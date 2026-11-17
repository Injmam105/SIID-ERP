import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import {
  type AuthedRequest,
  requireAuth,
  signOtpVerifiedToken,
  signSessionToken,
  type UserRole,
  validateStrongPassword,
  verifyOtpVerifiedToken,
} from '../auth.ts';
import { execute, getDbMode, queryAll, queryOne } from '../db.ts';
import { getSmsConfigStatus, normalizeMobile, type OtpPurpose, sendRealOtp, verifyRealOtp } from '../sms.ts';

const router = Router();

async function nextCode(prefix: string, table: string, col: string): Promise<string> {
  const row = await queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM ${table}`);
  const seq = (Number(row?.cnt || 0) + 1).toString().padStart(4, '0');
  return `${prefix}-${seq}`;
}

router.get('/auth/setup-status', async (_req, res) => {
  try {
    const owner = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`
    );
    const sms = getSmsConfigStatus();
    const company = await queryOne<Record<string, unknown>>(
      `SELECT company_name, owner_name, owner_mobile, official_email, website, gstin,
              developed_by, developer_designation, it_support_number, tagline, logo_url
       FROM company_settings WHERE id = 'SIID_COMPANY_DEFAULT'`
    );
    res.json({
      ownerInitialized: Boolean(owner),
      ownerMobileHint: '9650598785',
      requireSetupSecret: Boolean(process.env.OWNER_SETUP_SECRET),
      smsConfigured: sms.configured,
      smsProvider: sms.provider,
      smsMissingVars: sms.missingVars,
      dbMode: getDbMode(),
      company,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/auth/bootstrap-owner', async (req, res) => {
  try {
    const existingOwner = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`
    );
    if (existingOwner) {
      res.status(403).json({ error: 'Owner account is already initialized. Public Admin setup is permanently disabled.' });
      return;
    }

    const { mobile, fullName, email, password, confirmPassword, setupSecret } = req.body as {
      mobile?: string;
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
      setupSecret?: string;
    };

    const requiredSecret = process.env.OWNER_SETUP_SECRET?.trim();
    if (requiredSecret && setupSecret !== requiredSecret) {
      res.status(403).json({ error: 'Invalid Owner setup security code.' });
      return;
    }

    const normMobile = normalizeMobile(mobile || '');
    if (normMobile !== '9650598785') {
      res.status(400).json({ error: 'Initial Owner bootstrap is strictly restricted to authorized Owner mobile 9650598785.' });
      return;
    }

    if (!password || password !== confirmPassword) {
      res.status(400).json({ error: 'Password and Confirm Password must match.' });
      return;
    }

    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const id = crypto.randomUUID();
    const hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO users (
        id, company_id, user_code, full_name, mobile, email, password_hash, role,
        mobile_verified, account_status, must_change_password, created_at, updated_at
      ) VALUES (?, 'SIID_MAIN', 'SIID-OWN-0001', ?, ?, ?, ?, 'OWNER', 1, 'ACTIVE', 0, ?, ?)`,
      [
        id,
        (fullName || 'MD Zawed Ansar').trim(),
        normMobile,
        (email || 'sirahiinfrainteriordesign@gmail.com').trim().toLowerCase(),
        hash,
        now,
        now,
      ]
    );

    const token = signSessionToken({ id, role: 'OWNER', mobile: normMobile });
    const user = await queryOne(
      `SELECT id, user_code, full_name, mobile, email, role, account_status, must_change_password, profile_photo_url
       FROM users WHERE id = ?`,
      [id]
    );
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { identifier, password, portal } = req.body as {
      identifier?: string;
      password?: string;
      portal?: 'ADMIN' | 'EMPLOYEE' | 'CLIENT';
    };

    if (!identifier?.trim() || !password) {
      res.status(400).json({ error: 'Mobile number/Email and password are required.' });
      return;
    }

    const raw = identifier.trim();
    const norm = normalizeMobile(raw);
    const isEmail = raw.includes('@');

    const user = await queryOne<{
      id: string;
      user_code: string;
      full_name: string;
      mobile: string;
      email: string | null;
      password_hash: string;
      role: UserRole;
      account_status: string;
      must_change_password: number;
      profile_photo_url: string | null;
    }>(
      isEmail
        ? `SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`
        : `SELECT * FROM users WHERE mobile = ? LIMIT 1`,
      [isEmail ? raw : norm]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials. Account not found.' });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid password. Please try again or use Forgot Password.' });
      return;
    }

    if (user.account_status === 'PENDING_APPROVAL') {
      res.status(403).json({
        error: 'Your account is pending Admin approval. You will be able to log in once approved by SIID Admin.',
      });
      return;
    }

    if (user.account_status !== 'ACTIVE') {
      res.status(403).json({
        error: `Access denied. Account status is ${user.account_status}. Contact SIID Admin or IT Support (7503354996).`,
      });
      return;
    }

    // Enforce portal separation
    const adminRoles: UserRole[] = ['OWNER', 'ADMIN', 'ACCOUNTANT', 'SITE_MANAGER', 'INTERIOR_DESIGNER'];
    const employeeRoles: UserRole[] = [
      'PERMANENT_EMPLOYEE',
      'CONTRACT_EMPLOYEE',
      'DAILY_WAGE_LABOUR',
      'SITE_MANAGER',
      'INTERIOR_DESIGNER',
      'ACCOUNTANT',
      'ADMIN',
    ];

    if (portal === 'ADMIN' && !adminRoles.includes(user.role)) {
      res.status(403).json({ error: 'This portal is restricted to Admin & Management roles. Please use Employee or Client Login.' });
      return;
    }
    if (portal === 'EMPLOYEE' && !employeeRoles.includes(user.role)) {
      res.status(403).json({ error: 'Please log in through the portal assigned to your account role.' });
      return;
    }
    if (portal === 'CLIENT' && user.role !== 'CLIENT') {
      res.status(403).json({ error: 'This portal is strictly for registered Clients.' });
      return;
    }

    await execute(`UPDATE users SET last_login_at = ? WHERE id = ?`, [new Date().toISOString(), user.id]);
    const token = signSessionToken({ id: user.id, role: user.role, mobile: user.mobile });

    res.json({
      token,
      user: {
        id: user.id,
        user_code: user.user_code,
        full_name: user.full_name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        account_status: user.account_status,
        must_change_password: user.must_change_password,
        profile_photo_url: user.profile_photo_url,
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/otp/send', async (req, res) => {
  try {
    const { mobile, purpose } = req.body as { mobile?: string; purpose?: OtpPurpose };
    if (!mobile || !purpose) {
      res.status(400).json({ error: 'Mobile number and verification purpose are required.' });
      return;
    }

    const norm = normalizeMobile(mobile);
    const existingUser = await queryOne<{ id: string }>(`SELECT id FROM users WHERE mobile = ?`, [norm]);

    if ((purpose === 'EMPLOYEE_REGISTER' || purpose === 'CLIENT_REGISTER') && existingUser) {
      res.status(409).json({ error: 'This mobile number is already registered in SIID ERP.' });
      return;
    }
    if (purpose === 'PASSWORD_RESET' && !existingUser) {
      res.status(404).json({ error: 'No SIID ERP account found with this mobile number.' });
      return;
    }

    const result = await sendRealOtp(norm, purpose);
    res.json({
      sent: true,
      message: `OTP dispatched via ${result.provider} to +91 ${norm}.`,
      ...result,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number; code?: string; missingVars?: string[]; retryAfter?: number };
    res.status(e.statusCode || 500).json({
      error: e.message,
      code: e.code,
      missingVars: e.missingVars,
      retryAfter: e.retryAfter,
    });
  }
});

router.post('/otp/verify', async (req, res) => {
  try {
    const { mobile, purpose, otp } = req.body as { mobile?: string; purpose?: OtpPurpose; otp?: string };
    if (!mobile || !purpose || !otp) {
      res.status(400).json({ error: 'Mobile number, purpose, and OTP code are required.' });
      return;
    }
    const norm = normalizeMobile(mobile);
    await verifyRealOtp(norm, purpose, otp);
    const otpVerificationToken = signOtpVerifiedToken(norm, purpose);
    res.json({ verified: true, otpVerificationToken });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

router.post('/auth/register/employee', async (req, res) => {
  try {
    const {
      fullName,
      mobile,
      email,
      password,
      confirmPassword,
      employeeType,
      address,
      emergencyContact,
      joiningDate,
      photoUrl,
      documentsJson,
      otpVerificationToken,
    } = req.body as Record<string, string | undefined>;

    const normMobile = normalizeMobile(mobile || '');
    if (!otpVerificationToken || !verifyOtpVerifiedToken(otpVerificationToken, normMobile, 'EMPLOYEE_REGISTER')) {
      res.status(403).json({
        error: 'Verified mobile OTP is mandatory before submitting employee registration.',
      });
      return;
    }

    if (!fullName?.trim() || !password || password !== confirmPassword) {
      res.status(400).json({ error: 'Full Name and matching passwords are required.' });
      return;
    }

    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const duplicate = await queryOne<{ id: string }>(`SELECT id FROM users WHERE mobile = ?`, [normMobile]);
    if (duplicate) {
      res.status(409).json({ error: 'Mobile number is already registered.' });
      return;
    }

    const typeMap: Record<string, { role: UserRole; empType: string }> = {
      PERMANENT: { role: 'PERMANENT_EMPLOYEE', empType: 'PERMANENT' },
      CONTRACT: { role: 'CONTRACT_EMPLOYEE', empType: 'CONTRACT' },
      DAILY_WAGE: { role: 'DAILY_WAGE_LABOUR', empType: 'DAILY_WAGE' },
    };
    const chosen = typeMap[(employeeType || 'PERMANENT').toUpperCase()] || typeMap.PERMANENT;

    const userId = crypto.randomUUID();
    const empId = crypto.randomUUID();
    const empCode = await nextCode('SIID-EMP', 'employees', 'employee_code');
    const hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO users (
        id, company_id, user_code, full_name, mobile, email, password_hash, role,
        mobile_verified, account_status, profile_photo_url, created_at, updated_at
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, 1, 'PENDING_APPROVAL', ?, ?, ?)`,
      [userId, empCode, fullName.trim(), normMobile, email?.trim() || null, hash, chosen.role, photoUrl || null, now, now]
    );

    await execute(
      `INSERT INTO employees (
        id, company_id, user_id, employee_code, full_name, mobile, email, employee_type,
        address, emergency_contact, joining_date, photo_url, documents_json, status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?)`,
      [
        empId,
        userId,
        empCode,
        fullName.trim(),
        normMobile,
        email?.trim() || null,
        chosen.empType,
        address || null,
        emergencyContact || null,
        joiningDate || now.slice(0, 10),
        photoUrl || null,
        documentsJson || '[]',
        now,
        now,
        userId,
      ]
    );

    await execute(
      `INSERT INTO notifications (id, company_id, target_role, event_type, title, message, entity_type, entity_id, created_at)
       VALUES (?, 'SIID_MAIN', 'ADMIN', 'NEW_EMPLOYEE_REG', 'New Employee Registration Pending', ?, 'employee', ?, ?)`,
      [crypto.randomUUID(), `${fullName.trim()} (${chosen.empType}) verified mobile ${normMobile} and is awaiting approval.`, empId, now]
    );

    res.status(201).json({
      registered: true,
      employeeCode: empCode,
      accountStatus: 'PENDING_APPROVAL',
      message: 'Mobile verified & registration submitted. Admin approval is required before dashboard login.',
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/auth/register/client', async (req, res) => {
  try {
    const {
      clientName,
      mobile,
      email,
      password,
      confirmPassword,
      address,
      city,
      state,
      gstin,
      otpVerificationToken,
    } = req.body as Record<string, string | undefined>;

    const normMobile = normalizeMobile(mobile || '');
    if (!otpVerificationToken || !verifyOtpVerifiedToken(otpVerificationToken, normMobile, 'CLIENT_REGISTER')) {
      res.status(403).json({
        error: 'Verified mobile OTP is mandatory before submitting client registration.',
      });
      return;
    }

    if (!clientName?.trim() || !password || password !== confirmPassword) {
      res.status(400).json({ error: 'Client Name and matching passwords are required.' });
      return;
    }

    const pwErr = validateStrongPassword(password);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }

    const duplicate = await queryOne<{ id: string }>(`SELECT id FROM users WHERE mobile = ?`, [normMobile]);
    if (duplicate) {
      res.status(409).json({ error: 'Mobile number is already registered.' });
      return;
    }

    const userId = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    const clientCode = await nextCode('SIID-CLI', 'clients', 'client_code');
    const hash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    // Strictly enforce role='CLIENT' server-side
    await execute(
      `INSERT INTO users (
        id, company_id, user_code, full_name, mobile, email, password_hash, role,
        mobile_verified, account_status, created_at, updated_at
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, 'CLIENT', 1, 'PENDING_APPROVAL', ?, ?)`,
      [userId, clientCode, clientName.trim(), normMobile, email?.trim() || null, hash, now, now]
    );

    await execute(
      `INSERT INTO clients (
        id, company_id, user_id, client_code, client_name, mobile, email, address, city, state, gstin,
        status, created_at, updated_at, created_by
      ) VALUES (?, 'SIID_MAIN', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, ?, ?)`,
      [
        clientId,
        userId,
        clientCode,
        clientName.trim(),
        normMobile,
        email?.trim() || null,
        address || null,
        city || null,
        state || null,
        gstin || null,
        now,
        now,
        userId,
      ]
    );

    await execute(
      `INSERT INTO notifications (id, company_id, target_role, event_type, title, message, entity_type, entity_id, created_at)
       VALUES (?, 'SIID_MAIN', 'ADMIN', 'NEW_CLIENT_REG', 'New Client Registration Pending', ?, 'client', ?, ?)`,
      [crypto.randomUUID(), `${clientName.trim()} (${city || 'India'}) registered with verified mobile ${normMobile}.`, clientId, now]
    );

    res.status(201).json({
      registered: true,
      clientCode,
      accountStatus: 'PENDING_APPROVAL',
      message: 'Mobile verified & client registration submitted. Admin approval is required before login.',
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { mobile, newPassword, confirmPassword, otpVerificationToken } = req.body as Record<string, string | undefined>;
    const normMobile = normalizeMobile(mobile || '');
    if (!otpVerificationToken || !verifyOtpVerifiedToken(otpVerificationToken, normMobile, 'PASSWORD_RESET')) {
      res.status(403).json({ error: 'Verified mobile OTP is required to reset password.' });
      return;
    }
    if (!newPassword || newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Passwords must match.' });
      return;
    }
    const pwErr = validateStrongPassword(newPassword);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await execute(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE mobile = ?`, [
      hash,
      new Date().toISOString(),
      normMobile,
    ]);
    res.json({ reset: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/auth/change-password', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body as Record<string, string | undefined>;
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Current password and matching new passwords are required.' });
      return;
    }
    const pwErr = validateStrongPassword(newPassword);
    if (pwErr) {
      res.status(400).json({ error: pwErr });
      return;
    }
    const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = ?`, [req.user!.id]);
    if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await execute(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`, [
      hash,
      new Date().toISOString(),
      req.user!.id,
    ]);
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/auth/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const company = await queryOne(`SELECT * FROM company_settings WHERE id = 'SIID_COMPANY_DEFAULT'`);
    const employee = await queryOne(`SELECT * FROM employees WHERE user_id = ?`, [req.user!.id]);
    const client = await queryOne(`SELECT * FROM clients WHERE user_id = ?`, [req.user!.id]);
    const unread = await queryAll<{ id: string }>(
      `SELECT id FROM notifications WHERE is_read = 0 AND (target_user_id = ? OR target_role = ? OR (target_role = 'ADMIN' AND ? IN ('OWNER','ADMIN')))`,
      [req.user!.id, req.user!.role, req.user!.role]
    );
    res.json({
      user: req.user,
      employee,
      client,
      company,
      unreadNotifications: unread.length,
      dbMode: getDbMode(),
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
