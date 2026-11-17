import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import '../providers/erp_provider.dart';
import '../services/api_service.dart';
import '../theme/siid_theme.dart';

class SiidNavItem {
  final String key;
  final String label;
  final IconData icon;
  const SiidNavItem(this.key, this.label, this.icon);
}

class SiidShell extends StatelessWidget {
  final String activeKey;
  final List<SiidNavItem> navItems;
  final ValueChanged<String> onSelect;
  final Widget child;
  final String title;

  const SiidShell({
    super.key,
    required this.activeKey,
    required this.navItems,
    required this.onSelect,
    required this.child,
    required this.title,
  });

  String _syncLabel(SyncStatus s, int pending) {
    switch (s) {
      case SyncStatus.online:
        return 'Online';
      case SyncStatus.offline:
        return 'Offline';
      case SyncStatus.syncPending:
        return 'Sync Pending ($pending)';
      case SyncStatus.syncing:
        return 'Syncing...';
      case SyncStatus.syncCompleted:
        return 'Sync Completed';
      case SyncStatus.syncFailed:
        return 'Sync Failed';
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final erp = context.watch<ErpProvider>();
    final api = context.watch<ApiService>();
    final isWide = MediaQuery.of(context).size.width >= 960;

    final sidebar = Container(
      width: 260,
      color: SiidTheme.deepNavy,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFF1E3A5F))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Center(
                      child: Text('SIID', style: TextStyle(fontWeight: FontWeight.w800, color: SiidTheme.deepNavy)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('SIID ERP', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                        Text(
                          (auth.user?['role'] ?? '').toString().replaceAll('_', ' '),
                          style: const TextStyle(color: SiidTheme.elegantGold, fontSize: 11, fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
                children: navItems.map((item) {
                  final active = item.key == activeKey;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: ListTile(
                      dense: true,
                      selected: active,
                      selectedTileColor: SiidTheme.royalBlue,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      leading: Icon(item.icon, size: 20, color: active ? Colors.white : const Color(0xFF94A3B8)),
                      title: Text(
                        item.label,
                        style: TextStyle(
                          color: active ? Colors.white : const Color(0xFFE2E8F0),
                          fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                          fontSize: 13.5,
                        ),
                      ),
                      onTap: () {
                        if (!isWide) Navigator.of(context).pop();
                        onSelect(item.key);
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFF1E3A5F))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${auth.user?['full_name'] ?? ''}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                  Text('IT Support: ${AppConfig.itSupportNumber}',
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0xFF334155)),
                      ),
                      onPressed: () => auth.logout(),
                      icon: const Icon(Icons.logout, size: 16),
                      label: const Text('Logout'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    return Scaffold(
      drawer: isWide ? null : Drawer(child: sidebar),
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Center(
              child: Text(
                _syncLabel(api.syncStatus, api.pendingQueueCount),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: api.syncStatus == SyncStatus.offline ? Colors.red : SiidTheme.royalBlue,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Sync Cloud Database',
            onPressed: () => erp.syncAllForRole(auth.role),
            icon: erp.busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.sync),
          ),
          IconButton(
            tooltip: 'Toggle Light / Dark Mode',
            onPressed: () => erp.toggleTheme(),
            icon: Icon(erp.darkMode ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
          ),
        ],
      ),
      body: Row(
        children: [
          if (isWide) sidebar,
          Expanded(child: child),
        ],
      ),
    );
  }
}
