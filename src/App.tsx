import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  Building2,
  ClipboardCheck,
  Clock,
  Compass,
  Download,
  FileSpreadsheet,
  HardHat,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  RefreshCw,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AuthPortal } from './components/AuthPortal.tsx';
import { ClientPortalView, EmployeePortalView } from './components/EmployeeClientPortals.tsx';
import { FinanceSettingsModule } from './components/FinanceSettingsModule.tsx';
import { HrPayrollModule } from './components/HrPayrollModule.tsx';
import { ProjectsInventoryModule } from './components/ProjectsInventoryModule.tsx';
import { QuotationModule } from './components/QuotationModule.tsx';
import {
  apiFetch,
  type AuthUser,
  type CompanySettings,
  formatINR,
  getToken,
  setToken,
} from './lib/api.ts';

type NavKey =
  | 'dashboard'
  | 'quotations'
  | 'projects'
  | 'interior'
  | 'construction'
  | 'inventory'
  | 'employees'
  | 'clients'
  | 'attendance'
  | 'payroll'
  | 'finance'
  | 'notifications'
  | 'settings';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');

  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Record<string, unknown> | null>(null);
  const [dbMode, setDbMode] = useState<string>('sqlite_preview');

  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);
  const [clients, setClients] = useState<Record<string, unknown>[]>([]);
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [sites, setSites] = useState<Record<string, unknown>[]>([]);
  const [attendance, setAttendance] = useState<Record<string, unknown>[]>([]);
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([]);
  const [advances, setAdvances] = useState<Record<string, unknown>[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<Record<string, unknown>[]>([]);
  const [interiorDesigns, setInteriorDesigns] = useState<Record<string, unknown>[]>([]);
  const [constructionStages, setConstructionStages] = useState<Record<string, unknown>[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Record<string, unknown>[]>([]);
  const [stockLedger, setStockLedger] = useState<Record<string, unknown>[]>([]);
  const [vendors, setVendors] = useState<Record<string, unknown>[]>([]);
  const [quotations, setQuotations] = useState<Record<string, unknown>[]>([]);
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [complaints, setComplaints] = useState<Record<string, unknown>[]>([]);
  const [backups, setBackups] = useState<Record<string, unknown>[]>([]);
  const [financeSummary, setFinanceSummary] = useState<Record<string, unknown>>({});

  // Change Password Modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  const syncAll = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setInitializing(false);
      return;
    }
    setSyncing(true);
    try {
      const me = await apiFetch<{
        user: AuthUser;
        company: CompanySettings;
        employee: Record<string, unknown> | null;
        dbMode: string;
      }>('/auth/me');
      setUser(me.user);
      setCompany(me.company);
      setEmployeeProfile(me.employee);
      setDbMode(me.dbMode);
      if (me.user.must_change_password) {
        setShowChangePw(true);
      }

      const role = me.user.role;
      const tasks: Promise<void>[] = [
        apiFetch<Record<string, unknown>[]>('/projects').then(setProjects).catch(() => {}),
        apiFetch<Record<string, unknown>[]>('/sites').then(setSites).catch(() => {}),
        apiFetch<Record<string, unknown>[]>('/interior').then(setInteriorDesigns).catch(() => {}),
        apiFetch<Record<string, unknown>[]>('/notifications').then(setNotifications).catch(() => {}),
      ];

      if (role !== 'CLIENT') {
        tasks.push(
          apiFetch<Record<string, unknown>[]>('/employees').then(setEmployees).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/attendance').then(setAttendance).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/leaves').then(setLeaves).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/advances').then(setAdvances).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/salary').then(setSalaryRecords).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/construction').then(setConstructionStages).catch(() => {}),
          apiFetch<{ items: Record<string, unknown>[]; ledger: Record<string, unknown>[] }>('/inventory')
            .then((d) => {
              setInventoryItems(d.items || []);
              setStockLedger(d.ledger || []);
            })
            .catch(() => {})
        );
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'].includes(role)) {
        tasks.push(
          apiFetch<Record<string, unknown>[]>('/clients').then(setClients).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/vendors').then(setVendors).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/expenses').then(setExpenses).catch(() => {})
        );
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'INTERIOR_DESIGNER', 'CLIENT'].includes(role)) {
        tasks.push(apiFetch<Record<string, unknown>[]>('/quotations').then(setQuotations).catch(() => {}));
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'CLIENT'].includes(role)) {
        tasks.push(
          apiFetch<Record<string, unknown>[]>('/invoices').then(setInvoices).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/payments').then(setPayments).catch(() => {}),
          apiFetch<Record<string, unknown>[]>('/complaints').then(setComplaints).catch(() => {})
        );
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role)) {
        tasks.push(apiFetch<Record<string, unknown>>('/finance/summary').then(setFinanceSummary).catch(() => {}));
      }

      if (['OWNER', 'ADMIN'].includes(role)) {
        tasks.push(apiFetch<Record<string, unknown>[]>('/backups').then(setBackups).catch(() => {}));
      }

      await Promise.all(tasks);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setSyncing(false);
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    syncAll();
  }, [syncAll]);

  const navItems = useMemo(() => {
    if (!user) return [];
    const r = user.role;
    if (r === 'CLIENT') {
      return [
        { key: 'dashboard' as NavKey, label: 'Client Portal', icon: Building2 },
        { key: 'notifications' as NavKey, label: 'Notifications', icon: Bell },
      ];
    }
    if (['PERMANENT_EMPLOYEE', 'CONTRACT_EMPLOYEE', 'DAILY_WAGE_LABOUR'].includes(r)) {
      return [
        { key: 'dashboard' as NavKey, label: 'Employee Workspace', icon: HardHat },
        { key: 'notifications' as NavKey, label: 'Notifications', icon: Bell },
      ];
    }

    const items: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] = [
      { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    ];
    if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'INTERIOR_DESIGNER'].includes(r)) {
      items.push({ key: 'quotations', label: 'Quotation Management', icon: FileSpreadsheet });
    }
    items.push({ key: 'projects', label: 'Projects & Sites', icon: Briefcase });
    if (['OWNER', 'ADMIN', 'INTERIOR_DESIGNER'].includes(r)) {
      items.push({ key: 'interior', label: 'Interior Design', icon: Compass });
    }
    if (['OWNER', 'ADMIN', 'SITE_MANAGER'].includes(r)) {
      items.push({ key: 'construction', label: 'Construction Work', icon: HardHat });
    }
    if (['OWNER', 'ADMIN', 'SITE_MANAGER', 'ACCOUNTANT'].includes(r)) {
      items.push({ key: 'inventory', label: 'Inventory & Vendors', icon: Package });
    }
    if (['OWNER', 'ADMIN'].includes(r)) {
      items.push({ key: 'employees', label: 'Employees & Labour', icon: Users });
      items.push({ key: 'clients', label: 'Clients', icon: Building2 });
    }
    items.push({ key: 'attendance', label: 'Attendance & Leaves', icon: Clock });
    if (['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(r)) {
      items.push({ key: 'payroll', label: 'Salary & Wages', icon: ClipboardCheck });
      items.push({ key: 'finance', label: 'Invoices & Finance', icon: Wallet });
    }
    items.push({ key: 'notifications', label: 'Notifications', icon: Bell });
    if (['OWNER', 'ADMIN'].includes(r)) {
      items.push({ key: 'settings', label: 'Company Settings', icon: Settings });
    }
    return items;
  }, [user]);

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((n) => n.key === activeNav)) {
      setActiveNav(navItems[0].key);
    }
  }, [navItems, activeNav]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#07111E] text-sm font-medium">
        Loading SIID ERP...
      </div>
    );
  }

  if (!user || !company) {
    return (
      <AuthPortal
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        onAuthenticated={syncAll}
      />
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const pendingApprovals =
    employees.filter((e) => e.status === 'PENDING_APPROVAL').length +
    clients.filter((c) => c.status === 'PENDING_APPROVAL').length;
  const lowStockCount = inventoryItems.filter(
    (i) => Number(i.stock_available) <= Number(i.min_stock_alert)
  ).length;
  const incomeVal = Number(financeSummary.totalIncome || 0);
  const expenseVal = Number(financeSummary.totalExpenses || 0);
  const maxBar = Math.max(1, incomeVal, expenseVal);

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#07111E] text-[#0B1F3A] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#0B1F3A] text-white border-r border-slate-800">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center">
            <img
              src={company.logo_url || '/src/assets/images/siid_company_logo_1794819635021.jpg'}
              alt="SIID"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-base tracking-tight truncate">SIID ERP</div>
            <div className="text-[11px] text-[#E5C158] truncate">{user.role.replace(/_/g, ' ')}</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveNav(item.key)}
                className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                  active ? 'bg-[#1D4ED8] text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.key === 'notifications' && unreadCount > 0 && (
                  <span className="font-mono text-[11px] text-[#E5C158]">{unreadCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2.5 text-xs">
          <div>
            <div className="font-semibold truncate">{user.full_name}</div>
            <div className="text-slate-400 font-mono tabular-nums">
              {user.user_code} · IT: {company.it_support_number}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowChangePw(true)}
              className="flex-1 py-1.5 px-2 rounded border border-white/15 hover:bg-white/10 text-[11px] flex items-center justify-center gap-1"
            >
              <KeyRound className="w-3 h-3" /> Password
            </button>
            <button
              type="button"
              onClick={() => {
                setToken(null);
                setUser(null);
              }}
              className="flex-1 py-1.5 px-2 rounded border border-white/15 hover:bg-white/10 text-[11px] flex items-center justify-center gap-1"
            >
              <LogOut className="w-3 h-3" /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-[#0B1F3A] text-white flex flex-col p-4 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-display font-bold">SIID ERP</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 ${
                      activeNav === item.key ? 'bg-[#1D4ED8] text-white' : 'text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setToken(null);
                setUser(null);
              }}
              className="py-2 rounded border border-white/20 text-xs"
            >
              Logout
            </button>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1728] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
              aria-label="Open Navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium truncate">
              <span className="text-slate-500">{company.company_name}</span>
              <span className="mx-2 text-slate-400">/</span>
              <span className="font-semibold">
                {navItems.find((n) => n.key === activeNav)?.label || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs font-mono text-slate-500">
              {syncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline'} · {dbMode === 'mysql' ? 'MySQL' : 'SQL'}
            </span>
            <button
              type="button"
              onClick={syncAll}
              title="Sync Cloud Data"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              title="Toggle Light / Dark Mode"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4 text-[#C69B2D]" /> : <Moon className="w-4 h-4" />}
            </button>
            <a
              href="/api/export-flutter-bundle"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Flutter + MySQL (.zip)
            </a>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto">
          {user.role === 'CLIENT' && activeNav === 'dashboard' && (
            <ClientPortalView
              user={user}
              company={company}
              projects={projects}
              quotations={quotations}
              invoices={invoices}
              payments={payments}
              complaints={complaints}
              onRefresh={syncAll}
            />
          )}

          {['PERMANENT_EMPLOYEE', 'CONTRACT_EMPLOYEE', 'DAILY_WAGE_LABOUR'].includes(user.role) &&
            activeNav === 'dashboard' && (
              <EmployeePortalView
                user={user}
                company={company}
                employeeProfile={employeeProfile}
                projects={projects}
                attendance={attendance}
                leaves={leaves}
                advances={advances}
                salaryRecords={salaryRecords}
                onRefresh={syncAll}
              />
            )}

          {!['CLIENT', 'PERMANENT_EMPLOYEE', 'CONTRACT_EMPLOYEE', 'DAILY_WAGE_LABOUR'].includes(user.role) &&
            activeNav === 'dashboard' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display font-bold text-2xl">
                      Welcome, {user.full_name}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {company.company_name} · GSTIN: {company.gstin} · {company.tagline}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {['OWNER', 'ADMIN', 'ACCOUNTANT', 'INTERIOR_DESIGNER'].includes(user.role) && (
                      <button
                        type="button"
                        onClick={() => setActiveNav('quotations')}
                        className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
                      >
                        Open Quotation Generator
                      </button>
                    )}
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    {
                      label: 'Active Projects',
                      value: projects.length,
                      meta: `${projects.filter((p) => p.status === 'ONGOING').length} ongoing · ${sites.length} sites`,
                      nav: 'projects' as NavKey,
                    },
                    {
                      label: 'Quotations',
                      value: quotations.length,
                      meta: `${quotations.filter((q) => q.status === 'APPROVED').length} approved`,
                      nav: 'quotations' as NavKey,
                    },
                    {
                      label: 'Pending Approvals',
                      value: pendingApprovals,
                      meta: `${employees.length} staff · ${clients.length} clients`,
                      nav: 'employees' as NavKey,
                    },
                    {
                      label: 'Inventory Alerts',
                      value: lowStockCount,
                      meta: `${inventoryItems.length} materials tracked`,
                      nav: 'inventory' as NavKey,
                    },
                    {
                      label: 'Net Cash Position',
                      value: formatINR(financeSummary.netProfit as number),
                      meta: `Receivables: ${formatINR(financeSummary.totalOutstanding as number)}`,
                      nav: 'finance' as NavKey,
                    },
                  ].map((k) => (
                    <button
                      key={k.label}
                      type="button"
                      onClick={() => {
                        if (navItems.some((n) => n.key === k.nav)) setActiveNav(k.nav);
                      }}
                      className="text-left bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-[#1D4ED8] transition-colors"
                    >
                      <div className="text-xs text-slate-500">{k.label}</div>
                      <div className="mt-1.5 text-xl font-bold font-mono tabular-nums">{k.value}</div>
                      <div className="mt-1 text-xs text-slate-500 truncate">{k.meta}</div>
                    </button>
                  ))}
                </div>

                {/* Live Chart & Recent Activity */}
                <div className="grid lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                    <h3 className="font-display font-semibold text-sm">Financial Cash Flow Overview (INR)</h3>
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-mono tabular-nums">
                          <span>Verified Income</span>
                          <span className="font-semibold">{formatINR(incomeVal)}</span>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#1D4ED8]" style={{ width: `${(incomeVal / maxBar) * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-mono tabular-nums">
                          <span>Recorded Expenses &amp; Payroll</span>
                          <span className="font-semibold">{formatINR(expenseVal)}</span>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#C69B2D]" style={{ width: `${(expenseVal / maxBar) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                    <h3 className="font-display font-semibold text-sm">Latest Notifications</h3>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div key={String(n.id)} className="text-xs py-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="font-semibold">{String(n.title)}</div>
                          <div className="text-slate-500">{String(n.message)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

          {activeNav === 'quotations' && (
            <QuotationModule quotations={quotations} clients={clients} company={company} onRefresh={syncAll} />
          )}

          {(activeNav === 'employees' ||
            activeNav === 'clients' ||
            activeNav === 'attendance' ||
            activeNav === 'payroll') && (
            <HrPayrollModule
              activeSection={activeNav}
              user={user}
              company={company}
              employees={employees}
              clients={clients}
              projects={projects}
              attendance={attendance}
              leaves={leaves}
              advances={advances}
              salaryRecords={salaryRecords}
              onRefresh={syncAll}
            />
          )}

          {(activeNav === 'projects' ||
            activeNav === 'interior' ||
            activeNav === 'construction' ||
            activeNav === 'inventory') && (
            <ProjectsInventoryModule
              activeSection={activeNav}
              user={user}
              projects={projects}
              sites={sites}
              clients={clients}
              employees={employees}
              interiorDesigns={interiorDesigns}
              constructionStages={constructionStages}
              inventoryItems={inventoryItems}
              stockLedger={stockLedger}
              vendors={vendors}
              onRefresh={syncAll}
            />
          )}

          {(activeNav === 'finance' || activeNav === 'notifications' || activeNav === 'settings') && (
            <FinanceSettingsModule
              activeSection={activeNav}
              user={user}
              company={company}
              clients={clients}
              projects={projects}
              invoices={invoices}
              payments={payments}
              expenses={expenses}
              financeSummary={financeSummary}
              notifications={notifications}
              backups={backups}
              onRefresh={syncAll}
            />
          )}
        </main>
      </div>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPwErr(null);
              try {
                await apiFetch('/auth/change-password', {
                  method: 'POST',
                  body: JSON.stringify({ currentPassword: curPw, newPassword: newPw, confirmPassword: confirmPw }),
                });
                setShowChangePw(false);
                setCurPw('');
                setNewPw('');
                setConfirmPw('');
                await syncAll();
              } catch (err) {
                setPwErr((err as Error).message);
              }
            }}
            className="bg-white dark:bg-[#0F1D32] max-w-sm w-full rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-3"
          >
            <h3 className="font-display font-bold text-base">Change Password</h3>
            {pwErr && <p className="text-xs text-red-600">{pwErr}</p>}
            <input
              type="password"
              required
              placeholder="Current Password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            />
            <input
              type="password"
              required
              placeholder="New Strong Password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            />
            <input
              type="password"
              required
              placeholder="Confirm New Password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            />
            <div className="flex justify-end gap-2 pt-2">
              {!user.must_change_password && (
                <button
                  type="button"
                  onClick={() => setShowChangePw(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold">
                Update Password
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
