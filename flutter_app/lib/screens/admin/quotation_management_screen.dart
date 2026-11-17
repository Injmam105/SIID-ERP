import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';
import '../../services/pdf_service.dart';
import 'quotation_form_screen.dart';

class QuotationManagementScreen extends StatefulWidget {
  const QuotationManagementScreen({super.key});

  @override
  State<QuotationManagementScreen> createState() => _QuotationManagementScreenState();
}

class _QuotationManagementScreenState extends State<QuotationManagementScreen> {
  String _tab = 'ALL';
  String _search = '';

  Future<void> _downloadPdf(String quotationId) async {
    final api = context.read<ApiService>();
    final res = Map<String, dynamic>.from(await api.get('/quotations/$quotationId') as Map);
    final q = Map<String, dynamic>.from(res['quotation'] as Map);
    final items = (res['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final mats = (res['materials'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final company = Map<String, dynamic>.from(res['company'] as Map);
    final root = api.baseUrl.replaceFirst('/api', '');
    final bytes = await SiidPdfService.generateQuotationPdf(
      quotation: q,
      items: items,
      materials: mats,
      company: company,
      serverRoot: root,
    );
    await SiidPdfService.previewAndPrint(bytes, '${q['quotation_number']}.pdf');
  }

  Future<void> _shareWhatsApp(Map<String, dynamic> q) async {
    final mobile = (q['client_mobile'] ?? '').toString().replaceAll(RegExp(r'\D'), '');
    final msg = Uri.encodeComponent(
      'Sirahi Infrastructure & Interior Design\nQuotation: ${q['quotation_number']}\nProject: ${q['project_name']}\nTotal: Rs. ${q['grand_total']}\nValid Until: ${q['valid_until']}',
    );
    final uri = Uri.parse('https://wa.me/91$mobile?text=$msg');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    final auth = context.watch<AuthProvider>();
    final inr = NumberFormat.currency(locale: 'en_IN', symbol: 'Rs. ', decimalDigits: 0);

    final filtered = erp.quotations.where((q) {
      if (_tab != 'ALL' && q['status'] != _tab) return false;
      if (_search.isNotEmpty) {
        final s = _search.toLowerCase();
        return '${q['quotation_number']} ${q['project_name']} ${q['client_name']}'.toLowerCase().contains(s);
      }
      return true;
    }).toList();

    final totalValue = erp.quotations.fold<num>(0, (s, q) => s + (num.tryParse('${q['grand_total']}') ?? 0));
    final approvedValue = erp.quotations
        .where((q) => q['status'] == 'APPROVED')
        .fold<num>(0, (s, q) => s + (num.tryParse('${q['grand_total']}') ?? 0));

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quotation Management', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                Text('Generate itemized quotations with Material & Brand Specifications',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
              ],
            ),
            ElevatedButton.icon(
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => const QuotationFormScreen()));
                if (mounted) await erp.syncAllForRole(auth.role);
              },
              icon: const Icon(Icons.add),
              label: const Text('Create New Quotation'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _stat('Total Quotations', '${erp.quotations.length}'),
            _stat('Drafts', '${erp.quotations.where((q) => q['status'] == 'DRAFT').length}'),
            _stat('Sent', '${erp.quotations.where((q) => q['status'] == 'SENT').length}'),
            _stat('Approved', '${erp.quotations.where((q) => q['status'] == 'APPROVED').length}'),
            _stat('Total Value', inr.format(totalValue)),
            _stat('Approved Value', inr.format(approvedValue)),
          ],
        ),
        const SizedBox(height: 16),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'ALL', label: Text('All')),
              ButtonSegment(value: 'DRAFT', label: Text('Draft')),
              ButtonSegment(value: 'SENT', label: Text('Sent')),
              ButtonSegment(value: 'APPROVED', label: Text('Approved')),
              ButtonSegment(value: 'REJECTED', label: Text('Rejected')),
              ButtonSegment(value: 'EXPIRED', label: Text('Expired')),
            ],
            selected: {_tab},
            onSelectionChanged: (s) => setState(() => _tab = s.first),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Search by quotation number, project, or client...',
          ),
          onChanged: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(28),
              child: Center(child: Text('No quotations match your filter. Create a new quotation to begin.')),
            ),
          )
        else
          ...filtered.map((q) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${q['quotation_number']} · ${q['project_name']}',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                            ),
                          ),
                          Text('${q['status']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Client: ${q['client_name'] ?? ''} · Rev ${q['revision_no'] ?? 1} · Valid: ${q['valid_until']} · Total: ${inr.format(num.tryParse('${q['grand_total']}') ?? 0)}',
                        style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569)),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => _downloadPdf(q['id'].toString()),
                            icon: const Icon(Icons.picture_as_pdf, size: 16),
                            label: const Text('PDF'),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _shareWhatsApp(q),
                            icon: const Icon(Icons.share, size: 16),
                            label: const Text('WhatsApp'),
                          ),
                          if (q['status'] == 'DRAFT')
                            OutlinedButton(
                              onPressed: () async {
                                await context.read<ApiService>().post('/quotations/${q['id']}/status', {'status': 'SENT'});
                                await erp.syncAllForRole(auth.role);
                              },
                              child: const Text('Mark Sent'),
                            ),
                          if (q['status'] != 'APPROVED')
                            OutlinedButton(
                              onPressed: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => QuotationFormScreen(quotationId: q['id'].toString())),
                                );
                                if (mounted) await erp.syncAllForRole(auth.role);
                              },
                              child: const Text('Edit'),
                            ),
                          OutlinedButton(
                            onPressed: () async {
                              await context.read<ApiService>().post('/quotations/${q['id']}/revision', {});
                              await erp.syncAllForRole(auth.role);
                            },
                            child: const Text('New Revision'),
                          ),
                          if (q['status'] == 'APPROVED' && q['converted_project_id'] == null)
                            ElevatedButton(
                              onPressed: () async {
                                await context.read<ApiService>().post('/quotations/${q['id']}/convert-to-project', {});
                                await erp.syncAllForRole(auth.role);
                              },
                              child: const Text('Convert to Project'),
                            ),
                          if (q['status'] == 'DRAFT')
                            TextButton(
                              onPressed: () async {
                                await context.read<ApiService>().delete('/quotations/${q['id']}');
                                await erp.syncAllForRole(auth.role);
                              },
                              child: const Text('Delete Draft', style: TextStyle(color: Colors.red)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              )),
      ],
    );
  }

  Widget _stat(String label, String val) => Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              Text(val, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      );
}
