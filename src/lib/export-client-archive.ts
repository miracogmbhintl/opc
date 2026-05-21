/**
 * COMPREHENSIVE CLIENT ARCHIVE EXPORT
 * Exports ALL data points for a client in multiple formats
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClientArchiveData {
  client: {
    company_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    address?: string;
    created_at: string;
    deleted_at: string;
    notes?: string;
  };
  user_profile?: {
    full_name: string;
    email: string;
    role: string;
    last_login?: string;
  };
  projects: Array<{
    title: string;
    description?: string;
    status: string;
    category: string;
    progress: number;
    start_date?: string;
    deadline?: string;
    budget_total?: number;
    budget_paid?: number;
    created_at: string;
    updated_at: string;
  }>;
  project_notes: Array<{
    project_title: string;
    content: string;
    created_at: string;
    created_by: string;
  }>;
  project_milestones: Array<{
    project_title: string;
    title: string;
    description: string;
    status: string;
    due_date?: string;
    completed_at?: string;
  }>;
  project_checklist: Array<{
    project_title: string;
    item: string;
    completed: boolean;
    completed_at?: string;
  }>;
  project_timeline: Array<{
    project_title: string;
    stage: string;
    status: string;
    date: string;
  }>;
  project_files: Array<{
    project_title: string;
    file_name: string;
    file_type: string;
    file_size: number;
    uploaded_at: string;
    uploaded_by: string;
  }>;
  tickets: Array<{
    title: string;
    description: string;
    status: string;
    priority: string;
    type: string;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
    assigned_to?: string;
  }>;
  ticket_comments: Array<{
    ticket_title: string;
    author: string;
    comment: string;
    created_at: string;
  }>;
  chat_messages: Array<{
    sender: string;
    message: string;
    timestamp: string;
    project_title?: string;
  }>;
  files: Array<{
    name: string;
    type: string;
    size: number;
    uploaded_at: string;
    uploaded_by: string;
    category?: string;
  }>;
  activity_logs: Array<{
    action: string;
    resource_type: string;
    resource_id: string;
    user: string;
    timestamp: string;
    details?: string;
  }>;
}

// ========================================
// PDF EXPORT - COMPREHENSIVE REPORT
// ========================================
export function exportClientArchiveToPDF(data: ClientArchiveData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPos = 20;

  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(242, 242, 242);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('M&CO', 14, 10);
  doc.setFontSize(10);
  doc.text('CLIENT ARCHIVE REPORT', pageWidth - 14, 10, { align: 'right' });

  doc.setTextColor(26, 26, 26);
  yPos = 25;

  // Title
  doc.setFontSize(20);
  doc.text(`Client Archive: ${data.client.company_name}`, 14, yPos);
  yPos += 10;

  // Archive metadata
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 5;
  doc.text(`Archived on: ${new Date(data.client.deleted_at).toLocaleString()}`, 14, yPos);
  yPos += 12;

  // === CLIENT INFORMATION ===
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT INFORMATION', 14, yPos);
  yPos += 8;

  const clientInfo = [
    ['Company Name', data.client.company_name],
    ['Contact Name', data.client.contact_name],
    ['Email', data.client.email],
    ['Phone', data.client.phone || 'N/A'],
    ['Address', data.client.address || 'N/A'],
    ['Created', new Date(data.client.created_at).toLocaleDateString()],
    ['Archived', new Date(data.client.deleted_at).toLocaleDateString()]
  ];

  autoTable(doc, {
    startY: yPos,
    body: clientInfo,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // === DATA SUMMARY ===
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DATA SUMMARY', 14, yPos);
  yPos += 8;

  const dataSummary = [
    ['Projects', data.projects.length.toString()],
    ['Project Notes', data.project_notes.length.toString()],
    ['Project Milestones', data.project_milestones.length.toString()],
    ['Project Checklist Items', data.project_checklist.length.toString()],
    ['Project Timeline Events', data.project_timeline.length.toString()],
    ['Project Files', data.project_files.length.toString()],
    ['Support Tickets', data.tickets.length.toString()],
    ['Ticket Comments', data.ticket_comments.length.toString()],
    ['Chat Messages', data.chat_messages.length.toString()],
    ['Files', data.files.length.toString()],
    ['Activity Log Entries', data.activity_logs.length.toString()]
  ];

  autoTable(doc, {
    startY: yPos,
    body: dataSummary,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'right', cellWidth: 40 }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // === PROJECTS ===
  if (data.projects.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PROJECTS', 14, yPos);
    yPos += 8;

    const projectData = data.projects.map(p => [
      p.title,
      p.status,
      `${p.progress}%`,
      p.deadline ? new Date(p.deadline).toLocaleDateString() : 'N/A',
      p.budget_total ? `$${p.budget_total.toLocaleString()}` : 'N/A'
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Project', 'Status', 'Progress', 'Deadline', 'Budget']],
      body: projectData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9, cellPadding: 3 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // === TICKETS ===
  if (data.tickets.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPORT TICKETS', 14, yPos);
    yPos += 8;

    const ticketData = data.tickets.map(t => [
      t.title.substring(0, 40),
      t.status,
      t.priority,
      t.type,
      new Date(t.created_at).toLocaleDateString()
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Ticket', 'Status', 'Priority', 'Type', 'Created']],
      body: ticketData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9, cellPadding: 3 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // === ACTIVITY LOG (Last 20 entries) ===
  if (data.activity_logs.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECENT ACTIVITY', 14, yPos);
    yPos += 8;

    const activityData = data.activity_logs.slice(0, 20).map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.action,
      log.resource_type,
      log.user
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Time', 'Action', 'Resource', 'User']],
      body: activityData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 8, cellPadding: 2 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `M&CO - ${data.client.company_name} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const fileName = `${data.client.company_name.replace(/\s+/g, '_')}_archive_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

// ========================================
// CSV EXPORT - COMPLETE DATA DUMP
// ========================================
export function exportClientArchiveToCSV(data: ClientArchiveData, section: 'all' | 'projects' | 'tickets' | 'activity' | 'files' = 'all') {
  const escapeCSV = (value: any) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  let csvContent = '';
  let fileName = '';

  if (section === 'all') {
    // MASTER DATA EXPORT
    csvContent += `CLIENT ARCHIVE EXPORT\n`;
    csvContent += `Client: ${data.client.company_name}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Client Info
    csvContent += `CLIENT INFORMATION\n`;
    csvContent += `Field,Value\n`;
    Object.entries(data.client).forEach(([key, value]) => {
      csvContent += `${escapeCSV(key)},${escapeCSV(value)}\n`;
    });
    csvContent += `\n`;

    // Data Summary
    csvContent += `DATA SUMMARY\n`;
    csvContent += `Category,Count\n`;
    csvContent += `Projects,${data.projects.length}\n`;
    csvContent += `Project Notes,${data.project_notes.length}\n`;
    csvContent += `Project Milestones,${data.project_milestones.length}\n`;
    csvContent += `Project Checklist,${data.project_checklist.length}\n`;
    csvContent += `Project Timeline Events,${data.project_timeline.length}\n`;
    csvContent += `Project Files,${data.project_files.length}\n`;
    csvContent += `Tickets,${data.tickets.length}\n`;
    csvContent += `Ticket Comments,${data.ticket_comments.length}\n`;
    csvContent += `Chat Messages,${data.chat_messages.length}\n`;
    csvContent += `Files,${data.files.length}\n`;
    csvContent += `Activity Logs,${data.activity_logs.length}\n`;
    csvContent += `\n`;

    fileName = `${data.client.company_name.replace(/\s+/g, '_')}_complete_archive.csv`;

  } else if (section === 'projects') {
    csvContent += `PROJECTS - ${data.client.company_name}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Title,Status,Category,Progress,Start Date,Deadline,Budget Total,Budget Paid,Created,Updated\n`;
    
    data.projects.forEach(p => {
      csvContent += [
        escapeCSV(p.title),
        escapeCSV(p.status),
        escapeCSV(p.category),
        p.progress,
        escapeCSV(p.start_date),
        escapeCSV(p.deadline),
        escapeCSV(p.budget_total),
        escapeCSV(p.budget_paid),
        escapeCSV(p.created_at),
        escapeCSV(p.updated_at)
      ].join(',') + '\n';
    });

    csvContent += `\n\nPROJECT NOTES\n`;
    csvContent += `Project,Content,Created,Created By\n`;
    data.project_notes.forEach(n => {
      csvContent += [
        escapeCSV(n.project_title),
        escapeCSV(n.content),
        escapeCSV(n.created_at),
        escapeCSV(n.created_by)
      ].join(',') + '\n';
    });

    csvContent += `\n\nPROJECT MILESTONES\n`;
    csvContent += `Project,Title,Description,Status,Due Date,Completed\n`;
    data.project_milestones.forEach(m => {
      csvContent += [
        escapeCSV(m.project_title),
        escapeCSV(m.title),
        escapeCSV(m.description),
        escapeCSV(m.status),
        escapeCSV(m.due_date),
        escapeCSV(m.completed_at)
      ].join(',') + '\n';
    });

    fileName = `${data.client.company_name.replace(/\s+/g, '_')}_projects.csv`;

  } else if (section === 'tickets') {
    csvContent += `SUPPORT TICKETS - ${data.client.company_name}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Title,Description,Status,Priority,Type,Created,Updated,Resolved,Assigned To\n`;
    
    data.tickets.forEach(t => {
      csvContent += [
        escapeCSV(t.title),
        escapeCSV(t.description),
        escapeCSV(t.status),
        escapeCSV(t.priority),
        escapeCSV(t.type),
        escapeCSV(t.created_at),
        escapeCSV(t.updated_at),
        escapeCSV(t.resolved_at),
        escapeCSV(t.assigned_to)
      ].join(',') + '\n';
    });

    csvContent += `\n\nTICKET COMMENTS\n`;
    csvContent += `Ticket,Author,Comment,Created\n`;
    data.ticket_comments.forEach(c => {
      csvContent += [
        escapeCSV(c.ticket_title),
        escapeCSV(c.author),
        escapeCSV(c.comment),
        escapeCSV(c.created_at)
      ].join(',') + '\n';
    });

    fileName = `${data.client.company_name.replace(/\s+/g, '_')}_tickets.csv`;

  } else if (section === 'activity') {
    csvContent += `ACTIVITY LOG - ${data.client.company_name}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Timestamp,Action,Resource Type,Resource ID,User,Details\n`;
    
    data.activity_logs.forEach(log => {
      csvContent += [
        escapeCSV(log.timestamp),
        escapeCSV(log.action),
        escapeCSV(log.resource_type),
        escapeCSV(log.resource_id),
        escapeCSV(log.user),
        escapeCSV(log.details)
      ].join(',') + '\n';
    });

    fileName = `${data.client.company_name.replace(/\s+/g, '_')}_activity_log.csv`;

  } else if (section === 'files') {
    csvContent += `FILES - ${data.client.company_name}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Name,Type,Size (bytes),Uploaded,Uploaded By,Category\n`;
    
    data.files.forEach(f => {
      csvContent += [
        escapeCSV(f.name),
        escapeCSV(f.type),
        f.size,
        escapeCSV(f.uploaded_at),
        escapeCSV(f.uploaded_by),
        escapeCSV(f.category)
      ].join(',') + '\n';
    });

    csvContent += `\n\nPROJECT FILES\n`;
    csvContent += `Project,File Name,Type,Size (bytes),Uploaded,Uploaded By\n`;
    data.project_files.forEach(f => {
      csvContent += [
        escapeCSV(f.project_title),
        escapeCSV(f.file_name),
        escapeCSV(f.file_type),
        f.file_size,
        escapeCSV(f.uploaded_at),
        escapeCSV(f.uploaded_by)
      ].join(',') + '\n';
    });

    fileName = `${data.client.company_name.replace(/\s+/g, '_')}_files.csv`;
  }

  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========================================
// JSON EXPORT - RAW DATA
// ========================================
export function exportClientArchiveToJSON(data: ClientArchiveData) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const fileName = `${data.client.company_name.replace(/\s+/g, '_')}_archive_${new Date().toISOString().split('T')[0]}.json`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
