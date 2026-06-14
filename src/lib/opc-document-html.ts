import type {
  OPCDocumentItem,
  OPCDocumentParty,
  OPCDocumentTotals,
  OPCInvoicePdfInput,
  OPCQuotePdfInput,
} from './opc-document-pdf';

export const OPC_PDF_RENDERER_ENDPOINT =
  import.meta.env.PUBLIC_OPC_PDF_RENDERER_ENDPOINT ||
  import.meta.env.OPC_PDF_RENDERER_ENDPOINT ||
  '';

export type OPCRenderedPdf = {
  base64: string;
  filename?: string;
};

function clean(value: unknown) {
  return String(value || '').trim();
}

function escapeHtml(value: unknown) {
  return clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function nl2br(value: unknown) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function money(value: unknown) {
  const n = Number(value || 0);
  return n.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function swissDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return clean(value);

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function pick(obj: any, keys: string[]) {
  if (!obj) return '';
  for (const key of keys) {
    if (clean(obj[key])) return clean(obj[key]);
  }
  return '';
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  return lines
    .map((line) => clean(line))
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function addressLines(client?: OPCDocumentParty, site?: OPCDocumentParty) {
  const salutation = pick(client, ['salutation', 'anrede']);
  const firstName = pick(client, ['first_name', 'firstname']);
  const lastName = pick(client, ['last_name', 'lastname']);
  const contactName = pick(client, ['contact_name', 'full_name', 'name']);
  const company = pick(client, ['company_name', 'billing_name', 'business_name']);
  const street = pick(client, ['billing_address', 'street', 'address_line_1', 'address']);
  const zip = pick(client, ['billing_postal_code', 'postal_code', 'postcode', 'zip']) || pick(site, ['postal_code', 'postcode', 'zip']);
  const city = pick(client, ['billing_city', 'city']) || pick(site, ['city']);
  const country = pick(client, ['country']) || pick(site, ['country']) || 'Schweiz';

  const person =
    contactName ||
    [firstName, lastName].filter(Boolean).join(' ');

  return uniqueLines([
    salutation,
    person,
    company,
    street,
    [zip, city].filter(Boolean).join(' '),
    country,
  ]);
}

function jobAddress(site?: OPCDocumentParty) {
  const street = pick(site, ['address', 'address_text', 'street', 'address_line_1']);
  const zip = pick(site, ['postal_code', 'postcode', 'zip']);
  const city = pick(site, ['city']);
  return uniqueLines([street, [zip, city].filter(Boolean).join(' ')]).join(', ');
}

function lastNameFromClient(client?: OPCDocumentParty) {
  const last = pick(client, ['last_name', 'lastname']);
  if (last) return last;

  const name = pick(client, ['contact_name', 'full_name', 'name']);
  const parts = name.split(' ').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function greeting(client?: OPCDocumentParty) {
  const salutation = pick(client, ['salutation', 'anrede']).toLowerCase();
  const lastName = lastNameFromClient(client);

  if (salutation.includes('herr')) return `Sehr geehrter Herr ${lastName || ''}`.trim();
  if (salutation.includes('frau')) return `Sehr geehrte Frau ${lastName || ''}`.trim();

  return 'Sehr geehrte Damen und Herren';
}

function documentTypeLabel(type: 'quote' | 'order_confirmation' | 'invoice') {
  if (type === 'invoice') return 'Rechnung';
  if (type === 'order_confirmation') return 'Auftragsbestätigung';
  return 'Offerte';
}

function rows(items: OPCDocumentItem[]) {
  return items.map((item, index) => {
    const title = clean(item.title) || clean(item.description) || 'Position';
    const description = clean(item.description);
    const qty = clean(item.quantity ?? 1);
    const unit = clean((item as any).unit || 'pauschal');
    const unitPrice = Number(item.unit_price_chf ?? item.total_chf ?? 0);
    const total = Number(item.total_chf ?? item.subtotal_chf ?? unitPrice);

    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <strong>${escapeHtml(title)}</strong>
          ${description && description !== title ? `<br><span>${nl2br(description)}</span>` : ''}
        </td>
        <td class="right">${escapeHtml(qty)} ${escapeHtml(unit)}</td>
        <td class="right">CHF ${money(unitPrice)}</td>
        <td class="right">CHF ${money(total)}</td>
      </tr>
    `;
  }).join('');
}

function htmlShell(input: {
  type: 'quote' | 'order_confirmation' | 'invoice';
  number: string;
  title: string;
  issueDate?: string | null;
  validUntil?: string | null;
  customerNumber?: string | null;
  clientSnapshot?: OPCDocumentParty;
  siteSnapshot?: OPCDocumentParty;
  introText: string;
  scopeText?: string;
  closingText?: string;
  items: OPCDocumentItem[];
  totals: OPCDocumentTotals;
}) {
  const docType = documentTypeLabel(input.type);
  const address = addressLines(input.clientSnapshot, input.siteSnapshot);
  const objectAddress = jobAddress(input.siteSnapshot);
  const contactPerson = 'Miriam Tschudin';

  const headerTitle = [
    `${docType} ${input.number}`,
    input.title ? `zur ${input.title}` : '',
    objectAddress ? `an der ${objectAddress}` : '',
  ].filter(Boolean).join(' ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(headerTitle)}</title>
<style>
  @page {
    size: A4;
    margin: 26mm 18mm 25mm 22mm;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.32;
    color: #111;
  }

  .page {
    min-height: 246mm;
    position: relative;
    padding-bottom: 25mm;
  }

  .top {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 26mm;
  }

  .recipient {
    white-space: pre-line;
  }

  .sender {
    text-align: right;
    white-space: pre-line;
  }

  .date {
    margin-bottom: 9mm;
  }

  h1 {
    font-size: 13pt;
    line-height: 1.25;
    margin: 0 0 7mm;
    font-weight: 700;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20mm;
    margin-bottom: 9mm;
  }

  .meta p {
    margin: 0 0 2mm;
    font-weight: 700;
  }

  .body-text {
    margin-bottom: 6mm;
  }

  .scope {
    margin: 7mm 0;
    white-space: pre-line;
  }

  table.positions {
    width: 100%;
    border-collapse: collapse;
    margin-top: 7mm;
  }

  .positions th {
    text-align: left;
    font-weight: 700;
    border-bottom: 1px solid #111;
    padding: 0 0 2mm;
  }

  .positions td {
    padding: 2.5mm 0;
    vertical-align: top;
  }

  .positions th:nth-child(1),
  .positions td:nth-child(1) {
    width: 10mm;
  }

  .positions th:nth-child(3),
  .positions td:nth-child(3) {
    width: 26mm;
  }

  .positions th:nth-child(4),
  .positions td:nth-child(4),
  .positions th:nth-child(5),
  .positions td:nth-child(5) {
    width: 30mm;
  }

  .right {
    text-align: right;
    white-space: nowrap;
  }

  .totals {
    width: 72mm;
    margin-left: auto;
    margin-top: 4mm;
    border-collapse: collapse;
  }

  .totals td {
    padding: 1.5mm 0;
  }

  .totals .amount {
    text-align: right;
    white-space: nowrap;
  }

  .totals .final td {
    font-weight: 700;
    border-top: 1px solid #111;
    padding-top: 2mm;
  }

  .closing {
    margin-top: 10mm;
    white-space: pre-line;
  }

  .footer {
    position: fixed;
    left: 22mm;
    right: 18mm;
    bottom: 10mm;
    font-size: 7.2pt;
    line-height: 1.25;
    border-top: 1px solid #111;
    padding-top: 2mm;
  }

  .footer-line {
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
  }

  .footer strong {
    font-weight: 700;
  }
</style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div class="recipient">${address.map(escapeHtml).join('<br>')}</div>
      <div class="sender">
        Orange Pro Clean GmbH<br>
        Hagmattstrasse 7a<br>
        4123 Allschwil
      </div>
    </section>

    <div class="date">Basel, ${escapeHtml(swissDate(input.issueDate))}</div>

    <h1>${escapeHtml(headerTitle)}</h1>

    <section class="meta">
      <div>
        <p>Ihr Ansprechpartner: ${escapeHtml(contactPerson)}</p>
        <p>Kundennummer: ${escapeHtml(input.customerNumber || '—')}</p>
      </div>
      <div>
        ${input.validUntil ? `<p>Gültig bis: ${escapeHtml(swissDate(input.validUntil))}</p>` : ''}
      </div>
    </section>

    <div class="body-text">
      <p>${escapeHtml(greeting(input.clientSnapshot))}</p>
      <p>${nl2br(input.introText)}</p>
    </div>

    ${input.scopeText ? `<section class="scope">${nl2br(input.scopeText)}</section>` : ''}

    <table class="positions">
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Beschreibung</th>
          <th class="right">Menge</th>
          <th class="right">Einzelpreis</th>
          <th class="right">Preis in CHF</th>
        </tr>
      </thead>
      <tbody>${rows(input.items)}</tbody>
    </table>

    <table class="totals">
      <tr>
        <td>Total</td>
        <td class="amount">CHF ${money(input.totals.subtotal)}</td>
      </tr>
      <tr>
        <td>Zzgl. MWST ${money(input.totals.taxRate).replace('.00', '')}%</td>
        <td class="amount">CHF ${money(input.totals.tax)}</td>
      </tr>
      <tr class="final">
        <td>Betrag inkl. MWST</td>
        <td class="amount">CHF ${money(input.totals.total)}</td>
      </tr>
    </table>

    <section class="closing">
${nl2br(input.closingText || `Wir freuen uns auf Ihren Auftrag und stehen für Rückfragen jederzeit gerne zur Verfügung.

Freundliche Grüsse
${contactPerson}
Orange Pro Clean GmbH`)}
    </section>
  </main>

  <footer class="footer">
    <div class="footer-line">
      <span><strong>Orange Pro Clean GmbH</strong></span>
      <span>Hagmattstrasse 7a, 4123 Allschwil</span>
      <span><strong>E-Mail:</strong> info@orangeproclean.ch</span>
      <span><strong>Telefon:</strong> 061 508 03 79</span>
    </div>
    <div class="footer-line">
      <span><strong>Bank:</strong> Migros Bank AG</span>
      <span><strong>Kontoinhaber:</strong> Orange Pro Clean GmbH</span>
      <span><strong>BIC:</strong> MIGRCHZZ</span>
      <span><strong>IBAN:</strong> CH58 0840 1000 0791 9783 3</span>
    </div>
    <div class="footer-line">
      <span><strong>Umsatzsteuer-Identifikationsnummer:</strong> CHE-259.534.618</span>
      <span><strong>Mobile:</strong> 076 464 14 77</span>
      <span><strong>Website:</strong> www.orangeproclean.ch</span>
    </div>
  </footer>
</body>
</html>`;
}

export function buildQuoteHtml(input: OPCQuotePdfInput) {
  const quote: any = input.quote || {};
  const isConfirmation = input.documentType === 'order_confirmation';

  return htmlShell({
    type: isConfirmation ? 'order_confirmation' : 'quote',
    number: clean(quote.quote_number),
    title: clean(quote.title) || clean(quote.service_type) || 'Reinigungsleistung',
    issueDate: quote.issue_date,
    validUntil: quote.valid_until,
    customerNumber: pick(quote.client_snapshot, ['customer_number', 'client_number', 'number']),
    clientSnapshot: quote.client_snapshot,
    siteSnapshot: quote.site_snapshot,
    introText:
      clean(quote.intro_text) ||
      'Gerne unterbreiten wir Ihnen folgende unverbindliche Offerte für die gewünschte Reinigungsleistung.',
    scopeText: [quote.scope_text, quote.service_description_text].filter(Boolean).join('\n\n'),
    closingText: clean(quote.customer_notes),
    items: input.items,
    totals: input.totals,
  });
}

export function buildInvoiceHtml(input: OPCInvoicePdfInput) {
  const invoice: any = input.invoice || {};
  const metadata = invoice.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {};

  return htmlShell({
    type: 'invoice',
    number: clean(invoice.invoice_number),
    title: clean(invoice.title) || 'Reinigungsleistung',
    issueDate: invoice.issue_date,
    customerNumber: pick(invoice.client_snapshot, ['customer_number', 'client_number', 'number']),
    clientSnapshot: invoice.client_snapshot,
    siteSnapshot: invoice.site_snapshot,
    introText:
      clean(invoice.intro_text) ||
      'Vielen Dank für Ihren Auftrag. Nachfolgend finden Sie die Rechnung für die erbrachten Leistungen.',
    scopeText: clean(metadata.invoice_scope_text || metadata.source_quote_scope_text || metadata.source_quote_service_description_text),
    closingText: clean(metadata.customer_greeting),
    items: input.items,
    totals: input.totals,
  });
}

export async function renderHtmlToPdfBase64(html: string, filename: string): Promise<OPCRenderedPdf | null> {
  if (!OPC_PDF_RENDERER_ENDPOINT) return null;

  const response = await fetch(OPC_PDF_RENDERER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      filename,
      format: 'A4',
      printBackground: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PDF Renderer Fehler: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!data?.base64) throw new Error('PDF Renderer hat keine Base64-Datei zurückgegeben.');

  return {
    base64: data.base64,
    filename: data.filename || filename,
  };
}

export function downloadBase64Pdf(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}