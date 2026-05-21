




/**
 * Invoice Creator Component
 * Purpose: Create invoices for clients with Swiss formatting
 * Route: /miraka-co-portal/clients/invoice
 * Non-destructive: Does not modify existing components
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { baseUrl } from '../lib/base-url';
import { Plus, Trash2, Save, FileText, X, ChevronLeft } from 'lucide-react';
import InvoicePreviewModal from './InvoicePreviewModal';

interface Client {
  id: string;
  company_name: string;
  client_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
}

interface Project {
  id: string;
  project_title: string;
  client_id: string;
  status?: string;
  category?: string;
  progress_percent?: number;
  deadline?: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

const DEFAULT_INTRO_TEXT = 'Vielen Dank für Ihr Vertrauen. Wir erlauben uns, Ihnen folgende Positionen in Rechnung zu stellen:';
const SWISS_VAT_RATE = 8.10;

export default function InvoiceCreator() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  
  const [greeting, setGreeting] = useState<string>('');
  const [introText, setIntroText] = useState<string>(DEFAULT_INTRO_TEXT);
  
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, line_total: 0 }
  ]);
  
  const [isVatExempt, setIsVatExempt] = useState<boolean>(false);
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // ==========================================
  // LOAD DATA
  // ==========================================
  
  useEffect(() => {
    loadClients();
    loadProjects();
    generateInvoiceNumber();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      const filtered = projects.filter(p => p.client_id === selectedClientId);
      setFilteredProjects(filtered);
      setSelectedProjectId(''); // Reset project selection
      updateGreeting(selectedClientId);
    } else {
      setFilteredProjects([]);
      setGreeting('');
    }
  }, [selectedClientId, projects]);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, client_name, contact_person, email, phone, address, status')
      .order('company_name');
    
    if (!error && data) {
      setClients(data);
    }
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, project_title, client_id, status, category, progress_percent, deadline')
      .order('project_title');
    
    if (!error && data) {
      setProjects(data);
    }
  };

  const generateInvoiceNumber = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_invoice_number', {
        for_date: issueDate
      });
      
      if (!error && data) {
        setInvoiceNumber(data);
      } else {
        // Fallback: client-side generation
        const date = new Date(issueDate);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        
        // Get count of invoices in this month
        const { count } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .ilike('invoice_number', `__${month}${year}`);
        
        const sequence = String((count || 0) + 1).padStart(2, '0');
        setInvoiceNumber(`${sequence}${month}${year}`);
      }
    } catch (err) {
      console.error('Error generating invoice number:', err);
    }
  };

  const updateGreeting = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    // Use contact_person name if available, otherwise use generic greeting
    if (client.contact_person && client.contact_person.trim()) {
      // If contact person starts with "Herr" or "Frau", use it directly
      const name = client.contact_person.trim();
      if (name.toLowerCase().startsWith('herr ')) {
        setGreeting(`Sehr geehrter ${name}`);
      } else if (name.toLowerCase().startsWith('frau ')) {
        setGreeting(`Sehr geehrte ${name}`);
      } else {
        // Generic greeting with name
        setGreeting(`Sehr geehrte Damen und Herren`);
      }
    } else {
      // Default business greeting
      setGreeting('Sehr geehrte Damen und Herren');
    }
  };

  // ==========================================
  // INVOICE ITEMS MANAGEMENT
  // ==========================================
  
  const addItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, line_total: 0 }
    ]);
  };

  const removeItem = (id: string) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceItems(invoiceItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Auto-calculate line total
        if (field === 'quantity' || field === 'unit_price') {
          updated.line_total = Number(updated.quantity) * Number(updated.unit_price);
        }
        
        return updated;
      }
      return item;
    }));
  };

  // ==========================================
  // CALCULATIONS
  // ==========================================
  
  const calculateSubtotal = (): number => {
    return invoiceItems.reduce((sum, item) => sum + item.line_total, 0);
  };

  const calculateVat = (): number => {
    if (isVatExempt) return 0;
    return calculateSubtotal() * (SWISS_VAT_RATE / 100);
  };

  const calculateTotal = (): number => {
    return calculateSubtotal() + calculateVat();
  };

  // ==========================================
  // SAVE INVOICE
  // ==========================================
  
  const saveInvoice = async () => {
    // Validation
    if (!selectedClientId) {
      setSaveMessage('Bitte wählen Sie einen Kunden aus.');
      return;
    }

    if (invoiceItems.some(item => !item.description || item.quantity <= 0 || item.unit_price < 0)) {
      setSaveMessage('Bitte füllen Sie alle Rechnungspositionen korrekt aus.');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: selectedClientId,
          project_id: selectedProjectId || null,
          issue_date: issueDate,
          greeting: greeting,
          intro_text: introText,
          subtotal: calculateSubtotal(),
          is_vat_exempt: isVatExempt,
          vat_rate: SWISS_VAT_RATE,
          vat_amount: calculateVat(),
          total_amount: calculateTotal(),
          status: 'draft',
          created_by: user?.id || null
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice items
      const itemsToInsert = invoiceItems.map((item, index) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        sort_order: index
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setSaveMessage('✓ Rechnung erfolgreich gespeichert!');
      
      // Redirect after success
      setTimeout(() => {
        window.location.href = `${baseUrl}/miraka-co-portal/clients`;
      }, 1500);

    } catch (error) {
      console.error('Error saving invoice:', error);
      setSaveMessage('Fehler beim Speichern der Rechnung.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Möchten Sie wirklich abbrechen? Alle ungespeicherten Änderungen gehen verloren.')) {
      window.location.href = `${baseUrl}/miraka-co-portal/clients`;
    }
  };

  const handleShowPreview = () => {
    // Validation
    if (!selectedClientId) {
      setSaveMessage('Bitte wählen Sie einen Kunden aus.');
      return;
    }

    if (invoiceItems.some(item => !item.description || item.quantity <= 0 || item.unit_price < 0)) {
      setSaveMessage('Bitte füllen Sie alle Rechnungspositionen korrekt aus.');
      return;
    }

    setSaveMessage('');
    setShowPreviewModal(true);
  };

  // Prepare invoice data for preview
  const getInvoiceData = () => {
    const client = clients.find(c => c.id === selectedClientId);
    const project = projects.find(p => p.id === selectedProjectId);
    
    return {
      invoice_number: invoiceNumber,
      issue_date: issueDate,
      greeting: greeting,
      intro_text: introText,
      items: invoiceItems,
      subtotal: calculateSubtotal(),
      vat_rate: SWISS_VAT_RATE,
      vat_amount: calculateVat(),
      total_amount: calculateTotal(),
      is_vat_exempt: isVatExempt,
      // Client information
      client_name: client?.client_name,
      client_company: client?.company_name,
      client_address: client?.address,
      // Project information
      project_title: project?.project_title,
    };
  };

  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a
            href={`${baseUrl}/miraka-co-portal/clients`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#FFFFFF',
              border: '1px solid #E5E5E5',
              color: '#1A1A1A',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <ChevronLeft size={20} />
          </a>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: "'Poppins', sans-serif"
          }}>
            Rechnung erstellen
          </h1>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: saveMessage.includes('✓') ? '#E8F5E9' : '#FFEBEE',
          color: saveMessage.includes('✓') ? '#2E7D32' : '#C62828',
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          {saveMessage}
        </div>
      )}

      {/* Section 1: Basic Data */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '22px',
        padding: '32px',
        marginBottom: '24px',
        border: '1px solid #E5E5E5'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1A1A1A',
          marginBottom: '24px',
          fontFamily: "'Poppins', sans-serif"
        }}>
          Basisdaten
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          {/* Client Selection */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A',
              marginBottom: '8px'
            }}>
              Kunde *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 500,
                color: '#2A2A2A'
              }}
            >
              <option value="">Kunde auswählen...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Selection */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A',
              marginBottom: '8px'
            }}>
              Projekt (optional)
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={!selectedClientId}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: selectedClientId ? '#FFFFFF' : '#FAFAFA',
                fontSize: '15px',
                fontWeight: 500,
                color: '#2A2A2A',
                cursor: selectedClientId ? 'pointer' : 'not-allowed'
              }}
            >
              <option value="">Kein Projekt</option>
              {filteredProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.project_title}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A',
              marginBottom: '8px'
            }}>
              Rechnungsdatum
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value);
                // Regenerate invoice number when date changes
                setTimeout(() => generateInvoiceNumber(), 100);
              }}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 500,
                color: '#2A2A2A'
              }}
            />
          </div>

          {/* Invoice Number (Read-only) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#2A2A2A',
              marginBottom: '8px'
            }}>
              Rechnungsnummer
            </label>
            <input
              type="text"
              value={invoiceNumber}
              readOnly
              style={{
                width: '100%',
                height: '48px',
                padding: '0 14px',
                borderRadius: '16px',
                border: '1px solid #E6E6E6',
                background: '#FAFAFA',
                fontSize: '15px',
                fontWeight: 600,
                color: '#6B6B6B',
                cursor: 'not-allowed'
              }}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Greeting (Display Only) */}
      {greeting && (
        <div style={{
          background: '#FAFAFA',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          border: '1px solid #E5E5E5'
        }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 500,
            color: '#1A1A1A',
            fontStyle: 'italic'
          }}>
            {greeting}
          </div>
        </div>
      )}

      {/* Section 3: Intro Text */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '22px',
        padding: '32px',
        marginBottom: '24px',
        border: '1px solid #E5E5E5'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1A1A1A',
          marginBottom: '16px',
          fontFamily: "'Poppins', sans-serif"
        }}>
          Einleitungstext
        </h2>

        <textarea
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '16px',
            border: '1px solid #E6E6E6',
            background: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 500,
            color: '#2A2A2A',
            lineHeight: '1.6',
            resize: 'vertical',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif"
          }}
        />
      </div>

      {/* Section 4: Invoice Items */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '22px',
        padding: '32px',
        marginBottom: '24px',
        border: '1px solid #E5E5E5'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1A1A1A',
            margin: 0,
            fontFamily: "'Poppins', sans-serif"
          }}>
            Rechnungspositionen
          </h2>

          <button
            onClick={addItem}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              background: '#1A1A1A',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={16} />
            Position hinzufügen
          </button>
        </div>

        {/* Items Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E5E5' }}>
                <th style={{
                  padding: '12px 8px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#6B6B6B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Beschreibung
                </th>
                <th style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#6B6B6B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: '120px'
                }}>
                  Menge
                </th>
                <th style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#6B6B6B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: '140px'
                }}>
                  Preis (CHF)
                </th>
                <th style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#6B6B6B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: '140px'
                }}>
                  Total (CHF)
                </th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {invoiceItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Leistungsbeschreibung..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #E6E6E6',
                        background: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#2A2A2A'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #E6E6E6',
                        background: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#2A2A2A',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid #E6E6E6',
                        background: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#2A2A2A',
                        textAlign: 'right'
                      }}
                    />
                  </td>
                  <td style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1A1A1A'
                  }}>
                    {item.line_total.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={invoiceItems.length === 1}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: invoiceItems.length === 1 ? '#E5E5E5' : '#DC2626',
                        cursor: invoiceItems.length === 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 5: Tax & Total */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '22px',
        padding: '32px',
        marginBottom: '32px',
        border: '1px solid #E5E5E5'
      }}>
        <div style={{
          maxWidth: '400px',
          marginLeft: 'auto'
        }}>
          {/* Subtotal */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #F5F5F5'
          }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#6B6B6B' }}>
              Zwischensumme
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A' }}>
              CHF {calculateSubtotal().toFixed(2)}
            </span>
          </div>

          {/* VAT Checkbox */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 0',
            borderBottom: '1px solid #F5F5F5'
          }}>
            <input
              type="checkbox"
              id="vat-exempt"
              checked={isVatExempt}
              onChange={(e) => setIsVatExempt(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer'
              }}
            />
            <label
              htmlFor="vat-exempt"
              style={{
                fontSize: '15px',
                fontWeight: 500,
                color: '#2A2A2A',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              Nicht MWST-pflichtig
            </label>
          </div>

          {/* VAT Amount */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '2px solid #E5E5E5'
          }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#6B6B6B' }}>
              MWST ({SWISS_VAT_RATE}%)
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A' }}>
              CHF {calculateVat().toFixed(2)}
            </span>
          </div>

          {/* Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 0 0 0'
          }}>
            <span style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#1A1A1A',
              fontFamily: "'Poppins', sans-serif"
            }}>
              Gesamtbetrag
            </span>
            <span style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#1A1A1A',
              fontFamily: "'Poppins', sans-serif"
            }}>
              CHF {calculateTotal().toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Section 6: Actions */}
      <div style={{
        display: 'flex',
        gap: '16px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: '12px',
            background: 'transparent',
            border: '1px solid #E5E5E5',
            color: '#1A1A1A',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: "'Poppins', sans-serif"
          }}
        >
          <X size={18} />
          Abbrechen
        </button>

        <button
          onClick={handleShowPreview}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: '12px',
            background: '#FFFFFF',
            border: '1px solid #E5E5E5',
            color: '#1A1A1A',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: "'Poppins', sans-serif"
          }}
        >
          <FileText size={18} />
          PDF Vorschau
        </button>

        <button
          onClick={saveInvoice}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            borderRadius: '12px',
            background: '#1A1A1A',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isSaving ? 0.6 : 1,
            fontFamily: "'Poppins', sans-serif"
          }}
        >
          <Save size={18} />
          {isSaving ? 'Wird gespeichert...' : 'Rechnung speichern'}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <InvoicePreviewModal
          invoice={getInvoiceData()}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}





