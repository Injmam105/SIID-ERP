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

export interface CompanySettings {
  id: string;
  company_name: string;
  owner_name: string;
  owner_mobile: string;
  official_email: string;
  website: string;
  gstin: string;
  address?: string;
  city?: string;
  state?: string;
  developed_by: string;
  developer_designation: string;
  it_support_number: string;
  tagline: string;
  logo_url?: string;
  signature_url?: string;
  default_gst_rate: number;
  tax_label: string;
  pdf_footer_note?: string;
  backup_retention_days?: number;
}

export const CONSTRUCTION_BRANDS = [
  'UltraTech',
  'ACC',
  'Ambuja',
  'Tata Tiscon',
  'JSW Steel',
  'SAIL',
  'Asian Paints',
  'Berger Paints',
  'Nerolac',
  'Polycab',
  'Havells',
  'Finolex',
  'Anchor',
  'Legrand',
  'Kajaria',
  'Somany',
  'Johnson',
  'CenturyPly',
  'Greenply',
  'Jaquar',
  'Cera',
  'Hindware',
  'Supreme',
  'Astral',
  'Merino',
  'Greenlam',
  'Brand To Be Confirmed',
];

const TOKEN_KEY = 'siid_erp_jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function formatINR(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok) {
    if (contentType.includes('application/json')) {
      const errJson = (await resp.json()) as { error?: string };
      throw new Error(errJson.error || `Request failed (${resp.status})`);
    }
    throw new Error(`Request failed (${resp.status})`);
  }

  if (contentType.includes('application/json')) {
    return (await resp.json()) as T;
  }
  return (await resp.text()) as unknown as T;
}

export async function uploadFile(
  file: File,
  entityType: string,
  entityId: string,
  title?: string
): Promise<{ id: string; fileUrl: string; fileName: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('entityType', entityType);
  form.append('entityId', entityId);
  form.append('title', title || file.name);
  return apiFetch('/uploads', {
    method: 'POST',
    body: form,
  });
}
