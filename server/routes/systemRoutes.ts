import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { Router } from 'express';
import multer from 'multer';
import { type AuthedRequest, requireAuth, requireRoles } from '../auth.ts';
import { execute, getDbMode, queryAll, queryOne } from '../db.ts';
import { getSmsConfigStatus } from '../sms.ts';

const router = Router();

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    dbMode: getDbMode(),
    sms: getSmsConfigStatus(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/company', async (_req, res) => {
  try {
    const company = await queryOne(`SELECT * FROM company_settings WHERE id = 'SIID_COMPANY_DEFAULT'`);
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/company', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const {
      companyName,
      ownerName,
      ownerMobile,
      officialEmail,
      website,
      gstin,
      address,
      city,
      state,
      itSupportNumber,
      tagline,
      logoUrl,
      signatureUrl,
      defaultGstRate,
      taxLabel,
      pdfFooterNote,
      backupRetentionDays,
    } = req.body as Record<string, unknown>;

    await execute(
      `UPDATE company_settings SET
        company_name = COALESCE(?, company_name),
        owner_name = COALESCE(?, owner_name),
        owner_mobile = COALESCE(?, owner_mobile),
        official_email = COALESCE(?, official_email),
        website = COALESCE(?, website),
        gstin = COALESCE(?, gstin),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        it_support_number = COALESCE(?, it_support_number),
        tagline = COALESCE(?, tagline),
        logo_url = COALESCE(?, logo_url),
        signature_url = COALESCE(?, signature_url),
        default_gst_rate = COALESCE(?, default_gst_rate),
        tax_label = COALESCE(?, tax_label),
        pdf_footer_note = COALESCE(?, pdf_footer_note),
        backup_retention_days = COALESCE(?, backup_retention_days),
        updated_at = ?, updated_by = ?
       WHERE id = 'SIID_COMPANY_DEFAULT'`,
      [
        companyName || null,
        ownerName || null,
        ownerMobile || null,
        officialEmail || null,
        website || null,
        gstin !== undefined ? String(gstin) : null,
        address || null,
        city || null,
        state || null,
        itSupportNumber || null,
        tagline || null,
        logoUrl || null,
        signatureUrl || null,
        defaultGstRate !== undefined ? Number(defaultGstRate) : null,
        taxLabel || null,
        pdfFooterNote || null,
        backupRetentionDays !== undefined ? Number(backupRetentionDays) : null,
        new Date().toISOString(),
        req.user!.id,
      ]
    );
    const updated = await queryOne(`SELECT * FROM company_settings WHERE id = 'SIID_COMPANY_DEFAULT'`);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/uploads', requireAuth, upload.single('file'), async (req: AuthedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }
    const { entityType = 'general', entityId = req.user!.id, title } = req.body as Record<string, string>;
    const fileUrl = `/uploads/${req.file.filename}`;
    const docId = crypto.randomUUID();
    await execute(
      `INSERT INTO documents (id, company_id, entity_type, entity_id, title, file_name, mime_type, file_size, file_url, created_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        entityType,
        entityId,
        title || req.file.originalname,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        fileUrl,
        new Date().toISOString(),
        req.user!.id,
      ]
    );
    res.status(201).json({ id: docId, fileUrl, fileName: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/documents', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'].includes(req.user!.role)) {
      const rows = await queryAll(`SELECT * FROM documents ORDER BY created_at DESC`);
      res.json(rows);
      return;
    }
    const rows = await queryAll(`SELECT * FROM documents WHERE created_by = ? OR is_private = 0 ORDER BY created_at DESC`, [req.user!.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/notifications', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rows = await queryAll(
      `SELECT * FROM notifications
       WHERE target_user_id = ? OR target_role = ? OR (target_role = 'ADMIN' AND ? IN ('OWNER','ADMIN'))
       ORDER BY created_at DESC LIMIT 80`,
      [req.user!.id, req.user!.role, req.user!.role]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await execute(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id]);
    res.json({ read: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await execute(
      `UPDATE notifications SET is_read = 1
       WHERE target_user_id = ? OR target_role = ? OR (target_role = 'ADMIN' AND ? IN ('OWNER','ADMIN'))`,
      [req.user!.id, req.user!.role, req.user!.role]
    );
    res.json({ readAll: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/complaints', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      const rows = cli
        ? await queryAll(`SELECT * FROM complaints WHERE client_id = ? ORDER BY created_at DESC`, [cli.id])
        : [];
      res.json(rows);
      return;
    }
    const rows = await queryAll(
      `SELECT cm.*, c.client_name, p.project_name FROM complaints cm LEFT JOIN clients c ON c.id = cm.client_id LEFT JOIN projects p ON p.id = cm.project_id ORDER BY cm.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/complaints', requireAuth, requireRoles('CLIENT', 'OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { projectId, subject, description, clientId } = req.body as Record<string, string>;
    let targetClientId = clientId;
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      if (!cli) {
        res.status(400).json({ error: 'Client profile not found.' });
        return;
      }
      targetClientId = cli.id;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO complaints (id, company_id, client_id, project_id, subject, description, status, created_at, updated_at)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, 'OPEN', ?, ?)`,
      [id, targetClientId, projectId || null, subject, description, now, now]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/complaints/:id', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const { status, adminResponse } = req.body as { status: string; adminResponse?: string };
    await execute(`UPDATE complaints SET status = ?, admin_response = ?, updated_at = ? WHERE id = ?`, [
      status,
      adminResponse || null,
      new Date().toISOString(),
      req.params.id,
    ]);
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== BACKUPS & FLUTTER/MYSQL SOURCE BUNDLE ====================

router.get('/backups', requireAuth, requireRoles('OWNER', 'ADMIN'), async (_req, res) => {
  try {
    const rows = await queryAll(`SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 30`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/backups/export', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const tables = [
      'company_settings',
      'employees',
      'clients',
      'projects',
      'project_sites',
      'attendance',
      'leaves',
      'advances',
      'salary_records',
      'interior_designs',
      'construction_stages',
      'inventory_items',
      'stock_ledger',
      'vendors',
      'quotations',
      'quotation_items',
      'quotation_materials',
      'invoices',
      'payments',
      'expenses',
      'documents',
      'complaints',
    ];
    const snapshot: Record<string, unknown[]> = {};
    let totalCount = 0;
    for (const t of tables) {
      const rows = await queryAll(`SELECT * FROM ${t}`);
      snapshot[t] = rows;
      totalCount += rows.length;
    }
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), dbMode: getDbMode(), snapshot }, null, 2);
    const checksum = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);

    await execute(
      `INSERT INTO backup_logs (id, company_id, backup_type, record_count, checksum, created_by, created_at)
       VALUES (?, 'SIID_MAIN', 'FULL_JSON_EXPORT', ?, ?, ?, ?)`,
      [crypto.randomUUID(), totalCount, checksum, req.user!.id, new Date().toISOString()]
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="siid_erp_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(payload);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/export-flutter-bundle', (_req, res) => {
  const flutterDir = path.resolve(process.cwd(), 'flutter_app');
  const mysqlDir = path.resolve(process.cwd(), 'mysql');
  const serverDir = path.resolve(process.cwd(), 'server');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="siid_erp_flutter_mysql_bundle.zip"');

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err: Error) => res.status(500).end(err.message));
  archive.pipe(res);

  if (fs.existsSync(flutterDir)) archive.directory(flutterDir, 'flutter_app');
  if (fs.existsSync(mysqlDir)) archive.directory(mysqlDir, 'mysql');
  if (fs.existsSync(serverDir)) archive.directory(serverDir, 'backend_node_mysql/server');
  const serverEntry = path.resolve(process.cwd(), 'server.ts');
  if (fs.existsSync(serverEntry)) archive.file(serverEntry, { name: 'backend_node_mysql/server.ts' });
  const envExample = path.resolve(process.cwd(), '.env.example');
  if (fs.existsSync(envExample)) archive.file(envExample, { name: 'backend_node_mysql/.env.example' });
  const pkgJson = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgJson)) archive.file(pkgJson, { name: 'backend_node_mysql/package.json' });

  archive.finalize();
});

export default router;
