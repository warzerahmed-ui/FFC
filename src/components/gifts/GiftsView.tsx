import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Gift,
  Plus,
  Clock,
  Printer,
  Trash2,
  CheckCircle,
  User,
  Heart,
  Scale,
  Download,
  Search,
  Calendar,
} from 'lucide-react';
import { DispatchItem, DispatchOrder, roundTo250 } from '../../types';
import { FactoryLogo } from '../layout/FactoryLogo';
import { toLocalISODate } from '../../utils/date';

export const GiftsView: React.FC = () => {
  const { dispatches, products, custodyTransfers, factorySettings, repNames, currentUser, addDispatch, softDeleteRecord, hasAccess } = useApp();

  const isRepRole = currentUser.role === 'REP';
  const [showModal, setShowModal] = useState(false);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<DispatchOrder | null>(null);
  const [showFactoryCostOnPrint, setShowFactoryCostOnPrint] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form States
  const [manualReceiptNo, setManualReceiptNo] = useState('');
  const [date, setDate] = useState(toLocalISODate());
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
  const [sourceCustody, setSourceCustody] = useState<'READY' | 'REP'>(() =>
    currentUser.role === 'REP' ? 'REP' : 'READY'
  );
  const [repName, setRepName] = useState(() =>
    currentUser.role === 'REP' ? currentUser.name : repNames[0] || 'مەندوب شوان'
  );
  const effectiveSourceCustody = isRepRole ? 'REP' : sourceCustody;
  const effectiveRepName = isRepRole ? currentUser.name : repName;
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('دیاری و بەخشین — لەسەر خەڵک فری (٠ دینار) و تێچوو لەسەر کارگە');

  // Line items
  const defaultProduct = products[0];
  const [selectedProductId, setSelectedProductId] = useState(defaultProduct?.id || '');
  const [itemWeight, setItemWeight] = useState<number | ''>('');
  const [itemFactoryCostPerKg, setItemFactoryCostPerKg] = useState<number | ''>(
    defaultProduct?.costPerKg ?? 2750
  );
  const [itemsList, setItemsList] = useState<DispatchItem[]>([]);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    setItemFactoryCostPerKg(prod ? prod.costPerKg : 2750);
  };

  const handleOpenModal = () => {
    const firstProd = products[0];
    let nextNum = 100 + dispatches.filter(d => d.destinationType === 'GIFT').length + 1;
    while (dispatches.some(d => d.manualReceiptNo.trim().toLowerCase() === `g-${nextNum}`)) {
      nextNum += 1;
    }
    setManualReceiptNo(`G-${nextNum}`);
    setSelectedProductId(firstProd?.id || '');
    setItemFactoryCostPerKg(firstProd?.costPerKg ?? 2750);
    setItemsList([]);
    setItemWeight('');
    setRecipientName('');
    setNotes('دیاری و بەخشین — لەسەر خەڵک فری (٠ دینار) و تێچوو لەسەر کارگە');
    setShowModal(true);
  };

  const handleAddItem = () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod || !itemWeight || Number(itemWeight) <= 0) {
      alert('تکایە بەرهەم و کێش دیاری بکە');
      return;
    }

    const weight = Number(itemWeight);
    const alreadyQueued = itemsList
      .filter(i => i.productId === prod.id)
      .reduce((s, i) => s + i.weightKg, 0);

    if (effectiveSourceCustody === 'REP') {
      let availableStock = 0;
      const loaded = custodyTransfers
        .filter(
          t =>
            t.holderType === 'REP' &&
            t.holderName === effectiveRepName &&
            t.direction === 'LOAD' &&
            (!t.status || t.status === 'ACCEPTED')
        )
        .reduce(
          (s, t) => s + t.items.filter(i => i.productId === prod.id).reduce((is, i) => is + i.weightKg, 0),
          0
        );
      const sold = dispatches
        .filter(
          d =>
            (d.destinationType === 'REP' || (d.destinationType === 'GIFT' && d.sourceCustody === 'REP')) &&
            (d.repName || '') === effectiveRepName
        )
        .reduce(
          (s, d) => s + d.items.filter(i => i.productId === prod.id).reduce((is, i) => is + i.weightKg, 0),
          0
        );
      const ret = custodyTransfers
        .filter(
          t =>
            t.holderType === 'REP' &&
            t.holderName === effectiveRepName &&
            t.direction === 'RETURN_TO_READY' &&
            (!t.status || t.status === 'ACCEPTED')
        )
        .reduce(
          (s, t) => s + t.items.filter(i => i.productId === prod.id).reduce((is, i) => is + i.weightKg, 0),
          0
        );
      availableStock = Math.max(0, Number((loaded - sold - ret).toFixed(2)));

      if (weight + alreadyQueued > availableStock + 0.001) {
        alert(
          `ڕێگری لە دەرکردنی دیاری:\nبڕی پێویست لە کۆگای مەندوب (${effectiveRepName}) بەردەست نییە!\n\nبەرهەم: ${prod.nameKu}\nبەردەست: ${availableStock.toLocaleString()} کگم\nداواکراو: ${(weight + alreadyQueued).toLocaleString()} کگم`
        );
        return;
      }
    }

    const costPerKg =
      itemFactoryCostPerKg !== '' && Number(itemFactoryCostPerKg) >= 0
        ? Number(itemFactoryCostPerKg)
        : prod.costPerKg;
    const factoryCostAmount = roundTo250(weight * costPerKg);

    const newItem: DispatchItem = {
      productId: prod.id,
      productName: prod.nameKu,
      barcode: `${prod.barcodePrefix}${String(Math.round(weight * 1000)).padStart(5, '0')}`,
      weightKg: weight,
      pricePerKg: 0, // Always 0 IQD (Free) on recipient!
      totalAmount: 0,
      factoryCostPerKg: costPerKg,
      factoryCostAmount,
    };

    setItemsList([...itemsList, newItem]);
    setItemWeight('');
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(itemsList.filter((_, i) => i !== index));
  };

  const getItemFactoryCost = (item: DispatchItem): number => {
    if (item.factoryCostAmount !== undefined) return item.factoryCostAmount;
    const prod = products.find(p => p.id === item.productId);
    const cost = item.factoryCostPerKg ?? (prod ? prod.costPerKg : 2750);
    return roundTo250(item.weightKg * cost);
  };

  const getOrderFactoryCost = (order: DispatchOrder): number => {
    if (order.totalFactoryCost !== undefined) return order.totalFactoryCost;
    return order.items.reduce((sum, item) => sum + getItemFactoryCost(item), 0);
  };

  const totalWeight = itemsList.reduce((sum, item) => sum + item.weightKg, 0);
  const totalCost = itemsList.reduce((sum, item) => sum + getItemFactoryCost(item), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReceipt = manualReceiptNo.trim();
    if (!cleanReceipt || !recipientName.trim()) {
      alert('تکایە ژمارەی وەسڵ و ناوی وەرگر بنووسە');
      return;
    }
    if (
      dispatches.some(d => d.manualReceiptNo.trim().toLowerCase() === cleanReceipt.toLowerCase())
    ) {
      alert(`ڕێگری لە دووبارەبوونەوە:\nوەسڵی ژمارە "${cleanReceipt}" پێشتر تۆمارکراوە! تکایە ژمارەیەکی تر بنووسە.`);
      return;
    }

    if (itemsList.length === 0) {
      alert('تکایە بەلایەنی کەم یەک بەرهەم لەگەڵ کێشەکەی زیاد بکە');
      return;
    }

    addDispatch({
      manualReceiptNo,
      date,
      time,
      destinationType: 'GIFT',
      destinationName: recipientName.trim(),
      repName: effectiveRepName,
      customerName: recipientName.trim(),
      paymentType: 'CASH',
      sourceCustody: effectiveSourceCustody,
      items: itemsList,
      totalWeightKg: totalWeight,
      totalAmount: 0, // Always 0 IQD (Free on recipient)
      totalFactoryCost: totalCost, // Tracked on Factory account
      status: 'COMPLETED',
      notes,
    });

    setShowModal(false);
  };

  // Only GIFT dispatches + Filters (RBAC scoped for REP)
  const giftsList = dispatches.filter(
    d => d.destinationType === 'GIFT' && (!isRepRole || d.repName === currentUser.name)
  );
  const filteredGifts = giftsList.filter(d => {
    const q = searchTerm.trim().toLowerCase();
    const matchesQ =
      !q ||
      d.manualReceiptNo.toLowerCase().includes(q) ||
      (d.customerName && d.customerName.toLowerCase().includes(q)) ||
      (d.destinationName && d.destinationName.toLowerCase().includes(q)) ||
      (d.repName && d.repName.toLowerCase().includes(q));
    const matchesStart = !startDate || d.date.slice(0, 10) >= startDate;
    const matchesEnd = !endDate || d.date.slice(0, 10) <= endDate;
    return matchesQ && matchesStart && matchesEnd;
  });

  const totalGiftsKg = filteredGifts.reduce((sum, d) => sum + d.totalWeightKg, 0);
  const totalFactoryCost = filteredGifts.reduce((sum, d) => sum + getOrderFactoryCost(d), 0);

  const handleExportCsv = () => {
    const rows = [
      ['ژ. وەسڵ', 'بەروار', 'وەرگر', 'مەندوب / بەخشەر', 'کێش (کگم)', 'تێچووی کارگە (د.ع)', 'تێبینی'],
      ...filteredGifts.map(d => [
        d.manualReceiptNo,
        d.date,
        d.customerName || d.destinationName,
        d.repName || '',
        String(d.totalWeightKg),
        String(getOrderFactoryCost(d)),
        d.notes || '',
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Gifts-Report-${toLocalISODate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2.5">
            <Gift className="w-6 h-6 text-[#AF52DE]" />
            دیاری و هەدیە (سامپڵ و بەلاش)
          </h2>
          <p className="text-xs text-[#86868B] mt-1 font-medium">
            تۆمارکردنی مریشکی بەخشراو بە ٠ دینار بۆ مارکێتەکان، تێست، یان خێرخوازی لەسەر تێچووی کۆگا
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleExportCsv}
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
            onClick={handleOpenModal}
            className="px-5 py-2.5 bg-[#AF52DE] hover:bg-[#9E45CC] text-white font-semibold text-xs rounded-full shadow-sm shadow-[#AF52DE]/25 flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            + تۆمارکردنی وەسڵی دیاری (هەدیە)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>کۆی کێشی بەخشراو</span>
            <div className="w-8 h-8 rounded-2xl bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#AF52DE]">
            {totalGiftsKg.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">کگم</span>
          </div>
          <div className="mt-2 text-[11px] text-[#86868B] font-medium">
            لە کێشی کۆگای کارگە دەرچووە
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>نرخی فرۆش بە کڕیار</span>
            <div className="w-8 h-8 rounded-2xl bg-[#34C759]/10 text-[#248A3D] flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#248A3D]">
            ٠ <span className="text-xs font-medium text-[#86868B]">د.ع (بەلاش)</span>
          </div>
          <div className="mt-2 text-[11px] text-[#248A3D] font-medium">
            بێ هیچ بڕە پارەیەک
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>تێچووی لەسەر کارگە</span>
            <div className="w-8 h-8 rounded-2xl bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#FF9500]">
            {totalFactoryCost.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
          </div>
          <div className="mt-2 text-[11px] text-[#86868B] font-medium">
            تێچووی کڕین و بەخێوکردن
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-black/[0.06] shadow-sm">
          <div className="flex items-center justify-between text-[#86868B] text-xs font-semibold mb-2">
            <span>ژمارەی وەسڵەکانی دیاری</span>
            <div className="w-8 h-8 rounded-2xl bg-black/5 text-[#1D1D1F] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-[#1D1D1F]">
            {filteredGifts.length} <span className="text-xs font-medium text-[#86868B]">وەسڵ</span>
          </div>
          <div className="mt-2 text-[11px] text-[#86868B] font-medium">
            تۆمارکراوی سیستەم
          </div>
        </div>
      </div>

      {/* Search & Date Filter Bar */}
      <div className="apple-card p-3.5 flex flex-col md:flex-row md:items-center gap-3 no-print">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-[#86868B] mr-1 shrink-0" />
          <input
            type="text"
            placeholder="گەڕان بە ژ. وەسڵ، ناوی وەرگر یان مەندوب..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-[#1D1D1F] placeholder-[#86868B] outline-none w-full font-medium"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-[#AF52DE] shrink-0" />
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
          {(searchTerm || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#515154] font-semibold"
            >
              پاککردنەوە
            </button>
          )}
        </div>
      </div>

      {/* Table of Gifts */}
      <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-black/[0.05] flex items-center justify-between">
          <span className="font-bold text-xs text-[#1D1D1F]">
            لیستی وەسڵەکانی دیاری و هەدیە ({filteredGifts.length})
          </span>
          <span className="text-xs text-[#86868B]">بەروار و کاتژمێری دەرچوون</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
              <tr>
                <th className="p-4">ژ. وەسڵی دەستی</th>
                <th className="p-4">بەروار و کات</th>
                <th className="p-4">ناوی وەرگر (مارکێت / لایەن)</th>
                <th className="p-4">ناوی بەخشەر / مەندوب</th>
                <th className="p-4">بەرهەمەکان</th>
                <th className="p-4">کۆی کێش (کگم)</th>
                <th className="p-4">تێچوو لەسەر کارگە</th>
                <th className="p-4">لەسەر خەڵک / وەرگر</th>
                <th className="p-4">تێبینی</th>
                <th className="p-4 text-center">وەسڵ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
              {filteredGifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-[#86868B]">
                    هیچ وەسڵێکی دیاری تۆمار نەکراوە
                  </td>
                </tr>
              ) : (
                filteredGifts.map((d) => {
                  const rowFactoryCost = getOrderFactoryCost(d);
                  return (
                  <tr key={d.id} className="hover:bg-[#FBFBFD] transition-colors">
                    <td className="p-4 font-bold text-[#AF52DE]">
                      <span className="bg-[#AF52DE]/10 px-2.5 py-1 rounded-full text-[11px] font-mono">
                        {d.manualReceiptNo}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-[#1D1D1F]">{d.date}</div>
                      <div className="text-[10px] text-[#86868B] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-[#86868B]" />
                        <span>{d.time || '10:00 ص'}</span>
                      </div>
                    </td>

                    <td className="p-4 font-bold text-[#1D1D1F]">
                      {d.customerName || d.destinationName}
                    </td>

                    <td className="p-4 font-semibold text-[#515154]">
                      {d.repName || 'مەندوب'}
                    </td>

                    <td className="p-4 text-[#86868B]">
                      <div className="font-medium text-[#1D1D1F]">{d.items.length} جۆر بەرهەم</div>
                      <div className="text-[10px] text-[#86868B] truncate max-w-[150px]">
                        {d.items.map(i => `${i.productName} (${i.weightKg} کگم)`).join('، ')}
                      </div>
                    </td>

                    <td className="p-4 font-black text-[#AF52DE] text-sm">
                      {d.totalWeightKg.toLocaleString()} کگم
                    </td>

                    <td className="p-4">
                      <span className="bg-[#FF9500]/12 text-[#B25000] px-2.5 py-1 rounded-full text-[11px] font-black tabular-nums">
                        {rowFactoryCost.toLocaleString()} د.ع
                      </span>
                    </td>

                    <td className="p-4 font-bold text-[#34C759]">
                      <span className="bg-[#34C759]/10 text-[#248A3D] px-2.5 py-1 rounded-full text-[11px]">
                        ٠ د.ع (فری / بەلاش)
                      </span>
                    </td>

                    <td className="p-4 text-[#86868B]">
                      {d.notes || 'لەسەر تێچووی کۆگا'}
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setShowFactoryCostOnPrint(false);
                            setSelectedReceiptForPrint(d);
                          }}
                          className="p-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#EAEAEA] text-[#515154] hover:text-[#AF52DE] transition-colors"
                          title="بینینی وەسڵ و پرینت"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {hasAccess('settings') && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`وەسڵی دیاری #${d.manualReceiptNo} بخرێتە سەبەتەی سۆفت دیلیت؟`)) {
                                softDeleteRecord('DISPATCH', d.id, 'سڕینەوەی خێرا لە بەشی دیاری');
                              }
                            }}
                            className="p-1.5 rounded-lg bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white transition-colors"
                            title="سۆفت دیلیت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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

      {/* New Gift Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl border border-black/[0.08] animate-in fade-in duration-200">
            <div className="p-6 border-b border-black/[0.06] flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[#AF52DE] text-white flex items-center justify-center">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1D1D1F]">
                    تۆمارکردنی دیاری و هەدیەی نوێ (٠ دینار)
                  </h3>
                  <p className="text-[11px] text-[#86868B]">
                    دەرکردنی مریشک وەک سامپڵ یان بەخشین بە ٠ دینار لەسەر تێچووی کۆگا
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1">
                    ژمارەی وەسڵی دەستی *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="نموونە: G-106"
                    value={manualReceiptNo}
                    onChange={(e) => setManualReceiptNo(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] font-bold font-mono outline-none focus:border-[#AF52DE]"
                  />
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1">بەروار *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1">کاتژمێر</label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="نموونە: 10:00 ص"
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] outline-none font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#AF52DE]" />
                    ناوی مەندوب / بەخشەر *
                  </label>
                  <select
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] outline-none focus:border-[#AF52DE] font-semibold"
                  >
                    {repNames.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="کارگێڕی کارگە">کارگێڕی کارگە</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-[#FF3B30]" />
                    ناوی وەرگری دیاری (مارکێت، کەس، ڕێکخراو) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="نموونە: مارکێتی گوڵزار یان ڕێکخراوی هەژاران"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] outline-none focus:border-[#AF52DE] font-bold"
                  />
                </div>
              </div>

              {/* Source Custody Selector */}
              <div className="p-3 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#1D1D1F] block">سەرچاوەی دەرکردنی کێش:</span>
                  <span className="text-[11px] text-[#86868B]">
                    دیارییەکە لە کۆگای سەرەکی کارگە دەرچێت یان لە کۆگای ئەو مەندوبە؟
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceCustody('READY')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      sourceCustody === 'READY'
                        ? 'bg-[#AF52DE] text-white shadow-sm'
                        : 'bg-white text-[#515154] border border-black/[0.06]'
                    }`}
                  >
                    کۆگای سەرەکی (کارگە)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceCustody('REP')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      sourceCustody === 'REP'
                        ? 'bg-[#0071E3] text-white shadow-sm'
                        : 'bg-white text-[#515154] border border-black/[0.06]'
                    }`}
                  >
                    کۆگای مەندوب
                  </button>
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 rounded-2xl bg-[#AF52DE]/10 border border-[#AF52DE]/20 text-[#AF52DE] font-semibold flex items-center gap-2">
                <Gift className="w-4 h-4 shrink-0" />
                <span>
                  لەسەر وەرگر (خەڵک) بە تەواوی فرییە (٠ د.ع)، بەڵام نرخی تێچووەکەی لەسەر حسابی کارگە و ڕاپۆرتی قازانج و زیان تۆمار دەکرێت.
                </span>
              </div>

              {/* Line Items */}
              <div className="border border-black/[0.06] rounded-2xl p-4 bg-[#FBFBFD] space-y-3">
                <div className="font-bold text-[#1D1D1F] flex items-center justify-between">
                  <span>بەرهەمی دیاری و دیاریکردنی تێچووی کارگە</span>
                  <span className="text-[11px] font-normal text-[#86868B]">
                    نرخی تێچوو بە خۆکار لە کاڵاکان دێت و دەتوانیت بیگۆڕیت
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-[#86868B] font-semibold mb-1">
                      جۆری بەرهەم
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleProductChange(e.target.value)}
                      className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2 text-[#1D1D1F] outline-none font-semibold"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameKu} ({p.inStockKg.toLocaleString()} کگم کۆگا)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#86868B] font-semibold mb-1">
                      کێش (کگم) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="کێش (کگم) *"
                      value={itemWeight}
                      onChange={(e) => setItemWeight(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-white border border-black/[0.06] rounded-xl px-3 py-2 text-[#1D1D1F] font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#B25000] font-semibold mb-1">
                      تێچووی کیلۆ لەسەر کارگە (د.ع)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      placeholder="تێچووی کارگە"
                      value={itemFactoryCostPerKg}
                      onChange={(e) =>
                        setItemFactoryCostPerKg(e.target.value !== '' ? Number(e.target.value) : '')
                      }
                      className="w-full bg-white border border-[#FF9500]/35 rounded-xl px-3 py-2 text-[#B25000] font-black outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2 bg-white hover:bg-[#F5F5F7] border border-black/[0.08] text-[#AF52DE] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  زیادکردنی بەرهەم بۆ وەسڵی دیاری
                </button>

                {itemsList.length > 0 && (
                  <div className="mt-3 bg-white rounded-xl border border-black/[0.05] overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#F5F5F7] text-[#515154] font-semibold">
                        <tr>
                          <th className="p-2.5">بەرهەم</th>
                          <th className="p-2.5">کێش (کگم)</th>
                          <th className="p-2.5">نرخی کیلۆ (کارگە)</th>
                          <th className="p-2.5">تێچوو لەسەر کارگە</th>
                          <th className="p-2.5">لەسەر خەڵک</th>
                          <th className="p-2.5 text-center">سڕینەوە</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04]">
                        {itemsList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-2.5 font-bold text-[#1D1D1F]">{item.productName}</td>
                            <td className="p-2.5 font-black text-[#AF52DE]">{item.weightKg} کگم</td>
                            <td className="p-2.5 font-semibold text-[#515154] tabular-nums">
                              {(item.factoryCostPerKg || 0).toLocaleString()} د.ع
                            </td>
                            <td className="p-2.5 font-black text-[#B25000] tabular-nums">
                              {getItemFactoryCost(item).toLocaleString()} د.ع
                            </td>
                            <td className="p-2.5 text-[#248A3D] font-bold">٠ د.ع (فری)</td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-[#FF3B30] hover:text-[#E02D23] p-1"
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

              {/* Bottom Summary Bar */}
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[#86868B] text-xs block">کۆی کێشی دیاری:</span>
                  <span className="text-base font-black text-[#AF52DE] tabular-nums">
                    {totalWeight.toLocaleString()} کگم
                  </span>
                </div>
                <div>
                  <span className="text-[#B25000] text-xs font-semibold block">
                    تێچووی گشتی لەسەر کارگە:
                  </span>
                  <span className="text-base font-black text-[#FF9500] tabular-nums">
                    {totalCost.toLocaleString()} د.ع
                  </span>
                </div>
                <div>
                  <span className="text-[#248A3D] text-xs font-semibold block">
                    لەسەر وەرگر (خەڵک):
                  </span>
                  <span className="text-base font-black text-[#248A3D]">
                    ٠ د.ع (فری)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[#515154] font-semibold mb-1">تێبینی</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تێبینی دەربارەی دیاری یان هۆکار..."
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2.5 text-[#1D1D1F] outline-none focus:border-[#AF52DE]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#515154] hover:bg-[#F5F5F7]"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#AF52DE] hover:bg-[#9E45CC] shadow-md shadow-[#AF52DE]/25 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  پەسەندکردنی وەسڵی دیاری
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {selectedReceiptForPrint && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-3">
                <FactoryLogo size="md" />
                <div>
                  <h3 className="font-bold text-base text-[#1D1D1F]">وەسڵی دیاری و هەدیە (بەلاش)</h3>
                  <p className="text-[11px] text-[#86868B]">
                    {factorySettings.factoryName} • {factorySettings.phone1}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceiptForPrint(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FBFBFD] border border-black/[0.06] space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-dashed border-black/10 pb-2">
                <span>ژمارەی وەسڵ:</span>
                <span className="font-bold text-[#AF52DE]">{selectedReceiptForPrint.manualReceiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span>بەروار و کات:</span>
                <span>{selectedReceiptForPrint.date} - {selectedReceiptForPrint.time || '10:00 ص'}</span>
              </div>
              <div className="flex justify-between">
                <span>ناوی بەخشەر:</span>
                <span className="font-bold">{selectedReceiptForPrint.repName || 'مەندوب'}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-black/10 pb-2">
                <span>ناوی وەرگر:</span>
                <span className="font-bold text-[#1D1D1F]">{selectedReceiptForPrint.destinationName}</span>
              </div>

              <div className="space-y-1.5 py-2">
                <div className="font-bold text-[#515154] pb-1 border-b border-black/[0.05] flex justify-between">
                  <span>بەرهەم</span>
                  <div className="flex items-center gap-4">
                    <span>کێش (کگم)</span>
                    {showFactoryCostOnPrint && (
                      <span className="text-[#B25000]">تێچووی کارگە</span>
                    )}
                  </div>
                </div>
                {selectedReceiptForPrint.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span>{item.productName}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">{item.weightKg} کگم</span>
                      {showFactoryCostOnPrint && (
                        <span className="font-bold text-[#B25000] tabular-nums">
                          {getItemFactoryCost(item).toLocaleString()} د.ع
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-black/10 pt-2 flex justify-between text-sm font-bold">
                <span>کۆی گشتی کێش:</span>
                <span className="text-[#AF52DE]">{selectedReceiptForPrint.totalWeightKg} کگم</span>
              </div>
              {showFactoryCostOnPrint && (
                <div className="flex justify-between text-sm font-black text-[#B25000]">
                  <span>تێچووی لەسەر کارگە:</span>
                  <span>{getOrderFactoryCost(selectedReceiptForPrint).toLocaleString()} د.ع</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-[#34C759]">
                <span>بڕی پارە لەسەر وەرگر (خەڵک):</span>
                <span>٠ د.ع (فری / بەلاش)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 no-print">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#515154] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFactoryCostOnPrint}
                  onChange={(e) => setShowFactoryCostOnPrint(e.target.checked)}
                  className="rounded accent-[#FF9500]"
                />
                پیشاندانی تێچووی کارگە لەسەر وەسڵ (بۆ ژمێریاری)
              </label>

              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-[#AF52DE] hover:bg-[#9E45CC] text-white rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                پرینتکردنی وەسڵ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
