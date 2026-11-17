import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';

class InventoryVendorsScreen extends StatefulWidget {
  const InventoryVendorsScreen({super.key});

  @override
  State<InventoryVendorsScreen> createState() => _InventoryVendorsScreenState();
}

class _InventoryVendorsScreenState extends State<InventoryVendorsScreen> {
  String _tab = 'INVENTORY';

  void _addMaterialDialog() {
    String category = 'Cement';
    final nameCtrl = TextEditingController();
    final brandCtrl = TextEditingController();
    final unitCtrl = TextEditingController(text: 'Bags');
    final rateCtrl = TextEditingController(text: '0');
    final qtyCtrl = TextEditingController(text: '0');
    final minCtrl = TextEditingController(text: '10');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Inventory Material'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: const [
                  'Cement',
                  'Sand',
                  'Steel',
                  'Bricks',
                  'Tiles',
                  'Marble',
                  'Wood',
                  'Plywood',
                  'Paint',
                  'Electrical Items',
                  'Plumbing Items',
                  'Furniture Hardware',
                  'Tools',
                  'Construction Equipment',
                ].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                onChanged: (v) => category = v ?? category,
              ),
              const SizedBox(height: 8),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Material Name *')),
              const SizedBox(height: 8),
              TextField(controller: brandCtrl, decoration: const InputDecoration(labelText: 'Brand / Company')),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Opening Stock'))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit'))),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: TextField(controller: rateCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Purchase Rate'))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: minCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Low Alert Qty'))),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/inventory', {
                'category': category,
                'materialName': nameCtrl.text.trim(),
                'brand': brandCtrl.text.trim(),
                'unit': unitCtrl.text.trim(),
                'purchaseRate': double.tryParse(rateCtrl.text) ?? 0,
                'stockAvailable': double.tryParse(qtyCtrl.text) ?? 0,
                'minStockAlert': double.tryParse(minCtrl.text) ?? 10,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Save Material'),
          ),
        ],
      ),
    );
  }

  void _stockTxnDialog(Map<String, dynamic> item) {
    String txnType = 'ISSUE_OUT';
    final qtyCtrl = TextEditingController(text: '1');
    final remCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Stock Entry · ${item['material_name']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              value: txnType,
              decoration: const InputDecoration(labelText: 'Transaction Type'),
              items: const [
                DropdownMenuItem(value: 'PURCHASE_IN', child: Text('Purchase In (+)')),
                DropdownMenuItem(value: 'ISSUE_OUT', child: Text('Issue to Site (-)')),
                DropdownMenuItem(value: 'RETURN_IN', child: Text('Return to Store (+)')),
                DropdownMenuItem(value: 'DAMAGED', child: Text('Damaged / Scrap (-)')),
              ],
              onChanged: (v) => txnType = v ?? txnType,
            ),
            const SizedBox(height: 8),
            TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
            const SizedBox(height: 8),
            TextField(controller: remCtrl, decoration: const InputDecoration(labelText: 'Remarks')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/inventory/${item['id']}/transaction', {
                'txnType': txnType,
                'quantity': double.tryParse(qtyCtrl.text) ?? 0,
                'remarks': remCtrl.text.trim(),
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Record Stock'),
          ),
        ],
      ),
    );
  }

  void _addVendorDialog() {
    final nameCtrl = TextEditingController();
    final compCtrl = TextEditingController();
    final mobCtrl = TextEditingController();
    final gstCtrl = TextEditingController();
    final matCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Vendor / Supplier'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Vendor Name *')),
              const SizedBox(height: 8),
              TextField(controller: compCtrl, decoration: const InputDecoration(labelText: 'Company Name')),
              const SizedBox(height: 8),
              TextField(controller: mobCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile *')),
              const SizedBox(height: 8),
              TextField(controller: gstCtrl, decoration: const InputDecoration(labelText: 'GSTIN')),
              const SizedBox(height: 8),
              TextField(controller: matCtrl, decoration: const InputDecoration(labelText: 'Materials Supplied')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/vendors', {
                'vendorName': nameCtrl.text.trim(),
                'companyName': compCtrl.text.trim(),
                'mobile': mobCtrl.text.trim(),
                'gstin': gstCtrl.text.trim(),
                'materialsSupplied': matCtrl.text.trim(),
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Save Vendor'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'INVENTORY', label: Text('Inventory')),
                ButtonSegment(value: 'VENDORS', label: Text('Vendors')),
              ],
              selected: {_tab},
              onSelectionChanged: (s) => setState(() => _tab = s.first),
            ),
            ElevatedButton.icon(
              onPressed: _tab == 'INVENTORY' ? _addMaterialDialog : _addVendorDialog,
              icon: const Icon(Icons.add),
              label: Text(_tab == 'INVENTORY' ? 'Add Material' : 'Add Vendor'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_tab == 'INVENTORY')
          ...erp.inventoryItems.map((i) {
            final avail = num.tryParse('${i['stock_available']}') ?? 0;
            final min = num.tryParse('${i['min_stock_alert']}') ?? 10;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text('${i['material_name']} (${i['brand'] ?? 'Generic'})', style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(
                  '${i['category']} · Available: $avail ${i['unit']} · Issued: ${i['stock_issued']} · Rate: Rs. ${i['purchase_rate']}${avail <= min ? ' · LOW STOCK' : ''}',
                ),
                trailing: OutlinedButton(
                  onPressed: () => _stockTxnDialog(i),
                  child: const Text('Update Stock'),
                ),
              ),
            );
          })
        else
          ...erp.vendors.map((v) {
            final bills = num.tryParse('${v['total_bills']}') ?? 0;
            final paid = num.tryParse('${v['total_paid']}') ?? 0;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text('${v['vendor_name']} (${v['company_name'] ?? ''})', style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('Mobile: ${v['mobile']} · Bills: Rs. $bills · Paid: Rs. $paid · Balance: Rs. ${bills - paid}'),
              ),
            );
          }),
      ],
    );
  }
}
