import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';

class EmployeesClientsScreen extends StatefulWidget {
  final bool showClients;
  const EmployeesClientsScreen({super.key, this.showClients = false});

  @override
  State<EmployeesClientsScreen> createState() => _EmployeesClientsScreenState();
}

class _EmployeesClientsScreenState extends State<EmployeesClientsScreen> {
  String _search = '';

  void _openAddEmployeeDialog() {
    final nameCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final pwCtrl = TextEditingController();
    final salaryCtrl = TextEditingController(text: '0');
    final wageCtrl = TextEditingController(text: '0');
    String role = 'PERMANENT_EMPLOYEE';
    String empType = 'PERMANENT';
    String? err;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => AlertDialog(
          title: const Text('Add SIID Employee'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (err != null) Text(err!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Full Name *')),
                const SizedBox(height: 8),
                TextField(controller: mobileCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: '10-Digit Mobile *')),
                const SizedBox(height: 8),
                TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: const [
                    DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                    DropdownMenuItem(value: 'ACCOUNTANT', child: Text('Accountant')),
                    DropdownMenuItem(value: 'SITE_MANAGER', child: Text('Site Manager')),
                    DropdownMenuItem(value: 'INTERIOR_DESIGNER', child: Text('Interior Designer')),
                    DropdownMenuItem(value: 'PERMANENT_EMPLOYEE', child: Text('Permanent Employee')),
                    DropdownMenuItem(value: 'CONTRACT_EMPLOYEE', child: Text('Contract Employee')),
                    DropdownMenuItem(value: 'DAILY_WAGE_LABOUR', child: Text('Daily Wage Labour')),
                  ],
                  onChanged: (v) => setModal(() {
                    role = v ?? 'PERMANENT_EMPLOYEE';
                    empType = role == 'DAILY_WAGE_LABOUR'
                        ? 'DAILY_WAGE'
                        : role == 'CONTRACT_EMPLOYEE'
                            ? 'CONTRACT'
                            : 'PERMANENT';
                  }),
                ),
                const SizedBox(height: 8),
                TextField(controller: salaryCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Monthly Salary / Contract Amount')),
                const SizedBox(height: 8),
                TextField(controller: wageCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Daily Wage Rate')),
                const SizedBox(height: 8),
                TextField(controller: pwCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Initial Strong Password *')),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                try {
                  await context.read<ApiService>().post('/employees', {
                    'fullName': nameCtrl.text.trim(),
                    'mobile': mobileCtrl.text.trim(),
                    'email': emailCtrl.text.trim(),
                    'password': pwCtrl.text,
                    'role': role,
                    'employeeType': empType,
                    'salaryAmount': double.tryParse(salaryCtrl.text) ?? 0,
                    'dailyWageRate': double.tryParse(wageCtrl.text) ?? 0,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
                } catch (e) {
                  setModal(() => err = e.toString());
                }
              },
              child: const Text('Create Employee'),
            ),
          ],
        ),
      ),
    );
  }

  void _openAddClientDialog() {
    final nameCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final gstinCtrl = TextEditingController();
    final pwCtrl = TextEditingController();
    String? err;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => AlertDialog(
          title: const Text('Add SIID Client'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (err != null) Text(err!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Client Name *')),
                const SizedBox(height: 8),
                TextField(controller: mobileCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: '10-Digit Mobile *')),
                const SizedBox(height: 8),
                TextField(controller: emailCtrl, decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 8),
                TextField(controller: cityCtrl, decoration: const InputDecoration(labelText: 'City')),
                const SizedBox(height: 8),
                TextField(controller: gstinCtrl, decoration: const InputDecoration(labelText: 'GSTIN (Optional)')),
                const SizedBox(height: 8),
                TextField(controller: pwCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'Portal Password (Optional)')),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                try {
                  await context.read<ApiService>().post('/clients', {
                    'clientName': nameCtrl.text.trim(),
                    'mobile': mobileCtrl.text.trim(),
                    'email': emailCtrl.text.trim(),
                    'city': cityCtrl.text.trim(),
                    'gstin': gstinCtrl.text.trim(),
                    if (pwCtrl.text.isNotEmpty) 'password': pwCtrl.text,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
                } catch (e) {
                  setModal(() => err = e.toString());
                }
              },
              child: const Text('Create Client'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    final auth = context.watch<AuthProvider>();
    final list = widget.showClients ? erp.clients : erp.employees;
    final filtered = list.where((item) {
      if (_search.isEmpty) return true;
      return item.values.join(' ').toLowerCase().contains(_search.toLowerCase());
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(widget.showClients ? 'Client Directory & Approvals' : 'Employee & Labour Management',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            ElevatedButton.icon(
              onPressed: widget.showClients ? _openAddClientDialog : _openAddEmployeeDialog,
              icon: const Icon(Icons.person_add),
              label: Text(widget.showClients ? 'Add Client' : 'Add Employee'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by name, mobile, or ID...'),
          onChanged: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Center(child: Text(widget.showClients ? 'No clients registered yet.' : 'No employees added yet.')),
            ),
          )
        else
          ...filtered.map((row) {
            final status = '${row['status'] ?? ''}';
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text(
                  widget.showClients ? '${row['client_code']} · ${row['client_name']}' : '${row['employee_code']} · ${row['full_name']}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  widget.showClients
                      ? 'Mobile: ${row['mobile']} · City: ${row['city'] ?? '-'} · Status: $status'
                      : '${row['employee_type']} · ${row['user_role'] ?? ''} · Mobile: ${row['mobile']} · Status: $status',
                ),
                trailing: Wrap(
                  spacing: 6,
                  children: [
                    if (status == 'PENDING_APPROVAL') ...[
                      ElevatedButton(
                        onPressed: () async {
                          final endpoint = widget.showClients
                              ? '/clients/${row['id']}/approval'
                              : '/employees/${row['id']}/approval';
                          await context.read<ApiService>().post(endpoint, {'decision': 'APPROVE'});
                          await erp.syncAllForRole(auth.role);
                        },
                        child: const Text('Approve'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          final endpoint = widget.showClients
                              ? '/clients/${row['id']}/approval'
                              : '/employees/${row['id']}/approval';
                          await context.read<ApiService>().post(endpoint, {'decision': 'REJECT'});
                          await erp.syncAllForRole(auth.role);
                        },
                        child: const Text('Reject'),
                      ),
                    ] else if (!widget.showClients)
                      OutlinedButton(
                        onPressed: () async {
                          await context.read<ApiService>().post('/employees/${row['id']}/approval', {
                            'decision': status == 'ACTIVE' ? 'DEACTIVATE' : 'REACTIVATE',
                          });
                          await erp.syncAllForRole(auth.role);
                        },
                        child: Text(status == 'ACTIVE' ? 'Deactivate' : 'Reactivate'),
                      ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }
}
