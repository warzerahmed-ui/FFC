import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PackageCheck,
  CheckCircle,
  Edit3,
  Boxes,
  X,
  RotateCcw,
  RefreshCw,
  ClipboardList,
  Barcode,
  Printer,
  Plus,
  Trash2,
  Search,
  Download,
  Store,
  Clock,
} from 'lucide-react';
import { ProductItem, ReturnOrder, TabType, ProductCategory } from '../../types';
import { FactoryLogo } from '../layout/FactoryLogo';
import { toLocalISODate } from '../../utils/date';

type SubTabType = 'inventory' | 'fifo-batches' | 'returns-conversion';

interface ReadyForSaleViewProps {
  onNavigate?: (tab: TabType) => void;
}

export const ReadyForSaleView: React.FC<ReadyForSaleViewProps> = ({ onNavigate }) => {
  const {
    products,
    yields,
    custodyTransfers,
    returns,
    convertReturnOrder,
    updateProductPrice,
    transferReadyToBranch,
    addProduct,
    deleteProduct,
    factorySettings,
  } = useApp();

  const [subTab, setSubTab] = useState<SubTabType>('inventory');
  const [searchTerm, setSearchTerm] = useState('');

  // New Product Modal States
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState<number | ''>(4000);
  const [newProdCost, setNewProdCost] = useState<number | ''>(3000);
  const [newProdCategory, setNewProdCategory] = useState<ProductCategory>('OTHER');
  const [newProdStock, setNewProdStock] = useState<number | ''>('');

  // 3-Day Return Conversion Modal States
  const [convertingReturn, setConvertingReturn] = useState<ReturnOrder | null>(null);
  const [convertedWeights, setConvertedWeights] = useState<Record<string, number>>({});
  const [conversionNotes, setConversionNotes] = useState('');

  // Edit Price & Alert Modal States
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editPricePerKg, setEditPricePerKg] = useState<number | ''>('');
  const [editCostPerKg, setEditCostPerKg] = useState<number | ''>('');
  const [editMinAlertKg, setEditMinAlertKg] = useState<number | ''>(100);

  // Send to Showroom (POS) Modal States
  const [showBranchTransferModal, setShowBranchTransferModal] = useState(false);
  const [branchWeights, setBranchWeights] = useState<Record<string, number>>({});
  const [branchRepName, setBranchRepName] = useState('');
  const [branchReceiptNo, setBranchReceiptNo] = useState('');
  const [branchNotes, setBranchNotes] = useState('');

  // Barcode Sticker Label Modal States
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [labelProductId, setLabelProductId] = useState(products[0]?.id || '');
  const [labelWeightKg, setLabelWeightKg] = useState<number | ''>(1.5);

  // Derived Metrics
  const pendingReturns = useMemo(
    () => returns.filter(r => !r.conversionStatus || r.conversionStatus === 'PENDING'),
    [returns]
  );

  const convertedReturns = useMemo(
    () => returns.filter(r => r.conversionStatus === 'CONVERTED'),
    [returns]
  );

  const sortedReturns = useMemo(
    () => [...pendingReturns, ...convertedReturns],
    [pendingReturns, convertedReturns]
  );

  const totalStockKg = products.reduce((sum, p) => sum + p.inStockKg, 0);
  const totalStockValue = products.reduce((sum, p) => sum + p.inStockKg * p.pricePerKg, 0);
  const totalLoadedOutKg = custodyTransfers
    .filter(t => t.direction === 'LOAD' && (!t.status || t.status === 'ACCEPTED'))
    .reduce((s, t) => s + t.totalWeightKg, 0);
  const totalReturnedUnsoldKg = custodyTransfers
    .filter(t => t.direction === 'RETURN_TO_READY' && (!t.status || t.status === 'ACCEPTED'))
    .reduce((s, t) => s + t.totalWeightKg, 0);
  const pendingReturnsKg = pendingReturns.reduce((s, r) => s + r.totalWeightKg, 0);
  const convertedOutputKg = convertedReturns.reduce(
    (s, r) => s + (r.convertedOutputs?.reduce((cs, o) => cs + o.weightKg, 0) || 0),
    0
  );

  // FIFO Batch & Freshness Breakdown from Slaughter Yields
  const freshWindowDays = factorySettings.returnWindowDays || 3;
  const fifoBatches = useMemo(() => {
    const todayMs = new Date(`${toLocalISODate()}T00:00:00`).getTime();
    return products
      .filter(p => p.inStockKg > 0)
      .map(prod => {
        let remaining = prod.inStockKg;
        const allocated: {
          receiptNo: string;
          farmName: string;
          date: string;
          weightKg: number;
          ageDays: number;
          dressedCostPerKg?: number;
        }[] = [];

        const matchingYields = yields
          .filter(y => y.cuts.some(c => c.productId === prod.id && c.weightKg > 0))
          .sort((a, b) => b.date.localeCompare(a.date));

        for (const y of matchingYields) {
          if (remaining <= 0) break;
          const cutKg = y.cuts
            .filter(c => c.productId === prod.id)
            .reduce((s, c) => s + c.weightKg, 0);
          if (cutKg <= 0) continue;
          const take = Math.min(remaining, cutKg);
          const batchMs = new Date(`${y.date}T00:00:00`).getTime();
          const ageDays = Math.max(0, Math.round((todayMs - batchMs) / 86400000));
          allocated.push({
            receiptNo: y.manualReceiptNo,
            farmName: y.farmName,
            date: y.date,
            weightKg: Number(take.toFixed(2)),
            ageDays,
            dressedCostPerKg: y.dressedCostPerKg,
          });
          remaining = Number((remaining - take).toFixed(2));
        }

        if (remaining > 0.01) {
          allocated.push({
            receiptNo: 'سەرەتایی / گەڕاوە',
            farmName: 'کۆگای کارگە',
            date: toLocalISODate(),
            weightKg: remaining,
            ageDays: 0,
          });
        }

        const maxAgeDays = allocated.reduce((m, b) => Math.max(m, b.ageDays), 0);
        return {
          product: prod,
          batches: allocated,
          maxAgeDays,
        };
      });
  }, [products, yields]);

  const handleOpenBranchTransfer = (preselectProductId?: string) => {
    const init: Record<string, number> = {};
    products.forEach(p => {
      init[p.id] = preselectProductId && p.id === preselectProductId ? Math.min(p.inStockKg, 10) : 0;
    });
    setBranchWeights(init);
    setBranchRepName('');
    setBranchReceiptNo('');
    setBranchNotes('');
    setShowBranchTransferModal(true);
  };

  const handleSubmitBranchTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const items = products
      .map(p => ({ productId: p.id, weightKg: Number(branchWeights[p.id] || 0) }))
      .filter(i => i.weightKg > 0);
    if (items.length === 0) {
      alert('تکایە کێشی لانیکەم یەک بەرهەم بنووسە بۆ ناردن بۆ شۆرۆم');
      return;
    }
    for (const it of items) {
      const prod = products.find(p => p.id === it.productId);
      if (!prod || it.weightKg > prod.inStockKg) {
        alert(`بڕی داواکراو بۆ "${prod?.nameKu}" لە کۆگای ئامادە زیاترە!`);
        return;
      }
    }
    const created = transferReadyToBranch({
      items,
      repName: branchRepName,
      manualReceiptNo: branchReceiptNo,
      notes: branchNotes,
    });
    if (created) {
      setShowBranchTransferModal(false);
    }
  };

  const handleExportInventoryCsv = () => {
    const rows = [
      ['کۆد', 'ناوی پارچە', 'کێشی ئامادە (کگم)', 'سنووری ئاگاداری (کگم)', 'نرخی فرۆش (د.ع)', 'تێچووی کیلۆ (د.ع)', 'بەهای کۆگا (د.ع)'],
      ...products.map(p => [
        p.code,
        p.nameKu,
        String(p.inStockKg),
        String(p.minAlertKg ?? 100),
        String(p.pricePerKg),
        String(p.costPerKg),
        String(Math.round(p.inStockKg * p.pricePerKg)),
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ready-Inventory-${toLocalISODate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- 3-Day Return Conversion Handlers ---
  const handleOpenConvertModal = (ret: ReturnOrder) => {
    setConvertingReturn(ret);
    const initial: Record<string, number> = {};
    products.forEach(p => {
      initial[p.id] = 0;
    });
    setConvertedWeights(initial);
    setConversionNotes('');
  };

  const totalConvertedKg = Object.values(convertedWeights).reduce((s, w) => s + (w || 0), 0);

  const handleSubmitConversion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingReturn) return;

    if (totalConvertedKg > convertingReturn.totalWeightKg) {
      alert(
        `کێشی گۆڕدراو (${totalConvertedKg} کگم) ناتوانێت لە کێشی گەڕاوە (${convertingReturn.totalWeightKg} کگم) زیاتر بێت!`
      );
      return;
    }

    const outputs = products
      .map(p => ({
        productId: p.id,
        productName: p.nameKu,
        weightKg: Number(convertedWeights[p.id] || 0),
      }))
      .filter(o => o.weightKg > 0);

    convertReturnOrder(
      convertingReturn.id,
      outputs,
      conversionNotes.trim() ||
        (outputs.length > 0
          ? 'گۆڕدرا بۆ بەرهەمی تر و خرایەوە ناو کۆگای ئامادە بۆ فرۆشتن'
          : 'تەلەف کرا')
    );

    setConvertingReturn(null);
  };

  // --- Price Edit Handlers ---
  const handleOpenEditPrice = (prod: ProductItem) => {
    setEditingProduct(prod);
    setEditPricePerKg(prod.pricePerKg);
    setEditCostPerKg(prod.costPerKg);
    setEditMinAlertKg(prod.minAlertKg ?? 100);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    updateProductPrice(
      editingProduct.id,
      Number(editPricePerKg) || editingProduct.pricePerKg,
      Number(editCostPerKg) || editingProduct.costPerKg,
      editMinAlertKg === '' ? 100 : Math.max(0, Number(editMinAlertKg))
    );
    setEditingProduct(null);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      alert('تکایە ناوی پارچە بنووسە');
      return;
    }
    if (!newProdPrice || Number(newProdPrice) <= 0) {
      alert('تکایە نرخی فرۆشتنی کیلۆ بنووسە');
      return;
    }

    addProduct({
      nameKu: newProdName.trim(),
      pricePerKg: Number(newProdPrice),
      costPerKg: newProdCost ? Number(newProdCost) : Math.round(Number(newProdPrice) * 0.75),
      category: newProdCategory,
      unit: 'KG',
      initialStockKg: Number(newProdStock) || 0,
    });

    setNewProdName('');
    setNewProdPrice(4000);
    setNewProdCost(3000);
    setNewProdCategory('OTHER');
    setNewProdStock('');
    setShowAddProductModal(false);
  };

  const handleDeleteProduct = (prod: ProductItem) => {
    if (confirm(`ئایا دڵنیایت لە سڕینەوەی بەرهەمی "${prod.nameKu}"؟ ئەم بەشە لە تەواوی سیستمدا دەسڕدرێتەوە.`)) {
      const res = deleteProduct(prod.id);
      if (!res.ok && res.error) {
        alert(res.error);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="apple-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0071E3]/12 text-[#0071E3] flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#1D1D1F] tracking-tight">
              ٣. کۆگای ئامادە بۆ فرۆشتن و گۆڕینی گەڕاوەکان
            </h2>
            <p className="text-xs text-[#86868B] mt-0.5">
              بەڕێوەبردنی کۆگای ئامادە، نرخەکان، و گۆڕینی گەڕاوەی ٣ ڕۆژ (مەندوب و شۆرۆم) بۆ شێوازی تر و خستنەوە ناو کۆگا
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportInventoryCsv}
            className="px-3.5 py-2.5 bg-[#34C759]/12 hover:bg-[#34C759]/20 text-[#248A3D] font-bold text-xs rounded-full flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Excel / CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] font-bold text-xs rounded-full flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            چاپکردن
          </button>

          <button
            type="button"
            onClick={() => handleOpenBranchTransfer()}
            className="px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-xs rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Store className="w-4 h-4" />
            ناردن بۆ شۆرۆم (POS)
          </button>

          <button
            type="button"
            onClick={() => setShowAddProductModal(true)}
            className="px-4 py-2.5 bg-[#34C759] hover:bg-[#2FB350] text-white font-bold text-xs rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            زیادکردنی پارچەی نوێ
          </button>

          <button
            type="button"
            onClick={() => setShowBarcodeModal(true)}
            className="px-4 py-2.5 bg-[#1D1D1F] hover:bg-black text-white font-bold text-xs rounded-full flex items-center gap-1.5 transition-all"
          >
            <Barcode className="w-4 h-4" />
            ستیکەری بارکۆد
          </button>

          <button
            type="button"
            onClick={() => setSubTab('returns-conversion')}
            className="px-4 py-2.5 bg-[#FF9500]/12 hover:bg-[#FF9500]/20 text-[#B25000] font-bold text-xs rounded-full flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            گەڕاوەی ٣ ڕۆژ ({pendingReturns.length} چاوەڕوان)
          </button>
        </div>
      </div>

      {/* Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="apple-card p-5">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>کۆگای ئامادە بۆ فرۆشتن</span>
            <div className="w-8 h-8 rounded-full bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#1D1D1F] tabular-nums">
            {totalStockKg.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#0071E3] font-semibold mt-2 tabular-nums">
            بەهای کۆگا: {totalStockValue.toLocaleString()} د.ع
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>نێردراو بۆ کۆگای مەندوب</span>
            <div className="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#248A3D] flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#248A3D] tabular-nums">
            {totalLoadedOutKg.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#86868B] font-medium mt-2 tabular-nums">
            نەفرۆشراوی گەڕاوە بۆ کۆگا: {totalReturnedUnsoldKg.toLocaleString()} کگم
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>گەڕاوەی ٣ ڕۆژ (چاوەڕوانی گۆڕین)</span>
            <div className="w-8 h-8 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#FF3B30] tabular-nums">
            {pendingReturnsKg.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#FF9500] font-semibold mt-2">
            {pendingReturns.length} وەسڵ چاوەڕوانی گۆڕینی شێوازە
          </div>
        </div>

        <div className="apple-card p-5">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>گۆڕدراو و گەڕێنراوە بۆ کۆگا</span>
            <div className="w-8 h-8 rounded-full bg-[#5856D6]/10 text-[#5856D6] flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#5856D6] tabular-nums">
            {convertedOutputKg.toLocaleString()}{' '}
            <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="text-[11px] text-[#86868B] font-medium mt-2">
            لە {convertedReturns.length} وەسڵی گەڕاوە دروستکراوەتەوە
          </div>
        </div>
      </div>

      {/* Segmented Sub-Tabs */}
      <div className="inline-flex p-1 rounded-2xl bg-black/[0.05] flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setSubTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            subTab === 'inventory'
              ? 'bg-white text-[#1D1D1F] shadow-sm'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          <PackageCheck className="w-3.5 h-3.5 text-[#0071E3]" />
          کۆگای ئامادە ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('fifo-batches')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            subTab === 'fifo-batches'
              ? 'bg-white text-[#1D1D1F] shadow-sm'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#5856D6]" />
          شوێنپێی وەجبە و بەسەرچوون (FIFO)
        </button>

        <button
          type="button"
          onClick={() => setSubTab('returns-conversion')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            subTab === 'returns-conversion'
              ? 'bg-white text-[#1D1D1F] shadow-sm'
              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#FF9500]" />
          گەڕاوەی ٣ ڕۆژ و گۆڕینی شێواز ({pendingReturns.length})
        </button>
      </div>

      {/* SubTab 1: Ready Inventory Cards */}
      {subTab === 'inventory' && (
        <div className="space-y-4">
          <div className="apple-card p-3 flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#86868B] mr-1" />
            <input
              type="text"
              placeholder="گەڕان بەپێی ناوی پارچە یان کۆد..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-[#1D1D1F] placeholder-[#86868B] outline-none w-full font-medium"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products
              .filter(
                p =>
                  !searchTerm.trim() ||
                  p.nameKu.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  p.code.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(prod => {
            const alertThreshold = prod.minAlertKg ?? 100;
            const isOut = prod.inStockKg <= 0;
            const isLow = prod.inStockKg > 0 && prod.inStockKg < alertThreshold;
            return (
              <div
                key={prod.id}
                className="apple-card apple-card-hover p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono font-bold text-[#86868B] bg-[#F5F5F7] px-2.5 py-0.5 rounded-full">
                      #{prod.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isOut
                          ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
                          : isLow
                          ? 'bg-[#FF9500]/12 text-[#FF9500]'
                          : 'bg-[#34C759]/12 text-[#248A3D]'
                      }`}
                    >
                      {isOut ? 'تەواو بووە' : isLow ? 'کەم بووەتەوە' : 'ئامادەیە لە کۆگا'}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-[#1D1D1F]">{prod.nameKu}</h3>

                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <div className="text-[11px] text-[#86868B]">بڕی بەردەست لە کۆگا</div>
                      <div className="text-2xl font-black text-[#1D1D1F] tabular-nums mt-0.5">
                        {prod.inStockKg.toLocaleString()}{' '}
                        <span className="text-xs font-medium text-[#86868B]">کگم</span>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-[11px] text-[#86868B]">نرخی فرۆشی کیلۆ</div>
                      <div className="text-base font-black text-[#0071E3] tabular-nums mt-0.5">
                        {prod.pricePerKg.toLocaleString()}{' '}
                        <span className="text-[10px] font-medium">د.ع</span>
                      </div>
                      <div className="text-[10px] text-[#86868B] tabular-nums">
                        تێچوو: {prod.costPerKg.toLocaleString()} د.ع
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-black/[0.05] flex items-center gap-1.5 flex-wrap">
                  {onNavigate && (
                    <button
                      type="button"
                      disabled={isOut}
                      onClick={() => onNavigate('custody')}
                      className="flex-1 py-2 px-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      مەندوب
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isOut}
                    onClick={() => handleOpenBranchTransfer(prod.id)}
                    className="px-3 py-2 rounded-full bg-[#5856D6]/12 hover:bg-[#5856D6] disabled:opacity-40 text-[#5856D6] hover:text-white text-xs font-bold flex items-center gap-1 transition-all"
                    title="ناردن بۆ شۆرۆم (POS)"
                  >
                    <Store className="w-3.5 h-3.5" />
                    شۆرۆم
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditPrice(prod)}
                    className="px-3 py-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#515154] text-xs font-semibold flex items-center gap-1 transition-all"
                    title="گۆڕینی نرخ و سنووری ئاگاداری"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    نرخ
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(prod)}
                    className="p-2 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] text-xs font-semibold flex items-center justify-center transition-all"
                    title="سڕینەوەی پارچە"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* SubTab 2: FIFO Batch & Freshness Tracker */}
      {subTab === 'fifo-batches' && (
        <div className="apple-card overflow-hidden">
          <div className="p-4 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-xs text-[#1D1D1F] block">
                شوێنپێی وەجبەکان و تەمەنی فرێشیی گۆشت (FIFO)
              </span>
              <span className="text-[11px] text-[#86868B]">
                بەپێی بەرواری سەربڕین و ماوەی فرێشیی کارگە ({freshWindowDays} ڕۆژ) دۆخی هەر بەرهەمێک پیشان دەدات
              </span>
            </div>
          </div>

          {fifoBatches.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#86868B]">
              هیچ بەرهەمێکی بەردەست لە کۆگادا نییە
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {fifoBatches.map(({ product, batches, maxAgeDays }) => {
                const isExpired = maxAgeDays >= freshWindowDays;
                const isNearExpiry = !isExpired && maxAgeDays >= Math.max(1, freshWindowDays - 1);
                return (
                  <div key={product.id} className="p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#1D1D1F]">{product.nameKu}</span>
                        <span className="text-[11px] font-mono bg-[#F5F5F7] px-2 py-0.5 rounded-full text-[#86868B]">
                          #{product.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#0071E3] tabular-nums">
                          کۆی بەردەست: {product.inStockKg.toLocaleString()} کگم
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isExpired
                              ? 'bg-[#FF3B30]/12 text-[#D70015]'
                              : isNearExpiry
                              ? 'bg-[#FF9500]/15 text-[#B25000]'
                              : 'bg-[#34C759]/12 text-[#248A3D]'
                          }`}
                        >
                          {isExpired
                            ? `بەسەرچوون / پێویستی فرۆشتنی خێرا (${maxAgeDays} ڕۆژ)`
                            : isNearExpiry
                            ? `نزیکە لە کۆتایی ماوە (${maxAgeDays} ڕۆژ)`
                            : `تازە و فرێش (${maxAgeDays} ڕۆژ)`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {batches.map((b, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200/80 text-[11px] flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-[#1D1D1F]">
                              وەسڵ: <span className="font-mono text-[#5856D6]">{b.receiptNo}</span>
                            </div>
                            <div className="text-[10px] text-[#86868B]">
                              {b.farmName} • {b.date} ({b.ageDays} ڕۆژ)
                            </div>
                          </div>
                          <div className="text-left shrink-0">
                            <div className="font-black text-[#1D1D1F] tabular-nums">
                              {b.weightKg.toLocaleString()} کگم
                            </div>
                            {b.dressedCostPerKg && (
                              <div className="text-[10px] text-[#5856D6] tabular-nums">
                                تێچوو: {b.dressedCostPerKg.toLocaleString()} د.ع
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: 3-Day Returns Come Back Here -> Convert to Another Form */}
      {subTab === 'returns-conversion' && (
        <div className="apple-card overflow-hidden">
          <div className="p-4 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-xs text-[#1D1D1F] block">
                گەڕاوەکانی ٣ ڕۆژ لە مەندوبەوە (گۆڕینی شێواز و دووبارە ناردنەوە بۆ فرۆشتن)
              </span>
              <span className="text-[11px] text-[#86868B]">
                هەر گەڕاوەیەکی ٣ ڕۆژ لە مارکێتەکانی مەندوبەوە دێتە ئێرە و دەتوانیت بیگۆڕیت بۆ شێوازێکی تر (وەک سنگ، ڕان، ئێسک و شلمک...) تا خۆکار بچێتەوە ناو کۆگای ئامادە
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
                <tr>
                  <th className="p-4">ژ. وەسڵ</th>
                  <th className="p-4">بەروار</th>
                  <th className="p-4">سەرچاوە (مەندوب / شۆرۆم)</th>
                  <th className="p-4">بەرهەمی گەڕاوە</th>
                  <th className="p-4">کێشی گەڕاوە</th>
                  <th className="p-4">دۆخی گۆڕین</th>
                  <th className="p-4 text-center">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                {sortedReturns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#86868B]">
                      هیچ گەڕاوەیەکی ٣ ڕۆژ نەگەڕاوەتەوە
                    </td>
                  </tr>
                ) : (
                  sortedReturns.map(r => {
                    const isConverted = r.conversionStatus === 'CONVERTED';
                    return (
                      <tr key={r.id} className="hover:bg-[#FBFBFD] transition-colors">
                        <td className="p-4 font-mono font-bold text-[#FF3B30]">
                          <div>{r.manualReceiptNo}</div>
                          {r.salesReceiptNo && (
                            <div className="text-[10px] text-[#0071E3]">
                              سەر وەسڵی: {r.salesReceiptNo}
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-semibold">{r.date}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.sourceType === 'BRANCH'
                                  ? 'bg-[#AF52DE]/12 text-[#AF52DE]'
                                  : 'bg-[#0071E3]/12 text-[#0071E3]'
                              }`}
                            >
                              {r.sourceType === 'BRANCH' ? 'شۆرۆم POS' : 'مەندوب'}
                            </span>
                            <span className="font-bold">{r.customerName || r.sourceName}</span>
                          </div>
                          {r.repName && (
                            <div className="text-[10px] text-[#86868B] mt-0.5">{r.repName}</div>
                          )}
                        </td>
                        <td className="p-4 text-[11px] text-[#515154]">
                          {r.items.map(i => `${i.productName} (${i.weightKg} کگم)`).join('، ')}
                        </td>
                        <td className="p-4 font-black text-[#FF3B30] tabular-nums">
                          {r.totalWeightKg} کگم
                        </td>
                        <td className="p-4">
                          {isConverted ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#34C759]/12 text-[#248A3D] text-[10px] font-bold">
                                <CheckCircle className="w-3 h-3" />
                                گۆڕدرا بۆ کۆگای ئامادە ({r.convertedAt})
                              </span>
                              {r.convertedOutputs && r.convertedOutputs.length > 0 && (
                                <div className="text-[10px] text-[#515154]">
                                  بووە بە:{' '}
                                  {r.convertedOutputs
                                    .map(o => `${o.productName} (${o.weightKg} کگم)`)
                                    .join('، ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FF9500]/15 text-[#B25000] text-[10px] font-bold">
                              چاوەڕوانی گۆڕین
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {!isConverted ? (
                            <button
                              type="button"
                              onClick={() => handleOpenConvertModal(r)}
                              className="px-3.5 py-1.5 rounded-full bg-[#5856D6] hover:bg-[#4947C2] text-white font-bold text-[11px] flex items-center gap-1 mx-auto shadow-xs transition-all"
                            >
                              <RefreshCw className="w-3 h-3" />
                              گۆڕین بۆ شێوازی تر
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#248A3D] font-bold">تەواوبوو</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Convert 3-Day Return Into Another Product / Form */}
      {convertingReturn && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#5856D6] text-white flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#1D1D1F]">
                    گۆڕینی گەڕاوەی ٣ ڕۆژ بۆ شێوازی تر
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    وەسڵی {convertingReturn.salesReceiptNo || convertingReturn.manualReceiptNo} •{' '}
                    {convertingReturn.customerName || convertingReturn.sourceName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConvertingReturn(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitConversion} className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#FF3B30]/5 border border-[#FF3B30]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#1D1D1F] block">
                    گەڕاوەی هاتووەوە بۆ کۆگای ئامادە:
                  </span>
                  <span className="text-[11px] text-[#515154]">
                    {convertingReturn.items
                      .map(i => `${i.productName} (${i.weightKg} کگم)`)
                      .join('، ')}
                  </span>
                </div>
                <div className="text-lg font-black text-[#FF3B30] tabular-nums">
                  {convertingReturn.totalWeightKg} کگم
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-black/[0.06] space-y-3">
                <div className="font-bold text-[#1D1D1F]">
                  دەگۆڕدرێت بۆ چ بەرهەم / شێوازێکی تر؟ (کێش بە کگم بنووسە — خۆکار دەچێتەوە کۆگای ئامادە تا دووبارە بنێردرێت بۆ فرۆشتن):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {products.map(p => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between gap-2"
                    >
                      <span className="font-bold text-[#1D1D1F] text-xs">{p.nameKu}</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={convertingReturn.totalWeightKg}
                        placeholder="0 کگم"
                        value={convertedWeights[p.id] === 0 ? '' : convertedWeights[p.id] || ''}
                        onChange={e =>
                          setConvertedWeights(prev => ({
                            ...prev,
                            [p.id]: e.target.value === '' ? 0 : Number(e.target.value),
                          }))
                        }
                        className="w-24 bg-[#F5F5F7] rounded-xl px-2.5 py-1.5 font-black text-center outline-none focus:ring-2 focus:ring-[#5856D6]/25"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#5856D6]/8 border border-[#5856D6]/20 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-[#86868B] block">کێشی گەڕاوە</span>
                  <span className="text-sm font-black text-[#1D1D1F]">
                    {convertingReturn.totalWeightKg} کگم
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868B] block">گۆڕدراو بۆ شێوازی تر</span>
                  <span className="text-sm font-black text-[#248A3D]">
                    {totalConvertedKg.toLocaleString()} کگم
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#86868B] block">فەوتانی کۆتایی</span>
                  <span className="text-sm font-black text-[#FF3B30]">
                    {Math.max(0, Number((convertingReturn.totalWeightKg - totalConvertedKg).toFixed(2)))} کگم
                  </span>
                </div>
              </div>

              <input
                type="text"
                placeholder="تێبینی گۆڕین (بۆ نموونە: کراوەتە سنگی مریشک یان ئێسک و شلمک)..."
                value={conversionNotes}
                onChange={e => setConversionNotes(e.target.value)}
                className="apple-input w-full px-3.5 py-2"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setConvertingReturn(null)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#515154] hover:bg-[#F5F5F7]"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#5856D6] hover:bg-[#4947C2] shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  تۆمارکردنی گۆڕین و زیادکردن بۆ کۆگا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Product Price */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md p-6 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <h3 className="font-bold text-sm text-[#1D1D1F]">
                دەستکاری نرخی: {editingProduct.nameKu}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#515154] font-semibold mb-1">
                  نرخی فرۆشتنی کیلۆ (د.ع)
                </label>
                <input
                  type="number"
                  required
                  value={editPricePerKg}
                  onChange={e =>
                    setEditPricePerKg(e.target.value ? Number(e.target.value) : '')
                  }
                  className="apple-input w-full px-3.5 py-2.5 font-black text-base"
                />
              </div>

              <div>
                <label className="block text-[#515154] font-semibold mb-1">تێچووی کیلۆ (د.ع)</label>
                <input
                  type="number"
                  required
                  value={editCostPerKg}
                  onChange={e =>
                    setEditCostPerKg(e.target.value ? Number(e.target.value) : '')
                  }
                  className="apple-input w-full px-3.5 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="block text-[#515154] font-semibold mb-1">
                  سنووری ئاگادارکردنەوەی کەمیی کۆگا (کگم)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={editMinAlertKg}
                  onChange={e =>
                    setEditMinAlertKg(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="apple-input w-full px-3.5 py-2.5 font-bold tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-[#515154] hover:bg-[#F5F5F7]"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#0071E3] hover:bg-[#0077ED]"
                >
                  پاشەکەوتکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Sticker Label Modal */}
      {showBarcodeModal && (() => {
        const prod = products.find(p => p.id === labelProductId) || products[0];
        const wt = Number(labelWeightKg) || 0;
        const gramsStr = String(Math.round(wt * 1000)).padStart(5, '0');
        const fullBarcode = prod ? `${prod.barcodePrefix}${gramsStr}` : '210010101500';
        const priceTotal = prod ? Math.round(wt * prod.pricePerKg) : 0;

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl border border-black/[0.08] apple-sheet">
              <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex justify-between items-center no-print">
                <h3 className="font-extrabold text-[#1D1D1F] text-sm flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#0071E3]" />
                  چاپی ستیکەری بارکۆدی تەرازوو (80mm / Label)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 no-print">
                  <div>
                    <label className="block text-[#515154] font-semibold mb-1">جۆری بەرهەم:</label>
                    <select
                      value={labelProductId}
                      onChange={e => setLabelProductId(e.target.value)}
                      className="apple-input w-full px-3 py-2 font-semibold"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nameKu}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#515154] font-semibold mb-1">کێش (کگم):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.05"
                      value={labelWeightKg}
                      onChange={e => setLabelWeightKg(e.target.value ? Number(e.target.value) : '')}
                      className="apple-input w-full px-3 py-2 font-black tabular-nums"
                    />
                  </div>
                </div>

                {/* Printable Sticker Preview */}
                {prod && (
                  <div className="p-4 rounded-2xl border-2 border-dashed border-black/20 bg-white text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 pb-1.5 border-b border-black/10">
                      <FactoryLogo size="xs" />
                      <span className="font-extrabold text-[#1D1D1F] text-xs">
                        {factorySettings.factoryName}
                      </span>
                    </div>
                    <div className="font-black text-sm text-[#1D1D1F]">{prod.nameKu}</div>
                    <div className="flex justify-center items-center gap-4 text-xs font-bold tabular-nums">
                      <span className="text-[#0071E3]">کێش: {wt.toFixed(2)} کگم</span>
                      <span className="text-[#248A3D]">نرخ: {priceTotal.toLocaleString()} د.ع</span>
                    </div>
                    <svg width={220} height={46} className="mx-auto select-none">
                      <rect width={220} height={46} fill="#FFFFFF" />
                      {Array.from(fullBarcode).map((ch, i) => {
                        const code = ch.charCodeAt(0);
                        const x = 14 + i * 16;
                        return (
                          <g key={i}>
                            <rect x={x} y={3} width={(code % 3) + 1.5} height={28} fill="#1D1D1F" />
                            <rect x={x + 6} y={3} width={((code >> 1) % 2) + 1} height={28} fill="#1D1D1F" />
                          </g>
                        );
                      })}
                      <text
                        x={110}
                        y={43}
                        textAnchor="middle"
                        fontSize="10"
                        fontFamily="monospace"
                        fill="#1D1D1F"
                        letterSpacing="2"
                      >
                        {fullBarcode}
                      </text>
                    </svg>
                    <div className="text-[10px] text-[#86868B]">
                      بەرواری بەرهەمهێنان: {toLocalISODate()} • ماوەی فرێش: {factorySettings.returnWindowDays} ڕۆژ
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 no-print">
                  <button
                    type="button"
                    onClick={() => setShowBarcodeModal(false)}
                    className="w-1/2 py-2.5 rounded-full bg-[#F5F5F7] text-[#515154] font-semibold"
                  >
                    داخستن
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-1/2 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپکردنی ستیکەر
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-lg shadow-2xl border border-black/[0.08] p-5 space-y-4 apple-sheet">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1D1D1F]">زیادکردنی پارچەی نوێ بۆ کارگە و فرۆشتن</h4>
                  <p className="text-[11px] text-[#86868B]">بە هەمان ناو و کۆد لە تەواوی سیستمدا (کۆگا، فرۆشتن، کاشێر و مەندوبەکان) جێگیر دەبێت</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-[#515154] font-semibold mb-1">
                  ناوی پارچە / بەرهەم *
                </label>
                <input
                  type="text"
                  required
                  placeholder="بۆ نموونە: فیلێی سنگی مریشک، دەسکە ڕان..."
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    نرخی فرۆشتنی کیلۆ (دینار) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="50"
                    placeholder="4000"
                    value={newProdPrice}
                    onChange={e => setNewProdPrice(e.target.value ? Number(e.target.value) : '')}
                    className="apple-input w-full px-3.5 py-2 font-black text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    تێچووی کیلۆ (دینار)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="3000"
                    value={newProdCost}
                    onChange={e => setNewProdCost(e.target.value ? Number(e.target.value) : '')}
                    className="apple-input w-full px-3.5 py-2 font-black text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    بەش / پۆلێن
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={e => setNewProdCategory(e.target.value as ProductCategory)}
                    className="apple-input w-full px-3.5 py-2 font-semibold"
                  >
                    <option value="BREAST">سنگی مریشک (Breast)</option>
                    <option value="THIGH">ڕانی مریشک (Thigh / Leg)</option>
                    <option value="WINGS">باڵ و گەردەن (Wings)</option>
                    <option value="WHOLE_CHICKEN">مریشکی تەواو (Whole)</option>
                    <option value="GIBLET">جگەر و قەسەیل (Giblet)</option>
                    <option value="BONES_SCRAP">ئێسک، شلمک و پەل (Bones / Scrap)</option>
                    <option value="OTHER">بەش و پارچەی تر (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    بڕی سەرەتایی لە کۆگا (کگم)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={newProdStock}
                    onChange={e => setNewProdStock(e.target.value ? Number(e.target.value) : '')}
                    className="apple-input w-full px-3.5 py-2 font-semibold"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 rounded-full bg-[#F5F5F7] text-[#515154] text-xs font-bold hover:bg-[#E8E8ED]"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#34C759] hover:bg-[#2FB350] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  تۆمارکردن و زیادکردن بۆ کۆگا
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Directly to Showroom (POS) Modal */}
      {showBranchTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0071E3] text-white flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-[#1D1D1F]">
                    ناردنی بار لە کۆگای ئامادەوە بۆ شۆرۆم (POS)
                  </h4>
                  <p className="text-[11px] text-[#86868B]">
                    لە کۆگای ئامادەی کارگە کەم دەبێتەوە و ڕاستەوخۆ دەچێتە ناو کۆگای فرۆشگای شۆرۆم
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchTransferModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitBranchTransfer} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    ژمارەی وەسڵ (ئارەزوومەندانە)
                  </label>
                  <input
                    type="text"
                    placeholder="بۆ نموونە: SH-0012"
                    value={branchReceiptNo}
                    onChange={e => setBranchReceiptNo(e.target.value)}
                    className="apple-input w-full px-3.5 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    گەیەنەر / بەرپرس
                  </label>
                  <input
                    type="text"
                    placeholder="ناوی گەیەنەر..."
                    value={branchRepName}
                    onChange={e => setBranchRepName(e.target.value)}
                    className="apple-input w-full px-3.5 py-2 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto p-3 rounded-2xl bg-[#FBFBFD] border border-black/[0.06]">
                {products.filter(p => p.inStockKg > 0).length === 0 ? (
                  <div className="py-6 text-center text-[#86868B]">
                    هیچ بەرهەمێک لە کۆگای ئامادەدا بەردەست نییە
                  </div>
                ) : (
                  products
                    .filter(p => p.inStockKg > 0)
                    .map(p => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#1D1D1F]">{p.nameKu}</div>
                          <div className="text-[10px] text-[#86868B] tabular-nums">
                            بەردەست: {p.inStockKg.toLocaleString()} کگم
                          </div>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={p.inStockKg}
                          placeholder="0 کگم"
                          value={branchWeights[p.id] === 0 ? '' : branchWeights[p.id] || ''}
                          onChange={e =>
                            setBranchWeights(prev => ({
                              ...prev,
                              [p.id]: e.target.value === '' ? 0 : Number(e.target.value),
                            }))
                          }
                          className="w-28 bg-[#F5F5F7] rounded-xl px-3 py-1.5 font-black text-center outline-none focus:ring-2 focus:ring-[#0071E3]/25 tabular-nums"
                        />
                      </div>
                    ))
                )}
              </div>

              <input
                type="text"
                placeholder="تێبینی..."
                value={branchNotes}
                onChange={e => setBranchNotes(e.target.value)}
                className="apple-input w-full px-3.5 py-2"
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowBranchTransferModal(false)}
                  className="px-4 py-2 rounded-full bg-[#F5F5F7] text-[#515154] font-semibold"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5" />
                  ناردن بۆ شۆرۆم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
