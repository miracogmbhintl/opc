/**
 * Invoice HTML Preview Component
 * Purpose: Print-friendly HTML preview matching PDF layout exactly
 * Layout: A4 page with Swiss invoice formatting
 * Non-destructive: Extends existing invoice system
 */

import './invoice-preview.css';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InvoiceData {
  invoice_number: string;
  issue_date: string;
  greeting: string;
  intro_text: string;
  items: InvoiceItem[];
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  is_vat_exempt: boolean;
  // Optional fields for client/project info
  client_name?: string;
  client_company?: string;
  client_address?: string;
  project_title?: string;
}

interface InvoiceHTMLPreviewProps {
  invoice: InvoiceData;
}

/**
 * Formats Swiss CHF currency
 * Uses ' as thousands separator (Swiss standard)
 */
function formatSwissCurrency(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/**
 * Formats Swiss date (DD.MM.YYYY)
 */
function formatSwissDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function InvoiceHTMLPreview({ invoice }: InvoiceHTMLPreviewProps) {
  const clientName = invoice.client_company || invoice.client_name || 'Kunde';
  
  return (
    <div className="invoice-a4 invoice-preview-print">
      {/* HEADER - Centered, 4cm width, Termina Extra Bold */}
      <div className="header">
        <div className="logo">MIRAKA & CO.</div>
      </div>

      {/* ADDRESSES - Two columns */}
      <div className="address-row">
        {/* Client Address (Left) */}
        <div className="address-block">
          <div className="address-name">{clientName}</div>
          {invoice.client_address && (
            <>
              {invoice.client_address.split('\n').map((line, idx) => (
                <div key={idx} className="address-line">{line}</div>
              ))}
            </>
          )}
        </div>

        {/* Miraka Address (Right) */}
        <div className="address-block">
          <div className="address-line">Miraka & Co. GmbH</div>
          <div className="address-line">Mühlegasse 22</div>
          <div className="address-line">CH-4410 Liestal</div>
        </div>
      </div>

      {/* META - Date and Invoice Number */}
      <div className="meta-section">
        <div className="meta-text">
          Liestal, {formatSwissDate(invoice.issue_date)}
        </div>
        <div className="meta-text">
          Re. Nr. {invoice.invoice_number}
        </div>
      </div>

      {/* TITLE - Project Name if available */}
      {invoice.project_title && (
        <h1 className="title">
          Rechnung zum Projekt<br />
          "{invoice.project_title}"
        </h1>
      )}

      {/* GREETING */}
      {invoice.greeting && (
        <div className="greeting">{invoice.greeting}</div>
      )}

      {/* INTRO TEXT */}
      {invoice.intro_text && (
        <div className="intro">{invoice.intro_text}</div>
      )}

      {/* TABLE */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th className="col-pos">Pos.</th>
            <th className="col-desc">Beschreibung</th>
            <th className="col-qty">Menge</th>
            <th className="col-price">Preis CHF</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={item.id}>
              <td className="col-pos">{idx + 1}</td>
              <td className="col-desc">{item.description}</td>
              <td className="col-qty">{item.quantity}</td>
              <td className="col-price">{formatSwissCurrency(item.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALS SECTION */}
      <div className="totals-section">
        {/* Subtotal */}
        <div className="subtotal-row">
          <span className="subtotal-label">Zwischensumme:</span>
          <span className="subtotal-amount">CHF {formatSwissCurrency(invoice.subtotal)}</span>
        </div>

        {/* VAT */}
        {!invoice.is_vat_exempt && invoice.vat_amount > 0 && (
          <div className="vat-row">
            <span className="vat-label">MWST ({invoice.vat_rate}%):</span>
            <span className="vat-amount">CHF {formatSwissCurrency(invoice.vat_amount)}</span>
          </div>
        )}

        {/* Total */}
        <div className="total-row">
          <span className="total-label">
            Fälliger Betrag {invoice.is_vat_exempt ? '' : 'inkl. MWST'}:
          </span>
          <span className="total-amount">CHF {formatSwissCurrency(invoice.total_amount)}</span>
        </div>
      </div>

      {/* FOOTER - 4-column grid layout */}
      <div className="footer">
        <div className="footer-row">
          {/* Column 1: Address */}
          <div className="footer-col footer-col-1">
            <div className="footer-text">Miraka & Co. GmbH</div>
            <div className="footer-text">Mühlegasse 22</div>
            <div className="footer-text">CH-4410 Liestal</div>
          </div>

          {/* Column 2: Contact */}
          <div className="footer-col footer-col-2">
            <div className="footer-text">+41 61 626 17 37</div>
            <div className="footer-text">office@miraka.ch</div>
            <div className="footer-text">www.miraka.ch</div>
          </div>

          {/* Column 3: Bank Details */}
          <div className="footer-col footer-col-3">
            <div className="footer-text">
              <span className="footer-bold">Bank:</span> Basellandschaftliche Kantonalbank
            </div>
            <div className="footer-text">
              <span className="footer-bold">Konto Inhaber:</span> Miraka & Co. GmbH
            </div>
            <div className="footer-text">
              <span className="footer-bold">BIC:</span> BLKBCH22
            </div>
            <div className="footer-text">
              <span className="footer-bold">IBAN:</span> CH92 0076 9439 5935 0200 2
            </div>
          </div>

          {/* Column 4: Registration */}
          <div className="footer-col footer-col-4">
            <div className="footer-text">UID CHE-178.081.806</div>
            <div className="footer-text">CH-ID CH-280-4028408-9</div>
          </div>
        </div>
      </div>
    </div>
  );
}
