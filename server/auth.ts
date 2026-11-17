import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from './db.ts';

export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'SITE_MANAGER'
  | 'INTERIOR_DESIGNER'
  | 'PERMANENT_EMPLOYEE'
  | 'CONTRACT_EMPLOYEE'
  | 'DAILY_WAGE_LABOUR'
  | 'CLIENT';

export interface AuthUser {
  id: string;
  user_code: string;
  full_name: string;
  mobile: string;
  email: string | null;
  role: UserRole;
  account_status: string;
  must_change_password: number;
  profile_photo_url: string | null;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'siid-erp-dev-secret-change-in-production-env';

export function signSessionToken(user: { id: string; role: UserRole; mobile: string }): string {
  return jwt.sign({ sub: user.id, role: user.role, mobile: user.mobile, type: 'session' }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function signOtpVerifiedToken(mobile: string, purpose: string): string {
  return jwt.sign({ mobile, purpose, type: 'otp_verified' }, JWT_SECRET, {
    expiresIn: '15m',
  });
}

export function verifyOtpVerifiedToken(token: string, expectedMobile: string, expectedPurpose: string): boolean {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      type?: string;
      mobile?: string;
      purpose?: string;
    };
    return (
      decoded.type === 'otp_verified' &&
      decoded.mobile === expectedMobile &&
      decoded.purpose === expectedPurpose
    );
  } catch {
    return false;
  }
}

export function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Password must include at least one digit.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
  return null;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string; type?: string };
    if (payload.type !== 'session' || !payload.sub) {
      res.status(401).json({ error: 'Invalid session token.' });
      return;
    }

    const user = await queryOne<AuthUser>(
      `SELECT id, user_code, full_name, mobile, email, role, account_status, must_change_password, profile_photo_url
       FROM users WHERE id = ?`,
      [payload.sub]
    );

    if (!user) {
      res.status(401).json({ error: 'Account no longer exists.' });
      return;
    }
    if (user.account_status !== 'ACTIVE') {
      res.status(403).json({
        error: `Account status is ${user.account_status}. Only approved active accounts may access SIID ERP.`,
      });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

export function requireRoles(...allowed: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied for role ${req.user.role}.` });
      return;
    }
    next();
  };
}
