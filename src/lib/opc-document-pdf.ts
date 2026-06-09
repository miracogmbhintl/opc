import React from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type OPCDocumentKind = 'quote' | 'order_confirmation' | 'invoice';
export type OPCDocumentParty = Record<string, any> | null | undefined;

export type OPCDocumentItem = {
  title?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_price_chf?: number | string | null;
  subtotal_chf?: number | string | null;
  tax_chf?: number | string | null;
  total_chf?: number | string | null;
};

export type OPCDocumentTotals = {
  subtotal: number;
  discount?: number;
  taxRate: number;
  tax: number;
  total: number;
  balance?: number;
};

export type OPCQuotePdfInput = {
  quote: Record<string, any>;
  items: OPCDocumentItem[];
  totals: OPCDocumentTotals;
  documentType: 'quote' | 'order_confirmation';
};

export type OPCInvoicePdfInput = {
  invoice: Record<string, any>;
  items: OPCDocumentItem[];
  totals: OPCDocumentTotals;
};

const LOGO_URL = 'https://cdn.prod.website-files.com/6944470386300e196e5fc347/69495340f6a0fe99fed87217_WHITE%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

export const OPC_COMPANY = {
  name: 'Orange Pro Clean GmbH',
  tagline: 'Professionelle Reinigungsdienstleistungen',
  addressLine: 'Hagmattstrasse 7a',
  postcode: '4123',
  cityName: 'Allschwil',
  city: 'Basel',
  country: 'Schweiz',
  email: 'info@orangeproclean.ch',
  phone: '+4161 508 03 79',
  mobile: '+41764641477',
  website: 'www.orangeproclean.ch',
  bank: 'Migros Bank AG',
  accountHolder: 'Orange Pro Clean GmbH',
  bic: 'MIGRCHZZ',
  iban: 'CH58 0840 1000 0791 9783 3',
  vat: 'CHE-259.534.618',
  contactPerson: 'Miriam Tschudin',
};

export const OPC_DEFAULT_CLOSING = `Falls Sie Fragen haben, melden Sie sich gerne bei uns.\n\nFreundliche Grüsse\n${OPC_COMPANY.contactPerson}\n${OPC_COMPANY.name}`;

function clean(value: unknown) {
  return String(value || '').trim();
}

function compact<T>(values: T[]) {
  return values.filter((value) => clean(value));
}

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function stripDuplicateSectionTitle(text: string, title: string) {
  const lines = clean(text).split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length && lines[0].toLowerCase().replace(':', '') === title.toLowerCase().replace(':', '')) {
    return lines.slice(1).join('\n');
  }
  return clean(text);
}

export function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
}

export function formatPlainMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function isoDate(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getSnapshotValue(snapshot: OPCDocumentParty, keys: string[]) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  for (const key of keys) {
    const value = (snapshot as Record<string, any>)[key];
    if (clean(value)) return clean(value);
  }
  return '';
}

function splitAddress(value: unknown) {
  return clean(value)
    .replace(/,\s*/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getClientDisplayName(clientSnapshot?: OPCDocumentParty, fallback?: string) {
  return getSnapshotValue(clientSnapshot, ['billing_name', 'company_name', 'full_name', 'name', 'contact_name']) || clean(fallback) || 'Kundin / Kunde';
}

export function getClientEmail(clientSnapshot?: OPCDocumentParty) {
  return getSnapshotValue(clientSnapshot, ['billing_email', 'email', 'primary_email', 'contact_email']);
}

function buildRecipientLines(clientSnapshot?: OPCDocumentParty, siteSnapshot?: OPCDocumentParty, fallback?: string) {
  const name = getClientDisplayName(clientSnapshot, fallback);
  const billingAddress = getSnapshotValue(clientSnapshot, ['billing_address', 'address_text', 'address']);
  const siteAddress = getSnapshotValue(siteSnapshot, ['address_text', 'address', 'billing_address']);
  const postalCode = getSnapshotValue(siteSnapshot, ['postal_code', 'postcode', 'zip']);
  const city = getSnapshotValue(siteSnapshot, ['city', 'billing_city']);
  const country = getSnapshotValue(siteSnapshot, ['country']) || 'Schweiz';
  const addressLines = splitAddress(billingAddress || siteAddress);
  const cityLine = compact([postalCode, city]).join(' ');
  return compact([name, ...addressLines, cityLine, country]);
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 4.7) {
  const value = clean(text);
  if (!value) return y;
  const lines = doc.splitTextToSize(value, maxWidth) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc: jsPDF, currentY: number, needed = 30) {
  if (currentY + needed > 245) {
    doc.addPage();
    return 28;
  }
  return currentY;
}

function drawSmallLines(doc: jsPDF, lines: string[], x: number, y: number, options: { align?: 'left' | 'right'; maxWidth?: number; lineHeight?: number } = {}) {
  const align = options.align || 'left';
  const maxWidth = options.maxWidth || 72;
  const lineHeight = options.lineHeight || 4.2;
  let cursor = y;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, maxWidth) as string[];
    doc.text(wrapped, x, cursor, { align });
    cursor += wrapped.length * lineHeight;
  }
  return cursor;
}

async function loadLogoDataUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const response = await fetch(LOGO_URL, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function tryAddLogo(doc: jsPDF, logoDataUrl?: string | null) {
  if (!logoDataUrl) return false;
  try {
    doc.setFillColor(247, 147, 30);
    doc.roundedRect(149, 20, 41, 21, 2, 2, 'F');
    doc.addImage(logoDataUrl, 'PNG', 154, 23, 31, 15);
    return true;
  } catch {
    return false;
  }
}

function drawHeader(doc: jsPDF, input: {
  title: string;
  number: string;
  dateLine: string;
  clientSnapshot?: OPCDocumentParty;
  siteSnapshot?: OPCDocumentParty;
  fallbackClientName?: string;
  logoDataUrl?: string | null;
}) {
  const margin = 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(18, 18, 18);

  drawSmallLines(doc, buildRecipientLines(input.clientSnapshot, input.siteSnapshot, input.fallbackClientName), margin, 28, { maxWidth: 82, lineHeight: 4.7 });

  const logoAdded = tryAddLogo(doc, input.logoDataUrl);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  drawSmallLines(doc, [
    OPC_COMPANY.name,
    OPC_COMPANY.tagline,
    OPC_COMPANY.addressLine,
    `${OPC_COMPANY.postcode} ${OPC_COMPANY.cityName}`,
    OPC_COMPANY.country,
  ], 190, logoAdded ? 48 : 28, { align: 'right', maxWidth: 78, lineHeight: 4.7 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(input.dateLine, margin, 88);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text(input.title, margin, 103);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(input.number, margin, 112);

  return 127;
}

function drawFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerTop = pageHeight - 31;
  doc.setDrawColor(226, 226, 226);
  doc.line(22, footerTop - 5, 188, footerTop - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(60, 60, 60);

  drawSmallLines(doc, [OPC_COMPANY.name, OPC_COMPANY.addressLine, `${OPC_COMPANY.postcode} ${OPC_COMPANY.cityName}`], 22, footerTop, { maxWidth: 42, lineHeight: 3.6 });
  drawSmallLines(doc, [OPC_COMPANY.phone, OPC_COMPANY.email, OPC_COMPANY.website], 66, footerTop, { maxWidth: 44, lineHeight: 3.6 });
  drawSmallLines(doc, [`Bank: ${OPC_COMPANY.bank}`, `Kontoinhaber: ${OPC_COMPANY.accountHolder}`, `BIC: ${OPC_COMPANY.bic}`, `IBAN: ${OPC_COMPANY.iban}`], 111, footerTop, { maxWidth: 50, lineHeight: 3.6 });
  drawSmallLines(doc, [`UID/MWST`, OPC_COMPANY.vat, `Mobile: ${OPC_COMPANY.mobile}`], 164, footerTop, { maxWidth: 26, lineHeight: 3.6 });

  doc.setTextColor(18, 18, 18);
}

function addFooterToDocumentPages(doc: jsPDF, excludeLastPage = false) {
  const count = doc.getNumberOfPages();
  const until = excludeLastPage ? Math.max(count - 1, 1) : count;
  for (let page = 1; page <= until; page += 1) {
    doc.setPage(page);
    drawFooter(doc);
  }
}

function buildScopeText(scope?: string, serviceDescription?: string, includeServiceDescription = true) {
  const cleanedScope = stripDuplicateSectionTitle(scope || '', 'Leistungsumfang');
  const cleanedService = includeServiceDescription ? stripDuplicateSectionTitle(serviceDescription || '', 'Leistungsbeschreibung') : '';
  return compact([cleanedScope, cleanedService]).join('\n\n');
}

function drawIntroAndScope(doc: jsPDF, y: number, intro: string, scope: string) {
  const margin = 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  if (clean(intro)) y = addWrappedText(doc, intro, margin, y, 166, 4.8) + 8;

  if (clean(scope)) {
    y = ensureSpace(doc, y, 34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('Leistungsumfang', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = addWrappedText(doc, scope, margin, y, 166, 4.25) + 8;
  }
  return y;
}

function drawItemsAndTotals(doc: jsPDF, y: number, items: OPCDocumentItem[], totals: OPCDocumentTotals, documentKind: OPCDocumentKind) {
  y = ensureSpace(doc, y, 44);
  autoTable(doc, {
    startY: y,
    head: [['Pos.', 'Beschreibung', 'Menge', 'Einzelpreis', 'Preis in CHF']],
    body: items.map((item, index) => [
      String(index + 1),
      [clean(item.title) || 'Position', clean(item.description)].filter(Boolean).join('\n'),
      `${formatPlainMoney(item.quantity || 1)} ${item.unit || 'pauschal'}`,
      formatMoney(item.unit_price_chf || 0),
      formatMoney(item.total_chf || 0),
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.3, valign: 'top', lineColor: [0, 0, 0], lineWidth: 0, textColor: [18, 18, 18] },
    headStyles: { fillColor: [255, 255, 255], textColor: [18, 18, 18], fontStyle: 'normal', lineColor: [0, 0, 0], lineWidth: { bottom: 0.25 } as any },
    columnStyles: { 0: { cellWidth: 11 }, 1: { cellWidth: 86 }, 2: { cellWidth: 27, halign: 'right' }, 3: { cellWidth: 31, halign: 'right' }, 4: { cellWidth: 31, halign: 'right' } },
    margin: { left: 22, right: 22, bottom: 42 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 22;
  let cursor = ensureSpace(doc, finalY + 10, 46);
  const labelX = 112;
  const valueX = 188;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Total exkl. MWST', labelX, cursor);
  doc.text(formatMoney(totals.subtotal), valueX, cursor, { align: 'right' });
  cursor += 6;

  if (toNumber(totals.discount) > 0) {
    doc.text('Rabatt', labelX, cursor);
    doc.text(formatMoney(totals.discount || 0), valueX, cursor, { align: 'right' });
    cursor += 6;
  }

  doc.text(`Zzgl. MWST ${formatPlainMoney(totals.taxRate)}%`, labelX, cursor);
  doc.text(formatMoney(totals.tax), valueX, cursor, { align: 'right' });
  cursor += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Betrag inkl. MWST', labelX, cursor);
  doc.text(formatMoney(totals.total), valueX, cursor, { align: 'right' });

  if (documentKind === 'invoice') {
    cursor += 7;
    doc.text('Offener Betrag', labelX, cursor);
    doc.text(formatMoney(totals.balance ?? totals.total), valueX, cursor, { align: 'right' });
  }

  return cursor + 18;
}

function drawClosing(doc: jsPDF, y: number, closing = OPC_DEFAULT_CLOSING) {
  y = ensureSpace(doc, y, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  return addWrappedText(doc, closing, 22, y, 166, 5.0) + 8;
}

function makeQuoteTitle(documentType: 'quote' | 'order_confirmation') {
  return documentType === 'order_confirmation' ? 'Auftragsbestätigung' : 'Offerte';
}

function makeQuoteIntro(quote: Record<string, any>, documentType: 'quote' | 'order_confirmation') {
  if (documentType === 'order_confirmation') {
    return clean(quote.intro_text)
      ? `Danke für Ihren Auftrag. Nachfolgend finden Sie Ihre Auftragsbestätigung.\n\n${clean(quote.intro_text)}`
      : 'Danke für Ihren Auftrag. Nachfolgend finden Sie Ihre Auftragsbestätigung.';
  }
  return clean(quote.intro_text) || 'Danke für Ihr Interesse. Nachfolgend finden Sie unsere Offerte.';
}

function normalizeIban(value: string) {
  return clean(value).replace(/\s+/g, '').toUpperCase();
}

function alphanumToNumberString(value: string) {
  return value.toUpperCase().split('').map((char) => {
    if (/\d/.test(char)) return char;
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String(code - 55);
    return '';
  }).join('');
}

function mod97(value: string) {
  let checksum = 0;
  for (const char of value) {
    const digit = Number(char);
    if (!Number.isFinite(digit)) continue;
    checksum = (checksum * 10 + digit) % 97;
  }
  return checksum;
}

function buildCreditorReference(number: string) {
  const base = clean(number).replace(/[^0-9A-Z]/gi, '').toUpperCase() || String(Date.now()).slice(-10);
  const payload = alphanumToNumberString(`${base}RF00`);
  const check = 98 - mod97(payload);
  return `RF${String(check).padStart(2, '0')}${base}`;
}

function splitStreet(address: string) {
  const cleaned = clean(address);
  const match = cleaned.match(/^(.+?)\s+(\d+[a-zA-Z]?)$/);
  if (!match) return { street: cleaned, houseNo: '' };
  return { street: match[1], houseNo: match[2] };
}

function buildQrBillData(invoice: Record<string, any>, totals: OPCDocumentTotals) {
  const client = invoice.client_snapshot || {};
  const site = invoice.site_snapshot || {};
  const debtorName = getClientDisplayName(client, invoice.title);
  const address = getSnapshotValue(client, ['billing_address', 'address_text', 'address']) || getSnapshotValue(site, ['address_text', 'address']) || '';
  const postalCode = getSnapshotValue(site, ['postal_code', 'postcode', 'zip']) || getSnapshotValue(client, ['postal_code', 'postcode', 'zip']);
  const city = getSnapshotValue(site, ['city', 'billing_city']) || getSnapshotValue(client, ['city', 'billing_city']);
  const debtorStreet = splitStreet(splitAddress(address)[0] || '');
  const creditorStreet = splitStreet(OPC_COMPANY.addressLine);
  const reference = buildCreditorReference(invoice.invoice_number || '');
  const amount = Number(totals.balance ?? (totals.total || 0)).toFixed(2);

  const lines = [
    'SPC', '0200', '1',
    normalizeIban(OPC_COMPANY.iban),
    'K',
    OPC_COMPANY.accountHolder,
    creditorStreet.street,
    creditorStreet.houseNo,
    OPC_COMPANY.postcode,
    OPC_COMPANY.cityName,
    'CH',
    '', '', '', '', '', '', '',
    amount,
    'CHF',
    'K',
    debtorName,
    debtorStreet.street,
    debtorStreet.houseNo,
    postalCode,
    city,
    'CH',
    'SCOR',
    reference,
    `Rechnung ${clean(invoice.invoice_number)}`,
    'EPD',
  ];

  return { payload: lines.join('\n'), reference, debtorName, debtorAddress: compact([debtorStreet.street + (debtorStreet.houseNo ? ` ${debtorStreet.houseNo}` : ''), compact([postalCode, city]).join(' ')]), amount };
}

async function qrToDataUrl(value: string) {
  if (typeof document === 'undefined') return null;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(React.createElement(QRCodeCanvas, { value, size: 420, level: 'M', marginSize: 0 } as any));
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  const canvas = container.querySelector('canvas');
  const dataUrl = canvas ? canvas.toDataURL('image/png') : null;
  root.unmount();
  container.remove();
  return dataUrl;
}

function drawQrBillPage(doc: jsPDF, invoice: Record<string, any>, totals: OPCDocumentTotals, qrDataUrl: string | null) {
  const { payload, reference, debtorName, debtorAddress, amount } = buildQrBillData(invoice, totals);
  const pageWidth = 210;
  const pageHeight = 297;
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const top = 192;
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(0, top, pageWidth, top);
  doc.line(62, top, 62, pageHeight);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.text('Vor der Einzahlung abzutrennen', 150, 287);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Empfangsschein', 5, top + 9);
  doc.text('Zahlteil', 67, top + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('Konto / Zahlbar an', 5, top + 18);
  doc.text('Konto / Zahlbar an', 67, top + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const creditor = [normalizeIban(OPC_COMPANY.iban), OPC_COMPANY.accountHolder, OPC_COMPANY.addressLine, `${OPC_COMPANY.postcode} ${OPC_COMPANY.cityName}`];
  drawSmallLines(doc, creditor, 5, top + 23, { maxWidth: 52, lineHeight: 3.4 });
  drawSmallLines(doc, creditor, 67, top + 23, { maxWidth: 58, lineHeight: 3.4 });

  doc.setFont('helvetica', 'bold');
  doc.text('Referenz', 5, top + 45);
  doc.text('Referenz', 67, top + 45);
  doc.setFont('helvetica', 'normal');
  drawSmallLines(doc, [reference], 5, top + 50, { maxWidth: 52, lineHeight: 3.4 });
  drawSmallLines(doc, [reference], 67, top + 50, { maxWidth: 58, lineHeight: 3.4 });

  doc.setFont('helvetica', 'bold');
  doc.text('Zahlbar durch', 5, top + 63);
  doc.text('Zusätzliche Informationen', 67, top + 63);
  doc.setFont('helvetica', 'normal');
  drawSmallLines(doc, [debtorName, ...debtorAddress], 5, top + 68, { maxWidth: 52, lineHeight: 3.4 });
  drawSmallLines(doc, [`Rechnung ${clean(invoice.invoice_number)}`], 67, top + 68, { maxWidth: 58, lineHeight: 3.4 });

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', 123, top + 19, 46, 46);
  } else {
    doc.rect(123, top + 19, 46, 46);
    doc.setFontSize(7);
    doc.text('QR-Code', 146, top + 44, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Währung', 5, top + 92);
  doc.text('Betrag', 28, top + 92);
  doc.text('Währung', 123, top + 80);
  doc.text('Betrag', 150, top + 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('CHF', 5, top + 98);
  doc.text(amount, 28, top + 98);
  doc.text('CHF', 123, top + 86);
  doc.text(amount, 150, top + 86);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('Zahlbar durch', 67, top + 85);
  doc.setFont('helvetica', 'normal');
  drawSmallLines(doc, [debtorName, ...debtorAddress], 67, top + 90, { maxWidth: 50, lineHeight: 3.4 });
  doc.text('Annahmestelle', 5, top + 104);

  // keep payload referenced so tree-shaking does not remove the generated value during optimization.
  void payload;
}

export async function generateQuotePdfDocument(input: OPCQuotePdfInput) {
  const { quote, items, totals, documentType } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadLogoDataUrl();
  const title = makeQuoteTitle(documentType);
  const dateLine = documentType === 'quote'
    ? `${OPC_COMPANY.city}, ${isoDate(quote.issue_date)} · gültig bis ${isoDate(quote.valid_until)}`
    : `${OPC_COMPANY.city}, ${isoDate(quote.issue_date)}`;

  let y = drawHeader(doc, { title, number: String(quote.quote_number || ''), dateLine, clientSnapshot: quote.client_snapshot, siteSnapshot: quote.site_snapshot, fallbackClientName: quote.title, logoDataUrl });
  const includeServiceDescription = quote.service_description_mode !== 'none' && quote.service_description_mode !== 'separate_document';
  const scope = buildScopeText(quote.scope_text, quote.service_description_text, includeServiceDescription);
  y = drawIntroAndScope(doc, y, makeQuoteIntro(quote, documentType), scope);
  y = drawItemsAndTotals(doc, y, items, totals, documentType);
  drawClosing(doc, y, clean(quote.customer_notes) || OPC_DEFAULT_CLOSING);
  addFooterToDocumentPages(doc);
  return doc;
}

export async function generateInvoicePdfDocument(input: OPCInvoicePdfInput) {
  const { invoice, items, totals } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadLogoDataUrl();
  const metadata = invoice?.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {};
  const dateLine = `${OPC_COMPANY.city}, ${isoDate(invoice.issue_date)} · zahlbar bis ${isoDate(invoice.due_date)}`;

  let y = drawHeader(doc, { title: 'Rechnung', number: String(invoice.invoice_number || ''), dateLine, clientSnapshot: invoice.client_snapshot, siteSnapshot: invoice.site_snapshot, fallbackClientName: invoice.title, logoDataUrl });
  const scope = buildScopeText(metadata.invoice_scope_text || metadata.source_quote_scope_text, metadata.source_quote_service_description_text, true);
  y = drawIntroAndScope(doc, y, clean(invoice.intro_text) || 'Danke für Ihr Vertrauen. Ihre Rechnung setzt sich wie folgt zusammen:', scope);
  y = drawItemsAndTotals(doc, y, items, totals, 'invoice');
  drawClosing(doc, y, clean(metadata.customer_greeting) || OPC_DEFAULT_CLOSING);
  addFooterToDocumentPages(doc);

  const qrInfo = buildQrBillData(invoice, totals);
  const qrDataUrl = await qrToDataUrl(qrInfo.payload);
  drawQrBillPage(doc, invoice, totals, qrDataUrl);
  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function pdfToBase64(doc: jsPDF) {
  const dataUri = doc.output('datauristring');
  return dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
}

export function buildDocumentEmailHtml(input: { title: string; headline: string; intro: string; documentNumber: string; ctaUrl?: string }) {
  const ctaUrl = input.ctaUrl || 'https://www.orangeproclean.ch/kontakt';
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@800;900&display=swap');@media only screen and (max-width:600px){.container{width:90%!important;max-width:90%!important;margin:0 auto!important;border-radius:20px!important;box-sizing:border-box!important}.fullwidth{width:100%!important;display:block!important;box-sizing:border-box!important}}</style></head><body style="margin:0;padding:0;background:#f2f2f2;font-family:Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;"><tr><td align="center"><table class="container" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#ffffff;border-radius:20px;margin:0 auto;overflow:hidden;"><tr><td style="background:#f7931e;padding:28px 32px;text-align:left;"><img src="${LOGO_URL}" width="65" alt="Orange Pro Clean GmbH" style="display:block;"></td></tr><tr><td align="left" style="padding:32px 32px 20px 32px;"><h1 style="font-family:'Poppins',sans-serif;font-size:38px;line-height:38px;font-weight:900;text-transform:uppercase;color:#1a1a1a;margin:0;">${input.headline}</h1></td></tr><tr><td style="padding:0 32px;color:#1a1a1a;"><p style="margin:0 0 24px 0;font-size:15px;line-height:20px;">${input.intro}</p><div class="fullwidth" style="background:#e9e9e9;padding:20px;border-radius:20px;font-size:15px;line-height:20px;font-weight:600;color:#222;box-sizing:border-box;">Dokument: ${input.documentNumber}</div><div style="text-align:center;margin-top:20px;"><a class="fullwidth" href="${ctaUrl}" style="background:#f7931e;color:#fff;text-decoration:none;padding:14px 20px;border-radius:20px;font-size:15px;font-weight:600;display:block;margin-bottom:12px;box-sizing:border-box;">Kontakt aufnehmen</a><a class="fullwidth" href="https://wa.me/41764641477" style="background:#25D366;color:#fff;text-decoration:none;padding:14px 20px;border-radius:20px;font-size:15px;font-weight:600;display:block;margin-bottom:32px;box-sizing:border-box;">Whatsapp Chat</a></div><p style="margin:0 0 4px 0;font-size:15px;line-height:20px;">Mit freundlichen Grüssen,<br>Ihr Orange Pro Clean Team</p><p style="margin:10px 0 0 0;font-size:10px;line-height:14px;">Orange Pro Clean GmbH<br><a href="mailto:info@orangeproclean.ch" style="color:#1a1a1a;text-decoration:none;">info@orangeproclean.ch</a><br><a href="https://www.orangeproclean.ch" style="color:#1a1a1a;text-decoration:none;">www.orangeproclean.ch</a><br><a href="https://maps.app.goo.gl/CZRD3axnahsaVYME8" style="color:#f7931e;text-decoration:none;">Grosspeter Tower, 21St Floor, Grosspeteranlage 29, 4052 Basel, Schweiz</a></p></td></tr><tr><td style="padding:0 32px 20px 32px;"><div class="fullwidth" style="margin-top:28px;background:#f7931e;padding:24px;border-radius:20px;text-align:center;box-sizing:border-box;"><div style="font-family:'Poppins',sans-serif;font-size:15px;line-height:18px;font-weight:900;text-transform:uppercase;color:#ffffff;margin-bottom:8px;">24/7 NOTRUF</div><div style="font-family:Helvetica,sans-serif;font-size:10px;line-height:12px;color:#f2f2f2;margin-bottom:14px;">Dank unserem Express- und 24/7-Notfallservice sind wir auch kurzfristig für Sie im Einsatz.</div><a class="fullwidth" href="tel:+41764641477" style="background:#ffffff;color:#000000;text-decoration:none;padding:14px 26px;border-radius:20px;font-size:15px;font-weight:700;display:block;box-sizing:border-box;">ANRUFEN</a></div></td></tr><tr><td style="padding:20px;text-align:center;"><p style="font-size:8px;line-height:10px;color:#777;margin:0;">Diese E-Mail wurde automatisch generiert. Ihre Daten werden gemäss DSGVO ausschliesslich zur Bearbeitung Ihres Auftrags verwendet. Datenschutzerklärung: <a href="https://orangeproclean.ch/datenschutz" style="color:#777;text-decoration:underline;">orangeproclean.ch/datenschutz</a></p></td></tr></table></td></tr></table></body></html>`;
}
