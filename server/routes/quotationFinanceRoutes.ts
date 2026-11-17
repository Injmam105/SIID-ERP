import crypto from 'node:crypto';
import { Router } from 'express';
import { type AuthedRequest, requireAuth, requireRoles } from '../auth.ts';
import { execute, queryAll, queryOne } from '../db.ts';

const router = Router();

interface QuotationItemInput {
  workCategory: string;
  workDescription: string;
  materialOrService?: string;
  quantity: number;
  unit: string;
  rate: number;
}

interface QuotationMaterialInput {
  workCategory: string;
  materialName: string;
  materialDescription?: string;
  brandName: string;
  productModel?: string;
  gradeQuality?: string;
  sizeThickness?: string;
  technicalSpecs?: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  providedBy?: 'SIID' | 'CLIENT';
  imageUrl?: string;
  remarks?: string;
}

function computeQuotationFinancials(input: {
  items: QuotationItemInput[];
  materials: QuotationMaterialInput[];
  includeMaterialInItems: boolean;
  labourCharges: number;
  discountAmount: number;
  transportationCharges: number;
  additionalCharges: number;
  gstRate: number;
  advanceAmount: number;
}) {
  const subtotalItems = input.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0);
  // Prevent double-counting: if material costs are included in item prices OR provided by CLIENT, do not add extra SIID material charge to grand total
  const siidMaterialTotal = input.materials
    .filter((m) => (m.providedBy || 'SIID') === 'SIID')
    .reduce((s, m) => s + Number(m.quantity || 0) * Number(m.ratePerUnit || 0), 0);

  const materialCharges = input.includeMaterialInItems ? 0 : siidMaterialTotal;
  const taxableBase = Math.max(
    0,
    subtotalItems +
      materialCharges +
      Number(input.labourCharges || 0) +
      Number(input.transportationCharges || 0) +
      Number(input.additionalCharges || 0) -
      Number(input.discountAmount || 0)
  );
  const gstAmount = Number(((taxableBase * Number(input.gstRate || 0)) / 100).toFixed(2));
  const grandTotal = Number((taxableBase + gstAmount).toFixed(2));
  const remainingBalance = Math.max(0, Number((grandTotal - Number(input.advanceAmount || 0)).toFixed(2)));

  return {
    subtotalItems: Number(subtotalItems.toFixed(2)),
    materialCharges: Number(materialCharges.toFixed(2)),
    gstAmount,
    grandTotal,
    remainingBalance,
  };
}

async function generateQuotationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await queryAll<{ quotation_number: string }>(`SELECT quotation_number FROM quotations`);
  let maxSeq = 0;
  for (const r of rows) {
    const match = r.quotation_number.match(/SIID\/QTN\/\d+\/(\d+)/);
    if (match) {
      maxSeq = Math.max(maxSeq, Number(match[1]));
    }
  }
  return `SIID/QTN/${year}/${(maxSeq + 1).toString().padStart(4, '0')}`;
}

router.get('/quotations', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      const rows = cli
        ? await queryAll(
            `SELECT q.*, c.client_name, c.mobile AS client_mobile, c.city AS client_city
             FROM quotations q
             JOIN clients c ON c.id = q.client_id
             WHERE q.client_id = ? AND q.status != 'DRAFT'
             ORDER BY q.created_at DESC`,
            [cli.id]
          )
        : [];
      res.json(rows);
      return;
    }
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT', 'INTERIOR_DESIGNER'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Unauthorized to view quotations.' });
      return;
    }
    const rows = await queryAll(
      `SELECT q.*, c.client_name, c.mobile AS client_mobile, c.email AS client_email, c.address AS client_address, c.city AS client_city, c.state AS client_state, c.gstin AS client_gstin
       FROM quotations q
       LEFT JOIN clients c ON c.id = q.client_id
       ORDER BY q.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/quotations/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const quotation = await queryOne<Record<string, unknown>>(
      `SELECT q.*, c.client_name, c.mobile AS client_mobile, c.email AS client_email, c.address AS client_address, c.city AS client_city, c.state AS client_state, c.gstin AS client_gstin
       FROM quotations q
       LEFT JOIN clients c ON c.id = q.client_id
       WHERE q.id = ?`,
      [req.params.id]
    );
    if (!quotation) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      if (!cli || cli.id !== quotation.client_id) {
        res.status(403).json({ error: 'You are not authorized to view another client quotation.' });
        return;
      }
    }
    const items = await queryAll(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY serial_no ASC`, [req.params.id]);
    const materials = await queryAll(`SELECT * FROM quotation_materials WHERE quotation_id = ? ORDER BY serial_no ASC`, [req.params.id]);
    const company = await queryOne(`SELECT * FROM company_settings WHERE id = 'SIID_COMPANY_DEFAULT'`);
    res.json({ quotation, items, materials, company });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/quotations', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const items = (body.items || []) as QuotationItemInput[];
    const materials = (body.materials || []) as QuotationMaterialInput[];

    if (!body.clientId || !body.projectName || !body.projectCategory) {
      res.status(400).json({ error: 'Client, Project Name, and Category are required.' });
      return;
    }

    const fin = computeQuotationFinancials({
      items,
      materials,
      includeMaterialInItems: Boolean(body.includeMaterialInItems),
      labourCharges: Number(body.labourCharges || 0),
      discountAmount: Number(body.discountAmount || 0),
      transportationCharges: Number(body.transportationCharges || 0),
      additionalCharges: Number(body.additionalCharges || 0),
      gstRate: body.gstRate !== undefined ? Number(body.gstRate) : 18,
      advanceAmount: Number(body.advanceAmount || 0),
    });

    const id = crypto.randomUUID();
    const quotationNumber = await generateQuotationNumber();
    const now = new Date().toISOString();
    const status = body.status === 'SENT' ? 'SENT' : 'DRAFT';

    await execute(
      `INSERT INTO quotations (
        id, company_id, quotation_number, revision_no, quotation_date, valid_until,
        client_id, project_name, project_category, project_location, project_description, scope_of_work,
        estimated_duration, expected_start_date, expected_completion_date, include_material_in_items,
        labour_specs, design_specs, work_execution_details, included_services, excluded_services, special_instructions,
        subtotal_items, material_charges, labour_charges, discount_amount, transportation_charges, additional_charges,
        gst_rate, gst_amount, grand_total, advance_amount, remaining_balance,
        payment_terms_json, terms_conditions_json, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        quotationNumber,
        body.quotationDate || now.slice(0, 10),
        body.validUntil || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        body.clientId,
        String(body.projectName).trim(),
        body.projectCategory,
        body.projectLocation || null,
        body.projectDescription || null,
        body.scopeOfWork || null,
        body.estimatedDuration || null,
        body.expectedStartDate || null,
        body.expectedCompletionDate || null,
        body.includeMaterialInItems ? 1 : 0,
        body.labourSpecs || null,
        body.designSpecs || null,
        body.workExecutionDetails || null,
        body.includedServices || null,
        body.excludedServices || null,
        body.specialInstructions || null,
        fin.subtotalItems,
        fin.materialCharges,
        Number(body.labourCharges || 0),
        Number(body.discountAmount || 0),
        Number(body.transportationCharges || 0),
        Number(body.additionalCharges || 0),
        body.gstRate !== undefined ? Number(body.gstRate) : 18,
        fin.gstAmount,
        fin.grandTotal,
        Number(body.advanceAmount || 0),
        fin.remainingBalance,
        JSON.stringify(body.paymentTerms || {}),
        JSON.stringify(body.termsConditions || {}),
        status,
        now,
        now,
        req.user!.id,
      ]
    );

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const amount = Number((Number(it.quantity || 0) * Number(it.rate || 0)).toFixed(2));
      await execute(
        `INSERT INTO quotation_items (id, quotation_id, serial_no, work_category, work_description, material_or_service, quantity, unit, rate, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), id, idx + 1, it.workCategory, it.workDescription, it.materialOrService || null, Number(it.quantity || 0), it.unit, Number(it.rate || 0), amount]
      );
    }

    for (let idx = 0; idx < materials.length; idx++) {
      const m = materials[idx];
      const total = Number((Number(m.quantity || 0) * Number(m.ratePerUnit || 0)).toFixed(2));
      await execute(
        `INSERT INTO quotation_materials (
          id, quotation_id, serial_no, work_category, material_name, material_description,
          brand_name, product_model, grade_quality, size_thickness, technical_specs,
          quantity, unit, rate_per_unit, total_amount, provided_by, image_url, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          id,
          idx + 1,
          m.workCategory,
          m.materialName,
          m.materialDescription || null,
          m.brandName || 'Brand To Be Confirmed',
          m.productModel || null,
          m.gradeQuality || null,
          m.sizeThickness || null,
          m.technicalSpecs || null,
          Number(m.quantity || 0),
          m.unit,
          Number(m.ratePerUnit || 0),
          total,
          m.providedBy || 'SIID',
          m.imageUrl || null,
          m.remarks || null,
        ]
      );
    }

    if (status === 'SENT') {
      const cli = await queryOne<{ user_id: string | null }>(`SELECT user_id FROM clients WHERE id = ?`, [body.clientId]);
      if (cli?.user_id) {
        await execute(
          `INSERT INTO notifications (id, company_id, target_user_id, event_type, title, message, entity_type, entity_id, created_at)
           VALUES (?, 'SIID_MAIN', ?, 'NEW_QUOTATION', 'New Quotation Received', ?, 'quotation', ?, ?)`,
          [crypto.randomUUID(), cli.user_id, `Quotation ${quotationNumber} for ${body.projectName} is ready for review.`, id, now]
        );
      }
    }

    res.status(201).json({ id, quotation_number: quotationNumber, ...fin });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/quotations/:id', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const existing = await queryOne<{ id: string; status: string }>(`SELECT id, status FROM quotations WHERE id = ?`, [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }
    if (existing.status === 'APPROVED') {
      res.status(400).json({ error: 'Approved quotations cannot be silently modified. Create a new Revision instead.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const items = (body.items || []) as QuotationItemInput[];
    const materials = (body.materials || []) as QuotationMaterialInput[];
    const fin = computeQuotationFinancials({
      items,
      materials,
      includeMaterialInItems: Boolean(body.includeMaterialInItems),
      labourCharges: Number(body.labourCharges || 0),
      discountAmount: Number(body.discountAmount || 0),
      transportationCharges: Number(body.transportationCharges || 0),
      additionalCharges: Number(body.additionalCharges || 0),
      gstRate: body.gstRate !== undefined ? Number(body.gstRate) : 18,
      advanceAmount: Number(body.advanceAmount || 0),
    });

    const now = new Date().toISOString();
    await execute(
      `UPDATE quotations SET
        quotation_date = COALESCE(?, quotation_date),
        valid_until = COALESCE(?, valid_until),
        client_id = COALESCE(?, client_id),
        project_name = COALESCE(?, project_name),
        project_category = COALESCE(?, project_category),
        project_location = ?,
        project_description = ?,
        scope_of_work = ?,
        estimated_duration = ?,
        expected_start_date = ?,
        expected_completion_date = ?,
        include_material_in_items = ?,
        labour_specs = ?,
        design_specs = ?,
        work_execution_details = ?,
        included_services = ?,
        excluded_services = ?,
        special_instructions = ?,
        subtotal_items = ?,
        material_charges = ?,
        labour_charges = ?,
        discount_amount = ?,
        transportation_charges = ?,
        additional_charges = ?,
        gst_rate = ?,
        gst_amount = ?,
        grand_total = ?,
        advance_amount = ?,
        remaining_balance = ?,
        payment_terms_json = ?,
        terms_conditions_json = ?,
        status = COALESCE(?, status),
        updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [
        body.quotationDate || null,
        body.validUntil || null,
        body.clientId || null,
        body.projectName || null,
        body.projectCategory || null,
        body.projectLocation || null,
        body.projectDescription || null,
        body.scopeOfWork || null,
        body.estimatedDuration || null,
        body.expectedStartDate || null,
        body.expectedCompletionDate || null,
        body.includeMaterialInItems ? 1 : 0,
        body.labourSpecs || null,
        body.designSpecs || null,
        body.workExecutionDetails || null,
        body.includedServices || null,
        body.excludedServices || null,
        body.specialInstructions || null,
        fin.subtotalItems,
        fin.materialCharges,
        Number(body.labourCharges || 0),
        Number(body.discountAmount || 0),
        Number(body.transportationCharges || 0),
        Number(body.additionalCharges || 0),
        body.gstRate !== undefined ? Number(body.gstRate) : 18,
        fin.gstAmount,
        fin.grandTotal,
        Number(body.advanceAmount || 0),
        fin.remainingBalance,
        JSON.stringify(body.paymentTerms || {}),
        JSON.stringify(body.termsConditions || {}),
        body.status || null,
        now,
        req.user!.id,
        req.params.id,
      ]
    );

    await execute(`DELETE FROM quotation_items WHERE quotation_id = ?`, [req.params.id]);
    await execute(`DELETE FROM quotation_materials WHERE quotation_id = ?`, [req.params.id]);

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      await execute(
        `INSERT INTO quotation_items (id, quotation_id, serial_no, work_category, work_description, material_or_service, quantity, unit, rate, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          req.params.id,
          idx + 1,
          it.workCategory,
          it.workDescription,
          it.materialOrService || null,
          Number(it.quantity || 0),
          it.unit,
          Number(it.rate || 0),
          Number((Number(it.quantity || 0) * Number(it.rate || 0)).toFixed(2)),
        ]
      );
    }

    for (let idx = 0; idx < materials.length; idx++) {
      const m = materials[idx];
      await execute(
        `INSERT INTO quotation_materials (
          id, quotation_id, serial_no, work_category, material_name, material_description,
          brand_name, product_model, grade_quality, size_thickness, technical_specs,
          quantity, unit, rate_per_unit, total_amount, provided_by, image_url, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          req.params.id,
          idx + 1,
          m.workCategory,
          m.materialName,
          m.materialDescription || null,
          m.brandName || 'Brand To Be Confirmed',
          m.productModel || null,
          m.gradeQuality || null,
          m.sizeThickness || null,
          m.technicalSpecs || null,
          Number(m.quantity || 0),
          m.unit,
          Number(m.ratePerUnit || 0),
          Number((Number(m.quantity || 0) * Number(m.ratePerUnit || 0)).toFixed(2)),
          m.providedBy || 'SIID',
          m.imageUrl || null,
          m.remarks || null,
        ]
      );
    }

    res.json({ updated: true, ...fin });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/quotations/:id', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const existing = await queryOne<{ status: string }>(`SELECT status FROM quotations WHERE id = ?`, [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }
    if (existing.status !== 'DRAFT') {
      res.status(400).json({ error: 'Only DRAFT quotations can be deleted.' });
      return;
    }
    await execute(`DELETE FROM quotation_items WHERE quotation_id = ?`, [req.params.id]);
    await execute(`DELETE FROM quotation_materials WHERE quotation_id = ?`, [req.params.id]);
    await execute(`DELETE FROM quotations WHERE id = ?`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/quotations/:id/status', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { status, comments } = req.body as { status: 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; comments?: string };
    const q = await queryOne<Record<string, unknown>>(`SELECT * FROM quotations WHERE id = ?`, [req.params.id]);
    if (!q) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }

    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      if (!cli || cli.id !== q.client_id || !['APPROVED', 'REJECTED'].includes(status)) {
        res.status(403).json({ error: 'Clients can only approve or reject their own quotations.' });
        return;
      }
    } else if (!['OWNER', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    const now = new Date().toISOString();
    await execute(
      `UPDATE quotations SET status = ?, client_comments = COALESCE(?, client_comments), client_signed_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      [status, comments || null, status === 'APPROVED' ? now : null, now, req.user!.id, req.params.id]
    );

    if (status === 'APPROVED' || status === 'REJECTED') {
      await execute(
        `INSERT INTO notifications (id, company_id, target_role, event_type, title, message, entity_type, entity_id, created_at)
         VALUES (?, 'SIID_MAIN', 'ADMIN', ?, ?, ?, 'quotation', ?, ?)`,
        [
          crypto.randomUUID(),
          status === 'APPROVED' ? 'QTN_APPROVED' : 'QTN_REJECTED',
          `Quotation ${status}`,
          `${q.quotation_number} (${q.project_name}) was ${status}. ${comments || ''}`,
          q.id,
          now,
        ]
      );
    }

    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/quotations/:id/revision', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const q = await queryOne<Record<string, unknown>>(`SELECT * FROM quotations WHERE id = ?`, [req.params.id]);
    if (!q) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }
    const items = await queryAll<Record<string, unknown>>(`SELECT * FROM quotation_items WHERE quotation_id = ?`, [req.params.id]);
    const mats = await queryAll<Record<string, unknown>>(`SELECT * FROM quotation_materials WHERE quotation_id = ?`, [req.params.id]);

    const newId = crypto.randomUUID();
    const newNumber = await generateQuotationNumber();
    const newRev = Number(q.revision_no || 1) + 1;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO quotations (
        id, company_id, quotation_number, revision_no, parent_quotation_id, quotation_date, valid_until,
        client_id, project_name, project_category, project_location, project_description, scope_of_work,
        estimated_duration, expected_start_date, expected_completion_date, include_material_in_items,
        labour_specs, design_specs, work_execution_details, included_services, excluded_services, special_instructions,
        subtotal_items, material_charges, labour_charges, discount_amount, transportation_charges, additional_charges,
        gst_rate, gst_amount, grand_total, advance_amount, remaining_balance,
        payment_terms_json, terms_conditions_json, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      [
        newId,
        newNumber,
        newRev,
        q.id,
        now.slice(0, 10),
        q.valid_until,
        q.client_id,
        q.project_name,
        q.project_category,
        q.project_location,
        q.project_description,
        q.scope_of_work,
        q.estimated_duration,
        q.expected_start_date,
        q.expected_completion_date,
        q.include_material_in_items,
        q.labour_specs,
        q.design_specs,
        q.work_execution_details,
        q.included_services,
        q.excluded_services,
        q.special_instructions,
        q.subtotal_items,
        q.material_charges,
        q.labour_charges,
        q.discount_amount,
        q.transportation_charges,
        q.additional_charges,
        q.gst_rate,
        q.gst_amount,
        q.grand_total,
        q.advance_amount,
        q.remaining_balance,
        q.payment_terms_json,
        q.terms_conditions_json,
        now,
        now,
        req.user!.id,
      ]
    );

    for (const it of items) {
      await execute(
        `INSERT INTO quotation_items (id, quotation_id, serial_no, work_category, work_description, material_or_service, quantity, unit, rate, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), newId, it.serial_no, it.work_category, it.work_description, it.material_or_service, it.quantity, it.unit, it.rate, it.amount]
      );
    }

    for (const m of mats) {
      await execute(
        `INSERT INTO quotation_materials (
          id, quotation_id, serial_no, work_category, material_name, material_description,
          brand_name, product_model, grade_quality, size_thickness, technical_specs,
          quantity, unit, rate_per_unit, total_amount, provided_by, image_url, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          newId,
          m.serial_no,
          m.work_category,
          m.material_name,
          m.material_description,
          m.brand_name,
          m.product_model,
          m.grade_quality,
          m.size_thickness,
          m.technical_specs,
          m.quantity,
          m.unit,
          m.rate_per_unit,
          m.total_amount,
          m.provided_by,
          m.image_url,
          m.remarks,
        ]
      );
    }

    res.status(201).json({ id: newId, quotation_number: newNumber, revision_no: newRev });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/quotations/:id/convert-to-project', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const q = await queryOne<Record<string, unknown>>(`SELECT * FROM quotations WHERE id = ?`, [req.params.id]);
    if (!q) {
      res.status(404).json({ error: 'Quotation not found.' });
      return;
    }
    if (q.status !== 'APPROVED') {
      res.status(400).json({ error: 'Only APPROVED quotations can be converted into a project.' });
      return;
    }
    if (q.converted_project_id) {
      res.status(409).json({ error: 'This quotation has already been converted into a project.' });
      return;
    }
    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM projects`);
    const projectCode = `SIID-PRJ-${new Date().getFullYear()}-${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const projectId = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO projects (
        id, company_id, project_code, project_name, client_id, category, address,
        start_date, expected_completion_date, budget, description, progress_percent, quotation_id,
        status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'PLANNING', ?, ?, ?)`,
      [
        projectId,
        projectCode,
        q.project_name,
        q.client_id,
        q.project_category,
        q.project_location || null,
        q.expected_start_date || now.slice(0, 10),
        q.expected_completion_date || null,
        q.grand_total,
        q.project_description || null,
        q.id,
        now,
        now,
        req.user!.id,
      ]
    );
    await execute(`UPDATE quotations SET converted_project_id = ?, updated_at = ? WHERE id = ?`, [projectId, now, q.id]);
    res.status(201).json({ projectId, project_code: projectCode });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== INVOICES, PAYMENTS, EXPENSES & FINANCE ====================

router.get('/invoices', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      const rows = cli
        ? await queryAll(
            `SELECT i.*, c.client_name, c.mobile AS client_mobile, c.address AS client_address, c.gstin AS client_gstin, p.project_name
             FROM invoices i
             LEFT JOIN clients c ON c.id = i.client_id
             LEFT JOIN projects p ON p.id = i.project_id
             WHERE i.client_id = ? ORDER BY i.created_at DESC`,
            [cli.id]
          )
        : [];
      res.json(rows);
      return;
    }
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }
    const rows = await queryAll(
      `SELECT i.*, c.client_name, c.mobile AS client_mobile, c.email AS client_email, c.address AS client_address, c.gstin AS client_gstin, p.project_name
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       LEFT JOIN projects p ON p.id = i.project_id
       ORDER BY i.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/invoices', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const { clientId, projectId, invoiceDate, dueDate, items = [], materials = [], discountAmount = 0, gstRate = 18, advancePaid = 0, notes } =
      req.body as Record<string, unknown>;
    if (!clientId) {
      res.status(400).json({ error: 'Client is required.' });
      return;
    }
    const itemList = items as { description: string; quantity: number; unit: string; rate: number }[];
    const subtotal = itemList.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0);
    const taxable = Math.max(0, subtotal - Number(discountAmount || 0));
    const gstAmount = Number(((taxable * Number(gstRate || 0)) / 100).toFixed(2));
    const grandTotal = Number((taxable + gstAmount).toFixed(2));
    const paid = Number(advancePaid || 0);
    const outstanding = Math.max(0, Number((grandTotal - paid).toFixed(2)));
    const status = outstanding <= 0 && grandTotal > 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';

    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM invoices`);
    const invoiceNumber = `SIID/INV/${new Date().getFullYear()}/${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO invoices (
        id, company_id, invoice_number, invoice_date, due_date, client_id, project_id,
        items_json, materials_json, subtotal, discount_amount, gst_rate, gst_amount, grand_total,
        amount_paid, outstanding_balance, notes, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        invoiceNumber,
        invoiceDate || now.slice(0, 10),
        dueDate || null,
        clientId,
        projectId || null,
        JSON.stringify(itemList),
        JSON.stringify(materials || []),
        subtotal,
        Number(discountAmount || 0),
        Number(gstRate || 0),
        gstAmount,
        grandTotal,
        paid,
        outstanding,
        notes || null,
        status,
        now,
        now,
        req.user!.id,
      ]
    );
    res.status(201).json({ id, invoice_number: invoiceNumber, grand_total: grandTotal });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/payments', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      const cli = await queryOne<{ id: string }>(`SELECT id FROM clients WHERE user_id = ?`, [req.user!.id]);
      const rows = cli
        ? await queryAll(
            `SELECT p.*, i.invoice_number, pr.project_name FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id LEFT JOIN projects pr ON pr.id = p.project_id WHERE p.client_id = ? ORDER BY p.payment_date DESC`,
            [cli.id]
          )
        : [];
      res.json(rows);
      return;
    }
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }
    const rows = await queryAll(
      `SELECT p.*, c.client_name, v.vendor_name, i.invoice_number, pr.project_name
       FROM payments p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN projects pr ON pr.id = p.project_id
       ORDER BY p.payment_date DESC, p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/payments', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const {
      paymentDirection = 'INCOME',
      incomeCategory = 'MILESTONE_PAYMENT',
      clientId,
      vendorId,
      projectId,
      invoiceId,
      amount,
      paymentDate,
      paymentMethod,
      transactionRef,
      notes,
    } = req.body as Record<string, unknown>;

    const amt = Number(amount || 0);
    if (amt <= 0 || !paymentMethod || !String(transactionRef || '').trim()) {
      res.status(400).json({ error: 'Positive amount, payment method, and verified transaction reference are required.' });
      return;
    }

    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM payments`);
    const receiptNumber = `SIID/RCP/${new Date().getFullYear()}/${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO payments (
        id, company_id, receipt_number, payment_direction, income_category, client_id, vendor_id,
        project_id, invoice_id, amount, payment_date, payment_method, transaction_ref, verified, notes,
        status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'VERIFIED', ?, ?, ?)`,
      [
        id,
        receiptNumber,
        paymentDirection,
        incomeCategory,
        clientId || null,
        vendorId || null,
        projectId || null,
        invoiceId || null,
        amt,
        paymentDate || now.slice(0, 10),
        paymentMethod,
        String(transactionRef).trim(),
        notes || null,
        now,
        now,
        req.user!.id,
      ]
    );

    if (invoiceId && paymentDirection === 'INCOME') {
      const inv = await queryOne<{ id: string; grand_total: number; amount_paid: number }>(`SELECT id, grand_total, amount_paid FROM invoices WHERE id = ?`, [
        invoiceId,
      ]);
      if (inv) {
        const nextPaid = Number((inv.amount_paid + amt).toFixed(2));
        const nextOut = Math.max(0, Number((inv.grand_total - nextPaid).toFixed(2)));
        const nextStatus = nextOut <= 0 ? 'PAID' : 'PARTIAL';
        await execute(`UPDATE invoices SET amount_paid = ?, outstanding_balance = ?, status = ?, updated_at = ? WHERE id = ?`, [
          nextPaid,
          nextOut,
          nextStatus,
          now,
          inv.id,
        ]);
      }
    }

    if (vendorId && paymentDirection === 'VENDOR_OUT') {
      await execute(`UPDATE vendors SET total_paid = total_paid + ?, updated_at = ? WHERE id = ?`, [amt, now, vendorId]);
    }

    res.status(201).json({ id, receipt_number: receiptNumber });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/expenses', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER'), async (_req, res) => {
  try {
    const rows = await queryAll(
      `SELECT e.*, p.project_name, v.vendor_name
       FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN vendors v ON v.id = e.vendor_id
       ORDER BY e.expense_date DESC, e.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/expenses', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER'), async (req: AuthedRequest, res) => {
  try {
    const { category, projectId, siteId, vendorId, description, amount, expenseDate, paymentMethod } = req.body as Record<string, unknown>;
    if (!category || !description || Number(amount) <= 0) {
      res.status(400).json({ error: 'Category, Description, and positive Amount are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO expenses (id, company_id, category, project_id, site_id, vendor_id, description, amount, expense_date, payment_method, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, 'RECORDED', ?, ?, ?)`,
      [id, category, projectId || null, siteId || null, vendorId || null, description, Number(amount), expenseDate || now.slice(0, 10), paymentMethod || 'Bank Transfer', now, now, req.user!.id]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/finance/summary', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (_req, res) => {
  try {
    const incomePayments = await queryAll<{ amount: number; payment_date: string; project_id: string | null }>(
      `SELECT amount, payment_date, project_id FROM payments WHERE payment_direction = 'INCOME' AND verified = 1`
    );
    const vendorPayments = await queryAll<{ amount: number; payment_date: string; project_id: string | null }>(
      `SELECT amount, payment_date, project_id FROM payments WHERE payment_direction = 'VENDOR_OUT' AND verified = 1`
    );
    const expenses = await queryAll<{ amount: number; expense_date: string; category: string; project_id: string | null }>(
      `SELECT amount, expense_date, category, project_id FROM expenses`
    );
    const invoices = await queryAll<{ outstanding_balance: number; grand_total: number; amount_paid: number }>(`SELECT outstanding_balance, grand_total, amount_paid FROM invoices`);
    const projects = await queryAll<{ id: string; project_name: string; budget: number }>(`SELECT id, project_name, budget FROM projects`);

    const totalIncome = incomePayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0) + vendorPayments.reduce((s, v) => s + Number(v.amount), 0);
    const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstanding_balance), 0);

    const projectPnl = projects.map((proj) => {
      const inc = incomePayments.filter((p) => p.project_id === proj.id).reduce((s, p) => s + Number(p.amount), 0);
      const exp =
        expenses.filter((e) => e.project_id === proj.id).reduce((s, e) => s + Number(e.amount), 0) +
        vendorPayments.filter((v) => v.project_id === proj.id).reduce((s, v) => s + Number(v.amount), 0);
      return {
        projectId: proj.id,
        projectName: proj.project_name,
        budget: Number(proj.budget),
        income: inc,
        expense: exp,
        netProfit: inc - exp,
      };
    });

    res.json({
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      totalOutstanding,
      projectPnl,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
