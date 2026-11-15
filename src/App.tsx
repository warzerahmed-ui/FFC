import { useState, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Menubar } from './components/layout/Menubar';
import type { PosSubTab } from './components/pos/POSView';
import type { AccountingSubTab } from './components/accounting/AccountingView';
import type { ReportSubTab } from './components/reports/ReportsView';
import { TabType } from './types';
import { LoginScreen } from './components/auth/LoginScreen';

const DashboardView = lazy(() =>
  import('./components/dashboard/DashboardView').then(m => ({ default: m.DashboardView }))
);
const LiveIntakeView = lazy(() =>
  import('./components/intake/LiveIntakeView').then(m => ({ default: m.LiveIntakeView }))
);
const SlaughterCuttingView = lazy(() =>
  import('./components/production/SlaughterCuttingView').then(m => ({ default: m.SlaughterCuttingView }))
);
const ReadyForSaleView = lazy(() =>
  import('./components/ready/ReadyForSaleView').then(m => ({ default: m.ReadyForSaleView }))
);
const CustodyView = lazy(() =>
  import('./components/custody/CustodyView').then(m => ({ default: m.CustodyView }))
);
const RepSalesView = lazy(() =>
  import('./components/reps/RepSalesView').then(m => ({ default: m.RepSalesView }))
);
const GiftsView = lazy(() =>
  import('./components/gifts/GiftsView').then(m => ({ default: m.GiftsView }))
);
const POSView = lazy(() =>
  import('./components/pos/POSView').then(m => ({ default: m.POSView }))
);
const AccountingView = lazy(() =>
  import('./components/accounting/AccountingView').then(m => ({ default: m.AccountingView }))
);
const ReportsView = lazy(() =>
  import('./components/reports/ReportsView').then(m => ({ default: m.ReportsView }))
);
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then(m => ({ default: m.SettingsView }))
);

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [posSubTab, setPosSubTab] = useState<PosSubTab>('REGISTER');
  const [accountingSubTab, setAccountingSubTab] = useState<AccountingSubTab>('VOUCHERS');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('PNL');
  const [selectedIntakeForProductionId, setSelectedIntakeForProductionId] = useState<string | null>(null);
  const { hasAccess, currentUser, isAuthenticated, isHydratedFromCloud, factorySettings } = useApp();

  const handleSendToSlaughter = (intakeId: string) => {
    setSelectedIntakeForProductionId(intakeId);
    setActiveTab('production');
  };

  // Redirect if current role/account lacks permission for activeTab
  useEffect(() => {
    if (isAuthenticated && isHydratedFromCloud && !hasAccess(activeTab)) {
      const fallbackOrder: TabType[] = [
        'dashboard',
        'rep-sales',
        'pos',
        'accounting',
        'reports',
        'intake',
        'production',
        'ready-for-sale',
        'custody',
        'gifts',
        'settings',
      ];
      const firstAllowed = fallbackOrder.find(t => hasAccess(t));
      if (firstAllowed && firstAllowed !== activeTab) {
        setActiveTab(firstAllowed);
      }
    }
  }, [currentUser, activeTab, hasAccess, isAuthenticated, isHydratedFromCloud]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (!isHydratedFromCloud) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-6">
        <div className="apple-card p-8 text-center space-y-3 max-w-xs w-full">
          <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-extrabold text-[#1D1D1F]">
            پشکنینی ناسنامە و بارکردنی داتای پارێزراو...
          </div>
          <div className="text-[11px] text-[#86868B]">
            تکایە چاوەڕێ بە تا سێرڤەر دەسەڵاتەکان پشتڕاست دەکاتەوە
          </div>
          <div dir="ltr" className="pt-2 text-[10px] font-black tracking-widest text-[#0071E3]">
            POWERED BY RAND SUITE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3] selection:text-white">
      <Menubar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePosSubTab={posSubTab}
        setPosSubTab={setPosSubTab}
        activeAccountingSubTab={accountingSubTab}
        setAccountingSubTab={setAccountingSubTab}
        activeReportSubTab={reportSubTab}
        setReportSubTab={setReportSubTab}
      />

      <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-[1440px] mx-auto w-full overflow-x-hidden">
        <Suspense
          fallback={
            <div className="apple-card p-10 text-center text-xs font-bold text-[#86868B]">
              بارکردنی بەش...
            </div>
          }
        >
          {activeTab === 'dashboard' && hasAccess('dashboard') && (
            <DashboardView setActiveTab={setActiveTab} />
          )}
          {activeTab === 'intake' && hasAccess('intake') && (
            <LiveIntakeView
              onNavigate={setActiveTab}
              onSendToSlaughter={handleSendToSlaughter}
            />
          )}
          {activeTab === 'production' && hasAccess('production') && (
            <SlaughterCuttingView
              onNavigate={setActiveTab}
              preselectedIntakeId={selectedIntakeForProductionId}
              onClearPreselect={() => setSelectedIntakeForProductionId(null)}
            />
          )}
          {activeTab === 'ready-for-sale' && hasAccess('ready-for-sale') && (
            <ReadyForSaleView onNavigate={setActiveTab} />
          )}
          {activeTab === 'custody' && hasAccess('custody') && (
            <CustodyView onNavigate={setActiveTab} />
          )}
          {activeTab === 'rep-sales' && hasAccess('rep-sales') && <RepSalesView />}
          {activeTab === 'gifts' && hasAccess('gifts') && <GiftsView />}
          {activeTab === 'pos' && hasAccess('pos') && (
            <POSView activeSubTab={posSubTab} onSubTabChange={setPosSubTab} />
          )}
          {activeTab === 'accounting' && hasAccess('accounting') && (
            <AccountingView activeSubTab={accountingSubTab} />
          )}
          {activeTab === 'reports' && hasAccess('reports') && (
            <ReportsView activeReportTab={reportSubTab} />
          )}
          {activeTab === 'settings' && hasAccess('settings') && <SettingsView />}
        </Suspense>
      </main>

      <footer className="no-print border-t border-black/[0.06] bg-white/75 backdrop-blur-md px-4 lg:px-7 py-3 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#86868B]">
          <div className="font-semibold text-[#515154]">
            {factorySettings.factoryName} ({factorySettings.shortCode}) • سیستەمی بەڕێوەبردنی کارگە و فرۆشگا
          </div>
          <div className="inline-flex items-center gap-2 font-semibold">
            <span>دروستکراوە لەلایەن</span>
            <span
              dir="ltr"
              className="px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] font-black tracking-wider text-[10px]"
            >
              RAND SUITE
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
