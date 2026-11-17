import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Eye,
  FilePlus2,
  FolderPlus,
  GitBranch,
  Layers,
  Plus,
  Search,
  Send,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiFetch,
  type CompanySettings,
  CONSTRUCTION_BRANDS,
  formatINR,
  uploadFile,
} from '../lib/api.ts';
import { generateQuotationPdf } from '../lib/pdfGenerator.ts';

interface WorkItem {
  workCategory: string;
  workDescription: string;
  materialOrService: string;
  quantity: number;
  unit: string;
  rate: number;
}

interface MaterialSpec {
  workCategory: string;
  materialName: string;
  materialDescription: string;
  brandName: string;
  productModel: string;
  gradeQuality: string;
  sizeThickness: string;
  technicalSpecs: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  providedBy: 'SIID' | 'CLIENT';
  imageUrl: string;
  remarks: string;
}

interface Props {
  quotations: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  company: CompanySettings;
  onRefresh: () => Promise<void>;
}

const SUBMENUS = [
  { key: 'DASHBOARD', label: 'Quotation Dashboard' },
  { key: 'CREATE', label: 'Create New Quotation' },
  { key: 'ALL', label: 'All Quotations' },
  { key: 'DRAFT', label: 'Draft Quotations' },
  { key: 'SENT', label: 'Sent Quotations' },
  { key: 'APPROVED', label: 'Approved Quotations' },
  { key: 'REJECTED', label: 'Rejected Quotations' },
  { key: 'EXPIRED', label: 'Expired Quotations' },
] as const;

export function QuotationModule({ quotations, clients, company, onRefresh }: Props) {
  const [submenu, setSubmenu] = useState<string>('DASHBOARD');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    quotation: Record<string, unknown>;
    items: Record<string, unknown>[];
    materials: Record<string, unknown>[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Builder state
  const [clientId, setClientId] = useState<string>(String(clients[0]?.id || ''));
  const [showInlineClient, setShowInlineClient] = useState(false);
  const [newCliName, setNewCliName] = useState('');
  const [newCliMobile, setNewCliMobile] = useState('');
  const [newCliCity, setNewCliCity] = useState('');

  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );
  const [projectName, setProjectName] = useState('');
  const [projectCategory, setProjectCategory] = useState('Interior Design');
  const [projectLocation, setProjectLocation] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('90 Days');
  const [expectedStartDate, setExpectedStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');

  const [items, setItems] = useState<WorkItem[]>([
    { workCategory: 'Interior Work', workDescription: '', materialOrService: '', quantity: 1, unit: 'Sq.Ft', rate: 0 },
  ]);
  const [materials, setMaterials] = useState<MaterialSpec[]>([]);
  const [includeMaterialInItems, setIncludeMaterialInItems] = useState(false);

  const [labourSpecs, setLabourSpecs] = useState('');
  const [designSpecs, setDesignSpecs] = useState('');
  const [workExecutionDetails, setWorkExecutionDetails] = useState('');
  const [includedServices, setIncludedServices] = useState('');
  const [excludedServices, setExcludedServices] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [labourCharges, setLabourCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [transportationCharges, setTransportationCharges] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [gstRate, setGstRate] = useState(Number(company.default_gst_rate ?? 18));
  const [advanceAmount, setAdvanceAmount] = useState(0);

  const [paymentTerms, setPaymentTerms] = useState({
    advancePct: '30%',
    firstInstallment: '30% on Material Procurement',
    milestonePayment: '25% on Civil/Woodwork Completion',
    finalPayment: '15% on Project Handover',
    paymentMethod: 'NEFT / RTGS / UPI',
  });

  const [termsConditions, setTermsConditions] = useState({
    validity: 'This quotation is valid for 15 days from the date of issue.',
    material: 'Materials will be procured strictly as per approved Brand & Model table.',
    workStarting: 'Work starts within 7 days of advance clearance.',
    delays: 'Delays due to client approvals or force majeure extend completion timeline.',
    warranty: '12 months workmanship warranty from handover date.',
  });

  function resetBuilder() {
    setEditingId(null);
    setClientId(String(clients[0]?.id || ''));
    setProjectName('');
    setProjectLocation('');
    setProjectDescription('');
    setScopeOfWork('');
    setItems([{ workCategory: 'Interior Work', workDescription: '', materialOrService: '', quantity: 1, unit: 'Sq.Ft', rate: 0 }]);
    setMaterials([]);
    setIncludeMaterialInItems(false);
    setLabourCharges(0);
    setDiscountAmount(0);
    setTransportationCharges(0);
    setAdditionalCharges(0);
    setGstRate(Number(company.default_gst_rate ?? 18));
    setAdvanceAmount(0);
    setError(null);
  }

  async function loadQuotationForEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{
        quotation: Record<string, unknown>;
        items: Record<string, unknown>[];
        materials: Record<string, unknown>[];
      }>(`/quotations/${id}`);
      const q = res.quotation;
      setEditingId(id);
      setClientId(String(q.client_id || ''));
      setQuotationDate(String(q.quotation_date || ''));
      setValidUntil(String(q.valid_until || ''));
      setProjectName(String(q.project_name || ''));
      setProjectCategory(String(q.project_category || 'Interior Design'));
      setProjectLocation(String(q.project_location || ''));
      setProjectDescription(String(q.project_description || ''));
      setScopeOfWork(String(q.scope_of_work || ''));
      setEstimatedDuration(String(q.estimated_duration || ''));
      setExpectedStartDate(String(q.expected_start_date || ''));
      setExpectedCompletionDate(String(q.expected_completion_date || ''));
      setIncludeMaterialInItems(Boolean(q.include_material_in_items));
      setLabourSpecs(String(q.labour_specs || ''));
      setDesignSpecs(String(q.design_specs || ''));
      setWorkExecutionDetails(String(q.work_execution_details || ''));
      setIncludedServices(String(q.included_services || ''));
      setExcludedServices(String(q.excluded_services || ''));
      setSpecialInstructions(String(q.special_instructions || ''));
      setLabourCharges(Number(q.labour_charges || 0));
      setDiscountAmount(Number(q.discount_amount || 0));
      setTransportationCharges(Number(q.transportation_charges || 0));
      setAdditionalCharges(Number(q.additional_charges || 0));
      setGstRate(Number(q.gst_rate ?? 18));
      setAdvanceAmount(Number(q.advance_amount || 0));

      setItems(
        res.items.map((it) => ({
          workCategory: String(it.work_category || ''),
          workDescription: String(it.work_description || ''),
          materialOrService: String(it.material_or_service || ''),
          quantity: Number(it.quantity || 0),
          unit: String(it.unit || 'Sq.Ft'),
          rate: Number(it.rate || 0),
        }))
      );
      setMaterials(
        res.materials.map((m) => ({
          workCategory: String(m.work_category || ''),
          materialName: String(m.material_name || ''),
          materialDescription: String(m.material_description || ''),
          brandName: String(m.brand_name || ''),
          productModel: String(m.product_model || ''),
          gradeQuality: String(m.grade_quality || ''),
          sizeThickness: String(m.size_thickness || ''),
          technicalSpecs: String(m.technical_specs || ''),
          quantity: Number(m.quantity || 0),
          unit: String(m.unit || 'Bags'),
          ratePerUnit: Number(m.rate_per_unit || 0),
          providedBy: (m.provided_by === 'CLIENT' ? 'CLIENT' : 'SIID') as 'SIID' | 'CLIENT',
          imageUrl: String(m.image_url || ''),
          remarks: String(m.remarks || ''),
        }))
      );
      setSubmenu('CREATE');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleInlineCreateClient() {
    if (!newCliName.trim() || !newCliMobile.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ id: string }>('/clients', {
        method: 'POST',
        body: JSON.stringify({ clientName: newCliName, mobile: newCliMobile, city: newCliCity }),
      });
      await onRefresh();
      setClientId(res.id);
      setShowInlineClient(false);
      setNewCliName('');
      setNewCliMobile('');
      setNewCliCity('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveQuotation(status: 'DRAFT' | 'SENT') {
    if (!clientId || !projectName.trim()) {
      setError('Select a Client and enter Project Name before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        clientId,
        quotationDate,
        validUntil,
        projectName,
        projectCategory,
        projectLocation,
        projectDescription,
        scopeOfWork,
        estimatedDuration,
        expectedStartDate,
        expectedCompletionDate,
        includeMaterialInItems,
        labourSpecs,
        designSpecs,
        workExecutionDetails,
        includedServices,
        excludedServices,
        specialInstructions,
        labourCharges,
        discountAmount,
        transportationCharges,
        additionalCharges,
        gstRate,
        advanceAmount,
        paymentTerms,
        termsConditions,
        status,
        items: items.filter((i) => i.workDescription.trim() || i.rate > 0),
        materials: materials.filter((m) => m.materialName.trim()),
      };
      if (editingId) {
        await apiFetch(`/quotations/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/quotations', { method: 'POST', body: JSON.stringify(payload) });
      }
      await onRefresh();
      resetBuilder();
      setSubmenu('ALL');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf(id: string) {
    const res = await apiFetch<{
      quotation: Record<string, unknown>;
      items: Record<string, unknown>[];
      materials: Record<string, unknown>[];
    }>(`/quotations/${id}`);
    await generateQuotationPdf({
      quotation: res.quotation,
      items: res.items,
      materials: res.materials,
      company,
    });
  }

  async function handlePreview(id: string) {
    const res = await apiFetch<{
      quotation: Record<string, unknown>;
      items: Record<string, unknown>[];
      materials: Record<string, unknown>[];
    }>(`/quotations/${id}`);
    setPreviewData(res);
  }

  function handleWhatsApp(q: Record<string, unknown>) {
    const mob = String(q.client_mobile || '').replace(/\D/g, '');
    const text = encodeURIComponent(
      `Sirahi Infrastructure & Interior Design\nQuotation: ${q.quotation_number}\nProject: ${q.project_name}\nTotal: ${formatINR(q.grand_total as number)}\nValid Until: ${q.valid_until}`
    );
    window.open(`https://wa.me/91${mob}?text=${text}`, '_blank');
  }

  // Live Financial Math
  const subtotalItems = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.rate || 0), 0);
  const siidMaterialsSum = materials
    .filter((m) => m.providedBy === 'SIID')
    .reduce((s, m) => s + Number(m.quantity || 0) * Number(m.ratePerUnit || 0), 0);
  const materialCharges = includeMaterialInItems ? 0 : siidMaterialsSum;
  const taxableBase = Math.max(
    0,
    subtotalItems + materialCharges + labourCharges + transportationCharges + additionalCharges - discountAmount
  );
  const gstAmount = (taxableBase * gstRate) / 100;
  const grandTotal = taxableBase + gstAmount;
  const remainingBalance = Math.max(0, grandTotal - advanceAmount);

  const counts = {
    total: quotations.length,
    draft: quotations.filter((q) => q.status === 'DRAFT').length,
    sent: quotations.filter((q) => q.status === 'SENT').length,
    approved: quotations.filter((q) => q.status === 'APPROVED').length,
    rejected: quotations.filter((q) => q.status === 'REJECTED').length,
    expired: quotations.filter((q) => q.status === 'EXPIRED').length,
    totalVal: quotations.reduce((s, q) => s + Number(q.grand_total || 0), 0),
    approvedVal: quotations
      .filter((q) => q.status === 'APPROVED')
      .reduce((s, q) => s + Number(q.grand_total || 0), 0),
  };

  const filteredList = quotations.filter((q) => {
    if (!['DASHBOARD', 'CREATE', 'ALL'].includes(submenu) && q.status !== submenu) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return `${q.quotation_number} ${q.project_name} ${q.client_name}`.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Submenu Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="font-display font-bold text-xl">Quotation Management</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Itemized work schedules, Material & Brand specifications, revisions, and branded PDF generation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg">
          {SUBMENUS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                if (m.key === 'CREATE' && submenu !== 'CREATE') resetBuilder();
                setSubmenu(m.key);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                submenu === m.key
                  ? 'bg-white dark:bg-[#0B1F3A] text-[#0B1F3A] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* QUOTATION DASHBOARD */}
      {submenu === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Quotations', val: counts.total, sub: `${counts.draft} drafts · ${counts.sent} sent` },
              { label: 'Approved / Rejected', val: `${counts.approved} / ${counts.rejected}`, sub: `${counts.expired} expired` },
              { label: 'Total Quotation Value', val: formatINR(counts.totalVal), sub: 'Cumulative pipeline' },
              { label: 'Approved Business Value', val: formatINR(counts.approvedVal), sub: 'Confirmed client orders' },
            ].map((k) => (
              <div
                key={k.label}
                className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-4"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
                <p className="mt-1.5 text-xl font-bold font-mono tabular-nums">{k.val}</p>
                <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-semibold text-base">Recent Quotations</h3>
              <button
                type="button"
                onClick={() => {
                  resetBuilder();
                  setSubmenu('CREATE');
                }}
                className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-2"
              >
                <FilePlus2 className="w-4 h-4" />
                Create New Quotation
              </button>
            </div>
            {quotations.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No quotations created yet. Click &ldquo;Create New Quotation&rdquo; to generate your first SIID quotation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500">
                      <th className="py-2.5 pr-4">Quotation No.</th>
                      <th className="py-2.5 pr-4">Client & Project</th>
                      <th className="py-2.5 pr-4">Date / Valid</th>
                      <th className="py-2.5 pr-4 text-right">Grand Total</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.slice(0, 8).map((q) => (
                      <tr key={String(q.id)} className="border-b border-slate-100 dark:border-slate-800/70">
                        <td className="py-3 pr-4 font-mono text-xs font-semibold">{String(q.quotation_number)}</td>
                        <td className="py-3 pr-4">
                          <div className="font-medium">{String(q.project_name)}</div>
                          <div className="text-xs text-slate-500">{String(q.client_name || '')}</div>
                        </td>
                        <td className="py-3 pr-4 text-xs font-mono tabular-nums text-slate-500">
                          {String(q.quotation_date)} · {String(q.valid_until)}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold">
                          {formatINR(q.grand_total as number)}
                        </td>
                        <td className="py-3 pr-4 text-xs font-semibold">{String(q.status)}</td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePreview(String(q.id))}
                              className="text-xs text-[#1D4ED8] hover:underline"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(String(q.id))}
                              className="text-xs text-[#0B1F3A] dark:text-[#E5C158] hover:underline"
                            >
                              PDF
                            </button>
                          </div>
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

      {/* QUOTATION LIST VIEWS */}
      {!['DASHBOARD', 'CREATE'].includes(submenu) && (
        <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quotation number, client, or project..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                resetBuilder();
                setSubmenu('CREATE');
              }}
              className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Quotation
            </button>
          </div>

          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No quotations found in this view.</div>
          ) : (
            <div className="space-y-3">
              {filteredList.map((q) => (
                <div
                  key={String(q.id)}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="font-mono">{String(q.quotation_number)}</span>
                      <span className="text-slate-400">·</span>
                      <span>{String(q.project_name)}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs font-mono text-[#1D4ED8]">Rev {String(q.revision_no || 1)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-2 tabular-nums">
                      <span>Client: {String(q.client_name || '')}</span>
                      <span>·</span>
                      <span>Status: {String(q.status)}</span>
                      <span>·</span>
                      <span>Valid: {String(q.valid_until)}</span>
                      <span>·</span>
                      <span className="font-semibold text-[#0B1F3A] dark:text-white">
                        {formatINR(q.grand_total as number)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview(String(q.id))}
                      className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(String(q.id))}
                      className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWhatsApp(q)}
                      className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1"
                    >
                      <Share2 className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                    {q.status !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => loadQuotationForEdit(String(q.id))}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    )}
                    {q.status === 'DRAFT' && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/quotations/${q.id}/status`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'SENT' }),
                            });
                            await onRefresh();
                          }}
                          className="px-2.5 py-1.5 rounded-md bg-[#1D4ED8] text-white text-xs flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" /> Mark Sent
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/quotations/${q.id}`, { method: 'DELETE' });
                            await onRefresh();
                          }}
                          className="px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/quotations/${q.id}/revision`, { method: 'POST', body: '{}' });
                        await onRefresh();
                      }}
                      className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1"
                    >
                      <GitBranch className="w-3.5 h-3.5" /> New Revision
                    </button>
                    {q.status === 'APPROVED' && !q.converted_project_id && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/quotations/${q.id}/convert-to-project`, { method: 'POST', body: '{}' });
                          await onRefresh();
                        }}
                        className="px-2.5 py-1.5 rounded-md bg-emerald-700 text-white text-xs flex items-center gap-1"
                      >
                        <FolderPlus className="w-3.5 h-3.5" /> Convert to Project
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT QUOTATION BUILDER */}
      {submenu === 'CREATE' && (
        <div className="space-y-6">
          {/* Official SIID Company Header Preview */}
          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={company.logo_url || '/src/assets/images/siid_company_logo_1794819635021.jpg'}
                alt="SIID Logo"
                referrerPolicy="no-referrer"
                className="w-14 h-14 object-contain rounded-lg border border-slate-200 bg-white p-1"
              />
              <div>
                <h3 className="font-display font-bold text-base">{company.company_name}</h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  GSTIN: {company.gstin} · Mobile: {company.owner_mobile} · {company.website} · {company.official_email}
                </p>
              </div>
            </div>
            <div className="text-right text-xs font-mono tabular-nums">
              <div>{editingId ? 'Editing Quotation' : 'Auto-Number: SIID/QTN/YYYY/XXXX'}</div>
              <div className="text-slate-500">Date: {quotationDate} · Valid: {validUntil}</div>
            </div>
          </div>

          {/* Client & Project Info */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-semibold text-sm">Client Information</h4>
                <button
                  type="button"
                  onClick={() => setShowInlineClient(!showInlineClient)}
                  className="text-xs text-[#1D4ED8] hover:underline"
                >
                  {showInlineClient ? 'Select Existing Client' : '+ Quick Add Client'}
                </button>
              </div>
              {showInlineClient ? (
                <div className="space-y-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="Client Name *"
                    value={newCliName}
                    onChange={(e) => setNewCliName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      placeholder="10-Digit Mobile *"
                      value={newCliMobile}
                      onChange={(e) => setNewCliMobile(e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={newCliCity}
                      onChange={(e) => setNewCliCity(e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleInlineCreateClient}
                    className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold"
                  >
                    Save Client
                  </button>
                </div>
              ) : (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                >
                  <option value="">-- Select Client --</option>
                  {clients.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.client_name)} ({String(c.mobile)}) {c.city ? `· ${c.city}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Quotation Date</label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Valid Until Date</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-display font-semibold text-sm">Project Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Project Name *"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <select
                  value={projectCategory}
                  onChange={(e) => setProjectCategory(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                >
                  <option>Interior Design</option>
                  <option>Residential Interior</option>
                  <option>Commercial Interior</option>
                  <option>Construction</option>
                  <option>Infrastructure</option>
                  <option>Turnkey Civil & Interior</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Project Location / Site Address"
                  value={projectLocation}
                  onChange={(e) => setProjectLocation(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  type="text"
                  placeholder="Estimated Duration (e.g. 90 Days)"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Scope of Work & Project Description"
                value={scopeOfWork}
                onChange={(e) => setScopeOfWork(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
              />
            </div>
          </div>

          {/* Itemized Quotation Table */}
          <div className="bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold text-base">Itemized Quotation Table</h4>
              <button
                type="button"
                onClick={() =>
                  setItems([
                    ...items,
                    { workCategory: 'Civil Work', workDescription: '', materialOrService: '', quantity: 1, unit: 'Sq.Ft', rate: 0 },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Work Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Work Category</th>
                    <th className="py-2 pr-2">Work Description</th>
                    <th className="py-2 pr-2">Material / Service</th>
                    <th className="py-2 pr-2 w-20">Qty</th>
                    <th className="py-2 pr-2 w-24">Unit</th>
                    <th className="py-2 pr-2 w-28">Rate (INR)</th>
                    <th className="py-2 pr-2 text-right">Amount</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="py-2 pr-2 font-mono">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={it.workCategory}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx].workCategory = e.target.value;
                            setItems(next);
                          }}
                          className="w-32 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={it.workDescription}
                          placeholder="Detailed work item..."
                          onChange={(e) => {
                            const next = [...items];
                            next[idx].workDescription = e.target.value;
                            setItems(next);
                          }}
                          className="w-56 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={it.materialOrService}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx].materialOrService = e.target.value;
                            setItems(next);
                          }}
                          className="w-36 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx].quantity = Number(e.target.value);
                            setItems(next);
                          }}
                          className="w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={it.unit}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx].unit = e.target.value;
                            setItems(next);
                          }}
                          className="w-20 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          value={it.rate}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx].rate = Number(e.target.value);
                            setItems(next);
                          }}
                          className="w-28 px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono tabular-nums"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-mono tabular-nums font-semibold">
                        {formatINR(it.quantity * it.rate)}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          title="Move Up"
                          disabled={idx === 0}
                          onClick={() => {
                            const next = [...items];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            setItems(next);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Move Down"
                          disabled={idx === items.length - 1}
                          onClick={() => {
                            const next = [...items];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            setItems(next);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate Item"
                          onClick={() => setItems([...items, { ...it }])}
                          className="p-1 text-slate-500 hover:text-slate-900"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete Item"
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MATERIAL DETAILS & BRAND / COMPANY SPECIFICATIONS */}
          <div className="bg-white dark:bg-[#0F1D32] border border-[#C69B2D] rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-display font-bold text-base flex items-center gap-2 text-[#0B1F3A] dark:text-[#E5C158]">
                  <Layers className="w-4 h-4" />
                  MATERIAL DETAILS &amp; BRAND / COMPANY SPECIFICATIONS
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Specify exact material names, brands/companies (searchable or custom), product models, grades, sizes, and supplier responsibility.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setMaterials([
                    ...materials,
                    {
                      workCategory: 'Civil & Structure',
                      materialName: '',
                      materialDescription: '',
                      brandName: '',
                      productModel: '',
                      gradeQuality: '',
                      sizeThickness: '',
                      technicalSpecs: '',
                      quantity: 1,
                      unit: 'Bags',
                      ratePerUnit: 0,
                      providedBy: 'SIID',
                      imageUrl: '',
                      remarks: '',
                    },
                  ])
                }
                className="px-3.5 py-2 rounded-lg bg-[#C69B2D] text-[#0B1F3A] text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Material & Brand
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeMaterialInItems}
                onChange={(e) => setIncludeMaterialInItems(e.target.checked)}
              />
              <span>Material costs are already included inside work item rates (shows material specs transparently without double-counting in Grand Total)</span>
            </label>

            <datalist id="siid-brands-list">
              {CONSTRUCTION_BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>

            {materials.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                No materials added yet. Click &ldquo;Add Material &amp; Brand&rdquo; to enter Cement, Steel, Paint, Tiles, Plywood, Electrical, or Plumbing brands.
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1628] space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Material #{idx + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums">
                          Total: {formatINR(m.quantity * m.ratePerUnit)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMaterials([...materials, { ...m }])}
                          className="text-slate-500 hover:text-slate-900"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaterials(materials.filter((_, i) => i !== idx))}
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                      <input
                        type="text"
                        placeholder="Work Category (e.g. Painting)"
                        value={m.workCategory}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].workCategory = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <input
                        type="text"
                        placeholder="Material Name *"
                        value={m.materialName}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].materialName = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <input
                        list="siid-brands-list"
                        placeholder="Brand / Company (Search or Type) *"
                        value={m.brandName}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].brandName = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <input
                        type="text"
                        placeholder="Product Model / Code"
                        value={m.productModel}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].productModel = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <input
                        type="text"
                        placeholder="Grade / Quality"
                        value={m.gradeQuality}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].gradeQuality = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <input
                        type="text"
                        placeholder="Size / Thickness"
                        value={m.sizeThickness}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].sizeThickness = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={m.quantity}
                          onChange={(e) => {
                            const next = [...materials];
                            next[idx].quantity = Number(e.target.value);
                            setMaterials(next);
                          }}
                          className="px-2 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32] font-mono tabular-nums"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={m.unit}
                          onChange={(e) => {
                            const next = [...materials];
                            next[idx].unit = e.target.value;
                            setMaterials(next);
                          }}
                          className="px-2 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          value={m.ratePerUnit}
                          onChange={(e) => {
                            const next = [...materials];
                            next[idx].ratePerUnit = Number(e.target.value);
                            setMaterials(next);
                          }}
                          className="px-2 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32] font-mono tabular-nums"
                        />
                      </div>
                      <select
                        value={m.providedBy}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].providedBy = e.target.value as 'SIID' | 'CLIENT';
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      >
                        <option value="SIID">Provided By: SIID</option>
                        <option value="CLIENT">Provided By: Client</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                      <input
                        type="text"
                        placeholder="Material Description / Technical Specs"
                        value={m.materialDescription}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].materialDescription = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <input
                        type="text"
                        placeholder="Remarks"
                        value={m.remarks}
                        onChange={(e) => {
                          const next = [...materials];
                          next[idx].remarks = e.target.value;
                          setMaterials(next);
                        }}
                        className="px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32]"
                      />
                      <label className="flex items-center gap-2 px-2.5 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1D32] cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[#1D4ED8]" />
                        <span className="truncate">{m.imageUrl ? 'Material Image Uploaded' : 'Upload Material Image'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const up = await uploadFile(f, 'quotation_material', editingId || 'draft', m.materialName);
                            const next = [...materials];
                            next[idx].imageUrl = up.fileUrl;
                            setMaterials(next);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Specifications & Financial Summary */}
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-display font-semibold text-sm">Work Specifications, Payment Terms & Conditions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <textarea
                  rows={2}
                  placeholder="Labour Specifications"
                  value={labourSpecs}
                  onChange={(e) => setLabourSpecs(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <textarea
                  rows={2}
                  placeholder="Design Specifications"
                  value={designSpecs}
                  onChange={(e) => setDesignSpecs(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <textarea
                  rows={2}
                  placeholder="Included Services"
                  value={includedServices}
                  onChange={(e) => setIncludedServices(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <textarea
                  rows={2}
                  placeholder="Excluded Services"
                  value={excludedServices}
                  onChange={(e) => setExcludedServices(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <input
                  type="text"
                  placeholder="Advance Term"
                  value={paymentTerms.advancePct}
                  onChange={(e) => setPaymentTerms({ ...paymentTerms, advancePct: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
                <input
                  type="text"
                  placeholder="Warranty Condition"
                  value={termsConditions.warranty}
                  onChange={(e) => setTermsConditions({ ...termsConditions, warranty: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                />
              </div>
            </div>

            <div className="lg:col-span-5 bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="font-display font-semibold text-sm">Financial Summary (INR)</h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-slate-500">Labour Charges</label>
                  <input
                    type="number"
                    value={labourCharges}
                    onChange={(e) => setLabourCharges(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500">Transportation</label>
                  <input
                    type="number"
                    value={transportationCharges}
                    onChange={(e) => setTransportationCharges(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500">Additional Charges</label>
                  <input
                    type="number"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500">Discount</label>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500">GST Rate (%)</label>
                  <input
                    type="number"
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500">Advance Requested</label>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500">Work Items Subtotal</span>
                  <span>{formatINR(subtotalItems)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Material Charges {includeMaterialInItems ? '(Included)' : ''}</span>
                  <span>{formatINR(materialCharges)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax ({gstRate}%)</span>
                  <span>{formatINR(gstAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#0B1F3A] dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span>Grand Total</span>
                  <span>{formatINR(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Remaining Balance</span>
                  <span>{formatINR(remainingBalance)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveQuotation('DRAFT')}
                  className="flex-1 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSaveQuotation('SENT')}
                  className="flex-1 py-2.5 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save &amp; Send to Client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Live Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1D32] max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-[#C69B2D] pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={company.logo_url || '/src/assets/images/siid_company_logo_1794819635021.jpg'}
                  alt="SIID Logo"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 object-contain"
                />
                <div>
                  <h3 className="font-display font-bold text-lg">{company.company_name}</h3>
                  <p className="text-xs text-slate-500 tabular-nums">
                    GSTIN: {company.gstin} · Mobile: {company.owner_mobile} · {company.website}
                  </p>
                  <p className="text-xs text-slate-500">{company.official_email}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm">{String(previewData.quotation.quotation_number)}</div>
                <div className="text-xs text-slate-500">Date: {String(previewData.quotation.quotation_date)}</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <p className="font-semibold mb-1">Client: {String(previewData.quotation.client_name)}</p>
                <p>Mobile: {String(previewData.quotation.client_mobile || '')}</p>
                <p>City: {String(previewData.quotation.client_city || '-')}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <p className="font-semibold mb-1">Project: {String(previewData.quotation.project_name)}</p>
                <p>Category: {String(previewData.quotation.project_category)}</p>
                <p>Valid Until: {String(previewData.quotation.valid_until)}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">1. Work Schedule</h4>
              <table className="w-full text-xs border border-slate-200 dark:border-slate-700">
                <thead className="bg-[#0B1F3A] text-white">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="p-2 font-mono">{idx + 1}</td>
                      <td className="p-2">{String(it.work_category)}</td>
                      <td className="p-2">{String(it.work_description)}</td>
                      <td className="p-2 text-right font-mono">{String(it.quantity)} {String(it.unit)}</td>
                      <td className="p-2 text-right font-mono">{formatINR(it.rate as number)}</td>
                      <td className="p-2 text-right font-mono font-semibold">{formatINR(it.amount as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewData.materials.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">2. Material Details &amp; Brand Specifications</h4>
                <table className="w-full text-xs border border-slate-200 dark:border-slate-700">
                  <thead className="bg-[#0B1F3A] text-white">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Material</th>
                      <th className="p-2 text-left">Brand / Company</th>
                      <th className="p-2 text-left">Model / Grade</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-left">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.materials.map((m, idx) => (
                      <tr key={idx} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="p-2 font-mono">{idx + 1}</td>
                        <td className="p-2">{String(m.material_name)}</td>
                        <td className="p-2 font-semibold">{String(m.brand_name)}</td>
                        <td className="p-2">{String(m.product_model || '')} {String(m.grade_quality || '')}</td>
                        <td className="p-2 text-right font-mono">{String(m.quantity)} {String(m.unit)}</td>
                        <td className="p-2 text-right font-mono">{formatINR(m.total_amount as number)}</td>
                        <td className="p-2">{String(m.provided_by)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-base font-bold font-mono">
                Grand Total: {formatINR(previewData.quotation.grand_total as number)}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => generateQuotationPdf({ ...previewData, company })}
                  className="px-4 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download Branded PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
