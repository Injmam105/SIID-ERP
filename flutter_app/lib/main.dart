import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/erp_provider.dart';
import 'screens/admin/admin_dashboard_screen.dart';
import 'screens/admin/employees_clients_screen.dart';
import 'screens/admin/quotation_management_screen.dart';
import 'screens/auth/welcome_login_screen.dart';
import 'screens/client/client_portal_screen.dart';
import 'screens/employee/employee_portal_screen.dart';
import 'screens/finance/invoices_finance_screen.dart';
import 'screens/inventory/inventory_vendors_screen.dart';
import 'screens/projects/projects_sites_screen.dart';
import 'screens/settings/company_settings_screen.dart';
import 'services/api_service.dart';
import 'theme/siid_theme.dart';
import 'widgets/siid_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiService();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthProvider(api)..checkSetupAndRestoreSession()),
        ChangeNotifierProvider(create: (_) => ErpProvider(api)),
      ],
      child: const SiidErpApp(),
    ),
  );
}

class SiidErpApp extends StatelessWidget {
  const SiidErpApp({super.key});

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    return MaterialApp(
      title: 'SIID ERP — Sirahi Infrastructure & Interior Design',
      debugShowCheckedModeBanner: false,
      theme: SiidTheme.light(),
      darkTheme: SiidTheme.dark(),
      themeMode: erp.darkMode ? ThemeMode.dark : ThemeMode.light,
      home: const _RootGate(),
    );
  }
}

class _RootGate extends StatefulWidget {
  const _RootGate();

  @override
  State<_RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<_RootGate> {
  String _activeKey = 'dashboard';
  String? _syncedUserId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!auth.isAuthenticated) {
      _syncedUserId = null;
      return const WelcomeLoginScreen();
    }

    final uid = auth.user?['id']?.toString();
    if (uid != null && _syncedUserId != uid) {
      _syncedUserId = uid;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<ErpProvider>().syncAllForRole(auth.role);
      });
    }

    if (auth.isClient) {
      return SiidShell(
        activeKey: 'client_home',
        title: 'Client Portal',
        navItems: const [SiidNavItem('client_home', 'My Portal', Icons.home_work_outlined)],
        onSelect: (_) {},
        child: const ClientPortalScreen(),
      );
    }

    if (['PERMANENT_EMPLOYEE', 'CONTRACT_EMPLOYEE', 'DAILY_WAGE_LABOUR'].contains(auth.role)) {
      return SiidShell(
        activeKey: 'emp_home',
        title: 'Employee Portal',
        navItems: const [SiidNavItem('emp_home', 'My Workspace', Icons.badge_outlined)],
        onSelect: (_) {},
        child: const EmployeePortalScreen(),
      );
    }

    final navItems = <SiidNavItem>[
      const SiidNavItem('dashboard', 'Dashboard', Icons.dashboard_outlined),
      if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'INTERIOR_DESIGNER'].contains(auth.role))
        const SiidNavItem('quotations', 'Quotation Management', Icons.request_quote_outlined),
      const SiidNavItem('projects', 'Projects & Sites', Icons.apartment_outlined),
      if (['OWNER', 'ADMIN', 'INTERIOR_DESIGNER'].contains(auth.role))
        const SiidNavItem('interior', 'Interior Design', Icons.design_services_outlined),
      if (['OWNER', 'ADMIN', 'SITE_MANAGER'].contains(auth.role))
        const SiidNavItem('construction', 'Construction Progress', Icons.engineering_outlined),
      if (['OWNER', 'ADMIN', 'SITE_MANAGER', 'ACCOUNTANT'].contains(auth.role))
        const SiidNavItem('inventory', 'Inventory & Vendors', Icons.inventory_2_outlined),
      if (['OWNER', 'ADMIN'].contains(auth.role)) ...[
        const SiidNavItem('employees', 'Employees & Labour', Icons.people_outline),
        const SiidNavItem('clients', 'Clients', Icons.business_center_outlined),
      ],
      if (['OWNER', 'ADMIN', 'ACCOUNTANT'].contains(auth.role))
        const SiidNavItem('finance', 'Invoices & Finance', Icons.account_balance_wallet_outlined),
      const SiidNavItem('attendance', 'My Attendance & IT', Icons.access_time_outlined),
      if (['OWNER', 'ADMIN'].contains(auth.role))
        const SiidNavItem('settings', 'Company Settings', Icons.settings_outlined),
    ];

    if (!navItems.any((n) => n.key == _activeKey)) {
      _activeKey = navItems.first.key;
    }

    Widget body;
    switch (_activeKey) {
      case 'quotations':
        body = const QuotationManagementScreen();
        break;
      case 'projects':
        body = const ProjectsSitesScreen(mode: 'PROJECTS');
        break;
      case 'interior':
        body = const ProjectsSitesScreen(mode: 'INTERIOR');
        break;
      case 'construction':
        body = const ProjectsSitesScreen(mode: 'CONSTRUCTION');
        break;
      case 'inventory':
        body = const InventoryVendorsScreen();
        break;
      case 'employees':
        body = const EmployeesClientsScreen(showClients: false);
        break;
      case 'clients':
        body = const EmployeesClientsScreen(showClients: true);
        break;
      case 'finance':
        body = const InvoicesFinanceScreen();
        break;
      case 'attendance':
        body = const EmployeePortalScreen();
        break;
      case 'settings':
        body = const CompanySettingsScreen();
        break;
      default:
        body = AdminDashboardScreen(onNavigate: (k) => setState(() => _activeKey = k));
    }

    return SiidShell(
      activeKey: _activeKey,
      title: navItems.firstWhere((n) => n.key == _activeKey).label,
      navItems: navItems,
      onSelect: (k) => setState(() => _activeKey = k),
      child: body,
    );
  }
}
