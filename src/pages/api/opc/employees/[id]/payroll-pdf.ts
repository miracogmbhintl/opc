import type { APIRoute } from 'astro';
import { jsPDF } from 'jspdf';
import {
  cleanText,
  errorStatus,
  jsonResponse,
  requireEmployeeHrAccess,
} from '../../../../../lib/opc-employee-api';
import { calculateEmployeePayroll } from '../../../../../lib/opc-payroll-engine';

export const prerender = false;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: unknown) {
  const text = cleanText(value) || '';
  return ISO_DATE.test(text) ? text : '';
}

function chf(value: unknown) {
  const amount = Number(value || 0);
  return `CHF ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

function safeFilename(value: unknown) {
  const filename = String(value || 'Lohnabrechnung.pdf')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
}

function pdfText(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

function createPayrollPdf(calculation: Awaited<ReturnType<typeof calculateEmployeePayroll>>) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const payroll = (calculation.payrollDocument?.payroll || {}) as Record<string, any>;
  const employee = (calculation.payrollDocument?.employee || {}) as Record<string, any>;
  const document = (calculation.payrollDocument?.document || {}) as Record<string, any>;
  const pageWidth = 210;
  const left = 18;
  const right = 18;
  const contentWidth = pageWidth - left - right;
  let y = 18;

  const ensureSpace = (height = 10) => {
    if (y + height <= 276) return;
    doc.addPage('a4', 'portrait');
    y = 18;
  };

  const line = (label: string, value: string, options: { bold?: boolean; size?: number } = {}) => {
    ensureSpace(7);
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(options.size || 9);
    doc.text(pdfText(label), left, y);
    doc.text(pdfText(value), pageWidth - right, y, { align: 'right' });
    y += 5.4;
  };

  const heading = (value: string) => {
    ensureSpace(12);
    if (y > 22) y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(pdfText(value), left, y);
    y += 2.5;
    doc.setDrawColor(30);
    doc.setLineWidth(0.25);
    doc.line(left, y, pageWidth - right, y);
    y += 5;
  };

  const rows = (items: any[]) => {
    for (const item of items || []) {
      ensureSpace(8);
      const label = pdfText(item?.label || 'Position');
      const basis = pdfText(item?.basis || '');
      const rate = pdfText(item?.rate || '');
      const amount = chf(item?.amount);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      const labelLines = doc.splitTextToSize(label, 80);
      doc.text(labelLines, left, y);
      if (basis) doc.text(basis, 112, y, { align: 'right' });
      if (rate) doc.text(rate, 143, y, { align: 'right' });
      doc.text(amount, pageWidth - right, y, { align: 'right' });
      y += Math.max(5.2, labelLines.length * 4.1 + 1);
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ORANGE PRO CLEAN GMBH', left, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Grosspeteranlage 29 · 4052 Basel · Schweiz', left, y);
  y += 4.5;
  doc.text('info@orangeproclean.ch · +41 61 508 03 79', left, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Lohnabrechnung', left, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const period = [payroll.periodFrom, payroll.periodTo].filter(Boolean).join(' – ');
  doc.text(pdfText(period || `${payroll.month || ''} ${payroll.year || ''}`.trim()), left, y);
  doc.text(pdfText(document.date || ''), pageWidth - right, y, { align: 'right' });
  y += 10;

  heading('Mitarbeiter');
  const name = pdfText(employee.fullName || [calculation.employee?.legal_first_name, calculation.employee?.legal_last_name].filter(Boolean).join(' '));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(name || 'Mitarbeiter', left, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const address = [employee.street, [employee.postalCode, employee.city].filter(Boolean).join(' '), employee.country]
    .map(pdfText)
    .filter(Boolean);
  for (const value of address) {
    doc.text(value, left, y);
    y += 4.2;
  }
  if (employee.employeeNumber) {
    doc.text(`Mitarbeiter-Nr.: ${pdfText(employee.employeeNumber)}`, 118, y - Math.max(4.2, address.length * 4.2), { align: 'left' });
  }
  if (employee.ahvNumber) {
    doc.text(`AHV-Nr.: ${pdfText(employee.ahvNumber)}`, 118, y - Math.max(0, (address.length - 1) * 4.2), { align: 'left' });
  }
  y += 3;

  heading('Lohnbestandteile');
  rows(payroll.earnings || []);
  line('Bruttolohn', chf(payroll.grossSalary), { bold: true, size: 9.5 });

  heading('Abzüge');
  rows(payroll.deductions || []);
  line('Arbeitnehmerabzüge', chf(payroll.totalDeductions), { bold: true });
  line('Nettolohn', chf(payroll.netSalary), { bold: true, size: 9.5 });

  if ((payroll.reimbursements || []).length || Number(payroll.totalReimbursements || 0) !== 0 || Number(payroll.otherAdjustments || 0) !== 0) {
    heading('Spesen / weitere Bezüge und Abzüge');
    rows(payroll.reimbursements || []);
  }

  ensureSpace(20);
  y += 3;
  doc.setDrawColor(20);
  doc.setLineWidth(0.5);
  doc.line(left, y, pageWidth - right, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Auszahlung', left, y);
  doc.text(chf(payroll.payout), pageWidth - right, y, { align: 'right' });
  y += 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  const footer = 'Orange Pro Clean GmbH · Grosspeteranlage 29 · 4052 Basel · CHE-259.534.618';
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.text(footer, left, 289);
    doc.text(`Seite ${page}/${pageCount}`, pageWidth - right, 289, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

export const GET: APIRoute = async ({ request, locals, cookies, params }) => {
  try {
    const employeeId = cleanText(params.id);
    if (!employeeId) {
      return jsonResponse({ success: false, error: 'Keine Mitarbeiter-ID vorhanden.' }, 400);
    }

    const url = new URL(request.url);
    const periodFrom = isoDate(url.searchParams.get('from'));
    const periodTo = isoDate(url.searchParams.get('to'));
    if (!periodFrom || !periodTo || periodFrom > periodTo) {
      return jsonResponse({ success: false, error: 'Ungültiger Abrechnungszeitraum.' }, 400);
    }

    const durationDays = Math.floor(
      (new Date(`${periodTo}T12:00:00Z`).getTime() - new Date(`${periodFrom}T12:00:00Z`).getTime()) / 86400000,
    );
    if (durationDays > 366) {
      return jsonResponse({ success: false, error: 'Der Abrechnungszeitraum darf höchstens 366 Tage umfassen.' }, 400);
    }

    const { supabase, access } = await requireEmployeeHrAccess({ request, locals, cookies });
    if (!access.canManagePayroll) {
      return jsonResponse({ success: false, error: 'Sie haben keine Berechtigung für Lohnabrechnungen.' }, 403);
    }

    const calculation = await calculateEmployeePayroll({
      supabase,
      employeeId,
      periodFrom,
      periodTo,
    });
    const bytes = createPayrollPdf(calculation);
    const filename = safeFilename(calculation.filename);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('[opc/employees/id/payroll-pdf] GET failed', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Lohnabrechnung-PDF konnte nicht erstellt werden.' },
      errorStatus(error),
    );
  }
};
