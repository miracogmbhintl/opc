import { useEffect, useState } from 'react';

type ArchivedClient = { id: string; billing_name?: string; billing_email?: string; archive?: { archived_at?: string; archived_by?: string } };
export default function ArchivedClients() {
  const [clients, setClients] = useState<ArchivedClient[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loaded, setLoaded] = useState(false);
  async function reload() {
    try {
      const response = await fetch('/api/opc/client-archive', { credentials: 'include', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !Array.isArray(result.clients)) throw Error(result?.error || 'Archiv nicht verfügbar.');
      if (result.clients.some((c: any) => !('billing_name' in c))) throw Error('Nur Eigentümer können das Archiv öffnen.');
      setClients(result.clients);
      setError('');
    } catch (e: any) { setError(e.message || 'Archiv nicht verfügbar.'); }
    finally { setLoaded(true); }
  }
  useEffect(() => { void reload(); }, []);
  async function restore(client: ArchivedClient) {
    if (!window.confirm(`«${client.billing_name || client.id}» wiederherstellen?`)) return;
    setBusy(client.id);
    try {
      const response = await fetch('/api/opc/client-archive', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', clientId: client.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw Error(result?.error || 'Wiederherstellung fehlgeschlagen.');
      try { window.localStorage.removeItem('opc:page-cache:clients-management:v7-archived-filter'); } catch {}
      await reload();
    } catch (e: any) { setError(e.message || 'Wiederherstellung fehlgeschlagen.'); }
    finally { setBusy(''); }
  }
  return <main style={{ padding: '28px', maxWidth: 1050, margin: '0 auto', color: '#111827' }}>
    <a href="/kunden">← Kunden</a>
    <h1>Archivierte Kunden</h1>
    <p>Nur Eigentümer können Kundeneinträge wiederherstellen. Rechnungen und Aufträge wurden nicht gelöscht.</p>
    {error && <p role="alert" style={{ color: '#991b1b' }}>{error}</p>}
    {!loaded ? <p>Archiv wird geladen…</p> : clients.length === 0 ? <p>Keine archivierten Kunden.</p> :
      clients.map(client => <section key={client.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div><strong>{client.billing_name || 'Kunde'}</strong><div>{client.billing_email || ''}</div><small>Archiviert: {client.archive?.archived_at ? new Date(client.archive.archived_at).toLocaleString('de-CH') : '—'}</small></div>
        <button type="button" disabled={busy === client.id} onClick={() => void restore(client)} style={{ background: '#111318', color: 'white', padding: '11px 15px', borderRadius: 10, cursor: 'pointer' }}>{busy === client.id ? 'Wiederherstellen…' : 'Wiederherstellen'}</button>
      </section>)}
  </main>;
}
