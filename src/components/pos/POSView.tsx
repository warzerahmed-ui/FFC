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
  RotateCcw,
  Download,
  Gift,
  Calendar,
  ArrowLeftRight,
  CheckCircle,
  UserCheck,
} from 'lucide-react';
import { POSSaleItem, POSSale, ProductItem, BranchStockItem, Customer, PaymentVoucher, roundTo250 } from '../../types';
import { FactoryLogo } from '../layout/FactoryLogo';
import { toLocalISODate } from '../../utils/date';

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

export type PosSubTab = 'REGISTER' | 'INVENTORY' | 'CUSTOMERS_DEBT' | 'GIFTS' | 'REGISTER_REPORT';

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
    vouchers,
    branchExpenses,
    users,
    currentUser,
    factorySettings,
    addPOSSale,
    addReturn,
    addCustomer,
    addVoucher,
    addBranchDelivery,
    addBranchExpense,
    addProduct,
    updateBranchStockItem,
    adjustBranchStock,
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
  const [paymentType, setPaymentType] = useState<'CASH' | 'FIB_OR_CARD' | 'SPLIT' | 'DEBT' | 'GIFT'>('CASH');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [giftNote, setGiftNote] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('کڕیاری ئاسایی نەقد');
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>('');
  const [selectedDebtCustomerId, setSelectedDebtCustomerId] = useState<string>('');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ffc_pos_autoprint_v1') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('ffc_pos_autoprint_v1', String(autoPrintReceipt));
    } catch {
      // ignore
    }
  }, [autoPrintReceipt]);
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
  const [newMinAlertInput, setNewMinAlertInput] = useState<string>('5');

  // Shift Opening Float & Actual Cash Drawer Count (Per-Date & Per-Cashier)
  const todayISO = toLocalISODate();
  const canViewAllCashiers = hasAccess('reports') || hasAccess('settings');
  const [reportCashierFilter, setReportCashierFilter] = useState<string>(() =>
    canViewAllCashiers ? 'ALL' : currentUser?.name || 'ALL'
  );
  const [floatByCashierMap, setFloatByCashierMap] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('ffc_pos_drawer_float_v2');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as { date?: string; floats?: Record<string, number> };
      return parsed.date === toLocalISODate() && parsed.floats ? parsed.floats : {};
    } catch {
      return {};
    }
  });
  const activeFloatKey = reportCashierFilter === 'ALL' ? currentUser?.name || 'ALL' : reportCashierFilter;
  const openingFloat =
    reportCashierFilter === 'ALL'
      ? Object.values(floatByCashierMap).reduce((s, v) => s + (Number(v) || 0), 0)
      : floatByCashierMap[activeFloatKey] || 0;

  const [actualCashCount, setActualCashCount] = useState<string>('');
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>(todayISO);
  const [reportPaymentFilter, setReportPaymentFilter] = useState<'ALL' | 'CASH' | 'FIB_OR_CARD' | 'SPLIT' | 'DEBT' | 'GIFT'>('ALL');

  // Gifts Report Tab State
  const [giftSearch, setGiftSearch] = useState<string>('');
  const [giftStartDate, setGiftStartDate] = useState<string>('');
  const [giftEndDate, setGiftEndDate] = useState<string>('');

  // Customer Debt Collection Tab State
  const [debtSearch, setDebtSearch] = useState<string>('');
  const [collectingCustomer, setCollectingCustomer] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectDiscount, setCollectDiscount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [collectNotes, setCollectNotes] = useState<string>('');
  const [printDebtVoucher, setPrintDebtVoucher] = useState<PaymentVoucher | null>(null);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [editingCartWeight, setEditingCartWeight] = useState<string>('');

  // Inventory Audit / Spoilage Modal
  const [stockAdjustItem, setStockAdjustItem] = useState<BranchStockItem | null>(null);
  const [adjustNewKg, setAdjustNewKg] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<'AUDIT' | 'SPOILAGE'>('SPOILAGE');
  const [adjustNote, setAdjustNote] = useState<string>('');

  const handleOpeningFloatChange = (val: number) => {
    const clean = Math.max(0, val || 0);
    const key = reportCashierFilter === 'ALL' ? currentUser?.name || 'کاشێر' : reportCashierFilter;
    setFloatByCashierMap(prev => {
      const next = { ...prev, [key]: clean };
      try {
        localStorage.setItem('ffc_pos_drawer_float_v2', JSON.stringify({ date: todayISO, floats: next }));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Customer Return / Refund Modal
  const [returningSale, setReturningSale] = useState<POSSale | null>(null);
  const [returnWeights, setReturnWeights] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState('');

  // Inbound Delivery Receipt Print Modal
  const [selectedInboundReceipt, setSelectedInboundReceipt] = useState<{
    id: string;
    receiptNo: string;
    date: string;
    time?: string;
    repName: string;
    totalWeightKg: number;
    itemsCount: number;
    items?: { productName: string; weightKg: number }[];
  } | null>(null);

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
  const [showRecAddProduct, setShowRecAddProduct] = useState(false);
  const [recNewProdName, setRecNewProdName] = useState('');
  const [recNewProdBarcode, setRecNewProdBarcode] = useState('');
  const [recNewProdPrice, setRecNewProdPrice] = useState<string>('4500');
  const [recNewProdCost, setRecNewProdCost] = useState<string>('3250');
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
  const completeSaleRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (activeSubTab === 'REGISTER' && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [activeSubTab]);

  // Keyboard Shortcuts: F2 (Focus Scanner), F4 (Checkout), F8 (Reprint Last), Esc (Close Modals)
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
          completeSaleRef.current();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (posSales.length > 0) {
          setPrintReceipt(posSales[0]);
        }
      } else if (e.key === 'Escape') {
        setWeightModalProduct(null);
        setPrintReceipt(null);
        setEditingPriceItem(null);
        setShowZReportModal(false);
        setShowReceiveModal(false);
        setShowAddExpenseModal(false);
        setReturningSale(null);
        setSelectedInboundReceipt(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSubTab, cart.length, printReceipt, weightModalProduct, showZReportModal, showReceiveModal, posSales]);

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
    // Count ALL cart lines of this product (priced barcodes can create several lines with different per-kg prices)
    const existingWeight = cart
      .filter(item => item.productId === product.id)
      .reduce((s, item) => s + item.weightKg, 0);
    void existingIndex;
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
      const bi = result.branchItem;
      const prod: ProductItem | undefined =
        result.product ||
        products.find(p => p.id === bi?.productId) ||
        (bi
          ? {
              id: bi.productId,
              code: bi.code,
              barcodePrefix: bi.barcode,
              nameKu: bi.productName,
              category: bi.category || 'OTHER',
              pricePerKg: bi.retailPricePerKg,
              costPerKg: bi.factoryCostPerKg,
              unit: bi.unit || 'KG',
              inStockKg: 0,
            }
          : undefined);
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

  const setCartItemExactWeight = (index: number, rawWeight: number) => {
    const targetItem = cart[index];
    if (!targetItem) return;
    const cleanWeight = Math.round(rawWeight * 1000) / 1000;
    if (!Number.isFinite(cleanWeight) || cleanWeight <= 0) {
      removeCartItem(index);
      return;
    }

    const branchItem = branchStock.find(b => b.productId === targetItem.productId);
    const avail = branchItem ? branchItem.inStockKg : 0;
    const otherWeight = cart
      .filter((i, idx) => idx !== index && i.productId === targetItem.productId)
      .reduce((s, i) => s + i.weightKg, 0);

    if (cleanWeight + otherWeight > avail + 0.001) {
      playPosBeep('error');
      showToast(`ناتوانیت لە کۆگای شۆرۆم (${avail.toFixed(3)} کگم) زیاتر دابنێیت`, 'warn');
      return;
    }

    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      updated[index] = {
        ...item,
        weightKg: cleanWeight,
        total: roundTo250(cleanWeight * item.pricePerKg),
      };
      return updated;
    });
    playPosBeep('scale');
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
    setSplitCashAmount('');
    setGiftNote('');
    setSelectedDebtCustomerId('');
    setCustomerNameInput('کڕیاری ئاسایی نەقد');
    setCustomerPhoneInput('');
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
  const splitCashNum = roundTo250(parseFloat(splitCashAmount) || 0);
  const splitCardNum = Math.max(0, netTotal - splitCashNum);
  const payableTotal = paymentType === 'GIFT' ? 0 : netTotal;
  const changeDue = paymentType === 'CASH' && numericCashGiven > netTotal ? roundTo250(numericCashGiven - netTotal) : 0;

  const handleCompleteSale = () => {
    if (cart.length === 0) {
      showToast('سەبەتە بەتاڵە! تکایە بەرهەم هەڵبژێرە', 'warn');
      return;
    }

    const neededByProduct = new Map<string, { name: string; weightKg: number }>();
    cart.forEach(item => {
      const cur = neededByProduct.get(item.productId);
      neededByProduct.set(item.productId, {
        name: item.productName,
        weightKg: Math.round(((cur?.weightKg || 0) + item.weightKg) * 1000) / 1000,
      });
    });

    const stockShortages: string[] = [];
    neededByProduct.forEach(({ name, weightKg }, productId) => {
      const branchItem = branchStock.find(b => b.productId === productId);
      const avail = branchItem ? branchItem.inStockKg : 0;
      if (weightKg > avail + 0.001) {
        stockShortages.push(`• ${name}: داواکراو ${weightKg.toFixed(3)} کگم / بەردەست ${avail.toFixed(1)} کگم`);
      }
    });

    if (stockShortages.length > 0) {
      playPosBeep('error');
      alert(`ڕێگری لە دەرکردنی وەسڵ:\nبڕی پێویست لە کۆگای شۆرۆمدا نییە:\n\n${stockShortages.join('\n')}`);
      return;
    }

    const selectedCust = selectedDebtCustomerId
      ? customers.find(c => c.id === selectedDebtCustomerId)
      : undefined;

    if (paymentType === 'DEBT' && !selectedCust) {
      playPosBeep('error');
      showToast('تکایە کڕیاری قەرز هەڵبژێرە یان "+ کڕیاری نوێ" دابگرە', 'warn');
      return;
    }

    if (paymentType === 'GIFT' && !selectedCust) {
      playPosBeep('error');
      showToast('تکایە وەرگری هەدیە هەڵبژێرە یان "+ کڕیاری نوێ" دابگرە', 'warn');
      return;
    }

    if (paymentType === 'SPLIT' && (splitCashNum <= 0 || splitCashNum >= netTotal)) {
      playPosBeep('error');
      showToast('لە پارەدانی تێکەڵدا دەبێت بڕی کاش لە نێوان ٠ و کۆی گشتیدا بێت', 'warn');
      return;
    }

    const resolvedCustomerName = selectedCust ? selectedCust.name : 'کڕیاری ئاسایی نەقد';

    const giftCost =
      paymentType === 'GIFT'
        ? roundTo250(
            cart.reduce((sum, item) => {
              const bs = branchStock.find(b => b.productId === item.productId);
              return sum + item.weightKg * (bs?.factoryCostPerKg || 0);
            }, 0)
          )
        : undefined;

    const sale = addPOSSale({
      date: toLocalISODate(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      subtotal,
      discount: paymentType === 'GIFT' ? 0 : calculatedDiscount,
      total: payableTotal,
      paidAmount:
        paymentType === 'CASH'
          ? numericCashGiven > 0
            ? numericCashGiven
            : netTotal
          : paymentType === 'DEBT' || paymentType === 'GIFT'
          ? 0
          : netTotal,
      changeAmount: changeDue,
      paymentType,
      cashAmount: paymentType === 'SPLIT' ? splitCashNum : undefined,
      cardAmount: paymentType === 'SPLIT' ? splitCardNum : undefined,
      giftNote: paymentType === 'GIFT' ? giftNote.trim() || 'دیاری شۆرۆم' : undefined,
      giftCost,
      customerId: selectedCust ? selectedCust.id : undefined,
      customerName: resolvedCustomerName,
      customerPhone: customerPhoneInput.trim() || selectedCust?.phone || undefined,
      cashierName: currentUser?.name || 'کاشێری شۆرۆم',
    });

    playPosBeep('success');
    setPrintReceipt(sale);
    clearCart();
    showToast(
      paymentType === 'GIFT'
        ? `هەدیەی ${sale.saleNo} بۆ ${resolvedCustomerName} تۆمارکرا`
        : `وەسڵی ${sale.saleNo} تەواو کرا`,
      'success'
    );
    if (autoPrintReceipt) {
      setTimeout(() => window.print(), 250);
    }
  };

  useEffect(() => {
    completeSaleRef.current = handleCompleteSale;
  });

  // ==========================================
  // INBOUND STOCK RECEIPT (شۆرۆم وەرگرتنی بار)
  // ==========================================
  const showroomInboundReceipts = useMemo(() => {
    const showroomNameNorm = (factorySettings.showroomName || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const repDeliveries = dispatches
      .filter(d => {
        const t = (d.customerName || d.destinationName || '').trim().replace(/\s+/g, ' ').toLowerCase();
        return t === 'شۆرۆم' || t === 'فرۆشگای شۆرۆم' || (!!showroomNameNorm && t === showroomNameNorm);
      })
      .map(d => ({
        id: d.id,
        receiptNo: d.manualReceiptNo,
        date: d.date,
        time: d.time,
        repName: d.repName || d.destinationName,
        totalWeightKg: d.totalWeightKg,
        itemsCount: d.items.length,
        items: d.items.map(i => ({ productName: i.productName, weightKg: i.weightKg })),
        source: 'REP_RECEIPT' as const,
      }));

    const manualDeliveries = branchDeliveries
      .filter(b => !b.status || b.status === 'ACCEPTED')
      .map(b => ({
        id: b.id,
        receiptNo: b.manualReceiptNo,
        date: b.date,
        time: b.time,
        repName: b.repName,
        totalWeightKg: b.totalWeightKg,
        itemsCount: b.items.length,
        items: b.items.map(i => ({ productName: i.productName, weightKg: i.weightKg })),
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
      const bi = result.branchItem;
      const prod: ProductItem | undefined =
        result.product ||
        products.find(p => p.id === bi?.productId) ||
        (bi
          ? {
              id: bi.productId,
              code: bi.code,
              barcodePrefix: bi.barcode,
              nameKu: bi.productName,
              category: bi.category || 'OTHER',
              pricePerKg: bi.retailPricePerKg,
              costPerKg: bi.factoryCostPerKg,
              unit: bi.unit || 'KG',
              inStockKg: 0,
            }
          : undefined);
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

  const handleCreateReceiveProduct = () => {
    const cleanName = recNewProdName.trim();
    const price = parseFloat(recNewProdPrice) || 0;
    const cost = parseFloat(recNewProdCost) || Math.round(price * 0.75);
    if (!cleanName || price <= 0) {
      showToast('تکایە ناو و نرخی فرۆشتنی بەرهەم بنووسە', 'warn');
      return;
    }
    const created = addProduct({
      nameKu: cleanName,
      pricePerKg: price,
      costPerKg: cost,
      category: 'OTHER',
      unit: 'KG',
      barcodePrefix: recNewProdBarcode.trim() || undefined,
    });
    setReceiveProdId(created.id);
    setRecNewProdName('');
    setRecNewProdBarcode('');
    setShowRecAddProduct(false);
    showToast(`بەرهەمی "${created.nameKu}" زیادکرا`, 'success');
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
      date: toLocalISODate(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      repName: receiveRepName.trim() || 'داخڵکردنی ڕۆژانەی شۆرۆم',
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
      date: toLocalISODate(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      title: expTitle.trim(),
      amount: roundTo250(amount),
      category: expCategory,
      cashierName: currentUser?.name || 'کاشێری شۆرۆم',
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

  const dateSales = posSales.filter(s => !reportDate || s.date === reportDate);
  const dateExpenses = branchExpenses.filter(e => !reportDate || e.date === reportDate);
  const datePosDebtVouchers = vouchers.filter(
    v => v.collectedAtPos && (!reportDate || v.date === reportDate)
  );

  const nonCashierNames = new Set(users.filter(u => u.role !== 'CASHIER').map(u => u.name));
  const cashierOptions = Array.from(
    new Set([
      ...users.filter(u => u.role === 'CASHIER').map(u => u.name),
      ...posSales.map(s => s.cashierName).filter(name => Boolean(name) && !nonCashierNames.has(name)),
    ])
  );

  const periodSales = dateSales.filter(
    s => reportCashierFilter === 'ALL' || (s.cashierName || '') === reportCashierFilter
  );
  const periodExpenses = dateExpenses.filter(
    e => reportCashierFilter === 'ALL' || !e.cashierName || e.cashierName === reportCashierFilter
  );
  const periodPosDebtVouchers = datePosDebtVouchers.filter(
    v => reportCashierFilter === 'ALL' || !v.collectedByCashier || v.collectedByCashier === reportCashierFilter
  );

  const cashierShiftBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        cashierName: string;
        receiptCount: number;
        cashSales: number;
        cardSales: number;
        debtSales: number;
        giftCount: number;
        debtCollectedCash: number;
        expenses: number;
      }
    >();
    const ensure = (name: string) => {
      const key = name || 'نەناسراو';
      if (!map.has(key)) {
        map.set(key, {
          cashierName: key,
          receiptCount: 0,
          cashSales: 0,
          cardSales: 0,
          debtSales: 0,
          giftCount: 0,
          debtCollectedCash: 0,
          expenses: 0,
        });
      }
      return map.get(key)!;
    };
    dateSales.forEach(s => {
      const row = ensure(s.cashierName);
      row.receiptCount += 1;
      if (s.paymentType === 'CASH') row.cashSales += s.total;
      else if (s.paymentType === 'FIB_OR_CARD') row.cardSales += s.total;
      else if (s.paymentType === 'SPLIT') {
        row.cashSales += s.cashAmount || 0;
        row.cardSales += s.cardAmount || 0;
      } else if (s.paymentType === 'DEBT') row.debtSales += s.total;
      else if (s.paymentType === 'GIFT') row.giftCount += 1;
    });
    datePosDebtVouchers.forEach(v => {
      if (v.paymentMethod === 'CASH') {
        ensure(v.collectedByCashier || 'کاشێری شۆرۆم').debtCollectedCash += v.amount;
      }
    });
    dateExpenses.forEach(e => {
      ensure(e.cashierName || 'کاشێری شۆرۆم').expenses += e.amount;
    });
    return Array.from(map.values()).sort((a, b) => b.cashSales + b.cardSales - (a.cashSales + a.cardSales));
  }, [dateSales, datePosDebtVouchers, dateExpenses]);

  const totalCashSales = periodSales.reduce(
    (sum, s) => sum + (s.paymentType === 'CASH' ? s.total : s.paymentType === 'SPLIT' ? s.cashAmount || 0 : 0),
    0
  );
  const totalCardSales = periodSales.reduce(
    (sum, s) => sum + (s.paymentType === 'FIB_OR_CARD' ? s.total : s.paymentType === 'SPLIT' ? s.cardAmount || 0 : 0),
    0
  );
  const totalDebtSales = periodSales
    .filter(s => s.paymentType === 'DEBT')
    .reduce((sum, s) => sum + s.total, 0);
  const totalPosCashDebtCollected = periodPosDebtVouchers
    .filter(v => v.paymentMethod === 'CASH')
    .reduce((sum, v) => sum + v.amount, 0);
  const totalPosTransferDebtCollected = periodPosDebtVouchers
    .filter(v => v.paymentMethod === 'TRANSFER')
    .reduce((sum, v) => sum + v.amount, 0);
  const totalAllSales = periodSales.reduce((sum, s) => sum + s.total, 0);
  const totalBranchExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netCashInDrawer = openingFloat + totalCashSales + totalPosCashDebtCollected - totalBranchExpenses;
  const actualCashNum = actualCashCount === '' ? null : Number(actualCashCount) || 0;
  const cashDrawerDiff = actualCashNum !== null ? actualCashNum - netCashInDrawer : null;
  const totalShowroomStockKg = branchStock.reduce((sum, b) => sum + b.inStockKg, 0);
  const lowStockCount = branchStock.filter(b => b.inStockKg < (b.minAlertKg ?? 5)).length;

  const allPosGifts = posSales.filter(s => s.paymentType === 'GIFT');
  const customersWithDebtCount = customers.filter(c => c.currentDebt > 0).length;

  const filteredPosSales = periodSales.filter(s => {
    if (reportPaymentFilter !== 'ALL' && s.paymentType !== reportPaymentFilter) return false;
    const q = salesSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.saleNo.toLowerCase().includes(q) ||
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.cashierName || '').toLowerCase().includes(q)
    );
  });

  const handleExportPosSalesCsv = () => {
    const rows = [
      ['ژ. وەسڵ', 'بەروار', 'کات', 'کڕیار', 'کاشێر', 'شێواز', 'داشکاندن', 'کۆی گشتی (د.ع)'],
      ...filteredPosSales.map(s => [
        s.saleNo,
        s.date,
        s.time || '',
        s.customerName || 'کڕیاری ئاسایی',
        s.cashierName || '',
        s.paymentType,
        String(s.discount || 0),
        String(s.total),
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Showroom-POS-Sales-${todayISO}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenReturnModal = (sale: POSSale) => {
    setReturningSale(sale);
    const init: Record<string, number> = {};
    sale.items.forEach(it => {
      init[it.productId] = 0;
    });
    setReturnWeights(init);
    setReturnNotes('');
  };

  const handleSubmitPosReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningSale) return;
    const retItems = returningSale.items
      .map(it => {
        const w = Math.min(it.weightKg, Number(returnWeights[it.productId] || 0));
        if (w <= 0) return null;
        const bItem = branchStock.find(b => b.productId === it.productId);
        const prod = products.find(p => p.id === it.productId);
        const unitCost = bItem?.factoryCostPerKg ?? prod?.costPerKg ?? 2750;
        return {
          productId: it.productId,
          productName: it.productName,
          barcode: it.barcode || prod?.barcodePrefix || '',
          weightKg: Number(w.toFixed(3)),
          unitCost,
          costPerKg: unitCost,
          totalLoss: Math.round(w * unitCost),
          salePricePerKg: it.pricePerKg,
          customerDeductionAmount: roundTo250(w * it.pricePerKg),
          reason: 'DAMAGED' as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (retItems.length === 0) {
      showToast('تکایە کێشی گەڕاوە بنووسە', 'warn');
      return;
    }

    const totalWeightKg = Number(retItems.reduce((s, i) => s + i.weightKg, 0).toFixed(3));
    const totalLossAmount = retItems.reduce((s, i) => s + i.totalLoss, 0);
    const totalCustomerDeduction = retItems.reduce((s, i) => s + (i.customerDeductionAmount || 0), 0);

    addReturn({
      manualReceiptNo: `POS-RET-${returningSale.saleNo}`,
      salesReceiptNo: returningSale.saleNo,
      date: todayISO,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      sourceType: 'BRANCH',
      sourceName: factorySettings.showroomName || 'فرۆشگای شۆرۆم',
      customerName: returningSale.customerName,
      items: retItems,
      totalWeightKg,
      totalLossAmount,
      totalCustomerDeduction,
      disposalMethod: 'CONVERTED' as const,
      conversionStatus: 'PENDING' as const,
      notes: returnNotes.trim() || 'گەڕانەوە لە فرۆشگای شۆرۆم (POS)',
    });

    playPosBeep('success');
    showToast(`گەڕاوە بۆ وەسڵی #${returningSale.saleNo} تۆمارکرا و نێردرا بۆ قۆناغی ٣`, 'success');
    setReturningSale(null);
  };

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
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-0.5 rounded-full">
                <UserCheck className="w-3 h-3" />
                کاشێری ئێستا: {currentUser?.name || '---'}
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
          <button
            type="button"
            onClick={() => setAutoPrintReceipt(prev => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all border ${
              autoPrintReceipt
                ? 'bg-[#34C759]/12 border-[#34C759]/30 text-[#248A3D]'
                : 'bg-[#F5F5F7] border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
            title="چاپکردنی خۆکار دوای تەواوکردنی وەسڵ"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>چاپی خۆکار: {autoPrintReceipt ? 'چالاکە' : 'ناچالاک'}</span>
          </button>
          {posSales.length > 0 && (
            <button
              type="button"
              onClick={() => setPrintReceipt(posSales[0])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0071E3]/10 hover:bg-[#0071E3] text-[#0071E3] hover:text-white font-bold transition-all"
              title="چاپکردنەوەی دوایین وەسڵ (F8)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>دوا وەسڵ (F8)</span>
            </button>
          )}
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
                        <div className="flex items-center gap-1">
                          {inStock >= 1 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={e => {
                                e.stopPropagation();
                                const added = addItemToCart(product, 1, price);
                                if (added) playPosBeep('success');
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation();
                                  const added = addItemToCart(product, 1, price);
                                  if (added) playPosBeep('success');
                                }
                              }}
                              className="px-2 py-0.5 rounded-full bg-[#34C759]/15 hover:bg-[#34C759] text-[#248A3D] hover:text-white font-extrabold text-[10px] transition-colors"
                              title="زیادکردنی خێرای ١ کگم"
                            >
                              +١ کگم
                            </span>
                          )}
                          <span className="w-6 h-6 rounded-full bg-white group-hover:bg-[#0071E3] text-[#86868B] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                            <Scale className="w-3.5 h-3.5" />
                          </span>
                        </div>
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
                          {editingCartIndex === idx ? (
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={editingCartWeight}
                              onChange={e => setEditingCartWeight(e.target.value)}
                              onBlur={() => {
                                const parsed = parseFloat(editingCartWeight);
                                if (!isNaN(parsed)) {
                                  setCartItemExactWeight(idx, parsed);
                                }
                                setEditingCartIndex(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const parsed = parseFloat(editingCartWeight);
                                  if (!isNaN(parsed)) {
                                    setCartItemExactWeight(idx, parsed);
                                  }
                                  setEditingCartIndex(null);
                                } else if (e.key === 'Escape') {
                                  setEditingCartIndex(null);
                                }
                              }}
                              className="w-16 text-center font-bold text-xs tabular-nums text-[#0071E3] bg-white rounded-full px-1 py-0.5 border border-[#0071E3] outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCartIndex(idx);
                                setEditingCartWeight(item.weightKg.toFixed(3));
                              }}
                              title="کلیک بکە بۆ نووسینی کێشی ورد (بۆ نموونە 1.324)"
                              className="w-16 text-center font-bold text-xs tabular-nums text-[#1D1D1F] hover:text-[#0071E3] hover:bg-white rounded-full py-0.5 transition-colors"
                            >
                              {item.weightKg.toFixed(3)}
                            </button>
                          )}
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
                {/* Customer Selection (Required for DEBT/GIFT, Optional for CASH/CARD/SPLIT) */}
                <div
                  className={`p-2.5 rounded-2xl border space-y-1.5 text-xs ${
                    paymentType === 'DEBT'
                      ? 'bg-[#FF3B30]/8 border-[#FF3B30]/20'
                      : paymentType === 'GIFT'
                      ? 'bg-[#AF52DE]/8 border-[#AF52DE]/20'
                      : 'bg-[#F5F5F7]/70 border-black/[0.05]'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between font-bold ${
                      paymentType === 'DEBT'
                        ? 'text-[#D70015]'
                        : paymentType === 'GIFT'
                        ? 'text-[#8944AB]'
                        : 'text-[#515154]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {paymentType === 'GIFT' ? <Gift className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      <span>
                        {paymentType === 'DEBT'
                          ? 'کڕیاری قەرز (پێویستە):'
                          : paymentType === 'GIFT'
                          ? 'وەرگری هەدیە (پێویستە):'
                          : 'هەڵبژاردنی کڕیار (ئارەزوومەندانە):'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustName('');
                        setNewCustPhone('');
                        setNewCustAddress('');
                        setShowNewCustomerModal(true);
                      }}
                      className="px-2 py-0.5 rounded-full bg-white hover:bg-[#0071E3] text-[#0071E3] hover:text-white border border-[#0071E3]/25 text-[10px] font-extrabold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      کڕیاری نوێ
                    </button>
                  </div>
                  <select
                    value={selectedDebtCustomerId}
                    onChange={e => {
                      const cid = e.target.value;
                      setSelectedDebtCustomerId(cid);
                      const found = customers.find(c => c.id === cid);
                      if (found) {
                        setCustomerNameInput(found.name);
                        setCustomerPhoneInput(found.phone || '');
                      }
                    }}
                    className="apple-input bg-white w-full px-3 py-1.5 text-xs font-bold"
                  >
                    <option value="">
                      {paymentType === 'DEBT' || paymentType === 'GIFT'
                        ? '-- هەڵبژێرە یان "+ کڕیاری نوێ" دابگرە --'
                        : '-- کڕیاری ئاسایی نەقد (یان هەڵبژێرە) --'}
                    </option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `• ${c.phone}` : ''} {c.currentDebt > 0 ? `(قەرز: ${c.currentDebt.toLocaleString()} د.ع)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  {paymentType === 'GIFT' ? (
                    <input
                      type="text"
                      value={giftNote}
                      onChange={e => setGiftNote(e.target.value)}
                      placeholder="تێبینی هەدیە (بۆ نموونە: خێرخواز / تایبەت)..."
                      className="apple-input px-3 py-1.5 text-xs font-medium"
                    />
                  ) : (
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
                  )}
                </div>

                {/* Net Total & 5-Mode Payment Selector */}
                <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-[#86868B] flex items-center gap-2">
                        <span>{paymentType === 'GIFT' ? 'هەدیە (بێبەرامبەر)' : 'کۆی گشتی بۆ دان'}</span>
                        {paymentType !== 'GIFT' && calculatedDiscount > 0 && (
                          <span className="text-[#FF9500] font-bold">(-{calculatedDiscount.toLocaleString()})</span>
                        )}
                      </div>
                      <div className="text-2xl font-black text-[#1D1D1F] tabular-nums tracking-tight">
                        {payableTotal.toLocaleString()}{' '}
                        <span className="text-xs font-semibold text-[#86868B]">د.ع</span>
                        {paymentType === 'GIFT' && subtotal > 0 && (
                          <span className="text-[11px] font-bold text-[#8944AB] mr-2">
                            (بەهای فرۆش: {subtotal.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="apple-segmented grid grid-cols-5 gap-1">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`apple-segment-btn !px-1.5 !py-1.5 text-[11px] flex items-center justify-center gap-1 ${
                        paymentType === 'CASH' ? 'apple-segment-btn-active !text-[#248A3D]' : ''
                      }`}
                    >
                      <Banknote className="w-3 h-3" />
                      نەقد
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('FIB_OR_CARD')}
                      className={`apple-segment-btn !px-1.5 !py-1.5 text-[11px] flex items-center justify-center gap-1 ${
                        paymentType === 'FIB_OR_CARD' ? 'apple-segment-btn-active !text-[#0071E3]' : ''
                      }`}
                    >
                      <CreditCard className="w-3 h-3" />
                      کارت
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('SPLIT');
                        if (!splitCashAmount && netTotal > 0) {
                          setSplitCashAmount(String(roundTo250(netTotal / 2)));
                        }
                      }}
                      className={`apple-segment-btn !px-1.5 !py-1.5 text-[11px] flex items-center justify-center gap-1 ${
                        paymentType === 'SPLIT' ? 'apple-segment-btn-active !text-[#FF9500]' : ''
                      }`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      تێکەڵ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('DEBT')}
                      className={`apple-segment-btn !px-1.5 !py-1.5 text-[11px] flex items-center justify-center ${
                        paymentType === 'DEBT' ? 'apple-segment-btn-active !text-[#D70015]' : ''
                      }`}
                    >
                      قەرز
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('GIFT');
                        if (customerNameInput === 'کڕیاری ئاسایی نەقد') {
                          setCustomerNameInput('');
                        }
                      }}
                      className={`apple-segment-btn !px-1.5 !py-1.5 text-[11px] flex items-center justify-center gap-1 ${
                        paymentType === 'GIFT' ? 'apple-segment-btn-active !text-[#8944AB]' : ''
                      }`}
                    >
                      <Gift className="w-3 h-3" />
                      هەدیە
                    </button>
                  </div>
                </div>

                {/* Split Payment Inputs */}
                {paymentType === 'SPLIT' && (
                  <div className="p-3 rounded-2xl bg-[#FF9500]/10 border border-[#FF9500]/25 text-xs grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[#515154] font-semibold block mb-1">بەشی کاش (نەقد):</span>
                      <input
                        type="number"
                        step="250"
                        min="0"
                        max={netTotal}
                        value={splitCashAmount}
                        onChange={e => setSplitCashAmount(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-black/[0.08] rounded-xl font-bold text-sm text-[#248A3D] tabular-nums outline-none focus:border-[#FF9500]"
                      />
                    </div>
                    <div>
                      <span className="text-[#515154] font-semibold block mb-1">بەشی کارت / FIB:</span>
                      <div className="w-full px-3 py-1.5 bg-white/70 border border-black/[0.06] rounded-xl font-extrabold text-sm text-[#0071E3] tabular-nums">
                        {splitCardNum.toLocaleString()} د.ع
                      </div>
                    </div>
                  </div>
                )}

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
          {/* Inventory Header + Barcode Stock-In Button */}
          <div className="apple-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-[#1D1D1F]">کۆگای فرۆشگای شۆرۆم، جەرد و نرخەکان</h3>
              <p className="text-xs text-[#86868B] mt-0.5">
                داخڵکردنی ڕۆژانەی بەرهەم بە بارکۆد ریدەر، گۆڕینی نرخ، و جەرد و تەلەفی ساردکەرەوە
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setReceiveReceiptNo(`SH-IN-${Math.floor(100 + Math.random() * 900)}`);
                  setShowReceiveModal(true);
                }}
                className="px-4 py-2.5 rounded-full bg-[#34C759] hover:bg-[#2FB350] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Barcode className="w-4 h-4" />
                داخلکردنی بار بە بارکۆد ریدەر
              </button>
            </div>
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
                      <th className="p-3.5">کۆد / بارکۆد</th>
                      <th className="p-3.5">بەرهەم</th>
                      <th className="p-3.5">بەردەست (کگم)</th>
                      <th className="p-3.5">نرخی فرۆشتن</th>
                      <th className="p-3.5 text-center">کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {branchStock.map(item => (
                      <tr key={item.productId} className="hover:bg-[#F5F5F7]/50 transition-colors">
                        <td className="p-3.5 font-mono">
                          <div className="font-bold text-[#515154]">{item.code}</div>
                          <div className="text-[10px] text-[#86868B]">{item.barcode}</div>
                        </td>
                        <td className="p-3.5 font-bold text-[#1D1D1F]">{item.productName}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold tabular-nums ${
                              item.inStockKg > (item.minAlertKg ?? 5) * 2
                                ? 'bg-[#34C759]/12 text-[#248A3D]'
                                : item.inStockKg >= (item.minAlertKg ?? 5)
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
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPriceItem(item);
                                setNewPriceInput(item.retailPricePerKg.toString());
                                setNewMinAlertInput(String(item.minAlertKg ?? 5));
                              }}
                              className="px-2.5 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] hover:text-white text-[#1D1D1F] font-semibold text-xs transition-colors inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              نرخ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStockAdjustItem(item);
                                setAdjustNewKg(item.inStockKg.toFixed(2));
                                setAdjustReason('SPOILAGE');
                                setAdjustNote('');
                              }}
                              className="px-2.5 py-1 rounded-full bg-[#FF9500]/12 hover:bg-[#FF9500] text-[#B25000] hover:text-white font-semibold text-xs transition-colors inline-flex items-center gap-1"
                            >
                              <Scale className="w-3 h-3" />
                              جەرد/تەلەف
                            </button>
                          </div>
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
                    <button
                      type="button"
                      key={rec.id}
                      onClick={() => setSelectedInboundReceipt(rec)}
                      className="w-full py-2.5 px-1.5 hover:bg-[#F5F5F7]/70 rounded-xl flex items-center justify-between gap-2 text-xs text-right transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#0071E3]">{rec.receiptNo}</span>
                          <span className="font-bold text-[#1D1D1F]">{rec.repName}</span>
                        </div>
                        <span className="text-[10px] text-[#86868B]">
                          {rec.date} {rec.time} • {rec.itemsCount} بەرهەم (کلیک بۆ چاپ)
                        </span>
                      </div>
                      <span className="font-extrabold text-[#248A3D] tabular-nums shrink-0">
                        +{rec.totalWeightKg.toFixed(1)} کگم
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: CUSTOMERS DEBT COLLECTION AT POS (وەرگرتنەوەی قەرزی کڕیاران) */}
      {/* ===================================================================== */}
      {activeSubTab === 'CUSTOMERS_DEBT' && (() => {
        const q = debtSearch.trim().toLowerCase();
        const filteredDebtors = customers
          .filter(c => {
            if (!q) return c.currentDebt > 0;
            return c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
          })
          .sort((a, b) => b.currentDebt - a.currentDebt);
        const totalAllCustomerDebt = customers.reduce((s, c) => s + Math.max(0, c.currentDebt), 0);
        const posVouchersList = vouchers.filter(v => v.collectedAtPos);

        return (
          <div className="space-y-5">
            <div className="apple-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-[#1D1D1F] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0071E3]" />
                  قەرزی کڕیاران و وەرگرتنەوە لە کاشێر
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  هەر کڕیارێک لە شۆرۆم پارەی قەرزەکەی بداتەوە، ڕاستەوخۆ لێرە وەریبگرە و دەچێتە سەر سەندوقی ئەمڕۆ
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={debtSearch}
                    onChange={e => setDebtSearch(e.target.value)}
                    placeholder="گەڕان بە ناو یان مۆبایلی کڕیار..."
                    className="apple-input w-full pr-8 pl-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewCustName('');
                    setNewCustPhone('');
                    setNewCustAddress('');
                    setShowNewCustomerModal(true);
                  }}
                  className="px-3.5 py-2 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  کڕیاری نوێ
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">کۆی قەرزی کڕیاران</span>
                <div className="text-2xl font-black text-[#D70015] tabular-nums mt-1">
                  {totalAllCustomerDebt.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
                </div>
              </div>
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">کڕیارە قەرزارەکان</span>
                <div className="text-2xl font-black text-[#1D1D1F] tabular-nums mt-1">
                  {customersWithDebtCount} <span className="text-xs font-medium text-[#86868B]">کڕیار</span>
                </div>
              </div>
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">قەرزی وەرگیراوی ئەمڕۆ (کاش)</span>
                <div className="text-2xl font-black text-[#248A3D] tabular-nums mt-1">
                  {totalPosCashDebtCollected.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7 apple-card overflow-hidden">
                <div className="p-4 border-b border-black/[0.06] flex items-center justify-between">
                  <span className="font-extrabold text-sm text-[#1D1D1F]">لیستی کڕیاران ({filteredDebtors.length})</span>
                </div>
                <div className="divide-y divide-black/[0.05] max-h-[420px] overflow-y-auto">
                  {filteredDebtors.length === 0 ? (
                    <p className="py-12 text-center text-xs text-[#86868B]">هیچ کڕیارێکی قەرزار نەدۆزرایەوە</p>
                  ) : (
                    filteredDebtors.map(c => (
                      <div key={c.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[#F5F5F7]/50 text-xs">
                        <div>
                          <div className="font-extrabold text-sm text-[#1D1D1F]">{c.name}</div>
                          <div className="text-[11px] text-[#86868B] mt-0.5">
                            {c.phone || 'بێ ژمارە'} • {c.address || 'شۆرۆم'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <span className="text-[10px] text-[#86868B] block">قەرزی ماوە</span>
                            <span className={`font-black text-sm tabular-nums ${c.currentDebt > 0 ? 'text-[#D70015]' : 'text-[#248A3D]'}`}>
                              {c.currentDebt.toLocaleString()} د.ع
                            </span>
                          </div>
                          {c.currentDebt > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setCollectingCustomer(c);
                                setCollectAmount(String(c.currentDebt));
                                setCollectDiscount('');
                                setCollectMethod('CASH');
                                setCollectNotes('');
                              }}
                              className="px-3.5 py-2 rounded-full bg-[#34C759] hover:bg-[#2FB350] text-white font-bold text-xs shadow-2xs transition-all"
                            >
                              وەرگرتنی قەرز
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 apple-card p-5 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
                  <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#34C759]" />
                    قەرزە وەرگیراوەکانی شۆرۆم ({posVouchersList.length})
                  </h4>
                </div>
                <div className="divide-y divide-black/[0.05] max-h-[380px] overflow-y-auto">
                  {posVouchersList.length === 0 ? (
                    <p className="py-10 text-center text-xs text-[#86868B]">هێشتا هیچ قەرزێک لە کاشێر وەرنەگیراوە</p>
                  ) : (
                    posVouchersList.map(v => (
                      <div key={v.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#0071E3]">{v.voucherNo}</span>
                            <span className="font-bold text-[#1D1D1F]">{v.partyName}</span>
                          </div>
                          <span className="text-[10px] text-[#86868B]">
                            {v.date} {v.time} • {v.paymentMethod === 'CASH' ? 'نەقد' : 'گواستنەوە'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#248A3D] tabular-nums">
                            +{v.amount.toLocaleString()} د.ع
                          </span>
                          <button
                            type="button"
                            onClick={() => setPrintDebtVoucher(v)}
                            className="p-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] text-[#1D1D1F] hover:text-white transition-colors"
                            title="چاپکردنی وەسڵی 80mm"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB 4: SHOWROOM GIFTS REPORT (هەدیە و بەخشینی شۆرۆم) */}
      {/* ===================================================================== */}
      {activeSubTab === 'GIFTS' && (() => {
        const gq = giftSearch.trim().toLowerCase();
        const filteredGifts = allPosGifts.filter(g => {
          if (giftStartDate && g.date < giftStartDate) return false;
          if (giftEndDate && g.date > giftEndDate) return false;
          if (!gq) return true;
          return (
            g.saleNo.toLowerCase().includes(gq) ||
            (g.customerName || '').toLowerCase().includes(gq) ||
            (g.customerPhone || '').includes(gq) ||
            (g.giftNote || '').toLowerCase().includes(gq)
          );
        });

        const totalGiftWeightKg = filteredGifts.reduce(
          (sum, g) => sum + g.items.reduce((is, i) => is + i.weightKg, 0),
          0
        );
        const totalGiftsFactoryCost = filteredGifts.reduce((sum, g) => sum + (g.giftCost || 0), 0);
        const totalGiftsRetailValue = filteredGifts.reduce((sum, g) => sum + (g.subtotal || 0), 0);

        const byRecipientMap = new Map<string, { name: string; count: number; weightKg: number; cost: number }>();
        filteredGifts.forEach(g => {
          const name = g.customerName || 'نەناسراو';
          const cur = byRecipientMap.get(name) || { name, count: 0, weightKg: 0, cost: 0 };
          cur.count += 1;
          cur.weightKg += g.items.reduce((s, i) => s + i.weightKg, 0);
          cur.cost += g.giftCost || 0;
          byRecipientMap.set(name, cur);
        });
        const recipientSummary = Array.from(byRecipientMap.values()).sort((a, b) => b.weightKg - a.weightKg);

        const handleExportGiftsCsv = () => {
          const rows = [
            ['ژ. وەسڵ', 'بەروار', 'وەرگری هەدیە', 'ژ. مۆبایل', 'کێش (کگم)', 'بەهای فرۆش', 'تێچوو', 'تێبینی', 'کاشێر'],
            ...filteredGifts.map(g => [
              g.saleNo,
              g.date,
              g.customerName || '',
              g.customerPhone || '',
              g.items.reduce((s, i) => s + i.weightKg, 0).toFixed(2),
              String(g.subtotal || 0),
              String(g.giftCost || 0),
              g.giftNote || '',
              g.cashierName || '',
            ]),
          ];
          const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `showroom-gifts-${toLocalISODate()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <div className="space-y-5">
            <div className="apple-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-[#1D1D1F] flex items-center gap-2">
                  <Gift className="w-5 h-5 text-[#8944AB]" />
                  ڕاپۆرتی هەدیە و بەخشینەکانی شۆرۆم
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  تۆماری تەواوی هەموو هەدیەکان لە شۆرۆم: چەند هەدیە دراوە، بە کێ دراوە و تێچووەکەی چەندە
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <input
                  type="date"
                  value={giftStartDate}
                  onChange={e => setGiftStartDate(e.target.value)}
                  className="apple-input px-3 py-1.5 text-xs"
                />
                <span className="text-[#86868B]">تا</span>
                <input
                  type="date"
                  value={giftEndDate}
                  onChange={e => setGiftEndDate(e.target.value)}
                  className="apple-input px-3 py-1.5 text-xs"
                />
                {(giftStartDate || giftEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setGiftStartDate('');
                      setGiftEndDate('');
                    }}
                    className="px-2.5 py-1.5 rounded-full bg-[#F5F5F7] text-[#1D1D1F] font-bold"
                  >
                    هەموو
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportGiftsCsv}
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
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">ژمارەی هەدیەکان</span>
                <div className="text-2xl font-black text-[#8944AB] tabular-nums mt-1">{filteredGifts.length}</div>
              </div>
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">کۆی کێشی هەدیە</span>
                <div className="text-2xl font-black text-[#1D1D1F] tabular-nums mt-1">
                  {totalGiftWeightKg.toFixed(2)} <span className="text-xs font-medium text-[#86868B]">کگم</span>
                </div>
              </div>
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">تێچووی کارگە</span>
                <div className="text-2xl font-black text-[#D70015] tabular-nums mt-1">
                  {totalGiftsFactoryCost.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
                </div>
              </div>
              <div className="apple-card p-4">
                <span className="text-[11px] font-semibold text-[#86868B] block">بەهای بازاڕی</span>
                <div className="text-2xl font-black text-[#0071E3] tabular-nums mt-1">
                  {totalGiftsRetailValue.toLocaleString()} <span className="text-xs font-medium text-[#86868B]">د.ع</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 apple-card p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.06]">
                  <h4 className="font-extrabold text-sm text-[#1D1D1F]">تۆماری هەدیە دراوەکان ({filteredGifts.length})</h4>
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={giftSearch}
                      onChange={e => setGiftSearch(e.target.value)}
                      placeholder="گەڕان بە وەرگر یان وەسڵ..."
                      className="apple-input w-full pr-8 pl-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="divide-y divide-black/[0.05] max-h-[400px] overflow-y-auto">
                  {filteredGifts.length === 0 ? (
                    <p className="py-12 text-center text-xs text-[#86868B]">هیچ هەدیەیەک لەم ماوەیەدا نییە</p>
                  ) : (
                    filteredGifts.map(g => {
                      const kg = g.items.reduce((s, i) => s + i.weightKg, 0);
                      return (
                        <div key={g.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#8944AB]">{g.saleNo}</span>
                              <span className="font-extrabold text-[#1D1D1F]">{g.customerName || 'نەناسراو'}</span>
                              {g.customerPhone && (
                                <span className="text-[10px] font-mono text-[#515154]" dir="ltr">
                                  ({g.customerPhone})
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-[#AF52DE]/12 text-[#8944AB] font-bold text-[10px]">
                                {kg.toFixed(2)} کگم
                              </span>
                            </div>
                            <div className="text-[10px] text-[#86868B] mt-0.5">
                              {g.date} {g.time} • {g.giftNote || 'هەدیەی شۆرۆم'} • کاشێر: {g.cashierName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#D70015] tabular-nums">
                              تێچوو: {(g.giftCost || 0).toLocaleString()} د.ع
                            </span>
                            <button
                              type="button"
                              onClick={() => setPrintReceipt(g)}
                              className="px-2.5 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#0071E3] hover:text-white text-[#1D1D1F] font-semibold text-xs transition-colors flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" />
                              چاپ
                            </button>
                            {hasAccess('settings') && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`هەدیەی #${g.saleNo} بسڕێتەوە و کۆگا بگەڕێتەوە؟`)) {
                                    softDeleteRecord('POS_SALE', g.id, 'سڕینەوەی هەدیەی شۆرۆم');
                                  }
                                }}
                                className="p-1.5 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30] text-[#FF3B30] hover:text-white transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 apple-card p-5 space-y-3">
                <h4 className="font-extrabold text-sm text-[#1D1D1F] pb-3 border-b border-black/[0.06]">
                  پوختە بەپێی وەرگر (بە کێ دراوە)
                </h4>
                <div className="divide-y divide-black/[0.05] max-h-[380px] overflow-y-auto">
                  {recipientSummary.length === 0 ? (
                    <p className="py-10 text-center text-xs text-[#86868B]">هیچ داتایەک نییە</p>
                  ) : (
                    recipientSummary.map(r => (
                      <div key={r.name} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#1D1D1F]">{r.name}</div>
                          <span className="text-[10px] text-[#86868B]">{r.count} جار • تێچوو: {r.cost.toLocaleString()} د.ع</span>
                        </div>
                        <span className="font-extrabold text-[#8944AB] tabular-nums">{r.weightKg.toFixed(2)} کگم</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* TAB 5: SALES, CASH DRAWER, Z-REPORT & EXPENSES */}
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
                پوختەی فرۆشتنی نەقد، کارت، تێکەڵ، قەرزی وەرگیراو، خەرجی و صافی پارەی ناو قاسە بە 80mm
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
              <div className="flex items-center gap-1.5 bg-[#F5F5F7] px-2.5 py-1.5 rounded-full">
                <Calendar className="w-3.5 h-3.5 text-[#0071E3]" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={e => setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReportDate(todayISO)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    reportDate === todayISO ? 'bg-[#0071E3] text-white' : 'bg-white text-[#515154]'
                  }`}
                >
                  ئەمڕۆ
                </button>
                <button
                  type="button"
                  onClick={() => setReportDate('')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    reportDate === '' ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#515154]'
                  }`}
                >
                  هەموو
                </button>
              </div>
              <div className="flex items-center gap-1.5 bg-[#F5F5F7] px-2.5 py-1.5 rounded-full">
                <UserCheck className="w-3.5 h-3.5 text-[#0071E3]" />
                <select
                  value={reportCashierFilter}
                  disabled={!canViewAllCashiers}
                  onChange={e => setReportCashierFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {canViewAllCashiers && <option value="ALL">هەموو کاشێرەکان</option>}
                  {!canViewAllCashiers &&
                    currentUser?.name &&
                    !cashierOptions.includes(currentUser.name) && (
                      <option value={currentUser.name}>{currentUser.name}</option>
                    )}
                  {cashierOptions.map(cName => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
                {currentUser?.role === 'CASHIER' && currentUser?.name && (
                  <button
                    type="button"
                    onClick={() => setReportCashierFilter(currentUser.name)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      reportCashierFilter === currentUser.name
                        ? 'bg-[#0071E3] text-white'
                        : 'bg-white text-[#515154]'
                    }`}
                  >
                    شەفتی من
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleExportPosSalesCsv}
                title="دابەزاندنی Excel / CSV"
                aria-label="دابەزاندنی Excel / CSV"
                className="w-9 h-9 rounded-full bg-[#34C759]/12 hover:bg-[#34C759]/20 text-[#248A3D] flex items-center justify-center transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowZReportModal(true)}
                className="px-4 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                چاپکردنی Z-Report
              </button>
            </div>
          </div>

          {/* Shift Opening Float & Actual Cash Drawer Reconciliation */}
          <div className="apple-card p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-center text-xs">
            <div>
              <label className="font-bold text-[#515154] block mb-1">
                پارەی سەرەتای شەفت (Opening Float):
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={openingFloat || ''}
                onChange={e => handleOpeningFloatChange(Number(e.target.value) || 0)}
                placeholder="0 د.ع"
                className="apple-input w-full px-3 py-2 font-black tabular-nums"
              />
            </div>
            <div>
              <label className="font-bold text-[#515154] block mb-1">
                ژماردنی کاشی ناو قاسە (Actual Cash):
              </label>
              <input
                type="number"
                min="0"
                step="250"
                value={actualCashCount}
                onChange={e => setActualCashCount(e.target.value)}
                placeholder="بڕی ژمێردراو..."
                className="apple-input w-full px-3 py-2 font-black tabular-nums"
              />
            </div>
            <div className="p-3 rounded-2xl bg-[#F5F5F7]">
              <span className="text-[11px] text-[#86868B] block">کاشی چاوەڕوانکراو (بە فڵۆتەوە):</span>
              <span className="text-base font-black text-[#0071E3] tabular-nums">
                {netCashInDrawer.toLocaleString()} د.ع
              </span>
            </div>
            <div
              className={`p-3 rounded-2xl ${
                cashDrawerDiff === null
                  ? 'bg-[#F5F5F7]'
                  : cashDrawerDiff === 0
                  ? 'bg-[#34C759]/12 text-[#248A3D]'
                  : cashDrawerDiff > 0
                  ? 'bg-[#0071E3]/10 text-[#0071E3]'
                  : 'bg-[#FF3B30]/12 text-[#D70015]'
              }`}
            >
              <span className="text-[11px] opacity-80 block">جیاوازیی قاسە:</span>
              <span className="text-base font-black tabular-nums">
                {cashDrawerDiff === null
                  ? 'نەژمێردراوە'
                  : cashDrawerDiff === 0
                  ? '✓ تەواو یەکسانە (0 د.ع)'
                  : `${cashDrawerDiff > 0 ? '+' : ''}${cashDrawerDiff.toLocaleString()} د.ع`}
              </span>
            </div>
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

          {/* Per-Cashier Shift Breakdown (when viewing ALL cashiers) */}
          {reportCashierFilter === 'ALL' && cashierShiftBreakdown.length > 0 && (
            <div className="apple-card overflow-hidden">
              <div className="p-4 border-b border-black/[0.06] flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#0071E3]" />
                  پوختەی شەفتی هەر کاشێرێک ({reportDate || 'هەموو ڕۆژەکان'})
                </h4>
                <span className="text-[11px] text-[#86868B]">کلیک لەسەر ناوی هەر کاشێرێک بکە بۆ بینینی شەفتەکەی</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#F5F5F7] text-[#515154] font-semibold border-b border-black/[0.06]">
                    <tr>
                      <th className="p-3">کاشێر</th>
                      <th className="p-3">وەسڵ</th>
                      <th className="p-3">فرۆشی نەقد</th>
                      <th className="p-3">کارت / FIB</th>
                      <th className="p-3">قەرز</th>
                      <th className="p-3">وەرگرتنەوەی قەرز</th>
                      <th className="p-3">خەرجی</th>
                      <th className="p-3">صافی کاش</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {cashierShiftBreakdown.map(row => {
                      const netCash = row.cashSales + row.debtCollectedCash - row.expenses;
                      return (
                        <tr
                          key={row.cashierName}
                          onClick={() => setReportCashierFilter(row.cashierName)}
                          className="hover:bg-[#0071E3]/5 cursor-pointer transition-colors"
                        >
                          <td className="p-3 font-extrabold text-[#0071E3]">{row.cashierName}</td>
                          <td className="p-3 font-bold tabular-nums">{row.receiptCount}</td>
                          <td className="p-3 font-bold text-[#248A3D] tabular-nums">{row.cashSales.toLocaleString()}</td>
                          <td className="p-3 font-bold text-[#0071E3] tabular-nums">{row.cardSales.toLocaleString()}</td>
                          <td className="p-3 font-bold text-[#D70015] tabular-nums">{row.debtSales.toLocaleString()}</td>
                          <td className="p-3 font-bold text-[#248A3D] tabular-nums">+{row.debtCollectedCash.toLocaleString()}</td>
                          <td className="p-3 font-bold text-[#FF3B30] tabular-nums">-{row.expenses.toLocaleString()}</td>
                          <td className="p-3 font-black text-[#1D1D1F] tabular-nums">{netCash.toLocaleString()} د.ع</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* POS Sales History */}
            <div className="lg:col-span-7 apple-card p-5 space-y-3">
              <div className="flex flex-col gap-2.5 pb-3 border-b border-black/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#0071E3]" />
                    مێژووی وەسڵەکانی فرۆشگا ({filteredPosSales.length})
                  </h4>
                  <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 text-[#86868B] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={salesSearch}
                      onChange={e => setSalesSearch(e.target.value)}
                      placeholder="گەڕان بە وەسڵ یان کڕیار..."
                      className="apple-input w-full pr-8 pl-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'ALL', label: 'هەموو' },
                      { id: 'CASH', label: 'نەقد' },
                      { id: 'FIB_OR_CARD', label: 'کارت' },
                      { id: 'SPLIT', label: 'تێکەڵ' },
                      { id: 'DEBT', label: 'قەرز' },
                      { id: 'GIFT', label: 'هەدیە' },
                    ] as const
                  ).map(pf => (
                    <button
                      key={pf.id}
                      type="button"
                      onClick={() => setReportPaymentFilter(pf.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                        reportPaymentFilter === pf.id
                          ? 'bg-[#0071E3] text-white'
                          : 'bg-[#F5F5F7] text-[#515154] hover:bg-[#E8E8ED]'
                      }`}
                    >
                      {pf.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-black/[0.05] max-h-[380px] overflow-y-auto">
                {filteredPosSales.map(sale => (
                  <div key={sale.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
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
                              : sale.paymentType === 'SPLIT'
                              ? 'bg-[#FF9500]/12 text-[#B25000]'
                              : sale.paymentType === 'GIFT'
                              ? 'bg-[#AF52DE]/12 text-[#8944AB]'
                              : 'bg-[#FF3B30]/12 text-[#D70015]'
                          }`}
                        >
                          {sale.paymentType === 'CASH'
                            ? 'نەقد'
                            : sale.paymentType === 'FIB_OR_CARD'
                            ? 'کارت'
                            : sale.paymentType === 'SPLIT'
                            ? 'تێکەڵ'
                            : sale.paymentType === 'GIFT'
                            ? 'هەدیە'
                            : 'قەرز'}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#86868B]">
                        {sale.date} {sale.time} • کاشێر: {sale.cashierName}
                        {sale.paymentType === 'SPLIT' && ` • کاش: ${(sale.cashAmount || 0).toLocaleString()} / کارت: ${(sale.cardAmount || 0).toLocaleString()}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-[#1D1D1F] tabular-nums ml-1">
                        {sale.total.toLocaleString()} د.ع
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal(sale)}
                        className="px-2.5 py-1 rounded-full bg-[#FF9500]/12 hover:bg-[#FF9500] text-[#B25000] hover:text-white font-semibold text-xs transition-colors flex items-center gap-1"
                        title="گەڕانەوەی وەسڵ / تەلەف"
                      >
                        <RotateCcw className="w-3 h-3" />
                        گەڕانەوە
                      </button>
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
                {periodExpenses.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[#86868B]">هیچ خەرجییەک نییە</p>
                ) : (
                  periodExpenses.map(exp => (
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

              <div className="grid grid-cols-5 gap-1.5">
                {['0.500', '1.000', '1.500', '2.000', '5.000'].map(preset => (
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
                          const payLabel =
                            s.paymentType === 'CASH'
                              ? 'نەقد'
                              : s.paymentType === 'FIB_OR_CARD'
                              ? 'کارت'
                              : s.paymentType === 'SPLIT'
                              ? `تێکەڵ (کاش: ${(s.cashAmount || 0).toLocaleString()} / کارت: ${(s.cardAmount || 0).toLocaleString()})`
                              : s.paymentType === 'GIFT'
                              ? 'هەدیە (بێبەرامبەر)'
                              : 'قەرز';
                          const msg = `وەسڵی فرۆشتنی ${factorySettings.showroomName || factorySettings.factoryName}\n\nوەسڵ: ${s.saleNo}\nبەروار: ${s.date}\nکاشێر: ${s.cashierName || '---'}\n\nبڕگەکان:\n${itemsText}\n\nکۆی گشتی: ${s.total.toLocaleString()} د.ع (${payLabel})\n\nتەلەفۆن: ${factorySettings.phone1}\n${factorySettings.receiptFooter || 'سوپاس بۆ کڕینەکەتان 🍗'}`;
                          const rawPhone = (s.customerPhone || '').replace(/\D/g, '');
                          const waPhone = rawPhone.startsWith('0') ? `964${rawPhone.slice(1)}` : rawPhone;
                          window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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
                        <span className="text-[#86868B]">{printReceipt.paymentType === 'GIFT' ? 'وەرگر:' : 'کڕیار:'}</span>
                        <span>
                          {printReceipt.customerName}
                          {printReceipt.customerPhone ? ` (${printReceipt.customerPhone})` : ''}
                        </span>
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
                            : printReceipt.paymentType === 'SPLIT'
                            ? `تێکەڵ (کاش: ${(printReceipt.cashAmount || 0).toLocaleString()} / کارت: ${(printReceipt.cardAmount || 0).toLocaleString()})`
                            : printReceipt.paymentType === 'GIFT'
                            ? 'هەدیە (Gift - بێبەرامبەر)'
                            : 'قەرز (Debit)'}
                        </span>
                      </div>
                      {printReceipt.paymentType === 'GIFT' && printReceipt.giftNote && (
                        <div className="flex justify-between text-[10px] text-[#8944AB]">
                          <span>تێبینی هەدیە:</span>
                          <span className="font-bold">{printReceipt.giftNote}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <BarcodeSVG code={printReceipt.saleNo.replace(/[^0-9]/g, '') || '1001001'} width={220} height={40} />
                    </div>

                    <p className="text-[10px] text-[#86868B] font-sans">
                      {factorySettings.receiptFooter || 'سوپاس بۆ سەردانەکەتان'}
                    </p>
                    <p dir="ltr" className="text-[9px] font-bold text-[#86868B] tracking-widest uppercase pt-1">
                      Powered by RAND SUITE
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
              const totalSoldKg = periodSales.reduce(
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
                      بەروار: {reportDate || 'هەموو ڕۆژەکان'} •{' '}
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="border-t border-b border-dashed border-black/20 py-2 space-y-1 text-[11px] text-right font-sans">
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">کاشێر:</span>
                      <span className="font-bold">
                        {reportCashierFilter === 'ALL' ? `هەموو کاشێرەکان (${currentUser?.name || '---'})` : reportCashierFilter}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#86868B]">ژمارەی وەسڵەکان:</span>
                      <span className="font-bold tabular-nums">{periodSales.length} وەسڵ</span>
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
                    {totalPosCashDebtCollected > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">قەرزی وەرگیراو لە کاشێر (کاش):</span>
                        <span className="font-bold text-[#248A3D] tabular-nums">+{totalPosCashDebtCollected.toLocaleString()} د.ع</span>
                      </div>
                    )}
                    {totalPosTransferDebtCollected > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#86868B]">قەرزی وەرگیراو (گواستنەوە):</span>
                        <span className="font-bold text-[#0071E3] tabular-nums">{totalPosTransferDebtCollected.toLocaleString()} د.ع</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-black/[0.06]">
                      <span className="font-bold">کۆی گشتی فرۆش:</span>
                      <span className="font-black tabular-nums">{totalAllSales.toLocaleString()} د.ع</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-right font-sans">
                    {openingFloat > 0 && (
                      <div className="flex justify-between text-[11px] text-[#515154]">
                        <span>سەرەتای شەفت (Opening Float):</span>
                        <span className="font-bold tabular-nums">+{openingFloat.toLocaleString()} د.ع</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] text-[#FF3B30]">
                      <span>کۆی خەرجییەکانی شۆرۆم:</span>
                      <span className="font-bold tabular-nums">-{totalBranchExpenses.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between text-sm font-black pt-1.5 border-t border-black/15">
                      <span>صافی پارەی ناو قاسە:</span>
                      <span className="text-[#0071E3] tabular-nums">{netCashInDrawer.toLocaleString()} د.ع</span>
                    </div>
                    {actualCashNum !== null && (
                      <>
                        <div className="flex justify-between text-[11px] text-[#1D1D1F]">
                          <span>کاشی ژمێردراوی دەستی:</span>
                          <span className="font-bold tabular-nums">{actualCashNum.toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-black">
                          <span>جیاوازیی قاسە:</span>
                          <span className={cashDrawerDiff === 0 ? 'text-[#248A3D]' : 'text-[#FF3B30]'}>
                            {cashDrawerDiff === 0
                              ? '0 د.ع (تەواو)'
                              : `${(cashDrawerDiff || 0) > 0 ? '+' : ''}${(cashDrawerDiff || 0).toLocaleString()} د.ع`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <p dir="ltr" className="text-[9px] font-bold text-[#86868B] tracking-widest uppercase pt-1">
                    Powered by RAND SUITE
                  </p>
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
                <label className="font-semibold text-[#515154] block mb-1">سەرچاوە / تێبینی (ئارەزوومەندانە):</label>
                <input
                  type="text"
                  placeholder="داخڵکردنی ڕۆژانەی شۆرۆم..."
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
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-[#86868B]">زیادکردنی بەرهەم و کێش:</div>
                <button
                  type="button"
                  onClick={() => setShowRecAddProduct(prev => !prev)}
                  className="text-[11px] font-bold text-[#0071E3] hover:text-[#0077ED]"
                >
                  {showRecAddProduct ? 'پاشگەزبوونەوە' : '+ زیادکردنی بەرهەمی نوێ'}
                </button>
              </div>
              {showRecAddProduct && (
                <div className="p-2.5 rounded-xl bg-white border border-black/[0.06] space-y-2">
                  <input
                    type="text"
                    placeholder="ناوی بەرهەمی نوێ..."
                    value={recNewProdName}
                    onChange={e => setRecNewProdName(e.target.value)}
                    className="apple-input w-full px-3 py-1.5 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="بارکۆدی بەرهەم (سکان یان بنووسە — ئارەزوومەندانە)"
                    value={recNewProdBarcode}
                    onChange={e => setRecNewProdBarcode(e.target.value)}
                    className="apple-input w-full px-3 py-1.5 text-xs font-mono text-left"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="نرخی فرۆشتن (د.ع)"
                      value={recNewProdPrice}
                      onChange={e => setRecNewProdPrice(e.target.value)}
                      className="apple-input w-full px-3 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="number"
                      placeholder="تێچووی کیلۆ (د.ع)"
                      value={recNewProdCost}
                      onChange={e => setRecNewProdCost(e.target.value)}
                      className="apple-input w-full px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateReceiveProduct}
                    className="w-full py-1.5 rounded-xl bg-[#0071E3] text-white font-bold text-[11px]"
                  >
                    زیادکردنی بەرهەم و هەڵبژاردنی
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <select
                  value={receiveProdId}
                  onChange={e => setReceiveProdId(e.target.value)}
                  className="apple-input bg-white flex-1 px-3 py-2 font-bold"
                >
                  {products.length === 0 && (
                    <option value="">هیچ بەرهەمێک نییە — سەرەتا زیادی بکە</option>
                  )}
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
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#515154] block mb-1">نرخی فرۆشتنی کیلۆ (د.ع):</label>
                <input
                  type="number"
                  value={newPriceInput}
                  onChange={e => setNewPriceInput(e.target.value)}
                  className="apple-input w-full px-3.5 py-2.5 text-base font-extrabold tabular-nums text-center"
                  autoFocus
                />
              </div>
              <div>
                <label className="font-semibold text-[#515154] block mb-1">سنووری ئاگادارکردنەوەی کەمبوون (کگم):</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newMinAlertInput}
                  onChange={e => setNewMinAlertInput(e.target.value)}
                  className="apple-input w-full px-3.5 py-2 text-sm font-bold tabular-nums text-center"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const parsed = parseFloat(newPriceInput);
                const parsedAlert = parseFloat(newMinAlertInput);
                if (!isNaN(parsed) && parsed > 0) {
                  updateBranchStockItem(editingPriceItem.productId, {
                    retailPricePerKg: roundTo250(parsed),
                    ...(isNaN(parsedAlert) ? {} : { minAlertKg: Math.max(0, parsedAlert) }),
                  });
                  showToast('نرخ و سنووری ئاگاداری نوێکرانەوە', 'success');
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

      {/* 7. Showroom Customer Return / Refund Modal */}
      {returningSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <form
            onSubmit={handleSubmitPosReturn}
            className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h4 className="font-extrabold text-sm text-[#1D1D1F] flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-[#FF9500]" />
                  گەڕانەوەی کاڵا لە وەسڵی #{returningSale.saleNo}
                </h4>
                <p className="text-[11px] text-[#86868B]">
                  {returningSale.customerName || 'کڕیاری ئاسایی'} • دەچێتە قۆناغی ٣ بۆ گۆڕین یان تەلەف
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReturningSale(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
              {returningSale.items.map(it => (
                <div
                  key={it.productId}
                  className="p-3 rounded-2xl bg-[#F5F5F7] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-[#1D1D1F]">{it.productName}</div>
                    <div className="text-[10px] text-[#86868B] tabular-nums">
                      فرۆشراو: {it.weightKg.toFixed(3)} کگم × {it.pricePerKg.toLocaleString()} د.ع
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={it.weightKg}
                    placeholder="0 کگم"
                    value={returnWeights[it.productId] === 0 ? '' : returnWeights[it.productId] || ''}
                    onChange={e =>
                      setReturnWeights(prev => ({
                        ...prev,
                        [it.productId]: e.target.value === '' ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-24 bg-white rounded-xl px-2.5 py-1.5 font-black text-center outline-none border border-black/[0.08] tabular-nums"
                  />
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="هۆکاری گەڕانەوە (ئارەزوومەندانە)..."
              value={returnNotes}
              onChange={e => setReturnNotes(e.target.value)}
              className="apple-input w-full px-3 py-2 text-xs"
            />

            <div className="flex gap-2 pt-2 border-t border-black/[0.06] text-xs">
              <button
                type="button"
                onClick={() => setReturningSale(null)}
                className="w-1/2 py-2.5 bg-[#F5F5F7] text-[#515154] rounded-full font-semibold"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="submit"
                className="w-1/2 py-2.5 bg-[#FF9500] hover:bg-[#E08600] text-white font-bold rounded-full"
              >
                تۆمارکردنی گەڕانەوە
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. Inbound Showroom Delivery Receipt Print Modal */}
      {selectedInboundReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <div className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] no-print">
              <span className="text-xs font-bold text-[#86868B]">وەسڵی وەرگرتنی بار لە شۆرۆم</span>
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
                  onClick={() => setSelectedInboundReceipt(null)}
                  className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-center text-xs">
              <div className="flex justify-center">
                <FactoryLogo size="sm" />
              </div>
              <h4 className="font-black text-sm">{factorySettings.factoryName}</h4>
              <p className="text-[11px] font-bold text-[#0071E3]">
                {factorySettings.showroomName} • وەسڵی وەرگرتنی بار
              </p>

              <div className="border-t border-b border-dashed border-black/20 py-2 space-y-1 text-[11px] text-right">
                <div className="flex justify-between">
                  <span className="text-[#86868B]">ژمارەی وەسڵ:</span>
                  <span className="font-mono font-bold">{selectedInboundReceipt.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868B]">گەیەنەر / مەندوب:</span>
                  <span className="font-bold">{selectedInboundReceipt.repName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#86868B]">بەروار و کات:</span>
                  <span className="tabular-nums">
                    {selectedInboundReceipt.date} {selectedInboundReceipt.time}
                  </span>
                </div>
              </div>

              {selectedInboundReceipt.items && selectedInboundReceipt.items.length > 0 && (
                <div className="space-y-1 text-right text-[11px] border-b border-dashed border-black/20 pb-2">
                  {selectedInboundReceipt.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="font-semibold">{it.productName}</span>
                      <span className="font-black tabular-nums">{it.weightKg.toFixed(2)} کگم</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between text-sm font-black pt-1">
                <span>کۆی کێشی وەرگیراو:</span>
                <span className="text-[#248A3D] tabular-nums">
                  {selectedInboundReceipt.totalWeightKg.toFixed(2)} کگم
                </span>
              </div>

              <p dir="ltr" className="text-[9px] font-bold text-[#86868B] tracking-widest uppercase pt-1">
                Powered by RAND SUITE
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 8. POS Customer Debt Collection Modal */}
      {collectingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h4 className="font-extrabold text-sm text-[#1D1D1F]">وەرگرتنەوەی قەرز لە کاشێر</h4>
                <p className="text-xs text-[#86868B] mt-0.5">
                  {collectingCustomer.name} • قەرزی ئێستا: {collectingCustomer.currentDebt.toLocaleString()} د.ع
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectingCustomer(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const amt = roundTo250(parseFloat(collectAmount) || 0);
                const disc = roundTo250(parseFloat(collectDiscount) || 0);
                if (amt <= 0 && disc <= 0) {
                  showToast('تکایە بڕی پارەی وەرگیراو بنووسە', 'warn');
                  return;
                }
                const maxNo = vouchers.reduce((m, v) => {
                  const n = parseInt(String(v.voucherNo || '').replace(/\D/g, ''), 10);
                  return Number.isFinite(n) && n > m ? n : m;
                }, 0);
                const voucherNo = `POS-V-${String(maxNo + 1).padStart(4, '0')}`;
                const voucherPayload = {
                  voucherNo,
                  date: toLocalISODate(),
                  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  type: 'RECEIPT' as const,
                  partyType: 'CUSTOMER' as const,
                  partyId: collectingCustomer.id,
                  partyName: collectingCustomer.name,
                  amount: amt,
                  discount: disc,
                  paymentMethod: collectMethod,
                  collectedAtPos: true,
                  collectedByCashier: currentUser?.name || 'کاشێری شۆرۆم',
                  notes: collectNotes.trim() || `وەرگیراوە لە کاشێری شۆرۆم (${currentUser?.name || ''})`,
                };
                addVoucher(voucherPayload);
                playPosBeep('success');
                showToast(`بڕی ${amt.toLocaleString()} د.ع لە ${collectingCustomer.name} وەرگیرا`, 'success');
                setPrintDebtVoucher({
                  ...voucherPayload,
                  id: `temp-${Date.now()}`,
                  previousDebt: collectingCustomer.currentDebt,
                  remainingDebt: collectingCustomer.currentDebt - (amt + disc),
                });
                setCollectingCustomer(null);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-[#515154] block mb-1">بڕی پارەی وەرگیراو (د.ع):</label>
                  <input
                    type="number"
                    step="250"
                    min="0"
                    value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                    className="apple-input w-full px-3 py-2 font-black text-sm tabular-nums"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-[#515154] block mb-1">داشکاندن (د.ع):</label>
                  <input
                    type="number"
                    step="250"
                    min="0"
                    value={collectDiscount}
                    onChange={e => setCollectDiscount(e.target.value)}
                    placeholder="0"
                    className="apple-input w-full px-3 py-2 font-bold text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#515154] block mb-1">شێوازی وەرگرتن:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectMethod('CASH')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      collectMethod === 'CASH'
                        ? 'bg-[#34C759]/15 border-[#34C759] text-[#248A3D]'
                        : 'bg-[#F5F5F7] border-transparent text-[#515154]'
                    }`}
                  >
                    نەقد (دەچێتە سەر سەندوق)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMethod('TRANSFER')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      collectMethod === 'TRANSFER'
                        ? 'bg-[#0071E3]/15 border-[#0071E3] text-[#0071E3]'
                        : 'bg-[#F5F5F7] border-transparent text-[#515154]'
                    }`}
                  >
                    گواستنەوە / FIB
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#515154] block mb-1">تێبینی:</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={e => setCollectNotes(e.target.value)}
                  placeholder="تێبینی سەنەد..."
                  className="apple-input w-full px-3 py-2"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#34C759] hover:bg-[#2FB350] text-white font-bold text-sm transition-all"
              >
                پشتڕاستکردنەوە و تۆمارکردن
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 9. Inventory Audit / Spoilage Modal */}
      {stockAdjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h4 className="font-extrabold text-sm text-[#1D1D1F]">جەرد و تەلەفی کۆگای شۆرۆم</h4>
                <p className="text-xs text-[#86868B] mt-0.5">
                  {stockAdjustItem.productName} • کۆگای ئێستا: {stockAdjustItem.inStockKg.toFixed(2)} کگم
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStockAdjustItem(null)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const parsedKg = parseFloat(adjustNewKg);
                if (isNaN(parsedKg) || parsedKg < 0) {
                  showToast('تکایە کێشی ڕاست بنووسە', 'warn');
                  return;
                }
                adjustBranchStock({
                  productId: stockAdjustItem.productId,
                  newWeightKg: parsedKg,
                  reason: adjustReason,
                  note: adjustNote.trim(),
                });
                playPosBeep('success');
                showToast(`کۆگای ${stockAdjustItem.productName} نوێکرایەوە بۆ ${parsedKg.toFixed(2)} کگم`, 'success');
                setStockAdjustItem(null);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustReason('SPOILAGE')}
                  className={`py-2 rounded-xl font-bold border transition-all ${
                    adjustReason === 'SPOILAGE'
                      ? 'bg-[#FF3B30]/12 border-[#FF3B30] text-[#D70015]'
                      : 'bg-[#F5F5F7] border-transparent text-[#515154]'
                  }`}
                >
                  تەلەف / توانەوەی سەهۆڵ
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustReason('AUDIT')}
                  className={`py-2 rounded-xl font-bold border transition-all ${
                    adjustReason === 'AUDIT'
                      ? 'bg-[#0071E3]/12 border-[#0071E3] text-[#0071E3]'
                      : 'bg-[#F5F5F7] border-transparent text-[#515154]'
                  }`}
                >
                  جەردی کۆگا (ڕاستکردنەوە)
                </button>
              </div>

              <div>
                <label className="font-bold text-[#515154] block mb-1">کێشی ڕاستەقینەی ئێستا لە ساردکەرەوە (کگم):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjustNewKg}
                  onChange={e => setAdjustNewKg(e.target.value)}
                  className="apple-input w-full px-3 py-2 font-black text-sm tabular-nums"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-[#515154] block mb-1">هۆکار / تێبینی:</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="بۆ نموونە: تەلەفبوونی ٢ پارچە یان جەردی ئێوارە..."
                  className="apple-input w-full px-3 py-2"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-sm transition-all"
              >
                تۆمارکردنی جەرد / تەلەف
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 11. Quick Add Customer Modal (Name + Phone + Address) */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-[28px] p-6 shadow-2xl border border-black/[0.08] space-y-4 apple-sheet">
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div>
                <h4 className="font-extrabold text-sm text-[#1D1D1F]">زیادکردنی کڕیار / وەرگری نوێ</h4>
                <p className="text-xs text-[#86868B] mt-0.5">ناو و ژمارە مۆبایل تۆمار بکە بۆ قەرز، هەدیە و وەسڵ</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCustomerModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!newCustName.trim()) {
                  showToast('تکایە ناوی کڕیار بنووسە', 'warn');
                  return;
                }
                const created = addCustomer({
                  name: newCustName.trim(),
                  phone: newCustPhone.trim(),
                  type: 'SUPERMARKET',
                  address: newCustAddress.trim() || 'شۆرۆم',
                  currentDebt: 0,
                  creditLimit: 3000000,
                });
                setCustomerNameInput(created.name);
                setCustomerPhoneInput(created.phone || '');
                setSelectedDebtCustomerId(created.id);
                playPosBeep('success');
                showToast(`کڕیار "${newCustName.trim()}" زیادکرا`, 'success');
                setShowNewCustomerModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-[#515154] block mb-1">ناوی تەواو *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="ناوی کڕیار یان شوێن..."
                  className="apple-input w-full px-3 py-2 font-bold"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="font-bold text-[#515154] block mb-1">ژمارەی مۆبایل</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="0750 123 4567"
                  className="apple-input w-full px-3 py-2 font-mono text-right"
                />
              </div>
              <div>
                <label className="font-bold text-[#515154] block mb-1">ناونیشان (ئارەزوومەندانە)</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="گەڕەک / شار..."
                  className="apple-input w-full px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-bold text-sm transition-all"
              >
                پاشەکەوتکردن و هەڵبژاردن
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 12. 80mm Debt Payment Receipt Modal */}
      {printDebtVoucher && (() => {
        const cust = customers.find(c => c.id === printDebtVoucher.partyId);
        const rawPhone = (cust?.phone || '').replace(/\D/g, '');
        const waPhone = rawPhone.startsWith('0') ? `964${rawPhone.slice(1)}` : rawPhone;
        const msg = `سەنەدی وەرگرتنی قەرز (${factorySettings.showroomName || factorySettings.factoryName})\n\nژمارەی سەنەد: ${printDebtVoucher.voucherNo}\nبەروار: ${printDebtVoucher.date} ${printDebtVoucher.time}\nکڕیار: ${printDebtVoucher.partyName}\n\nقەرزی پێشوو: ${printDebtVoucher.previousDebt.toLocaleString()} د.ع\nبڕی وەرگیراو: ${printDebtVoucher.amount.toLocaleString()} د.ع${
          printDebtVoucher.discount > 0 ? `\nداشکاندن: ${printDebtVoucher.discount.toLocaleString()} د.ع` : ''
        }\nقەرزی ماوە: ${printDebtVoucher.remainingDebt.toLocaleString()} د.ع\n\nکاشێر: ${printDebtVoucher.collectedByCashier || currentUser?.name || '---'}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md">
            <div className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl border border-black/[0.08] space-y-4 max-h-[90vh] overflow-y-auto apple-sheet">
              <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] no-print">
                <span className="text-xs font-bold text-[#86868B]">سەنەدی وەرگرتنی قەرز (80mm)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank')}
                    className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full text-xs font-bold flex items-center gap-1"
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
                    onClick={() => setPrintDebtVoucher(null)}
                    className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-center text-xs text-[#1D1D1F]">
                <div className="space-y-1">
                  <div className="flex justify-center">
                    <FactoryLogo size="sm" />
                  </div>
                  <h4 className="font-black text-base">{factorySettings.factoryName}</h4>
                  <p className="text-[11px] font-bold text-[#0071E3]">
                    {factorySettings.showroomName} • سەنەدی وەرگرتنی قەرز
                  </p>
                </div>

                <div className="border-t border-b border-dashed border-black/20 py-2 space-y-1 text-[11px] text-right">
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">ژمارەی سەنەد:</span>
                    <span className="font-mono font-bold">{printDebtVoucher.voucherNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">بەروار و کات:</span>
                    <span>{printDebtVoucher.date} {printDebtVoucher.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">کڕیار:</span>
                    <span className="font-bold">{printDebtVoucher.partyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">کاشێر:</span>
                    <span>{printDebtVoucher.collectedByCashier || currentUser?.name || '---'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-right">
                  <div className="flex justify-between">
                    <span className="text-[#86868B]">قەرزی پێشوو:</span>
                    <span className="font-bold tabular-nums">{printDebtVoucher.previousDebt.toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex justify-between text-[#248A3D]">
                    <span className="font-bold">بڕی وەرگیراو ({printDebtVoucher.paymentMethod === 'CASH' ? 'نەقد' : 'گواستنەوە'}):</span>
                    <span className="font-black tabular-nums">-{printDebtVoucher.amount.toLocaleString()} د.ع</span>
                  </div>
                  {printDebtVoucher.discount > 0 && (
                    <div className="flex justify-between text-[#FF9500]">
                      <span>داشکاندن:</span>
                      <span className="font-bold tabular-nums">-{printDebtVoucher.discount.toLocaleString()} د.ع</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1.5 border-t border-black/15">
                    <span>قەرزی ماوە:</span>
                    <span className={printDebtVoucher.remainingDebt > 0 ? 'text-[#D70015]' : 'text-[#248A3D]'}>
                      {printDebtVoucher.remainingDebt.toLocaleString()} د.ع
                    </span>
                  </div>
                </div>

                <p dir="ltr" className="text-[9px] font-bold text-[#86868B] tracking-widest uppercase pt-1">
                  Powered by RAND SUITE
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default POSView;
