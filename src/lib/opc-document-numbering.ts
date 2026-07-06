function cleanDocumentNumber(value: unknown) {
  return String(value ?? '').trim();
}

/**
 * Leitet eine verbundene OPC-Dokumentnummer aus einer vorhandenen
 * Offerten- oder Rechnungsnummer ab.
 *
 * Beispiele:
 * AN-00162 -> AB-00162
 * RE-00159 -> MA-00159
 *
 * Die ursprüngliche Nummer wird dabei nicht verändert. Diese Funktion
 * dient nur für abgeleitete Dokumente wie Auftragsbestätigungen und
 * Mahnungen.
 */
export function deriveOpcDocumentNumber(
  sourceNumber: unknown,
  targetPrefix: string,
) {
  const source = cleanDocumentNumber(sourceNumber);
  const prefix = cleanDocumentNumber(targetPrefix)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!source || !prefix) {
    return '';
  }

  const trailingNumberMatch = source.match(/(\d+)(?!.*\d)/);

  if (!trailingNumberMatch) {
    return '';
  }

  const numericPart = trailingNumberMatch[1];
  const width = Math.max(5, numericPart.length);

  return `${prefix}-${numericPart.padStart(width, '0')}`;
}
