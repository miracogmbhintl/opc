import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.86.0';

import { generateInvoicePdfBase64 } from './opc-invoice-pdf.ts';

function getOpcServerEnvValue(_source: unknown, key: string) {
  return String(Deno.env.get(key) || '').trim();
}

function getOpcSupabaseUrl(_source?: unknown) {
  const value =
    getOpcServerEnvValue(null, 'SUPABASE_URL') ||
    getOpcServerEnvValue(null, 'PUBLIC_SUPABASE_URL');

  if (!value) throw new Error('SUPABASE_URL fehlt in der Edge Function.');
  return value.replace(/\/$/, '');
}

function getOpcSupabaseServiceRoleKey(_source?: unknown) {
  const value = getOpcServerEnvValue(null, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!value) throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt in der Edge Function.');
  return value;
}

type JsonRecord = Record<string, any>;

type AutomationRow = JsonRecord & {
  id: string;
  service_job_id: string;
  client_id?: string | null;
  client_site_id?: string | null;
  quote_id?: string | null;
  invoice_id?: string | null;
  attempt_count?: number | null;
};

type ProcessSummary = {
  claimed: number;
  completed: number;
  manualReview: number;
  failed: number;
  results: Array<{
    automationId: string;
    status: 'completed' | 'manual_review' | 'failed';
    invoiceId?: string | null;
    message?: string;
  }>;
};

class PermanentAutomationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PermanentAutomationError';
    this.code = code;
  }
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function asObject(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
}

function pick(source: JsonRecord | null | undefined, keys: string[]) {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && clean(value)) return value;
  }
  return '';
}

function zurichDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getPaymentDays(source: any) {
  const configured = Number(getOpcServerEnvValue(source, 'OPC_DEFAULT_PAYMENT_DAYS') || 10);
  return Number.isFinite(configured) && configured >= 0 && configured <= 365
    ? Math.floor(configured)
    : 10;
}

function createAdminClient(source: any) {
  return createClient(getOpcSupabaseUrl(source), getOpcSupabaseServiceRoleKey(source), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createEmailHtml(invoiceNumber: string) {
  const safeNumber = clean(invoiceNumber) || 'Rechnung';
  const logoUrl =
    'https://cdn.prod.website-files.com/6944470386300e196e5fc347/69495340f6a0fe99fed87217_WHITE%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:40px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;background:#ffffff;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="background:#f7931e;padding:28px 32px;">
              <img src="${logoUrl}" width="65" alt="Orange Pro Clean GmbH" style="display:block;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 20px;">
              <h1 style="font-size:36px;line-height:38px;font-weight:900;text-transform:uppercase;margin:0;">Ihre Rechnung</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 24px;font-size:15px;line-height:22px;">Guten Tag, im Anhang finden Sie unsere Rechnung <strong>${safeNumber}</strong>. Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
              <div style="background:#e9e9e9;padding:20px;border-radius:20px;font-size:15px;line-height:20px;font-weight:600;">Dokument: ${safeNumber}</div>
              <p style="margin:28px 0 0;font-size:15px;line-height:22px;">Mit freundlichen Grüssen<br>Ihr Orange Pro Clean Team</p>
              <p style="margin:10px 0 0;font-size:11px;line-height:16px;">Orange Pro Clean GmbH<br>info@orangeproclean.ch<br>www.orangeproclean.ch</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
async function invokeMailerFunction({
  source,
  payload,
}: {
  source: any;
  payload: JsonRecord;
}) {
  const supabaseUrl = getOpcSupabaseUrl(source);
  const serviceRoleKey = getOpcSupabaseServiceRoleKey(source);
  const functionNames = ['opc-send-document-email', 'opc-send-document-smtp'];
  const failures: string[] = [];

  for (const functionName of functionNames) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!response.ok || data?.ok === false) {
        throw new Error(
          `${functionName} HTTP ${response.status}: ${data?.error || data?.raw || text || response.statusText}`,
        );
      }

      return {
        functionName,
        messageId: data?.messageId || null,
      };
    } catch (error: any) {
      failures.push(error?.message || String(error));
    }
  }

  throw new Error(`Keine Mail-Edge-Function konnte senden: ${failures.join(' | ')}`);
}

async function loadClient(admin: SupabaseClient, clientId?: string | null) {
  if (!clientId) return null;

  const overview = await admin
    .from('opc_client_overview')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();

  if (!overview.error && overview.data) return overview.data as JsonRecord;

  const fallback = await admin
    .from('opc_clients')
    .select('*')
    .eq('id', clientId)
    .maybeSingle();

  if (fallback.error) throw fallback.error;
  return (fallback.data || null) as JsonRecord | null;
}

async function loadSite(admin: SupabaseClient, siteId?: string | null) {
  if (!siteId) return null;

  const response = await admin
    .from('opc_client_sites')
    .select('*')
    .eq('id', siteId)
    .maybeSingle();

  if (response.error) throw response.error;
  return (response.data || null) as JsonRecord | null;
}

function resolveQuoteId(automation: AutomationRow, job: JsonRecord) {
  const metadata = asObject(job.metadata);
  const candidates = [
    automation.quote_id,
    job.quote_id,
    metadata.quote_id,
    metadata.source_quote_id,
    metadata.offer_id,
  ];

  return candidates.find(isUuid) ? clean(candidates.find(isUuid)) : '';
}

async function loadQuote(admin: SupabaseClient, quoteId: string) {
  const [quoteResponse, itemsResponse] = await Promise.all([
    admin.from('opc_quotes').select('*').eq('id', quoteId).maybeSingle(),
    admin
      .from('opc_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true }),
  ]);

  if (quoteResponse.error) throw quoteResponse.error;
  if (itemsResponse.error) throw itemsResponse.error;

  if (!quoteResponse.data) {
    throw new PermanentAutomationError(
      'quote_not_found',
      'Die verknüpfte Offerte wurde nicht gefunden.',
    );
  }

  return {
    quote: quoteResponse.data as JsonRecord,
    items: (itemsResponse.data || []) as JsonRecord[],
  };
}

function calculateQuoteTotals(quote: JsonRecord, items: JsonRecord[]) {
  const itemSubtotal = items.reduce((sum, item) => {
    const explicit = toNumber(item.subtotal_chf);
    if (explicit) return sum + explicit;

    const quantity = toNumber(item.quantity) || 1;
    const unitPrice = toNumber(item.unit_price_chf);
    const discount = toNumber(item.discount_chf);
    return sum + Math.max(quantity * unitPrice - discount, 0);
  }, 0);

  const subtotal = toNumber(quote.subtotal_chf) || itemSubtotal;
  const discount = toNumber(quote.discount_chf);
  const taxRate =
    toNumber(quote.tax_rate) ||
    toNumber(items.find((item) => toNumber(item.tax_rate))?.tax_rate) ||
    8.1;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = toNumber(quote.tax_chf) || taxable * (taxRate / 100);
  const total = toNumber(quote.total_chf) || taxable + tax;

  if (total <= 0) {
    throw new PermanentAutomationError(
      'invalid_invoice_total',
      'Die bestätigte Offerte enthält keinen verrechenbaren Gesamtbetrag.',
    );
  }

  return {
    subtotal: roundMoney(subtotal),
    discount: roundMoney(discount),
    taxRate: roundMoney(taxRate),
    tax: roundMoney(tax),
    total: roundMoney(total),
    balance: roundMoney(total),
  };
}

function buildClientSnapshot(client: JsonRecord | null, quote: JsonRecord) {
  const quoteSnapshot = asObject(quote.client_snapshot);
  if (Object.keys(quoteSnapshot).length) return quoteSnapshot;

  return {
    client_id: pick(client, ['client_id', 'id']) || quote.client_id || null,
    customer_number: pick(client, [
      'client_number',
      'customer_number',
      'kundennummer',
      'client_code',
    ]) || null,
    billing_name: pick(client, ['billing_name']) || null,
    company_name: pick(client, ['company_name']) || null,
    full_name: pick(client, ['full_name', 'contact_name']) || null,
    salutation: pick(client, ['salutation', 'anrede']) || null,
    first_name: pick(client, ['first_name', 'firstname']) || null,
    last_name: pick(client, ['last_name', 'lastname']) || null,
    email: pick(client, ['billing_email', 'email']) || null,
    billing_email: pick(client, ['billing_email', 'email']) || null,
    billing_address: pick(client, ['billing_address', 'address_text', 'address']) || null,
    billing_postal_code: pick(client, ['billing_postal_code', 'postal_code']) || null,
    billing_city: pick(client, ['billing_city', 'city']) || null,
    country: pick(client, ['country']) || 'Schweiz',
  };
}

function buildSiteSnapshot(site: JsonRecord | null, quote: JsonRecord) {
  const quoteSnapshot = asObject(quote.site_snapshot);
  if (Object.keys(quoteSnapshot).length) return quoteSnapshot;

  if (!site) return {};

  return {
    client_site_id: site.id || null,
    site_name: site.site_name || null,
    address_text: site.address_text || site.address || null,
    postal_code: site.postal_code || null,
    city: site.city || null,
    country: site.country || 'Schweiz',
  };
}

function buildInvoiceItems(quote: JsonRecord, quoteItems: JsonRecord[], totals: ReturnType<typeof calculateQuoteTotals>) {
  if (quoteItems.length) {
    return quoteItems.map((item, index) => {
      const quantity = toNumber(item.quantity) || 1;
      const unitPrice = toNumber(item.unit_price_chf);
      const discount = toNumber(item.discount_chf);
      const taxRate = toNumber(item.tax_rate) || totals.taxRate;
      const subtotal =
        toNumber(item.subtotal_chf) || Math.max(quantity * unitPrice - discount, 0);
      const tax = toNumber(item.tax_chf) || subtotal * (taxRate / 100);
      const total = toNumber(item.total_chf) || subtotal + tax;

      return {
        quote_item_id: item.id || null,
        sort_order: index + 1,
        title: clean(item.title) || clean(quote.title) || 'Reinigungsleistung',
        description:
          clean(item.description) ||
          clean(quote.scope_text) ||
          clean(quote.service_description_text) ||
          null,
        quantity,
        unit: clean(item.unit) || 'pauschal',
        unit_price_chf: roundMoney(unitPrice || subtotal),
        discount_chf: roundMoney(discount),
        tax_rate: roundMoney(taxRate),
        subtotal_chf: roundMoney(subtotal),
        tax_chf: roundMoney(tax),
        total_chf: roundMoney(total),
        metadata: {
          created_from: 'automatic_invoice_from_quote',
        },
      };
    });
  }

  return [
    {
      quote_item_id: null,
      sort_order: 1,
      title: clean(quote.title) || 'Reinigungsleistung',
      description:
        clean(quote.scope_text) || clean(quote.service_description_text) || null,
      quantity: 1,
      unit: 'pauschal',
      unit_price_chf: totals.subtotal,
      discount_chf: totals.discount,
      tax_rate: totals.taxRate,
      subtotal_chf: totals.subtotal,
      tax_chf: totals.tax,
      total_chf: totals.total,
      metadata: {
        created_from: 'automatic_invoice_from_quote_fallback',
      },
    },
  ];
}

async function findExistingInvoice(admin: SupabaseClient, automation: AutomationRow) {
  if (automation.invoice_id) {
    const byId = await admin
      .from('opc_invoices')
      .select('*')
      .eq('id', automation.invoice_id)
      .maybeSingle();

    if (byId.error) throw byId.error;
    if (byId.data) return byId.data as JsonRecord;
  }

  const byJob = await admin
    .from('opc_invoices')
    .select('*')
    .eq('service_job_id', automation.service_job_id)
    .not('status', 'in', '(void,cancelled)')
    .maybeSingle();

  if (byJob.error) throw byJob.error;
  return (byJob.data || null) as JsonRecord | null;
}

async function loadInvoiceItems(admin: SupabaseClient, invoiceId: string) {
  const response = await admin
    .from('opc_invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  if (response.error) throw response.error;
  return (response.data || []) as JsonRecord[];
}

async function createInvoiceFromQuote({
  source,
  admin,
  automation,
  job,
  client,
  site,
  quote,
  quoteItems,
}: {
  source: any;
  admin: SupabaseClient;
  automation: AutomationRow;
  job: JsonRecord;
  client: JsonRecord | null;
  site: JsonRecord | null;
  quote: JsonRecord;
  quoteItems: JsonRecord[];
}) {
  const totals = calculateQuoteTotals(quote, quoteItems);
  const issueDate = zurichDate();
  const dueDate = addDays(issueDate, getPaymentDays(source));
  const clientSnapshot = buildClientSnapshot(client, quote);
  const siteSnapshot = buildSiteSnapshot(site, quote);
  const items = buildInvoiceItems(quote, quoteItems, totals);

  const invoicePayload = {
    service_job_id: automation.service_job_id,
    quote_id: quote.id,
    client_id: job.client_id || quote.client_id || automation.client_id || null,
    contact_id: job.contact_id || quote.contact_id || site?.contact_id || null,
    client_site_id:
      job.client_site_id || quote.client_site_id || automation.client_site_id || null,
    status: 'ready',
    invoice_type: 'standard',
    title: `Rechnung zu ${clean(quote.quote_number) || clean(quote.title) || 'Offerte'}`,
    language: quote.language || 'de',
    currency: quote.currency || 'CHF',
    issue_date: issueDate,
    due_date: dueDate,
    client_snapshot: clientSnapshot,
    site_snapshot: siteSnapshot,
    intro_text:
      clean(quote.invoice_intro_text) ||
      'Vielen Dank für Ihren Auftrag. Nachfolgend finden Sie die Rechnung für die erbrachten Leistungen.',
    payment_terms:
      clean(quote.payment_terms) ||
      `Zahlbar innert ${getPaymentDays(source)} Tagen ohne Abzug.`,
    internal_notes: `Automatisch aus Einsatz ${automation.service_job_id} und Offerte ${quote.id} erstellt.`,
    subtotal_chf: totals.subtotal,
    discount_chf: totals.discount,
    tax_rate: totals.taxRate,
    tax_chf: totals.tax,
    total_chf: totals.total,
    paid_chf: 0,
    balance_chf: totals.balance,
    metadata: {
      created_from: 'opc_invoice_automation',
      automation_id: automation.id,
      source_job_id: automation.service_job_id,
      source_quote_id: quote.id,
      source_quote_number: quote.quote_number || null,
      invoice_scope_text:
        clean(quote.scope_text) || clean(quote.service_description_text) || null,
      source_quote_scope_text: quote.scope_text || null,
      source_quote_service_description_text: quote.service_description_text || null,
    },
  };

  const invoiceResponse = await admin
    .from('opc_invoices')
    .insert(invoicePayload)
    .select('*')
    .single();

  if (invoiceResponse.error) {
    if (/duplicate|unique/i.test(invoiceResponse.error.message || '')) {
      const existing = await findExistingInvoice(admin, automation);
      if (existing) {
        return {
          invoice: existing,
          items: await loadInvoiceItems(admin, existing.id),
          totals,
        };
      }
    }
    throw invoiceResponse.error;
  }

  const invoice = invoiceResponse.data as JsonRecord;
  const itemPayloads = items.map((item) => ({ ...item, invoice_id: invoice.id }));
  const itemsResponse = await admin.from('opc_invoice_items').insert(itemPayloads).select('*');

  if (itemsResponse.error) {
    await admin.from('opc_invoices').delete().eq('id', invoice.id);
    throw itemsResponse.error;
  }

  return {
    invoice,
    items: (itemsResponse.data || itemPayloads) as JsonRecord[],
    totals,
  };
}

async function updateQueue(
  admin: SupabaseClient,
  automationId: string,
  payload: JsonRecord,
) {
  const response = await admin
    .from('opc_invoice_automation_jobs')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', automationId);

  if (response.error) throw response.error;
}

function retryDelayMinutes(attemptCount: number) {
  if (attemptCount <= 1) return 5;
  if (attemptCount === 2) return 20;
  return 120;
}

async function moveToManualReview(
  admin: SupabaseClient,
  automation: AutomationRow,
  code: string,
  message: string,
  invoiceId?: string | null,
) {
  await updateQueue(admin, automation.id, {
    status: 'manual_review',
    invoice_id: invoiceId || automation.invoice_id || null,
    blocker_code: code,
    blocker_message: message,
    error_message: null,
    claimed_at: null,
  });

  await admin
    .from('opc_service_jobs')
    .update({
      billing_status: 'manual_review',
      invoice_id: invoiceId || automation.invoice_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', automation.service_job_id);
}

async function markFailure(
  admin: SupabaseClient,
  automation: AutomationRow,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  const attemptCount = Number(automation.attempt_count || 1);

  if (attemptCount >= 3) {
    await moveToManualReview(
      admin,
      automation,
      'maximum_attempts_reached',
      `Automatischer Versand nach ${attemptCount} Versuchen gestoppt: ${message}`,
      automation.invoice_id || null,
    );
    return 'manual_review' as const;
  }

  const nextAttempt = new Date(
    Date.now() + retryDelayMinutes(attemptCount) * 60_000,
  ).toISOString();

  await updateQueue(admin, automation.id, {
    status: 'failed',
    error_message: message,
    next_attempt_at: nextAttempt,
    claimed_at: null,
  });

  return 'failed' as const;
}

async function processOne({
  source,
  admin,
  automation,
}: {
  source: any;
  admin: SupabaseClient;
  automation: AutomationRow;
}) {
  let invoice: JsonRecord | null = null;

  try {
    const jobResponse = await admin
      .from('opc_service_jobs')
      .select('*')
      .eq('id', automation.service_job_id)
      .maybeSingle();

    if (jobResponse.error) throw jobResponse.error;
    const job = jobResponse.data as JsonRecord | null;

    if (!job) {
      throw new PermanentAutomationError(
        'job_not_found',
        'Der zugehörige Einsatz wurde nicht gefunden.',
      );
    }

    if (clean(job.status).toLowerCase() !== 'completed') {
      throw new PermanentAutomationError(
        'job_not_completed',
        'Der Einsatz ist nicht mehr als abgeschlossen markiert.',
      );
    }

    const quoteId = resolveQuoteId(automation, job);
    if (!quoteId) {
      throw new PermanentAutomationError(
        'missing_quote_link',
        'Der Einsatz ist nicht mit einer bestätigten Offerte verknüpft.',
      );
    }

    const [client, site, quoteContext] = await Promise.all([
      loadClient(admin, job.client_id || automation.client_id),
      loadSite(admin, job.client_site_id || automation.client_site_id),
      loadQuote(admin, quoteId),
    ]);

    const quoteStatus = clean(quoteContext.quote.status).toLowerCase();
    const acceptedQuoteStatuses = new Set([
      'accepted',
      'confirmed',
      'approved',
      'won',
      'invoiced',
    ]);

    if (!acceptedQuoteStatuses.has(quoteStatus)) {
      throw new PermanentAutomationError(
        'quote_not_confirmed',
        `Die verknüpfte Offerte ist nicht bestätigt (Status: ${quoteStatus || 'unbekannt'}).`,
      );
    }

    if (
      quoteContext.quote.client_id &&
      job.client_id &&
      clean(quoteContext.quote.client_id) !== clean(job.client_id)
    ) {
      throw new PermanentAutomationError(
        'quote_client_mismatch',
        'Die verknüpfte Offerte gehört nicht zum Kunden dieses Einsatzes.',
      );
    }

    invoice = await findExistingInvoice(admin, automation);
    let items: JsonRecord[] = [];
    let totals: ReturnType<typeof calculateQuoteTotals>;

    if (invoice) {
      const status = clean(invoice.status).toLowerCase();

      if (status === 'sent' || invoice.sent_at) {
        await updateQueue(admin, automation.id, {
          status: 'completed',
          invoice_id: invoice.id,
          completed_at: invoice.sent_at || new Date().toISOString(),
          claimed_at: null,
          blocker_code: null,
          blocker_message: null,
          error_message: null,
        });

        await admin
          .from('opc_service_jobs')
          .update({
            billing_status: 'invoice_sent',
            invoice_id: invoice.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', automation.service_job_id);

        return {
          status: 'completed' as const,
          invoiceId: invoice.id,
          message: 'Rechnung war bereits versendet.',
        };
      }

      if (status === 'sending') {
        throw new PermanentAutomationError(
          'ambiguous_delivery_state',
          'Die Rechnung befindet sich bereits im Versandstatus. Zur Vermeidung einer Doppelzustellung ist eine manuelle Prüfung erforderlich.',
        );
      }

      items = await loadInvoiceItems(admin, invoice.id);
      totals = {
        subtotal: roundMoney(toNumber(invoice.subtotal_chf)),
        discount: roundMoney(toNumber(invoice.discount_chf)),
        taxRate: roundMoney(toNumber(invoice.tax_rate) || 8.1),
        tax: roundMoney(toNumber(invoice.tax_chf)),
        total: roundMoney(toNumber(invoice.total_chf)),
        balance: roundMoney(toNumber(invoice.balance_chf) || toNumber(invoice.total_chf)),
      };
    } else {
      const created = await createInvoiceFromQuote({
        source,
        admin,
        automation,
        job,
        client,
        site,
        quote: quoteContext.quote,
        quoteItems: quoteContext.items,
      });
      invoice = created.invoice;
      items = created.items;
      totals = created.totals;
    }

    if (!invoice?.id) {
      throw new Error('Rechnung konnte nicht erstellt oder geladen werden.');
    }

    if (!clean(invoice.invoice_number)) {
      const reload = await admin
        .from('opc_invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();
      if (reload.error) throw reload.error;
      invoice = reload.data as JsonRecord;
    }

    if (!clean(invoice.invoice_number)) {
      throw new PermanentAutomationError(
        'missing_invoice_number',
        'Die Rechnung hat keine Rechnungsnummer erhalten. Bitte Nummernlogik prüfen.',
      );
    }

    const preflight = await admin
      .from('opc_invoice_send_preflight')
      .select('recipient_email, can_send_email, send_blocker_message')
      .eq('invoice_id', invoice.id)
      .maybeSingle();

    if (preflight.error) throw preflight.error;

    const recipientEmail = clean(preflight.data?.recipient_email);
    if (!preflight.data?.can_send_email || !recipientEmail) {
      throw new PermanentAutomationError(
        'missing_recipient_email',
        clean(preflight.data?.send_blocker_message) ||
          'Für diesen Kunden ist keine gültige Rechnungs-E-Mail-Adresse hinterlegt.',
      );
    }

    const invoiceMetadataBeforeSend = asObject(invoice.metadata);
    const requestedFilename = clean(invoiceMetadataBeforeSend.invoice_filename);
    const rawFilename = requestedFilename || `${clean(invoice.invoice_number)}_Rechnung.pdf`;
    const filename = (rawFilename.toLowerCase().endsWith('.pdf') ? rawFilename : `${rawFilename}.pdf`).replace(
      /[\\/:*?"<>|]+/g,
      '-',
    );

    if (!items.length) {
      throw new PermanentAutomationError(
        'missing_invoice_items',
        'Die Rechnung enthält keine Positionen und kann nicht automatisch versendet werden.',
      );
    }

    const pdfBase64 = await generateInvoicePdfBase64({
      invoice,
      items,
      totals,
    });
    const sendAttemptId = `${automation.id}:${automation.attempt_count || 1}`;
    const invoiceMetadata = {
      ...asObject(invoice.metadata),
      automation_id: automation.id,
      send_attempt_id: sendAttemptId,
      sending_started_at: new Date().toISOString(),
    };

    const markSending = await admin
      .from('opc_invoices')
      .update({
        status: 'sending',
        metadata: invoiceMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (markSending.error) throw markSending.error;

    const mailResult = await invokeMailerFunction({
      source,
      payload: {
        to: recipientEmail,
        subject: `Ihre Rechnung ${invoice.invoice_number} – Orange Pro Clean GmbH`,
        html: createEmailHtml(invoice.invoice_number),
        attachments: [
          {
            filename,
            contentBase64: pdfBase64,
            contentType: 'application/pdf',
          },
        ],
        metadata: {
          invoice_id: invoice.id,
          document_type: 'invoice',
          automation_id: automation.id,
          idempotency_key: `opc-invoice-automation:${automation.id}`,
          send_attempt_id: sendAttemptId,
        },
      },
    });

    const sentAt = new Date().toISOString();
    const sentMetadata = {
      ...invoiceMetadata,
      sending_started_at: invoiceMetadata.sending_started_at,
      sent_at: sentAt,
      mail_function: mailResult.functionName,
      mail_message_id: mailResult.messageId,
    };

    const markSent = await admin
      .from('opc_invoices')
      .update({
        status: 'sent',
        sent_at: sentAt,
        metadata: sentMetadata,
        updated_at: sentAt,
      })
      .eq('id', invoice.id);

    if (markSent.error) {
      throw new PermanentAutomationError(
        'email_sent_database_update_failed',
        `E-Mail wurde möglicherweise versendet, aber der Rechnungsstatus konnte nicht gespeichert werden: ${markSent.error.message}`,
      );
    }

    await updateQueue(admin, automation.id, {
      status: 'completed',
      invoice_id: invoice.id,
      completed_at: sentAt,
      claimed_at: null,
      blocker_code: null,
      blocker_message: null,
      error_message: null,
      payload: {
        ...asObject(automation.payload),
        recipient_email: recipientEmail,
        invoice_number: invoice.invoice_number,
        mail_function: mailResult.functionName,
        mail_message_id: mailResult.messageId,
      },
    });

    await admin
      .from('opc_service_jobs')
      .update({
        billing_status: 'invoice_sent',
        invoice_id: invoice.id,
        updated_at: sentAt,
      })
      .eq('id', automation.service_job_id);

    const quoteUpdate = await admin
      .from('opc_quotes')
      .update({
        status: 'invoiced',
        invoiced_at: sentAt,
      })
      .eq('id', quoteId);

    if (quoteUpdate.error) {
      console.error(
        '[opc-invoice-automation] quote status update failed',
        quoteUpdate.error,
      );
    }

    const quoteEvent = await admin.from('opc_quote_events').insert({
      quote_id: quoteId,
      client_id: job.client_id || automation.client_id || null,
      event_type: 'invoice_created',
      message: `Rechnung ${invoice.invoice_number} automatisch erstellt und versendet.`,
      new_status: 'invoiced',
      metadata: {
        invoice_id: invoice.id,
        automation_id: automation.id,
        service_job_id: automation.service_job_id,
      },
    });

    if (quoteEvent.error) {
      console.error(
        '[opc-invoice-automation] quote event insert failed',
        quoteEvent.error,
      );
    }

    return {
      status: 'completed' as const,
      invoiceId: invoice.id,
      message: `Rechnung ${invoice.invoice_number} wurde an ${recipientEmail} gesendet.`,
    };
  } catch (error: any) {
    if (error instanceof PermanentAutomationError) {
      await moveToManualReview(
        admin,
        automation,
        error.code,
        error.message,
        invoice?.id || automation.invoice_id || null,
      );

      return {
        status: 'manual_review' as const,
        invoiceId: invoice?.id || automation.invoice_id || null,
        message: error.message,
      };
    }

    const failureStatus = await markFailure(admin, automation, error);
    return {
      status: failureStatus,
      invoiceId: invoice?.id || automation.invoice_id || null,
      message: error?.message || String(error),
    };
  }
}

export async function processDueInvoiceAutomations({
  source,
  limit = 20,
  workerId = 'opc-invoice-automation',
}: {
  source: any;
  limit?: number;
  workerId?: string;
}): Promise<ProcessSummary> {
  const admin = createAdminClient(source);
  const safeLimit = Math.max(1, Math.min(Number(limit || 20), 100));

  const claim = await admin.rpc('opc_claim_due_invoice_automations', {
    p_limit: safeLimit,
    p_worker_id: workerId,
  });

  if (claim.error) throw claim.error;

  const rows = (claim.data || []) as AutomationRow[];
  const summary: ProcessSummary = {
    claimed: rows.length,
    completed: 0,
    manualReview: 0,
    failed: 0,
    results: [],
  };

  for (const automation of rows) {
    const result = await processOne({ source, admin, automation });

    if (result.status === 'completed') summary.completed += 1;
    if (result.status === 'manual_review') summary.manualReview += 1;
    if (result.status === 'failed') summary.failed += 1;

    summary.results.push({
      automationId: automation.id,
      status: result.status,
      invoiceId: result.invoiceId,
      message: result.message,
    });
  }

  return summary;
}
