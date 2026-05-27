import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type LinkInfo = {
  ok: boolean;
  token?: string;
  title?: string;
  description?: string;
  site_label?: string | null;
  facility_label?: string | null;
  link_type?: 'facility' | 'general' | string;
  is_general?: boolean;
  error?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type Props = {
  token: string;
};

type PlaceSuggestion = {
  placeId: string;
  label: string;
  secondaryLabel?: string;
};

type SelectedPlace = {
  placeId: string;
  name?: string;
  formattedAddress: string;
  addressText?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  addressComponents?: unknown;
};

const categoryOptions = [
  { value: 'damage', label: 'Schaden melden' },
  { value: 'cleaning_needed', label: 'Reinigung notwendig' },
  { value: 'recleaning', label: 'Nachreinigung nötig' },
  { value: 'material_missing', label: 'Material fehlt' },
  { value: 'complaint', label: 'Beschwerde' },
  { value: 'praise', label: 'Lob / positives Feedback' },
  { value: 'other', label: 'Sonstiges' },
];

function createSessionToken() {
  const randomPart = Math.random().toString(36).slice(2, 14);
  const timePart = Date.now().toString(36);
  return `opc${timePart}${randomPart}`.slice(0, 36);
}

function getAddressComponent(components: any, types: string[]) {
  if (!Array.isArray(components)) return '';

  const found = components.find((component) => {
    const componentTypes = component.types || [];
    return types.some((type) => componentTypes.includes(type));
  });

  return found?.longText || found?.long_name || found?.shortText || found?.short_name || '';
}

function normalizeSuggestions(data: any): PlaceSuggestion[] {
  const rawList = data?.predictions || data?.suggestions || data?.items || data?.places || [];

  return rawList
    .map((item: any) => {
      const prediction = item.placePrediction || item;
      const text = prediction.text?.text || prediction.description || prediction.formattedAddress || prediction.label;
      const secondary =
        prediction.structuredFormat?.secondaryText?.text ||
        prediction.structured_formatting?.secondary_text ||
        prediction.secondaryLabel ||
        '';

      const placeId = prediction.placeId || prediction.place_id || prediction.id || item.placeId || item.place_id;

      if (!placeId || !text) return null;

      return {
        placeId,
        label: text,
        secondaryLabel: secondary,
      };
    })
    .filter(Boolean);
}

function normalizePlaceDetails(data: any, fallback?: PlaceSuggestion): SelectedPlace {
  const place = data?.place || data?.result || data;
  const components = place.addressComponents || place.address_components || [];

  const location = place.location || place.geometry?.location || {};
  const latitude =
    typeof location.latitude === 'number'
      ? location.latitude
      : typeof location.lat === 'number'
        ? location.lat
        : typeof location.lat === 'function'
          ? location.lat()
          : null;

  const longitude =
    typeof location.longitude === 'number'
      ? location.longitude
      : typeof location.lng === 'number'
        ? location.lng
        : typeof location.lng === 'function'
          ? location.lng()
          : null;

  const formattedAddress =
    place.formattedAddress ||
    place.formatted_address ||
    fallback?.label ||
    '';

  const streetNumber = getAddressComponent(components, ['street_number']);
  const route = getAddressComponent(components, ['route']);
  const addressText = [route, streetNumber].filter(Boolean).join(' ') || formattedAddress;

  return {
    placeId: place.id || place.place_id || place.placeId || fallback?.placeId || '',
    name: place.displayName?.text || place.name || fallback?.label || '',
    formattedAddress,
    addressText,
    postalCode: getAddressComponent(components, ['postal_code']),
    city:
      getAddressComponent(components, ['locality']) ||
      getAddressComponent(components, ['postal_town']) ||
      getAddressComponent(components, ['administrative_area_level_2']),
    country: getAddressComponent(components, ['country']),
    latitude,
    longitude,
    addressComponents: components,
  };
}

export default function PublicTicketForm({ token }: Props) {
  const sessionTokenRef = useRef(createSessionToken());

  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [category, setCategory] = useState('damage');
  const [description, setDescription] = useState('');
  const [facilityArea, setFacilityArea] = useState('');

  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');

  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const isGeneral = Boolean(linkInfo?.is_general || linkInfo?.link_type === 'general');

  const filePreviews = useMemo(() => {
    return files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [filePreviews]);

  useEffect(() => {
    let alive = true;

    async function loadLink() {
      try {
        setLoadingLink(true);
        setLinkError(null);

        const res = await fetch(`/api/opc/public-ticket-link?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        const data = (await res.json()) as LinkInfo;

        if (!alive) return;

        if (!res.ok || !data.ok) {
          setLinkError(data.error || 'Dieser QR-Code ist nicht aktiv oder wurde nicht gefunden.');
          setLinkInfo(null);
          return;
        }

        setLinkInfo(data);
      } catch {
        if (!alive) return;
        setLinkError('QR-Code konnte nicht geladen werden.');
      } finally {
        if (alive) setLoadingLink(false);
      }
    }

    loadLink();

    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!isGeneral) return;

    const query = addressQuery.trim();

    if (query.length < 3 || selectedPlace?.formattedAddress === query) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      try {
        setAddressLoading(true);
        setAddressError('');

        const params = new URLSearchParams({
          q: query,
          input: query,
          sessionToken: sessionTokenRef.current,
        });

        const res = await fetch(`/api/opc/google-place-autocomplete?${params.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        const data = await res.json();

        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || 'Adresssuche konnte nicht geladen werden.');
        }

        setSuggestions(normalizeSuggestions(data));
      } catch (error: any) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setAddressError(error?.message || 'Adresssuche konnte nicht geladen werden.');
      } finally {
        if (!controller.signal.aborted) setAddressLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [addressQuery, isGeneral, selectedPlace?.formattedAddress]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    try {
      setAddressLoading(true);
      setAddressError('');

      const params = new URLSearchParams({
        placeId: suggestion.placeId,
        sessionToken: sessionTokenRef.current,
      });

      const res = await fetch(`/api/opc/google-place-details?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Adresse konnte nicht geladen werden.');
      }

      const place = normalizePlaceDetails(data, suggestion);

      setSelectedPlace(place);
      setAddressQuery(place.formattedAddress || suggestion.label);
      setSuggestions([]);
    } catch (error: any) {
      const fallback: SelectedPlace = {
        placeId: suggestion.placeId,
        formattedAddress: suggestion.label,
        name: suggestion.label,
      };

      setSelectedPlace(fallback);
      setAddressQuery(suggestion.label);
      setSuggestions([]);
      setAddressError(error?.message || '');
    } finally {
      setAddressLoading(false);
    }
  }

  function handleFiles(nextFiles: FileList | null) {
    const accepted = Array.from(nextFiles || []).filter((file) => file.size > 0).slice(0, 5);
    setFiles(accepted);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isGeneral && !selectedPlace && !addressQuery.trim()) {
      setSubmitState('error');
      setSubmitError('Bitte suchen Sie die Adresse oder tragen Sie sie ein.');
      return;
    }

    if (!description.trim()) {
      setSubmitState('error');
      setSubmitError('Bitte beschreiben Sie kurz, was geprüft werden soll.');
      return;
    }

    try {
      setSubmitState('submitting');
      setSubmitError(null);

      const formData = new FormData();

      formData.append('token', token);
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('facility_area', facilityArea.trim());

      formData.append('reporter_name', reporterName.trim());
      formData.append('reporter_phone', reporterPhone.trim());
      formData.append('reporter_email', reporterEmail.trim());

      if (isGeneral) {
        formData.append('manual_address', addressQuery.trim());
        formData.append('google_place_id', selectedPlace?.placeId || '');
        formData.append('google_place_name', selectedPlace?.name || '');
        formData.append('google_formatted_address', selectedPlace?.formattedAddress || addressQuery.trim());
        formData.append('google_address_text', selectedPlace?.addressText || '');
        formData.append('google_postal_code', selectedPlace?.postalCode || '');
        formData.append('google_city', selectedPlace?.city || '');
        formData.append('google_country', selectedPlace?.country || '');

        if (selectedPlace?.latitude !== null && selectedPlace?.latitude !== undefined) {
          formData.append('google_latitude', String(selectedPlace.latitude));
        }

        if (selectedPlace?.longitude !== null && selectedPlace?.longitude !== undefined) {
          formData.append('google_longitude', String(selectedPlace.longitude));
        }

        if (selectedPlace?.addressComponents) {
          formData.append('google_address_components', JSON.stringify(selectedPlace.addressComponents));
        }
      }

      files.forEach((file) => formData.append('images', file));

      const res = await fetch('/api/opc/create-public-ticket', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Meldung konnte nicht gesendet werden.');
      }

      setTicketNumber(data.ticket_number || null);
      setSubmitState('success');
      setDescription('');
      setFacilityArea('');
      setReporterName('');
      setReporterPhone('');
      setReporterEmail('');
      setFiles([]);
    } catch (error: any) {
      setSubmitState('error');
      setSubmitError(error?.message || 'Meldung konnte nicht gesendet werden.');
    }
  }

  if (loadingLink) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>Meldeseite wird geladen...</div>
      </main>
    );
  }

  if (linkError || !linkInfo) {
    return (
      <main style={pageStyle}>
        <section style={plainSectionStyle}>
          <p style={eyebrowStyle}>Orange Pro Clean</p>
          <h1 style={titleStyle}>QR-Code nicht verfügbar</h1>
          <p style={textStyle}>{linkError || 'Dieser QR-Code konnte nicht geladen werden.'}</p>
        </section>
      </main>
    );
  }

  if (submitState === 'success') {
    return (
      <main style={pageStyle}>
        <section style={plainSectionStyle}>
          <p style={eyebrowStyle}>Orange Pro Clean</p>
          <h1 style={titleStyle}>Danke, die Meldung wurde gesendet.</h1>
          <p style={textStyle}>
            Unser Team prüft die Meldung und kümmert sich um die nächsten Schritte.
          </p>

          {ticketNumber && <p style={ticketNumberStyle}>Ticket: {ticketNumber}</p>}

          <button
            type="button"
            onClick={() => setSubmitState('idle')}
            style={blackButtonStyle}
          >
            Weitere Meldung senden
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={plainSectionStyle}>
        <p style={eyebrowStyle}>Orange Pro Clean</p>
        <h1 style={titleStyle}>{linkInfo.title || 'Meldung erstellen'}</h1>
        <p style={textStyle}>{linkInfo.description}</p>

        {!isGeneral && (
          <div style={contextBoxStyle}>
            {linkInfo.site_label && <p><strong>Standort:</strong> {linkInfo.site_label}</p>}
            {linkInfo.facility_label && <p><strong>Bereich:</strong> {linkInfo.facility_label}</p>}
          </div>
        )}

        <form onSubmit={submitForm} style={formStyle}>
          {isGeneral && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Adresse suchen</label>

              <div style={{ position: 'relative' }}>
                <input
                  value={addressQuery}
                  onChange={(event) => {
                    setAddressQuery(event.target.value);
                    setSelectedPlace(null);
                  }}
                  placeholder="Adresse, Gebäude oder Facility suchen"
                  style={inputStyle}
                  autoComplete="off"
                />

                {suggestions.length > 0 && (
                  <div style={suggestionsStyle}>
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        onClick={() => selectSuggestion(suggestion)}
                        style={suggestionButtonStyle}
                      >
                        <span style={suggestionMainStyle}>{suggestion.label}</span>
                        {suggestion.secondaryLabel && (
                          <span style={suggestionSubStyle}>{suggestion.secondaryLabel}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {addressLoading && <p style={hintStyle}>Adresse wird gesucht...</p>}
              {addressError && <p style={errorSmallStyle}>{addressError}</p>}

              {selectedPlace && (
                <div style={selectedAddressStyle}>
                  <strong>Ausgewählt:</strong> {selectedPlace.formattedAddress}
                </div>
              )}
            </div>
          )}

          {isGeneral && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Bereich optional</label>
              <input
                value={facilityArea}
                onChange={(event) => setFacilityArea(event.target.value)}
                placeholder="z. B. WC, Eingang, Büro, Treppenhaus, Parkplatz"
                style={inputStyle}
              />
            </div>
          )}

          <div style={fieldStyle}>
            <label style={labelStyle}>Art der Meldung</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)} style={inputStyle}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Beschreibung</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                isGeneral
                  ? 'Beschreiben Sie kurz, was an dieser Adresse geprüft werden soll.'
                  : 'Beschreiben Sie kurz, was geprüft werden soll.'
              }
              rows={7}
              style={textareaStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Bilder optional</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
              style={fileInputStyle}
            />

            {filePreviews.length > 0 && (
              <div style={previewGridStyle}>
                {filePreviews.map((preview, index) => (
                  <div key={`${preview.file.name}-${index}`} style={previewItemStyle}>
                    <img src={preview.url} alt={preview.file.name} style={previewImageStyle} />
                    <button type="button" onClick={() => removeFile(index)} style={removeButtonStyle}>
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={optionalGridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Name optional</label>
              <input
                value={reporterName}
                onChange={(event) => setReporterName(event.target.value)}
                placeholder="Ihr Name"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Telefon optional</label>
              <input
                value={reporterPhone}
                onChange={(event) => setReporterPhone(event.target.value)}
                placeholder="Telefonnummer"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>E-Mail optional</label>
              <input
                value={reporterEmail}
                onChange={(event) => setReporterEmail(event.target.value)}
                placeholder="E-Mail"
                type="email"
                style={inputStyle}
              />
            </div>
          </div>

          {submitState === 'error' && submitError && <div style={errorBoxStyle}>{submitError}</div>}

          <button type="submit" disabled={submitState === 'submitting'} style={blackButtonStyle}>
            {submitState === 'submitting' ? 'Wird gesendet...' : 'Meldung senden'}
          </button>
        </form>
      </section>
      <style>{responsiveStyle}</style>
    </main>
  );
}

const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, Helvetica, Arial, sans-serif';

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#FFFFFF',
  color: '#111827',
  fontFamily: fontStack,
  padding: 'clamp(24px, 5vw, 72px)',
  boxSizing: 'border-box',
};

const plainSectionStyle: CSSProperties = {
  width: '100%',
  maxWidth: '760px',
  margin: '0 auto',
};

const loadingStyle: CSSProperties = {
  minHeight: '70vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '15px',
  fontWeight: 650,
  color: '#6B7280',
};

const eyebrowStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: '12px',
  fontWeight: 820,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: '#F7931F',
};

const titleStyle: CSSProperties = {
  margin: '0 0 14px',
  fontSize: 'clamp(34px, 7vw, 64px)',
  lineHeight: 0.98,
  letterSpacing: '-0.06em',
  fontWeight: 860,
};

const textStyle: CSSProperties = {
  margin: '0 0 30px',
  fontSize: '17px',
  lineHeight: 1.55,
  color: '#5B616E',
  fontWeight: 560,
};

const contextBoxStyle: CSSProperties = {
  borderTop: '1px solid #E5E7EB',
  borderBottom: '1px solid #E5E7EB',
  padding: '18px 0',
  marginBottom: '30px',
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  color: '#374151',
};

const formStyle: CSSProperties = {
  display: 'grid',
  gap: '22px',
};

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '9px',
};

const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 780,
  color: '#111827',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '52px',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid #E5E7EB',
  outline: 'none',
  background: '#FFFFFF',
  color: '#111827',
  fontSize: '15px',
  fontWeight: 560,
  fontFamily: fontStack,
  boxSizing: 'border-box',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  paddingTop: '14px',
  paddingBottom: '14px',
  resize: 'vertical',
  lineHeight: 1.5,
};

const fileInputStyle: CSSProperties = {
  ...inputStyle,
  padding: '14px 16px',
};

const suggestionsStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  zIndex: 20,
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '16px',
  boxShadow: '0 18px 50px rgba(15, 17, 21, 0.12)',
  overflow: 'hidden',
};

const suggestionButtonStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderBottom: '1px solid #F3F4F6',
  background: '#FFFFFF',
  padding: '14px 16px',
  textAlign: 'left',
  display: 'grid',
  gap: '4px',
  cursor: 'pointer',
  fontFamily: fontStack,
};

const suggestionMainStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 760,
  color: '#111827',
};

const suggestionSubStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 560,
  color: '#6B7280',
};

const selectedAddressStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '14px',
  background: '#F9FAFB',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 620,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#6B7280',
  fontWeight: 620,
};

const errorSmallStyle: CSSProperties = {
  margin: 0,
  fontSize: '12px',
  color: '#991B1B',
  fontWeight: 650,
};

const optionalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '14px',
};

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '12px',
};

const previewItemStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '16px',
  overflow: 'hidden',
};

const previewImageStyle: CSSProperties = {
  width: '100%',
  height: '110px',
  objectFit: 'cover',
  display: 'block',
};

const removeButtonStyle: CSSProperties = {
  width: '100%',
  height: '34px',
  border: 'none',
  borderTop: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#991B1B',
  fontSize: '12px',
  fontWeight: 760,
  cursor: 'pointer',
};

const errorBoxStyle: CSSProperties = {
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#FEF2F2',
  border: '1px solid #FCA5A5',
  color: '#991B1B',
  fontSize: '14px',
  fontWeight: 700,
};

const blackButtonStyle: CSSProperties = {
  minHeight: '54px',
  borderRadius: '16px',
  border: '1px solid #0F1115',
  background: '#0F1115',
  color: '#FFFFFF',
  padding: '0 22px',
  fontSize: '15px',
  fontWeight: 820,
  fontFamily: fontStack,
  cursor: 'pointer',
};

const ticketNumberStyle: CSSProperties = {
  display: 'inline-flex',
  minHeight: '38px',
  alignItems: 'center',
  padding: '0 14px',
  borderRadius: '999px',
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  fontSize: '13px',
  fontWeight: 760,
  color: '#111827',
  marginBottom: '22px',
};

const responsiveStyle = `
  @media (max-width: 720px) {
    form [style*="grid-template-columns"] {
      grid-template-columns: 1fr !important;
    }
  }
`;
