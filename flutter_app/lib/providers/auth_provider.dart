import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService api;

  AuthProvider(this.api);

  bool loading = false;
  bool ownerInitialized = true;
  bool smsConfigured = false;
  String? smsProvider;
  String dbMode = 'mysql';
  Map<String, dynamic>? user;
  Map<String, dynamic>? company;
  Map<String, dynamic>? employeeProfile;
  Map<String, dynamic>? clientProfile;
  int unreadNotifications = 0;

  bool get isAuthenticated => user != null;
  String get role => (user?['role'] ?? '').toString();

  bool get isAdminPortalRole =>
      ['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'].contains(role);
  bool get isClient => role == 'CLIENT';

  Future<void> checkSetupAndRestoreSession() async {
    loading = true;
    notifyListeners();
    try {
      await api.init();
      final setup = Map<String, dynamic>.from(await api.get('/auth/setup-status', cacheOnSuccess: false) as Map);
      ownerInitialized = setup['ownerInitialized'] == true;
      smsConfigured = setup['smsConfigured'] == true;
      smsProvider = setup['smsProvider']?.toString();
      dbMode = (setup['dbMode'] ?? 'mysql').toString();
      if (setup['company'] is Map) {
        company = Map<String, dynamic>.from(setup['company'] as Map);
      }
      if (api.token != null) {
        await refreshMe();
      }
    } catch (_) {
      // Session invalid or offline
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshMe() async {
    try {
      final me = Map<String, dynamic>.from(await api.get('/auth/me') as Map);
      user = Map<String, dynamic>.from(me['user'] as Map);
      company = me['company'] != null ? Map<String, dynamic>.from(me['company'] as Map) : company;
      employeeProfile = me['employee'] != null ? Map<String, dynamic>.from(me['employee'] as Map) : null;
      clientProfile = me['client'] != null ? Map<String, dynamic>.from(me['client'] as Map) : null;
      unreadNotifications = int.tryParse('${me['unreadNotifications'] ?? 0}') ?? 0;
      notifyListeners();
    } catch (_) {
      await logout();
    }
  }

  Future<void> bootstrapOwner({
    required String mobile,
    required String fullName,
    required String email,
    required String password,
    required String confirmPassword,
    String? setupSecret,
  }) async {
    final res = Map<String, dynamic>.from(await api.post('/auth/bootstrap-owner', {
      'mobile': mobile,
      'fullName': fullName,
      'email': email,
      'password': password,
      'confirmPassword': confirmPassword,
      if (setupSecret != null && setupSecret.isNotEmpty) 'setupSecret': setupSecret,
    }) as Map);
    await api.setToken(res['token'].toString());
    ownerInitialized = true;
    await refreshMe();
  }

  Future<void> login({
    required String identifier,
    required String password,
    required String portal,
  }) async {
    final res = Map<String, dynamic>.from(await api.post('/auth/login', {
      'identifier': identifier,
      'password': password,
      'portal': portal,
    }) as Map);
    await api.setToken(res['token'].toString());
    await refreshMe();
  }

  Future<void> logout() async {
    await api.setToken(null);
    user = null;
    employeeProfile = null;
    clientProfile = null;
    notifyListeners();
  }
}
