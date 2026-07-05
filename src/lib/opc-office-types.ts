export type OpcOfficeRole = 'owner' | 'admin' | 'dispatch' | 'employee' | 'client';

export type OpcDocumentKind =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'template'
  | 'form'
  | 'other';

export type OpcOfficeAccess = {
  canView: boolean;
  canEdit: boolean;
  canDownload: boolean;
  canShare: boolean;
  canDelete: boolean;
};

export const OPC_OFFICE_BUCKET = 'opc-office-documents';
export const OPC_OFFICE_MAX_FILE_SIZE = 100 * 1024 * 1024;

export const OPC_OFFICE_ALLOWED_EXTENSIONS = new Set([
  'doc',
  'docx',
  'odt',
  'rtf',
  'txt',
  'xls',
  'xlsx',
  'ods',
  'csv',
  'ppt',
  'pptx',
  'odp',
  'pdf',
]);

const MIME_TYPES: Record<string, string> = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  txt: 'text/plain',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation',
  pdf: 'application/pdf',
};

export function normalizeOfficeExtension(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '');
}

export function extensionFromFileName(fileName: string) {
  const cleanName = String(fileName || '').trim();
  const index = cleanName.lastIndexOf('.');
  return index >= 0 ? normalizeOfficeExtension(cleanName.slice(index + 1)) : '';
}

export function isAllowedOfficeExtension(extension: string) {
  return OPC_OFFICE_ALLOWED_EXTENSIONS.has(normalizeOfficeExtension(extension));
}

export function inferOfficeDocumentKind(extension: string): OpcDocumentKind {
  const normalized = normalizeOfficeExtension(extension);

  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(normalized)) return 'document';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(normalized)) return 'spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(normalized)) return 'presentation';
  if (normalized === 'pdf') return 'pdf';

  return 'other';
}

export function getOfficeMimeType(extension: string, fallback?: string | null) {
  const normalized = normalizeOfficeExtension(extension);
  return MIME_TYPES[normalized] || String(fallback || '').trim() || 'application/octet-stream';
}

export function getEuroOfficeDocumentType(kind: OpcDocumentKind) {
  if (kind === 'spreadsheet') return 'cell';
  if (kind === 'presentation') return 'slide';
  if (kind === 'pdf') return 'pdf';
  return 'word';
}

export function sanitizeOfficeFileName(value: string, fallback = 'dokument') {
  const source = String(value || '').trim() || fallback;
  const normalized = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 140);

  return normalized || fallback;
}

export function ensureOfficeFileName(title: string, extension: string) {
  const normalizedExtension = normalizeOfficeExtension(extension);
  const baseName = sanitizeOfficeFileName(title, 'dokument').replace(/\.[^.]+$/, '');
  return `${baseName}.${normalizedExtension}`;
}

export function normalizeOfficeRole(value: unknown): OpcOfficeRole {
  const role = String(value || '').trim().toLowerCase();

  if (role === 'owner' || role === 'godmode') return 'owner';
  if (role === 'admin' || role === 'administrator') return 'admin';
  if (['dispatch', 'dispatcher', 'disposition'].includes(role)) return 'dispatch';
  if (['employee', 'mitarbeiter', 'staff'].includes(role)) return 'employee';

  return 'client';
}

export function canManageOfficeDocuments(role: OpcOfficeRole) {
  return role === 'owner' || role === 'admin' || role === 'dispatch';
}

export function canDeleteOfficeDocuments(role: OpcOfficeRole) {
  return role === 'owner' || role === 'admin';
}
