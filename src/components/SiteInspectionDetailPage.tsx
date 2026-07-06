import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import MirakaDashboardShell from './MirakaDashboardShell';
import {
  OPCPageShell,
  OPCListCard,
  OPC_BRAND,
  OPC_PAGE_FONT,
  opcBlackButtonStyle,
  opcSecondaryButtonStyle,
  opcInputStyle,
  opcSelectStyle,
  opcResponsiveStyle,
} from './opc/OPCPageTop';
import { ArrowLeft, Camera, Check, ChevronDown, FileDown, FileText, Image as ImageIcon, MapPin, Save, UploadCloud, X } from 'lucide-react';

type InspectionStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'converted_to_quote' | 'cancelled';

type InspectionForm = {
  id?: string;
  inspection_number: string;
  metadata: Record<string, any>;
  inquiry_id: string | null;
  client_id: string;
  contact_id: string | null;
  client_site_id: string | null;
  status: InspectionStatus;
  inspection_type: string;
  requested_service_category: string;
  property_type: string;
  property_size_m2: string;
  room_count: string;
  bathroom_count: string;
  floor_level: string;
  has_elevator: string;
  access_notes: string;
  parking_notes: string;
  key_handover_notes: string;
  property_condition_notes: string;
  risk_notes: string;
  estimator_notes: string;
  internal_notes: string;
  estimated_hours: string;
  estimated_staff_count: string;
  scheduled_at: string;
};

type ClientRow = Record<string, any>;
type SiteRow = Record<string, any>;
type ContactRow = Record<string, any>;
type MediaRow = Record<string, any>;
type AddressSource = 'client' | 'site' | 'manual';

type ManualSiteAddress = {
  site_name: string;
  address_text: string;
  postal_code: string;
  city: string;
  country: string;
};

type SiteInspectionDetailPageProps = {
  inspectionId: string;
};

const DOCUMENT_CORRECTION_MODE = String(import.meta.env.PUBLIC_OPC_DOCUMENT_CORRECTION_MODE || '').toLowerCase() === 'true';

const emptyForm: InspectionForm = {
  inspection_number: '',
  metadata: {},
  inquiry_id: null,
  client_id: '',
  contact_id: null,
  client_site_id: null,
  status: 'draft',
  inspection_type: 'onsite',
  requested_service_category: '',
  property_type: '',
  property_size_m2: '',
  room_count: '',
  bathroom_count: '',
  floor_level: '',
  has_elevator: '',
  access_notes: '',
  parking_notes: '',
  key_handover_notes: '',
  property_condition_notes: '',
  risk_notes: '',
  estimator_notes: '',
  internal_notes: '',
  estimated_hours: '',
  estimated_staff_count: '',
  scheduled_at: '',
};

const emptyManualSiteAddress: ManualSiteAddress = {
  site_name: '',
  address_text: '',
  postal_code: '',
  city: '',
  country: 'Schweiz',
};

function clean(value: unknown) {
  return String(value || '').trim();
}

function toNumberOrNull(value: string) {
  const cleaned = clean(value).replace(',', '.');
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function toIntOrNull(value: string) {
  const number = toNumberOrNull(value);
  return number === null ? null : Math.round(number);
}

function dateTimeLocalToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function buildAddressSnapshot(site?: SiteRow | null) {
  if (!site) return {};
  return {
    site_id: site.id,
    site_name: site.site_name || null,
    site_type: site.site_type || null,
    address_text: site.address_text || null,
    postal_code: site.postal_code || null,
    city: site.city || null,
    country: site.country || null,
  };
}

function hasManualAddress(address: ManualSiteAddress) {
  return Boolean(
    clean(address.address_text) ||
    clean(address.postal_code) ||
    clean(address.city)
  );
}

function clientAddressFromClient(client?: ClientRow | null): ManualSiteAddress {
  const billingAddress = client?.billing_address;
  const billingObject = billingAddress && typeof billingAddress === 'object' && !Array.isArray(billingAddress)
    ? billingAddress
    : {};

  const street = clean(
    billingObject.address_text ||
    billingObject.street_address ||
    billingObject.street ||
    client?.billing_address_text ||
    client?.billing_street ||
    client?.address_text ||
    client?.street
  );
  const houseNumber = clean(
    billingObject.house_number ||
    billingObject.street_number ||
    client?.billing_house_number ||
    client?.house_number
  );
  const addressText = typeof billingAddress === 'string'
    ? clean(billingAddress)
    : [street, houseNumber].filter(Boolean).join(' ').trim();

  return {
    site_name: `Kundenadresse - ${getClientLabel(client)}`,
    address_text: addressText,
    postal_code: clean(
      billingObject.postal_code ||
      billingObject.zip ||
      client?.billing_postal_code ||
      client?.postal_code ||
      client?.zip
    ),
    city: clean(
      billingObject.city ||
      billingObject.locality ||
      client?.billing_city ||
      client?.city
    ),
    country: clean(
      billingObject.country ||
      client?.billing_country ||
      client?.country
    ) || 'Schweiz',
  };
}

function formatManualAddress(address: ManualSiteAddress) {
  const cityLine = [clean(address.postal_code), clean(address.city)].filter(Boolean).join(' ');
  return [clean(address.site_name), clean(address.address_text), cityLine, clean(address.country)]
    .filter(Boolean)
    .join(' · ');
}

function buildInspectionAddressSnapshot(
  site?: SiteRow | null,
  manualSite?: ManualSiteAddress,
  source: AddressSource = site ? 'site' : 'manual'
) {
  if (site) {
    return {
      ...buildAddressSnapshot(site),
      source: 'client_site',
    };
  }

  if (!manualSite || !hasManualAddress(manualSite)) return {};

  return {
    site_id: null,
    site_name: clean(manualSite.site_name) || null,
    site_type: null,
    address_text: clean(manualSite.address_text) || null,
    postal_code: clean(manualSite.postal_code) || null,
    city: clean(manualSite.city) || null,
    country: clean(manualSite.country) || null,
    source: source === 'client' ? 'client_address' : 'manual_inspection_address',
  };
}

function manualAddressFromSnapshot(snapshot: any): ManualSiteAddress {
  if (!snapshot || typeof snapshot !== 'object') return emptyManualSiteAddress;

  return {
    site_name: clean(snapshot.site_name),
    address_text: clean(snapshot.address_text),
    postal_code: clean(snapshot.postal_code),
    city: clean(snapshot.city),
    country: clean(snapshot.country) || 'Schweiz',
  };
}

function buildContactSnapshot(contact?: ContactRow | null) {
  if (!contact) return {};
  return {
    contact_id: contact.id,
    full_name: contact.full_name || null,
    email: contact.email || null,
    phone_e164: contact.phone_e164 || contact.phone_raw || null,
  };
}

function buildClientSnapshot(client?: ClientRow | null) {
  if (!client) return {};
  return {
    client_id: client.id,
    billing_name: client.billing_name || null,
    company_name: client.company_name || null,
    client_type: client.client_type || null,
    billing_email: client.billing_email || null,
    billing_phone_e164: client.billing_phone_e164 || null,
    billing_address: client.billing_address || null,
  };
}

function getClientLabel(client?: ClientRow | null) {
  if (!client) return 'Kunde';
  return client.billing_name || client.company_name || client.full_name || 'Kunde';
}

function getSiteLabel(site?: SiteRow | null) {
  if (!site) return 'Kein Standort';
  const cityLine = [site.postal_code, site.city].filter(Boolean).join(' ');
  return [site.site_name, site.address_text, cityLine].filter(Boolean).join(' · ') || 'Standort';
}

// OPC_INSPECTION_ADDRESS_SELECTION_UPGRADE_20260706
function normalizeClientAddressKey(address?: Record<string, any> | null) {
  if (!address) return '';

  const normalizePart = (value: unknown) =>
    clean(value)
      .toLocaleLowerCase('de-CH')
      .replace(/[.,;:/\\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  return [
    normalizePart(address.address_text),
    normalizePart(address.postal_code),
    normalizePart(address.city),
    normalizePart(address.country || 'Schweiz'),
  ].join('|');
}

function uniqueClientSites(rows: SiteRow[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const status = clean(row.status).toLowerCase();

    if (status && status !== 'active') return false;

    const key = normalizeClientAddressKey(row);

    if (!key || key === '|||') {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getInspectionStatusLabel(status: InspectionStatus | string) {
  const labels: Record<string, string> = {
    draft: 'Entwurf',
    scheduled: 'Geplant',
    in_progress: 'In Arbeit',
    completed: 'Abgeschlossen',
    converted_to_quote: 'In Offerte übergeben',
    cancelled: 'Storniert',
  };
  return labels[status] || status;
}


function formatDateTimeForDocument(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value) || '-';
  return new Intl.DateTimeFormat('de-CH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function safeDocumentFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function imageUrlToPdfData(url: string) {
  const response = await fetch(url, {
    cache: 'force-cache',
  });

  if (!response.ok) {
    throw new Error(
      `Bild konnte nicht geladen werden (${response.status}).`
    );
  }

  const sourceBlob = await response.blob();
  const objectUrl = URL.createObjectURL(sourceBlob);

  try {
    const image = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const element = new Image();

        element.decoding = 'async';

        element.onload = () => resolve(element);

        element.onerror = () => {
          reject(
            new Error(
              'Bildformat konnte nicht gelesen werden.'
            )
          );
        };

        element.src = objectUrl;
      }
    );

    const sourceWidth = Math.max(
      1,
      image.naturalWidth || image.width
    );

    const sourceHeight = Math.max(
      1,
      image.naturalHeight || image.height
    );

    /*
     * Für eine halbe A4-Seite reichen 900 Pixel.
     * Das Seitenverhältnis bleibt unverändert.
     */
    const maxEdge = 900;

    const scale = Math.min(
      1,
      maxEdge / Math.max(sourceWidth, sourceHeight)
    );

    const width = Math.max(
      1,
      Math.round(sourceWidth * scale)
    );

    const height = Math.max(
      1,
      Math.round(sourceHeight * scale)
    );

    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', {
      alpha: false,
    });

    if (!context) {
      throw new Error(
        'Bild konnte nicht für das PDF vorbereitet werden.'
      );
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    const compressedBlob = await new Promise<Blob>(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
              return;
            }

            reject(
              new Error(
                'Bild konnte nicht komprimiert werden.'
              )
            );
          },
          'image/jpeg',
          0.46
        );
      }
    );

    const dataUrl = await new Promise<string>(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          resolve(String(reader.result || ''));
        };

        reader.onerror = () => {
          reject(
            new Error(
              'Komprimiertes Bild konnte nicht gelesen werden.'
            )
          );
        };

        reader.readAsDataURL(compressedBlob);
      }
    );

    canvas.width = 1;
    canvas.height = 1;

    return {
      dataUrl,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function SiteInspectionDetailPage({ inspectionId }: SiteInspectionDetailPageProps) {
  const isNew = inspectionId === 'neu' || inspectionId === 'new';

  const [form, setForm] = useState<InspectionForm>(emptyForm);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [site, setSite] = useState<SiteRow | null>(null);
  const [clientSites, setClientSites] = useState<SiteRow[]>([]);
  const [addressSource, setAddressSource] = useState<AddressSource>('client');
  const [manualSiteAddress, setManualSiteAddress] = useState<ManualSiteAddress>(emptyManualSiteAddress);
  const [showAddressPopup, setShowAddressPopup] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [showMoreNotes, setShowMoreNotes] = useState(false);
  const [contact, setContact] = useState<ContactRow | null>(null);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [existingQuoteId, setExistingQuoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    void loadInitialData();
  }, [inspectionId]);

  const canUpload = Boolean(form.id);
  const canOpenOrCreateQuote = Boolean(form.id);

  async function loadInitialData() {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      if (isNew) {
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get('client_id') || '';
        const siteId = params.get('site_id');
        const contactId = params.get('contact_id');
        const inquiryId = params.get('inquiry_id');

        if (!clientId) throw new Error('Für eine neue Besichtigung fehlt die client_id. Bitte über die Kundenseite starten.');

        setForm({ ...emptyForm, client_id: clientId, client_site_id: siteId, contact_id: contactId, inquiry_id: inquiryId });
        const references = await loadReferences(clientId, siteId, contactId);
        const availableSites = references?.sites || [];

        if (references?.site) {
          setAddressSource('site');
          setSite(references.site);
          setManualSiteAddress(emptyManualSiteAddress);
        } else if (availableSites.length === 1) {
          const defaultSite = availableSites[0];

          setAddressSource('site');
          setSite(defaultSite);
          setManualSiteAddress(emptyManualSiteAddress);
          setForm((previous) => ({
            ...previous,
            client_site_id: defaultSite.id,
          }));
        } else if (availableSites.length > 1) {
          setAddressSource('site');
          setSite(null);
          setManualSiteAddress(emptyManualSiteAddress);
          setForm((previous) => ({
            ...previous,
            client_site_id: null,
          }));
        } else {
          setAddressSource('client');
          setSite(null);
          setManualSiteAddress(clientAddressFromClient(references?.client));
        }

        return;
      }

      const { data, error } = await supabase.from('opc_site_inspections').select('*').eq('id', inspectionId).single();
      if (error) throw error;
      if (!data) throw new Error('Besichtigung wurde nicht gefunden.');

      const nextForm: InspectionForm = {
        id: data.id,
        inspection_number: data.inspection_number || '',
        metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {},
        inquiry_id: data.inquiry_id || null,
        client_id: data.client_id,
        contact_id: data.contact_id || null,
        client_site_id: data.client_site_id || null,
        status: data.status || 'draft',
        inspection_type: data.inspection_type || 'onsite',
        requested_service_category: data.requested_service_category || '',
        property_type: data.property_type || '',
        property_size_m2: data.property_size_m2 === null || data.property_size_m2 === undefined ? '' : String(data.property_size_m2),
        room_count: data.room_count === null || data.room_count === undefined ? '' : String(data.room_count),
        bathroom_count: data.bathroom_count === null || data.bathroom_count === undefined ? '' : String(data.bathroom_count),
        floor_level: data.floor_level || '',
        has_elevator: data.has_elevator === null || data.has_elevator === undefined ? '' : String(data.has_elevator),
        access_notes: data.access_notes || '',
        parking_notes: data.parking_notes || '',
        key_handover_notes: data.key_handover_notes || '',
        property_condition_notes: data.property_condition_notes || '',
        risk_notes: data.risk_notes || '',
        estimator_notes: data.estimator_notes || '',
        internal_notes: data.internal_notes || '',
        estimated_hours: data.estimated_hours === null || data.estimated_hours === undefined ? '' : String(data.estimated_hours),
        estimated_staff_count: data.estimated_staff_count === null || data.estimated_staff_count === undefined ? '' : String(data.estimated_staff_count),
        scheduled_at: isoToDateTimeLocal(data.scheduled_at),
      };

      const addressSnapshot = data.address_snapshot && typeof data.address_snapshot === 'object' ? data.address_snapshot : null;
      setForm(nextForm);

      const [references] = await Promise.all([
        loadReferences(data.client_id, data.client_site_id, data.contact_id),
        loadMedia(data.id),
        loadExistingQuote(data.id),
      ]);

      const availableSites = references?.sites || [];

      if (data.client_site_id && references?.site) {
        setAddressSource('site');
        setSite(references.site);
        setManualSiteAddress(emptyManualSiteAddress);
      } else if (addressSnapshot && hasManualAddress(manualAddressFromSnapshot(addressSnapshot))) {
        setAddressSource(addressSnapshot.source === 'client_address' ? 'client' : 'manual');
        setSite(null);
        setManualSiteAddress(manualAddressFromSnapshot(addressSnapshot));
      } else if (availableSites.length === 1) {
        const defaultSite = availableSites[0];

        setAddressSource('site');
        setSite(defaultSite);
        setManualSiteAddress(emptyManualSiteAddress);
        setForm((previous) => ({
          ...previous,
          client_site_id: defaultSite.id,
        }));
      } else if (availableSites.length > 1) {
        setAddressSource('site');
        setSite(null);
        setManualSiteAddress(emptyManualSiteAddress);
        setForm((previous) => ({
          ...previous,
          client_site_id: null,
        }));
      } else {
        setAddressSource('client');
        setSite(null);
        setManualSiteAddress(clientAddressFromClient(references?.client));
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Besichtigung konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function loadReferences(clientId: string, siteId?: string | null, contactId?: string | null) {
    if (!supabase) return null;

    const [clientResponse, sitesResponse, siteResponse, contactResponse] = await Promise.all([
      supabase.from('opc_clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('opc_client_sites').select('*').eq('client_id', clientId),
      siteId ? supabase.from('opc_client_sites').select('*').eq('id', siteId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
      contactId ? supabase.from('opc_contacts').select('*').eq('id', contactId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (clientResponse.error) throw clientResponse.error;
    if (sitesResponse.error) console.warn(sitesResponse.error.message);
    if (siteResponse.error) console.warn(siteResponse.error.message);
    if (contactResponse.error) console.warn(contactResponse.error.message);

    const loadedClient = clientResponse.data || null;
    const loadedSites = uniqueClientSites(sitesResponse.data || []).sort((a: SiteRow, b: SiteRow) => {
      const primaryDifference = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary));
      if (primaryDifference !== 0) return primaryDifference;
      return getSiteLabel(a).localeCompare(getSiteLabel(b), 'de');
    });
    const loadedSite = siteResponse.data || null;
    const loadedContact = contactResponse.data || null;

    setClient(loadedClient);
    setClientSites(loadedSites);
    setSite(loadedSite);
    setContact(loadedContact);

    return {
      client: loadedClient,
      sites: loadedSites,
      site: loadedSite,
      contact: loadedContact,
    };
  }

  async function loadMedia(targetInspectionId: string) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from('opc_site_inspection_media')
      .select('*')
      .eq('inspection_id', targetInspectionId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Besichtigungsmedien konnten nicht geladen werden:', error.message);
      setMediaRows([]);
      return [];
    }

    const rows = data || [];
    const rowsWithPreviews = await Promise.all(
      rows.map(async (media) => {
        if (!media.object_path) return media;

        try {
          const bucketId = media.bucket_id || 'opc-site-inspection-media';
          const { data: signed, error: signedError } = await supabase.storage
            .from(bucketId)
            .createSignedUrl(media.object_path, 60 * 60);

          if (signedError) {
            console.warn('Vorschau konnte nicht signiert werden:', signedError.message);
            return media;
          }

          return { ...media, preview_url: signed?.signedUrl || null };
        } catch (previewError) {
          console.warn('Vorschau konnte nicht erstellt werden:', previewError);
          return media;
        }
      })
    );

    setMediaRows(rowsWithPreviews);
    return rowsWithPreviews;
  }

  async function loadExistingQuote(targetInspectionId: string) {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('opc_quotes')
      .select('id,status,created_at')
      .eq('inspection_id', targetInspectionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Bestehende Offerte konnte nicht geladen werden:', error.message);
      setExistingQuoteId(null);
      return null;
    }

    const quoteId = data?.id || null;
    setExistingQuoteId(quoteId);
    return quoteId;
  }

  async function redirectToQuote(quoteId: string) {
    const target = `${baseUrl}/offerte/${quoteId}`;
    window.location.assign(target);
  }

  function updateField<K extends keyof InspectionForm>(key: K, value: InspectionForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateInspectionMetadata(key: string, value: any) {
    setForm((previous) => ({
      ...previous,
      metadata: {
        ...(previous.metadata || {}),
        [key]: value,
      },
    }));
  }

  function chooseClientAddress() {
    setAddressSource('client');
    setSite(null);
    setForm((previous) => ({
      ...previous,
      client_site_id: null,
    }));
    setManualSiteAddress(clientAddressFromClient(client));
  }

  function chooseClientSite(siteId: string) {
    if (!siteId) {
      setAddressSource('site');
      setSite(null);
      setForm((previous) => ({
        ...previous,
        client_site_id: null,
      }));
      setManualSiteAddress(emptyManualSiteAddress);
      return;
    }

    const selectedSite =
      clientSites.find((row) => row.id === siteId) || null;

    setAddressSource('site');
    setSite(selectedSite);
    setForm((previous) => ({
      ...previous,
      client_site_id: selectedSite?.id || null,
    }));
    setManualSiteAddress(emptyManualSiteAddress);
  }

  function chooseStoredAddressMode() {
    if (clientSites.length === 1) {
      chooseClientSite(clientSites[0].id);
      return;
    }

    setAddressSource('site');
    setSite(null);
    setForm((previous) => ({
      ...previous,
      client_site_id: null,
    }));
    setManualSiteAddress(emptyManualSiteAddress);
  }

  function chooseManualAddress() {
    setAddressSource('manual');
    setSite(null);
    setForm((previous) => ({
      ...previous,
      client_site_id: null,
    }));
    setManualSiteAddress({
      ...emptyManualSiteAddress,
      site_name: `Weitere Adresse - ${getClientLabel(client)}`,
    });
  }

  function updateManualAddressField(
    key: keyof ManualSiteAddress,
    value: string
  ) {
    setAddressSource('manual');
    setSite(null);
    setForm((previous) => ({
      ...previous,
      client_site_id: null,
    }));
    setManualSiteAddress((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveAdditionalClientSite() {
    if (!supabase) {
      throw new Error('Supabase ist nicht verfügbar.');
    }

    if (!form.client_id) {
      throw new Error('Kunde fehlt.');
    }

    const nextAddress = {
      site_name:
        clean(manualSiteAddress.site_name) ||
        `Weitere Adresse - ${getClientLabel(client)}`,
      address_text: clean(manualSiteAddress.address_text),
      postal_code: clean(manualSiteAddress.postal_code),
      city: clean(manualSiteAddress.city),
      country: clean(manualSiteAddress.country) || 'Schweiz',
    };

    if (
      !nextAddress.address_text ||
      !nextAddress.postal_code ||
      !nextAddress.city
    ) {
      throw new Error(
        'Für die weitere Adresse müssen Strasse, PLZ und Ort vollständig sein.'
      );
    }

    const requestedKey = normalizeClientAddressKey(nextAddress);

    const existingSite = clientSites.find(
      (candidate) =>
        normalizeClientAddressKey(candidate) === requestedKey
    );

    if (existingSite) {
      chooseClientSite(existingSite.id);
      setSuccessMessage(
        'Die Adresse war bereits beim Kunden hinterlegt und wurde ausgewählt.'
      );
      return existingSite;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error(
        'Die Sitzung ist abgelaufen. Bitte neu anmelden.'
      );
    }

    const response = await fetch(
      `${baseUrl}/api/opc/client-sites`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          client_id: form.client_id,
          contact_id: form.contact_id || contact?.id || null,
          ...nextAddress,
        }),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success || !result?.site) {
      throw new Error(
        result?.error ||
          `Weitere Adresse konnte nicht gespeichert werden (${response.status}).`
      );
    }

    const savedSite = result.site as SiteRow;

    const nextSites = uniqueClientSites([
      ...clientSites,
      savedSite,
    ]).sort((a: SiteRow, b: SiteRow) => {
      const primaryDifference =
        Number(Boolean(b.is_primary)) -
        Number(Boolean(a.is_primary));

      if (primaryDifference !== 0) {
        return primaryDifference;
      }

      return getSiteLabel(a).localeCompare(
        getSiteLabel(b),
        'de'
      );
    });

    setClientSites(nextSites);
    setAddressSource('site');
    setSite(savedSite);
    setManualSiteAddress(emptyManualSiteAddress);
    setForm((previous) => ({
      ...previous,
      client_site_id: savedSite.id,
    }));

    setSuccessMessage(
      result.reused
        ? 'Die bestehende Kundenadresse wurde ausgewählt.'
        : 'Die weitere Adresse wurde im Kundenprofil gespeichert und ausgewählt.'
    );

    return savedSite;
  }

  async function confirmAddressSelection() {
    setSavingAddress(true);
    setErrorMessage('');

    try {
      if (addressSource === 'manual') {
        await saveAdditionalClientSite();
      } else if (addressSource === 'site' && !site) {
        throw new Error('Bitte Standort wählen.');
      } else if (
        addressSource === 'client' &&
        !hasManualAddress(manualSiteAddress)
      ) {
        throw new Error(
          'Die Kundenadresse ist nicht vollständig.'
        );
      }

      setShowAddressPopup(false);
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          'Besichtigungsadresse konnte nicht übernommen werden.'
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function saveInspection(nextStatus?: InspectionStatus) {
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');
      if (!form.client_id) throw new Error('Kunde fehlt.');

      const status = nextStatus || form.status;
      const correctedInspectionNumber = clean(form.inspection_number);

      if (
        addressSource === 'site' &&
        clientSites.length > 1 &&
        !site
      ) {
        throw new Error('Bitte Standort wählen.');
      }

      const inspectionAddress = site
        ? buildAddressSnapshot(site)
        : manualSiteAddress;

      if (form.inspection_type === 'onsite') {
        if (!clean(inspectionAddress.address_text) || !clean(inspectionAddress.postal_code) || !clean(inspectionAddress.city)) {
          throw new Error('Für eine Vor-Ort-Besichtigung müssen Strasse, PLZ und Ort der Besichtigungsadresse vollständig sein.');
        }
      }

      if (DOCUMENT_CORRECTION_MODE && form.id && correctedInspectionNumber) {
        const { data: duplicate, error: duplicateError } = await supabase
          .from('opc_site_inspections')
          .select('id, inspection_number')
          .eq('inspection_number', correctedInspectionNumber)
          .neq('id', form.id)
          .limit(1)
          .maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) throw new Error(`Die Besichtigungsnummer ${correctedInspectionNumber} wird bereits verwendet.`);
      }

      const payload = {
        ...(DOCUMENT_CORRECTION_MODE && correctedInspectionNumber ? { inspection_number: correctedInspectionNumber } : {}),
        inquiry_id: form.inquiry_id,
        client_id: form.client_id,
        contact_id: form.contact_id,
        client_site_id: form.client_site_id,
        status,
        inspection_type: form.inspection_type,
        requested_service_category: clean(form.requested_service_category) || null,
        property_type: clean(form.property_type) || null,
        property_size_m2: toNumberOrNull(form.property_size_m2),
        room_count: toNumberOrNull(form.room_count),
        bathroom_count: toIntOrNull(form.bathroom_count),
        floor_level: clean(form.floor_level) || null,
        has_elevator: form.has_elevator === '' ? null : form.has_elevator === 'true',
        address_snapshot: buildInspectionAddressSnapshot(site, manualSiteAddress, addressSource),
        contact_snapshot: buildContactSnapshot(contact),
        inquiry_snapshot: {},
        access_notes: clean(form.access_notes) || null,
        parking_notes: clean(form.parking_notes) || null,
        key_handover_notes: clean(form.key_handover_notes) || null,
        property_condition_notes: clean(form.property_condition_notes) || null,
        risk_notes: clean(form.risk_notes) || null,
        estimator_notes: clean(form.estimator_notes) || null,
        internal_notes: clean(form.internal_notes) || null,
        estimated_hours: toNumberOrNull(form.estimated_hours),
        estimated_staff_count: toIntOrNull(form.estimated_staff_count),
        scheduled_at: dateTimeLocalToIso(form.scheduled_at),
        completed_at: status === 'completed' && form.status !== 'completed' ? new Date().toISOString() : undefined,
        metadata: {
          ...(form.metadata || {}),
          source: isNew ? 'manual_from_client' : 'inspection_detail_page',
          manual_inspection_address: addressSource === 'manual' && !site && hasManualAddress(manualSiteAddress),
          inspection_address_source: addressSource,
        },
        updated_at: new Date().toISOString(),
      };

      let savedId = form.id;

      if (form.id) {
        const { error } = await supabase.from('opc_site_inspections').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('opc_site_inspections')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select('id, inspection_number')
          .single();

        if (error) throw error;
        savedId = data?.id;
        if (data?.inspection_number) {
          setForm((previous) => ({
            ...previous,
            inspection_number: data.inspection_number,
          }));
        }
      }

      if (!savedId) throw new Error('Besichtigung wurde gespeichert, aber keine ID wurde zurückgegeben.');

      setForm((previous) => ({
        ...previous,
        id: savedId,
        status,
        inspection_number:
          correctedInspectionNumber ||
          previous.inspection_number,
      }));
      setSuccessMessage('Besichtigung wurde gespeichert.');

      if (isNew) {
        window.history.replaceState({}, '', `${baseUrl}/besichtigung/${savedId}`);
      }

      return savedId;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Besichtigung konnte nicht gespeichert werden.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !form.id) return;

    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const files = Array.from(fileList);
      let uploadedCount = 0;
      const failedFiles: string[] = [];

      for (const [index, file] of files.entries()) {
        try {
          const extension = file.name.includes('.') ? file.name.split('.').pop() : 'file';
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          const objectPath = `${form.client_id}/${form.id}/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from('opc-site-inspection-media')
            .upload(objectPath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type || undefined,
            });

          if (uploadError) throw uploadError;

          const mediaType = file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'document' : 'image';

          const { error: insertError } = await supabase.from('opc_site_inspection_media').insert({
            inspection_id: form.id,
            client_id: form.client_id,
            client_site_id: form.client_site_id,
            bucket_id: 'opc-site-inspection-media',
            object_path: objectPath,
            media_type: mediaType,
            purpose: 'inspection',
            file_name: file.name,
            mime_type: file.type || null,
            file_size_bytes: file.size,
            sort_order: mediaRows.length + index,
            metadata: { original_extension: extension },
          });

          if (insertError) throw insertError;

          uploadedCount += 1;
        } catch (fileError: any) {
          failedFiles.push(`${file.name}: ${fileError?.message || 'Upload fehlgeschlagen'}`);
        }
      }

      await loadMedia(form.id);

      if (uploadedCount > 0) {
        setSuccessMessage(`${uploadedCount} von ${files.length} Medien wurden hochgeladen.`);
      }

      if (failedFiles.length > 0) {
        setErrorMessage(`Nicht alle Medien konnten hochgeladen werden. ${failedFiles.slice(0, 5).join(' | ')}`);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  }

  // OPC_INSPECTION_V3_HTML_GENERATOR_20260706
  // OPC_INSPECTION_FAST_VECTOR_PDF_20260706_V2
  async function generateInspectionPdf() {
    if (generatingPdf) return;

    const startedAt = performance.now();

    setGeneratingPdf(true);
    setPdfProgress(
      'Besichtigungsdaten werden vorbereitet...'
    );

    setErrorMessage('');
    setSuccessMessage('');

    try {
      const savedId = await saveInspection();

      if (!savedId) {
        return;
      }

      const freshMedia = await loadMedia(savedId);

      const mediaForPdf = Array.isArray(freshMedia)
        ? freshMedia
        : mediaRows;

      const imageMedia = mediaForPdf.filter(
        (media) =>
          media.media_type === 'image' &&
          media.preview_url
      );

      const { jsPDF } = await import('jspdf');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
        putOnlyUsedFonts: true,
        precision: 2,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      const bottomLimit = 280;

      const columnGap = 8;
      const columnWidth =
        (contentWidth - columnGap) / 2;

      const labelWidth = 31;

      let y = 18;

      const inspectionAddress: Record<string, any> =
        site
          ? buildInspectionAddressSnapshot(
              site,
              manualSiteAddress,
              addressSource
            )
          : buildInspectionAddressSnapshot(
              null,
              manualSiteAddress,
              addressSource
            );

      const inspectionNumber =
        clean(form.inspection_number) ||
        `Besichtigung-${savedId.slice(0, 8)}`;

      const clientLabel = getClientLabel(client);

      const downloadedAt =
        formatDateTimeForDocument(
          new Date().toISOString()
        );

      const scheduledAt =
        formatDateTimeForDocument(
          dateTimeLocalToIso(form.scheduled_at)
        );

      const cityLine = [
        clean(inspectionAddress.postal_code),
        clean(inspectionAddress.city),
      ]
        .filter(Boolean)
        .join(' ');

      const inspectionAddressText = [
        clean(inspectionAddress.address_text),
        cityLine,
        clean(inspectionAddress.country),
      ]
        .filter(Boolean)
        .join(', ');

      function wrappedLines(
        value: unknown,
        maxWidth: number,
        fontSize = 9
      ) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(fontSize);

        return pdf.splitTextToSize(
          clean(value),
          maxWidth
        ) as string[];
      }

      function drawContinuationHeader(
        title: string
      ) {
        pdf.setTextColor(17, 17, 17);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);

        pdf.text(
          'Orange Pro Clean GmbH',
          margin,
          17
        );

        pdf.setFontSize(9.5);

        pdf.text(
          title,
          pageWidth - margin,
          17,
          {
            align: 'right',
          }
        );

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.4);
        pdf.setTextColor(100, 100, 100);

        pdf.text(
          `${inspectionNumber} · ${clientLabel}`,
          pageWidth - margin,
          21.5,
          {
            align: 'right',
          }
        );

        pdf.text(
          `Download: ${downloadedAt}`,
          pageWidth - margin,
          25.5,
          {
            align: 'right',
          }
        );

        y = 35;
      }

      function addContentPage(
        title: string
      ) {
        pdf.addPage('a4', 'portrait');
        drawContinuationHeader(title);
      }

      function ensureSpace(
        requiredHeight: number,
        pageTitle =
          'Internes Besichtigungsprotokoll'
      ) {
        if (
          y + requiredHeight <= bottomLimit
        ) {
          return;
        }

        addContentPage(pageTitle);
      }

      function addSectionTitle(
        title: string
      ) {
        ensureSpace(11);

        pdf.setTextColor(17, 17, 17);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11.5);

        pdf.text(title, margin, y);

        y += 6.5;
      }

      function addTwoColumnRows(
        rows: Array<[string, unknown]>
      ) {
        const visibleRows = rows.filter(
          ([, value]) => clean(value)
        );

        for (
          let index = 0;
          index < visibleRows.length;
          index += 2
        ) {
          const pair = [
            visibleRows[index],
            visibleRows[index + 1],
          ].filter(Boolean) as Array<
            [string, unknown]
          >;

          const heights = pair.map(
            ([, value]) => {
              const lines = wrappedLines(
                value,
                columnWidth - labelWidth - 2,
                8.7
              );

              return Math.max(
                5.2,
                lines.length * 3.8
              );
            }
          );

          const rowHeight =
            Math.max(...heights, 5.2) + 1.5;

          ensureSpace(rowHeight);

          pair.forEach(
            ([label, value], pairIndex) => {
              const x =
                margin +
                pairIndex *
                  (columnWidth + columnGap);

              const lines = wrappedLines(
                value,
                columnWidth - labelWidth - 2,
                8.7
              );

              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(8.2);
              pdf.setTextColor(17, 17, 17);

              pdf.text(label, x, y);

              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(8.7);

              pdf.text(
                lines,
                x + labelWidth,
                y
              );
            }
          );

          y += rowHeight;
        }

        y += 3;
      }

      function addNote(
        title: string,
        value: string
      ) {
        const allLines = wrappedLines(
          value,
          contentWidth,
          9
        );

        let remainingLines = [...allLines];
        let firstPart = true;

        while (remainingLines.length > 0) {
          const availableHeight =
            bottomLimit - y;

          const titleHeight = firstPart ? 5.5 : 0;

          const maximumLines = Math.max(
            1,
            Math.floor(
              (availableHeight - titleHeight - 4) /
                4.05
            )
          );

          if (maximumLines < 2) {
            addContentPage(
              'Notizen & Feststellungen'
            );

            continue;
          }

          if (firstPart) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(17, 17, 17);

            pdf.text(title, margin, y);

            y += 5;
          }

          const currentLines =
            remainingLines.splice(0, maximumLines);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(17, 17, 17);

          pdf.text(
            currentLines,
            margin,
            y
          );

          y += currentLines.length * 4.05 + 5;

          firstPart = false;

          if (remainingLines.length > 0) {
            addContentPage(
              'Notizen & Feststellungen'
            );
          }
        }
      }

      /*
       * Seite 1
       */
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(17, 17, 17);

      pdf.text(
        'Internes Besichtigungsprotokoll',
        margin,
        22
      );

      pdf.setFontSize(8.5);
      pdf.setTextColor(95, 95, 95);

      pdf.text(
        'Internes Dokument',
        pageWidth - margin,
        22,
        {
          align: 'right',
        }
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.3);

      const introduction = wrappedLines(
        'Dieses Protokoll dokumentiert die Besichtigung und dient als interne Grundlage für Kalkulation, Offertenerstellung, Einsatzplanung, Qualitätssicherung und spätere Auftragsdokumente.',
        contentWidth,
        9.3
      );

      pdf.text(
        introduction,
        margin,
        31
      );

      y =
        31 +
        introduction.length * 4.1 +
        7;

      addSectionTitle('Besichtigung');

      addTwoColumnRows([
        [
          'Besichtigungs-Nr.',
          inspectionNumber,
        ],
        [
          'Termin',
          scheduledAt,
        ],
        [
          'Status',
          getInspectionStatusLabel(form.status),
        ],
        [
          'Leistung',
          form.requested_service_category,
        ],
        [
          'Besichtigungsart',
          form.inspection_type === 'onsite'
            ? 'Vor Ort'
            : form.inspection_type,
        ],
        [
          'PDF erstellt',
          downloadedAt,
        ],
      ]);

      addSectionTitle('Kunde und Objekt');

      addTwoColumnRows([
        [
          'Kunde',
          clientLabel,
        ],
        [
          'Kontaktperson',
          contact?.full_name || contact?.name,
        ],
        [
          'Standort',
          inspectionAddress.site_name,
        ],
        [
          'Besichtigungsadresse',
          inspectionAddressText,
        ],
        [
          'Objektart',
          [
            clean(form.room_count)
              ? `${clean(form.room_count)} Zimmer`
              : '',
            clean(form.property_type),
          ]
            .filter(Boolean)
            .join(' · '),
        ],
        [
          'Fläche',
          clean(form.property_size_m2)
            ? `${clean(form.property_size_m2)} m²`
            : '',
        ],
        [
          'Nasszellen',
          form.bathroom_count,
        ],
        [
          'Etage',
          form.floor_level,
        ],
        [
          'Lift',
          form.has_elevator === 'true'
            ? 'Vorhanden'
            : form.has_elevator === 'false'
              ? 'Nicht vorhanden'
              : '',
        ],
      ]);

      addSectionTitle(
        'Kalkulationsgrundlage'
      );

      addTwoColumnRows([
        [
          'Geschätzte Stunden',
          clean(form.estimated_hours)
            ? `${clean(form.estimated_hours)} Stunden`
            : '',
        ],
        [
          'Mitarbeiter',
          clean(form.estimated_staff_count)
            ? `${clean(form.estimated_staff_count)} Personen`
            : '',
        ],
        [
          'Bilddokumentation',
          `${imageMedia.length} Bilder`,
        ],
      ]);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.2);
      pdf.setTextColor(130, 130, 130);

      const confidentiality = wrappedLines(
        'Vertraulich - ausschliesslich für die interne Verwendung durch Orange Pro Clean GmbH. Die interne Richtlinie befindet sich auf der letzten Seite.',
        contentWidth,
        7.2
      );

      pdf.text(
        confidentiality,
        margin,
        Math.min(y + 3, 276)
      );

      /*
       * Notizen
       */
      addContentPage(
        'Internes Besichtigungsprotokoll'
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(17, 17, 17);

      pdf.text(
        'Notizen & Feststellungen',
        margin,
        y
      );

      y += 8;

      const notes = [
        [
          'Auftragsnotiz',
          clean(form.internal_notes),
        ],
        [
          'Objektzustand',
          clean(form.property_condition_notes),
        ],
        [
          'Zugang und Schlüssel',
          [
            clean(form.access_notes),
            clean(form.key_handover_notes),
          ]
            .filter(Boolean)
            .join('\n\n'),
        ],
        [
          'Parken',
          clean(form.parking_notes),
        ],
        [
          'Risiken / Besonderheiten',
          clean(form.risk_notes),
        ],
        [
          'Interne Empfehlung',
          clean(form.estimator_notes),
        ],
      ].filter(
        ([, value]) => clean(value)
      ) as Array<[string, string]>;

      if (notes.length === 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(95, 95, 95);

        pdf.text(
          'Keine zusätzlichen Notizen erfasst.',
          margin,
          y
        );
      } else {
        for (const [title, value] of notes) {
          addNote(title, value);
        }
      }

      /*
       * Bilder:
       * Vier Bilder werden gleichzeitig vorbereitet.
       * Zwei Bilder werden pro A4-Seite dargestellt.
       */
      const imageBatchSize = 4;
      const imageFailures: string[] = [];

      for (
        let batchStart = 0;
        batchStart < imageMedia.length;
        batchStart += imageBatchSize
      ) {
        const batch = imageMedia.slice(
          batchStart,
          batchStart + imageBatchSize
        );

        setPdfProgress(
          `Bilder ${batchStart + 1}-${Math.min(
            batchStart + batch.length,
            imageMedia.length
          )} von ${imageMedia.length}`
        );

        const preparedBatch = await Promise.all(
          batch.map(async (media) => {
            try {
              return await imageUrlToPdfData(
                media.preview_url
              );
            } catch (error: any) {
              imageFailures.push(
                error?.message ||
                  'Bild konnte nicht verarbeitet werden.'
              );

              return null;
            }
          })
        );

        for (
          let pairStart = 0;
          pairStart < preparedBatch.length;
          pairStart += 2
        ) {
          const pair = preparedBatch.slice(
            pairStart,
            pairStart + 2
          );

          pdf.addPage('a4', 'portrait');
          drawContinuationHeader(
            'Fotodokumentation'
          );

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(17, 17, 17);

          pdf.text(
            'Fotodokumentation',
            margin,
            36
          );

          const slotTop = 43;
          const slotWidth = contentWidth;
          const slotHeight = 106;
          const slotGap = 8;

          pair.forEach(
            (preparedImage, slotIndex) => {
              if (!preparedImage) {
                return;
              }

              const scale = Math.min(
                slotWidth / preparedImage.width,
                slotHeight / preparedImage.height
              );

              const drawWidth =
                preparedImage.width * scale;

              const drawHeight =
                preparedImage.height * scale;

              const x =
                margin +
                (slotWidth - drawWidth) / 2;

              const slotY =
                slotTop +
                slotIndex *
                  (slotHeight + slotGap);

              const imageY =
                slotY +
                (slotHeight - drawHeight) / 2;

              /*
               * CONTAIN:
               * kein Zuschneiden,
               * kein Strecken,
               * keine Dateinamen,
               * keine Links.
               */
              pdf.addImage(
                preparedImage.dataUrl,
                'JPEG',
                x,
                imageY,
                drawWidth,
                drawHeight,
                undefined,
                'FAST'
              );
            }
          );
        }

        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            resolve();
          });
        });
      }

      /*
       * Interne Richtlinie
       */
      pdf.addPage('a4', 'portrait');
      drawContinuationHeader(
        'Interne Richtlinie'
      );

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(17, 17, 17);

      pdf.text(
        'Vertraulichkeit und Umgang mit Kundendaten',
        margin,
        y
      );

      y += 8;

      const policyIntro = wrappedLines(
        'Die folgenden Bestimmungen gelten für dieses Besichtigungsprotokoll, alle darin enthaltenen Kundendaten und Notizen sowie sämtliche Bilddateien.',
        contentWidth,
        8.6
      );

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.6);
      pdf.setTextColor(95, 95, 95);

      pdf.text(
        policyIntro,
        margin,
        y
      );

      y += policyIntro.length * 3.8 + 6;

      const policies: Array<
        [string, string]
      > = [
        [
          '1. Vertraulichkeit und Zweck',
          'Dieses Besichtigungsprotokoll ist ein internes Arbeitsdokument der Orange Pro Clean GmbH. Es darf ausschliesslich zur internen Beurteilung, Kalkulation, Offertenerstellung, Einsatzplanung, Qualitätssicherung und Auftragsabwicklung verwendet werden.',
        ],
        [
          '2. Kundendaten und Bildmaterial',
          'Kundendaten, Objektangaben, Notizen und Bilder sind vertraulich zu behandeln. Sie dürfen nur von Mitarbeitenden eingesehen werden, die diese Informationen für ihre konkrete Aufgabe benötigen.',
        ],
        [
          '3. Keine externe Weitergabe',
          'Das Dokument und seine Inhalte dürfen nicht an externe Personen, andere Kunden, private Kontakte oder nicht freigegebene Dienstleister versendet, weitergeleitet, veröffentlicht oder anderweitig zugänglich gemacht werden.',
        ],
        [
          '4. Zulässige Systeme und Geräte',
          'Die Verarbeitung und Speicherung darf nur in den von Orange Pro Clean GmbH freigegebenen Systemen, Konten und Geräten erfolgen. Das Speichern auf privaten Geräten, privaten Cloud-Diensten oder privaten Messenger-Konten ist untersagt.',
        ],
        [
          '5. Sorgfalt und Zugriffsschutz',
          'Zugangsdaten dürfen nicht geteilt werden. Dokumente und Bilder sind vor unbefugtem Zugriff zu schützen. Geräte müssen gesperrt werden, sobald sie unbeaufsichtigt sind.',
        ],
        [
          '6. Meldung von Vorfällen',
          'Fehlversand, Verlust, unberechtigter Zugriff oder eine mögliche Verletzung der Vertraulichkeit ist unverzüglich der Geschäftsleitung zu melden.',
        ],
        [
          '7. Folgen bei Verstössen',
          'Verstösse gegen diese interne Richtlinie können je nach Schwere arbeitsrechtliche Massnahmen sowie zivil- oder strafrechtliche Folgen nach sich ziehen.',
        ],
      ];

      for (const [title, body] of policies) {
        const bodyLines = wrappedLines(
          body,
          contentWidth,
          8.2
        );

        const requiredHeight =
          5 +
          bodyLines.length * 3.5 +
          4;

        ensureSpace(
          requiredHeight,
          'Interne Richtlinie'
        );

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.1);
        pdf.setTextColor(17, 17, 17);

        pdf.text(title, margin, y);

        y += 4.2;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.2);

        pdf.text(
          bodyLines,
          margin,
          y
        );

        y += bodyLines.length * 3.5 + 4;
      }

      /*
       * Seitenzahlen
       */
      const totalPages = pdf.getNumberOfPages();

      for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber += 1
      ) {
        pdf.setPage(pageNumber);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.2);
        pdf.setTextColor(140, 140, 140);

        pdf.text(
          `Seite ${pageNumber} von ${totalPages}`,
          pageWidth - margin,
          pageHeight - 8,
          {
            align: 'right',
          }
        );
      }

      pdf.setProperties({
        title:
          `Internes Besichtigungsprotokoll ${inspectionNumber}`,
        subject:
          'Interne Besichtigungsdokumentation',
        author:
          'Orange Pro Clean GmbH',
        creator:
          'Orange Pro Clean Portal',
      });

      const customFileName = clean(
        form.metadata?.document_filename
      );

      const generatedFileName =
        `${inspectionNumber}_` +
        `Besichtigungsprotokoll_` +
        `${clientLabel}.pdf`;

      const safeName =
        safeDocumentFileName(
          customFileName || generatedFileName
        ) ||
        'Besichtigungsprotokoll.pdf';

      const finalFileName =
        safeName.toLowerCase().endsWith('.pdf')
          ? safeName
          : `${safeName}.pdf`;

      setPdfProgress(
        'PDF-Datei wird gespeichert...'
      );

      /*
       * Blob statt Base64 reduziert den zusätzlichen
       * Speicherbedarf im Browser.
       */
      const pdfBlob = pdf.output('blob');

      const downloadUrl =
        URL.createObjectURL(pdfBlob);

      const anchor =
        document.createElement('a');

      anchor.href = downloadUrl;
      anchor.download = finalFileName;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1500);

      const elapsedSeconds = Math.max(
        1,
        Math.round(
          (performance.now() - startedAt) / 1000
        )
      );

      const sizeMb =
        pdfBlob.size / (1024 * 1024);

      const failureNotice =
        imageFailures.length > 0
          ? ` ${imageFailures.length} Bild(er) konnten nicht eingebettet werden.`
          : '';

      setSuccessMessage(
        `Besichtigungs-PDF erstellt: ${sizeMb.toFixed(
          1
        )} MB in ${elapsedSeconds} Sekunden.${failureNotice}`
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          'Besichtigungs-PDF konnte nicht erstellt werden.'
      );
    } finally {
      setPdfProgress('');
      setGeneratingPdf(false);
    }
  }

  async function createQuoteFromInspection() {
    if (!form.id) return;

    setCreatingQuote(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');

      const foundQuoteId = existingQuoteId || await loadExistingQuote(form.id);
      if (foundQuoteId) {
        await redirectToQuote(foundQuoteId);
        return;
      }

      const title = form.requested_service_category
        ? `Offerte ${form.requested_service_category}`
        : 'Offerte Reinigungsdienstleistung';

      const scopeText = [
        form.requested_service_category ? `Leistung: ${form.requested_service_category}` : '',
        form.property_type ? `Objektart: ${form.property_type}` : '',
        form.property_size_m2 ? `Fläche: ${form.property_size_m2} m²` : '',
        form.room_count ? `Zimmer: ${form.room_count}` : '',
        form.bathroom_count ? `Nasszellen: ${form.bathroom_count}` : '',
        form.property_condition_notes ? `Zustand: ${form.property_condition_notes}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const { data: quote, error: quoteError } = await supabase
        .from('opc_quotes')
        .insert({
          inquiry_id: form.inquiry_id,
          inspection_id: form.id,
          client_id: form.client_id,
          contact_id: form.contact_id,
          client_site_id: form.client_site_id,
          status: 'draft',
          quote_type: 'standard',
          title,
          language: 'de',
          client_snapshot: buildClientSnapshot(client),
          site_snapshot: buildInspectionAddressSnapshot(site, manualSiteAddress, addressSource),
          inspection_snapshot: {
            inspection_id: form.id,
            service_category: form.requested_service_category,
            property_type: form.property_type,
            property_size_m2: form.property_size_m2,
            room_count: form.room_count,
            bathroom_count: form.bathroom_count,
            estimated_hours: form.estimated_hours,
            estimated_staff_count: form.estimated_staff_count,
          },
          intro_text: 'Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen unsere Offerte.',
          scope_text: scopeText,
          service_description_mode: 'embedded',
          service_description_text: '',
          terms_text: 'Die Offerte ist freibleibend bis zur schriftlichen Bestätigung. Termine werden gemeinsam vereinbart.',
          payment_terms: 'Zahlbar gemäss Vereinbarung.',
          estimated_hours: toNumberOrNull(form.estimated_hours),
          estimated_staff_count: toIntOrNull(form.estimated_staff_count),
          metadata: {
            created_from: 'site_inspection',
            inspection_id: form.id,
          },
        })
        .select('id')
        .single();

      if (quoteError) throw quoteError;
      if (!quote?.id) throw new Error('Offerte wurde erstellt, aber keine ID wurde zurückgegeben.');

      await supabase.from('opc_quote_items').insert({
        quote_id: quote.id,
        sort_order: 1,
        item_type: 'service',
        title: form.requested_service_category || 'Reinigungsdienstleistung',
        description: scopeText || null,
        quantity: 1,
        unit: 'pauschal',
        unit_price_chf: 0,
        subtotal_chf: 0,
        tax_chf: 0,
        total_chf: 0,
      });

      await supabase.from('opc_quote_events').insert({
        quote_id: quote.id,
        client_id: form.client_id,
        event_type: 'created',
        message: 'Offerte aus Besichtigung erstellt.',
        new_status: 'draft',
        metadata: { inspection_id: form.id },
      });

      await supabase
        .from('opc_site_inspections')
        .update({ status: 'converted_to_quote', updated_at: new Date().toISOString() })
        .eq('id', form.id);

      setExistingQuoteId(quote.id);
      setForm((previous) => ({ ...previous, status: 'converted_to_quote' }));
      await redirectToQuote(quote.id);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Offerte konnte nicht erstellt werden.');
    } finally {
      setCreatingQuote(false);
    }
  }

  const mediaPreviewRows = mediaRows;
  const hasInspectionAddress =
    Boolean(site) || hasManualAddress(manualSiteAddress);
  const requiresSiteSelection =
    addressSource === 'site' &&
    clientSites.length > 1 &&
    !site;
  const currentSiteLabel = site
    ? getSiteLabel(site)
    : requiresSiteSelection
      ? 'Bitte Standort wählen'
      : hasManualAddress(manualSiteAddress)
        ? formatManualAddress(manualSiteAddress)
        : 'Keine Adresse hinterlegt';
  const currentAddressSourceLabel = addressSource === 'client'
    ? 'Kundenadresse'
    : addressSource === 'site'
      ? 'Kundenstandort'
      : 'Weitere Adresse';
  const addressActionLabel = requiresSiteSelection
    ? 'Bitte Standort wählen'
    : hasInspectionAddress
      ? 'Andere Adresse wählen'
      : 'Adresse erfassen';

  if (loading) {
    return (
      <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath="/besichtigungen" fullWidth hideTopBar>
        <OPCPageShell><div style={emptyStyle}>Besichtigung wird geladen.</div></OPCPageShell>
      </MirakaDashboardShell>
    );
  }

  return (
    <MirakaDashboardShell requiredRole={['owner', 'admin', 'dispatch']} currentPath={isNew ? '/besichtigung/neu' : `/besichtigung/${inspectionId}`} fullWidth hideTopBar>
      <OPCPageShell>
        <div style={topBarStyle} className="opc-mobile-topbar">
          <a href={`${baseUrl}/besichtigungen`} className="opc-mobile-back opc-top-pill" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
            <ArrowLeft size={16} />
            Zurück
          </a>

          <button type="button" disabled={saving} onClick={() => saveInspection()} className="opc-top-pill" style={{ ...opcBlackButtonStyle, width: 'auto' }}>
            <Save size={16} />
            {saving ? 'Speichert...' : 'Speichern'}
          </button>

          <button type="button" disabled={generatingPdf || saving} onClick={generateInspectionPdf} className="opc-top-pill" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
            <FileDown size={16} />
            {generatingPdf ? (pdfProgress || 'PDF wird erstellt...') : 'Besichtigungs-PDF'}
          </button>

          {canOpenOrCreateQuote && (
            <button type="button" disabled={creatingQuote} onClick={createQuoteFromInspection} className="opc-top-pill" style={{ ...opcSecondaryButtonStyle, width: 'auto' }}>
              <FileText size={16} />
              {creatingQuote ? 'Öffnet...' : existingQuoteId || form.status === 'converted_to_quote' ? 'Offerte öffnen' : 'Zur Offerte übergeben'}
            </button>
          )}
        </div>

        <section style={heroStyle} className="opc-mobile-hero">
          <span style={statusBadgeStyle} className="opc-inspection-status-top">{getInspectionStatusLabel(form.status)}</span>
          <div style={{ minWidth: 0 }}>
            <p style={eyebrowStyle}>Besichtigung</p>
            <h1 style={titleStyle} className="opc-mobile-title">{isNew ? 'Neue Besichtigung' : 'Besichtigung bearbeiten'}</h1>
            <p style={subtitleStyle}>{getClientLabel(client)} · {currentAddressSourceLabel}: {currentSiteLabel}</p>
            <button type="button" className="opc-address-trigger" onClick={() => setShowAddressPopup(true)}>
              <MapPin size={15} />
              {addressActionLabel}
            </button>
          </div>
        </section>

        {showAddressPopup && (
          <div className="opc-address-popup" role="dialog" aria-label="Besichtigungsadresse wählen">
            <div className="opc-address-popup-head">
              <div>
                <strong>Besichtigungsadresse wählen</strong>
                <span>Standardmässig wird die Kundenadresse verwendet. Alternativ kann ein Kundenstandort oder eine andere Adresse gewählt werden.</span>
              </div>
              <button type="button" onClick={() => setShowAddressPopup(false)} aria-label="Schliessen">
                <X size={16} />
              </button>
            </div>

            <div className="opc-address-source-options">
              {clientSites.length > 0 && (
                <button
                  type="button"
                  className={addressSource === 'site' ? 'active' : ''}
                  onClick={chooseStoredAddressMode}
                >
                  <strong>
                    {clientSites.length === 1
                      ? 'Gespeicherte Adresse'
                      : 'Gespeicherte Standorte'}
                  </strong>
                  <span>
                    {clientSites.length === 1
                      ? getSiteLabel(clientSites[0])
                      : `${clientSites.length} Adressen verfügbar`}
                  </span>
                </button>
              )}

              {clientSites.length === 0 &&
                hasManualAddress(clientAddressFromClient(client)) && (
                  <button
                    type="button"
                    className={addressSource === 'client' ? 'active' : ''}
                    onClick={chooseClientAddress}
                  >
                    <strong>Kundenadresse</strong>
                    <span>
                      {formatManualAddress(
                        clientAddressFromClient(client)
                      )}
                    </span>
                  </button>
                )}

              <button
                type="button"
                className={addressSource === 'manual' ? 'active' : ''}
                onClick={chooseManualAddress}
              >
                <strong>Neue weitere Adresse erfassen</strong>
                <span>
                  Wird dauerhaft im Kundenprofil unter weiteren
                  Adressen gespeichert
                </span>
              </button>
            </div>

            {addressSource === 'site' &&
              clientSites.length > 0 && (
                <div className="opc-address-popup-grid one">
                  <Field label="Gespeicherte Adresse wählen">
                    <select
                      value={form.client_site_id || ''}
                      onChange={(event) =>
                        chooseClientSite(event.target.value)
                      }
                      style={opcSelectStyle}
                    >
                      <option value="">
                        {clientSites.length > 1
                          ? 'Bitte Standort wählen'
                          : 'Adresse wählen'}
                      </option>
                      {clientSites.map((row) => (
                        <option key={row.id} value={row.id}>
                          {getSiteLabel(row)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

            {addressSource === 'client' && (
              <div className="opc-address-readonly">
                <strong>Verwendete Kundenadresse</strong>
                <span>
                  {formatManualAddress(manualSiteAddress) ||
                    'Die Kundenadresse ist noch nicht vollständig.'}
                </span>
              </div>
            )}

            {addressSource === 'manual' && (
              <div className="opc-address-popup-grid">
                <Field label="Standortname">
                  <input
                    value={manualSiteAddress.site_name}
                    onChange={(event) =>
                      updateManualAddressField(
                        'site_name',
                        event.target.value
                      )
                    }
                    style={inputStyle}
                    placeholder="z.B. Ferienwohnung, Filiale oder Baustelle"
                  />
                </Field>

                <Field label="Adresse">
                  <input
                    value={manualSiteAddress.address_text}
                    onChange={(event) =>
                      updateManualAddressField(
                        'address_text',
                        event.target.value
                      )
                    }
                    style={inputStyle}
                    placeholder="Strasse und Nummer"
                  />
                </Field>

                <Field label="PLZ">
                  <input
                    value={manualSiteAddress.postal_code}
                    onChange={(event) =>
                      updateManualAddressField(
                        'postal_code',
                        event.target.value
                      )
                    }
                    style={inputStyle}
                    placeholder="PLZ"
                  />
                </Field>

                <Field label="Ort">
                  <input
                    value={manualSiteAddress.city}
                    onChange={(event) =>
                      updateManualAddressField(
                        'city',
                        event.target.value
                      )
                    }
                    style={inputStyle}
                    placeholder="Ort"
                  />
                </Field>

                <Field label="Land">
                  <input
                    value={manualSiteAddress.country}
                    onChange={(event) =>
                      updateManualAddressField(
                        'country',
                        event.target.value
                      )
                    }
                    style={inputStyle}
                    placeholder="Schweiz"
                  />
                </Field>
              </div>
            )}

            <div className="opc-address-popup-actions">
              <button type="button" style={{ ...opcSecondaryButtonStyle, width: 'auto' }} onClick={() => setShowAddressPopup(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                disabled={savingAddress}
                style={{
                  ...opcBlackButtonStyle,
                  width: 'auto',
                  opacity: savingAddress ? 0.6 : 1,
                }}
                onClick={() => void confirmAddressSelection()}
              >
                {savingAddress
                  ? 'Adresse wird gespeichert...'
                  : 'Übernehmen'}
              </button>
            </div>
          </div>
        )}

        {successMessage && <div style={successStyle}><Check size={16} />{successMessage}</div>}
        {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

        {DOCUMENT_CORRECTION_MODE && !isNew && (
          <section style={{ marginBottom: 22 }}>
            <OPCListCard>
              <CardHeader title="Temporärer Dokument-Korrekturmodus" />
              <p style={{ margin: '0 0 16px', color: OPC_BRAND.muted, fontSize: 13 }}>
                Hier können bestehende Besichtigungsnummern und die vorgesehenen Dokumentangaben geordnet werden.
              </p>
              <div className="opc-inspection-row three">
                <Field label="Besichtigungsnummer"><input value={form.inspection_number} onChange={(e) => updateField('inspection_number', e.target.value)} style={inputStyle} /></Field>
                <Field label="Dokumenttitel"><input value={form.metadata?.document_title || ''} onChange={(e) => updateInspectionMetadata('document_title', e.target.value)} style={inputStyle} placeholder="Besichtigungsprotokoll" /></Field>
                <Field label="PDF-Dateiname"><input value={form.metadata?.document_filename || ''} onChange={(e) => updateInspectionMetadata('document_filename', e.target.value)} style={inputStyle} placeholder={`${form.inspection_number || 'BE-00000'}_Besichtigung.pdf`} /></Field>
              </div>
            </OPCListCard>
          </section>
        )}

        <div style={gridStyle} className="opc-inspection-grid">
          <OPCListCard>
            <CardHeader title="Objekt & Leistung" />
            <div className="opc-inspection-field-stack">
              <div className="opc-inspection-row two">
                <Field label="Leistung / Kategorie">
                  <input value={form.requested_service_category} onChange={(e) => updateField('requested_service_category', e.target.value)} style={inputStyle} placeholder="z.B. Endreinigung, Unterhaltsreinigung" />
                </Field>
                <Field label="Objektart">
                  <input value={form.property_type} onChange={(e) => updateField('property_type', e.target.value)} style={inputStyle} placeholder="Wohnung, Büro, Haus, Gewerbe" />
                </Field>
              </div>

              <div className="opc-inspection-row three">
                <Field label="Fläche m²">
                  <input value={form.property_size_m2} onChange={(e) => updateField('property_size_m2', e.target.value)} style={inputStyle} inputMode="decimal" />
                </Field>
                <Field label="Zimmer">
                  <input value={form.room_count} onChange={(e) => updateField('room_count', e.target.value)} style={inputStyle} inputMode="decimal" />
                </Field>
                <Field label="Nasszellen">
                  <input value={form.bathroom_count} onChange={(e) => updateField('bathroom_count', e.target.value)} style={inputStyle} inputMode="numeric" />
                </Field>
              </div>

              <div className="opc-inspection-row three">
                <Field label="Etage">
                  <input value={form.floor_level} onChange={(e) => updateField('floor_level', e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Lift vorhanden">
                  <select value={form.has_elevator} onChange={(e) => updateField('has_elevator', e.target.value)} style={opcSelectStyle}>
                    <option value="">Unbekannt</option>
                    <option value="true">Ja</option>
                    <option value="false">Nein</option>
                  </select>
                </Field>
                <Field label="Besichtigungstermin">
                  <input type="datetime-local" value={form.scheduled_at} onChange={(e) => updateField('scheduled_at', e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </div>
          </OPCListCard>

          <OPCListCard>
            <CardHeader title="Kalkulationshilfe" />
            <div className="opc-inspection-field-stack">
              <div className="opc-inspection-row two">
                <Field label="Geschätzte Stunden">
                  <input value={form.estimated_hours} onChange={(e) => updateField('estimated_hours', e.target.value)} style={inputStyle} inputMode="decimal" />
                </Field>
                <Field label="Geschätzte Mitarbeiter">
                  <input value={form.estimated_staff_count} onChange={(e) => updateField('estimated_staff_count', e.target.value)} style={inputStyle} inputMode="numeric" />
                </Field>
              </div>

              <div className="opc-inspection-row two">
                <Field label="Status">
                  <select value={form.status} onChange={(e) => updateField('status', e.target.value as InspectionStatus)} style={opcSelectStyle}>
                    <option value="draft">Entwurf</option>
                    <option value="scheduled">Geplant</option>
                    <option value="in_progress">In Arbeit</option>
                    <option value="completed">Abgeschlossen</option>
                    <option value="converted_to_quote">In Offerte übergeben</option>
                    <option value="cancelled">Storniert</option>
                  </select>
                </Field>
                <Field label="Besichtigungsart">
                  <select value={form.inspection_type} onChange={(e) => updateField('inspection_type', e.target.value)} style={opcSelectStyle}>
                    <option value="onsite">Vor Ort</option>
                    <option value="phone">Telefon</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-Mail</option>
                    <option value="internal">Intern</option>
                  </select>
                </Field>
              </div>
            </div>
          </OPCListCard>
        </div>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <CardHeader title="Besichtigungsnotizen" />
            <div className="opc-notes-compact-body">
              <TextArea label="Auftragsnotiz" value={form.estimator_notes} onChange={(value) => updateField('estimator_notes', value)} wide />

              <button type="button" className="opc-notes-toggle" onClick={() => setShowMoreNotes((current) => !current)}>
                <ChevronDown size={16} className={showMoreNotes ? 'open' : ''} />
                {showMoreNotes ? 'Weniger Notizen' : 'Weitere Notizen'}
              </button>

              {showMoreNotes && (
                <div className="opc-inspection-notes-more">
                  <TextArea label="Zugang" value={form.access_notes} onChange={(value) => updateField('access_notes', value)} />
                  <TextArea label="Parken" value={form.parking_notes} onChange={(value) => updateField('parking_notes', value)} />
                  <TextArea label="Schlüssel / Zutritt" value={form.key_handover_notes} onChange={(value) => updateField('key_handover_notes', value)} />
                  <TextArea label="Objektzustand" value={form.property_condition_notes} onChange={(value) => updateField('property_condition_notes', value)} />
                  <TextArea label="Risiken / Besonderheiten" value={form.risk_notes} onChange={(value) => updateField('risk_notes', value)} />
                  <TextArea label="Interne Notizen" value={form.internal_notes} onChange={(value) => updateField('internal_notes', value)} />
                </div>
              )}
            </div>
          </OPCListCard>
        </section>

        <section style={{ marginTop: 22 }}>
          <OPCListCard>
            <div style={mediaHeaderStyle} className="opc-inspection-media-header">
              <CardHeader title="Bilder & Dateien" compact />
              <label style={{ ...opcBlackButtonStyle, width: 'auto', cursor: canUpload ? 'pointer' : 'not-allowed', opacity: canUpload ? 1 : 0.55 }}>
                <UploadCloud size={16} />
                {uploading ? 'Upload läuft...' : 'Medien hochladen'}
                <input type="file" multiple accept="image/*,video/*,application/pdf" disabled={!canUpload || uploading} onChange={(event) => uploadFiles(event.target.files)} style={{ display: 'none' }} />
              </label>
            </div>

            {!canUpload ? (
              <div style={emptyStyle}>Speichere die Besichtigung zuerst, danach können Bilder und Videos hochgeladen werden.</div>
            ) : mediaPreviewRows.length === 0 ? (
              <div style={emptyStyle}>Noch keine Medien hochgeladen.</div>
            ) : (
              <div style={mediaGridStyle} className="opc-inspection-media-grid">
                {mediaPreviewRows.map((media) => (
                  <div key={media.id} style={mediaCardStyle}>
                    <a href={media.preview_url || '#'} target="_blank" rel="noreferrer" style={mediaLinkStyle}>
                      <div style={mediaThumbStyle}>
                        {media.media_type === 'image' && media.preview_url ? (
                          <img src={media.preview_url} alt={media.file_name || 'Besichtigungsbild'} style={mediaImageStyle} loading="lazy" />
                        ) : media.media_type === 'video' && media.preview_url ? (
                          <video src={media.preview_url} style={mediaImageStyle} muted playsInline preload="metadata" />
                        ) : media.media_type === 'document' ? (
                          <FileText size={22} />
                        ) : media.media_type === 'image' ? (
                          <ImageIcon size={22} />
                        ) : (
                          <Camera size={22} />
                        )}
                      </div>
                      <div style={mediaNameStyle}>{media.file_name || media.object_path}</div>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </OPCListCard>
        </section>

        <style>{`
          ${opcResponsiveStyle}

          .opc-mobile-topbar {
            justify-content: flex-start !important;
            align-items: center !important;
            gap: 10px !important;
            flex-wrap: wrap !important;
            margin-bottom: 16px !important;
          }

          .opc-top-pill {
            min-height: 42px !important;
            padding: 0 16px !important;
            border-radius: 16px !important;
          }

          .opc-mobile-hero {
            position: relative !important;
            padding-right: 130px !important;
            align-items: flex-start !important;
          }

          .opc-inspection-status-top {
            position: absolute !important;
            top: 18px !important;
            right: 18px !important;
          }

          .opc-address-trigger {
            margin-top: 14px;
            min-height: 38px;
            border-radius: 999px;
            border: 1px solid ${OPC_BRAND.border};
            background: #FFFFFF;
            color: ${OPC_BRAND.text};
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 0 14px;
            font-family: ${OPC_PAGE_FONT};
            font-size: 13px;
            font-weight: 760;
            cursor: pointer;
          }

          .opc-address-popup {
            margin: -6px 0 22px;
            padding: 16px;
            background: #FFFFFF;
            border: 1px solid ${OPC_BRAND.border};
            border-radius: 18px;
            box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
          }

          .opc-address-popup-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 14px;
            margin-bottom: 14px;
          }

          .opc-address-popup-head strong,
          .opc-address-popup-head span {
            display: block;
          }

          .opc-address-popup-head strong {
            color: ${OPC_BRAND.text};
            font-size: 15px;
            font-weight: 820;
            letter-spacing: -0.02em;
          }

          .opc-address-popup-head span {
            margin-top: 4px;
            color: ${OPC_BRAND.muted};
            font-size: 12px;
            font-weight: 650;
          }

          .opc-address-popup-head button {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            border: 1px solid ${OPC_BRAND.border};
            background: #FFFFFF;
            color: ${OPC_BRAND.text};
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .opc-address-source-options {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .opc-address-source-options button {
            min-height: 78px;
            padding: 12px;
            border-radius: 14px;
            border: 1px solid ${OPC_BRAND.border};
            background: #FFFFFF;
            color: ${OPC_BRAND.text};
            text-align: left;
            font-family: ${OPC_PAGE_FONT};
            cursor: pointer;
          }

          .opc-address-source-options button.active {
            border-color: #111827;
            box-shadow: 0 0 0 1px #111827 inset;
            background: #F9FAFB;
          }

          .opc-address-source-options button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .opc-address-source-options strong,
          .opc-address-source-options span {
            display: block;
          }

          .opc-address-source-options strong {
            font-size: 13px;
            font-weight: 800;
          }

          .opc-address-source-options span {
            margin-top: 5px;
            color: ${OPC_BRAND.muted};
            font-size: 11px;
            line-height: 1.35;
            font-weight: 620;
          }

          .opc-address-readonly {
            padding: 14px;
            border: 1px solid ${OPC_BRAND.border};
            border-radius: 14px;
            background: #F9FAFB;
          }

          .opc-address-readonly strong,
          .opc-address-readonly span {
            display: block;
          }

          .opc-address-readonly strong {
            color: ${OPC_BRAND.text};
            font-size: 12px;
            font-weight: 800;
          }

          .opc-address-readonly span {
            margin-top: 5px;
            color: ${OPC_BRAND.muted};
            font-size: 12px;
            line-height: 1.45;
            font-weight: 620;
          }

          .opc-address-popup-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .opc-address-popup-grid.one {
            grid-template-columns: 1fr;
          }

          .opc-address-popup-grid select {
            height: 46px;
            border-radius: 14px;
          }

          .opc-address-popup-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 14px;
            flex-wrap: wrap;
          }

          .opc-inspection-field-stack {
            padding: 18px 20px 20px;
            display: grid;
            gap: 14px;
          }

          .opc-inspection-row {
            display: grid;
            gap: 12px;
            align-items: start;
          }

          .opc-inspection-row.two {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .opc-inspection-row.three {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .opc-inspection-row input,
          .opc-inspection-row select,
          .opc-address-popup input {
            height: 46px !important;
            min-height: 46px !important;
            border-radius: 14px !important;
            font-size: 14px !important;
            font-weight: 650 !important;
          }

          .opc-notes-compact-body {
            padding: 18px 20px 20px;
          }

          .opc-notes-toggle {
            margin: 10px auto 0;
            min-height: 34px;
            border: 0;
            background: transparent;
            color: ${OPC_BRAND.muted};
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            font-family: ${OPC_PAGE_FONT};
            font-size: 13px;
            font-weight: 760;
            cursor: pointer;
          }

          .opc-notes-toggle svg {
            transition: transform 0.18s ease;
          }

          .opc-notes-toggle svg.open {
            transform: rotate(180deg);
          }

          .opc-inspection-notes-more {
            margin-top: 14px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }
          @media (max-width: 980px) {
            .opc-inspection-grid { grid-template-columns: 1fr !important; }
          }

          @media (max-width: 760px) {
            .opc-mobile-topbar { justify-content: flex-start !important; align-items: center !important; gap: 10px !important; }
            .opc-mobile-back { width: auto !important; }
            .opc-mobile-hero { padding: 18px 120px 18px 18px !important; border-radius: 18px !important; }
            .opc-mobile-title { font-size: 32px !important; line-height: 0.98 !important; overflow-wrap: anywhere !important; }
            .opc-inspection-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
            .opc-inspection-field-stack { padding: 16px !important; gap: 12px !important; }
            .opc-inspection-row.two { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
            .opc-inspection-row.three { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
            .opc-inspection-row input, .opc-inspection-row select { font-size: 12px !important; padding-left: 8px !important; padding-right: 8px !important; }
            .opc-address-source-options { grid-template-columns: 1fr !important; }
            .opc-address-popup-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
            .opc-address-popup-grid.one { grid-template-columns: 1fr !important; }
            .opc-inspection-notes-more { grid-template-columns: 1fr !important; gap: 12px !important; }
            .opc-inspection-media-header { flex-direction: column !important; align-items: stretch !important; padding: 16px !important; }
            .opc-inspection-media-header label { width: 100% !important; }
            .opc-inspection-media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; padding: 16px !important; gap: 10px !important; }
          }

          @media (max-width: 430px) {
            .opc-inspection-row.three { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .opc-inspection-row.three input, .opc-inspection-row.three select { font-size: 11px !important; }
            .opc-mobile-hero { padding-right: 96px !important; }
            .opc-inspection-status-top { right: 14px !important; top: 14px !important; }
          }
        `}</style>
      </OPCPageShell>
    </MirakaDashboardShell>
  );
}

function CardHeader({ title, compact = false }: { title: string; compact?: boolean }) {
  return <div style={{ ...cardHeaderStyle, borderBottom: compact ? 'none' : `1px solid ${OPC_BRAND.border}` }}><h2 style={cardTitleStyle}>{title}</h2></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span style={labelStyle}>{label}</span>{children}</label>;
}

function TextArea({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <span style={labelStyle}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} style={textareaStyle} />
    </label>
  );
}

const topBarStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 };
const actionRowStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' };
const heroStyle: CSSProperties = { background: '#FFFFFF', border: `1px solid ${OPC_BRAND.border}`, borderRadius: 20, padding: 22, marginBottom: 22, display: 'flex', justifyContent: 'space-between', gap: 16 };
const eyebrowStyle: CSSProperties = { margin: '0 0 8px', color: OPC_BRAND.faint, fontSize: 12, fontWeight: 780, textTransform: 'uppercase', letterSpacing: '0.08em' };
const titleStyle: CSSProperties = { margin: 0, fontSize: 34, fontWeight: 880, letterSpacing: '-0.05em', color: OPC_BRAND.text };
const subtitleStyle: CSSProperties = { margin: '10px 0 0', color: OPC_BRAND.muted, fontSize: 14, fontWeight: 620 };
const statusBadgeStyle: CSSProperties = { height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${OPC_BRAND.border}`, background: '#F9FAFB', display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 760 };
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1.35fr 0.9fr', gap: 22 };
const fieldGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const notesGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 760, color: OPC_BRAND.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 };
const inputStyle: CSSProperties = { ...opcInputStyle, height: 46 };
const textareaStyle: CSSProperties = { ...opcInputStyle, minHeight: 108, height: 'auto', resize: 'vertical', paddingTop: 12, lineHeight: 1.45 };
const cardHeaderStyle: CSSProperties = { padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const cardTitleStyle: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 820, color: OPC_BRAND.text };
const successStyle: CSSProperties = { marginBottom: 22, padding: 14, borderRadius: 14, border: '1px solid #BBF7D0', background: '#F0FDF4', color: OPC_BRAND.green, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 };
const errorStyle: CSSProperties = { marginBottom: 22, padding: 14, borderRadius: 14, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', fontSize: 14, fontWeight: 700 };
const emptyStyle: CSSProperties = { padding: 28, textAlign: 'center', color: OPC_BRAND.muted, fontWeight: 680 };
const mediaHeaderStyle: CSSProperties = { padding: '0 20px', minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottom: `1px solid ${OPC_BRAND.border}` };
const mediaGridStyle: CSSProperties = { padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 };
const mediaCardStyle: CSSProperties = { border: `1px solid ${OPC_BRAND.border}`, borderRadius: 14, padding: 12, background: '#FAFAFA' };
const mediaThumbStyle: CSSProperties = { height: 82, borderRadius: 12, background: '#FFFFFF', border: `1px solid ${OPC_BRAND.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: OPC_BRAND.muted, marginBottom: 10 };
const mediaLinkStyle: CSSProperties = { display: 'block', color: 'inherit', textDecoration: 'none' };
const mediaImageStyle: CSSProperties = { width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: 12 };
const mediaNameStyle: CSSProperties = { fontSize: 12, fontWeight: 680, color: OPC_BRAND.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
