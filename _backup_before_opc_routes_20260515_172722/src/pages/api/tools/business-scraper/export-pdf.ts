import type { APIRoute } from 'astro';

// Helper to escape HTML
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate table HTML from business data
function generateTableHTML(businesses: any[]): string {
  if (!businesses || businesses.length === 0) {
    return '<p style="text-align: center; padding: 20px; color: #999;">No business data available</p>';
  }

  let tableHTML = `
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Business Name</th>
          <th style="width: 15%;">Category</th>
          <th style="width: 8%;">Rating</th>
          <th style="width: 17%;">Phone</th>
          <th style="width: 25%;">Address</th>
          <th style="width: 15%;">Website</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const business of businesses) {
    const name = escapeHtml(business.name || 'N/A');
    const category = escapeHtml(business.category || business.types?.[0] || 'N/A');
    const rating = business.rating ? `${business.rating} ⭐ (${business.userRatingsTotal || 0})` : 'N/A';
    const phone = escapeHtml(business.phone || business.formattedPhoneNumber || 'N/A');
    const address = escapeHtml(business.address || business.formattedAddress || 'N/A');
    const website = business.website 
      ? `<a href="${escapeHtml(business.website)}" style="color: #0066cc; text-decoration: none;">${escapeHtml(business.website.length > 30 ? business.website.substring(0, 30) + '...' : business.website)}</a>`
      : 'N/A';

    tableHTML += `
      <tr>
        <td><strong>${name}</strong></td>
        <td>${category}</td>
        <td style="font-size: 10px;">${rating}</td>
        <td style="font-size: 10px;">${phone}</td>
        <td style="font-size: 9px;">${address}</td>
        <td style="font-size: 9px;">${website}</td>
      </tr>
    `;
  }

  tableHTML += `
      </tbody>
    </table>
  `;

  return tableHTML;
}

// The fixed HTML template (inline for Cloudflare Workers compatibility)
const getTemplate = (): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Business Data Export – Miraka & Co</title>

  <style>
    @page {
      margin: 25mm 20mm 30mm 20mm;
    }

    body {
      font-family: Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #111;
      line-height: 1.5;
      padding-bottom: 45mm; /* prevents footer overlap */
    }

    header {
      width: 100%;
      text-align: center;
      margin-bottom: 25px;
    }

    header img {
      width: 4cm;
      max-width: 4cm;
      height: auto;
      margin-bottom: 10px;
    }

    header h1 {
      font-size: 14px;
      font-weight: normal;
      margin: 0;
      letter-spacing: 0.5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    th {
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1px solid #000;
      padding: 6px 4px;
    }

    td {
      border-bottom: 1px solid #e5e5e5;
      padding: 6px 4px;
      vertical-align: top;
    }

    footer {
      position: fixed;
      bottom: 15mm;
      left: 20mm;
      right: 20mm;
      font-size: 8.5px;
      color: #666;
      line-height: 1.4;
    }

    .footer-block {
      margin-top: 6px;
    }

    .footer-title {
      font-weight: bold;
      color: #333;
      margin-bottom: 2px;
    }
  </style>
</head>

<body>

  <!-- HEADER -->
  <header>
    <img
      src="https://cdn.prod.website-files.com/68dc2b9c31cb83ac9f84a1af/691b3e4165fe511df8128a71_white%20LOGO%20MIRAKA%20%26%20CO%20PLAIN%20TEXT.png"
      alt="Miraka & Co"
    />
    <h1>Business Data Overview</h1>
  </header>

  <!-- DYNAMIC TABLE INJECTION -->
  {{TABLE_CONTENT}}

  <!-- FOOTER -->
  <footer>

    <div class="footer-block">
      <div class="footer-title">Company Information</div>
      Miraka & Co GmbH<br />
      Elsabethenstrasse 41, CH-4051 Basel, Switzerland<br />
      www.miraka.ch · office@miraka.ch
    </div>

    <div class="footer-block">
      <div class="footer-title">Data Source & Information Disclaimer</div>
      This document contains business-related information retrieved from publicly available sources, including Google services, at the time of generation. Miraka & Co GmbH does not guarantee the accuracy, completeness, timeliness, or continued availability of the data provided.
    </div>

    <div class="footer-block">
      <div class="footer-title">Non-Solicitation & Usage Restriction Clause</div>
      The information contained in this document is provided strictly for informational and analytical purposes only. The data must not be used for unsolicited communication, advertising, direct marketing, cold outreach, or any form of solicitation. Any use of the data must comply fully with applicable data protection laws, including but not limited to the EU General Data Protection Regulation (GDPR / DSGVO) and the Swiss Federal Act on Data Protection (nFADP).
    </div>

    <div class="footer-block">
      <div class="footer-title">Data Protection & GDPR / DSGVO Compliance</div>
      This document does not constitute a database, lead list, or marketing dataset. No personal data is intentionally collected, stored, or processed by Miraka & Co GmbH. Any personal data that may incidentally appear originates from third-party public sources and remains the sole responsibility of the data recipient to handle lawfully, transparently, and in accordance with GDPR, DSGVO, and Swiss data protection regulations.
    </div>

    <div class="footer-block">
      <div class="footer-title">Limitation of Liability</div>
      Miraka & Co GmbH shall not be held liable for any direct, indirect, incidental, consequential, or special damages arising out of or in connection with the use, misuse, interpretation, or reliance on the information contained in this document. Use of this document is entirely at the recipient's own risk.
    </div>

    <div class="footer-block">
      © {{YEAR}} Miraka & Co GmbH · Generated on {{DATE}}
    </div>

  </footer>

</body>
</html>`;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as { businesses?: any[] };
    const { businesses } = body;

    if (!businesses || !Array.isArray(businesses)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: businesses array required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the template (inline for Cloudflare Workers)
    const templateHTML = getTemplate();

    // Generate table content
    const tableContent = generateTableHTML(businesses);

    // Replace placeholders
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
    const yearStr = now.getFullYear().toString();

    let finalHTML = templateHTML
      .replace('{{TABLE_CONTENT}}', tableContent)
      .replace('{{DATE}}', dateStr)
      .replace('{{YEAR}}', yearStr);

    // Return the HTML for client-side PDF generation
    return new Response(
      JSON.stringify({ 
        success: true, 
        html: finalHTML,
        filename: `Miraka-Co-Business-Data-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.pdf`
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

