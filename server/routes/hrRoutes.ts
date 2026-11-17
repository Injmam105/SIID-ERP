import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { type AuthedRequest, requireAuth, requireRoles, type UserRole, validateStrongPassword } from '../auth.ts';
import { execute, queryAll, queryOne } from '../db.ts';
import { normalizeMobile } from '../sms.ts';

const router = Router();

// ==================== EMPLOYEES ====================

router.get('/employees', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const role = req.user!.role;
    if (['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'].includes(role)) {
      const rows = await queryAll(
        `SELECT e.*, u.role AS user_role, u.account_status, u.mobile_verified
         FROM employees e
         LEFT JOIN users u ON u.id = e.user_id
         ORDER BY e.created_at DESC`
      );
      res.json(rows);
      return;
    }
    if (role === 'CLIENT') {
      res.status(403).json({ error: 'Clients cannot view company employee directory.' });
      return;
    }
    const self = await queryAll(
      `SELECT e.*, u.role AS user_role, u.account_status, u.mobile_verified
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.user_id = ?`,
      [req.user!.id]
    );
    res.json(self);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/employees', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const {
      fullName,
      mobile,
      email,
      password,
      role,
      employeeType,
      department,
      designation,
      address,
      emergencyContact,
      joiningDate,
      salaryAmount,
      dailyWageRate,
      halfDayRate,
      overtimeHourlyRate,
      contractPeriod,
      assignedProjectId,
      assignedSiteId,
    } = req.body as Record<string, string | number | undefined>;

    const normMobile = normalizeMobile(String(mobile || ''));
    if (!fullName || !/^[6-9]\d{9}$/.test(normMobile)) {
      res.status(400).json({ error: 'Valid full name and 10-digit mobile number are required.' });
      return;
    }

    const targetRole = (String(role || 'PERMANENT_EMPLOYEE').toUpperCase()) as UserRole;
    if (targetRole === 'OWNER' || (targetRole === 'ADMIN' && req.user!.role !== 'OWNER')) {
      res.status(403).json({ error: 'Only Owner can create Admin accounts.' });
      return;
    }

    const dup = await queryOne(`SELECT id FROM users WHERE mobile = ?`, [normMobile]);
    if (dup) {
      res.status(409).json({ error: 'Mobile number already exists.' });
      return;
    }

    const rawPw = String(password || '');
    const pwErr = validateStrongPassword(rawPw);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM employees`);
    const empCode = `SIID-EMP-${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const userId = crypto.randomUUID();
    const empId = crypto.randomUUID();
    const hash = await bcrypt.hash(rawPw, 12);
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO users (
        id, company_id, user_code, full_name, mobile, email, password_hash, role,
        mobile_verified, account_status, must_change_password, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', 1, ?, ?, ?)`,
      [userId, empCode, String(fullName).trim(), normMobile, email ? String(email).trim() : null, hash, targetRole, now, now, req.user!.id]
    );

    await execute(
      `INSERT INTO employees (
        id, company_id, user_id, employee_code, full_name, mobile, email, employee_type,
        department, designation, address, emergency_contact, joining_date,
        salary_amount, daily_wage_rate, half_day_rate, overtime_hourly_rate, contract_period,
        assigned_project_id, assigned_site_id, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        empId,
        userId,
        empCode,
        String(fullName).trim(),
        normMobile,
        email ? String(email).trim() : null,
        String(employeeType || 'PERMANENT').toUpperCase(),
        department || 'Operations',
        designation || targetRole.replace(/_/g, ' '),
        address || null,
        emergencyContact || null,
        joiningDate || now.slice(0, 10),
        Number(salaryAmount || 0),
        Number(dailyWageRate || 0),
        Number(halfDayRate || 0),
        Number(overtimeHourlyRate || 0),
        contractPeriod || null,
        assignedProjectId || null,
        assignedSiteId || null,
        now,
        now,
        req.user!.id,
      ]
    );

    await execute(
      `INSERT INTO notifications (id, company_id, target_user_id, event_type, title, message, entity_type, entity_id, created_at)
       VALUES (?, 'SIID_MAIN', ?, 'NEW_EMP_ADDED', 'Welcome to SIID ERP', ?, 'employee', ?, ?)`,
      [crypto.randomUUID(), userId, `Your SIID account (${empCode}) is active.`, empId, now]
    );

    res.status(201).json({ id: empId, employee_code: empCode });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/employees/:id', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const emp = await queryOne<{ id: string; user_id: string }>(`SELECT id, user_id FROM employees WHERE id = ?`, [req.params.id]);
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    const {
      fullName,
      email,
      employeeType,
      role,
      department,
      designation,
      address,
      emergencyContact,
      salaryAmount,
      dailyWageRate,
      halfDayRate,
      overtimeHourlyRate,
      contractPeriod,
      assignedProjectId,
      assignedSiteId,
      documentsJson,
    } = req.body as Record<string, string | number | undefined>;

    const now = new Date().toISOString();
    await execute(
      `UPDATE employees SET
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        employee_type = COALESCE(?, employee_type),
        department = COALESCE(?, department),
        designation = COALESCE(?, designation),
        address = COALESCE(?, address),
        emergency_contact = COALESCE(?, emergency_contact),
        salary_amount = COALESCE(?, salary_amount),
        daily_wage_rate = COALESCE(?, daily_wage_rate),
        half_day_rate = COALESCE(?, half_day_rate),
        overtime_hourly_rate = COALESCE(?, overtime_hourly_rate),
        contract_period = COALESCE(?, contract_period),
        assigned_project_id = ?,
        assigned_site_id = ?,
        documents_json = COALESCE(?, documents_json),
        updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [
        fullName || null,
        email || null,
        employeeType || null,
        department || null,
        designation || null,
        address || null,
        emergencyContact || null,
        salaryAmount !== undefined ? Number(salaryAmount) : null,
        dailyWageRate !== undefined ? Number(dailyWageRate) : null,
        halfDayRate !== undefined ? Number(halfDayRate) : null,
        overtimeHourlyRate !== undefined ? Number(overtimeHourlyRate) : null,
        contractPeriod || null,
        assignedProjectId || null,
        assignedSiteId || null,
        documentsJson || null,
        now,
        req.user!.id,
        req.params.id,
      ]
    );

    if (role && (req.user!.role === 'OWNER' || role !== 'ADMIN') && role !== 'OWNER') {
      await execute(`UPDATE users SET role = ?, full_name = COALESCE(?, full_name), updated_at = ? WHERE id = ?`, [
        role,
        fullName || null,
        now,
        emp.user_id,
      ]);
    }
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/employees/:id/approval', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { decision, notes } = req.body as { decision: 'APPROVE' | 'REJECT' | 'DEACTIVATE' | 'REACTIVATE'; notes?: string };
    const emp = await queryOne<{ id: string; user_id: string; full_name: string }>(`SELECT id, user_id, full_name FROM employees WHERE id = ?`, [req.params.id]);
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    const statusMap: Record<string, string> = {
      APPROVE: 'ACTIVE',
      REACTIVATE: 'ACTIVE',
      REJECT: 'REJECTED',
      DEACTIVATE: 'INACTIVE',
    };
    const nextStatus = statusMap[decision];
    if (!nextStatus) {
      res.status(400).json({ error: 'Invalid decision.' });
      return;
    }
    const now = new Date().toISOString();
    await execute(`UPDATE employees SET status = ?, approval_notes = COALESCE(?, approval_notes), updated_at = ?, updated_by = ? WHERE id = ?`, [
      nextStatus,
      notes || null,
      now,
      req.user!.id,
      emp.id,
    ]);
    await execute(`UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?`, [nextStatus, now, emp.user_id]);
    await execute(
      `INSERT INTO notifications (id, company_id, target_user_id, event_type, title, message, entity_type, entity_id, created_at)
       VALUES (?, 'SIID_MAIN', ?, 'EMP_APPROVAL', ?, ?, 'employee', ?, ?)`,
      [crypto.randomUUID(), emp.user_id, `Account ${nextStatus}`, `Your SIID Employee account status is now ${nextStatus}.`, emp.id, now]
    );
    res.json({ status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== CLIENTS ====================

router.get('/clients', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      const own = await queryAll(`SELECT * FROM clients WHERE user_id = ?`, [req.user!.id]);
      res.json(own);
      return;
    }
    if (!['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Unauthorized to view client directory.' });
      return;
    }
    const rows = await queryAll(
      `SELECT c.*, u.account_status, u.mobile_verified
       FROM clients c
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/clients', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { clientName, mobile, email, address, city, state, gstin, password } = req.body as Record<string, string | undefined>;
    const normMobile = normalizeMobile(mobile || '');
    if (!clientName?.trim() || !/^[6-9]\d{9}$/.test(normMobile)) {
      res.status(400).json({ error: 'Client Name and valid 10-digit mobile number are required.' });
      return;
    }
    const existing = await queryOne(`SELECT id FROM clients WHERE mobile = ?`, [normMobile]);
    if (existing) {
      res.status(409).json({ error: 'A client with this mobile number already exists.' });
      return;
    }
    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM clients`);
    const clientCode = `SIID-CLI-${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const clientId = crypto.randomUUID();
    const now = new Date().toISOString();
    let userId: string | null = null;

    if (password) {
      const pwErr = validateStrongPassword(password);
      if (pwErr) {
        res.status(400).json({ error: pwErr });
        return;
      }
      userId = crypto.randomUUID();
      const hash = await bcrypt.hash(password, 12);
      await execute(
        `INSERT INTO users (id, company_id, user_code, full_name, mobile, email, password_hash, role, mobile_verified, account_status, must_change_password, created_at, updated_at, created_by)
         VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, 'CLIENT', 1, 'ACTIVE', 1, ?, ?, ?)`,
        [userId, clientCode, clientName.trim(), normMobile, email?.trim() || null, hash, now, now, req.user!.id]
      );
    }

    await execute(
      `INSERT INTO clients (id, company_id, user_id, client_code, client_name, mobile, email, address, city, state, gstin, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [clientId, userId, clientCode, clientName.trim(), normMobile, email?.trim() || null, address || null, city || null, state || null, gstin || null, now, now, req.user!.id]
    );
    res.status(201).json({ id: clientId, client_code: clientCode });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/clients/:id/approval', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { decision, notes } = req.body as { decision: 'APPROVE' | 'REJECT'; notes?: string };
    const cli = await queryOne<{ id: string; user_id: string | null }>(`SELECT id, user_id FROM clients WHERE id = ?`, [req.params.id]);
    if (!cli) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }
    const nextStatus = decision === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
    const now = new Date().toISOString();
    await execute(`UPDATE clients SET status = ?, approval_notes = COALESCE(?, approval_notes), updated_at = ?, updated_by = ? WHERE id = ?`, [
      nextStatus,
      notes || null,
      now,
      req.user!.id,
      cli.id,
    ]);
    if (cli.user_id) {
      await execute(`UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?`, [nextStatus, now, cli.user_id]);
      await execute(
        `INSERT INTO notifications (id, company_id, target_user_id, event_type, title, message, entity_type, entity_id, created_at)
         VALUES (?, 'SIID_MAIN', ?, 'CLIENT_APPROVAL', ?, ?, 'client', ?, ?)`,
        [crypto.randomUUID(), cli.user_id, `Client Account ${nextStatus}`, `Your SIID Client Portal access is now ${nextStatus}.`, cli.id, now]
      );
    }
    res.json({ status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== ATTENDANCE ====================

router.get('/attendance', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }
    const isManager = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER'].includes(req.user!.role);
    if (isManager) {
      const rows = await queryAll(
        `SELECT a.*, e.full_name AS employee_name, e.employee_code, e.employee_type, p.project_name
         FROM attendance a
         JOIN employees e ON e.id = a.employee_id
         LEFT JOIN projects p ON p.id = a.project_id
         ORDER BY a.attendance_date DESC, a.created_at DESC`
      );
      res.json(rows);
      return;
    }
    const emp = await queryOne<{ id: string }>(`SELECT id FROM employees WHERE user_id = ?`, [req.user!.id]);
    if (!emp) {
      res.json([]);
      return;
    }
    const rows = await queryAll(
      `SELECT a.*, e.full_name AS employee_name, e.employee_code, e.employee_type, p.project_name
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.employee_id = ?
       ORDER BY a.attendance_date DESC`,
      [emp.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/attendance/check-in', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.role === 'CLIENT') {
      res.status(403).json({ error: 'Clients do not record employee attendance.' });
      return;
    }
    const { employeeId, projectId, siteId, gpsLat, gpsLng, selfieUrl, notes } = req.body as Record<string, unknown>;
    let targetEmpId = employeeId as string | undefined;
    if (!targetEmpId || !['OWNER', 'ADMIN', 'SITE_MANAGER'].includes(req.user!.role)) {
      const self = await queryOne<{ id: string }>(`SELECT id FROM employees WHERE user_id = ?`, [req.user!.id]);
      if (!self) {
        res.status(400).json({ error: 'Employee profile not found for this account.' });
        return;
      }
      targetEmpId = self.id;
    }

    const today = new Date().toISOString().slice(0, 10);
    const existing = await queryOne(`SELECT id, check_in_at FROM attendance WHERE employee_id = ? AND attendance_date = ?`, [
      targetEmpId,
      today,
    ]);
    if (existing) {
      res.status(409).json({ error: 'Attendance already checked in for today. Duplicate check-in is blocked.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO attendance (
        id, company_id, employee_id, project_id, site_id, attendance_date, check_in_at,
        attendance_status, gps_lat, gps_lng, selfie_url, notes, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, 'PRESENT', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        targetEmpId,
        projectId || null,
        siteId || null,
        today,
        now,
        gpsLat !== undefined ? Number(gpsLat) : null,
        gpsLng !== undefined ? Number(gpsLng) : null,
        selfieUrl || null,
        notes || null,
        now,
        now,
        req.user!.id,
      ]
    );
    res.status(201).json({ id, attendance_date: today, check_in_at: now });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/attendance/check-out', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { attendanceId } = req.body as { attendanceId?: string };
    const today = new Date().toISOString().slice(0, 10);
    const self = await queryOne<{ id: string }>(`SELECT id FROM employees WHERE user_id = ?`, [req.user!.id]);

    const record = attendanceId
      ? await queryOne<{ id: string; employee_id: string; check_in_at: string; check_out_at: string | null }>(
          `SELECT * FROM attendance WHERE id = ?`,
          [attendanceId]
        )
      : self
        ? await queryOne<{ id: string; employee_id: string; check_in_at: string; check_out_at: string | null }>(
            `SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?`,
            [self.id, today]
          )
        : null;

    if (!record) {
      res.status(404).json({ error: 'No check-in record found for today.' });
      return;
    }
    if (record.check_out_at) {
      res.status(409).json({ error: 'Already checked out for today.' });
      return;
    }

    const now = new Date();
    const hoursWorked = record.check_in_at
      ? Math.max(0, (now.getTime() - new Date(record.check_in_at).getTime()) / 3600000)
      : 8;
    const overtime = Math.max(0, Number((hoursWorked - 8).toFixed(2)));
    await execute(`UPDATE attendance SET check_out_at = ?, overtime_hours = ?, updated_at = ?, updated_by = ? WHERE id = ?`, [
      now.toISOString(),
      overtime,
      now.toISOString(),
      req.user!.id,
      record.id,
    ]);
    res.json({ check_out_at: now.toISOString(), overtime_hours: overtime });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/attendance/mark', requireAuth, requireRoles('OWNER', 'ADMIN', 'SITE_MANAGER'), async (req: AuthedRequest, res) => {
  try {
    const { employeeId, projectId, siteId, attendanceDate, attendanceStatus, overtimeHours, notes } = req.body as Record<string, unknown>;
    if (!employeeId || !attendanceDate || !attendanceStatus) {
      res.status(400).json({ error: 'Employee, date, and attendance status are required.' });
      return;
    }
    const existing = await queryOne<{ id: string }>(`SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ?`, [
      employeeId,
      attendanceDate,
    ]);
    const now = new Date().toISOString();
    if (existing) {
      await execute(
        `UPDATE attendance SET attendance_status = ?, overtime_hours = ?, project_id = COALESCE(?, project_id), site_id = COALESCE(?, site_id), notes = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
        [attendanceStatus, Number(overtimeHours || 0), projectId || null, siteId || null, notes || null, now, req.user!.id, existing.id]
      );
      res.json({ id: existing.id, updated: true });
      return;
    }
    const id = crypto.randomUUID();
    await execute(
      `INSERT INTO attendance (id, company_id, employee_id, project_id, site_id, attendance_date, attendance_status, overtime_hours, notes, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, employeeId, projectId || null, siteId || null, attendanceDate, attendanceStatus, Number(overtimeHours || 0), notes || null, now, now, req.user!.id]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/attendance/:id/correction', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) {
      res.status(400).json({ error: 'Correction reason is required.' });
      return;
    }
    await execute(
      `UPDATE attendance SET correction_requested = 1, correction_reason = ?, correction_status = 'PENDING', updated_at = ? WHERE id = ?`,
      [reason.trim(), new Date().toISOString(), req.params.id]
    );
    res.json({ requested: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/attendance/:id/correction-review', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { decision, correctedStatus } = req.body as { decision: 'APPROVED' | 'REJECTED'; correctedStatus?: string };
    await execute(
      `UPDATE attendance SET correction_status = ?, attendance_status = COALESCE(?, attendance_status), updated_at = ?, updated_by = ? WHERE id = ?`,
      [decision, decision === 'APPROVED' ? correctedStatus || null : null, new Date().toISOString(), req.user!.id, req.params.id]
    );
    res.json({ correction_status: decision });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ==================== LEAVES & ADVANCES & SALARY ====================

router.get('/leaves', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (['OWNER', 'ADMIN', 'SITE_MANAGER'].includes(req.user!.role)) {
      const rows = await queryAll(
        `SELECT l.*, e.full_name AS employee_name, e.employee_code FROM leaves l JOIN employees e ON e.id = l.employee_id ORDER BY l.created_at DESC`
      );
      res.json(rows);
      return;
    }
    const self = await queryOne<{ id: string }>(`SELECT id FROM employees WHERE user_id = ?`, [req.user!.id]);
    if (!self) {
      res.json([]);
      return;
    }
    const rows = await queryAll(`SELECT * FROM leaves WHERE employee_id = ? ORDER BY created_at DESC`, [self.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/leaves', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const self = await queryOne<{ id: string; full_name: string }>(`SELECT id, full_name FROM employees WHERE user_id = ?`, [req.user!.id]);
    if (!self) {
      res.status(400).json({ error: 'Only employees can submit leave requests.' });
      return;
    }
    const { leaveType, startDate, endDate, reason } = req.body as Record<string, string>;
    if (!leaveType || !startDate || !endDate) {
      res.status(400).json({ error: 'Leave type, start date, and end date are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO leaves (id, company_id, employee_id, leave_type, start_date, end_date, reason, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [id, self.id, leaveType, startDate, endDate, reason || null, now, now, req.user!.id]
    );
    await execute(
      `INSERT INTO notifications (id, company_id, target_role, event_type, title, message, entity_type, entity_id, created_at)
       VALUES (?, 'SIID_MAIN', 'ADMIN', 'LEAVE_REQUEST', 'New Leave Request', ?, 'leave', ?, ?)`,
      [crypto.randomUUID(), `${self.full_name} requested ${leaveType} (${startDate} to ${endDate}).`, id, now]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/leaves/:id/review', requireAuth, requireRoles('OWNER', 'ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { status } = req.body as { status: 'APPROVED' | 'REJECTED' };
    await execute(`UPDATE leaves SET status = ?, reviewed_by = ?, updated_at = ? WHERE id = ?`, [
      status,
      req.user!.id,
      new Date().toISOString(),
      req.params.id,
    ]);
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/advances', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(req.user!.role)) {
      const rows = await queryAll(
        `SELECT a.*, e.full_name AS employee_name, e.employee_code FROM advances a JOIN employees e ON e.id = a.employee_id ORDER BY a.advance_date DESC`
      );
      res.json(rows);
      return;
    }
    const self = await queryOne<{ id: string }>(`SELECT id FROM employees WHERE user_id = ?`, [req.user!.id]);
    if (!self) {
      res.json([]);
      return;
    }
    const rows = await queryAll(`SELECT * FROM advances WHERE employee_id = ? ORDER BY advance_date DESC`, [self.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/advances', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const { employeeId, amount, advanceDate, reason } = req.body as Record<string, unknown>;
    if (!employeeId || Number(amount) <= 0) {
      res.status(400).json({ error: 'Employee and positive amount are required.' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await execute(
      `INSERT INTO advances (id, company_id, employee_id, amount, advance_date, reason, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, 'PAID', ?, ?, ?)`,
      [id, employeeId, Number(amount), advanceDate || now.slice(0, 10), reason || null, now, now, req.user!.id]
    );
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/salary', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(req.user!.role)) {
      const rows = await queryAll(
        `SELECT s.*, e.full_name AS employee_name, e.employee_code, e.designation
         FROM salary_records s
         JOIN employees e ON e.id = s.employee_id
         ORDER BY s.created_at DESC`
      );
      res.json(rows);
      return;
    }
    const self = await queryOne<{ id: string }>(`SELECT id FROM employees WHERE user_id = ?`, [req.user!.id]);
    if (!self) {
      res.json([]);
      return;
    }
    const rows = await queryAll(
      `SELECT s.*, e.full_name AS employee_name, e.employee_code, e.designation
       FROM salary_records s
       JOIN employees e ON e.id = s.employee_id
       WHERE s.employee_id = ?
       ORDER BY s.created_at DESC`,
      [self.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/salary/generate', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const { employeeId, periodLabel, startDate, endDate, deductions = 0, contractBasePay } = req.body as Record<string, unknown>;
    const emp = await queryOne<{
      id: string;
      employee_type: string;
      salary_amount: number;
      daily_wage_rate: number;
      half_day_rate: number;
      overtime_hourly_rate: number;
    }>(`SELECT * FROM employees WHERE id = ?`, [employeeId]);

    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const att = await queryAll<{ attendance_status: string; overtime_hours: number }>(
      `SELECT attendance_status, overtime_hours FROM attendance
       WHERE employee_id = ? AND attendance_date >= ? AND attendance_date <= ?`,
      [emp.id, startDate, endDate]
    );

    const presentDays = att.filter((a) => a.attendance_status === 'PRESENT').length;
    const halfDays = att.filter((a) => a.attendance_status === 'HALF_DAY').length;
    const leaveDays = att.filter((a) => a.attendance_status === 'LEAVE').length;
    const overtimeHours = att.reduce((acc, a) => acc + Number(a.overtime_hours || 0), 0);

    let basePay = 0;
    if (emp.employee_type === 'PERMANENT') {
      const perDay = Number(emp.salary_amount || 0) / 30;
      basePay = Number(((presentDays + halfDays * 0.5) * perDay).toFixed(2));
    } else if (emp.employee_type === 'DAILY_WAGE') {
      basePay = Number((presentDays * Number(emp.daily_wage_rate || 0) + halfDays * Number(emp.half_day_rate || emp.daily_wage_rate * 0.5)).toFixed(2));
    } else {
      basePay = Number(contractBasePay || emp.salary_amount || 0);
    }

    const overtimePay = Number((overtimeHours * Number(emp.overtime_hourly_rate || 0)).toFixed(2));

    const openAdvances = await queryAll<{ id: string; amount: number }>(
      `SELECT id, amount FROM advances WHERE employee_id = ? AND settled = 0`,
      [emp.id]
    );
    const advanceAdjusted = openAdvances.reduce((s, a) => s + Number(a.amount), 0);
    const netPayable = Math.max(0, Number((basePay + overtimePay - Number(deductions || 0) - advanceAdjusted).toFixed(2)));

    const cntRow = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM salary_records`);
    const slipNumber = `SIID/SAL/${new Date().getFullYear()}/${(Number(cntRow?.cnt || 0) + 1).toString().padStart(4, '0')}`;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO salary_records (
        id, company_id, slip_number, employee_id, employee_type, period_label,
        present_days, half_days, leave_days, overtime_hours, base_pay, overtime_pay,
        deductions, advance_adjusted, net_payable, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERATED', ?, ?, ?)`,
      [
        id,
        slipNumber,
        emp.id,
        emp.employee_type,
        periodLabel || `${startDate} to ${endDate}`,
        presentDays,
        halfDays,
        leaveDays,
        overtimeHours,
        basePay,
        overtimePay,
        Number(deductions || 0),
        advanceAdjusted,
        netPayable,
        now,
        now,
        req.user!.id,
      ]
    );

    for (const adv of openAdvances) {
      await execute(`UPDATE advances SET settled = 1, status = 'SETTLED', updated_at = ? WHERE id = ?`, [now, adv.id]);
    }

    res.status(201).json({ id, slip_number: slipNumber, net_payable: netPayable });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/salary/:id/pay', requireAuth, requireRoles('OWNER', 'ADMIN', 'ACCOUNTANT'), async (req: AuthedRequest, res) => {
  try {
    const { paymentMethod, transactionRef } = req.body as { paymentMethod?: string; transactionRef?: string };
    if (!paymentMethod || !transactionRef) {
      res.status(400).json({ error: 'Payment method and transaction reference are required.' });
      return;
    }
    const sal = await queryOne<{ id: string; employee_id: string; net_payable: number; slip_number: string }>(
      `SELECT * FROM salary_records WHERE id = ?`,
      [req.params.id]
    );
    if (!sal) {
      res.status(404).json({ error: 'Salary record not found.' });
      return;
    }
    const now = new Date().toISOString();
    await execute(
      `UPDATE salary_records SET status = 'PAID', payment_method = ?, transaction_ref = ?, paid_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`,
      [paymentMethod, transactionRef, now, now, req.user!.id, sal.id]
    );
    // Log as company expense automatically
    await execute(
      `INSERT INTO expenses (id, company_id, category, description, amount, expense_date, payment_method, status, created_at, updated_at, created_by)
       VALUES (?, 'SIID_MAIN', 'SALARY_WAGES', ?, ?, ?, ?, 'RECORDED', ?, ?, ?)`,
      [crypto.randomUUID(), `Payroll disbursement ${sal.slip_number}`, sal.net_payable, now.slice(0, 10), paymentMethod, now, now, req.user!.id]
    );
    res.json({ status: 'PAID' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
