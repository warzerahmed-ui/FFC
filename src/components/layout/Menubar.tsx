import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TabType } from '../../types';
import { FactoryLogo } from './FactoryLogo';
import type { PosSubTab } from '../pos/POSView';
import type { AccountingSubTab } from '../accounting/AccountingView';
import type { ReportSubTab } from '../reports/ReportsView';
import type { SettingsSubTab } from '../settings/SettingsView';
import {
  LayoutDashboard,
  Truck,
  PackageCheck,
  ClipboardList,
  Send,
  Gift,
  ShoppingBag,
  Barcode,
  Boxes,
  Receipt,
  Calculator,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  Calendar,
  LogOut,
  Clock,
  Menu,
  X,
  Check,
  Cloud,
  Settings,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
  Activity,
  Smartphone,
  Share,
} from 'lucide-react';

interface MenubarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activePosSubTab?: PosSubTab;
  setPosSubTab?: (tab: PosSubTab) => void;
  activeAccountingSubTab?: AccountingSubTab;
  setAccountingSubTab?: (tab: AccountingSubTab) => void;
  activeReportSubTab?: ReportSubTab;
  setReportSubTab?: (tab: ReportSubTab) => void;
  activeSettingsSubTab?: SettingsSubTab;
  setSettingsSubTab?: (tab: SettingsSubTab) => void;
}

interface MenuSubItem {
  id: TabType;
  posSubTab?: PosSubTab;
  accountingSubTab?: AccountingSubTab;
  reportSubTab?: ReportSubTab;
  label: string;
  description: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  matchTabs?: TabType[];
}

interface MenuGroup {
  key: 'dashboard' | 'factory' | 'sales' | 'showroom' | 'finance';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  directTab?: TabType;
  items: MenuSubItem[];
}

const MENU_GROUPS: MenuGroup[] = [
  {
    key: 'dashboard',
    label: 'داشبۆرد',
    icon: LayoutDashboard,
    directTab: 'dashboard',
    items: [
      {
        id: 'dashboard',
        label: 'داشبۆردی سەرەکی',
        description: 'کورتەی ئامارەکان، کۆگا و چالاکی ئەمڕۆ',
        badge: 'سەرەکی',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    key: 'factory',
    label: 'کۆگای وەرگرتن',
    icon: Truck,
    directTab: 'intake',
    items: [
      {
        id: 'intake',
        label: 'کۆگای وەرگرتن (وەسڵی کێڵگە)',
        description: 'تۆمارکردنی وەسڵ و کێشی مریشکی وەرگیراو لە کێڵگەکان',
        badge: 'وەرگرتن',
        icon: Truck,
      },
    ],
  },
  {
    key: 'sales',
    label: 'ناردن و فرۆشتن',
    icon: ShoppingBag,
    items: [
      {
        id: 'custody',
        label: '١. کۆگای مەندوب',
        description: 'بارکردن و بەدواداچوونی کۆگای مەندوبەکان',
        badge: 'قۆناغی ١',
        icon: ClipboardList,
      },
      {
        id: 'rep-sales',
        label: '٢. فرۆشتنی مەندوب و گەڕاوە',
        description: 'وەسڵی دەستی و گەڕاوەی ٣ ڕۆژی مارکێتەکان',
        badge: 'قۆناغی ٢',
        icon: Send,
      },
      {
        id: 'gifts',
        label: '٣. دیاری و هەدیە',
        description: 'بەخشینی بێبەرامبەر بە تێچووی کارگە',
        badge: 'قۆناغی ٣',
        icon: Gift,
      },
    ],
  },
  {
    key: 'showroom',
    label: 'فرۆشگای شۆرۆم (POS)',
    icon: ShoppingBag,
    items: [
      {
        id: 'pos',
        posSubTab: 'REGISTER',
        label: '١. کاشێر و فرۆشتن',
        description: 'سکانەری بارکۆد و تەرازوو، سەبەتەی فرۆشتن و چاپی وەسڵی 80mm',
        badge: 'POS',
        icon: Barcode,
      },
      {
        id: 'pos',
        posSubTab: 'INVENTORY',
        label: '٢. کۆگا، وەرگرتن و جەرد',
        description: 'بەڕێوەبردنی کۆگای شۆرۆم، وەرگرتنی بار، جەرد و گەڕاندنەوە',
        badge: 'کۆگا',
        icon: Boxes,
      },
      {
        id: 'pos',
        posSubTab: 'CUSTOMERS_DEBT',
        label: '٣. قەرزی کڕیاران',
        description: 'بینین و وەرگرتنەوەی قەرزی کڕیاران ڕاستەوخۆ لە کاشێر',
        badge: 'قەرز',
        icon: Users,
      },
      {
        id: 'pos',
        posSubTab: 'GIFTS',
        label: '٤. هەدیە و بەخشین',
        description: 'ڕاپۆرتی هەدیەکان: کێ وەریگرتووە، کێش و تێچوو',
        badge: 'هەدیە',
        icon: Gift,
      },
      {
        id: 'pos',
        posSubTab: 'REGISTER_REPORT',
        label: '٥. سەندوق و Z-Report',
        description: 'تەسفیەی سەندوقی ڕۆژانە، خەرجی لق و مێژووی وەسڵەکان',
        badge: 'سەندوق',
        icon: Receipt,
      },
    ],
  },
  {
    key: 'finance',
    label: 'ژمێریاری و ڕاپۆرت',
    icon: Calculator,
    items: [
      {
        id: 'accounting',
        accountingSubTab: 'VOUCHERS',
        label: '١. سەنەدانی سافکردنی قەرز',
        description: 'سەنەدی قەبز (وەرگرتن) و سەنەدی سەرف (دانەوە بە کێڵگە)',
        badge: 'سەنەد',
        icon: Receipt,
      },
      {
        id: 'accounting',
        accountingSubTab: 'CUSTOMERS',
        label: '٢. کەشف حسابی کڕیاران',
        description: 'کەشف حسابی مارکێت و کڕیارە قەرزارەکان',
        badge: 'کڕیاران',
        icon: Users,
      },
      {
        id: 'accounting',
        accountingSubTab: 'SUPPLIERS',
        label: '٣. کەشف حسابی کێڵگەکان',
        description: 'کەشف حسابی کێڵگە و دابینکەران',
        badge: 'کێڵگەکان',
        icon: Building2,
      },
      {
        id: 'reports',
        reportSubTab: 'EXPENSES',
        label: '٤. خەرجییەکانی کارگە',
        description: 'تۆمارکردن و بەدواداچوونی خەرجییەکانی کارگە',
        badge: 'خەرجی',
        icon: DollarSign,
      },
      {
        id: 'reports',
        reportSubTab: 'PNL',
        label: '٥. ڕاپۆرتی قازانج و زەرەر (P&L)',
        description: 'ڕاپۆرتی داهات، تێچوو، خەرجی و قازانجی گشتی',
        badge: 'P&L',
        icon: TrendingUp,
      },
      {
        id: 'reports',
        reportSubTab: 'DAILY',
        label: '٦. ڕاپۆرت و تەسفییەی ڕۆژانە',
        description: 'تەسفییەی ڕۆژانەی مەندوب و شۆرۆم',
        badge: 'تەسفییە',
        icon: Calendar,
      },
    ],
  },
];

export const Menubar: React.FC<MenubarProps> = ({
  activeTab,
  setActiveTab,
  activePosSubTab = 'REGISTER',
  setPosSubTab,
  activeAccountingSubTab = 'VOUCHERS',
  setAccountingSubTab,
  activeReportSubTab = 'PNL',
  setReportSubTab,
  activeSettingsSubTab = 'FACTORY_INFO',
  setSettingsSubTab,
}) => {
  const {
    currentUser,
    hasAccess,
    logout,
    changeOwnPassword,
    factorySettings,
    cloudSyncStatus,
    lastSyncedAt,
    syncNow,
  } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [currPwd, setCurrPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrPwd, setShowCurrPwd] = useState(false);
  const [pwdStatus, setPwdStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // PWA Install Prompt & Standalone Detection
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallPwaClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowIosInstallModal(true);
    }
  };

  // Live clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Close mobile drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Filter accessible items per group
  const accessibleGroups = MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => hasAccess(item.id)),
  })).filter(group => group.items.length > 0);

  const isItemActive = (item: MenuSubItem) => {
    if (item.posSubTab) {
      return activeTab === item.id && activePosSubTab === item.posSubTab;
    }
    if (item.accountingSubTab) {
      return activeTab === item.id && activeAccountingSubTab === item.accountingSubTab;
    }
    if (item.reportSubTab) {
      return activeTab === item.id && activeReportSubTab === item.reportSubTab;
    }
    return item.id === activeTab || (item.matchTabs ? item.matchTabs.includes(activeTab) : false);
  };

  const isGroupActive = (group: MenuGroup) => group.items.some(isItemActive);

  const isSettingsTab = activeTab === 'settings';
  const activeGroupObj = accessibleGroups.find(isGroupActive) || accessibleGroups[0];
  const activeItemObj = isSettingsTab
    ? {
        id: 'settings' as TabType,
        label: 'سیتینی کارگە، ئەکاونتەکان، سۆفت دیلیت و ئەکتیڤتی لۆگ',
        icon: Settings,
      }
    : activeGroupObj?.items.find(isItemActive) || activeGroupObj?.items[0];

  const handleSelectItem = (item: MenuSubItem) => {
    setActiveTab(item.id);
    if (item.posSubTab && setPosSubTab) setPosSubTab(item.posSubTab);
    if (item.accountingSubTab && setAccountingSubTab) setAccountingSubTab(item.accountingSubTab);
    if (item.reportSubTab && setReportSubTab) setReportSubTab(item.reportSubTab);
    setMobileOpen(false);
  };

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const formattedDateTime = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} • ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const isSuper = Boolean(currentUser?.isSuperAdmin || currentUser?.role === 'SUPER_ADMIN');
  const displayName = isSuper ? 'بەڕێوەبەری کارگە' : currentUser?.name || 'بەکارهێنەر';
  const displayRole = isSuper ? 'بەڕێوەبەر' : currentUser?.roleTitleKu || '';
  const avatarInitial = isSuper ? 'م' : currentUser?.name?.trim()?.[0] || 'ک';

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdSaving) return;
    if (newPwd.trim().length < 4) {
      setPwdStatus({ msg: 'وشەی نهێنی نوێ دەبێت لانیکەم ٤ پیت بێت', ok: false });
      return;
    }
    if (newPwd.trim() !== confirmPwd.trim()) {
      setPwdStatus({ msg: 'وشەی نهێنی نوێ و دووپاتکردنەوەکەی یەک ناگرنەوە', ok: false });
      return;
    }
    setPwdSaving(true);
    setPwdStatus(null);
    const res = await changeOwnPassword(currPwd, newPwd);
    setPwdSaving(false);
    if (!res.ok) {
      setPwdStatus({ msg: res.error || 'هەڵە لە گۆڕینی وشەی نهێنی', ok: false });
      return;
    }
    setPwdStatus({ msg: 'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا', ok: true });
    setTimeout(() => setShowPwdModal(false), 1100);
  };

  const ActiveBreadIcon = activeItemObj?.icon || LayoutDashboard;

  return (
    <div className="sticky top-0 z-40 no-print">
      {/* Main Apple Frosted Glass Menubar */}
      <header className="h-16 apple-glass border-b border-black/[0.06] px-4 lg:px-7 flex items-center justify-between gap-3">
        {/* Right Side (RTL Start): Brand + Grouped Horizontal Menubar */}
        <div className="flex items-center gap-3 lg:gap-4 min-w-0">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(prev => !prev)}
            className="lg:hidden w-9 h-9 rounded-xl bg-[#F5F5F7] hover:bg-[#E8E8ED] flex items-center justify-center text-[#1D1D1F] transition-colors shrink-0"
            aria-label="مینۆ"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand Emblem (Click to open Dashboard) */}
          <button
            type="button"
            onClick={() => {
              if (hasAccess('dashboard')) handleSelectTab('dashboard');
            }}
            title="داشبۆردی سەرەکی"
            className={`flex items-center gap-2.5 text-right shrink-0 group cursor-pointer px-2.5 py-1 rounded-2xl transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[#0071E3]/10 ring-1 ring-[#0071E3]/25'
                : 'hover:bg-black/[0.04]'
            }`}
          >
            <FactoryLogo size="md" className="transition-transform group-hover:scale-105" />
            <div>
              <div className="text-[13px] font-extrabold text-[#1D1D1F] tracking-tight leading-tight">
                {factorySettings.factoryName}
              </div>
              <div className="text-[10px] font-bold text-[#0071E3] tracking-tight">
                {factorySettings.shortCode} • {factorySettings.showroomName}
              </div>
            </div>
          </button>

          {/* Subtle Vertical Divider */}
          <div className="hidden lg:block h-7 w-px bg-black/[0.08] mx-1 shrink-0" />

          {/* Desktop Horizontal Menubar Groups (Brand opens Dashboard) */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {accessibleGroups
              .filter(group => group.key !== 'dashboard')
              .map(group => {
                const active = isGroupActive(group);
                const firstItem = group.items[0];
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      if (!active && firstItem) {
                        handleSelectItem(firstItem);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#0071E3]/10 border border-[#0071E3]/25 text-[#0071E3] font-bold shadow-[0_1px_3px_rgba(0,113,227,0.08)]'
                        : 'border border-transparent text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.04] font-semibold'
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] shrink-0" />}
                    <span>{group.label}</span>
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Left Side (RTL End): Unified Sync+Clock Capsule, Settings, Unified Profile+SignOut */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Unified D1 Sync + Live Clock Capsule */}
          <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-[#F8FAFC] border border-slate-200/90 p-0.5 pl-3 text-[11px]">
            <button
              type="button"
              onClick={() => syncNow()}
              title={lastSyncedAt ? `دوایین سینک: ${lastSyncedAt}` : 'کلیک بکە بۆ سینککردن لەگەڵ Cloudflare D1'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap ${
                cloudSyncStatus === 'SYNCED'
                  ? 'bg-[#ECFDF5] text-[#047857]'
                  : cloudSyncStatus === 'SYNCING'
                  ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                  : cloudSyncStatus === 'ERROR'
                  ? 'bg-[#FEF2F2] text-[#B91C1C]'
                  : 'bg-[#FFFBEB] text-[#B45309]'
              }`}
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  cloudSyncStatus === 'SYNCED'
                    ? 'text-[#10B981]'
                    : cloudSyncStatus === 'SYNCING'
                    ? 'text-[#3B82F6] animate-pulse'
                    : cloudSyncStatus === 'ERROR'
                    ? 'text-[#EF4444]'
                    : 'text-[#F59E0B]'
                }`}
              />
              <span>
                {cloudSyncStatus === 'SYNCED'
                  ? 'D1 هاوئاهەنگە'
                  : cloudSyncStatus === 'SYNCING'
                  ? 'لە سینکدایە...'
                  : cloudSyncStatus === 'ERROR'
                  ? 'هەڵەی D1'
                  : 'لۆکاڵ'}
              </span>
            </button>

            <div className="h-3.5 w-px bg-slate-200 shrink-0" />

            <div className="inline-flex items-center gap-1.5 text-slate-600 font-semibold tabular-nums whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
              <span dir="ltr">{formattedDateTime}</span>
            </div>
          </div>

          {/* Mobile PWA Install Pill */}
          {!isStandalone && (
            <button
              type="button"
              onClick={handleInstallPwaClick}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#0071E3] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all whitespace-nowrap cursor-pointer"
              title="دابەزاندنی ئەپ بۆ سەر شاشەی مۆبایل"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>ئەپ</span>
            </button>
          )}

          {/* Factory Settings Quick Pill (Admin Only) */}
          {hasAccess('settings') && (
            <button
              type="button"
              onClick={() => handleSelectTab('settings')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isSettingsTab
                  ? 'bg-[#EFF6FF] border border-[#3B82F6]/45 text-[#1D4ED8] shadow-[0_1px_2px_rgba(37,99,235,0.08)]'
                  : 'bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200/90 text-slate-700'
              }`}
              title="سیتینی کارگە"
            >
              <Settings className={`w-3.5 h-3.5 ${isSettingsTab ? 'text-[#1D4ED8]' : 'text-slate-600'}`} />
              <span>سیتین</span>
            </button>
          )}

          {/* Unified User Profile + Password + Sign Out Capsule */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-slate-200/90 rounded-full p-1 pr-1.5 pl-1">
            <div className="hidden sm:flex items-center gap-2 pl-1">
              <div className="w-7 h-7 rounded-full bg-[#EFF6FF] border border-[#3B82F6]/25 text-[#1D4ED8] flex items-center justify-center font-extrabold text-xs shrink-0">
                {avatarInitial}
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-extrabold text-slate-800 max-w-[110px] truncate">
                  {displayName}
                </div>
                <div className="text-[10px] font-bold text-[#0071E3] truncate">
                  {displayRole}
                </div>
              </div>
              {!isSuper && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrPwd('');
                    setNewPwd('');
                    setConfirmPwd('');
                    setPwdStatus(null);
                    setShowPwdModal(true);
                  }}
                  className="p-1 rounded-full bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-600 hover:text-[#1D4ED8] transition-all cursor-pointer"
                  title="گۆڕینی وشەی نهێنیی خۆم"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={logout}
              className="px-2.5 py-1 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/15 border border-[#FF3B30]/20 text-[#FF3B30] text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              title="چوونەدەرەوە"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">چوونەدەرەوە</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Top Sub-Navigation Bar */}
      <div className="bg-[#F5F5F7]/90 backdrop-blur-md border-b border-black/[0.06] px-4 lg:px-7 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0 text-[#86868B] font-semibold pl-1">
            <ActiveBreadIcon className="w-3.5 h-3.5 text-[#0071E3]" />
            <span>{isSettingsTab ? 'بەڕێوەبردن' : activeGroupObj?.label}</span>
            <span className="text-black/20">/</span>
          </div>

          {isSettingsTab ? (
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'FACTORY_INFO' as SettingsSubTab, label: '١. زانیاری کارگە و باکئەپ', icon: Building2 },
                  { id: 'ACCOUNTS' as SettingsSubTab, label: '٢. ئەکاونت و مۆڵەتەکان', icon: Users },
                  { id: 'SOFT_DELETE' as SettingsSubTab, label: '٣. سەبەتەی سۆفت دیلیت', icon: Trash2 },
                  { id: 'ACTIVITY_LOG' as SettingsSubTab, label: '٤. ئەکتیڤتی لۆگ', icon: Activity },
                ]
              ).map(sub => {
                const SubIcon = sub.icon;
                const subActive = activeSettingsSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSettingsSubTab?.(sub.id)}
                    className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      subActive
                        ? 'bg-white text-[#0071E3] font-extrabold shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-[#0071E3]/25'
                        : 'text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05] font-semibold'
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 ${subActive ? 'text-[#0071E3]' : 'text-[#86868B]'}`} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          ) : activeGroupObj && activeGroupObj.items.length > 1 ? (
            <div className="flex items-center gap-1.5">
              {activeGroupObj.items.map(sub => {
                const SubIcon = sub.icon;
                const subActive = isItemActive(sub);
                return (
                  <button
                    key={`${sub.id}-${sub.posSubTab ?? sub.accountingSubTab ?? sub.reportSubTab ?? ''}`}
                    type="button"
                    onClick={() => handleSelectItem(sub)}
                    className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      subActive
                        ? 'bg-white text-[#0071E3] font-extrabold shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-[#0071E3]/25'
                        : 'text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05] font-semibold'
                    }`}
                  >
                    <SubIcon className={`w-3.5 h-3.5 ${subActive ? 'text-[#0071E3]' : 'text-[#86868B]'}`} />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="font-extrabold text-[#1D1D1F] truncate">{activeItemObj?.label}</span>
          )}
        </div>

        <div className="hidden xl:flex items-center gap-2 text-[10px] font-extrabold tracking-wide shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[#248A3D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
            <span>{factorySettings.shortCode} • کارکردن: کراوەیە</span>
          </span>
          <span className="text-black/15">|</span>
          <span
            dir="ltr"
            className="px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-black tracking-wider"
          >
            RAND SUITE
          </span>
        </div>
      </div>

      {/* Mobile Bottom Sheet Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/40 backdrop-blur-xs flex items-end no-print"
          onClick={() => setMobileOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-t-[28px] bg-white w-full max-h-[82vh] overflow-y-auto p-4 pb-8 space-y-3 shadow-2xl border-t border-black/[0.08] apple-sheet"
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-1" />
            <div className="flex items-center justify-between bg-[#F5F5F7] rounded-2xl p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#0071E3] text-white flex items-center justify-center font-black text-sm">
                  {avatarInitial}
                </div>
                <div>
                  <div className="text-xs font-extrabold text-[#1D1D1F]">{displayName}</div>
                  <div className="text-[11px] font-bold text-[#0071E3]">{displayRole}</div>
                </div>
              </div>
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleInstallPwaClick();
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#0071E3] text-white text-[11px] font-bold flex items-center gap-1"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  دابەزاندنی ئەپ
                </button>
              )}
            </div>

            {hasAccess('settings') && (
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs transition-all ${
                  isSettingsTab
                    ? 'bg-[#EFF6FF] border border-[#3B82F6]/35 text-[#1D4ED8] font-bold'
                    : 'bg-slate-50/90 text-slate-700 font-semibold hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 shrink-0 text-[#0071E3]" />
                  <span>سیتینی کارگە، ئەکاونتەکان، سۆفت دیلیت و لۆگ</span>
                </div>
                {isSettingsTab && <Check className="w-4 h-4 text-[#2563EB]" />}
              </button>
            )}
            {accessibleGroups.map(group => (
              <div key={group.key} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-extrabold text-slate-400">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const itemActive = isItemActive(item);
                    return (
                      <button
                        key={`${item.id}-${item.posSubTab ?? item.accountingSubTab ?? item.reportSubTab ?? ''}`}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs transition-all ${
                          itemActive
                            ? 'bg-[#EFF6FF] border border-[#3B82F6]/35 text-[#1D4ED8] font-bold'
                            : 'bg-slate-50/90 text-slate-700 font-semibold hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {itemActive && <Check className="w-4 h-4 text-[#2563EB]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {!isSuper && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setCurrPwd('');
                    setNewPwd('');
                    setConfirmPwd('');
                    setPwdStatus(null);
                    setShowPwdModal(true);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs bg-[#F5F5F7] text-[#1D1D1F] font-bold"
                >
                  <KeyRound className="w-4 h-4 text-[#0071E3]" />
                  <span>گۆڕینی پاسوۆرد</span>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-xs bg-[#FF3B30]/10 text-[#FF3B30] font-bold ${
                  isSuper ? 'col-span-2' : ''
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span>چوونەدەرەوە</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role-Specific Native Mobile Bottom Tab Bar */}
      {(() => {
        interface BottomNavItem {
          key: string;
          tab?: TabType;
          label: string;
          icon: React.ComponentType<{ className?: string }>;
          active: boolean;
          onClick: () => void;
        }
        const role = currentUser?.role || 'ADMIN';
        let items: BottomNavItem[] = [];

        if (role === 'CASHIER') {
          items = [
            {
              key: 'pos-reg',
              tab: 'pos',
              label: 'کاشێر',
              icon: Barcode,
              active: activeTab === 'pos' && activePosSubTab === 'REGISTER',
              onClick: () => {
                setActiveTab('pos');
                setPosSubTab?.('REGISTER');
              },
            },
            {
              key: 'pos-inv',
              tab: 'pos',
              label: 'کۆگا',
              icon: Boxes,
              active: activeTab === 'pos' && activePosSubTab === 'INVENTORY',
              onClick: () => {
                setActiveTab('pos');
                setPosSubTab?.('INVENTORY');
              },
            },
            {
              key: 'pos-debt',
              tab: 'pos',
              label: 'قەرز',
              icon: Users,
              active: activeTab === 'pos' && activePosSubTab === 'CUSTOMERS_DEBT',
              onClick: () => {
                setActiveTab('pos');
                setPosSubTab?.('CUSTOMERS_DEBT');
              },
            },
            {
              key: 'pos-gift',
              tab: 'pos',
              label: 'هەدیە',
              icon: Gift,
              active: activeTab === 'pos' && activePosSubTab === 'GIFTS',
              onClick: () => {
                setActiveTab('pos');
                setPosSubTab?.('GIFTS');
              },
            },
            {
              key: 'pos-rep',
              tab: 'pos',
              label: 'سەندوق',
              icon: Receipt,
              active: activeTab === 'pos' && activePosSubTab === 'REGISTER_REPORT',
              onClick: () => {
                setActiveTab('pos');
                setPosSubTab?.('REGISTER_REPORT');
              },
            },
          ];
        } else if (role === 'REP') {
          items = [
            {
              key: 'dash',
              tab: 'dashboard',
              label: 'سەرەکی',
              icon: LayoutDashboard,
              active: activeTab === 'dashboard',
              onClick: () => setActiveTab('dashboard'),
            },
            {
              key: 'custody',
              tab: 'custody',
              label: 'عەهدە',
              icon: PackageCheck,
              active: activeTab === 'custody',
              onClick: () => setActiveTab('custody'),
            },
            {
              key: 'rep-sales',
              tab: 'rep-sales',
              label: 'فرۆشتن',
              icon: Send,
              active: activeTab === 'rep-sales',
              onClick: () => setActiveTab('rep-sales'),
            },
            {
              key: 'gifts',
              tab: 'gifts',
              label: 'هەدیە',
              icon: Gift,
              active: activeTab === 'gifts',
              onClick: () => setActiveTab('gifts'),
            },
            {
              key: 'more',
              label: 'بەشەکان',
              icon: Menu,
              active: mobileOpen,
              onClick: () => setMobileOpen(prev => !prev),
            },
          ];
        } else if (role === 'ACCOUNTANT') {
          items = [
            {
              key: 'dash',
              tab: 'dashboard',
              label: 'سەرەکی',
              icon: LayoutDashboard,
              active: activeTab === 'dashboard',
              onClick: () => setActiveTab('dashboard'),
            },
            {
              key: 'acc-vouch',
              tab: 'accounting',
              label: 'سەنەد',
              icon: Receipt,
              active: activeTab === 'accounting' && activeAccountingSubTab === 'VOUCHERS',
              onClick: () => {
                setActiveTab('accounting');
                setAccountingSubTab?.('VOUCHERS');
              },
            },
            {
              key: 'acc-cust',
              tab: 'accounting',
              label: 'کڕیاران',
              icon: Users,
              active: activeTab === 'accounting' && activeAccountingSubTab === 'CUSTOMERS',
              onClick: () => {
                setActiveTab('accounting');
                setAccountingSubTab?.('CUSTOMERS');
              },
            },
            {
              key: 'rep-pnl',
              tab: 'reports',
              label: 'قازانج',
              icon: TrendingUp,
              active: activeTab === 'reports' && activeReportSubTab === 'PNL',
              onClick: () => {
                setActiveTab('reports');
                setReportSubTab?.('PNL');
              },
            },
            {
              key: 'more',
              label: 'بەشەکان',
              icon: Menu,
              active: mobileOpen,
              onClick: () => setMobileOpen(prev => !prev),
            },
          ];
        } else {
          items = [
            {
              key: 'dash',
              tab: 'dashboard',
              label: 'سەرەکی',
              icon: LayoutDashboard,
              active: activeTab === 'dashboard',
              onClick: () => setActiveTab('dashboard'),
            },
            {
              key: 'intake',
              tab: 'intake',
              label: 'وەرگرتن',
              icon: Truck,
              active: activeTab === 'intake',
              onClick: () => setActiveTab('intake'),
            },
            {
              key: 'rep-sales',
              tab: 'rep-sales',
              label: 'فرۆشتن',
              icon: Send,
              active: activeTab === 'rep-sales',
              onClick: () => setActiveTab('rep-sales'),
            },
            {
              key: 'pos',
              tab: 'pos',
              label: 'شۆرۆم',
              icon: ShoppingBag,
              active: activeTab === 'pos',
              onClick: () => {
                setActiveTab('pos');
                setPosSubTab?.('REGISTER');
              },
            },
            {
              key: 'more',
              label: 'بەشەکان',
              icon: Menu,
              active: mobileOpen,
              onClick: () => setMobileOpen(prev => !prev),
            },
          ];
        }

        const visibleItems = items.filter(
          item => item.key === 'more' || !item.tab || hasAccess(item.tab)
        );

        return (
          <nav
            aria-label="مینیوی خوارەوەی مۆبایل"
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-black/[0.08] pb-safe no-print shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
          >
            <div
              className="grid items-center h-16 px-1"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleItems.length)}, minmax(0, 1fr))` }}
            >
              {visibleItems.map(navItem => {
                const NavIcon = navItem.icon;
                return (
                  <button
                    key={navItem.key}
                    type="button"
                    onClick={navItem.onClick}
                    className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all active:scale-95 ${
                      navItem.active ? 'text-[#0071E3] font-extrabold' : 'text-[#86868B] font-semibold'
                    }`}
                  >
                    <span
                      className={`px-3 py-0.5 rounded-full transition-colors ${
                        navItem.active ? 'bg-[#0071E3]/12' : ''
                      }`}
                    >
                      <NavIcon className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] leading-none">{navItem.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        );
      })()}

      {/* iOS / Browser Manual Add-to-Home-Screen Guide Modal */}
      {showIosInstallModal && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 no-print"
          onClick={() => setShowIosInstallModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-black/[0.06] space-y-4 apple-sheet"
          >
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-2.5">
                <img src="/icon.svg" alt="FFC" className="w-10 h-10 rounded-xl shadow-xs" />
                <div>
                  <h3 className="text-sm font-black text-[#1D1D1F]">دابەزاندنی ئەپی FFC-ERP</h3>
                  <p className="text-[11px] text-[#86868B]">وەک ئەپێکی سەربەخۆ لەسەر مۆبایلەکەت</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosInstallModal(false)}
                className="w-7 h-7 rounded-full bg-[#F5F5F7] text-[#86868B] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#1D1D1F] leading-relaxed">
              <div className="p-3 rounded-2xl bg-[#F5F5F7] space-y-1.5">
                <div className="font-extrabold text-[#0071E3] flex items-center gap-1.5">
                  <Share className="w-3.5 h-3.5" />
                  <span>بۆ ئایفۆن و ئایپاد (Safari):</span>
                </div>
                <p>
                  ١. لە خوارەوەی شاشە کلیک لە دوگمەی <strong>Share (⬆️)</strong> بکە.<br />
                  ٢. هەڵبژێرە <strong>Add to Home Screen</strong> (زیادکردن بۆ شاشەی سەرەکی).<br />
                  ٣. کلیک لە <strong>Add</strong> بکە.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#F5F5F7] space-y-1.5">
                <div className="font-extrabold text-[#248A3D] flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>بۆ ئەندرۆید (Chrome):</span>
                </div>
                <p>
                  لە سێ خاڵەکەی سەرەوە (⋮) کلیک لە <strong>Install App</strong> یان <strong>Add to Home Screen</strong> بکە.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosInstallModal(false)}
              className="w-full py-2.5 rounded-full bg-[#0071E3] text-white font-bold text-xs"
            >
              تێگەیشتم
            </button>
          </div>
        </div>
      )}

      {/* Change Own Password Modal (non-SuperAdmin) */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="apple-sheet bg-white rounded-[24px] max-w-sm w-full p-6 shadow-2xl border border-black/[0.06]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/[0.06]">
              <h3 className="text-sm font-black text-[#1D1D1F] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#0071E3]" />
                گۆڕینی وشەی نهێنی
              </h3>
              <button
                type="button"
                onClick={() => setShowPwdModal(false)}
                className="p-1.5 rounded-full hover:bg-black/[0.05] text-[#86868B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">وشەی نهێنی ئێستا *</label>
                <div className="relative">
                  <input
                    type={showCurrPwd ? 'text' : 'password'}
                    required
                    value={currPwd}
                    onChange={e => setCurrPwd(e.target.value)}
                    className="apple-input w-full px-3.5 py-2.5 pl-9 text-left font-bold"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrPwd(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]"
                    tabIndex={-1}
                  >
                    {showCurrPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">وشەی نهێنی نوێ *</label>
                <input
                  type={showCurrPwd ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  className="apple-input w-full px-3.5 py-2.5 text-left font-bold"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">دووپاتکردنەوەی وشەی نهێنی نوێ *</label>
                <input
                  type={showCurrPwd ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  className="apple-input w-full px-3.5 py-2.5 text-left font-bold"
                  dir="ltr"
                />
              </div>

              {pwdStatus && (
                <div
                  className={`p-2.5 rounded-xl font-bold text-center ${
                    pwdStatus.ok
                      ? 'bg-[#34C759]/12 text-[#248A3D]'
                      : 'bg-[#FF3B30]/10 text-[#D70015]'
                  }`}
                >
                  {pwdStatus.msg}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="w-1/2 py-2.5 bg-[#F5F5F7] text-[#515154] rounded-full font-semibold cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="w-1/2 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-60 text-white font-bold rounded-full cursor-pointer"
                >
                  {pwdSaving ? 'چاوەڕێ بە...' : 'پاشەکەوتکردن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
