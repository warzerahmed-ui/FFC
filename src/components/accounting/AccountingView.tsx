import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Calculator,
  FileText,
  Plus,
  Printer,
  Receipt,
  Clock,
  Calendar,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { Customer, Supplier, PaymentVoucher } from '../../types';
import { FactoryLogo } from '../layout/FactoryLogo';
import { toLocalISODate } from '../../utils/date';

export type AccountingSubTab = 'VOUCHERS' | 'CUSTOMERS' | 'SUPPLIERS';

interface AccountingViewProps {
  activeSubTab?: AccountingSubTab;
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  activeSubTab: controlledSubTab,
}) => {
  const { customers, suppliers, vouchers, dispatches, intakes, posSales, returns, repNames, addVoucher, addCustomer, addSupplier, softDeleteRecord, hasAccess, factorySettings } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<AccountingSubTab>(controlledSubTab || 'VOUCHERS');

  useEffect(() => {
    if (controlledSubTab && controlledSubTab !== activeSubTab) {
      setActiveSubTab(controlledSubTab);
      if (controlledSubTab === 'CUSTOMERS') setSelectedSupplier(null);
      if (controlledSubTab === 'SUPPLIERS') setSelectedCustomer(null);
    }
  }, [controlledSubTab]);

  // Customer Statement Modal with Date Range Filter!
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>(toLocalISODate());

  // Supplier Statement Modal
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Settlement Voucher Modal States
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherType, setVoucherType] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [voucherDate, setVoucherDate] = useState(toLocalISODate());
  const [voucherTime, setVoucherTime] = useState(() =>
    new Date().toLocaleTimeString('ckb-IQ', { hour: '2-digit', minute: '2-digit' })
  );
  const [voucherAmount, setVoucherAmount] = useState<number | ''>('');
  const [voucherDiscount, setVoucherDiscount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [collectedByRep, setCollectedByRep] = useState<string>('');
  const [voucherNotes, setVoucherNotes] = useState('');

  // Search & Filter states
  const [customerSearch, setCustomerSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'ALL' | 'RECEIPT' | 'PAYMENT' | 'POS'>('ALL');
  const [voucherStartDate, setVoucherStartDate] = useState('');
  const [voucherEndDate, setVoucherEndDate] = useState('');
  const [printVoucher, setPrintVoucher] = useState<PaymentVoucher | null>(null);

  // Selected party's current debt
  const selectedCustomerObj = customers.find(c => c.id === selectedPartyId) || customers[0];
  const selectedSupplierObj = suppliers.find(s => s.id === selectedPartyId) || suppliers[0];

  const currentDebtBefore = voucherType === 'RECEIPT'
    ? (selectedCustomerObj ? selectedCustomerObj.currentDebt : 0)
    : (selectedSupplierObj ? selectedSupplierObj.currentBalance : 0);

  const totalSettledInput = (Number(voucherAmount) || 0) + (Number(voucherDiscount) || 0);
  const remainingDebtCalculated = Math.max(0, currentDebtBefore - totalSettledInput);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newInitialDebt] = useState<number | ''>(0);
  const [newPriceTier, setNewPriceTier] = useState<'STANDARD' | 'WHOLESALE' | 'SPECIAL'>('STANDARD');
  const [newCustomDiscount, setNewCustomDiscount] = useState<number | ''>('');

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !voucherAmount || Number(voucherAmount) <= 0) {
      alert('تکایە لایەن و بڕی پارەکە دیاری بکە');
      return;
    }

    const partyName = voucherType === 'RECEIPT'
      ? customers.find(c => c.id === selectedPartyId)?.name || 'کڕیار'
      : suppliers.find(s => s.id === selectedPartyId)?.name || 'کێڵگە';

    addVoucher({
      voucherNo: `${voucherType === 'RECEIPT' ? 'REC' : 'PAY'}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: voucherDate,
      time: voucherTime || new Date().toLocaleTimeString('ckb-IQ', { hour: '2-digit', minute: '2-digit' }),
      type: voucherType,
      partyType: voucherType === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER',
      partyId: selectedPartyId,
      partyName,
      amount: Number(voucherAmount),
      discount: Number(voucherDiscount) || 0,
      paymentMethod,
      ...(voucherType === 'RECEIPT' && collectedByRep ? { collectedByRep } : {}),
      notes: voucherNotes,
    });

    setShowVoucherModal(false);
    setVoucherAmount('');
    setVoucherDiscount('');
    setCollectedByRep('');
    setVoucherNotes('');
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    addCustomer({
      name: newName,
      phone: newPhone,
      type: 'SUPERMARKET',
      address: newAddress,
      currentDebt: Number(newInitialDebt) || 0,
      creditLimit: 5000000,
      priceTier: newPriceTier,
      customDiscountPerKg: Number(newCustomDiscount) || 0,
    });
    setShowAddCustomerModal(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewPriceTier('STANDARD');
    setNewCustomDiscount('');
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    addSupplier({
      name: newName,
      phone: newPhone,
      farmLocation: newAddress,
      currentBalance: Number(newInitialDebt) || 0,
    });
    setShowAddSupplierModal(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
  };

  // Build Dynamic Real-Time Ledger Transactions for Selected Customer
  const getCustomerTransactions = (customer: Customer) => {
    // 1. Purchases (from dispatches associated with this market/rep or initial orders)
    const purchaseTx = dispatches.flatMap((d) => {
      // Check if dispatch matches customer name or if it's a general market sale
      const isMatch = 
        (d.customerName && (d.customerName.includes(customer.name) || customer.name.includes(d.customerName))) ||
        (d.destinationName && (d.destinationName.includes(customer.name) || customer.name.includes(d.destinationName)));

      if (isMatch && (d.destinationType === 'REP' || d.destinationType === 'DIRECT')) {
        return [{
          id: d.id,
          date: d.date,
          time: d.time || '08:30 ص',
          refNo: d.manualReceiptNo,
          type: 'PURCHASE' as const,
          description:
            d.destinationType === 'DIRECT'
              ? `فرۆشتن لە ئامادە بۆ فرۆشتن (${d.totalWeightKg} کگم)`
              : `فرۆشی مەندوب (${d.repName || 'مەندوب'} - ${d.totalWeightKg} کگم)`,
          debit: d.paymentType === 'CASH' ? 0 : d.totalAmount, // قەرز زیاد دەکات
          credit: 0,
          discount: 0,
        }];
      }
      return [];
    });

    // 1b. Showroom POS Debt Purchases
    const posDebtTx = posSales
      .filter(
        s =>
          s.paymentType === 'DEBT' &&
          (s.customerId === customer.id ||
            (s.customerName &&
              (s.customerName.includes(customer.name) || customer.name.includes(s.customerName))))
      )
      .map(s => ({
        id: `pos-${s.id}`,
        date: s.date,
        time: s.time || '10:00 ص',
        refNo: s.saleNo,
        type: 'PURCHASE' as const,
        description: `فرۆشی قەرزی شۆرۆم (${s.items.map(i => `${i.productName} ${i.weightKg} کگم`).join('، ')})`,
        debit: s.total,
        credit: 0,
        discount: s.discount || 0,
      }));

    // 2. Real-time Payments (from vouchers where partyId === customer.id)
    const paymentTx = vouchers
      .filter(v => v.partyId === customer.id || v.partyName.includes(customer.name) || customer.name.includes(v.partyName))
      .map(v => ({
        id: v.id,
        date: v.date,
        time: v.time,
        refNo: v.voucherNo,
        type: 'PAYMENT' as const,
        description: `سند قبض - ${v.notes || 'پارەدانی کاش'}`,
        debit: 0,
        credit: v.amount, // قەرز کەم دەکاتەوە
        discount: v.discount || 0,
      }));

    // 3. Real-time Returns (گەڕاوەی تەلەفی ٣ ڕۆژ لە کڕیارەوە)
    const returnTx = returns
      .filter(r => 
        (r.customerName && (r.customerName.includes(customer.name) || customer.name.includes(r.customerName))) ||
        (r.sourceName && (r.sourceName.includes(customer.name) || customer.name.includes(r.sourceName)))
      )
      .map(r => ({
        id: r.id,
        date: r.date,
        time: r.time || '10:00 ص',
        refNo: r.manualReceiptNo,
        type: 'RETURN' as const,
        description: `گەڕاوەی تەلەف بۆ وەسڵی فرۆشتنی (${r.salesReceiptNo || 'دەستی'}) - ${r.totalWeightKg} کگم`,
        debit: 0,
        credit: r.totalCustomerDeduction || r.totalLossAmount, // کەمکردنەوەی قەرز لە حسابی کڕیار
        discount: 0,
      }));

    // Combine and sort by date & time
    const all = [...purchaseTx, ...posDebtTx, ...paymentTx, ...returnTx].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate opening balance before startDate
    let openingBalance = 0;
    const periodTransactions: any[] = [];

    all.forEach(tx => {
      if (tx.date < startDate) {
        openingBalance += (tx.debit - tx.credit - tx.discount);
      } else if (tx.date <= endDate) {
        periodTransactions.push(tx);
      }
    });

    // Calculate running balance for filtered period
    let running = openingBalance;
    const rowsWithBalance = periodTransactions.map(tx => {
      running += (tx.debit - tx.credit - tx.discount);
      return {
        ...tx,
        balanceAfter: running,
      };
    });

    const totalDebitPeriod = periodTransactions.reduce((sum, tx) => sum + tx.debit, 0);
    const totalCreditPeriod = periodTransactions.reduce((sum, tx) => sum + tx.credit, 0);
    const totalDiscountPeriod = periodTransactions.reduce((sum, tx) => sum + tx.discount, 0);

    return {
      openingBalance,
      rows: rowsWithBalance,
      totalDebitPeriod,
      totalCreditPeriod,
      totalDiscountPeriod,
      closingBalance: running,
    };
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#0071E3]" />
            ژمێریاری گشتی، کەشف حساب و سافکردنی قەرزەکان
          </h2>
          <p className="text-xs text-[#86868B] mt-1">
            کەشف حسابی مانگانە و بەروار-بۆ-بەرواری مارکێتەکان، هاوکاتکردنی ڕاستەوخۆی سەنەداتی دانەوە و باڵانسی ماوە
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setVoucherType('RECEIPT');
              setSelectedPartyId(customers[0]?.id || '');
              setVoucherDate(toLocalISODate());
              setVoucherTime(new Date().toLocaleTimeString('ckb-IQ', { hour: '2-digit', minute: '2-digit' }));
              setShowVoucherModal(true);
            }}
            className="px-4 py-2.5 bg-[#34C759] hover:bg-[#248A3D] text-white font-semibold text-xs rounded-full flex items-center gap-1.5 shadow-sm shadow-[#34C759]/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            سەنەدی قەبز (وەرگرتنی قەرز)
          </button>

          <button
            onClick={() => {
              setVoucherType('PAYMENT');
              setSelectedPartyId(suppliers[0]?.id || '');
              setVoucherDate(toLocalISODate());
              setVoucherTime(new Date().toLocaleTimeString('ckb-IQ', { hour: '2-digit', minute: '2-digit' }));
              setShowVoucherModal(true);
            }}
            className="px-4 py-2.5 bg-[#FF9500] hover:bg-[#E08500] text-white font-semibold text-xs rounded-full flex items-center gap-1.5 shadow-sm shadow-[#FF9500]/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            سەنەدی سەرف (دانەوە بە کێڵگە)
          </button>
        </div>
      </div>

      {/* View 1: Vouchers List */}
      {activeSubTab === 'VOUCHERS' && (() => {
        const vq = voucherSearch.trim().toLowerCase();
        const filteredVouchers = vouchers.filter(v => {
          if (voucherTypeFilter === 'RECEIPT' && v.type !== 'RECEIPT') return false;
          if (voucherTypeFilter === 'PAYMENT' && v.type !== 'PAYMENT') return false;
          if (voucherTypeFilter === 'POS' && !v.collectedAtPos) return false;
          if (voucherStartDate && v.date < voucherStartDate) return false;
          if (voucherEndDate && v.date > voucherEndDate) return false;
          if (!vq) return true;
          return (
            v.voucherNo.toLowerCase().includes(vq) ||
            v.partyName.toLowerCase().includes(vq) ||
            (v.notes || '').toLowerCase().includes(vq)
          );
        });

        const totalReceiptsAmt = filteredVouchers.filter(v => v.type === 'RECEIPT').reduce((s, v) => s + v.amount, 0);
        const totalPaymentsAmt = filteredVouchers.filter(v => v.type === 'PAYMENT').reduce((s, v) => s + v.amount, 0);

        const handleExportVouchersCsv = () => {
          const rows = [
            ['ژ. سەنەد', 'بەروار', 'کات', 'جۆر', 'لایەن', 'قەرزی پێشوو', 'بڕی دراو/وەرگیراو', 'داشکاندن', 'قەرزی ماوە', 'شێواز', 'تێبینی'],
            ...filteredVouchers.map(v => [
              v.voucherNo,
              v.date,
              v.time || '',
              v.type === 'RECEIPT' ? 'سند قبض' : 'سند صرف',
              v.partyName,
              String(v.previousDebt || 0),
              String(v.amount),
              String(v.discount || 0),
              String(v.remainingDebt || 0),
              v.paymentMethod === 'CASH' ? 'کاش' : 'حەواڵە/کارت',
              v.notes || '',
            ]),
          ];
          const csv = '\uFEFF' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vouchers-${toLocalISODate()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">وەرگیراو لە کڕیاران (سند قبض)</span>
              <div className="text-xl font-black text-[#248A3D] tabular-nums mt-1">
                +{totalReceiptsAmt.toLocaleString()} <span className="text-[11px] font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>
            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">دراو بە کێڵگەکان (سند صرف)</span>
              <div className="text-xl font-black text-[#FF9500] tabular-nums mt-1">
                -{totalPaymentsAmt.toLocaleString()} <span className="text-[11px] font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>
            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">صافی جوڵەی نەقدی سەنەدەکان</span>
              <div className="text-xl font-black text-[#0071E3] tabular-nums mt-1">
                {(totalReceiptsAmt - totalPaymentsAmt).toLocaleString()} <span className="text-[11px] font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="p-4 bg-[#FBFBFD] border-b border-black/[0.05] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'هەموو' },
                  { id: 'RECEIPT', label: 'سند قبض (کڕیار)' },
                  { id: 'PAYMENT', label: 'سند صرف (کێڵگە)' },
                  { id: 'POS', label: 'وەرگیراوی شۆرۆم (POS)' },
                ] as const
              ).map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVoucherTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    voucherTypeFilter === f.id
                      ? 'bg-[#0071E3] text-white'
                      : 'bg-[#F5F5F7] text-[#515154] hover:bg-[#E8E8ED]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={voucherSearch}
                  onChange={e => setVoucherSearch(e.target.value)}
                  placeholder="گەڕان بە سەنەد یان ناو..."
                  className="apple-input w-full pr-8 pl-3 py-1.5 text-xs"
                />
              </div>
              <input
                type="date"
                value={voucherStartDate}
                onChange={e => setVoucherStartDate(e.target.value)}
                className="apple-input px-2.5 py-1.5 text-xs"
              />
              <span className="text-[#86868B]">تا</span>
              <input
                type="date"
                value={voucherEndDate}
                onChange={e => setVoucherEndDate(e.target.value)}
                className="apple-input px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleExportVouchersCsv}
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
              <span className="text-xs text-[#86868B]">
                کۆ: <strong>{filteredVouchers.length}</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
                <tr>
                  <th className="p-4">ژ. سەنەد</th>
                  <th className="p-4">بەروار و کاتژمێر</th>
                  <th className="p-4">جۆری سەنەد</th>
                  <th className="p-4">لایەنی مامەڵە</th>
                  <th className="p-4">قەرزی پێشوو</th>
                  <th className="p-4">بڕی دراو / وەرگیراو</th>
                  <th className="p-4">داشکاندن (خصم)</th>
                  <th className="p-4">قەرزی ماوە (باڵانس)</th>
                  <th className="p-4">شێوازی پارەدان</th>
                  <th className="p-4">تێبینی</th>
                  <th className="p-4 text-center">چاپ</th>
                  {hasAccess('settings') && <th className="p-4 text-center">سڕینەوە</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                {filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-[#FBFBFD] transition-colors">
                    <td className="p-4 font-mono font-bold text-[#0071E3]">
                      <span className="bg-[#0071E3]/10 px-2.5 py-1 rounded-full text-[11px]">
                        {v.voucherNo}
                      </span>
                    </td>
                    <td className="p-4 text-[#515154]">
                      <div className="font-semibold text-[#1D1D1F]">{v.date}</div>
                      <div className="text-[10px] text-[#86868B] flex items-center gap-1 mt-0.5 font-mono">
                        <Clock className="w-3 h-3 text-[#0071E3]" />
                        {v.time || '10:00 ص'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                          v.type === 'RECEIPT'
                            ? 'bg-[#34C759]/10 text-[#248A3D]'
                            : 'bg-[#FF9500]/10 text-[#FF9500]'
                        }`}
                      >
                        {v.type === 'RECEIPT' ? 'سند قبض (وەرگرتن)' : 'سند صرف (پێدان)'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-[#1D1D1F]">{v.partyName}</td>
                    
                    <td className="p-4 text-[#86868B] font-semibold">
                      {v.previousDebt ? `${v.previousDebt.toLocaleString()} د.ع` : '---'}
                    </td>

                    <td className="p-4 font-black text-[#1D1D1F] text-sm">
                      {v.amount.toLocaleString()} د.ع
                    </td>

                    <td className="p-4 text-[#86868B]">
                      {v.discount ? `${v.discount.toLocaleString()} د.ع` : '---'}
                    </td>

                    <td className="p-4">
                      {v.remainingDebt === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#34C759] bg-[#34C759]/10 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          تەواو ساف بوو (0 د.ع)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#FF3B30] bg-[#FF3B30]/10 px-2.5 py-1 rounded-full">
                          {v.remainingDebt.toLocaleString()} د.ع ماوە
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-[#515154]">
                      <span className="bg-[#F5F5F7] px-2.5 py-1 rounded-full text-[11px] font-medium">
                        {v.paymentMethod === 'CASH' ? 'کاش' : 'حەواڵە / کارت'}
                      </span>
                    </td>
                    <td className="p-4 text-[#86868B]">{v.notes || '---'}</td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => setPrintVoucher(v)}
                        className="p-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#0071E3] text-[#1D1D1F] hover:text-white transition-colors"
                        title="چاپکردنی سەنەد"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    {hasAccess('settings') && (
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`سەنەدی #${v.voucherNo} بخرێتە سەبەتەی سۆفت دیلیت و قەرزی ${v.partyName} بگەڕێندرێتەوە؟`)) {
                              softDeleteRecord('VOUCHER', v.id, 'سڕینەوەی خێرا لە بەشی سەنەدەکان');
                            }
                          }}
                          className="p-1.5 rounded-lg bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white transition-colors"
                          title="سۆفت دیلیت (گەڕانەوەی قەرز)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
        );
      })()}

      {/* View 2: Customers Ledger */}
      {activeSubTab === 'CUSTOMERS' && (() => {
        const totalCustomersDebt = customers.reduce((s, c) => s + Math.max(0, c.currentDebt), 0);
        const debtorCount = customers.filter(c => c.currentDebt > 0).length;
        const handleExportCustomersCsv = () => {
          const rows = [
            ['ناوی کڕیار', 'جۆر', 'مۆبایل', 'ناونیشان', 'سنووری قەرز', 'قەرزی ئێستا (د.ع)'],
            ...filteredCustomers.map(c => [
              c.name,
              c.type,
              c.phone || '',
              c.address || '',
              String(c.creditLimit),
              String(c.currentDebt),
            ]),
          ];
          const csv = '\uFEFF' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `customers-debt-${toLocalISODate()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">کۆی قەرزی کڕیاران لە بازاڕدا</span>
              <div className="text-xl font-black text-[#FF3B30] tabular-nums mt-1">
                {totalCustomersDebt.toLocaleString()} <span className="text-[11px] font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>
            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">کڕیارە قەرزارەکان</span>
              <div className="text-xl font-black text-[#1D1D1F] tabular-nums mt-1">
                {debtorCount} <span className="text-[11px] font-medium text-[#86868B]">لە کۆی {customers.length} کڕیار</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#86868B] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="گەڕان بەپێی ناوی مارکێت یان تەلەفۆن..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full bg-white border border-black/[0.08] rounded-full pr-9 pl-4 py-2 text-xs text-[#1D1D1F] placeholder-[#86868B] outline-none focus:border-[#0071E3]"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleExportCustomersCsv}
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
                onClick={() => setShowAddCustomerModal(true)}
                className="text-xs text-[#0071E3] font-semibold hover:underline flex items-center gap-1"
              >
                + زیادکردنی کڕیاری نوێ
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
                <tr>
                  <th className="p-4">ناوی کڕیار / مارکێت</th>
                  <th className="p-4">جۆر</th>
                  <th className="p-4">تەلەفۆن و ناونیشان</th>
                  <th className="p-4">سنووری قەرز</th>
                  <th className="p-4">بڕی قەرزی ئێستا</th>
                  <th className="p-4">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FBFBFD]">
                    <td className="p-4 font-bold text-[#1D1D1F]">{c.name}</td>
                    <td className="p-4 text-[#86868B]">
                      <div>{c.type === 'SUPERMARKET' ? 'مارکێت' : c.type === 'RESTAURANT' ? 'چێشتخانە' : 'کۆ'}</div>
                      {c.priceTier && c.priceTier !== 'STANDARD' && (
                        <span className="inline-block text-[10px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-1.5 py-0.5 rounded-md mt-0.5">
                          {c.priceTier === 'WHOLESALE' ? 'جملە' : 'تایبەت'} {c.customDiscountPerKg ? `(-${c.customDiscountPerKg})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-[#86868B]">{c.phone} - {c.address}</td>
                    <td className="p-4">{c.creditLimit.toLocaleString()} د.ع</td>
                    <td className="p-4 font-black text-[#FF3B30] text-sm">
                      {c.currentDebt.toLocaleString()} د.ع
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="px-4 py-2 bg-[#0071E3]/10 hover:bg-[#0071E3] text-[#0071E3] hover:text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        دەرهێنانی کەشف حساب (بە بەروار)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* View 3: Suppliers Ledger */}
      {activeSubTab === 'SUPPLIERS' && (() => {
        const sq = supplierSearch.trim().toLowerCase();
        const filteredSuppliers = suppliers.filter(
          s => !sq || s.name.toLowerCase().includes(sq) || (s.phone || '').includes(sq) || (s.farmLocation || '').toLowerCase().includes(sq)
        );
        const totalSupplierDebt = suppliers.reduce((s, sup) => s + Math.max(0, sup.currentBalance), 0);
        const handleExportSuppliersCsv = () => {
          const rows = [
            ['ناوی کێڵگە', 'مۆبایل', 'ناونیشان', 'قەرزی سەر کارگە (د.ع)'],
            ...filteredSuppliers.map(s => [s.name, s.phone || '', s.farmLocation || '', String(s.currentBalance)]),
          ];
          const csv = '\uFEFF' + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `suppliers-balance-${toLocalISODate()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
        <div className="space-y-4">
          <div className="apple-card p-4 flex items-center justify-between text-xs">
            <span className="font-bold text-[#515154]">کۆی قەرزی کێڵگەکان لەسەر کارگە:</span>
            <span className="text-xl font-black text-[#FF9500] tabular-nums">
              {totalSupplierDebt.toLocaleString()} د.ع
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-[#86868B] absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="گەڕان بەپێی ناوی کێڵگە یان ناونیشان..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full bg-white border border-black/[0.08] rounded-full pr-9 pl-4 py-2 text-xs text-[#1D1D1F] placeholder-[#86868B] outline-none focus:border-[#0071E3]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportSuppliersCsv}
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
                onClick={() => setShowAddSupplierModal(true)}
                className="text-xs text-[#0071E3] font-semibold hover:underline flex items-center gap-1"
              >
                + زیادکردنی کێڵگەی نوێ
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-black/[0.06] shadow-sm overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.05]">
                <tr>
                  <th className="p-4">ناوی کێڵگە / فرۆشیار</th>
                  <th className="p-4">تەلەفۆن</th>
                  <th className="p-4">شوێنی کێڵگە</th>
                  <th className="p-4">ماوەی قەرز لەسەر کارگە</th>
                  <th className="p-4">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FBFBFD]">
                    <td className="p-4 font-bold text-[#1D1D1F]">{s.name}</td>
                    <td className="p-4 text-[#86868B]">{s.phone}</td>
                    <td className="p-4 text-[#86868B]">{s.farmLocation}</td>
                    <td className="p-4 font-black text-[#FF9500] text-sm">
                      {s.currentBalance.toLocaleString()} د.ع
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedSupplier(s)}
                        className="px-3.5 py-1.5 bg-[#F5F5F7] hover:bg-[#EAEAEA] text-[#1D1D1F] rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#0071E3]" />
                        کەشف حسابی کێڵگە
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* DYNAMIC REAL-TIME CUSTOMER STATEMENT WITH DATE RANGE FILTER (Directly addressing user request!) */}
      {selectedCustomer && (() => {
        const ledger = getCustomerTransactions(selectedCustomer);

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl p-6 md:p-8 shadow-2xl space-y-5 font-sans border border-black/[0.08] max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              
              {/* Statement Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/[0.08] pb-4 gap-4">
                <div className="flex items-start gap-3">
                  <FactoryLogo size="lg" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-[#1D1D1F]">
                        {factorySettings.factoryName} ({factorySettings.shortCode})
                      </span>
                      <span className="text-xs font-bold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-0.5 rounded-full">
                        کەشف حسابی فەرمی کڕیار (Account Statement)
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-[#1D1D1F] mt-1">{selectedCustomer.name}</h3>
                    <p className="text-xs text-[#86868B]">ناونیشان: {selectedCustomer.address} | تەلەفۆن: {selectedCustomer.phone}</p>
                    <p className="text-[11px] text-[#86868B] mt-0.5">کارگە: {factorySettings.address} • {factorySettings.phone1}</p>
                  </div>
                </div>

                <div className="text-left bg-[#F5F5F7] p-3 rounded-2xl border border-black/[0.04]">
                  <span className="text-[11px] text-[#86868B] block">قەرزی ماوەی ئێستا:</span>
                  <span className="text-xl font-black text-[#FF3B30]">{selectedCustomer.currentDebt.toLocaleString()} د.ع</span>
                </div>
              </div>

              {/* DATE RANGE FILTER CONTROLS (لە بەروار بۆ بەروار بۆ حسابی مانگانە) */}
              <div className="p-4 rounded-2xl bg-[#0071E3]/5 border border-[#0071E3]/15 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-[#1D1D1F] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#0071E3]" />
                    فلتەرکردنی ماوە (بەروار بۆ بەروار):
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[#86868B]">لە بەرواری:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 text-[#1D1D1F] font-semibold outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[#86868B]">بۆ بەرواری:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 text-[#1D1D1F] font-semibold outline-none"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const d = new Date();
                      d.setDate(1); // First of month
                      setStartDate(toLocalISODate(d));
                      setEndDate(toLocalISODate());
                    }}
                    className="px-3 py-1 bg-white hover:bg-[#F5F5F7] text-[#0071E3] border border-[#0071E3]/20 rounded-lg font-bold"
                  >
                    ئەم مانگە
                  </button>
                  <button
                    onClick={() => {
                      setStartDate('2026-01-01');
                      setEndDate(toLocalISODate());
                    }}
                    className="px-3 py-1 bg-white hover:bg-[#F5F5F7] text-[#515154] border border-black/[0.08] rounded-lg font-bold"
                  >
                    هەموو کات
                  </button>
                </div>
              </div>

              {/* Statement Summary Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7]">
                  <span className="text-[#86868B] block text-[11px]">قەرزی پێش ئەم بەروارە:</span>
                  <span className="text-base font-black text-[#1D1D1F] mt-0.5 block">{ledger.openingBalance.toLocaleString()} د.ع</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#0071E3]/10">
                  <span className="text-[#0071E3] block text-[11px]">کۆی کڕینی ئەم ماوەیە:</span>
                  <span className="text-base font-black text-[#0071E3] mt-0.5 block">+{ledger.totalDebitPeriod.toLocaleString()} د.ع</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#34C759]/10">
                  <span className="text-[#248A3D] block text-[11px]">کۆی پارەی دراو لەم ماوەیە:</span>
                  <span className="text-base font-black text-[#248A3D] mt-0.5 block">-{ledger.totalCreditPeriod.toLocaleString()} د.ع</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FF3B30]/10">
                  <span className="text-[#FF3B30] block text-[11px]">قەرزی ماوە لە کۆتایی ماوەکە:</span>
                  <span className="text-base font-black text-[#FF3B30] mt-0.5 block">{ledger.closingBalance.toLocaleString()} د.ع</span>
                </div>
              </div>

              {/* DETAILED LEDGER TABLE (Real-Time Rows with Running Balance) */}
              <div className="border border-black/[0.08] rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.06]">
                    <tr>
                      <th className="p-3.5">بەروار و کاتژمێر</th>
                      <th className="p-3.5">ژ. وەسڵ / سەنەد</th>
                      <th className="p-3.5">ڕوونکردنەوە و شێوازی مامەڵە</th>
                      <th className="p-3.5">کڕین (قەرز +)</th>
                      <th className="p-3.5">پارەی دراو (-)</th>
                      <th className="p-3.5">داشکاندن (خصم)</th>
                      <th className="p-3.5">باڵانسی قەرزی ماوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                    {/* Opening Balance Row */}
                    <tr className="bg-[#FBFBFD] font-bold text-[#86868B]">
                      <td className="p-3">{startDate}</td>
                      <td className="p-3">---</td>
                      <td className="p-3">قەرزی سەرەتای ماوە (Opening Balance)</td>
                      <td className="p-3">---</td>
                      <td className="p-3">---</td>
                      <td className="p-3">---</td>
                      <td className="p-3 font-black text-[#1D1D1F]">{ledger.openingBalance.toLocaleString()} د.ع</td>
                    </tr>

                    {/* Period Rows */}
                    {ledger.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-[#FBFBFD]">
                        <td className="p-3.5">
                          <div className="font-semibold">{row.date}</div>
                          <div className="text-[10px] text-[#86868B] font-mono">{row.time}</div>
                        </td>
                        <td className="p-3.5 font-bold font-mono">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                            row.type === 'PAYMENT' 
                              ? 'bg-[#34C759]/10 text-[#248A3D]' 
                              : row.type === 'RETURN'
                              ? 'bg-[#FF9500]/10 text-[#FF9500]'
                              : 'bg-[#0071E3]/10 text-[#0071E3]'
                          }`}>
                            {row.refNo}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium">{row.description}</td>
                        <td className="p-3.5 font-bold text-[#0071E3]">
                          {row.debit > 0 ? `+${row.debit.toLocaleString()} د.ع` : '---'}
                        </td>
                        <td className="p-3.5 font-bold text-[#248A3D]">
                          {row.credit > 0 ? `-${row.credit.toLocaleString()} د.ع` : '---'}
                        </td>
                        <td className="p-3.5 text-[#86868B]">
                          {row.discount > 0 ? `${row.discount.toLocaleString()} د.ع` : '---'}
                        </td>
                        <td className="p-3.5 font-black text-[#FF3B30]">
                          {row.balanceAfter.toLocaleString()} د.ع
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-3 text-xs border-t border-black/[0.08] gap-4">
                <span className="text-[#86868B]">
                  واژۆ و مۆری فەرمی ژمێریاری کارگە: __________________________ •{' '}
                  <span dir="ltr" className="font-bold text-[#0071E3]">RAND SUITE</span>
                </span>
                
                <div className="flex items-center gap-2.5 no-print">
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        [factorySettings.factoryName, 'کەشف حسابی کڕیار', selectedCustomer.name, `${startDate} تا ${endDate}`],
                        ['بەروار', 'کات', 'ژ. وەسڵ / سەنەد', 'وردەکاری', 'کڕین (+)', 'پارەی دراو (-)', 'داشکاندن', 'باڵانسی ماوە'],
                        [startDate, '---', '---', 'قەرزی سەرەتای ماوە', '0', '0', '0', String(ledger.openingBalance)],
                        ...ledger.rows.map(r => [
                          r.date,
                          r.time,
                          r.refNo,
                          r.description,
                          String(r.debit),
                          String(r.credit),
                          String(r.discount),
                          String(r.balanceAfter),
                        ]),
                      ];
                      const csv = '\uFEFF' + csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Statement-${selectedCustomer.name}-${endDate}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    title="دابەزاندنی Excel / CSV"
                    aria-label="دابەزاندنی Excel / CSV"
                    className="w-9 h-9 rounded-full bg-[#34C759]/12 hover:bg-[#34C759]/20 text-[#248A3D] flex items-center justify-center transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const cleanPhone = (selectedCustomer.phone || '').replace(/[^0-9]/g, '');
                      const intlPhone = cleanPhone.startsWith('0') ? '964' + cleanPhone.slice(1) : cleanPhone;
                      const msg = `سڵاو و ڕێز بەڕێز ${selectedCustomer.name}\n\nکەشفی حسابی کارگەی ${factorySettings.factoryName} (${factorySettings.shortCode}):\nکۆی ماوەی قەرز تا بەرواری ${endDate}: ${selectedCustomer.currentDebt.toLocaleString()} د.ع\n\nناونیشانی کارگە: ${factorySettings.address}\nتەلەفۆن: ${factorySettings.phone1} | ${factorySettings.phone2}\nسوپاس بۆ متمانەتان 🍗`;
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="px-5 py-2.5 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full font-bold flex items-center gap-2 shadow-sm transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    ناردن بە واتسئاپ (WhatsApp)
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    title="چاپکردنی کەشف حساب (PDF/کاغەز)"
                    aria-label="چاپکردن"
                    className="w-9 h-9 rounded-full bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white flex items-center justify-center shadow-sm transition-all"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="px-5 py-2.5 bg-[#F5F5F7] hover:bg-[#EAEAEA] text-[#515154] rounded-full font-semibold"
                  >
                    داخستن
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Supplier Statement Modal (Full Running-Balance Ledger with Date Range Filter) */}
      {selectedSupplier && (() => {
        const normalizeStr = (s: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const targetSupName = normalizeStr(selectedSupplier.name);

        type SupTxRow = {
          id: string;
          date: string;
          time: string;
          refNo: string;
          description: string;
          type: 'PURCHASE' | 'PAYMENT';
          creditIncrease: number; // قەرزی کێڵگە زیاد دەکات (+)
          debitPaid: number;      // پارەی دراو بە کێڵگە (-)
          discount: number;
          balanceAfter: number;
        };

        const rawSupTx: Omit<SupTxRow, 'balanceAfter'>[] = [];

        intakes.forEach(intake => {
          if (normalizeStr(intake.farmName) !== targetSupName) return;
          rawSupTx.push({
            id: `int-${intake.id}`,
            date: intake.date,
            time: '09:00',
            refNo: intake.manualReceiptNo,
            description: `کڕینی مریشکی زیندوو (${intake.netWeightKg.toLocaleString()} کگم × ${intake.pricePerKg.toLocaleString()} د.ع)`,
            type: 'PURCHASE',
            creditIncrease: intake.totalAmount,
            debitPaid: intake.paymentStatus === 'PAID' ? intake.totalAmount : intake.paidAmount || 0,
            discount: 0,
          });
        });

        vouchers.forEach(v => {
          if (v.type !== 'PAYMENT') return;
          if (v.partyId !== selectedSupplier.id && normalizeStr(v.partyName) !== targetSupName) return;
          rawSupTx.push({
            id: `pay-${v.id}`,
            date: v.date,
            time: v.time || '12:00',
            refNo: v.voucherNo,
            description: `سەنەدی سەرف (${v.paymentMethod === 'CASH' ? 'کاش' : 'حەواڵە'})${v.notes ? ` - ${v.notes}` : ''}`,
            type: 'PAYMENT',
            creditIncrease: 0,
            debitPaid: v.amount,
            discount: v.discount || 0,
          });
        });

        rawSupTx.sort((a, b) => a.date.localeCompare(b.date));

        let running = 0;
        let openingBal = 0;
        const periodRows: SupTxRow[] = [];
        let totalPurchasesPeriod = 0;
        let totalPaidPeriod = 0;

        rawSupTx.forEach(tx => {
          const netEffect = tx.creditIncrease - (tx.debitPaid + tx.discount);
          if (tx.date < startDate) {
            openingBal += netEffect;
            running = openingBal;
          } else if (tx.date <= endDate) {
            running += netEffect;
            totalPurchasesPeriod += tx.creditIncrease;
            totalPaidPeriod += tx.debitPaid + tx.discount;
            periodRows.push({ ...tx, balanceAfter: running });
          }
        });

        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-5 font-sans border border-black/[0.08]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/[0.06] pb-4 gap-3">
                <div className="flex items-center gap-3">
                  <FactoryLogo size="lg" />
                  <div>
                    <h3 className="text-xl font-extrabold text-[#1D1D1F]">کەشف حسابی کێڵگە / دابینکەر</h3>
                    <p className="text-xs text-[#86868B]">
                      {factorySettings.factoryName} - بەشی کڕین و ژمێریاری • {factorySettings.phone1}
                    </p>
                  </div>
                </div>
                <div className="text-left bg-[#F5F5F7] p-3 rounded-2xl border border-black/[0.04]">
                  <span className="text-[11px] text-[#86868B] block">قەرزی ماوەی ئێستا (بۆ کێڵگە):</span>
                  <span className="text-xl font-black text-[#FF9500] tabular-nums">
                    {selectedSupplier.currentBalance.toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              <div className="bg-[#F5F5F7] p-3.5 rounded-2xl text-xs grid grid-cols-1 sm:grid-cols-3 gap-2 text-[#515154]">
                <div>ناوی کێڵگە: <strong className="text-[#1D1D1F]">{selectedSupplier.name}</strong></div>
                <div>تەلەفۆن: <strong className="text-[#1D1D1F]">{selectedSupplier.phone || '---'}</strong></div>
                <div>شوێنی کێڵگە: <strong className="text-[#1D1D1F]">{selectedSupplier.farmLocation || '---'}</strong></div>
              </div>

              {/* Date Filter */}
              <div className="p-3.5 rounded-2xl bg-[#FF9500]/6 border border-[#FF9500]/20 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-[#1D1D1F] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#FF9500]" />
                    فلتەری بەروار:
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 text-[#1D1D1F] font-semibold outline-none"
                  />
                  <span className="text-[#86868B]">بۆ</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 text-[#1D1D1F] font-semibold outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(1);
                      setStartDate(toLocalISODate(d));
                      setEndDate(toLocalISODate());
                    }}
                    className="px-3 py-1 bg-white hover:bg-[#F5F5F7] text-[#FF9500] border border-[#FF9500]/25 rounded-lg font-bold"
                  >
                    ئەم مانگە
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('2026-01-01');
                      setEndDate(toLocalISODate());
                    }}
                    className="px-3 py-1 bg-white hover:bg-[#F5F5F7] text-[#515154] border border-black/[0.08] rounded-lg font-bold"
                  >
                    هەموو کات
                  </button>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7]">
                  <span className="text-[#86868B] block text-[11px]">قەرزی سەرەتای ماوە:</span>
                  <span className="text-base font-black text-[#1D1D1F] mt-0.5 block tabular-nums">
                    {openingBal.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FF9500]/10">
                  <span className="text-[#B25000] block text-[11px]">کۆی کڕینی ئەم ماوەیە:</span>
                  <span className="text-base font-black text-[#B25000] mt-0.5 block tabular-nums">
                    +{totalPurchasesPeriod.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#34C759]/10">
                  <span className="text-[#248A3D] block text-[11px]">پارەی دراو بە کێڵگە:</span>
                  <span className="text-base font-black text-[#248A3D] mt-0.5 block tabular-nums">
                    -{totalPaidPeriod.toLocaleString()} د.ع
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#FF3B30]/10">
                  <span className="text-[#FF3B30] block text-[11px]">قەرزی ماوە لە کۆتاییدا:</span>
                  <span className="text-base font-black text-[#FF3B30] mt-0.5 block tabular-nums">
                    {running.toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="border border-black/[0.08] rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-right">
                  <thead className="bg-[#F5F5F7] text-[#515154] font-bold border-b border-black/[0.06]">
                    <tr>
                      <th className="p-3">بەروار و کات</th>
                      <th className="p-3">ژ. وەسڵ / سەنەد</th>
                      <th className="p-3">ڕوونکردنەوە</th>
                      <th className="p-3">کڕین (قەرز +)</th>
                      <th className="p-3">پارەی دراو (-)</th>
                      <th className="p-3">داشکاندن</th>
                      <th className="p-3">باڵانسی ماوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] text-[#1D1D1F]">
                    <tr className="bg-[#FBFBFD] font-bold text-[#86868B]">
                      <td className="p-3">{startDate}</td>
                      <td className="p-3">---</td>
                      <td className="p-3">قەرزی سەرەتای ماوە (Opening Balance)</td>
                      <td className="p-3">---</td>
                      <td className="p-3">---</td>
                      <td className="p-3">---</td>
                      <td className="p-3 font-black text-[#1D1D1F] tabular-nums">
                        {openingBal.toLocaleString()} د.ع
                      </td>
                    </tr>
                    {periodRows.map(row => (
                      <tr key={row.id} className="hover:bg-[#FBFBFD]">
                        <td className="p-3">
                          <div className="font-semibold">{row.date}</div>
                          <div className="text-[10px] text-[#86868B] font-mono">{row.time}</div>
                        </td>
                        <td className="p-3 font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              row.type === 'PAYMENT'
                                ? 'bg-[#34C759]/10 text-[#248A3D]'
                                : 'bg-[#FF9500]/12 text-[#B25000]'
                            }`}
                          >
                            {row.refNo}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{row.description}</td>
                        <td className="p-3 font-bold text-[#B25000] tabular-nums">
                          {row.creditIncrease > 0 ? `+${row.creditIncrease.toLocaleString()} د.ع` : '---'}
                        </td>
                        <td className="p-3 font-bold text-[#248A3D] tabular-nums">
                          {row.debitPaid > 0 ? `-${row.debitPaid.toLocaleString()} د.ع` : '---'}
                        </td>
                        <td className="p-3 text-[#86868B] tabular-nums">
                          {row.discount > 0 ? `${row.discount.toLocaleString()} د.ع` : '---'}
                        </td>
                        <td className="p-3 font-black text-[#FF3B30] tabular-nums">
                          {row.balanceAfter.toLocaleString()} د.ع
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center pt-3 text-xs border-t border-black/[0.06] gap-3">
                <span className="text-[#86868B]">
                  مۆری فەرمی کارگە: ______________ •{' '}
                  <span dir="ltr" className="font-bold text-[#0071E3]">RAND SUITE</span>
                </span>
                <div className="flex gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => {
                      const csvRows = [
                        [factorySettings.factoryName, 'کەشف حسابی کێڵگە', selectedSupplier.name, `${startDate} تا ${endDate}`],
                        ['بەروار', 'کات', 'ژ. وەسڵ / سەنەد', 'وردەکاری', 'کڕین (+)', 'پارەی دراو (-)', 'داشکاندن', 'باڵانسی ماوە'],
                        [startDate, '---', '---', 'قەرزی سەرەتای ماوە', '0', '0', '0', String(openingBal)],
                        ...periodRows.map(r => [
                          r.date,
                          r.time,
                          r.refNo,
                          r.description,
                          String(r.creditIncrease),
                          String(r.debitPaid),
                          String(r.discount),
                          String(r.balanceAfter),
                        ]),
                      ];
                      const csv = '\uFEFF' + csvRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Supplier-${selectedSupplier.name}-${endDate}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
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
                    className="w-9 h-9 rounded-full bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white flex items-center justify-center shadow-sm transition-all"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSupplier(null)}
                    className="px-5 py-2.5 bg-[#F5F5F7] text-[#515154] rounded-full font-semibold"
                  >
                    داخستن
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Enhanced Voucher Modal (Tracks Date, Time, Current Debt, and Remaining Debt Live!) */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 text-xs shadow-2xl border border-black/[0.08] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-black/[0.06] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0071E3]" />
                  {voucherType === 'RECEIPT' ? 'سند قبض نوێ (وەرگرتنی قەرز)' : 'سند صرف نوێ (دانەوەی قەرز بە کێڵگە)'}
                </h3>
                <p className="text-[11px] text-[#86868B] mt-0.5">تۆمارکردنی کاتی ڕاستەقینە و حیسابکردنی قەرزی ماوە</p>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] font-bold">✕</button>
            </div>

            <form onSubmit={handleVoucherSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[#515154] font-semibold mb-1">دیاریکردنی لایەن:</label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F] font-semibold outline-none focus:border-[#0071E3] focus:bg-white"
                >
                  {voucherType === 'RECEIPT'
                    ? customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (قەرزی ئێستا: {c.currentDebt.toLocaleString()} د.ع)</option>
                      ))
                    : suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (قەرزی کێڵگە: {s.currentBalance.toLocaleString()} د.ع)</option>
                      ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#0071E3]" />
                    بەرواری سەنەد:
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[#515154] font-semibold mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#FF9500]" />
                    کاتی دانەوە (کاتژمێر):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="نموونە: 10:15 ص"
                    value={voucherTime}
                    onChange={(e) => setVoucherTime(e.target.value)}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:bg-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#515154] font-semibold mb-1">بڕی دراو / وەرگیراو (د.ع) *</label>
                  <input
                    type="number"
                    required
                    placeholder="500000"
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F] font-black text-sm outline-none focus:border-[#0071E3] focus:bg-white"
                  />
                </div>

                {voucherType === 'RECEIPT' ? (
                  <div>
                    <label className="block text-[#515154] font-semibold mb-1">داشکاندن (خصم د.ع):</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={voucherDiscount}
                      onChange={(e) => setVoucherDiscount(e.target.value ? Number(e.target.value) : '')}
                      className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F] outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[#515154] font-semibold mb-1">شێوازی پێدان:</label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                    >
                      <option value="CASH">کاش (دەستی)</option>
                      <option value="TRANSFER">حەواڵە / ئەلیکترۆنی</option>
                    </select>
                  </div>
                )}
              </div>

              {voucherType === 'RECEIPT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#515154] font-semibold mb-1">شێوازی وەرگرتن:</label>
                    <select
                      value={paymentMethod}
                      onChange={(e: any) => setPaymentMethod(e.target.value)}
                      className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                    >
                      <option value="CASH">کاش (لە ڕێگەی مەندوب یان نووسینگە)</option>
                      <option value="TRANSFER">حەواڵە / FIB</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#515154] font-semibold mb-1">مەندوبی وەرگر (ئارەزوومەندانە):</label>
                    <select
                      value={collectedByRep}
                      onChange={e => setCollectedByRep(e.target.value)}
                      className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                    >
                      <option value="">ڕاستەوخۆ / نووسینگە</option>
                      {repNames.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* LIVE DEBT CALCULATION CARD */}
              <div className="p-4 rounded-2xl bg-[#0071E3]/5 border border-[#0071E3]/15 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#86868B]">قەرزی ئەم لایەنە پێش دانەوە:</span>
                  <span className="font-bold text-[#1D1D1F]">{currentDebtBefore.toLocaleString()} د.ع</span>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-black/[0.06] pb-2">
                  <span className="text-[#86868B]">کۆی بڕی دراو + داشکاندن:</span>
                  <span className="font-bold text-[#34C759]">-{totalSettledInput.toLocaleString()} د.ع</span>
                </div>

                <div className="flex justify-between items-center text-xs font-black pt-0.5">
                  <span className="text-[#1D1D1F]">بڕی ئەو قەرزەی دەمێنێتەوە (ماوە):</span>
                  <span className={`text-sm ${remainingDebtCalculated === 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                    {remainingDebtCalculated === 0 ? '✓ تەواو ساف دەبێت (0 د.ع)' : `${remainingDebtCalculated.toLocaleString()} د.ع`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[#515154] font-semibold mb-1">تێبینی:</label>
                <input
                  type="text"
                  placeholder="سافکردنی بەشێک لە وەسڵە کۆنەکان..."
                  value={voucherNotes}
                  onChange={(e) => setVoucherNotes(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="w-1/2 py-2.5 bg-[#F5F5F7] text-[#515154] rounded-full font-semibold"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold rounded-full shadow-sm shadow-[#0071E3]/25"
                >
                  تۆمارکردن و سافکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-3.5 text-xs shadow-2xl border border-black/[0.08]">
            <h3 className="font-bold text-[#1D1D1F] text-sm">زیادکردنی کڕیاری نوێ</h3>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-3">
              <div>
                <label className="block text-[#515154] mb-1">ناوی کڕیار / مارکێت *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>
              <div>
                <label className="block text-[#515154] mb-1">تەلەفۆن</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>
              <div>
                <label className="block text-[#515154] mb-1">ناونیشان</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#515154] mb-1">پۆلی نرخ</label>
                  <select
                    value={newPriceTier}
                    onChange={e => setNewPriceTier(e.target.value as 'STANDARD' | 'WHOLESALE' | 'SPECIAL')}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3 py-2 text-[#1D1D1F] font-semibold"
                  >
                    <option value="STANDARD">ستاندارد (ئاسایی)</option>
                    <option value="WHOLESALE">جملە (مارکێتی گەورە)</option>
                    <option value="SPECIAL">تایبەت (چێشتخانە/هۆڵ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#515154] mb-1">داشکاندن (د.ع/کگم)</label>
                  <input
                    type="number"
                    placeholder="نموونە: 150"
                    value={newCustomDiscount}
                    onChange={e => setNewCustomDiscount(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F] tabular-nums"
                  />
                </div>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="w-1/2 py-2.5 bg-[#F5F5F7] text-[#515154] rounded-full font-semibold">پاشگەزبوونەوە</button>
                <button type="submit" className="w-1/2 py-2.5 bg-[#0071E3] text-white font-bold rounded-full">زیادکردن</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-3.5 text-xs shadow-2xl border border-black/[0.08]">
            <h3 className="font-bold text-[#1D1D1F] text-sm">زیادکردنی کێڵگەی نوێ</h3>
            <form onSubmit={handleAddSupplierSubmit} className="space-y-3">
              <div>
                <label className="block text-[#515154] mb-1">ناوی کێڵگە / فرۆشیار *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>
              <div>
                <label className="block text-[#515154] mb-1">تەلەفۆن</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>
              <div>
                <label className="block text-[#515154] mb-1">ناوچە و ناونیشانی کێڵگە</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3.5 py-2 text-[#1D1D1F]"
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button type="button" onClick={() => setShowAddSupplierModal(false)} className="w-1/2 py-2.5 bg-[#F5F5F7] text-[#515154] rounded-full font-semibold">پاشگەزبوونەوە</button>
                <button type="submit" className="w-1/2 py-2.5 bg-[#0071E3] text-white font-bold rounded-full">زیادکردن</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Voucher Modal */}
      {printVoucher && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] no-print">
              <span className="text-xs font-bold text-[#86868B]">
                {printVoucher.type === 'RECEIPT' ? 'سند قبض (وەرگرتن)' : 'سند صرف (پێدان)'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#0071E3] text-white rounded-full text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپکردن
                </button>
                <button
                  type="button"
                  onClick={() => setPrintVoucher(null)}
                  className="px-3 py-1.5 bg-[#F5F5F7] text-[#515154] rounded-full text-xs font-bold"
                >
                  داخستن
                </button>
              </div>
            </div>

            <div className="space-y-3 text-center text-xs text-[#1D1D1F]">
              <div className="flex justify-center">
                <FactoryLogo size="sm" />
              </div>
              <h4 className="font-black text-base">{factorySettings.factoryName}</h4>
              <p className="text-[11px] font-bold text-[#0071E3]">
                {printVoucher.type === 'RECEIPT' ? 'سەنەدی وەرگرتن (سند قبض)' : 'سەنەدی پێدان (سند صرف)'}
              </p>

              <div className="border-t border-b border-dashed border-black/20 py-2 space-y-1 text-[11px] text-right">
                <div className="flex justify-between">
                  <span className="text-[#86868B]">ژ. سەنەد:</span>
                  <span className="font-mono font-bold">{printVoucher.voucherNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868B]">بەروار و کات:</span>
                  <span>{printVoucher.date} {printVoucher.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868B]">لایەن:</span>
                  <span className="font-bold">{printVoucher.partyName}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] text-right">
                <div className="flex justify-between">
                  <span className="text-[#86868B]">قەرزی پێشوو:</span>
                  <span className="font-bold tabular-nums">{(printVoucher.previousDebt || 0).toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-[#248A3D]">
                  <span className="font-bold">بڕی دراو / وەرگیراو:</span>
                  <span className="font-black tabular-nums">{printVoucher.amount.toLocaleString()} د.ع</span>
                </div>
                {printVoucher.discount > 0 && (
                  <div className="flex justify-between text-[#FF9500]">
                    <span>داشکاندن:</span>
                    <span className="font-bold tabular-nums">{printVoucher.discount.toLocaleString()} د.ع</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black pt-1.5 border-t border-black/15">
                  <span>قەرزی ماوە:</span>
                  <span className={printVoucher.remainingDebt > 0 ? 'text-[#D70015]' : 'text-[#248A3D]'}>
                    {printVoucher.remainingDebt.toLocaleString()} د.ع
                  </span>
                </div>
              </div>

              {printVoucher.notes && (
                <p className="text-[10px] text-[#86868B] text-right">تێبینی: {printVoucher.notes}</p>
              )}
              <p dir="ltr" className="text-[9px] font-bold text-[#86868B] tracking-widest uppercase pt-1">
                Powered by RAND SUITE
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
