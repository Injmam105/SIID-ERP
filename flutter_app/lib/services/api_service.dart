import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

enum SyncStatus { online, offline, syncPending, syncing, syncCompleted, syncFailed }

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final Map<String, dynamic>? details;
  ApiException(this.statusCode, this.message, [this.details]);
  @override
  String toString() => message;
}

class ApiService extends ChangeNotifier {
  static const _tokenKey = 'siid_jwt_token';
  static const _baseUrlKey = 'siid_api_base_url';
  static const _queueKey = 'siid_offline_sync_queue';
  static const _cachePrefix = 'siid_cache_';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  String _baseUrl = AppConfig.defaultApiBaseUrl;
  String? _token;
  SyncStatus syncStatus = SyncStatus.online;
  String? lastSyncError;
  int pendingQueueCount = 0;

  String get baseUrl => _baseUrl;
  String? get token => _token;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString(_baseUrlKey) ?? AppConfig.defaultApiBaseUrl;
    _token = await _secureStorage.read(key: _tokenKey);
    final rawQueue = prefs.getStringList(_queueKey) ?? [];
    pendingQueueCount = rawQueue.length;
    if (pendingQueueCount > 0) {
      syncStatus = SyncStatus.syncPending;
    }
    notifyListeners();
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseUrlKey, _baseUrl);
    notifyListeners();
  }

  Future<void> setToken(String? jwt) async {
    _token = jwt;
    if (jwt == null) {
      await _secureStorage.delete(key: _tokenKey);
    } else {
      await _secureStorage.write(key: _tokenKey, value: jwt);
    }
  }

  Map<String, String> _headers() => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<dynamic> get(String path, {bool cacheOnSuccess = true}) async {
    try {
      final resp = await http
          .get(Uri.parse('$_baseUrl$path'), headers: _headers())
          .timeout(const Duration(seconds: 20));
      final body = _decode(resp);
      syncStatus = pendingQueueCount > 0 ? SyncStatus.syncPending : SyncStatus.online;
      if (cacheOnSuccess) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('$_cachePrefix$path', jsonEncode(body));
      }
      notifyListeners();
      return body;
    } on ApiException {
      rethrow;
    } catch (e) {
      syncStatus = SyncStatus.offline;
      notifyListeners();
      if (cacheOnSuccess) {
        final prefs = await SharedPreferences.getInstance();
        final cached = prefs.getString('$_cachePrefix$path');
        if (cached != null) return jsonDecode(cached);
      }
      throw ApiException(0, 'Network unavailable. Showing cached data if available.');
    }
  }

  Future<dynamic> post(String path, Map<String, dynamic> data, {bool allowOfflineQueue = false}) async {
    return _mutate('POST', path, data, allowOfflineQueue: allowOfflineQueue);
  }

  Future<dynamic> put(String path, Map<String, dynamic> data, {bool allowOfflineQueue = false}) async {
    return _mutate('PUT', path, data, allowOfflineQueue: allowOfflineQueue);
  }

  Future<dynamic> delete(String path) async {
    final resp = await http
        .delete(Uri.parse('$_baseUrl$path'), headers: _headers())
        .timeout(const Duration(seconds: 20));
    return _decode(resp);
  }

  Future<dynamic> _mutate(String method, String path, Map<String, dynamic> data, {bool allowOfflineQueue = false}) async {
    try {
      final uri = Uri.parse('$_baseUrl$path');
      final resp = await (method == 'POST'
              ? http.post(uri, headers: _headers(), body: jsonEncode(data))
              : http.put(uri, headers: _headers(), body: jsonEncode(data)))
          .timeout(const Duration(seconds: 25));
      final decoded = _decode(resp);
      syncStatus = pendingQueueCount > 0 ? SyncStatus.syncPending : SyncStatus.online;
      notifyListeners();
      return decoded;
    } on ApiException {
      rethrow;
    } catch (e) {
      if (allowOfflineQueue) {
        await _enqueue(method, path, data);
        return {'queuedOffline': true};
      }
      syncStatus = SyncStatus.offline;
      notifyListeners();
      throw ApiException(0, 'Server unreachable. Financial and approval actions require live server confirmation.');
    }
  }

  Future<Map<String, dynamic>> uploadFile({
    required String filePath,
    required String entityType,
    required String entityId,
    required String title,
  }) async {
    final uri = Uri.parse('$_baseUrl/uploads');
    final request = http.MultipartRequest('POST', uri);
    if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
    request.fields['entityType'] = entityType;
    request.fields['entityId'] = entityId;
    request.fields['title'] = title;
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    final streamed = await request.send();
    final resp = await http.Response.fromStream(streamed);
    return Map<String, dynamic>.from(_decode(resp) as Map);
  }

  Future<void> _enqueue(String method, String path, Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_queueKey) ?? [];
    queue.add(jsonEncode({'method': method, 'path': path, 'data': data, 'ts': DateTime.now().toIso8601String()}));
    await prefs.setStringList(_queueKey, queue);
    pendingQueueCount = queue.length;
    syncStatus = SyncStatus.syncPending;
    notifyListeners();
  }

  Future<void> flushOfflineQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_queueKey) ?? [];
    if (queue.isEmpty) {
      syncStatus = SyncStatus.online;
      notifyListeners();
      return;
    }
    syncStatus = SyncStatus.syncing;
    notifyListeners();
    final remaining = <String>[];
    for (final raw in queue) {
      try {
        final item = jsonDecode(raw) as Map<String, dynamic>;
        await _mutate(
          item['method'] as String,
          item['path'] as String,
          Map<String, dynamic>.from(item['data'] as Map),
          allowOfflineQueue: false,
        );
      } catch (e) {
        lastSyncError = e.toString();
        remaining.add(raw);
      }
    }
    await prefs.setStringList(_queueKey, remaining);
    pendingQueueCount = remaining.length;
    syncStatus = remaining.isEmpty ? SyncStatus.syncCompleted : SyncStatus.syncFailed;
    notifyListeners();
  }

  dynamic _decode(http.Response resp) {
    final text = resp.body.isEmpty ? '{}' : resp.body;
    final parsed = jsonDecode(text);
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      return parsed;
    }
    final errMsg = (parsed is Map && parsed['error'] != null)
        ? parsed['error'].toString()
        : 'Request failed (HTTP ${resp.statusCode})';
    throw ApiException(resp.statusCode, errMsg, parsed is Map<String, dynamic> ? parsed : null);
  }
}
