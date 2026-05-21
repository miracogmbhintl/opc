import type { APIRoute } from 'astro';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { requireAuth } from '../../../../lib/supabase-server';
import { logLeadExport, logLeadActivity } from '../../../../lib/supabase-leads';

interface Business {
  place_id: string;
  business_name: string;
  industry: string;
  rating: number | null;
  review_count: number | null;
  phone: string | null;
  international_phone: string | null;
  address: string;
  formatted_address: string;
  website: string | null;
  lat: number;
  lng: number;
  business_status: string | null;
  opening_hours: {
    open_now: boolean | null;
    weekday_text: string[];
  } | null;
  price_level: number | null;
  types: string[];
  url: string | null;
  vicinity: string | null;
  reviews: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
  }>;
  plus_code: {
    global_code: string;
    compound_code: string;
  } | null;
  utc_offset_minutes: number | null;
  wheelchair_accessible_entrance: boolean | null;
  editorial_summary: string | null;
}

function generateCSV(businesses: Business[]): string {
  const headers = [
    'Business Name',
    'Industry',
    'Rating',
    'Review Count',
    'Phone',
    'International Phone',
    'Address',
    'Formatted Address',
    'Website',
    'Google Maps URL',
    'Business Status',
    'Open Now',
    'Price Level',
    'Types',
    'Latitude',
    'Longitude',
    'Plus Code',
    'Wheelchair Accessible',
    'Total Reviews',
    'Latest Review Rating',
    'Latest Review Text',
    'Latest Review Author',
    'Opening Hours',
    'Editorial Summary'
  ];

  const rows = businesses.map((b) => [
    b.business_name,
    b.industry,
    b.rating?.toFixed(1) || 'N/A',
    b.review_count?.toString() || '0',
    b.phone || 'N/A',
    b.international_phone || 'N/A',
    b.address,
    b.formatted_address || b.address,
    b.website || 'N/A',
    b.url || 'N/A',
    b.business_status || 'N/A',
    b.opening_hours?.open_now !== null
      ? b.opening_hours?.open_now
        ? 'Yes'
        : 'No'
      : 'N/A',
    b.price_level !== null ? '$'.repeat(b.price_level) : 'N/A',
    b.types.join('; '),
    b.lat.toString(),
    b.lng.toString(),
    b.plus_code?.global_code || 'N/A',
    b.wheelchair_accessible_entrance ? 'Yes' : 'No',
    b.reviews?.length.toString() || '0',
    b.reviews?.[0]?.rating?.toString() || 'N/A',
    b.reviews?.[0]?.text?.substring(0, 200) || 'N/A',
    b.reviews?.[0]?.author_name || 'N/A',
    b.opening_hours?.weekday_text.join('; ') || 'N/A',
    b.editorial_summary || 'N/A'
  ]);

  return [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
}

function generateMirakaPDF(businesses: Business[]): ArrayBuffer {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const accentColor = [26, 26, 26];
  const greyColor = [107, 107, 107];

  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MIRAKA & CO', pageWidth / 2, 12, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprehensive Business Intelligence Report', pageWidth / 2, 20, {
    align: 'center'
  });

  doc.setFontSize(9);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);

  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  doc.text(`Generated: ${generatedAt}`, 15, 38);
  doc.text(`Total Businesses: ${businesses.length}`, pageWidth / 2, 38, {
    align: 'center'
  });
  doc.text(`Data Source: Google Places API`, pageWidth - 15, 38, {
    align: 'right'
  });

  const tableData = businesses.map((b, index) => [
    String(index + 1),
    b.business_name,
    b.industry,
    b.rating ? `${b.rating.toFixed(1)}⭐ (${b.review_count || 0})` : 'N/A',
    b.phone || 'N/A',
    b.international_phone || b.phone || 'N/A',
    b.website ? 'Yes' : 'No',
    b.formatted_address || b.address,
    b.opening_hours?.open_now !== null
      ? b.opening_hours?.open_now
        ? 'Open'
        : 'Closed'
      : 'N/A',
    b.price_level !== null ? '$'.repeat(b.price_level) : 'N/A',
    b.business_status || 'N/A',
    String(b.reviews?.length || 0),
    b.wheelchair_accessible_entrance ? 'Yes' : 'No'
  ]);

  autoTable(doc, {
    startY: 45,
    head: [[
      '#',
      'Business Name',
      'Category',
      'Rating',
      'Phone',
      "Int'l Phone",
      'Website',
      'Address',
      'Status',
      'Price',
      'Operating',
      'Reviews',
      'Accessible'
    ]],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 6,
      textColor: accentColor,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 20 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 45 },
      8: { cellWidth: 15, halign: 'center' },
      9: { cellWidth: 12, halign: 'center' },
      10: { cellWidth: 18, halign: 'center' },
      11: { cellWidth: 15, halign: 'center' },
      12: { cellWidth: 18, halign: 'center' }
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      const footerY = pageHeight - 10;

      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(0.3);
      doc.line(10, footerY - 4, pageWidth - 10, footerY - 4);

      doc.setFontSize(7);
      doc.setTextColor(greyColor[0], greyColor[1], greyColor[2]);
      doc.setFont('helvetica', 'normal');
      doc.text('Miraka & Co | Comprehensive Business Intelligence Solutions', 10, footerY);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 10, footerY, {
        align: 'right'
      });
    }
  });

  return doc.output('arraybuffer');
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const runtimeEnv = locals?.runtime?.env as Record<string, string> | undefined;
    const user = await requireAuth(cookies, runtimeEnv);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Nicht authentifiziert' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json() as {
      businesses: Business[];
      format: 'csv' | 'xlsx' | 'pdf';
      sourceId?: string | null;
    };

    if (!Array.isArray(body.businesses)) {
      return new Response(JSON.stringify({ error: 'Invalid businesses payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (body.format === 'xlsx') {
      return new Response(
        JSON.stringify({ error: 'XLSX export is not implemented server-side yet. Use CSV or PDF.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let content: string | ArrayBuffer;
    let contentType: string;
    let extension: 'csv' | 'pdf';

    if (body.format === 'csv') {
      content = generateCSV(body.businesses);
      contentType = 'text/csv; charset=utf-8';
      extension = 'csv';
    } else {
      content = generateMirakaPDF(body.businesses);
      contentType = 'application/pdf';
      extension = 'pdf';
    }

    const fileSizeBytes =
      typeof content === 'string'
        ? new TextEncoder().encode(content).byteLength
        : content.byteLength;

    const fileSizeMb = Number((fileSizeBytes / (1024 * 1024)).toFixed(2));

    await logLeadExport({
      runtimeEnv,
      generatedBy: user.id,
      organizationId: null,
      sourceId: body.sourceId ?? null,
      exportType: extension,
      exportScope: 'current_results',
      rowCount: body.businesses.length,
      fileSizeMb,
      filePath: null
    });

    await logLeadActivity({
      runtimeEnv,
      actorUserId: user.id,
      organizationId: null,
      sourceId: body.sourceId ?? null,
      actorRole: null,
      action: 'scraper_export_generated',
      details: {
        format: extension,
        rowCount: body.businesses.length,
        fileSizeMb
      }
    });

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="miraka-co-leads-${Date.now()}.${extension}"`
      }
    });
  } catch (error: any) {
    console.error('[export.ts] fatal error', error);

    return new Response(
      JSON.stringify({
        error: error?.message || 'Export failed'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};






