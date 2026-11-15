import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShoppingBag,
  Barcode,
  Printer,
  Trash2,
  CreditCard,
  Banknote,
  Boxes,
  Users,
  Plus,
  Search,
  TrendingUp,
  X,
  Scale,
  Receipt,
  Percent,
  Edit3,
  AlertCircle,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Clock,
  FileText,
  Truck,
} from 'lucide-react';
import { POSSaleItem, POSSale, ProductItem, BranchStockItem, roundTo250 } from '../../types';
import { FactoryLogo } from '../layout/FactoryLogo';

// ==========================================
// AUDIO FEEDBACK (Web Audio API)
// ==========================================
const playPosBeep = (type: 'success' | 'scale' | 'error' = 'success') => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'scale') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      osc.frequency.setValueAtTime(1360, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
      osc.start();
      osc.stop(ctx.currentTime + 0.11);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // AudioContext blocked or unsupported
  }
};

// ==========================================
// SVG BARCODE GENERATOR
// ==========================================
const BarcodeSVG: React.FC<{ code: string; width?: number; height?: number }> = ({
  code,
  width = 200,
  height = 44,
}) => {
  const bars: { x: number; w: number }[] = [];
  let currentX = 10;
  const totalLength = code.length || 10;
  const barUnit = (width - 20) / (totalLength * 3.5);

  for (let i = 0; i < totalLength; i++) {
    const charCode = code.charCodeAt(i % code.length) || 50;
    const w1 = ((charCode % 3) + 1) * barUnit;
    const space = (((charCode >> 1) % 2) + 1) * barUnit;
    const w2 = (((charCode >> 2) % 3) + 1) * barUnit;

    bars.push({ x: currentX, w: w1 });
    currentX += w1 + space;
    bars.push({ x: currentX, w: w2 });
    currentX += w2 + space;
  }

  return (
    <svg width={width} height={height} className="mx-auto select-none">
      <rect width={width} height={height} fill="#FFFFFF" />
      {bars.map((bar, idx) => (
        <rect key={idx} x={bar.x} y={4} width={Math.max(1, bar.w)} height={height - 18} fill="#1D1D1F" />
      ))}
      <text
        x={width / 2}
        y={height - 2}
        textAnchor="middle"
        fontSize="10"
        fontFamily="monospace"
        fill="#515154"
        letterSpacing="2"
      >
        {code}
      </text>
    </svg>
  );
};

interface HeldOrder {
  id: string;
  label: string;
  time: string;
  items: POSSaleItem[];
  discountPercent: number;
  discountAmount: number;
  customerName: string;
}

export type PosSubTab = 'REGISTER' | 'INVENTORY' | 'REGISTER_REPORT';

interface POSViewProps {
  activeSubTab?: PosSubTab;
  onSubTabChange?: (tab: PosSubTab) => void;
}

export const POSView: React.FC<POSViewProps> = ({
  activeSubTab: controlledSubTab,
  onSubTabChange,
}) => {
  const {
    products,
    posSales,
    branchStock,
    branchDeliveries,
    dispatches,
    customers,
    branchExpenses,
    currentUser,
    factorySettings,
    addPOSSale,
    addBranchDelivery,
    addBranchExpense,
    updateBranchStockItem,
    parseWeightBarcode,
    softDeleteRecord,
    hasAccess,
  } = useApp();

  // Standalone Showroom Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<PosSubTab>(controlledSubTab || 'REGISTER');

  useEffect(() => {
    if (controlledSubTab && controlledSubTab !== activeSubTab) {
      setActiveSubTab(controlledSubTab);
    }
  }, [controlledSubTab]);

  const handleSubTabChange = (tab: PosSubTab) => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };

  // POS Register State
  const [cart, setCart] = useState<POSSaleItem[]>([]);
  const [scannerInput, setScannerInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<'CASH' | 'FIB_OR_CARD' | 'DEBT'>('CASH');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('کڕیاری ئاسایی نەقد');
  const [selectedDebtCustomerId, setSelectedDebtCustomerId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warn' | 'info' } | null>(null);

  // Hold / Park Orders
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    try {
      const saved = localStorage.getItem('ffc_pos_held_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem('ffc_pos_held_orders', JSON.stringify(heldOrders));
  }, [heldOrders]);

  // Modals
  const [weightModalProduct, setWeightModalProduct] = useState<ProductItem | null>(null);
  const [weightKeypadValue, setWeightKeypadValue] = useState<string>('1.000');
  const [printReceipt, setPrintReceipt] = useState<POSSale | null>(null);
  const [showZReportModal, setShowZReportModal] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState<BranchStockItem | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<string>('');

  // Inbound Stock Receipt Modal (Manual & Barcode Receive at Showroom)
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveReceiptNo, setReceiveReceiptNo] = useState('');
  const [receiveRepName, setReceiveRepName] = useState('');
  const [receiveProdId, setReceiveProdId] = useState(products[0]?.id || '');
  const [receiveWeight, setReceiveWeight] = useState('');
  const [receiveScannerInput, setReceiveScannerInput] = useState('');
  const [receiveScanFeedback, setReceiveScanFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [receiveItems, setReceiveItems] = useState<
    { productId: string; productName: string; weightKg: number; trayCount?: number; factoryPricePerKg: number; totalCost: number }[]
  >([]);
  const receiveScannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showReceiveModal) {
      setReceiveScanFeedback(null);
      setReceiveScannerInput('');
      setTimeout(() => receiveScannerRef.current?.focus(), 60);
    }
  }, [showReceiveModal]);

  // Expenses Modal
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expCategory, setExpCategory] = useState<'RENT' | 'ELECTRICITY' | 'PACKAGING' | 'SALARIES' | 'CLEANING' | 'MAINTENANCE' | 'OTHER'>('PACKAGING');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  const scannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeSubTab === 'REGISTER' && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [activeSubTab]);

  // Keyboard Shortcuts: F2 (Focus Scanner), F4 (Checkout), Esc (Close Modals)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleSubTabChange('REGISTER');
        setTimeout(() => scannerInputRef.current?.focus(), 50);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (
          activeSubTab === 'REGISTER' &&
          cart.length > 0 &&
          !printReceipt &&
          !weightModalProduct &&
          !showZReportModal &&
          !showReceiveModal
        ) {
          handleCompleteSale();
        }
      } else if (e.key === 'Escape') {
        setWeightModalProduct(null);
        setPrintReceipt(null);
        setEditingPriceItem(null);
        setShowZReportModal(false);
        setShowReceiveModal(false);
        setShowAddExpenseModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const showToast = (text: string, type: 'success' | 'warn' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ==========================================
  // CART & BARCODE LOGIC (AGGREGATED + 250 ROUNDING)
  // ==========================================
  const addItemToCart = (product: ProductItem, weightKg: number, pricePerKg: number, barcodeStr?: string): boolean => {
    const branchItem = branchStock.find(b => b.productId === product.id);
    const availableStock = branchItem ? branchItem.inStockKg : 0;
    const existingIndex = cart.findIndex(item => item.productId === product.id && item.pricePerKg === pricePerKg);
    const existingWeight = existingIndex > -1 ? cart[existingIndex].weightKg : 0;
    const newTotalWeight = Math.round((existingWeight + weightKg) * 1000) / 1000;

    if (newTotalWeight > availableStock + 0.001) {
      playPosBeep('error');
      alert(
        `ڕێگری لە فرۆشتنی زێدە:\nناتوانیت لە بڕی بەردەستی کۆگای شۆرۆم زیاتر بفرۆشیت!\n\nبەرهەم: ${product.nameKu}\nبەردەست لە کۆگا: ${availableStock.toFixed(1)} کگم\nکێشی داواکراو: ${newTotalWeight.toFixed(3)} کگم\n\nتکایە بار لە مەندوب یان بەشی کۆگا وەربگرە.`
      );
      return false;
    }

    const total = roundTo250(weightKg * pricePerKg);
    setCart(prev => {
      const existing = prev.findIndex(item => item.productId === product.id && item.pricePerKg === pricePerKg);
      if (existing > -1) {
        const updated = [...prev];
        const newWeight = Math.round((updated[existing].weightKg + weightKg) * 1000) / 1000;
        updated[existing] = {
          ...updated[existing],
          weightKg: newWeight,
          total: roundTo250(newWeight * pricePerKg),
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.nameKu,
          barcode: barcodeStr || product.barcodePrefix,
          weightKg,
          pricePerKg,
          total,
        },
      ];
    });
    return true;
  };

  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawBarcode = scannerInput.trim();
    if (!rawBarcode) return;

    const result = parseWeightBarcode(rawBarcode);
    if (result.valid && (result.product || result.branchItem)) {
      const prod = result.product || products.find(p => p.id === result.branchItem?.productId);
      if (!prod) {
        playPosBeep('error');
        showToast('بەرهەم نەدۆزرایەوە!', 'warn');
        setScannerInput('');
        return;
      }

      const branchItem = branchStock.find(b => b.productId === prod.id);
      const baseRetailPrice = branchItem ? branchItem.retailPricePerKg : prod.pricePerKg;
      const weight = result.weightKg > 0 ? result.weightKg : 1.0;
      const effectivePrice =
        result.embeddedPrice && result.embeddedPrice > 0
          ? Math.round(result.embeddedPrice / weight)
          : baseRetailPrice;

      const added = addItemToCart(prod, weight, effectivePrice, rawBarcode);
      if (added) {
        playPosBeep(rawBarcode.length >= 13 ? 'scale' : 'success');
        showToast(
          `سکان کرا: ${prod.nameKu} (${weight.toFixed(3)} کگم • ${roundTo250(weight * effectivePrice).toLocaleString()} د.ع)`,
          'success'
        );
      }
      setScannerInput('');
    } else {
      playPosBeep('error');
      showToast('بارکۆد نەناسراوە یان هەڵەیە', 'warn');
      setScannerInput('');
    }
  };

  const updateCartItemWeight = (index: number, delta: number) => {
    const targetItem = cart[index];
    if (!targetItem) return;

    const newWeight = Math.round((targetItem.weightKg + delta) * 1000) / 1000;
    if (newWeight <= 0) {
      removeCartItem(index);
      return;
    }

    if (delta > 0) {
      const branchItem = branchStock.find(b => b.productId === targetItem.productId);
      const avail = branchItem ? branchItem.inStockKg : 0;
      const otherWeight = cart
        .filter((i, idx) => idx !== index && i.productId === targetItem.productId)
        .reduce((s, i) => s + i.weightKg, 0);

      if (newWeight + otherWeight > avail + 0.001) {
        playPosBeep('error');
        showToast(`ناتوانیت لە کۆگای شۆرۆم (${avail.toFixed(1)} کگم) زیاتر زیاد بکەیت`, 'warn');
        return;
      }
    }

    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      updated[index] = {
        ...item,
        weightKg: newWeight,
        total: roundTo250(newWeight * item.pricePerKg),
      };
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    playPosBeep('scale');
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountPercent(0);
    setCashGiven('');
    setSelectedDebtCustomerId('');
    setCustomerNameInput('کڕیاری ئاسایی نەقد');
  };

  // Hold / Resume
  const handleHoldOrder = () => {
    if (cart.length === 0) return;
    const newHeld: HeldOrder = {
      id: `hold-${Date.now()}`,
      label:
        customerNameInput && customerNameInput !== 'کڕیاری ئاسایی نەقد'
          ? customerNameInput
          : `وەسڵی ڕاگیراو #${heldOrders.length + 1}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      discountPercent,
      discountAmount,
      customerName: customerNameInput,
    };
    setHeldOrders(prev => [newHeld, ...prev]);
    clearCart();
    playPosBeep('scale');
    showToast('وەسڵەکە بە کاتی ڕاگیرا (Hold)', 'info');
  };

  const handleResumeHeldOrder = (orderId: string) => {
    const target = heldOrders.find(o => o.id === orderId);
    if (!target) return;
    if (cart.length > 0) handleHoldOrder();
    setCart(target.items);
    setDiscountPercent(target.discountPercent);
    setDiscountAmount(target.discountAmount);
    setCustomerNameInput(target.customerName || 'کڕیاری ئاسایی نەقد');
    setHeldOrders(prev => prev.filter(o => o.id !== orderId));
    playPosBeep('success');
    showToast(`وەسڵی "${target.label}" گەڕێندرایەوە`, 'success');
  };

  // Totals (250 IQD rounded)
  const subtotal = roundTo250(cart.reduce((sum, item) => sum + item.total, 0));
  const rawDiscount = discountPercent > 0 ? (subtotal * discountPercent) / 100 : discountAmount;
  const calculatedDiscount = roundTo250(rawDiscount);
  const netTotal = roundTo250(Math.max(0, subtotal - calculatedDiscount));
  const numericCashGiven = parseFloat(cashGiven) || 0;
  const changeDue = numericCashGiven > netTotal ? roundTo250(numericCashGiven - netTotal) : 0;

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast('سەبەتە بەتاڵە! تکایە بەرهەم هەڵبژێرە', 'warn');
      return;
    }

    const stockShortages: string[] = [];
    cart.forEach(item => {
      const branchItem = branchStock.find(b => b.productId === item.productId);
      const avail = branchItem ? branchItem.inStockKg : 0;
      if (item.weightKg > avail + 0.001) {
        stockShortages.push(`• ${item.productName}: داواکراو ${item.weightKg.toFixed(3)} کگم / بەردەست ${avail.toFixed(1)} کگم`);
      }
    });

    if (stockShortages.length > 0) {
      playPosBeep('error');
      alert(`ڕێگری لە دەرکردنی وەسڵ:\nبڕی پێویست لە کۆگای شۆرۆمدا نییە:\n\n${stockShortages.join('\n')}`);
      return;
    }

    const resolvedCustomerName =
      paymentType === 'DEBT' && selectedDebtCustomerId
        ? customers.find(c => c.id === selectedDebtCustomerId)?.name || customerNameInput.trim() || 'کڕیاری قەرز'
        : customerNameInput.trim() || 'کڕیاری ئاسایی نەقد';

    const sale = addPOSSale({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      subtotal,
      discount: calculatedDiscount,
      total: netTotal,
      paidAmount:
        paymentType === 'CASH'
          ? numericCashGiven > 0
            ? numericCashGiven
            : netTotal
          : paymentType === 'DEBT'
          ? 0
          : netTotal,
      changeAmount: changeDue,
      paymentType,
      customerId: paymentType === 'DEBT' ? selectedDebtCustomerId || undefined : undefined,
      customerName: resolvedCustomerName,
      cashierName: currentUser?.name || 'کاشێری شۆرۆم',
    });

    playPosBeep('success');
    setPrintReceipt(sale);
    clearCart();
    showToast(`وەسڵی ${sale.saleNo} تەواو کرا`, 'success');
  };

  // ==========================================
  // INBOUND STOCK RECEIPT (شۆرۆم وەرگرتنی بار)
  // ==========================================
  const showroomInboundReceipts = useMemo(() => {
    const repDeliveries = dispatches
      .filter(d => {
        const t = (d.customerName || d.destinationName || '').toLowerCase();
        return t.includes('شۆرۆم') || t.includes('فرۆشگا') || (factorySettings.showroomName && t.includes(factorySettings.showroomName.toLowerCase()));
      })
      .map(d => ({
        id: d.id,
        receiptNo: d.manualReceiptNo,
        date: d.date,
        time: d.time,
        repName: d.repName || d.destinationName,
        totalWeightKg: d.totalWeightKg,
        itemsCount: d.items.length,
        source: 'REP_RECEIPT' as const,
      }));

    const manualDeliveries = branchDeliveries.map(b => ({
      id: b.id,
      receiptNo: b.manualReceiptNo,
      date: b.date,
      time: b.time,
      repName: b.repName,
      totalWeightKg: b.totalWeightKg,
      itemsCount: b.items.length,
      source: 'DIRECT_INBOUND' as const,
    }));

    return [...repDeliveries, ...manualDeliveries].sort((a, b) => b.date.localeCompare(a.date));
  }, [dispatches, branchDeliveries, factorySettings.showroomName]);

  const appendReceiveProduct = (prod: ProductItem, weightKg: number, isTrayScan = false) => {
    const cost = prod.costPerKg || 3000;
    setReceiveItems(prev => {
      const idx = prev.findIndex(i => i.productId === prod.id);
      if (idx > -1) {
        const updated = [...prev];
        const newW = Math.round((updated[idx].weightKg + weightKg) * 1000) / 1000;
        const newTrays = (updated[idx].trayCount || 0) + (isTrayScan ? 1 : 0);
        updated[idx] = {
          ...updated[idx],
          weightKg: newW,
          trayCount: newTrays > 0 ? newTrays : undefined,
          totalCost: roundTo250(newW * cost),
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.nameKu,
          weightKg,
          trayCount: isTrayScan ? 1 : undefined,
          factoryPricePerKg: cost,
          totalCost: roundTo250(weightKg * cost),
        },
      ];
    });
  };

  const handleReceiveBarcodeScan = () => {
    const raw = receiveScannerInput.trim();
    if (!raw) return;

    const result = parseWeightBarcode(raw);
    if (result.valid && (result.product || result.branchItem)) {
      const prod = result.product || products.find(p => p.id === result.branchItem?.productId);
      if (!prod) {
        playPosBeep('error');
        setReceiveScanFeedback({ text: 'بەرهەم نەدۆزرایەوە!', ok: false });
        setReceiveScannerInput('');
        return;
      }
      const w = result.weightKg > 0 ? result.weightKg : 1.0;
      appendReceiveProduct(prod, w, true);
      playPosBeep(raw.length >= 13 ? 'scale' : 'success');
      setReceiveScanFeedback({
        text: `سکان کرا: ${prod.nameKu} (+١ قاپ • ${w.toFixed(3)} کگم)`,
        ok: true,
      });
    } else {
      playPosBeep('error');
      setReceiveScanFeedback({ text: `بارکۆد نەناسراوە: ${raw}`, ok: false });
    }
    setReceiveScannerInput('');
    setTimeout(() => receiveScannerRef.current?.focus(), 20);
  };

  const handleAddReceiveItem = () => {
    const prod = products.find(p => p.id === receiveProdId);
    const w = parseFloat(receiveWeight);
    if (!prod || isNaN(w) || w <= 0) {
      showToast('تکایە بەرهەم و کێشێکی دروست بنووسە', 'warn');
      return;
    }
    appendReceiveProduct(prod, w, false);
    setReceiveWeight('');
  };

  const handleSubmitReceiveStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (receiveItems.length === 0) {
      showToast('تکایە لانیکەم یەک بەرهەم سکان بکە یان زیاد بکە', 'warn');
      return;
    }
    const totalKg = Math.round(receiveItems.reduce((s, i) => s + i.weightKg, 0) * 1000) / 1000;
    const totalTrays = receiveItems.reduce((s, i) => s + (i.trayCount || 0), 0);
    const totalCost = receiveItems.reduce((s, i) => s + i.totalCost, 0);
    const cleanItems = receiveItems.map(({ trayCount: _tc, ...rest }) => rest);
    addBranchDelivery({
      manualReceiptNo: receiveReceiptNo.trim() || `SH-IN-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      repName: receiveRepName.trim() || 'مەندوب / گەیاندنی ناوخۆ',
      items: cleanItems,
      totalWeightKg: totalKg,
      totalCost,
      notes:
        totalTrays > 0
          ? `وەرگرتنی باری قاپ بە بارکۆد ریدەر لە شۆرۆم (${totalTrays} قاپ)`
          : 'وەرگرتنی باری ڕاستەوخۆ لە شۆرۆم',
    });
    playPosBeep('success');
    showToast(
      totalTrays > 0
        ? `${totalTrays} قاپ (${totalKg.toFixed(2)} کگم) خرایە سەر کۆگای شۆرۆم`
        : `${totalKg.toFixed(1)} کگم خرایە سەر کۆگای شۆرۆم`,
      'success'
    );
    setReceiveItems([]);
    setReceiveReceiptNo('');
    setReceiveRepName('');
    setReceiveScannerInput('');
    setReceiveScanFeedback(null);
    setShowReceiveModal(false);
  };

  // ==========================================
  // EXPENSES & Z-REPORT TOTALS
  // ==========================================
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount);
    if (!expTitle.trim() || isNaN(amount) || amount <= 0) {
      showToast('تکایە ناو و بڕی خەرجی بنووسە', 'warn');
      return;
    }
    addBranchExpense({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: expTitle.trim(),
      amount: roundTo250(amount),
      category: expCategory,
    });
    playPosBeep('success');
    showToast('خەرجی شۆرۆم تۆمارکرا', 'success');
    setExpTitle('');
    setExpAmount('');
    setShowAddExpenseModal(false);
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = activeCategory === 'ALL' || p.category === activeCategory;
    const matchesSearch =
      !searchFilter.trim() ||
      p.nameKu.includes(searchFilter.trim()) ||
      p.code.includes(searchFilter.trim());
    return matchesCat && matchesSearch;
  });

  const totalCashSales = posSales.filter(s => s.paymentType === 'CASH').reduce((sum, s) => sum + s.total, 0);
  const totalCardSales = posSales.filter(s => s.paymentType === 'FIB_OR_CARD').reduce((sum, s) => sum + s.total, 0);
  const totalDebtSales = posSales.filter(s => s.paymentType === 'DEBT').reduce((sum, s) => sum + s.total, 0);
  const totalAllSales = posSales.reduce((sum, s) => sum + s.total, 0);
  const totalBranchExpenses = branchExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashInDrawer = totalCashSales - totalBranchExpenses;
  const totalShowroomStockKg = branchStock.reduce((sum, b) => sum + b.inStockKg, 0);
  const lowStockCount = branchStock.filter(b => b.inStockKg < 5).length;

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-full shadow-xl border font-bold text-xs flex items-center gap-2.5 apple-glass apple-sheet ${
            toastMessage.type === 'success'
              ? 'border-[#34C759]/30 text-[#1D1D1F]'
              : toastMessage.type === 'warn'
              ? 'border-[#FF3B30]/30 text-[#FF3B30]'
              : 'border-[#0071E3]/30 text-[#0071E3]'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              toastMessage.type === 'success'
                ? 'bg-[#34C759]'
                : toastMessage.type === 'warn'
                ? 'bg-[#FF3B30]'
                : 'bg-[#0071E3]'
            }`}
          />
          {toastMessage.text}
        </div>
      )}

      {/* STANDALONE SHOWROOM HEADER & SEGMENTED NAVIGATION */}
      <div className="apple-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0071E3] to-[#005BB5] text-white flex items-center justify-center shadow-sm shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-[#1D1D1F] tracking-tight">
                {factorySettings.showroomName || 'فرۆشگای تایبەت (شۆرۆم - POS)'}
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#248A3D] bg-[#34C759]/12 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                دووکانی سەربەخۆ
              </span>
              {lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D70015] bg-[#FF3B30]/12 px-2.5 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />
                  {lowStockCount} بەرهەم کەمبووە
                </span>
              )}
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              کاشێری بارکۆد و تەرازوو • وەرگرتنی باری مەندوب • کۆگا و ژمێریاریی سەندوق
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] font-bold">
            <Boxes className="w-3.5 h-3.5 text-[#34C759]" />
            <span>کۆگای ئێستا: {totalShowroomStockKg.toFixed(0)} کگم</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] font-bold">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF9500]" />
            <span>وەسڵی تۆمارکراو: {posSales.length}</span>
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: POS REGISTER (کاشێر و فرۆشتن) */}
      {/* ===================================================================== */}
      {activeSubTab === 'REGISTER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* RIGHT SIDE (7 cols): BARCODE SCANNER & PRODUCT GRID */}
          <div className="lg:col-span-7 space-y-4">
            {/* Clean Barcode Scanner Bar */}
            <div className="apple-card p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-[#1D1D1F]">
                  <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                  <span>سکانەری بارکۆد و تەرازوو ئامادەیە</span>
                </div>
                <span className="text-[11px] font-mono text-[#86868B]">
                  F2: سکانەر • F4: تەواوکردن و چاپ
                </span>
              </div>

              <form onSubmit={handleBarcodeSubmit} className="relative flex items-center">
                <Barcode className="w-5 h-5 text-[#0071E3] absolute right-3.5 pointer-events-none" />
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={scannerInput}
                  onChange={e => setScannerInput(e.target.value)}
                  placeholder="بارکۆدی تەرازوو سکان بکە یان کۆد بنووسە و Enter دابگرە..."
                  className="apple-input w-full pr-11 pl-24 py-3 text-sm font-mono font-bold tabular-nums"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute left-1.5 px-4 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl text-xs transition-all active:scale-95"
                >
                  تۆمارکردن
                </button>
              </form>
            </div>

            {/* Category Filter & Product Touch Grid */}
            <div className="apple-card p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: 'هەموو' },
                    { id: 'WHOLE_CHICKEN', label: 'مریشکی تەواو' },
                    { id: 'BREAST', label: 'سنگ' },
                    { id: 'THIGH', label: 'ڕان' },
                    { id: 'WINGS', label: 'باڵ و مل' },
                    { id: 'GIBLETS', label: 'جگەر و قەسیل' },
                    { id: 'BONES_SCRAP', label: 'ئێسک' },
                  ].map(cat => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        activeCategory === cat.id
                          ? 'bg-[#1D1D1F] text-white shadow-xs'
                          : 'bg-[#F5F5F7] text-[#515154] hover:bg-[#E8E8ED]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 min-w-[160px] max-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    placeholder="گەڕان..."
                    className="apple-input w-full pr-8 pl-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map(product => {
                  const branchItem = branchStock.find(b => b.productId === product.id);
                  const inStock = branchItem ? branchItem.inStockKg : 0;
                  const price = branchItem ? branchItem.retailPricePerKg : product.pricePerKg;

                  return (
                    <button
                      type="button"
                      key={product.id}
                      onClick={() => {
                        if (inStock <= 0) {
                          playPosBeep('error');
                          showToast(`"${product.nameKu}" لە کۆگای شۆرۆمدا نەماوە!`, 'warn');
                          return;
                        }
                        setWeightModalProduct(product);
                        setWeightKeypadValue(inStock < 1 ? inStock.toFixed(3) : '1.000');
                        playPosBeep('scale');
                      }}
                      className={`text-right p-3.5 rounded-2xl border transition-all active:scale-[0.98] flex flex-col justify-between min-h-[110px] group ${
                        inStock <= 0
                          ? 'bg-[#F5F5F7]/40 border-black/[0.04] opacity-65'
                          : 'bg-[#F5F5F7]/80 hover:bg-white border-black/[0.05] hover:border-[#0071E3]/40 hover:shadow-md'
                      }`}
                    >
                      <div className="w-full space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white text-[#515154] border border-black/[0.05]">
                            #{product.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                              inStock > 20
                                ? 'bg-[#34C759]/12 text-[#248A3D]'
                                : inStock >= 5
                                ? 'bg-[#FF9500]/12 text-[#B25000]'
                                : 'bg-[#FF3B30]/12 text-[#D70015]'
                            }`}
                          >
                            {inStock <= 0
                              ? 'نەماوە'
                              : inStock < 5
                              ? `${inStock.toFixed(1)} کگم • کەمە!`
                              : `${inStock.toFixed(1)} کگم`}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors line-clamp-2">
                          {product.nameKu}
                        </h4>
                      </div>

                      <div className="w-full flex items-center justify-between pt-2 mt-2 border-t border-black/[0.05]">
                        <span className="text-xs font-extrabold text-[#0071E3] tabular-nums">
                          {price.toLocaleString()} <span className="text-[10px] font-medium text-[#86868B]">د.ع</span>
                        </span>
                        <span className="w-6 h-6 rounded-full bg-white group-hover:bg-[#0071E3] text-[#86868B] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                          <Scale className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LEFT SIDE (5 cols): SMART CART & CHECKOUT */}
          <div className="lg:col-span-5">
            <div className="apple-card p-5 flex flex-col justify-between min-h-[580px]">
              <div>
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#0071E3] text-white font-bold text-xs flex items-center justify-center tabular-nums">
                      {cart.length}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#1D1D1F]">سەبەتەی فرۆشتن</h3>
                      <p className="text-[10px] text-[#86868B]">کاشێر: {currentUser?.name}</p>
                    </div>
                  </div>

                  {cart.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleHoldOrder}
                        className="px-2.5 py-1 rounded-full text-[#FF9500] bg-[#FF9500]/10 hover:bg-[#FF9500]/18 text-xs font-bold transition-colors flex items-center gap-1"
                        title="ڕاگرتنی کاتیی وەسڵ"
                      >
                        <PauseCircle className="w-3.5 h-3.5" />
                        ڕاگرتن
                      </button>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="px-2.5 py-1 rounded-full text-[#FF3B30] hover:bg-[#FF3B30]/10 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        پاککردنەوە
                      </button>
                    </div>
                  )}
                </div>

                {/* Held Orders Pills */}
                {heldOrders.length > 0 && (
                  <div className="mt-2.5 p-2.5 rounded-2xl bg-[#FF9500]/8 border border-[#FF9500]/20 space-y-1.5">
                    <div className="text-[10px] font-extrabold text-[#B25000] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>وەسڵە ڕاگیراوەکان ({heldOrders.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {heldOrders.map(order => (
                        <div
                          key={order.id}
                          className="inline-flex items-center gap-1 bg-white border border-[#FF9500]/30 rounded-full pl-1.5 pr-2.5 py-1 text-[11px] shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleResumeHeldOrder(order.id)}
                            className="flex items-center gap-1 font-bold text-[#1D1D1F] hover:text-[#0071E3]"
                          >
                            <PlayCircle className="w-3.5 h-3.5 text-[#34C759]" />
                            <span>{order.label}</span>
                            <span className="text-[10px] text-[#86868B] font-mono">({order.time})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHeldOrders(prev => prev.filter(o => o.id !== order.id))}
                            className="text-[#86868B] hover:text-[#FF3B30] p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cart Items */}
                <div className="divide-y divide-black/[0.05] max-h-[250px] overflow-y-auto my-2">
                  {cart.length === 0 ? (
                    <div className="py-14 text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] text-[#86868B] flex items-center justify-center mx-auto">
                        <Barcode className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-xs text-[#1D1D1F]">سەبەتە بەتاڵە</p>
                      <p className="text-[11px] text-[#86868B]">بارکۆد سکان بکە یان لە بەرهەمەکان هەڵبژێرە</p>
                    </div>
                  ) : (
                    cart.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-[#1D1D1F] truncate">{item.productName}</h5>
                          <div className="text-[10px] text-[#86868B] tabular-nums">
                            {item.pricePerKg.toLocaleString()} د.ع / کگم
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-[#F5F5F7] p-0.5 rounded-full border border-black/[0.04]">
                          <button
                            type="button"
                            onClick={() => updateCartItemWeight(idx, -0.25)}
                            className="w-6 h-6 rounded-full bg-white text-[#1D1D1F] font-bold text-xs flex items-center justify-center hover:bg-[#FF3B30] hover:text-white transition-colors shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-14 text-center font-bold text-xs tabular-nums text-[#1D1D1F]">
                            {item.weightKg.toFixed(3)}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartItemWeight(idx, 0.25)}
                            className="w-6 h-6 rounded-full bg-white text-[#1D1D1F] font-bold text-xs flex items-center justify-center hover:bg-[#34C759] hover:text-white transition-colors shadow-2xs"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-left w-20 font-extrabold text-xs text-[#0071E3] tabular-nums">
                          {item.total.toLocaleString()} د.ع
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCartItem(idx)}
                          className="text-[#86868B] hover:text-[#FF3B30] p-1 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Payment & Checkout Area */}
              <div className="pt-3 border-t border-black/[0.06] space-y-3">
                {paymentType === 'DEBT' && (
                  <div className="p-2.5 rounded-2xl bg-[#FF3B30]/8 border border-[#FF3B30]/20 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-[#D70015] font-bold">
                      <Users className="w-3.5 h-3.5" />
                      <span>هەڵبژاردنی کڕیاری قەرز:</span>
                    </div>
                    <select
                      value={selectedDebtCustomerId}
                      onChange={e => {
                        const cid = e.target.value;
                        setSelectedDebtCustomerId(cid);
                        const found = customers.find(c => c.id === cid);
                        if (found) setCustomerNameInput(found.name);
                      }}
                      className="apple-input bg-white w-full px-3 py-1.5 text-xs font-bold"
                    >
                      <option value="">-- کڕیارێکی نوێ بنووسە یان هەڵبژێرە --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (قەرز: {c.currentDebt.toLocaleString()} د.ع)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={customerNameInput}
                    onChange={e => {
                      setCustomerNameInput(e.target.value);
                      if (selectedDebtCustomerId) setSelectedDebtCustomerId('');
                    }}
                    placeholder={paymentType === 'DEBT' ? 'ناوی کڕیاری قەرز...' : 'ناوی کڕیار...'}
                    className="apple-input px-3 py-1.5 text-xs font-medium"
                  />
                  <div className="flex items-center gap-1 bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-2">
                    <Percent className="w-3.5 h-3.5 text-[#FF9500] shrink-0" />
                    <input
                      type="number"
                      placeholder="داشکاندن د.ع"
                      value={discountAmount || ''}
                      onChange={e => {
                        setDiscountAmount(parseFloat(e.target.value) || 0);
                        setDiscountPercent(0);
                      }}
                      className="bg-transparent w-full py-1.5 text-xs font-semibold outline-none tabular-nums"
                    />
                    {[5, 10].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setDiscountPercent(discountPercent === pct ? 0 : pct);
                          setDiscountAmount(0);
                        }}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                          discountPercent === pct ? 'bg-[#FF9500] text-white' : 'bg-white text-[#515154]'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Net Total & Payment Mode */}
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[#86868B] flex items-center gap-2">
                      <span>کۆی گشتی بۆ دان</span>
                      {calculatedDiscount > 0 && (
                        <span className="text-[#FF9500] font-bold">(-{calculatedDiscount.toLocaleString()})</span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-[#1D1D1F] tabular-nums tracking-tight">
                      {netTotal.toLocaleString()} <span className="text-xs font-semibold text-[#86868B]">د.ع</span>
                    </div>
                  </div>

                  <div className="apple-segmented">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`apple-segment-btn !px-2.5 !py-1.5 text-[11px] flex items-center gap-1 ${
                        paymentType === 'CASH' ? 'apple-segment-btn-active !text-[#248A3D]' : ''
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      نەقد
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('FIB_OR_CARD')}
                      className={`apple-segment-btn !px-2.5 !py-1.5 text-[11px] flex items-center gap-1 ${
                        paymentType === 'FIB_OR_CARD' ? 'apple-segment-btn-active !text-[#0071E3]' : ''
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      کارت
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('DEBT')}
                      className={`apple-segment-btn !px-2.5 !py-1.5 text-[11px] ${
                        paymentType === 'DEBT' ? 'apple-segment-btn-active !text-[#D70015]' : ''
                      }`}
                    >
                      قەرز
                    </button>
                  </div>
                </div>

                {/* Cash Quick Denominations & Change */}
                {paymentType === 'CASH' && (
                  <div className="p-3 rounded-2xl bg-[#34C759]/8 border border-[#34C759]/20 text-xs space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[#515154] font-semibold block mb-1">پارەی وەرگیراو:</span>
                        <input
                          type="number"
                          value={cashGiven}
                          onChange={e => setCashGiven(e.target.value)}
                          placeholder={netTotal > 0 ? netTotal.toString() : '25000'}
                          className="w-full px-3 py-1.5 bg-white border border-black/[0.08] rounded-xl font-bold text-sm text-[#1D1D1F] tabular-nums outline-none focus:border-[#34C759]"
                        />
                      </div>
                      <div>
                        <span className="text-[#515154] font-semibold block mb-1">پارەی گەڕاوە (باقی):</span>
                        <div className="font-extrabold text-base text-[#248A3D] tabular-nums py-1">
                          {changeDue > 0 ? `${changeDue.toLocaleString()} د.ع` : '٠ د.ع'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#34C759]/15">
                      <button
                        type="button"
                        onClick={() => setCashGiven(netTotal > 0 ? netTotal.toString() : '')}
                        className="px-2.5 py-1 rounded-full bg-[#34C759] text-white font-bold text-[10px] hover:bg-[#28B34C] transition-colors"
                      >
                        تەواو
                      </button>
                      {[5000, 10000, 25000, 50000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashGiven(amt.toString())}
                          className={`px-2.5 py-1 rounded-full font-mono font-bold text-[10px] border transition-colors ${
                            Number(cashGiven) === amt
                              ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                              : 'bg-white text-[#1D1D1F] border-black/[0.08] hover:bg-[#F5F5F7]'
                          }`}
                        >
                          {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={cart.length === 0}
                  className="w-full py-3.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-sm shadow-sm shadow-[#0071E3]/30 active:scale-[0.985] transition-all disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>تەواوکردن و چاپکردنی وەسڵ (80mm)</span>
                  <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded-md">F4</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SHOWROOM INVENTORY & INBOUND RECEIPTS (کۆگا و وەرگرتنی بار) */}
      {/* ===================================================================== */}
      {activeSubTab === 'INVENTORY' && (
        <div className="space-y-5">
          {/* Inventory Header + Receive Stock Button */}
          <div className="apple-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-[#1D1D1F]">کۆگای فرۆشگای شۆرۆم و نرخەکان</h3>
              <p className="text-xs text-[#86868B] mt-0.5">
                باری نێردراو لە وەسڵی مەندوبەوە ئۆتۆماتیکی دێتە ناو ئەم کۆگایە، هەروەها دەتوانیت بە دەستیش بار وەربگریت
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReceiveReceiptNo(`SH-IN-${Math.floor(100 + Math.random() * 900)}`);
                setShowReceiveModal(true);
              }}
              className="px-4 py-2.5 rounded-full bg-[#34C759] hover:bg-[#2FB350] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              وەرگرتنی باری نوێ بۆ شۆرۆم
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Stock & Prices Table */}
            <div className="lg:col-span-8 apple-card overflow-hidden">
              <div className="p-4 border-b border-black/[0.06] flex items-center justify-between">
                <span className="font-extrabold text-sm text-[#1D1D1F]">بەردەستیی کاڵاکان ({branchStock.length})</span>
                <span className="text-xs font-bold text-[#0071E3] tabular-nums">
                  کۆی کێش: {totalShowroomStockKg.toFixed(1)} کگم
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#F5F5F7] text-[#515154] font-semibold border-b border-black/[0.06]">
                    <tr>
                      <th className="p-3.5">کۆد</th>
                      <th className="p-3.5">بەرهەم</th>
                      <th className="p-3.5">بەردەست (کگم)</th>
                      <th className="p-3.5">نرخی فرۆشتن</th>
                      <th className="p-3.5 text-center">گۆڕینی نرخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {branchStock.map(item => (
                      <tr key={item.productId} className="hover:bg-[#F5F5F7]/50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-[#515154]">{item.code}</td>
                        <td className="p-3.5 font-bold text-[#1D1D1F]">{item.productName}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold tabular-nums ${
                              item.inStockKg > 20
                                ? 'bg-[#34C759]/12 text-[#248A3D]'
                                : item.inStockKg >= 5
                                ? 'bg-[#FF9500]/12 text-[#B25000]'
                                : 'bg-[#FF3B30]/12 text-[#D70015]'
                            }`}
                          >
                            {item.inStockKg.toFixed(1)} کگم
                          </span>
                        </td>
                        <td className="p-3.5 font-extrabold text-[#0071E3] tabular-nums">
                          {item.retailPricePerKg.toLocaleString()} د.ع
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPriceItem(item);
                              setNewPriceInput(item.retailPricePerKg.toString());
                            }}
                            className="px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] hover:text-white text-[#1D1D1F] font-semibold text-xs transition-colors inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            نرخ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inbound Deliveries History */}
            <div className="lg:col-span-4 apple-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#34C759]" />
                  وەسڵە هاتووەکان بۆ شۆرۆم
                </h4>
                <span className="text-xs font-bold text-[#86868B]">{showroomInboundReceipts.length}</span>
              </div>

              <div className="divide-y divide-black/[0.05] max-h-[380px] overflow-y-auto">
                {showroomInboundReceipts.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[#86868B]">هێشتا هیچ وەسڵێکی هاتوو نییە</p>
                ) : (
                  showroomInboundReceipts.map(rec => (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#0071E3]">{rec.receiptNo}</span>
                          <span className="font-bold text-[#1D1D1F]">{rec.repName}</span>
                        </div>
                        <span className="text-[10px] text-[#86868B]">
                          {rec.date} {rec.time} • {rec.itemsCount} بەرهەم
                        </span>
                      </div>
                      <span className="font-extrabold text-[#248A3D] tabular-nums">
                        +{rec.totalWeightKg.toFixed(1)} کگم
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SALES, CASH DRAWER, Z-REPORT & EXPENSES */}
      {/* ===================================================================== */}
      {activeSubTab === 'REGISTER_REPORT' && (
        <div className="space-y-5">
          {/* Z-Report Bar */}
          <div className="apple-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#1D1D1F] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0071E3]" />
                ڕاپۆرتی سەندوقی کاشێر و داخستنی شەفت (Z-Report)
              </h3>
              <p className="text-[11px] text-[#86868B] mt-0.5">
                پوختەی فرۆشتنی نەقد، کارت، قەرز، خەرجی و صافی پارەی ناو قاسە بە 80mm
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowZReportModal(true)}
              className="px-4 py-2.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <Printer className="w-4 h-4" />
              چاپکردنی Z-Report (داخستنی سەندوق)
            </button>
          </div>

          {/* KPI Bento Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">کۆی فرۆشی شۆرۆم</span>
              <div className="text-2xl font-black text-[#0071E3] tabular-nums mt-1">
                {totalAllSales.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>

            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">نەقدی وەرگیراو</span>
              <div className="text-2xl font-black text-[#248A3D] tabular-nums mt-1">
                {totalCashSales.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>

            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">خەرجی شۆرۆم</span>
              <div className="text-2xl font-black text-[#FF3B30] tabular-nums mt-1">
                {totalBranchExpenses.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>

            <div className="apple-card p-4">
              <span className="text-[11px] font-semibold text-[#86868B] block">صافی پارەی ناو قاسە</span>
              <div className="text-2xl font-black text-[#1D1D1F] tabular-nums mt-1">
                {netCashInDrawer.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* POS Sales History */}
            <div className="lg:col-span-7 apple-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#0071E3]" />
                  مێژووی وەسڵەکانی فرۆشگا
                </h4>
                <span className="text-xs font-bold text-[#86868B] tabular-nums">{posSales.length} وەسڵ</span>
              </div>

              <div className="divide-y divide-black/[0.05] max-h-[380px] overflow-y-auto">
                {posSales.map(sale => (
                  <div key={sale.id} className="py-3 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0071E3]">{sale.saleNo}</span>
                        <span className="font-bold text-[#1D1D1F]">{sale.customerName || 'کڕیاری ئاسایی'}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sale.paymentType === 'CASH'
                              ? 'bg-[#34C759]/12 text-[#248A3D]'
                              : sale.paymentType === 'FIB_OR_CARD'
                              ? 'bg-[#0071E3]/12 text-[#0071E3]'
                              : 'bg-[#FF3B30]/12 text-[#D70015]'
                          }`}
                        >
                          {sale.paymentType === 'CASH' ? 'نەقد' : sale.paymentType === 'FIB_OR_CARD' ? 'کارت' : 'قەرز'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#86868B]">
                        {sale.date} {sale.time} • کاشێر: {sale.cashierName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-sm text-[#1D1D1F] tabular-nums">
                        {sale.total.toLocaleString()} د.ع
                      </span>
                      <button
                        type="button"
                        onClick={() => setPrintReceipt(sale)}
                        className="px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] hover:text-white text-[#1D1D1F] font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        چاپ
                      </button>
                      {hasAccess('settings') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`وەسڵی شۆرۆم #${sale.saleNo} بخرێتە سەبەتەی سۆفت دیلیت و کۆگا/قەرز بگەڕێندرێتەوە؟`)) {
                              softDeleteRecord('POS_SALE', sale.id, 'سڕینەوە لە سەندوقی شۆرۆم');
                            }
                          }}
                          className="p-1.5 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Showroom Expenses */}
            <div className="lg:col-span-5 apple-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#FF3B30]" />
                  خەرجییەکانی شۆرۆم
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(true)}
                  className="px-3 py-1 rounded-full bg-[#FF3B30] hover:bg-[#E0352B] text-white font-bold text-xs flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  خەرجیی نوێ
                </button>
              </div>

              <div className="divide-y divide-black/[0.05] max-h-[380px] overflow-y-auto">
                {branchExpenses.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[#86868B]">هیچ خەرجییەک نییە</p>
                ) : (
                  branchExpenses.map(exp => (
                    <div key={exp.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-[#1D1D1F]">{exp.title}</p>
                        <span className="text-[10px] text-[#86868B]">
                          {exp.date} {exp.time}
                        </span>
                      </div>
                      <span className="font-extrabold text-[#FF3B30] tabular-nums">
                        -{exp.amount.toLocaleString()} د.ع
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS: WEIGHT KEYPAD, 80MM RECEIPT, Z-REPORT, RECEIVE STOCK, PRICE, EXPENSE */}
      {/* ===================================================================== */}

      {/* 1. Apple Numeric Weight Keypad Modal */}
      {weightModalProduct && (() => {
        const branchItem = branchStock.find(b => b.productId === weightModalProduct.id);
        const unitPrice = branchItem ? branchItem.retailPricePerKg : weightModalProduct.pricePerKg;
        const parsedWeight = parseFloat(weightKeypadValue) || 0;
        const estimatedTotal = roundTo250(parsedWeight * unitPrice);

        const handleKeyPress = (val: string) => {
          if (val === 'C') {
            setWeightKeypadValue('');
          } else if (val === '.') {
            if (!weightKeypadValue.includes('.')) {
              setWeightKeypadValue(prev => (prev === '' ? '0.' : prev + '.'));
            }
          } else {
            setWeightKeypadValue(prev => (prev === '0' ? val : prev + val));
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
            <div className="w-full max-w-xs bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-[#1D1D1F]">{weightModalProduct.nameKu}</h4>
                  <span className="text-xs text-[#86868B] font-semibold">
                    {unitPrice.toLocaleString()} د.ع / کگم
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWeightModalProduct(null)}
                  className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center hover:bg-[#E8E8ED]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-[#F5F5F7] rounded-2xl p-3.5 text-center space-y-1">
                <span className="text-[10px] font-semibold text-[#86868B]">کێشی تەرازوو</span>
                <div className="text-3xl font-black text-[#1D1D1F] tabular-nums tracking-tight">
                  {weightKeypadValue || '0'} <span className="text-sm font-bold text-[#86868B]">کگم</span>
                </div>
                <div className="text-xs font-extrabold text-[#0071E3] tabular-nums">
                  کۆ: {estimatedTotal.toLocaleString()} د.ع
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {['0.500', '1.000', '1.500', '2.000'].map(preset => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setWeightKeypadValue(preset)}
                    className="py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] hover:text-white text-[#1D1D1F] font-bold text-[11px] tabular-nums transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'].map(key => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="py-3 rounded-2xl bg-[#F5F5F7] hover:bg-[#E8E8ED] active:scale-95 text-[#1D1D1F] font-bold text-base transition-all"
                  >
                    {key}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (parsedWeight <= 0) {
                    playPosBeep('error');
                    return;
                  }
                  const added = addItemToCart(weightModalProduct, parsedWeight, unitPrice);
                  if (added) {
                    playPosBeep('success');
                    setWeightModalProduct(null);
                  }
                }}
                className="w-full py-3 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-sm transition-all active:scale-95"
              >
                خستنە ناو سەبەتە
              </button>
            </div>
          </div>
        );
      })()}

      {/* 2. 80mm Thermal Sale Receipt Modal (Aggregated) */}
      {printReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto apple-sheet">
            {(() => {
              const map = new Map<
                string,
                { productId: string; productName: string; pricePerKg: number; weightKg: number; total: number; count: number }
              >();
              (printReceipt.items || []).forEach(item => {
                const key = `${item.productId}-${item.pricePerKg}`;
                if (!map.has(key)) {
                  map.set(key, {
                    productId: item.productId,
                    productName: item.productName,
                    pricePerKg: item.pricePerKg,
                    weightKg: item.weightKg,
                    total: item.total,
                    count: 1,
                  });
                } else {
                  const ex = map.get(key)!;
                  const newW = Math.round((ex.weightKg + item.weightKg) * 1000) / 1000;
                  ex.weightKg = newW;
                  ex.total = roundTo250(newW * ex.pricePerKg);
                  ex.count += 1;
                }
              });
              const aggregatedItems = Array.from(map.values());

              return (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] no-print">
                    <span className="text-xs font-bold text-[#86868B]">وەسڵی گەرمی 80mm</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const s = printReceipt;
                          const itemsText = aggregatedItems
                            .map(
                              i =>
                                `• ${i.productName}${i.count > 1 ? ` (${i.count} دانە)` : ''}: ${i.weightKg.toFixed(3)} کگم x ${i.pricePerKg.toLocaleString()} = ${i.total.toLocaleString()} د.ع`
                            )
                            .join('\n');
                          const msg = `وەسڵی فرۆشتنی ${factorySettings.showroomName || factorySettings.factoryName}\n\nوەسڵ: ${s.saleNo}\nبەروار: ${s.date}\nکاشێر: ${s.cashierName || '---'}\n\nبڕگەکان:\n${itemsText}\n\nکۆی گشتی: ${s.total.toLocaleString()} د.ع (${
                            s.paymentType === 'CASH' ? 'نەقد' : s.paymentType === 'FIB_OR_CARD' ? 'کارت' : 'قەرز'
                          })\n\nتەلەفۆن: ${factorySettings.phone1}\n${factorySettings.receiptFooter || 'سوپاس بۆ کڕینەکەتان 🍗'}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                        }}
                        className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        واتسئاپ
                      </button>
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
                        onClick={() => setPrintReceipt(null)}
                        className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-center font-mono text-xs text-[#1D1D1F]">
                    <div className="space-y-1">
                      <div className="flex justify-center">
                        <FactoryLogo size="sm" />
                      </div>
                      <h4 className="font-black text-base font-sans">{factorySettings.factoryName}</h4>
                      <p className="text-[11px] font-bold text-[#0071E3] font-sans">
                        {factorySettings.shortCode} • {factorySettings.showroomName}
                      </p>
                      <p className="text-[10px] text-[#86868B] font-sans">
                        {factorySettings.address} • {factorySettings.phone1}
                      </p>
                    </div>

                    <div className="border-t border-b border-dashed border-black/20 py-2 space-y-1 text-[11px] text-right font-sans">
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">وەسڵ:</span>
                        <span className="font-bold">{printReceipt.saleNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">بەروار:</span>
                        <span>
                          {printReceipt.date} {printReceipt.time}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">کڕیار:</span>
                        <span>{printReceipt.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">کاشێر:</span>
                        <span>{printReceipt.cashierName}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-right font-sans">
                      {aggregatedItems.map((item, i) => (
                        <div key={i} className="flex justify-between items-start text-[11px] border-b border-black/[0.04] pb-1.5">
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{item.productName}</span>
                              {item.count > 1 && (
                                <span className="text-[9px] bg-[#F5F5F7] text-[#515154] px-1.5 py-0.2 rounded-full font-extrabold">
                                  ({item.count} دانە)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#86868B] tabular-nums">
                              {item.weightKg.toFixed(3)} کگم × {item.pricePerKg.toLocaleString()} د.ع
                            </div>
                          </div>
                          <span className="font-bold tabular-nums">{item.total.toLocaleString()} د.ع</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-dashed border-black/20 pt-2 space-y-1 text-right font-sans">
                      {printReceipt.discount > 0 && (
                        <div className="flex justify-between text-[11px] text-[#FF3B30]">
                          <span>داشکاندن:</span>
                          <span>-{printReceipt.discount.toLocaleString()} د.ع</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black">
                        <span>کۆی گشتی:</span>
                        <span>{printReceipt.total.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#86868B]">
                        <span>شێوازی دان:</span>
                        <span className="font-bold">
                          {printReceipt.paymentType === 'CASH'
                            ? 'نەقد (Cash)'
                            : printReceipt.paymentType === 'FIB_OR_CARD'
                            ? 'کارت / FIB'
                            : 'قەرز (Debit)'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <BarcodeSVG code={printReceipt.saleNo.replace(/[^0-9]/g, '') || '1001001'} width={220} height={40} />
                    </div>

                    <p className="text-[10px] text-[#86868B] font-sans">
                      {factorySettings.receiptFooter || 'سوپاس بۆ سەردانەکەتان'}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. 80mm Z-Report Modal */}
      {showZReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto apple-sheet">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] no-print">
              <span className="text-xs font-bold text-[#86868B]">Z-Report (داخستنی سەندوق 80mm)</span>
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
                  onClick={() => setShowZReportModal(false)}
                  className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(() => {
              const totalSoldKg = posSales.reduce(
                (sum, s) => sum + s.items.reduce((is, i) => is + i.weightKg, 0),
                0
              );

              return (
                <div className="space-y-3 text-center font-mono text-xs text-[#1D1D1F]">
                  <div className="space-y-1">
                    <div className="flex justify-center">
                      <FactoryLogo size="sm" />
                    </div>
                    <h4 className="font-black text-base font-sans">{factorySettings.factoryName}</h4>
                    <p className="text-[11px] font-bold text-[#0071E3] font-sans">
                      {factorySettings.showroomName} • Z-Report
                    </p>
                    <p className="text-[10px] text-[#86868B] font-sans">
                      بەروار: {new Date().toISOString().split('T')[0]} •{' '}
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="border-t border-b border-dashed border-black/20 py-2 space-y-1 text-[11px] text-right font-sans">
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">کاشێر:</span>
                      <span className="font-bold">{currentUser?.name || '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">ژمارەی وەسڵەکان:</span>
                      <span className="font-bold tabular-nums">{posSales.length} وەسڵ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">کۆی کێشی فرۆشراو:</span>
                      <span className="font-bold tabular-nums">{totalSoldKg.toFixed(2)} کگم</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-right text-[11px] font-sans border-b border-dashed border-black/20 pb-2.5">
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">فرۆشتنی نەقد:</span>
                      <span className="font-bold text-[#248A3D] tabular-nums">{totalCashSales.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">فرۆشتنی کارت / FIB:</span>
                      <span className="font-bold text-[#0071E3] tabular-nums">{totalCardSales.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">فرۆشتنی قەرز:</span>
                      <span className="font-bold text-[#D70015] tabular-nums">{totalDebtSales.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-black/[0.06]">
                      <span className="font-bold">کۆی گشتی فرۆش:</span>
                      <span className="font-black tabular-nums">{totalAllSales.toLocaleString()} د.ع</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-right font-sans">
                    <div className="flex justify-between text-[11px] text-[#FF3B30]">
                      <span>کۆی خەرجییەکانی شۆرۆم:</span>
                      <span className="font-bold tabular-nums">-{totalBranchExpenses.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between text-sm font-black pt-1.5 border-t border-black/15">
                      <span>صافی پارەی ناو قاسە:</span>
                      <span className="text-[#0071E3] tabular-nums">{netCashInDrawer.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. Manual Receive Stock Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <form
            onSubmit={handleSubmitReceiveStock}
            className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h4 className="font-extrabold text-sm text-[#1D1D1F]">وەرگرتنی باری نوێ بۆ شۆرۆم</h4>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#515154] block mb-1">ژمارەی وەسڵ:</label>
                <input
                  type="text"
                  value={receiveReceiptNo}
                  onChange={e => setReceiveReceiptNo(e.target.value)}
                  className="apple-input w-full px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-[#515154] block mb-1">مەندوب / گەیەنەر:</label>
                <input
                  type="text"
                  placeholder="ناوی مەندوب..."
                  value={receiveRepName}
                  onChange={e => setReceiveRepName(e.target.value)}
                  className="apple-input w-full px-3 py-2 font-bold"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0071E3]/6 border border-[#0071E3]/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#0071E3] flex items-center gap-1.5">
                  <Barcode className="w-4 h-4" />
                  سکانکردنی قاپە هاتووەکان (بارکۆد ریدەر)
                </span>
                {receiveItems.length > 0 && (
                  <span className="text-[11px] font-bold text-[#1D1D1F]">
                    {receiveItems.reduce((s, i) => s + (i.trayCount || 0), 0)} قاپ •{' '}
                    {receiveItems.reduce((s, i) => s + i.weightKg, 0).toFixed(3)} کگم
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  ref={receiveScannerRef}
                  type="text"
                  value={receiveScannerInput}
                  onChange={e => setReceiveScannerInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleReceiveBarcodeScan();
                    }
                  }}
                  placeholder="بارکۆدی قاپەکە سکان بکە یان لێرە بنووسە و Enter دابگرە..."
                  className="apple-input bg-white flex-1 px-3 py-2 font-mono font-bold text-xs"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleReceiveBarcodeScan}
                  className="px-3.5 py-2 rounded-xl bg-[#0071E3] text-white font-bold shrink-0"
                >
                  سکان
                </button>
              </div>

              {receiveScanFeedback && (
                <div
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl ${
                    receiveScanFeedback.ok
                      ? 'bg-[#34C759]/15 text-[#1B7A34]'
                      : 'bg-[#FF3B30]/15 text-[#D70015]'
                  }`}
                >
                  {receiveScanFeedback.text}
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-[#F5F5F7] space-y-2 text-xs">
              <div className="text-[11px] font-bold text-[#86868B]">یان زیادکردنی دەستی (بێ بارکۆد):</div>
              <div className="flex gap-2">
                <select
                  value={receiveProdId}
                  onChange={e => setReceiveProdId(e.target.value)}
                  className="apple-input bg-white flex-1 px-3 py-2 font-bold"
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
                  value={receiveWeight}
                  onChange={e => setReceiveWeight(e.target.value)}
                  className="apple-input bg-white w-24 px-3 py-2 font-bold text-center"
                />
                <button
                  type="button"
                  onClick={handleAddReceiveItem}
                  className="px-3 py-2 rounded-xl bg-[#1D1D1F] text-white font-bold"
                >
                  +
                </button>
              </div>

              {receiveItems.length > 0 && (
                <div className="divide-y divide-black/[0.06] pt-1 max-h-44 overflow-y-auto">
                  {receiveItems.map((it, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold">{it.productName}</span>
                        {it.trayCount && it.trayCount > 0 && (
                          <span className="mr-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                            {it.trayCount} قاپ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-[#248A3D] tabular-nums">
                          {it.weightKg.toFixed(3)} کگم
                        </span>
                        <button
                          type="button"
                          onClick={() => setReceiveItems(prev => prev.filter((_, i) => i !== idx))}
                          className="text-[#FF3B30]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#34C759] hover:bg-[#2FB350] text-white font-bold text-xs rounded-2xl transition-all"
            >
              تۆمارکردن و خستنە ناو کۆگای شۆرۆم
            </button>
          </form>
        </div>
      )}

      {/* 5. Price Editor Modal */}
      {editingPriceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="w-full max-w-xs bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-[#1D1D1F]">گۆڕینی نرخی {editingPriceItem.productName}</h4>
              <button
                type="button"
                onClick={() => setEditingPriceItem(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="number"
              value={newPriceInput}
              onChange={e => setNewPriceInput(e.target.value)}
              className="apple-input w-full px-3.5 py-2.5 text-base font-extrabold tabular-nums text-center"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                const parsed = parseFloat(newPriceInput);
                if (!isNaN(parsed) && parsed > 0) {
                  updateBranchStockItem(editingPriceItem.productId, { retailPricePerKg: roundTo250(parsed) });
                  showToast('نرخ نوێکرایەوە', 'success');
                }
                setEditingPriceItem(null);
              }}
              className="w-full py-2.5 bg-[#0071E3] text-white font-bold text-xs rounded-2xl transition-all"
            >
              پاشەکەوتکردن
            </button>
          </div>
        </div>
      )}

      {/* 6. Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <form
            onSubmit={handleAddExpense}
            className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <h4 className="font-extrabold text-sm text-[#1D1D1F]">تۆمارکردنی خەرجی شۆرۆم</h4>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#515154] block mb-1">ناونیشانی خەرجی:</label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={e => setExpTitle(e.target.value)}
                  placeholder="وەک: کڕینی کیس و عەلاگە..."
                  className="apple-input w-full px-3 py-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#515154] block mb-1">بڕ (د.ع):</label>
                  <input
                    type="number"
                    required
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    placeholder="25000"
                    className="apple-input w-full px-3 py-2.5 font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#515154] block mb-1">پۆلێن:</label>
                  <select
                    value={expCategory}
                    onChange={e =>
                      setExpCategory(
                        e.target.value as 'RENT' | 'ELECTRICITY' | 'PACKAGING' | 'SALARIES' | 'CLEANING' | 'MAINTENANCE' | 'OTHER'
                      )
                    }
                    className="apple-input w-full px-3 py-2.5 font-bold"
                  >
                    <option value="PACKAGING">پاکەت و عەلاگە</option>
                    <option value="ELECTRICITY">کارەبا و بەفر</option>
                    <option value="RENT">کرێی شوێن</option>
                    <option value="SALARIES">مووچە</option>
                    <option value="CLEANING">خاوێنکردنەوە</option>
                    <option value="MAINTENANCE">چاککردنەوە</option>
                    <option value="OTHER">هی تر</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#FF3B30] hover:bg-[#E0352B] text-white font-bold text-xs rounded-2xl transition-all"
            >
              تۆمارکردنی خەرجی
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default POSView;
