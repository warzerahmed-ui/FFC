import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ProductItem,
  ProductCategory,
  LiveIntake,
  Customer,
  Supplier,
  DispatchOrder,
  ReturnOrder,
  ExpenseRecord,
  PaymentVoucher,
  POSSale,
  BranchStockItem,
  BranchDelivery,
  BranchDeliveryItem,
  BranchExpense,
  CustodyTransfer,
  DailySettlement,
  User,
  FactorySettings,
  TrashEntityType,
  SoftDeletedItem,
  ActivityCategory,
  ActivityActionType,
  ActivityLogEntry,
  UserRole,
} from '../types';
import { toLocalISODate } from '../utils/date';

// Collision-resistant record IDs (safe across multiple devices syncing to D1)
const genId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const normalizeName = (s: string | undefined | null): string =>
  (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const ALL_SYSTEM_SECTIONS: { id: string; label: string; groupLabel: string }[] = [
  { id: 'dashboard', label: 'داشبۆردی سەرەکی', groupLabel: 'سەرەکی' },
  { id: 'intake', label: '١. کۆگای وەرگرتن', groupLabel: 'کارگە' },
  { id: 'ready-for-sale', label: '٢. کۆگای ئامادە', groupLabel: 'کارگە' },
  { id: 'custody', label: '٣. کۆگای مەندوب', groupLabel: 'کارگە' },
  { id: 'rep-sales', label: '٤. فرۆشتنی مەندوب و گەڕاوە', groupLabel: 'کارگە' },
  { id: 'gifts', label: '٥. دیاری و هەدیە', groupLabel: 'کارگە' },
  { id: 'pos', label: 'شۆرۆم (POS)', groupLabel: 'شۆرۆم' },
  { id: 'accounting', label: 'کەشف حساب و دانەوەی قەرز', groupLabel: 'ژمێریاری' },
  { id: 'reports', label: 'خەرجی، قازانج و تەسفییە', groupLabel: 'ژمێریاری' },
  { id: 'settings', label: 'سیتینی کارگە و ئەکاونتەکان', groupLabel: 'بەڕێوەبردن' },
];

export const getDefaultTabsForRole = (role: UserRole): string[] => {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return ALL_SYSTEM_SECTIONS.map(s => s.id);
    case 'WAREHOUSE_MANAGER':
      return ['dashboard', 'intake', 'ready-for-sale', 'custody', 'gifts'];
    case 'ACCOUNTANT':
      return ['dashboard', 'accounting', 'reports'];
    case 'REP':
      return ['dashboard', 'custody', 'rep-sales', 'gifts'];
    case 'CASHIER':
      return ['dashboard', 'pos'];
    default:
      return ['dashboard'];
  }
};

interface AppContextType {
  products: ProductItem[];
  intakes: LiveIntake[];
  customers: Customer[];
  suppliers: Supplier[];
  dispatches: DispatchOrder[];
  returns: ReturnOrder[];
  expenses: ExpenseRecord[];
  vouchers: PaymentVoucher[];
  posSales: POSSale[];

  // Dedicated Store (Branch) states
  branchStock: BranchStockItem[];
  branchDeliveries: BranchDelivery[];
  branchExpenses: BranchExpense[];

  // Rep & Branch Custody Transfers
  custodyTransfers: CustodyTransfer[];

  // Daily Rep & Showroom Financial Settlements
  settlements: DailySettlement[];

  // Authentication & Users
  currentUser: User;
  users: User[];
  login: (phone: string, pass: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasAccess: (tab: string) => boolean;
  isAuthenticated: boolean;
  isHydratedFromCloud: boolean;

  // Actions
  addIntake: (intake: Omit<LiveIntake, 'id' | 'processedLiveWeightKg' | 'remainingLiveWeightKg'>) => void;
  addDispatch: (dispatch: Omit<DispatchOrder, 'id'>) => void;
  addReturn: (returnOrder: Omit<ReturnOrder, 'id'>) => void;
  convertReturnOrder: (
    returnId: string,
    outputs: { productId: string; productName: string; weightKg: number }[],
    notes?: string
  ) => void;
  addExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  addVoucher: (voucher: Omit<PaymentVoucher, 'id' | 'previousDebt' | 'remainingDebt'>) => void;
  addPOSSale: (sale: Omit<POSSale, 'id' | 'saleNo'>) => POSSale;
  addProduct: (product: {
    nameKu: string;
    pricePerKg: number;
    costPerKg?: number;
    category?: ProductCategory;
    unit?: 'KG' | 'PIECE';
    initialStockKg?: number;
    barcodePrefix?: string;
  }) => ProductItem;
  updateProduct: (product: ProductItem) => void;
  deleteProduct: (id: string) => { ok: boolean; error?: string };
  addReadyStock: (productId: string, weightKg: number, note?: string) => void;
  updateProductPrice: (id: string, newPrice: number, newCost: number, minAlertKg?: number) => void;
  transferReadyToBranch: (payload: {
    items: { productId: string; weightKg: number }[];
    repName?: string;
    manualReceiptNo?: string;
    notes?: string;
  }) => BranchDelivery | null;
  acceptBranchDelivery: (deliveryId: string) => { ok: boolean; error?: string };
  rejectBranchDelivery: (deliveryId: string, reason?: string) => void;
  
  // Dedicated Store Actions
  addBranchDelivery: (delivery: Omit<BranchDelivery, 'id'>) => void;
  addBranchExpense: (expense: Omit<BranchExpense, 'id'>) => void;
  updateBranchStockItem: (productId: string, updates: Partial<BranchStockItem>) => void;
  adjustBranchStock: (payload: {
    productId: string;
    newWeightKg: number;
    reason: 'AUDIT' | 'SPOILAGE';
    note?: string;
  }) => void;
  returnBranchToReady: (payload: {
    items: { productId: string; weightKg: number }[];
    note?: string;
  }) => boolean;

  // Custody Actions (Rep & Branch Stock Reconciliation)
  loadToRepCustody: (transfer: Omit<CustodyTransfer, 'id' | 'direction'>) => void;
  returnUnsoldToReadyStock: (transfer: Omit<CustodyTransfer, 'id' | 'direction'>) => void;
  acceptCustodyTransfer: (transferId: string) => void;
  rejectCustodyTransfer: (transferId: string, reason?: string) => void;

  // Daily Settlement Action
  addDailySettlement: (settlement: Omit<DailySettlement, 'id'>) => DailySettlement;

  // Factory Settings, Account Management, Soft Delete & Activity Log
  factorySettings: FactorySettings;
  updateFactorySettings: (updates: Partial<FactorySettings>) => void;
  addUser: (userData: Omit<User, 'id'>) => { ok: boolean; error?: string; user?: User };
  updateUser: (
    userId: string,
    updates: Partial<Omit<User, 'id' | 'isSuperAdmin'>>
  ) => { ok: boolean; error?: string };
  trashItems: SoftDeletedItem[];
  softDeleteRecord: (entityType: TrashEntityType, entityId: string, reason?: string) => boolean;
  restoreTrashItem: (trashId: string) => boolean;
  permanentlyDeleteTrashItem: (trashId: string) => void;
  emptyTrash: () => void;
  activityLogs: ActivityLogEntry[];
  clearActivityLogs: () => void;

  // Rep list (from Settings REP users + historical dispatches/custody/settlements)
  repNames: string[];

  // Barcode decoding utility
  parseWeightBarcode: (barcodeStr: string) => { product?: ProductItem; branchItem?: BranchStockItem; weightKg: number; embeddedPrice?: number; valid: boolean };

  // Full System Backup & Restore & Clean Start
  exportSystemBackup: () => string;
  importSystemBackup: (jsonStr: string) => { ok: boolean; error?: string; stats?: string };
  resetToCleanStart: (options?: { clearParties?: boolean }) => void;
  changeOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;

  // Cloudflare D1 Cloud Sync
  cloudSyncStatus: 'SYNCING' | 'SYNCED' | 'LOCAL_ONLY' | 'ERROR';
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TOKEN_KEY = 'ffc_session_token_v1';
const getToken = () => localStorage.getItem(TOKEN_KEY) || '';

const UNAUTHENTICATED_USER: User = {
  id: '',
  name: '',
  phone: '',
  role: 'CASHIER',
  roleTitleKu: '',
  isSuperAdmin: false,
};

const STORAGE_KEYS = {
  PRODUCTS: 'fresh_chicken_products_v4',
  INTAKES: 'fresh_chicken_intakes_v4',
  CUSTOMERS: 'fresh_chicken_customers_v4',
  SUPPLIERS: 'fresh_chicken_suppliers_v4',
  DISPATCHES: 'fresh_chicken_dispatches_v4',
  RETURNS: 'fresh_chicken_returns_v4',
  EXPENSES: 'fresh_chicken_expenses_v4',
  VOUCHERS: 'fresh_chicken_vouchers_v4',
  POS_SALES: 'fresh_chicken_pos_sales_v4',
  BRANCH_STOCK: 'fresh_chicken_branch_stock_v4',
  BRANCH_DELIVERIES: 'fresh_chicken_branch_deliveries_v4',
  BRANCH_EXPENSES: 'fresh_chicken_branch_expenses_v4',
  CUSTODY_TRANSFERS: 'fresh_chicken_custody_v4',
  DAILY_SETTLEMENTS: 'fresh_chicken_settlements_v4',
  USERS: 'fresh_chicken_users_v4',
  CURRENT_USER: 'fresh_chicken_current_user_v4',
  FACTORY_SETTINGS: 'fresh_chicken_settings_v4',
  TRASH_ITEMS: 'fresh_chicken_trash_v4',
  ACTIVITY_LOGS: 'fresh_chicken_activity_logs_v4',
};

const purgeBrowserStorage = () => {
  try {
    localStorage.removeItem('fresh_chicken_auth_v4');
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
};

const DEFAULT_FACTORY_SETTINGS: FactorySettings = {
  factoryName: 'فروج فریش چیکن',
  shortCode: 'FFC-ERP',
  tagline: 'سیستەمی بەڕێوەبردنی کارگە، مەندوب، شۆرۆم و ژمێریاری',
  showroomName: 'فرۆشگای تایبەت (شۆرۆم POS)',
  phone1: '0770 111 2233',
  phone2: '0750 111 2233',
  address: 'کوردستان - ناوچەی پیشەسازی',
  licenseNo: 'FFC-2026-IQ',
  currency: 'د.ع',
  returnWindowDays: 3,
  receiptFooter: 'سوپاس بۆ متمانەتان • مریشکی فرێش هەمیشە تەندروست و پاکژە',
  orderWhatsapp: '0770 111 2233',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [intakes, setIntakes] = useState<LiveIntake[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dispatches, setDispatches] = useState<DispatchOrder[]>([]);
  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [posSales, setPosSales] = useState<POSSale[]>([]);
  const [branchStock, setBranchStock] = useState<BranchStockItem[]>([]);
  const [branchDeliveries, setBranchDeliveries] = useState<BranchDelivery[]>([]);
  const [branchExpenses, setBranchExpenses] = useState<BranchExpense[]>([]);
  const [custodyTransfers, setCustodyTransfers] = useState<CustodyTransfer[]>([]);
  const [settlements, setSettlements] = useState<DailySettlement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [factorySettings, setFactorySettings] = useState<FactorySettings>(DEFAULT_FACTORY_SETTINGS);
  const [trashItems, setTrashItems] = useState<SoftDeletedItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(UNAUTHENTICATED_USER);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => Boolean(localStorage.getItem(TOKEN_KEY))
  );
  const [isHydratedFromCloud, setIsHydratedFromCloud] = useState<boolean>(false);

  // Never keep business data cached in localStorage on disk
  useEffect(() => {
    purgeBrowserStorage();
  }, []);

  useEffect(() => {
    document.title = `${factorySettings.factoryName} | ${factorySettings.shortCode}`;
  }, [factorySettings.factoryName, factorySettings.shortCode]);

  // ==========================================
  // CLOUDFLARE D1 CLOUD SYNC ENGINE
  // ==========================================
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'SYNCING' | 'SYNCED' | 'LOCAL_ONLY' | 'ERROR'>('SYNCING');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isHydratedFromCloudRef = useRef(false);
  const skipNextPushRef = useRef(false);
  const lastServerUpdatedAtRef = useRef<string | null>(null);
  const keyVersionsRef = useRef<Record<string, string>>({});
  const lastSyncedJsonByKeyRef = useRef<Record<string, string>>({});
  const pushTimerRef = useRef<number | null>(null);

  const clearMemoryState = useCallback(() => {
    if (pushTimerRef.current !== null) {
      window.clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    setProducts([]);
    setIntakes([]);
    setCustomers([]);
    setSuppliers([]);
    setDispatches([]);
    setReturns([]);
    setExpenses([]);
    setVouchers([]);
    setPosSales([]);
    setBranchStock([]);
    setBranchDeliveries([]);
    setBranchExpenses([]);
    setCustodyTransfers([]);
    setSettlements([]);
    setUsers([]);
    setFactorySettings(DEFAULT_FACTORY_SETTINGS);
    setTrashItems([]);
    setActivityLogs([]);
    setCurrentUser(UNAUTHENTICATED_USER);
    setIsHydratedFromCloud(false);
    isHydratedFromCloudRef.current = false;
    lastServerUpdatedAtRef.current = null;
    keyVersionsRef.current = {};
    lastSyncedJsonByKeyRef.current = {};
  }, []);

  const buildSnapshot = useCallback(
    () => ({
      products,
      intakes,
      customers,
      suppliers,
      dispatches,
      returns,
      expenses,
      vouchers,
      posSales,
      branchStock,
      branchDeliveries,
      branchExpenses,
      custodyTransfers,
      settlements,
      users,
      factorySettings,
      trashItems,
      activityLogs,
    }),
    [
      products,
      intakes,
      customers,
      suppliers,
      dispatches,
      returns,
      expenses,
      vouchers,
      posSales,
      branchStock,
      branchDeliveries,
      branchExpenses,
      custodyTransfers,
      settlements,
      users,
      factorySettings,
      trashItems,
      activityLogs,
    ]
  );

  const applyCloudState = useCallback(
    (d: Record<string, unknown>, incomingVersions?: Record<string, string>) => {
      skipNextPushRef.current = true;
      const recordKey = (key: string, val: unknown) => {
        try {
          lastSyncedJsonByKeyRef.current[key] = JSON.stringify(val);
        } catch {
          // ignore
        }
      };

      if (Array.isArray(d.products)) {
        setProducts(d.products as ProductItem[]);
        recordKey('products', d.products);
      }
      if (Array.isArray(d.intakes)) {
        setIntakes(d.intakes as LiveIntake[]);
        recordKey('intakes', d.intakes);
      }
      if (Array.isArray(d.customers)) {
        setCustomers(d.customers as Customer[]);
        recordKey('customers', d.customers);
      }
      if (Array.isArray(d.suppliers)) {
        setSuppliers(d.suppliers as Supplier[]);
        recordKey('suppliers', d.suppliers);
      }
      if (Array.isArray(d.dispatches)) {
        setDispatches(d.dispatches as DispatchOrder[]);
        recordKey('dispatches', d.dispatches);
      }
      if (Array.isArray(d.returns)) {
        setReturns(d.returns as ReturnOrder[]);
        recordKey('returns', d.returns);
      }
      if (Array.isArray(d.expenses)) {
        setExpenses(d.expenses as ExpenseRecord[]);
        recordKey('expenses', d.expenses);
      }
      if (Array.isArray(d.vouchers)) {
        setVouchers(d.vouchers as PaymentVoucher[]);
        recordKey('vouchers', d.vouchers);
      }
      if (Array.isArray(d.posSales)) {
        setPosSales(d.posSales as POSSale[]);
        recordKey('posSales', d.posSales);
      }
      if (Array.isArray(d.branchStock)) {
        setBranchStock(d.branchStock as BranchStockItem[]);
        recordKey('branchStock', d.branchStock);
      }
      if (Array.isArray(d.branchDeliveries)) {
        setBranchDeliveries(d.branchDeliveries as BranchDelivery[]);
        recordKey('branchDeliveries', d.branchDeliveries);
      }
      if (Array.isArray(d.branchExpenses)) {
        setBranchExpenses(d.branchExpenses as BranchExpense[]);
        recordKey('branchExpenses', d.branchExpenses);
      }
      if (Array.isArray(d.custodyTransfers)) {
        setCustodyTransfers(d.custodyTransfers as CustodyTransfer[]);
        recordKey('custodyTransfers', d.custodyTransfers);
      }
      if (Array.isArray(d.settlements)) {
        setSettlements(d.settlements as DailySettlement[]);
        recordKey('settlements', d.settlements);
      }
      if (Array.isArray(d.users)) {
        const nextUsers = d.users as User[];
        setUsers(nextUsers);
        recordKey('users', nextUsers);
        setCurrentUser(prev => {
          if (prev.isSuperAdmin || prev.role === 'SUPER_ADMIN') return prev;
          const refreshed = nextUsers.find(u => u.id === prev.id);
          return refreshed ? { ...prev, ...refreshed } : prev;
        });
      }
      if (d.factorySettings && typeof d.factorySettings === 'object') {
        setFactorySettings(prev => {
          const merged = { ...prev, ...(d.factorySettings as Partial<FactorySettings>) };
          recordKey('factorySettings', merged);
          return merged;
        });
      }
      if (Array.isArray(d.trashItems)) {
        setTrashItems(d.trashItems as SoftDeletedItem[]);
        recordKey('trashItems', d.trashItems);
      }
      if (Array.isArray(d.activityLogs)) {
        setActivityLogs(d.activityLogs as ActivityLogEntry[]);
        recordKey('activityLogs', d.activityLogs);
      }
      if (incomingVersions) {
        keyVersionsRef.current = { ...keyVersionsRef.current, ...incomingVersions };
      }
    },
    []
  );

  const pushStateToD1 = useCallback(
    async (snapshot: Record<string, unknown>, forceFull = false) => {
      const delta: Record<string, unknown> = {};
      const baseVersions: Record<string, string> = {};
      const serializedByKey: Record<string, string> = {};

      for (const [key, val] of Object.entries(snapshot)) {
        if (val === undefined) continue;
        const json = JSON.stringify(val);
        serializedByKey[key] = json;
        if (forceFull || lastSyncedJsonByKeyRef.current[key] !== json) {
          delta[key] = val;
          if (keyVersionsRef.current[key]) {
            baseVersions[key] = keyVersionsRef.current[key];
          }
        }
      }

      if (Object.keys(delta).length === 0) {
        setCloudSyncStatus('SYNCED');
        return;
      }

      try {
        setCloudSyncStatus('SYNCING');
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ state: delta, baseVersions }),
        });
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          purgeBrowserStorage();
          clearMemoryState();
          setIsAuthenticated(false);
          return;
        }
        if (!res.ok) {
          setCloudSyncStatus(res.status === 503 || res.status === 404 ? 'LOCAL_ONLY' : 'ERROR');
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          serverUpdatedAt?: string;
          keyVersions?: Record<string, string>;
          conflicts?: string[];
          conflictState?: Record<string, unknown>;
        };
        if (data.ok) {
          if (data.keyVersions) {
            keyVersionsRef.current = { ...keyVersionsRef.current, ...data.keyVersions };
          }
          const conflictSet = new Set(data.conflicts || []);
          for (const key of Object.keys(delta)) {
            if (!conflictSet.has(key)) {
              lastSyncedJsonByKeyRef.current[key] = serializedByKey[key];
            }
          }
          if (conflictSet.size > 0 && data.conflictState) {
            applyCloudState(data.conflictState, data.keyVersions);
          }
          lastServerUpdatedAtRef.current = data.serverUpdatedAt || new Date().toISOString();
          setLastSyncedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
          setCloudSyncStatus('SYNCED');
        } else {
          setCloudSyncStatus('ERROR');
        }
      } catch {
        setCloudSyncStatus('LOCAL_ONLY');
      }
    },
    [applyCloudState, clearMemoryState]
  );

  const buildSnapshotRef = useRef(buildSnapshot);
  useEffect(() => {
    buildSnapshotRef.current = buildSnapshot;
  }, [buildSnapshot]);

  const pullStateFromD1 = useCallback(
    async (initializeIfEmpty = false) => {
      try {
        const res = await fetch('/api/sync', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          purgeBrowserStorage();
          clearMemoryState();
          setIsAuthenticated(false);
          return;
        }
        if (!res.ok) {
          if (!isHydratedFromCloudRef.current) {
            localStorage.removeItem(TOKEN_KEY);
            purgeBrowserStorage();
            clearMemoryState();
            setIsAuthenticated(false);
          } else {
            setCloudSyncStatus(res.status === 503 || res.status === 404 ? 'LOCAL_ONLY' : 'ERROR');
          }
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          empty?: boolean;
          serverUpdatedAt?: string | null;
          keyVersions?: Record<string, string>;
          callerUser?: User;
          state?: Record<string, unknown>;
        };
        if (!data.ok) {
          if (!isHydratedFromCloudRef.current) {
            localStorage.removeItem(TOKEN_KEY);
            purgeBrowserStorage();
            clearMemoryState();
            setIsAuthenticated(false);
          } else {
            setCloudSyncStatus('ERROR');
          }
          return;
        }
        if (data.callerUser && typeof data.callerUser === 'object') {
          skipNextPushRef.current = true;
          setCurrentUser(data.callerUser);
        }
        if (data.empty) {
          if (initializeIfEmpty) {
            await pushStateToD1(buildSnapshotRef.current(), true);
          }
          isHydratedFromCloudRef.current = true;
          setIsHydratedFromCloud(true);
          return;
        }
        if (data.state && (!isHydratedFromCloudRef.current || data.serverUpdatedAt !== lastServerUpdatedAtRef.current)) {
          applyCloudState(data.state, data.keyVersions);
          lastServerUpdatedAtRef.current = data.serverUpdatedAt || null;
        }
        isHydratedFromCloudRef.current = true;
        setIsHydratedFromCloud(true);
        setLastSyncedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        setCloudSyncStatus('SYNCED');
      } catch {
        if (!isHydratedFromCloudRef.current) {
          localStorage.removeItem(TOKEN_KEY);
          purgeBrowserStorage();
          clearMemoryState();
          setIsAuthenticated(false);
        } else {
          setCloudSyncStatus('LOCAL_ONLY');
        }
      }
    },
    [applyCloudState, clearMemoryState, pushStateToD1]
  );

  // Initial D1 hydration + 20s background pull from other devices
  useEffect(() => {
    if (!isAuthenticated) {
      clearMemoryState();
      purgeBrowserStorage();
      return;
    }
    let active = true;
    (async () => {
      await pullStateFromD1(true);
      if (!active) return;
    })();

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && pushTimerRef.current === null) {
        pullStateFromD1(false);
      }
    }, 20000);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
    };
  }, [pullStateFromD1, isAuthenticated, clearMemoryState]);

  // Debounced auto-save to Cloudflare D1 whenever local state changes
  const snapshotObj = useMemo(() => buildSnapshot(), [buildSnapshot]);
  useEffect(() => {
    if (!isHydratedFromCloudRef.current) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }
    if (pushTimerRef.current !== null) {
      window.clearTimeout(pushTimerRef.current);
    }
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      pushStateToD1(snapshotObj);
    }, 600);

    return () => {
      if (pushTimerRef.current !== null) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [snapshotObj, pushStateToD1]);

  const syncNow = useCallback(async () => {
    if (!isHydratedFromCloudRef.current) return;
    await pushStateToD1(buildSnapshot());
  }, [pushStateToD1, buildSnapshot]);

  const recordActivity = (
    category: ActivityCategory,
    action: ActivityActionType,
    title: string,
    details: string,
    refNo?: string,
    actorOverride?: User
  ) => {
    const actor = actorOverride || currentUser;
    const now = new Date();
    const isHiddenSuper = actor?.isSuperAdmin || actor?.role === 'SUPER_ADMIN';
    const entry: ActivityLogEntry = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      date: toLocalISODate(now),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      userId: actor?.id || 'system',
      userName: isHiddenSuper ? 'بەڕێوەبەری کارگە' : actor?.name || 'بەکارهێنەر',
      userRoleTitle: isHiddenSuper ? 'بەڕێوەبەر' : actor?.roleTitleKu || '',
      category,
      action,
      title,
      details,
      refNo,
    };
    setActivityLogs(prev => [entry, ...prev].slice(0, 500));
  };

  const hasAccess = (tab: string): boolean => {
    if (!isAuthenticated || !currentUser || !currentUser.id) return false;
    if (currentUser.isSuperAdmin || currentUser.role === 'SUPER_ADMIN') {
      return true;
    }
    const normalizedTab = tab === 'dispatch' || tab === 'returns' ? 'rep-sales' : tab;
    if (Array.isArray(currentUser.allowedTabs)) {
      return currentUser.allowedTabs.includes(normalizedTab);
    }
    return getDefaultTabsForRole(currentUser.role).includes(normalizedTab);
  };

  const login = async (phone: string, pass: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: pass }),
      });
      if (res.status === 429) {
        return { ok: false, error: 'هەوڵی زۆر درا، تکایە دوای چەند خولەکێک دووبارە هەوڵبدەرەوە' };
      }
      if (res.status === 503) {
        return { ok: false, error: 'سێرڤەر ڕێکنەخراوە، پەیوەندی بە بەڕێوەبەرەوە بکە' };
      }
      if (!res.ok) {
        return { ok: false, error: 'ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە' };
      }
      const data = (await res.json()) as { ok?: boolean; token?: string; user?: User };
      if (!data.ok || !data.token || !data.user) {
        return { ok: false, error: 'ژمارەی مۆبایل یان وشەی نهێنی هەڵەیە' };
      }
      const serverUser = data.user;
      localStorage.setItem(TOKEN_KEY, data.token);
      setCurrentUser(serverUser);
      setIsAuthenticated(true);
      recordActivity(
        'AUTH',
        'LOGIN',
        'چوونەژوورەوە بۆ سیستەم',
        serverUser.isSuperAdmin
          ? 'چوونەژوورەوەی بەڕێوەبەر'
          : `ئەکاونتی ${serverUser.name} (${serverUser.roleTitleKu}) چووە ژوورەوە`,
        undefined,
        serverUser
      );
      return { ok: true };
    } catch {
      return { ok: false, error: 'پەیوەندی بە سێرڤەرەوە نییە، ئینتەرنێتەکەت بپشکنە' };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    purgeBrowserStorage();
    clearMemoryState();
    setIsAuthenticated(false);
  };

  const changeOwnPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 401) {
        return { ok: false, error: 'وشەی نهێنی ئێستا هەڵەیە' };
      }
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'هەڵە لە نوێکردنەوەی وشەی نهێنی' };
      }
      recordActivity('AUTH', 'UPDATE', 'گۆڕینی وشەی نهێنی', `${currentUser.name} وشەی نهێنییەکەی گۆڕی`);
      return { ok: true };
    } catch {
      return { ok: false, error: 'پەیوەندی بە سێرڤەرەوە نییە' };
    }
  };

  const parseWeightBarcode = (barcodeStr: string) => {
    const clean = barcodeStr.trim();
    if (!clean) return { product: undefined, branchItem: undefined, weightKg: 0, embeddedPrice: undefined, valid: false };

    // Extended scale barcode with BOTH weight and embedded price (17-22 digits, starts with 20, 21, 22, 23, 24, 28)
    // Format: PP(2) + CCCCC(5) + WWWWW(5 grams) + PRICE(5-9 IQD) + CHECK(1)
    if (clean.length >= 17 && clean.length <= 22 && /^(20|21|22|23|24|28)/.test(clean)) {
      const prodCode = clean.substring(2, 7);
      const weightGrams = parseInt(clean.substring(7, 12), 10);
      const priceDigits = clean.substring(12, clean.length - 1);
      const parsedPrice = parseInt(priceDigits, 10);

      const product = products.find(p =>
        clean.startsWith(p.barcodePrefix) ||
        p.code === prodCode ||
        prodCode.endsWith(p.code)
      );
      const branchItem = product ? branchStock.find(b => b.productId === product.id) : undefined;
      const weightKg = isNaN(weightGrams) || weightGrams <= 0 ? 1 : Math.round((weightGrams / 1000) * 1000) / 1000;
      const embeddedPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined;
      return { product, branchItem, weightKg, embeddedPrice, valid: !!(product || branchItem) };
    }

    // Standard 13-digit scale barcode (starts with 20, 21, 22, 23, 24, 28)
    if (clean.length === 13 && /^(20|21|22|23|24|28)/.test(clean)) {
      const prodCode = clean.substring(2, 7); // e.g. 00101
      const weightGrams = parseInt(clean.substring(7, 12), 10);
      
      const product = products.find(p => 
        clean.startsWith(p.barcodePrefix) || 
        p.code === prodCode || 
        prodCode.endsWith(p.code)
      );
      const branchItem = product ? branchStock.find(b => b.productId === product.id) : undefined;
      const weightKg = isNaN(weightGrams) ? 1 : Math.round((weightGrams / 1000) * 1000) / 1000;
      return { product, branchItem, weightKg, embeddedPrice: undefined, valid: !!(product || branchItem) };
    }

    // Direct barcode or code match
    const product = products.find(p => 
      p.code === clean || 
      p.id === clean || 
      p.barcodePrefix === clean ||
      clean.startsWith(p.barcodePrefix)
    );
    const branchItem = product 
      ? branchStock.find(b => b.productId === product.id) 
      : branchStock.find(b => b.barcode === clean || b.code === clean || b.productId === clean || (b.barcode && clean.startsWith(b.barcode)));

    const resolvedProduct = product || (branchItem ? products.find(p => p.id === branchItem.productId) : undefined);

    if (resolvedProduct || branchItem) {
      return { product: resolvedProduct, branchItem, weightKg: 1, embeddedPrice: undefined, valid: true };
    }

    return { product: undefined, branchItem: undefined, weightKg: 0, embeddedPrice: undefined, valid: false };
  };

  const addIntake = (newIntake: Omit<LiveIntake, 'id' | 'processedLiveWeightKg' | 'remainingLiveWeightKg'>) => {
    if (!hasAccess('intake') && !hasAccess('accounting')) return;
    const id = `int-${genId()}`;
    const intake: LiveIntake = {
      ...newIntake,
      id,
      processedLiveWeightKg: 0,
      remainingLiveWeightKg: newIntake.netWeightKg,
    };
    setIntakes(prev => [intake, ...prev]);
    recordActivity(
      'INTAKE',
      'CREATE',
      'وەرگرتنی مریشکی زیندوو',
      `${intake.farmName} • ${intake.netWeightKg.toLocaleString()} کگم • ${intake.totalAmount.toLocaleString()} د.ع`,
      intake.manualReceiptNo
    );

    if (intake.paymentStatus === 'DEBT' || intake.paymentStatus === 'PARTIAL') {
      const remainingDebt = intake.totalAmount - (intake.paidAmount || 0);
      const targetFarm = normalizeName(intake.farmName);
      setSuppliers(prev => prev.map(s => {
        if (normalizeName(s.name) === targetFarm) {
          return { ...s, currentBalance: s.currentBalance + remainingDebt };
        }
        return s;
      }));
    }
  };

  const addDispatch = (newDispatch: Omit<DispatchOrder, 'id'>) => {
    if (!hasAccess('rep-sales') && !hasAccess('ready-for-sale') && !hasAccess('custody') && !hasAccess('gifts')) return;
    const id = `disp-${genId()}`;
    const dispatch: DispatchOrder = { ...newDispatch, id };
    setDispatches(prev => [dispatch, ...prev]);
    recordActivity(
      'SALES',
      'CREATE',
      dispatch.destinationType === 'GIFT' ? 'دەرکردنی دیاری و هەدیە' : 'فرۆشتنی مەندوب',
      `${dispatch.customerName || dispatch.destinationName} • ${dispatch.totalWeightKg} کگم • ${dispatch.totalAmount.toLocaleString()} د.ع`,
      dispatch.manualReceiptNo
    );

    // If it's a rep or direct sale on credit to a customer, update the customer's currentDebt
    if ((dispatch.destinationType === 'REP' || dispatch.destinationType === 'DIRECT') && dispatch.paymentType === 'CREDIT') {
      const custName = dispatch.customerName || dispatch.destinationName;
      if (custName) {
        const target = normalizeName(custName);
        setCustomers(prev => {
          // Exact (normalized) name match only — partial matching assigned debt to the wrong customer
          const matchIndex = prev.findIndex(c => normalizeName(c.name) === target);
          if (matchIndex >= 0) {
            return prev.map((c, i) => i === matchIndex ? { ...c, currentDebt: c.currentDebt + dispatch.totalAmount } : c);
          } else {
            const newCust: Customer = {
              id: `cust-${genId()}`,
              name: custName,
              phone: dispatch.driverOrRepPhone || '',
              type: 'SUPERMARKET',
              address: 'سلێمانی',
              currentDebt: dispatch.totalAmount,
              creditLimit: 3000000,
              source: 'FACTORY',
              createdAt: dispatch.date,
            };
            return [...prev, newCust];
          }
        });
      }
    }

    // Rep sales & Rep-custody gifts reconcile from Rep Custody; Direct & Factory Gifts deduct from Ready Stock
    if (
      dispatch.destinationType === 'DIRECT' ||
      (dispatch.destinationType === 'GIFT' && dispatch.sourceCustody !== 'REP')
    ) {
      setProducts(prev => prev.map(p => {
        const dispatchedKg = dispatch.items
          .filter(i => i.productId === p.id)
          .reduce((s, i) => s + i.weightKg, 0);
        if (dispatchedKg > 0) {
          return { ...p, inStockKg: Math.max(0, Number((p.inStockKg - dispatchedKg).toFixed(2))) };
        }
        return p;
      }));
    }

    // NOTE: Goods delivered to the showroom are NOT auto-added to showroom stock here.
    // The showroom must accept them itself (scan trays / receive in POS → کۆگا و وەرگرتنی بار),
    // otherwise the same goods were counted twice and any customer named "فرۆشگا…" polluted showroom stock.
  };

  const addReturn = (newReturn: Omit<ReturnOrder, 'id'>) => {
    if (!hasAccess('rep-sales') && !hasAccess('ready-for-sale') && !hasAccess('custody') && !hasAccess('pos')) return;
    const id = `ret-${genId()}`;
    const deduction = newReturn.totalCustomerDeduction !== undefined 
      ? newReturn.totalCustomerDeduction 
      : newReturn.totalLossAmount;
      
    const ret: ReturnOrder = { 
      ...newReturn, 
      id,
      totalCustomerDeduction: deduction,
      conversionStatus: newReturn.conversionStatus || 'PENDING',
    };
    setReturns(prev => [ret, ...prev]);
    recordActivity(
      'RETURN',
      'CREATE',
      ret.sourceType === 'BRANCH' ? 'گەڕاوەی ٣ ڕۆژی شۆرۆم' : 'گەڕاوەی ٣ ڕۆژی مەندوب',
      `${ret.customerName || ret.sourceName} • ${ret.totalWeightKg} کگم`,
      ret.manualReceiptNo
    );

    // Real-time deduction from customer's debt
    const targetCust = newReturn.customerName;
    if (targetCust && deduction > 0) {
      const normTarget = normalizeName(targetCust);
      setCustomers(prev => {
        const exactMatch = prev.find(c => normalizeName(c.name) === normTarget);
        const match =
          exactMatch ||
          prev.find(c => c.name.includes(targetCust) || targetCust.includes(c.name));
        if (!match) return prev;
        return prev.map(c =>
          c.id === match.id
            ? { ...c, currentDebt: Math.max(0, c.currentDebt - deduction) }
            : c
        );
      });
    }

    // If 3-day return originates from Showroom (BRANCH), deduct expired weight from branchStock
    if (ret.sourceType === 'BRANCH') {
      setBranchStock(prev =>
        prev.map(bs => {
          const retKg = ret.items
            .filter(i => i.productId === bs.productId)
            .reduce((s, i) => s + i.weightKg, 0);
          return retKg > 0
            ? { ...bs, inStockKg: Math.max(0, Number((bs.inStockKg - retKg).toFixed(2))) }
            : bs;
        })
      );
    }
  };

  const convertReturnOrder = (
    returnId: string,
    outputs: { productId: string; productName: string; weightKg: number }[],
    notes?: string
  ) => {
    if (!hasAccess('rep-sales') && !hasAccess('ready-for-sale') && !hasAccess('custody')) return;
    const existing = returns.find(r => r.id === returnId);
    if (!existing || existing.conversionStatus === 'CONVERTED') return;
    const today = toLocalISODate();

    setReturns(prev =>
      prev.map(r => {
        if (r.id === returnId) {
          return {
            ...r,
            conversionStatus: 'CONVERTED',
            convertedAt: today,
            convertedOutputs: outputs,
            conversionNotes: notes,
            disposalMethod: outputs.length > 0 ? 'CONVERTED' : 'DESTROYED',
          };
        }
        return r;
      })
    );

    if (outputs.length > 0) {
      setProducts(prev =>
        prev.map(p => {
          const added = outputs
            .filter(o => o.productId === p.id)
            .reduce((s, o) => s + o.weightKg, 0);
          return added > 0 ? { ...p, inStockKg: Number((p.inStockKg + added).toFixed(2)) } : p;
        })
      );
    }
    recordActivity(
      'RETURN',
      'UPDATE',
      'گۆڕینی شێوازی گەڕاوە بۆ ئامادە',
      outputs.length > 0
        ? outputs.map(o => `${o.productName}: ${o.weightKg} کگم`).join('، ')
        : 'تەلەفکردنی گەڕاوە',
      returnId
    );
  };

  const addExpense = (newExpense: Omit<ExpenseRecord, 'id'>) => {
    if (!hasAccess('reports') && !hasAccess('accounting')) return;
    const id = `exp-${genId()}`;
    setExpenses(prev => [{ ...newExpense, id }, ...prev]);
    recordActivity('FINANCE', 'CREATE', 'تۆمارکردنی خەرجی کارگە', `${newExpense.title} • ${newExpense.amount.toLocaleString()} د.ع`, newExpense.receiptNo);
  };

  const addCustomer = (newCustomer: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const id = `cust-${genId()}`;
    const customer: Customer = {
      ...newCustomer,
      id,
      createdAt: toLocalISODate(),
    };
    setCustomers(prev => [...prev, customer]);
    recordActivity('FINANCE', 'CREATE', 'زیادکردنی کڕیار / مارکێت', `${customer.name} (${customer.phone || 'بێ ژمارە'})`);
    return customer;
  };

  const addSupplier = (newSupplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    if (!hasAccess('intake') && !hasAccess('accounting')) return;
    const id = `supp-${genId()}`;
    const supplier: Supplier = {
      ...newSupplier,
      id,
      createdAt: toLocalISODate(),
    };
    setSuppliers(prev => [...prev, supplier]);
    recordActivity('INTAKE', 'CREATE', 'زیادکردنی کێڵگە / دابینکەر', `${supplier.name} (${supplier.phone})`);
  };

  // Enhanced addVoucher: tracks previousDebt, amount, discount, remainingDebt, and time!
  const addVoucher = (newVoucher: Omit<PaymentVoucher, 'id' | 'previousDebt' | 'remainingDebt'>) => {
    const canRecordPosCustomerReceipt = newVoucher.partyType === 'CUSTOMER' && hasAccess('pos');
    if (!hasAccess('accounting') && !canRecordPosCustomerReceipt) return;
    const id = `vouch-${genId()}`;
    const totalSettled = newVoucher.amount + (newVoucher.discount || 0);

    let previousDebt = 0;

    if (newVoucher.partyType === 'CUSTOMER') {
      const customer = customers.find(c => c.id === newVoucher.partyId);
      previousDebt = customer ? customer.currentDebt : 0;
      const remainingDebt = previousDebt - totalSettled;

      const voucher: PaymentVoucher = {
        ...newVoucher,
        id,
        previousDebt,
        remainingDebt,
      };

      setVouchers(prev => [voucher, ...prev]);

      setCustomers(prev => prev.map(c => {
        if (c.id === newVoucher.partyId) {
          return { ...c, currentDebt: remainingDebt };
        }
        return c;
      }));
      recordActivity('FINANCE', 'CREATE', 'سەنەدی وەرگرتن لە کڕیار', `${newVoucher.partyName} • ${newVoucher.amount.toLocaleString()} د.ع`, newVoucher.voucherNo);
    } else {
      const supplier = suppliers.find(s => s.id === newVoucher.partyId);
      previousDebt = supplier ? supplier.currentBalance : 0;
      const remainingDebt = previousDebt - totalSettled;

      const voucher: PaymentVoucher = {
        ...newVoucher,
        id,
        previousDebt,
        remainingDebt,
      };

      setVouchers(prev => [voucher, ...prev]);

      setSuppliers(prev => prev.map(s => {
        if (s.id === newVoucher.partyId) {
          return { ...s, currentBalance: remainingDebt };
        }
        return s;
      }));
      recordActivity('FINANCE', 'CREATE', 'سەنەدی پێدان بە کێڵگە', `${newVoucher.partyName} • ${newVoucher.amount.toLocaleString()} د.ع`, newVoucher.voucherNo);
    }
  };

  const addPOSSale = (saleData: Omit<POSSale, 'id' | 'saleNo'>): POSSale => {
    const id = `pos-${genId()}`;
    // Next number = highest existing number + 1 (stable after deletions)
    const maxNo = posSales.reduce((m, s) => {
      const n = parseInt(String(s.saleNo || '').replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const saleNo = `POS-${String(maxNo + 1).padStart(4, '0')}`;
    const sale: POSSale = { ...saleData, id, saleNo };
    setPosSales(prev => [sale, ...prev]);
    recordActivity(
      'SALES',
      'CREATE',
      'فرۆشتن لە شۆرۆم (POS)',
      `${sale.customerName || 'کڕیار'} • ${sale.total.toLocaleString()} د.ع (${sale.paymentType})`,
      sale.saleNo
    );

    // Deduct from branch's dedicated stock — SUM all cart lines of the same product
    // (the same product can appear on several lines with different per-kg prices from priced barcodes)
    const soldByProduct = new Map<string, number>();
    sale.items.forEach(i => soldByProduct.set(i.productId, (soldByProduct.get(i.productId) || 0) + i.weightKg));
    setBranchStock(prev => prev.map(bs => {
      const soldKg = soldByProduct.get(bs.productId);
      if (soldKg) {
        return { ...bs, inStockKg: Math.max(0, Number((bs.inStockKg - soldKg).toFixed(3))) };
      }
      return bs;
    }));

    // If Showroom POS sale is on DEBT, add to the customer's debt ledger
    if (sale.paymentType === 'DEBT' && sale.total > 0) {
      const targetName = (sale.customerName || '').trim();
      const target = normalizeName(targetName);
      setCustomers(prev => {
        const matchIndex = prev.findIndex(
          c =>
            (sale.customerId && c.id === sale.customerId) ||
            (!sale.customerId && target && normalizeName(c.name) === target)
        );
        if (matchIndex >= 0) {
          return prev.map((c, i) =>
            i === matchIndex
              ? {
                  ...c,
                  currentDebt: c.currentDebt + sale.total,
                  ...(sale.customerPhone && !c.phone ? { phone: sale.customerPhone } : {}),
                }
              : c
          );
        }
        if (targetName) {
          const newCust: Customer = {
            id: `cust-${genId()}`,
            name: targetName,
            phone: sale.customerPhone || '',
            type: 'SUPERMARKET',
            address: 'کڕیاری شۆرۆم',
            currentDebt: sale.total,
            creditLimit: 3000000,
            source: 'SHOWROOM',
            createdAt: sale.date.slice(0, 10),
          };
          return [...prev, newCust];
        }
        return prev;
      });
    }

    return sale;
  };

  const addBranchDelivery = (deliveryData: Omit<BranchDelivery, 'id'>) => {
    const id = `bdel-${genId()}`;
    const delivery: BranchDelivery = { ...deliveryData, id };
    setBranchDeliveries(prev => [delivery, ...prev]);

    // Add received weight to branch store stock (sum per product)
    const arrivedByProduct = new Map<string, number>();
    delivery.items.forEach(i => arrivedByProduct.set(i.productId, (arrivedByProduct.get(i.productId) || 0) + i.weightKg));
    setBranchStock(prev => {
      const updated = prev.map(bs => {
        const arrivedKg = arrivedByProduct.get(bs.productId);
        if (arrivedKg) {
          return { ...bs, inStockKg: Math.round((bs.inStockKg + arrivedKg) * 1000) / 1000 };
        }
        return bs;
      });
      const existingIds = new Set(prev.map(b => b.productId));
      for (const item of delivery.items) {
        if (!existingIds.has(item.productId)) {
          existingIds.add(item.productId);
          const prod = products.find(p => p.id === item.productId);
          updated.push({
            productId: item.productId,
            productName: item.productName,
            code: prod?.code || item.productId.slice(-4),
            barcode: prod?.barcodePrefix || item.productId,
            inStockKg: Math.round((arrivedByProduct.get(item.productId) || item.weightKg) * 1000) / 1000,
            minAlertKg: 10,
            retailPricePerKg: prod?.pricePerKg || item.factoryPricePerKg || 0,
            factoryCostPerKg: prod?.costPerKg || item.factoryPricePerKg || 0,
            category: prod?.category || 'OTHER',
            unit: prod?.unit || 'KG',
          });
        }
      }
      return updated;
    });

    // Factory stock is NOT deducted here: goods reaching the showroom were already deducted
    // from factory stock when loaded to the rep (custody) or dispatched directly.
    recordActivity(
      'SALES',
      'CREATE',
      'وەرگرتنی بار لە شۆرۆم',
      `${delivery.repName} • ${delivery.totalWeightKg.toLocaleString()} کگم`,
      delivery.manualReceiptNo
    );
  };

  const addBranchExpense = (expData: Omit<BranchExpense, 'id'>) => {
    const id = `bexp-${genId()}`;
    setBranchExpenses(prev => [{ ...expData, id }, ...prev]);
    recordActivity('FINANCE', 'CREATE', 'خەرجی شۆرۆم (POS)', `${expData.title} • ${expData.amount.toLocaleString()} د.ع`);
  };

  const updateBranchStockItem = (productId: string, updates: Partial<BranchStockItem>) => {
    setBranchStock(prev => prev.map(item => item.productId === productId ? { ...item, ...updates } : item));
  };

  const adjustBranchStock = (payload: {
    productId: string;
    newWeightKg: number;
    reason: 'AUDIT' | 'SPOILAGE';
    note?: string;
  }) => {
    const target = branchStock.find(b => b.productId === payload.productId);
    if (!target) return;
    const safeNewKg = Math.max(0, Number(payload.newWeightKg.toFixed(3)));
    const diff = Number((safeNewKg - target.inStockKg).toFixed(3));
    setBranchStock(prev =>
      prev.map(item => (item.productId === payload.productId ? { ...item, inStockKg: safeNewKg } : item))
    );
    const label = payload.reason === 'SPOILAGE' ? 'تەلەف / فەوتانی ساردکەرەوەی شۆرۆم' : 'جەرد و ڕێکخستنی کۆگای شۆرۆم';
    const noteText = payload.note ? ` (${payload.note})` : '';
    recordActivity(
      'SALES',
      'UPDATE',
      label,
      `${target.productName}: ${target.inStockKg} ← ${safeNewKg} کگم (${diff >= 0 ? '+' : ''}${diff} کگم)${noteText}`
    );
  };

  const returnBranchToReady = (payload: {
    items: { productId: string; weightKg: number }[];
    note?: string;
  }): boolean => {
    const validItems = payload.items.filter(i => i.weightKg > 0);
    if (validItems.length === 0) return false;

    for (const item of validItems) {
      const bs = branchStock.find(b => b.productId === item.productId);
      if (!bs || bs.inStockKg < item.weightKg) return false;
    }

    const byProd = new Map<string, number>();
    validItems.forEach(i => byProd.set(i.productId, (byProd.get(i.productId) || 0) + i.weightKg));

    setBranchStock(prev =>
      prev.map(bs => {
        const retKg = byProd.get(bs.productId);
        return retKg ? { ...bs, inStockKg: Math.max(0, Number((bs.inStockKg - retKg).toFixed(3))) } : bs;
      })
    );

    setProducts(prev =>
      prev.map(p => {
        const retKg = byProd.get(p.id);
        return retKg ? { ...p, inStockKg: Number((p.inStockKg + retKg).toFixed(3)) } : p;
      })
    );

    const totalKg = validItems.reduce((s, i) => s + i.weightKg, 0);
    const noteText = payload.note ? ` • ${payload.note}` : '';
    recordActivity(
      'SALES',
      'UPDATE',
      'گەڕاندنەوەی کاڵای شۆرۆم بۆ کارگە',
      `کۆی کێش: ${totalKg.toLocaleString()} کگم${noteText}`
    );
    return true;
  };

  const updateProductPrice = (id: string, newPrice: number, newCost: number, minAlertKg?: number) => {
    const prod = products.find(p => p.id === id);
    setProducts(prev =>
      prev.map(p =>
        p.id === id
          ? {
              ...p,
              pricePerKg: newPrice,
              costPerKg: newCost,
              ...(minAlertKg !== undefined ? { minAlertKg } : {}),
            }
          : p
      )
    );
    setBranchStock(prev =>
      prev.map(b =>
        b.productId === id
          ? {
              ...b,
              retailPricePerKg: newPrice,
              factoryCostPerKg: newCost,
              ...(minAlertKg !== undefined ? { minAlertKg } : {}),
            }
          : b
      )
    );
    recordActivity(
      'PRODUCTION',
      'UPDATE',
      'گۆڕینی نرخی بەرهەم',
      `${prod?.nameKu || id}: فرۆشتن ${newPrice.toLocaleString()} د.ع • تێچوو ${newCost.toLocaleString()} د.ع`
    );
  };

  const transferReadyToBranch = (payload: {
    items: { productId: string; weightKg: number }[];
    repName?: string;
    manualReceiptNo?: string;
    notes?: string;
  }): BranchDelivery | null => {
    if (!hasAccess('pos') && !hasAccess('custody')) return null;

    const validItems = payload.items
      .filter(i => i.weightKg > 0)
      .map(i => {
        const prod = products.find(p => p.id === i.productId);
        if (!prod) return null;
        return {
          productId: prod.id,
          productName: prod.nameKu,
          weightKg: Number(i.weightKg.toFixed(3)),
          factoryPricePerKg: prod.costPerKg,
          totalCost: Math.round(i.weightKg * prod.costPerKg),
        };
      })
      .filter((x): x is BranchDeliveryItem => x !== null);

    if (validItems.length === 0) return null;

    const totalWeightKg = Number(validItems.reduce((s, i) => s + i.weightKg, 0).toFixed(3));
    const totalCost = validItems.reduce((s, i) => s + i.totalCost, 0);
    const receiptNo =
      payload.manualReceiptNo?.trim() ||
      `SH-${String(branchDeliveries.length + 1).padStart(4, '0')}`;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const delivery: BranchDelivery = {
      id: `bdel-${genId()}`,
      manualReceiptNo: receiptNo,
      date: toLocalISODate(),
      time: nowTime,
      repName: payload.repName?.trim() || currentUser.name,
      items: validItems,
      totalWeightKg,
      totalCost,
      notes: payload.notes?.trim() || 'ناردن لە کۆگای سەرەکی کارگەوە بۆ شۆرۆم (چاوەڕوانی ئەکسیپت)',
      status: 'PENDING',
      sentBy: currentUser.name,
    };

    // Stock is NOT moved until Showroom accepts (just like Rep Custody PENDING -> ACCEPTED).
    setBranchDeliveries(prev => [delivery, ...prev]);

    recordActivity(
      'SALES',
      'CREATE',
      'ناردن لە کارگەوە بۆ شۆرۆم (چاوەڕوانی ئەکسیپت)',
      `${totalWeightKg.toLocaleString()} کگم • ${delivery.repName}`,
      receiptNo
    );

    return delivery;
  };

  const acceptBranchDelivery = (deliveryId: string): { ok: boolean; error?: string } => {
    if (!hasAccess('pos')) return { ok: false, error: 'مۆڵەتی شۆرۆمت نییە' };
    const target = branchDeliveries.find(b => b.id === deliveryId);
    if (!target || target.status !== 'PENDING') {
      return { ok: false, error: 'ئەم بارە چاوەڕوانی ئەکسیپت نییە' };
    }

    const neededByProd = new Map<string, number>();
    target.items.forEach(it => neededByProd.set(it.productId, (neededByProd.get(it.productId) || 0) + it.weightKg));

    const respondedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setBranchDeliveries(prev =>
      prev.map(b =>
        b.id === deliveryId
          ? { ...b, status: 'ACCEPTED', respondedBy: currentUser.name, respondedAt }
          : b
      )
    );

    setBranchStock(prev =>
      prev.map(bs => {
        const w = neededByProd.get(bs.productId);
        return w ? { ...bs, inStockKg: Math.round((bs.inStockKg + w) * 1000) / 1000 } : bs;
      })
    );

    recordActivity(
      'SALES',
      'UPDATE',
      'ئەکسیپتی وەرگرتنی بار لەلایەن شۆرۆم (POS)',
      `${target.totalWeightKg.toLocaleString()} کگم • وەرگر: ${currentUser.name}`,
      target.manualReceiptNo
    );

    return { ok: true };
  };

  const rejectBranchDelivery = (deliveryId: string, reason?: string) => {
    if (!hasAccess('pos')) return;
    const target = branchDeliveries.find(b => b.id === deliveryId);
    if (!target || target.status !== 'PENDING') return;

    const respondedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setBranchDeliveries(prev =>
      prev.map(b =>
        b.id === deliveryId
          ? {
              ...b,
              status: 'REJECTED',
              respondedBy: currentUser.name,
              respondedAt,
              rejectReason: reason?.trim() || 'ڕەتکرایەوە لەلایەن شۆرۆمەوە',
            }
          : b
      )
    );

    recordActivity(
      'SALES',
      'UPDATE',
      'ڕەتکردنەوەی باری نێردراو لەلایەن شۆرۆم',
      `${target.totalWeightKg.toLocaleString()} کگم • ${reason || 'بێ هۆکار'}`,
      target.manualReceiptNo
    );
  };

  const addProduct = (newProd: {
    nameKu: string;
    pricePerKg: number;
    costPerKg?: number;
    category?: ProductCategory;
    unit?: 'KG' | 'PIECE';
    initialStockKg?: number;
    barcodePrefix?: string;
  }): ProductItem => {
    const numericCodes = products
      .map(p => parseInt(p.code, 10))
      .filter(n => !isNaN(n));
    const nextCodeNum = numericCodes.length > 0 ? Math.max(...numericCodes) + 1 : 107;
    const code = String(nextCodeNum);
    const barcodePrefix = newProd.barcodePrefix?.trim() || `2100${code}`;
    const id = `prod-${genId()}`;

    const created: ProductItem = {
      id,
      code,
      barcodePrefix,
      nameKu: newProd.nameKu.trim(),
      category: newProd.category || 'OTHER',
      pricePerKg: Number(newProd.pricePerKg) || 0,
      costPerKg: Number(newProd.costPerKg) || Math.round((Number(newProd.pricePerKg) || 0) * 0.75),
      unit: newProd.unit || 'KG',
      inStockKg: Number(newProd.initialStockKg) || 0,
    };

    setProducts(prev => [...prev, created]);

    const branchItem: BranchStockItem = {
      productId: created.id,
      productName: created.nameKu,
      code: created.code,
      barcode: created.barcodePrefix,
      inStockKg: 0,
      minAlertKg: 10,
      retailPricePerKg: created.pricePerKg,
      factoryCostPerKg: created.costPerKg,
      category: created.category,
      unit: created.unit,
    };
    setBranchStock(prev => [...prev, branchItem]);

    recordActivity(
      'PRODUCTION',
      'CREATE',
      'زیادکردنی پارچەی نوێ',
      `${created.nameKu} • نرخی فرۆشتن: ${created.pricePerKg.toLocaleString()} د.ع • کۆد: ${created.code}`,
      created.code
    );

    return created;
  };

  const updateProduct = (updated: ProductItem) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    setBranchStock(prev => prev.map(b => b.productId === updated.id ? {
      ...b,
      productName: updated.nameKu,
      retailPricePerKg: updated.pricePerKg,
      factoryCostPerKg: updated.costPerKg,
      category: updated.category,
      unit: updated.unit,
    } : b));
    recordActivity(
      'PRODUCTION',
      'UPDATE',
      'دەستکاریکردنی پارچەی بەرهەم',
      `${updated.nameKu} • نرخ: ${updated.pricePerKg.toLocaleString()} د.ع`,
      updated.code
    );
  };

  const deleteProduct = (id: string): { ok: boolean; error?: string } => {
    const target = products.find(p => p.id === id);
    if (!target) return { ok: false, error: 'بەرهەم نەدۆزرایەوە' };
    if (target.inStockKg > 0) {
      return {
        ok: false,
        error: `ناتوانرێت "${target.nameKu}" بسڕدرێتەوە چونکە هێشتا ${target.inStockKg.toLocaleString()} کگم لە کۆگادا ماوە!`,
      };
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    setBranchStock(prev => prev.filter(b => b.productId !== id));
    recordActivity(
      'PRODUCTION',
      'DELETE',
      'سڕینەوەی پارچەی بەرهەم',
      `${target.nameKu} (${target.code})`,
      target.code
    );
    return { ok: true };
  };

  const addReadyStock = (productId: string, weightKg: number, note?: string) => {
    if (!hasAccess('ready-for-sale') && !hasAccess('intake')) return;
    if (!Number.isFinite(weightKg) || weightKg <= 0) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const added = Number(weightKg.toFixed(3));
    setProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, inStockKg: Number((p.inStockKg + added).toFixed(3)) }
          : p
      )
    );
    recordActivity(
      'PRODUCTION',
      'UPDATE',
      'داخلکردن بۆ کۆگای ئامادە',
      `${prod.nameKu} (+${added} کگم)${note ? ` • ${note}` : ''}`,
      prod.code
    );
  };

  const loadToRepCustody = (transfer: Omit<CustodyTransfer, 'id' | 'direction'>) => {
    const id = `cust-ld-${Date.now()}`;
    const record: CustodyTransfer = {
      ...transfer,
      id,
      direction: 'LOAD',
      status: 'PENDING',
      requestedBy: currentUser.name,
    };
    setCustodyTransfers(prev => [record, ...prev]);
    recordActivity(
      'CUSTODY',
      'CREATE',
      'ناردنی بار بۆ مەندوب (چاوەڕوانی ئەکسیپت)',
      `${transfer.holderName} • ${transfer.totalWeightKg} کگم`,
      transfer.receiptNo
    );
  };

  const returnUnsoldToReadyStock = (transfer: Omit<CustodyTransfer, 'id' | 'direction'>) => {
    const id = `cust-ret-${Date.now()}`;
    const record: CustodyTransfer = {
      ...transfer,
      id,
      direction: 'RETURN_TO_READY',
      status: 'PENDING',
      requestedBy: currentUser.name,
    };
    setCustodyTransfers(prev => [record, ...prev]);
    recordActivity(
      'CUSTODY',
      'UPDATE',
      'داواکاری گەڕاندنەوەی نەفرۆشراو (چاوەڕوانی ئەکسیپت)',
      `${transfer.holderName} • ${transfer.totalWeightKg} کگم`,
      transfer.receiptNo
    );
  };

  const acceptCustodyTransfer = (transferId: string) => {
    const target = custodyTransfers.find(t => t.id === transferId);
    if (!target || target.status !== 'PENDING') return;

    if (
      target.direction === 'LOAD' &&
      currentUser.role !== 'REP' &&
      currentUser.role !== 'SUPER_ADMIN' &&
      currentUser.role !== 'ADMIN'
    ) {
      return;
    }
    if (
      target.direction === 'RETURN_TO_READY' &&
      currentUser.role !== 'SUPER_ADMIN' &&
      currentUser.role !== 'ADMIN'
    ) {
      return;
    }

    const respondedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setCustodyTransfers(prev =>
      prev.map(t =>
        t.id === transferId
          ? { ...t, status: 'ACCEPTED', respondedBy: currentUser.name, respondedAt }
          : t
      )
    );

    if (target.direction === 'LOAD') {
      setProducts(prev =>
        prev.map(p => {
          const sent = target.items
            .filter(i => i.productId === p.id)
            .reduce((s, i) => s + i.weightKg, 0);
          return sent > 0 ? { ...p, inStockKg: Math.max(0, Number((p.inStockKg - sent).toFixed(2))) } : p;
        })
      );
      recordActivity(
        'CUSTODY',
        'UPDATE',
        'ئەکسیپتی وەرگرتنی بار لەلایەن مەندوب',
        `${target.holderName} • ${target.totalWeightKg} کگم`,
        target.receiptNo
      );
    } else {
      setProducts(prev =>
        prev.map(p => {
          const retKg = target.items
            .filter(i => i.productId === p.id)
            .reduce((s, i) => s + i.weightKg, 0);
          return retKg > 0 ? { ...p, inStockKg: Number((p.inStockKg + retKg).toFixed(2)) } : p;
        })
      );
      recordActivity(
        'CUSTODY',
        'UPDATE',
        'ئەکسیپتی گەڕانەوەی بار لەلایەن بەڕێوەبەری کۆگا',
        `${target.holderName} • ${target.totalWeightKg} کگم`,
        target.receiptNo
      );
    }
  };

  const rejectCustodyTransfer = (transferId: string, reason?: string) => {
    const target = custodyTransfers.find(t => t.id === transferId);
    if (!target || target.status !== 'PENDING') return;

    if (
      target.direction === 'LOAD' &&
      currentUser.role !== 'REP' &&
      currentUser.role !== 'SUPER_ADMIN' &&
      currentUser.role !== 'ADMIN'
    ) {
      return;
    }
    if (
      target.direction === 'RETURN_TO_READY' &&
      currentUser.role !== 'SUPER_ADMIN' &&
      currentUser.role !== 'ADMIN'
    ) {
      return;
    }

    const respondedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setCustodyTransfers(prev =>
      prev.map(t =>
        t.id === transferId
          ? {
              ...t,
              status: 'REJECTED',
              respondedBy: currentUser.name,
              respondedAt,
              notes: reason ? `${t.notes ? t.notes + ' • ' : ''}ڕەتکراوە: ${reason}` : t.notes,
            }
          : t
      )
    );
    recordActivity(
      'CUSTODY',
      'UPDATE',
      'ڕەتکردنەوەی گواستنەوەی کۆگای مەندوب',
      `${target.holderName} • ${target.totalWeightKg} کگم`,
      target.receiptNo
    );
  };

  const addDailySettlement = (data: Omit<DailySettlement, 'id'>): DailySettlement => {
    if (!hasAccess('reports') && !hasAccess('accounting')) {
      return { ...data, id: '' };
    }
    const id = `set-${genId()}`;
    const record: DailySettlement = { ...data, id };
    setSettlements(prev => [record, ...prev]);
    recordActivity(
      'FINANCE',
      'CREATE',
      'تەسفییەی ڕۆژانە',
      `تەسفییە بۆ ${data.accountName} - گەڕاوە: ${(data.returnedCashAmount + data.returnedCardAmount).toLocaleString()} د.ع`,
      data.settlementNo
    );
    return record;
  };

  // ==========================================
  // FACTORY SETTINGS, ACCOUNTS, SOFT DELETE & LOGS
  // ==========================================
  const updateFactorySettings = (updates: Partial<FactorySettings>) => {
    if (!hasAccess('settings')) return;
    const updatedAt = new Date().toLocaleString('en-GB');
    setFactorySettings(prev => ({ ...prev, ...updates, updatedAt }));
    recordActivity(
      'SETTINGS',
      'UPDATE',
      'نوێکردنەوەی زانیاری کارگە',
      `زانیارییەکانی کارگە (${updates.factoryName || factorySettings.factoryName}) نوێکرایەوە`
    );
  };

  const addUser = (userData: Omit<User, 'id'>): { ok: boolean; error?: string; user?: User } => {
    if (!hasAccess('settings')) {
      return { ok: false, error: 'دەسەڵاتی بەڕێوەبردنی ئەکاونتت نییە' };
    }
    const cleanPhone = userData.phone.trim();
    if (!userData.name.trim() || !cleanPhone || !userData.password?.trim()) {
      return { ok: false, error: 'تکایە ناو، ژمارەی مۆبایل و وشەی نهێنی بنووسە' };
    }
    if (users.some(u => u.phone.trim() === cleanPhone)) {
      return { ok: false, error: 'ئەم ژمارە مۆبایلە پێشتر تۆمارکراوە!' };
    }
    const newUser: User = {
      ...userData,
      id: `user-${genId()}`,
      name: userData.name.trim(),
      phone: cleanPhone,
      password: userData.password.trim(),
      isSuperAdmin: false,
      isActive: userData.isActive !== false,
      createdAt: toLocalISODate(),
    };
    setUsers(prev => [...prev, newUser]);
    recordActivity(
      'SETTINGS',
      'CREATE',
      'دروستکردنی ئەکاونتی نوێ',
      `ئەکاونتی ${newUser.name} (${newUser.roleTitleKu} - ${newUser.phone}) دروستکرا`,
      newUser.phone
    );
    return { ok: true, user: newUser };
  };

  const updateUser = (
    userId: string,
    updates: Partial<Omit<User, 'id' | 'isSuperAdmin'>>
  ): { ok: boolean; error?: string } => {
    if (!hasAccess('settings')) {
      return { ok: false, error: 'دەسەڵاتی دەستکاریکردنی ئەکاونتت نییە' };
    }
    const existing = users.find(u => u.id === userId && !u.isSuperAdmin);
    if (!existing) return { ok: false, error: 'ئەکاونت نەدۆزرایەوە' };

    if (updates.phone) {
      const cleanPhone = updates.phone.trim();
      if (users.some(u => u.id !== userId && u.phone.trim() === cleanPhone)) {
        return { ok: false, error: 'ئەم ژمارە مۆبایلە بۆ ئەکاونتێکی تر بەکارهێنراوە' };
      }
    }

    const applyUserPatch = (u: User): User => ({
      ...u,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : u.name,
      phone: updates.phone !== undefined ? updates.phone.trim() : u.phone,
      password: updates.password && updates.password.trim() ? updates.password.trim() : u.password,
    });

    setUsers(prev =>
      prev.map(u => {
        if (u.id !== userId || u.isSuperAdmin) return u;
        return applyUserPatch(u);
      })
    );

    if (currentUser?.id === userId && !currentUser.isSuperAdmin) {
      setCurrentUser(prev => applyUserPatch(prev));
    }

    recordActivity(
      'SETTINGS',
      'UPDATE',
      'دەستکاریکردنی ئەکاونت',
      `زانیاری ئەکاونتی ${updates.name || existing.name} نوێکرایەوە`,
      updates.phone || existing.phone
    );
    return { ok: true };
  };

  const softDeleteRecord = (
    entityType: TrashEntityType,
    entityId: string,
    reason?: string
  ): boolean => {
    if (!hasAccess('settings')) return false;
    const now = new Date();
    const deletedAt = toLocalISODate(now);
    const deletedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const actorName =
      currentUser?.role === 'SUPER_ADMIN' ? 'بەڕێوەبەری کارگە' : currentUser?.name || 'بەڕێوەبەر';

    let entry: Omit<SoftDeletedItem, 'id' | 'deletedAt' | 'deletedTime' | 'deletedBy' | 'reason'> | null =
      null;

    if (entityType === 'USER') {
      const target = users.find(u => u.id === entityId && !u.isSuperAdmin);
      if (!target || target.id === currentUser.id) return false;
      setUsers(prev => prev.filter(u => u.id !== entityId));
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'ئەکاونتی بەکارهێنەر',
        title: target.name,
        subtitle: `${target.roleTitleKu} • ${target.phone}`,
        payload: target,
      };
    } else if (entityType === 'CUSTOMER') {
      const target = customers.find(c => c.id === entityId);
      if (!target) return false;
      setCustomers(prev => prev.filter(c => c.id !== entityId));
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'کڕیار / مارکێت',
        title: target.name,
        subtitle: `قەرز: ${target.currentDebt.toLocaleString()} د.ع • ${target.phone || 'بێ ژمارە'}`,
        payload: target,
      };
    } else if (entityType === 'SUPPLIER') {
      const target = suppliers.find(s => s.id === entityId);
      if (!target) return false;
      setSuppliers(prev => prev.filter(s => s.id !== entityId));
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'کێڵگە / دابینکەر',
        title: target.name,
        subtitle: `باڵانس: ${target.currentBalance.toLocaleString()} د.ع • ${target.phone}`,
        payload: target,
      };
    } else if (entityType === 'INTAKE') {
      const target = intakes.find(i => i.id === entityId);
      if (!target) return false;
      const isWorkedOn =
        target.processedLiveWeightKg > 0 ||
        target.remainingLiveWeightKg < target.netWeightKg ||
        Boolean(target.yieldProcessed);
      if (isWorkedOn) {
        return false;
      }
      setIntakes(prev => prev.filter(i => i.id !== entityId));
      if (target.paymentStatus === 'DEBT' || target.paymentStatus === 'PARTIAL') {
        const unpaid = Math.max(0, target.totalAmount - (target.paidAmount || 0));
        if (unpaid > 0) {
          setSuppliers(prev =>
            prev.map(s =>
              s.name.includes(target.farmName) || target.farmName.includes(s.name)
                ? { ...s, currentBalance: Math.max(0, s.currentBalance - unpaid) }
                : s
            )
          );
        }
      }
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'وەسڵی وەرگرتن',
        title: `#${target.manualReceiptNo} • ${target.farmName}`,
        subtitle: `${target.date} • ${target.netWeightKg.toLocaleString()} کگم • ${target.totalAmount.toLocaleString()} د.ع`,
        payload: target,
      };
    } else if (entityType === 'DISPATCH') {
      const target = dispatches.find(d => d.id === entityId);
      if (!target) return false;
      setDispatches(prev => prev.filter(d => d.id !== entityId));
      if ((target.destinationType === 'REP' || target.destinationType === 'DIRECT') && target.paymentType === 'CREDIT') {
        const custName = target.customerName || target.destinationName;
        if (custName) {
          setCustomers(prev =>
            prev.map(c =>
              c.name.toLowerCase().includes(custName.toLowerCase()) ||
              custName.toLowerCase().includes(c.name.toLowerCase())
                ? { ...c, currentDebt: Math.max(0, c.currentDebt - target.totalAmount) }
                : c
            )
          );
        }
      }
      if (
        target.destinationType === 'DIRECT' ||
        (target.destinationType === 'GIFT' && target.sourceCustody !== 'REP')
      ) {
        setProducts(prev =>
          prev.map(p => {
            const retKg = target.items
              .filter(i => i.productId === p.id)
              .reduce((s, i) => s + i.weightKg, 0);
            return retKg > 0 ? { ...p, inStockKg: Number((p.inStockKg + retKg).toFixed(2)) } : p;
          })
        );
      }
      entry = {
        entityType,
        entityId,
        entityLabelKu: target.destinationType === 'GIFT' ? 'وەسڵی هەدیە' : 'وەسڵی فرۆشی مەندوب',
        title: `#${target.manualReceiptNo} • ${target.customerName || target.destinationName}`,
        subtitle: `${target.date} • ${target.totalWeightKg} کگم • ${target.totalAmount.toLocaleString()} د.ع`,
        payload: target,
      };
    } else if (entityType === 'POS_SALE') {
      const target = posSales.find(s => s.id === entityId);
      if (!target) return false;
      setPosSales(prev => prev.filter(s => s.id !== entityId));
      // Rollback branch stock
      setBranchStock(prev =>
        prev.map(bs => {
          const soldKg = target.items
            .filter(i => i.productId === bs.productId)
            .reduce((sum, i) => sum + i.weightKg, 0);
          return soldKg > 0 ? { ...bs, inStockKg: Number((bs.inStockKg + soldKg).toFixed(2)) } : bs;
        })
      );
      // Rollback customer debt if CREDIT/DEBT
      if (target.paymentType === 'DEBT' && target.total > 0) {
        const custName = (target.customerName || '').trim();
        setCustomers(prev =>
          prev.map(c =>
            (target.customerId && c.id === target.customerId) ||
            (custName &&
              (c.name.toLowerCase().includes(custName.toLowerCase()) ||
                custName.toLowerCase().includes(c.name.toLowerCase())))
              ? { ...c, currentDebt: Math.max(0, c.currentDebt - target.total) }
              : c
          )
        );
      }
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'وەسڵی شۆرۆم (POS)',
        title: `#${target.saleNo} • ${target.customerName || 'کڕیار'}`,
        subtitle: `${target.date} • ${target.total.toLocaleString()} د.ع (${target.paymentType})`,
        payload: target,
      };
    } else if (entityType === 'RETURN') {
      const target = returns.find(r => r.id === entityId);
      if (!target) return false;
      setReturns(prev => prev.filter(r => r.id !== entityId));
      const deduction = target.totalCustomerDeduction ?? target.totalLossAmount;
      if (target.customerName && deduction > 0) {
        setCustomers(prev =>
          prev.map(c =>
            c.name.includes(target.customerName!) || target.customerName!.includes(c.name)
              ? { ...c, currentDebt: c.currentDebt + deduction }
              : c
          )
        );
      }
      if (target.sourceType === 'BRANCH') {
        setBranchStock(prev =>
          prev.map(bs => {
            const retKg = target.items
              .filter(i => i.productId === bs.productId)
              .reduce((s, i) => s + i.weightKg, 0);
            return retKg > 0 ? { ...bs, inStockKg: Number((bs.inStockKg + retKg).toFixed(2)) } : bs;
          })
        );
      }
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'گەڕاوەی ٣ ڕۆژ',
        title: `#${target.manualReceiptNo} • ${target.sourceName}`,
        subtitle: `${target.date} • ${target.totalWeightKg} کگم • ${target.totalLossAmount.toLocaleString()} د.ع`,
        payload: target,
      };
    } else if (entityType === 'VOUCHER') {
      const target = vouchers.find(v => v.id === entityId);
      if (!target) return false;
      setVouchers(prev => prev.filter(v => v.id !== entityId));
      const totalSettled = target.amount + (target.discount || 0);
      if (target.partyType === 'CUSTOMER') {
        setCustomers(prev =>
          prev.map(c =>
            c.id === target.partyId ? { ...c, currentDebt: c.currentDebt + totalSettled } : c
          )
        );
      } else {
        setSuppliers(prev =>
          prev.map(s =>
            s.id === target.partyId ? { ...s, currentBalance: s.currentBalance + totalSettled } : s
          )
        );
      }
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'سەنەدی پارەدان/وەرگرتن',
        title: `#${target.voucherNo} • ${target.partyName}`,
        subtitle: `${target.date} • ${target.amount.toLocaleString()} د.ع`,
        payload: target,
      };
    } else if (entityType === 'EXPENSE') {
      const target = expenses.find(e => e.id === entityId);
      if (!target) return false;
      setExpenses(prev => prev.filter(e => e.id !== entityId));
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'خەرجی کارگە',
        title: target.title,
        subtitle: `${target.date} • ${target.amount.toLocaleString()} د.ع`,
        payload: target,
      };
    } else if (entityType === 'BRANCH_EXPENSE') {
      const target = branchExpenses.find(e => e.id === entityId);
      if (!target) return false;
      setBranchExpenses(prev => prev.filter(e => e.id !== entityId));
      entry = {
        entityType,
        entityId,
        entityLabelKu: 'خەرجی شۆرۆم',
        title: target.title,
        subtitle: `${target.date} • ${target.amount.toLocaleString()} د.ع`,
        payload: target,
      };
    }

    if (!entry) return false;

    const trashRecord: SoftDeletedItem = {
      ...entry,
      id: `trash-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      reason: reason?.trim() || undefined,
      deletedAt,
      deletedTime,
      deletedBy: actorName,
    };

    setTrashItems(prev => [trashRecord, ...prev]);
    recordActivity(
      'TRASH',
      'DELETE',
      `سۆفت دیلیت: ${entry.entityLabelKu}`,
      `${entry.title} (${entry.subtitle})${trashRecord.reason ? ` • هۆکار: ${trashRecord.reason}` : ''}`,
      entry.entityId
    );
    return true;
  };

  const restoreTrashItem = (trashId: string): boolean => {
    if (!hasAccess('settings')) return false;
    const item = trashItems.find(t => t.id === trashId);
    if (!item) return false;

    if (item.entityType === 'USER') {
      const u = item.payload as User;
      setUsers(prev => (prev.some(x => x.id === u.id || x.phone === u.phone) ? prev : [...prev, u]));
    } else if (item.entityType === 'CUSTOMER') {
      const c = item.payload as Customer;
      setCustomers(prev => (prev.some(x => x.id === c.id) ? prev : [...prev, c]));
    } else if (item.entityType === 'SUPPLIER') {
      const s = item.payload as Supplier;
      setSuppliers(prev => (prev.some(x => x.id === s.id) ? prev : [...prev, s]));
    } else if (item.entityType === 'INTAKE') {
      const i = item.payload as LiveIntake;
      if (!intakes.some(x => x.id === i.id)) {
        setIntakes(prev => [i, ...prev]);
        if (i.paymentStatus === 'DEBT' || i.paymentStatus === 'PARTIAL') {
          const unpaid = Math.max(0, i.totalAmount - (i.paidAmount || 0));
          if (unpaid > 0) {
            setSuppliers(prev =>
              prev.map(s =>
                s.name.includes(i.farmName) || i.farmName.includes(s.name)
                  ? { ...s, currentBalance: s.currentBalance + unpaid }
                  : s
              )
            );
          }
        }
      }
    } else if (item.entityType === 'DISPATCH') {
      const d = item.payload as DispatchOrder;
      if (!dispatches.some(x => x.id === d.id)) {
        setDispatches(prev => [d, ...prev]);
        if ((d.destinationType === 'REP' || d.destinationType === 'DIRECT') && d.paymentType === 'CREDIT') {
          const custName = d.customerName || d.destinationName;
          if (custName) {
            setCustomers(prev =>
              prev.map(c =>
                c.name.toLowerCase().includes(custName.toLowerCase()) ||
                custName.toLowerCase().includes(c.name.toLowerCase())
                  ? { ...c, currentDebt: c.currentDebt + d.totalAmount }
                  : c
              )
            );
          }
        }
        if (
          d.destinationType === 'DIRECT' ||
          (d.destinationType === 'GIFT' && d.sourceCustody !== 'REP')
        ) {
          setProducts(prev =>
            prev.map(p => {
              const sentKg = d.items
                .filter(it => it.productId === p.id)
                .reduce((s, it) => s + it.weightKg, 0);
              return sentKg > 0
                ? { ...p, inStockKg: Math.max(0, Number((p.inStockKg - sentKg).toFixed(2))) }
                : p;
            })
          );
        }
      }
    } else if (item.entityType === 'POS_SALE') {
      const s = item.payload as POSSale;
      if (!posSales.some(x => x.id === s.id)) {
        setPosSales(prev => [s, ...prev]);
        setBranchStock(prev =>
          prev.map(bs => {
            const soldKg = s.items
              .filter(it => it.productId === bs.productId)
              .reduce((sum, it) => sum + it.weightKg, 0);
            return soldKg > 0
              ? { ...bs, inStockKg: Math.max(0, Number((bs.inStockKg - soldKg).toFixed(2))) }
              : bs;
          })
        );
        if (s.paymentType === 'DEBT' && s.total > 0) {
          const custName = (s.customerName || '').trim();
          setCustomers(prev =>
            prev.map(c =>
              (s.customerId && c.id === s.customerId) ||
              (custName &&
                (c.name.toLowerCase().includes(custName.toLowerCase()) ||
                  custName.toLowerCase().includes(c.name.toLowerCase())))
                ? { ...c, currentDebt: c.currentDebt + s.total }
                : c
            )
          );
        }
      }
    } else if (item.entityType === 'RETURN') {
      const r = item.payload as ReturnOrder;
      if (!returns.some(x => x.id === r.id)) {
        setReturns(prev => [r, ...prev]);
        const deduction = r.totalCustomerDeduction ?? r.totalLossAmount;
        if (r.customerName && deduction > 0) {
          setCustomers(prev =>
            prev.map(c =>
              c.name.includes(r.customerName!) || r.customerName!.includes(c.name)
                ? { ...c, currentDebt: Math.max(0, c.currentDebt - deduction) }
                : c
            )
          );
        }
        if (r.sourceType === 'BRANCH') {
          setBranchStock(prev =>
            prev.map(bs => {
              const retKg = r.items
                .filter(it => it.productId === bs.productId)
                .reduce((sum, it) => sum + it.weightKg, 0);
              return retKg > 0
                ? { ...bs, inStockKg: Math.max(0, Number((bs.inStockKg - retKg).toFixed(2))) }
                : bs;
            })
          );
        }
      }
    } else if (item.entityType === 'VOUCHER') {
      const v = item.payload as PaymentVoucher;
      if (!vouchers.some(x => x.id === v.id)) {
        setVouchers(prev => [v, ...prev]);
        const totalSettled = v.amount + (v.discount || 0);
        if (v.partyType === 'CUSTOMER') {
          setCustomers(prev =>
            prev.map(c =>
              c.id === v.partyId ? { ...c, currentDebt: Math.max(0, c.currentDebt - totalSettled) } : c
            )
          );
        } else {
          setSuppliers(prev =>
            prev.map(s =>
              s.id === v.partyId
                ? { ...s, currentBalance: Math.max(0, s.currentBalance - totalSettled) }
                : s
            )
          );
        }
      }
    } else if (item.entityType === 'EXPENSE') {
      const e = item.payload as ExpenseRecord;
      setExpenses(prev => (prev.some(x => x.id === e.id) ? prev : [e, ...prev]));
    } else if (item.entityType === 'BRANCH_EXPENSE') {
      const e = item.payload as BranchExpense;
      setBranchExpenses(prev => (prev.some(x => x.id === e.id) ? prev : [e, ...prev]));
    }

    setTrashItems(prev => prev.filter(t => t.id !== trashId));
    recordActivity(
      'TRASH',
      'RESTORE',
      `گەڕاندنەوەی ${item.entityLabelKu}`,
      `${item.title} لە سەبەتەی سۆفت دیلیت گەڕێندرایەوە`,
      item.entityId
    );
    return true;
  };

  const permanentlyDeleteTrashItem = (trashId: string) => {
    if (!hasAccess('settings')) return;
    const item = trashItems.find(t => t.id === trashId);
    if (!item) return;
    setTrashItems(prev => prev.filter(t => t.id !== trashId));
    recordActivity(
      'TRASH',
      'PURGE',
      `سڕینەوەی یەکجاری: ${item.entityLabelKu}`,
      `${item.title} بە تەواوی لە سەبەتەی سۆفت دیلیت سڕایەوە`,
      item.entityId
    );
  };

  const emptyTrash = () => {
    if (!hasAccess('settings')) return;
    const count = trashItems.length;
    setTrashItems([]);
    recordActivity('TRASH', 'PURGE', 'بەتاڵکردنەوەی سەبەتەی سۆفت دیلیت', `${count} تۆمار بە یەکجاری سڕدرانەوە`);
  };

  const clearActivityLogs = () => {
    if (!hasAccess('settings')) return;
    const now = new Date();
    const isHiddenSuper = currentUser?.isSuperAdmin || currentUser?.role === 'SUPER_ADMIN';
    setActivityLogs([
      {
        id: `act-${genId()}`,
        timestamp: now.toISOString(),
        date: toLocalISODate(now),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        userId: currentUser?.id || 'system',
        userName: isHiddenSuper ? 'بەڕێوەبەری کارگە' : currentUser?.name || 'بەڕێوەبەر',
        userRoleTitle: isHiddenSuper ? 'بەڕێوەبەر' : currentUser?.roleTitleKu || '',
        category: 'SETTINGS',
        action: 'PURGE',
        title: 'پاککردنەوەی ئەکتیڤتی لۆگ',
        details: 'تۆمارە کۆنەکانی چالاکی لەلایەن بەڕێوەبەرەوە پاککرانەوە',
      },
    ]);
  };

  const repNames = useMemo(() => {
    const set = new Set<string>();
    // 1. Active REP accounts configured in Settings
    users
      .filter(u => u.role === 'REP' && u.isActive !== false && u.name.trim())
      .forEach(u => set.add(u.name.trim()));
    // 2. Historical names from transfers/dispatches/settlements
    custodyTransfers
      .filter(t => t.holderType === 'REP' && t.holderName.trim())
      .forEach(t => set.add(t.holderName.trim()));
    dispatches
      .filter(d => (d.destinationType === 'REP' || d.sourceCustody === 'REP') && d.repName?.trim())
      .forEach(d => set.add(d.repName!.trim()));
    settlements
      .filter(s => s.accountType === 'REP' && s.accountName.trim())
      .forEach(s => set.add(s.accountName.trim()));
    return Array.from(set);
  }, [users, custodyTransfers, dispatches, settlements]);

  const exportSystemBackup = (): string => {
    const payload = {
      version: 'FFC-ERP-v4',
      exportedAt: new Date().toISOString(),
      data: {
        products,
        intakes,
        customers,
        suppliers,
        dispatches,
        returns,
        expenses,
        vouchers,
        posSales,
        branchStock,
        branchDeliveries,
        branchExpenses,
        custodyTransfers,
        settlements,
        users,
        factorySettings,
        trashItems,
        activityLogs,
      },
    };
    recordActivity('SETTINGS', 'CREATE', 'دابەزاندنی باکئەپی سیستەم', 'هەموو داتاکانی کارگە بە فایلی JSON دابەزێنران');
    return JSON.stringify(payload, null, 2);
  };

  const importSystemBackup = (
    jsonStr: string
  ): { ok: boolean; error?: string; stats?: string } => {
    if (!hasAccess('settings')) {
      return { ok: false, error: 'دەسەڵاتی گەڕاندنەوەی باکئەپت نییە' };
    }
    try {
      const parsed = JSON.parse(jsonStr);
      const d = parsed?.data || parsed;
      if (!d || typeof d !== 'object' || !Array.isArray(d.products) || !Array.isArray(d.users)) {
        return { ok: false, error: 'فایلی باکئەپ دروست نییە یان فۆرماتەکەی هەڵەیە!' };
      }

      setProducts(d.products);
      if (Array.isArray(d.intakes)) setIntakes(d.intakes);
      if (Array.isArray(d.customers)) setCustomers(d.customers);
      if (Array.isArray(d.suppliers)) setSuppliers(d.suppliers);
      if (Array.isArray(d.dispatches)) setDispatches(d.dispatches);
      if (Array.isArray(d.returns)) setReturns(d.returns);
      if (Array.isArray(d.expenses)) setExpenses(d.expenses);
      if (Array.isArray(d.vouchers)) setVouchers(d.vouchers);
      if (Array.isArray(d.posSales)) setPosSales(d.posSales);
      if (Array.isArray(d.branchStock)) setBranchStock(d.branchStock);
      if (Array.isArray(d.branchDeliveries)) setBranchDeliveries(d.branchDeliveries);
      if (Array.isArray(d.branchExpenses)) setBranchExpenses(d.branchExpenses);
      if (Array.isArray(d.custodyTransfers)) setCustodyTransfers(d.custodyTransfers);
      if (Array.isArray(d.settlements)) setSettlements(d.settlements);
      if (Array.isArray(d.users)) setUsers(d.users);
      if (d.factorySettings && typeof d.factorySettings === 'object') {
        setFactorySettings(prev => ({ ...prev, ...d.factorySettings }));
      }
      if (Array.isArray(d.trashItems)) setTrashItems(d.trashItems);
      if (Array.isArray(d.activityLogs)) setActivityLogs(d.activityLogs);

      recordActivity(
        'SETTINGS',
        'RESTORE',
        'گەڕاندنەوەی باکئەپی سیستەم',
        `باکئەپ گەڕێندرایەوە (${d.intakes?.length || 0} وەرگرتن، ${d.dispatches?.length || 0} وەسڵی مەندوب، ${d.posSales?.length || 0} POS)`
      );
      return {
        ok: true,
        stats: `${d.intakes?.length || 0} وەرگرتن • ${d.dispatches?.length || 0} وەسڵی مەندوب • ${d.posSales?.length || 0} فرۆشی POS`,
      };
    } catch {
      return { ok: false, error: 'نەتوانرا فایلەکە بخوێندرێتەوە (JSON هەڵەیە)' };
    }
  };

  const resetToCleanStart = (options?: { clearParties?: boolean }) => {
    if (!hasAccess('settings')) return;
    setIntakes([]);
    setDispatches([]);
    setReturns([]);
    setExpenses([]);
    setVouchers([]);
    setPosSales([]);
    setBranchDeliveries([]);
    setBranchExpenses([]);
    setCustodyTransfers([]);
    setSettlements([]);
    setTrashItems([]);
    setProducts(prev => prev.map(p => ({ ...p, inStockKg: 0 })));
    setBranchStock(prev => prev.map(b => ({ ...b, inStockKg: 0 })));
    if (options?.clearParties) {
      setCustomers([]);
      setSuppliers([]);
    } else {
      setCustomers(prev => prev.map(c => ({ ...c, currentDebt: 0 })));
      setSuppliers(prev => prev.map(s => ({ ...s, currentBalance: 0 })));
    }
    recordActivity(
      'SETTINGS',
      'PURGE',
      'سفرکردنەوەی داتای تێست',
      options?.clearParties
        ? 'سەرجەم وەسڵ، کۆگا، قەرز و کڕیار/کێڵگە تێستەکان پاک کرانەوە بۆ دەستپێکی کار'
        : 'سەرجەم وەسڵ، کۆگا و قەرزە تێستەکان سفر کرانەوە بۆ دەستپێکی کار'
    );
  };

  return (
    <AppContext.Provider
      value={{
        products,
        intakes,
        customers,
        suppliers,
        dispatches,
        returns,
        expenses,
        vouchers,
        posSales,
        branchStock,
        branchDeliveries,
        branchExpenses,
        custodyTransfers,
        settlements,
        currentUser,
        users,
        login,
        logout,
        hasAccess,
        isAuthenticated,
        isHydratedFromCloud,
        addIntake,
        addDispatch,
        addReturn,
        convertReturnOrder,
        addExpense,
        addCustomer,
        addSupplier,
        addVoucher,
        addPOSSale,
        addProduct,
        updateProduct,
        deleteProduct,
        addReadyStock,
        addBranchDelivery,
        addBranchExpense,
        updateBranchStockItem,
        adjustBranchStock,
        returnBranchToReady,
        updateProductPrice,
        transferReadyToBranch,
        acceptBranchDelivery,
        rejectBranchDelivery,
        loadToRepCustody,
        returnUnsoldToReadyStock,
        acceptCustodyTransfer,
        rejectCustodyTransfer,
        addDailySettlement,
        factorySettings,
        updateFactorySettings,
        addUser,
        updateUser,
        trashItems,
        softDeleteRecord,
        restoreTrashItem,
        permanentlyDeleteTrashItem,
        emptyTrash,
        activityLogs,
        clearActivityLogs,
        repNames,
        parseWeightBarcode,
        exportSystemBackup,
        importSystemBackup,
        resetToCleanStart,
        changeOwnPassword,
        cloudSyncStatus,
        lastSyncedAt,
        syncNow,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
