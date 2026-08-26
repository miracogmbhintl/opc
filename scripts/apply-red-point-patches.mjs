import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) throw new Error(`Patch anchor missing: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index === -1) throw new Error(`Patch text missing: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

// Invoice detail: header + item writes must be one transaction, and document
// generation must stop if persistence failed.
{
  const path = 'src/components/InvoiceDetailPage.tsx';
  let source = read(path);
  const saveInvoice = `  async function saveInvoice(nextStatus?: string, options: { silent?: boolean } = {}) {
    if (!invoice || !supabase) return false;

    setSaving(true);
    setErrorMessage('');
    if (!options.silent) setSuccessMessage('');

    try {
      const status = nextStatus || invoice.status || 'draft';
      const correctedInvoiceNumber = clean(invoice.invoice_number);

      if (DOCUMENT_CORRECTION_MODE) {
        if (!correctedInvoiceNumber) throw new Error('Die Rechnungsnummer darf im Korrekturmodus nicht leer sein.');
        const { data: duplicate, error: duplicateError } = await supabase
          .from('opc_invoices')
          .select('id, invoice_number')
          .eq('invoice_number', correctedInvoiceNumber)
          .neq('id', invoice.id)
          .limit(1)
          .maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) throw new Error(\`Die Rechnungsnummer \${correctedInvoiceNumber} wird bereits verwendet.\`);
      }

      const invoicePayload = {
        ...(DOCUMENT_CORRECTION_MODE ? { invoice_number: correctedInvoiceNumber } : {}),
        status,
        invoice_type: invoice.invoice_type || 'standard',
        title: clean(invoice.title) || 'Rechnung',
        issue_date: isoDate(invoice.issue_date) || new Date().toISOString().slice(0, 10),
        due_date: isoDate(invoice.due_date) || null,
        intro_text: rawInvoiceText(invoice.intro_text),
        payment_terms: rawInvoiceText(invoice.payment_terms),
        internal_notes: invoice.internal_notes || null,
        discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate),
        subtotal_chf: roundMoney(totals.subtotal),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        paid_chf: roundMoney(totals.paid),
        balance_chf: roundMoney(totals.balance),
        sent_at: status === 'sent' && !invoice.sent_at ? new Date().toISOString() : invoice.sent_at || null,
        paid_at: status === 'paid' && !invoice.paid_at ? new Date().toISOString() : invoice.paid_at || null,
        metadata: {
          ...getMetadata(invoice),
          invoice_editor_version: INVOICE_EDITOR_VERSION,
          unrounded_total_chf: roundMoney(totals.unroundedTotal),
          rounding_difference_chf: roundMoney(totals.rounding),
          cash_rounding_increment_chf: 0.05,
        },
      };

      const itemPayloads = items.map((item, index) => ({
        ...(String(item.id).startsWith('local-') ? {} : { id: item.id }),
        quote_item_id: item.quote_item_id || null,
        sort_order: index + 1,
        title: clean(item.title) || 'Position',
        description: item.description || null,
        quantity: toNumber(item.quantity || 1) || 1,
        unit: item.unit || 'pauschal',
        unit_price_chf: roundMoney(toNumber(item.unit_price_chf)),
        discount_chf: roundMoney(toNumber(item.discount_chf)),
        tax_rate: roundMoney(toNumber(item.tax_rate || totals.taxRate) || 8.1),
        subtotal_chf: roundMoney(toNumber(item.subtotal_chf)),
        tax_chf: roundMoney(toNumber(item.tax_chf)),
        total_chf: roundMoney(toNumber(item.total_chf)),
        metadata: getMetadata(item),
      }));

      const { data: saved, error } = await supabase.rpc('opc_save_invoice_atomic', {
        p_invoice_id: invoice.id,
        p_invoice: invoicePayload,
        p_items: itemPayloads,
      });
      if (error) throw error;
      if (!saved?.invoice?.id) throw new Error('Die Rechnung wurde nicht vollständig gespeichert.');

      setInvoice(saved.invoice);
      setItems(Array.isArray(saved.items) ? saved.items : items);
      const savedTime = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
      setLastSavedAt(savedTime);
      if (!options.silent) setSuccessMessage(\`Gespeichert um \${savedTime}.\`);
      return true;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnung konnte nicht gespeichert werden.');
      return false;
    } finally {
      setSaving(false);
    }
  }
`;
  source = replaceBetween(source, '  async function saveInvoice(', '\n\n  async function handleDuplicateInvoice()', saveInvoice, 'InvoiceDetail.saveInvoice');

  source = replaceOnce(
    source,
    `  async function handleDownloadInvoicePdf() {\n    await saveInvoice(undefined, { silent: true });`,
    `  async function handleDownloadInvoicePdf() {\n    const saved = await saveInvoice(undefined, { silent: true });\n    if (!saved) { setErrorMessage('Rechnung konnte vor der PDF-Erstellung nicht gespeichert werden.'); return; }`,
    'Invoice PDF save guard',
  );
  source = replaceOnce(
    source,
    `    try {\n      await saveInvoice(undefined, { silent: true });\n      const input = buildInvoicePdfInput();`,
    `    try {\n      const saved = await saveInvoice(undefined, { silent: true });\n      if (!saved) throw new Error('Rechnung konnte vor der Zahlungserinnerung nicht gespeichert werden.');\n      const input = buildInvoicePdfInput();`,
    'Payment reminder save guard',
  );
  source = replaceOnce(
    source,
    `    try {\n      await saveInvoice(undefined, { silent: true });\n      const input = buildInvoicePdfInput();`,
    `    try {\n      const saved = await saveInvoice(undefined, { silent: true });\n      if (!saved) throw new Error('Rechnung konnte vor der Mahnung nicht gespeichert werden.');\n      const input = buildInvoicePdfInput();`,
    'First reminder save guard',
  );
  write(path, source);
}

// Quote detail: quote + items atomic, mail state after successful delivery,
// and quote -> invoice uses the dedicated idempotent transaction.
{
  const path = 'src/components/QuoteDetailPage.tsx';
  let source = read(path);
  const saveQuote = `  async function saveQuote(nextStatus?: string, options: { silent?: boolean } = {}) {
    if (!quote) return quote;

    setSaving(true);
    setErrorMessage('');
    if (!options.silent) setSuccessMessage('');

    try {
      if (!supabase) throw new Error('Supabase ist nicht verfügbar.');
      const issueDate = quote.issue_date || new Date().toISOString().slice(0, 10);
      const validUntil = quote.valid_until || addDays(issueDate, 14);
      const status = nextStatus || quote.status || 'draft';
      const correctedQuoteNumber = clean(quote.quote_number);
      const now = new Date().toISOString();

      if (DOCUMENT_CORRECTION_MODE) {
        if (!correctedQuoteNumber) throw new Error('Die Offertennummer darf im Korrekturmodus nicht leer sein.');
        const { data: duplicate, error: duplicateError } = await supabase
          .from('opc_quotes').select('id, quote_number')
          .eq('quote_number', correctedQuoteNumber).neq('id', quote.id).limit(1).maybeSingle();
        if (duplicateError) throw duplicateError;
        if (duplicate) throw new Error(\`Die Offertennummer \${correctedQuoteNumber} wird bereits verwendet.\`);
      }

      const quotePayload = {
        ...(DOCUMENT_CORRECTION_MODE ? { quote_number: correctedQuoteNumber } : {}),
        status,
        title: normalizeServiceTitle(quote.title) || 'Reinigungsleistung',
        quote_type: quote.quote_type || 'standard',
        issue_date: issueDate,
        valid_until: validUntil,
        intro_text: quote.intro_text || null,
        scope_text: quote.scope_text || null,
        service_description_mode: quote.service_description_mode || 'embedded',
        service_description_template_id: quote.service_description_template_id || null,
        service_description_text: quote.service_description_text || null,
        terms_text: quote.terms_text || null,
        payment_terms: quote.payment_terms || null,
        acceptance_terms: quote.acceptance_terms || null,
        internal_notes: quote.internal_notes || null,
        customer_notes: quote.customer_notes || null,
        subtotal_chf: roundMoney(totals.subtotal),
        discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate),
        tax_chf: roundMoney(totals.tax),
        total_chf: roundMoney(totals.total),
        sent_at: nextStatus === 'sent' && !quote.sent_at ? now : quote.sent_at || null,
        accepted_at: nextStatus === 'accepted' && !quote.accepted_at ? now : quote.accepted_at || null,
        metadata: { ...getMetadata(quote), price_input_mode: priceInputMode },
      };

      const itemPayloads = items.map((item, index) => ({
        ...((Boolean(item.isLocal) || String(item.id || '').startsWith('local-')) ? {} : { id: item.id }),
        sort_order: index + 1,
        item_type: item.item_type || 'service',
        title: clean(item.title) || 'Position',
        description: item.description || null,
        quantity: toNumber(item.quantity || 1) || 1,
        unit: item.unit || 'pauschal',
        unit_price_chf: roundMoney(toNumber(item.unit_price_chf)),
        discount_chf: roundMoney(toNumber(item.discount_chf)),
        tax_rate: roundMoney(toNumber(item.tax_rate || totals.taxRate) || 8.1),
        subtotal_chf: roundMoney(toNumber(item.subtotal_chf)),
        tax_chf: roundMoney(toNumber(item.tax_chf)),
        total_chf: roundMoney(toNumber(item.total_chf)),
        metadata: { ...getMetadata(item), input_price_mode: priceInputMode },
      }));

      const event = {
        event_type: nextStatus && nextStatus !== quote.status ? 'status_changed' : 'updated',
        message: nextStatus && nextStatus !== quote.status ? \`Status auf \${nextStatus} geändert.\` : 'Offerte gespeichert.',
        previous_status: quote.status || null,
        new_status: status,
      };
      const { data: saved, error } = await supabase.rpc('opc_save_quote_atomic', {
        p_quote_id: quote.id,
        p_quote: quotePayload,
        p_items: itemPayloads,
        p_event: event,
      });
      if (error) throw error;
      if (!saved?.quote?.id) throw new Error('Die Offerte wurde nicht vollständig gespeichert.');

      const nextQuote = normalizeQuoteAfterLoad(saved.quote);
      setQuote(nextQuote);
      setItems(Array.isArray(saved.items) ? saved.items : items);
      const savedTime = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
      setLastSavedAt(savedTime);
      if (!options.silent) setSuccessMessage(\`Gespeichert um \${savedTime}.\`);
      return nextQuote;
    } catch (error: any) {
      const message = error?.message === 'Load failed' || error?.message === 'Failed to fetch'
        ? 'Die Verbindung wurde während des Speicherns unterbrochen. Bitte nochmals versuchen.'
        : error?.message || 'Offerte konnte nicht gespeichert werden.';
      setErrorMessage(message);
      throw error;
    } finally {
      setSaving(false);
    }
  }
`;
  source = replaceBetween(source, '  async function saveQuote(', '\n\n  function buildQuotePdfInput(', saveQuote, 'QuoteDetail.saveQuote');

  const convert = `  async function createInvoiceFromQuote() {
    if (!quote || !supabase) return;
    setCreatingAction('invoice');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await saveQuote('accepted', { silent: true });
      const today = new Date().toISOString().slice(0, 10);
      const invoicePayload = {
        job_id: quote.job_id || null,
        client_id: quote.client_id,
        contact_id: quote.contact_id || null,
        client_site_id: quote.client_site_id || null,
        status: 'draft', invoice_type: 'standard', title: \`Rechnung zu \${quote.quote_number}\`,
        language: quote.language || 'de', currency: quote.currency || 'CHF',
        issue_date: today, due_date: addDays(today, 10),
        client_snapshot: quote.client_snapshot || {}, site_snapshot: quote.site_snapshot || {},
        quote_snapshot: { id: quote.id, quote_number: quote.quote_number, title: quote.title, total_chf: totals.total },
        intro_text: 'Danke für Ihr Vertrauen. Ihre Rechnung setzt sich wie folgt zusammen:',
        payment_terms: quote.payment_terms || 'Zahlbar gemäss Vereinbarung.',
        subtotal_chf: roundMoney(totals.subtotal), discount_chf: roundMoney(totals.discount),
        tax_rate: roundMoney(totals.taxRate), tax_chf: roundMoney(totals.tax), total_chf: roundMoney(totals.total),
        paid_chf: 0, balance_chf: roundMoney(totals.total),
        metadata: {
          created_from: 'quote_detail_page', source_quote_id: quote.id, source_quote_number: quote.quote_number,
          source_quote_scope_text: quote.scope_text || '', source_quote_service_description_text: quote.service_description_text || '',
          customer_greeting: getDefaultGreeting(quote),
        },
      };
      const invoiceItems = items.map((item, index) => ({
        quote_item_id: String(item.id).startsWith('local-') ? null : item.id,
        sort_order: index + 1, title: clean(item.title) || 'Position', description: item.description || null,
        quantity: toNumber(item.quantity || 1) || 1, unit: item.unit || 'pauschal',
        unit_price_chf: roundMoney(toNumber(item.unit_price_chf)), discount_chf: roundMoney(toNumber(item.discount_chf)),
        tax_rate: roundMoney(toNumber(item.tax_rate || totals.taxRate) || 8.1), subtotal_chf: roundMoney(toNumber(item.subtotal_chf)),
        tax_chf: roundMoney(toNumber(item.tax_chf)), total_chf: roundMoney(toNumber(item.total_chf)), metadata: getMetadata(item),
      }));
      const { data: converted, error } = await supabase.rpc('opc_convert_quote_to_invoice_atomic', {
        p_quote_id: quote.id,
        p_invoice: invoicePayload,
        p_items: invoiceItems,
      });
      if (error) throw error;
      const invoice = converted?.invoice;
      if (!invoice?.id) throw new Error('Rechnung wurde nicht vollständig aus der Offerte erstellt.');
      window.location.href = \`\${baseUrl}/rechnung/\${invoice.id}\`;
    } catch (error: any) {
      setErrorMessage(error?.message || 'Rechnung konnte nicht erstellt werden.');
    } finally {
      setCreatingAction('');
    }
  }
`;
  source = replaceBetween(source, '  async function createInvoiceFromQuote()', '\n\n  async function createJobFromQuote()', convert, 'QuoteDetail.createInvoiceFromQuote');

  const send = `  async function sendQuoteEmail() {
    if (!quote || !supabase) return;
    setCreatingAction('email');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const savedQuote = await saveQuote(undefined, { silent: true });
      const recipientEmail = await resolveQuoteRecipientEmail();
      if (!recipientEmail) throw new Error('Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Bitte zuerst beim Kunden eine Rechnungs- oder Kontakt-E-Mail eintragen.');
      const filename = buildQuoteFileName(savedQuote || quote, 'Offerte');
      const pdfBase64 = await generateQuotePdfBase64(filename, 'quote');
      if (!pdfBase64) throw new Error('PDF konnte nicht erstellt werden.');
      const html = buildDocumentEmailHtml({
        title: 'Ihre Offerte', headline: 'Ihre Offerte',
        intro: \`Guten Tag, im Anhang finden Sie unsere Offerte \${quote.quote_number}. Bei Fragen stehen wir Ihnen gerne zur Verfügung.\`,
        documentNumber: quote.quote_number || '',
      });
      await sendDocumentEmail(supabase, {
        to: recipientEmail,
        subject: \`Ihre Offerte \${quote.quote_number} – Orange Pro Clean GmbH\`,
        html,
        attachments: [{ filename, contentBase64: pdfBase64, contentType: 'application/pdf' }],
        metadata: { quote_id: quote.id, document_type: 'quote' },
      });
      await saveQuote('sent', { silent: true });
      setSuccessMessage(\`Offerte wurde per E-Mail an \${recipientEmail} gesendet.\`);
      await loadQuote({ clearMessages: false });
    } catch (error: any) {
      setErrorMessage(error?.message || 'E-Mail konnte nicht gesendet werden.');
    } finally {
      setCreatingAction('');
    }
  }
`;
  source = replaceBetween(source, '  async function sendQuoteEmail()', '\n\n  if (loading)', send, 'QuoteDetail.sendQuoteEmail');
  write(path, source);
}

console.log('Remaining finance caller patches applied.');
