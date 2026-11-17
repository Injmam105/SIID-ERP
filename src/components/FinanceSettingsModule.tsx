import React, { useState } from 'react';
import { Bell, Database, Download, FileText, Plus, ShieldCheck, Upload } from 'lucide-react';
import { apiFetch, type AuthUser, type CompanySettings, formatINR, uploadFile } from '../lib/api.ts';
import { generateInvoicePdf } from '../lib/pdfGenerator.ts';

interface Props {
  activeSection: 'finance' | 'notifications' | 'settings';
  user: AuthUser;
  company: CompanySettings;
  clients: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  financeSummary: Record<string, unknown>;
  notifications: Record<string, unknown>[];
  backups: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

export function FinanceSettingsModule({
  activeSection,
  user,
  company,
  clients,
  projects,
  invoices,
  payments,
  expenses,
  financeSummary,
  notifications,
  backups,
  onRefresh,
}: Props) {
  const [finTab, setFinTab] = useState<'INVOICES' | 'PAYMENTS' | 'EXPENSES' | 'PNL'>('INVOICES');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [invForm, setInvForm] = useState({
    clientId: String(clients[0]?.id || ''),
    projectId: String(projects[0]?.id || ''),
    description: 'Project Milestone Billing',
    quantity: 1,
    unit: 'Lot',
    rate: 0,
    gstRate: Number(company.default_gst_rate ?? 18),
  });

  const [payForm, setPayForm] = useState({
    invoiceId: '',
    amount: 0,
    paymentMethod: 'NEFT / RTGS',
    transactionRef: '',
  });

  const [expForm, setExpForm] = useState({
    category: 'Materials',
    projectId: '',
    description: '',
    amount: 0,
    paymentMethod: 'Bank Transfer',
  });

  const [compForm, setCompForm] = useState({
    companyName: company.company_name,
    ownerName: company.owner_name,
    ownerMobile: company.owner_mobile,
    officialEmail: company.official_email,
    website: company.website,
    gstin: company.gstin,
    address: company.address || '',
    itSupportNumber: company.it_support_number,
    defaultGstRate: company.default_gst_rate,
    logoUrl: company.logo_url || '',
    signatureUrl: company.signature_url || '',
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* FINANCE & INVOICES */}
      {activeSection === 'finance' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl">Invoices, Payments &amp; Financial Control</h2>
              <p className="text-xs text-slate-500">Tax invoices, verified payment receipts, expenses, and project-wise P&amp;L.</p>
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg text-xs">
              {(['INVOICES', 'PAYMENTS', 'EXPENSES', 'PNL'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFinTab(t)}
                  className={`px-3 py-1.5 rounded-md font-medium ${
                    finTab === t ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t === 'INVOICES' ? 'Invoices' : t === 'PAYMENTS' ? 'Payments' : t === 'EXPENSES' ? 'Expenses' : 'Profit & Loss'}
                </button>
              ))}
            </div>
          </div>

          {finTab === 'INVOICES' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Create Branded Tax Invoice</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                  <select
                    value={invForm.clientId}
                    onChange={(e) => setInvForm({ ...invForm, clientId: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Select Client *</option>
                    {clients.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {String(c.client_name)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={invForm.projectId}
                    onChange={(e) => setInvForm({ ...invForm, projectId: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Select Project</option>
                    {projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.project_name)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Billing Description"
                    value={invForm.description}
                    onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="number"
                    placeholder="Amount (INR)"
                    value={invForm.rate}
                    onChange={(e) => setInvForm({ ...invForm, rate: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiFetch('/invoices', {
                          method: 'POST',
                          body: JSON.stringify({
                            clientId: invForm.clientId,
                            projectId: invForm.projectId || null,
                            gstRate: invForm.gstRate,
                            items: [
                              {
                                description: invForm.description,
                                quantity: invForm.quantity,
                                unit: invForm.unit,
                                rate: invForm.rate,
                              },
                            ],
                          }),
                        });
                        await onRefresh();
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white font-semibold flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Invoice
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No invoices issued yet.</p>
                ) : (
                  invoices.map((inv) => (
                    <div
                      key={String(inv.id)}
                      className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold">
                          <span className="font-mono">{String(inv.invoice_number)}</span> · {String(inv.client_name)}
                        </div>
                        <div className="text-slate-500 font-mono tabular-nums mt-0.5">
                          Total: {formatINR(inv.grand_total as number)} · Paid: {formatINR(inv.amount_paid as number)} · Due:{' '}
                          {formatINR(inv.outstanding_balance as number)} · {String(inv.status)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => generateInvoicePdf({ invoice: inv, company })}
                          className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                        {inv.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayForm({
                                ...payForm,
                                invoiceId: String(inv.id),
                                amount: Number(inv.outstanding_balance || 0),
                              });
                              setFinTab('PAYMENTS');
                            }}
                            className="px-3 py-1.5 rounded bg-[#1D4ED8] text-white font-semibold"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {finTab === 'PAYMENTS' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Record Verified Payment Receipt</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                  <select
                    value={payForm.invoiceId}
                    onChange={(e) => setPayForm({ ...payForm, invoiceId: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Select Invoice</option>
                    {invoices.map((i) => (
                      <option key={String(i.id)} value={String(i.id)}>
                        {String(i.invoice_number)} (Due {formatINR(i.outstanding_balance as number)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Amount (INR)"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option>NEFT / RTGS</option>
                    <option>UPI</option>
                    <option>Cheque</option>
                    <option>Cash</option>
                  </select>
                  <input
                    placeholder="Transaction Ref / UTR *"
                    value={payForm.transactionRef}
                    onChange={(e) => setPayForm({ ...payForm, transactionRef: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const inv = invoices.find((i) => i.id === payForm.invoiceId);
                        await apiFetch('/payments', {
                          method: 'POST',
                          body: JSON.stringify({
                            paymentDirection: 'INCOME',
                            clientId: inv?.client_id || null,
                            projectId: inv?.project_id || null,
                            invoiceId: payForm.invoiceId || null,
                            amount: payForm.amount,
                            paymentMethod: payForm.paymentMethod,
                            transactionRef: payForm.transactionRef,
                          }),
                        });
                        setPayForm({ ...payForm, transactionRef: '', amount: 0 });
                        await onRefresh();
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-semibold"
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                {payments.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No payment receipts recorded yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                        <th className="py-2">Receipt No.</th>
                        <th className="py-2">Date</th>
                        <th className="py-2">Client / Invoice</th>
                        <th className="py-2">Method & Ref</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={String(p.id)} className="border-b border-slate-100 dark:border-slate-800/70">
                          <td className="py-2 font-mono font-semibold">{String(p.receipt_number)}</td>
                          <td className="py-2 font-mono">{String(p.payment_date)}</td>
                          <td className="py-2">{String(p.client_name || '-')} · {String(p.invoice_number || '')}</td>
                          <td className="py-2 font-mono">{String(p.payment_method)} · {String(p.transaction_ref)}</td>
                          <td className="py-2 text-right font-mono font-semibold">{formatINR(p.amount as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {finTab === 'EXPENSES' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Record Expense</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                  <select
                    value={expForm.category}
                    onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    {['Materials', 'Transportation', 'Daily Wages', 'Salary', 'Equipment', 'Site Expenses', 'Office Expenses'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={expForm.projectId}
                    onChange={(e) => setExpForm({ ...expForm, projectId: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">General Office Expense</option>
                    {projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.project_name)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Description *"
                    value={expForm.description}
                    onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="number"
                    placeholder="Amount (INR)"
                    value={expForm.amount}
                    onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/expenses', { method: 'POST', body: JSON.stringify(expForm) });
                      setExpForm({ ...expForm, description: '', amount: 0 });
                      await onRefresh();
                    }}
                    className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white font-semibold"
                  >
                    Save Expense
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                {expenses.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No expenses recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((ex) => (
                      <div key={String(ex.id)} className="flex justify-between text-xs py-2 border-b border-slate-100 dark:border-slate-800">
                        <span>
                          <strong>{String(ex.category)}</strong> — {String(ex.description)} ({String(ex.expense_date)})
                        </span>
                        <span className="font-mono font-semibold">{formatINR(ex.amount as number)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {finTab === 'PNL' && (
            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Income', val: formatINR(financeSummary.totalIncome as number) },
                { label: 'Total Expenses', val: formatINR(financeSummary.totalExpenses as number) },
                { label: 'Net Profit / Loss', val: formatINR(financeSummary.netProfit as number) },
                { label: 'Outstanding Receivables', val: formatINR(financeSummary.totalOutstanding as number) },
              ].map((m) => (
                <div key={m.label} className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{m.label}</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums">{m.val}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#1D4ED8]" /> Cloud Notifications
            </h2>
            <button
              type="button"
              onClick={async () => {
                await apiFetch('/notifications/read-all', { method: 'POST', body: '{}' });
                await onRefresh();
              }}
              className="text-xs text-[#1D4ED8] hover:underline"
            >
              Mark All Read
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No notifications in your feed.</p>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div key={String(n.id)} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold">{String(n.title)}</div>
                    <div className="text-slate-500 mt-0.5">{String(n.message)}</div>
                  </div>
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/notifications/${n.id}/read`, { method: 'POST', body: '{}' });
                        await onRefresh();
                      }}
                      className="text-[#1D4ED8] shrink-0"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMPANY SETTINGS, BACKUPS & FLUTTER/MYSQL SOURCE */}
      {activeSection === 'settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#C69B2D]" /> Authorized Company Settings &amp; Branding
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-500">Company Name</label>
                <input
                  value={compForm.companyName}
                  onChange={(e) => setCompForm({ ...compForm, companyName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <div>
                <label className="text-slate-500">Company GSTIN</label>
                <input
                  value={compForm.gstin}
                  onChange={(e) => setCompForm({ ...compForm, gstin: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                />
              </div>
              <div>
                <label className="text-slate-500">Owner / Director Mobile</label>
                <input
                  value={compForm.ownerMobile}
                  onChange={(e) => setCompForm({ ...compForm, ownerMobile: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                />
              </div>
              <div>
                <label className="text-slate-500">Official Email</label>
                <input
                  value={compForm.officialEmail}
                  onChange={(e) => setCompForm({ ...compForm, officialEmail: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <div>
                <label className="text-slate-500">Website</label>
                <input
                  value={compForm.website}
                  onChange={(e) => setCompForm({ ...compForm, website: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <div>
                <label className="text-slate-500">Default GST Rate (%)</label>
                <input
                  type="number"
                  value={compForm.defaultGstRate}
                  onChange={(e) => setCompForm({ ...compForm, defaultGstRate: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <label className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Upload Company Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const up = await uploadFile(f, 'company_logo', 'SIID_MAIN', 'Company Logo');
                    setCompForm({ ...compForm, logoUrl: up.fileUrl });
                    setSuccess('Logo uploaded. Click Save Settings to apply across dashboards and PDFs.');
                  }}
                />
              </label>
              <label className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Upload Authorized Signature</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const up = await uploadFile(f, 'company_signature', 'SIID_MAIN', 'Authorized Signature');
                    setCompForm({ ...compForm, signatureUrl: up.fileUrl });
                    setSuccess('Signature uploaded. Click Save Settings to apply.');
                  }}
                />
              </label>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch('/company', { method: 'PUT', body: JSON.stringify(compForm) });
                  setSuccess('Company settings saved to cloud database.');
                  await onRefresh();
                }}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
              >
                Save Company Settings
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-[#1D4ED8]" /> Cloud Database Backup &amp; Export
              </h3>
              <p className="text-xs text-slate-500">
                Export complete relational backup snapshot ({backups.length} logged exports).
              </p>
              <button
                type="button"
                onClick={async () => {
                  const data = await apiFetch<string>('/backups/export', { method: 'POST', body: '{}' });
                  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `siid_erp_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  await onRefresh();
                }}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export Full Database Backup (.json)
              </button>
            </div>

            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C69B2D]" /> Flutter Mobile App &amp; MySQL Backend Bundle
              </h3>
              <p className="text-xs text-slate-500">
                Download the complete Flutter Dart project (`flutter_app/`), MySQL 8.0 DDL schema (`mysql/siid_erp_mysql.sql`),
                and Node.js REST API (`server.ts`) as a single archive.
              </p>
              <a
                href="/api/export-flutter-bundle"
                className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download Flutter + MySQL Source (.zip)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
