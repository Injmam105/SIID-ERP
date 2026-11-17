import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class RegistrationScreen extends StatefulWidget {
  final bool isClient;
  const RegistrationScreen({super.key, required this.isClient});

  @override
  State<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends State<RegistrationScreen> {
  final _nameCtrl = TextEditingController();
  final _mobileCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _emergencyCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _gstinCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();

  String _employeeType = 'PERMANENT';
  String? _otpVerificationToken;
  bool _otpSent = false;
  int _cooldown = 0;
  Timer? _timer;
  bool _busy = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _timer?.cancel();
    _nameCtrl.dispose();
    _mobileCtrl.dispose();
    _emailCtrl.dispose();
    _pwCtrl.dispose();
    _confirmCtrl.dispose();
    _addressCtrl.dispose();
    _emergencyCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    _gstinCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  void _startCooldown(int seconds) {
    _timer?.cancel();
    setState(() => _cooldown = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown--);
      }
    });
  }

  Future<void> _sendOtp() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await context.read<ApiService>().post('/otp/send', {
        'mobile': _mobileCtrl.text.trim(),
        'purpose': widget.isClient ? 'CLIENT_REGISTER' : 'EMPLOYEE_REGISTER',
      });
      setState(() {
        _otpSent = true;
        _success = res['message']?.toString();
      });
      _startCooldown(int.tryParse('${res['resendCooldownSeconds'] ?? 60}') ?? 60);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await context.read<ApiService>().post('/otp/verify', {
        'mobile': _mobileCtrl.text.trim(),
        'purpose': widget.isClient ? 'CLIENT_REGISTER' : 'EMPLOYEE_REGISTER',
        'otp': _otpCtrl.text.trim(),
      });
      setState(() {
        _otpVerificationToken = res['otpVerificationToken']?.toString();
        _success = 'Mobile OTP verified. You may now complete your registration.';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _submitRegistration() async {
    if (_otpVerificationToken == null) {
      setState(() => _error = 'Real SMS OTP verification is required before registration.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = context.read<ApiService>();
      final res = widget.isClient
          ? await api.post('/auth/register/client', {
              'clientName': _nameCtrl.text.trim(),
              'mobile': _mobileCtrl.text.trim(),
              'email': _emailCtrl.text.trim(),
              'password': _pwCtrl.text,
              'confirmPassword': _confirmCtrl.text,
              'address': _addressCtrl.text.trim(),
              'city': _cityCtrl.text.trim(),
              'state': _stateCtrl.text.trim(),
              'gstin': _gstinCtrl.text.trim(),
              'otpVerificationToken': _otpVerificationToken,
            })
          : await api.post('/auth/register/employee', {
              'fullName': _nameCtrl.text.trim(),
              'mobile': _mobileCtrl.text.trim(),
              'email': _emailCtrl.text.trim(),
              'password': _pwCtrl.text,
              'confirmPassword': _confirmCtrl.text,
              'employeeType': _employeeType,
              'address': _addressCtrl.text.trim(),
              'emergencyContact': _emergencyCtrl.text.trim(),
              'otpVerificationToken': _otpVerificationToken,
            });
      if (mounted) {
        await showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Registration Submitted'),
            content: Text(res['message']?.toString() ?? 'Pending Admin Approval.'),
            actions: [
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                },
                child: const Text('Return to Login'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: Text(widget.isClient ? 'Client Registration' : 'Employee Registration')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (!auth.smsConfigured)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: const Text(
                          'Server SMS gateway is not configured yet. Real SMS OTP is mandatory—registration cannot bypass OTP.',
                          style: TextStyle(fontSize: 12.5, color: Color(0xFF92400E)),
                        ),
                      ),
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12.5)),
                      ),
                    if (_success != null)
                      Container(
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFA7F3D0)),
                        ),
                        child: Text(_success!, style: const TextStyle(color: Color(0xFF065F46), fontSize: 12.5)),
                      ),
                    Text('Step 1: Verify Mobile via Real SMS OTP',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _mobileCtrl,
                            enabled: _otpVerificationToken == null,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(labelText: '10-Digit Mobile Number'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: (_busy || _cooldown > 0 || _otpVerificationToken != null) ? null : _sendOtp,
                          child: Text(_cooldown > 0 ? '${_cooldown}s' : 'Send OTP'),
                        ),
                      ],
                    ),
                    if (_otpSent && _otpVerificationToken == null) ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _otpCtrl,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(labelText: 'Enter 6-Digit SMS OTP'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: _busy ? null : _verifyOtp,
                            child: const Text('Verify OTP'),
                          ),
                        ],
                      ),
                    ],
                    const Divider(height: 28),
                    Text('Step 2: Account & Profile Details',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _nameCtrl,
                      decoration: InputDecoration(labelText: widget.isClient ? 'Client / Company Name' : 'Full Name'),
                    ),
                    const SizedBox(height: 10),
                    TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email Address')),
                    const SizedBox(height: 10),
                    if (!widget.isClient) ...[
                      DropdownButtonFormField<String>(
                        value: _employeeType,
                        decoration: const InputDecoration(labelText: 'Employee Type'),
                        items: const [
                          DropdownMenuItem(value: 'PERMANENT', child: Text('Permanent Employee')),
                          DropdownMenuItem(value: 'CONTRACT', child: Text('Contract Employee')),
                          DropdownMenuItem(value: 'DAILY_WAGE', child: Text('Daily Wage Labour')),
                        ],
                        onChanged: (v) => setState(() => _employeeType = v ?? 'PERMANENT'),
                      ),
                      const SizedBox(height: 10),
                      TextField(controller: _emergencyCtrl, decoration: const InputDecoration(labelText: 'Emergency Contact')),
                      const SizedBox(height: 10),
                    ] else ...[
                      Row(
                        children: [
                          Expanded(child: TextField(controller: _cityCtrl, decoration: const InputDecoration(labelText: 'City'))),
                          const SizedBox(width: 10),
                          Expanded(child: TextField(controller: _stateCtrl, decoration: const InputDecoration(labelText: 'State'))),
                        ],
                      ),
                      const SizedBox(height: 10),
                      TextField(controller: _gstinCtrl, decoration: const InputDecoration(labelText: 'GSTIN (Optional)')),
                      const SizedBox(height: 10),
                    ],
                    TextField(controller: _addressCtrl, decoration: const InputDecoration(labelText: 'Full Address')),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _pwCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Strong Password'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _confirmCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Confirm Password'),
                    ),
                    const SizedBox(height: 18),
                    ElevatedButton(
                      onPressed: (_busy || _otpVerificationToken == null) ? null : _submitRegistration,
                      child: const Text('Submit Registration for Admin Approval'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
