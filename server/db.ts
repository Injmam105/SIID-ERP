import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import mysql from 'mysql2/promise';

export type DbMode = 'mysql' | 'sqlite_preview';

let mysqlPool: mysql.Pool | null = null;
let sqliteDb: DatabaseSync | null = null;
let activeMode: DbMode = 'sqlite_preview';

export function getDbMode(): DbMode {
  return activeMode;
}

function getSqliteSchemaStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS company_settings (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      company_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_mobile TEXT NOT NULL,
      official_email TEXT NOT NULL,
      website TEXT NOT NULL,
      gstin TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      developed_by TEXT NOT NULL,
      developer_designation TEXT NOT NULL,
      it_support_number TEXT NOT NULL,
      tagline TEXT NOT NULL,
      logo_url TEXT,
      signature_url TEXT,
      default_gst_rate REAL NOT NULL DEFAULT 18.0,
      tax_label TEXT NOT NULL DEFAULT 'GST',
      pdf_footer_note TEXT,
      backup_retention_days INTEGER NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      user_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      mobile_verified INTEGER NOT NULL DEFAULT 0,
      account_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      profile_photo_url TEXT,
      permissions_json TEXT,
      last_login_at TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS otp_verifications (
      id TEXT PRIMARY KEY,
      mobile TEXT NOT NULL,
      purpose TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_message_id TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      verified INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      user_id TEXT NOT NULL UNIQUE,
      employee_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT,
      employee_type TEXT NOT NULL DEFAULT 'PERMANENT',
      department TEXT,
      designation TEXT,
      address TEXT,
      emergency_contact TEXT,
      joining_date TEXT,
      salary_amount REAL NOT NULL DEFAULT 0,
      daily_wage_rate REAL NOT NULL DEFAULT 0,
      half_day_rate REAL NOT NULL DEFAULT 0,
      overtime_hourly_rate REAL NOT NULL DEFAULT 0,
      contract_period TEXT,
      assigned_project_id TEXT,
      assigned_site_id TEXT,
      photo_url TEXT,
      documents_json TEXT,
      approval_notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      user_id TEXT UNIQUE,
      client_code TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      gstin TEXT,
      approval_notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      project_code TEXT NOT NULL UNIQUE,
      project_name TEXT NOT NULL,
      client_id TEXT NOT NULL,
      category TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      start_date TEXT,
      expected_completion_date TEXT,
      budget REAL NOT NULL DEFAULT 0,
      site_manager_id TEXT,
      designer_id TEXT,
      assigned_employees_json TEXT,
      description TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      quotation_id TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNING',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS project_sites (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      project_id TEXT NOT NULL,
      site_name TEXT NOT NULL,
      location TEXT,
      city TEXT,
      site_manager_id TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      employee_id TEXT NOT NULL,
      project_id TEXT,
      site_id TEXT,
      attendance_date TEXT NOT NULL,
      check_in_at TEXT,
      check_out_at TEXT,
      attendance_status TEXT NOT NULL DEFAULT 'PRESENT',
      overtime_hours REAL NOT NULL DEFAULT 0,
      gps_lat REAL,
      gps_lng REAL,
      selfie_url TEXT,
      correction_requested INTEGER NOT NULL DEFAULT 0,
      correction_reason TEXT,
      correction_status TEXT NOT NULL DEFAULT 'NONE',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT,
      UNIQUE(employee_id, attendance_date)
    )`,
    `CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      employee_id TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS advances (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      employee_id TEXT NOT NULL,
      amount REAL NOT NULL,
      advance_date TEXT NOT NULL,
      reason TEXT,
      settled INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS salary_records (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      slip_number TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL,
      employee_type TEXT NOT NULL,
      period_label TEXT NOT NULL,
      present_days REAL NOT NULL DEFAULT 0,
      half_days REAL NOT NULL DEFAULT 0,
      leave_days REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      base_pay REAL NOT NULL DEFAULT 0,
      overtime_pay REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      advance_adjusted REAL NOT NULL DEFAULT 0,
      net_payable REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      transaction_ref TEXT,
      paid_at TEXT,
      status TEXT NOT NULL DEFAULT 'GENERATED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS interior_designs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      project_id TEXT NOT NULL,
      design_category TEXT NOT NULL,
      room_name TEXT NOT NULL,
      title TEXT NOT NULL,
      material_specs TEXT,
      furniture_layout TEXT,
      lighting_electrical TEXT,
      plumbing_layout TEXT,
      file_type TEXT NOT NULL DEFAULT '2D_PLAN',
      file_url TEXT,
      revision_number INTEGER NOT NULL DEFAULT 1,
      client_approval_status TEXT NOT NULL DEFAULT 'PENDING',
      client_remarks TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS construction_stages (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      project_id TEXT NOT NULL,
      site_id TEXT,
      stage_name TEXT NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      quality_check TEXT NOT NULL DEFAULT 'PENDING',
      safety_check TEXT NOT NULL DEFAULT 'PENDING',
      report_notes TEXT,
      photo_urls_json TEXT,
      admin_approval TEXT NOT NULL DEFAULT 'PENDING',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      category TEXT NOT NULL,
      material_name TEXT NOT NULL,
      brand TEXT,
      company_name TEXT,
      product_model TEXT,
      grade TEXT,
      unit TEXT NOT NULL,
      purchase_rate REAL NOT NULL DEFAULT 0,
      supplier_id TEXT,
      stock_available REAL NOT NULL DEFAULT 0,
      stock_issued REAL NOT NULL DEFAULT 0,
      stock_returned REAL NOT NULL DEFAULT 0,
      stock_damaged REAL NOT NULL DEFAULT 0,
      min_stock_alert REAL NOT NULL DEFAULT 10,
      site_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS stock_ledger (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      inventory_item_id TEXT NOT NULL,
      project_id TEXT,
      site_id TEXT,
      txn_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      rate REAL NOT NULL DEFAULT 0,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      vendor_name TEXT NOT NULL,
      company_name TEXT,
      mobile TEXT NOT NULL,
      email TEXT,
      address TEXT,
      gstin TEXT,
      materials_supplied TEXT,
      total_bills REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      quotation_number TEXT NOT NULL UNIQUE,
      revision_no INTEGER NOT NULL DEFAULT 1,
      parent_quotation_id TEXT,
      quotation_date TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      client_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_category TEXT NOT NULL,
      project_location TEXT,
      project_description TEXT,
      scope_of_work TEXT,
      estimated_duration TEXT,
      expected_start_date TEXT,
      expected_completion_date TEXT,
      include_material_in_items INTEGER NOT NULL DEFAULT 0,
      labour_specs TEXT,
      design_specs TEXT,
      work_execution_details TEXT,
      included_services TEXT,
      excluded_services TEXT,
      special_instructions TEXT,
      subtotal_items REAL NOT NULL DEFAULT 0,
      material_charges REAL NOT NULL DEFAULT 0,
      labour_charges REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      transportation_charges REAL NOT NULL DEFAULT 0,
      additional_charges REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 18.0,
      gst_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      advance_amount REAL NOT NULL DEFAULT 0,
      remaining_balance REAL NOT NULL DEFAULT 0,
      payment_terms_json TEXT,
      terms_conditions_json TEXT,
      client_comments TEXT,
      client_signed_at TEXT,
      converted_project_id TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS quotation_items (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      serial_no INTEGER NOT NULL,
      work_category TEXT NOT NULL,
      work_description TEXT NOT NULL,
      material_or_service TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS quotation_materials (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      serial_no INTEGER NOT NULL,
      work_category TEXT NOT NULL,
      material_name TEXT NOT NULL,
      material_description TEXT,
      brand_name TEXT NOT NULL,
      product_model TEXT,
      grade_quality TEXT,
      size_thickness TEXT,
      technical_specs TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL,
      rate_per_unit REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      provided_by TEXT NOT NULL DEFAULT 'SIID',
      image_url TEXT,
      remarks TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      invoice_number TEXT NOT NULL UNIQUE,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      client_id TEXT NOT NULL,
      project_id TEXT,
      items_json TEXT NOT NULL,
      materials_json TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      gst_rate REAL NOT NULL DEFAULT 18.0,
      gst_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      outstanding_balance REAL NOT NULL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      receipt_number TEXT NOT NULL UNIQUE,
      payment_direction TEXT NOT NULL DEFAULT 'INCOME',
      income_category TEXT,
      client_id TEXT,
      vendor_id TEXT,
      project_id TEXT,
      invoice_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_ref TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'VERIFIED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      category TEXT NOT NULL,
      project_id TEXT,
      site_id TEXT,
      vendor_id TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL,
      payment_method TEXT,
      receipt_url TEXT,
      status TEXT NOT NULL DEFAULT 'RECORDED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      file_url TEXT NOT NULL,
      is_private INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      target_user_id TEXT,
      target_role TEXT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      client_id TEXT NOT NULL,
      project_id TEXT,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      admin_response TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS backup_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL DEFAULT 'SIID_MAIN',
      backup_type TEXT NOT NULL,
      record_count INTEGER NOT NULL DEFAULT 0,
      checksum TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];
}

export async function initDatabase(): Promise<void> {
  const mysqlHost = process.env.MYSQL_HOST?.trim();
  const mysqlDb = process.env.MYSQL_DATABASE?.trim();

  if (mysqlHost && mysqlDb) {
    try {
      mysqlPool = mysql.createPool({
        host: mysqlHost,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: mysqlDb,
        waitForConnections: true,
        connectionLimit: 10,
        multipleStatements: true,
      });
      await mysqlPool.query('SELECT 1');
      activeMode = 'mysql';

      const schemaPath = path.resolve(process.cwd(), 'mysql/siid_erp_mysql.sql');
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await mysqlPool.query(sql);
      }
      console.log(`[SIID DB] Connected to MySQL (${mysqlHost}/${mysqlDb})`);
      return;
    } catch (err) {
      console.error('[SIID DB] MySQL connection failed, falling back to local SQL engine:', err);
      mysqlPool = null;
    }
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'siid_erp.db');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  for (const stmt of getSqliteSchemaStatements()) {
    sqliteDb.exec(stmt);
  }

  await seedInitialCompany();
  activeMode = 'sqlite_preview';
  console.log(`[SIID DB] Active SQLite relational persistence at ${dbPath} (MySQL schema ready at mysql/siid_erp_mysql.sql)`);
}

async function seedInitialCompany(): Promise<void> {
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM company_settings WHERE id = ?',
    ['SIID_COMPANY_DEFAULT']
  );
  if (!existing) {
    await execute(
      `INSERT INTO company_settings (
        id, company_id, company_name, owner_name, owner_mobile,
        official_email, website, gstin, address, city, state,
        developed_by, developer_designation, it_support_number,
        tagline, logo_url, default_gst_rate, tax_label, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'SIID_COMPANY_DEFAULT',
        'SIID_MAIN',
        'Sirahi Infrastructure & Interior Design',
        'MD Zawed Ansar',
        '9650598785',
        'sirahiinfrainteriordesign@gmail.com',
        'https://sirahi.in',
        '07DCYPA1228R1ZZ',
        'New Delhi, India',
        'New Delhi',
        'Delhi',
        'Injmam Ansari',
        'IT Head of SIID',
        '7503354996',
        'One Company. Multiple Projects. Complete Control.',
        '/src/assets/images/siid_company_logo_1794819635021.jpg',
        18.0,
        'GST',
        'ACTIVE',
      ]
    );
  }
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(sql, params as (string | number | boolean | null | Buffer)[]);
    return rows as T[];
  }
  if (!sqliteDb) throw new Error('Database not initialized');
  const stmt = sqliteDb.prepare(sql);
  return stmt.all(...(params as (string | number | null | Uint8Array)[])) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number }> {
  if (mysqlPool) {
    const [result] = await mysqlPool.execute(sql, params as (string | number | boolean | null | Buffer)[]);
    const info = result as mysql.ResultSetHeader;
    return { changes: info.affectedRows || 0 };
  }
  if (!sqliteDb) throw new Error('Database not initialized');
  const stmt = sqliteDb.prepare(sql);
  const info = stmt.run(...(params as (string | number | null | Uint8Array)[]));
  return { changes: Number(info.changes || 0) };
}
