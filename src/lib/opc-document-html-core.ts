import generalLetterTemplate from './opc-document-templates/general-letter.html?raw';
import offerTemplate from './opc-document-templates/offer.html?raw';
import orderConfirmationTemplate from './opc-document-templates/order-confirmation.html?raw';
import invoiceTemplate from './opc-document-templates/invoice.html?raw';
import paymentReminderTemplate from './opc-document-templates/payment-reminder.html?raw';
import firstReminderTemplate from './opc-document-templates/first-reminder.html?raw';
import payrollTemplate from './opc-document-templates/payroll.html?raw';

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

export type OPCGeneralLetterInput = {
  recipient?: Record<string, unknown>;
  document: {
    date?: string | null;
    city?: string | null;
    title: string;
  };
  letter: {
    salutation?: string | null;
    paragraphs?: string[] | string | null;
    closingParagraph?: string | null;
    closing?: string | null;
    signatoryName?: string | null;
    signatoryRole?: string | null;
    signatoryCompany?: string | null;
  };
};

export type OPCPayrollHtmlInput = {
  company?: Record<string, unknown>;
  document: Record<string, unknown>;
  employee: Record<string, unknown>;
  payroll: Record<string, unknown>;
};

export type OPCReminderOverrides = {
  documentDate?: string | null;
  newDueDate?: string | null;
  paymentReminderDate?: string | null;
  reminderFee?: number | string | null;
  showEnforcementInformation?: boolean;
  signatoryName?: string | null;
  signatoryRole?: string | null;
  introParagraphs?: string[];
  followupParagraphs?: string[];
  enforcementParagraphs?: string[];
};

const TEMPLATE_COMPANY = {
  name: 'Orange Pro Clean GmbH',
  street: 'Grosspeteranlage 29',
  streetName: 'Grosspeteranlage',
  buildingNumber: '29',
  postalPrefix: 'CH-',
  postalCode: '4052',
  city: 'Basel',
  country: 'Schweiz',
  countryCode: 'CH',
  phone: '+41 61 508 03 79',
  email: 'info@orangeproclean.ch',
  website: 'www.orangeproclean.ch',
  bankName: 'Migros Bank AG',
  accountHolder: 'Orange Pro Clean GmbH',
  bic: 'MIGRCHZZ',
  iban: 'CH58 0840 1000 0791 9783 3',
  uid: 'CHE-259.534.618',
  chId: 'CH-280.4.031.577-6',
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function pick(obj: any, keys: string[]) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    if (clean(obj[key])) return clean(obj[key]);
  }
  return '';
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = clean(value);
    if (!normalized) return false;
    const key = normalized.toLocaleLowerCase('de-CH');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitLines(value: unknown) {
  return clean(value)
    .replace(/,\s*(?=\d{4}\s)/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitStreet(value: unknown) {
  const line = clean(value);
  const match = line.match(/^(.+?)\s+(\d+[a-zA-Z]?(?:[-/]\d+[a-zA-Z]?)?)$/);
  if (!match) return { street: line, streetNumber: '' };
  return { street: match[1], streetNumber: match[2] };
}

function normalizeCountryCode(value: unknown) {
  const code = clean(value).toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  if (/schweiz|switzerland|suisse|svizzera/i.test(clean(value))) return 'CH';
  return 'CH';
}

function formatDate(value?: string | null) {
  if (!clean(value)) return '';
  const source = clean(value);
  const iso = source.slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00`)
    : new Date(source);
  if (Number.isNaN(date.getTime())) return source;

  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function addDays(value: string | null | undefined, days: number) {
  const source = clean(value) || new Date().toISOString().slice(0, 10);
  const date = new Date(`${source.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return source;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function paragraphs(value: unknown) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const text = clean(value);
  if (!text) return [];
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

function getMetadata(record: any) {
  return asObject(record?.metadata);
}

function getQuoteSnapshot(invoice: any) {
  return asObject(invoice?.quote_snapshot);
}

function buildRecipient(client?: OPCDocumentParty, site?: OPCDocumentParty) {
  const clientRecord = asObject(client);
  const siteRecord = asObject(site);

  const companyName = pick(clientRecord, ['company_name', 'business_name']);
  const firstName = pick(clientRecord, ['first_name', 'firstname']);
  const lastName = pick(clientRecord, ['last_name', 'lastname']);
  const explicitName = pick(clientRecord, ['contact_name', 'full_name', 'billing_name', 'name']);
  const personName = [firstName, lastName].filter(Boolean).join(' ') || explicitName;
  const salutation = pick(clientRecord, ['salutation', 'anrede', 'form_of_address']);

  const rawAddress =
    pick(clientRecord, ['billing_address', 'address_text', 'address_line_1', 'street', 'address']) ||
    pick(siteRecord, ['address_text', 'address', 'address_line_1', 'street']);
  const rawAddressLines = splitLines(rawAddress);
  const streetLine = rawAddressLines[0] || rawAddress;
  const { street, streetNumber } = splitStreet(streetLine);

  const postalCode =
    pick(clientRecord, ['billing_postal_code', 'postal_code', 'postcode', 'zip']) ||
    pick(siteRecord, ['postal_code', 'postcode', 'zip']);
  const city =
    pick(clientRecord, ['billing_city', 'city']) ||
    pick(siteRecord, ['city', 'billing_city']);
  const country = pick(clientRecord, ['country']) || pick(siteRecord, ['country']) || 'Schweiz';
  const countryCode =
    pick(clientRecord, ['country_code']) || pick(siteRecord, ['country_code']) || normalizeCountryCode(country);

  const personLine = personName && personName !== companyName ? personName : '';
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  const addressLines = unique([
    companyName,
    personLine,
    ...rawAddressLines,
    cityLine,
    country,
  ]);

  const salutationLower = salutation.toLocaleLowerCase('de-CH');
  let salutationLine = 'Sehr geehrte Damen und Herren';
  if (salutationLower.includes('herr')) {
    salutationLine = `Sehr geehrter Herr ${lastName || personName}`.trim();
  } else if (salutationLower.includes('frau')) {
    salutationLine = `Sehr geehrte Frau ${lastName || personName}`.trim();
  }

  return {
    companyName,
    formOfAddress: '',
    firstName,
    lastName,
    street,
    streetNumber,
    postalCode,
    city,
    country,
    countryCode,
    addressLines,
    salutationLine,
    fullName: personName || companyName,
  };
}

function buildSiteAddress(site?: OPCDocumentParty) {
  const record = asObject(site);
  const rawAddress = pick(record, ['address_text', 'address', 'address_line_1', 'street']);
  const postalCode = pick(record, ['postal_code', 'postcode', 'zip']);
  const city = pick(record, ['city']);
  return unique([...splitLines(rawAddress), [postalCode, city].filter(Boolean).join(' ')]).join(', ');
}

function stripDocumentPrefix(value: unknown) {
  return clean(value)
    .replace(/^(Offerte|Angebot|Auftragsbestätigung|Rechnung)\s+(zur|zum|für|zu)\s+/i, '')
    .replace(/^(Offerte|Angebot|Auftragsbestätigung|Rechnung)\s+/i, '')
    .trim();
}

function documentTitle(prefix: 'Offerte' | 'Rechnung', rawTitle: unknown) {
  const title = clean(rawTitle);
  if (!title) return prefix;
  if (new RegExp(`^${prefix}\\b`, 'i').test(title)) return title;
  const stripped = stripDocumentPrefix(title);
  return stripped ? `${prefix} zur ${stripped}` : prefix;
}

function signatory(record: any) {
  const metadata = getMetadata(record);
  return {
    name: clean(
      metadata.signatory_name ||
      metadata.user_name ||
      metadata.created_by_name ||
      record?.signatory_name ||
      '',
    ),
    role: clean(metadata.signatory_role || record?.signatory_role || ''),
  };
}

function quantityText(item: OPCDocumentItem) {
  return clean(item.quantity ?? 1) || '1';
}

function stripInternalUnitFromTitle(value: unknown, unit: unknown) {
  let title = clean(value);
  const internalUnit = clean(unit);

  if (internalUnit) {
    const escapedUnit = internalUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`\\s+${escapedUnit}$`, 'i'), '').trim();
  }

  return title
    .replace(/\s+(Pauschale|pauschal)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function itemPositionTitle(item: OPCDocumentItem) {
  return (
    stripInternalUnitFromTitle(item.title, item.unit) ||
    stripInternalUnitFromTitle(item.description, item.unit) ||
    'Position'
  );
}

function itemDescriptionParagraphs(items: OPCDocumentItem[]) {
  return unique(
    items.flatMap((item) => {
      const positionTitle = clean(itemPositionTitle(item));
      return paragraphs(item.description).filter(
        (description) => clean(description) !== positionTitle,
      );
    }),
  );
}

function mapItems(items: OPCDocumentItem[]) {
  return items.map((item, index) => ({
    position: String(index + 1),
    description: itemPositionTitle(item),
    details: [],
    bullets: [],
    quantity: quantityText(item),
    unitPrice: toNumber(item.unit_price_chf),
    amount: toNumber(item.subtotal_chf ?? item.unit_price_chf ?? item.total_chf),
  }));
}

function quoteServiceDescriptionParagraphs(quote: any, items: OPCDocumentItem[]) {
  return unique([
    ...paragraphs(quote.scope_text),
    ...paragraphs(quote.service_description_text),
    ...itemDescriptionParagraphs(items),
  ]);
}


function pricing(totals: OPCDocumentTotals) {
  return {
    currency: 'CHF',
    subtotalLabel: 'Zwischentotal exkl. MWST',
    subtotal: toNumber(totals.subtotal),
    discountLabel: 'Rabatt',
    discount: toNumber(totals.discount) > 0 ? toNumber(totals.discount) : '',
    taxLabel: 'MWST',
    taxRate: toNumber(totals.taxRate),
    taxAmount: toNumber(totals.tax),
    roundingLabel: 'Rundungsdifferenz',
    rounding: '',
    totalLabel: 'Gesamtbetrag inkl. MWST',
    total: toNumber(totals.total),
  };
}

function looksLikeDocumentNumber(value: unknown) {
  const normalized = clean(value).replace(/\s+/g, '');
  return /^[A-ZÄÖÜ]{1,8}[-/]?\d{2,}$/i.test(normalized);
}

function invoiceServiceTitle(invoice: any, items: OPCDocumentItem[] = []) {
  const metadata = getMetadata(invoice);
  const quoteSnapshot = getQuoteSnapshot(invoice);
  const firstItem = items[0] || {};

  const candidates = [
    metadata.source_quote_title,
    quoteSnapshot.title,
    invoice.service_type,
    firstItem.title,
    invoice.title,
  ];

  for (const candidate of candidates) {
    const stripped = stripInternalUnitFromTitle(
      stripDocumentPrefix(candidate),
      firstItem.unit,
    );

    if (stripped && !looksLikeDocumentNumber(stripped)) {
      return stripped;
    }
  }

  return 'Reinigungsleistung';
}

function invoiceServiceAddress(invoice: any) {
  const metadata = getMetadata(invoice);
  const quoteSnapshot = getQuoteSnapshot(invoice);

  return (
    clean(
      metadata.job_address ||
      metadata.order_address ||
      metadata.service_address ||
      metadata.site_address,
    ) ||
    buildSiteAddress(invoice.site_snapshot) ||
    buildSiteAddress(quoteSnapshot.site_snapshot)
  );
}

function invoiceObjectType(invoice: any) {
  const metadata = getMetadata(invoice);
  const siteSnapshot = asObject(invoice.site_snapshot);
  const quoteSnapshot = getQuoteSnapshot(invoice);

  const direct =
    pick(siteSnapshot, [
      'property_type',
      'object_type',
      'site_type',
      'building_type',
      'object_category',
    ]) ||
    pick(quoteSnapshot, [
      'property_type',
      'object_type',
      'site_type',
      'building_type',
      'object_category',
    ]) ||
    clean(
      metadata.property_type ||
      metadata.object_type ||
      metadata.site_type ||
      metadata.building_type,
    );

  if (direct) return direct;

  const hiddenReferenceText = [
    metadata.invoice_scope_text,
    metadata.source_quote_scope_text,
    metadata.source_quote_service_description_text,
    quoteSnapshot.scope_text,
    quoteSnapshot.service_description_text,
  ]
    .map(clean)
    .filter(Boolean)
    .join('\n');

  const match = hiddenReferenceText.match(
    /(?:Objektart|Objekttyp|Immobilientyp)\s*:\s*([^\n\r•,;]+)/i,
  );

  return clean(match?.[1]);
}

function invoiceObjectPhrase(invoice: any) {
  const type = invoiceObjectType(invoice).toLocaleLowerCase('de-CH');

  if (type.includes('wohnung')) return 'Ihrer Wohnung';
  if (type.includes('einfamilienhaus')) return 'Ihres Einfamilienhauses';
  if (type.includes('mehrfamilienhaus')) return 'Ihres Mehrfamilienhauses';
  if (/\bhaus\b/.test(type)) return 'Ihres Hauses';
  if (type.includes('büro') || type.includes('buero') || type.includes('office')) {
    return 'Ihres Büros';
  }
  if (type.includes('praxis')) return 'Ihrer Praxis';
  if (type.includes('salon')) return 'Ihres Salons';
  if (
    type.includes('gewerbe') ||
    type.includes('geschäft') ||
    type.includes('geschaeft') ||
    type.includes('laden')
  ) {
    return 'Ihres Gewerbeobjekts';
  }
  if (type.includes('treppenhaus')) return 'Ihres Treppenhauses';

  return 'Ihres Objekts';
}

function payableAmount(totals: OPCDocumentTotals) {
  const balance = toNumber(totals.balance);
  const total = toNumber(totals.total);
  return balance > 0 ? balance : total;
}

function qrData(invoice: any, totals: OPCDocumentTotals, recipient: ReturnType<typeof buildRecipient>) {
  return {
    enabled: true,
    amount: payableAmount(totals),
    currency: clean(invoice.currency) || 'CHF',
    iban: TEMPLATE_COMPANY.iban,
    creditor: {
      name: TEMPLATE_COMPANY.accountHolder,
      street: TEMPLATE_COMPANY.streetName,
      buildingNumber: TEMPLATE_COMPANY.buildingNumber,
      postalCode: TEMPLATE_COMPANY.postalCode,
      city: TEMPLATE_COMPANY.city,
      countryCode: TEMPLATE_COMPANY.countryCode,
    },
    debtor: {
      name: recipient.fullName,
      street: recipient.street,
      buildingNumber: recipient.streetNumber,
      postalCode: recipient.postalCode,
      city: recipient.city,
      countryCode: recipient.countryCode,
    },
    referenceType: 'SCOR',
    reference: '',
    autoCreateScorReference: true,
    unstructuredMessage: `Rechnung ${clean(invoice.invoice_number)}`,
    billingInformation: '',
    alternativeSchemes: [],
  };
}

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function injectWindowData(template: string, variableName: string, data: unknown) {
  const script = `<script>window.${variableName}=${serializeForInlineScript(data)};</script>`;
  if (/<head[^>]*>/i.test(template)) {
    return template.replace(/<head([^>]*)>/i, `<head$1>\n${script}`);
  }
  return `${script}${template}`;
}

function buildOfferData(input: OPCQuotePdfInput) {
  const quote: any = input.quote || {};
  const metadata = getMetadata(quote);
  const recipient = buildRecipient(quote.client_snapshot, quote.site_snapshot);
  const signer = signatory(quote);

  const terms = [
    quote.valid_until ? `Die Offerte ist bis ${formatDate(quote.valid_until)} gültig.` : '',
    ...paragraphs(quote.terms_text),
    ...paragraphs(quote.payment_terms),
    ...paragraphs(quote.acceptance_terms),
    ...paragraphs(quote.customer_notes),
    'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
  ].filter(Boolean);

  return {
    company: TEMPLATE_COMPANY,
    recipient,
    document: {
      city: 'Basel',
      date: formatDate(quote.issue_date),
      title: clean(metadata.offer_document_title) || documentTitle('Offerte', quote.title || quote.service_type || 'Reinigungsleistung'),
      numberLabel: 'Offerten Nr.',
      offerNumber: clean(quote.quote_number),
      continuationTitle: 'Fortsetzung Offerte',
    },
    letter: {
      salutation: recipient.salutationLine,
      introParagraphs: paragraphs(quote.intro_text).length
        ? paragraphs(quote.intro_text)
        : ['Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen unsere Offerte für die gewünschten Reinigungsleistungen.'],
      serviceDescriptionTitle: 'Leistungsbeschreibung',
      serviceDescriptionParagraphs: quoteServiceDescriptionParagraphs(quote, input.items),
      termsParagraphs: terms,
      closing: 'Freundliche Grüsse',
      signatoryName: signer.name,
      signatoryRole: '',
      signatoryCompany: TEMPLATE_COMPANY.name,
    },
    offer: {
      columns: {
        position: 'Pos.',
        description: 'Beschreibung',
        quantity: 'Menge',
        amount: 'Preis in CHF',
      },
      items: mapItems(input.items),
      pricing: pricing(input.totals),
    },
    pagination: {
      firstPageItems: 5,
      continuationPageItems: 14,
      continuationNote: 'Fortsetzung auf der nächsten Seite.',
    },
  };
}

function buildOrderConfirmationData(input: OPCQuotePdfInput) {
  const quote: any = input.quote || {};
  const metadata = getMetadata(quote);
  const recipient = buildRecipient(quote.client_snapshot, quote.site_snapshot);
  const signer = signatory(quote);
  const firstPositionTitle = input.items.length ? itemPositionTitle(input.items[0]) : '';
  const serviceName =
    stripDocumentPrefix(quote.title) ||
    stripDocumentPrefix(quote.service_type) ||
    firstPositionTitle ||
    'Reinigungsleistung';
  const executionDate =
    metadata.execution_date ||
    metadata.service_date ||
    metadata.job_date ||
    quote.execution_date ||
    '';

  return {
    company: TEMPLATE_COMPANY,
    recipient,
    document: {
      city: 'Basel',
      date: formatDate(quote.accepted_at || quote.issue_date),
      title: clean(metadata.order_confirmation_title),
      number: clean(metadata.order_confirmation_number || quote.quote_number),
    },
    linkedOffer: {
      number: clean(quote.quote_number),
      title: documentTitle('Offerte', serviceName),
      serviceName,
      serviceArticle: clean(metadata.service_article) || 'der',
      serviceObject: clean(metadata.service_object || quote.service_object || ''),
      serviceAddress: buildSiteAddress(quote.site_snapshot),
      locationPrefix: 'an der',
      executionDate: formatDate(executionDate),
      currency: clean(quote.currency) || 'CHF',
      total: toNumber(input.totals.total),
      taxText: 'inkl. MWST.',
    },
    letter: {
      salutation: recipient.salutationLine,
      introParagraphs: null,
      // Die Auftragsbestätigung verweist auf die bestätigte Offerte.
      // Das vollständige Leistungsverzeichnis gehört nicht in den Brieftext.
      // Ein gezielter Sondertext kann optional über metadata.order_confirmation_scope_text gesetzt werden.
      scopeParagraph: clean(metadata.order_confirmation_scope_text),
      // Die Offerte wurde bereits angenommen.
      // Gültigkeitsfristen, Offertenbedingungen und allgemeine Kundennotizen
      // werden daher nicht automatisch in die Auftragsbestätigung übernommen.
      // Ein bewusst gewünschter Zusatztext kann separat in den Metadaten gesetzt werden.
      additionalParagraphs: paragraphs(metadata.order_confirmation_additional_text),
      closingParagraph: 'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
      closing: 'Freundliche Grüsse',
      signatoryName: signer.name,
      signatoryRole: signer.role,
      signatoryCompany: TEMPLATE_COMPANY.name,
    },
  };
}

function buildInvoiceData(input: OPCInvoicePdfInput) {
  const invoice: any = input.invoice || {};
  const metadata = getMetadata(invoice);
  const recipient = buildRecipient(invoice.client_snapshot, invoice.site_snapshot);
  const signer = signatory(invoice);
  const serviceTitle = invoiceServiceTitle(invoice, input.items);
  const serviceAddress = invoiceServiceAddress(invoice);
  const objectPhrase = invoiceObjectPhrase(invoice);

  const addressFragment = serviceAddress ? ` an der ${serviceAddress}` : '';
  const executionParagraph =
    `Vielen Dank für Ihren Auftrag. Nachfolgend stellen wir Ihnen hiermit die Ausführung der ` +
    `${serviceTitle} ${objectPhrase}${addressFragment}, in Rechnung.`;

  return {
    company: TEMPLATE_COMPANY,
    recipient,
    document: {
      city: 'Basel',
      date: formatDate(invoice.issue_date),
      dueDate: formatDate(invoice.due_date),
      title: documentTitle('Rechnung', serviceTitle),
      numberLabel: '',
      invoiceNumber: clean(invoice.invoice_number),
      customerNumber: pick(invoice.client_snapshot, ['customer_number', 'client_number', 'number']),
      offerNumber: clean(metadata.source_quote_number || getQuoteSnapshot(invoice).quote_number),
      orderConfirmationNumber: clean(metadata.order_confirmation_number),
      serviceName: serviceTitle,
      serviceAddress,
      continuationTitle: 'Detaillierte Rechnungsübersicht zur Rechnung',
    },
    letter: {
      salutation: recipient.salutationLine,
      introParagraphs: [executionParagraph],
      afterTableParagraphs: [
        'Bitte begleichen Sie den Rechnungsbetrag innerhalb von 10 Tagen ab Rechnungsdatum. Der dazugehörige QR-Zahlteil befindet sich auf der letzten Seite. Die Verrechnung erfolgt auf Grundlage des bestätigten Auftrags und des vereinbarten Leistungsumfangs.',
        'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
      ],
      serviceDescriptionTitle: '',
      serviceDescriptionParagraphs: [],
      termsParagraphs: [],
      closing: 'Freundliche Grüsse',
      signatoryName: '',
      signatoryRole: signer.role,
      signatoryCompany: TEMPLATE_COMPANY.name,
    },
    invoice: {
      columns: {
        position: 'Pos.',
        description: 'Beschreibung',
        quantity: 'Menge',
        amount: 'Preis in CHF',
      },
      items: mapItems(input.items),
      pricing: pricing(input.totals),
    },
    qrBill: qrData(invoice, input.totals, recipient),
    pagination: {
      firstPageItems: 0,
      continuationPageItems: 11,
      continuationNote: 'Fortsetzung auf der nächsten Seite.',
    },
  };
}

export function buildQuoteHtml(input: OPCQuotePdfInput) {
  if (input.documentType === 'order_confirmation') {
    return injectWindowData(
      orderConfirmationTemplate,
      'ORDER_CONFIRMATION_DATA',
      buildOrderConfirmationData(input),
    );
  }

  return injectWindowData(offerTemplate, 'OFFER_DATA', buildOfferData(input));
}

export function buildInvoiceHtml(input: OPCInvoicePdfInput) {
  return injectWindowData(invoiceTemplate, 'INVOICE_DATA', buildInvoiceData(input));
}

export function buildGeneralLetterHtml(input: OPCGeneralLetterInput) {
  const recipient = input.recipient?.clientSnapshot || input.recipient?.siteSnapshot
    ? buildRecipient(
        input.recipient.clientSnapshot as OPCDocumentParty,
        input.recipient.siteSnapshot as OPCDocumentParty,
      )
    : {
        ...input.recipient,
        addressLines: Array.isArray(input.recipient?.addressLines)
          ? input.recipient.addressLines
          : undefined,
      };

  const data = {
    company: TEMPLATE_COMPANY,
    recipient,
    document: {
      city: clean(input.document.city) || 'Basel',
      date: formatDate(input.document.date),
      title: clean(input.document.title),
    },
    letter: {
      salutation: clean(input.letter.salutation) || (recipient as any).salutationLine || 'Sehr geehrte Damen und Herren',
      paragraphs: paragraphs(input.letter.paragraphs),
      closingParagraph: clean(input.letter.closingParagraph) || 'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
      closing: clean(input.letter.closing) || 'Freundliche Grüsse',
      signatoryName: clean(input.letter.signatoryName),
      signatoryRole: clean(input.letter.signatoryRole),
      signatoryCompany: clean(input.letter.signatoryCompany) || TEMPLATE_COMPANY.name,
    },
  };

  return injectWindowData(generalLetterTemplate, 'GENERAL_LETTER_DATA', data);
}

export function buildPayrollHtml(input: OPCPayrollHtmlInput) {
  const data = {
    ...input,
    company: {
      ...TEMPLATE_COMPANY,
      ...(input.company || {}),
    },
  };
  return injectWindowData(payrollTemplate, 'PAYROLL_DATA', data);
}

function buildReminderBase(input: OPCInvoicePdfInput, overrides: OPCReminderOverrides = {}) {
  const invoiceData = buildInvoiceData(input);
  const invoice: any = input.invoice || {};
  const metadata = getMetadata(invoice);
  const outstanding = payableAmount(input.totals);
  const documentDate = overrides.documentDate || new Date().toISOString().slice(0, 10);
  const newDueDate = overrides.newDueDate || metadata.reminder_due_date || addDays(documentDate, 7);

  return {
    invoiceData,
    documentDate: formatDate(documentDate),
    newDueDate: formatDate(newDueDate),
    invoiceDate: formatDate(invoice.issue_date),
    originalDueDate: formatDate(invoice.due_date),
    outstanding,
  };
}

export function buildPaymentReminderHtml(
  input: OPCInvoicePdfInput,
  overrides: OPCReminderOverrides = {},
) {
  const base = buildReminderBase(input, overrides);
  const signer = signatory(input.invoice);
  const metadata = getMetadata(input.invoice);
  const data = {
    ...base.invoiceData,
    document: {
      ...base.invoiceData.document,
      date: base.documentDate,
    },
    letter: {
      ...base.invoiceData.letter,
      introParagraphs: overrides.introParagraphs || [
        'Bei der Prüfung unserer Buchhaltung haben wir festgestellt, dass die nachfolgende Rechnung noch nicht vollständig beglichen wurde. Möglicherweise hat sich Ihre Zahlung mit diesem Schreiben überschnitten.',
      ],
      followupParagraphs: overrides.followupParagraphs || [
        'Wir bitten Sie, den offenen Betrag bis spätestens zum {Neue Zahlungsfrist} zu überweisen. Verwenden Sie dafür bitte den Swiss QR-Zahlteil auf der letzten Seite.',
        'Falls Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.',
        'Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
      ],
      signatoryName: clean(overrides.signatoryName) || signer.name,
      signatoryRole: clean(overrides.signatoryRole) || signer.role,
    },
    reminder: {
      titleLabel: 'Zahlungserinnerung zu',
      documentNumber: clean(metadata.payment_reminder_number || base.invoiceData.document.invoiceNumber),
      documentTitle: clean(metadata.payment_reminder_title),
      invoiceDate: base.invoiceDate,
      originalDueDate: base.originalDueDate,
      newDueDate: base.newDueDate,
      outstandingAmount: base.outstanding,
      currency: 'CHF',
      escalationLevel: 1,
      reminderFee: 0,
      columns: {
        invoiceNumber: 'Rechnungs-Nr.',
        invoiceDate: 'Rechnungsdatum',
        dueDate: 'Fällig am',
        amount: 'Offener Betrag',
      },
    },
    invoice: {
      items: [],
      pricing: {
        currency: 'CHF',
        total: base.outstanding,
      },
    },
    qrBill: {
      ...base.invoiceData.qrBill,
      amount: base.outstanding,
      unstructuredMessage: `Zahlungserinnerung ${clean(metadata.payment_reminder_number || base.invoiceData.document.invoiceNumber)} zu Rechnung ${base.invoiceData.document.invoiceNumber}`,
    },
  };

  return injectWindowData(paymentReminderTemplate, 'PAYMENT_REMINDER_DATA', data);
}

export function buildFirstReminderHtml(
  input: OPCInvoicePdfInput,
  overrides: OPCReminderOverrides = {},
) {
  const base = buildReminderBase(input, overrides);
  const signer = signatory(input.invoice);
  const metadata = getMetadata(input.invoice);
  const fee = toNumber(overrides.reminderFee);
  const totalDue = base.outstanding + fee;

  const data = {
    ...base.invoiceData,
    document: {
      ...base.invoiceData.document,
      date: base.documentDate,
    },
    letter: {
      ...base.invoiceData.letter,
      introParagraphs: overrides.introParagraphs || [
        'Trotz Fälligkeit und unserer vorausgegangenen Zahlungserinnerung konnten wir für die nachfolgende Rechnung noch keinen vollständigen Zahlungseingang feststellen.',
      ],
      followupParagraphs: overrides.followupParagraphs || [
        'Hiermit fordern wir Sie auf, den offenen Gesamtbetrag von {Gesamtbetrag} bis spätestens zum {Neue Zahlungsfrist} vollständig zu bezahlen. Verwenden Sie dafür bitte den Swiss QR-Zahlteil auf der letzten Seite.',
      ],
      enforcementTitle: 'Zahlungsaufforderung und Information zur Betreibung',
      enforcementParagraphs: overrides.enforcementParagraphs || [
        'Sollte bis zum Ablauf dieser Frist weder der vollständige Zahlungseingang noch eine schriftlich bestätigte Zahlungsvereinbarung vorliegen, behalten wir uns vor, ohne weitere Mahnung beim zuständigen Betreibungsamt ein Betreibungsbegehren einzureichen.',
        'Eine eingeleitete Betreibung wird im Betreibungsregister vermerkt. Das Betreibungsamt stellt einen Zahlungsbefehl zu. Die gesetzlichen Fristen betragen 20 Tage für die Zahlung und 10 Tage für einen Rechtsvorschlag. Erweist sich die Betreibung als gerechtfertigt, sind die Betreibungskosten von der Schuldnerin oder dem Schuldner zu tragen.',
        'Sollte die Zahlung bereits erfolgt sein, betrachten Sie dieses Schreiben bitte als gegenstandslos. Bei Zahlungsschwierigkeiten nehmen Sie bitte vor Ablauf der Frist schriftlich Kontakt mit uns auf.',
      ],
      feeParagraph: 'Für diese Mahnung wird eine Mahngebühr von {Mahngebühr} erhoben. Der insgesamt zu zahlende Betrag beträgt {Gesamtbetrag}.',
      signatoryName: clean(overrides.signatoryName) || signer.name,
      signatoryRole: clean(overrides.signatoryRole) || signer.role,
    },
    reminder: {
      titleLabel: '1. Mahnung zu Rechnung',
      documentNumber: clean(metadata.first_reminder_number || base.invoiceData.document.invoiceNumber),
      documentTitle: clean(metadata.first_reminder_title),
      invoiceDate: base.invoiceDate,
      originalDueDate: base.originalDueDate,
      paymentReminderDate: formatDate(overrides.paymentReminderDate || ''),
      newDueDate: base.newDueDate,
      outstandingAmount: base.outstanding,
      reminderFee: fee,
      totalDue,
      currency: 'CHF',
      escalationLevel: 1,
      showEnforcementInformation: overrides.showEnforcementInformation !== false,
      columns: {
        invoiceNumber: 'Rechnungs-Nr.',
        invoiceDate: 'Rechnungsdatum',
        dueDate: 'Fällig am',
        amount: 'Offener Betrag',
      },
    },
    invoice: {
      items: [],
      pricing: {
        currency: 'CHF',
        total: totalDue,
      },
    },
    qrBill: {
      ...base.invoiceData.qrBill,
      amount: totalDue,
      unstructuredMessage: `1. Mahnung ${clean(metadata.first_reminder_number || base.invoiceData.document.invoiceNumber)} zu Rechnung ${base.invoiceData.document.invoiceNumber}`,
    },
  };

  return injectWindowData(firstReminderTemplate, 'FIRST_REMINDER_DATA', data);
}

function byteArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function waitForRenderedPages(iframe: HTMLIFrameElement) {
  const frameDocument = iframe.contentDocument;
  if (!frameDocument) throw new Error('Die HTML-Vorschau konnte nicht geöffnet werden.');

  if (frameDocument.fonts?.ready) {
    await frameDocument.fonts.ready.catch(() => undefined);
  }

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const pages = Array.from(frameDocument.querySelectorAll<HTMLElement>('.page'));
    if (pages.length > 0 && pages.every((page) => page.getBoundingClientRect().width > 0)) {
      const frameWindow = iframe.contentWindow || window;
      await new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => frameWindow.requestAnimationFrame(() => resolve()));
      return pages;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('Die HTML-Vorlage hat innerhalb von 10 Sekunden keine PDF-Seiten erzeugt.');
}

async function renderHtmlInBrowserToPdfBase64(
  html: string,
  filename: string,
): Promise<OPCRenderedPdf> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Der lokale HTML-PDF-Renderer ist nur im Browser verfügbar.');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    'width:210mm',
    'height:297mm',
    'border:0',
    'pointer-events:none',
    'z-index:-2147483648',
    'background:#fff',
  ].join(';');

  document.body.appendChild(iframe);

  try {
    const loaded = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Die HTML-Vorlage konnte nicht geladen werden.')), 10000);
      iframe.addEventListener('load', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
    });

    iframe.srcdoc = html;
    await loaded;

    const pages = await waitForRenderedPages(iframe);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      if (index > 0) pdf.addPage('a4', 'portrait');

      const rect = page.getBoundingClientRect();
      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 3,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: Math.max(Math.ceil(rect.width), page.scrollWidth),
        height: Math.max(Math.ceil(rect.height), page.scrollHeight),
        windowWidth: Math.max(Math.ceil(rect.width), iframe.contentDocument?.documentElement.scrollWidth || 0),
        windowHeight: Math.max(Math.ceil(rect.height), iframe.contentDocument?.documentElement.scrollHeight || 0),
        scrollX: 0,
        scrollY: 0,
        onclone: (_clonedDocument, clonedElement) => {
          const element = clonedElement as HTMLElement;
          element.style.margin = '0';
          element.style.boxShadow = 'none';
          element.style.transform = 'none';
        },
      });

      const pageImage = canvas.toDataURL('image/png');
      pdf.addImage(pageImage, 'PNG', 0, 0, 210, 297, `opc-page-${index + 1}`, 'FAST');
    }

    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    return { base64: byteArrayToBase64(bytes), filename };
  } finally {
    iframe.remove();
  }
}

async function renderHtmlWithEndpoint(
  html: string,
  filename: string,
): Promise<OPCRenderedPdf | null> {
  if (!OPC_PDF_RENDERER_ENDPOINT) return null;

  const response = await fetch(OPC_PDF_RENDERER_ENDPOINT, {
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

export async function renderHtmlToPdfBase64(
  html: string,
  filename: string,
): Promise<OPCRenderedPdf | null> {
  if (OPC_PDF_RENDERER_ENDPOINT) {
    try {
      const rendered = await renderHtmlWithEndpoint(html, filename);
      if (rendered) return rendered;
    } catch (error) {
      console.warn('Externer HTML-PDF-Renderer fehlgeschlagen. Lokaler Browser-Renderer wird verwendet.', error);
    }
  }

  return renderHtmlInBrowserToPdfBase64(html, filename);
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
