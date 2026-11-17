import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class CompanySettingsScreen extends StatefulWidget {
  const CompanySettingsScreen({super.key});

  @override
  State<CompanySettingsScreen> createState() => _CompanySettingsScreenState();
}

class _CompanySettingsScreenState extends State<CompanySettingsScreen> {
  late TextEditingController _nameCtrl;
  late TextEditingController _gstinCtrl;
  late TextEditingController _mobileCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _websiteCtrl;
  late TextEditingController _gstRateCtrl;
  String? _logoUrl;
  String? _msg;

  @override
  void initState() {
    super.initState();
    final c = context.read<AuthProvider>().company ?? {};
    _nameCtrl = TextEditingController(text: '${c['company_name'] ?? 'Sirahi Infrastructure & Interior Design'}');
    _gstinCtrl = TextEditingController(text: '${c['gstin'] ?? '07DCYPA1228R1ZZ'}');
    _mobileCtrl = TextEditingController(text: '${c['owner_mobile'] ?? '9650598785'}');
    _emailCtrl = TextEditingController(text: '${c['official_email'] ?? 'sirahiinfrainteriordesign@gmail.com'}');
    _websiteCtrl = TextEditingController(text: '${c['website'] ?? 'https://sirahi.in'}');
    _gstRateCtrl = TextEditingController(text: '${c['default_gst_rate'] ?? 18}');
    _logoUrl = c['logo_url']?.toString();
  }

  Future<void> _uploadLogo() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (picked == null || !mounted) return;
    final up = await context.read<ApiService>().uploadFile(
          filePath: picked.path,
          entityType: 'company_logo',
          entityId: 'SIID_MAIN',
          title: 'SIID Company Logo',
        );
    setState(() => _logoUrl = up['fileUrl']?.toString());
  }

  Future<void> _saveSettings() async {
    await context.read<ApiService>().put('/company', {
      'companyName': _nameCtrl.text.trim(),
      'gstin': _gstinCtrl.text.trim(),
      'ownerMobile': _mobileCtrl.text.trim(),
      'officialEmail': _emailCtrl.text.trim(),
      'website': _websiteCtrl.text.trim(),
      'defaultGstRate': double.tryParse(_gstRateCtrl.text) ?? 18,
      if (_logoUrl != null) 'logoUrl': _logoUrl,
    });
    if (mounted) {
      await context.read<AuthProvider>().refreshMe();
      setState(() => _msg = 'Company settings saved to cloud database.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Authorized Company Settings', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (_msg != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(_msg!, style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w600)),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Company Name')),
                const SizedBox(height: 10),
                TextField(controller: _gstinCtrl, decoration: const InputDecoration(labelText: 'GSTIN')),
                const SizedBox(height: 10),
                TextField(controller: _mobileCtrl, decoration: const InputDecoration(labelText: 'Owner Mobile')),
                const SizedBox(height: 10),
                TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Official Email')),
                const SizedBox(height: 10),
                TextField(controller: _websiteCtrl, decoration: const InputDecoration(labelText: 'Website')),
                const SizedBox(height: 10),
                TextField(controller: _gstRateCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Default GST %')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    OutlinedButton.icon(onPressed: _uploadLogo, icon: const Icon(Icons.image), label: const Text('Upload SIID Logo')),
                    const SizedBox(width: 12),
                    ElevatedButton(onPressed: _saveSettings, child: const Text('Save Settings')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
