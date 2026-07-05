import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { baseUrl } from '../../lib/base-url';
import MirakaDashboardShell from '../MirakaDashboardShell';
import './documents.css';

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
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Office-Editor konnte nicht geladen werden.')), { once: true });
    });
    return;
  }

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

export default function OfficeEditorPage({ documentId }: { documentId: string }) {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [error, setError] = useState('');
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null);
  const editorElementId = useMemo(() => `opc-office-editor-${documentId.replace(/[^a-zA-Z0-9]/g, '')}`, [documentId]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('Anmeldung abgelaufen.');

        const response = await fetch(`/api/opc/documents/${documentId}/editor-config`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const nextPayload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(nextPayload.error || 'Editor-Konfiguration konnte nicht geladen werden.');
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
      } catch (nextError: any) {
        if (!cancelled) setError(nextError?.message || 'Dokument konnte nicht geöffnet werden.');
      }
    }

    void start();

    return () => {
      cancelled = true;
      try { editorRef.current?.destroyEditor?.(); } catch { /* editor cleanup is best effort */ }
      editorRef.current = null;
    };
  }, [documentId, editorElementId]);

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch', 'employee']} currentPath="/dokumente" fullWidth>
      <div className="opc-office-editor-page">
        <header className="opc-office-editor-header">
          <a href={`${baseUrl}/dokumente/${documentId}`}><ArrowLeft size={17} /> Zurück</a>
          <div><strong>{payload?.document?.title || 'Dokument wird geöffnet'}</strong><span>{payload?.document?.fileName || 'Editor wird geladen …'}</span></div>
          <a href={`${baseUrl}/dokumente/${documentId}`}><ExternalLink size={16} /> Details</a>
        </header>
        {error ? <div className="opc-office-editor-error"><strong>Editor nicht verfügbar</strong><span>{error}</span></div> : <div id={editorElementId} className="opc-office-editor-frame"><div className="opc-office-editor-loading">Office-Editor wird geladen …</div></div>}
      </div>
    </MirakaDashboardShell>
  );
}
