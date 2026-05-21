
/**
 * Invoice Preview Modal Component
 * Purpose: Display invoice preview with PDF download option
 * Non-destructive: New component, does not modify existing files
 */

import { X, Download, Printer } from 'lucide-react';
import { InvoiceHTMLPreview } from './invoice/preview/InvoiceHTMLPreview';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './invoice/pdf/InvoicePDF';

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
}

interface InvoicePreviewModalProps {
  invoice: InvoiceData;
  onClose: () => void;
}

export default function InvoicePreviewModal({ invoice, onClose }: InvoicePreviewModalProps) {
  const handleDownloadPDF = async () => {
    try {
      const blob = await pdf(<InvoicePDF invoice={invoice} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Rechnung_${invoice.invoice_number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Fehler beim Generieren der PDF-Datei.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F2F2F2',
          borderRadius: '22px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 32px',
            borderBottom: '1px solid #E5E5E5',
            background: '#FFFFFF',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1A1A1A',
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Rechnungsvorschau
          </h2>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                background: '#FFFFFF',
                border: '1px solid #E5E5E5',
                color: '#1A1A1A',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <Printer size={16} />
              Drucken
            </button>

            <button
              onClick={handleDownloadPDF}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                background: '#1A1A1A',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <Download size={16} />
              PDF Download
            </button>

            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'transparent',
                border: '1px solid #E5E5E5',
                color: '#1A1A1A',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview Content - Scrollable */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '40px',
            background: '#F2F2F2',
          }}
        >
          <div
            style={{
              maxWidth: '210mm',
              margin: '0 auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            <InvoiceHTMLPreview invoice={invoice} />
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body > *:not(.invoice-preview-print) {
            display: none !important;
          }

          .invoice-preview-print {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
          }
        }
      `}</style>
    </div>
  );
}



