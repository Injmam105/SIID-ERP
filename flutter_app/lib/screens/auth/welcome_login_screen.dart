import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/app_config.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/siid_theme.dart';
import 'registration_screen.dart';

class WelcomeLoginScreen extends StatefulWidget {
  const WelcomeLoginScreen({super.key});

  @override
  State<WelcomeLoginScreen> createState() => _WelcomeLoginScreenState();
}

class _WelcomeLoginScreenState extends State<WelcomeLoginScreen> {
  String _portal = 'ADMIN';
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;
  String? _error;

  // Initial Owner Bootstrap controllers
  final _ownerNameCtrl = TextEditingController(text: AppConfig.ownerName);
  final _ownerMobileCtrl = TextEditingController(text: AppConfig.ownerMobile);
  final _ownerEmailCtrl = TextEditingController(text: AppConfig.officialEmail);
  final _ownerPwCtrl = TextEditingController();
  final _ownerConfirmCtrl = TextEditingController();
  final _setupSecretCtrl = TextEditingController();

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    _ownerNameCtrl.dispose();
    _ownerMobileCtrl.dispose();
    _ownerEmailCtrl.dispose();
    _ownerPwCtrl.dispose();
    _ownerConfirmCtrl.dispose();
    _setupSecretCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitLogin() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().login(
            identifier: _identifierCtrl.text.trim(),
            password: _passwordCtrl.text,
            portal: _portal,
          );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _submitOwnerBootstrap() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().bootstrapOwner(
            mobile: _ownerMobileCtrl.text.trim(),
            fullName: _ownerNameCtrl.text.trim(),
            email: _ownerEmailCtrl.text.trim(),
            password: _ownerPwCtrl.text,
            confirmPassword: _ownerConfirmCtrl.text,
            setupSecret: _setupSecretCtrl.text.trim(),
          );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _openServerConfigDialog() {
    final api = context.read<ApiService>();
    final ctrl = TextEditingController(text: api.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Backend MySQL Server URL'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'API Base URL',
            hintText: 'https://your-server.com/api',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await api.setBaseUrl(ctrl.text.trim());
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) await context.read<AuthProvider>().checkSetupAndRestoreSession();
            },
            child: const Text('Save & Reconnect'),
          ),
        ],
      ),
    );
  }

  void _openForgotPasswordDialog() {
    final mobileCtrl = TextEditingController();
    final otpCtrl = TextEditingController();
    final newPwCtrl = TextEditingController();
    final confirmPwCtrl = TextEditingController();
    String? verifiedToken;
    String? dialogErr;
    bool busy = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => AlertDialog(
          title: const Text('Reset Password via SMS OTP'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (dialogErr != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(dialogErr!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ),
                TextField(
                  controller: mobileCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Registered Mobile Number'),
                ),
                const SizedBox(height: 10),
                if (verifiedToken == null) ...[
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: otpCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: '6-digit OTP'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: busy
                            ? null
                            : () async {
                                setModal(() {
                                  busy = true;
                                  dialogErr = null;
                                });
                                try {
                                  await context.read<ApiService>().post('/otp/send', {
                                    'mobile': mobileCtrl.text.trim(),
                                    'purpose': 'PASSWORD_RESET',
                                  });
                                } catch (e) {
                                  dialogErr = e.toString();
                                } finally {
                                  setModal(() => busy = false);
                                }
                              },
                        child: const Text('Send OTP'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: busy
                          ? null
                          : () async {
                              setModal(() {
                                busy = true;
                                dialogErr = null;
                              });
                              try {
                                final res = await context.read<ApiService>().post('/otp/verify', {
                                  'mobile': mobileCtrl.text.trim(),
                                  'purpose': 'PASSWORD_RESET',
                                  'otp': otpCtrl.text.trim(),
                                });
                                verifiedToken = res['otpVerificationToken'].toString();
                              } catch (e) {
                                dialogErr = e.toString();
                              } finally {
                                setModal(() => busy = false);
                              }
                            },
                      child: const Text('Verify OTP'),
                    ),
                  ),
                ] else ...[
                  TextField(
                    controller: newPwCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'New Strong Password'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: confirmPwCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Confirm Password'),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            if (verifiedToken != null)
              ElevatedButton(
                onPressed: busy
                    ? null
                    : () async {
                        setModal(() {
                          busy = true;
                          dialogErr = null;
                        });
                        try {
                          await context.read<ApiService>().post('/auth/reset-password', {
                            'mobile': mobileCtrl.text.trim(),
                            'newPassword': newPwCtrl.text,
                            'confirmPassword': confirmPwCtrl.text,
                            'otpVerificationToken': verifiedToken,
                          });
                          if (ctx.mounted) Navigator.pop(ctx);
                        } catch (e) {
                          setModal(() {
                            dialogErr = e.toString();
                            busy = false;
                          });
                        }
                      },
                child: const Text('Reset Password'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(AppConfig.shortName,
                                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: SiidTheme.deepNavy)),
                            Text(AppConfig.companyName,
                                style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569))),
                          ],
                        ),
                        IconButton(
                          tooltip: 'Server Settings',
                          onPressed: _openServerConfigDialog,
                          icon: const Icon(Icons.dns_outlined),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      AppConfig.tagline,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SiidTheme.elegantGold),
                    ),
                    const Divider(height: 28),
                    if (!auth.ownerInitialized && _portal == 'ADMIN') ...[
                      const Text('Protected First-Time Owner Setup',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      const Text(
                        'Initialize the authorized Super Admin account for MD Zawed Ansar (9650598785). This setup locks permanently once completed.',
                        style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 14),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12.5)),
                        ),
                      TextField(controller: _ownerNameCtrl, decoration: const InputDecoration(labelText: 'Owner Full Name')),
                      const SizedBox(height: 10),
                      TextField(controller: _ownerMobileCtrl, readOnly: true, decoration: const InputDecoration(labelText: 'Authorized Owner Mobile')),
                      const SizedBox(height: 10),
                      TextField(controller: _ownerEmailCtrl, decoration: const InputDecoration(labelText: 'Official Email')),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _ownerPwCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Strong Password (8+ chars, Upper, Lower, Digit, Symbol)'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _ownerConfirmCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Confirm Password'),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _setupSecretCtrl,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Setup Security Key (if configured)'),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _submitting ? null : _submitOwnerBootstrap,
                        child: Text(_submitting ? 'Initializing...' : 'Initialize Owner Account'),
                      ),
                    ] else ...[
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'ADMIN', label: Text('Admin')),
                          ButtonSegment(value: 'EMPLOYEE', label: Text('Employee')),
                          ButtonSegment(value: 'CLIENT', label: Text('Client')),
                        ],
                        selected: {_portal},
                        onSelectionChanged: (s) => setState(() {
                          _portal = s.first;
                          _error = null;
                        }),
                      ),
                      const SizedBox(height: 18),
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
                      TextField(
                        controller: _identifierCtrl,
                        decoration: const InputDecoration(labelText: 'Registered Mobile Number or Email'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _passwordCtrl,
                        obscureText: _obscure,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          suffixIcon: IconButton(
                            onPressed: () => setState(() => _obscure = !_obscure),
                            icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                          ),
                        ),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: _openForgotPasswordDialog,
                          child: const Text('Forgot Password?'),
                        ),
                      ),
                      const SizedBox(height: 6),
                      ElevatedButton(
                        onPressed: _submitting ? null : _submitLogin,
                        child: Text(_submitting ? 'Signing In...' : 'Sign In to $_portal Portal'),
                      ),
                      if (_portal != 'ADMIN') ...[
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => RegistrationScreen(isClient: _portal == 'CLIENT'),
                            ),
                          ),
                          child: Text(_portal == 'CLIENT'
                              ? 'New Client Registration (SMS OTP)'
                              : 'New Employee / Labour Registration (SMS OTP)'),
                        ),
                      ],
                    ],
                    const Divider(height: 28),
                    Text(
                      'Developed By ${AppConfig.developedBy} (${AppConfig.developerDesignation}) · IT Support: ${AppConfig.itSupportNumber}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
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
