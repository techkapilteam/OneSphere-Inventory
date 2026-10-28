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
  /** PDF only: draw the notes (label + text) inside a bordered box (Customer Receipt narration). */
  notesBoxed?: boolean;
  /** Amount in words — "Total Invoice Amount In Words" left of the totals
   *  (invoices, default), or an "Amount in Words :" line under them (vouchers). */
  amountInWords?: string;
  /** 'box': one ruled box joined to the grid — "Total Invoice Amount In
   *  Words" on the left, `summary` on the right (Sales Invoice). */
  amountInWordsPosition?: 'left' | 'below' | 'box';
  /** GST tax-invoice grid (Sales Invoice): [title, span] pairs covering every
   *  column, printed as a header row above `columns`; a span-1 group prints
   *  its column's header across both rows. The grid is then ruled in black
   *  with a plain header instead of the #0b4093 one. */
  columnGroups?: Array<[string, number]>;
  /** Bold Total row printed as the grid's last row; the blank cells after
   *  its first cell merge into it. */
  totalRow?: string[];
  /** PDF only: shrink text and spacing step by step until the whole document
   *  fits on one page (Sales Invoice). */
  fitOnePage?: boolean;
  /** Copy type printed at the top right, on the title line (Sales Invoice),
   *  e.g. "Original for Recipient" / "Duplicate for Recipient". */
  copyType?: string;
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
  /** PDF only: print the signature row in the lower part of the last page, ~7 cm above the page bottom (Customer Receipt). */
  signaturesAtBottom?: boolean;
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  /** PDF only: fixed width (mm) per column index, for values that can't wrap
   *  (e.g. voucher numbers with no spaces). Unlisted columns size automatically. */
  pdfColumnWidths?: Record<number, number>;
  /** PDF only: table header font size (default 10) — smaller lets wide lists fit portrait. */
  pdfHeadFontSize?: number;

  /** Invoice layout (Purchase Invoice): "Total Invoice Amount In Words" (and notes)
   *  on the left and the totals on the right, in ONE bordered block joined
   *  directly under the items table (like the old printed invoice). */
  gstInvoiceLayout?: boolean;
  /** With gstInvoiceLayout: the old-invoice signature row under the totals:
   *  empty box | Common Seal | Certified … / For <Company> / Authorised Signatory. */
  signatureBlock?: boolean;
    /** Rows (indexes in `rows`) that are group headers / subtotals: printed bold and shaded. */
  groupRowIndexes?: number[];
}

const HEADER_COLOR = '#0b4093';
const L_MARGIN = 15;
const R_MARGIN = 15;
const CODE_HEADER = /\b(no\.?|number|code|phone|mobile|pin|gstin|pan|hsn|sac|id)\b/i;
const TERMS_LINE_HEIGHT = 3.6;
/** Rendered height (mm) of the Bank Details / Authorised Signatory box. */
// Previous: 46 (4 bank rows); +Account Name row, which can wrap.
// Previous: 58 — the box really prints ~62mm (two-line "Certified …" and
// "For <Company>"), so it passed the fit check and then broke onto a new page.
// Previous: 64 — row padding 1.5 -> 1.2 so the Sales Invoice fits one page.
//const BANK_BOX_HEIGHT = 60;
/** Text/spacing scales tried in turn for a fitOnePage document. */
const ONE_PAGE_SCALES = [1, 0.92, 0.85, 0.78, 0.7, 0.62];
const BANK_BOX_HEIGHT = 58;
const SIGNATURE_ROW_HEIGHT = 32;
const NUMERIC_CELL =/^-?(rs\.?\s*|₹\s*)?-?[\d,]+(\.\d+)?\s*%?$/i;

@Injectable({ providedIn: 'root' })
export class InventoryExportService {

  /** Text/spacing scale of the PDF being built (1 = normal); see fitOnePage. */
  private pdfScale = 1;

  // 'Open': show the PDF in a new browser tab (the browser's own PDF viewer).
  // If the browser blocks the new tab, the PDF is downloaded instead.
  // Previous: pdf(document: InventoryExportDocument, mode: 'Pdf' | 'Print'): void {
  pdf(document: InventoryExportDocument, mode: 'Pdf' | 'Print' | 'Open'): void {
    // Previous: const doc = this.buildPdf(document);
    const doc = this.buildPdfFitted(document);
    if (mode === 'Open') {
      const tab = window.open(String(doc.output('bloburl')), '_blank');
      if (!tab) doc.save(`${this.fileSafeName(document.fileName || document.title)}.pdf`);
    } else if (mode === 'Pdf') {
    // Previous: if (mode === 'Pdf') {
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
    periodRow.getCell(half + 1).font = { bold: true };
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
    const groups = document.columnGroups || [];
    if (groups.length) {
      // Tax-invoice grid: group row over the column headers, plain and ruled
      // like the PDF.
      const top = ws.addRow([]);
      const sub = ws.addRow([]);
      let col = 1;
      groups.forEach(([title, span]) => {
        if (span > 1) {
          top.getCell(col).value = title;
          columns.slice(col - 1, col - 1 + span).forEach((header, i) => { sub.getCell(col + i).value = header; });
          mergeRow(top.number, col, col + span - 1);
        } else {
          top.getCell(col).value = columns[col - 1] ?? title;
          ws.mergeCells(top.number, col, sub.number, col);
        }
        col += span;
      });
      [top, sub].forEach(row => {
        for (let c = 1; c <= columns.length; c++) {
          const cell = row.getCell(c);
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = thin;
        }
      });
    } else {
    const headRow = ws.addRow(columns);
    headRow.eachCell({ includeEmpty: false }, cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4093' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thin;
    });
    }
    rows.forEach(values => {
      const row = ws.addRow(values.map((value, index) => numeric.has(index) ? this.excelNumber(value) : value));
      values.forEach((value, index) => {
        const cell = row.getCell(index + 1);
        cell.border = thin;
        cell.alignment = { vertical: 'top', wrapText: true, horizontal: numeric.has(index) ? 'right' : (columns[index]?.trim() === '#' || /^s\.?\s*no\.?$/i.test(columns[index] || '') ? 'center' : 'left') };
        if (typeof cell.value === 'number') cell.numFmt = /\.\d/.test(value) ? '#,##0.00' : '0';
      });
    });
    if (document.totalRow) {
      const totals = columns.map((_, index) => String(document.totalRow![index] ?? ''));
      const row = ws.addRow(totals.map((value, index) => index > 0 && numeric.has(index) ? this.excelNumber(value) : value));
      totals.forEach((_, index) => {
        const cell = row.getCell(index + 1);
        cell.border = thin;
        cell.font = { bold: true };
        cell.alignment = { horizontal: index === 0 ? 'center' : 'right' };
        if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      });
      mergeRow(row.number, 1, this.totalRowSpan(totals, columns.length));
    }

    // Totals on the right, last one bold — same as the PDF summary box.
    const summary = document.summary || [];
    const wordsBox = document.amountInWordsPosition === 'box';
    if (summary.length) {
      // Previous: ws.addRow([]);
      if (!wordsBox) ws.addRow([]);
      const firstSummaryRow = ws.rowCount + 1;
      summary.forEach(([label, value], index) => {
        const row = ws.addRow([]);
        const labelCell = row.getCell(numCols - 1);
        const valueCell = row.getCell(numCols);
        labelCell.value = label;
        valueCell.value = value;
        // Previous: const isLast = index === summary.length - 1;
        // Grand Total stays the bold row when Previous Balance follows it.
        const grandTotalIndex = summary.findIndex(([l]) => /^grand total$/i.test(String(l).trim()));
        const isLast = index === (grandTotalIndex >= 0 ? grandTotalIndex : summary.length - 1);
        labelCell.font = { bold: true, size: isLast ? 11 : 10 };
        valueCell.font = { bold: isLast, size: isLast ? 11 : 10 };
        valueCell.alignment = { horizontal: 'right' };
        labelCell.border = thin;
        valueCell.border = thin;
      });
      if (wordsBox && numCols > 2) {
        // "Total Invoice Amount In Words" box left of the totals, as in the PDF.
        const titleCell = ws.getCell(firstSummaryRow, 1);
        titleCell.value = 'Total Invoice Amount In Words';
        titleCell.font = { bold: true, size: 11 };
        titleCell.border = thin;
        mergeRow(firstSummaryRow, 1, numCols - 2);
        if (summary.length > 1) {
          const notes = String(document.notes || '').trim();
          const wordsCell = ws.getCell(firstSummaryRow + 1, 1);
          wordsCell.value = [String(document.amountInWords || '').toUpperCase(), notes ? `${document.notesLabel || 'Notes'} : ${notes}` : '']
            .filter(Boolean).join('\n\n');
          wordsCell.alignment = { wrapText: true, vertical: 'top' };
          wordsCell.border = thin;
          ws.mergeCells(firstSummaryRow + 1, 1, firstSummaryRow + summary.length - 1, numCols - 2);
        }
      }
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

  // A fitOnePage document is rebuilt with smaller text and spacing until it
  // fits on one page; the last (smallest) try is kept if none does.
  private buildPdfFitted(document: InventoryExportDocument): jsPDF {
    if (!document.fitOnePage) return this.buildPdf(document);
    let doc!: jsPDF;
    try {
      for (const scale of ONE_PAGE_SCALES) {
        this.pdfScale = scale;
        doc = this.buildPdf(document);
        if (doc.getNumberOfPages() === 1) break;
      }
    } finally {
      this.pdfScale = 1;
    }
    return doc;
  }

  private buildPdf(document: InventoryExportDocument): jsPDF {
    const s = this.pdfScale;
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
    if (document.copyType) {
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9);
      doc.text(document.copyType, pageWidth - R_MARGIN, y, { align: 'right' });
    }
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (document.periodText) doc.text(document.periodText, L_MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`Branch : ${company?.branchName || ''}`, pageWidth - R_MARGIN, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
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
      // Both value columns get a fixed, equal width; left to auto-size, a long
      // right-hand value (e.g. Mode of Payment) squeezed the left one until
      // no-space values like PAY-SS-26-00011 overflowed into the next label.
      const valueWidth = (pageWidth - L_MARGIN - R_MARGIN - 76) / 2;
      autoTable(doc, {
        body: fieldRows,
        theme: 'plain',
        startY: y,
        margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
        // Previous: styles: { fontSize: 9, cellPadding: 0.8, overflow: 'linebreak' },
        styles: { fontSize: 9 * s, cellPadding: 0.8 * s, overflow: 'linebreak' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 38 },
          1: { cellWidth: valueWidth },
          2: { fontStyle: 'bold', cellWidth: 38 },
          3: { cellWidth: valueWidth }
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
    Object.entries(document.pdfColumnWidths || {}).forEach(([index, width]) => {
      columnStyles[+index] = { ...columnStyles[+index], cellWidth: width };
    });

    const taxGrid = !!document.columnGroups?.length;
    const bodyRows: any[][] = document.rows.map(row => document.columns.map((_, index) => String(row[index] ?? '').replace(/₹/g, '').trim()));
    if (document.totalRow) {
      const span = this.totalRowSpan(document.totalRow, document.columns.length);
      bodyRows.push([{ content: document.totalRow[0], colSpan: span, styles: { halign: 'center' } }, ...document.totalRow.slice(span)]);
    }
    if (taxGrid) {
      columnStyles[1] = { ...columnStyles[1], minCellWidth: 28 };
      // Rate % cells sit centred under their heading, as on the old invoice.
      document.columns.forEach((header, index) => {
        if (/%/.test(header)) columnStyles[index] = { ...columnStyles[index], halign: 'center' };
      });
    }

    autoTable(doc, {
      // Previous: head: [document.columns],
      head: taxGrid ? this.pdfGroupedHead(document.columns, document.columnGroups!) : [document.columns],
      // Previous: body: document.rows.map(row => document.columns.map((_, index) => String(row[index] ?? '').replace(/₹/g, '').trim())),
      body: bodyRows,
      theme: 'grid',
      startY: y,
      margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
      // Previous: headStyles: { fillColor: HEADER_COLOR, textColor: 255, halign: 'center', valign: 'middle', fontSize: document.pdfHeadFontSize || 10 },
      headStyles: taxGrid
        ? { fillColor: 255, textColor: 0, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: (document.pdfHeadFontSize || 8) * s, cellPadding: 0.8 * s, lineColor: 0, lineWidth: 0.2 }
        : { fillColor: HEADER_COLOR, textColor: 255, halign: 'center', valign: 'middle', fontSize: document.pdfHeadFontSize || 10 },
      // Previous: styles: { fontSize: 8, cellPadding: 0.8, overflow: 'linebreak', valign: 'middle' } as any,
      styles: taxGrid
        ? { fontSize: 7.5 * s, cellPadding: 0.8 * s, overflow: 'linebreak', valign: 'top', lineColor: 0, lineWidth: 0.2, textColor: 0 } as any
        : { fontSize: 8, cellPadding: 0.8, overflow: 'linebreak', valign: 'middle' } as any,
      columnStyles,
      didParseCell: (data: any) => {
        if (document.totalRow && data.section === 'body' && data.row.index === bodyRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8.5 * s;
        }
        // Group headers / subtotals (report "Group by"): bold, shaded.
        if (data.section === 'body' && (document.groupRowIndexes || []).includes(data.row.index)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 238, 250];
        }
      },
      rowPageBreak: 'avoid',
      showHead: 'everyPage'
    });
    // Previous: y = (doc as any).lastAutoTable.finalY + 6;
    const wordsBox = document.amountInWordsPosition === 'box';
    y = (doc as any).lastAutoTable.finalY + (wordsBox ? 0 : 6);

        // Invoice layout (Purchase Invoice): words + totals joined under the table,
    // then the signature row. The blocks below are then skipped for this document.
    const joined = !!document.gstInvoiceLayout;
    if (joined) {
      const joinedEnd = this.drawPdfJoinedTotals(doc, document, (doc as any).lastAutoTable.finalY);
      if (document.signatureBlock) this.drawPdfSignatureRow(doc, joinedEnd);
    }
    const summary = joined ? [] : (document.summary || []);
    const notes = joined ? '' : String(document.notes || '').trim();
    const amountInWords = joined ? '' : String(document.amountInWords || '').trim();
    const wordsBelow = document.amountInWordsPosition === 'below';
    // Previous: const wordsLeft = wordsBelow ? '' : amountInWords;
    const wordsLeft = wordsBelow || wordsBox ? '' : amountInWords;
    let blockEnd = y;
    if (wordsBox && summary.length) {
      blockEnd = this.drawPdfWordsBox(doc, amountInWords, notes ? `${document.notesLabel || 'Notes'} : ${notes}` : '', summary, y);
    // Previous: if (summary.length || notes) {
    } else if (summary.length || notes || wordsLeft) {
      // Previous: const blockHeight = Math.max(summary.length * 5 + 6, notes ? 14 : 0);
      const blockHeight = Math.max(summary.length * 5 + 6, (notes ? 14 : 0) + (wordsLeft ? 14 : 0));
      if (y + blockHeight > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }
      blockEnd = y;
      const summaryWidth = 80;
      // Left of the totals: notes.
      let leftY = y;
      if (wordsLeft) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Total Invoice Amount In Words :', L_MARGIN, leftY + 3);
        doc.setFont('helvetica', 'normal');
        const wordLines = doc.splitTextToSize(wordsLeft,pageWidth - L_MARGIN - R_MARGIN - summaryWidth - 10) as string[];
        doc.text(wordLines, L_MARGIN, leftY + 8);
        leftY = leftY + 8 + wordLines.length * 4 + 2;
        blockEnd = Math.max(blockEnd, leftY);
      }
      if (notes && document.notesBoxed) {
        // Customer Receipt: "Narration :" and its text inside a bordered box,
        // as tall as the totals box beside it (at least), with inner padding.
        const pad = 2;
        const boxWidth = pageWidth - L_MARGIN - R_MARGIN - summaryWidth - 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${document.notesLabel || 'Notes'} :`, L_MARGIN + pad, leftY + 3 + pad);
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(notes, boxWidth - pad * 2) as string[];
        doc.text(noteLines, L_MARGIN + pad, leftY + 8 + pad);
        const boxHeight = Math.max(10 + pad * 2 + (noteLines.length - 1) * 4, summary.length * 5 + 2);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        doc.rect(L_MARGIN, leftY, boxWidth, boxHeight);
        blockEnd = Math.max(blockEnd, leftY + boxHeight);
      } else if (notes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        // Previous: doc.text(`${document.notesLabel || 'Notes'} :`, L_MARGIN, y + 3);
        doc.text(`${document.notesLabel || 'Notes'} :`, L_MARGIN, leftY + 3);
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(notes, pageWidth - L_MARGIN - R_MARGIN - summaryWidth - 10) as string[];
        // Previous: doc.text(noteLines, L_MARGIN, y + 8);
        // Previous: blockEnd = Math.max(blockEnd, y + 8 + noteLines.length * 4);
        doc.text(noteLines, L_MARGIN, leftY + 8);
        blockEnd = Math.max(blockEnd, leftY + 8 + noteLines.length * 4);
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

    if (wordsBelow && amountInWords) {
      const label = 'Amount in Words : ';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const labelWidth = doc.getTextWidth(label);
      doc.setFont('helvetica', 'normal');
      const wordLines = doc.splitTextToSize(amountInWords, pageWidth - L_MARGIN - R_MARGIN - labelWidth) as string[];
      let wordsY = blockEnd + 6;
      if (wordsY + wordLines.length * 4 > pageHeight - 15) {
        doc.addPage();
        wordsY = 18;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(label, L_MARGIN, wordsY);
      doc.setFont('helvetica', 'normal');
      doc.text(wordLines, L_MARGIN + labelWidth, wordsY);
      blockEnd = wordsY + (wordLines.length - 1) * 4 + 2;
      y = blockEnd;
    }

    const terms = document.terms || [];
    if (terms.length || document.bankDetails) {
      // Previous: y = blockEnd + 5;
      y = blockEnd + (document.fitOnePage ? 3 : 5) * s;
      // Terms and the bank box move to a new page together, never split.
      const termsHeight = terms.length ? this.pdfTermsHeight(doc, terms) + 2 : 0;
      // Previous: if (y + termsHeight + (document.bankDetails ? BANK_BOX_HEIGHT : 0) > pageHeight - 15) {
      if (y + termsHeight + (document.bankDetails ? BANK_BOX_HEIGHT * s : 0) > pageHeight - 15) {
        doc.addPage();
        y = 15;
      }
      if (terms.length) y = this.drawPdfTerms(doc, terms, y) + 2;
      if (document.bankDetails) this.drawPdfBankBox(doc, document.bankDetails, y);
    }

    const signatures = joined ? [] : (document.signatures || []);
    if (signatures.length) {
      const lastY = summary.length ? (doc as any).lastAutoTable.finalY : y;
      // Previous: let signY = Math.max(lastY, y) + 25;
      // signaturesAtBottom: captions in the lower part of the page, ~7 cm above
      // the page bottom (footer line is at pageHeight - 10); on a new page only
      // if the content already reaches that area.
      const bottomSignY = pageHeight - 70;
      let signY = document.signaturesAtBottom
        ? (Math.max(lastY, y) + 20 > bottomSignY ? -1 : bottomSignY)
        : Math.max(lastY, y) + 25;
      if (signY === -1) {
        doc.addPage();
        signY = bottomSignY;
      } else if (!document.signaturesAtBottom && signY > pageHeight - 20) {
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

  // Two header rows for a grouped grid: a group spanning several columns
  // prints its title over their own headers (CGST over Rate % | Amount);
  // a single-column group prints that column's header across both rows.
  private pdfGroupedHead(columns: string[], groups: Array<[string, number]>): any[][] {
    const top: any[] = [];
    const sub: any[] = [];
    let index = 0;
    groups.forEach(([title, span]) => {
      if (span > 1) {
        top.push({ content: title, colSpan: span });
        sub.push(...columns.slice(index, index + span));
      } else {
        top.push({ content: columns[index] ?? title, rowSpan: 2 });
      }
      index += span;
    });
    return [top, sub];
  }

  /** Columns the Total row's first cell covers: itself plus the blanks after it. */
  private totalRowSpan(totalRow: string[], columnCount: number): number {
    const next = totalRow.slice(1).findIndex(value => String(value ?? '') !== '');
    return next < 0 ? Math.max(columnCount, 1) : next + 1;
  }

  // Ruled box under a tax-invoice grid, as on the old sale invoice report:
  // "Total Invoice Amount In Words" with the words (and notes) under it on
  // the left, the tax totals as label | value rows on the right, last bold.
  // Returns the y below the box.
  private drawPdfWordsBox(doc: jsPDF, words: string, notes: string, summary: Array<[string, string]>, y: number): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const width = pageWidth - L_MARGIN - R_MARGIN;
    const labelWidth = 52;
    const valueWidth = 32;
    const s = this.pdfScale;
    const leftText = [words.toUpperCase(), notes].filter(Boolean).join('\n\n');
    const body: any[][] = summary.map(([label, value], index) => {
      const cells: any[] = [`${label} :`, value];
      if (index === 0) cells.unshift({ content: 'Total Invoice Amount In Words', styles: { fontStyle: 'bold', fontSize: 10 * s } });
      if (index === 1) cells.unshift({ content: leftText, rowSpan: summary.length - 1, styles: { fontSize: 8 * s } });
      return cells;
    });
    // Bold row: Grand Total when there is one (rows such as Previous Balance
    // can follow it), else the last row.
    // Previous: const last = summary.length - 1;
    const grandTotal = summary.findIndex(([label]) => /^grand total$/i.test(String(label).trim()));
    const last = grandTotal >= 0 ? grandTotal : summary.length - 1;
    autoTable(doc, {
      body,
      theme: 'grid',
      startY: y,
      margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
      tableWidth: width,
      pageBreak: 'avoid',
      // Previous cellPadding: 1.2 (tightened so the invoice fits one page).
      styles: { fontSize: 9 * s, cellPadding: 0.9 * s, overflow: 'linebreak', valign: 'top', lineColor: 0, lineWidth: 0.2, textColor: 0 },
      columnStyles: {
        0: { cellWidth: width - labelWidth - valueWidth },
        1: { cellWidth: labelWidth, fontStyle: 'bold' },
        2: { cellWidth: valueWidth, halign: 'right' }
      },
      didParseCell: data => {
        if (data.row.index === last && data.column.index > 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10 * s;
        }
      }
    });
    return (doc as any).lastAutoTable.finalY;
  }

  // "Terms & Conditions :" heading + one dot-prefixed line per term, wrapped
  // to the page width; returns the y below the last line.
  private drawPdfTerms(doc: jsPDF, terms: string[], y: number): number {
    const s = this.pdfScale;
    const lines = this.pdfTermsLines(doc, terms);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9 * s);
    doc.text('Terms & Conditions :', L_MARGIN, y + 3 * s);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8 * s);
    lines.forEach((line, index) => doc.text(line, L_MARGIN, y + 7 * s + index * TERMS_LINE_HEIGHT * s));
    return y + this.pdfTermsHeight(doc, terms);
  }

  private pdfTermsHeight(doc: jsPDF, terms: string[]): number {
    return (7 + this.pdfTermsLines(doc, terms).length * TERMS_LINE_HEIGHT) * this.pdfScale;
  }

  private pdfTermsLines(doc: jsPDF, terms: string[]): string[] {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8 * this.pdfScale);
    return terms.flatMap(term => doc.splitTextToSize(`.${term}`, pageWidth - L_MARGIN - R_MARGIN) as string[]);
  }

  // Boxed footer as on the earlier sale invoice report: Bank Details on the
  // left, a blank middle column, and "Certified …" / "For <Company>" /
  // Authorised Signatory on the right.
  private drawPdfBankBox(doc: jsPDF, bankDetails: Array<[string, string]>, y: number): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const width = pageWidth - L_MARGIN - R_MARGIN;
    const s = this.pdfScale;
    // Previous: if (y + BANK_BOX_HEIGHT > pageHeight - 15) {
    if (y + BANK_BOX_HEIGHT * s > pageHeight - 15) {
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
    // Where the table really starts: if it still moves to a new page, the
    // outline must be drawn there, not at the y it was given.
    let boxTop = y;
    // Previous: [0.36, 0.2, 0.44] — "Account Name : <company>" wrapped onto two
    // lines; the blank middle column gives up its width so it stays on one.
    const widths = [width * 0.54, width * 0.02, width * 0.44];
    autoTable(doc, {
      body,
      theme: 'plain',
      startY: y,
      margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
      tableWidth: width,
      pageBreak: 'avoid',
      // Previous: styles: { fontSize: 9, fontStyle: 'bold', cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, overflow: 'linebreak' },
      styles: { fontSize: 9 * s, fontStyle: 'bold', cellPadding: { top: 1.2 * s, bottom: 1.2 * s, left: 2, right: 2 }, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: widths[0] }, 1: { cellWidth: widths[1] }, 2: { cellWidth: widths[2] } },
      didParseCell: data => {
        if (data.row.index === 0 && data.column.index === 0) data.cell.styles.fontSize = 10 * s;
        if (data.row.index === 0 && data.column.index === 2) data.cell.styles.fontSize = 8 * s;
        if (data.row.index === 1 && data.column.index === 2) data.cell.styles.fontSize = 11 * s;
        if (data.row.index === lastRow) {
          data.cell.styles.minCellHeight = 14 * s;
          data.cell.styles.valign = 'bottom';
          if (data.column.index === 2) {
            data.cell.styles.halign = 'center';
            data.cell.styles.fontSize = 10 * s;
          }
        }
      },
      didDrawCell: data => {
        const { x, y: cellY, width: cellWidth, height } = data.cell;
        if (data.row.index === 0 && data.column.index === 0) boxTop = cellY;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        // Rule under "Certified …" and above "Authorised Signatory".
        if (data.row.index === 0 && data.column.index === 2) doc.line(x, cellY + height, x + cellWidth, cellY + height);
        // Previous: rule at height - 7.
        if (data.row.index === lastRow && data.column.index > 0) doc.line(x, cellY + height - 7 * s, x + cellWidth, cellY + height - 7 * s);
      }
    });
    const end = (doc as any).lastAutoTable.finalY;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    // Previous: drawn from y, which was the old page's position after a break.
    doc.rect(L_MARGIN, boxTop, width, end - boxTop);
    doc.line(L_MARGIN + widths[0], boxTop, L_MARGIN + widths[0], end);
    doc.line(L_MARGIN + widths[0] + widths[1], boxTop, L_MARGIN + widths[0] + widths[1], end);
  }

    // Point 7: one bordered block joined directly under the items table:
  // left = "Total Invoice Amount In Words" (+ notes), right = the totals.
  private drawPdfJoinedTotals(doc: jsPDF, document: InventoryExportDocument, startY: number): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const width = pageWidth - L_MARGIN - R_MARGIN;
    const leftWidth = width * 0.55;
    const labelWidth = width * 0.27;
    const valueWidth = width - leftWidth - labelWidth;
    const summary = document.summary || [];
    const words = String(document.amountInWords || '').trim();
    const notes = String(document.notes || '').trim();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const wordLines = words ? doc.splitTextToSize(words, leftWidth - 4) as string[] : [];
    const noteLines = notes ? doc.splitTextToSize(notes, leftWidth - 4) as string[] : [];
    const leftHeight = 4 + (words ? 5 + wordLines.length * 4 : 0) + (notes ? 6 + noteLines.length * 4 : 0) + 2;

    const rows: Array<[string, string]> = summary.length ? summary : [['', '']];
    const body: any[] = rows.map(([label, value], index) => index === 0
      ? [{ content: '', rowSpan: rows.length, styles: { minCellHeight: leftHeight } }, label, value]
      : [label, value]);

    autoTable(doc, {
      body,
      theme: 'grid',
      startY,
      pageBreak: 'avoid',
      margin: { left: L_MARGIN, right: R_MARGIN, top: 15, bottom: 15 },
      tableWidth: width,
      styles: { fontSize: 9, cellPadding: 1.2, textColor: 0, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: leftWidth },
        1: { cellWidth: labelWidth, fontStyle: 'bold' },
        2: { cellWidth: valueWidth, halign: 'right' }
      },
      didParseCell: data => {
        // Last line (Grand Total) bold and slightly bigger, as before.
        if (summary.length && data.row.index === summary.length - 1 && data.column.index > 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
        }
      },
      didDrawCell: data => {
        if (data.row.index !== 0 || data.column.index !== 0) return;
        const x = data.cell.x + 2;
        let ty = data.cell.y + 4.5;
        doc.setTextColor(0);
        doc.setFontSize(9);
        if (words) {
          doc.setFont('helvetica', 'bold');
          doc.text('Total Invoice Amount In Words :', x, ty);
          doc.setFont('helvetica', 'normal');
          doc.text(wordLines, x, ty + 5);
          ty += 5 + wordLines.length * 4 + 2;
        }
        if (notes) {
          doc.setFont('helvetica', 'bold');
          doc.text(`${document.notesLabel || 'Notes'} :`, x, ty + 1);
          doc.setFont('helvetica', 'normal');
          doc.text(noteLines, x, ty + 6);
        }
      }
    });
    return (doc as any).lastAutoTable.finalY;
  }

  // Point 6: the old-invoice signature row:
  // [ empty ] [ Common Seal ] [ Certified … / For <Company> / Authorised Signatory ]
  private drawPdfSignatureRow(doc: jsPDF, startY: number): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const width = pageWidth - L_MARGIN - R_MARGIN;
    let y = startY;
    if (y + SIGNATURE_ROW_HEIGHT > pageHeight - 15) {
      doc.addPage();
      y = 15;
    }
    const w1 = width * 0.25;
    const w2 = width * 0.25;
    const w3 = width - w1 - w2;
    const x2 = L_MARGIN + w1;
    const x3 = x2 + w2;
    const bottom = y + SIGNATURE_ROW_HEIGHT;
    const company = String(this.companyDetails()?.companyName || '').trim();

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.setTextColor(0);
    doc.rect(L_MARGIN, y, width, SIGNATURE_ROW_HEIGHT);
    doc.line(x2, y, x2, bottom);
    doc.line(x3, y, x3, bottom);

    // Middle box: Common Seal
    doc.line(x2, bottom - 7, x3, bottom - 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Common Seal', x2 + w2 / 2, bottom - 2.5, { align: 'center' });

    // Right box: Certified … / For <Company> / Authorised Signatory
    doc.setFontSize(8);
    doc.text('Certified that the particulars given above are true and correct', x3 + 2, y + 4.5, { maxWidth: w3 - 4 });
    doc.line(x3, y + 6.5, x3 + w3, y + 6.5);
    if (company) {
      doc.setFontSize(9.5);
      doc.text(`For ${company}`, x3 + 2, y + 11.5, { maxWidth: w3 - 4 });
      doc.line(x3, y + 13.5, x3 + w3, y + 13.5);
    }
    doc.line(x3, bottom - 7, x3 + w3, bottom - 7);
    doc.setFontSize(10);
    doc.text('Authorised Signatory', x3 + w3 / 2, bottom - 2.5, { align: 'center' });
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

  /** Amount in Indian words, rounded to the nearest rupee, e.g. 147956.66 ->
   *  "Rupees One Lakh Forty Seven Thousand Nine Hundred Fifty Seven Only". */
  amountInWords(amount: number | undefined): string {
    const rupees = Math.round(Math.abs(Number(amount || 0)));
    return `Rupees ${rupees ? this.indianWords(rupees) : 'Zero'} Only`;
  }

  private indianWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const belowThousand = (n: number): string => {
      const parts: string[] = [];
      if (n >= 100) { parts.push(`${ones[Math.floor(n / 100)]} Hundred`); n %= 100; }
      if (n >= 20) { parts.push(tens[Math.floor(n / 10)]); n %= 10; }
      if (n > 0) parts.push(ones[n]);
      return parts.join(' ');
    };
    const parts: string[] = [];
    const crore = Math.floor(num / 10000000);
    // Crores above 999 read as "One Thousand Crore" etc.
    if (crore) parts.push(`${this.indianWords(crore)} Crore`);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
    num %= 1000;
    if (num) parts.push(belowThousand(num));
    return parts.join(' ');
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

  companyDetails(): any {
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
    if (company?.panNumber) parts.push(`PAN : ${company.panNumber}`);
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
