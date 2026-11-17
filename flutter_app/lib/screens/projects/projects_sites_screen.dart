import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';

class ProjectsSitesScreen extends StatefulWidget {
  final String mode; // PROJECTS | INTERIOR | CONSTRUCTION
  const ProjectsSitesScreen({super.key, this.mode = 'PROJECTS'});

  @override
  State<ProjectsSitesScreen> createState() => _ProjectsSitesScreenState();
}

class _ProjectsSitesScreenState extends State<ProjectsSitesScreen> {
  void _addProjectDialog() {
    final erp = context.read<ErpProvider>();
    if (erp.clients.isEmpty) return;
    String clientId = erp.clients.first['id'].toString();
    final nameCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final budgetCtrl = TextEditingController(text: '0');
    String cat = 'Interior Design';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create New Project'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: clientId,
                decoration: const InputDecoration(labelText: 'Client'),
                items: erp.clients.map((c) => DropdownMenuItem(value: c['id'].toString(), child: Text('${c['client_name']}'))).toList(),
                onChanged: (v) => clientId = v ?? clientId,
              ),
              const SizedBox(height: 8),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Project Name')),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: cat,
                decoration: const InputDecoration(labelText: 'Category'),
                items: const [
                  DropdownMenuItem(value: 'Interior Design', child: Text('Interior Design')),
                  DropdownMenuItem(value: 'Construction', child: Text('Construction')),
                  DropdownMenuItem(value: 'Infrastructure', child: Text('Infrastructure')),
                ],
                onChanged: (v) => cat = v ?? cat,
              ),
              const SizedBox(height: 8),
              TextField(controller: cityCtrl, decoration: const InputDecoration(labelText: 'City')),
              const SizedBox(height: 8),
              TextField(controller: budgetCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Budget (INR)')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/projects', {
                'clientId': clientId,
                'projectName': nameCtrl.text.trim(),
                'category': cat,
                'city': cityCtrl.text.trim(),
                'budget': double.tryParse(budgetCtrl.text) ?? 0,
                'status': 'ONGOING',
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await erp.syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Create Project'),
          ),
        ],
      ),
    );
  }

  void _addInteriorDialog() {
    final erp = context.read<ErpProvider>();
    if (erp.projects.isEmpty) return;
    String projectId = erp.projects.first['id'].toString();
    String room = 'Living Room';
    String fileType = '3D_RENDER';
    final titleCtrl = TextEditingController();
    final specCtrl = TextEditingController();
    String? fileUrl;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => AlertDialog(
          title: const Text('Upload Interior Design / 2D Plan / 3D Render'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: projectId,
                  decoration: const InputDecoration(labelText: 'Project'),
                  items: erp.projects.map((p) => DropdownMenuItem(value: p['id'].toString(), child: Text('${p['project_name']}'))).toList(),
                  onChanged: (v) => projectId = v ?? projectId,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: room,
                  decoration: const InputDecoration(labelText: 'Space / Room'),
                  items: const [
                    DropdownMenuItem(value: 'Living Room', child: Text('Living Room')),
                    DropdownMenuItem(value: 'Modular Kitchen', child: Text('Modular Kitchen')),
                    DropdownMenuItem(value: 'Bedroom Design', child: Text('Bedroom Design')),
                    DropdownMenuItem(value: 'Office Interior', child: Text('Office Interior')),
                    DropdownMenuItem(value: 'Bathroom', child: Text('Bathroom')),
                    DropdownMenuItem(value: 'False Ceiling', child: Text('False Ceiling')),
                  ],
                  onChanged: (v) => room = v ?? room,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: fileType,
                  decoration: const InputDecoration(labelText: 'Deliverable Type'),
                  items: const [
                    DropdownMenuItem(value: '2D_PLAN', child: Text('2D Floor Plan')),
                    DropdownMenuItem(value: '3D_RENDER', child: Text('3D Render')),
                    DropdownMenuItem(value: 'DESIGN_IMAGE', child: Text('Design Image')),
                    DropdownMenuItem(value: 'APPROVAL_DOC', child: Text('Approval Document')),
                  ],
                  onChanged: (v) => fileType = v ?? fileType,
                ),
                const SizedBox(height: 8),
                TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Design Title')),
                const SizedBox(height: 8),
                TextField(controller: specCtrl, decoration: const InputDecoration(labelText: 'Material & Lighting Specs')),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
                    if (picked != null && mounted) {
                      final up = await context.read<ApiService>().uploadFile(
                            filePath: picked.path,
                            entityType: 'interior_design',
                            entityId: projectId,
                            title: titleCtrl.text.trim(),
                          );
                      setModal(() => fileUrl = up['fileUrl']?.toString());
                    }
                  },
                  icon: const Icon(Icons.upload_file),
                  label: Text(fileUrl != null ? 'File Uploaded' : 'Upload Design File'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                await context.read<ApiService>().post('/interior', {
                  'projectId': projectId,
                  'designCategory': 'Residential Interior',
                  'roomName': room,
                  'title': titleCtrl.text.trim(),
                  'materialSpecs': specCtrl.text.trim(),
                  'fileType': fileType,
                  'fileUrl': fileUrl,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) await erp.syncAllForRole(context.read<AuthProvider>().role);
              },
              child: const Text('Save Design'),
            ),
          ],
        ),
      ),
    );
  }

  void _addConstructionStageDialog() {
    final erp = context.read<ErpProvider>();
    if (erp.projects.isEmpty) return;
    String projectId = erp.projects.first['id'].toString();
    String stage = 'Foundation';
    final pctCtrl = TextEditingController(text: '25');
    final notesCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log Construction Progress Stage'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: projectId,
                decoration: const InputDecoration(labelText: 'Project'),
                items: erp.projects.map((p) => DropdownMenuItem(value: p['id'].toString(), child: Text('${p['project_name']}'))).toList(),
                onChanged: (v) => projectId = v ?? projectId,
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: stage,
                decoration: const InputDecoration(labelText: 'Stage'),
                items: const [
                  'Site Preparation',
                  'Foundation',
                  'Civil Work',
                  'Structure',
                  'Brickwork',
                  'Plastering',
                  'Plumbing',
                  'Electrical Work',
                  'Waterproofing',
                  'Flooring',
                  'Painting',
                  'Finishing',
                  'Quality Inspection',
                  'Safety Inspection',
                  'Project Handover',
                ].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                onChanged: (v) => stage = v ?? stage,
              ),
              const SizedBox(height: 8),
              TextField(controller: pctCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Progress %')),
              const SizedBox(height: 8),
              TextField(controller: notesCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Daily Progress Notes')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/construction', {
                'projectId': projectId,
                'stageName': stage,
                'progressPercent': int.tryParse(pctCtrl.text) ?? 0,
                'qualityCheck': 'PASSED',
                'safetyCheck': 'PASSED',
                'reportNotes': notesCtrl.text.trim(),
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await erp.syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Submit Progress'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final erp = context.watch<ErpProvider>();
    final auth = context.watch<AuthProvider>();

    if (widget.mode == 'INTERIOR') {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Interior Design & 2D/3D Studio', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              ElevatedButton.icon(onPressed: _addInteriorDialog, icon: const Icon(Icons.add), label: const Text('Add Design')),
            ],
          ),
          const SizedBox(height: 14),
          if (erp.interiorDesigns.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No interior designs uploaded yet.'))))
          else
            ...erp.interiorDesigns.map((d) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    title: Text('${d['title']} · ${d['room_name']} (Rev ${d['revision_number']})',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${d['project_name']} · ${d['file_type']} · Client Approval: ${d['client_approval_status']}'),
                  ),
                )),
        ],
      );
    }

    if (widget.mode == 'CONSTRUCTION') {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Construction & Infrastructure Progress', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              ElevatedButton.icon(onPressed: _addConstructionStageDialog, icon: const Icon(Icons.add), label: const Text('Log Stage')),
            ],
          ),
          const SizedBox(height: 14),
          if (erp.constructionStages.isEmpty)
            const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No construction stage updates yet.'))))
          else
            ...erp.constructionStages.map((cs) => Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    title: Text('${cs['project_name']} · ${cs['stage_name']} (${cs['progress_percent']}%)',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${cs['report_notes'] ?? ''} · Approval: ${cs['admin_approval']}'),
                    trailing: cs['admin_approval'] == 'PENDING' && ['OWNER', 'ADMIN'].contains(auth.role)
                        ? ElevatedButton(
                            onPressed: () async {
                              await context.read<ApiService>().post('/construction/${cs['id']}/approve', {'approval': 'APPROVED'});
                              await erp.syncAllForRole(auth.role);
                            },
                            child: const Text('Approve'),
                          )
                        : null,
                  ),
                )),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Projects & Multiple Sites', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            if (['OWNER', 'ADMIN'].contains(auth.role))
              ElevatedButton.icon(onPressed: _addProjectDialog, icon: const Icon(Icons.add), label: const Text('New Project')),
          ],
        ),
        const SizedBox(height: 14),
        if (erp.projects.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No projects created yet.'))))
        else
          ...erp.projects.map((p) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('${p['project_code']} · ${p['project_name']}',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                          Text('${p['status']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('Client: ${p['client_name'] ?? ''} · ${p['category']} · ${p['city'] ?? ''} · Budget: Rs. ${p['budget']}'),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(value: ((num.tryParse('${p['progress_percent']}') ?? 0) / 100).clamp(0.0, 1.0)),
                    ],
                  ),
                ),
              )),
      ],
    );
  }
}
