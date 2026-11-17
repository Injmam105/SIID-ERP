import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanySettings } from './api.ts';

function inrPlain(val: number | string | null | undefined): string {
  const n = Number(val || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function loadImageAsDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawCompanyHeader(
  doc: jsPDF,
  company: CompanySettings,
  logoDataUrl: string | null,
  docTitle: string,
  docNumber: string,
  docDate: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Top Navy Bar Accent
  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, pageWidth, 6, 'F');

  let textStartX = 14;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'JPEG', 14, 12, 22, 22);
      textStartX = 40;
    } catch {
      textStartX = 14;
    }
  }

  doc.setTextColor(11, 31, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.company_name || 'Sirahi Infrastructure & Interior Design', textStartX, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const gstin = (company.gstin || '').trim();
  let yMeta = 23;
  if (gstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${gstin}`, textStartX, yMeta);
    doc.setFont('helvetica', 'normal');
    yMeta += 4.5;
  }
  doc.text(`Mobile: ${company.owner_mobile || '9650598785'}  |  Website: ${company.website || 'https://sirahi.in'}`, textStartX, yMeta);
  yMeta += 4.5;
  doc.text(`Email: ${company.official_email || 'sirahiinfrainteriordesign@gmail.com'}`, textStartX, yMeta);

  // Right Document Title Box
  doc.setFillColor(11, 31, 58);
  doc.rect(pageWidth - 74, 12, 60, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(docTitle, pageWidth - 44, 17.5, { align: 'center' });

  doc.setTextColor(11, 31, 58);
  doc.setFontSize(8.5);
  doc.text(`No: ${docNumber}`, pageWidth - 14, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${docDate}`, pageWidth - 14, 30, { align: 'right' });

  // Gold Divider
  doc.setDrawColor(198, 155, 45);
  doc.setLineWidth(0.7);
  doc.line(14, 38, pageWidth - 14, 38);

  return 44;
}

function addPageFooters(doc: jsPDF, company: CompanySettings): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${company.company_name} · ${company.tagline || 'One Company. Multiple Projects. Complete Control.'}`,
      14,
      pageHeight - 9
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 9, { align: 'right' });
  }
}

export async function generateQuotationPdf(params: {
  quotation: Record<string, unknown>;
  items: Record<string, unknown>[];
  materials: Record<string, unknown>[];
  company: CompanySettings;
}): Promise<void> {
  const { quotation: q, items, materials, company } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoData = await loadImageAsDataUrl(company.logo_url);
  const sigData = await loadImageAsDataUrl(company.signature_url);

  let y = drawCompanyHeader(
    doc,
    company,
    logoData,
    'PROJECT QUOTATION',
    `${q.quotation_number} (Rev ${q.revision_no || 1})`,
    String(q.quotation_date || '')
  );

  const pageWidth = doc.internal.pageSize.getWidth();
  // Client & Project Summary Boxes
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 88, 28, 'F');
  doc.rect(108, y, 88, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(11, 31, 58);
  doc.text('CLIENT DETAILS', 17, y + 5);
  doc.text('PROJECT DETAILS', 111, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(String(q.client_name || ''), 17, y + 10);
  doc.text(`Mobile: ${q.client_mobile || ''}`, 17, y + 15);
  doc.text(`${q.client_address || ''} ${q.client_city || ''}`.trim().slice(0, 48), 17, y + 20);
  if (q.client_gstin) doc.text(`GSTIN: ${q.client_gstin}`, 17, y + 25);

  doc.text(String(q.project_name || '').slice(0, 45), 111, y + 10);
  doc.text(`Category: ${q.project_category || ''}`, 111, y + 15);
  doc.text(`Location: ${q.project_location || '-'}`, 111, y + 20);
  doc.text(`Valid Until: ${q.valid_until || ''}`, 111, y + 25);

  y += 34;

  // 1. Work Items Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 31, 58);
  doc.text('1. Itemized Work Schedule', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [11, 31, 58], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    head: [['S.No', 'Work Category', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: items.map((it, i) => [
      String(i + 1),
      String(it.work_category || ''),
      String(it.work_description || ''),
      String(it.quantity || 0),
      String(it.unit || ''),
      inrPlain(it.rate as number),
      inrPlain(it.amount as number),
    ]),
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // 2. Material Details & Brand / Company Specifications
  if (materials.length > 0) {
    if (y > 235) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 31, 58);
    doc.text('2. Material Details & Brand / Company Specifications', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [11, 31, 58], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      head: [['#', 'Material & Category', 'Brand / Company', 'Model / Grade', 'Size', 'Qty', 'Rate', 'Total', 'By']],
      body: materials.map((m, i) => [
        String(i + 1),
        `${m.material_name || ''}\n(${m.work_category || ''})`,
        String(m.brand_name || ''),
        `${m.product_model || ''} ${m.grade_quality || ''}`.trim() || '-',
        String(m.size_thickness || '-'),
        `${m.quantity || 0} ${m.unit || ''}`,
        inrPlain(m.rate_per_unit as number),
        inrPlain(m.total_amount as number),
        String(m.provided_by || 'SIID'),
      ]),
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // 3. Financial Summary
  if (y > 220) {
    doc.addPage();
    y = 20;
  }
  const summaryRows = [
    ['Work Items Subtotal', inrPlain(q.subtotal_items as number)],
    [
      q.include_material_in_items ? 'Material Charges (Included in Item Rates)' : 'Material Charges',
      inrPlain(q.material_charges as number),
    ],
    ['Labour Charges', inrPlain(q.labour_charges as number)],
    ['Transportation & Additional', inrPlain(Number(q.transportation_charges || 0) + Number(q.additional_charges || 0))],
    ['Discount', `- ${inrPlain(q.discount_amount as number)}`],
    [`Applicable ${company.tax_label || 'GST'} (${q.gst_rate ?? 18}%)`, inrPlain(q.gst_amount as number)],
    ['GRAND TOTAL', inrPlain(q.grand_total as number)],
    ['Advance Requested', inrPlain(q.advance_amount as number)],
    ['Remaining Balance', inrPlain(q.remaining_balance as number)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth - 98, right: 14 },
    tableWidth: 84,
    theme: 'grid',
    bodyStyles: { fontSize: 8.5, textColor: [11, 31, 58] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    body: summaryRows,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (q.scope_of_work || q.labour_specs || q.design_specs) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Specifications & Notes:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const notes = [q.scope_of_work, q.labour_specs, q.design_specs, q.included_services, q.excluded_services]
      .filter(Boolean)
      .join(' | ');
    const split = doc.splitTextToSize(notes, pageWidth - 28);
    doc.text(split, 14, y);
    y += split.length * 4 + 8;
  }

  if (y > 250) {
    doc.addPage();
    y = 24;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`For ${company.company_name}`, 14, y);
  doc.text('Client Acceptance', pageWidth - 14, y, { align: 'right' });

  if (sigData) {
    try {
      doc.addImage(sigData, 'PNG', 14, y + 2, 30, 10);
    } catch {
      // ignore invalid sig image
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Authorized By: ${company.owner_name || 'MD Zawed Ansar'} (Owner)`, 14, y + 16);
  doc.text(`Prepared By: ${company.developed_by || 'Injmam Ansari'} (${company.developer_designation || 'IT Head of SIID'})`, 14, y + 20);
  doc.text('Authorized Signature & Date', pageWidth - 14, y + 16, { align: 'right' });

  addPageFooters(doc, company);
  doc.save(`${String(q.quotation_number || 'SIID_Quotation').replace(/\//g, '_')}.pdf`);
}

export async function generateInvoicePdf(params: {
  invoice: Record<string, unknown>;
  company: CompanySettings;
}): Promise<void> {
  const { invoice: inv, company } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoData = await loadImageAsDataUrl(company.logo_url);

  let y = drawCompanyHeader(
    doc,
    company,
    logoData,
    'TAX INVOICE',
    String(inv.invoice_number || ''),
    String(inv.invoice_date || '')
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Bill To: ${inv.client_name || ''}`, 14, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Mobile: ${inv.client_mobile || ''}  |  Project: ${inv.project_name || '-'}`, 14, y + 9);
  if (inv.client_gstin) doc.text(`Client GSTIN: ${inv.client_gstin}`, 14, y + 14);

  const items = JSON.parse(String(inv.items_json || '[]')) as {
    description: string;
    quantity: number;
    unit: string;
    rate: number;
  }[];

  autoTable(doc, {
    startY: y + 18,
    margin: { left: 14, right: 14 },
    headStyles: { fillColor: [11, 31, 58], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    head: [['#', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: items.map((it, idx) => [
      String(idx + 1),
      it.description,
      String(it.quantity),
      it.unit,
      inrPlain(it.rate),
      inrPlain(Number(it.quantity) * Number(it.rate)),
    ]),
  });

  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: endY,
    margin: { left: 112, right: 14 },
    theme: 'grid',
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    body: [
      ['Subtotal', inrPlain(inv.subtotal as number)],
      ['Discount', `- ${inrPlain(inv.discount_amount as number)}`],
      [`GST (${inv.gst_rate ?? 18}%)`, inrPlain(inv.gst_amount as number)],
      ['Grand Total', inrPlain(inv.grand_total as number)],
      ['Amount Paid', inrPlain(inv.amount_paid as number)],
      ['Outstanding Balance', inrPlain(inv.outstanding_balance as number)],
    ],
  });

  addPageFooters(doc, company);
  doc.save(`${String(inv.invoice_number || 'SIID_Invoice').replace(/\//g, '_')}.pdf`);
}

export async function generateSalarySlipPdf(params: {
  slip: Record<string, unknown>;
  company: CompanySettings;
}): Promise<void> {
  const { slip, company } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoData = await loadImageAsDataUrl(company.logo_url);

  const y = drawCompanyHeader(
    doc,
    company,
    logoData,
    'SALARY / WAGE SLIP',
    String(slip.slip_number || ''),
    String(slip.created_at || '').slice(0, 10)
  );

  autoTable(doc, {
    startY: y + 4,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: { fillColor: [11, 31, 58], textColor: 255 },
    head: [['Field', 'Details']],
    body: [
      ['Employee Name', String(slip.employee_name || '')],
      ['Employee Code', String(slip.employee_code || '')],
      ['Employee Type', String(slip.employee_type || '')],
      ['Pay Period', String(slip.period_label || '')],
      ['Present / Half / Leave Days', `${slip.present_days} / ${slip.half_days} / ${slip.leave_days}`],
      ['Overtime Hours', String(slip.overtime_hours || 0)],
      ['Base Pay', inrPlain(slip.base_pay as number)],
      ['Overtime Pay', inrPlain(slip.overtime_pay as number)],
      ['Deductions', `- ${inrPlain(slip.deductions as number)}`],
      ['Advance Adjusted', `- ${inrPlain(slip.advance_adjusted as number)}`],
      ['NET PAYABLE', inrPlain(slip.net_payable as number)],
      ['Payment Status', `${slip.status} ${slip.transaction_ref ? `(Ref: ${slip.transaction_ref})` : ''}`],
    ],
  });

  addPageFooters(doc, company);
  doc.save(`${String(slip.slip_number || 'SIID_Salary_Slip').replace(/\//g, '_')}.pdf`);
}
