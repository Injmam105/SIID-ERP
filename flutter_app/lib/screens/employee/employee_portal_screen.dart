import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/app_config.dart';
import '../../providers/auth_provider.dart';
import '../../providers/erp_provider.dart';
import '../../services/api_service.dart';
import '../../theme/siid_theme.dart';

class EmployeePortalScreen extends StatefulWidget {
  const EmployeePortalScreen({super.key});

  @override
  State<EmployeePortalScreen> createState() => _EmployeePortalScreenState();
}

class _EmployeePortalScreenState extends State<EmployeePortalScreen> {
  bool _busy = false;
  String? _statusMsg;

  Future<void> _checkIn() async {
    setState(() {
      _busy = true;
      _statusMsg = null;
    });
    try {
      double? lat;
      double? lng;
      try {
        final perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) await Geolocator.requestPermission();
        final pos = await Geolocator.getCurrentPosition().timeout(const Duration(seconds: 6));
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {}
      await context.read<ApiService>().post('/attendance/check-in', {
        if (lat != null) 'gpsLat': lat,
        if (lng != null) 'gpsLng': lng,
      });
      if (mounted) {
        await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
        setState(() => _statusMsg = 'Checked in successfully with server timestamp.');
      }
    } catch (e) {
      setState(() => _statusMsg = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _checkOut() async {
    setState(() {
      _busy = true;
      _statusMsg = null;
    });
    try {
      await context.read<ApiService>().post('/attendance/check-out', {});
      if (mounted) {
        await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
        setState(() => _statusMsg = 'Checked out successfully.');
      }
    } catch (e) {
      setState(() => _statusMsg = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _requestLeaveDialog() {
    String leaveType = 'Casual Leave';
    final startCtrl = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    final endCtrl = TextEditingController(text: DateTime.now().toIso8601String().substring(0, 10));
    final reasonCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit Leave Request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              value: leaveType,
              decoration: const InputDecoration(labelText: 'Leave Type'),
              items: const ['Casual Leave', 'Sick Leave', 'Emergency Leave']
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => leaveType = v ?? leaveType,
            ),
            const SizedBox(height: 8),
            TextField(controller: startCtrl, decoration: const InputDecoration(labelText: 'Start Date (YYYY-MM-DD)')),
            const SizedBox(height: 8),
            TextField(controller: endCtrl, decoration: const InputDecoration(labelText: 'End Date (YYYY-MM-DD)')),
            const SizedBox(height: 8),
            TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: 'Reason')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await context.read<ApiService>().post('/leaves', {
                'leaveType': leaveType,
                'startDate': startCtrl.text.trim(),
                'endDate': endCtrl.text.trim(),
                'reason': reasonCtrl.text.trim(),
              });
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await context.read<ErpProvider>().syncAllForRole(context.read<AuthProvider>().role);
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final erp = context.watch<ErpProvider>();
    final emp = auth.employeeProfile;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${auth.user?['full_name'] ?? ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Text('ID: ${emp?['employee_code'] ?? auth.user?['user_code']} · Role: ${auth.role.replaceAll('_', ' ')}'),
                const SizedBox(height: 12),
                if (_statusMsg != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(_statusMsg!, style: const TextStyle(fontWeight: FontWeight.w600, color: SiidTheme.royalBlue)),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _busy ? null : _checkIn,
                        icon: const Icon(Icons.login),
                        label: const Text('Check In'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _checkOut,
                        icon: const Icon(Icons.logout),
                        label: const Text('Check Out'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _requestLeaveDialog,
                  icon: const Icon(Icons.event_note),
                  label: const Text('Apply for Leave'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: SiidTheme.elegantGold, width: 1.3),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('CALL TO IT – SIID IT SUPPORT',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: SiidTheme.deepNavy)),
                const SizedBox(height: 4),
                Text('IT Head: ${AppConfig.developedBy} · Support Number: ${AppConfig.itSupportNumber}'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => launchUrl(Uri.parse('tel:${AppConfig.itSupportNumber}')),
                        icon: const Icon(Icons.call),
                        label: const Text('Call Now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => launchUrl(
                          Uri.parse('https://wa.me/91${AppConfig.itSupportNumber}?text=Hello%20SIID%20IT%20Support'),
                          mode: LaunchMode.externalApplication,
                        ),
                        icon: const Icon(Icons.chat),
                        label: const Text('WhatsApp Support'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Text('Recent Attendance', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 8),
        ...erp.attendance.take(10).map((a) => Card(
              child: ListTile(
                title: Text('${a['attendance_date']} · ${a['attendance_status']}'),
                subtitle: Text('In: ${a['check_in_at'] ?? '-'} · Out: ${a['check_out_at'] ?? '-'} · OT: ${a['overtime_hours'] ?? 0}h'),
              ),
            )),
        const SizedBox(height: 14),
        const Text('Salary & Wage Slips', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 8),
        ...erp.salaryRecords.map((s) => Card(
              child: ListTile(
                title: Text('${s['slip_number']} · ${s['period_label']}'),
                subtitle: Text('Net Payable: Rs. ${s['net_payable']} · Status: ${s['status']}'),
              ),
            )),
      ],
    );
  }
}
