import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { sendDocumentEmail } from '../lib/opc-document-email';
import { buildDocumentEmailHtml, downloadPdf, generateInvoicePdfDocument, pdfToBase64, OPC_DEFAULT_CLOSING } from '../lib/opc-document-pdf';
import { buildFirstReminderHtml, buildInvoiceHtml, buildPaymentReminderHtml, downloadBase64Pdf, renderHtmlToPdfBase64 } from '../lib/opc-document-html';
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
import { ArrowLeft, Check, Download, Plus, Save, Trash2 } from 'lucide-react';

type InvoiceRow = Record<string, any>;
type InvoiceItem = Record<string, any>;

type InvoiceDetailPageProps = {
  invoiceId: string;
};

const DOCUMENT_CORRECTION_MODE = String(import.meta.env.PUBLIC_OPC_DOCUMENT_CORRECTION_MODE || '').toLowerCase() === 'true';

function clean(value: unknown) {
  return String(value || '').trim();
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

function getMetadata(row?: InvoiceRow | InvoiceItem | null) {
  if (!row?.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) return {};
  return row.metadata as Record<string, any>;
}

function getInvoiceScope(invoice?: InvoiceRow | null) {
  const metadata = getMetadata(invoice);
  return clean(metadata.invoice_scope_text) || clean(metadata.source_quote_scope_text) || clean(metadata.source_quote_service_description_text);
}

function getGreeting(invoice?: InvoiceRow | null) {
  const metadata = getMetadata(invoice);
  return clean(metadata.customer_greeting) || OPC_DEFAULT_CLOSING;
}

function normalizePdfFileName(value: unknown, fallback: string) {
  const source = clean(value) || fallback;
  const safe = source.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

function buildInvoiceFileName(invoice: InvoiceRow) {
  const number = clean(invoice.invoice_number) || 'Rechnung';
  return normalizePdfFileName(getMetadata(invoice).invoice_filename, `${number}_Rechnung.pdf`);
}

function buildEscalationFileName(invoice: InvoiceRow, label: string) {
  const number = clean(invoice.invoice_number) || 'Rechnung';
  const metadata = getMetadata(invoice);
  const isPaymentReminder = label === 'Zahlungserinnerung';
  const override = isPaymentReminder
    ? metadata.payment_reminder_filename
    : metadata.first_reminder_filename;
  const documentNumber = isPaymentReminder
    ? clean(metadata.payment_reminder_number) || number
    : clean(metadata.first_reminder_number) || number;
  return normalizePdfFileName(override, `${documentNumber}_${label}.pdf`);
}

function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function InvoiceDetailPage({ invoiceId }: InvoiceDetailPageProps) {
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    void loadInvoice({ clearMessages: true });
  }, [invoiceId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal_chf || 0), 0);
    const discount = Number(invoice?.discount_chf || 0);
    const taxable = Math.max(subtotal - discount, 0);
    const taxRate = Number(invoice?.tax_rate || 8.1);
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;
    const paid = Number(invoice?.paid_chf || 0);
    const balance = Math.max(total - paid, 0);
    return { subtotal, discount, taxRate, tax, total, paid, balance };
  }, [items, invoice?.discount_chf, invoice?.tax_rate, invoice?.paid_chf]);

  async function loadInvoice(options: { clearMessages?: boolean } = {}) {
    setLoading(true);
    if (options.clearMessages) {
      setErrorMessage('');
      setSuccessMessage('');
    }

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const [invoiceResponse, itemsResponse] = await Promise.all([
        supabase.from('opc_invoices').select('*').eq('id', invoiceId).single(),
        supabase.from('opc_invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order', { ascending: true }),
      ]);

      if (invoiceResponse.error) throw invoiceResponse.error;
      if (itemsResponse.error) throw itemsResponse.error;

      const row = invoiceResponse.data;
      setInvoice({
        ...row,
        issue_date: isoDate(row.issue_date),
        due_date: isoDate(row.due_date),
        intro_text: clean(row.intro_text) || 'Danke für Ihr Vertrauen. Ihre Rechnung setzt sich wie folgt zusammen:',
      });
      setItems(itemsResponse.data || []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnung konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  function updateInvoiceField(key: string, value: any) {
    setInvoice((previous) => previous ? { ...previous, [key]: value } : previous);
  }

  function updateInvoiceMetadata(key: string, value: any) {
    setInvoice((previous) => {
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
      const taxRate = toNumber(item.tax_rate || invoice?.tax_rate || 8.1) || 8.1;
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

  function addItem() {
    setItems((previous) => [
      ...previous,
      {
        id: `local-${Date.now()}`,
        invoice_id: invoiceId,
        sort_order: previous.length + 1,
        title: 'Neue Position',
        description: '',
        quantity: 1,
        unit: 'pauschal',
        unit_price_chf: 0,
        discount_chf: 0,
        tax_rate: Number(invoice?.tax_rate || 8.1),
        subtotal_chf: 0,
        tax_chf: 0,
        total_chf: 0,
        metadata: {},
      },
    ]);
  }

  async function removeItem(item: InvoiceItem, index: number) {
    if (!supabase) return;

    if (!String(item.id).startsWith('local-')) {
      const { error } = await supabase.from('opc_invoice_items').delete().eq('id', item.id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
    }

    setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveInvoice(nextStatus?: string, options: { silent?: boolean } = {}) {
    if (!invoice || !supabase) return false;

    setSaving(true);
    setErrorMessage('');
    if (!options.silent) setSuccessMessage('');

    try {
      const status = nextStatus || invoice.status || 'draft';
      const correctedInvoiceNumber = clean(invoice.invoice_number);

      if (DOCUMENT_CORRECTION_MODE) {
        if (!correctedInvoiceNumber) throw new Error('Die Rechnungsnummer darf im Korrekturmodus nicht leer sein.');
        const { data: duplicate, error: duplicateError } = await supabase
          .from('opc_invoices')
          .select('id, invoice_number')
          .eq('invoice_number', correctedInvoiceNumber)
          .neq('id', invoice.id)
          .limit(1)
          .maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) throw new Error(`Die Rechnungsnummer ${correctedInvoiceNumber} wird bereits verwendet.`);
      }

      const invoicePayload = {
        ...(DOCUMENT_CORRECTION_MODE ? { invoice_number: correctedInvoiceNumber } : {}),
        status,
        invoice_type: invoice.invoice_type || 'standard',
        title: clean(invoice.title) || 'Rechnung',
        issue_date: isoDate(invoice.issue_date) || new Date().toISOString().slice(0, 10),
        due_date: isoDate(invoice.due_date) || null,
        intro_text: invoice.intro_text || null,
        payment_terms: invoice.payment_terms || null,
        internal_notes: invoice.internal_notes || null,
        discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate),
        subtotal_chf: roundMoney(totals.subtotal),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        paid_chf: roundMoney(totals.paid),
        balance_chf: roundMoney(totals.balance),
        sent_at: status === 'sent' && !invoice.sent_at ? new Date().toISOString() : invoice.sent_at || null,
        paid_at: status === 'paid' && !invoice.paid_at ? new Date().toISOString() : invoice.paid_at || null,
        updated_at: new Date().toISOString(),
        metadata: getMetadata(invoice),
      };

      const { error } = await supabase.from('opc_invoices').update(invoicePayload).eq('id', invoice.id);
      if (error) throw error;

      for (const [index, item] of items.entries()) {
        const itemPayload = {
          invoice_id: invoice.id,
          quote_item_id: item.quote_item_id || null,
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
          updated_at: new Date().toISOString(),
          metadata: getMetadata(item),
        };

        if (String(item.id).startsWith('local-')) {
          const { error: insertError } = await supabase.from('opc_invoice_items').insert(itemPayload);
          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase.from('opc_invoice_items').update(itemPayload).eq('id', item.id);
          if (updateError) throw updateError;
        }
      }

      const savedTime = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
      setLastSavedAt(savedTime);
      if (!options.silent) setSuccessMessage(`Gespeichert um ${savedTime}.`);
      await loadInvoice({ clearMessages: false });
      return true;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnung konnte nicht gespeichert werden.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function buildInvoicePdfInput() {
    if (!invoice) return null;

    return {
      invoice,
      items,
      totals: {
        subtotal: roundMoney(totals.subtotal),
        discount: roundMoney(totals.discount),
        taxRate: roundMoney(totals.taxRate),
        tax: roundMoney(totals.tax),
        total: roundMoney(totals.total),
        balance: roundMoney(totals.balance),
      },
    };
  }

  async function generateInvoicePdf() {
    const input = buildInvoicePdfInput();
    if (!input) return null;
    return await generateInvoicePdfDocument(input);
  }

  async function generateInvoicePdfBase64(filename: string) {
    const input = buildInvoicePdfInput();
    if (!input) return null;

    const html = buildInvoiceHtml(input);
    const rendered = await renderHtmlToPdfBase64(html, filename);
    if (rendered?.base64) return rendered.base64;

    const fallbackDoc = await generateInvoicePdfDocument(input);
    return pdfToBase64(fallbackDoc);
  }

  async function handleSendInvoiceEmail() {
    if (!invoice || !supabase || sending) return;

    setErrorMessage('');
    setSuccessMessage('');
    setSending(true);

    try {
      const saved = await saveInvoice(undefined, { silent: true });
      if (!saved) {
        throw new Error('Rechnung konnte vor dem Versand nicht gespeichert werden.');
      }

      const { data: preflight, error: preflightError } = await supabase
        .from('opc_invoice_send_preflight')
        .select('recipient_email, can_send_email, send_blocker_message')
        .eq('invoice_id', invoice.id)
        .maybeSingle();

      if (preflightError) {
        throw new Error(`E-Mail-Prüfung fehlgeschlagen: ${preflightError.message}`);
      }

      const recipientEmail = clean(preflight?.recipient_email);

      if (!preflight?.can_send_email || !recipientEmail) {
        throw new Error(
          clean(preflight?.send_blocker_message) ||
            'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Bitte ergänzen Sie eine E-Mail-Adresse im Kundenkontakt oder tragen Sie eine Empfängeradresse für diese Rechnung ein.'
        );
      }

      const filename = buildInvoiceFileName(invoice);
      const pdfBase64 = await generateInvoicePdfBase64(filename);
      if (!pdfBase64) throw new Error('PDF konnte nicht erstellt werden.');

      const html = buildDocumentEmailHtml({
        title: 'Ihre Rechnung',
        headline: 'Ihre Rechnung',
        intro: `Guten Tag, im Anhang finden Sie unsere Rechnung ${invoice.invoice_number}. Bei Fragen stehen wir Ihnen gerne zur Verfügung.`,
        documentNumber: invoice.invoice_number || '',
      });

      await sendDocumentEmail(supabase, {
        to: recipientEmail,
        subject: `Ihre Rechnung ${invoice.invoice_number} – Orange Pro Clean GmbH`,
        html,
        attachments: [{ filename, contentBase64: pdfBase64, contentType: 'application/pdf' }],
        metadata: { invoice_id: invoice.id, document_type: 'invoice' },
      });

      await saveInvoice('sent', { silent: true });
      setSuccessMessage(`Rechnung wurde per E-Mail an ${recipientEmail} gesendet.`);
      await loadInvoice({ clearMessages: false });
    } catch (error: any) {
      setErrorMessage(error?.message || 'E-Mail konnte nicht gesendet werden.');
    } finally {
      setSending(false);
    }
  }

  async function handleDownloadInvoicePdf() {
    await saveInvoice(undefined, { silent: true });
    const filename = buildInvoiceFileName(invoice!);
    const input = buildInvoicePdfInput();

    if (input) {
      const html = buildInvoiceHtml(input);
      const rendered = await renderHtmlToPdfBase64(html, filename);

      if (rendered?.base64) {
        downloadBase64Pdf(rendered.base64, filename);
      } else {
        const doc = await generateInvoicePdf();
        if (doc) downloadPdf(doc, filename);
      }
    }
    setSuccessMessage('PDF wurde erstellt.');
  }

  async function handleDownloadPaymentReminder() {
    try {
      await saveInvoice(undefined, { silent: true });
      const input = buildInvoicePdfInput();
      if (!input) return;

      const today = new Date().toISOString().slice(0, 10);
      const filename = buildEscalationFileName(invoice!, 'Zahlungserinnerung');
      const html = buildPaymentReminderHtml(input, {
        documentDate: today,
        newDueDate: addCalendarDays(today, 7),
      });
      const rendered = await renderHtmlToPdfBase64(html, filename);
      if (!rendered?.base64) {
        throw new Error('Für Zahlungserinnerungen ist der HTML-PDF-Renderer erforderlich.');
      }
      downloadBase64Pdf(rendered.base64, filename);
      setSuccessMessage('Zahlungserinnerung wurde erstellt.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Zahlungserinnerung konnte nicht erstellt werden.');
    }
  }

  async function handleDownloadFirstReminder() {
    try {
      await saveInvoice(undefined, { silent: true });
      const input = buildInvoicePdfInput();
      if (!input) return;

      const today = new Date().toISOString().slice(0, 10);
      const filename = buildEscalationFileName(invoice!, '1-Mahnung');
      const html = buildFirstReminderHtml(input, {
        documentDate: today,
        newDueDate: addCalendarDays(today, 7),
        reminderFee: 0,
        showEnforcementInformation: true,
      });
      const rendered = await renderHtmlToPdfBase64(html, filename);
      if (!rendered?.base64) {
        throw new Error('Für Mahnungen ist der HTML-PDF-Renderer erforderlich.');
      }
      downloadBase64Pdf(rendered.base64, filename);
      setSuccessMessage('1. Mahnung wurde erstellt.');
    } catch (error: any) {
      setErrorMessage(error?.message || '1. Mahnung konnte nicht erstellt werden.');
    }
  }

  if (loading) {
    return (
      <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={`/rechnung/${invoiceId}`} fullWidth hideTopBar>
        <OPCPageShell><div style={emptyStyle}>Rechnung wird geladen.</div></OPCPageShell>
      </MirakaDashboardShell>
    );
  }

  if (!invoice) {
    return (
      <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={`/rechnung/${invoiceId}`} fullWidth hideTopBar>
        <OPCPageShell><div style={errorStyle}>{errorMessage || 'Rechnung wurde nicht gefunden.'}</div></OPCPageShell>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={`/rechnung/${invoiceId}`} fullWidth hideTopBar>
      <OPCPageShell>
        <div style={topBarStyle} className="opc-mobile-topbar">
          <a href={`${baseUrl}/rechnung`} className="opc-mobile-back" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
            <ArrowLeft size={16} /> Zurück
          </a>
          <div style={actionRowStyle} className="opc-mobile-action-row">
            <button type="button" disabled={saving} onClick={() => saveInvoice()} style={{ ...opcBlackButtonStyle, width: 'auto' }}>
              <Save size={16} /> {saving ? 'Speichert...' : 'Speichern'}
            </button>
            <button type="button" disabled={saving} onClick={() => saveInvoice('sent')} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              Als gesendet markieren
            </button>
            <button type="button" disabled={saving || sending} onClick={handleSendInvoiceEmail} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              {sending ? 'Sendet...' : 'Rechnung per E-Mail senden'}
            </button>
            <button type="button" disabled={saving} onClick={handleDownloadInvoicePdf} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              <Download size={16} /> PDF herunterladen
            </button>
            <button type="button" disabled={saving} onClick={handleDownloadPaymentReminder} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              <Download size={16} /> Zahlungserinnerung
            </button>
            <button type="button" disabled={saving} onClick={handleDownloadFirstReminder} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              <Download size={16} /> 1. Mahnung
            </button>
          </div>
        </div>

        <section style={heroStyle} className="opc-mobile-hero">
          <div>
            <p style={eyebrowStyle}>Rechnung</p>
            <h1 style={titleStyle} className="opc-mobile-title">{invoice.invoice_number}</h1>
            <p style={subtitleStyle}>{invoice.title}</p>
            {lastSavedAt && <p style={savedHintStyle}>Zuletzt gespeichert um {lastSavedAt}</p>}
          </div>
          <div style={totalBoxStyle} className="opc-mobile-total-box">
            <span style={totalLabelStyle}>Total inkl. MWST</span>
            <strong style={totalValueStyle}>{formatMoney(totals.total)}</strong>
            <span style={totalSubLabelStyle}>Offen: {formatMoney(totals.balance)}</span>
          </div>
        </section>

        {successMessage && <div style={successStyle}><Check size={16} />{successMessage}</div>}
        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        {DOCUMENT_CORRECTION_MODE && (
          <section style={{ marginBottom: 22 }}>
            <OPCListCard>
              <CardHeader title="Temporärer Dokument-Korrekturmodus" />
              <p style={{ margin: '0 0 16px', color: OPC_BRAND.muted, fontSize: 13 }}>
                Nummern, PDF-Titel und Dateinamen können vorübergehend korrigiert werden. Nach dem Abschalten bleiben alle gespeicherten Werte aktiv.
              </p>
              <div style={fieldGridStyle} className="opc-invoice-field-grid">
                <Field label="Rechnungsnummer"><input value={invoice.invoice_number || ''} onChange={(e) => updateInvoiceField('invoice_number', e.target.value)} style={inputStyle} /></Field>
                <Field label="Rechnungs-PDF-Titel"><input value={getMetadata(invoice).invoice_document_title || ''} onChange={(e) => updateInvoiceMetadata('invoice_document_title', e.target.value)} style={inputStyle} placeholder={`Rechnung zur ${invoice.title || 'Reinigungsleistung'}`} /></Field>
                <Field label="Rechnungs-Dateiname"><input value={getMetadata(invoice).invoice_filename || ''} onChange={(e) => updateInvoiceMetadata('invoice_filename', e.target.value)} style={inputStyle} placeholder={`${invoice.invoice_number || 'RE-00000'}_Rechnung.pdf`} /></Field>
                <Field label="Zahlungserinnerungsnummer"><input value={getMetadata(invoice).payment_reminder_number || ''} onChange={(e) => updateInvoiceMetadata('payment_reminder_number', e.target.value)} style={inputStyle} placeholder={invoice.invoice_number || 'RE-00000'} /></Field>
                <Field label="Zahlungserinnerungs-PDF-Titel"><input value={getMetadata(invoice).payment_reminder_title || ''} onChange={(e) => updateInvoiceMetadata('payment_reminder_title', e.target.value)} style={inputStyle} placeholder={`Zahlungserinnerung zu ${invoice.invoice_number || 'RE-00000'}`} /></Field>
                <Field label="Zahlungserinnerungs-Dateiname"><input value={getMetadata(invoice).payment_reminder_filename || ''} onChange={(e) => updateInvoiceMetadata('payment_reminder_filename', e.target.value)} style={inputStyle} placeholder={`${invoice.invoice_number || 'RE-00000'}_Zahlungserinnerung.pdf`} /></Field>
                <Field label="1.-Mahnungsnummer"><input value={getMetadata(invoice).first_reminder_number || ''} onChange={(e) => updateInvoiceMetadata('first_reminder_number', e.target.value)} style={inputStyle} placeholder={invoice.invoice_number || 'RE-00000'} /></Field>
                <Field label="1.-Mahnungs-PDF-Titel"><input value={getMetadata(invoice).first_reminder_title || ''} onChange={(e) => updateInvoiceMetadata('first_reminder_title', e.target.value)} style={inputStyle} placeholder={`1. Mahnung zu Rechnung ${invoice.invoice_number || 'RE-00000'}`} /></Field>
                <Field label="1.-Mahnungs-Dateiname"><input value={getMetadata(invoice).first_reminder_filename || ''} onChange={(e) => updateInvoiceMetadata('first_reminder_filename', e.target.value)} style={inputStyle} placeholder={`${invoice.invoice_number || 'RE-00000'}_1-Mahnung.pdf`} /></Field>
              </div>
            </OPCListCard>
          </section>
        )}

        <div style={gridStyle} className="opc-invoice-grid">
          <OPCListCard>
            <CardHeader title="Rechnungskopf" />
            <div style={fieldGridStyle} className="opc-invoice-field-grid">
              <Field label="Titel"><input value={invoice.title || ''} onChange={(e) => updateInvoiceField('title', e.target.value)} style={inputStyle} /></Field>
              <Field label="Status">
                <select value={invoice.status || 'draft'} onChange={(e) => updateInvoiceField('status', e.target.value)} style={opcSelectStyle}>
                  <option value="draft">Entwurf</option>
                  <option value="ready">Bereit</option>
                  <option value="sent">Gesendet</option>
                  <option value="paid">Bezahlt</option>
                  <option value="partially_paid">Teilweise bezahlt</option>
                  <option value="overdue">Überfällig</option>
                  <option value="cancelled">Storniert</option>
                  <option value="void">Ungültig</option>
                </select>
              </Field>
              <Field label="Datum"><input type="date" value={isoDate(invoice.issue_date)} onChange={(e) => updateInvoiceField('issue_date', e.target.value)} style={inputStyle} /></Field>
              <Field label="Fällig bis"><input type="date" value={isoDate(invoice.due_date)} onChange={(e) => updateInvoiceField('due_date', e.target.value)} style={inputStyle} /></Field>
              <Field label="Typ">
                <select value={invoice.invoice_type || 'standard'} onChange={(e) => updateInvoiceField('invoice_type', e.target.value)} style={opcSelectStyle}>
                  <option value="standard">Standard</option>
                  <option value="deposit">Akonto</option>
                  <option value="final">Schlussrechnung</option>
                  <option value="recurring">Wiederkehrend</option>
                  <option value="credit_note">Gutschrift</option>
                </select>
              </Field>
              <Field label="Bezahlt CHF"><input value={invoice.paid_chf || 0} onChange={(e) => updateInvoiceField('paid_chf', parseSwissMoney(e.target.value))} style={inputStyle} inputMode="decimal" /></Field>
            </div>
          </OPCListCard>

          <OPCListCard>
            <CardHeader title="Summen" />
            <div style={summaryStackStyle}>
              <SummaryRow label="Zwischentotal" value={formatMoney(totals.subtotal)} />
              <SummaryRow label="Rabatt" value={formatMoney(totals.discount)} />
              <SummaryRow label={`MWST ${formatPlainMoney(totals.taxRate)}%`} value={formatMoney(totals.tax)} />
              <SummaryRow label="Total" value={formatMoney(totals.total)} strong />
              <SummaryRow label="Offen" value={formatMoney(totals.balance)} strong />
            </div>
          </OPCListCard>
        </div>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <div style={cardHeaderWithActionStyle}>
              <h2 style={cardTitleStyle}>Interne Rechnungsreferenzen</h2>
            </div>
            <div style={textGridStyle} className="opc-invoice-text-grid">
              <TextArea label="Interne Einleitung (nicht im Rechnungs-PDF)" value={invoice.intro_text || ''} onChange={(value) => updateInvoiceField('intro_text', value)} />
              <TextArea label="Interne Leistungsreferenz (nicht im Rechnungs-PDF)" value={getInvoiceScope(invoice)} onChange={(value) => updateInvoiceMetadata('invoice_scope_text', value)} />
              <TextArea label="Interne Zahlungsnotiz (nicht im Rechnungs-PDF)" value={invoice.payment_terms || ''} onChange={(value) => updateInvoiceField('payment_terms', value)} />
              <TextArea label="Interne Kundennotiz (nicht im Rechnungs-PDF)" value={getGreeting(invoice)} onChange={(value) => updateInvoiceMetadata('customer_greeting', value)} />
              <TextArea label="Interne Notizen" value={invoice.internal_notes || ''} onChange={(value) => updateInvoiceField('internal_notes', value)} wide />
            </div>
          </OPCListCard>
        </section>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <div style={cardHeaderWithActionStyle}>
              <h2 style={cardTitleStyle}>Positionen</h2>
              <button type="button" onClick={addItem} style={{ ...opcSecondaryButtonStyle, width: 'auto' }}><Plus size={16} /> Position</button>
            </div>
            <div style={itemsStackStyle} className="opc-invoice-items-stack">
              {items.map((item, index) => (
                <div key={item.id} style={itemCardStyle}>
                  <div style={itemGridStyle} className="opc-invoice-item-grid">
                    <Field label="Reinigungsart / Positionstitel"><input value={item.title || ''} onChange={(e) => updateItem(index, 'title', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Einheit (intern)"><input value={item.unit || 'pauschal'} onChange={(e) => updateItem(index, 'unit', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Menge"><input value={item.quantity || 1} onChange={(e) => updateItem(index, 'quantity', e.target.value)} style={inputStyle} inputMode="decimal" /></Field>
                    <Field label="Einzelpreis exkl."><input value={item.unit_price_chf || 0} onChange={(e) => updateItem(index, 'unit_price_chf', e.target.value)} style={inputStyle} inputMode="decimal" /></Field>
                    <div style={itemTotalStyle} className="opc-invoice-item-total">{formatMoney(item.total_chf)}</div>
                    <button type="button" onClick={() => removeItem(item, index)} style={iconButtonStyle}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </OPCListCard>
        </section>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <CardHeader title="Schweizer QR-Rechnung" />
            <div style={qrInfoStyle}>
              Bankdaten und Fusszeile sind im Rechnungs-PDF integriert. Die echte Schweizer QR-Rechnung wird im nächsten Schritt als standardkonformer Zahlteil ergänzt. Dafür verwenden wir IBAN, Kontoinhaber und Rechnungsbetrag aus dieser Rechnung.
            </div>
          </OPCListCard>
        </section>

        <style>{`${opcResponsiveStyle}@media (max-width: 980px) {.opc-invoice-grid,.opc-invoice-field-grid,.opc-invoice-item-grid,.opc-invoice-text-grid{grid-template-columns:1fr!important;}.opc-invoice-grid{gap:16px!important;}}
          @media (max-width: 760px) {
            .opc-mobile-topbar { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
            .opc-mobile-action-row { display: grid !important; grid-template-columns: 1fr !important; width: 100% !important; }
            .opc-mobile-action-row > *, .opc-mobile-back { width: 100% !important; }
            .opc-mobile-hero { flex-direction: column !important; padding: 18px !important; border-radius: 18px !important; }
            .opc-mobile-title { font-size: 30px !important; line-height: 0.98 !important; overflow-wrap: anywhere !important; }
            .opc-mobile-total-box { width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
            .opc-invoice-grid, .opc-invoice-field-grid, .opc-invoice-item-grid, .opc-invoice-text-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
            .opc-invoice-field-grid, .opc-invoice-text-grid, .opc-invoice-items-stack { padding: 16px !important; }
            .opc-invoice-item-grid > * { width: 100% !important; }
            .opc-invoice-item-total { min-height: auto !important; padding: 8px 0 0 !important; }
          }
`}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

function CardHeader({ title }: { title: string }) {
  return <div style={cardHeaderStyle}><h2 style={cardTitleStyle}>{title}</h2></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label><span style={labelStyle}>{label}</span>{children}</label>;
}

function TextArea({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label style={wide ? { gridColumn: '1 / -1' } : undefined}><span style={labelStyle}>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} style={textareaStyle} /></label>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={summaryRowStyle}><span>{label}</span><strong style={{ fontSize: strong ? 18 : 14 }}>{value}</strong></div>;
}

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
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1.25fr 0.8fr', gap: 22 };
const fieldGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const cardHeaderStyle: CSSProperties = { padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${OPC_BRAND.border}` };
const cardHeaderWithActionStyle: CSSProperties = { padding: '0 20px', minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottom: `1px solid ${OPC_BRAND.border}` };
const cardTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 820, color: OPC_BRAND.text };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 760, color: OPC_BRAND.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 };
const inputStyle: CSSProperties = { ...opcInputStyle, height: 46 };
const textareaStyle: CSSProperties = { ...opcInputStyle, minHeight: 108, height: 'auto', resize: 'vertical', paddingTop: 12, lineHeight: 1.45 };
const summaryStackStyle: CSSProperties = { padding: 20, display: 'grid', gap: 14 };
const summaryRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 720, color: OPC_BRAND.text };
const textGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const itemsStackStyle: CSSProperties = { padding: 20, display: 'grid', gap: 14 };
const itemCardStyle: CSSProperties = { border: `1px solid ${OPC_BRAND.border}`, borderRadius: 16, padding: 16, background: '#FAFAFA' };
const itemGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 120px 100px 150px minmax(0, 1.6fr) 130px 44px', gap: 12, alignItems: 'end' };
const itemTotalStyle: CSSProperties = { minHeight: 46, display: 'flex', alignItems: 'center', fontWeight: 820, color: OPC_BRAND.text };
const iconButtonStyle: CSSProperties = { width: 44, height: 44, borderRadius: 12, border: `1px solid ${OPC_BRAND.border}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#991B1B' };
const qrInfoStyle: CSSProperties = { padding: 20, color: OPC_BRAND.muted, fontSize: 14, lineHeight: 1.55, fontWeight: 650 };
const successStyle: CSSProperties = { marginBottom: 22, padding: 14, borderRadius: 14, border: '1px solid #BBF7D0', background: '#F0FDF4', color: OPC_BRAND.green, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 };
const errorStyle: CSSProperties = { marginBottom: 22, padding: 14, borderRadius: 14, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 700 };
const emptyStyle: CSSProperties = { padding: 28, textAlign: 'center', color: OPC_BRAND.muted, fontWeight: 680 };
