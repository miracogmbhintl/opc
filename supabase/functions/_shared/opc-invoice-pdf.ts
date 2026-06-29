import { buildInvoiceHtml } from './opc-invoice-html.ts';
import { jsPDF } from 'npm:jspdf@3.0.4';
import autoTable from 'npm:jspdf-autotable@5.0.2';
import * as QRCode from 'npm:qrcode@1.5.4';

export type OPCDocumentParty = Record<string, unknown> | null | undefined;

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

export type OPCInvoicePdfInput = {
  invoice: Record<string, unknown>;
  items: OPCDocumentItem[];
  totals: OPCDocumentTotals;
};

const LOGO_URL =
  'https://cdn.prod.website-files.com/6944470386300e196e5fc347/69495340f6a0fe99fed87217_WHITE%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

const OPC_COMPANY = {
  name: 'Orange Pro Clean GmbH',
  tagline: 'Professionell. Präzise. Persönlich.',
  addressLine: 'Grosspeteranlage 29',
  postcode: '4052',
  cityName: 'Basel',
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
  contactPerson: '',
};

const DEFAULT_CLOSING =
  `Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nFreundliche Grüsse\n${OPC_COMPANY.name}`;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function compact(values: unknown[]) {
  return values.map(clean).filter(Boolean);
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(toNumber(value));
}

function formatPlainMoney(value: unknown) {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function isoDate(value: unknown) {
  if (!clean(value)) return '';
  return clean(value).slice(0, 10);
}

function getSnapshotValue(snapshot: OPCDocumentParty, keys: string[]) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const record = snapshot as Record<string, unknown>;

  for (const key of keys) {
    if (clean(record[key])) return clean(record[key]);
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
  return (
    getSnapshotValue(clientSnapshot, [
      'billing_name',
      'company_name',
      'full_name',
      'name',
      'contact_name',
    ]) ||
    clean(fallback) ||
    'Kundin / Kunde'
  );
}

function buildRecipientLines(
  clientSnapshot?: OPCDocumentParty,
  siteSnapshot?: OPCDocumentParty,
  fallback?: string,
) {
  const name = getClientDisplayName(clientSnapshot, fallback);
  const billingAddress = getSnapshotValue(clientSnapshot, [
    'billing_address',
    'address_text',
    'address',
  ]);
  const siteAddress = getSnapshotValue(siteSnapshot, [
    'address_text',
    'address',
    'billing_address',
  ]);
  const postalCode =
    getSnapshotValue(clientSnapshot, ['billing_postal_code', 'postal_code', 'postcode', 'zip']) ||
    getSnapshotValue(siteSnapshot, ['postal_code', 'postcode', 'zip']);
  const city =
    getSnapshotValue(clientSnapshot, ['billing_city', 'city']) ||
    getSnapshotValue(siteSnapshot, ['city', 'billing_city']);
  const country =
    getSnapshotValue(clientSnapshot, ['country']) ||
    getSnapshotValue(siteSnapshot, ['country']) ||
    'Schweiz';
  const addressLines = splitAddress(billingAddress || siteAddress);
  const cityLine = compact([postalCode, city]).join(' ');

  return compact([name, ...addressLines, cityLine, country]);
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.7,
) {
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

function drawSmallLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  options: {
    align?: 'left' | 'right';
    maxWidth?: number;
    lineHeight?: number;
  } = {},
) {
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return `data:image/png;base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

function tryAddLogo(doc: jsPDF, logoDataUrl?: string | null) {
  doc.setFillColor(247, 147, 30);
  doc.roundedRect(149, 20, 41, 21, 2, 2, 'F');

  if (!logoDataUrl) return false;

  try {
    doc.addImage(logoDataUrl, 'PNG', 154, 23, 31, 15);
    return true;
  } catch {
    return false;
  }
}

function drawHeader(
  doc: jsPDF,
  input: {
    title: string;
    number: string;
    dateLine: string;
    clientSnapshot?: OPCDocumentParty;
    siteSnapshot?: OPCDocumentParty;
    fallbackClientName?: string;
    logoDataUrl?: string | null;
  },
) {
  const margin = 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(18, 18, 18);

  drawSmallLines(
    doc,
    buildRecipientLines(
      input.clientSnapshot,
      input.siteSnapshot,
      input.fallbackClientName,
    ),
    margin,
    28,
    { maxWidth: 82, lineHeight: 4.7 },
  );

  const logoAdded = tryAddLogo(doc, input.logoDataUrl);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  drawSmallLines(
    doc,
    [
      OPC_COMPANY.name,
      OPC_COMPANY.tagline,
      OPC_COMPANY.addressLine,
      `${OPC_COMPANY.postcode} ${OPC_COMPANY.cityName}`,
      OPC_COMPANY.country,
    ],
    190,
    logoAdded ? 48 : 28,
    { align: 'right', maxWidth: 78, lineHeight: 4.7 },
  );

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

  drawSmallLines(
    doc,
    [OPC_COMPANY.name, OPC_COMPANY.addressLine, `${OPC_COMPANY.postcode} ${OPC_COMPANY.cityName}`],
    22,
    footerTop,
    { maxWidth: 42, lineHeight: 3.6 },
  );
  drawSmallLines(
    doc,
    [OPC_COMPANY.phone, OPC_COMPANY.email, OPC_COMPANY.website],
    66,
    footerTop,
    { maxWidth: 44, lineHeight: 3.6 },
  );
  drawSmallLines(
    doc,
    [
      `Bank: ${OPC_COMPANY.bank}`,
      `Kontoinhaber: ${OPC_COMPANY.accountHolder}`,
      `BIC: ${OPC_COMPANY.bic}`,
      `IBAN: ${OPC_COMPANY.iban}`,
    ],
    111,
    footerTop,
    { maxWidth: 50, lineHeight: 3.6 },
  );
  drawSmallLines(
    doc,
    ['UID/MWST', OPC_COMPANY.vat, `Mobile: ${OPC_COMPANY.mobile}`],
    164,
    footerTop,
    { maxWidth: 26, lineHeight: 3.6 },
  );

  doc.setTextColor(18, 18, 18);
}

function addFooterToDocumentPages(doc: jsPDF) {
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    drawFooter(doc);
  }
}

function stripDuplicateSectionTitle(text: string, title: string) {
  const lines = clean(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    lines.length &&
    lines[0].toLowerCase().replace(':', '') === title.toLowerCase().replace(':', '')
  ) {
    return lines.slice(1).join('\n');
  }

  return clean(text);
}

function buildScopeText(scope?: string, serviceDescription?: string) {
  const cleanedScope = stripDuplicateSectionTitle(scope || '', 'Leistungsumfang');
  const cleanedService = stripDuplicateSectionTitle(
    serviceDescription || '',
    'Leistungsbeschreibung',
  );
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

function drawItemsAndTotals(
  doc: jsPDF,
  y: number,
  items: OPCDocumentItem[],
  totals: OPCDocumentTotals,
) {
  y = ensureSpace(doc, y, 44);

  autoTable(doc, {
    startY: y,
    head: [['Pos.', 'Beschreibung', 'Menge', 'Preis in CHF']],
    body: items.map((item, index) => [
      String(index + 1),
      [clean(item.title) || 'Position', clean(item.description)].filter(Boolean).join('\n'),
      `${clean(item.quantity || 1)} ${item.unit || ''}`.trim(),
      formatMoney(item.total_chf ?? item.subtotal_chf ?? item.unit_price_chf ?? 0),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.3,
      valign: 'top',
      lineColor: [0, 0, 0],
      lineWidth: 0,
      textColor: [18, 18, 18],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [18, 18, 18],
      fontStyle: 'normal',
      lineColor: [0, 0, 0],
      lineWidth: { bottom: 0.25 } as unknown as number,
    },
    columnStyles: {
      0: { cellWidth: 11 },
      1: { cellWidth: 111 },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 36, halign: 'right' },
    },
    margin: { left: 22, right: 22, bottom: 42 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } })
    .lastAutoTable?.finalY || y + 22;
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
  cursor += 7;
  doc.text('Offener Betrag', labelX, cursor);
  doc.text(formatMoney(totals.balance ?? totals.total), valueX, cursor, {
    align: 'right',
  });

  return cursor + 18;
}

function drawClosing(doc: jsPDF, y: number, closing = DEFAULT_CLOSING) {
  y = ensureSpace(doc, y, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  return addWrappedText(doc, closing, 22, y, 166, 5.0) + 8;
}

function normalizeIban(value: string) {
  return clean(value).replace(/\s+/g, '').toUpperCase();
}

function alphanumToNumberString(value: string) {
  return value
    .toUpperCase()
    .split('')
    .map((char) => {
      if (/\d/.test(char)) return char;
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) return String(code - 55);
      return '';
    })
    .join('');
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
  const base = clean(number).replace(/[^0-9A-Z]/gi, '').toUpperCase() ||
    String(Date.now()).slice(-10);
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

function buildQrBillData(invoice: Record<string, unknown>, totals: OPCDocumentTotals) {
  const client = (invoice.client_snapshot || {}) as Record<string, unknown>;
  const site = (invoice.site_snapshot || {}) as Record<string, unknown>;
  const debtorName = getClientDisplayName(client, clean(invoice.title));
  const address =
    getSnapshotValue(client, ['billing_address', 'address_text', 'address']) ||
    getSnapshotValue(site, ['address_text', 'address']) ||
    '';
  const postalCode =
    getSnapshotValue(client, ['billing_postal_code', 'postal_code', 'postcode', 'zip']) ||
    getSnapshotValue(site, ['postal_code', 'postcode', 'zip']);
  const city =
    getSnapshotValue(client, ['billing_city', 'city']) ||
    getSnapshotValue(site, ['city', 'billing_city']);
  const debtorStreet = splitStreet(splitAddress(address)[0] || '');
  const creditorStreet = splitStreet(OPC_COMPANY.addressLine);
  const reference = buildCreditorReference(clean(invoice.invoice_number));
  const amount = Number((totals.balance ?? totals.total) || 0).toFixed(2);

  const lines = [
    'SPC',
    '0200',
    '1',
    normalizeIban(OPC_COMPANY.iban),
    'K',
    OPC_COMPANY.accountHolder,
    creditorStreet.street,
    creditorStreet.houseNo,
    OPC_COMPANY.postcode,
    OPC_COMPANY.cityName,
    'CH',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
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

  return {
    payload: lines.join('\n'),
    reference,
    debtorName,
    debtorAddress: compact([
      debtorStreet.street + (debtorStreet.houseNo ? ` ${debtorStreet.houseNo}` : ''),
      compact([postalCode, city]).join(' '),
    ]),
    amount,
  };
}

async function qrToDataUrl(value: string) {
  const api = QRCode as unknown as {
    toDataURL: (
      value: string,
      options?: Record<string, unknown>,
    ) => Promise<string>;
  };

  return await api.toDataURL(value, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 420,
    type: 'image/png',
  });
}

function drawQrBillPage(
  doc: jsPDF,
  invoice: Record<string, unknown>,
  totals: OPCDocumentTotals,
  qrDataUrl: string | null,
) {
  const { reference, debtorName, debtorAddress, amount } = buildQrBillData(
    invoice,
    totals,
  );
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
  const creditor = [
    normalizeIban(OPC_COMPANY.iban),
    OPC_COMPANY.accountHolder,
    OPC_COMPANY.addressLine,
    `${OPC_COMPANY.postcode} ${OPC_COMPANY.cityName}`,
  ];
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
  drawSmallLines(doc, [debtorName, ...debtorAddress], 5, top + 68, {
    maxWidth: 52,
    lineHeight: 3.4,
  });
  drawSmallLines(doc, [`Rechnung ${clean(invoice.invoice_number)}`], 67, top + 68, {
    maxWidth: 58,
    lineHeight: 3.4,
  });

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
  drawSmallLines(doc, [debtorName, ...debtorAddress], 67, top + 90, {
    maxWidth: 50,
    lineHeight: 3.4,
  });
  doc.text('Annahmestelle', 5, top + 104);
}

async function generateLegacyInvoicePdfBase64(input: OPCInvoicePdfInput) {
  const { invoice, items, totals } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await loadLogoDataUrl();
  const metadata =
    invoice?.metadata && typeof invoice.metadata === 'object'
      ? (invoice.metadata as Record<string, unknown>)
      : {};
  const dateLine = `${OPC_COMPANY.city}, ${isoDate(invoice.issue_date)}`;

  let y = drawHeader(doc, {
    title: 'Rechnung',
    number: clean(invoice.invoice_number),
    dateLine,
    clientSnapshot: invoice.client_snapshot as OPCDocumentParty,
    siteSnapshot: invoice.site_snapshot as OPCDocumentParty,
    fallbackClientName: clean(invoice.title),
    logoDataUrl,
  });

  const scope = buildScopeText(
    clean(metadata.invoice_scope_text || metadata.source_quote_scope_text),
    clean(metadata.source_quote_service_description_text),
  );

  y = drawIntroAndScope(
    doc,
    y,
    clean(invoice.intro_text) ||
      'Danke für Ihr Vertrauen. Ihre Rechnung setzt sich wie folgt zusammen:',
    scope,
  );
  y = drawItemsAndTotals(doc, y, items, totals);
  const invoiceClosing = [
    clean(invoice.payment_terms) || `Bitte bezahlen Sie den Rechnungsbetrag bis zum ${isoDate(invoice.due_date)}.`,
    clean(metadata.customer_greeting) || DEFAULT_CLOSING,
  ].filter(Boolean).join('\n\n');
  drawClosing(doc, y, invoiceClosing);
  addFooterToDocumentPages(doc);

  const qrInfo = buildQrBillData(invoice, totals);
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await qrToDataUrl(qrInfo.payload);
  } catch (error) {
    console.error('[opc-invoice-pdf] QR generation failed', error);
  }

  drawQrBillPage(doc, invoice, totals, qrDataUrl);

  const arrayBuffer = doc.output('arraybuffer');
  return bytesToBase64(new Uint8Array(arrayBuffer));
}


export async function generateInvoicePdfBase64(input: OPCInvoicePdfInput) {
  const endpoint =
    Deno.env.get('OPC_PDF_RENDERER_ENDPOINT') ||
    Deno.env.get('PUBLIC_OPC_PDF_RENDERER_ENDPOINT') ||
    '';

  if (endpoint) {
    try {
      const invoiceNumber = clean(input.invoice?.invoice_number) || 'Rechnung';
      const filename = `${invoiceNumber}_Rechnung.pdf`.replace(/[\\/:*?"<>|]+/g, '-');
      const html = buildInvoiceHtml(input);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          filename,
          format: 'A4',
          printBackground: true,
          waitUntil: 'networkidle0',
        }),
      });

      if (response.ok) {
        const payload = await response.json() as { base64?: string };
        if (clean(payload?.base64)) return clean(payload.base64);
      } else {
        const details = await response.text().catch(() => '');
        console.error('[opc-invoice-pdf] HTML renderer failed', response.status, details);
      }
    } catch (error) {
      console.error('[opc-invoice-pdf] HTML renderer exception; using jsPDF fallback', error);
    }
  }

  return await generateLegacyInvoicePdfBase64(input);
}
