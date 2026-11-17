import React, { useState } from 'react';
import { Check, Clock, Download, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { apiFetch, type AuthUser, type CompanySettings, formatINR } from '../lib/api.ts';
import { generateSalarySlipPdf } from '../lib/pdfGenerator.ts';

interface Props {
  activeSection: 'employees' | 'clients' | 'attendance' | 'payroll';
  user: AuthUser;
  company: CompanySettings;
  employees: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
  leaves: Record<string, unknown>[];
  advances: Record<string, unknown>[];
  salaryRecords: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

export function HrPayrollModule({
  activeSection,
  user,
  company,
  employees,
  clients,
  projects,
  attendance,
  leaves,
  advances,
  salaryRecords,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add employee state
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empForm, setEmpForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    password: '',
    role: 'PERMANENT_EMPLOYEE',
    employeeType: 'PERMANENT',
    department: 'Engineering',
    designation: 'Site Engineer',
    salaryAmount: 0,
    dailyWageRate: 0,
    overtimeHourlyRate: 0,
    assignedProjectId: '',
  });

  // Add client state
  const [showAddCli, setShowAddCli] = useState(false);
  const [cliForm, setCliForm] = useState({
    clientName: '',
    mobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    gstin: '',
    password: '',
  });

  // Mark attendance state
  const [attForm, setAttForm] = useState({
    employeeId: String(employees[0]?.id || ''),
    projectId: String(projects[0]?.id || ''),
    attendanceDate: new Date().toISOString().slice(0, 10),
    attendanceStatus: 'PRESENT',
    overtimeHours: 0,
    notes: '',
  });

  // Salary generator state
  const [salForm, setSalForm] = useState({
    employeeId: String(employees[0]?.id || ''),
    periodLabel: new Date().toISOString().slice(0, 7),
    startDate: `${new Date().toISOString().slice(0, 7)}-01`,
    endDate: new Date().toISOString().slice(0, 10),
    deductions: 0,
    contractBasePay: 0,
  });

  // Advance state
  const [advForm, setAdvForm] = useState({
    employeeId: String(employees[0]?.id || ''),
    amount: 0,
    reason: '',
  });

  const canManage = ['OWNER', 'ADMIN'].includes(user.role);
  const canPayroll = ['OWNER', 'ADMIN', 'ACCOUNTANT'].includes(user.role);

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/employees', { method: 'POST', body: JSON.stringify(empForm) });
      setShowAddEmp(false);
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/clients', { method: 'POST', body: JSON.stringify(cliForm) });
      setShowAddCli(false);
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* EMPLOYEES SECTION */}
      {activeSection === 'employees' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl">Employee &amp; Labour Management</h2>
              <p className="text-xs text-slate-500">
                Permanent staff, contract personnel, daily wage labour, OTP approval queue, and role assignments.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddEmp(!showAddEmp)}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            )}
          </div>

          {showAddEmp && (
            <form
              onSubmit={handleCreateEmployee}
              className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
            >
              <h3 className="font-semibold text-sm">Create Employee Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  required
                  placeholder="Full Name *"
                  value={empForm.fullName}
                  onChange={(e) => setEmpForm({ ...empForm, fullName: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  required
                  placeholder="10-Digit Mobile *"
                  value={empForm.mobile}
                  onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <select
                  value={empForm.role}
                  onChange={(e) => {
                    const role = e.target.value;
                    const employeeType =
                      role === 'DAILY_WAGE_LABOUR'
                        ? 'DAILY_WAGE'
                        : role === 'CONTRACT_EMPLOYEE'
                          ? 'CONTRACT'
                          : 'PERMANENT';
                    setEmpForm({ ...empForm, role, employeeType });
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                >
                  {user.role === 'OWNER' && <option value="ADMIN">Admin</option>}
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="SITE_MANAGER">Site Manager</option>
                  <option value="INTERIOR_DESIGNER">Interior Designer</option>
                  <option value="PERMANENT_EMPLOYEE">Permanent Employee</option>
                  <option value="CONTRACT_EMPLOYEE">Contract Employee</option>
                  <option value="DAILY_WAGE_LABOUR">Daily Wage Labour</option>
                </select>
                <input
                  placeholder="Department"
                  value={empForm.department}
                  onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  placeholder="Designation"
                  value={empForm.designation}
                  onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  type="number"
                  placeholder="Monthly Salary / Contract Pay"
                  value={empForm.salaryAmount}
                  onChange={(e) => setEmpForm({ ...empForm, salaryAmount: Number(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                />
                <input
                  type="number"
                  placeholder="Daily Wage Rate"
                  value={empForm.dailyWageRate}
                  onChange={(e) => setEmpForm({ ...empForm, dailyWageRate: Number(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                />
                <input
                  type="password"
                  required
                  placeholder="Initial Strong Password *"
                  value={empForm.password}
                  onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEmp(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
                >
                  Save Employee
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              />
            </div>

            {employees.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No employees added yet. Add employees or review OTP-verified registrations here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="py-2 pr-3">Emp ID</th>
                      <th className="py-2 pr-3">Name & Mobile</th>
                      <th className="py-2 pr-3">Role / Type</th>
                      <th className="py-2 pr-3 text-right">Compensation</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees
                      .filter((e) =>
                        `${e.employee_code} ${e.full_name} ${e.mobile} ${e.user_role}`
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      )
                      .map((e) => (
                        <tr key={String(e.id)} className="border-b border-slate-100 dark:border-slate-800/70">
                          <td className="py-2.5 pr-3 font-mono font-semibold">{String(e.employee_code)}</td>
                          <td className="py-2.5 pr-3">
                            <div className="font-medium">{String(e.full_name)}</div>
                            <div className="text-slate-500 font-mono tabular-nums">{String(e.mobile)}</div>
                          </td>
                          <td className="py-2.5 pr-3">
                            {String(e.user_role || '').replace(/_/g, ' ')} · {String(e.employee_type)}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono tabular-nums">
                            {e.employee_type === 'DAILY_WAGE'
                              ? `${formatINR(e.daily_wage_rate as number)}/day`
                              : formatINR(e.salary_amount as number)}
                          </td>
                          <td className="py-2.5 pr-3 font-semibold">{String(e.status)}</td>
                          <td className="py-2.5 text-right whitespace-nowrap space-x-2">
                            {canManage && e.status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiFetch(`/employees/${e.id}/approval`, {
                                      method: 'POST',
                                      body: JSON.stringify({ decision: 'APPROVE' }),
                                    });
                                    await onRefresh();
                                  }}
                                  className="px-2 py-1 rounded bg-emerald-700 text-white"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiFetch(`/employees/${e.id}/approval`, {
                                      method: 'POST',
                                      body: JSON.stringify({ decision: 'REJECT' }),
                                    });
                                    await onRefresh();
                                  }}
                                  className="px-2 py-1 rounded border border-red-300 text-red-600"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {canManage && e.status !== 'PENDING_APPROVAL' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/employees/${e.id}/approval`, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      decision: e.status === 'ACTIVE' ? 'DEACTIVATE' : 'REACTIVATE',
                                    }),
                                  });
                                  await onRefresh();
                                }}
                                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700"
                              >
                                {e.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLIENTS SECTION */}
      {activeSection === 'clients' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl">Client Directory &amp; Approvals</h2>
              <p className="text-xs text-slate-500">Manage registered clients, GSTIN details, and portal approvals.</p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAddCli(!showAddCli)}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Client
              </button>
            )}
          </div>

          {showAddCli && (
            <form
              onSubmit={handleCreateClient}
              className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  required
                  placeholder="Client Name *"
                  value={cliForm.clientName}
                  onChange={(e) => setCliForm({ ...cliForm, clientName: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  required
                  placeholder="10-Digit Mobile *"
                  value={cliForm.mobile}
                  onChange={(e) => setCliForm({ ...cliForm, mobile: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={cliForm.email}
                  onChange={(e) => setCliForm({ ...cliForm, email: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  placeholder="City"
                  value={cliForm.city}
                  onChange={(e) => setCliForm({ ...cliForm, city: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  placeholder="GSTIN (Optional)"
                  value={cliForm.gstin}
                  onChange={(e) => setCliForm({ ...cliForm, gstin: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  type="password"
                  placeholder="Portal Password (Optional)"
                  value={cliForm.password}
                  onChange={(e) => setCliForm({ ...cliForm, password: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
              >
                Save Client
              </button>
            </form>
          )}

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            {clients.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No clients registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="py-2 pr-3">Client ID</th>
                      <th className="py-2 pr-3">Name & Mobile</th>
                      <th className="py-2 pr-3">City / GSTIN</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={String(c.id)} className="border-b border-slate-100 dark:border-slate-800/70">
                        <td className="py-2.5 pr-3 font-mono font-semibold">{String(c.client_code)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{String(c.client_name)}</div>
                          <div className="text-slate-500 font-mono tabular-nums">{String(c.mobile)}</div>
                        </td>
                        <td className="py-2.5 pr-3">
                          {String(c.city || '-')} {c.gstin ? `· ${c.gstin}` : ''}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold">{String(c.status)}</td>
                        <td className="py-2.5 text-right space-x-2">
                          {canManage && c.status === 'PENDING_APPROVAL' && (
                            <>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/clients/${c.id}/approval`, {
                                    method: 'POST',
                                    body: JSON.stringify({ decision: 'APPROVE' }),
                                  });
                                  await onRefresh();
                                }}
                                className="px-2 py-1 rounded bg-emerald-700 text-white"
                              >
                                <UserCheck className="w-3.5 h-3.5 inline mr-1" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/clients/${c.id}/approval`, {
                                    method: 'POST',
                                    body: JSON.stringify({ decision: 'REJECT' }),
                                  });
                                  await onRefresh();
                                }}
                                className="px-2 py-1 rounded border border-red-300 text-red-600"
                              >
                                <UserX className="w-3.5 h-3.5 inline mr-1" /> Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATTENDANCE SECTION */}
      {activeSection === 'attendance' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl">Attendance &amp; Leave Management</h2>
              <p className="text-xs text-slate-500">
                Server-timestamped check-in/out, site-wise marking, overtime tracking, and leave approvals.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiFetch('/attendance/check-in', { method: 'POST', body: '{}' });
                    await onRefresh();
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" /> Self Check-In
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiFetch('/attendance/check-out', { method: 'POST', body: '{}' });
                    await onRefresh();
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Self Check-Out
              </button>
            </div>
          </div>

          {['OWNER', 'ADMIN', 'SITE_MANAGER'].includes(user.role) && employees.length > 0 && (
            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm">Mark Site / Daily Attendance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                <select
                  value={attForm.employeeId}
                  onChange={(e) => setAttForm({ ...attForm, employeeId: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={String(e.id)} value={String(e.id)}>
                      {String(e.full_name)} ({String(e.employee_code)})
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={attForm.attendanceDate}
                  onChange={(e) => setAttForm({ ...attForm, attendanceDate: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <select
                  value={attForm.attendanceStatus}
                  onChange={(e) => setAttForm({ ...attForm, attendanceStatus: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                >
                  <option value="PRESENT">Present</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LEAVE">Leave</option>
                </select>
                <input
                  type="number"
                  placeholder="Overtime Hours"
                  value={attForm.overtimeHours}
                  onChange={(e) => setAttForm({ ...attForm, overtimeHours: Number(e.target.value) })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/attendance/mark', { method: 'POST', body: JSON.stringify(attForm) });
                    await onRefresh();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white font-semibold"
                >
                  Save Attendance
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Attendance Register</h3>
            {attendance.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No attendance records yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Employee</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">In / Out</th>
                      <th className="py-2 text-right">OT Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={String(a.id)} className="border-b border-slate-100 dark:border-slate-800/70">
                        <td className="py-2 pr-3 font-mono tabular-nums">{String(a.attendance_date)}</td>
                        <td className="py-2 pr-3">
                          {String(a.employee_name)} ({String(a.employee_code)})
                        </td>
                        <td className="py-2 pr-3 font-semibold">{String(a.attendance_status)}</td>
                        <td className="py-2 pr-3 font-mono text-slate-500">
                          {a.check_in_at ? String(a.check_in_at).slice(11, 16) : '-'} /{' '}
                          {a.check_out_at ? String(a.check_out_at).slice(11, 16) : '-'}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">{String(a.overtime_hours || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {leaves.length > 0 && (
            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
              <h3 className="font-semibold text-sm">Leave Requests</h3>
              {leaves.map((l) => (
                <div key={String(l.id)} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800">
                  <span>
                    {String(l.employee_name || '')} · {String(l.leave_type)} ({String(l.start_date)} to {String(l.end_date)}) · {String(l.status)}
                  </span>
                  {canManage && l.status === 'PENDING' && (
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/leaves/${l.id}/review`, { method: 'POST', body: JSON.stringify({ status: 'APPROVED' }) });
                          await onRefresh();
                        }}
                        className="px-2 py-1 rounded bg-emerald-700 text-white"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/leaves/${l.id}/review`, { method: 'POST', body: JSON.stringify({ status: 'REJECTED' }) });
                          await onRefresh();
                        }}
                        className="px-2 py-1 rounded border border-red-300 text-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAYROLL & WAGES SECTION */}
      {activeSection === 'payroll' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl">Salary, Contract &amp; Daily Wage Payroll</h2>
            <p className="text-xs text-slate-500">
              Attendance-based salary slips, weekly daily-wage settlements, advances, and PDF pay slips.
            </p>
          </div>

          {canPayroll && employees.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Generate Salary / Wage Slip</h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <select
                    value={salForm.employeeId}
                    onChange={(e) => setSalForm({ ...salForm, employeeId: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Select Employee / Labour</option>
                    {employees.map((e) => (
                      <option key={String(e.id)} value={String(e.id)}>
                        {String(e.full_name)} ({String(e.employee_type)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Period Label (e.g. 2026-11)"
                    value={salForm.periodLabel}
                    onChange={(e) => setSalForm({ ...salForm, periodLabel: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="number"
                    placeholder="Deductions (INR)"
                    value={salForm.deductions}
                    onChange={(e) => setSalForm({ ...salForm, deductions: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <input
                    type="date"
                    value={salForm.startDate}
                    onChange={(e) => setSalForm({ ...salForm, startDate: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="date"
                    value={salForm.endDate}
                    onChange={(e) => setSalForm({ ...salForm, endDate: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/salary/generate', { method: 'POST', body: JSON.stringify(salForm) });
                    await onRefresh();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
                >
                  Calculate &amp; Generate Slip
                </button>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Issue Salary / Wage Advance</h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <select
                    value={advForm.employeeId}
                    onChange={(e) => setAdvForm({ ...advForm, employeeId: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Select Employee / Labour</option>
                    {employees.map((e) => (
                      <option key={String(e.id)} value={String(e.id)}>
                        {String(e.full_name)} ({String(e.employee_code)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Advance Amount (INR)"
                    value={advForm.amount}
                    onChange={(e) => setAdvForm({ ...advForm, amount: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Reason"
                    value={advForm.reason}
                    onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/advances', { method: 'POST', body: JSON.stringify(advForm) });
                    await onRefresh();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold"
                >
                  Record Advance ({advances.filter((a) => !a.settled).length} unsettled)
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Salary &amp; Wage Slips</h3>
            {salaryRecords.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No salary slips generated yet.</p>
            ) : (
              <div className="space-y-2.5">
                {salaryRecords.map((s) => (
                  <div
                    key={String(s.id)}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold">
                        <span className="font-mono">{String(s.slip_number)}</span> · {String(s.employee_name)} ({String(s.period_label)})
                      </div>
                      <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                        Net: {formatINR(s.net_payable as number)} · Present: {String(s.present_days)}d · Status: {String(s.status)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => generateSalarySlipPdf({ slip: s, company })}
                        className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF Slip
                      </button>
                      {canPayroll && s.status !== 'PAID' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/salary/${s.id}/pay`, {
                              method: 'POST',
                              body: JSON.stringify({ paymentMethod: 'Bank Transfer', transactionRef: `SAL-${Date.now()}` }),
                            });
                            await onRefresh();
                          }}
                          className="px-2.5 py-1.5 rounded bg-emerald-700 text-white flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
