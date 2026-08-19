from pathlib import Path
import re

MARKER = 'OPC_RECIPIENT_SALUTATION_FIX_20260819'


def one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


# ------------------------------------------------------------------
# Invoice detail UI/state
# ------------------------------------------------------------------
p = Path('src/components/InvoiceDetailPage.tsx')
t = p.read_text(encoding='utf-8')

if MARKER not in t:
    helper = r'''// OPC_RECIPIENT_SALUTATION_FIX_20260819
function normalizeRecipientNamePart(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/^(?:herrn?|frau|firma)(?:[\s,.:;-]+|$)/i, '')
    .trim();
}

function normalizeRecipientFormOfAddress(value: unknown) {
  const source = String(value ?? '').trim();
  const normalized = source.toLocaleLowerCase('de-CH');

  if (!source || normalized === 'keine anrede' || normalized === 'ohne anrede') return '';
  if (normalized === 'herr' || normalized === 'herrn') return 'Herr';
  if (normalized === 'frau') return 'Frau';
  if (normalized === 'firma') return 'Firma';
  return source;
}

'''
    t = one(
        t,
        'function getInvoiceRecipientEditor(invoice?: InvoiceRow | null) {',
        helper + 'function getInvoiceRecipientEditor(invoice?: InvoiceRow | null) {',
        'invoice helper',
    )

    t = one(
        t,
        "  const explicitName = snapshotValue(client, [",
        "  const explicitName = normalizeRecipientNamePart(snapshotValue(client, [",
        'invoice explicit name open',
    )
    t = one(
        t,
        "  ]).replace(/^(Herr|Frau|Firma)\\s+/i, '');",
        "  ]));",
        'invoice explicit name close',
    )

    t, n = re.subn(
        r"  const formOfAddress = metadataField\((.*?)\n  \);",
        lambda m: "  const formOfAddress = normalizeRecipientFormOfAddress(metadataField(" + m.group(1) + "\n  ));",
        t,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit('invoice formOfAddress normalization failed')

    t, n = re.subn(
        r"  const firstName = metadataField\((.*?)\n  \);",
        lambda m: "  const firstName = normalizeRecipientNamePart(metadataField(" + m.group(1) + "\n  ));",
        t,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit('invoice firstName normalization failed')

    t, n = re.subn(
        r"  const lastName = metadataField\((.*?)\n  \);",
        lambda m: "  const lastName = normalizeRecipientNamePart(metadataField(" + m.group(1) + "\n  ));",
        t,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit('invoice lastName normalization failed')

    t = one(
        t,
        "  if (normalizedForm.includes('herr')) {",
        "  if (normalizedForm === 'herr' && lastNameForGreeting) {",
        'invoice Herr greeting',
    )
    t = one(
        t,
        "  } else if (normalizedForm.includes('frau')) {",
        "  } else if (normalizedForm === 'frau' && lastNameForGreeting) {",
        'invoice Frau greeting',
    )

    old_ui = '''              <Field label="Anrede">
                <input
                  list="opc-invoice-recipient-salutations"
                  value={recipientEditor.formOfAddress}
                  onChange={(event) =>
                    updateInvoiceMetadata(
                      'invoice_recipient_form_of_address',
                      event.target.value,
                    )
                  }
                  style={inputStyle}
                  placeholder="Herr, Frau oder Firma"
                />
                <datalist id="opc-invoice-recipient-salutations">
                  <option value="Herr" />
                  <option value="Frau" />
                  <option value="Firma" />
                </datalist>
              </Field>'''
    new_ui = '''              <Field label="Anrede">
                <select
                  value={normalizeRecipientFormOfAddress(recipientEditor.formOfAddress)}
                  onChange={(event) => {
                    updateInvoiceMetadata(
                      'invoice_recipient_form_of_address',
                      event.target.value,
                    );
                    updateInvoiceMetadata('invoice_salutation', '');
                  }}
                  style={opcSelectStyle}
                >
                  <option value="">Keine Anrede</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                  <option value="Firma">Firma</option>
                </select>
              </Field>'''
    t = one(t, old_ui, new_ui, 'invoice salutation dropdown')

p.write_text(t, encoding='utf-8')


# ------------------------------------------------------------------
# Shared HTML renderer: invoice, reminders, offer
# ------------------------------------------------------------------
p = Path('src/lib/opc-document-html.ts')
t = p.read_text(encoding='utf-8')

if MARKER not in t:
    helper = r'''// OPC_RECIPIENT_SALUTATION_FIX_20260819
function normalizeRecipientNamePart(value: unknown) {
  return clean(value)
    .replace(/^(?:herrn?|frau|firma)(?:[\s,.:;-]+|$)/i, '')
    .trim();
}

function normalizeRecipientFormOfAddress(value: unknown) {
  const source = clean(value);
  const normalized = source.toLocaleLowerCase('de-CH');

  if (!source || normalized === 'keine anrede' || normalized === 'ohne anrede') return '';
  if (normalized === 'herr' || normalized === 'herrn') return 'Herr';
  if (normalized === 'frau') return 'Frau';
  if (normalized === 'firma') return 'Firma';
  return source;
}

'''
    t = one(t, 'function buildRecipient(', helper + 'function buildRecipient(', 'html helper')

    t = one(
        t,
        "  const snapshotFirstName = pick(clientRecord, ['first_name', 'firstname']);",
        "  const snapshotFirstName = normalizeRecipientNamePart(pick(clientRecord, ['first_name', 'firstname']));",
        'html snapshot first name',
    )
    t = one(
        t,
        "  const snapshotLastName = pick(clientRecord, ['last_name', 'lastname']);",
        "  const snapshotLastName = normalizeRecipientNamePart(pick(clientRecord, ['last_name', 'lastname']));",
        'html snapshot last name',
    )
    t = one(
        t,
        "  const explicitName = pick(clientRecord, ['contact_name', 'full_name', 'billing_name', 'name']);",
        "  const explicitName = normalizeRecipientNamePart(pick(clientRecord, ['contact_name', 'full_name', 'billing_name', 'name']));",
        'html explicit name',
    )

    old_first = '''  const firstName = overrideValue(
    'offer_recipient_first_name',
    snapshotFirstName || (explicitNameParts.length > 1 ? explicitNameParts[0] : ''),
  );'''
    new_first = '''  const firstName = normalizeRecipientNamePart(overrideValue(
    'offer_recipient_first_name',
    snapshotFirstName || (explicitNameParts.length > 1 ? explicitNameParts[0] : ''),
  ));'''
    t = one(t, old_first, new_first, 'html firstName')

    old_last = '''  const lastName = overrideValue(
    'offer_recipient_last_name',
    snapshotLastName || (explicitNameParts.length > 1 ? explicitNameParts.slice(1).join(' ') : explicitName),
  );'''
    new_last = '''  const lastName = normalizeRecipientNamePart(overrideValue(
    'offer_recipient_last_name',
    snapshotLastName || (explicitNameParts.length > 1 ? explicitNameParts.slice(1).join(' ') : explicitName),
  ));'''
    t = one(t, old_last, new_last, 'html lastName')

    old_form = '''  const formOfAddress = overrideValue(
    'offer_recipient_form_of_address',
    snapshotFormOfAddress,
  );'''
    new_form = '''  const formOfAddress = normalizeRecipientFormOfAddress(overrideValue(
    'offer_recipient_form_of_address',
    snapshotFormOfAddress,
  ));'''
    t = one(t, old_form, new_form, 'html formOfAddress')

    old_block = '''  const personLine = [formOfAddress, personName].filter(Boolean).join(' ').trim();
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  const addressLines = unique([
    companyName,
    personLine && personLine !== companyName ? personLine : '',
    streetLine,
    cityLine,
    country,
  ]);

  const salutationLower = formOfAddress.toLocaleLowerCase('de-CH');
  let salutationLine = 'Sehr geehrte Damen und Herren';
  if (salutationLower.includes('herr')) {
    salutationLine = `Sehr geehrter Herr ${lastName || personName}`.trim();
  } else if (salutationLower.includes('frau')) {
    salutationLine = `Sehr geehrte Frau ${lastName || personName}`.trim();
  }

  return {'''
    new_block = '''  const salutationLower = formOfAddress.toLocaleLowerCase('de-CH');
  const personPrefix =
    salutationLower === 'herr' || salutationLower === 'frau'
      ? formOfAddress
      : '';
  const personLine = personName
    ? [personPrefix, personName].filter(Boolean).join(' ').trim()
    : '';
  const cityLine = [postalCode, city].filter(Boolean).join(' ');
  const addressLines = unique([
    companyName,
    personLine && personLine !== companyName ? personLine : '',
    streetLine,
    cityLine,
    country,
  ]);

  let salutationLine = 'Sehr geehrte Damen und Herren';
  if (salutationLower === 'herr' && (lastName || personName)) {
    salutationLine = `Sehr geehrter Herr ${lastName || personName}`;
  } else if (salutationLower === 'frau' && (lastName || personName)) {
    salutationLine = `Sehr geehrte Frau ${lastName || personName}`;
  }

  return {'''
    t = one(t, old_block, new_block, 'html address block')

    t = one(
        t,
        '    fullName: personName || companyName,',
        "    fullName: (salutationLower === 'firma' || (!salutationLower && companyName))\n      ? (companyName || personName)\n      : (personName || companyName),",
        'html QR debtor name',
    )

p.write_text(t, encoding='utf-8')


# ------------------------------------------------------------------
# jsPDF fallback path
# ------------------------------------------------------------------
p = Path('src/lib/opc-document-pdf.ts')
t = p.read_text(encoding='utf-8')

if MARKER not in t:
    old = '''function getClientDisplayName(clientSnapshot?: OPCDocumentParty, fallback?: string) {
  return getSnapshotValue(clientSnapshot, ['billing_name', 'company_name', 'full_name', 'name', 'contact_name']) || clean(fallback) || 'Kundin / Kunde';
}'''
    new = r'''// OPC_RECIPIENT_SALUTATION_FIX_20260819
function normalizeRecipientNamePart(value: unknown) {
  return clean(value)
    .replace(/^(?:herrn?|frau|firma)(?:[\s,.:;-]+|$)/i, '')
    .trim();
}

function getClientDisplayName(clientSnapshot?: OPCDocumentParty, fallback?: string) {
  const companyName = getSnapshotValue(clientSnapshot, ['company_name', 'business_name']);
  const billingName = normalizeRecipientNamePart(getSnapshotValue(clientSnapshot, ['billing_name']));
  const personName = normalizeRecipientNamePart(
    getSnapshotValue(clientSnapshot, ['full_name', 'name', 'contact_name']),
  );
  return companyName || billingName || personName || clean(fallback) || 'Kundin / Kunde';
}

function getInvoiceFallbackDisplayName(invoice: Record<string, any>) {
  const metadata = invoice?.metadata && typeof invoice.metadata === 'object' && !Array.isArray(invoice.metadata)
    ? invoice.metadata
    : {};
  const client = invoice?.client_snapshot || {};
  const value = (invoiceKey: string, offerKey: string) =>
    Object.prototype.hasOwnProperty.call(metadata, invoiceKey)
      ? String(metadata[invoiceKey] ?? '')
      : Object.prototype.hasOwnProperty.call(metadata, offerKey)
        ? String(metadata[offerKey] ?? '')
        : '';
  const form = value('invoice_recipient_form_of_address', 'offer_recipient_form_of_address')
    .trim().toLocaleLowerCase('de-CH');
  const companyName = clean(value('invoice_recipient_company_name', 'offer_recipient_company_name'));
  const firstName = normalizeRecipientNamePart(value('invoice_recipient_first_name', 'offer_recipient_first_name'));
  const lastName = normalizeRecipientNamePart(value('invoice_recipient_last_name', 'offer_recipient_last_name'));
  const personName = [firstName, lastName].filter(Boolean).join(' ');

  if (form === 'firma' || (!form && companyName)) return companyName || personName;
  return personName || companyName || getClientDisplayName(client, invoice.title);
}'''
    t = one(t, old, new, 'fallback display name')

    t = one(
        t,
        '  const debtorName = getClientDisplayName(client, invoice.title);',
        '  const debtorName = getInvoiceFallbackDisplayName(invoice);',
        'fallback QR debtor',
    )

    t = one(
        t,
        '  let y = drawHeader(doc, { title: \'Rechnung\', number: String(invoice.invoice_number || \'\'), dateLine, clientSnapshot: invoice.client_snapshot, siteSnapshot: invoice.site_snapshot, fallbackClientName: invoice.title, logoDataUrl });',
        '  let y = drawHeader(doc, { title: \'Rechnung\', number: String(invoice.invoice_number || \'\'), dateLine, clientSnapshot: invoice.client_snapshot, siteSnapshot: invoice.site_snapshot, fallbackClientName: getInvoiceFallbackDisplayName(invoice), logoDataUrl });',
        'fallback invoice header',
    )

p.write_text(t, encoding='utf-8')


for filename in [
    'src/components/InvoiceDetailPage.tsx',
    'src/lib/opc-document-html.ts',
    'src/lib/opc-document-pdf.ts',
]:
    if MARKER not in Path(filename).read_text(encoding='utf-8'):
        raise SystemExit(f'marker missing: {filename}')

print('Recipient salutation repair applied to all print paths.')
