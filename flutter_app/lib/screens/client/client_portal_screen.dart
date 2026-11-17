import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';
import '../../services/pdf_service.dart';

class ClientPortalScreen extends StatelessWidget {
  const ClientPortalScreen({super.key});

  Future<void> _respondQuotation(BuildContext context, String qId, String status) async {
    final commentCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(status == 'APPROVED' ? 'Approve Quotation' : 'Reject Quotation'),
        content: TextField(controller: commentCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Comments / Remarks')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: Text('Confirm $status')),
        ],
      ),
    );
    if (ok == true && context.mounted) {
      await context.read<ApiService>().post('/quotations/$qId/status', {
        'status': status,
        'comments': commentCtrl.text.trim(),
      });
      if (context.mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
    }
  }

  Future<void> _submitComplaint(BuildContext context) async {
    final subCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Support Ticket / Complaint'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: subCtrl, decoration: const InputDecoration(labelText: 'Subject *')),
            const SizedBox(height: 8),
            TextField(controller: descCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Details *')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/complaints', {
                'subject': subCtrl.text.trim(),
                'description': descCtrl.text.trim(),
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (context.mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    final auth = context.watch<AuthProvider>();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Welcome, ${auth.user?['full_name'] ?? 'Client'}',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                const Text('Your SIID Projects, Quotations, Invoices & Progress',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
              ],
            ),
            OutlinedButton.icon(
              onPressed: () => _submitComplaint(context),
              icon: const Icon(Icons.support_agent),
              label: const Text('Raise Ticket'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text('My Projects', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 8),
        if (erp.projects.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No projects assigned yet.')))
        else
          ...erp.projects.map((p) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${p['project_name']} (${p['status']})', style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      LinearProgressIndicator(value: ((num.tryParse('${p['progress_percent']}') ?? 0) / 100).clamp(0.0, 1.0)),
                      const SizedBox(height: 4),
                      Text('Progress: ${p['progress_percent']}% · Expected Completion: ${p['expected_completion_date'] ?? 'TBD'}'),
                    ],
                  ),
                ),
              )),
        const SizedBox(height: 16),
        const Text('Assigned Quotations', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 8),
        ...erp.quotations.map((q) => Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${q['quotation_number']} · ${q['project_name']} · Rs. ${q['grand_total']}',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('Status: ${q['status']} · Valid Until: ${q['valid_until']}'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () async {
                            final api = context.read<ApiService>();
                            final res = Map<String, dynamic>.from(await api.get('/quotations/${q['id']}') as Map);
                            final bytes = await SiidPdfService.generateQuotationPdf(
                              quotation: Map<String, dynamic>.from(res['quotation'] as Map),
                              items: (res['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
                              materials: (res['materials'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
                              company: Map<String, dynamic>.from(res['company'] as Map),
                              serverRoot: api.baseUrl.replaceFirst('/api', ''),
                            );
                            await SiidPdfService.previewAndPrint(bytes, '${q['quotation_number']}.pdf');
                          },
                          icon: const Icon(Icons.picture_as_pdf, size: 16),
                          label: const Text('View PDF'),
                        ),
                        if (q['status'] == 'SENT') ...[
                          ElevatedButton(
                            onPressed: () => _respondQuotation(context, q['id'].toString(), 'APPROVED'),
                            child: const Text('Approve'),
                          ),
                          OutlinedButton(
                            onPressed: () => _respondQuotation(context, q['id'].toString(), 'REJECTED'),
                            child: const Text('Reject'),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            )),
        const SizedBox(height: 16),
        const Text('Invoices & Payments', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 8),
        ...erp.invoices.map((i) => Card(
              child: ListTile(
                title: Text('${i['invoice_number']} · Rs. ${i['grand_total']}'),
                subtitle: Text('Paid: Rs. ${i['amount_paid']} · Remaining: Rs. ${i['outstanding_balance']} · ${i['status']}'),
              ),
            )),
      ],
    );
  }
}
