-- ============================================================================
-- SIID ERP - Sirahi Infrastructure & Interior Design
-- Production MySQL 8.0+ Database Schema
-- ============================================================================

CREATE DATABASE IF NOT EXISTS siid_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE siid_erp;

-- 1. Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  company_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  owner_mobile VARCHAR(20) NOT NULL,
  official_email VARCHAR(255) NOT NULL,
  website VARCHAR(255) NOT NULL,
  gstin VARCHAR(32) NOT NULL,
  address TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  developed_by VARCHAR(255) NOT NULL,
  developer_designation VARCHAR(255) NOT NULL,
  it_support_number VARCHAR(20) NOT NULL,
  tagline VARCHAR(255) NOT NULL,
  logo_url TEXT,
  signature_url TEXT,
  default_gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  tax_label VARCHAR(64) NOT NULL DEFAULT 'GST',
  pdf_footer_note TEXT,
  backup_retention_days INT NOT NULL DEFAULT 90,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 2. Users (Unified Auth & RBAC)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  user_code VARCHAR(64) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM(
    'OWNER',
    'ADMIN',
    'ACCOUNTANT',
    'SITE_MANAGER',
    'INTERIOR_DESIGNER',
    'PERMANENT_EMPLOYEE',
    'CONTRACT_EMPLOYEE',
    'DAILY_WAGE_LABOUR',
    'CLIENT'
  ) NOT NULL,
  mobile_verified TINYINT(1) NOT NULL DEFAULT 0,
  account_status ENUM('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE') NOT NULL DEFAULT 'PENDING_APPROVAL',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  profile_photo_url TEXT,
  permissions_json TEXT,
  last_login_at TIMESTAMP NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  INDEX idx_users_role_status (role, account_status),
  INDEX idx_users_mobile (mobile)
) ENGINE=InnoDB;

-- 3. OTP Verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
  id VARCHAR(64) PRIMARY KEY,
  mobile VARCHAR(20) NOT NULL,
  purpose ENUM('EMPLOYEE_REGISTER', 'CLIENT_REGISTER', 'PASSWORD_RESET') NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_message_id VARCHAR(128),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_mobile_purpose (mobile, purpose, created_at)
) ENGINE=InnoDB;

-- 4. Employees
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  user_id VARCHAR(64) NOT NULL UNIQUE,
  employee_code VARCHAR(64) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  employee_type ENUM('PERMANENT', 'CONTRACT', 'DAILY_WAGE') NOT NULL DEFAULT 'PERMANENT',
  department VARCHAR(120),
  designation VARCHAR(120),
  address TEXT,
  emergency_contact VARCHAR(32),
  joining_date DATE,
  salary_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  daily_wage_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  half_day_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  overtime_hourly_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  contract_period VARCHAR(120),
  assigned_project_id VARCHAR(64),
  assigned_site_id VARCHAR(64),
  photo_url TEXT,
  documents_json TEXT,
  approval_notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_emp_type_status (employee_type, status)
) ENGINE=InnoDB;

-- 5. Clients
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  user_id VARCHAR(64) UNIQUE,
  client_code VARCHAR(64) NOT NULL UNIQUE,
  client_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  gstin VARCHAR(32),
  approval_notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  INDEX idx_client_status (status)
) ENGINE=InnoDB;

-- 6. Projects
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  project_code VARCHAR(64) NOT NULL UNIQUE,
  project_name VARCHAR(255) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  category VARCHAR(120) NOT NULL,
  address TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  start_date DATE,
  expected_completion_date DATE,
  budget DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  site_manager_id VARCHAR(64),
  designer_id VARCHAR(64),
  assigned_employees_json TEXT,
  description TEXT,
  progress_percent INT NOT NULL DEFAULT 0,
  quotation_id VARCHAR(64),
  status ENUM('PLANNING', 'ONGOING', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  INDEX idx_proj_client (client_id),
  INDEX idx_proj_status (status)
) ENGINE=InnoDB;

-- 7. Project Sites
CREATE TABLE IF NOT EXISTS project_sites (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  project_id VARCHAR(64) NOT NULL,
  site_name VARCHAR(255) NOT NULL,
  location TEXT,
  city VARCHAR(120),
  site_manager_id VARCHAR(64),
  progress_percent INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  CONSTRAINT fk_site_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  employee_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64),
  site_id VARCHAR(64),
  attendance_date DATE NOT NULL,
  check_in_at TIMESTAMP NULL,
  check_out_at TIMESTAMP NULL,
  attendance_status ENUM('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE') NOT NULL DEFAULT 'PRESENT',
  overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  gps_lat DECIMAL(10,7),
  gps_lng DECIMAL(10,7),
  selfie_url TEXT,
  correction_requested TINYINT(1) NOT NULL DEFAULT 0,
  correction_reason TEXT,
  correction_status ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NONE',
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  UNIQUE KEY uq_emp_date (employee_id, attendance_date),
  INDEX idx_att_date (attendance_date)
) ENGINE=InnoDB;

-- 9. Leaves
CREATE TABLE IF NOT EXISTS leaves (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  employee_id VARCHAR(64) NOT NULL,
  leave_type VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  reviewed_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 10. Salary & Wage Advances
CREATE TABLE IF NOT EXISTS advances (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  employee_id VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  advance_date DATE NOT NULL,
  reason TEXT,
  settled TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('PENDING', 'APPROVED', 'PAID', 'SETTLED') NOT NULL DEFAULT 'APPROVED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 11. Salary & Wage Records
CREATE TABLE IF NOT EXISTS salary_records (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  slip_number VARCHAR(64) NOT NULL UNIQUE,
  employee_id VARCHAR(64) NOT NULL,
  employee_type ENUM('PERMANENT', 'CONTRACT', 'DAILY_WAGE') NOT NULL,
  period_label VARCHAR(64) NOT NULL,
  present_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  half_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  leave_days DECIMAL(6,2) NOT NULL DEFAULT 0,
  overtime_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  base_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  overtime_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  advance_adjusted DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_payable DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(64),
  transaction_ref VARCHAR(128),
  paid_at TIMESTAMP NULL,
  status ENUM('GENERATED', 'PAID') NOT NULL DEFAULT 'GENERATED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 12. Interior Design Records
CREATE TABLE IF NOT EXISTS interior_designs (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  project_id VARCHAR(64) NOT NULL,
  design_category VARCHAR(120) NOT NULL,
  room_name VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  material_specs TEXT,
  furniture_layout TEXT,
  lighting_electrical TEXT,
  plumbing_layout TEXT,
  file_type ENUM('2D_PLAN', '3D_RENDER', 'DESIGN_IMAGE', 'APPROVAL_DOC') NOT NULL DEFAULT '2D_PLAN',
  file_url TEXT,
  revision_number INT NOT NULL DEFAULT 1,
  client_approval_status ENUM('PENDING', 'APPROVED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'PENDING',
  client_remarks TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 13. Construction Stages & Daily Progress Reports
CREATE TABLE IF NOT EXISTS construction_stages (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  project_id VARCHAR(64) NOT NULL,
  site_id VARCHAR(64),
  stage_name VARCHAR(120) NOT NULL,
  progress_percent INT NOT NULL DEFAULT 0,
  quality_check ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  safety_check ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  report_notes TEXT,
  photo_urls_json TEXT,
  admin_approval ENUM('PENDING', 'APPROVED', 'REVISION_NEEDED') NOT NULL DEFAULT 'PENDING',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 14. Material Inventory
CREATE TABLE IF NOT EXISTS inventory_items (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  category VARCHAR(120) NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  brand VARCHAR(160),
  company_name VARCHAR(160),
  product_model VARCHAR(120),
  grade VARCHAR(120),
  unit VARCHAR(40) NOT NULL,
  purchase_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  supplier_id VARCHAR(64),
  stock_available DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_issued DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_returned DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_damaged DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  min_stock_alert DECIMAL(12,2) NOT NULL DEFAULT 10.00,
  site_id VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 15. Stock Ledger
CREATE TABLE IF NOT EXISTS stock_ledger (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  inventory_item_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64),
  site_id VARCHAR(64),
  txn_type ENUM('PURCHASE_IN', 'ISSUE_OUT', 'RETURN_IN', 'DAMAGED') NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64)
) ENGINE=InnoDB;

-- 16. Vendors & Suppliers
CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  vendor_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  gstin VARCHAR(32),
  materials_supplied TEXT,
  total_bills DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 17. Quotations
CREATE TABLE IF NOT EXISTS quotations (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  quotation_number VARCHAR(64) NOT NULL UNIQUE,
  revision_no INT NOT NULL DEFAULT 1,
  parent_quotation_id VARCHAR(64),
  quotation_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  project_category VARCHAR(120) NOT NULL,
  project_location TEXT,
  project_description TEXT,
  scope_of_work TEXT,
  estimated_duration VARCHAR(120),
  expected_start_date DATE,
  expected_completion_date DATE,
  include_material_in_items TINYINT(1) NOT NULL DEFAULT 0,
  labour_specs TEXT,
  design_specs TEXT,
  work_execution_details TEXT,
  included_services TEXT,
  excluded_services TEXT,
  special_instructions TEXT,
  subtotal_items DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  material_charges DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  labour_charges DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  transportation_charges DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  additional_charges DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  gst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  advance_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  remaining_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_terms_json TEXT,
  terms_conditions_json TEXT,
  client_comments TEXT,
  client_signed_at TIMESTAMP NULL,
  converted_project_id VARCHAR(64),
  status ENUM('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  INDEX idx_qtn_status (status),
  INDEX idx_qtn_client (client_id)
) ENGINE=InnoDB;

-- 18. Quotation Work Items
CREATE TABLE IF NOT EXISTS quotation_items (
  id VARCHAR(64) PRIMARY KEY,
  quotation_id VARCHAR(64) NOT NULL,
  serial_no INT NOT NULL,
  work_category VARCHAR(120) NOT NULL,
  work_description TEXT NOT NULL,
  material_or_service VARCHAR(255),
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(40) NOT NULL,
  rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_qitem_qtn FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 19. Quotation Material Details & Brand / Company Specifications
CREATE TABLE IF NOT EXISTS quotation_materials (
  id VARCHAR(64) PRIMARY KEY,
  quotation_id VARCHAR(64) NOT NULL,
  serial_no INT NOT NULL,
  work_category VARCHAR(120) NOT NULL,
  material_name VARCHAR(255) NOT NULL,
  material_description TEXT,
  brand_name VARCHAR(255) NOT NULL,
  product_model VARCHAR(160),
  grade_quality VARCHAR(160),
  size_thickness VARCHAR(160),
  technical_specs TEXT,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(40) NOT NULL,
  rate_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  provided_by ENUM('SIID', 'CLIENT') NOT NULL DEFAULT 'SIID',
  image_url TEXT,
  remarks TEXT,
  CONSTRAINT fk_qmat_qtn FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 20. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  due_date DATE,
  client_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64),
  items_json TEXT NOT NULL,
  materials_json TEXT,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  gst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  outstanding_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  status ENUM('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'UNPAID',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 21. Payments (Client Receipts & Vendor Payments)
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  receipt_number VARCHAR(64) NOT NULL UNIQUE,
  payment_direction ENUM('INCOME', 'VENDOR_OUT') NOT NULL DEFAULT 'INCOME',
  income_category VARCHAR(120),
  client_id VARCHAR(64),
  vendor_id VARCHAR(64),
  project_id VARCHAR(64),
  invoice_id VARCHAR(64),
  amount DECIMAL(14,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(64) NOT NULL,
  transaction_ref VARCHAR(128) NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 22. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  category VARCHAR(120) NOT NULL,
  project_id VARCHAR(64),
  site_id VARCHAR(64),
  vendor_id VARCHAR(64),
  description TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(64),
  receipt_url TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'RECORDED',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(64),
  updated_by VARCHAR(64)
) ENGINE=InnoDB;

-- 23. Documents
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120),
  file_size BIGINT,
  file_url TEXT NOT NULL,
  is_private TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64)
) ENGINE=InnoDB;

-- 24. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  target_user_id VARCHAR(64),
  target_role VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(64),
  entity_id VARCHAR(64),
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 25. Client Complaints & Support Tickets
CREATE TABLE IF NOT EXISTS complaints (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  client_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  admin_response TEXT,
  status ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 26. Backups & Audit
CREATE TABLE IF NOT EXISTS backup_logs (
  id VARCHAR(64) PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL DEFAULT 'SIID_MAIN',
  backup_type VARCHAR(64) NOT NULL,
  record_count INT NOT NULL DEFAULT 0,
  checksum VARCHAR(128),
  created_by VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Initial Official Company Record (Authorized Values Only)
INSERT IGNORE INTO company_settings (
  id, company_id, company_name, owner_name, owner_mobile,
  official_email, website, gstin, address, city, state,
  developed_by, developer_designation, it_support_number,
  tagline, logo_url, default_gst_rate, tax_label, status
) VALUES (
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
  18.00,
  'GST',
  'ACTIVE'
);
