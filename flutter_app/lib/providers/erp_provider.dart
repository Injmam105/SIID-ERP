import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ErpProvider extends ChangeNotifier {
  final ApiService api;
  ErpProvider(this.api);

  bool busy = false;
  String? error;
  bool darkMode = false;

  List<Map<String, dynamic>> employees = [];
  List<Map<String, dynamic>> clients = [];
  List<Map<String, dynamic>> projects = [];
  List<Map<String, dynamic>> sites = [];
  List<Map<String, dynamic>> attendance = [];
  List<Map<String, dynamic>> leaves = [];
  List<Map<String, dynamic>> advances = [];
  List<Map<String, dynamic>> salaryRecords = [];
  List<Map<String, dynamic>> interiorDesigns = [];
  List<Map<String, dynamic>> constructionStages = [];
  List<Map<String, dynamic>> inventoryItems = [];
  List<Map<String, dynamic>> stockLedger = [];
  List<Map<String, dynamic>> vendors = [];
  List<Map<String, dynamic>> quotations = [];
  List<Map<String, dynamic>> invoices = [];
  List<Map<String, dynamic>> payments = [];
  List<Map<String, dynamic>> expenses = [];
  List<Map<String, dynamic>> notifications = [];
  List<Map<String, dynamic>> complaints = [];
  Map<String, dynamic> financeSummary = {};

  void toggleTheme() {
    darkMode = !darkMode;
    notifyListeners();
  }

  List<Map<String, dynamic>> _asList(dynamic data) {
    if (data is List) {
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<void> syncAllForRole(String role) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.flushOfflineQueue();
      final futures = <Future>[];
      futures.add(api.get('/projects').then((v) => projects = _asList(v)).catchError((_) {}));
      futures.add(api.get('/sites').then((v) => sites = _asList(v)).catchError((_) {}));
      futures.add(api.get('/quotations').then((v) => quotations = _asList(v)).catchError((_) {}));
      futures.add(api.get('/interior').then((v) => interiorDesigns = _asList(v)).catchError((_) {}));
      futures.add(api.get('/notifications').then((v) => notifications = _asList(v)).catchError((_) {}));

      if (role != 'CLIENT') {
        futures.add(api.get('/employees').then((v) => employees = _asList(v)).catchError((_) {}));
        futures.add(api.get('/attendance').then((v) => attendance = _asList(v)).catchError((_) {}));
        futures.add(api.get('/leaves').then((v) => leaves = _asList(v)).catchError((_) {}));
        futures.add(api.get('/advances').then((v) => advances = _asList(v)).catchError((_) {}));
        futures.add(api.get('/salary').then((v) => salaryRecords = _asList(v)).catchError((_) {}));
        futures.add(api.get('/construction').then((v) => constructionStages = _asList(v)).catchError((_) {}));
        futures.add(api.get('/inventory').then((v) {
          if (v is Map) {
            inventoryItems = _asList(v['items']);
            stockLedger = _asList(v['ledger']);
          }
        }).catchError((_) {}));
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'].contains(role)) {
        futures.add(api.get('/clients').then((v) => clients = _asList(v)).catchError((_) {}));
        futures.add(api.get('/vendors').then((v) => vendors = _asList(v)).catchError((_) {}));
        futures.add(api.get('/expenses').then((v) => expenses = _asList(v)).catchError((_) {}));
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'CLIENT'].contains(role)) {
        futures.add(api.get('/invoices').then((v) => invoices = _asList(v)).catchError((_) {}));
        futures.add(api.get('/payments').then((v) => payments = _asList(v)).catchError((_) {}));
        futures.add(api.get('/complaints').then((v) => complaints = _asList(v)).catchError((_) {}));
      }

      if (['OWNER', 'ADMIN', 'ACCOUNTANT'].contains(role)) {
        futures.add(api.get('/finance/summary').then((v) {
          if (v is Map) financeSummary = Map<String, dynamic>.from(v);
        }).catchError((_) {}));
      }

      await Future.wait(futures);
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }
}
