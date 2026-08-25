import { createOpcServiceClient } from './opc-ticket-admin';

const QR_LINK_TABLE = 'opc_facility_public_links';

function normalizeLinkType(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'general' || raw === 'mass_print' || raw === 'public_general') return 'general';
  return 'facility';
}

export async function validateActiveGeneralQrToken(locals: unknown, value: string | null) {
  const token = String(value || '').trim().slice(0, 220);

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: 'Öffentlicher QR-Token fehlt.',
    };
  }

  const supabase = createOpcServiceClient(locals);
  const { data, error } = await supabase
    .from(QR_LINK_TABLE)
    .select('id,is_active,link_type')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[opc/public-qr-access] QR validation failed:', error.message);
    return {
      ok: false as const,
      status: 500,
      error: 'QR-Code konnte nicht geprüft werden.',
    };
  }

  if (!data || data.is_active !== true || normalizeLinkType(data.link_type) !== 'general') {
    return {
      ok: false as const,
      status: 403,
      error: 'Dieser QR-Code ist für die Adresssuche nicht freigegeben.',
    };
  }

  return {
    ok: true as const,
    linkId: String(data.id || ''),
  };
}
