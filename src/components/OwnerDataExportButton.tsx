import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

import { createPortal } from 'react-dom';
const PORTAL_FONT =
  '-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Inter\", \"Helvetica Neue\", Segoe UI, Roboto, sans-serif';

const PORTAL = {
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  black: '#0F1115',
  card: '#FFFFFF',
  soft: '#FAFAFA',
  orange: '#F7931E',
};

export type OwnerDataExportScope =
  | 'all'
  | 'clients'
  | 'quotes'
  | 'invoices'
  | 'finance'
  | 'employees'
  | 'time'
  | 'payroll'
  | 'jobs'
  | 'inspections'
  | 'inquiries'
  | 'tickets';

type Phase =
  | 'closed'
  | 'ready'
  | 'sending-code'
  | 'verify'
  | 'verifying'
  | 'exporting'
  | 'success'
  | 'error';

type Props = {
  scope: OwnerDataExportScope;
  label?: string;
};

const SCOPE_LABELS: Record<OwnerDataExportScope, string> = {
  all: 'Gesamter Unternehmensdatenbestand',
  clients: 'Kundendaten',
  quotes: 'Offerten',
  invoices: 'Rechnungen',
  finance: 'Finanzdaten',
  employees: 'Mitarbeiterdaten',
  time: 'Zeiterfassung',
  payroll: 'Lohndaten',
  jobs: 'Einsätze',
  inspections: 'Besichtigungen',
  inquiries: 'Anfragen',
  tickets: 'Tickets',
};

const DEFAULT_ESTIMATE: Record<OwnerDataExportScope, number> = {
  all: 45,
  clients: 25,
  quotes: 25,
  invoices: 25,
  finance: 35,
  employees: 30,
  time: 30,
  payroll: 35,
  jobs: 25,
  inspections: 25,
  inquiries: 20,
  tickets: 20,
};

function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function normalizePostalInput(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 23);
}

async function authHeaders() {
  if (!supabase) throw new Error('Supabase-Sitzung ist nicht verfügbar.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function postJson(path: string, body: Record<string, unknown>) {
  const headers = await authHeaders();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      String(payload?.error || `Anfrage fehlgeschlagen (HTTP ${response.status}).`),
    ) as Error & { status?: number; payload?: any };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload || {};
}

function stageFor(elapsed: number, estimate: number) {
  const ratio = estimate > 0 ? elapsed / estimate : 0;
  if (ratio < 0.22) return 'Unternehmensdaten werden zusammengestellt';
  if (ratio < 0.5) return 'CSV-Dateien werden erstellt';
  if (ratio < 0.78) return 'Dateien werden für den Versand vorbereitet';
  return 'E-Mail-Versand wird abgeschlossen';
}

function ModalBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15, 17, 21, 0.26)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}

export function OwnerDataExportButton({ scope, label }: Props) {
  const [phase, setPhase] = useState<Phase>('closed');
  const [verificationId, setVerificationId] = useState('');
  const [recipientMasked, setRecipientMasked] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [estimateSeconds, setEstimateSeconds] = useState(DEFAULT_ESTIMATE[scope]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const startedAtRef = useRef(0);
  const codeSendStartedAtRef = useRef(0);

  const modalOpen = phase !== 'closed';
  const busy = ['sending-code', 'verifying', 'exporting'].includes(phase);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [modalOpen]);

  useEffect(() => {
    if (phase !== 'exporting') return undefined;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  const resendSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt - nowTick) / 1000),
  );

  const codeSendElapsed = phase === 'sending-code' && codeSendStartedAtRef.current
    ? Math.max(0, Math.floor((nowTick - codeSendStartedAtRef.current) / 1000))
    : 0;

  const estimatedRemaining = Math.max(0, estimateSeconds - elapsedSeconds);
  const visualProgress = Math.min(
    92,
    Math.max(7, (elapsedSeconds / Math.max(estimateSeconds, 1)) * 86),
  );

  const scopeLabel = SCOPE_LABELS[scope];
  const buttonLabel = label || (scope === 'all'
    ? 'Gesamten Datenbestand per E-Mail anfordern'
    : 'CSV per E-Mail');

  const postalLooksValid = useMemo(() => {
    return (
      postalCode.length === 23 &&
      /^[A-Z0-9-]{23}$/.test(postalCode) &&
      /[A-Z]/.test(postalCode) &&
      /[0-9]/.test(postalCode) &&
      postalCode.includes('-')
    );
  }, [postalCode]);

  function resetForNewVerification() {
    setVerificationId('');
    setEmailCode('');
    setPostalCode('');
    setRecipientMasked('');
    setErrorMessage('');
    setSuccessMessage('');
    setElapsedSeconds(0);
    setEstimateSeconds(DEFAULT_ESTIMATE[scope]);
    setPhase('ready');
  }

  function openModal() {
    resetForNewVerification();
  }

  function closeModal() {
    if (busy) return;
    setPhase('closed');
  }

  async function sendVerificationCode() {
    setErrorMessage('');
    setSuccessMessage('');
    codeSendStartedAtRef.current = Date.now();
    setPhase('sending-code');

    try {
      const payload = await postJson(
        '/api/opc/data-export/verification/start',
        { scope },
      );

      setVerificationId(String(payload.verificationId || ''));
      setRecipientMasked(String(payload.recipientMasked || 'hinterlegte Owner-E-Mail'));
      setEstimateSeconds(
        Number(payload.estimatedSeconds) > 0
          ? Number(payload.estimatedSeconds)
          : DEFAULT_ESTIMATE[scope],
      );
      setResendAvailableAt(
        Date.now() + Math.max(30, Number(payload.resendAfterSeconds || 60)) * 1000,
      );
      setEmailCode('');
      setPostalCode('');
      setPhase('verify');
    } catch (error: any) {
      const retry = Number(error?.payload?.retryAfterSeconds || 0);
      if (retry > 0) setResendAvailableAt(Date.now() + retry * 1000);
      setErrorMessage(error instanceof Error ? error.message : 'Code konnte nicht gesendet werden.');
      setPhase('error');
    }
  }

  async function verifyAndExport() {
    if (emailCode.length !== 6) {
      setErrorMessage('Bitte geben Sie den vollständigen 6-stelligen E-Mail-Code ein.');
      return;
    }

    if (!postalLooksValid) {
      setErrorMessage(
        'Bitte geben Sie den vollständigen 23-stelligen Unternehmens-Sicherheitscode inklusive Bindestrichen ein.',
      );
      return;
    }

    setErrorMessage('');
    setPhase('verifying');

    try {
      const verified = await postJson(
        '/api/opc/data-export/verification/verify',
        {
          scope,
          verificationId,
          emailCode,
          postalCode,
        },
      );

      if (Number(verified.estimatedSeconds) > 0) {
        setEstimateSeconds(Number(verified.estimatedSeconds));
      }

      setEmailCode('');
      setPostalCode('');
      setPhase('exporting');

      const exported = await postJson(
        '/api/opc/data-export/email',
        {
          scope,
          verificationId,
        },
      );

      const recipient = String(
        exported.recipient || exported.email || exported.actor_email || recipientMasked || '',
      );
      const files = Number(exported.fileCount ?? exported.file_count ?? 0);
      const rows = Number(exported.rowCount ?? exported.row_count ?? 0);
      const details = [
        recipient ? `an ${recipient}` : '',
        Number.isFinite(files) && files > 0 ? `${files} Datei${files === 1 ? '' : 'en'}` : '',
        Number.isFinite(rows) && rows > 0 ? `${rows} Datensätze` : '',
      ].filter(Boolean);

      setSuccessMessage(
        details.length > 0
          ? `Der Datenexport wurde erfolgreich ${details.join(' · ')} versendet.`
          : 'Der Datenexport wurde erfolgreich an die hinterlegte Owner-E-Mail-Adresse versendet.',
      );
      setPhase('success');
    } catch (error: any) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Der Datenexport konnte nicht abgeschlossen werden.',
      );
      setPhase('error');
    }
  }

  const buttonStyle: React.CSSProperties = {
    appearance: 'none',
    border: `1px solid ${PORTAL.border}`,
    borderRadius: 14,
    background: PORTAL.card,
    color: PORTAL.text,
    minHeight: 46,
    padding: '0 14px',
    fontSize: 13,
    lineHeight: 1.2,
    fontWeight: 820,
    fontFamily: PORTAL_FONT,
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(15, 17, 21, 0.04)',
  };

  const primaryStyle: React.CSSProperties = {
    ...buttonStyle,
    borderColor: PORTAL.black,
    background: PORTAL.black,
    color: '#ffffff',
    minHeight: 46,
    padding: '0 16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    height: 46,
    border: `1px solid ${PORTAL.border}`,
    borderRadius: 14,
    background: PORTAL.card,
    color: PORTAL.text,
    fontSize: 14,
    fontWeight: 650,
    fontFamily: PORTAL_FONT,
    padding: '0 14px',
    outline: 'none',
    boxShadow: 'none',
  };

  return (
    <>
      <button type="button" onClick={openModal} style={buttonStyle}>
        {buttonLabel}
      </button>

      {modalOpen ? (
        <ModalBackdrop>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="opc-export-security-title"
            style={{
              width: '100%',
              maxWidth: phase === 'exporting' ? 600 : 560,
              maxHeight: 'calc(100vh - 36px)',
              overflowY: 'auto',
              borderRadius: 20,
              background: PORTAL.card,
              boxShadow: '0 18px 42px rgba(15, 17, 21, 0.16)',
              border: `1px solid ${PORTAL.border}`,
              fontFamily: PORTAL_FONT,
            }}
          >
            <div style={{ padding: '24px 26px 26px' }}>
              {phase === 'exporting' ? (
                <>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      border: '2px solid #e6e9ee',
                      borderTopColor: PORTAL.black,
                      animation: 'opc-export-spin 0.9s linear infinite',
                      marginBottom: 14,
                    }}
                  />
                  <style>{`@keyframes opc-export-spin{to{transform:rotate(360deg)}}`}</style>

                  <div
                    style={{
                      color: PORTAL.muted,
                      fontSize: 12,
                      fontWeight: 760,
                      letterSpacing: '-0.01em',
                      marginBottom: 7,
                    }}
                  >
                    Sicherheitsprüfung abgeschlossen
                  </div>
                  <h2
                    id="opc-export-security-title"
                    style={{ margin: 0, fontSize: 22, lineHeight: 1.2, color: PORTAL.text, fontWeight: 820, letterSpacing: '-0.035em' }}
                  >
                    Datenexport wird erstellt
                  </h2>
                  <p style={{ margin: '10px 0 22px', color: PORTAL.muted, fontSize: 14, lineHeight: 1.55 }}>
                    {scopeLabel}. Die Dauer hängt von Datenmenge und E-Mail-Anhängen ab.
                  </p>

                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      overflow: 'hidden',
                      background: '#F3F4F6',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${visualProgress}%`,
                        borderRadius: 999,
                        background: PORTAL.black,
                        transition: 'width 500ms ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: PORTAL.faint, marginBottom: 20 }}>
                    Zeitbasierte Schätzung – kein exakter Backend-Fortschritt
                  </div>

                  <div
                    style={{
                      border: `1px solid ${PORTAL.border}`,
                      borderRadius: 14,
                      padding: 16,
                      background: PORTAL.soft,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 820, color: PORTAL.text, marginBottom: 8 }}>
                      Voraussichtlicher Schritt
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 650, color: PORTAL.text }}>
                      {stageFor(elapsedSeconds, estimateSeconds)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <div style={{ border: `1px solid ${PORTAL.border}`, borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 11, color: PORTAL.muted, marginBottom: 5 }}>Verstrichen</div>
                      <div style={{ fontSize: 22, fontWeight: 820, color: PORTAL.text }}>
                        {formatSeconds(elapsedSeconds)}
                      </div>
                    </div>
                    <div style={{ border: `1px solid ${PORTAL.border}`, borderRadius: 14, padding: 14 }}>
                      <div style={{ fontSize: 11, color: PORTAL.muted, marginBottom: 5 }}>
                        Geschätzte Restzeit
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 820, color: PORTAL.text }}>
                        {elapsedSeconds <= estimateSeconds
                          ? `ca. ${formatSeconds(estimatedRemaining)}`
                          : 'wird abgeschlossen'}
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: '16px 0 0', fontSize: 12, color: PORTAL.muted, lineHeight: 1.5 }}>
                    Geschätzte Gesamtdauer: ca. {formatSeconds(estimateSeconds)}. Bitte lassen Sie dieses Fenster geöffnet.
                  </p>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <h2
                        id="opc-export-security-title"
                        style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: PORTAL.text, fontWeight: 820, letterSpacing: '-0.025em' }}
                      >
                        Sicherheitsverifizierung
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={busy}
                      aria-label="Schließen"
                      style={{
                        width: 34,
                        height: 34,
                        flex: '0 0 34px',
                        border: `1px solid ${PORTAL.border}`,
                        background: PORTAL.card,
                        borderRadius: 14,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        color: PORTAL.muted,
                        fontSize: 20,
                        lineHeight: '30px',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <p style={{ margin: '8px 0 18px', color: PORTAL.muted, fontSize: 13, fontWeight: 650, lineHeight: 1.45 }}>
                    Für <strong>{scopeLabel}</strong> sind die Owner-Anmeldung, ein Einmalcode per E-Mail und der dauerhaft gültige, per A-Post zugestellte Unternehmens-Sicherheitscode erforderlich.
                  </p>

                  {phase === 'ready' || phase === 'sending-code' ? (
                    <>
                      <div
                        style={{
                          borderTop: `1px solid ${PORTAL.border}`,
                          borderBottom: `1px solid ${PORTAL.border}`,
                          padding: '18px 0',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 18,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 820, color: PORTAL.text, marginBottom: 4 }}>
                            E-Mail-Verifizierung
                          </div>
                          <div style={{ fontSize: 12, color: PORTAL.muted, fontWeight: 650, lineHeight: 1.45 }}>
                            Einmalcode an die E-Mail-Adresse des angemeldeten Owner-Kontos · 10 Minuten gültig.
                          </div>
                          {phase === 'sending-code' ? (
                            <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 8, color: PORTAL.muted, fontSize: 11 }}>
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 13,
                                  height: 13,
                                  borderRadius: 999,
                                  border: '2px solid #dfe3e8',
                                  borderTopColor: PORTAL.black,
                                  animation: 'opc-export-spin 0.9s linear infinite',
                                  flex: '0 0 13px',
                                }}
                              />
                              Übergabe an Mailserver · {formatSeconds(codeSendElapsed)}
                              <style>{`@keyframes opc-export-spin{to{transform:rotate(360deg)}}`}</style>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          style={{ ...primaryStyle, opacity: phase === 'sending-code' ? 0.7 : 1, whiteSpace: 'nowrap' }}
                          disabled={phase === 'sending-code'}
                          onClick={sendVerificationCode}
                        >
                          {phase === 'sending-code' ? 'Wird gesendet…' : 'Code senden'}
                        </button>
                      </div>

                      <div
                        style={{
                          padding: '16px 0 2px',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 18,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 820, color: PORTAL.text, marginBottom: 4 }}>
                            Unternehmens-Sicherheitscode
                          </div>
                          <div style={{ fontSize: 12, color: PORTAL.muted, fontWeight: 650, lineHeight: 1.45 }}>
                            23-stelliger, per A-Post zugestellter Code. Dauerhaft gültig, bis die Gesellschaft ihn bewusst rotiert.
                          </div>
                        </div>
                        <span
                          style={{
                            border: `1px solid ${PORTAL.border}`,
                            borderRadius: 999,
                            padding: '6px 9px',
                            background: PORTAL.soft,
                            color: PORTAL.muted,
                            fontSize: 11,
                            fontWeight: 760,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Erforderlich
                        </span>
                      </div>
                    </>
                  ) : null}

                  {phase === 'verify' || phase === 'verifying' ? (
                    <>
                      <div
                        style={{
                          padding: '14px 0 16px',
                          borderRadius: 0,
                          background: 'transparent',
                          border: 'none',
                          borderTop: `1px solid ${PORTAL.border}`,
                          borderBottom: `1px solid ${PORTAL.border}`,
                          color: PORTAL.muted,
                          fontSize: 12,
                          fontWeight: 650,
                          lineHeight: 1.5,
                          marginBottom: 18,
                        }}
                      >
                        Einmalcode wurde an <strong>{recipientMasked}</strong> an den Mailserver übergeben. Die Zustellung kann je nach empfangendem Mailserver kurz verzögert sein.
                      </div>

                      <label style={{ display: 'block', marginBottom: 15 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 820, color: PORTAL.text, marginBottom: 6 }}>
                          6-stelliger E-Mail-Code
                        </span>
                        <input
                          value={emailCode}
                          onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          disabled={phase === 'verifying'}
                          style={{ ...inputStyle, letterSpacing: '0.22em', fontWeight: 820 }}
                        />
                      </label>

                      <label style={{ display: 'block', marginBottom: 17 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 820, color: PORTAL.text, marginBottom: 6 }}>
                          23-stelliger Unternehmens-Sicherheitscode
                        </span>
                        <input
                          value={postalCode}
                          onChange={(event) => setPostalCode(normalizePostalInput(event.target.value))}
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="••••-••••-••••-••••-•••"
                          disabled={phase === 'verifying'}
                          style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                        />
                        <span style={{ display: 'block', fontSize: 11, color: '#778196', marginTop: 6 }}>
                          Der Code bleibt dauerhaft gültig, bis die Gesellschaft ihn bewusst rotiert.
                        </span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', paddingTop: 3 }}>
                        <button
                          type="button"
                          disabled={phase === 'verifying'}
                          onClick={verifyAndExport}
                          style={{ ...primaryStyle, opacity: phase === 'verifying' ? 0.7 : 1 }}
                        >
                          {phase === 'verifying' ? 'Codes werden geprüft…' : 'Codes bestätigen & Export starten'}
                        </button>

                        <button
                          type="button"
                          disabled={phase === 'verifying' || resendSeconds > 0}
                          onClick={sendVerificationCode}
                          style={{
                            ...buttonStyle,
                            opacity: phase === 'verifying' || resendSeconds > 0 ? 0.55 : 1,
                            cursor: phase === 'verifying' || resendSeconds > 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {resendSeconds > 0 ? `Neu senden in ${resendSeconds}s` : 'Neuen E-Mail-Code senden'}
                        </button>
                      </div>
                    </>
                  ) : null}

                  {phase === 'success' ? (
                    <div
                      style={{
                        padding: 17,
                        borderRadius: 14,
                        background: '#f7fbf8',
                        border: '1px solid #bbf7d0',
                        color: '#166534',
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}
                    >
                      <strong>Export abgeschlossen.</strong>
                      <div style={{ marginTop: 5 }}>{successMessage}</div>
                      <button type="button" onClick={closeModal} style={{ ...buttonStyle, marginTop: 14, background: '#fff' }}>
                        Schließen
                      </button>
                    </div>
                  ) : null}

                  {phase === 'error' ? (
                    <div
                      style={{
                        padding: 17,
                        borderRadius: 14,
                        background: '#fff8f8',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      <strong>Vorgang konnte nicht abgeschlossen werden.</strong>
                      <div style={{ marginTop: 5 }}>{errorMessage}</div>
                      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
                        <button
                          type="button"
                          onClick={resetForNewVerification}
                          style={primaryStyle}
                        >
                          Sicherheitsprüfung neu starten
                        </button>
                        <button type="button" onClick={closeModal} style={buttonStyle}>
                          Schließen
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {errorMessage && phase !== 'error' ? (
                    <div
                      role="alert"
                      style={{
                        marginTop: 15,
                        padding: '11px 13px',
                        borderRadius: 9,
                        border: '1px solid #fecaca',
                        background: '#fff7f7',
                        color: '#991b1b',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {errorMessage}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </ModalBackdrop>
      ) : null}
    </>
  );
}

export function ContextualOwnerDataExport() {
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    const update = () => setPathname(window.location.pathname || '');
    update();
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  const scope = useMemo<OwnerDataExportScope | null>(() => {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (path === '/kunden' || path.startsWith('/kunden/')) return 'clients';
    if (path === '/offerten' || path.startsWith('/offerte/')) return 'quotes';
    if (path === '/rechnungen' || path === '/rechnung' || path.startsWith('/rechnung/')) return 'invoices';
    if (path === '/finanzen' || path.startsWith('/finanzen/')) return 'finance';
    if (path === '/mitarbeiter' || path.startsWith('/mitarbeiter/')) return 'employees';
    if (path === '/zeiterfassung' || path.startsWith('/zeiterfassung/')) return 'time';
    if (path === '/einsaetze' || path.startsWith('/einsatz/')) return 'jobs';
    if (path === '/besichtigungen' || path.startsWith('/besichtigung/')) return 'inspections';
    if (path === '/anfragen') return 'inquiries';
    if (path === '/tickets' || path === '/anfragen-schaeden' || path.startsWith('/ticket/')) return 'tickets';
    return null;
  }, [pathname]);

const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null);

useEffect(() => {
  if (!scope) {
    setDockTarget(null);
    return;
  }

  let frame = 0;

  const findDock = () => {
    const selectors =
      pathname === '/zeiterfassung' || pathname.startsWith('/zeiterfassung/')
        ? [
            '[data-opc-owner-export-dock="true"]',
            '.opc-time-tab-buttons',
          ]
        : [
            '[data-opc-owner-export-dock="true"]',
            '.opc-page-title-actions',
            '.opc-cp-title-actions',
            '.opc-page-actions',
            '.opc-title-actions',
            '.opc-page-action',
          ];

    let next: HTMLElement | null = null;

    for (const selector of selectors) {
      const candidate = document.querySelector(selector);
      if (candidate instanceof HTMLElement) {
        next = candidate;
        break;
      }
    }

    setDockTarget((current) => (current === next ? current : next));
  };

  const scheduleFind = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(findDock);
  };

  scheduleFind();

  const observer = new MutationObserver(scheduleFind);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('astro:page-load', scheduleFind);

  return () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener('astro:page-load', scheduleFind);
  };
}, [pathname, scope]);



  if (!scope) return null;

  const exportButton = (
    <span
      data-opc-owner-export-dock-v91="true"
      style={{ display: 'inline-flex', flex: '0 0 auto' }}
    >
      <OwnerDataExportButton scope={scope} />
    </span>
  );

  if (dockTarget) {
    return createPortal(exportButton, dockTarget);
  }

  return (
    <div
      data-opc-owner-export-fallback="true"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: 14,
      }}
    >
      {exportButton}
    </div>
  );
}

export default OwnerDataExportButton;
