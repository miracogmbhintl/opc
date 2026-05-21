import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Globe2,
  MapPin,
  Search,
  StickyNote,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';

type CreatedClient = {
  id: string;
  contact_id?: string;
  company_name: string;
  client_name: string;
  email: string;
  phone?: string;
  status?: string;
  client_type?: string;
  created_at: string;
  has_portal_access?: boolean;
};

type FormState = {
  companyName: string;
  website: string;
  industry: string;
  taxId: string;
  clientType: string;
  fullName: string;
  email: string;
  phone: string;
  preferredContact: string;
  street: string;
  streetNumber: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  internalNotes: string;
};

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  details?: string;
  clients?: T[];
  profile?: T;
}

const initialFormState: FormState = {
  companyName: '',
  website: '',
  industry: '',
  taxId: '',
  clientType: 'geschaeftskunden',
  fullName: '',
  email: '',
  phone: '',
  preferredContact: 'email',
  street: '',
  streetNumber: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Schweiz',
  internalNotes: '',
};

const industries = [
  'Gebäudereinigung',
  'Immobilienverwaltung',
  'Büro & Verwaltung',
  'Gastronomie',
  'Hotel',
  'Retail',
  'Bau',
  'Praxis / Medizin',
  'Privathaushalt',
  'Industrie',
  'Andere',
];

const countries = [
  'Schweiz',
  'Deutschland',
  'Frankreich',
  'Italien',
  'Österreich',
  'Liechtenstein',
  'Albanien',
  'USA',
  'Kanada',
  'Andere',
];

const BRAND = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#111111',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  green: '#166534',
  greenBg: '#F0FDF4',
  red: '#B91C1C',
  redBg: '#FEF2F2',
  amber: '#92400E',
  amberBg: '#FFFBEB',
};

const pageFont =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, "Helvetica Neue", Segoe UI, Roboto, sans-serif';

const cardStyle: CSSProperties = {
  background: BRAND.card,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '22px',
  boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '0 13px',
  borderRadius: '12px',
  border: `1px solid ${BRAND.border}`,
  background: '#FFFFFF',
  color: BRAND.text,
  outline: 'none',
  fontSize: '14px',
  fontWeight: 560,
  fontFamily: pageFont,
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 720,
  color: BRAND.text,
  marginBottom: '7px',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '17px',
  fontWeight: 820,
  letterSpacing: '-0.02em',
  color: BRAND.text,
};

function formatDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {required ? <span style={{ color: BRAND.red }}> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function Input({
  name,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
}: {
  name: keyof FormState;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={onChange}
      style={inputStyle}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = BRAND.black;
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = BRAND.border;
      }}
    />
  );
}

function Select({
  name,
  value,
  onChange,
  children,
}: {
  name: keyof FormState;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={onChange}
      style={inputStyle}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = BRAND.black;
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = BRAND.border;
      }}
    >
      {children}
    </select>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '18px',
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: '#F8F8F8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: BRAND.black,
        }}
      >
        {icon}
      </span>
      <h2 style={sectionTitleStyle}>{title}</h2>
    </div>
  );
}

function StatusMessage({
  type,
  message,
}: {
  type: 'success' | 'error' | 'warning';
  message: string;
}) {
  if (!message) return null;

  const isSuccess = type === 'success';
  const isWarning = type === 'warning';

  return (
    <div
      style={{
        padding: '13px 15px',
        borderRadius: '14px',
        border: `1px solid ${
          isSuccess ? '#BBF7D0' : isWarning ? '#FDE68A' : '#FCA5A5'
        }`,
        background: isSuccess ? BRAND.greenBg : isWarning ? BRAND.amberBg : BRAND.redBg,
        color: isSuccess ? BRAND.green : isWarning ? BRAND.amber : BRAND.red,
        fontSize: '14px',
        fontWeight: 660,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '18px',
      }}
    >
      {isSuccess ? <CheckCircle2 size={17} /> : null}
      {message}
    </div>
  );
}

export default function AdminClientCreator() {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [businessCertificate, setBusinessCertificate] = useState<File | null>(null);
  const [clients, setClients] = useState<CreatedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [industrySearch, setIndustrySearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const filteredIndustries = useMemo(() => {
    const query = industrySearch.trim().toLowerCase();

    if (!query) return industries;

    return industries.filter((industry) => industry.toLowerCase().includes(query));
  }, [industrySearch]);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();

    if (!query) return countries;

    return countries.filter((country) => country.toLowerCase().includes(query));
  }, [countrySearch]);

  useEffect(() => {
    void loadRecentlyCreatedClients();
  }, []);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Nicht authentifiziert. Bitte erneut anmelden.');
    }

    return session.access_token;
  }

  async function loadRecentlyCreatedClients() {
    setLoadingClients(true);

    try {
      const accessToken = await getAccessToken();

      const response = await fetch(`${baseUrl}/api/opc/create-client`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = (await response.json().catch(() => null)) as ApiResponse<CreatedClient> | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Kunden konnten nicht geladen werden.');
      }

      setClients(result.clients || []);
    } catch (err) {
      console.error('Error loading recently created clients:', err);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setError('');
    setWarning('');

    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileName = file.name.toLowerCase();

    const validType =
      allowedTypes.includes(file.type) ||
      allowedExtensions.some((extension) => fileName.endsWith(extension));

    if (!validType) {
      setError('Bitte PDF, JPG oder PNG hochladen.');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Das Dokument darf maximal 10MB gross sein.');
      event.target.value = '';
      return;
    }

    setBusinessCertificate(file);
  }

  function removeFile() {
    setBusinessCertificate(null);
  }

  function resetForm() {
    setFormData(initialFormState);
    setBusinessCertificate(null);
    setIndustrySearch('');
    setCountrySearch('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError('');
    setSuccess('');
    setWarning('');

    try {
      const accessToken = await getAccessToken();

      const payload = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        payload.append(key, value || '');
      });

      if (businessCertificate) {
        payload.append('businessCertificate', businessCertificate);
      }

      const response = await fetch(`${baseUrl}/api/opc/create-client`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: payload,
      });

      type CreateClientResponse = {
        success?: boolean;
        error?: string;
        certificateWarning?: string;
      };

      const result = (await response.json().catch(() => null)) as
        | CreateClientResponse
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Kunde konnte nicht angelegt werden.');
      }

      setSuccess('Kunde wurde erfolgreich angelegt. Es wurde kein Portalzugang erstellt.');
      setWarning(result.certificateWarning || '');
      resetForm();
      await loadRecentlyCreatedClients();
    } catch (err: any) {
      console.error('Create client error:', err);
      setError(err?.message || 'Kunde konnte nicht angelegt werden.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: '100%',
        fontFamily: pageFont,
        color: BRAND.text,
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <a
            href={`${baseUrl}/kunden`}
            style={{
              height: '36px',
              padding: '0 13px',
              borderRadius: '11px',
              border: `1px solid ${BRAND.border}`,
              background: '#FFFFFF',
              color: BRAND.muted,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 720,
            }}
          >
            <ArrowLeft size={15} />
            Zurück zu Kunden
          </a>

          <div
            style={{
              color: BRAND.muted,
              fontSize: '13px',
              fontWeight: 620,
            }}
          >
            Interner Kunde · Kein automatischer Portalzugang
          </div>
        </div>

        <StatusMessage type="error" message={error} />
        <StatusMessage type="success" message={success} />
        <StatusMessage type="warning" message={warning} />

        <form
          onSubmit={handleSubmit}
          style={{
            ...cardStyle,
            padding: '28px',
            marginBottom: '22px',
          }}
        >
          <div style={{ marginBottom: '30px' }}>
            <SectionHeader icon={<Building2 size={18} />} title="Unternehmensinformationen" />

            <div className="opc-create-client-grid-2" style={grid2Style}>
              <Field label="Firmenname" required>
                <Input
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Firmenname eingeben"
                  required
                />
              </Field>

              <Field label="Website">
                <Input
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />
              </Field>

              <Field label="Branche">
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={formData.industry || industrySearch}
                    placeholder="Branche suchen oder auswählen"
                    onChange={(event) => {
                      setIndustrySearch(event.target.value);
                      setFormData((prev) => ({ ...prev, industry: '' }));
                      setShowIndustryDropdown(true);
                    }}
                    onFocus={() => setShowIndustryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowIndustryDropdown(false), 160)}
                    style={{
                      ...inputStyle,
                      paddingLeft: '38px',
                    }}
                  />
                  <Search
                    size={15}
                    color={BRAND.faint}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {showIndustryDropdown && filteredIndustries.length > 0 && (
                    <Dropdown>
                      {filteredIndustries.map((industry) => (
                        <DropdownItem
                          key={industry}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, industry }));
                            setIndustrySearch('');
                            setShowIndustryDropdown(false);
                          }}
                        >
                          {industry}
                        </DropdownItem>
                      ))}
                    </Dropdown>
                  )}
                </div>
              </Field>

              <Field label="UID / MWST-Nummer">
                <Input
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                  placeholder="z.B. CHE-123.456.789"
                />
              </Field>

              <Field label="Kundentyp">
                <Select name="clientType" value={formData.clientType} onChange={handleChange}>
                  <option value="geschaeftskunden">Geschäftskunde</option>
                  <option value="privatkunden">Privatkunde</option>
                  <option value="baukunden">Baukunde</option>
                  <option value="unknown">Unbekannt</option>
                </Select>
              </Field>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <SectionHeader icon={<UserRound size={18} />} title="Kontaktperson" />

            <div className="opc-create-client-grid-2" style={grid2Style}>
              <Field label="Vollständiger Name" required>
                <Input
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Kontaktperson eingeben"
                  required
                />
              </Field>

              <Field label="E-Mail-Adresse" required>
                <Input
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  type="email"
                  required
                />
              </Field>

              <Field label="Telefonnummer">
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+41 ..."
                />
              </Field>

              <Field label="Bevorzugter Kontaktweg">
                <Select name="preferredContact" value={formData.preferredContact} onChange={handleChange}>
                  <option value="email">E-Mail</option>
                  <option value="phone">Telefon</option>
                  <option value="whatsapp">WhatsApp</option>
                </Select>
              </Field>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <SectionHeader icon={<MapPin size={18} />} title="Adresse" />

            <div
              className="opc-create-client-address"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 180px',
                gap: '18px',
                marginBottom: '18px',
              }}
            >
              <Field label="Strasse">
                <Input
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  placeholder="Strasse eingeben"
                />
              </Field>

              <Field label="Nummer">
                <Input
                  name="streetNumber"
                  value={formData.streetNumber}
                  onChange={handleChange}
                  placeholder="Nr."
                />
              </Field>
            </div>

            <div className="opc-create-client-grid-2" style={grid2Style}>
              <Field label="Stadt">
                <Input
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Stadt eingeben"
                />
              </Field>

              <Field label="Kanton / Bundesland">
                <Input
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Kanton oder Bundesland"
                />
              </Field>

              <Field label="PLZ">
                <Input
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  placeholder="PLZ eingeben"
                />
              </Field>

              <Field label="Land">
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={formData.country || countrySearch}
                    placeholder="Land suchen oder auswählen"
                    onChange={(event) => {
                      setCountrySearch(event.target.value);
                      setFormData((prev) => ({ ...prev, country: '' }));
                      setShowCountryDropdown(true);
                    }}
                    onFocus={() => setShowCountryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCountryDropdown(false), 160)}
                    style={{
                      ...inputStyle,
                      paddingLeft: '38px',
                    }}
                  />
                  <Globe2
                    size={15}
                    color={BRAND.faint}
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {showCountryDropdown && filteredCountries.length > 0 && (
                    <Dropdown>
                      {filteredCountries.map((country) => (
                        <DropdownItem
                          key={country}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, country }));
                            setCountrySearch('');
                            setShowCountryDropdown(false);
                          }}
                        >
                          {country}
                        </DropdownItem>
                      ))}
                    </Dropdown>
                  )}
                </div>
              </Field>
            </div>
          </div>

          <div
            className="opc-create-client-grid-2"
            style={{
              ...grid2Style,
              alignItems: 'start',
              marginBottom: '28px',
            }}
          >
            <div>
              <SectionHeader icon={<StickyNote size={18} />} title="Interne Notizen" />

              <Field label="Notizen nur für Admins">
                <textarea
                  name="internalNotes"
                  value={formData.internalNotes}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Interne Notizen zu diesem Kunden..."
                  style={{
                    width: '100%',
                    minHeight: '160px',
                    padding: '13px',
                    borderRadius: '12px',
                    border: `1px solid ${BRAND.border}`,
                    background: '#FFFFFF',
                    color: BRAND.text,
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: 560,
                    fontFamily: pageFont,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(event) => {
                    event.currentTarget.style.borderColor = BRAND.black;
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.borderColor = BRAND.border;
                  }}
                />
              </Field>
            </div>

            <div>
              <SectionHeader icon={<FileText size={18} />} title="Handelsregister / Dokument" />

              <Field label="PDF, JPG oder PNG · max. 10MB">
                {!businessCertificate ? (
                  <label
                    style={{
                      width: '100%',
                      minHeight: '160px',
                      borderRadius: '14px',
                      border: `2px dashed ${BRAND.border}`,
                      background: '#FAFAFA',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: BRAND.muted,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Upload size={28} color={BRAND.faint} style={{ marginBottom: '10px' }} />
                    <span style={{ fontSize: '14px', fontWeight: 680, marginBottom: '4px' }}>
                      Datei hochladen
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 560 }}>
                      PDF, JPG, PNG
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                ) : (
                  <div
                    style={{
                      minHeight: '160px',
                      borderRadius: '14px',
                      border: `1px solid ${BRAND.border}`,
                      background: '#FAFAFA',
                      padding: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <FileText size={22} color={BRAND.black} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 760,
                            color: BRAND.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '320px',
                          }}
                        >
                          {businessCertificate.name}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: BRAND.muted,
                            fontWeight: 560,
                            marginTop: '4px',
                          }}
                        >
                          {(businessCertificate.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={removeFile}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        border: `1px solid ${BRAND.border}`,
                        background: '#FFFFFF',
                        color: BRAND.muted,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </Field>
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${BRAND.border}`,
              paddingTop: '20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <a
              href={`${baseUrl}/kunden`}
              style={{
                height: '44px',
                padding: '0 18px',
                borderRadius: '12px',
                border: `1px solid ${BRAND.border}`,
                background: '#FFFFFF',
                color: BRAND.muted,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 720,
              }}
            >
              Abbrechen
            </a>

            <button
              type="submit"
              disabled={loading}
              style={{
                height: '44px',
                padding: '0 18px',
                borderRadius: '12px',
                border: 'none',
                background: loading ? '#9CA3AF' : BRAND.black,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 760,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Kunde wird angelegt...' : 'Kunde anlegen'}
            </button>
          </div>
        </form>

        <section
          style={{
            ...cardStyle,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${BRAND.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 820,
                color: BRAND.text,
              }}
            >
              Zuletzt angelegte Kunden
            </h2>

            <button
              type="button"
              onClick={() => void loadRecentlyCreatedClients()}
              style={{
                border: 'none',
                background: 'transparent',
                color: BRAND.muted,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 720,
              }}
            >
              Aktualisieren
            </button>
          </div>

          {loadingClients ? (
            <div style={emptyStateStyle}>Kunden werden geladen...</div>
          ) : clients.length === 0 ? (
            <div style={emptyStateStyle}>Noch keine Kunden angelegt.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BRAND.border}` }}>
                    {['Firma', 'Kontakt', 'E-Mail', 'Telefon', 'Typ', 'Erstellt'].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: '13px 24px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: 820,
                          color: BRAND.muted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {clients.map((client, index) => (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: index < clients.length - 1 ? `1px solid #F3F4F6` : 'none',
                      }}
                    >
                      <td style={tableCellStrongStyle}>{client.company_name || '-'}</td>
                      <td style={tableCellStyle}>{client.client_name || '-'}</td>
                      <td style={tableCellStyle}>{client.email || '-'}</td>
                      <td style={tableCellStyle}>{client.phone || '-'}</td>
                      <td style={tableCellStyle}>
                        {client.client_type === 'geschaeftskunden'
                          ? 'Geschäftskunde'
                          : client.client_type === 'privatkunden'
                            ? 'Privatkunde'
                            : client.client_type === 'baukunden'
                              ? 'Baukunde'
                              : 'Unbekannt'}
                      </td>
                      <td style={tableCellStyle}>{formatDate(client.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .opc-create-client-grid-2 {
            grid-template-columns: 1fr !important;
          }

          .opc-create-client-address {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 5px)',
        left: 0,
        right: 0,
        maxHeight: '220px',
        overflowY: 'auto',
        background: '#FFFFFF',
        border: `1px solid ${BRAND.border}`,
        borderRadius: '12px',
        boxShadow: '0 12px 30px rgba(15, 17, 21, 0.10)',
        zIndex: 50,
      }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        padding: '11px 14px',
        textAlign: 'left',
        color: BRAND.text,
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: pageFont,
      }}
    >
      {children}
    </button>
  );
}

const grid2Style: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '18px',
};

const emptyStateStyle: CSSProperties = {
  padding: '42px 24px',
  textAlign: 'center',
  color: BRAND.muted,
  fontSize: '14px',
  fontWeight: 620,
};

const tableCellStyle: CSSProperties = {
  padding: '15px 24px',
  color: BRAND.muted,
  fontSize: '14px',
  fontWeight: 560,
  whiteSpace: 'nowrap',
};

const tableCellStrongStyle: CSSProperties = {
  ...tableCellStyle,
  color: BRAND.text,
  fontWeight: 760,
};