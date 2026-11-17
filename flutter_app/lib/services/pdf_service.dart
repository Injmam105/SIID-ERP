import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../config/app_config.dart';

class SiidPdfService {
  static final _inr = NumberFormat.currency(locale: 'en_IN', symbol: 'Rs. ', decimalDigits: 2);
  static const _navy = PdfColor.fromInt(0xFF0B1F3A);
  static const _gold = PdfColor.fromInt(0xFFC69B2D);
  static const _lightBg = PdfColor.fromInt(0xFFF8FAFC);

  static Future<pw.MemoryImage?> _fetchLogo(String? logoUrl, String baseServerRoot) async {
    if (logoUrl == null || logoUrl.isEmpty) return null;
    try {
      final full = logoUrl.startsWith('http') ? logoUrl : '$baseServerRoot$logoUrl';
      final resp = await http.get(Uri.parse(full)).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200 && resp.bodyBytes.isNotEmpty) {
        return pw.MemoryImage(resp.bodyBytes);
      }
    } catch (_) {}
    return null;
  }

  static pw.Widget _buildMandatoryHeader({
    required Map<String, dynamic> company,
    required String documentTitle,
    required String documentNumber,
    required String documentDate,
    pw.MemoryImage? logo,
  }) {
    final gstin = (company['gstin'] ?? AppConfig.gstin).toString().trim();
    return pw.Container(
      padding: const pw.EdgeInsets.only(bottom: 12),
      decoration: const pw.BoxDecoration(
        border: pw.Border(bottom: pw.BorderSide(color: _gold, width: 2)),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logo != null)
                pw.Container(
                  width: 58,
                  height: 58,
                  margin: const pw.EdgeInsets.only(right: 12),
                  child: pw.Image(logo, fit: pw.BoxFit.contain),
                ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    (company['company_name'] ?? AppConfig.companyName).toString(),
                    style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: _navy),
                  ),
                  pw.SizedBox(height: 3),
                  if (gstin.isNotEmpty)
                    pw.Text('GSTIN: $gstin', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _navy)),
                  pw.Text(
                    'Mobile: ${company['owner_mobile'] ?? AppConfig.ownerMobile}  |  Website: ${company['website'] ?? AppConfig.website}',
                    style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.blueGrey800),
                  ),
                  pw.Text(
                    'Email: ${company['official_email'] ?? AppConfig.officialEmail}',
                    style: const pw.TextStyle(fontSize: 8.5, color: PdfColors.blueGrey800),
                  ),
                ],
              ),
            ],
          ),
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                color: _navy,
                child: pw.Text(documentTitle, style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold, color: PdfColors.white)),
              ),
              pw.SizedBox(height: 5),
              pw.Text('No: $documentNumber', style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold, color: _navy)),
              pw.Text('Date: $documentDate', style: const pw.TextStyle(fontSize: 9, color: PdfColors.blueGrey800)),
            ],
          ),
        ],
      ),
    );
  }

  static Future<Uint8List> generateQuotationPdf({
    required Map<String, dynamic> quotation,
    required List<Map<String, dynamic>> items,
    required List<Map<String, dynamic>> materials,
    required Map<String, dynamic> company,
    required String serverRoot,
  }) async {
    final doc = pw.Document();
    final logo = await _fetchLogo(company['logo_url']?.toString(), serverRoot);

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        header: (ctx) => _buildMandatoryHeader(
          company: company,
          documentTitle: 'PROJECT QUOTATION',
          documentNumber: '${quotation['quotation_number']} (Rev ${quotation['revision_no'] ?? 1})',
          documentDate: (quotation['quotation_date'] ?? '').toString(),
          logo: logo,
        ),
        footer: (ctx) => pw.Container(
          padding: const pw.EdgeInsets.only(top: 6),
          decoration: const pw.BoxDecoration(border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300))),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('${company['company_name'] ?? AppConfig.companyName} | ${AppConfig.tagline}',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
              pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                  style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
            ],
          ),
        ),
        build: (ctx) => [
          pw.SizedBox(height: 12),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(10),
                  color: _lightBg,
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('CLIENT DETAILS', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _navy)),
                      pw.SizedBox(height: 4),
                      pw.Text('${quotation['client_name'] ?? ''}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                      pw.Text('Mobile: ${quotation['client_mobile'] ?? ''}', style: const pw.TextStyle(fontSize: 8.5)),
                      if ((quotation['client_address'] ?? '').toString().isNotEmpty)
                        pw.Text('${quotation['client_address'] ?? ''}, ${quotation['client_city'] ?? ''}',
                            style: const pw.TextStyle(fontSize: 8.5)),
                      if ((quotation['client_gstin'] ?? '').toString().isNotEmpty)
                        pw.Text('GSTIN: ${quotation['client_gstin']}', style: const pw.TextStyle(fontSize: 8.5)),
                    ],
                  ),
                ),
              ),
              pw.SizedBox(width: 12),
              pw.Expanded(
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(10),
                  color: _lightBg,
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('PROJECT INFORMATION', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _navy)),
                      pw.SizedBox(height: 4),
                      pw.Text('${quotation['project_name'] ?? ''}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                      pw.Text('Category: ${quotation['project_category'] ?? ''}', style: const pw.TextStyle(fontSize: 8.5)),
                      pw.Text('Location: ${quotation['project_location'] ?? ''}', style: const pw.TextStyle(fontSize: 8.5)),
                      pw.Text('Valid Until: ${quotation['valid_until'] ?? ''}', style: const pw.TextStyle(fontSize: 8.5)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 14),
          pw.Text('1. ITEMIZED WORK SCHEDULE', style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, color: _navy)),
          pw.SizedBox(height: 6),
          pw.TableHelper.fromTextArray(
            headerStyle: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
            headerDecoration: const pw.BoxDecoration(color: _navy),
            cellStyle: const pw.TextStyle(fontSize: 8),
            headers: ['S.No', 'Category', 'Work Description', 'Qty', 'Unit', 'Rate', 'Amount'],
            data: items
                .asMap()
                .entries
                .map((e) => [
                      '${e.key + 1}',
                      '${e.value['work_category'] ?? ''}',
                      '${e.value['work_description'] ?? ''}',
                      '${e.value['quantity'] ?? 0}',
                      '${e.value['unit'] ?? ''}',
                      _inr.format(num.tryParse('${e.value['rate'] ?? 0}') ?? 0),
                      _inr.format(num.tryParse('${e.value['amount'] ?? 0}') ?? 0),
                    ])
                .toList(),
          ),
          if (materials.isNotEmpty) ...[
            pw.SizedBox(height: 16),
            pw.Text('2. MATERIAL DETAILS & BRAND / COMPANY SPECIFICATIONS',
                style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, color: _navy)),
            pw.SizedBox(height: 6),
            pw.TableHelper.fromTextArray(
              headerStyle: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
              headerDecoration: const pw.BoxDecoration(color: _navy),
              cellStyle: const pw.TextStyle(fontSize: 7.5),
              headers: ['S.No', 'Material', 'Brand / Company', 'Model / Grade', 'Size', 'Qty & Unit', 'Rate', 'Total', 'By'],
              data: materials
                  .asMap()
                  .entries
                  .map((e) => [
                        '${e.key + 1}',
                        '${e.value['material_name'] ?? ''}\n${e.value['work_category'] ?? ''}',
                        '${e.value['brand_name'] ?? ''}',
                        '${e.value['product_model'] ?? ''} ${e.value['grade_quality'] ?? ''}'.trim(),
                        '${e.value['size_thickness'] ?? '-'}',
                        '${e.value['quantity'] ?? 0} ${e.value['unit'] ?? ''}',
                        _inr.format(num.tryParse('${e.value['rate_per_unit'] ?? 0}') ?? 0),
                        _inr.format(num.tryParse('${e.value['total_amount'] ?? 0}') ?? 0),
                        '${e.value['provided_by'] ?? 'SIID'}',
                      ])
                  .toList(),
            ),
          ],
          pw.SizedBox(height: 16),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Container(
              width: 240,
              padding: const pw.EdgeInsets.all(10),
              decoration: pw.BoxDecoration(border: pw.Border.all(color: PdfColors.grey400)),
              child: pw.Column(
                children: [
                  _sumRow('Work Subtotal', quotation['subtotal_items']),
                  _sumRow('Material Charges', quotation['material_charges']),
                  _sumRow('Labour Charges', quotation['labour_charges']),
                  _sumRow('Transport & Additional',
                      (num.tryParse('${quotation['transportation_charges'] ?? 0}') ?? 0) +
                          (num.tryParse('${quotation['additional_charges'] ?? 0}') ?? 0)),
                  _sumRow('Discount', -(num.tryParse('${quotation['discount_amount'] ?? 0}') ?? 0)),
                  _sumRow('GST (${quotation['gst_rate'] ?? 18}%)', quotation['gst_amount']),
                  pw.Divider(color: _navy),
                  _sumRow('GRAND TOTAL', quotation['grand_total'], bold: true),
                  _sumRow('Advance Requested', quotation['advance_amount']),
                  _sumRow('Remaining Balance', quotation['remaining_balance'], bold: true),
                ],
              ),
            ),
          ),
          pw.SizedBox(height: 24),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('For ${AppConfig.companyName}', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _navy)),
                  pw.SizedBox(height: 20),
                  pw.Text('Authorized By: ${AppConfig.ownerName} (Owner)', style: const pw.TextStyle(fontSize: 8.5)),
                  pw.Text('Prepared By: ${AppConfig.developedBy} (${AppConfig.developerDesignation})',
                      style: const pw.TextStyle(fontSize: 8)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('CLIENT ACCEPTANCE', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: _navy)),
                  pw.SizedBox(height: 24),
                  pw.Text('Signature & Date', style: const pw.TextStyle(fontSize: 8.5)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  static pw.Widget _sumRow(String label, dynamic val, {bool bold = false}) {
    final amount = num.tryParse('${val ?? 0}') ?? 0;
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: bold ? 9.5 : 8.5, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
          pw.Text(_inr.format(amount),
              style: pw.TextStyle(fontSize: bold ? 9.5 : 8.5, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
        ],
      ),
    );
  }

  static Future<void> previewAndPrint(Uint8List pdfBytes, String filename) async {
    await Printing.layoutPdf(onLayout: (_) async => pdfBytes, name: filename);
  }
}
