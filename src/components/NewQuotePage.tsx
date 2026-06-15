import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Building2, CalendarDays, Check, FileText, Plus, Save, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import { OPCPageShell, opcResponsiveStyle } from './opc/OPCPageTop';

type ClientOption = {
  client_id?: string;
  id?: string;
  contact_id?: string | null;
  billing_name?: string | null;
  company_name?: string | null;
  full_name?: string | null;
  billing_email?: string | null;
  email?: string | null;
  primary_site_id?: string | null;
  primary_site_name?: string | null;
  primary_site_address?: string | null;
  primary_site_postal_code?: string | null;
  primary_site_city?: string | null;
};

type SiteOption = {
  id: string;
  client_id?: string | null;
  contact_id?: string | null;
  site_name?: string | null;
  address_text?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
};

type FormState = {
  clientId: string;
  clientSiteId: string;
  title: string;
  quoteType: string;
  status: string;
  issueDate: string;
  validUntil: string;
  priceMode: 'excl' | 'incl';
  itemTitle: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  introText: string;
  termsText: string;
  paymentTerms: string;
  customerNotes: string;
  internalNotes: string;
};

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  red: '#B91C1C',
  amber: '#92400E',
};

const pageFont = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '20px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  border: `1px solid ${BRAND.border}`,
  borderRadius: 14,
  background: '#FFFFFF',
  color: BRAND.text,
  padding: '10px 13px',
  fontSize: 14,
  fontWeight: 620,
  fontFamily: pageFont,
  outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: 'vertical',
  lineHeight: 1.45,
};

function todayInput() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDays(inputDate: string, days: number) {
  const date = new Date(`${inputDate || todayInput()}T00:00:00`);
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function parseMoney(value: unknown) {
  const raw = clean(value);
  if (!raw) return 0;
  const normalized = raw.replace(/CHF/gi, '').replace(/[’'`´\s]/g, '').replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(Number.isFinite(amount) ? amount : 0);
}

function getClientId(client: ClientOption) {
  return client.client_id || client.id || '';
}

function getClientName(client?: ClientOption | null) {
  if (!client) return '';
  return client.billing_name || client.company_name || client.full_name || client.email || client.billing_email || 'Kunde';
}

function getSiteLabel(site?: SiteOption | null) {
  if (!site) return '';
  const address = site.address_text || site.address || '';
  const cityLine = [site.postal_code, site.city].filter(Boolean).join(' ');
  return [site.site_name, address, cityLine, site.country].filter(Boolean).join(' · ') || 'Standort';
}

function Label({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="opc-new-doc-label">
      {children}
      {required ? <span> *</span> : null}
    </label>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="opc-new-doc-card" style={cardStyle}>
      <div className="opc-new-doc-section-header">
        {icon ? <div className="opc-new-doc-section-icon">{icon}</div> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function NewQuotePage() {
  const [form, setForm] = useState<FormState>(() => ({
    clientId: '',
    clientSiteId: '',
    title: 'Neue Offerte',
    quoteType: 'standard',
    status: 'draft',
    issueDate: todayInput(),
    validUntil: addDays(todayInput(), 14),
    priceMode: 'excl',
    itemTitle: 'Neue Position',
    description: '',
    quantity: '1',
    unit: 'pauschal',
    unitPrice: '0',
    discount: '0',
    taxRate: '8.1',
    introText: 'Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen unsere Offerte.',
    termsText: 'Die Offerte ist freibleibend bis zur schriftlichen Bestätigung. Termine werden gemeinsam vereinbart.',
    paymentTerms: 'Zahlbar gemäss Vereinbarung.',
    customerNotes: '',
    internalNotes: '',
  }));
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSites, setLoadingSites] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('client_id') || '';
    const siteId = params.get('site_id') || '';
    setForm((current) => ({ ...current, clientId, clientSiteId: siteId }));
    void loadClients(clientId);
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setSites([]);
      return;
    }
    void loadSites(form.clientId);
  }, [form.clientId]);

  const selectedClient = useMemo(() => clients.find((client) => getClientId(client) === form.clientId) || null, [clients, form.clientId]);
  const selectedSite = useMemo(() => sites.find((site) => site.id === form.clientSiteId) || null, [sites, form.clientSiteId]);

  const totals = useMemo(() => {
    const quantity = parseMoney(form.quantity) || 1;
    const taxRate = parseMoney(form.taxRate) || 8.1;
    const discount = parseMoney(form.discount);
    const inputPrice = parseMoney(form.unitPrice);
    const unitExcl = form.priceMode === 'incl' ? inputPrice / (1 + taxRate / 100) : inputPrice;
    const subtotal = Math.max(quantity * unitExcl - discount, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { quantity, taxRate, discount, unitExcl, subtotal, tax, total };
  }, [form.discount, form.priceMode, form.quantity, form.taxRate, form.unitPrice]);

  async function loadClients(preselectClientId = '') {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('opc_client_overview')
        .select('client_id,contact_id,billing_name,company_name,full_name,billing_email,email,primary_site_id,primary_site_name,primary_site_address,primary_site_postal_code,primary_site_city')
        .order('billing_name', { ascending: true })
        .limit(300);
      if (error) throw error;
      const rows = (data || []) as ClientOption[];
      setClients(rows);
      if (preselectClientId && rows.some((client) => getClientId(client) === preselectClientId)) {
        setForm((current) => ({ ...current, clientId: preselectClientId }));
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Kunden konnten nicht geladen werden.');
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadSites(clientId: string) {
    setLoadingSites(true);
    try {
      const { data, error } = await supabase
        .from('opc_client_sites')
        .select('id,client_id,contact_id,site_name,address_text,postal_code,city,country')
        .eq('client_id', clientId)
        .order('site_name', { ascending: true });
      if (error) throw error;
      const loaded = (data || []) as SiteOption[];
      setSites(loaded);
      setForm((current) => {
        if (current.clientSiteId && loaded.some((site) => site.id === current.clientSiteId)) return current;
        const fallback = loaded[0]?.id || '';
        return { ...current, clientSiteId: fallback };
      });
    } catch (error: any) {
      setSites([]);
      setErrorMessage(error?.message || 'Standorte konnten nicht geladen werden.');
    } finally {
      setLoadingSites(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!form.clientId) return 'Bitte Kunde auswählen.';
    if (!clean(form.title)) return 'Bitte Titel erfassen.';
    if (!form.issueDate) return 'Bitte Datum erfassen.';
    if (!clean(form.itemTitle)) return 'Bitte mindestens eine Position erfassen.';
    return '';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    setErrorMessage('');
    setSuccessMessage('');
    const validation = validate();
    if (validation) {
      setErrorMessage(validation);
      return;
    }

    setSaving(true);

    try {
      const clientSnapshot = selectedClient
        ? {
            client_id: form.clientId,
            billing_name: selectedClient.billing_name,
            company_name: selectedClient.company_name,
            full_name: selectedClient.full_name,
            email: selectedClient.email || selectedClient.billing_email,
          }
        : {};

      const siteSnapshot = selectedSite
        ? {
            client_site_id: selectedSite.id,
            site_name: selectedSite.site_name,
            address_text: selectedSite.address_text || selectedSite.address,
            postal_code: selectedSite.postal_code,
            city: selectedSite.city,
            country: selectedSite.country,
          }
        : {};

      const quotePayload = {
        client_id: form.clientId,
        contact_id: selectedSite?.contact_id || selectedClient?.contact_id || null,
        client_site_id: form.clientSiteId || null,
        status: form.status,
        quote_type: form.quoteType,
        title: clean(form.title),
        language: 'de',
        currency: 'CHF',
        issue_date: form.issueDate,
        valid_until: form.validUntil || null,
        intro_text: form.introText || null,
        scope_text: form.description || null,
        service_description_mode: 'embedded',
        service_description_text: form.description || null,
        terms_text: form.termsText || null,
        payment_terms: form.paymentTerms || null,
        customer_notes: form.customerNotes || null,
        internal_notes: form.internalNotes || null,
        client_snapshot: clientSnapshot,
        site_snapshot: siteSnapshot,
        subtotal_chf: roundMoney(totals.subtotal),
        discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        metadata: {
          created_from: 'offerte_neu_page',
          price_input_mode: form.priceMode,
        },
      };

      const { data: quote, error: quoteError } = await supabase
        .from('opc_quotes')
        .insert(quotePayload)
        .select('id, quote_number')
        .single();

      if (quoteError) throw quoteError;

      const itemPayload = {
        quote_id: quote.id,
        sort_order: 1,
        item_type: 'service',
        title: clean(form.itemTitle),
        description: form.description || null,
        quantity: totals.quantity,
        unit: form.unit || 'pauschal',
        unit_price_chf: roundMoney(totals.unitExcl),
        discount_chf: 0,
        tax_rate: roundMoney(totals.taxRate),
        subtotal_chf: roundMoney(totals.subtotal),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        metadata: {
          input_price_mode: form.priceMode,
          input_price_chf: parseMoney(form.unitPrice),
        },
      };

      const { error: itemError } = await supabase.from('opc_quote_items').insert(itemPayload);
      if (itemError) throw itemError;

      setSuccessMessage('Offerte wurde erstellt.');
      window.location.href = `${baseUrl}/offerte/${quote.id}`;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Offerte konnte nicht erstellt werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/offerte/neu" fullWidth hideTopBar>
      <OPCPageShell>
        <form onSubmit={handleSubmit} className="opc-new-doc-page" style={{ fontFamily: pageFont }}>
          <div className="opc-new-doc-topbar">
            <a href={`${baseUrl}/offerten`} className="opc-back-pill">
              <ArrowLeft size={16} /> Zurück
            </a>

            <div className="opc-new-doc-top-actions">
              <a href={`${baseUrl}/kunden`} className="opc-button light">
                <UserRound size={16} /> Kunde auswählen
              </a>
              <button type="submit" disabled={saving} className="opc-button dark">
                <Save size={16} /> {saving ? 'Speichert...' : 'Offerte erstellen'}
              </button>
            </div>
          </div>

          <section className="opc-new-doc-hero" style={cardStyle}>
            <div>
              <p>Offerte</p>
              <h1>Neue Offerte</h1>
              <span>{getClientName(selectedClient) || 'Kunde noch nicht gewählt'}</span>
            </div>
            <div className="opc-new-doc-total-box">
              <span>Total inkl. MWST</span>
              <strong>{formatMoney(totals.total)}</strong>
              <em>Preisangaben: {form.priceMode === 'incl' ? 'inkl. MWST' : 'exkl. MWST'}</em>
            </div>
          </section>

          {errorMessage ? <div className="opc-alert error">{errorMessage}</div> : null}
          {successMessage ? <div className="opc-alert success"><Check size={16} />{successMessage}</div> : null}

          <div className="opc-new-doc-metrics">
            <div style={cardStyle}><FileText size={18} /><strong>{form.status === 'draft' ? 'Entwurf' : 'Bereit'}</strong><span>Status</span></div>
            <div style={cardStyle}><CalendarDays size={18} /><strong>{form.issueDate}</strong><span>Datum</span></div>
            <div style={cardStyle}><WalletCards size={18} /><strong>{formatMoney(totals.subtotal)}</strong><span>Exkl. MWST</span></div>
            <div style={cardStyle}><Building2 size={18} /><strong>{getSiteLabel(selectedSite) || 'Kein Standort'}</strong><span>Standort</span></div>
          </div>

          <Section title="Kunde & Offertenkopf" icon={<UserRound size={17} />}>
            <div className="opc-grid two">
              <div>
                <Label required>Kunde</Label>
                <select value={form.clientId} onChange={(event) => update('clientId', event.target.value)} disabled={loadingClients} style={inputStyle}>
                  <option value="">{loadingClients ? 'Kunden werden geladen...' : 'Kunden auswählen'}</option>
                  {clients.map((client) => <option key={getClientId(client)} value={getClientId(client)}>{getClientName(client)}</option>)}
                </select>
              </div>
              <div>
                <Label>Standort</Label>
                <select value={form.clientSiteId} onChange={(event) => update('clientSiteId', event.target.value)} disabled={!form.clientId || loadingSites || sites.length === 0} style={inputStyle}>
                  <option value="">{!form.clientId ? 'Zuerst Kunde auswählen' : loadingSites ? 'Standorte werden geladen...' : 'Kein Standort'}</option>
                  {sites.map((site) => <option key={site.id} value={site.id}>{getSiteLabel(site)}</option>)}
                </select>
              </div>
              <div>
                <Label required>Titel</Label>
                <input value={form.title} onChange={(event) => update('title', event.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label>Status</Label>
                <select value={form.status} onChange={(event) => update('status', event.target.value)} style={inputStyle}>
                  <option value="draft">Entwurf</option>
                  <option value="ready">Bereit</option>
                  <option value="sent">Gesendet</option>
                  <option value="accepted">Angenommen</option>
                </select>
              </div>
              <div>
                <Label>Datum</Label>
                <input type="date" value={form.issueDate} onChange={(event) => update('issueDate', event.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label>Gültig bis</Label>
                <input type="date" value={form.validUntil} onChange={(event) => update('validUntil', event.target.value)} style={inputStyle} />
              </div>
            </div>
          </Section>

          <Section title="Position & Preis" icon={<Plus size={17} />}>
            <div className="opc-grid two">
              <div>
                <Label required>Position</Label>
                <input value={form.itemTitle} onChange={(event) => update('itemTitle', event.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label>Preisangaben</Label>
                <select value={form.priceMode} onChange={(event) => update('priceMode', event.target.value as FormState['priceMode'])} style={inputStyle}>
                  <option value="excl">Preise exkl. MWST eingeben</option>
                  <option value="incl">Preise inkl. MWST eingeben</option>
                </select>
              </div>
            </div>
            <div className="opc-grid four">
              <div><Label>Menge</Label><input value={form.quantity} onChange={(event) => update('quantity', event.target.value)} inputMode="decimal" style={inputStyle} /></div>
              <div><Label>Einheit</Label><input value={form.unit} onChange={(event) => update('unit', event.target.value)} style={inputStyle} /></div>
              <div><Label>Preis CHF</Label><input value={form.unitPrice} onChange={(event) => update('unitPrice', event.target.value)} inputMode="decimal" style={inputStyle} /></div>
              <div><Label>MWST %</Label><input value={form.taxRate} onChange={(event) => update('taxRate', event.target.value)} inputMode="decimal" style={inputStyle} /></div>
            </div>
            <div className="opc-full-field"><Label>Leistungsbeschreibung</Label><textarea value={form.description} onChange={(event) => update('description', event.target.value)} style={textareaStyle} /></div>
          </Section>

          <Section title="Texte" icon={<FileText size={17} />}>
            <div className="opc-grid two">
              <div><Label>Einleitung</Label><textarea value={form.introText} onChange={(event) => update('introText', event.target.value)} style={textareaStyle} /></div>
              <div><Label>Bedingungen</Label><textarea value={form.termsText} onChange={(event) => update('termsText', event.target.value)} style={textareaStyle} /></div>
              <div><Label>Zahlungsbedingungen</Label><textarea value={form.paymentTerms} onChange={(event) => update('paymentTerms', event.target.value)} style={textareaStyle} /></div>
              <div><Label>Interne Notizen</Label><textarea value={form.internalNotes} onChange={(event) => update('internalNotes', event.target.value)} style={textareaStyle} /></div>
            </div>
          </Section>

          <div className="opc-bottom-actions" style={cardStyle}>
            <a href={`${baseUrl}/offerten`} className="opc-button light">Abbrechen</a>
            <button type="submit" disabled={saving} className="opc-button dark">{saving ? 'Speichert...' : 'Offerte erstellen'}</button>
          </div>
        </form>

        <style>{`${opcResponsiveStyle}${sharedCss}`}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

const sharedCss = `
  .opc-new-doc-page { color: #111827; padding: 0 0 140px; }
  .opc-new-doc-page * { box-sizing: border-box; }
  .opc-new-doc-topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .opc-new-doc-top-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
  .opc-back-pill, .opc-button { height: 42px; border-radius: 999px; border: 1px solid #E5E7EB; background: #FFF; color: #111827; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; font-size: 13px; font-weight: 780; text-decoration: none; font-family: ${pageFont}; cursor: pointer; white-space: nowrap; }
  .opc-button { border-radius: 14px; height: 46px; min-width: 150px; }
  .opc-button.dark { background: #0F1115; border-color: #0F1115; color: #FFF; }
  .opc-new-doc-hero { padding: 22px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .opc-new-doc-hero p { margin: 0 0 7px; font-size: 12px; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; color: #9CA3AF; }
  .opc-new-doc-hero h1 { margin: 0; font-size: 32px; line-height: 1.03; letter-spacing: -.05em; font-weight: 880; color: #111827; }
  .opc-new-doc-hero span { display: block; margin-top: 8px; color: #6B7280; font-size: 14px; font-weight: 660; }
  .opc-new-doc-total-box { min-width: 240px; border: 1px solid #E5E7EB; border-radius: 16px; padding: 15px; background: #FAFAFA; }
  .opc-new-doc-total-box span, .opc-new-doc-total-box em { display: block; color: #6B7280; font-size: 12px; font-weight: 760; font-style: normal; }
  .opc-new-doc-total-box strong { display: block; margin: 7px 0; font-size: 24px; font-weight: 880; color: #111827; letter-spacing: -.04em; }
  .opc-new-doc-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
  .opc-new-doc-metrics > div { min-height: 86px; padding: 16px; display: grid; gap: 5px; align-content: center; color: #111827; }
  .opc-new-doc-metrics svg { color: #0F1115; }
  .opc-new-doc-metrics strong { font-size: 17px; font-weight: 860; overflow-wrap: anywhere; }
  .opc-new-doc-metrics span { color: #6B7280; font-size: 12px; font-weight: 760; }
  .opc-new-doc-card { padding: 18px; margin-bottom: 14px; }
  .opc-new-doc-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .opc-new-doc-section-icon { width: 36px; height: 36px; border-radius: 13px; border: 1px solid #E5E7EB; background: #FAFAFA; display: flex; align-items: center; justify-content: center; }
  .opc-new-doc-section-header h2 { margin: 0; font-size: 19px; line-height: 1.15; letter-spacing: -.035em; font-weight: 860; color: #111827; }
  .opc-grid { display: grid; gap: 12px; margin-bottom: 12px; }
  .opc-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .opc-grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .opc-new-doc-label { display: block; color: #374151; font-size: 12px; font-weight: 760; margin-bottom: 7px; }
  .opc-new-doc-label span { color: #D97706; }
  .opc-full-field { margin-top: 12px; }
  .opc-alert { border-radius: 16px; padding: 14px 16px; font-size: 13px; font-weight: 740; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .opc-alert.error { border: 1px solid #FECACA; background: #FEF2F2; color: #B91C1C; }
  .opc-alert.success { border: 1px solid #BBF7D0; background: #F0FDF4; color: #166534; }
  .opc-bottom-actions { padding: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .opc-bottom-actions .opc-button { width: 100%; border-radius: 14px; }
  @media (max-width: 760px) {
    .opc-new-doc-topbar { flex-direction: column; align-items: stretch; }
    .opc-new-doc-top-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
    .opc-new-doc-top-actions .opc-button, .opc-back-pill { width: 100%; min-width: 0; }
    .opc-new-doc-hero { flex-direction: column; align-items: stretch; padding: 18px; }
    .opc-new-doc-total-box { min-width: 0; width: 100%; }
    .opc-grid.two { grid-template-columns: 1fr; }
    .opc-grid.four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .opc-new-doc-hero h1 { font-size: 29px; }
  }
`;
