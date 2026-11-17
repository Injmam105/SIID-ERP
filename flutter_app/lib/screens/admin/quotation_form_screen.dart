import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../config/app_config.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';
import '../../theme/siid_theme.dart';

class QuotationFormScreen extends StatefulWidget {
  final String? quotationId;
  const QuotationFormScreen({super.key, this.quotationId});

  @override
  State<QuotationFormScreen> createState() => _QuotationFormScreenState();
}

class _QuotationFormScreenState extends State<QuotationFormScreen> {
  String? _clientId;
  final _projectNameCtrl = TextEditingController();
  String _projectCategory = 'Interior Design';
  final _locationCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _scopeCtrl = TextEditingController();
  final _durationCtrl = TextEditingController(text: '90 Days');
  final _labourCtrl = TextEditingController(text: '0');
  final _transportCtrl = TextEditingController(text: '0');
  final _additionalCtrl = TextEditingController(text: '0');
  final _discountCtrl = TextEditingController(text: '0');
  final _gstCtrl = TextEditingController(text: '18');
  final _advanceCtrl = TextEditingController(text: '0');
  final _labourSpecsCtrl = TextEditingController();
  final _designSpecsCtrl = TextEditingController();
  final _includedCtrl = TextEditingController();
  final _excludedCtrl = TextEditingController();

  bool _includeMaterialInItems = false;
  bool _saving = false;
  String? _error;

  final List<Map<String, dynamic>> _items = [];
  final List<Map<String, dynamic>> _materials = [];

  @override
  void initState() {
    super.initState();
    if (widget.quotationId != null) {
      _loadExisting();
    } else {
      final clients = context.read<ErpProvider>().clients;
      if (clients.isNotEmpty) _clientId = clients.first['id'].toString();
    }
  }

  Future<void> _loadExisting() async {
    try {
      final res = Map<String, dynamic>.from(await context.read<ApiService>().get('/quotations/${widget.quotationId}') as Map);
      final q = Map<String, dynamic>.from(res['quotation'] as Map);
      setState(() {
        _clientId = q['client_id']?.toString();
        _projectNameCtrl.text = '${q['project_name'] ?? ''}';
        _projectCategory = '${q['project_category'] ?? 'Interior Design'}';
        _locationCtrl.text = '${q['project_location'] ?? ''}';
        _descCtrl.text = '${q['project_description'] ?? ''}';
        _scopeCtrl.text = '${q['scope_of_work'] ?? ''}';
        _durationCtrl.text = '${q['estimated_duration'] ?? ''}';
        _includeMaterialInItems = q['include_material_in_items'] == 1;
        _labourCtrl.text = '${q['labour_charges'] ?? 0}';
        _transportCtrl.text = '${q['transportation_charges'] ?? 0}';
        _additionalCtrl.text = '${q['additional_charges'] ?? 0}';
        _discountCtrl.text = '${q['discount_amount'] ?? 0}';
        _gstCtrl.text = '${q['gst_rate'] ?? 18}';
        _advanceCtrl.text = '${q['advance_amount'] ?? 0}';
        _labourSpecsCtrl.text = '${q['labour_specs'] ?? ''}';
        _designSpecsCtrl.text = '${q['design_specs'] ?? ''}';
        _includedCtrl.text = '${q['included_services'] ?? ''}';
        _excludedCtrl.text = '${q['excluded_services'] ?? ''}';

        _items.clear();
        for (final it in (res['items'] as List)) {
          _items.add({
            'workCategory': it['work_category'],
            'workDescription': it['work_description'],
            'materialOrService': it['material_or_service'],
            'quantity': it['quantity'],
            'unit': it['unit'],
            'rate': it['rate'],
          });
        }
        _materials.clear();
        for (final m in (res['materials'] as List)) {
          _materials.add({
            'workCategory': m['work_category'],
            'materialName': m['material_name'],
            'materialDescription': m['material_description'],
            'brandName': m['brand_name'],
            'productModel': m['product_model'],
            'gradeQuality': m['grade_quality'],
            'sizeThickness': m['size_thickness'],
            'technicalSpecs': m['technical_specs'],
            'quantity': m['quantity'],
            'unit': m['unit'],
            'ratePerUnit': m['rate_per_unit'],
            'providedBy': m['provided_by'],
            'imageUrl': m['image_url'],
            'remarks': m['remarks'],
          });
        }
      });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  void _openItemDialog([int? editIdx]) {
    final existing = editIdx != null ? _items[editIdx] : null;
    final catCtrl = TextEditingController(text: existing?['workCategory'] ?? 'Civil Work');
    final descCtrl = TextEditingController(text: existing?['workDescription'] ?? '');
    final qtyCtrl = TextEditingController(text: '${existing?['quantity'] ?? 1}');
    final unitCtrl = TextEditingController(text: existing?['unit'] ?? 'Sq.Ft');
    final rateCtrl = TextEditingController(text: '${existing?['rate'] ?? 0}');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(editIdx == null ? 'Add Work Item' : 'Edit Work Item'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: catCtrl, decoration: const InputDecoration(labelText: 'Work Category')),
              const SizedBox(height: 8),
              TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Work Description')),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Qty'))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit'))),
                ],
              ),
              const SizedBox(height: 8),
              TextField(controller: rateCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Rate (INR)')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final entry = {
                'workCategory': catCtrl.text.trim(),
                'workDescription': descCtrl.text.trim(),
                'quantity': double.tryParse(qtyCtrl.text) ?? 1,
                'unit': unitCtrl.text.trim(),
                'rate': double.tryParse(rateCtrl.text) ?? 0,
              };
              setState(() {
                if (editIdx == null) {
                  _items.add(entry);
                } else {
                  _items[editIdx] = entry;
                }
              });
              Navigator.pop(ctx);
            },
            child: const Text('Save Item'),
          ),
        ],
      ),
    );
  }

  void _openMaterialSpecDialog([int? editIdx]) {
    final existing = editIdx != null ? _materials[editIdx] : null;
    final catCtrl = TextEditingController(text: existing?['workCategory'] ?? 'Civil & Structure');
    final nameCtrl = TextEditingController(text: existing?['materialName'] ?? '');
    final descCtrl = TextEditingController(text: existing?['materialDescription'] ?? '');
    final brandCtrl = TextEditingController(text: existing?['brandName'] ?? '');
    final modelCtrl = TextEditingController(text: existing?['productModel'] ?? '');
    final gradeCtrl = TextEditingController(text: existing?['gradeQuality'] ?? '');
    final sizeCtrl = TextEditingController(text: existing?['sizeThickness'] ?? '');
    final techCtrl = TextEditingController(text: existing?['technicalSpecs'] ?? '');
    final qtyCtrl = TextEditingController(text: '${existing?['quantity'] ?? 1}');
    final unitCtrl = TextEditingController(text: existing?['unit'] ?? 'Bags');
    final rateCtrl = TextEditingController(text: '${existing?['ratePerUnit'] ?? 0}');
    final remarksCtrl = TextEditingController(text: existing?['remarks'] ?? '');
    String providedBy = existing?['providedBy'] ?? 'SIID';
    String? imageUrl = existing?['imageUrl'];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => AlertDialog(
          title: Text(editIdx == null ? 'Add Material & Brand Specification' : 'Edit Material Specification'),
          content: SingleChildScrollView(
            child: SizedBox(
              width: 460,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: catCtrl, decoration: const InputDecoration(labelText: 'Work Category')),
                  const SizedBox(height: 8),
                  TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Material Name *')),
                  const SizedBox(height: 8),
                  TextField(controller: descCtrl, decoration: const InputDecoration(labelText: 'Material Description')),
                  const SizedBox(height: 8),
                  Autocomplete<String>(
                    initialValue: TextEditingValue(text: brandCtrl.text),
                    optionsBuilder: (val) => AppConfig.commonConstructionBrands
                        .where((b) => b.toLowerCase().contains(val.text.toLowerCase())),
                    onSelected: (s) => brandCtrl.text = s,
                    fieldViewBuilder: (c, tc, fn, onSub) {
                      tc.text = brandCtrl.text;
                      tc.addListener(() => brandCtrl.text = tc.text);
                      return TextField(
                        controller: tc,
                        focusNode: fn,
                        decoration: const InputDecoration(
                          labelText: 'Brand / Company Name (Search or Type Custom) *',
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: modelCtrl, decoration: const InputDecoration(labelText: 'Product Model / Code'))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: gradeCtrl, decoration: const InputDecoration(labelText: 'Grade / Quality'))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: sizeCtrl, decoration: const InputDecoration(labelText: 'Size / Thickness'))),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: providedBy,
                          decoration: const InputDecoration(labelText: 'Provided By'),
                          items: const [
                            DropdownMenuItem(value: 'SIID', child: Text('SIID')),
                            DropdownMenuItem(value: 'CLIENT', child: Text('Client')),
                          ],
                          onChanged: (v) => setModal(() => providedBy = v ?? 'SIID'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(controller: techCtrl, decoration: const InputDecoration(labelText: 'Technical Specifications')),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: qtyCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Qty'))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: unitCtrl, decoration: const InputDecoration(labelText: 'Unit'))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: rateCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Rate/Unit'))),
                    ],
                  ),
                  const SizedBox(height: 8),
                  TextField(controller: remarksCtrl, decoration: const InputDecoration(labelText: 'Remarks')),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () async {
                          final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
                          if (picked != null && mounted) {
                            final up = await context.read<ApiService>().uploadFile(
                                  filePath: picked.path,
                                  entityType: 'quotation_material',
                                  entityId: widget.quotationId ?? 'draft',
                                  title: nameCtrl.text.trim(),
                                );
                            setModal(() => imageUrl = up['fileUrl']?.toString());
                          }
                        },
                        icon: const Icon(Icons.image),
                        label: Text(imageUrl != null ? 'Image Uploaded' : 'Upload Material Image'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty || brandCtrl.text.trim().isEmpty) return;
                final entry = {
                  'workCategory': catCtrl.text.trim(),
                  'materialName': nameCtrl.text.trim(),
                  'materialDescription': descCtrl.text.trim(),
                  'brandName': brandCtrl.text.trim(),
                  'productModel': modelCtrl.text.trim(),
                  'gradeQuality': gradeCtrl.text.trim(),
                  'sizeThickness': sizeCtrl.text.trim(),
                  'technicalSpecs': techCtrl.text.trim(),
                  'quantity': double.tryParse(qtyCtrl.text) ?? 1,
                  'unit': unitCtrl.text.trim(),
                  'ratePerUnit': double.tryParse(rateCtrl.text) ?? 0,
                  'providedBy': providedBy,
                  'imageUrl': imageUrl,
                  'remarks': remarksCtrl.text.trim(),
                };
                setState(() {
                  if (editIdx == null) {
                    _materials.add(entry);
                  } else {
                    _materials[editIdx] = entry;
                  }
                });
                Navigator.pop(ctx);
              },
              child: const Text('Save Material'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveQuotation(String status) async {
    if (_clientId == null || _projectNameCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Please select a Client and enter Project Name.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final payload = {
        'clientId': _clientId,
        'projectName': _projectNameCtrl.text.trim(),
        'projectCategory': _projectCategory,
        'projectLocation': _locationCtrl.text.trim(),
        'projectDescription': _descCtrl.text.trim(),
        'scopeOfWork': _scopeCtrl.text.trim(),
        'estimatedDuration': _durationCtrl.text.trim(),
        'includeMaterialInItems': _includeMaterialInItems,
        'labourCharges': double.tryParse(_labourCtrl.text) ?? 0,
        'transportationCharges': double.tryParse(_transportCtrl.text) ?? 0,
        'additionalCharges': double.tryParse(_additionalCtrl.text) ?? 0,
        'discountAmount': double.tryParse(_discountCtrl.text) ?? 0,
        'gstRate': double.tryParse(_gstCtrl.text) ?? 18,
        'advanceAmount': double.tryParse(_advanceCtrl.text) ?? 0,
        'labourSpecs': _labourSpecsCtrl.text.trim(),
        'designSpecs': _designSpecsCtrl.text.trim(),
        'includedServices': _includedCtrl.text.trim(),
        'excludedServices': _excludedCtrl.text.trim(),
        'status': status,
        'items': _items,
        'materials': _materials,
      };
      if (widget.quotationId == null) {
        await api.post('/quotations', payload);
      } else {
        await api.put('/quotations/${widget.quotationId}', payload);
      }
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();

    final itemSub = _items.fold<double>(0, (s, i) => s + (double.tryParse('${i['quantity']}') ?? 0) * (double.tryParse('${i['rate']}') ?? 0));
    final matSub = _materials
        .where((m) => (m['providedBy'] ?? 'SIID') == 'SIID')
        .fold<double>(0, (s, m) => s + (double.tryParse('${m['quantity']}') ?? 0) * (double.tryParse('${m['ratePerUnit']}') ?? 0));
    final effectiveMat = _includeMaterialInItems ? 0.0 : matSub;
    final taxable = (itemSub +
            effectiveMat +
            (double.tryParse(_labourCtrl.text) ?? 0) +
            (double.tryParse(_transportCtrl.text) ?? 0) +
            (double.tryParse(_additionalCtrl.text) ?? 0) -
            (double.tryParse(_discountCtrl.text) ?? 0))
        .clamp(0, double.infinity);
    final gstAmt = taxable * ((double.tryParse(_gstCtrl.text) ?? 18) / 100);
    final grandTotal = taxable + gstAmt;

    return Scaffold(
      appBar: AppBar(title: Text(widget.quotationId == null ? 'Create New Quotation' : 'Edit Quotation')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_error != null)
            Container(
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 12),
              color: const Color(0xFFFEF2F2),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Client & Project Information', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _clientId,
                    decoration: const InputDecoration(labelText: 'Select Client'),
                    items: erp.clients
                        .map((c) => DropdownMenuItem(value: c['id'].toString(), child: Text('${c['client_name']} (${c['mobile']})')))
                        .toList(),
                    onChanged: (v) => setState(() => _clientId = v),
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _projectNameCtrl, decoration: const InputDecoration(labelText: 'Project Name *')),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _projectCategory,
                    decoration: const InputDecoration(labelText: 'Project Category'),
                    items: const [
                      DropdownMenuItem(value: 'Interior Design', child: Text('Interior Design')),
                      DropdownMenuItem(value: 'Construction', child: Text('Construction')),
                      DropdownMenuItem(value: 'Infrastructure', child: Text('Infrastructure')),
                      DropdownMenuItem(value: 'Turnkey Interior & Civil', child: Text('Turnkey Interior & Civil')),
                    ],
                    onChanged: (v) => setState(() => _projectCategory = v ?? 'Interior Design'),
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _locationCtrl, decoration: const InputDecoration(labelText: 'Project Location')),
                  const SizedBox(height: 10),
                  TextField(controller: _scopeCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Scope of Work')),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Itemized Work Schedule', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      ElevatedButton.icon(onPressed: () => _openItemDialog(), icon: const Icon(Icons.add), label: const Text('Add Item')),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (_items.isEmpty)
                    const Text('No work items added yet.', style: TextStyle(color: Color(0xFF64748B)))
                  else
                    ..._items.asMap().entries.map((e) {
                      final it = e.value;
                      final amt = (double.tryParse('${it['quantity']}') ?? 0) * (double.tryParse('${it['rate']}') ?? 0);
                      return ListTile(
                        title: Text('${e.key + 1}. ${it['workCategory']} — ${it['workDescription']}'),
                        subtitle: Text('${it['quantity']} ${it['unit']} @ Rs. ${it['rate']} = Rs. ${amt.toStringAsFixed(2)}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(icon: const Icon(Icons.edit), onPressed: () => _openItemDialog(e.key)),
                            IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => setState(() => _items.removeAt(e.key))),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: SiidTheme.elegantGold, width: 1.4),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Text(
                          'MATERIAL DETAILS & BRAND / COMPANY SPECIFICATIONS',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: SiidTheme.deepNavy),
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: () => _openMaterialSpecDialog(),
                        icon: const Icon(Icons.add),
                        label: const Text('Add Material & Brand'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Material costs already included in work item rates (prevent double-counting)'),
                    value: _includeMaterialInItems,
                    onChanged: (v) => setState(() => _includeMaterialInItems = v),
                  ),
                  if (_materials.isEmpty)
                    const Text('Add exact brands & materials (e.g., UltraTech, Tata Tiscon, Asian Paints, Polycab, Kajaria, Jaquar).',
                        style: TextStyle(color: Color(0xFF64748B)))
                  else
                    ..._materials.asMap().entries.map((e) {
                      final m = e.value;
                      final tot = (double.tryParse('${m['quantity']}') ?? 0) * (double.tryParse('${m['ratePerUnit']}') ?? 0);
                      return ListTile(
                        title: Text('${e.key + 1}. ${m['materialName']} — Brand: ${m['brandName']}'),
                        subtitle: Text(
                          '${m['workCategory']} · Model: ${m['productModel'] ?? '-'} · Grade: ${m['gradeQuality'] ?? '-'} · ${m['quantity']} ${m['unit']} @ Rs. ${m['ratePerUnit']} = Rs. ${tot.toStringAsFixed(2)} (${m['providedBy']})',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(icon: const Icon(Icons.edit), onPressed: () => _openMaterialSpecDialog(e.key)),
                            IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => setState(() => _materials.removeAt(e.key))),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Financial Summary & Taxes (INR)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: _labourCtrl, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Labour Charges'))),
                      const SizedBox(width: 10),
                      Expanded(child: TextField(controller: _transportCtrl, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Transportation'))),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: _additionalCtrl, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Additional Charges'))),
                      const SizedBox(width: 10),
                      Expanded(child: TextField(controller: _discountCtrl, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Discount'))),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: _gstCtrl, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'GST %'))),
                      const SizedBox(width: 10),
                      Expanded(child: TextField(controller: _advanceCtrl, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Advance Amount'))),
                    ],
                  ),
                  const Divider(height: 24),
                  Text('Items Subtotal: Rs. ${itemSub.toStringAsFixed(2)}'),
                  Text('Material Charges (Added): Rs. ${effectiveMat.toStringAsFixed(2)}'),
                  Text('GST Amount: Rs. ${gstAmt.toStringAsFixed(2)}'),
                  Text('Grand Total: Rs. ${grandTotal.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: SiidTheme.deepNavy)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving ? null : () => _saveQuotation('DRAFT'),
                  child: const Text('Save as Draft'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _saving ? null : () => _saveQuotation('SENT'),
                  child: const Text('Save & Send to Client'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
