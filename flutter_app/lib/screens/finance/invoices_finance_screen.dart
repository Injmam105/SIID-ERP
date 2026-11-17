import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';

class InvoicesFinanceScreen extends StatefulWidget {
  const InvoicesFinanceScreen({super.key});

  @override
  State<InvoicesFinanceScreen> createState() => _InvoicesFinanceScreenState();
}

class _InvoicesFinanceScreenState extends State<InvoicesFinanceScreen> {
  String _tab = 'INVOICES';

  void _recordPaymentDialog(Map<String, dynamic> inv) {
    final amtCtrl = TextEditingController(text: '${inv['outstanding_balance']}');
    final refCtrl = TextEditingController();
    String method = 'Bank Transfer / NEFT';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Record Payment · ${inv['invoice_number']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: amtCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount Paid (INR)')),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: method,
              decoration: const InputDecoration(labelText: 'Payment Method'),
              items: const [
                DropdownMenuItem(value: 'Bank Transfer / NEFT', child: Text('Bank Transfer / NEFT')),
                DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                DropdownMenuItem(value: 'Cheque', child: Text('Cheque')),
                DropdownMenuItem(value: 'Cash', child: Text('Cash')),
              ],
              onChanged: (v) => method = v ?? method,
            ),
            const SizedBox(height: 8),
            TextField(controller: refCtrl, decoration: const InputDecoration(labelText: 'Verified Transaction Reference *')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/payments', {
                'paymentDirection': 'INCOME',
                'clientId': inv['client_id'],
                'projectId': inv['project_id'],
                'invoiceId': inv['id'],
                'amount': double.tryParse(amtCtrl.text) ?? 0,
                'paymentMethod': method,
                'transactionRef': refCtrl.text.trim(),
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Record Verified Payment'),
          ),
        ],
      ),
    );
  }

  void _addExpenseDialog() {
    final erp = context.read<ErpProvider>();
    String category = 'Site Expenses';
    String? projectId = erp.projects.isNotEmpty ? erp.projects.first['id'].toString() : null;
    final descCtrl = TextEditingController();
    final amtCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Record Expense'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: category,
                decoration: const InputDecoration(labelText: 'Expense Category'),
                items: const [
                  'Materials',
                  'Transportation',
                  'Daily Wages',
                  'Salary',
                  'Equipment',
                  'Site Expenses',
                  'Office Expenses',
                ].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                onChanged: (v) => category = v ?? category,
              ),
              const SizedBox(height: 8),
              if (erp.projects.isNotEmpty)
                DropdownButtonFormField<String>(
                  value: projectId,
                  decoration: const InputDecoration(labelText: 'Project'),
                  items: erp.projects.map((p) => DropdownMenuItem(value: p['id'].toString(), child: Text('${p['project_name']}'))).toList(),
                  onChanged: (v) => projectId = v,
                ),
              const SizedBox(height: 8),
              TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Description *')),
              const SizedBox(height: 8),
              TextField(controller: amtCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount (INR) *')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/expenses', {
                'category': category,
                'projectId': projectId,
                'description': descCtrl.text.trim(),
                'amount': double.tryParse(amtCtrl.text) ?? 0,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await erp.syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Save Expense'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: 'Rs. ', decimalDigits: 0);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'INVOICES', label: Text('Invoices')),
                ButtonSegment(value: 'EXPENSES', label: Text('Expenses')),
                ButtonSegment(value: 'PNL', label: Text('Profit & Loss')),
              ],
              selected: {_tab},
              onSelectionChanged: (s) => setState(() => _tab = s.first),
            ),
            if (_tab == 'EXPENSES')
              ElevatedButton.icon(onPressed: _addExpenseDialog, icon: const Icon(Icons.add), label: const Text('Add Expense')),
          ],
        ),
        const SizedBox(height: 16),
        if (_tab == 'INVOICES')
          ...erp.invoices.map((inv) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  title: Text('${inv['invoice_number']} · ${inv['client_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(
                    'Total: ${inr.format(num.tryParse('${inv['grand_total']}') ?? 0)} · Paid: ${inr.format(num.tryParse('${inv['amount_paid']}') ?? 0)} · Due: ${inr.format(num.tryParse('${inv['outstanding_balance']}') ?? 0)} · ${inv['status']}',
                  ),
                  trailing: inv['status'] != 'PAID'
                      ? ElevatedButton(onPressed: () => _recordPaymentDialog(inv), child: const Text('Record Payment'))
                      : null,
                ),
              ))
        else if (_tab == 'EXPENSES')
          ...erp.expenses.map((ex) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  title: Text('${ex['category']} — ${ex['description']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${ex['expense_date']} · ${ex['project_name'] ?? 'General'}'),
                  trailing: Text(inr.format(num.tryParse('${ex['amount']}') ?? 0), style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ))
        else
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total Income: ${inr.format(num.tryParse('${erp.financeSummary['totalIncome'] ?? 0}') ?? 0)}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text('Total Expenses: ${inr.format(num.tryParse('${erp.financeSummary['totalExpenses'] ?? 0}') ?? 0)}'),
                  Text('Net Profit: ${inr.format(num.tryParse('${erp.financeSummary['netProfit'] ?? 0}') ?? 0)}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  Text('Outstanding Receivables: ${inr.format(num.tryParse('${erp.financeSummary['totalOutstanding'] ?? 0}') ?? 0)}'),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
