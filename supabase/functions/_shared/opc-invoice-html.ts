import { buildInvoiceHtml as buildInvoiceHtmlCore } from './opc-invoice-html-core.ts';
import type { OPCInvoiceHtmlInput } from './opc-invoice-html-core.ts';

export type {
  OPCDocumentItem,
  OPCDocumentParty,
  OPCDocumentTotals,
  OPCInvoiceHtmlInput,
} from './opc-invoice-html-core.ts';

type JsonRecord = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function pick(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = clean(record[key]);
    if (value) return value;
  }
  return '';
}

function splitAddressLines(value: unknown) {
  return clean(value)
    .replace(/,\s*/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePostalCity(value: unknown) {
  const addressLines = splitAddressLines(value);

  for (let index = addressLines.length - 1; index >= 0; index -= 1) {
    const line = addressLines[index]
      .replace(/^(?:CH|DE|FR|AT|IT)[-\s]+(?=[A-Z0-9])/i, '')
      .trim();

    const swissMatch = line.match(/^(\d{4,6})\s+(.+)$/);
    if (swissMatch) {
      return {
        postalCode: swissMatch[1].trim(),
        city: swissMatch[2].trim(),
      };
    }

    const internationalMatch = line.match(/^([A-Z0-9][A-Z0-9 -]{2,9})\s+(.+)$/i);
    if (
      internationalMatch &&
      /\d/.test(internationalMatch[1]) &&
      /[A-ZÀ-ÖØ-öø-ÿ]/i.test(internationalMatch[2])
    ) {
      return {
        postalCode: internationalMatch[1].trim(),
        city: internationalMatch[2].trim(),
      };
    }
  }

  return { postalCode: '', city: '' };
}

function normalizeCountryCode(value: unknown) {
  const country = clean(value).toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) return country;
  if (/SCHWEIZ|SWITZERLAND|SUISSE|SVIZZERA/.test(country)) return 'CH';
  if (/DEUTSCHLAND|GERMANY|ALLEMAGNE/.test(country)) return 'DE';
  if (/FRANKREICH|FRANCE/.test(country)) return 'FR';
  if (/ÖSTERREICH|AUSTRIA|AUTRICHE/.test(country)) return 'AT';
  if (/ITALIEN|ITALY|ITALIA/.test(country)) return 'IT';
  return 'CH';
}

function normalizeInvoiceInput(input: OPCInvoiceHtmlInput): OPCInvoiceHtmlInput {
  const invoice = asRecord(input.invoice);
  const client = asRecord(invoice.client_snapshot);
  const site = asRecord(invoice.site_snapshot);

  const clientAddress = pick(client, [
    'billing_address',
    'address_text',
    'address_line_1',
    'street',
    'address',
  ]);
  const siteAddress = pick(site, [
    'address_text',
    'address',
    'billing_address',
    'address_line_1',
    'street',
  ]);

  const clientParsed = parsePostalCity(clientAddress);
  const siteParsed = parsePostalCity(siteAddress);

  const postalCode =
    pick(client, [
      'billing_postal_code',
      'billing_postcode',
      'billing_zip',
      'billing_zip_code',
      'postal_code',
      'postcode',
      'zip',
    ]) ||
    clientParsed.postalCode ||
    pick(site, ['postal_code', 'postcode', 'zip']) ||
    siteParsed.postalCode;

  const city =
    pick(client, ['billing_city', 'city', 'locality', 'town']) ||
    clientParsed.city ||
    pick(site, ['city', 'billing_city', 'locality', 'town']) ||
    siteParsed.city;

  const country =
    pick(client, ['country_code', 'billing_country_code', 'country']) ||
    pick(site, ['country_code', 'country']) ||
    'CH';
  const countryCode = normalizeCountryCode(country);

  const normalizedClient: JsonRecord = { ...client };
  const normalizedSite: JsonRecord = { ...site };

  if (postalCode) {
    if (!pick(normalizedClient, ['billing_postal_code', 'postal_code', 'postcode', 'zip'])) {
      normalizedClient.billing_postal_code = postalCode;
    }
    if (!pick(normalizedSite, ['postal_code', 'postcode', 'zip'])) {
      normalizedSite.postal_code = postalCode;
    }
  }

  if (city) {
    if (!pick(normalizedClient, ['billing_city', 'city', 'locality', 'town'])) {
      normalizedClient.billing_city = city;
    }
    if (!pick(normalizedSite, ['city', 'billing_city', 'locality', 'town'])) {
      normalizedSite.city = city;
    }
  }

  if (!pick(normalizedClient, ['country_code', 'billing_country_code'])) {
    normalizedClient.country_code = countryCode;
  }
  if (!pick(normalizedSite, ['country_code'])) {
    normalizedSite.country_code = countryCode;
  }

  return {
    ...input,
    invoice: {
      ...invoice,
      client_snapshot: normalizedClient,
      site_snapshot: normalizedSite,
    },
  };
}

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function validateQrDebtorInHtml(html: string) {
  return html.replace(
    /<script>window\.([A-Z0-9_]+)=([\s\S]*?);<\/script>/g,
    (fullMatch, variableName: string, json: string) => {
      try {
        const data = JSON.parse(json) as JsonRecord;
        const qrBill = asRecord(data.qrBill);
        if (!Object.keys(qrBill).length) return fullMatch;

        const debtor = asRecord(qrBill.debtor);
        const name = clean(debtor.name);
        const postalCode = clean(debtor.postalCode);
        const city = clean(debtor.city);
        const countryCode = normalizeCountryCode(debtor.countryCode);
        const complete = Boolean(
          name &&
          postalCode &&
          city &&
          /^[A-Z]{2}$/.test(countryCode),
        );

        data.qrBill = {
          ...qrBill,
          debtor: complete
            ? {
                ...debtor,
                name,
                postalCode,
                city,
                countryCode,
              }
            : {},
        };

        return `<script>window.${variableName}=${serializeForInlineScript(data)};</script>`;
      } catch {
        return fullMatch;
      }
    },
  );
}

export function buildInvoiceHtml(input: OPCInvoiceHtmlInput) {
  return validateQrDebtorInHtml(
    buildInvoiceHtmlCore(normalizeInvoiceInput(input)),
  );
}
