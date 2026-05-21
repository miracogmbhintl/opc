/**
 * React-PDF Invoice Component
 * Generates downloadable PDF invoices with Swiss formatting
 * Layout: A4 page with precise typography and spacing
 * Non-destructive: Extends existing invoice system
 */

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./InvoicePDF.styles";
import "./InvoiceFonts";

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

interface InvoicePDFProps {
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

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const clientName = invoice.client_company || invoice.client_name || 'Kunde';
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER - Centered, 4cm width, Termina Extra Bold */}
        <View style={styles.header}>
          <Text style={styles.logo}>MIRAKA & CO.</Text>
        </View>

        {/* ADDRESSES - Two columns */}
        <View style={styles.addressRow}>
          {/* Client Address (Left) */}
          <View style={styles.addressBlock}>
            <Text style={styles.addressName}>{clientName}</Text>
            {invoice.client_address && (
              <>
                {invoice.client_address.split('\n').map((line, idx) => (
                  <Text key={idx} style={styles.addressLine}>{line}</Text>
                ))}
              </>
            )}
          </View>

          {/* Miraka Address (Right) */}
          <View style={styles.addressBlock}>
            <Text style={styles.addressLine}>Miraka & Co. GmbH</Text>
            <Text style={styles.addressLine}>Mühlegasse 22</Text>
            <Text style={styles.addressLine}>CH-4410 Liestal</Text>
          </View>
        </View>

        {/* META - Date and Invoice Number */}
        <View style={styles.metaSection}>
          <Text style={styles.metaText}>
            Liestal, {formatSwissDate(invoice.issue_date)}
          </Text>
          <Text style={styles.metaText}>
            Re. Nr. {invoice.invoice_number}
          </Text>
        </View>

        {/* TITLE - Project Name if available */}
        {invoice.project_title && (
          <Text style={styles.title}>
            Rechnung zum Projekt{"\n"}
            "{invoice.project_title}"
          </Text>
        )}

        {/* GREETING */}
        {invoice.greeting && (
          <Text style={styles.greeting}>{invoice.greeting}</Text>
        )}

        {/* INTRO TEXT */}
        {invoice.intro_text && (
          <Text style={styles.intro}>{invoice.intro_text}</Text>
        )}

        {/* TABLE HEADER */}
        <View style={styles.tableHeader}>
          <Text style={styles.colPos}>Pos.</Text>
          <Text style={styles.colDesc}>Beschreibung</Text>
          <Text style={styles.colQty}>Menge</Text>
          <Text style={styles.colPrice}>Preis CHF</Text>
        </View>

        {/* TABLE ROWS */}
        {invoice.items.map((item, idx) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.colPos}>{idx + 1}</Text>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>
              {formatSwissCurrency(item.unit_price)}
            </Text>
          </View>
        ))}

        {/* SUBTOTAL */}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Zwischensumme:</Text>
          <Text style={styles.subtotalAmount}>
            CHF {formatSwissCurrency(invoice.subtotal)}
          </Text>
        </View>

        {/* VAT */}
        {!invoice.is_vat_exempt && invoice.vat_amount > 0 && (
          <View style={styles.vatRow}>
            <Text style={styles.vatLabel}>
              MWST ({invoice.vat_rate}%):
            </Text>
            <Text style={styles.vatAmount}>
              CHF {formatSwissCurrency(invoice.vat_amount)}
            </Text>
          </View>
        )}

        {/* TOTAL */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Fälliger Betrag {invoice.is_vat_exempt ? '' : 'inkl. MWST'}:
          </Text>
          <Text style={styles.totalAmount}>
            CHF {formatSwissCurrency(invoice.total_amount)}
          </Text>
        </View>

        {/* FOOTER - 4-column grid layout */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            {/* Column 1: Address */}
            <View style={styles.footerCol1}>
              <Text style={styles.footerText}>Miraka & Co. GmbH</Text>
              <Text style={styles.footerText}>Mühlegasse 22</Text>
              <Text style={styles.footerText}>CH-4410 Liestal</Text>
            </View>

            {/* Column 2: Contact */}
            <View style={styles.footerCol2}>
              <Text style={styles.footerText}>+41 61 626 17 37</Text>
              <Text style={styles.footerText}>office@miraka.ch</Text>
              <Text style={styles.footerText}>www.miraka.ch</Text>
            </View>

            {/* Column 3: Bank Details */}
            <View style={styles.footerCol3}>
              <Text style={styles.footerText}>
                <Text style={styles.footerBold}>Bank:</Text> Basellandschaftliche Kantonalbank
              </Text>
              <Text style={styles.footerText}>
                <Text style={styles.footerBold}>Konto Inhaber:</Text> Miraka & Co. GmbH
              </Text>
              <Text style={styles.footerText}>
                <Text style={styles.footerBold}>BIC:</Text> BLKBCH22
              </Text>
              <Text style={styles.footerText}>
                <Text style={styles.footerBold}>IBAN:</Text> CH92 0076 9439 5935 0200 2
              </Text>
            </View>

            {/* Column 4: Registration */}
            <View style={styles.footerCol4}>
              <Text style={styles.footerText}>UID CHE-178.081.806</Text>
              <Text style={styles.footerText}>CH-ID CH-280-4028408-9</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
