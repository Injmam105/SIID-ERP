import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../theme/siid_theme.dart';

class AdminDashboardScreen extends StatelessWidget {
  final ValueChanged<String> onNavigate;
  const AdminDashboardScreen({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    final auth = context.watch<AuthProvider>();
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: 'Rs. ', decimalDigits: 0);

    final activeProjects = erp.projects.where((p) => p['status'] == 'ONGOING').length;
    final pendingApprovals = erp.employees.where((e) => e['status'] == 'PENDING_APPROVAL').length +
        erp.clients.where((c) => c['status'] == 'PENDING_APPROVAL').length;
    final lowStock = erp.inventoryItems
        .where((i) => (num.tryParse('${i['stock_available']}') ?? 0) <= (num.tryParse('${i['min_stock_alert']}') ?? 0))
        .length;
    final income = num.tryParse('${erp.financeSummary['totalIncome'] ?? 0}') ?? 0;
    final expense = num.tryParse('${erp.financeSummary['totalExpenses'] ?? 0}') ?? 0;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('Welcome, ${auth.user?['full_name'] ?? 'Director'}',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Text('${auth.company?['company_name'] ?? 'Sirahi Infrastructure & Interior Design'} · Live Cloud Overview',
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
        const SizedBox(height: 20),
        Wrap(
          spacing: 14,
          runSpacing: 14,
          children: [
            _kpiCard('Total Projects', '${erp.projects.length}', '$activeProjects Ongoing', Icons.apartment, () => onNavigate('projects')),
            _kpiCard('Quotations', '${erp.quotations.length}', 'Material & Brand Specs', Icons.request_quote, () => onNavigate('quotations')),
            _kpiCard('Pending Approvals', '$pendingApprovals', 'Employees & Clients', Icons.verified_user, () => onNavigate('employees')),
            _kpiCard('Low Stock Alerts', '$lowStock', '${erp.inventoryItems.length} Total Materials', Icons.inventory_2, () => onNavigate('inventory')),
            _kpiCard('Total Income', inr.format(income), 'Expenses: ${inr.format(expense)}', Icons.account_balance_wallet, () => onNavigate('finance')),
          ],
        ),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Income vs Expenses Snapshot', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 16),
                SizedBox(
                  height: 200,
                  child: BarChart(
                    BarChartData(
                      borderData: FlBorderData(show: false),
                      titlesData: FlTitlesData(
                        leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            getTitlesWidget: (val, _) => Text(val.toInt() == 0 ? 'Income' : 'Expense', style: const TextStyle(fontSize: 12)),
                          ),
                        ),
                      ),
                      barGroups: [
                        BarChartGroupData(x: 0, barRods: [BarChartRodData(toY: income.toDouble(), width: 32, color: SiidTheme.royalBlue)]),
                        BarChartGroupData(x: 1, barRods: [BarChartRodData(toY: expense.toDouble(), width: 32, color: SiidTheme.elegantGold)]),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Recent Notifications', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                const SizedBox(height: 10),
                if (erp.notifications.isEmpty)
                  const Text('No notifications yet.', style: TextStyle(color: Color(0xFF64748B)))
                else
                  ...erp.notifications.take(5).map((n) => ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text('${n['title'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                        subtitle: Text('${n['message'] ?? ''}', style: const TextStyle(fontSize: 12.5)),
                      )),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _kpiCard(String label, String value, String sub, IconData icon, VoidCallback onTap) {
    return SizedBox(
      width: 220,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(label, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                    Icon(icon, size: 18, color: SiidTheme.royalBlue),
                  ],
                ),
                const SizedBox(height: 10),
                Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(sub, style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
