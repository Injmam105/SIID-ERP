import React, { useState } from 'react';
import { Clock, Download, MessageSquare, Phone } from 'lucide-react';
import { apiFetch, type AuthUser, type CompanySettings, formatINR } from '../lib/api.ts';
import { generateInvoicePdf, generateQuotationPdf, generateSalarySlipPdf } from '../lib/pdfGenerator.ts';

export function EmployeePortalView({
  user,
  company,
  employeeProfile,
  projects,
  attendance,
  leaves,
  advances,
  salaryRecords,
  onRefresh,
}: {
  user: AuthUser;
  company: CompanySettings;
  employeeProfile: Record<string, unknown> | null;
  projects: Record<string, unknown>[];
  attendance: Record<string, unknown>[];
  leaves: Record<string, unknown>[];
  advances: Record<string, unknown>[];
  salaryRecords: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}) {
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-xl">{user.full_name}</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            {String(employeeProfile?.employee_code || user.user_code)} · {user.role.replace(/_/g, ' ')} · Mobile: {user.mobile}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={async () => {
              setErr(null);
              try {
                await apiFetch('/attendance/check-in', { method: 'POST', body: '{}' });
                setMsg('Checked in successfully with server timestamp.');
                await onRefresh();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
            className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" /> Check In
          </button>
          <button
            type="button"
            onClick={async () => {
              setErr(null);
              try {
                await apiFetch('/attendance/check-out', { method: 'POST', body: '{}' });
                setMsg('Checked out successfully.');
                await onRefresh();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
          >
            Check Out
          </button>
        </div>
      </div>

      {err && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">{err}</div>}
      {msg && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">{msg}</div>}

      {/* CALL TO IT – SIID IT SUPPORT */}
      <div className="bg-white dark:bg-[#0F1D32] border border-[#C69B2D] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-sm text-[#0B1F3A] dark:text-[#E5C158]">
            CALL TO IT – SIID IT SUPPORT
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            IT Head: {company.developed_by} · Support Number: <span className="font-mono font-semibold">{company.it_support_number}</span>
          </p>
        </div>
        <div className="flex gap-2.5">
          <a
            href={`tel:${company.it_support_number}`}
            className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5" /> Call Now
          </a>
          <a
            href={`https://wa.me/91${company.it_support_number}?text=Hello%20SIID%20IT%20Support`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Support
          </a>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">Apply for Leave</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            >
              <option>Casual Leave</option>
              <option>Sick Leave</option>
              <option>Emergency Leave</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            />
          </div>
          <input
            placeholder="Reason for leave"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
          />
          <button
            type="button"
            onClick={async () => {
              await apiFetch('/leaves', {
                method: 'POST',
                body: JSON.stringify({ leaveType, startDate, endDate, reason }),
              });
              setReason('');
              setMsg('Leave request submitted.');
              await onRefresh();
            }}
            className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold"
          >
            Submit Leave Request
          </button>
          <div className="text-xs text-slate-500 pt-2">
            Recent Leaves: {leaves.length === 0 ? 'None' : leaves.map((l) => `${l.leave_type} (${l.status})`).join(', ')}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm">Assigned Projects &amp; Advances</h3>
          <div className="text-xs text-slate-500">
            Assigned Projects: {projects.length === 0 ? 'None assigned yet' : projects.map((p) => String(p.project_name)).join(', ')}
          </div>
          <div className="text-xs text-slate-500">
            Advances Taken: {advances.length === 0 ? 'None' : advances.map((a) => `${formatINR(a.amount as number)} (${a.status})`).join(', ')}
          </div>
          <h4 className="font-semibold text-xs pt-2">My Salary / Wage Slips</h4>
          {salaryRecords.length === 0 ? (
            <p className="text-xs text-slate-500">No salary slips generated yet.</p>
          ) : (
            salaryRecords.map((s) => (
              <div key={String(s.id)} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span>
                  {String(s.slip_number)} · {String(s.period_label)} · {formatINR(s.net_payable as number)}
                </span>
                <button
                  type="button"
                  onClick={() => generateSalarySlipPdf({ slip: s, company })}
                  className="text-[#1D4ED8] inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-3">My Attendance History</h3>
        {attendance.length === 0 ? (
          <p className="text-xs text-slate-500">No attendance logs yet.</p>
        ) : (
          <div className="space-y-1.5 text-xs">
            {attendance.slice(0, 15).map((a) => (
              <div key={String(a.id)} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                <span>{String(a.attendance_date)} · {String(a.attendance_status)}</span>
                <span>
                  In: {a.check_in_at ? String(a.check_in_at).slice(11, 16) : '-'} · Out: {a.check_out_at ? String(a.check_out_at).slice(11, 16) : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientPortalView({
  user,
  company,
  projects,
  quotations,
  invoices,
  payments,
  complaints,
  onRefresh,
}: {
  user: AuthUser;
  company: CompanySettings;
  projects: Record<string, unknown>[];
  quotations: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  complaints: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}) {
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h2 className="font-display font-bold text-xl">Welcome, {user.full_name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          View your projects, approve quotations with material &amp; brand details, download invoices, and track payments.
        </p>
      </div>

      {/* Projects */}
      <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-sm">My Projects</h3>
        {projects.length === 0 ? (
          <p className="text-xs text-slate-500">No active projects assigned yet.</p>
        ) : (
          projects.map((p) => (
            <div key={String(p.id)} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between font-semibold text-sm">
                <span>{String(p.project_name)}</span>
                <span>{String(p.status)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#1D4ED8]" style={{ width: `${Number(p.progress_percent || 0)}%` }} />
              </div>
              <div className="text-slate-500 font-mono tabular-nums">
                Progress: {String(p.progress_percent || 0)}% · Expected Completion: {String(p.expected_completion_date || 'TBD')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quotations */}
      <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-sm">Quotations &amp; Approvals</h3>
        {quotations.length === 0 ? (
          <p className="text-xs text-slate-500">No quotations sent to you yet.</p>
        ) : (
          quotations.map((q) => (
            <div key={String(q.id)} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
                <span>
                  {String(q.quotation_number)} · {String(q.project_name)}
                </span>
                <span className="font-mono">{formatINR(q.grand_total as number)}</span>
              </div>
              <p className="text-slate-500">
                Status: {String(q.status)} · Valid Until: {String(q.valid_until)}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await apiFetch<{
                      quotation: Record<string, unknown>;
                      items: Record<string, unknown>[];
                      materials: Record<string, unknown>[];
                    }>(`/quotations/${q.id}`);
                    await generateQuotationPdf({ ...res, company });
                  }}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                {q.status === 'SENT' && (
                  <>
                    <input
                      placeholder="Approval / revision comment..."
                      value={commentMap[String(q.id)] || ''}
                      onChange={(e) => setCommentMap({ ...commentMap, [String(q.id)]: e.target.value })}
                      className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/quotations/${q.id}/status`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'APPROVED', comments: commentMap[String(q.id)] || '' }),
                        });
                        await onRefresh();
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-700 text-white font-semibold"
                    >
                      Approve Quotation
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/quotations/${q.id}/status`, {
                          method: 'POST',
                          body: JSON.stringify({ status: 'REJECTED', comments: commentMap[String(q.id)] || '' }),
                        });
                        await onRefresh();
                      }}
                      className="px-3 py-1.5 rounded border border-red-300 text-red-600 font-semibold"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoices & Support */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
          <h3 className="font-semibold text-sm">Invoices &amp; Payment History</h3>
          {invoices.length === 0 ? (
            <p className="text-xs text-slate-500">No invoices issued yet.</p>
          ) : (
            invoices.map((inv) => (
              <div key={String(inv.id)} className="flex items-center justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800">
                <span>
                  <strong className="font-mono">{String(inv.invoice_number)}</strong> · Paid {formatINR(inv.amount_paid as number)} /{' '}
                  {formatINR(inv.grand_total as number)}
                </span>
                <button
                  type="button"
                  onClick={() => generateInvoicePdf({ invoice: inv, company })}
                  className="text-[#1D4ED8] hover:underline"
                >
                  PDF
                </button>
              </div>
            ))
          )}
          <div className="text-xs text-slate-500 pt-2">Payments Recorded: {payments.length}</div>
        </div>

        <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
          <h3 className="font-semibold text-sm">Complaint / Support Desk</h3>
          <input
            placeholder="Subject *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
          />
          <textarea
            rows={2}
            placeholder="Describe your request or issue..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
          />
          <button
            type="button"
            onClick={async () => {
              if (!subject.trim() || !description.trim()) return;
              await apiFetch('/complaints', { method: 'POST', body: JSON.stringify({ subject, description }) });
              setSubject('');
              setDescription('');
              await onRefresh();
            }}
            className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
          >
            Submit Support Ticket
          </button>
          <div className="text-xs text-slate-500">
            {complaints.map((c) => `${c.subject} (${c.status})`).join(' · ')}
          </div>
        </div>
      </div>
    </div>
  );
}
