import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Upload } from 'lucide-react';
import { apiFetch, type AuthUser, formatINR, uploadFile } from '../lib/api.ts';

interface Props {
  activeSection: 'projects' | 'interior' | 'construction' | 'inventory';
  user: AuthUser;
  projects: Record<string, unknown>[];
  sites: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  employees: Record<string, unknown>[];
  interiorDesigns: Record<string, unknown>[];
  constructionStages: Record<string, unknown>[];
  inventoryItems: Record<string, unknown>[];
  stockLedger: Record<string, unknown>[];
  vendors: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}

const CONSTRUCTION_STAGES = [
  'Site Preparation',
  'Foundation',
  'Civil Work',
  'Structure',
  'Brickwork',
  'Plastering',
  'Plumbing',
  'Electrical Work',
  'Waterproofing',
  'Flooring',
  'Painting',
  'Finishing',
  'Quality Inspection',
  'Safety Inspection',
  'Project Handover',
];

const INVENTORY_CATEGORIES = [
  'Cement',
  'Sand',
  'Steel',
  'Bricks',
  'Tiles',
  'Marble',
  'Wood',
  'Plywood',
  'Paint',
  'Electrical Items',
  'Plumbing Items',
  'Furniture Hardware',
  'Tools',
  'Construction Equipment',
];

export function ProjectsInventoryModule({
  activeSection,
  user,
  projects,
  sites,
  clients,
  employees,
  interiorDesigns,
  constructionStages,
  inventoryItems,
  stockLedger,
  vendors,
  onRefresh,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [invTab, setInvTab] = useState<'STOCK' | 'LEDGER' | 'VENDORS'>('STOCK');

  const [projForm, setProjForm] = useState({
    projectName: '',
    clientId: String(clients[0]?.id || ''),
    category: 'Interior Design',
    city: '',
    state: '',
    budget: 0,
    siteManagerId: '',
    status: 'ONGOING',
  });

  const [siteForm, setSiteForm] = useState({
    projectId: String(projects[0]?.id || ''),
    siteName: '',
    location: '',
    city: '',
  });

  const [intForm, setIntForm] = useState({
    projectId: String(projects[0]?.id || ''),
    designCategory: 'Residential Interior',
    roomName: 'Living Room',
    title: '',
    materialSpecs: '',
    furnitureLayout: '',
    fileType: '3D_RENDER',
    fileUrl: '',
    revisionNumber: 1,
  });

  const [conForm, setConForm] = useState({
    projectId: String(projects[0]?.id || ''),
    stageName: 'Foundation',
    progressPercent: 20,
    qualityCheck: 'PASSED',
    safetyCheck: 'PASSED',
    reportNotes: '',
    photoUrl: '',
  });

  const [matForm, setMatForm] = useState({
    category: 'Cement',
    materialName: '',
    brand: '',
    productModel: '',
    grade: '',
    unit: 'Bags',
    purchaseRate: 0,
    stockAvailable: 0,
    minStockAlert: 10,
  });

  const [vendorForm, setVendorForm] = useState({
    vendorName: '',
    companyName: '',
    mobile: '',
    gstin: '',
    materialsSupplied: '',
  });

  const canManage = ['OWNER', 'ADMIN'].includes(user.role);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* PROJECTS & MULTIPLE SITES */}
      {activeSection === 'projects' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl">Projects &amp; Multi-City Sites</h2>
            <p className="text-xs text-slate-500">
              Manage multiple infrastructure, construction, and interior design projects across cities.
            </p>
          </div>

          {canManage && (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Create Project</h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <input
                    placeholder="Project Name *"
                    value={projForm.projectName}
                    onChange={(e) => setProjForm({ ...projForm, projectName: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <select
                    value={projForm.clientId}
                    onChange={(e) => setProjForm({ ...projForm, clientId: e.target.value })}
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
                    value={projForm.category}
                    onChange={(e) => setProjForm({ ...projForm, category: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option>Interior Design</option>
                    <option>Construction</option>
                    <option>Infrastructure</option>
                  </select>
                  <input
                    placeholder="City"
                    value={projForm.city}
                    onChange={(e) => setProjForm({ ...projForm, city: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="number"
                    placeholder="Budget (INR)"
                    value={projForm.budget}
                    onChange={(e) => setProjForm({ ...projForm, budget: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <select
                    value={projForm.siteManagerId}
                    onChange={(e) => setProjForm({ ...projForm, siteManagerId: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Assign Site Manager (Optional)</option>
                    {employees.map((e) => (
                      <option key={String(e.id)} value={String(e.id)}>
                        {String(e.full_name)} ({String(e.user_role)})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch('/projects', { method: 'POST', body: JSON.stringify(projForm) });
                      setProjForm({ ...projForm, projectName: '' });
                      await onRefresh();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Save Project
                </button>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Add Project Site</h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <select
                    value={siteForm.projectId}
                    onChange={(e) => setSiteForm({ ...siteForm, projectId: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    <option value="">Select Project *</option>
                    {projects.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>
                        {String(p.project_name)}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Site Name *"
                    value={siteForm.siteName}
                    onChange={(e) => setSiteForm({ ...siteForm, siteName: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="City"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="Site Address / Location"
                    value={siteForm.location}
                    onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch('/sites', { method: 'POST', body: JSON.stringify(siteForm) });
                      setSiteForm({ ...siteForm, siteName: '', location: '' });
                      await onRefresh();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold"
                >
                  Add Site ({sites.length} active)
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Active Projects</h3>
            {projects.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No projects created yet.</p>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <div key={String(p.id)} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">
                        <span className="font-mono text-xs mr-2">{String(p.project_code)}</span>
                        {String(p.project_name)}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono tabular-nums">{formatINR(p.budget as number)}</span>
                        <select
                          value={String(p.status)}
                          onChange={async (e) => {
                            await apiFetch(`/projects/${p.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({ status: e.target.value }),
                            });
                            await onRefresh();
                          }}
                          className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                        >
                          <option value="PLANNING">Planning</option>
                          <option value="ONGOING">Ongoing</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Client: {String(p.client_name || '')} · Category: {String(p.category)} · City: {String(p.city || '-')}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1D4ED8]"
                          style={{ width: `${Math.min(100, Number(p.progress_percent || 0))}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums">{String(p.progress_percent || 0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERIOR DESIGN MODULE */}
      {activeSection === 'interior' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl">Interior Design Studio</h2>
            <p className="text-xs text-slate-500">
              2D floor plans, 3D renders, room-wise layouts, material specs, revisions, and client approvals.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Upload Interior Deliverable</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <select
                value={intForm.projectId}
                onChange={(e) => setIntForm({ ...intForm, projectId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              >
                <option value="">Select Project *</option>
                {projects.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.project_name)}
                  </option>
                ))}
              </select>
              <select
                value={intForm.roomName}
                onChange={(e) => setIntForm({ ...intForm, roomName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              >
                {['Living Room', 'Modular Kitchen', 'Bedroom Design', 'Office Interior', 'Bathroom', 'Wardrobe', 'False Ceiling', 'Lighting', 'Electrical Layout', 'Plumbing Layout'].map(
                  (r) => (
                    <option key={r}>{r}</option>
                  )
                )}
              </select>
              <select
                value={intForm.fileType}
                onChange={(e) => setIntForm({ ...intForm, fileType: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              >
                <option value="2D_PLAN">2D Floor Plan</option>
                <option value="3D_RENDER">3D Render</option>
                <option value="DESIGN_IMAGE">Design Image</option>
                <option value="APPROVAL_DOC">Approval Document</option>
              </select>
              <input
                placeholder="Design Title *"
                value={intForm.title}
                onChange={(e) => setIntForm({ ...intForm, title: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              />
              <input
                placeholder="Material, Flooring & Paint Specs"
                value={intForm.materialSpecs}
                onChange={(e) => setIntForm({ ...intForm, materialSpecs: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              />
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span className="truncate">{intForm.fileUrl ? 'File Attached' : 'Upload Plan / Render'}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const up = await uploadFile(f, 'interior_design', intForm.projectId || 'general', intForm.title);
                    setIntForm({ ...intForm, fileUrl: up.fileUrl });
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await apiFetch('/interior', { method: 'POST', body: JSON.stringify(intForm) });
                  setIntForm({ ...intForm, title: '', fileUrl: '' });
                  await onRefresh();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
            >
              Publish Design Revision
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {interiorDesigns.map((d) => (
              <div key={String(d.id)} className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span>{String(d.title)}</span>
                  <span className="text-xs font-mono text-[#1D4ED8]">Rev {String(d.revision_number)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {String(d.project_name)} · {String(d.room_name)} · {String(d.file_type)} · Client: {String(d.client_approval_status)}
                </p>
                {Boolean(d.file_url) && (
                  <a href={String(d.file_url)} target="_blank" rel="noreferrer" className="text-xs text-[#1D4ED8] hover:underline inline-block">
                    View Uploaded Drawing / Render
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONSTRUCTION PROGRESS */}
      {activeSection === 'construction' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display font-bold text-xl">Construction &amp; Site Progress</h2>
            <p className="text-xs text-slate-500">
              Stage-wise updates from Site Preparation to Handover, quality/safety inspections, and Admin review.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm">Submit Daily Progress Report</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <select
                value={conForm.projectId}
                onChange={(e) => setConForm({ ...conForm, projectId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              >
                <option value="">Select Project *</option>
                {projects.map((p) => (
                  <option key={String(p.id)} value={String(p.id)}>
                    {String(p.project_name)}
                  </option>
                ))}
              </select>
              <select
                value={conForm.stageName}
                onChange={(e) => setConForm({ ...conForm, stageName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              >
                {CONSTRUCTION_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Progress %"
                value={conForm.progressPercent}
                onChange={(e) => setConForm({ ...conForm, progressPercent: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
              />
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>{conForm.photoUrl ? 'Site Photo Ready' : 'Upload Site Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const up = await uploadFile(f, 'site_photo', conForm.projectId || 'general', conForm.stageName);
                    setConForm({ ...conForm, photoUrl: up.fileUrl });
                  }}
                />
              </label>
            </div>
            <textarea
              rows={2}
              placeholder="Work completed today, labour count, and inspection notes..."
              value={conForm.reportNotes}
              onChange={(e) => setConForm({ ...conForm, reportNotes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
            />
            <button
              type="button"
              onClick={async () => {
                await apiFetch('/construction', {
                  method: 'POST',
                  body: JSON.stringify({
                    ...conForm,
                    photoUrls: conForm.photoUrl ? [conForm.photoUrl] : [],
                  }),
                });
                setConForm({ ...conForm, reportNotes: '', photoUrl: '' });
                await onRefresh();
              }}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold"
            >
              Submit Stage Report
            </button>
          </div>

          <div className="space-y-3">
            {constructionStages.map((cs) => (
              <div
                key={String(cs.id)}
                className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-semibold text-sm">
                    {String(cs.project_name)} · {String(cs.stage_name)} ({String(cs.progress_percent)}%)
                  </div>
                  <p className="text-slate-500 mt-1">{String(cs.report_notes || '')}</p>
                  <p className="mt-1 font-mono text-slate-500">Admin Approval: {String(cs.admin_approval)}</p>
                </div>
                {canManage && cs.admin_approval === 'PENDING' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/construction/${cs.id}/approve`, {
                        method: 'POST',
                        body: JSON.stringify({ approval: 'APPROVED' }),
                      });
                      await onRefresh();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve Progress
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVENTORY & VENDORS */}
      {activeSection === 'inventory' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl">Material Inventory &amp; Vendors</h2>
              <p className="text-xs text-slate-500">Stock ledger, low stock alerts, site issue/return, and supplier accounts.</p>
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg text-xs">
              {(['STOCK', 'LEDGER', 'VENDORS'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInvTab(t)}
                  className={`px-3 py-1.5 rounded-md font-medium ${
                    invTab === t ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t === 'STOCK' ? 'Material Stock' : t === 'LEDGER' ? 'Stock Ledger' : 'Vendors & Suppliers'}
                </button>
              ))}
            </div>
          </div>

          {invTab === 'STOCK' && (
            <>
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Add Material to Inventory</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <select
                    value={matForm.category}
                    onChange={(e) => setMatForm({ ...matForm, category: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  >
                    {INVENTORY_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Material Name *"
                    value={matForm.materialName}
                    onChange={(e) => setMatForm({ ...matForm, materialName: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="Brand / Company"
                    value={matForm.brand}
                    onChange={(e) => setMatForm({ ...matForm, brand: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="Unit (Bags/Tons/Sq.Ft)"
                    value={matForm.unit}
                    onChange={(e) => setMatForm({ ...matForm, unit: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="number"
                    placeholder="Opening Qty"
                    value={matForm.stockAvailable}
                    onChange={(e) => setMatForm({ ...matForm, stockAvailable: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Purchase Rate"
                    value={matForm.purchaseRate}
                    onChange={(e) => setMatForm({ ...matForm, purchaseRate: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Min Stock Alert"
                    value={matForm.minStockAlert}
                    onChange={(e) => setMatForm({ ...matForm, minStockAlert: Number(e.target.value) })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/inventory', { method: 'POST', body: JSON.stringify(matForm) });
                      setMatForm({ ...matForm, materialName: '', brand: '' });
                      await onRefresh();
                    }}
                    className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white font-semibold"
                  >
                    Add Material
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                {inventoryItems.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No materials in inventory yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {inventoryItems.map((it) => {
                      const low = Number(it.stock_available) <= Number(it.min_stock_alert);
                      return (
                        <div
                          key={String(it.id)}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              <span>
                                {String(it.material_name)} ({String(it.brand || 'Generic')})
                              </span>
                              {low && (
                                <span className="text-amber-600 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 font-mono tabular-nums">
                              {String(it.category)} · Available: {String(it.stock_available)} {String(it.unit)} · Issued:{' '}
                              {String(it.stock_issued)} · Rate: {formatINR(it.purchase_rate as number)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/inventory/${it.id}/transaction`, {
                                  method: 'POST',
                                  body: JSON.stringify({ txnType: 'PURCHASE_IN', quantity: 10, remarks: 'Restock +10' }),
                                });
                                await onRefresh();
                              }}
                              className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700"
                            >
                              +10 Purchase
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await apiFetch(`/inventory/${it.id}/transaction`, {
                                    method: 'POST',
                                    body: JSON.stringify({ txnType: 'ISSUE_OUT', quantity: 5, remarks: 'Issued to site' }),
                                  });
                                  await onRefresh();
                                } catch (err) {
                                  setError((err as Error).message);
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-[#1D4ED8] text-white"
                            >
                              -5 Issue
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {invTab === 'LEDGER' && (
            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              {stockLedger.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No stock ledger entries yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="py-2">Date</th>
                      <th className="py-2">Material</th>
                      <th className="py-2">Type</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLedger.map((l) => (
                      <tr key={String(l.id)} className="border-b border-slate-100 dark:border-slate-800/70">
                        <td className="py-2 font-mono">{String(l.created_at).slice(0, 10)}</td>
                        <td className="py-2">{String(l.material_name)}</td>
                        <td className="py-2 font-semibold">{String(l.txn_type)}</td>
                        <td className="py-2 text-right font-mono">{String(l.quantity)} {String(l.unit)}</td>
                        <td className="py-2 text-slate-500">{String(l.remarks || '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {invTab === 'VENDORS' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-sm">Add Vendor / Supplier</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <input
                    placeholder="Vendor Name *"
                    value={vendorForm.vendorName}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendorName: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="Company Name"
                    value={vendorForm.companyName}
                    onChange={(e) => setVendorForm({ ...vendorForm, companyName: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="Mobile *"
                    value={vendorForm.mobile}
                    onChange={(e) => setVendorForm({ ...vendorForm, mobile: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    placeholder="GSTIN"
                    value={vendorForm.gstin}
                    onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/vendors', { method: 'POST', body: JSON.stringify(vendorForm) });
                      setVendorForm({ vendorName: '', companyName: '', mobile: '', gstin: '', materialsSupplied: '' });
                      await onRefresh();
                    }}
                    className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white font-semibold"
                  >
                    Save Vendor
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                {vendors.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No vendors added yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {vendors.map((v) => (
                      <div key={String(v.id)} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-between text-xs">
                        <div>
                          <div className="font-semibold">{String(v.vendor_name)} · {String(v.company_name || '')}</div>
                          <div className="text-slate-500 font-mono">Mobile: {String(v.mobile)} · GSTIN: {String(v.gstin || '-')}</div>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <div>Bills: {formatINR(v.total_bills as number)}</div>
                          <div>Outstanding: {formatINR(Number(v.total_bills || 0) - Number(v.total_paid || 0))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
