import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  PackageCheck,
  Plus,
  Search,
  Edit3,
  Trash2,
  Printer,
  Download,
  Barcode,
  RotateCcw,
  X,
  AlertTriangle,
} from 'lucide-react';
import { ProductCategory, ProductItem, ReturnOrder, TabType } from '../../types';
import { toLocalISODate } from '../../utils/date';

interface ReadyForSaleViewProps {
  onNavigate?: (tab: TabType) => void;
}

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  WHOLE_CHICKEN: 'مریشکی تەواو',
  BREAST: 'سنگی مریشک',
  THIGH: 'ڕان',
  WINGS: 'باڵ و مل',
  GIBLET: 'جگەر و دڵ و قەسیل',
  BONES_SCRAP: 'ئێسک و شلمک',
  OTHER: 'بەش و پارچەی تر',
};

export const ReadyForSaleView: React.FC<ReadyForSaleViewProps> = ({ onNavigate }) => {
  const {
    products,
    returns,
    addProduct,
    addReadyStock,
    updateProductPrice,
    deleteProduct,
    convertReturnOrder,
    parseWeightBarcode,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'STOCK' | 'RETURNS'>('STOCK');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal: Add New Product
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCategory, setNewCategory] = useState<ProductCategory>('OTHER');
  const [newPrice, setNewPrice] = useState<string>('4500');
  const [newCost, setNewCost] = useState<string>('3250');
  const [newInitialKg, setNewInitialKg] = useState<string>('0');

  // Modal: Add Stock into Ready Warehouse
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [stockInProdId, setStockInProdId] = useState<string>(products[0]?.id || '');
  const [stockInWeight, setStockInWeight] = useState<string>('');
  const [stockInNote, setStockInNote] = useState<string>('');
  const [stockInScanner, setStockInScanner] = useState<string>('');

  // Modal: Edit Price / Cost / Alert
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editCost, setEditCost] = useState<string>('');
  const [editMinAlert, setEditMinAlert] = useState<string>('100');

  // Modal: Barcode Preview
  const [barcodeProduct, setBarcodeProduct] = useState<ProductItem | null>(null);

  // Modal: Convert 3-Day Return
  const [convertingReturn, setConvertingReturn] = useState<ReturnOrder | null>(null);
  const [convertOutputs, setConvertOutputs] = useState<
    { productId: string; productName: string; weightKg: number }[]
  >([]);
  const [convProdId, setConvProdId] = useState<string>(products[0]?.id || '');
  const [convWeight, setConvWeight] = useState<string>('');
  const [convNotes, setConvNotes] = useState<string>('');

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p =>
        p.nameKu.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.barcodePrefix.toLowerCase().includes(q)
    );
  }, [products, searchTerm]);

  const pendingReturns = useMemo(
    () => returns.filter(r => r.conversionStatus !== 'CONVERTED'),
    [returns]
  );

  const totalReadyKg = Number(products.reduce((s, p) => s + p.inStockKg, 0).toFixed(2));
  const totalSaleValue = Math.round(products.reduce((s, p) => s + p.inStockKg * p.pricePerKg, 0));
  const totalCostValue = Math.round(products.reduce((s, p) => s + p.inStockKg * p.costPerKg, 0));
  const lowStockCount = products.filter(p => p.inStockKg < (p.minAlertKg ?? 100)).length;

  const handleExportInventoryCsv = () => {
    const rows = [
      ['کۆد', 'بارکۆد', 'ناوی بەرهەم', 'کێشی ئامادە (کگم)', 'نرخی فرۆش (د.ع)', 'تێچووی کیلۆ (د.ع)', 'بەهای کۆگا (د.ع)'],
      ...products.map(p => [
        p.code,
        p.barcodePrefix,
        p.nameKu,
        String(p.inStockKg),
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

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    const price = Number(newPrice) || 0;
    const cost = Number(newCost) || Math.round(price * 0.75);
    if (!clean || price <= 0) {
      alert('تکایە ناو و نرخی فرۆشتن بنووسە');
      return;
    }
    const created = addProduct({
      nameKu: clean,
      pricePerKg: price,
      costPerKg: cost,
      category: newCategory,
      unit: 'KG',
      initialStockKg: Number(newInitialKg) || 0,
      barcodePrefix: newBarcode.trim() || undefined,
    });
    setStockInProdId(created.id);
    setNewName('');
    setNewBarcode('');
    setNewInitialKg('0');
    setShowAddProductModal(false);
  };

  const handleStockInScan = () => {
    const raw = stockInScanner.trim();
    if (!raw) return;
    const decoded = parseWeightBarcode(raw);
    if (!decoded.valid || !decoded.product) {
      alert('بارکۆد نەناسراوە!');
      setStockInScanner('');
      return;
    }
    const w = decoded.weightKg > 0 ? decoded.weightKg : 1;
    addReadyStock(decoded.product.id, w, 'سکان بە بارکۆد ریدەر');
    setStockInScanner('');
  };

  const handleSubmitStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(stockInWeight);
    if (!stockInProdId || !w || w <= 0) {
      alert('تکایە بەرهەم و کێش بنووسە');
      return;
    }
    addReadyStock(stockInProdId, w, stockInNote.trim());
    setStockInWeight('');
    setStockInNote('');
    setShowStockInModal(false);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    updateProductPrice(
      editingProduct.id,
      Number(editPrice) || editingProduct.pricePerKg,
      Number(editCost) || editingProduct.costPerKg,
      Number(editMinAlert) || 100
    );
    setEditingProduct(null);
  };

  const handleSubmitConvert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingReturn) return;
    convertReturnOrder(
      convertingReturn.id,
      convertOutputs,
      convNotes.trim() || (convertOutputs.length > 0 ? 'گۆڕدرا بۆ بەرهەمی ئامادە' : 'تەلەف کرا')
    );
    setConvertingReturn(null);
    setConvertOutputs([]);
    setConvNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="apple-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#34C759]/12 text-[#248A3D] flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#1D1D1F] tracking-tight">
              ٢. کۆگای ئامادە
            </h2>
            <p className="text-xs text-[#86868B] mt-0.5">
              بەڕێوەبردنی کۆگای ئامادەی کارگە، نرخەکان، بارکۆد و گۆڕینی گەڕاوەی ٣ ڕۆژ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportInventoryCsv}
            title="دابەزاندنی Excel / CSV"
            aria-label="دابەزاندنی Excel / CSV"
            className="w-9 h-9 rounded-full bg-[#34C759]/12 hover:bg-[#34C759]/20 text-[#248A3D] flex items-center justify-center transition-all"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            title="چاپکردن"
            aria-label="چاپکردن"
            className="w-9 h-9 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] flex items-center justify-center transition-all"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowAddProductModal(true)}
            className="px-4 py-2.5 bg-[#34C759] hover:bg-[#2DB84D] text-white font-bold text-xs rounded-full shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            زیادکردنی بەرهەمی نوێ
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">کۆی کۆگای ئامادە</span>
          <div className="text-2xl font-black text-[#1D1D1F] tabular-nums mt-2">
            {totalReadyKg.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          {lowStockCount > 0 && (
            <div className="text-[11px] font-bold text-[#FF3B30] mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {lowStockCount} بەرهەم لە سنووری کەمیدایە
            </div>
          )}
        </div>

        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">بەهای کۆگا (بە نرخی فرۆشتن)</span>
          <div className="text-2xl font-black text-[#0071E3] tabular-nums mt-2">
            {totalSaleValue.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">بەهای تێچووی کۆگا</span>
          <div className="text-2xl font-black text-[#248A3D] tabular-nums mt-2">
            {totalCostValue.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
          </div>
        </div>

        <div className="apple-card p-5">
          <span className="text-xs font-semibold text-[#86868B]">گەڕاوەی ٣ ڕۆژ (چاوەڕێی گۆڕین)</span>
          <div className="text-2xl font-black text-[#FF9500] tabular-nums mt-2">
            {pendingReturns.length} <span className="text-xs font-medium text-[#86868B]">وەسڵ</span>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('custody')}
              className="text-[11px] font-bold text-[#0071E3] hover:underline mt-1"
            >
              ناردن بۆ کۆگای مەندوب ←
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="inline-flex bg-white p-1 rounded-full border border-black/[0.06] shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('STOCK')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'STOCK' ? 'bg-[#1D1D1F] text-white' : 'text-[#515154] hover:text-[#1D1D1F]'
            }`}
          >
            کۆگای ئامادە ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('RETURNS')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeSubTab === 'RETURNS' ? 'bg-[#FF9500] text-white' : 'text-[#515154] hover:text-[#1D1D1F]'
            }`}
          >
            گەڕاوەی ٣ ڕۆژ و گۆڕین ({pendingReturns.length})
          </button>
        </div>

        {activeSubTab === 'STOCK' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#86868B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="گەڕان بە ناو، کۆد یان بارکۆد..."
              className="apple-input w-full pr-9 pl-4 py-2 text-xs font-medium"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Products Stock Table */}
      {activeSubTab === 'STOCK' && (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
                <tr>
                  <th className="p-4">کۆد / بارکۆد</th>
                  <th className="p-4">بەرهەم</th>
                  <th className="p-4">پۆلێن</th>
                  <th className="p-4 text-center">بەردەست (کگم)</th>
                  <th className="p-4 text-center">نرخی فرۆشتن</th>
                  <th className="p-4 text-center">تێچووی کیلۆ</th>
                  <th className="p-4 text-left">بەهای کۆگا</th>
                  <th className="p-4 text-center no-print">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-[#86868B]">
                      هیچ بەرهەمێک لە کۆگای ئامادەدا نییە — کلیک لە «زیادکردنی بەرهەمی نوێ» بکە
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(prod => {
                    const isLow = prod.inStockKg < (prod.minAlertKg ?? 100);
                    return (
                      <tr key={prod.id} className="hover:bg-[#F5F5F7]/60 transition-colors">
                        <td className="p-4 font-mono">
                          <div className="font-bold text-[#0071E3]">{prod.code}</div>
                          <div className="text-[10px] text-[#86868B]">{prod.barcodePrefix}</div>
                        </td>
                        <td className="p-4 font-bold">{prod.nameKu}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#F5F5F7] text-[#515154] text-[10px] font-bold">
                            {CATEGORY_LABELS[prod.category] || prod.category}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full font-black tabular-nums ${
                              isLow
                                ? 'bg-[#FF3B30]/12 text-[#D70015]'
                                : 'bg-[#34C759]/12 text-[#248A3D]'
                            }`}
                          >
                            {prod.inStockKg.toLocaleString()} کگم
                          </span>
                        </td>
                        <td className="p-4 text-center font-bold tabular-nums">
                          {prod.pricePerKg.toLocaleString()} د.ع
                        </td>
                        <td className="p-4 text-center text-[#515154] tabular-nums">
                          {prod.costPerKg.toLocaleString()} د.ع
                        </td>
                        <td className="p-4 text-left font-black tabular-nums">
                          {Math.round(prod.inStockKg * prod.pricePerKg).toLocaleString()} د.ع
                        </td>
                        <td className="p-4 text-center no-print">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setStockInProdId(prod.id);
                                setStockInWeight('');
                                setStockInNote('');
                                setShowStockInModal(true);
                              }}
                              title="زیادکردنی کێش"
                              className="px-2.5 py-1 rounded-full bg-[#0071E3]/10 hover:bg-[#0071E3] text-[#0071E3] hover:text-white font-bold text-[11px] transition-colors"
                            >
                              + کێش
                            </button>
                            <button
                              type="button"
                              onClick={() => setBarcodeProduct(prod)}
                              title="ستیکەری بارکۆد"
                              aria-label="ستیکەری بارکۆد"
                              className="p-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#1D1D1F] text-[#1D1D1F] hover:text-white transition-colors"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(prod);
                                setEditPrice(String(prod.pricePerKg));
                                setEditCost(String(prod.costPerKg));
                                setEditMinAlert(String(prod.minAlertKg ?? 100));
                              }}
                              title="دەستکاری نرخ"
                              aria-label="دەستکاری نرخ"
                              className="p-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#0071E3] text-[#515154] hover:text-white transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const res = deleteProduct(prod.id);
                                if (!res.ok && res.error) alert(res.error);
                              }}
                              title="سڕینەوە"
                              aria-label="سڕینەوە"
                              className="p-1.5 rounded-lg bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Tab 2: Pending 3-Day Returns Conversion */}
      {activeSubTab === 'RETURNS' && (
        <div className="apple-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
                <tr>
                  <th className="p-4">ژ. وەسڵ</th>
                  <th className="p-4">بەروار</th>
                  <th className="p-4">سەرچاوە</th>
                  <th className="p-4">بەرهەمی گەڕاوە</th>
                  <th className="p-4 text-center">کێش</th>
                  <th className="p-4 text-center no-print">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {pendingReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-[#86868B]">
                      هیچ گەڕاوەیەکی ٣ ڕۆژ چاوەڕوانی گۆڕین نییە
                    </td>
                  </tr>
                ) : (
                  pendingReturns.map(r => (
                    <tr key={r.id} className="hover:bg-[#F5F5F7]/60">
                      <td className="p-4 font-mono font-bold text-[#FF3B30]">{r.manualReceiptNo}</td>
                      <td className="p-4 text-[#86868B] tabular-nums">{r.date}</td>
                      <td className="p-4 font-bold">{r.customerName || r.sourceName}</td>
                      <td className="p-4 text-[11px] text-[#515154]">
                        {r.items.map(i => `${i.productName} (${i.weightKg} کگم)`).join('، ')}
                      </td>
                      <td className="p-4 text-center font-black tabular-nums">{r.totalWeightKg} کگم</td>
                      <td className="p-4 text-center no-print">
                        <button
                          type="button"
                          onClick={() => {
                            setConvertingReturn(r);
                            setConvertOutputs([]);
                            setConvProdId(products[0]?.id || '');
                            setConvWeight('');
                            setConvNotes('');
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-[#FF9500] hover:bg-[#E08600] text-white font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          گۆڕین / تەلەف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Product */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">زیادکردنی بەرهەمی نوێ بۆ کۆگای ئامادە</h3>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#515154] mb-1">ناوی بەرهەم *</label>
                <input
                  type="text"
                  required
                  placeholder="نموونە: فیلێی سنگی مریشک"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">بارکۆد (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="سکان یان بنووسە..."
                    value={newBarcode}
                    onChange={e => setNewBarcode(e.target.value)}
                    className="apple-input w-full px-3.5 py-2 font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">پۆلێن</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value as ProductCategory)}
                    className="apple-input w-full px-3 py-2 font-semibold"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">نرخی فرۆش *</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="apple-input w-full px-3 py-2 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">تێچوو</label>
                  <input
                    type="number"
                    value={newCost}
                    onChange={e => setNewCost(e.target.value)}
                    className="apple-input w-full px-3 py-2 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">کێشی سەرەتا</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newInitialKg}
                    onChange={e => setNewInitialKg(e.target.value)}
                    className="apple-input w-full px-3 py-2 font-bold tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-[#34C759] hover:bg-[#2DB84D] text-white font-bold"
              >
                زیادکردن بۆ کۆگای ئامادە
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Stock Into Ready Warehouse */}
      {showStockInModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">داخلکردنی کێش بۆ کۆگای ئامادە</h3>
              <button
                type="button"
                onClick={() => setShowStockInModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-[#0071E3]/6 border border-[#0071E3]/20 space-y-2">
                <div className="font-bold text-[#0071E3]">سکان بە بارکۆد ریدەر (زیادکردنی خێرا)</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={stockInScanner}
                    onChange={e => setStockInScanner(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStockInScan();
                      }
                    }}
                    placeholder="بارکۆد سکان بکە و Enter دابگرە..."
                    className="apple-input bg-white flex-1 px-3 py-2 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleStockInScan}
                    className="px-4 py-2 rounded-xl bg-[#0071E3] text-white font-bold"
                  >
                    سکان
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitStockIn} className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">بەرهەم *</label>
                  <select
                    value={stockInProdId}
                    onChange={e => setStockInProdId(e.target.value)}
                    className="apple-input w-full px-3 py-2 font-bold"
                  >
                    {products.length === 0 && <option value="">هیچ بەرهەمێک نییە</option>}
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nameKu} (ئێستا: {p.inStockKg.toLocaleString()} کگم)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">کێشی زیادکراو (کگم) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="100"
                    value={stockInWeight}
                    onChange={e => setStockInWeight(e.target.value)}
                    className="apple-input w-full px-3.5 py-2 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#515154] mb-1">تێبینی (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    placeholder="بۆ نموونە: بەرهەمی ئەمڕۆ..."
                    value={stockInNote}
                    onChange={e => setStockInNote(e.target.value)}
                    className="apple-input w-full px-3.5 py-2"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold"
                >
                  داخلکردن بۆ کۆگای ئامادە
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Price */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">نرخی {editingProduct.nameKu}</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSavePrice} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#515154] mb-1">نرخی فرۆشتنی کیلۆ (د.ع)</label>
                <input
                  type="number"
                  required
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#515154] mb-1">تێچووی کیلۆ (د.ع)</label>
                <input
                  type="number"
                  required
                  value={editCost}
                  onChange={e => setEditCost(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#515154] mb-1">سنووری ئاگادارکردنەوەی کەمی (کگم)</label>
                <input
                  type="number"
                  value={editMinAlert}
                  onChange={e => setEditMinAlert(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 font-bold tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-[#0071E3] text-white font-bold"
              >
                پاشەکەوتکردن
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Barcode Sticker */}
      {barcodeProduct && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-xs p-6 shadow-2xl border border-black/[0.08] space-y-4 text-center apple-sheet">
            <div className="flex items-center justify-between no-print">
              <span className="text-xs font-bold text-[#86868B]">ستیکەری بارکۆد</span>
              <button
                type="button"
                onClick={() => setBarcodeProduct(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 rounded-2xl border border-dashed border-black/20 space-y-1.5">
              <div className="font-extrabold text-sm">{barcodeProduct.nameKu}</div>
              <div className="font-mono text-lg font-black tracking-widest text-[#1D1D1F]">
                {barcodeProduct.barcodePrefix}
              </div>
              <div className="text-xs font-bold text-[#0071E3]">
                {barcodeProduct.pricePerKg.toLocaleString()} د.ع / کگم
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full py-2.5 rounded-full bg-[#1D1D1F] text-white text-xs font-bold flex items-center justify-center gap-1.5 no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              چاپکردنی ستیکەر
            </button>
          </div>
        </div>
      )}

      {/* Modal: Convert 3-Day Return */}
      {convertingReturn && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl border border-black/[0.08] apple-sheet">
            <div className="p-5 bg-[#FBFBFD] border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#1D1D1F]">
                گۆڕینی گەڕاوەی #{convertingReturn.manualReceiptNo} ({convertingReturn.totalWeightKg} کگم)
              </h3>
              <button
                type="button"
                onClick={() => setConvertingReturn(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitConvert} className="p-5 space-y-3 text-xs">
              <div className="flex gap-2">
                <select
                  value={convProdId}
                  onChange={e => setConvProdId(e.target.value)}
                  className="apple-input flex-1 px-3 py-2 font-bold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nameKu}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  placeholder="کگم"
                  value={convWeight}
                  onChange={e => setConvWeight(e.target.value)}
                  className="apple-input w-24 px-3 py-2 font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    const prod = products.find(p => p.id === convProdId);
                    const w = Number(convWeight);
                    if (!prod || !w || w <= 0) return;
                    setConvertOutputs(prev => [
                      ...prev,
                      { productId: prod.id, productName: prod.nameKu, weightKg: w },
                    ]);
                    setConvWeight('');
                  }}
                  className="px-3 py-2 rounded-xl bg-[#0071E3] text-white font-bold"
                >
                  +
                </button>
              </div>
              {convertOutputs.length > 0 && (
                <div className="p-3 rounded-xl bg-[#F5F5F7] space-y-1">
                  {convertOutputs.map((o, idx) => (
                    <div key={idx} className="flex justify-between font-bold">
                      <span>{o.productName}</span>
                      <span>{o.weightKg} کگم</span>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="text"
                placeholder="تێبینی (بەتاڵ بەجێیبهێڵە بۆ تەلەف ئەگەر هیچ بەرهەمێک زیاد نەکرا)..."
                value={convNotes}
                onChange={e => setConvNotes(e.target.value)}
                className="apple-input w-full px-3.5 py-2"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-[#FF9500] text-white font-bold"
              >
                {convertOutputs.length > 0 ? 'خستنە ناو کۆگای ئامادە' : 'تۆمارکردن وەک تەلەف'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
