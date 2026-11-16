import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Truck,
  PackageCheck,
  RotateCcw,
  Users,
  ArrowUpRight,
  Gift,
  Store,
  ShoppingBag,
  Boxes,
  Calculator,
  FileSpreadsheet,
  AlertTriangle,
  Scissors,
  Send,
  ClipboardList,
} from 'lucide-react';
import { TabType } from '../../types';
import { toLocalISODate } from '../../utils/date';

interface DashboardViewProps {
  setActiveTab: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const {
    intakes,
    products,
    dispatches,
    returns,
    customers,
    suppliers,
    branchStock,
    posSales,
    custodyTransfers,
    branchDeliveries,
    factorySettings,
    currentUser,
    hasAccess,
  } = useApp();

  const todayISO = toLocalISODate();

  const remainingLiveKg = intakes.reduce((sum, i) => sum + i.remainingLiveWeightKg, 0);
  const todayLiveIntakeKg = intakes
    .filter(i => i.date.slice(0, 10) === todayISO)
    .reduce((sum, i) => sum + i.netWeightKg, 0);
  const totalReadyStockKg = products.reduce((sum, p) => sum + p.inStockKg, 0);
  const totalReturnsKg = returns.reduce((sum, r) => sum + r.totalWeightKg, 0);
  const totalReturnsLoss = returns.reduce((sum, r) => sum + r.totalLossAmount, 0);
  const totalCustomerDebt = customers.reduce((sum, c) => sum + c.currentDebt, 0);
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + s.currentBalance, 0);

  const repSalesList = dispatches.filter(d => d.destinationType === 'REP');
  const todayRepSalesList = repSalesList.filter(d => d.date.slice(0, 10) === todayISO);
  const todayRepSalesKg = todayRepSalesList.reduce((sum, d) => sum + d.totalWeightKg, 0);
  const todayRepSalesIQD = todayRepSalesList.reduce((sum, d) => sum + d.totalAmount, 0);
  const repSalesKg = repSalesList.reduce((sum, d) => sum + d.totalWeightKg, 0);

  const giftKg = dispatches
    .filter(d => d.destinationType === 'GIFT')
    .reduce((sum, d) => sum + d.totalWeightKg, 0);

  const totalBranchStockKg = branchStock.reduce((sum, b) => sum + b.inStockKg, 0);
  const todayPOSSalesIQD = posSales
    .filter(s => s.date.slice(0, 10) === todayISO)
    .reduce((sum, s) => sum + s.total, 0);
  const totalPOSSalesIQD = posSales.reduce((sum, s) => sum + s.total, 0);

  // Check actual remaining custody weight per rep before issuing 3-day freshness warnings
  const repRemainingMap = new Map<string, number>();
  custodyTransfers.forEach(t => {
    if (t.holderType !== 'REP' || (t.status && t.status !== 'ACCEPTED')) return;
    const prev = repRemainingMap.get(t.holderName) || 0;
    repRemainingMap.set(
      t.holderName,
      t.direction === 'LOAD' ? prev + t.totalWeightKg : prev - t.totalWeightKg
    );
  });
  dispatches.forEach(d => {
    if ((d.destinationType === 'REP' || (d.destinationType === 'GIFT' && d.sourceCustody === 'REP')) && d.repName) {
      repRemainingMap.set(d.repName, (repRemainingMap.get(d.repName) || 0) - d.totalWeightKg);
    }
  });

  // Automatic 3-Day Freshness Expiry Alert (only when stock actually remains!)
  const freshWindowDays = factorySettings.returnWindowDays || 3;
  const todayMs = new Date(`${todayISO}T00:00:00`).getTime();
  const expiryWarnings = [
    ...(hasAccess('custody')
      ? custodyTransfers
          .filter(
            t =>
              t.direction === 'LOAD' &&
              (!t.status || t.status === 'ACCEPTED') &&
              (repRemainingMap.get(t.holderName) || 0) > 0.1
          )
          .map(t => {
            const dMs = new Date(t.date.slice(0, 10)).getTime();
            const ageDays = Number.isFinite(dMs) ? Math.floor((todayMs - dMs) / 86400000) : 0;
            return {
              id: t.id,
              label: `${t.holderName} • وەسڵ #${t.receiptNo}`,
              date: t.date,
              weightKg: t.totalWeightKg,
              ageDays,
              targetTab: 'custody' as TabType,
            };
          })
      : []),
    ...(hasAccess('pos')
      ? branchDeliveries
          .filter(() => totalBranchStockKg > 0.1)
          .map(b => {
            const dMs = new Date(b.date.slice(0, 10)).getTime();
            const ageDays = Number.isFinite(dMs) ? Math.floor((todayMs - dMs) / 86400000) : 0;
            return {
              id: b.id,
              label: `فرۆشگای شۆرۆم • وەسڵ #${b.manualReceiptNo}`,
              date: b.date,
              weightKg: b.totalWeightKg,
              ageDays,
              targetTab: 'pos' as TabType,
            };
          })
      : []),
    ...(hasAccess('custody') || hasAccess('pos')
      ? []
      : []),
  ].filter(w => w.ageDays >= Math.max(2, freshWindowDays - 1));

  // Low-Stock Alerts (Ready Warehouse & Showroom POS)
  const lowReadyProducts = hasAccess('ready-for-sale')
    ? products.filter(p => p.inStockKg < (p.minAlertKg ?? 100))
    : [];
  const lowBranchProducts = hasAccess('pos')
    ? branchStock.filter(b => b.inStockKg < (b.minAlertKg ?? 10))
    : [];

  // 7-Day Sales Overview (Rep Sales + Showroom POS)
  const last7DaysSales = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(`${todayISO}T00:00:00`);
    d.setDate(d.getDate() - (6 - idx));
    const iso = toLocalISODate(d);
    const repTotal = repSalesList
      .filter(s => s.date.slice(0, 10) === iso)
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const posTotal = posSales
      .filter(s => s.date.slice(0, 10) === iso)
      .reduce((sum, s) => sum + s.total, 0);
    return {
      iso,
      label: iso.slice(5),
      repTotal,
      posTotal,
      total: repTotal + posTotal,
    };
  });
  const max7DayTotal = Math.max(1, ...last7DaysSales.map(d => d.total));

  const formatIQD = (val: number) => `${val.toLocaleString()} د.ع`;

  const isCashier = currentUser.role === 'CASHIER';
  const isRep = currentUser.role === 'REP';
  const displayName = currentUser.role === 'SUPER_ADMIN' ? 'بەڕێوەبەری کارگە' : currentUser.name;
  const displayRole = currentUser.role === 'SUPER_ADMIN' ? 'بەڕێوەبەر' : currentUser.roleTitleKu;
  const displayEmoji = currentUser.role === 'SUPER_ADMIN' ? '👔' : currentUser.avatarEmoji || '👤';

  return (
    <div className="space-y-6">
      {/* Apple Control Center Hero Card */}
      <div className="apple-card p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#0071E3]/10 text-[#0071E3] px-3 py-1 rounded-full text-[11px] font-bold">
            <span>{displayEmoji}</span>
            <span>داشبۆردی زیرەک • {displayRole}</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-[#1D1D1F] tracking-tight mt-3">
            بەخێربێیت، {displayName}
          </h2>
          <p className="text-[#86868B] text-xs md:text-sm mt-1.5 max-w-2xl leading-relaxed">
            {isCashier
              ? 'کۆگا، فرۆشتنی خێرا بە بارکۆد و تەرازوو، وەسڵی 80mm و سەندوقی شۆرۆم.'
              : isRep
              ? 'بەڕێوەبردنی فرۆشی مەندوبان، دیاری و هەدیە، و گەڕاوەی ٣ ڕۆژ.'
              : 'بەڕێوەبردنی تەواوی وەرگرتنی زیندوو، مەندوبان، فرۆشگای POS، گەڕاوەی ٣ ڕۆژ و کەشف حساب.'}
          </p>
        </div>
      </div>

      {/* Role-Based Mobile Quick-Action Hub */}
      {(() => {
        const allQuickActions: {
          tab: TabType;
          label: string;
          sub: string;
          icon: React.ComponentType<{ className?: string }>;
          color: string;
          bg: string;
        }[] = [
          {
            tab: 'intake',
            label: 'وەرگرتنی زیندوو',
            sub: 'قۆناغی ١',
            icon: Truck,
            color: 'text-[#0071E3]',
            bg: 'bg-[#0071E3]/12',
          },
          {
            tab: 'production',
            label: 'سەربڕین و بەشکردن',
            sub: 'قۆناغی ٢',
            icon: Scissors,
            color: 'text-[#5856D6]',
            bg: 'bg-[#5856D6]/12',
          },
          {
            tab: 'ready-for-sale',
            label: 'کۆگای ئامادە',
            sub: 'قۆناغی ٣',
            icon: PackageCheck,
            color: 'text-[#248A3D]',
            bg: 'bg-[#34C759]/12',
          },
          {
            tab: 'custody',
            label: 'کۆگای مەندوب',
            sub: 'عەهدە و بار',
            icon: ClipboardList,
            color: 'text-[#B25000]',
            bg: 'bg-[#FF9500]/15',
          },
          {
            tab: 'rep-sales',
            label: 'فرۆشتنی مەندوب',
            sub: 'وەسڵ و گەڕاوە',
            icon: Send,
            color: 'text-[#0071E3]',
            bg: 'bg-[#0071E3]/12',
          },
          {
            tab: 'pos',
            label: 'فرۆشگای شۆرۆم POS',
            sub: 'کاشێر و قاسە',
            icon: ShoppingBag,
            color: 'text-[#248A3D]',
            bg: 'bg-[#34C759]/12',
          },
          {
            tab: 'gifts',
            label: 'دیاری و هەدیە',
            sub: 'بەخشین',
            icon: Gift,
            color: 'text-[#8944AB]',
            bg: 'bg-[#AF52DE]/12',
          },
          {
            tab: 'accounting',
            label: 'ژمێریاری و قەرز',
            sub: 'سەنەد و کەشف',
            icon: Calculator,
            color: 'text-[#0071E3]',
            bg: 'bg-[#0071E3]/12',
          },
          {
            tab: 'reports',
            label: 'ڕاپۆرت و P&L',
            sub: 'قازانج و تەسفییە',
            icon: FileSpreadsheet,
            color: 'text-[#B25000]',
            bg: 'bg-[#FF9500]/15',
          },
        ];
        const quickActions = allQuickActions.filter(a => hasAccess(a.tab));

        if (quickActions.length === 0) return null;

        return (
          <div className="lg:hidden space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold text-[#1D1D1F]">کردارە خێراکانی مۆبایل</h3>
              <span className="text-[11px] font-bold text-[#86868B]">{quickActions.length} بەش</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {quickActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.tab}
                    type="button"
                    onClick={() => setActiveTab(action.tab)}
                    className="apple-card p-3.5 text-right flex items-center gap-3 active:scale-[0.97] transition-transform"
                  >
                    <div className={`w-10 h-10 rounded-2xl ${action.bg} ${action.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#1D1D1F] truncate">{action.label}</div>
                      <div className="text-[10px] font-semibold text-[#86868B] mt-0.5">{action.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Automatic 3-Day Freshness Expiry Alert */}
      {expiryWarnings.length > 0 && (hasAccess('custody') || hasAccess('pos')) && (
        <div className="p-4 rounded-3xl bg-[#FF9500]/10 border border-[#FF9500]/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FF9500] text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#9A3412]">
                ئاگادارکردنەوەی ماوەی فرێش ({freshWindowDays} ڕۆژ): {expiryWarnings.length} باری مەندوب / شۆرۆم ماوەکەیان نزیکبووەتەوە یان تێپەڕیوە!
              </div>
              <div className="text-[11px] text-[#7C2D12] mt-0.5 flex flex-wrap gap-2">
                {expiryWarnings.slice(0, 3).map(w => (
                  <span key={w.id} className="bg-white/70 px-2 py-0.5 rounded-full font-bold">
                    {w.label} ({w.ageDays} ڕۆژ • {w.weightKg} کگم)
                  </span>
                ))}
              </div>
            </div>
          </div>
          {hasAccess('custody') && (
            <button
              type="button"
              onClick={() => setActiveTab('custody')}
              className="px-4 py-2 rounded-full bg-[#FF9500] hover:bg-[#E08600] text-white text-xs font-bold shrink-0 transition-all"
            >
              کۆگای مەندوب و گەڕاوە
            </button>
          )}
        </div>
      )}

      {/* Low-Stock Alert Banner (Factory Ready Stock & Showroom POS) */}
      {(lowReadyProducts.length > 0 || lowBranchProducts.length > 0) && (
        <div className="p-4 rounded-3xl bg-[#FF3B30]/8 border border-[#FF3B30]/25 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FF3B30] text-white flex items-center justify-center shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#B91C1C]">
                ئاگادارکردنەوەی کەمبوونی کۆگا: {lowReadyProducts.length} بەرهەمی کارگە و {lowBranchProducts.length} بەرهەمی شۆرۆم لە سنووری کەمیدان!
              </div>
              <div className="text-[11px] text-[#7F1D1D] mt-1 flex flex-wrap gap-1.5">
                {lowReadyProducts.slice(0, 4).map(p => (
                  <span key={p.id} className="bg-white/80 px-2 py-0.5 rounded-full font-bold">
                    کارگە: {p.nameKu} ({p.inStockKg.toLocaleString()} کگم)
                  </span>
                ))}
                {lowBranchProducts.slice(0, 4).map(b => (
                  <span key={b.productId} className="bg-white/80 px-2 py-0.5 rounded-full font-bold">
                    شۆرۆم: {b.productName} ({b.inStockKg.toFixed(1)} کگم)
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lowReadyProducts.length > 0 && hasAccess('ready-for-sale') && (
              <button
                type="button"
                onClick={() => setActiveTab('ready-for-sale')}
                className="px-3.5 py-2 rounded-full bg-[#FF3B30] hover:bg-[#DC2626] text-white text-xs font-bold transition-all"
              >
                کۆگای ئامادە
              </button>
            )}
            {lowBranchProducts.length > 0 && hasAccess('pos') && (
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="px-3.5 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-bold transition-all"
              >
                کۆگای شۆرۆم
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bento KPI Grid (Strictly RBAC Filtered) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasAccess('intake') && (
          <button
            type="button"
            onClick={() => setActiveTab('intake')}
            className="apple-card apple-card-hover p-5 text-right"
          >
            <div className="flex items-center justify-between text-[#86868B] mb-3">
              <span className="text-xs font-semibold">مەخزەنی زیندوو (چاوەڕێی سەربڕین)</span>
              <div className="w-8 h-8 rounded-full bg-[#FF9500]/12 text-[#FF9500] flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#1D1D1F] tabular-nums">
              {remainingLiveKg.toLocaleString()}{' '}
              <span className="text-xs font-medium text-[#86868B]">کگم</span>
            </div>
            <div className="text-xs text-[#86868B] mt-3 pt-2.5 border-t border-black/[0.05] flex items-center justify-between">
              <span>هاتووی ئەمڕۆ:</span>
              <span className="font-bold text-[#1D1D1F] tabular-nums">{todayLiveIntakeKg.toLocaleString()} کگم</span>
            </div>
          </button>
        )}

        {hasAccess('rep-sales') && (
          <button
            type="button"
            onClick={() => setActiveTab('rep-sales')}
            className="apple-card apple-card-hover p-5 text-right"
          >
            <div className="flex items-center justify-between text-[#86868B] mb-3">
              <span className="text-xs font-semibold">فرۆشی مەندوبەکان (ئەمڕۆ)</span>
              <div className="w-8 h-8 rounded-full bg-[#34C759]/12 text-[#248A3D] flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#1D1D1F] tabular-nums">
              {todayRepSalesKg.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">کگم</span>
            </div>
            <div className="text-xs text-[#86868B] mt-3 pt-2.5 border-t border-black/[0.05] flex items-center justify-between">
              <span>داهاتی ئەمڕۆ:</span>
              <span className="font-bold text-[#248A3D] tabular-nums">{formatIQD(todayRepSalesIQD)}</span>
            </div>
          </button>
        )}

        {hasAccess('pos') && (
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="apple-card apple-card-hover p-5 text-right"
          >
            <div className="flex items-center justify-between text-[#86868B] mb-3">
              <span className="text-xs font-semibold">فرۆشی شۆرۆم (ئەمڕۆ)</span>
              <div className="w-8 h-8 rounded-full bg-[#0071E3]/12 text-[#0071E3] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#0071E3] tabular-nums">
              {formatIQD(todayPOSSalesIQD)}
            </div>
            <div className="text-xs text-[#86868B] mt-3 pt-2.5 border-t border-black/[0.05] flex items-center justify-between">
              <span>کۆی گشتی / کۆگا:</span>
              <span className="font-bold text-[#1D1D1F] tabular-nums">{formatIQD(totalPOSSalesIQD)} • {totalBranchStockKg.toFixed(1)} کگم</span>
            </div>
          </button>
        )}

        {isCashier && (
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="apple-card apple-card-hover p-5 text-right"
          >
            <div className="flex items-center justify-between text-[#86868B] mb-3">
              <span className="text-xs font-semibold">مەخزەنی سەلاجەی فرۆشگا</span>
              <div className="w-8 h-8 rounded-full bg-[#34C759]/12 text-[#248A3D] flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#248A3D] tabular-nums">
              {totalBranchStockKg.toFixed(1)} <span className="text-xs font-medium text-[#86868B]">کگم</span>
            </div>
            <div className="text-xs text-[#86868B] mt-3 pt-2.5 border-t border-black/[0.05] flex items-center justify-between">
              <span>ژمارەی وەسڵەکان:</span>
              <span className="font-bold text-[#1D1D1F] tabular-nums">{posSales.length} وەسڵ</span>
            </div>
          </button>
        )}

        {(hasAccess('rep-sales') || hasAccess('ready-for-sale')) && (
          <button
            type="button"
            onClick={() => setActiveTab(hasAccess('rep-sales') ? 'rep-sales' : 'ready-for-sale')}
            className="apple-card apple-card-hover p-5 text-right"
          >
            <div className="flex items-center justify-between text-[#86868B] mb-3">
              <span className="text-xs font-semibold">گەڕاوە و تەلەفی ٣ ڕۆژ</span>
              <div className="w-8 h-8 rounded-full bg-[#FF3B30]/12 text-[#FF3B30] flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#FF3B30] tabular-nums">
              {totalReturnsKg.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">کگم</span>
            </div>
            <div className="text-xs text-[#86868B] mt-3 pt-2.5 border-t border-black/[0.05] flex items-center justify-between">
              <span>زیانی تەلەف:</span>
              <span className="font-bold text-[#FF3B30] tabular-nums">-{formatIQD(totalReturnsLoss)}</span>
            </div>
          </button>
        )}

        {hasAccess('accounting') && (
          <button
            type="button"
            onClick={() => setActiveTab('accounting')}
            className="apple-card apple-card-hover p-5 text-right"
          >
            <div className="flex items-center justify-between text-[#86868B] mb-3">
              <span className="text-xs font-semibold">قەرزی بازاڕ (مارکێتەکان)</span>
              <div className="w-8 h-8 rounded-full bg-[#5856D6]/12 text-[#5856D6] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#5856D6] tabular-nums">
              {formatIQD(totalCustomerDebt)}
            </div>
            <div className="text-xs text-[#86868B] mt-3 pt-2.5 border-t border-black/[0.05] flex items-center justify-between">
              <span>قەرزی کێڵگەکان:</span>
              <span className="font-bold text-[#FF9500] tabular-nums">{formatIQD(totalSupplierDebt)}</span>
            </div>
          </button>
        )}
      </div>

      {/* Role-Specific Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hasAccess('ready-for-sale') && (
          <button
            type="button"
            onClick={() => setActiveTab('ready-for-sale')}
            className="apple-card apple-card-hover p-5 text-right flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-1 rounded-full">
                  ئامادە بۆ فرۆشتن
                </span>
                <PackageCheck className="w-4 h-4 text-[#0071E3]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">کۆگای بەرهەمە ئامادەکان</h3>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                ئامادەکردنی باری کێڵگە و فرۆشتنی ڕاستەوخۆی بەرهەمە پاککراوەکان لە کارگەوە.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs w-full">
              <span className="text-[#86868B]">کۆی بەرهەمی ئامادە:</span>
              <span className="font-bold text-[#1D1D1F] tabular-nums">{totalReadyStockKg.toLocaleString()} کگم</span>
            </div>
          </button>
        )}

        {hasAccess('rep-sales') && (
          <button
            type="button"
            onClick={() => setActiveTab('rep-sales')}
            className="apple-card apple-card-hover p-5 text-right flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-1 rounded-full">
                  فرۆشتنی مەندوب و گەڕاوە
                </span>
                <Truck className="w-4 h-4 text-[#0071E3]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">فرۆش و گەڕاوەی ٣ ڕۆژ</h3>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                تۆمارکردنی فرۆشی مەندوب بە وەسڵی دەستی و گەڕاوەی تەلەف بە هەمان ژمارەی وەسڵ.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs w-full">
              <span className="text-[#86868B]">کۆی باری فرۆشراو:</span>
              <span className="font-bold text-[#1D1D1F] tabular-nums">{repSalesKg.toLocaleString()} کگم</span>
            </div>
          </button>
        )}

        {hasAccess('pos') && (
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className="apple-card apple-card-hover p-5 text-right flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#248A3D] bg-[#34C759]/12 px-2.5 py-1 rounded-full">
                  فرۆشگای تایبەت (شۆرۆم)
                </span>
                <Store className="w-4 h-4 text-[#34C759]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">پۆسی کاشێر و کۆگای بارکۆد</h3>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                داخلکردنی کۆگا و فرۆشتن بە سکانەری بارکۆد و تەرازوو لەگەڵ وەسڵی 80mm.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs w-full">
              <span className="text-[#86868B]">کۆگای شۆرۆم:</span>
              <span className="font-bold text-[#1D1D1F] tabular-nums">{totalBranchStockKg.toFixed(1)} کگم</span>
            </div>
          </button>
        )}

        {hasAccess('gifts') && (
          <button
            type="button"
            onClick={() => setActiveTab('gifts')}
            className="apple-card apple-card-hover p-5 text-right flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#AF52DE] bg-[#AF52DE]/12 px-2.5 py-1 rounded-full">
                  دیاری و هەدیە
                </span>
                <Gift className="w-4 h-4 text-[#AF52DE]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">هەدیە و نموونەی بەلاش</h3>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                دەرکردنی بەرهەم بە نرخی ٠ دینار بە وەسڵی فەرمی لە کۆگای کارگە.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs w-full">
              <span className="text-[#86868B]">کۆی بەخشراو:</span>
              <span className="font-bold text-[#AF52DE] tabular-nums">{giftKg.toLocaleString()} کگم</span>
            </div>
          </button>
        )}

        {hasAccess('accounting') && (
          <button
            type="button"
            onClick={() => setActiveTab('accounting')}
            className="apple-card apple-card-hover p-5 text-right flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#5856D6] bg-[#5856D6]/12 px-2.5 py-1 rounded-full">
                  ژمێریاری و سافکردن
                </span>
                <Calculator className="w-4 h-4 text-[#5856D6]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">کەشف حساب و سەنەدات</h3>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                سافکردنی قەرز بە کات و بەروار، دەرهێنانی کەشف حساب بە ناو یان بەروار بۆ بەروار.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs w-full">
              <span className="text-[#86868B]">قەرزی مارکێتەکان:</span>
              <span className="font-bold text-[#5856D6] tabular-nums">{formatIQD(totalCustomerDebt)}</span>
            </div>
          </button>
        )}

        {hasAccess('reports') && (
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="apple-card apple-card-hover p-5 text-right flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-[#FF9500] bg-[#FF9500]/12 px-2.5 py-1 rounded-full">
                  قازانج و خەرجی (P&L)
                </span>
                <FileSpreadsheet className="w-4 h-4 text-[#FF9500]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">ڕاپۆرتی دارایی گشتی</h3>
              <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                پوختەی داهات، تێچووی کێڵگە، تەلەفی ٣ ڕۆژ، خەرجی کارگە و قازانجی خاوێن.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-black/[0.05] flex items-center justify-between text-xs w-full">
              <span className="text-[#86868B]">تەلەفی ٣ ڕۆژ:</span>
              <span className="font-bold text-[#FF3B30] tabular-nums">-{formatIQD(totalReturnsLoss)}</span>
            </div>
          </button>
        )}
      </div>

      {/* 7-Day Sales Performance Chart */}
      {(hasAccess('rep-sales') || hasAccess('pos')) && (
        <div className="apple-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">
                چالاکی و فرۆشتنی ٧ ڕۆژی ڕابردوو (مەندوب + شۆرۆم)
              </h3>
              <p className="text-[11px] text-[#86868B]">
                بەراوردی داهاتی ڕۆژانەی فرۆشتن لە ماوەی هەفتەیەکدا
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 text-[#0071E3]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0071E3]" />
                شۆرۆم (POS)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#34C759]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#34C759]" />
                مەندوب
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-36 pt-3">
            {last7DaysSales.map(day => {
              const totalPct = Math.round((day.total / max7DayTotal) * 100);
              const repPct = day.total > 0 ? Math.round((day.repTotal / day.total) * 100) : 0;
              return (
                <div key={day.iso} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="text-[10px] font-bold text-[#515154] tabular-nums truncate max-w-full">
                    {day.total > 0 ? `${Math.round(day.total / 1000)}k` : '0'}
                  </div>
                  <div className="w-full max-w-[36px] flex-1 flex items-end bg-[#F5F5F7] rounded-xl overflow-hidden p-0.5">
                    <div
                      className="w-full rounded-lg overflow-hidden flex flex-col justify-end transition-all"
                      style={{ height: `${Math.max(day.total > 0 ? 12 : 4, totalPct)}%` }}
                      title={`${day.iso}: مەندوب ${day.repTotal.toLocaleString()} د.ع • شۆرۆم ${day.posTotal.toLocaleString()} د.ع`}
                    >
                      <div
                        className="w-full bg-[#0071E3]"
                        style={{ height: `${100 - repPct}%` }}
                      />
                      <div
                        className="w-full bg-[#34C759]"
                        style={{ height: `${repPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono font-semibold text-[#86868B]">{day.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
