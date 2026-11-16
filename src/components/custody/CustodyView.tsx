import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ClipboardList,
  Plus,
  Send,
  RotateCcw,
  User,
  CheckCircle,
  AlertCircle,
  Trash2,
  X,
  ArrowRight,
  Clock,
  Printer,
  Calendar,
  Barcode,
} from 'lucide-react';
import { CustodyTransfer, TabType } from '../../types';
import { toLocalISODate } from '../../utils/date';

interface CustodyViewProps {
  onNavigate?: (tab: TabType) => void;
}

interface ProductBreakdown {
  productId: string;
  productName: string;
  loadedKg: number;
  soldKg: number;
  returnedKg: number;
  remainingKg: number;
}

interface HolderSummary {
  holderType: 'REP';
  holderName: string;
  loadedKg: number;
  soldKg: number;
  returnedKg: number;
  remainingKg: number;
  products: ProductBreakdown[];
}

export const CustodyView: React.FC<CustodyViewProps> = ({ onNavigate }) => {
  const {
    products,
    dispatches,
    returns,
    vouchers,
    custodyTransfers,
    loadToRepCustody,
    returnUnsoldToReadyStock,
    acceptCustodyTransfer,
    rejectCustodyTransfer,
    parseWeightBarcode,
    currentUser,
    repNames,
    factorySettings,
  } = useApp();

  const isWarehouseAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';
  const isRepUser = currentUser.role === 'REP';

  const [selectedFilterHolder, setSelectedFilterHolder] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTransferForPrint, setSelectedTransferForPrint] = useState<CustodyTransfer | null>(null);
  const [reportHolder, setReportHolder] = useState<HolderSummary | null>(null);
  const [reportDate, setReportDate] = useState<string>(toLocalISODate());

  // Modal 1: Load / Send from Ready Stock onto Rep Custody Account
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadHolderKey, setLoadHolderKey] = useState<string>(repNames[0] || '');
  const [loadReceiptNo, setLoadReceiptNo] = useState('');
  const [loadDate, setLoadDate] = useState(toLocalISODate());
  const [loadTime, setLoadTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
  const [loadNotes, setLoadNotes] = useState('');
  const [loadProductId, setLoadProductId] = useState(products[0]?.id || '');
  const [loadWeight, setLoadWeight] = useState<number | ''>('');
  const [loadScannerInput, setLoadScannerInput] = useState('');
  const [loadItems, setLoadItems] = useState<
    { productId: string; productName: string; weightKg: number }[]
  >([]);

  // Modal 2: Return Unsold Stock from Rep or Store Back to Ready Stock
  const [returnTarget, setReturnTarget] = useState<HolderSummary | null>(null);
  const [returnReceiptNo, setReturnReceiptNo] = useState('');
  const [returnWeights, setReturnWeights] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState('');

  // Compute full custody balance per Rep + Dedicated Store (Branch)
  const holderSummaries: HolderSummary[] = useMemo(() => {
    const repNamesSet = new Set<string>(repNames);
    custodyTransfers
      .filter(t => t.holderType === 'REP')
      .forEach(t => repNamesSet.add(t.holderName));
    dispatches
      .filter(d => (d.destinationType === 'REP' || d.sourceCustody === 'REP') && d.repName)
      .forEach(d => repNamesSet.add(d.repName!));

    const repSummaries: HolderSummary[] = Array.from(repNamesSet).map(repName => {
      const breakdown: ProductBreakdown[] = products
        .map(p => {
          const loadedKg = custodyTransfers
            .filter(
              t =>
                t.holderType === 'REP' &&
                t.holderName === repName &&
                t.direction === 'LOAD' &&
                (!t.status || t.status === 'ACCEPTED')
            )
            .reduce(
              (s, t) =>
                s +
                t.items
                  .filter(i => i.productId === p.id)
                  .reduce((is, i) => is + i.weightKg, 0),
              0
            );

          const soldKg = dispatches
            .filter(
              d =>
                (d.destinationType === 'REP' ||
                  (d.destinationType === 'GIFT' && d.sourceCustody === 'REP')) &&
                (d.repName || '') === repName
            )
            .reduce(
              (s, d) =>
                s +
                d.items
                  .filter(i => i.productId === p.id)
                  .reduce((is, i) => is + i.weightKg, 0),
              0
            );

          const returnedKg = custodyTransfers
            .filter(
              t =>
                t.holderType === 'REP' &&
                t.holderName === repName &&
                t.direction === 'RETURN_TO_READY' &&
                (!t.status || t.status === 'ACCEPTED')
            )
            .reduce(
              (s, t) =>
                s +
                t.items
                  .filter(i => i.productId === p.id)
                  .reduce((is, i) => is + i.weightKg, 0),
              0
            );

          const remainingKg = Math.max(0, Number((loadedKg - soldKg - returnedKg).toFixed(2)));
          return {
            productId: p.id,
            productName: p.nameKu,
            loadedKg: Number(loadedKg.toFixed(2)),
            soldKg: Number(soldKg.toFixed(2)),
            returnedKg: Number(returnedKg.toFixed(2)),
            remainingKg,
          };
        })
        .filter(b => b.loadedKg > 0 || b.soldKg > 0 || b.returnedKg > 0 || b.remainingKg > 0);

      const loadedKg = Number(breakdown.reduce((s, b) => s + b.loadedKg, 0).toFixed(2));
      const soldKg = Number(breakdown.reduce((s, b) => s + b.soldKg, 0).toFixed(2));
      const returnedKg = Number(breakdown.reduce((s, b) => s + b.returnedKg, 0).toFixed(2));
      const remainingKg = Number(breakdown.reduce((s, b) => s + b.remainingKg, 0).toFixed(2));

      return {
        holderType: 'REP',
        holderName: repName,
        loadedKg,
        soldKg,
        returnedKg,
        remainingKg,
        products: breakdown,
      };
    });

    return repSummaries;
  }, [products, custodyTransfers, dispatches, repNames]);

  // Overall Totals
  const totalLoadedAll = Number(
    holderSummaries.reduce((s, h) => s + h.loadedKg, 0).toFixed(2)
  );
  const totalSoldAll = Number(
    holderSummaries.reduce((s, h) => s + h.soldKg, 0).toFixed(2)
  );
  const totalReturnedAll = Number(
    holderSummaries.reduce((s, h) => s + h.returnedKg, 0).toFixed(2)
  );
  const totalRemainingAll = Number(
    holderSummaries.reduce((s, h) => s + h.remainingKg, 0).toFixed(2)
  );

  // --- Load Modal Handlers ---
  const handleOpenLoadModal = (defaultHolder?: string) => {
    const holder = defaultHolder || repNames[0] || 'مەندوب';
    setLoadHolderKey(holder);
    let nextNum = 110 + custodyTransfers.length + 1;
    while (custodyTransfers.some(t => t.receiptNo.trim().toLowerCase() === `ld-${nextNum}`)) {
      nextNum += 1;
    }
    setLoadReceiptNo(`LD-${nextNum}`);
    setLoadDate(toLocalISODate());
    setLoadTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    setLoadNotes('');
    setLoadItems([]);
    setLoadProductId(products[0]?.id || '');
    setLoadWeight('');
    setShowLoadModal(true);
  };

  const handleScanLoadBarcode = () => {
    const raw = loadScannerInput.trim();
    if (!raw) return;
    const decoded = parseWeightBarcode(raw);
    if (!decoded.valid || !decoded.product) {
      alert('بارکۆد نەناسراوە یان هەڵەیە!');
      setLoadScannerInput('');
      return;
    }
    const prod = decoded.product;
    const weight = decoded.weightKg > 0 ? decoded.weightKg : 1;
    const alreadyQueued = loadItems
      .filter(i => i.productId === prod.id)
      .reduce((s, i) => s + i.weightKg, 0);
    const pendingLoadKg = custodyTransfers
      .filter(t => t.direction === 'LOAD' && t.status === 'PENDING')
      .reduce(
        (s, t) =>
          s + t.items.filter(i => i.productId === prod.id).reduce((is, i) => is + i.weightKg, 0),
        0
      );
    const availableStock = Math.max(0, prod.inStockKg - pendingLoadKg);
    if (alreadyQueued + weight > availableStock) {
      alert(
        `بڕی پێویست لە کۆگای ئامادەدا نییە! تەنها ${(availableStock - alreadyQueued).toFixed(1)} کگم ماوە`
      );
      setLoadScannerInput('');
      return;
    }
    setLoadItems(prev => [...prev, { productId: prod.id, productName: prod.nameKu, weightKg: weight }]);
    setLoadScannerInput('');
  };

  const handleAddLoadItem = () => {
    const prod = products.find(p => p.id === loadProductId);
    const weight = Number(loadWeight);
    if (!prod || !weight || weight <= 0) {
      alert('تکایە بەرهەم و کێش بنووسە');
      return;
    }

    const alreadyQueued = loadItems
      .filter(i => i.productId === prod.id)
      .reduce((s, i) => s + i.weightKg, 0);
    const pendingLoadKg = custodyTransfers
      .filter(t => t.direction === 'LOAD' && t.status === 'PENDING')
      .reduce(
        (s, t) =>
          s + t.items.filter(i => i.productId === prod.id).reduce((is, i) => is + i.weightKg, 0),
        0
      );
    const availableStock = Math.max(0, prod.inStockKg - pendingLoadKg);
    if (alreadyQueued + weight > availableStock) {
      alert(
        `بڕی پێویست لە کۆگای ئامادەدا نییە! تەنها ${(availableStock - alreadyQueued).toFixed(
          1
        )} کگم ماوە`
      );
      return;
    }

    setLoadItems(prev => [...prev, { productId: prod.id, productName: prod.nameKu, weightKg: weight }]);
    setLoadWeight('');
  };

  const handleSubmitLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReceipt = loadReceiptNo.trim();
    if (!cleanReceipt || loadItems.length === 0) {
      alert('تکایە ژمارەی وەسڵ و بەلایەنی کەم یەک بەرهەم زیاد بکە');
      return;
    }
    if (custodyTransfers.some(t => t.receiptNo.trim().toLowerCase() === cleanReceipt.toLowerCase())) {
      alert(`ڕێگری لە دووبارەبوونەوە:\nوەسڵی ژمارە "${cleanReceipt}" پێشتر تۆمارکراوە! تکایە ژمارەیەکی تر بنووسە.`);
      return;
    }

    const totalKg = Number(loadItems.reduce((s, i) => s + i.weightKg, 0).toFixed(2));

    loadToRepCustody({
      receiptNo: loadReceiptNo.trim(),
      date: loadDate,
      time: loadTime,
      holderType: 'REP',
      holderName: loadHolderKey,
      items: loadItems,
      totalWeightKg: totalKg,
      notes: loadNotes.trim() || `ناردنی ڕۆژانە بۆ کۆگای ${loadHolderKey}`,
    });

    setShowLoadModal(false);
  };

  // --- Return Unsold Modal Handlers ---
  const handleOpenReturnModal = (holder: HolderSummary) => {
    setReturnTarget(holder);
    setReturnReceiptNo(`RET-ST-${Math.floor(100 + Math.random() * 900)}`);
    const initial: Record<string, number> = {};
    holder.products.forEach(p => {
      if (p.remainingKg > 0) {
        initial[p.productId] = p.remainingKg;
      }
    });
    setReturnWeights(initial);
    setReturnNotes('');
  };

  const totalReturnBackKg = Number(
    Object.values(returnWeights)
      .reduce((s, w) => s + (w || 0), 0)
      .toFixed(2)
  );

  const handleSubmitReturnUnsold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;

    const itemsToReturn = returnTarget.products
      .filter(p => (returnWeights[p.productId] || 0) > 0)
      .map(p => ({
        productId: p.productId,
        productName: p.productName,
        weightKg: Number(returnWeights[p.productId]),
      }));

    if (itemsToReturn.length === 0) {
      alert('تکایە کێشی گەڕانەوە بنووسە');
      return;
    }

    for (const item of itemsToReturn) {
      const orig = returnTarget.products.find(p => p.productId === item.productId);
      if (orig && item.weightKg > orig.remainingKg) {
        alert(
          `کێشی گەڕانەوەی ${item.productName} (${item.weightKg} کگم) ناتوانێت لە بڕی ماوەی سەر حساب (${orig.remainingKg} کگم) زیاتر بێت!`
        );
        return;
      }
    }

    const cleanReturnReceipt = returnReceiptNo.trim() || `RET-${Date.now()}`;
    if (custodyTransfers.some(t => t.receiptNo.trim().toLowerCase() === cleanReturnReceipt.toLowerCase())) {
      alert(`ڕێگری لە دووبارەبوونەوە:\nوەسڵی ژمارە "${cleanReturnReceipt}" پێشتر تۆمارکراوە! تکایە ژمارەیەکی تر بنووسە.`);
      return;
    }

    returnUnsoldToReadyStock({
      receiptNo: cleanReturnReceipt,
      date: toLocalISODate(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      holderType: returnTarget.holderType,
      holderName: returnTarget.holderName,
      items: itemsToReturn,
      totalWeightKg: totalReturnBackKg,
      notes:
        returnNotes.trim() ||
        `گەڕانەوەی باری نەفرۆشراو لە ${returnTarget.holderName} بۆ کۆگای ئامادە`,
    });

    setReturnTarget(null);
  };

  const filteredSummaries =
    selectedFilterHolder === 'ALL'
      ? holderSummaries
      : holderSummaries.filter(h => h.holderName === selectedFilterHolder);

  // Unified chronological ledger of Load & Return back to Ready Stock
  const filteredTransfers = custodyTransfers.filter(t => {
    const matchesHolder = selectedFilterHolder === 'ALL' || t.holderName === selectedFilterHolder;
    const matchesStart = !startDate || t.date.slice(0, 10) >= startDate;
    const matchesEnd = !endDate || t.date.slice(0, 10) <= endDate;
    return matchesHolder && matchesStart && matchesEnd;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="apple-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0071E3]/12 text-[#0071E3] flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#1D1D1F] tracking-tight">
              ٤. کۆگای مەندوب
            </h2>
            <p className="text-xs text-[#86868B] mt-0.5">
              بارکردنی گۆشت لە کۆگای ئامادەوە بۆ سەر کۆگای مەندوبەکان، بەدواداچوونی فرۆشراو، و گەڕاندنەوەی نەفرۆشراو
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenLoadModal()}
            className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-xs rounded-full shadow-sm shadow-[#0071E3]/25 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            ناردن بۆ کۆگای مەندوب
          </button>
        </div>
      </div>

      {/* Zero-Loss Balance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">کۆی نێردراو بۆ کۆگای مەندوب</span>
          <div className="text-2xl font-black text-[#1D1D1F] tabular-nums mt-2">
            {totalLoadedAll.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#0071E3] font-semibold mt-1">
            نێردراوە لە کۆگای ئامادەوە
          </div>
        </div>

        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">فرۆشراو بە وەسڵ (تەسفیەکراو)</span>
          <div className="text-2xl font-black text-[#248A3D] tabular-nums mt-2">
            {totalSoldAll.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#248A3D] font-medium mt-1">
            فرۆشی مەندوبەکان بە وەسڵ
          </div>
        </div>

        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">گەڕێنراوە بۆ کۆگای ئامادە</span>
          <div className="text-2xl font-black text-[#5856D6] tabular-nums mt-2">
            {totalReturnedAll.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#86868B] font-medium mt-1">
            باری نەفرۆشراو گەڕاوەتەوە کۆگا
          </div>
        </div>

        <div className="apple-card p-5 border-[#FF9500]/30">
          <span className="text-xs font-semibold text-[#B25000]">
            نەفرۆشراوی ماوە لەسەر حساب
          </span>
          <div className="text-2xl font-black text-[#FF9500] tabular-nums mt-2">
            {totalRemainingAll.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#B25000] font-semibold mt-1">
            بە تەواوی لەسەر مەندوبەکان دیارە
          </div>
        </div>
      </div>

      {/* Pending Acceptance Panel (Two-Way Approval: Rep accepts LOAD, Warehouse Admin accepts RETURN) */}
      {(() => {
        const pendingList = custodyTransfers.filter(t => t.status === 'PENDING');
        if (pendingList.length === 0) return null;
        return (
          <div className="apple-card p-5 border-[#FF9500]/35 bg-[#FF9500]/[0.04] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF9500] text-white flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#9A3412]">
                    داواکارییە چاوەڕوانەکانی ئەکسیپت ({pendingList.length})
                  </h3>
                  <p className="text-[11px] text-[#7C2D12]">
                    هیچ بارێک ناچێتە سەر حساب تا لایەنی وەرگر لە ئەکاونتی خۆیەوە ئەکسیپتی نەکات
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pendingList.map(t => {
                const canAcceptLoad = t.direction === 'LOAD' && isRepUser;
                const canAcceptReturn = t.direction === 'RETURN_TO_READY' && isWarehouseAdmin;
                const canRespond = canAcceptLoad || canAcceptReturn;
                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl p-4 border border-black/[0.06] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-[#0071E3]/10 text-[#0071E3] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                            {t.receiptNo}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.direction === 'LOAD'
                                ? 'bg-[#0071E3]/10 text-[#0071E3]'
                                : 'bg-[#5856D6]/12 text-[#5856D6]'
                            }`}
                          >
                            {t.direction === 'LOAD'
                              ? 'ناردن بۆ کۆگای مەندوب'
                              : 'گەڕانەوە بۆ کۆگای ئامادە'}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-[#1D1D1F] mt-1.5">
                          {t.holderName}
                        </div>
                        <div className="text-[11px] text-[#86868B] mt-0.5">
                          داواکار: {t.requestedBy || '---'} • {t.date} • {t.time}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-black text-[#FF9500] tabular-nums">
                          {t.totalWeightKg} کگم
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#515154] bg-[#F5F5F7] rounded-xl px-3 py-2">
                      {t.items.map(i => `${i.productName} (${i.weightKg} کگم)`).join('، ')}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      {canRespond ? (
                        <>
                          <button
                            type="button"
                            onClick={() => acceptCustodyTransfer(t.id)}
                            className="flex-1 py-2 rounded-full bg-[#34C759] hover:bg-[#248A3D] text-white text-xs font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t.direction === 'LOAD' ? 'ئەکسیپت و وەرگرتن' : 'ئەکسیپتی گەڕانەوە'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const r = window.prompt('هۆکاری ڕەتکردنەوە (ئارەزوومەندانە):') || undefined;
                              rejectCustodyTransfer(t.id, r);
                            }}
                            className="px-4 py-2 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white text-xs font-bold transition-all"
                          >
                            ڕەتکردنەوە
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-[#B25000] bg-[#FF9500]/10 px-3 py-1.5 rounded-full">
                          {t.direction === 'LOAD'
                            ? 'چاوەڕوانی ئەکسیپتی مەندوبە لە ئەکاونتی خۆیەوە'
                            : 'چاوەڕوانی ئەکسیپتی بەڕێوەبەری کۆگایە'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Filter Pills by Account */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedFilterHolder('ALL')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedFilterHolder === 'ALL'
              ? 'bg-[#1D1D1F] text-white'
              : 'bg-white text-[#515154] border border-black/[0.06] hover:bg-[#F5F5F7]'
          }`}
        >
          هەموو حسابەکان ({holderSummaries.length})
        </button>
        {holderSummaries.map(h => (
          <button
            key={h.holderName}
            type="button"
            onClick={() => setSelectedFilterHolder(h.holderName)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedFilterHolder === h.holderName
                ? 'bg-[#0071E3] text-white'
                : 'bg-white text-[#515154] border border-black/[0.06] hover:bg-[#F5F5F7]'
            }`}
          >
            <User className="w-3 h-3" />
            <span>{h.holderName.split(' (')[0]}</span>
            {h.remainingKg > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedFilterHolder === h.holderName
                    ? 'bg-white/25 text-white'
                    : 'bg-[#FF9500]/15 text-[#B25000]'
                }`}
              >
                {h.remainingKg} کگم
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Per-Account Custody Reconciliation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredSummaries.map(holder => {
          const hasRemaining = holder.remainingKg > 0;
          const freshWindowDays = factorySettings.returnWindowDays || 3;
          const todayMs = new Date(`${toLocalISODate()}T00:00:00`).getTime();
          const maxAgeDays = hasRemaining
            ? custodyTransfers
                .filter(
                  t =>
                    t.holderName === holder.holderName &&
                    t.direction === 'LOAD' &&
                    (!t.status || t.status === 'ACCEPTED')
                )
                .reduce((maxD, t) => {
                  const dMs = new Date(`${t.date.slice(0, 10)}T00:00:00`).getTime();
                  const age = Number.isFinite(dMs) ? Math.max(0, Math.floor((todayMs - dMs) / 86400000)) : 0;
                  return Math.max(maxD, age);
                }, 0)
            : 0;
          const showFreshAlert = hasRemaining && maxAgeDays >= Math.max(2, freshWindowDays - 1);
          return (
            <div key={holder.holderName} className="apple-card p-5 flex flex-col justify-between gap-4">
              <div>
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.05]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-[#0071E3]/12 text-[#0071E3]">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#1D1D1F]">{holder.holderName}</h3>
                      <span className="text-[10px] text-[#86868B] font-semibold">
                        حسابی عەهدەی مەندوب
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {showFreshAlert && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                          maxAgeDays >= freshWindowDays
                            ? 'bg-[#FF3B30]/12 text-[#D70015]'
                            : 'bg-[#FF9500]/15 text-[#B25000]'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        فرێشی: {maxAgeDays} ڕۆژ
                      </span>
                    )}
                    {hasRemaining ? (
                      <span className="inline-flex items-center gap-1 bg-[#FF9500]/15 text-[#B25000] px-3 py-1 rounded-full text-[11px] font-black w-fit tabular-nums">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {holder.remainingKg.toLocaleString()} کگم لەسەر حساب ماوە
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-[#34C759]/12 text-[#248A3D] px-3 py-1 rounded-full text-[11px] font-bold w-fit">
                        <CheckCircle className="w-3.5 h-3.5" />
                        تەسفیەکراوە (٠ کگم)
                      </span>
                    )}
                  </div>
                </div>

                {/* 4-Column Reconciliation Summary */}
                <div className="grid grid-cols-4 gap-2 my-3 text-center">
                  <div className="p-2.5 rounded-xl bg-[#F5F5F7]">
                    <div className="text-[10px] text-[#86868B]">نێردراو</div>
                    <div className="text-xs font-black text-[#1D1D1F] tabular-nums mt-0.5">
                      {holder.loadedKg} کگم
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#34C759]/8">
                    <div className="text-[10px] text-[#248A3D]">فرۆشراو</div>
                    <div className="text-xs font-black text-[#248A3D] tabular-nums mt-0.5">
                      {holder.soldKg} کگم
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#5856D6]/8">
                    <div className="text-[10px] text-[#5856D6]">گەڕێنراوە</div>
                    <div className="text-xs font-black text-[#5856D6] tabular-nums mt-0.5">
                      {holder.returnedKg} کگم
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FF9500]/10">
                    <div className="text-[10px] text-[#B25000]">ماوە</div>
                    <div className="text-xs font-black text-[#FF9500] tabular-nums mt-0.5">
                      {holder.remainingKg} کگم
                    </div>
                  </div>
                </div>

                {/* Product-by-Product Custody Breakdown */}
                {holder.products.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#86868B] bg-[#FBFBFD] rounded-2xl">
                    هێشتا هیچ بارێک نەنێردراوەتە سەر ئەم حسابە
                  </div>
                ) : (
                  <div className="rounded-2xl border border-black/[0.06] overflow-hidden">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-[#F5F5F7] text-[#515154] font-bold">
                        <tr>
                          <th className="p-2.5">بەرهەم</th>
                          <th className="p-2.5 text-center">نێردراو</th>
                          <th className="p-2.5 text-center">فرۆشراو</th>
                          <th className="p-2.5 text-center">گەڕێنراوە</th>
                          <th className="p-2.5 text-center">ماوە لەسەر حساب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04]">
                        {holder.products.map(p => (
                          <tr key={p.productId}>
                            <td className="p-2.5 font-bold text-[#1D1D1F]">{p.productName}</td>
                            <td className="p-2.5 text-center tabular-nums">{p.loadedKg} کگم</td>
                            <td className="p-2.5 text-center font-bold text-[#248A3D] tabular-nums">
                              {p.soldKg} کگم
                            </td>
                            <td className="p-2.5 text-center font-bold text-[#5856D6] tabular-nums">
                              {p.returnedKg} کگم
                            </td>
                            <td className="p-2.5 text-center font-black tabular-nums">
                              <span
                                className={
                                  p.remainingKg > 0 ? 'text-[#FF9500]' : 'text-[#86868B]'
                                }
                              >
                                {p.remainingKg} کگم
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-black/[0.05]">
                <button
                  type="button"
                  onClick={() => handleOpenLoadModal(holder.holderName)}
                  className="px-3.5 py-2 rounded-full bg-[#0071E3]/10 hover:bg-[#0071E3] text-[#0071E3] hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ناردنی باری نوێ
                </button>

                {hasRemaining && (
                  <button
                    type="button"
                    onClick={() => handleOpenReturnModal(holder)}
                    className="px-3.5 py-2 rounded-full bg-[#5856D6] hover:bg-[#4947C2] text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    گەڕانەوەی نەفرۆشراو بۆ کۆگای ئامادە
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setReportDate(toLocalISODate());
                    setReportHolder(holder);
                  }}
                  className="px-3.5 py-2 rounded-full bg-[#1D1D1F]/8 hover:bg-[#1D1D1F] text-[#1D1D1F] hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  ڕاپۆرتی کۆتایی ڕۆژ
                </button>

                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('rep-sales')}
                    className="mr-auto px-3 py-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#515154] text-[11px] font-semibold flex items-center gap-1 transition-all"
                  >
                    <ArrowRight className="w-3 h-3" />
                    تۆمارکردنی وەسڵی فرۆشتن
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custody Movement History */}
      <div className="apple-card overflow-hidden">
        <div className="p-4 border-b border-black/[0.05] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="font-bold text-xs text-[#1D1D1F]">
            تۆماری جوڵەی ناردن و گەڕانەوە لە نێوان کۆگای ئامادە و مەندوبەکان ({filteredTransfers.length})
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs no-print">
            <Calendar className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="apple-input px-2.5 py-1.5 text-xs font-semibold"
            />
            <span className="text-[#86868B]">بۆ</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="apple-input px-2.5 py-1.5 text-xs font-semibold"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#F5F5F7] text-[#515154] font-semibold"
              >
                پاککردنەوە
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
              <tr>
                <th className="p-4">ژ. وەسڵ</th>
                <th className="p-4">بەروار و کات</th>
                <th className="p-4">جۆری جوڵە</th>
                <th className="p-4">مەندوب</th>
                <th className="p-4">بەرهەمەکان</th>
                <th className="p-4">کۆی کێش</th>
                <th className="p-4 text-center">دۆخی ئەکسیپت</th>
                <th className="p-4">تێبینی</th>
                <th className="p-4 text-center no-print">وەسڵ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#86868B]">
                    هیچ جوڵەیەکی کۆگای مەندوب تۆمار نەکراوە
                  </td>
                </tr>
              ) : (
                filteredTransfers.map(t => {
                  const status = t.status || 'ACCEPTED';
                  return (
                    <tr key={t.id} className="hover:bg-[#FBFBFD] transition-colors">
                      <td className="p-4">
                        <span className="bg-[#0071E3]/10 text-[#0071E3] px-2.5 py-1 rounded-full text-[11px] font-mono font-bold">
                          {t.receiptNo}
                        </span>
                      </td>
                      <td className="p-4 tabular-nums text-[11px]">
                        {t.date} • {t.time}
                      </td>
                      <td className="p-4">
                        {t.direction === 'LOAD' ? (
                          <span className="bg-[#0071E3]/10 text-[#0071E3] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            نێردرا بۆ کۆگای مەندوب
                          </span>
                        ) : (
                          <span className="bg-[#5856D6]/12 text-[#5856D6] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            گەڕایەوە کۆگای ئامادە
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold">{t.holderName}</td>
                      <td className="p-4 text-[11px] text-[#515154]">
                        {t.items.map(i => `${i.productName} (${i.weightKg} کگم)`).join('، ')}
                      </td>
                      <td className="p-4 font-black tabular-nums">{t.totalWeightKg} کگم</td>
                      <td className="p-4 text-center">
                        {status === 'PENDING' ? (
                          <span className="bg-[#FF9500]/12 text-[#B25000] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            چاوەڕوانی ئەکسیپت
                          </span>
                        ) : status === 'REJECTED' ? (
                          <span className="bg-[#FF3B30]/12 text-[#D70015] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            ڕەتکراوەتەوە {t.respondedBy ? `(${t.respondedBy})` : ''}
                          </span>
                        ) : (
                          <span className="bg-[#34C759]/12 text-[#248A3D] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            ئەکسیپت کراوە {t.respondedBy ? `(${t.respondedBy})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-[11px] text-[#86868B]">{t.notes}</td>
                      <td className="p-4 text-center no-print">
                        <button
                          type="button"
                          onClick={() => setSelectedTransferForPrint(t)}
                          className="px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] hover:text-white text-[#1D1D1F] font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <Printer className="w-3 h-3" />
                          چاپ
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Send Daily Stock to Rep or Dedicated Store Account */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0071E3] text-white flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D1D1F]">
                    ناردنی ڕۆژانە لە کۆگای ئامادەوە بۆ کۆگای مەندوب
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    لە کۆگای ئامادە دادەبەزێت و دەچێتە ناو کۆگای مەندوب هەتا دەفرۆشرێت یان دەگەڕێنرێتەوە
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLoad} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[#515154] font-semibold mb-1">
                    مەندوب هەڵبژێرە *
                  </label>
                  <select
                    value={loadHolderKey}
                    onChange={e => setLoadHolderKey(e.target.value)}
                    className="apple-input w-full px-3.5 py-2.5 font-bold"
                  >
                    {repNames.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1">ژمارەی وەسڵ *</label>
                  <input
                    type="text"
                    required
                    value={loadReceiptNo}
                    onChange={e => setLoadReceiptNo(e.target.value)}
                    className="apple-input w-full px-3.5 py-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1">بەروار *</label>
                  <input
                    type="date"
                    required
                    value={loadDate}
                    onChange={e => setLoadDate(e.target.value)}
                    className="apple-input w-full px-3.5 py-2 font-semibold"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-black/[0.06] space-y-3">
                <div className="font-bold text-[#1D1D1F]">بەرهەمەکانی کۆگای ئامادە</div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-[#0071E3] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={loadScannerInput}
                      onChange={e => setLoadScannerInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScanLoadBarcode();
                        }
                      }}
                      placeholder="بارکۆدی قاپ سکان بکە و Enter دابگرە..."
                      className="w-full bg-white border border-[#0071E3]/30 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold outline-none focus:border-[#0071E3]"
                      dir="ltr"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleScanLoadBarcode}
                    className="px-4 py-2 rounded-xl bg-[#0071E3] text-white font-bold text-xs shrink-0"
                  >
                    سکان
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={loadProductId}
                    onChange={e => setLoadProductId(e.target.value)}
                    className="sm:col-span-2 apple-input px-3 py-2 bg-white font-semibold"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nameKu} (بەردەست: {p.inStockKg.toLocaleString()} کگم)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="کێش (کگم) *"
                    value={loadWeight}
                    onChange={e => setLoadWeight(e.target.value ? Number(e.target.value) : '')}
                    className="apple-input px-3 py-2 bg-white font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddLoadItem}
                  className="w-full py-2 rounded-xl bg-white hover:bg-[#F5F5F7] border border-black/[0.08] text-[#0071E3] font-bold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  زیادکردن بۆ لیستی ناردن
                </button>

                {loadItems.length > 0 && (
                  <div className="bg-white rounded-xl border border-black/[0.05] overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#F5F5F7] text-[#515154]">
                        <tr>
                          <th className="p-2.5">بەرهەم</th>
                          <th className="p-2.5">کێش (کگم)</th>
                          <th className="p-2.5 text-center">سڕینەوە</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04]">
                        {loadItems.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold">{it.productName}</td>
                            <td className="p-2.5 font-black text-[#0071E3]">{it.weightKg} کگم</td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => setLoadItems(loadItems.filter((_, i) => i !== idx))}
                                className="text-[#FF3B30] p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="تێبینی (ئارەزوومەندانە)..."
                value={loadNotes}
                onChange={e => setLoadNotes(e.target.value)}
                className="apple-input w-full px-3.5 py-2"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowLoadModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#515154] hover:bg-[#F5F5F7]"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0071E3] hover:bg-[#0077ED] flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  ناردنە سەر حساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Return Unsold Stock Back to Ready Stock */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#5856D6] text-white flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D1D1F]">
                    گەڕانەوەی باری نەفرۆشراو بۆ کۆگای ئامادە
                  </h3>
                  <p className="text-[11px] text-[#86868B]">{returnTarget.holderName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturnUnsold} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[#515154] font-semibold mb-1">ژمارەی وەسڵی گەڕانەوە</label>
                <input
                  type="text"
                  required
                  value={returnReceiptNo}
                  onChange={e => setReturnReceiptNo(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 font-mono font-bold"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-black/[0.06] space-y-3">
                <div className="font-bold text-[#1D1D1F]">
                  ئەو بەرهەمانەی لەسەر حسابی ماون (بڕی گەڕانەوە بۆ کۆگای ئامادە دیاری بکە):
                </div>

                <div className="space-y-2">
                  {returnTarget.products
                    .filter(p => p.remainingKg > 0)
                    .map(p => (
                      <div
                        key={p.productId}
                        className="p-3 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#1D1D1F]">{p.productName}</div>
                          <div className="text-[10px] text-[#FF9500] font-semibold">
                            ماوە لەسەر حساب: {p.remainingKg} کگم
                          </div>
                        </div>

                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={p.remainingKg}
                          value={
                            returnWeights[p.productId] === 0
                              ? ''
                              : returnWeights[p.productId] ?? ''
                          }
                          onChange={e =>
                            setReturnWeights(prev => ({
                              ...prev,
                              [p.productId]: e.target.value === '' ? 0 : Number(e.target.value),
                            }))
                          }
                          className="w-28 bg-[#F5F5F7] rounded-xl px-3 py-1.5 font-black text-center outline-none focus:ring-2 focus:ring-[#5856D6]/25"
                        />
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#5856D6]/8 border border-[#5856D6]/20 flex items-center justify-between">
                <span className="font-bold text-[#1D1D1F]">
                  کۆی گشتی گەڕێنراو بۆ کۆگای ئامادە:
                </span>
                <span className="text-lg font-black text-[#5856D6] tabular-nums">
                  +{totalReturnBackKg} کگم
                </span>
              </div>

              <input
                type="text"
                placeholder="تێبینی..."
                value={returnNotes}
                onChange={e => setReturnNotes(e.target.value)}
                className="apple-input w-full px-3.5 py-2"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#515154] hover:bg-[#F5F5F7]"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#5856D6] hover:bg-[#4947C2] flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  گەڕانەوە بۆ کۆگای ئامادە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Rep End-of-Day Printable & CSV Report */}
      {reportHolder && (() => {
        const repDispatches = dispatches.filter(
          d =>
            d.repName === reportHolder.holderName &&
            d.date.slice(0, 10) === reportDate &&
            d.destinationType === 'REP'
        );
        const repReturns = returns.filter(
          r => r.repName === reportHolder.holderName && r.date.slice(0, 10) === reportDate
        );
        const dayLoadedKg = custodyTransfers
          .filter(
            t =>
              t.holderName === reportHolder.holderName &&
              t.date.slice(0, 10) === reportDate &&
              t.direction === 'LOAD' &&
              (!t.status || t.status === 'ACCEPTED')
          )
          .reduce((s, t) => s + t.totalWeightKg, 0);

        const cashTotal = repDispatches
          .filter(d => d.paymentType === 'CASH')
          .reduce((s, d) => s + d.totalAmount, 0);
        const creditTotal = repDispatches
          .filter(d => d.paymentType === 'CREDIT')
          .reduce((s, d) => s + d.totalAmount, 0);
        const electronicTotal = repDispatches
          .filter(d => d.paymentType === 'ELECTRONIC')
          .reduce((s, d) => s + d.totalAmount, 0);
        const repDebtCollectionsCash = vouchers
          .filter(
            v =>
              v.type === 'RECEIPT' &&
              v.date.slice(0, 10) === reportDate &&
              v.collectedByRep === reportHolder.holderName &&
              v.paymentMethod === 'CASH'
          )
          .reduce((s, v) => s + v.amount, 0);
        const totalCashInHand = cashTotal + repDebtCollectionsCash;
        const daySoldKg = repDispatches.reduce((s, d) => s + d.totalWeightKg, 0);
        const dayReturnedKg = repReturns.reduce((s, r) => s + r.totalWeightKg, 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-black/[0.08] space-y-5 apple-sheet">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
                <div>
                  <h3 className="text-base font-black text-[#1D1D1F]">
                    ڕاپۆرتی کۆتایی ڕۆژی مەندوب: {reportHolder.holderName}
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    {factorySettings.factoryName} ({factorySettings.shortCode}) • {reportDate}
                  </p>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <input
                    type="date"
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                    className="apple-input px-3 py-1.5 text-xs font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setReportHolder(null)}
                    className="w-8 h-8 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-[#0071E3]/10">
                  <div className="text-[10px] text-[#0071E3] font-semibold">باری وەرگیراوی ئەمڕۆ</div>
                  <div className="text-base font-black text-[#0071E3] tabular-nums mt-0.5">
                    {dayLoadedKg.toLocaleString()} کگم
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#34C759]/10">
                  <div className="text-[10px] text-[#248A3D] font-semibold">فرۆشراوی ئەمڕۆ</div>
                  <div className="text-base font-black text-[#248A3D] tabular-nums mt-0.5">
                    {daySoldKg.toLocaleString()} کگم
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FF3B30]/10">
                  <div className="text-[10px] text-[#D70015] font-semibold">گەڕاوەی ٣ ڕۆژ</div>
                  <div className="text-base font-black text-[#D70015] tabular-nums mt-0.5">
                    {dayReturnedKg.toLocaleString()} کگم
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#FF9500]/12">
                  <div className="text-[10px] text-[#B25000] font-semibold">ماوەی ناو سەیارە</div>
                  <div className="text-base font-black text-[#B25000] tabular-nums mt-0.5">
                    {reportHolder.remainingKg.toLocaleString()} کگم
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7]">
                  <span className="text-[11px] text-[#86868B] block">فرۆشتنی کاش</span>
                  <span className="text-base font-black text-[#248A3D] tabular-nums">
                    {cashTotal.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7]">
                  <span className="text-[11px] text-[#86868B] block">قەرزی وەرگیراو (تەحصیلات)</span>
                  <span className="text-base font-black text-[#5856D6] tabular-nums">
                    {repDebtCollectionsCash.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#34C759]/12 border border-[#34C759]/25">
                  <span className="text-[11px] text-[#248A3D] font-bold block">کۆی کاشی ناو دەست</span>
                  <span className="text-base font-black text-[#248A3D] tabular-nums">
                    {totalCashInHand.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7]">
                  <span className="text-[11px] text-[#86868B] block">قەرز + ئەلکترۆنی</span>
                  <span className="text-base font-black text-[#FF9500] tabular-nums">
                    {(creditTotal + electronicTotal).toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              <div className="border border-black/[0.06] rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-[#F5F5F7] text-[#515154] font-bold">
                    <tr>
                      <th className="p-3">وەسڵ</th>
                      <th className="p-3">کڕیار / مارکێت</th>
                      <th className="p-3">کێش</th>
                      <th className="p-3">جۆر</th>
                      <th className="p-3">بڕی پارە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {repDispatches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-[#86868B]">
                          هیچ وەسڵێکی فرۆشتن لە {reportDate} بۆ ئەم مەندوبە نییە
                        </td>
                      </tr>
                    ) : (
                      repDispatches.map(d => (
                        <tr key={d.id}>
                          <td className="p-3 font-mono font-bold text-[#0071E3]">{d.manualReceiptNo}</td>
                          <td className="p-3 font-bold">{d.customerName || d.destinationName}</td>
                          <td className="p-3 tabular-nums">{d.totalWeightKg} کگم</td>
                          <td className="p-3 font-semibold">
                            {d.paymentType === 'CASH' ? 'کاش' : d.paymentType === 'CREDIT' ? 'قەرز' : 'ئەلکترۆنی'}
                          </td>
                          <td className="p-3 font-black tabular-nums">{d.totalAmount.toLocaleString()} د.ع</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] text-xs no-print">
                <span className="text-[#86868B]">واژۆی مەندوب: _______________</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-5 py-2 rounded-full bg-[#1D1D1F] text-white font-bold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپکردن
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal 4: Printable Vehicle Loading / Return Slip */}
      {selectedTransferForPrint && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] no-print">
              <span className="text-xs font-bold text-[#86868B]">
                {selectedTransferForPrint.direction === 'LOAD'
                  ? 'وەسڵی بارکردنی ئۆتۆمبێلی مەندوب'
                  : 'وەسڵی گەڕاندنەوە بۆ کۆگای ئامادە'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#0071E3] text-white rounded-full text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپ
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTransferForPrint(null)}
                  className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="text-center space-y-1">
                <h4 className="font-black text-base text-[#1D1D1F]">{factorySettings.factoryName}</h4>
                <p className="text-[11px] font-bold text-[#0071E3]">
                  {selectedTransferForPrint.direction === 'LOAD'
                    ? 'وەسڵی بارکردنی مەندوب (Loading Slip)'
                    : 'وەسڵی گەڕانەوەی نەفرۆشراو'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-[#F5F5F7] space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#86868B]">ژمارەی وەسڵ:</span>
                  <span className="font-mono font-bold text-[#0071E3]">{selectedTransferForPrint.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868B]">مەندوب:</span>
                  <span className="font-bold text-[#1D1D1F]">{selectedTransferForPrint.holderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868B]">بەروار و کات:</span>
                  <span className="tabular-nums">{selectedTransferForPrint.date} • {selectedTransferForPrint.time}</span>
                </div>
              </div>

              <div className="border border-black/[0.06] rounded-2xl overflow-hidden">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-[#F5F5F7] text-[#515154] font-bold">
                    <tr>
                      <th className="p-2.5">بەرهەم</th>
                      <th className="p-2.5 text-left">کێش (کگم)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {selectedTransferForPrint.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold">{it.productName}</td>
                        <td className="p-2.5 text-left font-black tabular-nums">{it.weightKg} کگم</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-black/[0.06]">
                <span>کۆی گشتی کێش:</span>
                <span className="text-[#0071E3] tabular-nums">{selectedTransferForPrint.totalWeightKg} کگم</span>
              </div>

              <div className="pt-3 border-t border-dashed border-black/15 flex justify-between text-[10px] text-[#86868B]">
                <span>واژۆی کۆگا: ___________</span>
                <span>واژۆی مەندوب: ___________</span>
              </div>
              <p dir="ltr" className="text-center text-[9px] font-bold text-[#86868B] tracking-widest uppercase">
                Powered by RAND SUITE
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
