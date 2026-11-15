import {
  ProductItem,
  LiveIntake,
  YieldRecord,
  DispatchOrder,
  ReturnOrder,
  Customer,
  Supplier,
  ExpenseRecord,
  PaymentVoucher,
  POSSale,
  BranchStockItem,
  BranchDelivery,
  BranchExpense,
  CustodyTransfer,
  DailySettlement,
  User,
} from '../types';

export const INITIAL_USERS: User[] = [
  // Manager / Admin
  {
    id: 'user-admin',
    name: 'بەڕێوەبەری کارگە',
    phone: '07701112233',
    role: 'ADMIN',
    roleTitleKu: 'بەڕێوەبەر',
    isSuperAdmin: false,
    avatarEmoji: '👔',
  },
  // Accountant
  {
    id: 'user-accountant',
    name: 'ژمێریاری گشتی',
    phone: '07702223344',
    role: 'ACCOUNTANT',
    roleTitleKu: 'ژمێریار',
    isSuperAdmin: false,
    avatarEmoji: '💼',
  },
  // Sales Rep
  {
    id: 'user-rep',
    name: 'مەندوب شوان',
    phone: '07703334455',
    role: 'REP',
    roleTitleKu: 'مەندوب',
    isSuperAdmin: false,
    avatarEmoji: '🚚',
  },
  // Cashier
  {
    id: 'user-cashier',
    name: 'کاشێری فرۆشگا',
    phone: '07704445566',
    role: 'CASHIER',
    roleTitleKu: 'کاشێری شۆروم',
    isSuperAdmin: false,
    avatarEmoji: '🏪',
  },
];

export const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    code: '101',
    barcodePrefix: '2100101',
    nameKu: 'مریشکی تەواو فرێش (پاكکراو)',
    category: 'WHOLE_CHICKEN',
    pricePerKg: 3500,
    costPerKg: 2750,
    unit: 'KG',
    inStockKg: 0,
  },
  {
    id: 'prod-2',
    code: '102',
    barcodePrefix: '2100102',
    nameKu: 'سنگی مریشکی بێ ئێسک',
    category: 'BREAST',
    pricePerKg: 6500,
    costPerKg: 5100,
    unit: 'KG',
    inStockKg: 0,
  },
  {
    id: 'prod-3',
    code: '103',
    barcodePrefix: '2100103',
    nameKu: 'ڕانی مریشک (تەواو)',
    category: 'THIGH',
    pricePerKg: 4000,
    costPerKg: 3100,
    unit: 'KG',
    inStockKg: 0,
  },
  {
    id: 'prod-4',
    code: '104',
    barcodePrefix: '2100104',
    nameKu: 'باڵی مریشک',
    category: 'WINGS',
    pricePerKg: 4250,
    costPerKg: 3200,
    unit: 'KG',
    inStockKg: 0,
  },
  {
    id: 'prod-5',
    code: '105',
    barcodePrefix: '2100105',
    nameKu: 'جگەر و دڵ و قەسیل',
    category: 'GIBLET',
    pricePerKg: 3000,
    costPerKg: 2000,
    unit: 'KG',
    inStockKg: 0,
  },
  {
    id: 'prod-6',
    code: '106',
    barcodePrefix: '2100106',
    nameKu: 'شلمک و ئێسکی مریشک',
    category: 'BONES_SCRAP',
    pricePerKg: 850,
    costPerKg: 400,
    unit: 'KG',
    inStockKg: 0,
  },
];

export const INITIAL_INTAKES: LiveIntake[] = [];

export const INITIAL_YIELDS: YieldRecord[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'سوپەرمارکێتی بەختەوەری (بەختیاری)',
    phone: '0770 123 4567',
    type: 'SUPERMARKET',
    address: 'سلێمانی - شەقامی بەختیاری',
    currentDebt: 1250000,
    creditLimit: 3000000,
    createdAt: '2026-09-01',
  },
  {
    id: 'cust-2',
    name: 'چێشتخانە و کەبابی سنەوبەر',
    phone: '0750 987 6543',
    type: 'RESTAURANT',
    address: 'هەولێر - شەقامی ١٠٠ مەتری',
    currentDebt: 3420000,
    creditLimit: 5000000,
    createdAt: '2026-08-15',
  },
  {
    id: 'cust-3',
    name: 'مارکێتی چوارچرا',
    phone: '0771 456 7890',
    type: 'SUPERMARKET',
    address: 'سلێمانی - چوارچرا',
    currentDebt: 450000,
    creditLimit: 2000000,
    createdAt: '2026-10-10',
  },
  {
    id: 'cust-4',
    name: 'هۆڵی ئاهەنگەکانی تەلاری شازادە',
    phone: '0750 111 2233',
    type: 'HOTEL',
    address: 'سلێمانی - ڕێگای تاسڵوجە',
    currentDebt: 0,
    creditLimit: 4000000,
    createdAt: '2026-07-01',
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'supp-1',
    name: 'کێڵگەی پەلەوەری حاجی کەمال',
    phone: '0770 555 4433',
    farmLocation: 'ناوچەی شارەزوور - گوندی تەپەڕەش',
    currentBalance: 7562500,
    createdAt: '2026-06-01',
  },
  {
    id: 'supp-2',
    name: 'کێڵگەی شەمامک (کاک هێمن)',
    phone: '0750 444 3322',
    farmLocation: 'دەشتی هەولێر - شەمامک',
    currentBalance: 1200000,
    createdAt: '2026-05-10',
  },
];

export const INITIAL_DISPATCHES: DispatchOrder[] = [];

export const INITIAL_RETURNS: ReturnOrder[] = [];

export const INITIAL_EXPENSES: ExpenseRecord[] = [
  {
    id: 'exp-1',
    date: '2026-11-04',
    category: 'ICE',
    title: 'کڕینی ١٢ قالبی سەهۆڵ بۆ سەربڕخانە',
    amount: 60000,
    recipient: 'کارگەی سەهۆڵی کۆسار',
    receiptNo: 'ICE-98',
  },
];

// Realistic vouchers with previousDebt, paid, discount, remainingDebt, and time!
export const INITIAL_VOUCHERS: PaymentVoucher[] = [
  {
    id: 'vouch-1',
    voucherNo: 'REC-8862',
    date: '2026-11-05',
    time: '09:45 ص',
    type: 'RECEIPT',
    partyType: 'CUSTOMER',
    partyId: 'cust-1',
    partyName: 'سوپەرمارکێتی بەختەوەری (بەختیاری)',
    previousDebt: 1750000,
    amount: 500000,
    discount: 0,
    remainingDebt: 1250000,
    paymentMethod: 'CASH',
    notes: 'دانەوەی بەشێک لە قەرز لە ڕێگەی مەندوب شوان',
  },
  {
    id: 'vouch-2',
    voucherNo: 'REC-1044',
    date: '2026-11-04',
    time: '11:20 ب.ن',
    type: 'RECEIPT',
    partyType: 'CUSTOMER',
    partyId: 'cust-1',
    partyName: 'سوپەرمارکێتی بەختەوەری (بەختیاری)',
    previousDebt: 2525000,
    amount: 750000,
    discount: 25000,
    remainingDebt: 1750000,
    paymentMethod: 'CASH',
    notes: 'بەشە پارەی وەسڵەکانی هەفتەی ڕابردوو',
  },
  {
    id: 'vouch-3',
    voucherNo: 'PAY-501',
    date: '2026-11-03',
    time: '04:15 پ.ن',
    type: 'PAYMENT',
    partyType: 'SUPPLIER',
    partyId: 'supp-1',
    partyName: 'کێڵگەی پەلەوەری حاجی کەمال',
    previousDebt: 9562500,
    amount: 2000000,
    discount: 0,
    remainingDebt: 7562500,
    paymentMethod: 'TRANSFER',
    notes: 'پێشەکی بۆ وەجبەی مریشکی هاتوو لە ڕێگەی حەواڵە',
  },
];

export const INITIAL_POS_SALES: POSSale[] = [];

// ==========================================
// DEDICATED STORE (BRANCH) INITIAL SEED DATA
// ==========================================
export const INITIAL_BRANCH_STOCK: BranchStockItem[] = [
  {
    productId: 'prod-1',
    productName: 'مریشکی تەواو فرێش (پاكکراو)',
    code: '101',
    barcode: '2100101',
    inStockKg: 0,
    minAlertKg: 30,
    retailPricePerKg: 3500,
    factoryCostPerKg: 2900,
    category: 'WHOLE_CHICKEN',
    unit: 'KG',
  },
  {
    productId: 'prod-2',
    productName: 'سنگی مریشکی بێ ئێسک',
    code: '102',
    barcode: '2100102',
    inStockKg: 0,
    minAlertKg: 15,
    retailPricePerKg: 6500,
    factoryCostPerKg: 5500,
    category: 'BREAST',
    unit: 'KG',
  },
  {
    productId: 'prod-3',
    productName: 'ڕانی مریشک (تەواو)',
    code: '103',
    barcode: '2100103',
    inStockKg: 0,
    minAlertKg: 20,
    retailPricePerKg: 4200,
    factoryCostPerKg: 3400,
    category: 'THIGH',
    unit: 'KG',
  },
  {
    productId: 'prod-4',
    productName: 'باڵ و گەردەنی مریشک',
    code: '104',
    barcode: '2100104',
    inStockKg: 0,
    minAlertKg: 10,
    retailPricePerKg: 3800,
    factoryCostPerKg: 3000,
    category: 'WINGS',
    unit: 'KG',
  },
  {
    productId: 'prod-5',
    productName: 'جگەر و دڵ و قەسیل',
    code: '105',
    barcode: '2100105',
    inStockKg: 0,
    minAlertKg: 8,
    retailPricePerKg: 3000,
    factoryCostPerKg: 2000,
    category: 'GIBLET',
    unit: 'KG',
  },
  {
    productId: 'prod-6',
    productName: 'شلمک و ئێسکی مریشک',
    code: '106',
    barcode: '2100106',
    inStockKg: 0,
    minAlertKg: 15,
    retailPricePerKg: 850,
    factoryCostPerKg: 400,
    category: 'BONES_SCRAP',
    unit: 'KG',
  },
];

export const INITIAL_BRANCH_DELIVERIES: BranchDelivery[] = [];

export const INITIAL_BRANCH_EXPENSES: BranchExpense[] = [];

export const INITIAL_CUSTODY_TRANSFERS: CustodyTransfer[] = [];

export const INITIAL_DAILY_SETTLEMENTS: DailySettlement[] = [
  {
    id: 'set-1',
    settlementNo: 'SET-1001',
    date: '2026-11-04',
    settledAtDate: '2026-11-04',
    settledAtTime: '08:30 پ.ن',
    accountType: 'BRANCH',
    accountName: 'فرۆشگای تایبەت (POS / شۆرۆم)',
    totalWeightKg: 3.35,
    totalSalesAmount: 15000,
    cashSalesAmount: 15000,
    creditSalesAmount: 0,
    cardSalesAmount: 0,
    returnsAmount: 0,
    expensesAmount: 0,
    collectedDebtAmount: 0,
    expectedCashAmount: 15000,
    returnedCashAmount: 15000,
    returnedCardAmount: 0,
    varianceAmount: 0,
    status: 'MATCHED',
    settledBy: 'ئەدمین',
    notes: 'تەسفییەی تەواوی سندووقی شۆرۆم بۆ ڕۆژی 2026-11-04',
  },
];
