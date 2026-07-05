import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { baseUrl } from '../../lib/base-url';
import MirakaDashboardShell from '../MirakaDashboardShell';
import './documents.css';
import './office-editor.css';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (elementId: string, config: Record<string, unknown>) => {
        destroyEditor?: () => void;
      };
    };
  }
}

type EditorPayload = {
  document: {
    id: string;
    title: string;
    fileName: string;
    extension: string;
    currentVersionNumber: number;
  };
  scriptUrl: string;
  config: Record<string, unknown>;
};

async function loadScript(url: string) {
  if (window.DocsAPI?.DocEditor) return;

  const existing = document.querySelector<HTMLScriptElement>('script[data-opc-office-api="true"]');
  if (existing) existing.remove();

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.opcOfficeApi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Office-Editor konnte nicht geladen werden.'));
    document.head.appendChild(script);
  });
}

function friendlyEditorError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value || '');

  if (
    message.includes('EURO_OFFICE_URL') ||
    message.includes('EURO_OFFICE_JWT_SECRET') ||
    message.includes('Office-Editor konnte nicht geladen werden')
  ) {
    return 'Der Office-Server wird gerade bereitgestellt oder ist vorübergehend nicht erreichbar. Das Dokument ist bereits sicher gespeichert.';
  }

  return message || 'Dokument konnte nicht geöffnet werden.';
}

export default function OfficeEditorPage({ documentId }: { documentId: string }) {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const editorElementId = useMemo(
    () => `opc-office-editor-${documentId.replace(/[^a-zA-Z0-9]/g, '')}`,
    [documentId],
  );

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setError('');
      setPayload(null);

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('Anmeldung abgelaufen.');

        const response = await fetch(`/api/opc/documents/${documentId}/editor-config`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const nextPayload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(nextPayload.error || 'Editor-Konfiguration konnte nicht geladen werden.');
        }
        if (cancelled) return;

        setPayload(nextPayload);
        await loadScript(nextPayload.scriptUrl);
        if (cancelled) return;
        if (!window.DocsAPI?.DocEditor) throw new Error('Office-Editor API ist nicht verfügbar.');

        editorRef.current = new window.DocsAPI.DocEditor(editorElementId, {
          ...nextPayload.config,
          width: '100%',
          height: '100%',
        });
      } catch (nextError) {
        if (!cancelled) setError(friendlyEditorError(nextError));
      }
    }

    void start();

    return () => {
      cancelled = true;
      try {
        editorRef.current?.destroyEditor?.();
      } catch {
        // Editor cleanup is best effort.
      }
      editorRef.current = null;
    };
  }, [documentId, editorElementId, retryKey]);

  return (
    <MirakaDashboardShell
      requiredRole={['owner', 'admin', 'dispatch', 'employee']}
      currentPath="/dokumente"
      fullWidth
    >
      <div className="opc-office-editor-page">
        <header className="opc-office-editor-header">
          <a href={`${baseUrl}/dokumente`}><ArrowLeft size={17} /> Dokumente</a>
          <div>
            <strong>{payload?.document?.title || 'Dokument wird geöffnet'}</strong>
            <span>{payload?.document?.fileName || 'Editor wird geladen …'}</span>
          </div>
          <a href={`${baseUrl}/dokumente`}><ExternalLink size={16} /> Übersicht</a>
        </header>

        {error ? (
          <div className="opc-office-editor-error">
            <strong>Editor momentan nicht verfügbar</strong>
            <span>{error}</span>
            <div className="opc-office-editor-error-actions">
              <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
                <RefreshCw size={16} /> Erneut versuchen
              </button>
              <a href={`${baseUrl}/dokumente`}>Zur Dokumentenübersicht</a>
            </div>
          </div>
        ) : (
          <div id={editorElementId} className="opc-office-editor-frame">
            <div className="opc-office-editor-loading">Office-Editor wird geladen …</div>
          </div>
        )}
      </div>
    </MirakaDashboardShell>
  );
}
