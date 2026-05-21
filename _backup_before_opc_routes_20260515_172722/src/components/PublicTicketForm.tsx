import React, { useEffect, useMemo, useState } from 'react';

type LinkInfo = {
  ok: boolean;
  token?: string;
  title?: string;
  description?: string;
  site_label?: string | null;
  facility_label?: string | null;
  error?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type Props = {
  token: string;
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

export default function PublicTicketForm({ token }: Props) {
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [category, setCategory] = useState('damage');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

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

        const res = await fetch(
          `/api/opc/public-ticket-link?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          }
        );

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
        setLinkError('Der QR-Code konnte nicht geprüft werden.');
      } finally {
        if (alive) setLoadingLink(false);
      }
    }

    loadLink();

    return () => {
      alive = false;
    };
  }, [token]);

  function onFilesChanged(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);

    const validFiles = selected
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 5);

    setFiles(validFiles);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!description.trim()) {
      setSubmitError('Bitte kurz beschreiben, was geprüft werden soll.');
      return;
    }

    try {
      setSubmitState('submitting');
      setSubmitError(null);

      const formData = new FormData();
      formData.append('token', token);
      formData.append('category', category);
      formData.append('description', description.trim());

      if (reporterName.trim()) formData.append('reporter_name', reporterName.trim());
      if (reporterPhone.trim()) formData.append('reporter_phone', reporterPhone.trim());
      if (reporterEmail.trim()) formData.append('reporter_email', reporterEmail.trim());

      files.forEach((file) => {
        formData.append('images', file);
      });

      const res = await fetch('/api/opc/create-public-ticket', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as {
        ok?: boolean;
        ticketNumber?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Die Meldung konnte nicht gesendet werden.');
      }

      setTicketNumber(data.ticketNumber || null);
      setSubmitState('success');
      setDescription('');
      setReporterName('');
      setReporterPhone('');
      setReporterEmail('');
      setFiles([]);
    } catch (error) {
      setSubmitState('error');
      setSubmitError(
        error instanceof Error ? error.message : 'Die Meldung konnte nicht gesendet werden.'
      );
    }
  }

  if (loadingLink) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.logoMark}>OPC</div>
          <h1 style={styles.title}>QR-Code wird geprüft</h1>
          <p style={styles.text}>Bitte einen Moment.</p>
        </section>
      </main>
    );
  }

  if (linkError || !linkInfo) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.logoMark}>OPC</div>
          <h1 style={styles.title}>Link nicht verfügbar</h1>
          <p style={styles.text}>
            {linkError || 'Dieser QR-Code ist nicht aktiv oder wurde nicht gefunden.'}
          </p>
        </section>
      </main>
    );
  }

  if (submitState === 'success') {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.logoMark}>OPC</div>
          <p style={styles.eyebrow}>Orange Pro Clean</p>
          <h1 style={styles.title}>Meldung erhalten</h1>
          <p style={styles.text}>
            Danke. Die Meldung wurde an Orange Pro Clean weitergeleitet.
          </p>

          {ticketNumber ? (
            <div style={styles.successBox}>
              Ticketnummer: <strong>{ticketNumber}</strong>
            </div>
          ) : null}

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => {
              setSubmitState('idle');
              setTicketNumber(null);
            }}
          >
            Neue Meldung erstellen
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logoMark}>OPC</div>

        <p style={styles.eyebrow}>Orange Pro Clean</p>
        <h1 style={styles.title}>{linkInfo.title || 'Meldung erstellen'}</h1>
        <p style={styles.text}>
          {linkInfo.description ||
            'Der Standort wurde automatisch erkannt. Beschreiben Sie kurz, was geprüft werden soll.'}
        </p>

        {(linkInfo.site_label || linkInfo.facility_label) ? (
          <div style={styles.detectedBox}>
            <strong>Standort erkannt</strong>
            {linkInfo.site_label ? <span>{linkInfo.site_label}</span> : null}
            {linkInfo.facility_label ? <span>{linkInfo.facility_label}</span> : null}
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>
            Art der Meldung
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={styles.input}
            >
              {categoryOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Beschreibung *
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Kurz beschreiben, was passiert ist oder geprüft werden soll."
              rows={5}
              maxLength={2000}
              style={{ ...styles.input, ...styles.textarea }}
              required
            />
          </label>

          <label style={styles.label}>
            Foto hochladen
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={onFilesChanged}
              style={styles.fileInput}
            />
            <span style={styles.hint}>Bis zu 5 Bilder. Maximal 10 MB pro Bild.</span>
          </label>

          {filePreviews.length > 0 ? (
            <div style={styles.previewGrid}>
              {filePreviews.map((preview) => (
                <div key={`${preview.file.name}-${preview.file.size}`} style={styles.previewItem}>
                  <img src={preview.url} alt={preview.file.name} style={styles.previewImage} />
                  <span style={styles.previewName}>{preview.file.name}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div style={styles.optionalBox}>
            <p style={styles.optionalTitle}>Kontaktangaben optional</p>

            <label style={styles.label}>
              Name
              <input
                value={reporterName}
                onChange={(event) => setReporterName(event.target.value)}
                placeholder="Optional"
                maxLength={120}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Telefon
              <input
                value={reporterPhone}
                onChange={(event) => setReporterPhone(event.target.value)}
                placeholder="Optional"
                maxLength={80}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              E-Mail
              <input
                type="email"
                value={reporterEmail}
                onChange={(event) => setReporterEmail(event.target.value)}
                placeholder="Optional"
                maxLength={160}
                style={styles.input}
              />
            </label>
          </div>

          {submitError ? <p style={styles.error}>{submitError}</p> : null}

          <button
            type="submit"
            disabled={submitState === 'submitting'}
            style={{
              ...styles.primaryButton,
              opacity: submitState === 'submitting' ? 0.65 : 1,
              cursor: submitState === 'submitting' ? 'not-allowed' : 'pointer',
            }}
          >
            {submitState === 'submitting' ? 'Wird gesendet...' : 'Meldung senden'}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f6f5f1',
    color: '#111111',
    fontFamily:
      'Inter, "Inter Tight", Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    background: '#ffffff',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxSizing: 'border-box',
  },
  logoMark: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: '#F7931F',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '14px',
    letterSpacing: '0.04em',
    marginBottom: '22px',
  },
  eyebrow: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    color: '#F7931F',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '30px',
    lineHeight: 1.08,
    letterSpacing: '-0.04em',
    fontWeight: 850,
  },
  text: {
    margin: '0 0 24px 0',
    fontSize: '15px',
    lineHeight: 1.6,
    color: '#555555',
  },
  detectedBox: {
    display: 'grid',
    gap: '4px',
    padding: '14px',
    borderRadius: '16px',
    background: '#f7f7f5',
    border: '1px solid rgba(0,0,0,0.06)',
    fontSize: '13px',
    color: '#333333',
    marginBottom: '18px',
  },
  form: {
    display: 'grid',
    gap: '16px',
  },
  label: {
    display: 'grid',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#222222',
  },
  input: {
    width: '100%',
    minHeight: '46px',
    borderRadius: '14px',
    border: '1px solid rgba(0,0,0,0.14)',
    padding: '0 14px',
    fontSize: '15px',
    outline: 'none',
    background: '#ffffff',
    color: '#111111',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  textarea: {
    paddingTop: '12px',
    resize: 'vertical',
    minHeight: '120px',
    lineHeight: 1.5,
  },
  fileInput: {
    width: '100%',
    minHeight: '46px',
    borderRadius: '14px',
    border: '1px dashed rgba(0,0,0,0.24)',
    padding: '12px',
    background: '#fafafa',
    boxSizing: 'border-box',
    fontSize: '14px',
  },
  hint: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#777777',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  previewItem: {
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#fafafa',
  },
  previewImage: {
    width: '100%',
    height: '130px',
    objectFit: 'cover',
    display: 'block',
  },
  previewName: {
    display: 'block',
    padding: '8px',
    fontSize: '11px',
    color: '#555555',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  optionalBox: {
    display: 'grid',
    gap: '14px',
    padding: '16px',
    borderRadius: '18px',
    background: '#f7f7f5',
    border: '1px solid rgba(0,0,0,0.06)',
  },
  optionalTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 800,
    color: '#333333',
  },
  error: {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '14px',
    background: '#fff1f1',
    color: '#9f1d1d',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  primaryButton: {
    width: '100%',
    minHeight: '48px',
    border: 'none',
    borderRadius: '999px',
    background: '#111111',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 800,
    fontFamily: 'inherit',
  },
  secondaryButton: {
    width: '100%',
    minHeight: '46px',
    border: '1px solid rgba(0,0,0,0.14)',
    borderRadius: '999px',
    background: '#ffffff',
    color: '#111111',
    fontSize: '15px',
    fontWeight: 800,
    fontFamily: 'inherit',
    cursor: 'pointer',
    marginTop: '18px',
  },
  successBox: {
    padding: '14px',
    borderRadius: '16px',
    background: '#f5f5f2',
    fontSize: '14px',
    color: '#111111',
  },
};