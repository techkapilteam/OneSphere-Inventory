import { Injectable } from '@angular/core';
import { formatDate } from '@angular/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Print / PDF / Excel output for Inventory, laid out the same way as the
// Accounts module (CommonService._downloadReportsPdf / exportAsExcelFile):
// company letterhead (logo, name, registration address, CIN / GST, branch),
// #0b4093 grid header, "Printed on / User" + "Page N of M" footer, Print via
// a hidden iframe, Excel as a real .xlsx with the letterhead rows on top.
export interface InventoryExportDocument {
  title: string;
  columns: string[];
  rows: string[][];
  /** Label/value pairs printed above the table (document header block). */
  fields?: Array<[string, string]>;
  /** Label/value pairs printed under the table on the right; the last one is bold. */
  summary?: Array<[string, string]>;
  notes?: string;
  notesLabel?: string;
  /** "Terms & Conditions :" lines printed under the totals (Sales Invoice). */
  terms?: string[];
  /** Bank label/value pairs for the Bank Details | Certified / For <Company> |
   *  Authorised Signatory box at the foot of the document (Sales Invoice). */
  bankDetails?: Array<[string, string]>;
  /** Text printed on the left of the branch line (e.g. "Between: x And y"). */
  periodText?: string;
  /** Signature captions printed at the foot of a voucher, e.g. (Approved By). */
  signatures?: string[];
  /** Name printed above the last signature caption (the posting user). */
  signedBy?: string;
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
}

const HEADER_COLOR = '#0b4093';
const L_MARGIN = 15;
const R_MARGIN = 15;
const CODE_HEADER = /\b(no\.?|number|code|phone|mobile|pin|gstin|pan|hsn|sac|id)\b/i;
const TERMS_LINE_HEIGHT = 3.6;
/** Rendered height (mm) of the Bank Details / Authorised Signatory box. */
const BANK_BOX_HEIGHT = 46;
const NUMERIC_CELL =/^-?(rs\.?\s*|₹\s*)?-?[\d,]+(\.\d+)?\s*%?$/i;

@Injectable({ providedIn: 'root' })
export class InventoryExportService {

  pdf(document: InventoryExportDocument, mode: 'Pdf' | 'Print'): void {
    const doc = this.buildPdf(document);
    if (mode === 'Pdf') {
      doc.save(`${this.fileSafeName(document.fileName || document.title)}.pdf`);
    } else {
      this.printDoc(doc);
    }
  }

  excel(document: InventoryExportDocument): void {
    // Single documents (invoice, challan, voucher …) get the same layout as
    // their PDF; plain grids keep the Accounts list-export layout below.
    if (this.filledFields(document).length || document.summary?.length) {
      this.documentExcel(document);
      return;
    }

    const company = this.companyDetails();
    const headerLines: string[] = [];
    if (company?.companyName) headerLines.push(company.companyName);
    if (company?.registrationAddress) headerLines.push(company.registrationAddress);
    const cinGst = this.cinGstLine(company);
    if (cinGst) headerLines.push(cinGst);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('data');
    const columns = document.columns;
    const rows = document.rows.map(row => columns.map((_, index) => String(row[index] ?? '')));
    const numCols = Math.max(columns.length, 1);

    worksheet.columns = columns.map((header, index) => {
      const longest = rows.reduce((max, row) => Math.max(max, row[index].length), header.length);
      return { header, key: `c${index}`, width: Math.min(60, Math.max(20, longest + 2)) };
    });
    worksheet.addRows(rows);

    const summary = document.summary || [];
    summary.forEach(([label, value]) => {
      const cells = columns.map(() => '');
      if (numCols >= 2) {
        cells[numCols - 2] = label;
        cells[numCols - 1] = value;
      } else {
        cells[0] = `${label} : ${value}`;
      }
      worksheet.addRow(cells);
    });

    if (headerLines.length > 0) {
      worksheet.spliceRows(1, 0, ...headerLines.map(line => [line]));
      headerLines.forEach((_, idx) => {
        const rowNum = idx + 1;
        const row = worksheet.getRow(rowNum);
        row.font = { bold: idx === 0 };
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        if (numCols > 1) worksheet.mergeCells(rowNum, 1, rowNum, numCols);
      });
    }

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    worksheet.eachRow(row => {
      row.eachCell({ includeEmpty: true }, cell => { cell.border = thinBorder; });
    });

    const columnHeaderRowNum = headerLines.length + 1;
    worksheet.getRow(columnHeaderRowNum).font = { bold: true };

    // Column alignment also rewrites the header/letterhead cells, so the
    // header row is re-centred after it.
    this.numericColumns(columns, rows).forEach(index => {
      worksheet.getColumn(index + 1).alignment = { horizontal: 'right' };
    });
    for (let rowNum = 1; rowNum <= columnHeaderRowNum; rowNum++) {
      worksheet.getRow(rowNum).alignment = { horizontal: 'center', vertical: 'middle' };
    }
    if (summary.length) {
      worksheet.getRow(worksheet.rowCount).font = { bold: true };
    }

    this.saveWorkbook(workbook, document);
  }

  // Excel twin of buildPdf() for one document: logo + letterhead, title,
  // period / branch line, the header fields as label/value pairs in two
  // columns, the item table under a #0b4093 header, then totals (and
  // signatures on vouchers) — in the same order as the PDF.
  private documentExcel(document: InventoryExportDocument): void {
    const company = this.companyDetails();
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('data');
    const columns = document.columns;
    const rows = document.rows.map(row => columns.map((_, index) => String(row[index] ?? '').replace(/₹/g, '').trim()));
    const numCols = Math.max(columns.length, 4);
    const half = Math.floor(numCols / 2);
    const numeric = new Set(this.numericColumns(columns, rows));
    const thin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    ws.columns = Array.from({ length: numCols }, (_, index) => {
      const header = columns[index] ?? '';
      const longest = rows.reduce((max, row) => Math.max(max, (row[index] ?? '').length), header.length);
      return { width: Math.min(45, Math.max(index === 0 ? 8 : 12, longest + 3)) };
    });

    const mergeRow = (rowNum: number, from: number, to: number) => {
      if (to > from) ws.mergeCells(rowNum, from, rowNum, to);
    };
    const bannerRow = (text: string, font: Partial<ExcelJS.Font>, height = 18) => {
      const row = ws.addRow([text]);
      row.height = height;
      mergeRow(row.number, 1, numCols);
      row.getCell(1).font = font;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      return row;
    };

    // Letterhead
    bannerRow(company?.companyName || '', { bold: true, size: 15 }, 24);
    if (company?.registrationAddress) bannerRow(String(company.registrationAddress), { size: 9 }, 30);
    const cinGst = this.cinGstLine(company);
    if (cinGst) bannerRow(cinGst, { size: 9 });
    const logo = String(company?.companyLogo || '');
    if (logo) {
      try {
        const format = this.imageFormat(logo);
        const imageId = workbook.addImage({
          base64: logo.includes(',') ? logo.split(',')[1] : logo,
          extension: format === 'PNG' ? 'png' : 'jpeg'
        });
        ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });
      } catch {
        // An unreadable logo must not block the export.
      }
    }
    bannerRow(document.title, { bold: true, size: 13 }, 22);

    const periodRow = ws.addRow([]);
    periodRow.getCell(1).value = document.periodText || '';
    periodRow.getCell(half + 1).value = `Branch : ${company?.branchName || ''}`;
    mergeRow(periodRow.number, 1, half);
    mergeRow(periodRow.number, half + 1, numCols);
    periodRow.getCell(half + 1).alignment = { horizontal: 'right' };
    for (let col = 1; col <= numCols; col++) {
      periodRow.getCell(col).border = { bottom: { style: 'medium' } };
    }
    ws.addRow([]);

    // Header fields — "Label : | value" pairs, two per row, as in the PDF.
    const fields = this.filledFields(document);
    for (let i = 0; i < fields.length; i += 2) {
      const row = ws.addRow([]);
      let lines = 1;
      const place = (pair: [string, string] | undefined, labelCol: number, lastCol: number) => {
        if (!pair) return;
        row.getCell(labelCol).value = `${pair[0]} :`;
        row.getCell(labelCol).font = { bold: true };
        row.getCell(labelCol + 1).value = pair[1];
        row.getCell(labelCol + 1).alignment = { wrapText: true, vertical: 'top' };
        mergeRow(row.number, labelCol + 1, lastCol);
        // Excel never auto-grows a merged cell's row, so size it for the
        // wrapped value (e.g. a full customer address) or it shows one line.
        let width = 0;
        for (let col = labelCol + 1; col <= lastCol; col++) width += ws.getColumn(col).width || 10;
        lines = Math.max(lines, Math.ceil(String(pair[1] || '').length / Math.max(width - 2, 1)));
      };
      place(fields[i], 1, half);
      place(fields[i + 1], half + 1, numCols);
      if (lines > 1) row.height = lines * 15;
    }
    if (fields.length) ws.addRow([]);

    // Item table
    const headRow = ws.addRow(columns);
    headRow.eachCell({ includeEmpty: false }, cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4093' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thin;
    });
    rows.forEach(values => {
      const row = ws.addRow(values.map((value, index) => numeric.has(index) ? this.excelNumber(value) : value));
      values.forEach((value, index) => {
        const cell = row.getCell(index + 1);
        cell.border = thin;
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: numeric.has(index) ? 'right' : (columns[index]?.trim() === '#' || /^s\.?\s*no\.?$/i.test(columns[index] || '') ? 'center' : 'left') };
        if (typeof cell.value === 'number') cell.numFmt = /\.\d/.test(value) ? '#,##0.00' : '0';
      });
    });

    // Totals on the right, last one bold — same as the PDF summary box.
    const summary = document.summary || [];
    if (summary.length) {
      ws.addRow([]);
      summary.forEach(([label, value], index) => {
        const row = ws.addRow([]);
        const labelCell = row.getCell(numCols - 1);
        const valueCell = row.getCell(numCols);
        labelCell.value = label;
        valueCell.value = value;
        const isLast = index === summary.length - 1;
        labelCell.font = { bold: true, size: isLast ? 11 : 10 };
        valueCell.font = { bold: isLast, size: isLast ? 11 : 10 };
        valueCell.alignment = { horizontal: 'right' };
        labelCell.border = thin;
        valueCell.border = thin;
      });
    }

    // Terms & Conditions, then the Bank Details | Certified / Authorised
    // Signatory box — same order as the PDF.
    const sheetWidth = (from: number, to: number) => {
      let width = 0;
      for (let col = from; col <= to; col++) width += ws.getColumn(col).width || 10;
      return Math.max(width - 2, 1);
    };
    const terms = document.terms || [];
    if (terms.length) {
      ws.addRow([]);
      ws.addRow(['Terms & Conditions :']).getCell(1).font = { bold: true };
      terms.forEach(term => {
        const row = ws.addRow([`.${term}`]);
        mergeRow(row.number, 1, numCols);
        row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
        row.getCell(1).font = { size: 9 };
        const lines = Math.ceil((term.length + 1) / sheetWidth(1, numCols));
        if (lines > 1) row.height = lines * 13;
      });
    }
    if (document.bankDetails) {
      ws.addRow([]);
      const companyName = String(company?.companyName || '').trim();
      const boxRows: Array<[string, string]> = [
        ['Bank Details :', 'Certified that the particulars given above are true and correct'],
        ...document.bankDetails.map(([label, value], index) =>
          [`${label} : ${value}`, index === 0 && companyName ? `For  ${companyName}` : ''] as [string, string]),
        ['', 'Authorised Signatory']
      ];
      const line: Partial<ExcelJS.Border> = { style: 'thin' };
      boxRows.forEach(([left, right], index) => {
        const row = ws.addRow([]);
        const isFirst = index === 0;
        const isLast = index === boxRows.length - 1;
        row.getCell(1).value = left;
        row.getCell(1).font = { bold: true, size: isFirst ? 11 : 10 };
        row.getCell(1).border = { left: line, right: line, ...(isFirst ? { top: line } : {}), ...(isLast ? { bottom: line } : {}) };
        mergeRow(row.number, 1, half);
        row.getCell(half + 1).value = right;
        row.getCell(half + 1).font = { bold: true, size: index === 1 ? 11 : isFirst ? 9 : 10 };
        // Ruled under "Certified …" and around "Authorised Signatory".
        row.getCell(half + 1).border = { left: line, right: line, ...(isFirst || isLast ? { top: line, bottom: line } : {}) };
        row.getCell(half + 1).alignment = { wrapText: true, vertical: isLast ? 'bottom' : 'top', horizontal: isLast ? 'center' : 'left' };
        mergeRow(row.number, half + 1, numCols);
        if (isLast) row.height = 40;
      });
    }

    // Notes and the "Printed on" footer are PDF-only.
    const signatures = document.signatures || [];
    if (signatures.length) {
      ws.addRow([]);
      ws.addRow([]);
      const slots = signatures.map((_, index) => Math.min(numCols, Math.floor(index * numCols / signatures.length) + 1));
      if (document.signedBy) {
        const byRow = ws.addRow([]);
        byRow.getCell(slots[slots.length - 1]).value = document.signedBy;
      }
      const capRow = ws.addRow([]);
      signatures.forEach((caption, index) => { capRow.getCell(slots[index]).value = caption; });
    }

    ws.pageSetup = { orientation: document.orientation || (columns.length > 7 ? 'landscape' : 'portrait'), fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    this.saveWorkbook(workbook, document);
  }

  private excelNumber(value: string): number | string {
    const cleaned = value.replace(/rs\.?/i, '').replace(/[,%\s]/g, '');
    return cleaned !== '' && !isNaN(Number(cleaned)) ? Number(cleaned) : value;
  }

  private saveWorkbook(workbook: ExcelJS.Workbook, document: InventoryExportDocument): void {
    workbook.xlsx.writeBuffer().then((buffer: any) => {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      });
      saveAs(blob, `${this.fileSafeName(document.fileName || document.title)}.xlsx`);
    });
  }

  private buildPdf(document: InventoryExportDocument): jsPDF {
    const orientation = document.orientation || (document.columns.length > 7 ? 'landscape' : 'portrait');
    const doc = new jsPDF({ format: 'a4', orientation });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;
    const company = this.companyDetails();

    // Letterhead — first page only, same positions/fonts as Accounts.
    const logo = company?.companyLogo || '';
    if (logo) {
      try {
        doc.addImage(logo, this.imageFormat(logo), 10, 5, 20, 20);
      } catch {
        // An unreadable logo must not block the export.
      }
    }
    doc.setTextColor('black');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(company?.companyName || '', centerX, 14, { align: 'center' });

    let y = 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const address = String(company?.registrationAddress || '').trim();
    if (address) {
      const lines = doc.splitTextToSize(address, pageWidth - 70) as string[];
      lines.forEach(line => {
        doc.text(line, centerX, y, { align: 'center' });
        y += 4.5;
      });
      y += 1.5;
    } else {
      y += 6;
    }
    const cinGst = this.cinGstLine(company);
    if (cinGst) doc.text(cinGst, centerX, y, { align: 'center' });
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(document.title, centerX, y, { align: 'center' });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (document.periodText) doc.text(document.periodText, L_MARGIN, y);
    doc.text(`Branch : ${company?.branchName || ''}`, pageWidth - R_MARGIN, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(0, 0, 0);
    doc.line(L_MARGIN, y, pageWidth - R_MARGIN, y);
    y += 3;

    const fields = this.filledFields(document);
    if (fields.length) {
      const fieldRows: string[][] = [];
      for (let i = 0; i < fields.length; i += 2) {
        const [l1, v1] = fields[i];
        const [l2, v2] = fields[i + 1] || ['', ''];
        fieldRows.push([l1 ? `${l1} :` : '', v1 || '', l2 ? `${l2} :` : '', v2 || '']);
      }
      autoTable(doc, {
        body: fieldRows,
        theme: 'plain',
        startY: y,
        margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
        styles: { fontSize: 9, cellPadding: 0.8, overflow: 'linebreak' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 38 },
          2: { fontStyle: 'bold', cellWidth: 38 }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 3;
    }

    const numeric = this.numericColumns(document.columns, document.rows);
    const columnStyles: Record<number, any> = {};
    numeric.forEach(index => { columnStyles[index] = { halign: 'right' }; });
    document.columns.forEach((header, index) => {
      if (header.trim() === '#' || /^s\.?\s*no\.?$/i.test(header.trim())) {
        columnStyles[index] = { halign: 'center', cellWidth: 12 };
      }
    });

    autoTable(doc, {
      head: [document.columns],
      body: document.rows.map(row => document.columns.map((_, index) => String(row[index] ?? '').replace(/₹/g, '').trim())),
      theme: 'grid',
      startY: y,
      margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
      headStyles: { fillColor: HEADER_COLOR, textColor: 255, halign: 'center', valign: 'middle', fontSize: 10 },
      styles: { fontSize: 8, cellPadding: 0.8, overflow: 'linebreak', valign: 'middle' } as any,
      columnStyles,
      rowPageBreak: 'avoid',
      showHead: 'everyPage'
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    const summary = document.summary || [];
    const notes = String(document.notes || '').trim();
    let blockEnd = y;
    if (summary.length || notes) {
      const blockHeight = Math.max(summary.length * 5 + 6, notes ? 14 : 0);
      if (y + blockHeight > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }
      blockEnd = y;
      const summaryWidth = 80;
      if (notes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${document.notesLabel || 'Notes'} :`, L_MARGIN, y + 3);
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(notes, pageWidth - L_MARGIN - R_MARGIN - summaryWidth - 10) as string[];
        doc.text(noteLines, L_MARGIN, y + 8);
        blockEnd = Math.max(blockEnd, y + 8 + noteLines.length * 4);
      }
      if (summary.length) {
        autoTable(doc, {
          body: summary.map(([label, value]) => [label, value]),
          theme: 'grid',
          startY: y,
          margin: { left: pageWidth - R_MARGIN - summaryWidth, right: R_MARGIN, top: 15, bottom: 15 },
          tableWidth: summaryWidth,
          styles: { fontSize: 9, cellPadding: 1 },
          columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
          didParseCell: data => {
            if (data.row.index === summary.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fontSize = 10;
            }
          }
        });
        blockEnd = Math.max(blockEnd, (doc as any).lastAutoTable.finalY);
      }
    }

    const terms = document.terms || [];
    if (terms.length || document.bankDetails) {
      y = blockEnd + 5;
      // Terms and the bank box move to a new page together, never split.
      const termsHeight = terms.length ? this.pdfTermsHeight(doc, terms) + 2 : 0;
      if (y + termsHeight + (document.bankDetails ? BANK_BOX_HEIGHT : 0) > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }
      if (terms.length) y = this.drawPdfTerms(doc, terms, y) + 2;
      if (document.bankDetails) this.drawPdfBankBox(doc, document.bankDetails, y);
    }

    const signatures = document.signatures || [];
    if (signatures.length) {
      const lastY = summary.length ? (doc as any).lastAutoTable.finalY : y;
      let signY = Math.max(lastY, y) + 25;
      if (signY > pageHeight - 20) {
        doc.addPage();
        signY = 40;
      }
      const slot = (pageWidth - L_MARGIN - R_MARGIN) / signatures.length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      signatures.forEach((caption, index) => {
        const x = L_MARGIN + slot * index + slot / 2;
        if (index === signatures.length - 1 && document.signedBy) {
          doc.text(document.signedBy, x, signY - 6, { align: 'center' });
        }
        doc.text(caption, x, signY, { align: 'center' });
      });
    }

    // Footer on every page — "Printed on: <date>, User: <name>" + "Page N of M".
    const printedOn = formatDate(new Date(), 'dd-MMM-yyyy h:mm:ss a', 'en-US');
    const user = this.userName();
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor('black');
      doc.setDrawColor(0, 0, 0);
      doc.line(L_MARGIN, pageHeight - 10, pageWidth - R_MARGIN, pageHeight - 10);
      doc.text(`Printed on: ${printedOn}, User: ${user}`, L_MARGIN, pageHeight - 5);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - R_MARGIN, pageHeight - 5, { align: 'right' });
    }
    return doc;
  }

  // "Terms & Conditions :" heading + one dot-prefixed line per term, wrapped
  // to the page width; returns the y below the last line.
  private drawPdfTerms(doc: jsPDF, terms: string[], y: number): number {
    const lines = this.pdfTermsLines(doc, terms);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Terms & Conditions :', L_MARGIN, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    lines.forEach((line, index) => doc.text(line, L_MARGIN, y + 7 + index * TERMS_LINE_HEIGHT));
    return y + this.pdfTermsHeight(doc, terms);
  }

  private pdfTermsHeight(doc: jsPDF, terms: string[]): number {
    return 7 + this.pdfTermsLines(doc, terms).length * TERMS_LINE_HEIGHT;
  }

  private pdfTermsLines(doc: jsPDF, terms: string[]): string[] {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    return terms.flatMap(term => doc.splitTextToSize(`.${term}`, pageWidth - L_MARGIN - R_MARGIN) as string[]);
  }

  // Boxed footer as on the earlier sale invoice report: Bank Details on the
  // left, a blank middle column, and "Certified …" / "For <Company>" /
  // Authorised Signatory on the right.
  private drawPdfBankBox(doc: jsPDF, bankDetails: Array<[string, string]>, y: number): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const width = pageWidth - L_MARGIN - R_MARGIN;
    if (y + BANK_BOX_HEIGHT > pageHeight - 15) {
      doc.addPage();
      y = 15;
    }
    const company = String(this.companyDetails()?.companyName || '').trim();
    const body = [
      ['Bank Details :', '', 'Certified that the particulars given above are true and correct'],
      ...bankDetails.map(([label, value], index) => [`${label} : ${value}`, '', index === 0 && company ? `For  ${company}` : '']),
      ['', '', 'Authorised Signatory']
    ];
    const lastRow = body.length - 1;
    const widths = [width * 0.36, width * 0.2, width * 0.44];
    autoTable(doc, {
      body,
      theme: 'plain',
      startY: y,
      margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
      tableWidth: width,
      pageBreak: 'avoid',
      styles: { fontSize: 9, fontStyle: 'bold', cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: widths[0] }, 1: { cellWidth: widths[1] }, 2: { cellWidth: widths[2] } },
      didParseCell: data => {
        if (data.row.index === 0 && data.column.index === 0) data.cell.styles.fontSize = 10;
        if (data.row.index === 0 && data.column.index === 2) data.cell.styles.fontSize = 8;
        if (data.row.index === 1 && data.column.index === 2) data.cell.styles.fontSize = 11;
        if (data.row.index === lastRow) {
          data.cell.styles.minCellHeight = 14;
          data.cell.styles.valign = 'bottom';
          if (data.column.index === 2) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontSize = 10;
          }
        }
      },
      didDrawCell: data => {
        const { x, y: cellY, width: cellWidth, height } = data.cell;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        // Rule under "Certified …" and above "Authorised Signatory".
        if (data.row.index === 0 && data.column.index === 2) doc.line(x, cellY + height, x + cellWidth, cellY + height);
        if (data.row.index === lastRow && data.column.index > 0) doc.line(x, cellY + height - 7, x + cellWidth, cellY + height - 7);
      }
    });
    const end = (doc as any).lastAutoTable.finalY;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(L_MARGIN, y, width, end - y);
    doc.line(L_MARGIN + widths[0], y, L_MARGIN + widths[0], end);
    doc.line(L_MARGIN + widths[0] + widths[1], y, L_MARGIN + widths[0] + widths[1], end);
  }

  private printDoc(doc: jsPDF): void {
    // Earlier print frames are dropped only after a delay: an SI + DC posted
    // together print back to back, and removing the first frame immediately
    // would cancel its print dialog.
    document.querySelectorAll('iframe.inventory-print-frame').forEach(frame => {
      if (Date.now() - Number((frame as HTMLElement).dataset['created'] || 0) > 60000) frame.remove();
    });
    const iframe = document.createElement('iframe');
    iframe.className = 'inventory-print-frame';
    iframe.dataset['created'] = String(Date.now());
    iframe.setAttribute('style', 'display: none;');
    iframe.onload = () => iframe.contentWindow?.print();
    iframe.src = String(doc.output('bloburl'));
    document.body.appendChild(iframe);
  }

  private filledFields(document: InventoryExportDocument): Array<[string, string]> {
    return (document.fields || [])
      .filter(([label, value]) => !!label && String(value ?? '').trim() !== '')
      .map(([label, value]) => [label, String(value)]);
  }

  private numericColumns(columns: string[], rows: string[][]): number[] {
    return columns
      .map((header, index) => ({ header, index }))
      .filter(({ header, index }) => {
        if (header.trim() === '#' || CODE_HEADER.test(header)) return false;
        const values = rows.map(row => String(row[index] ?? '').trim()).filter(v => v && v !== '-');
        return values.length > 0 && values.every(v => NUMERIC_CELL.test(v));
      })
      .map(({ index }) => index);
  }

  private companyDetails(): any {
    try {
      const raw = sessionStorage.getItem('CompanyDetails');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed[0] : parsed) || {};
    } catch {
      return {};
    }
  }

  private cinGstLine(company: any): string {
    const parts: string[] = [];
    if (company?.cinNumber) parts.push(`CIN : ${company.cinNumber}`);
    if (company?.gstNumber) parts.push(`GST NO : ${company.gstNumber}`);
    return parts.join('   ');
  }

  userName(): string {
    const read = (key: string) => {
      try { return JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch { return {}; }
    };
    const authUser = read('authUser');
    const currentUser = read('currentUser');
    return String(authUser.fullName || currentUser.pEmployeeName || sessionStorage.getItem('username') || '');
  }

  private imageFormat(dataUrl: string): string {
    const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl);
    if (!match) return 'JPEG';
    const type = match[1].toUpperCase();
    return type === 'JPG' ? 'JPEG' : type;
  }

  private fileSafeName(value: string): string {
    return String(value || 'Inventory').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100) || 'Inventory';
  }
}
