import { deriveOpcDocumentNumber } from '../lib/opc-document-numbering';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { sendDocumentEmail } from '../lib/opc-document-email';
import { buildDocumentEmailHtml, downloadPdf, generateQuotePdfDocument, getClientEmail, pdfToBase64, OPC_DEFAULT_CLOSING } from '../lib/opc-document-pdf';
import { buildQuoteHtml, downloadBase64Pdf, renderHtmlToPdfBase64 } from '../lib/opc-document-html';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  OPCPageShell,
  OPCListCard,
  OPC_BRAND,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcInputStyle,
  opcSelectStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Mail,
  Plus,
  Receipt,
  Save,
  Trash2,
} from 'lucide-react';

type QuoteRow = Record<string, any>;
type QuoteItem = Record<string, any>;
type TemplateRow = Record<string, any>;

type QuoteDetailPageProps = {
  quoteId: string;
};

type PriceInputMode = 'excl' | 'incl';

const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  ready: 'Bereit',
  sent: 'Gesendet',
  viewed: 'Gesehen',
  accepted: 'Angenommen',
  declined: 'Abgelehnt',
  expired: 'Abgelaufen',
  cancelled: 'Storniert',
  converted_to_job: 'Einsatz erstellt',
  invoiced: 'Verrechnet',
};

const DOCUMENT_CORRECTION_MODE = false; // Dokumentnummern werden ausschliesslich automatisch vergeben.

function clean(value: unknown) {
  return String(value || '').trim();
}

function normalizeServiceTitle(value: unknown) {
  let title = clean(value);

  for (let index = 0; index < 4; index += 1) {
    const stripped = title
      .replace(/^(Offerte|Angebot|Auftragsbestätigung|Rechnung)\s+(zur|zum|für|zu)\s+/i, '')
      .replace(/^(Offerte|Angebot|Auftragsbestätigung|Rechnung)\s+/i, '')
      .trim();

    if (stripped === title) break;
    title = stripped;
  }

  return title;
}

function parseSwissMoney(value: unknown) {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  const normalized = raw
    .replace(/CHF/gi, '')
    .replace(/Fr\.?/gi, '')
    .replace(/[’'`´\s]/g, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/,/g, '.');

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function toNumber(value: unknown) {
  return parseSwissMoney(value);
}

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
}

function formatPlainMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function isoDate(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const base = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function getMetadata(row?: QuoteRow | QuoteItem | null) {
  if (!row?.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) return {};
  return row.metadata as Record<string, any>;
}

function snapshotObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function pickSnapshot(record: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = clean(record[key]);
    if (value) return value;
  }
  return '';
}

function getOfferRecipientFields(quote?: QuoteRow | null) {
  const metadata = getMetadata(quote);
  const client = snapshotObject(quote?.client_snapshot);
  const site = snapshotObject(quote?.site_snapshot);

  const explicitName = pickSnapshot(client, ['contact_name', 'full_name', 'billing_name', 'name']);
  const nameParts = explicitName.split(/\s+/).filter(Boolean);
  const rawAddress =
    pickSnapshot(client, ['billing_address', 'address_text', 'address_line_1', 'street', 'address']) ||
    pickSnapshot(site, ['address_text', 'address', 'address_line_1', 'street']);
  const addressParts = rawAddress.split(/\r?\n|,/).map((part) => part.trim()).filter(Boolean);
  const locationPart = addressParts.find((part) => /^\d{4}\s/.test(part)) || '';
  const locationMatch = locationPart.match(/^(\d{4})\s+(.+)$/);

  const fallbackStreet =
    pickSnapshot(client, ['billing_street', 'street', 'address_line_1']) ||
    pickSnapshot(site, ['street', 'address_line_1']) ||
    addressParts.find((part) => !/^\d{4}\s/.test(part)) || '';
  const fallbackCity = (
    pickSnapshot(client, ['billing_city', 'city']) ||
    pickSnapshot(site, ['city', 'billing_city']) ||
    locationMatch?.[2] || ''
  ).split(',')[0].trim();

  return {
    formOfAddress: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_form_of_address')
      ? clean(metadata.offer_recipient_form_of_address)
      : pickSnapshot(client, ['salutation', 'anrede', 'form_of_address']),
    firstName: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_first_name')
      ? clean(metadata.offer_recipient_first_name)
      : pickSnapshot(client, ['first_name', 'firstname']) || (nameParts.length > 1 ? nameParts[0] : ''),
    lastName: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_last_name')
      ? clean(metadata.offer_recipient_last_name)
      : pickSnapshot(client, ['last_name', 'lastname']) || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : explicitName),
    companyName: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_company_name')
      ? clean(metadata.offer_recipient_company_name)
      : pickSnapshot(client, ['company_name', 'business_name']),
    street: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_street')
      ? clean(metadata.offer_recipient_street)
      : fallbackStreet,
    postalCode: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_postal_code')
      ? clean(metadata.offer_recipient_postal_code)
      : pickSnapshot(client, ['billing_postal_code', 'postal_code', 'postcode', 'zip']) ||
        pickSnapshot(site, ['postal_code', 'postcode', 'zip']) ||
        locationMatch?.[1] || '',
    city: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_city')
      ? clean(metadata.offer_recipient_city)
      : fallbackCity,
    country: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_country')
      ? clean(metadata.offer_recipient_country)
      : (pickSnapshot(client, ['country']) || pickSnapshot(site, ['country']) || 'Schweiz').split(',')[0].trim(),
    email: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_email')
      ? String(metadata.offer_recipient_email ?? '')
      : pickSnapshot(client, [
          'billing_email',
          'email',
          'primary_email',
          'contact_email',
        ]),
    phone: Object.prototype.hasOwnProperty.call(metadata, 'offer_recipient_phone')
      ? String(metadata.offer_recipient_phone ?? '')
      : pickSnapshot(client, [
          'billing_phone_e164',
          'phone_e164',
          'phone_raw',
          'phone',
          'mobile',
          'telephone',
        ]),
  };
}

function getQuoteClientDisplayName(
  quote?: QuoteRow | null,
) {
  const client = snapshotObject(
    quote?.client_snapshot,
  );

  const recipient =
    getOfferRecipientFields(quote);

  return (
    pickSnapshot(client, [
      'billing_name',
      'company_name',
      'business_name',
      'full_name',
      'contact_name',
      'name',
    ]) ||
    recipient.companyName ||
    [recipient.firstName, recipient.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Kundendetails'
  );
}

function buildOfferSalutation(fields: ReturnType<typeof getOfferRecipientFields>) {
  const form = clean(fields.formOfAddress).toLocaleLowerCase('de-CH');
  if (form.includes('herr')) return `Sehr geehrter Herr ${fields.lastName || fields.firstName}`.trim();
  if (form.includes('frau')) return `Sehr geehrte Frau ${fields.lastName || fields.firstName}`.trim();
  return 'Sehr geehrte Damen und Herren';
}

function introHasSalutation(value: unknown) {
  return /^(sehr geehrte|sehr geehrter|guten tag|liebe|lieber|grüezi|grüezi mitenand)/i.test(clean(value));
}

function ensureEditableIntroText(quote?: QuoteRow | null) {
  const current = clean(quote?.intro_text);
  const salutation = buildOfferSalutation(getOfferRecipientFields(quote));
  const body = current || 'Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen unsere Offerte für die gewünschten Reinigungsleistungen.';
  return introHasSalutation(body) ? body : `${salutation}\n\n${body}`;
}

function replaceIntroSalutation(value: string, salutation: string) {
  const source = String(value || '').trim();
  if (!source) return `${salutation}\n\n`;

  const paragraphs = source.split(/\n\s*\n/);
  if (introHasSalutation(paragraphs[0])) {
    paragraphs[0] = salutation;
    return paragraphs.join('\n\n');
  }

  return `${salutation}\n\n${source}`;
}

function getPriceInputMode(quote?: QuoteRow | null): PriceInputMode {
  const metadata = getMetadata(quote);
  return metadata.price_input_mode === 'incl' ? 'incl' : 'excl';
}

function getDefaultGreeting(quote?: QuoteRow | null) {
  return clean(quote?.customer_notes) || OPC_DEFAULT_CLOSING;
}

function migrateLegacyServiceDescription(scopeValue: unknown, descriptionValue: unknown) {
  const scope = clean(scopeValue);
  const description = clean(descriptionValue);
  const looksLikeLegacyDescription =
    !description &&
    Boolean(scope) &&
    (scope.includes('\n') || scope.startsWith('•') || scope.length > 180);

  if (!looksLikeLegacyDescription) {
    return { scopeText: scopeValue || '', descriptionText: descriptionValue || '' };
  }

  const cleanedDescription = scope
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Leistungsumfang$/i.test(line))
    .filter((line) => !/^(Leistung|Objektart|Objekttyp|Zimmer|Fläche|Flaeche)\s*:/i.test(line))
    .join('\n');

  return {
    scopeText: '',
    descriptionText: cleanedDescription,
  };
}

function normalizeQuoteAfterLoad(row: QuoteRow | null) {
  if (!row) return row;

  const issueDate = isoDate(row.issue_date) || new Date().toISOString().slice(0, 10);
  const validUntil = isoDate(row.valid_until);
  const metadata = getMetadata(row);
  const migratedDescription = migrateLegacyServiceDescription(
    row.scope_text,
    row.service_description_text,
  );

  const normalized = {
    ...row,
    issue_date: issueDate,
    valid_until: validUntil && validUntil !== issueDate ? validUntil : addDays(issueDate, 14),
    scope_text: migratedDescription.scopeText,
    service_description_text: migratedDescription.descriptionText,
    customer_notes: getDefaultGreeting(row),
    metadata: {
      ...metadata,
      price_input_mode: metadata.price_input_mode === 'incl' ? 'incl' : 'excl',
    },
  };

  return {
    ...normalized,
    intro_text: ensureEditableIntroText(normalized),
  };
}

function getItemInputPrice(item: QuoteItem, mode: PriceInputMode) {
  const metadata = getMetadata(item);
  if (metadata.input_price_chf !== undefined && metadata.input_price_chf !== null && String(metadata.input_price_chf) !== '') {
    return String(metadata.input_price_chf);
  }

  const unitPrice = Number(item.unit_price_chf || 0);
  const taxRate = Number(item.tax_rate || 8.1);

  if (mode === 'incl') {
    return formatPlainMoney(unitPrice * (1 + taxRate / 100));
  }

  return formatPlainMoney(unitPrice);
}

function normalizePdfFileName(value: unknown, fallback: string) {
  const source = clean(value) || fallback;
  const safe = source.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function buildQuoteFileName(quote: QuoteRow, suffix = 'Offerte') {
  const number = clean(quote.quote_number) || 'Offerte';
  const metadata = getMetadata(quote);
  const isOrderConfirmation = suffix === 'Auftragsbestaetigung';
  const override = isOrderConfirmation
    ? metadata.order_confirmation_filename
    : metadata.offer_filename;
  const documentNumber = isOrderConfirmation
    ? clean(metadata.order_confirmation_number) || deriveOpcDocumentNumber(quote.quote_number, 'AB') || number
    : number;
  return normalizePdfFileName(override, `${documentNumber}_${suffix}.pdf`);
}

export default function QuoteDetailPage({ quoteId }: QuoteDetailPageProps) {
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAction, setCreatingAction] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void loadQuote({ clearMessages: true });
  }, [quoteId]);

  const priceInputMode = getPriceInputMode(quote);
  const offerRecipient = getOfferRecipientFields(quote);
  const generatedSalutation = buildOfferSalutation(offerRecipient);
  const linkedClientName = getQuoteClientDisplayName(quote);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal_chf || 0), 0);
    const discount = Number(quote?.discount_chf || 0);
    const taxable = Math.max(subtotal - discount, 0);
    const taxRate = Number(quote?.tax_rate || 8.1);
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;
    return { subtotal, discount, taxRate, tax, total };
  }, [items, quote?.discount_chf, quote?.tax_rate]);

  async function loadQuote(options: { clearMessages?: boolean } = {}) {
    setLoading(true);
    if (options.clearMessages) {
      setErrorMessage('');
      setSuccessMessage('');
    }

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const [quoteResponse, itemsResponse] = await Promise.all([
        supabase.from('opc_quotes').select('*').eq('id', quoteId).single(),
        supabase.from('opc_quote_items').select('*').eq('quote_id', quoteId).order('sort_order', { ascending: true }),
      ]);

      if (quoteResponse.error) throw quoteResponse.error;
      if (itemsResponse.error) throw itemsResponse.error;

      setQuote(normalizeQuoteAfterLoad(quoteResponse.data));
      setItems(itemsResponse.data || []);

      void (async () => {
        try {
          const templatesResponse = await supabase
            .from('opc_service_description_templates')
            .select('*')
            .eq('status', 'active')
            .order('title', { ascending: true });

          if (templatesResponse.error) {
            console.warn('Offertenvorlagen konnten nicht geladen werden:', templatesResponse.error.message);
            return;
          }

          setTemplates(templatesResponse.data || []);
        } catch (templateError) {
          console.warn('Offertenvorlagen konnten nicht geladen werden:', templateError);
        }
      })();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Offerte konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  function updateQuoteField(key: string, value: any) {
    setQuote((previous) => previous ? { ...previous, [key]: value } : previous);
  }

  function updateQuoteMetadata(key: string, value: any) {
    setQuote((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        metadata: {
          ...getMetadata(previous),
          [key]: value,
        },
      };
    });
  }

  function updateItem(index: number, key: string, value: any) {
    setItems((previous) => {
      const next = [...previous];
      const item = { ...next[index], [key]: value };

      const quantity = toNumber(item.quantity || 1) || 1;
      const unitPrice = toNumber(item.unit_price_chf || 0);
      const discount = toNumber(item.discount_chf || 0);
      const taxRate = toNumber(item.tax_rate || quote?.tax_rate || 8.1) || 8.1;
      const subtotal = Math.max(quantity * unitPrice - discount, 0);
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      next[index] = {
        ...item,
        quantity,
        unit_price_chf: roundMoney(unitPrice),
        discount_chf: roundMoney(discount),
        tax_rate: roundMoney(taxRate),
        subtotal_chf: roundMoney(subtotal),
        tax_chf: roundMoney(tax),
        total_chf: roundMoney(total),
      };

      return next;
    });
  }

  function updateItemPriceInput(index: number, value: string) {
    setItems((previous) => {
      const next = [...previous];
      const item = { ...next[index] };
      const taxRate = toNumber(item.tax_rate || quote?.tax_rate || 8.1) || 8.1;
      const parsed = parseSwissMoney(value);
      const unitPriceExcl = priceInputMode === 'incl' ? parsed / (1 + taxRate / 100) : parsed;
      const quantity = toNumber(item.quantity || 1) || 1;
      const discount = toNumber(item.discount_chf || 0);
      const subtotal = Math.max(quantity * unitPriceExcl - discount, 0);
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      next[index] = {
        ...item,
        unit_price_chf: roundMoney(unitPriceExcl),
        subtotal_chf: roundMoney(subtotal),
        tax_chf: roundMoney(tax),
        total_chf: roundMoney(total),
        metadata: {
          ...getMetadata(item),
          input_price_chf: value,
          input_price_mode: priceInputMode,
        },
      };

      return next;
    });
  }

  function addItem() {
    setItems((previous) => [
      ...previous,
      {
        id: `local-${Date.now()}`,
        quote_id: quoteId,
        sort_order: previous.length + 1,
        item_type: 'service',
        title: 'Neue Position',
        description: '',
        quantity: 1,
        unit: 'pauschal',
        unit_price_chf: 0,
        discount_chf: 0,
        tax_rate: Number(quote?.tax_rate || 8.1),
        subtotal_chf: 0,
        tax_chf: 0,
        total_chf: 0,
        metadata: {
          input_price_chf: '',
          input_price_mode: priceInputMode,
        },
        isLocal: true,
      },
    ]);
  }

  async function removeItem(item: QuoteItem, index: number) {
    if (!supabase) return;

    if (!String(item.id).startsWith('local-')) {
      const { error } = await supabase.from('opc_quote_items').delete().eq('id', item.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
    }

    setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    updateQuoteField('service_description_template_id', template.id);
    updateQuoteField('service_description_text', template.description_text || '');
  }

  async function saveQuote(nextStatus?: string, options: { silent?: boolean } = {}) {
    if (!quote) return quote;

    setSaving(true);
    setErrorMessage('');
    if (!options.silent) setSuccessMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const issueDate = quote.issue_date || new Date().toISOString().slice(0, 10);
      const validUntil = quote.valid_until || addDays(issueDate, 14);
      const status = nextStatus || quote.status || 'draft';
      const correctedQuoteNumber = clean(quote.quote_number);
      const now = new Date().toISOString();

      if (DOCUMENT_CORRECTION_MODE) {
        if (!correctedQuoteNumber) throw new Error('Die Offertennummer darf im Korrekturmodus nicht leer sein.');

        const { data: duplicate, error: duplicateError } = await supabase
          .from('opc_quotes')
          .select('id, quote_number')
          .eq('quote_number', correctedQuoteNumber)
          .neq('id', quote.id)
          .limit(1)
          .maybeSingle();

        if (duplicateError) throw duplicateError;
        if (duplicate) throw new Error(`Die Offertennummer ${correctedQuoteNumber} wird bereits verwendet.`);
      }

      const quotePayload = {
        ...(DOCUMENT_CORRECTION_MODE ? { quote_number: correctedQuoteNumber } : {}),
        status,
        title: normalizeServiceTitle(quote.title) || 'Reinigungsleistung',
        quote_type: quote.quote_type || 'standard',
        issue_date: issueDate,
        valid_until: validUntil,
        intro_text: quote.intro_text || null,
        scope_text: quote.scope_text || null,
        service_description_mode: quote.service_description_mode || 'embedded',
        service_description_template_id: quote.service_description_template_id || null,
        service_description_text: quote.service_description_text || null,
        terms_text: quote.terms_text || null,
        payment_terms: quote.payment_terms || null,
        acceptance_terms: quote.acceptance_terms || null,
        internal_notes: quote.internal_notes || null,
        customer_notes: quote.customer_notes || null,
        subtotal_chf: roundMoney(totals.subtotal),
        discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        sent_at: nextStatus === 'sent' && !quote.sent_at ? now : quote.sent_at || null,
        accepted_at: nextStatus === 'accepted' && !quote.accepted_at ? now : quote.accepted_at || null,
        updated_at: now,
        metadata: {
          ...getMetadata(quote),
          price_input_mode: priceInputMode,
        },
      };

      const preparedItems = items.map((item, index) => {
        const payload = {
          quote_id: quote.id,
          sort_order: index + 1,
          item_type: item.item_type || 'service',
          title: clean(item.title) || 'Position',
          description: item.description || null,
          quantity: toNumber(item.quantity || 1) || 1,
          unit: item.unit || 'pauschal',
          unit_price_chf: roundMoney(toNumber(item.unit_price_chf)),
          discount_chf: roundMoney(toNumber(item.discount_chf)),
          tax_rate: roundMoney(toNumber(item.tax_rate || totals.taxRate) || 8.1),
          subtotal_chf: roundMoney(toNumber(item.subtotal_chf)),
          tax_chf: roundMoney(toNumber(item.tax_chf)),
          total_chf: roundMoney(toNumber(item.total_chf)),
          updated_at: now,
          metadata: {
            ...getMetadata(item),
            input_price_mode: priceInputMode,
          },
        };

        return {
          item,
          payload,
          isLocal: Boolean(item.isLocal) || String(item.id || '').startsWith('local-'),
        };
      });

      const { data: savedQuote, error: quoteError } = await supabase
        .from('opc_quotes')
        .update(quotePayload)
        .eq('id', quote.id)
        .select('*')
        .single();

      if (quoteError) throw quoteError;

      const existingPayloads = preparedItems
        .filter((entry) => !entry.isLocal)
        .map((entry) => ({
          id: entry.item.id,
          ...entry.payload,
        }));

      const newPayloads = preparedItems
        .filter((entry) => entry.isLocal)
        .map((entry) => entry.payload);

      const existingRequest = existingPayloads.length
        ? supabase
            .from('opc_quote_items')
            .upsert(existingPayloads, { onConflict: 'id' })
            .select('*')
        : Promise.resolve({ data: [] as QuoteItem[], error: null });

      const newRequest = newPayloads.length
        ? supabase
            .from('opc_quote_items')
            .insert(newPayloads)
            .select('*')
        : Promise.resolve({ data: [] as QuoteItem[], error: null });

      const [existingResponse, newResponse] = await Promise.all([
        existingRequest,
        newRequest,
      ]);

      if (existingResponse.error) throw existingResponse.error;
      if (newResponse.error) throw newResponse.error;

      const savedItems = [
        ...(existingResponse.data || []),
        ...(newResponse.data || []),
      ].sort((left: QuoteItem, right: QuoteItem) =>
        Number(left.sort_order || 0) - Number(right.sort_order || 0)
      );

      setItems(savedItems);

      const nextQuote = normalizeQuoteAfterLoad(
        savedQuote || {
          ...quote,
          ...quotePayload,
        },
      );

      setQuote(nextQuote);

      const { error: eventError } = await supabase
        .from('opc_quote_events')
        .insert({
          quote_id: quote.id,
          client_id: quote.client_id,
          event_type: nextStatus && nextStatus !== quote.status ? 'status_changed' : 'updated',
          message: nextStatus && nextStatus !== quote.status ? `Status auf ${nextStatus} geändert.` : 'Offerte gespeichert.',
          previous_status: quote.status || null,
          new_status: status,
        });

      if (eventError) {
        console.warn('Offerten-Ereignis konnte nicht protokolliert werden:', eventError.message);
      }

      const savedTime = new Date().toLocaleTimeString('de-CH', {
        hour: '2-digit',
        minute: '2-digit',
      });

      setLastSavedAt(savedTime);
      if (!options.silent) setSuccessMessage(`Gespeichert um ${savedTime}.`);

      return nextQuote;
    } catch (error: any) {
      const message =
        error?.message === 'Load failed' || error?.message === 'Failed to fetch'
          ? 'Die Verbindung wurde während des Speicherns unterbrochen. Bitte nochmals versuchen.'
          : error?.message || 'Offerte konnte nicht gespeichert werden.';

      setErrorMessage(message);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function buildQuotePdfInput(documentType: 'quote' | 'order_confirmation' = 'quote') {
    if (!quote) return null;

    return {
      quote: {
        ...quote,
        title: normalizeServiceTitle(quote.title) || 'Reinigungsleistung',
      },
      items,
      totals: {
        subtotal: roundMoney(totals.subtotal),
        discount: roundMoney(totals.discount),
        taxRate: roundMoney(totals.taxRate),
        tax: roundMoney(totals.tax),
        total: roundMoney(totals.total),
      },
      documentType,
    };
  }

  async function generateQuotePdf(documentType: 'quote' | 'order_confirmation' = 'quote') {
    const input = buildQuotePdfInput(documentType);
    if (!input) return null;
    return await generateQuotePdfDocument(input);
  }

  async function generateQuotePdfBase64(filename: string, documentType: 'quote' | 'order_confirmation' = 'quote') {
    const input = buildQuotePdfInput(documentType);
    if (!input) return null;

    const html = buildQuoteHtml(input);
    const rendered = await renderHtmlToPdfBase64(html, filename);
    if (rendered?.base64) return rendered.base64;

    const fallbackDoc = await generateQuotePdfDocument(input);
    return pdfToBase64(fallbackDoc);
  }

  // OPC_QUOTE_DUPLICATION_20260706
  async function handleDuplicateQuote() {
    if (
      !quote ||
      !supabase ||
      saving ||
      creatingAction !== ''
    ) {
      return;
    }

    setCreatingAction('duplicate_quote');
    setErrorMessage('');
    setSuccessMessage('');

    let createdQuoteId = '';

    try {
      const saved = await saveQuote(
        undefined,
        { silent: true },
      );

      if (!saved) {
        throw new Error(
          'Die Offerte konnte vor dem Duplizieren nicht gespeichert werden.',
        );
      }

      const today =
        new Date().toISOString().slice(0, 10);

      const originalIssueDate =
        isoDate(quote.issue_date);

      const originalValidUntil =
        isoDate(quote.valid_until);

      let validityDays = 14;

      if (
        originalIssueDate &&
        originalValidUntil
      ) {
        const issueTimestamp = new Date(
          `${originalIssueDate}T12:00:00`,
        ).getTime();

        const validTimestamp = new Date(
          `${originalValidUntil}T12:00:00`,
        ).getTime();

        const difference = Math.round(
          (
            validTimestamp -
            issueTimestamp
          ) / 86_400_000,
        );

        if (
          Number.isFinite(difference) &&
          difference >= 0
        ) {
          validityDays = difference;
        }
      }

      const originalNumber =
        clean(quote.quote_number);

      const originalTitle =
        normalizeServiceTitle(quote.title) ||
        'Reinigungsleistung';

      const duplicateMetadata:
        Record<string, any> = {
          ...getMetadata(quote),
          created_from: 'quote_duplicate',
          duplicated_from_quote_id:
            quote.id,
          duplicated_from_quote_number:
            quote.quote_number || null,
          duplicated_at:
            new Date().toISOString(),
        };

      [
        'offer_filename',
        'order_confirmation_number',
        'order_confirmation_title',
        'order_confirmation_filename',
        'invoice_id',
        'invoice_number',
        'job_id',
        'service_job_id',
        'automation_run_id',
        'automation_candidate_id',
        'archive_enriched_at',
        'archive_document_key',
        'archive_document_number',
        'archive_document_type',
        'download_strategy',
        'converted_at',
        'invoiced_at',
        'accepted_document_id',
        'created_from_archive_import',
      ].forEach((key) => {
        delete duplicateMetadata[key];
      });

      const quotePayload = {
        client_id:
          quote.client_id,
        contact_id:
          quote.contact_id || null,
        client_site_id:
          quote.client_site_id || null,

        status: 'draft',
        quote_type:
          quote.quote_type || 'standard',

        title: originalTitle,

        language:
          quote.language || 'de',
        currency:
          quote.currency || 'CHF',

        issue_date: today,
        valid_until:
          addDays(today, validityDays),

        client_snapshot:
          quote.client_snapshot || {},
        site_snapshot:
          quote.site_snapshot || {},

        intro_text:
          quote.intro_text || null,
        scope_text:
          quote.scope_text || null,

        service_description_mode:
          quote.service_description_mode ||
          'embedded',

        service_description_template_id:
          quote.service_description_template_id ||
          null,

        service_description_text:
          quote.service_description_text ||
          null,

        terms_text:
          quote.terms_text || null,
        payment_terms:
          quote.payment_terms || null,
        acceptance_terms:
          quote.acceptance_terms || null,

        internal_notes:
          quote.internal_notes || null,
        customer_notes:
          quote.customer_notes || null,

        estimated_hours:
          quote.estimated_hours || null,

        estimated_staff_count:
          quote.estimated_staff_count || null,

        subtotal_chf:
          roundMoney(totals.subtotal),
        discount_chf:
          roundMoney(totals.discount),
        tax_rate:
          roundMoney(totals.taxRate),
        tax_chf:
          roundMoney(totals.tax),
        total_chf:
          roundMoney(totals.total),

        sent_at: null,
        accepted_at: null,

        metadata: duplicateMetadata,
      };

      const {
        data: createdQuote,
        error: quoteError,
      } = await supabase
        .from('opc_quotes')
        .insert(quotePayload)
        .select('id, quote_number')
        .single();

      if (quoteError) {
        throw quoteError;
      }

      if (!createdQuote?.id) {
        throw new Error(
          'Die neue Offerte wurde ohne ID angelegt.',
        );
      }

      createdQuoteId =
        createdQuote.id;

      const newNumber =
        clean(createdQuote.quote_number);

      const replaceOldNumber = (
        value: unknown,
      ) => {
        const source = clean(value);

        if (
          !source ||
          !originalNumber ||
          !newNumber
        ) {
          return source;
        }

        return source
          .split(originalNumber)
          .join(newNumber);
      };

      const finalizedMetadata = {
        ...duplicateMetadata,
      };

      [
        'offer_document_title',
        'offer_print_title',
      ].forEach((key) => {
        if (finalizedMetadata[key]) {
          finalizedMetadata[key] =
            replaceOldNumber(
              finalizedMetadata[key],
            );
        }
      });

      const finalizedTitle =
        replaceOldNumber(originalTitle) ||
        originalTitle;

      const {
        error: finalizeError,
      } = await supabase
        .from('opc_quotes')
        .update({
          title: finalizedTitle,
          metadata: finalizedMetadata,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', createdQuote.id);

      if (finalizeError) {
        throw finalizeError;
      }

      if (items.length > 0) {
        const duplicateItems =
          items.map((item, index) => ({
            quote_id:
              createdQuote.id,

            sort_order:
              index + 1,

            item_type:
              item.item_type || 'service',

            title:
              clean(item.title) ||
              'Position',

            description:
              item.description || null,

            quantity:
              toNumber(
                item.quantity || 1,
              ) || 1,

            unit:
              item.unit || 'pauschal',

            unit_price_chf:
              roundMoney(
                toNumber(
                  item.unit_price_chf,
                ),
              ),

            discount_chf:
              roundMoney(
                toNumber(
                  item.discount_chf,
                ),
              ),

            tax_rate:
              roundMoney(
                toNumber(
                  item.tax_rate ||
                  totals.taxRate,
                ) || 8.1,
              ),

            subtotal_chf:
              roundMoney(
                toNumber(
                  item.subtotal_chf,
                ),
              ),

            tax_chf:
              roundMoney(
                toNumber(
                  item.tax_chf,
                ),
              ),

            total_chf:
              roundMoney(
                toNumber(
                  item.total_chf,
                ),
              ),

            metadata: {
              ...getMetadata(item),

              duplicated_from_quote_item_id:
                String(item.id).startsWith(
                  'local-',
                )
                  ? null
                  : item.id,
            },
          }));

        const {
          error: itemError,
        } = await supabase
          .from('opc_quote_items')
          .insert(duplicateItems);

        if (itemError) {
          throw itemError;
        }
      }

      setSuccessMessage(
        `Neue Offerte ${newNumber || ''} wurde als Entwurf erstellt.`,
      );

      window.location.assign(
        `${baseUrl}/offerte/${createdQuote.id}`,
      );
    } catch (error: any) {
      if (
        createdQuoteId &&
        supabase
      ) {
        await supabase
          .from('opc_quote_items')
          .delete()
          .eq(
            'quote_id',
            createdQuoteId,
          );

        await supabase
          .from('opc_quotes')
          .delete()
          .eq(
            'id',
            createdQuoteId,
          );
      }

      setErrorMessage(
        error?.message ||
        'Die Offerte konnte nicht dupliziert werden.',
      );
    } finally {
      setCreatingAction('');
    }
  }

  async function handleDownloadQuotePdf() {
    if (!quote || saving || creatingAction !== '') return;

    setCreatingAction('quote_pdf');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const savedQuote = await saveQuote(undefined, { silent: true });
      const filename = buildQuoteFileName(savedQuote || quote, 'Offerte');
      const input = buildQuotePdfInput('quote');

      if (!input) throw new Error('PDF-Daten konnten nicht vorbereitet werden.');

      let downloaded = false;

      try {
        const html = buildQuoteHtml(input);
        const rendered = await renderHtmlToPdfBase64(html, filename);

        if (rendered?.base64) {
          downloadBase64Pdf(rendered.base64, filename);
          downloaded = true;
        }
      } catch (rendererError) {
        console.warn('HTML-PDF-Renderer fehlgeschlagen; Standard-PDF wird verwendet.', rendererError);
      }

      if (!downloaded) {
        const doc = await generateQuotePdf('quote');
        if (!doc) throw new Error('PDF konnte nicht erstellt werden.');
        downloadPdf(doc, filename);
      }

      setSuccessMessage('PDF wurde erstellt.');
    } catch (error: any) {
      const message =
        error?.message === 'Load failed' || error?.message === 'Failed to fetch'
          ? 'Die PDF-Komponenten konnten nicht geladen werden. Bitte die Seite neu laden und nochmals versuchen.'
          : error?.message || 'PDF konnte nicht erstellt werden.';

      setErrorMessage(message);
    } finally {
      setCreatingAction('');
    }
  }

  async function handleDownloadOrderConfirmation() {
    if (!quote || saving || creatingAction !== '') return;

    setCreatingAction('order_confirmation_pdf');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const savedQuote = await saveQuote('accepted', { silent: true });
      const filename = buildQuoteFileName(savedQuote || quote, 'Auftragsbestaetigung');
      const input = buildQuotePdfInput('order_confirmation');

      if (!input) throw new Error('PDF-Daten konnten nicht vorbereitet werden.');

      let downloaded = false;

      try {
        const html = buildQuoteHtml(input);
        const rendered = await renderHtmlToPdfBase64(html, filename);

        if (rendered?.base64) {
          downloadBase64Pdf(rendered.base64, filename);
          downloaded = true;
        }
      } catch (rendererError) {
        console.warn('HTML-PDF-Renderer fehlgeschlagen; Standard-PDF wird verwendet.', rendererError);
      }

      if (!downloaded) {
        const doc = await generateQuotePdf('order_confirmation');
        if (!doc) throw new Error('Auftragsbestätigung konnte nicht erstellt werden.');
        downloadPdf(doc, filename);
      }

      setSuccessMessage('Auftragsbestätigung wurde erstellt.');
    } catch (error: any) {
      const message =
        error?.message === 'Load failed' || error?.message === 'Failed to fetch'
          ? 'Die PDF-Komponenten konnten nicht geladen werden. Bitte die Seite neu laden und nochmals versuchen.'
          : error?.message || 'Auftragsbestätigung konnte nicht erstellt werden.';

      setErrorMessage(message);
    } finally {
      setCreatingAction('');
    }
  }

  async function createInvoiceFromQuote() {
    if (!quote || !supabase) return;

    setCreatingAction('invoice');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await saveQuote('accepted', { silent: true });

      const invoicePayload = {
        quote_id: quote.id,
        job_id: quote.job_id || null,
        client_id: quote.client_id,
        contact_id: quote.contact_id || null,
        client_site_id: quote.client_site_id || null,
        status: 'draft',
        invoice_type: 'standard',
        title: `Rechnung zu ${quote.quote_number}`,
        language: quote.language || 'de',
        currency: quote.currency || 'CHF',
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: addDays(new Date().toISOString().slice(0, 10), 10),
        client_snapshot: quote.client_snapshot || {},
        site_snapshot: quote.site_snapshot || {},
        quote_snapshot: {
          id: quote.id,
          quote_number: quote.quote_number,
          title: quote.title,
          total_chf: totals.total,
        },
        intro_text: 'Danke für Ihr Vertrauen. Ihre Rechnung setzt sich wie folgt zusammen:',
        payment_terms: quote.payment_terms || 'Zahlbar gemäss Vereinbarung.',
        subtotal_chf: roundMoney(totals.subtotal),
        discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        paid_chf: 0,
        balance_chf: roundMoney(totals.total),
        metadata: {
          created_from: 'quote_detail_page',
          source_quote_id: quote.id,
          source_quote_number: quote.quote_number,
          source_quote_scope_text: quote.scope_text || '',
          source_quote_service_description_text: quote.service_description_text || '',
          customer_greeting: getDefaultGreeting(quote),
        },
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('opc_invoices')
        .insert(invoicePayload)
        .select('id, invoice_number')
        .single();

      if (invoiceError) throw invoiceError;

      const invoiceItems = items.map((item, index) => ({
        invoice_id: invoice.id,
        quote_item_id: String(item.id).startsWith('local-') ? null : item.id,
        sort_order: index + 1,
        title: clean(item.title) || 'Position',
        description: item.description || null,
        quantity: toNumber(item.quantity || 1) || 1,
        unit: item.unit || 'pauschal',
        unit_price_chf: roundMoney(toNumber(item.unit_price_chf)),
        discount_chf: roundMoney(toNumber(item.discount_chf)),
        tax_rate: roundMoney(toNumber(item.tax_rate || totals.taxRate) || 8.1),
        subtotal_chf: roundMoney(toNumber(item.subtotal_chf)),
        tax_chf: roundMoney(toNumber(item.tax_chf)),
        total_chf: roundMoney(toNumber(item.total_chf)),
        metadata: getMetadata(item),
      }));

      if (invoiceItems.length > 0) {
        const { error: itemsError } = await supabase.from('opc_invoice_items').insert(invoiceItems);
        if (itemsError) throw itemsError;
      }

      await supabase.from('opc_quotes').update({ status: 'invoiced', invoiced_at: new Date().toISOString() }).eq('id', quote.id);
      await supabase.from('opc_quote_events').insert({
        quote_id: quote.id,
        client_id: quote.client_id,
        event_type: 'invoice_created',
        message: `Rechnung ${invoice.invoice_number || ''} erstellt.`,
        new_status: 'invoiced',
        metadata: { invoice_id: invoice.id },
      });

      window.location.href = `${baseUrl}/rechnung/${invoice.id}`;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnung konnte nicht erstellt werden.');
    } finally {
      setCreatingAction('');
    }
  }

  async function createJobFromQuote() {
    if (!quote) return;

    try {
      await saveQuote('accepted', { silent: true });

      const prefill = {
        source: 'quote',
        quote_id: quote.id,
        quote_number: quote.quote_number,
        client_id: quote.client_id,
        client_site_id: quote.client_site_id || '',
        contact_id: quote.contact_id || '',
        title: quote.title || `Einsatz aus ${quote.quote_number}`,
        service_category: quote.quote_type || quote.title || 'Reinigung',
        service_description: [quote.scope_text, quote.service_description_text].filter(Boolean).join('\n\n'),
        estimated_hours: quote.estimated_hours || '',
        estimated_staff_count: quote.estimated_staff_count || '',
        internal_notes: quote.internal_notes || '',
        dispatcher_notes: `Erstellt aus Offerte ${quote.quote_number}.`,
        total_chf: roundMoney(totals.total),
        missing_site: !quote.client_site_id,
      };

      try {
        window.localStorage.setItem('opc_quote_job_prefill', JSON.stringify(prefill));
      } catch {
        // localStorage may be blocked. Query parameters still carry the core IDs.
      }

      const params = new URLSearchParams({
        quote_id: quote.id,
        client_id: quote.client_id || '',
      });

      if (quote.client_site_id) params.set('client_site_id', quote.client_site_id);
      if (quote.contact_id) params.set('contact_id', quote.contact_id);

      window.location.href = `${baseUrl}/einsatz-planen?${params.toString()}`;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Einsatzplanung konnte nicht geöffnet werden.');
    }
  }

  async function resolveQuoteRecipientEmail() {
    const editedRecipientEmail =
      clean(offerRecipient.email);

    if (editedRecipientEmail) {
      return editedRecipientEmail;
    }

    const snapshotEmail = getClientEmail(quote?.client_snapshot);
    if (snapshotEmail) return snapshotEmail;

    if (!supabase || !quote) return '';

    if (quote.contact_id) {
      const { data } = await supabase
        .from('opc_contacts')
        .select('email, primary_email, billing_email')
        .eq('id', quote.contact_id)
        .maybeSingle();
      const contactEmail = clean(data?.email || data?.primary_email || data?.billing_email);
      if (contactEmail) return contactEmail;
    }

    const { data } = await supabase
      .from('opc_clients')
      .select('billing_email, email')
      .eq('id', quote.client_id)
      .maybeSingle();

    return clean(data?.billing_email || data?.email);
  }

  async function sendQuoteEmail() {
    if (!quote || !supabase) return;

    setCreatingAction('email');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await saveQuote('sent', { silent: true });
      const recipientEmail = await resolveQuoteRecipientEmail();
      if (!recipientEmail) throw new Error('Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Bitte zuerst beim Kunden eine Rechnungs- oder Kontakt-E-Mail eintragen.');

      const filename = buildQuoteFileName(quote, 'Offerte');
      const pdfBase64 = await generateQuotePdfBase64(filename, 'quote');
      if (!pdfBase64) throw new Error('PDF konnte nicht erstellt werden.');
      const html = buildDocumentEmailHtml({
        title: 'Ihre Offerte',
        headline: 'Ihre Offerte',
        intro: `Guten Tag, im Anhang finden Sie unsere Offerte ${quote.quote_number}. Bei Fragen stehen wir Ihnen gerne zur Verfügung.`,
        documentNumber: quote.quote_number || '',
      });

      await sendDocumentEmail(supabase, {
        to: recipientEmail,
        subject: `Ihre Offerte ${quote.quote_number} – Orange Pro Clean GmbH`,
        html,
        attachments: [{ filename, contentBase64: pdfBase64, contentType: 'application/pdf' }],
        metadata: { quote_id: quote.id, document_type: 'quote' },
      });
      await supabase.from('opc_quote_events').insert({
        quote_id: quote.id,
        client_id: quote.client_id,
        event_type: 'sent',
        message: `Offerte per E-Mail an ${recipientEmail} gesendet.`,
        new_status: 'sent',
      });
      setSuccessMessage(`Offerte wurde per E-Mail an ${recipientEmail} gesendet.`);
      await loadQuote({ clearMessages: false });
    } catch (error: any) {
      setErrorMessage(error?.message || 'E-Mail konnte nicht gesendet werden.');
    } finally {
      setCreatingAction('');
    }
  }

  if (loading) {
    return (
      <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={`/offerte/${quoteId}`} fullWidth hideTopBar>
        <OPCPageShell><div style={emptyStyle}>Offerte wird geladen.</div></OPCPageShell>
      </MirakaDashboardShell>
    );
  }

  if (!quote) {
    return (
      <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={`/offerte/${quoteId}`} fullWidth hideTopBar>
        <OPCPageShell><div style={errorStyle}>{errorMessage || 'Offerte wurde nicht gefunden.'}</div></OPCPageShell>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={`/offerte/${quoteId}`} fullWidth hideTopBar>
      <OPCPageShell>
        <div style={detailTopBarStyle} className="opc-quote-topbar">
          <a
            href={`${baseUrl}/offerten`}
            data-opc-back="true"
            className="opc-quote-back"
            style={detailBackPillStyle}
          >
            <ArrowLeft size={16} />
            Zurück
          </a>

          <div style={detailActionRowStyle} className="opc-quote-action-row">
            <button type="button" disabled={saving} onClick={() => saveQuote()} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
              <Save size={16} />
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
            <button
              type="button"
              disabled={
                saving ||
                creatingAction !== ''
              }
              onClick={() =>
                void handleDuplicateQuote()
              }
              style={{
                ...opcSecondaryButtonStyle,
                width: 'auto',
              }}
            >
              <Copy size={16} />

              {creatingAction ===
              'duplicate_quote'
                ? 'Dupliziert...'
                : 'Offerte duplizieren'}
            </button>
            <button type="button" disabled={saving} onClick={() => saveQuote('ready')} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              Als bereit markieren
            </button>
            <button type="button" disabled={saving} onClick={() => saveQuote('accepted')} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              Angenommen
            </button>
          </div>
        </div>

        <section style={detailHeroStyle} className="opc-quote-hero">
          <div style={detailHeroMainStyle}>
            <p style={eyebrowStyle}>Offerte</p>
            <h1 style={titleStyle} className="opc-quote-title">{quote.quote_number}</h1>

            {quote.client_id ? (
              <a
                href={`${baseUrl}/kunde/${quote.client_id}`}
                style={clientHeroLinkStyle}
              >
                {linkedClientName}
              </a>
            ) : (
              <span style={clientHeroTextStyle}>
                {linkedClientName}
              </span>
            )}

            <p style={subtitleStyle}>{quote.title}</p>
            {lastSavedAt && <p style={savedHintStyle}>Zuletzt gespeichert um {lastSavedAt}</p>}
          </div>

          <div style={detailHeroSideStyle}>
            <span style={quoteStatusBadgeStyle}>{statusLabels[quote.status] || quote.status}</span>
            <div style={totalBoxStyle} className="opc-quote-total-box">
              <span style={totalLabelStyle}>Total inkl. MWST</span>
              <strong style={totalValueStyle}>{formatMoney(totals.total)}</strong>
              <span style={totalSubLabelStyle}>Preisangaben: {priceInputMode === 'incl' ? 'inkl. MWST' : 'exkl. MWST'}</span>
            </div>
          </div>
        </section>

        <div style={quoteDetailMetricsStyle} className="opc-quote-detail-metrics">
          <div style={quoteDetailMetricCardStyle}>
            <div>
              <div style={quoteMetricValueStyle}>{statusLabels[quote.status] || quote.status}</div>
              <div style={quoteMetricLabelStyle}>Status</div>
            </div>
            <div style={quoteMetricIconStyle}><Check size={18} /></div>
          </div>

          <div style={quoteDetailMetricCardStyle}>
            <div>
              <div style={quoteMetricValueStyle}>{formatMoney(totals.total)}</div>
              <div style={quoteMetricLabelStyle}>Total</div>
            </div>
            <div style={quoteMetricIconStyle}><Receipt size={18} /></div>
          </div>

          <div style={quoteDetailMetricCardStyle}>
            <div>
              <div style={quoteMetricValueStyle}>{isoDate(quote.valid_until) || '—'}</div>
              <div style={quoteMetricLabelStyle}>Gültig bis</div>
            </div>
            <div style={quoteMetricIconStyle}><CalendarClock size={18} /></div>
          </div>

          <div style={quoteDetailMetricCardStyle}>
            <div>
              <div style={quoteMetricValueStyle}>{priceInputMode === 'incl' ? 'Inkl.' : 'Exkl.'}</div>
              <div style={quoteMetricLabelStyle}>Preisangaben</div>
            </div>
            <div style={quoteMetricIconStyle}><FileText size={18} /></div>
          </div>
        </div>

        {successMessage && <div style={successStyle}><Check size={16} />{successMessage}</div>}
        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        {DOCUMENT_CORRECTION_MODE && (
          <section style={{ marginBottom: 22 }}>
            <OPCListCard>
              <CardHeader title="Temporärer Dokument-Korrekturmodus" />
              <p style={{ margin: '0 0 16px', color: OPC_BRAND.muted, fontSize: 13 }}>
                Diese Felder dienen nur zur Bereinigung bestehender Dokumente. Nach Abschluss kann der Modus wieder deaktiviert werden; gespeicherte Werte bleiben erhalten.
              </p>
              <div style={fieldGridStyle} className="opc-quote-field-grid">
                <Field label="Offertennummer"><input value={quote.quote_number || ''} onChange={(e) => updateQuoteField('quote_number', e.target.value)} style={inputStyle} /></Field>
                <Field label="Offerten-PDF-Titel"><input value={getMetadata(quote).offer_document_title || ''} onChange={(e) => updateQuoteMetadata('offer_document_title', e.target.value)} style={inputStyle} placeholder={`Offerte ${normalizeServiceTitle(quote.title) || 'Reinigungsleistung'}`} /></Field>
                <Field label="Offerten-Dateiname"><input value={getMetadata(quote).offer_filename || ''} onChange={(e) => updateQuoteMetadata('offer_filename', e.target.value)} style={inputStyle} placeholder={`${quote.quote_number || 'AN-00000'}_Offerte.pdf`} /></Field>
                <Field label="Auftragsbestätigungsnummer"><input value={getMetadata(quote).order_confirmation_number || ''} onChange={(e) => updateQuoteMetadata('order_confirmation_number', e.target.value)} style={inputStyle} placeholder={deriveOpcDocumentNumber(quote.quote_number, 'AB') || 'AB-00000'} /></Field>
                <Field label="Auftragsbestätigungs-PDF-Titel"><input value={getMetadata(quote).order_confirmation_title || ''} onChange={(e) => updateQuoteMetadata('order_confirmation_title', e.target.value)} style={inputStyle} placeholder={`Auftragsbestätigung zur ${normalizeServiceTitle(quote.title) || 'Reinigungsleistung'}`} /></Field>
                <Field label="Auftragsbestätigungs-Dateiname"><input value={getMetadata(quote).order_confirmation_filename || ''} onChange={(e) => updateQuoteMetadata('order_confirmation_filename', e.target.value)} style={inputStyle} placeholder={`${deriveOpcDocumentNumber(quote.quote_number, 'AB') || 'AB-00000'}_Auftragsbestaetigung.pdf`} /></Field>
              </div>
            </OPCListCard>
          </section>
        )}

        <section style={{ marginBottom: 22 }}>
          <OPCListCard>
            <CardHeader title="Nächste Schritte" />
            <div style={quoteNextActionsGridStyle} className="opc-quote-next-actions">
              <button type="button" onClick={handleDownloadQuotePdf} disabled={saving || creatingAction !== ''} style={{ ...opcSecondaryButtonStyle, width: '100%' }}>
                <Download size={16} /> Offerte PDF herunterladen
              </button>
              <button type="button" onClick={sendQuoteEmail} disabled={saving || creatingAction !== ''} style={{ ...opcSecondaryButtonStyle, width: '100%' }}>
                <Mail size={16} /> {creatingAction === 'email' ? 'E-Mail wird gesendet...' : 'Per E-Mail senden'}
              </button>
              <button type="button" onClick={handleDownloadOrderConfirmation} disabled={saving || creatingAction !== ''} style={{ ...opcSecondaryButtonStyle, width: '100%' }}>
                <ClipboardCheck size={16} /> Auftragsbestätigung
              </button>
              <button type="button" onClick={createInvoiceFromQuote} disabled={saving || creatingAction !== ''} style={{ ...opcSecondaryButtonStyle, width: '100%' }}>
                <Receipt size={16} /> {creatingAction === 'invoice' ? 'Rechnung wird erstellt...' : 'Rechnung erstellen'}
              </button>
              <button type="button" onClick={createJobFromQuote} disabled={saving || creatingAction !== ''} style={{ ...opcBlackButtonStyle, width: '100%' }}>
                <CalendarClock size={16} /> {creatingAction === 'job' ? 'Einsatz wird erstellt...' : 'Einsatz planen'}
              </button>
            </div>
          </OPCListCard>
        </section>

        <div style={gridStyle} className="opc-quote-main-grid">
          <OPCListCard>
            <CardHeader title="Offertenkopf" />
            <div style={fieldGridStyle} className="opc-quote-field-grid">
              <Field label="Reinigungsart / Offertentitel"><input value={quote.title || ''} onChange={(e) => updateQuoteField('title', e.target.value)} style={inputStyle} placeholder="z. B. Umzugsreinigung" /></Field>
              <Field label="Status">
                <select value={quote.status || 'draft'} onChange={(e) => updateQuoteField('status', e.target.value)} style={opcSelectStyle}>
                  <option value="draft">Entwurf</option>
                  <option value="ready">Bereit</option>
                  <option value="sent">Gesendet</option>
                  <option value="accepted">Angenommen</option>
                  <option value="declined">Abgelehnt</option>
                  <option value="converted_to_job">Einsatz erstellt</option>
                  <option value="invoiced">Verrechnet</option>
                </select>
              </Field>
              <Field label="Datum"><input type="date" value={isoDate(quote.issue_date)} onChange={(e) => {
                updateQuoteField('issue_date', e.target.value);
                updateQuoteField('valid_until', addDays(e.target.value, 14));
              }} style={inputStyle} /></Field>
              <Field label="Gültig bis"><input type="date" value={isoDate(quote.valid_until)} onChange={(e) => updateQuoteField('valid_until', e.target.value)} style={inputStyle} /></Field>
              <Field label="Preisangaben">
                <select value={priceInputMode} onChange={(e) => updateQuoteMetadata('price_input_mode', e.target.value)} style={opcSelectStyle}>
                  <option value="excl">Preise exkl. MWST eingeben</option>
                  <option value="incl">Preise inkl. MWST eingeben</option>
                </select>
              </Field>
              <Field label="Rabatt CHF"><input value={quote.discount_chf || 0} onChange={(e) => updateQuoteField('discount_chf', e.target.value)} style={inputStyle} inputMode="decimal" /></Field>
              <Field label="MWST %"><input value={quote.tax_rate || 8.1} onChange={(e) => updateQuoteField('tax_rate', e.target.value)} style={inputStyle} inputMode="decimal" /></Field>
            </div>
          </OPCListCard>

          <OPCListCard>
            <CardHeader title="Summen" />
            <div style={summaryStackStyle}>
              <SummaryRow label="Zwischentotal exkl. MWST" value={formatMoney(totals.subtotal)} />
              <SummaryRow label="Rabatt" value={formatMoney(totals.discount)} />
              <SummaryRow label={`MWST ${totals.taxRate}%`} value={formatMoney(totals.tax)} />
              <SummaryRow label="Total inkl. MWST" value={formatMoney(totals.total)} strong />
            </div>
          </OPCListCard>
        </div>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <CardHeader title="Empfänger im PDF" />
            <div style={fieldGridStyle} className="opc-quote-field-grid">
              <Field label="Anrede">
                <input
                  list="opc-offer-recipient-salutations"
                  value={offerRecipient.formOfAddress}
                  onChange={(event) => updateQuoteMetadata('offer_recipient_form_of_address', event.target.value)}
                  style={inputStyle}
                  placeholder="Herr, Frau oder Firma"
                />
                <datalist id="opc-offer-recipient-salutations">
                  <option value="Herr" />
                  <option value="Frau" />
                  <option value="Firma" />
                </datalist>
              </Field>
              <Field label="Vorname"><input value={offerRecipient.firstName} onChange={(event) => updateQuoteMetadata('offer_recipient_first_name', event.target.value)} style={inputStyle} /></Field>
              <Field label="Nachname"><input value={offerRecipient.lastName} onChange={(event) => updateQuoteMetadata('offer_recipient_last_name', event.target.value)} style={inputStyle} /></Field>
              <Field label="Firma (optional)"><input value={offerRecipient.companyName} onChange={(event) => updateQuoteMetadata('offer_recipient_company_name', event.target.value)} style={inputStyle} /></Field>
              <Field label="Strasse und Hausnummer"><input value={offerRecipient.street} onChange={(event) => updateQuoteMetadata('offer_recipient_street', event.target.value)} style={inputStyle} /></Field>
              <Field label="PLZ"><input value={offerRecipient.postalCode} onChange={(event) => updateQuoteMetadata('offer_recipient_postal_code', event.target.value)} style={inputStyle} /></Field>
              <Field label="Ort"><input value={offerRecipient.city} onChange={(event) => updateQuoteMetadata('offer_recipient_city', event.target.value)} style={inputStyle} /></Field>
              <Field label="Land">
                <input
                  value={offerRecipient.country}
                  onChange={(event) =>
                    updateQuoteMetadata(
                      'offer_recipient_country',
                      event.target.value,
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="E-Mail">
                <input
                  type="email"
                  value={offerRecipient.email}
                  onChange={(event) =>
                    updateQuoteMetadata(
                      'offer_recipient_email',
                      event.target.value,
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Telefon">
                <input
                  type="tel"
                  value={offerRecipient.phone}
                  onChange={(event) =>
                    updateQuoteMetadata(
                      'offer_recipient_phone',
                      event.target.value,
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <p style={recipientHintStyle}>
              Diese Angaben steuern den Empfängerblock
              und den Versand dieser Offerte.
              Änderungen gelten für dieses Dokument.

              {quote.client_id ? (
                <>
                  {' '}Die dauerhaften Stammdaten können im{' '}
                  <a
                    href={`${baseUrl}/kunde/${quote.client_id}`}
                    style={recipientProfileLinkStyle}
                  >
                    Kundenprofil
                  </a>
                  {' '}bearbeitet werden.
                </>
              ) : null}
            </p>
          </OPCListCard>
        </section>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <CardHeader title="Texte & Leistungsbeschreibung" />
            <div style={textGridStyle} className="opc-quote-text-grid">
              <EditableTextArea
                label="Einleitung inklusive Anrede"
                value={quote.intro_text || ''}
                onChange={(value) => updateQuoteField('intro_text', value)}
                actionLabel="Anrede aus Empfänger übernehmen"
                onAction={() => updateQuoteField('intro_text', replaceIntroSalutation(quote.intro_text || '', generatedSalutation))}
              />
              <EditableTextArea label="Leistungsumfang (optional)" value={quote.scope_text || ''} onChange={(value) => updateQuoteField('scope_text', value)} />
              <Field label="Leistungsbeschreibung Modus">
                <select value={quote.service_description_mode || 'embedded'} onChange={(e) => updateQuoteField('service_description_mode', e.target.value)} style={opcSelectStyle}>
                  <option value="embedded">In Offerte enthalten</option>
                  <option value="separate_document">Separates Dokument</option>
                  <option value="embedded_and_separate">In Offerte + separates Dokument</option>
                  <option value="none">Keine Leistungsbeschreibung</option>
                </select>
              </Field>
              <Field label="Vorlage übernehmen">
                <select value={quote.service_description_template_id || ''} onChange={(e) => applyTemplate(e.target.value)} style={opcSelectStyle}>
                  <option value="">Keine Vorlage</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                </select>
              </Field>
              <EditableTextArea label="Leistungsbeschreibung" value={quote.service_description_text || ''} onChange={(value) => updateQuoteField('service_description_text', value)} wide />
              <EditableTextArea label="Bedingungen (optional)" value={quote.terms_text || ''} onChange={(value) => updateQuoteField('terms_text', value)} />
              <EditableTextArea label="Zahlungsbedingungen (optional)" value={quote.payment_terms || ''} onChange={(value) => updateQuoteField('payment_terms', value)} />
              <EditableTextArea label="Grusszeile unten" value={quote.customer_notes || ''} onChange={(value) => updateQuoteField('customer_notes', value)} wide />
              <EditableTextArea label="Interne Notizen" value={quote.internal_notes || ''} onChange={(value) => updateQuoteField('internal_notes', value)} wide />
            </div>
          </OPCListCard>
        </section>


        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <div style={cardHeaderWithActionStyle}>
              <CardHeader title="Positionen" compact />
              <button type="button" onClick={addItem} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}><Plus size={16} />Position</button>
            </div>

            <div style={itemsStackStyle} className="opc-quote-items-stack">
              {items.map((item, index) => (
                <div key={item.id || index} style={itemCardStyle}>
                  <div style={itemGridStyle} className="opc-quote-item-grid">
                    <Field label="Reinigungsart / Positionstitel"><input value={item.title || ''} onChange={(e) => updateItem(index, 'title', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Einheit (intern)"><input value={item.unit || 'pauschal'} onChange={(e) => updateItem(index, 'unit', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Menge"><input value={item.quantity || 1} onChange={(e) => updateItem(index, 'quantity', e.target.value)} style={inputStyle} inputMode="decimal" /></Field>
                    <Field label={priceInputMode === 'incl' ? 'Preis Eingabe inkl. CHF' : 'Preis Eingabe exkl. CHF'}>
                      <input
                        value={getItemInputPrice(item, priceInputMode)}
                        onChange={(e) => updateItemPriceInput(index, e.target.value)}
                        style={inputStyle}
                        inputMode="decimal"
                        placeholder={priceInputMode === 'incl' ? 'z.B. CHF 1’250.00' : 'z.B. 1156.34'}
                      />
                    </Field>
                    <div style={itemTotalStyle} className="opc-quote-item-total">{formatMoney(item.total_chf)}</div>
                    <button type="button" onClick={() => removeItem(item, index)} style={iconButtonStyle}><Trash2 size={16} /></button>
                  </div>
                  <div style={itemHintStyle}>
                    Intern gespeichert: {formatMoney(item.unit_price_chf)} exkl. MWST · Total: {formatMoney(item.total_chf)} inkl. MWST
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <EditableTextArea
                      label="Beschreibung / Zusatztext im Offerten-PDF"
                      value={item.description || ''}
                      onChange={(value) =>
                        updateItem(
                          index,
                          'description',
                          value,
                        )
                      }
                      wide
                    />
                  </div>
                </div>
              ))}
            </div>
          </OPCListCard>
        </section>

        <style>{`
          ${opcResponsiveStyle}

          .opc-quote-topbar {
            flex-wrap: wrap;
          }

          .opc-quote-action-row > button,
          .opc-quote-action-row > a {
            min-height: 40px;
            border-radius: 13px !important;
          }

          .opc-quote-hero {
            align-items: stretch;
          }

          .opc-quote-detail-metrics {
            margin-bottom: 22px;
          }

          .opc-quote-next-actions {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            padding: 18px 20px;
          }

          .opc-quote-next-actions > button {
            min-height: 42px;
            border-radius: 13px !important;
          }

          .opc-quote-field-grid input,
          .opc-quote-field-grid select,
          .opc-quote-text-grid input,
          .opc-quote-text-grid select,
          .opc-quote-item-grid input,
          .opc-quote-item-grid select {
            min-height: 46px;
            border-radius: 14px !important;
            font-size: 14px !important;
            font-weight: 650 !important;
          }

          @media (max-width: 980px) {
            .opc-quote-main-grid {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
            }

            .opc-quote-field-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 14px !important;
            }

            .opc-quote-item-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 14px !important;
            }

            .opc-quote-text-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 14px !important;
            }
          }

          @media (max-width: 760px) {
            .opc-quote-topbar {
              flex-direction: row !important;
              align-items: center !important;
              gap: 10px !important;
            }

            .opc-quote-back {
              width: auto !important;
            }

            .opc-quote-action-row {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              width: 100% !important;
              gap: 8px !important;
            }

            .opc-quote-action-row > * {
              width: 100% !important;
            }

            .opc-quote-hero {
              flex-direction: column !important;
              padding: 18px !important;
              border-radius: 18px !important;
            }

            .opc-quote-title {
              font-size: 30px !important;
              line-height: 0.98 !important;
              overflow-wrap: anywhere !important;
            }

            .opc-quote-total-box {
              width: 100% !important;
              min-width: 0 !important;
              box-sizing: border-box !important;
            }

            .opc-quote-detail-metrics {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px !important;
            }

            .opc-quote-next-actions {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              padding: 16px !important;
            }

            .opc-quote-field-grid,
            .opc-quote-text-grid,
            .opc-quote-items-stack {
              padding: 16px !important;
            }

            .opc-quote-item-total {
              min-height: auto !important;
              padding: 8px 0 0 !important;
            }
          }

          @media (max-width: 560px) {
            .opc-quote-field-grid,
            .opc-quote-item-grid,
            .opc-quote-text-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

function CardHeader({ title, compact = false }: { title: string; compact?: boolean }) {
  return <div style={{ ...cardHeaderStyle, borderBottom: compact ? 'none' : `1px solid ${OPC_BRAND.border}` }}><h2 style={cardTitleStyle}>{title}</h2></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span style={labelStyle}>{label}</span>{children}</label>;
}

function EditableTextArea({
  label,
  value,
  onChange,
  wide = false,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  }

  function formatSelectedLines(mode: 'bullet' | 'plain' | 'heading') {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
    const nextBreak = value.indexOf('\n', selectionEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const selectedBlock = value.slice(lineStart, lineEnd);
    const sourceLines = selectedBlock ? selectedBlock.split('\n') : [''];

    const formattedLines = sourceLines.map((line) => {
      const plainLine = line
        .replace(/^\s*(?:[•*-]\s+|#{1,3}\s+)/, '')
        .trimEnd();

      if (mode === 'bullet') return `• ${plainLine}`;
      if (mode === 'heading') return `## ${plainLine}`;
      return plainLine;
    });

    const replacement = formattedLines.join('\n');
    const nextValue = `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`;

    onChange(nextValue);
    restoreSelection(lineStart, lineStart + replacement.length);
  }

  function formatBold() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const replacement = selected ? `**${selected}**` : '****';
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

    onChange(nextValue);

    if (selected) {
      restoreSelection(start, start + replacement.length);
    } else {
      restoreSelection(start + 2, start + 2);
    }
  }

  function insertParagraphSpacing() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? start;
    const replacement = '\n\n';
    const nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;

    onChange(nextValue);
    restoreSelection(start + replacement.length, start + replacement.length);
  }

  const preventToolbarBlur = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <label style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <span style={labelStyle}>{label}</span>

      <div style={editorToolbarStyle}>
        <button type="button" onMouseDown={preventToolbarBlur} onClick={() => formatSelectedLines('heading')} style={editorToolButtonStyle}>
          Überschrift
        </button>
        <button type="button" onMouseDown={preventToolbarBlur} onClick={formatBold} style={editorToolButtonStyle}>
          Fett
        </button>
        <button type="button" onMouseDown={preventToolbarBlur} onClick={() => formatSelectedLines('bullet')} style={editorToolButtonStyle}>
          • Aufzählung
        </button>
        <button type="button" onMouseDown={preventToolbarBlur} onClick={() => formatSelectedLines('plain')} style={editorToolButtonStyle}>
          Normaler Text
        </button>
        <button type="button" onMouseDown={preventToolbarBlur} onClick={insertParagraphSpacing} style={editorToolButtonStyle}>
          Absatzabstand
        </button>
        {onAction && actionLabel ? (
          <button type="button" onMouseDown={preventToolbarBlur} onClick={onAction} style={editorToolButtonStyle}>
            {actionLabel}
          </button>
        ) : null}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={wide ? 12 : 8}
        style={textareaStyle}
      />

      <span style={editorHintStyle}>
        Leerzeilen bleiben im PDF erhalten. Überschriften und markierter fetter Text werden ebenfalls übernommen.
      </span>
    </label>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={summaryRowStyle}><span>{label}</span><strong style={{ fontSize: strong ? 18 : 14 }}>{value}</strong></div>;
}

const recipientHintStyle: CSSProperties = {
  margin: '12px 0 0',
  color: OPC_BRAND.muted,
  fontSize: 12,
  lineHeight: 1.5,
};

const clientHeroLinkStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 8,
  color: OPC_BRAND.text,
  fontSize: 15,
  fontWeight: 820,
  textDecoration: 'underline',
  textUnderlineOffset: 4,
};

const clientHeroTextStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 8,
  color: OPC_BRAND.text,
  fontSize: 15,
  fontWeight: 820,
};

const recipientProfileLinkStyle: CSSProperties = {
  color: OPC_BRAND.text,
  fontWeight: 820,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

const editorToolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginBottom: 7,
};

const editorToolButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 10px',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 9,
  background: '#FFFFFF',
  color: OPC_BRAND.text,
  fontSize: 11,
  fontWeight: 750,
  cursor: 'pointer',
};

const editorHintStyle: CSSProperties = {
  display: 'block',
  marginTop: 7,
  color: OPC_BRAND.muted,
  fontSize: 11,
  lineHeight: 1.4,
};

const detailTopBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 14,
  marginBottom: 14,
};

const detailBackPillStyle: CSSProperties = {
  ...opcSecondaryButtonStyle,
  width: 'auto',
  minHeight: 38,
  borderRadius: 999,
  padding: '0 14px',
};

const detailActionRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
};

const detailHeroStyle: CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 20,
  padding: 22,
  marginBottom: 14,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
};

const detailHeroMainStyle: CSSProperties = {
  minWidth: 0,
};

const detailHeroSideStyle: CSSProperties = {
  minWidth: 240,
  display: 'grid',
  gap: 10,
  alignContent: 'start',
  justifyItems: 'end',
};

const quoteStatusBadgeStyle: CSSProperties = {
  minHeight: 32,
  minWidth: 132,
  padding: '0 13px',
  borderRadius: 999,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#F9FAFB',
  color: OPC_BRAND.text,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 780,
  whiteSpace: 'nowrap',
};

const quoteDetailMetricsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 12,
};

const quoteDetailMetricCardStyle: CSSProperties = {
  minHeight: 78,
  padding: '16px 18px',
  background: '#FFFFFF',
  border: `1px solid ${OPC_BRAND.border}`,
  borderRadius: 18,
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const quoteMetricValueStyle: CSSProperties = {
  color: OPC_BRAND.text,
  fontSize: 19,
  lineHeight: 1.05,
  fontWeight: 860,
  letterSpacing: '-0.035em',
};

const quoteMetricLabelStyle: CSSProperties = {
  marginTop: 5,
  color: OPC_BRAND.muted,
  fontSize: 12,
  fontWeight: 760,
};

const quoteMetricIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 13,
  border: `1px solid ${OPC_BRAND.border}`,
  background: '#FAFAFA',
  color: OPC_BRAND.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};

const quoteNextActionsGridStyle: CSSProperties = {
  padding: 20,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
};

const topBarStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 };
const actionRowStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' };
const heroStyle: CSSProperties = { background: '#FFFFFF', border: `1px solid ${OPC_BRAND.border}`, borderRadius: 20, padding: 22, marginBottom: 22, display: 'flex', justifyContent: 'space-between', gap: 16 };
const eyebrowStyle: CSSProperties = { margin: '0 0 8px', color: OPC_BRAND.faint, fontSize: 12, fontWeight: 780, textTransform: 'uppercase', letterSpacing: '0.08em' };
const titleStyle: CSSProperties = { margin: 0, fontSize: 34, fontWeight: 880, letterSpacing: '-0.05em', color: OPC_BRAND.text };
const subtitleStyle: CSSProperties = { margin: '10px 0 0', color: OPC_BRAND.muted, fontSize: 14, fontWeight: 620 };
const savedHintStyle: CSSProperties = { margin: '8px 0 0', color: OPC_BRAND.green, fontSize: 13, fontWeight: 760 };
const totalBoxStyle: CSSProperties = { minWidth: 220, border: `1px solid ${OPC_BRAND.border}`, borderRadius: 16, padding: 16, background: '#FAFAFA' };
const totalLabelStyle: CSSProperties = { display: 'block', color: OPC_BRAND.faint, fontSize: 12, fontWeight: 760, marginBottom: 8 };
const totalSubLabelStyle: CSSProperties = { display: 'block', color: OPC_BRAND.muted, fontSize: 12, fontWeight: 720, marginTop: 8 };
const totalValueStyle: CSSProperties = { fontSize: 24, letterSpacing: '-0.04em', color: OPC_BRAND.text };
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1.35fr 0.75fr', gap: 22 };
const fieldGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const summaryStackStyle: CSSProperties = { padding: 20, display: 'grid', gap: 14 };
const summaryRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 720, color: OPC_BRAND.text };
const cardHeaderStyle: CSSProperties = { padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const cardTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 820, color: OPC_BRAND.text };
const cardHeaderWithActionStyle: CSSProperties = { padding: '0 20px', minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottom: `1px solid ${OPC_BRAND.border}` };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 760, color: OPC_BRAND.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 };
const inputStyle: CSSProperties = { ...opcInputStyle, height: 46 };
const textareaStyle: CSSProperties = { ...opcInputStyle, minHeight: 180, height: 'auto', resize: 'vertical', paddingTop: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap' };
const itemsStackStyle: CSSProperties = { padding: 20, display: 'grid', gap: 14 };
const itemCardStyle: CSSProperties = { border: `1px solid ${OPC_BRAND.border}`, borderRadius: 16, padding: 16, background: '#FAFAFA' };
const itemGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 120px 100px 160px minmax(0, 1.6fr) 130px 44px', gap: 12, alignItems: 'end' };
const itemTotalStyle: CSSProperties = { minHeight: 46, display: 'flex', alignItems: 'center', fontWeight: 820, color: OPC_BRAND.text };
const itemHintStyle: CSSProperties = { marginTop: 10, fontSize: 12, color: OPC_BRAND.muted, fontWeight: 680 };
const iconButtonStyle: CSSProperties = { width: 44, height: 44, borderRadius: 12, border: `1px solid ${OPC_BRAND.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#991B1B' };
const textGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const nextActionsStyle: CSSProperties = { padding: 20, display: 'flex', flexWrap: 'wrap', gap: 10 };
const successStyle: CSSProperties = { marginBottom: 22, padding: 14, borderRadius: 14, border: '1px solid #BBF7D0', background: '#F0FDF4', color: OPC_BRAND.green, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 };
const errorStyle: CSSProperties = { marginBottom: 22, padding: 14, borderRadius: 14, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 700 };
const emptyStyle: CSSProperties = { padding: 28, textAlign: 'center', color: OPC_BRAND.muted, fontWeight: 680 };
