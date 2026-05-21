import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProjectData {
  title: string;
  category: string;
  status: string;
  progress: number;
  deadline: string;
  nextStep: string;
  client?: {
    name: string;
    company: string;
    email: string;
  };
  budget?: {
    total: number;
    paid: number;
    balance: number;
    currency: string;
  };
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    description: string;
    date: string;
    category: string;
    assignedPerson: {
      name: string;
      initials: string;
    };
    files: Array<{
      name: string;
      type: string;
    }>;
    comments: Array<{
      author: string;
      message: string;
      date: string;
    }>;
    changelog: Array<{
      action: string;
      date: string;
      user: string;
    }>;
  }>;
  timeline: Array<{
    id: string;
    name: string;
    status: string;
    date: string;
  }>;
  communications: Array<{
    date: string;
    type: string;
    from: string;
    to: string;
    subject: string;
    summary: string;
  }>;
}

export function exportProjectToPDF(project: ProjectData, exportType: 'full' | 'timeline' = 'full') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPos = 20;

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header with M&CO branding
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, 15, 'F');
  doc.setTextColor(242, 242, 242);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('M&CO', 14, 10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('PROJECT REPORT', pageWidth - 14, 10, { align: 'right' });

  // Reset text color
  doc.setTextColor(26, 26, 26);
  yPos = 25;

  // Project Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(project.title, 14, yPos);
  yPos += 10;

  // Project Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Category: ${project.category}`, 14, yPos);
  doc.text(`Status: ${project.status.toUpperCase()}`, 100, yPos);
  yPos += 6;
  doc.text(`Progress: ${project.progress}%`, 14, yPos);
  doc.text(`Deadline: ${project.deadline}`, 100, yPos);
  yPos += 6;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 10;

  // Progress Bar
  doc.setDrawColor(218, 218, 218);
  doc.setLineWidth(0.5);
  doc.rect(14, yPos, pageWidth - 28, 4);
  doc.setFillColor(10, 186, 181);
  doc.rect(14, yPos, ((pageWidth - 28) * project.progress) / 100, 4, 'F');
  yPos += 12;

  if (exportType === 'full') {
    // Client Information
    if (project.client) {
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENT INFORMATION', 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Name: ${project.client.name}`, 14, yPos);
      yPos += 6;
      doc.text(`Company: ${project.client.company}`, 14, yPos);
      yPos += 6;
      doc.text(`Email: ${project.client.email}`, 14, yPos);
      yPos += 12;
    }

    // Financial Summary
    if (project.budget) {
      checkPageBreak(40);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL SUMMARY', 14, yPos);
      yPos += 8;

      const financialData = [
        ['Total Budget', `${project.budget.currency} ${project.budget.total.toLocaleString()}`],
        ['Paid to Date', `${project.budget.currency} ${project.budget.paid.toLocaleString()}`],
        ['Open Balance', `${project.budget.currency} ${project.budget.balance.toLocaleString()}`],
        ['Payment Status', project.budget.balance > 0 ? 'Outstanding' : 'Paid in Full']
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Item', 'Amount']],
        body: financialData,
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 26], textColor: [242, 242, 242], fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right' }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;
    }

    // Next Steps
    checkPageBreak(20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('NEXT STEPS', 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const nextStepLines = doc.splitTextToSize(project.nextStep, pageWidth - 28);
    doc.text(nextStepLines, 14, yPos);
    yPos += nextStepLines.length * 6 + 12;

    // Communications Log
    if (project.communications && project.communications.length > 0) {
      checkPageBreak(40);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('COMMUNICATIONS LOG', 14, yPos);
      yPos += 8;

      const communicationData = project.communications.map(comm => [
        comm.date,
        comm.type,
        comm.from,
        comm.subject,
        comm.summary.substring(0, 50) + (comm.summary.length > 50 ? '...' : '')
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Type', 'From', 'Subject', 'Summary']],
        body: communicationData,
        theme: 'grid',
        headStyles: { fillColor: [26, 26, 26], textColor: [242, 242, 242], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 }
        }
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // Milestones
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJECT MILESTONES', 14, yPos);
  yPos += 8;

  project.milestones.forEach((milestone, index) => {
    checkPageBreak(50);

    // Milestone header with colored status indicator
    doc.setFillColor(242, 242, 242);
    doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
    
    // Status color
    let statusColor: [number, number, number] = [128, 128, 128];
    switch (milestone.status) {
      case 'complete': statusColor = [10, 121, 104]; break;
      case 'active': statusColor = [26, 26, 26]; break;
      case 'pending': statusColor = [243, 112, 33]; break;
      case 'at-risk': statusColor = [128, 27, 43]; break;
    }
    
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.circle(18, yPos, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${milestone.title}`, 24, yPos);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(milestone.status.toUpperCase(), pageWidth - 14, yPos, { align: 'right' });
    yPos += 8;

    // Milestone details
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(milestone.description, pageWidth - 38);
    doc.text(descLines, 24, yPos);
    yPos += descLines.length * 5 + 4;

    doc.text(`Date: ${milestone.date}`, 24, yPos);
    doc.text(`Assigned: ${milestone.assignedPerson.name}`, 100, yPos);
    yPos += 5;

    // Files
    if (milestone.files.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Files (${milestone.files.length}):`, 24, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 4;
      milestone.files.slice(0, 3).forEach(file => {
        doc.text(`  • ${file.name}`, 26, yPos);
        yPos += 4;
      });
      if (milestone.files.length > 3) {
        doc.text(`  ... and ${milestone.files.length - 3} more`, 26, yPos);
        yPos += 4;
      }
    }

    // Comments
    if (exportType === 'full' && milestone.comments.length > 0) {
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.text(`Comments (${milestone.comments.length}):`, 24, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 4;
      milestone.comments.slice(0, 2).forEach(comment => {
        checkPageBreak(15);
        doc.text(`  ${comment.author} (${comment.date}):`, 26, yPos);
        yPos += 4;
        const commentLines = doc.splitTextToSize(`  "${comment.message}"`, pageWidth - 45);
        doc.text(commentLines, 26, yPos);
        yPos += commentLines.length * 4 + 2;
      });
      if (milestone.comments.length > 2) {
        doc.text(`  ... and ${milestone.comments.length - 2} more comments`, 26, yPos);
        yPos += 4;
      }
    }

    // Changelog
    if (exportType === 'full' && milestone.changelog.length > 0) {
      yPos += 2;
      doc.setFont('helvetica', 'bold');
      doc.text(`Change Log:`, 24, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 4;
      milestone.changelog.slice(0, 3).forEach(change => {
        checkPageBreak(10);
        doc.text(`  • ${change.action} - ${change.user} (${change.date})`, 26, yPos);
        yPos += 4;
      });
      if (milestone.changelog.length > 3) {
        doc.text(`  ... and ${milestone.changelog.length - 3} more changes`, 26, yPos);
        yPos += 4;
      }
    }

    yPos += 8;
  });

  // Timeline
  if (project.timeline && project.timeline.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PROJECT TIMELINE', 14, yPos);
    yPos += 8;

    const timelineData = project.timeline.map(stage => [
      stage.name,
      stage.date,
      stage.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Stage', 'Date', 'Status']],
      body: timelineData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26], textColor: [242, 242, 242], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50 },
        2: { cellWidth: 40, halign: 'center' }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `M&CO Client Portal - ${project.title} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const fileName = `${project.title.replace(/\s+/g, '_')}_${exportType}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

export function exportProjectToCSV(project: ProjectData, exportType: 'milestones' | 'timeline' | 'communications' = 'milestones') {
  let csvContent = '';
  let fileName = '';

  const escapeCSV = (value: string | number) => {
    if (typeof value === 'number') return value.toString();
    const stringValue = value.toString();
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  if (exportType === 'milestones') {
    // Project header
    csvContent += `PROJECT REPORT: ${project.title}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n`;
    csvContent += `Status: ${project.status}\n`;
    csvContent += `Progress: ${project.progress}%\n`;
    csvContent += `Deadline: ${project.deadline}\n\n`;

    // Financial info if available
    if (project.budget) {
      csvContent += `FINANCIAL SUMMARY\n`;
      csvContent += `Total Budget,${project.budget.currency} ${project.budget.total}\n`;
      csvContent += `Paid to Date,${project.budget.currency} ${project.budget.paid}\n`;
      csvContent += `Open Balance,${project.budget.currency} ${project.budget.balance}\n\n`;
    }

    // Milestones
    csvContent += `MILESTONES\n`;
    csvContent += `ID,Title,Status,Category,Date,Assigned To,Description,Files Count,Comments Count,Changes Count\n`;
    
    project.milestones.forEach(milestone => {
      csvContent += [
        escapeCSV(milestone.id),
        escapeCSV(milestone.title),
        escapeCSV(milestone.status),
        escapeCSV(milestone.category),
        escapeCSV(milestone.date),
        escapeCSV(milestone.assignedPerson.name),
        escapeCSV(milestone.description),
        milestone.files.length,
        milestone.comments.length,
        milestone.changelog.length
      ].join(',') + '\n';
    });

    // Detailed milestone information
    csvContent += `\nDETAILED MILESTONE INFORMATION\n`;
    project.milestones.forEach(milestone => {
      csvContent += `\nMilestone: ${escapeCSV(milestone.title)}\n`;
      
      if (milestone.files.length > 0) {
        csvContent += `Files:\n`;
        milestone.files.forEach(file => {
          csvContent += `  ${escapeCSV(file.name)},${escapeCSV(file.type)}\n`;
        });
      }

      if (milestone.comments.length > 0) {
        csvContent += `Comments:\n`;
        milestone.comments.forEach(comment => {
          csvContent += `  ${escapeCSV(comment.date)},${escapeCSV(comment.author)},${escapeCSV(comment.message)}\n`;
        });
      }

      if (milestone.changelog.length > 0) {
        csvContent += `Change Log:\n`;
        milestone.changelog.forEach(change => {
          csvContent += `  ${escapeCSV(change.date)},${escapeCSV(change.user)},${escapeCSV(change.action)}\n`;
        });
      }
    });

    fileName = `${project.title.replace(/\s+/g, '_')}_milestones_${new Date().toISOString().split('T')[0]}.csv`;

  } else if (exportType === 'timeline') {
    csvContent += `PROJECT TIMELINE: ${project.title}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Stage,Date,Status\n`;
    
    project.timeline.forEach(stage => {
      csvContent += [
        escapeCSV(stage.name),
        escapeCSV(stage.date),
        escapeCSV(stage.status)
      ].join(',') + '\n';
    });

    fileName = `${project.title.replace(/\s+/g, '_')}_timeline_${new Date().toISOString().split('T')[0]}.csv`;

  } else if (exportType === 'communications') {
    csvContent += `COMMUNICATIONS LOG: ${project.title}\n`;
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    csvContent += `Date,Type,From,To,Subject,Summary\n`;
    
    project.communications.forEach(comm => {
      csvContent += [
        escapeCSV(comm.date),
        escapeCSV(comm.type),
        escapeCSV(comm.from),
        escapeCSV(comm.to),
        escapeCSV(comm.subject),
        escapeCSV(comm.summary)
      ].join(',') + '\n';
    });

    fileName = `${project.title.replace(/\s+/g, '_')}_communications_${new Date().toISOString().split('T')[0]}.csv`;
  }

  // Create and download CSV
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
