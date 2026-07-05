import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Plus, Presentation, Search, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { baseUrl } from '../../lib/base-url';
import MirakaDashboardShell from '../MirakaDashboardShell';
import './documents.css';

type DocumentRow = {
  id: string;
  title: string;
  description?: string | null;
  document_kind: string;
  file_name: string;
  file_extension: string;
  current_version_number: number;
  file_size_bytes?: number | null;
  updated_at: string;
};

async function token() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Anmeldung abgelaufen.');
  return data.session.access_token;
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token()}`);

  const response = await fetch(path, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Anfrage fehlgeschlagen.');
  return payload;
}

function icon(kind: string) {
  if (kind === 'spreadsheet') return <FileSpreadsheet size={21} />;
  if (kind === 'presentation') return <Presentation size={21} />;
  return <FileText size={21} />;
}

function size(bytes?: number | null) {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const payload = await request('/api/opc/documents');
      setDocuments(payload.documents || []);
      setCanCreate(payload.canCreate === true);
    } catch (next: any) {
      setError(next.message || 'Dokumente konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function createBlank(documentKind: string) {
    setBusy(true);
    setError('');
    try {
      const payload = await request('/api/opc/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: documentKind }),
      });
      window.location.assign(`${baseUrl}/dokumente/${payload.document.id}/bearbeiten`);
    } catch (next: any) {
      setError(next.message || 'Dokument konnte nicht erstellt werden.');
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('title', file.name.replace(/\.[^.]+$/, ''));
      const payload = await request('/api/opc/documents', { method: 'POST', body });
      window.location.assign(`${baseUrl}/dokumente/${payload.document.id}`);
    } catch (next: any) {
      setError(next.message || 'Datei konnte nicht hochgeladen werden.');
      setBusy(false);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function download(documentId: string) {
    try {
      const payload = await request(`/api/opc/documents/${documentId}/signed-download`, { method: 'POST' });
      window.location.assign(payload.signedUrl);
    } catch (next: any) {
      setError(next.message || 'Download konnte nicht gestartet werden.');
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((item) =>
      (kind === 'all' || item.document_kind === kind) &&
      (!needle || `${item.title} ${item.file_name} ${item.description || ''}`.toLowerCase().includes(needle)),
    );
  }, [documents, kind, query]);

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch', 'employee']} currentPath="/dokumente" fullWidth>
      <div className="opc-docs-page">
        <header className="opc-docs-header">
          <div><small>OFFICE</small><h1>Dokumente</h1><p>Dokumente, Tabellen und Präsentationen direkt im Portal.</p></div>
          {canCreate && <div className="opc-docs-actions">
            <input ref={fileInput} type="file" hidden accept=".doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <button onClick={() => fileInput.current?.click()} disabled={busy}><Upload size={16} /> Hochladen</button>
            <a href={`${baseUrl}/dokumente/neu`}><Plus size={16} /> Neu</a>
          </div>}
        </header>

        {error && <div className="opc-docs-error">{error}</div>}

        {canCreate && <section className="opc-docs-create">
          <button disabled={busy} onClick={() => void createBlank('document')}><FileText /> <span>Dokument<small>DOCX</small></span></button>
          <button disabled={busy} onClick={() => void createBlank('spreadsheet')}><FileSpreadsheet /> <span>Tabelle<small>XLSX</small></span></button>
          <button disabled={busy} onClick={() => void createBlank('presentation')}><Presentation /> <span>Präsentation<small>PPTX</small></span></button>
        </section>}

        <section className="opc-docs-toolbar">
          <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dokumente durchsuchen" /></label>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">Alle Dateitypen</option><option value="document">Dokumente</option><option value="spreadsheet">Tabellen</option><option value="presentation">Präsentationen</option><option value="pdf">PDF</option>
          </select>
        </section>

        {loading ? <div className="opc-docs-empty">Dokumente werden geladen …</div> : filtered.length === 0 ? <div className="opc-docs-empty">Keine Dokumente gefunden.</div> : <section className="opc-docs-grid">
          {filtered.map((item) => <article key={item.id}>
            <div className="opc-docs-card-icon">{icon(item.document_kind)}</div>
            <span className="opc-docs-extension">{item.file_extension.toUpperCase()}</span>
            <h3>{item.title}</h3><p>{item.file_name}</p>
            <small>Version {item.current_version_number || 1} · {size(item.file_size_bytes)}</small>
            <div className="opc-docs-card-actions">
              <a href={`${baseUrl}/dokumente/${item.id}`}>Öffnen</a>
              <a className="primary" href={`${baseUrl}/dokumente/${item.id}/bearbeiten`}>Bearbeiten</a>
              <button onClick={() => void download(item.id)} title="Herunterladen"><Download size={15} /></button>
            </div>
          </article>)}
        </section>}
      </div>
    </MirakaDashboardShell>
  );
}
