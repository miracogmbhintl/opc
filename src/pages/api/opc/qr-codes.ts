/*
 * invoice-with-qr.ts
 *
 * This script illustrates how to generate an A4 invoice with a Swiss QR‑payment section
 * at the bottom.  It uses PDFKit to build the invoice content and the
 * open‑source `swissqrbill` library to render the QR payment slip.  The
 * layout and typography follow the official Swiss QR‑Rechnung guidelines
 * (DIN‑A4 page with 95 pt/55 pt/60 pt/70 pt margins, sans‑serif fonts and
 * clearly separated sections).  You can adapt the sample data below to
 * generate your own invoices.
 *
 * To run this example you must install the dependencies:
 *   npm install pdfkit swissqrbill
 *
 * Running the script will create a file named `invoice-with-qr.pdf` in
 * the current working directory.
 */

import { createWriteStream } from 'node:fs';
import PDFDocument from 'pdfkit';
import { SwissQRBill } from 'swissqrbill/pdf';

// Example data used to populate the invoice and the QR bill.  Replace
// these values with your own invoice details, addresses and QR reference.
const invoiceData = {
  // Invoice metadata
  invoiceNumber: '03062026',
  invoiceDate: new Date('2026-06-18'),
  projectName: 'Videografie – Melodic Wine Fest',
  greeting: 'Sehr geehrter Herr Leliveld,',
  intro:
    'Anbei finden Sie die Rechnung für die Videografie Ihres Events. Wir bedanken uns herzlich für den Auftrag und stehen bei Rückfragen gerne zur Verfügung.',

  // Biller (creditor) details – also used in the QR bill
  creditor: {
    account: 'CH17 3076 9439 5935 0200 2',
    name: 'Miraka & Co. GmbH',
    address: 'Mühlegasse 22',
    postalCode: '4410',
    city: 'Liestal',
    country: 'CH',
  },

  // Customer (debtor) details – also used in the QR bill
  debtor: {
    name: 'Sven Leliveld',
    address: 'Hof van Zilverlicht 17',
    postalCode: '2614TV',
    city: 'Delft',
    country: 'NL',
  },

  // Invoice line items
  items: [
    {
      description: 'Videografie – Eventvorbereitung, Aufnahmen, Postproduktion',
      quantity: 1,
      price: 500.0,
    },
  ],

  // Taxes and totals
  vatRate: 0.0, // 0% VAT in this example; adjust as needed
  currency: 'EUR',
  // QR reference (27 digits for QRR).  It may contain spaces; the
  // SwissQRBill library will format it correctly.  Ensure that the
  // reference type matches the IBAN (QR‑IBAN requires QRR).
  reference: '03 06260 00000 00000 00003 06261',
  // Additional information printed below the reference on the payment part
  additionalInfo: ['Rechnung zur Videografie von Melodic Wine Fest', 'Rechnungs Nr. 03062026'],
};

/**
 * Create a PDF invoice with a Swiss QR‑payment section.
 */
async function generateInvoiceWithQr(): Promise<void> {
  // Calculate totals
  const subtotal = invoiceData.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const vatAmount = subtotal * invoiceData.vatRate;
  const total = subtotal + vatAmount;

  // Prepare the SwissQRBill data object.  Only fields defined in the
  // specification are passed; extra properties are ignored by the library.
  const qrData = {
    amount: total,
    currency: invoiceData.currency,
    creditor: {
      account: invoiceData.creditor.account,
      name: invoiceData.creditor.name,
      address: invoiceData.creditor.address,
      zip: invoiceData.creditor.postalCode,
      city: invoiceData.creditor.city,
      country: invoiceData.creditor.country,
    },
    debtor: {
      name: invoiceData.debtor.name,
      address: invoiceData.debtor.address,
      zip: invoiceData.debtor.postalCode,
      city: invoiceData.debtor.city,
      country: invoiceData.debtor.country,
    },
    reference: invoiceData.reference,
    additionalInfo: invoiceData.additionalInfo.join('\n'),
  } as const;

  // Create the PDF document and pipe to a file stream
  const outputFile = createWriteStream('invoice-with-qr.pdf');
  const pdf = new PDFDocument({ size: 'A4', margin: 0 });
  pdf.pipe(outputFile);

  // Define page padding to match the CSS (in points)
  const paddingTop = 95;
  const paddingRight = 55;
  const paddingBottom = 60;
  const paddingLeft = 70;

  const pageWidth = pdf.page.width;
  const usableWidth = pageWidth - paddingLeft - paddingRight;

  // Set base font and colour
  pdf.font('Helvetica').fontSize(11).fillColor('#000');

  // Header – simple text logo; adjust as needed
  pdf
    .font('Helvetica-Bold')
    .fontSize(18)
    .text('MIRAKA', paddingLeft, paddingTop, { width: usableWidth, align: 'center' });

  // Addresses (two columns)
  const addrY = paddingTop + 18 * 2; // spacing after logo
  const columnWidth = usableWidth / 2;

  // Client (debtor) address
  pdf.font('Helvetica-Bold').fontSize(11);
  pdf
    .text(invoiceData.debtor.name, paddingLeft, addrY, { width: columnWidth })
    .font('Helvetica')
    .text(invoiceData.debtor.address, { continued: false })
    .text(`${invoiceData.debtor.postalCode} ${invoiceData.debtor.city}`);

  // Biller (creditor) address (aligned right within second column)
  const rightColX = paddingLeft + columnWidth;
  pdf.font('Helvetica-Bold').fontSize(11);
  pdf
    .text(invoiceData.creditor.name, rightColX, addrY, { width: columnWidth, align: 'right' })
    .font('Helvetica')
    .text(invoiceData.creditor.address, { align: 'right' })
    .text(`${invoiceData.creditor.postalCode} ${invoiceData.creditor.city}`, { align: 'right' });

  // Meta section (date and invoice number)
  const metaY = addrY + 60;
  pdf.font('Helvetica').fontSize(11);
  pdf.text(`Rechnungs‑Nr.: ${invoiceData.invoiceNumber}`, paddingLeft, metaY);
  pdf.text(
    `Datum: ${invoiceData.invoiceDate.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    paddingLeft,
    metaY + 14,
  );

  // Title (project name)
  const titleY = metaY + 40;
  pdf.font('Helvetica-Bold').fontSize(13);
  pdf.text(invoiceData.projectName, paddingLeft, titleY);

  // Greeting and introduction
  const introY = titleY + 26;
  pdf.font('Helvetica').fontSize(11);
  pdf.text(invoiceData.greeting, paddingLeft, introY);
  pdf.moveDown(0.5);
  pdf.text(invoiceData.intro, { width: usableWidth });

  // Table header
  const tableTop = introY + 60;
  const colWidths = {
    pos: 0.06 * usableWidth,
    desc: 0.54 * usableWidth,
    qty: 0.2 * usableWidth,
    price: 0.2 * usableWidth,
  } as const;
  let y = tableTop;
  pdf.font('Helvetica-Bold').fontSize(11);
  pdf.text('Pos.', paddingLeft, y, { width: colWidths.pos });
  pdf.text('Beschreibung', paddingLeft + colWidths.pos, y, { width: colWidths.desc });
  pdf.text('Menge', paddingLeft + colWidths.pos + colWidths.desc, y, { width: colWidths.qty });
  pdf.text('Preis', paddingLeft + colWidths.pos + colWidths.desc + colWidths.qty, y, {
    width: colWidths.price,
    align: 'right',
  });
  y += 16;
  pdf
    .moveTo(paddingLeft, y)
    .lineTo(paddingLeft + usableWidth, y)
    .strokeColor('#000')
    .lineWidth(1)
    .stroke();

  // Table rows
  pdf.font('Helvetica').fontSize(11);
  let posCounter = 1;
  y += 6;
  for (const item of invoiceData.items) {
    pdf.text(String(posCounter++), paddingLeft, y, { width: colWidths.pos });
    pdf.text(item.description, paddingLeft + colWidths.pos, y, { width: colWidths.desc });
    pdf.text(item.quantity.toFixed(2), paddingLeft + colWidths.pos + colWidths.desc, y, {
      width: colWidths.qty,
    });
    pdf.text((item.price * item.quantity).toFixed(2), paddingLeft + colWidths.pos + colWidths.desc + colWidths.qty, y, {
      width: colWidths.price,
      align: 'right',
    });
    y += 20;
    // draw row separator
    pdf
      .moveTo(paddingLeft, y)
      .lineTo(paddingLeft + usableWidth, y)
      .strokeColor('#ccc')
      .lineWidth(0.5)
      .stroke();
    y += 6;
  }

  // Totals section
  y += 10;
  const totalsX = paddingLeft + usableWidth - 120; // right align totals within 120pt
  pdf.font('Helvetica').fontSize(11);
  pdf.text('Subtotal', totalsX - 80, y, { width: 80, align: 'right' });
  pdf.text(subtotal.toFixed(2), totalsX, y, { width: 120, align: 'right' });
  y += 16;
  pdf.text('VAT', totalsX - 80, y, { width: 80, align: 'right' });
  pdf.text(vatAmount.toFixed(2), totalsX, y, { width: 120, align: 'right' });
  y += 20;
  pdf
    .moveTo(totalsX - 80, y)
    .lineTo(paddingLeft + usableWidth, y)
    .strokeColor('#000')
    .lineWidth(1)
    .stroke();
  y += 8;
  pdf.font('Helvetica-Bold').fontSize(12);
  pdf.text('Total', totalsX - 80, y, { width: 80, align: 'right' });
  pdf.text(total.toFixed(2), totalsX, y, { width: 120, align: 'right' });

  // Footer – company information; you can add multiple lines here
  const footerY = pdf.page.height - paddingBottom - 40;
  pdf.font('Helvetica').fontSize(7.5);
  pdf.text('Miraka & Co. GmbH', paddingLeft, footerY);
  pdf.text('Mühlegasse 22, 4410 Liestal, Schweiz', paddingLeft, footerY + 10);
  pdf.text('Tel. +41 61 123 45 67 · info@miraka.ch', paddingLeft, footerY + 20);

  // Instantiate the SwissQRBill and attach it to the PDF.  This automatically
  // draws the payment slip (receipt + QR section) at the next available
  // position, including the Swiss cross and all mandatory fields.
  const qrBill = new SwissQRBill(qrData);
  qrBill.attachTo(pdf);

  // Finalize and close the PDF
  pdf.end();
  await new Promise<void>((resolve) => outputFile.on('finish', () => resolve()));

  console.log('Invoice with QR bill created successfully.');
}

generateInvoiceWithQr().catch((err) => {
  console.error('Error generating invoice:', err);
});