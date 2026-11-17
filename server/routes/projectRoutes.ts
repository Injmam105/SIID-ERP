import crypto from 'node:crypto';
import { Router } from 'express';
import { type AuthedRequest, requireAuth, requireRoles } from '../auth.ts';
import { execute, queryAll, queryOne } from '../db.ts';

const router = Router();

// ==================== PROJECTS & SITES ====================

router.get('/projects', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const role = req.user!.role;
    let rows;
    if (['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(role)) {
      rows = await queryAll(
        `SELECT p.*, c.client_name, c.mobile AS client_mobile
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id
         ORDER BY p.created_at DESC`
      );
    } else if (role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      rows = cli
        ? await queryAll(
            `SELECT p.*, c.client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.client_id = ? ORDER BY p.created_at DESC`,
            [cli.id]
          )
        : [];
    } else {
      const emp = await queryOne<{ id: string; assigned_project_id: string | null }>(`SELECT id, assigned_project_id FROM employees WHERE user_id = ?`, [
        req.user!.id,
      ]);
      rows = await queryAll(
        `SELECT p.*, c.client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id
         WHERE p.site_manager_id = ? OR p.designer_id = ? OR p.id = ? OR p.assigned_employees_json LIKE ?
         ORDER BY p.created_at DESC`,
        [emp?.id || '', emp?.id || '', emp?.assigned_project_id || '', `%${emp?.id || 'NONE'}%`]
      );
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/projects', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const {
      projectName,
      clientId,
      category,
      address,
      city,
      state,
      startDate,
      expectedCompletionDate,
      budget,
      siteManagerId,
      designerId,
      assignedEmployees,
      description,
      status,
    } = req.body as Record<string, unknown>;

    if (!projectName || !clientId || !category) {
      res.status(400).json({ error: 'Project Name, Client, and Category are required.' });
      return;
    }
    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM projects`);
    const projectCode = `SIID-PRJ-${new Date().getFullYear()}-${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO projects (
        id, company_id, project_code, project_name, client_id, category, address, city, state,
        start_date, expected_completion_date, budget, site_manager_id, designer_id,
        assigned_employees_json, description, progress_percent, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        id,
        projectCode,
        String(projectName).trim(),
        clientId,
        category,
        address || null,
        city || null,
        state || null,
        startDate || now.slice(0, 10),
        expectedCompletionDate || null,
        Number(budget || 0),
        siteManagerId || null,
        designerId || null,
        JSON.stringify(assignedEmployees || []),
        description || null,
        status || 'PLANNING',
        now,
        now,
        req.user!.id,
      ]
    );
    res.status(201).json({ id, project_code: projectCode });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/projects/:id', requireAuth, requireRoles('OWNER', 'ADMIN', 'SITE_MANAGER', 'INTERIOR_DESIGNER'), async (req: AuthedRequest, res) => {
  try {
    const { projectName, status, progressPercent, budget, siteManagerId, designerId, expectedCompletionDate, description } = req.body as Record<
      string,
      unknown
    >;
    await execute(
      `UPDATE projects SET
        project_name = COALESCE(?, project_name),
        status = COALESCE(?, status),
        progress_percent = COALESCE(?, progress_percent),
        budget = COALESCE(?, budget),
        site_manager_id = COALESCE(?, site_manager_id),
        designer_id = COALESCE(?, designer_id),
        expected_completion_date = COALESCE(?, expected_completion_date),
        description = COALESCE(?, description),
        updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [
        projectName || null,
        status || null,
        progressPercent !== undefined ? Number(progressPercent) : null,
        budget !== undefined ? Number(budget) : null,
        siteManagerId || null,
        designerId || null,
        expectedCompletionDate || null,
        description || null,
        new Date().toISOString(),
        req.user!.id,
        req.params.id,
      ]
    );
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/sites', requireAuth, async (_req, res) => {
  try {
    const rows = await queryAll(
      `SELECT s.*, p.project_name, p.project_code, e.full_name AS site_manager_name
       FROM project_sites s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN employees e ON e.id = s.site_manager_id
       ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/sites', requireAuth, requireRoles('OWNER', 'ADMIN', 'SITE_MANAGER'), async (req: AuthedRequest, res) => {
  try {
    const { projectId, siteName, location, city, siteManagerId } = req.body as Record<string, string>;
    if (!projectId || !siteName) {
      res.status(400).json({ error: 'Project and Site Name are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO project_sites (id, company_id, project_id, site_name, location, city, site_manager_id, progress_percent, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?, ?)`,
      [id, projectId, siteName.trim(), location || null, city || null, siteManagerId || null, now, now, req.user!.id]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== CONSTRUCTION PROGRESS ====================

router.get('/construction', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    const rows = projectId
      ? await queryAll(
          `SELECT cs.*, p.project_name FROM construction_stages cs JOIN projects p ON p.id = cs.project_id WHERE cs.project_id = ? ORDER BY cs.created_at DESC`,
          [projectId]
        )
      : await queryAll(`SELECT cs.*, p.project_name FROM construction_stages cs JOIN projects p ON p.id = cs.project_id ORDER BY cs.created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/construction', requireAuth, requireRoles('OWNER', 'ADMIN', 'SITE_MANAGER'), async (req: AuthedRequest, res) => {
  try {
    const { projectId, siteId, stageName, progressPercent, qualityCheck, safetyCheck, reportNotes, photoUrls } = req.body as Record<string, unknown>;
    if (!projectId || !stageName) {
      res.status(400).json({ error: 'Project and Construction Stage are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO construction_stages (
        id, company_id, project_id, site_id, stage_name, progress_percent, quality_check, safety_check,
        report_notes, photo_urls_json, admin_approval, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        id,
        projectId,
        siteId || null,
        stageName,
        Number(progressPercent || 0),
        qualityCheck || 'PENDING',
        safetyCheck || 'PENDING',
        reportNotes || null,
        JSON.stringify(photoUrls || []),
        ['OWNER', 'ADMIN'].includes(req.user!.role) ? 'APPROVED' : 'PENDING',
        now,
        now,
        req.user!.id,
      ]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/construction/:id/approve', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { approval } = req.body as { approval: 'APPROVED' | 'REVISION_NEEDED' };
    await execute(`UPDATE construction_stages SET admin_approval = ?, updated_at = ?, updated_by = ? WHERE id = ?`, [
      approval,
      new Date().toISOString(),
      req.user!.id,
      req.params.id,
    ]);
    res.json({ admin_approval: approval });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== INTERIOR DESIGN ====================

router.get('/interior', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      const rows = cli
        ? await queryAll(
            `SELECT d.*, p.project_name FROM interior_designs d JOIN projects p ON p.id = d.project_id WHERE p.client_id = ? ORDER BY d.created_at DESC`,
            [cli.id]
          )
        : [];
      res.json(rows);
      return;
    }
    const rows = await queryAll(
      `SELECT d.*, p.project_name FROM interior_designs d JOIN projects p ON p.id = d.project_id ORDER BY d.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/interior', requireAuth, requireRoles('OWNER', 'ADMIN', 'INTERIOR_DESIGNER'), async (req: AuthedRequest, res) => {
  try {
    const {
      projectId,
      designCategory,
      roomName,
      title,
      materialSpecs,
      furnitureLayout,
      lightingElectrical,
      plumbingLayout,
      fileType,
      fileUrl,
      revisionNumber,
    } = req.body as Record<string, unknown>;
    if (!projectId || !designCategory || !roomName || !title) {
      res.status(400).json({ error: 'Project, Category, Room Name, and Design Title are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO interior_designs (
        id, company_id, project_id, design_category, room_name, title, material_specs,
        furniture_layout, lighting_electrical, plumbing_layout, file_type, file_url,
        revision_number, client_approval_status, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'ACTIVE', ?, ?, ?)`,
      [
        id,
        projectId,
        designCategory,
        roomName,
        title,
        materialSpecs || null,
        furnitureLayout || null,
        lightingElectrical || null,
        plumbingLayout || null,
        fileType || '2D_PLAN',
        fileUrl || null,
        Number(revisionNumber || 1),
        now,
        now,
        req.user!.id,
      ]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/interior/:id/client-approval', requireAuth, requireRoles('OWNER', 'ADMIN', 'CLIENT'), async (req: AuthedRequest, res) => {
  try {
    const { status, remarks } = req.body as { status: 'APPROVED' | 'REVISION_REQUESTED'; remarks?: string };
    await execute(`UPDATE interior_designs SET client_approval_status = ?, client_remarks = ?, updated_at = ? WHERE id = ?`, [
      status,
      remarks || null,
      new Date().toISOString(),
      req.params.id,
    ]);
    res.json({ client_approval_status: status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== INVENTORY & VENDORS ====================

router.get('/inventory', requireAuth, async (_req, res) => {
  try {
    const items = await queryAll(
      `SELECT i.*, v.vendor_name, s.site_name
       FROM inventory_items i
       LEFT JOIN vendors v ON v.id = i.supplier_id
       LEFT JOIN project_sites s ON s.id = i.site_id
       ORDER BY i.created_at DESC`
    );
    const ledger = await queryAll(
      `SELECT l.*, i.material_name, i.brand, i.unit, p.project_name
       FROM stock_ledger l
       JOIN inventory_items i ON i.id = l.inventory_item_id
       LEFT JOIN projects p ON p.id = l.project_id
       ORDER BY l.created_at DESC LIMIT 100`
    );
    res.json({ items, ledger });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/inventory', requireAuth, requireRoles('OWNER', 'ADMIN', 'SITE_MANAGER', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const {
      category,
      materialName,
      brand,
      companyName,
      productModel,
      grade,
      unit,
      purchaseRate,
      supplierId,
      stockAvailable,
      minStockAlert,
      siteId,
    } = req.body as Record<string, unknown>;
    if (!category || !materialName || !unit) {
      res.status(400).json({ error: 'Category, Material Name, and Unit are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const qty = Number(stockAvailable || 0);
    await execute(
      `INSERT INTO inventory_items (
        id, company_id, category, material_name, brand, company_name, product_model, grade,
        unit, purchase_rate, supplier_id, stock_available, min_stock_alert, site_id,
        status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        id,
        category,
        materialName,
        brand || null,
        companyName || null,
        productModel || null,
        grade || null,
        unit,
        Number(purchaseRate || 0),
        supplierId || null,
        qty,
        Number(minStockAlert || 10),
        siteId || null,
        now,
        now,
        req.user!.id,
      ]
    );
    if (qty > 0) {
      await execute(
        `INSERT INTO stock_ledger (id, company_id, inventory_item_id, site_id, txn_type, quantity, rate, remarks, created_at, created_by)
         VALUES (?, 'SIID_MAIN', ?, ?, 'PURCHASE_IN', ?, ?, 'Opening Stock', ?, ?)`,
        [crypto.randomUUID(), id, siteId || null, qty, Number(purchaseRate || 0), now, req.user!.id]
      );
    }
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/inventory/:id/transaction', requireAuth, requireRoles('OWNER', 'ADMIN', 'SITE_MANAGER'), async (req: AuthedRequest, res) => {
  try {
    const { txnType, quantity, rate, projectId, siteId, remarks } = req.body as {
      txnType: 'PURCHASE_IN' | 'ISSUE_OUT' | 'RETURN_IN' | 'DAMAGED';
      quantity: number;
      rate?: number;
      projectId?: string;
      siteId?: string;
      remarks?: string;
    };
    const item = await queryOne<{
      id: string;
      material_name: string;
      stock_available: number;
      min_stock_alert: number;
      purchase_rate: number;
    }>(`SELECT * FROM inventory_items WHERE id = ?`, [req.params.id]);

    if (!item) {
      res.status(404).json({ error: 'Inventory item not found.' });
      return;
    }
    const qty = Number(quantity || 0);
    if (qty <= 0) {
      res.status(400).json({ error: 'Quantity must be positive.' });
      return;
    }
    if ((txnType === 'ISSUE_OUT' || txnType === 'DAMAGED') && item.stock_available < qty) {
      res.status(400).json({ error: `Insufficient stock. Available: ${item.stock_available}.` });
      return;
    }

    const now = new Date().toISOString();
    let newAvail = item.stock_available;
    if (txnType === 'PURCHASE_IN') {
      newAvail += qty;
      await execute(`UPDATE inventory_items SET stock_available = ?, purchase_rate = COALESCE(?, purchase_rate), updated_at = ? WHERE id = ?`, [
        newAvail,
        rate || null,
        now,
        item.id,
      ]);
    } else if (txnType === 'ISSUE_OUT') {
      newAvail -= qty;
      await execute(`UPDATE inventory_items SET stock_available = ?, stock_issued = stock_issued + ?, updated_at = ? WHERE id = ?`, [
        newAvail,
        qty,
        now,
        item.id,
      ]);
    } else if (txnType === 'RETURN_IN') {
      newAvail += qty;
      await execute(`UPDATE inventory_items SET stock_available = ?, stock_returned = stock_returned + ?, updated_at = ? WHERE id = ?`, [
        newAvail,
        qty,
        now,
        item.id,
      ]);
    } else if (txnType === 'DAMAGED') {
      newAvail -= qty;
      await execute(`UPDATE inventory_items SET stock_available = ?, stock_damaged = stock_damaged + ?, updated_at = ? WHERE id = ?`, [
        newAvail,
        qty,
        now,
        item.id,
      ]);
    }

    await execute(
      `INSERT INTO stock_ledger (id, company_id, inventory_item_id, project_id, site_id, txn_type, quantity, rate, remarks, created_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), item.id, projectId || null, siteId || null, txnType, qty, rate || item.purchase_rate, remarks || null, now, req.user!.id]
    );

    if (newAvail <= item.min_stock_alert) {
      await execute(
        `INSERT INTO notifications (id, company_id, target_role, event_type, title, message, entity_type, entity_id, created_at)
         VALUES (?, 'SIID_MAIN', 'ADMIN', 'LOW_STOCK', 'Low Stock Alert', ?, 'inventory', ?, ?)`,
        [crypto.randomUUID(), `${item.material_name} stock is low (${newAvail} remaining).`, item.id, now]
      );
    }

    res.json({ stock_available: newAvail });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/vendors', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER'), async (_req, res) => {
  try {
    const rows = await queryAll(`SELECT * FROM vendors ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/vendors', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const { vendorName, companyName, mobile, email, address, gstin, materialsSupplied, totalBills } = req.body as Record<string, unknown>;
    if (!vendorName || !mobile) {
      res.status(400).json({ error: 'Vendor Name and Mobile are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO vendors (id, company_id, vendor_name, company_name, mobile, email, address, gstin, materials_supplied, total_bills, total_paid, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?, ?)`,
      [
        id,
        vendorName,
        companyName || null,
        mobile,
        email || null,
        address || null,
        gstin || null,
        materialsSupplied || null,
        Number(totalBills || 0),
        now,
        now,
        req.user!.id,
      ]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/vendors/:id/bill', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const { amount } = req.body as { amount: number };
    await execute(`UPDATE vendors SET total_bills = total_bills + ?, updated_at = ? WHERE id = ?`, [
      Number(amount || 0),
      new Date().toISOString(),
      req.params.id,
    ]);
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
