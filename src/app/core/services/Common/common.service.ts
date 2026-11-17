import { EventEmitter, Inject, Injectable, LOCALE_ID, Optional } from '@angular/core';
import { mergeMap, of, Subject } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

import { formatDate } from '@angular/common';
import { CookieService } from 'ngx-cookie-service';
// import { environment } from '../envir/environment.prod';
import { jsPDF } from 'jspdf';
import autoTable, { ColumnInput, RowInput } from 'jspdf-autotable';
// import * as XLSX from 'xlsx';
// import { saveAs } from 'file-saver';
import * as FileSaver from 'file-saver';
import * as xlsx from 'xlsx';
import { saveAs } from 'file-saver';
import { AbstractControl } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../envir/environment';
import { PageCriteria } from '../../models/pagecriteria';
import { currentAccessToken } from '../../host/host-bridge';



@Injectable({
  providedIn: 'root',
})
export class CommonService {
  // common.service.ts line ~28
  ConnectionString: string = '';
  BranchSchema: string = '';
  CompanyName: string = '';
  NPSPledgeDetails1(reportname: string, rows: any[], gridheaders: string[], FirstcolWidthHeight: any, arg4: string, arg5: string, fromdate: any, toDate: string, printorpdf: string) {
    throw new Error('Method not implemented.');
  }
  getUserId(): any {
    throw new Error('Method not implemented.');
  }
  addWrappedText({
    text,
    textWidth,
    doc,
    fontSize = 10,
    fontType = 'normal',
    lineSpacing = 7,
    xPosition = 10,
    initialYPosition = 10,
    pageWrapInitialYPosition = 10
  }: any) {

    if (!doc || !text) return;

    doc.setFont('helvetica', fontType);
    doc.setFontSize(fontSize);

    const textLines =
      doc.splitTextToSize(text, textWidth);

    const pageHeight =
      doc.internal.pageSize.getHeight();

    let cursorY = initialYPosition;

    textLines.forEach((lineText: string) => {

      if (cursorY > pageHeight - 10) {

        doc.addPage();
        cursorY = pageWrapInitialYPosition;
      }

      doc.text(
        lineText,
        xPosition,
        cursorY,
        {
          align: 'justify'
        }
      );

      cursorY += lineSpacing;

    });

  }

  showInfo(message: any) {
    this.messageService?.add({ severity: 'info', summary: 'Info', detail: message, life: this.messageShowTimeOut });
  }

  showSuccessMessage() {
    this.messageService?.add({ severity: 'success', summary: 'Success', detail: 'Saved successfully', life: this.messageShowTimeOut });
  }
  showSuccessMsg(message: any) {
    this.messageService?.add({ severity: 'success', summary: 'Success', detail: message, life: this.messageShowTimeOut });
  }
  showErrorMessage(error: any) {
    console.warn('API disabled (mock mode):', error?.message || error);
  }

  _downloadchequesReportsPdf(
    reportName: string,
    gridData: any[][],
    gridHeaders: string[],
    colWidthHeight: Record<string, any>,
    pageType: string,
    betweenOrAsOn: string,
    fromDate: string,
    toDate: string,
    printOrPdf: string,
    amount: string
  ): void {

    const companyDetails = this._getCompanyDetails();
    const address = this.getcompanyaddress();
    const today = this.pdfProperties('Date');
    const kapilLogo = this.getKapilGroupLogo();
    const rupeeImage = this._getRupeeSymbol();
    const currencyFormat = this.currencysymbol;
    const headerColor = this.pdfProperties('Header Color');
    const headerAlign = this.pdfProperties('Header Alignment');
    const headerFontsize = this.pdfProperties('Header Fontsize');
    const cellFontsize = this.pdfProperties('Cell Fontsize');

    const totalPagesExp = '{total_pages_count_string}';
    const lMargin = 15;
    const rMargin = 15;

    const doc = new jsPDF({ orientation: pageType === 'landscape' ? 'landscape' : 'portrait' });

    autoTable(doc, {
      columns: gridHeaders.map(h => ({ header: h, dataKey: h })),
      body: gridData,
      theme: 'grid',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: headerColor,
        halign: headerAlign as 'center',
        fontSize: Number(headerFontsize),
      },
      styles: {
        cellPadding: 1,
        fontSize: Number(cellFontsize),
        cellWidth: 'wrap',

        overflow: 'linebreak',
      },
      columnStyles: colWidthHeight,
      startY: 35,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      didDrawPage: (data) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const pdfInMM = pageType === 'landscape' ? 315 : 233;

        if (doc.getNumberOfPages() === 1) {
          this.drawPageHeader(doc, pageType, kapilLogo, companyDetails, address, reportName, betweenOrAsOn, fromDate, toDate, pdfInMM, lMargin, rMargin);
        } else {
          data.settings.margin.top = 20;
          data.settings.margin.bottom = 15;
        }

        doc.setDrawColor(0, 0, 0);
        doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, (data.settings.margin.left ?? 15) - 5, pageHeight - 5);

        let pageLabel = `Page ${doc.getNumberOfPages()}`;
        if (typeof (doc as any).putTotalPages === 'function') {
          pageLabel += ` of ${totalPagesExp}`;
        }
        doc.text(pageLabel, pageWidth - (data.settings.margin.right ?? 15) - 20, pageHeight - 5);
      },

      didDrawCell: (data) => {
        if (data.cell.section !== 'body' || currencyFormat !== '₹') return;

        const rupeeCols: Record<string, number> = {
          'Cheques On Hand': 2,
          'Cheques In Bank': 2,
          'Cheques Issued': 1,
        };
        const targetCol = rupeeCols[reportName];

        if (targetCol !== undefined && data.column.index === targetCol && data.cell.raw) {
          const x = data.cell.x + data.cell.padding('left');
          const y = data.cell.y + data.cell.padding('top');
          doc.addImage(rupeeImage, x, y + 0.5, 1.5, 1.5);
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 40;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    // doc.text(`Total : ${amount}`, doc.internal.pageSize.getWidth() - rMargin, finalY + 10, { align: 'right' });

    if (typeof (doc as any).putTotalPages === 'function') {
      (doc as any).putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setIFrameForPrint(doc);
    }
  }

  private drawPageHeader(
    doc: jsPDF,
    pageType: string,
    kapilLogo: string,
    companyDetails: any,
    address: string,
    reportName: string,
    betweenOrAsOn: string,
    fromDate: string,
    toDate: string,
    pdfInMM: number,
    lMargin: number,
    rMargin: number
  ): void {
    const isLandscape = pageType === 'landscape';

    doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);
    doc.setTextColor('black');

    if (isLandscape) {
      doc.setFontSize(15);
      doc.text(companyDetails.companyName, 110, 10);
      doc.setFontSize(10);
      //  doc.text(companyDetails.registrationAddress, 80, 15, { align: 'left' });
      doc.text(companyDetails.registrationAddress, 150, 15, { align: 'center' });
      if (companyDetails.cinNumber) {
        doc.text(`CIN : ${companyDetails.cinNumber}`, 125, 20);
      }
      doc.setFontSize(14);
      doc.text(reportName, 135, 30);
      doc.setFontSize(10);
      doc.text(`Branch : ${companyDetails.branchName}`, 235, 32);
      doc.setDrawColor(0, 0, 0);
      doc.line(10, 33, pdfInMM - lMargin - rMargin, 33);
    } else {
      doc.setFontSize(15);
      doc.text(companyDetails.companyName, 60, 10);
      doc.setFontSize(8);
      doc.text(companyDetails.registrationAddress, 40, 17, { align: 'left' });
      if (companyDetails.cinNumber) {
        doc.text(`CIN : ${companyDetails.cinNumber}`, 85, 22);
      }
      doc.setFontSize(14);
      doc.text(reportName, 90, 30);
      doc.setFontSize(10);
      doc.text(`Branch : ${companyDetails.branchName}`, 163, 32);
      doc.setDrawColor(0, 0, 0);
      doc.line(10, 45, pdfInMM - lMargin - rMargin, 45);
    }

    doc.setFontSize(10);
    if (betweenOrAsOn === 'Between') {
      doc.text(`Between : ${fromDate}  And  ${toDate}`, 15, 40);
    } else if (betweenOrAsOn === 'As On' && fromDate) {
      doc.text(`As on : ${fromDate}`, 15, 40);
    }
  }

  private setIFrameForPrint(doc: jsPDF): void {
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }
  _downloadchqrecReportsPdf(
    reportName: string,
    gridData: any[],
    gridHeaders: string[],
    columnStyles: any,
    pageType: 'a4' | 'landscape',
    betweenOrAsOn: string,
    fromDate: string,
    toDate: string | null,
    printOrPdf: 'Pdf' | 'Print',
    amount: string
  ): void {
    const company = this._getCompanyDetails();
    const address = this.getcompanyaddress();
    const logo = this.getKapilGroupLogo();
    const rupeeImage = this._getRupeeSymbol();
    const currencySymbol = this.currencysymbol;
    const today = this.pdfProperties('Date');
    const companyName = company?.companyName ?? '';
    const companyAddress = company?.registrationAddress ?? '';
    const companyCIN = company?.cinNumber ?? '';
    const companyBranch = company?.branchName ?? '';

    const doc = new jsPDF({
      orientation: pageType === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    const totalPagesExp = '{total_pages_count_string}';
    const leftMargin = 15;
    const rightMargin = 15;

    const currencyColumnMap: Record<string, number[]> = {
      'Recived Cheque Details': [3],
      'Cheques On Hand': [2],
      'Cheques In Bank': [2],
      'Cheques Issued': [1],
      'Bid Payable Adjustment': [2, 4, 5],
      'Initial Payment Voucher': [4],
      'PS List': [3, 4, 5, 6, 7, 8],
      'TDS Report': [4, 5, 6],
      'TDS': [5, 6],
      'Subscriber Jv': [3, 4, 5]
    };

    const shouldDrawCurrency = (columnIndex: number): boolean =>
      currencySymbol === '₹' &&
      currencyColumnMap[reportName]?.includes(columnIndex);

    autoTable(doc, {
      head: [gridHeaders],
      body: gridData,
      theme: 'grid',
      startY: 48,
      columnStyles,
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right' | 'justify',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },
      styles: {
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellPadding: 1,
        overflow: 'linebreak'
      },
      didDrawPage: (data: any) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        if (doc.getNumberOfPages() === 1) {
          doc.addImage(logo, 'JPEG', 10, 5, 20, 20);
          // doc.setFontSize(14);
          // doc.text(company?.pCompanyName ?? '', pageWidth / 2, 12, { align: 'center' });
          // const companyName = company?.pCompanyName ?? '';
          // const textWidth = doc.getTextWidth(companyName);
          // doc.text(companyName, (pageWidth - textWidth) / 2, 12);
          // doc.setFontSize(9);
          // doc.text(address, pageWidth / 2, 18, { align: 'center' });
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text(companyName, pageWidth / 2, 15, { align: 'center' });
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(
            companyAddress,
            pageWidth / 2, 21,
            { align: 'center' }
          );
          doc.text(`CIN : ${companyCIN}`, pageWidth / 2, 26, { align: 'center' });

          doc.setFontSize(12);
          doc.text(reportName, pageWidth / 2, 35, { align: 'center' });
          // doc.setFontSize(9);
          // doc.text(`Branch : ${company?.pBranchname ?? ''}`, pageWidth - 60, 40);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`Branch : ${companyBranch}`, pageWidth - rightMargin, 40, {
            align: 'right'
          });


          if (betweenOrAsOn === 'Between') {
            doc.text(`Between : ${fromDate} And ${toDate}`, 15, 40);
          } else if (betweenOrAsOn === 'As On' && fromDate) {
            doc.text(`As on : ${fromDate}`, 15, 40);
          }

          doc.line(10, 45, pageWidth - leftMargin - rightMargin, 45);
        }

        const pageNumber =
          'Page ' +
          doc.getNumberOfPages() +
          (typeof doc.putTotalPages === 'function'
            ? ` of ${totalPagesExp}`
            : '');

        doc.line(
          10,
          pageHeight - 10,
          pageWidth - leftMargin - rightMargin,
          pageHeight - 10
        );

        doc.setFontSize(9);
        doc.text(`Printed on : ${today}`, 10, pageHeight - 5);
        doc.text(pageNumber, pageWidth - 30, pageHeight - 5);
      },
      didDrawCell: (data: any) => {
        if (
          data.cell.section === 'body' &&
          shouldDrawCurrency(data.column.index) &&
          data.cell.raw
        ) {
          const textPos = data.cell.textPos;
          doc.addImage(
            rupeeImage,
            'JPEG',
            textPos.x - data.cell.contentWidth,
            textPos.y + 0.5,
            1.5,
            1.5
          );
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;

    doc.setFontSize(10);
    doc.text('Total : ', 45, finalY + 10);
    doc.text(amount, 90, finalY + 10);

    if (currencySymbol === '₹') {
      doc.addImage(rupeeImage, 'JPEG', 85, finalY + 8, 1.8, 1.8);
    }

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setiFrameForPrint(doc);
    }
  }


  exportAsExcelFile(json: any[], excelFileName: string): void {
    import("xlsx").then(xlsx => {
      const worksheet = xlsx.utils.json_to_sheet(json);
      const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
      const excelBuffer: any = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
      this.saveAsExcelFile(excelBuffer, excelFileName);
    });
  }
  saveAsExcelFile(n: any, e: string) {
    const blob = new Blob([n], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
    });

    saveAs(blob, e + ".xlsx");
  }

  // saveAsExcelFile(buffer: any, fileName: string): void {
  //   import("file-saver").then(FileSaver => {
  //     const data: Blob = new Blob([buffer], {
  //       type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  //     });
  //     FileSaver.saveAs(data, fileName + '.xlsx');
  //   });
  // }


  showWarningMessage(message: string) {
    this.messageService?.add({ severity: 'warn', summary: 'Warning', detail: message });
  }
  convertAmountToPdfFormat(value: number | string | null | undefined): string {

    if (value == null || value === '') {
      return this.currencysymbol === "₹" ? "0" : this.currencysymbol + " 0";
    }

    const newAmount: number = Number(
      this.removeCommasForEntredNumber(value)
    );

    const absoluteValue = Math.abs(newAmount);

    let formattedAmount = this.currencyFormat(absoluteValue);

    if (newAmount < 0) {
      formattedAmount = `(${formattedAmount})`;
    }

    if (this.currencysymbol && this.currencysymbol !== "₹") {
      return `${this.currencysymbol} ${formattedAmount}`;
    }

    return formattedAmount;
  }

  pageSize: number = 10;

  datePickerPropertiesSetup(property: string): string | boolean {

    if (property === "containerClass") {
      return "theme-dark-blue";
    }

    if (property === "dateInputFormat") {
      return sessionStorage.getItem("dateformat") ?? "DD-MM-YYYY";
    }

    if (property === "monthInputFormat") {
      return this.getMonthInputFormat();
    }

    if (property === "showWeekNumbers") {
      return false;
    }

    if (property === "currencysymbol") {
      return sessionStorage.getItem("currencyformat") ?? "₹";
    }
    return "";
  }

  getMonthInputFormat(): string {

    this.dateFormat = sessionStorage.getItem("dateformat");

    if (this.dateFormat == "MM DD YYYY") return 'MM YYYY';
    if (this.dateFormat == "DD MM YYYY") return 'MM YYYY';
    if (this.dateFormat == "YYYY MM DD") return 'YYYY MM';
    if (this.dateFormat == "DD/MM/YYYY") return 'MM/YYYY';
    if (this.dateFormat == "MM/DD/YYYY") return 'MM/YYYY';
    if (this.dateFormat == "YYYY/MM/DD") return 'YYYY/MM';
    if (this.dateFormat == "DD-MM-YYYY") return 'MM-YYYY';
    if (this.dateFormat == "MM-DD-YYYY") return 'MM-YYYY';
    if (this.dateFormat == "YYYY-MM-DD") return 'YYYY-MM';
    if (this.dateFormat == "DD-MMM-YYYY") return 'MMM-YYYY';
    if (this.dateFormat == "MMM-DD-YYYY") return 'MMM-YYYY';
    if (this.dateFormat == "YYYY-MMM-DD") return 'YYYY-MMM';
    return 'MM-YYYY';
  }

  public currencyformat(
    value: number | string | null | undefined,
    format: 'India' | 'International' = 'India'
  ): string {

    if (value === null || value === undefined) {
      value = 0;
    }

    let cleanValue = value;

    if (typeof cleanValue === 'string') {
      cleanValue = cleanValue.trim();

      if (cleanValue.toLowerCase().startsWith('null')) {
        cleanValue = cleanValue.substring(4).trim();
      }
    }

    const numericValue: number = typeof cleanValue === 'string'
      ? parseFloat(cleanValue.replace(/,/g, ''))
      : cleanValue ?? 0;

    const rupeeSymbol = '₹ ';

    if (isNaN(numericValue) || numericValue === 0) {
      return rupeeSymbol + '0.00';
    }

    const isNegative = numericValue < 0;
    const absoluteValue = Math.abs(numericValue);

    const fixedValue = absoluteValue.toFixed(2);
    const [integerPart, decimalPart] = fixedValue.split('.');

    let formattedInteger = '';

    if (format === 'India') {
      const lastThree = integerPart.slice(-3);
      const otherNumbers = integerPart.slice(0, -3);

      formattedInteger = otherNumbers
        ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
        : lastThree;

    } else {
      formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    const result = `${formattedInteger}.${decimalPart}`;

    return isNegative ? `-${rupeeSymbol}${result}` : rupeeSymbol + result;
  }


  searchfilterlength = 3;
  searchplaceholder = 'Please enter 3 or more characters'
  ipaddress = sessionStorage.getItem("ipaddress");
  errormessages: any
  datevalue: any;
  year: any;
  month: any;
  day: any;
  newDate: any;
  public ReferralId: any;
  pCreatedby: any;
  pStatusname = 'ACTIVE';
  ptypeofoperation = 'CREATE';
  globalschema = 'GLOBAL';
  comapnydetails: any = {};
  //dateFormat: any;
  //currencysymbol: any;
  private FiTab1Data = new Subject<any>();
  private BankData = new Subject<any>();
  private BankUpdate = new Subject<any>();
  private KYCData = new Subject<any>();
  private KYCUpdate = new Subject<any>();
  private TDSData = new Subject<any>();
  private TDSUpdate = new Subject<any>();
  private ContactData = new Subject<any>();
  private ContactUpdate = new Subject<any>();
  private chargesDataToEdit = new Subject<any>();
  private ContactId = new Subject<any>();

  private GuarantorId = new Subject<any>();
  private CollectionTargetListupdate = new Subject<any>();
  private EnrollDetailsupdate = new Subject<any>();
  private showingGuarantordataInSearchEngine = new Subject<any>();
  showingGuarantordataInSearchEngine$ = this.showingGuarantordataInSearchEngine.asObservable();
  formtype: any;
  NoticePostDetails: any = [];
  totalamount: any = 0;
  penaltyamount: any = 0;
  duedetails: any = [];
  duedetailsgriddata: any = [];
  subscriptionamounttotal = 0;
  dividendamounttotal = 0;
  totalamountdues = 0;
  totaldamages = 0;
  pdftype!: string;
  GuarantorDetails!: any[];
  Companydetails: any;
  tempdata = []
  aadhar_Required: any;
  clear_ContactMerge_Event = new EventEmitter();
  ptranstypedate: boolean = false
  fromdateglobal = ''
  todateglobal = ''
  ptranstypegroupcode: boolean = false
  chitno = '';
  contactGST: any;
  legalReceiptCheckStatus!: string;
  ReserveticketStatus: boolean = false;
  Referredbystatus: boolean = false;
  UserRightsList: any;
  status: any;
  messageShowTimeOut = 1500;
  dateFormat!: string | null;
  // datepipe: any;
  // private apiHostUrl: string | null = null;
  private api = sessionStorage.getItem("apiURL") || '';

  // currencysymbol = sessionStorage.getItem("currencyformat");
  currencysymbol = '₹'

  constructor(private http: HttpClient, @Optional() private messageService: MessageService | null, private _CookieService: CookieService, private datepipe: DatePipe, @Inject(LOCALE_ID) private locale: string) {
    this.pCreatedby = 'admin'; // or from auth/user session
    this.ipaddress = '127.0.0.1';
    console.log('DatePipe injected:', this.datepipe);
  }



  // getschemaname() {
  //   let pschemaname = sessionStorage.getItem("schemaname");
  //   return pschemaname.toString();
  // }

  getschemaname(): string {
    // return sessionStorage.getItem('schemaname') ?? '';
    return 'global';
  }
  getbranchname(): string {
    return sessionStorage.getItem('moduleName') ?? '';
  }



  getCompanyCode(): string {
    return sessionStorage.getItem('companyCode') ?? '';
    // return 'KAPILCHITS';
  }

  getBranchCode(): string {
    return sessionStorage.getItem('branchCode') ?? '';
    // return 'KLC01';
  }

  getCreatedBy(): number | null {

    const userId = sessionStorage.getItem('userId');

    if (!userId) {
      return null;
    }

    return Number(userId);
  }

  getbrachid(): number | null {

    const companyDetailsRaw = sessionStorage.getItem('CompanyDetails');

    if (!companyDetailsRaw) {
      return null;
    }

    const companyDetails = JSON.parse(companyDetailsRaw);

    return companyDetails?.branchId ?? null;
  }



  getloginbranchanme(): string {
    ;
    const companyDetailsRaw = sessionStorage.getItem('CompanyDetails');

    if (!companyDetailsRaw) {
      return '';
    }

    const companyDetails = JSON.parse(companyDetailsRaw);
    console.log("companydeatis", companyDetails);


    return companyDetails?.branchName ?? '';
  }

  // getbrachid(): number | null {

  //   let companyDetailsRaw = sessionStorage.getItem('companydetails');

  //   if (!companyDetailsRaw) {
  //     return null;
  //   }

  //   let companyDetails = JSON.parse(companyDetailsRaw);
  //   return companyDetails?.pbranchid ?? null;
  // }
  extractData(data: any) {
    //  let body = res;
    // return body;
    return data;
  }
  // public extractData(res: Response) {

  //   let body = res;
  //   return body;
  // }

  extractData1(data: any) {
    return data;
  }

  handleError(error: any) {
    console.error(error);
    return throwError(() => error);
  }

  getAPI1(apiPath: string, params: any, parameterStatus: string): Observable<any> {
    let urldata = environment.apiUrl;

    return this.http.get<any[]>(urldata).pipe(
      mergeMap(json => {
        let apiUrl = json[0].ApiHostUrl + apiPath;

        if (parameterStatus.toUpperCase() === 'YES') {
          return this.http.get(apiUrl, {
            params: new HttpParams({ fromObject: params }),
            responseType: 'text'
          }).pipe(
            map(this.extractData1),
            catchError(this.handleError)
          );
        } else {
          return this.http.get(apiUrl).pipe(
            map(this.extractData),
            catchError(this.handleError)
          );
        }
      }),
      catchError(this.handleError)
    );
  }




  private loadApiHostUrl() {
    let api = sessionStorage.getItem("apiURL") || '';
    // this.apiHostUrl = environment.apiUrl
    if (api) {
      return of(api);
    }
    // if (this.apiHostUrl) {
    //   return of(this.apiHostUrl);
    // }
    return this.http.get<any>(api).pipe(
      // return this.http.get<any>(environment.apiUrl).pipe(
      map(config => {
        this.api = config['api'];
        return this.api;
        // this.apiHostUrl = config['ApiHostUrl'];
        // return this.apiHostUrl;
      })
    )
  }
  getAPI(apiPath: string, params: any, parameterStatus: string): Observable<any> {

    ;
    let api = sessionStorage.getItem("apiURL") || '';
    let urldata = environment.apiUrl;

    if (parameterStatus.toUpperCase() == 'YES')
      return this.loadApiHostUrl().pipe(
        switchMap(api => {
          // switchMap(apiBaseUrl => {

          const fullUrl = api + apiPath + "?" + params;
          // const fullUrl = apiBaseUrl + apiPath + "?" + params;
          return this.http.get(fullUrl).pipe(
            map((res: any) => this.extractData(res)),
            catchError(error => this.handleError(error))
          );
        }));
    else
      return this.loadApiHostUrl().pipe(
        switchMap(api => {
          // switchMap(apiBaseUrl => {
          const fullUrl = api + apiPath;
          // const fullUrl = apiBaseUrl + apiPath;
          return this.http.get(fullUrl).pipe(
            map((res: any) => this.extractData(res)),
            catchError(error => this.handleError(error))
          );
        }));
  }

  // postAPI(apiPath: string, data: any): Observable<any> {
  //   const urldata = environment.apiUrl;
  //   const headers = new HttpHeaders({
  //     'Content-Type': 'application/json',
  //     'Cache-Control': 'no-cache'
  //   });

  //   return this.http.get<any[]>(urldata).pipe(
  //     mergeMap(json => {
  //       const apiUrl = json[0].ApiHostUrl + apiPath;

  //       return this.http.post(apiUrl, data, { headers }).pipe(
  //         map(this.extractData),
  //         catchError(this.handleError)
  //       );
  //     }),
  //     catchError(this.handleError)
  //   );
  // }

  // postAPI1(apiPath: string, data: any): Observable<any> {
  //   const urldata = environment.apiUrl;

  //   const headers = new HttpHeaders({
  //     'Content-Type': 'application/json',
  //     'Cache-Control': 'no-cache'
  //   });

  //   return this.http.get<any[]>(urldata).pipe(
  //     mergeMap(json => {
  //       const apiUrl = json[0].ApiHostUrl + apiPath;
  //       return this.http.post(apiUrl, data, { headers });
  //     }),
  //     catchError(this.handleError)
  //   );
  // }
  postAPI(apiPath: any, data: any) {
    let urldata = environment.apiUrl;
    let httpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });

    let options = {
      headers: httpHeaders
    };

    return this.loadApiHostUrl().pipe(
      switchMap(api => {
        const fullUrl = api + apiPath;
        // switchMap(apiBaseUrl => {
        //   const fullUrl = apiBaseUrl + apiPath;
        return this.http.post(fullUrl, data, options).pipe(
          map((res: any) => this.extractData(res)),
          catchError(error => this.handleError(error))
        );
      }
      ));

  }
  postAPIWithParams(apiPath: any, data: any, params: HttpParams) {
    let httpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });

    return this.loadApiHostUrl().pipe(
      switchMap(api => {
        const fullUrl = api + apiPath;
        // switchMap(apiBaseUrl => {
        //   const fullUrl = apiBaseUrl + apiPath;
        return this.http.post(fullUrl, data, { headers: httpHeaders, params }).pipe(
          map((res: any) => this.extractData(res)),
          catchError(error => this.handleError(error))
        );
      })
    );
  }

  callPostAPIMultipleParameters(apiPath: any) {
    let urldata = environment.apiUrl;
    let httpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    httpHeaders.append('Access-Control-Allow-Origin', '/*');

    let options = {
      headers: httpHeaders
    };

    return this.http.get(urldata).pipe(
      mergeMap((json: any) =>
        this.http.post(json[0]['api'] + apiPath, options).pipe(
          // this.http.post(json[0]['ApiHostUrl'] + apiPath, options).pipe(
          map((data: any) => this.extractData(data)),
          catchError(this.handleError)
        )
      )
    );

  }

  getcompanyaddress(): string {
    let companyDetails = this._getCompanyDetails();
    if (!companyDetails) {
      return '';
    }
    // let address = '';

    // if (companyDetails.pAddress1?.trim()) {
    //   address = companyDetails.pAddress1.trim();
    // }
    const address = companyDetails.branchAddress?.trim() ?? '';
    return address ? `${address.replace(/,\s*$/, '')}.` : '';
  }
  _getCompanyDetails(): any | null {
    let raw = sessionStorage.getItem('CompanyDetails');
    // return raw ? JSON.parse(raw) : null;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  }

  // showErrorMessage(errormsg: string) {

  //   this.messageService.add({ severity: 'error', summary: 'Error!', detail: errormsg, life: this.messageShowTimeOut });
  // }

  // pdfProperties(propertyType: string): string | number {
  //   switch (propertyType) {
  //     case 'Date': {
  //       const time = formatDate(
  //         new Date(),
  //         'dd-MMM-yyyy/h:mm:ss a',
  //         'en-IN'
  //       ).split('/')[1];

  //       return `${this.getFormatDateGlobal(new Date())} ${time}`;
  //     }

  //     case 'Header Color':
  //       return '#0b4093';

  //     case 'Header Color1':
  //       return 'white';

  //     case 'Header Alignment':
  //       return 'center';

  //     case 'Header Fontsize':
  //     case 'Cell Fontsize':
  //       return 7;

  //     case 'Address Fontsize':
  //       return 8;

  //     default:
  //       return '';
  //   }
  // }
  pdfProperties(propertyType: string): string | number {
    const now = new Date();

    const datePart = this.getFormatDateGlobal(now);

    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;

    const config: Record<string, string | number> = {
      'Date': `${datePart} ${hour12}:${minutes}:${seconds} ${ampm}`,
      'Header Color': '#0b4093',
      'Header Color1': 'white',
      'Header Alignment': 'center',
      'Header Fontsize': 10,
      'Cell Fontsize': 8,
      'Address Fontsize': 8
    };
    if (!config[propertyType]) {
      console.warn('Unknown pdf property:', propertyType);
    }

    return config[propertyType] ?? '';
  }
  // getFormatDateGlobal(date: any)  {

  //   this.dateFormat = sessionStorage.getItem("dateformat");

  //   if (this.dateFormat == "MM DD YYYY") {
  //     return this.datepipe.transform(date, 'MM dd yyyy')
  //   }
  //   if (this.dateFormat == "DD MM YYYY") {
  //     return this.datepipe.transform(date, 'dd MM yyyy')
  //   }
  //   if (this.dateFormat == "YYYY MM DD") {
  //     return this.datepipe.transform(date, 'yyyy MM dd')
  //   }
  //   if (this.dateFormat == "DD/MM/YYYY") {
  //     return this.datepipe.transform(date, 'dd/MM/yyyy')
  //   }
  //   if (this.dateFormat == "MM/DD/YYYY") {
  //     return this.datepipe.transform(date, 'MM/dd/yyyy')
  //   }
  //   if (this.dateFormat == "YYYY/MM/DD") {
  //     return this.datepipe.transform(date, 'yyyy/MM/dd')
  //   }
  //   if (this.dateFormat == "DD-MM-YYYY") {
  //     return this.datepipe.transform(date, 'dd-MM-yyyy')
  //   }
  //   if (this.dateFormat == "MM-DD-YYYY") {
  //     return this.datepipe.transform(date, 'MM-dd-yyyy')
  //   }
  //   if (this.dateFormat == "YYYY-MM-DD") {
  //     return this.datepipe.transform(date, 'yyyy-MM-dd')
  //   }
  //   if (this.dateFormat == "DD-MMM-YYYY") {
  //     return this.datepipe.transform(date, 'dd-MMM-yyyy')
  //   }
  //   if (this.dateFormat == "MMM-DD-YYYY") {
  //     return this.datepipe.transform(date, 'MMM-dd-yyyy')
  //   }
  //   if (this.dateFormat == "YYYY-MMM-DD") {
  //     return this.datepipe.transform(date, 'yyyy-MMM-dd')
  //   }
  //   if (this.dateFormat == "YYYY-DD-MMM") {
  //     return this.datepipe.transform(date, 'dd-MMM-yyyy')
  //   }
  // }
  // getFormatDateGlobal(date: any): string {
  //   if (!date) return '';

  //   if (typeof date === 'object' && !(date instanceof Date)) return '';

  //   const storedFormat = sessionStorage.getItem('dateformat') ?? '';

  //   let format = 'dd/MM/yyyy';

  //   switch (storedFormat) {
  //     case "MM DD YYYY": format = 'MM dd yyyy'; break;
  //     case "DD MM YYYY": format = 'dd MM yyyy'; break;
  //     case "YYYY MM DD": format = 'yyyy MM dd'; break;
  //     case "DD/MM/YYYY": format = 'dd/MM/yyyy'; break;
  //     case "MM/DD/YYYY": format = 'MM/dd/yyyy'; break;
  //     case "YYYY/MM/DD": format = 'yyyy/MM/dd'; break;
  //     case "DD-MM-YYYY": format = 'dd-MM-yyyy'; break;
  //     case "MM-DD-YYYY": format = 'MM-dd-yyyy'; break;
  //     case "YYYY-MM-DD": format = 'yyyy-MM-dd'; break;
  //     case "DD-MMM-YYYY": format = 'dd-MMM-yyyy'; break;
  //     case "MMM-DD-YYYY": format = 'MMM-dd-yyyy'; break;
  //     case "YYYY-MMM-DD": format = 'yyyy-MMM-dd'; break;
  //     case "YYYY-DD-MMM": format = 'dd-MMM-yyyy'; break;
  //   }

  //   return this.datepipe.transform(date, format) ?? '';
  // }

  getFormatDateGlobal(date: any): string {
    if (!date) return '';

    // Block non-Date objects
    if (typeof date === 'object' && !(date instanceof Date)) return '';

    // Convert string dates to Date object before passing to DatePipe
    if (typeof date === 'string') {
      const str = date.trim();

      // "DD/MM/YYYY" e.g. "28/03/2026"
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [day, month, year] = str.split('/');
        const parsed = new Date(+year, +month - 1, +day);
        if (!isNaN(parsed.getTime())) date = parsed;
        else return '';
      }
      // "DD-MM-YYYY" e.g. "28-03-2026"
      else if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
        const [day, month, year] = str.split('-');
        const parsed = new Date(+year, +month - 1, +day);
        if (!isNaN(parsed.getTime())) date = parsed;
        else return '';
      }
      // "DD-MMM-YYYY" e.g. "28-Mar-2026"
      else if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) date = parsed;
        else return '';
      }
      // ISO "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD"
      else {
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) date = parsed;
        else return '';
      }
    }

    const storedFormat = sessionStorage.getItem('dateformat') ?? '';

    let format = 'dd-MMM-yyyy';

    switch (storedFormat) {
      case "MM DD YYYY": format = 'MM dd yyyy'; break;
      case "DD MM YYYY": format = 'dd MM yyyy'; break;
      case "YYYY MM DD": format = 'yyyy MM dd'; break;
      case "DD/MM/YYYY": format = 'dd/MM/yyyy'; break;
      case "MM/DD/YYYY": format = 'MM/dd/yyyy'; break;
      case "YYYY/MM/DD": format = 'yyyy/MM/dd'; break;
      case "DD-MM-YYYY": format = 'dd-MM-yyyy'; break;
      case "MM-DD-YYYY": format = 'MM-dd-yyyy'; break;
      case "YYYY-MM-DD": format = 'yyyy-MM-dd'; break;
      case "DD-MMM-YYYY": format = 'dd-MMM-yyyy'; break;
      case "MMM-DD-YYYY": format = 'MMM-dd-yyyy'; break;
      case "YYYY-MMM-DD": format = 'yyyy-MMM-dd'; break;
      case "YYYY-DD-MMM": format = 'dd-MMM-yyyy'; break;
    }

    return this.datepipe.transform(date, format) ?? '';
  }
  _getRupeeSymbol() {
    return "data:image/png;base64,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";
  }
  getKapilGroupLogo() {

    let img: string = '';
    let Company = this._getCompanyDetails();
    img = Company.companyLogo;
    return img;
  }
  // getKapilGroupLogo() {
  //   // let img = "/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAABkAAD/4QMraHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjAtYzA2MSA2NC4xNDA5NDksIDIwMTAvMTIvMDctMTA6NTc6MDEgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzUuMSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjZDMEJFNzUyQUJFRTExRTE5MjQxRjJBQUQ1RUI1NkVBIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjZDMEJFNzUzQUJFRTExRTE5MjQxRjJBQUQ1RUI1NkVBIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NkMwQkU3NTBBQkVFMTFFMTkyNDFGMkFBRDVFQjU2RUEiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NkMwQkU3NTFBQkVFMTFFMTkyNDFGMkFBRDVFQjU2RUEiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAOQWRvYmUAZMAAAAAB/9sAhAABAQEBAQEBAQEBAQEBAQEBAQEB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"
  //   let img = "iVBORw0KGgoAAAANSUhEUgAAADYAAABFCAYAAAAB8xWyAAAABHNCSVQICAgIfAhkiAAAFw9JREFUaEPdWwl4FeXVfmfm7vcmITvZCIEQAmFfBRWr9ccCbrW1f6ttQQUXcN+FXwEpYAULBRQUUBFqta51paLWgguyLwECRCD7Qvbcfbb/OWfuhCygJJQ+j53HeM31ZuZ7v+8923vOFeSmBbquB/DfdAmCE0K4caYOPQRR/PFDEwQdqioAgp2APa4L8KOxSYKuAcKPGKCqAt1iVAiiywAmCn7kH3KgR5oMi1U7D0cn8D0FejH+E9CNH3o59UbXHy2JwJFCO/pkh2C3MxUNYIeO2JGdFYbFcupRnXkML1oUePGiRP8iShjvQdcBRYcS0qDJxsYJkgDJLkK0iKc+S5+jf1Td+NEiv7deEt3zNEuUJB2HChzIzAx3BNa7ZytgAmB1SpGFtYNo7jq9rdECwAuWgyrCzQqCtWEE6sMIN8oINcnwVYXQeMIHf00YSlDlhUlWAdYoK1zxNnhSHXDG22GLtsIRY4Uz0QZXgh1Wt4XXIFhaP9AArobbMouBHXag5/cCo01WgeObqhCoCfHO8onQBuqApuoMhBYZblIQbAgjUBdGsC6MQE2YwShBMliDfhanxD+SVYRko1MS+D60OCWgQvYqfJrmZXVJsBPAOBsccTbYoi2w2CS+X6A2jKzxycj9ZbqxSZHrrIBZHBKqdtfjw5t38MOZFqZd8KvxO++jIPBCzcV4Up2I6+NBdKYbjlgrnPE24zQ8EtOOPisQPek2ms7AgvUyLzhYH4a3Moj6Qi98VUEGrMo6bw5tiNUt8anmXJuGnj9NanNqZwWMPKPsU9FcFjB2NWjYBi1EUwz+82mQnVhFWBwi7N1svMO00/Q72xbR1LQZPpCIzUR2meGRXYrkjSOAiS1sjyo02lQNsLgktlt6vmgV+VWNMKJTJ8YHIQoQreQMjAfDKkHzK8x3pqXpy0zvxrYWMfqu+Z82hmx4UIMNZV/XQnJISB0dB9mnnNanndWJtf5LBiUIOLC+CAVvleGiJ/ohdXR8G36fjfekBIACqKYKp3Nqp70FbS5t1t9v+Jadz8Vz8tDn6tTTPrvTwMgz7XnhGL5ZWICEvGhMeGE42w1RkplkIbctMT2JPqdbtdWqIxQWEAqKiI5WoSiG8+hwEb1N+yO6A+y4Cj+owBeP5cOVaMc1fxkFV5IDmtIVr2h6GosAb3UIH0zezt7xiueGIf2ihBY60EP9VSGUfFkDT4oDKaPiWmKPuWiLTUdhoR0L/pSE6hoLrhzfhNtuqYXWDhxT3yJwuKCLPCHZGG+eTcRn9+9lgGMfy8Xgab06ULJTJ0antXfNMWx9+jDi+kbhqnWj2PuRu7fYJVTtbcAXj+1Hc2mAHcmQaVkYPiO7hSpEP1kBpj+Qjt37nLDZNDhsOtatLOF4I8uRjCRCuZ0rClGyuYZPPeuKZAyelsXArE4LSr48iY+m7kT2pBRctngQe9PWV+eAuSR89YdD2P9yEXpenoTxzw5lL0kOhaj48a07UL2/ETa3BbJfQfKQbpi4dqRBEx0gChaV2HDznekIhw2nQzRcsagMw4YFIAcNYLSBBX8rwb8eP8AbZ3q/qzeMQmxvD3vgmoPNeP/Gb5kVV6wc1vKMTntFfiABm28AIwpOWDUMGrlcUUCoUcY7/7uVYxB5z3CTjKG398ao+/pA9hu7ScBKy6yYPD0DoRDZlQCHQ8MrK0uQmipDiZyYNcqCbYuPYM/qY7BHW9leyQte9cpIRKW72M4ObCjCltkH0etn3XH5nwcb7r7V1bkT81iwfclR7Fr5HaLTnbhqwygOthTTKGDuXXMc+RuK2OB7jEvE6Ef6clzjHI9sQwQUFbj3sTR8s80Fu03HdVc14qF7qg3vGHEglJUU//MkNt2zh2OdGtIYwKWLBjEof2UI70/ehsbjPgy5tRdGP9T33GyM7Khydz3+MX0X79DoB3Mw4JZeUH0yZxGCXYSvNABd1zk4m8G49U5SUh0Kidi934Eoj4Z+OSHjc+28Im1I/l+KUfZ1DaLSnXz67jQXApUB/GtWPkq21HAmM+nFEejWy9PFXLHVyigJ3fzEARx6vYRPa9T9fZDxk0T4KoI48Vk1pz/9rk9HxrgEIz80L7Ixuw45LOCrb91o9ooY2D+Inn1CUHziad29NcYK1adwxkN0pHvnry9C1Z5Gdk5E80E39WyhepepyHSyigg1yPjsgT2o2NEAi12EM8HGKRfZFTmK2EHxuGbdCEjQKIsy7Mumo65BwsLFSfh8iweaBsTFqrhtSh1+9fMG/ozpFQ0HIqDmgJc9cO2hZs5wOMug09WAgVMyMeq+nDPGyk7ZmLkjRMlAQxhfPLofFdvqOK6QhyPbkjQF5bY0XLx4OMaM9kIOCBAlcEB+bHYKNn/t5qBMl6IKCAYFTBrfjPtmnERsogLFL8Li1HGi0IqtD2yFt7ABFrel5TA0WedTGn5XNtueab9tPAcF8rMqW9r/VSQDoOC58fZdqDvSzM6Dd1qXUaBmIXzlODw1rwSqT4QUpeK5ZYlYvS6+BRR9lsCSJ1Q1Abk5IcyYVoOxY734dkcM1j8dxshjG/m+ZiVBoWXEXdkYNDULil89Iyi6d5eBMYhoK7Y9XYB9L56A1WPsqkUJ46ilNzZ6JuCxOytwzS/rseXzKMx5KpmdBj2QrrAsYMiAAFe4GzdFo75BQnSUir45IXxX6kFe9VaM9m2F5nYZpxtQOcSMX27EzjOdlHkG5wbMJWHL3IM4/FaZkYEoGhIy7ZAvGY4FbwyE26lgYF4Qh4/a4fWKsNkMUKQcxcSoeGlFCZIyw8jf6cKK1Qn4dqcLoqBDF0RMG7AVQ5PKcPiTOrYrKiIvmT8A2Vencl32Q9c5AaOY8uk9e1Gy5SRXxLyrY+Ixfu0wLF0ci5dfjWUwVovOJ2VKepR15GSHsPrPpZAkSmw1BP0i3v57DNa9FofM9DD+9FQFPB4d7/5mG+qOeDnbuOLZoUi9IL5D+nQ6kF0HFhFp/jF9Nyp21IGqbDLmpEExmLhmGCgZX7U6Hutfi+WMY9aDVfj40yhsp1MRgcyMMNYuL4XdrrOHJICiTUNttZUFpOgYHXJQx8dTd6D2SDOzYcwjucj7Xeb5PTFTOiPnUb23kTMCSoadsTZcuW4kPEk26KqGvflOXuiAoX7MmZ2CDzdFc8bhdmtMxZSUU6kU26hkyAw6RAQbZLz/+20sExCwtDHx+J9lQ4wS6QeK1y6fGBWcFE823rYLJ/MNYByLfApG3Z+DQbdkQfEpoDKFL1HH/KeS8e6HMXC5NPgDImY9UI1rr22A7O+oytL96gqa8dG0nS21FsXQK18eiW5Z7g6Zxr/N3dOJ0ZIZ2P5TwIiOVNJMXDOc0yzTe1ldGpYuS8T612PhcWsIBERcPMaHZxaWQ6GEuN3KiNoV2+s4fWOtUTA2bci0XhhxTzYnBN93df3EIgF54x27ULmrnm3MvCib/wl5sKtSuXzh0ODS8Oab3fDU0iS4XRqXK4kJCtY9V4KoKNXQ2FtddL/KnfX4xx27OH0iYJRsu5MduPKVUbBHWZj6Z7q6DIztwS5iUyuv2ALMq6D/jT0wdma/lqybUqqjhXZMuzcdqmJk+kTHh+8+ieuvr+9ARwrMDcd9huQXIv3dAE6bdsm8PPS5Nu2MQg597pyAUUH47eLD2PfSCdgiAdqwMxV9r0vDxXP6Q45UtlyyKMCUGRk4XmRjB0I1GWUca5aVsiZp5pV0DwJCgfijW3ag/jtvS2ZDMazfr3vgwv/LPW3y+28J0BS7ij6vxucP7mtxHqYDyb0+gxUss8hkOjo1rH0pHs+/HA+nQzMyegFY+UwZ8voHIYfa0pEqiS9m5qPwwwpOAFo27RdpuGh2/++NZ+d0YiRaBhtlvP87wyWT+MIP9yoYeFNPowBslSWQ229olDD5jh6oq5eYLl6fiJtvrMeM6Sc70JEZsegw9q87wXKBeW8qLkfc2+d749k5AWM7c1B9lo+j77XeVQVjHs1F3m8z29gB0ZF6Vrfem46Co3amYzAoYsRQP+se5EBaF5wEZvuSI9iz5ngL1YkB4+blsax9JrH0nG2MgTklVO4wqmo2cMFoLlAgTb8woQ1duLQRSKVKw558Bxx2nUUdSq+eX1LGGQplIebVHpjZiJy4ejji+0dzpnNevCLdlOjnPxnC+7/fzl0V7odZREygh/eNahNI+f+JwIwH07BrnwGMisvMDBlrlpXA6dChtgNGzmn/ywYVKeMgkZREHWpGcM/gDNc5U7GzwOiBMx5Kw849zhZgGWky1i4vgcvZDphLwtcLC3Dw1WIDmKwhuocLk14cyY2J8w6MGnmU04W9ikFHXWfpO3FgTAe6UDy75+E0fLPdBadTYypm9wrziVksaEtFl4QvnzyIgjdKGVhLVrN2REu35bydGDcKVBJLd6J6XwPTkOmyfhSrSKam32I3Lg0bNsRh0fJETq1I1CEJbs6sSsjBtjkjK89rj7PuYY+2cFMx91fpuHhu3g+WLudMRdMzUl73z0f3s6AzbEY26xLtZWe2SZK5VWDRn5Pw1VY3sjLDXNKQYKpGBFNzEyiVokSa7lu5qwGxvd249OlBoGai2bs+byfWEulJU6wKQfEriMlyf29ZIYpG2dHQILK2SLtLTqRNKhxpupGqTBT0VgTh7k6dUGtEVjeeTOCJNbSJreWCTp8YOQsWR4k1kS4l0Y1Kd3qlH4ovZqeTxFOYni4y/kBiKLdZXdwkgw5jcWY+SAs2uqVG99RUo4wu6qkRCvoMbSZVF7nXp3P31HQonQJGD6amua8yiEBtCI1FfjQVB+AtD3AjnbIQSlj54ZGrzSyH+R61dKmH7JRYp2xpzVIWT5cGqIoBiBySGmx1z0gspHhJzyHqk67/8zfGsMc0KXrWwEy+fzBlB2oLmox+s0OC3WMBNREol6PFEngehYh0/6lZQRMAJk3MVi8BoqyFCkr6O/OnpeHeqgXMTJCp761DjbxqkYBH9+j/6wz0+3VGGw981sDMHTr6bhnfoFsvN9wpDjhibS0jDcx32nAej9C5FiPbaCrxcy5J4KjFRB1Q8pw02mB1WTjI8/SAROJqhJKRMoUnEuh+kSEWfqWuVKQUIGBE6/ZZyNkDi9CIbgKe1tEBGVBCRpok2U7xTw8bIihRTHLQ/2whJqAYcY4WJtA4E98qkkHQiyxwc5D7aSQrUO5L8ltEkxQiUoMWFo2Yx5J3xwykU8AIACWxBw874PeL6JEuIzUtDF0VWLSheovU3ZzeISQmUumuo7zchpJyK59k76wQ4uIVQBO4gj542M7CqTkMQxvRMyOMpGSFFeITRTZUnbRwxT2gX5BF1cJjdhaH+vcNssJ12t51ZwtNksh8PgG/va0Hz1pR9Tv19mqsW5uI5S8kcKZ+4WgfFs6tQLcoDaJdwxNzU/DOB9F8ZFNuqMcD91dDCwpobpZww7QeqD5pMSZsAgJrkN2TFdw1rQYTrmnE3Nkp+Oub3ZCXG8Sb64rw6b88uH9WKmJjVaxfWYLMHqfau+3jWadOzAR2810ZKDhixxMPV6Fnpoz7Z6bC5xcwfHAQi+eXIyba8GJV1VZMvTsdNXUSU4YW/dKzJbywxgaJq+mycityc4KYOKEJn3wSjZ17nRjQP4j1a4rxx8VJ+Ovb3ZDXN4hXVxdzl+aROSmI7aZi7bJS9Mg4D8CovP/Z5c04WOBAUYmVe11/ml+OuHiVe8lWj4aPPojBI3O647JxPvj9AnbtdeLZxeW44CIvGqstDOxEkRUTr2jG/AXF+Ov6JBZ7MtLCeOvlIixZlcgnRrT7jwErq7ByfKbWK/WShw4M4LklpWxvxHvJpmPm7BS893E0Fs2r4N7z0pUJuO7KJvxhbjka6yyYMj0DFZUWpKXIGDAgiN17nDh2wo7LxnmxbEkpFjyVjNff/k8DK7cyral5FwgKPJF617RaTJ5Sy57v0CE7br03g53Nsj+Ws+HPnNcdMVEqNrxQwp2VG281bIycAW2Gzaojr18I900/iZ45Qcyf3x1/e+f0wF5aUYr0jDA02UjEWheotK4u2xiNNdBOk00tX5XADb3kRLKhUnTPCuHVV+LxzIoErrloMoAuaiOR15z7aBXGX9aM66dkorjEiovG+vB/D1VDU4CEeBUShRNJx/w/Jp8R2MrFZchID0NWjNhJ1Xfrma4uAZs8vQdrFvfdUYNpd1Thy89jcN/MVE5kJ41vwuxZlbj1zgzsO+BATu8wC6N0FZdaUVxqw/DBfqbnTTMycOy4DeN/2ozFT5dDDwotugcpWvMWJuO1t2LZK77+YhE+2+zBw7NT4XJqfE/S+akrGuVR8cwfKpAQr3AY6dKJkRO465E0HP3OhhlT6/CbG+sQahbx8BOpOFBg52z96glNeOu9GARDAp6cWYWxlzSzS3/7tVgsX53Ayu+8mVVY/nw8Co/ZMO4iH56cVdVGfrM6NDyzLAnvfhiNvtRyWlqKzd+4MW9RMrOAYibZNmVW0R4Nq5aUMtguAeOsWwd8fuqsCHA4NQ6SRAESP0mP50lRFbBYjcFMj1tt6YvR+16fkYYQPYlGqiJw/4yq6TaXAAQDAsJhowtK3RlaNKnHrSlnTIDqXLR2mYrmg62UJtlEKM004qrDFmXhBrpO025UflAzIjKNpmnGEDMnsmGN7UdwSNApHfPLnAjT74pf44FLqr9ohfRZuid1OAWrCEU2pGKLk9KfSBuJkFCXJ0zzx23Tqk7ZGHPXLqKpyM+TZ1QvsRQd0pAyOg4ZFydw0ksTOpTkUorECTFN1kzsjtg+UTyedPzTKlTtbuDkmbJ2Sob7XpfOryc2VfI98m7swfelz+x/pQix2W6kXRCPHcsKjREku8ivol1E74kpPCnUWoboFDDKvmlS4PMH96LX+O7oPak773j1vkbsfv4YfrJwAGfxNEh2xYqhPCZBWTvJZ8Wba3D1q6Nx5J0yHHm7jFViWizdb88LxxFqlnHposHYs+o7nkKgiTbqAZBu+ende5B6QRwPNH80dQfGzOwHT3c7VwO7Vx3jAZfLlw5pI0V0ChiJK7tXfccTMpctHQqlWUa4mThCzW+Nx4yaSv08vDVwciZX2haniOIvTnKKNXZmLt777TaMuDsb6eMSITfRQJlxavQ+bQy1jmoONHEjnVRfAvbPh/YhZWQscn6exm2lodOz4U60MRv2ryvi4vaSBQPPAZjHgm8WHGJbGDt3AAMreKOEqUNg+1yTxj3oT+7cjfSx8exIjm+qROalSbjwif4M5IMp23Hh4/2RODiGZzXMgUsCdsGDOag94kXtoSaMI2Behes1YggB6/uLdHx403aegCO7pg2xRVnR/4YMrgtb64ydOjHSKuoKvdjyeD7GzMxF92GxZrGPjbfvROqoWGT+NBlfPXmIlWDBLqE2vxFbnsjH4FuykDUpFTsWH0ZjsR/jnszjApEcBdPz3XJMWDMcxz6q5FnFiS+NgGQzJhGo6TFsRm+kjY7jTRs3fyA8yXY+MTpxkg7aNwE7BYxQEDXKvqnF0ffKWQ4QJZErZZorpGYfPYQMnKjEVHRLKN1cg53PFfKpxfbxYN+aE2gq9vHfkM5PVKIGBjmXsFdm50O6Cp0CSQtRaU4Murknf6mBNmn0w7lwERUjc8jtS5YfDNAdvtsS8bIEjhbTeMLPoNxJDh69M9UqAmdxWTiuEB2p8+mvDbOXtEdZWSvxlvvhLQ8ylUhm4GnTELl4gZ0OzSKSQESe0mym06mQvEfPb61onQkYVR4dvgKy/6ADvTK/50s73Hww5vDNLxbwAyK96fa6On8BgCUBYxmmvkHvdRhviMyQ0GdMvcP8KoY5on624xAdvo1UUmblyTQqLn+sF2X8pDSLEn9/zPjGnznMBb1t+/THBJK+sEBJMn/j77/1O5r/D3bdoGtZ9fwZAAAAAElFTkSuQmCC";
  //   return img;
  // }
  downloadgstsummarypdf(reportName: any, month: string, gridData: any, gridheaders: any, colWidthHeight: any, pagetype: string, printorpdf: string) {
    //  ;
    // let address = this.getcompanyaddress();
    // let Companyreportdetails = this._getCompanyDetails();
    // const doc = new jsPDF('p', 'mm', 'a4');
    // // let doc = new jsPDF('lanscape');
    // let totalPagesExp = '{total_pages_count_string}'
    // let today = this.pdfProperties("Date");
    // // let Easy_chit_Img = this.Easy_chit_Img;
    // let kapil_logo = this.getKapilGroupLogo();
    // var lMargin = 15; //left margin in mm
    // var rMargin = 15; //right margin in mm
    // var pdfInMM: number;

    // autoTable(doc, {
    //   columns: gridheaders,
    //   body: gridData,
    //   theme: 'grid',//'striped'|'grid'|'plain'|'css' = 'striped'
    //    rowPageBreak: 'avoid',
    //   headStyles: {
    //     fillColor: this.pdfProperties("Header Color"),
    //     halign: this.pdfProperties("Header Alignment") as 'center',
    //     fontSize: Number(this.pdfProperties("Header Fontsize"))
    //   }, // Red
    //   styles: {
    //     cellWidth: 'wrap', fontSize: Number(this.pdfProperties("Cell Fontsize")),

    //     overflow: 'linebreak'
    //   },
    //   // Override the default above for the text column
    //   columnStyles: colWidthHeight,
    //   startY: 48,
    //   showHead: 'everyPage',//|'everyPage'|'never' = 'firstPage''
    //   showFoot: 'lastPage',

    //   didDrawPage: function (data: any) {

    //     let pageSize = doc.internal.pageSize;
    //     let pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
    //     let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
    //     // Header
    //     doc.setFont('helvetica', 'bold');
    //     if (doc.getNumberOfPages() === 1) {
    //        ;
    //       doc.setFontSize(15);
    //       if (pagetype == "a4") {
    //         doc.addImage(kapil_logo, 'JPEG', 10, 5, 20, 20);

    //         doc.setTextColor('black');
    //         doc.text(Companyreportdetails.companyName, 60, 10);
    //         doc.setFontSize(8);
    //         doc.text(address, 40, 15, { align: 'left' });
    //         // if (!isNullOrEmptyString(Companyreportdetails.pCinNo)) {
    //         //   doc.text('CIN : ' + Companyreportdetails.pCinNo + '', 85, 20);
    //         // }

    //         let cin = Companyreportdetails?.cinNumber;

    //         if (typeof cin === 'string' && cin.trim().length > 0) {
    //           doc.text(`CIN : ${cin}`, 85, 20);
    //         }


    //         doc.setFontSize(14);

    //         doc.text(reportName, 87, 30);


    //         doc.setFontSize(10);


    //         //  doc.text('Printed On : ' + today + '', 15, 57);
    //         doc.text('Month : ' + month + '', 15, 40);
    //         doc.text('Branch : ' + Companyreportdetails.branchName + '', 163, 40);
    //         doc.setDrawColor(0, 0, 0);
    //         pdfInMM = 233;
    //         doc.line(10, 45, (pdfInMM - lMargin - rMargin), 45) // horizontal line

    //       }
    //       if (pagetype == "landscape") {
    //         doc.addImage(kapil_logo, 'JPEG', 10, 5, 20, 20)
    //         doc.setTextColor('black');
    //         doc.text(Companyreportdetails.companyName, 110, 20);
    //         doc.setFontSize(10);
    //         doc.text(address, 80, 27, { align: 'left' });
    //         // if (!isNullOrEmptyString(Companyreportdetails.pCinNo)) {
    //         //   doc.text('CIN : ' + Companyreportdetails.pCinNo + '', 125, 32);
    //         // }
    //         let cin = Companyreportdetails?.cinNumber;

    //         if (typeof cin === 'string' && cin.trim().length > 0) {
    //           doc.text(`CIN : ${cin}`, 125, 32);
    //         }

    //         doc.setFontSize(14);


    //         doc.text(reportName, 130, 42);


    //         doc.setFontSize(10);


    //         //  doc.text('Printed On : ' + today + '', 15, 57);
    //         doc.text('Branch : ' + Companyreportdetails.branchName + '', 235, 50);
    //         pdfInMM = 315;
    //         doc.setDrawColor(0, 0, 0);
    //         doc.line(10, 48, (pdfInMM - lMargin - rMargin), 48) // horizontal line
    //       }

    //     }
    //     else {

    //       data.settings.margin.top = 20;
    //       data.settings.margin.bottom = 15;
    //     }
    //      ;
    //     var pageCount = doc.getNumberOfPages();
    //     if (doc.getNumberOfPages() == Number(totalPagesExp)) {
    //        ;

    //     }
    //     // Footer
    //     let page = "Page " + doc.getNumberOfPages()
    //     // Total page number plugin only available in jspdf v1.0+
    //     if (typeof doc.putTotalPages === 'function') {
    //        ;
    //       page = page + ' of ' + totalPagesExp
    //     }
    //     doc.line(5, pageHeight - 10, (pdfInMM - lMargin - rMargin), pageHeight - 10) // horizontal line
    //     doc.setFontSize(10);
    //     doc.text("Printed on : " + today, data.settings.margin.left, pageHeight - 5);
    //     //doc.text(officeCd, pageWidth / 2, pageHeight - 5, 'center');
    //     doc.text(page, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
    //   },

    // });
    let address = this.getcompanyaddress();
    let Companyreportdetails = this._getCompanyDetails();
    // const doc = new jsPDF('p', 'mm', 'a4');
    const doc = new jsPDF(pagetype === 'landscape' ? 'l' : 'p', 'mm', 'a4');
    let totalPagesExp = '{total_pages_count_string}';
    let today = this.pdfProperties("Date");
    let kapil_logo = this.getKapilGroupLogo();
    var lMargin = 15;
    var rMargin = 15;
    var pdfInMM: number;

    autoTable(doc, {
      columns: gridheaders,
      body: gridData,
      theme: 'grid',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: this.pdfProperties("Header Color"),
        halign: this.pdfProperties("Header Alignment") as 'center',
        fontSize: Number(this.pdfProperties("Header Fontsize"))
      },
      tableWidth: doc.internal.pageSize.getWidth() - 30,
      styles: {
        cellWidth: 'wrap',
        fontSize: Number(this.pdfProperties("Cell Fontsize")),
        overflow: 'linebreak'
      },
      columnStyles: colWidthHeight,
      startY: 50,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      didDrawPage: function (data: any) {
        let pageSize = doc.internal.pageSize;
        let pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
        let pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();

        doc.setFont('helvetica', 'bold');

        if (doc.getNumberOfPages() === 1) {
          doc.setFontSize(15);

          if (pagetype == "a4") {
            const centerX = pageWidth / 2;
            doc.addImage(kapil_logo, 'JPEG', 10, 10, 20, 20);
            doc.setTextColor('black');
            doc.text(Companyreportdetails.companyName, centerX, 22, { align: 'center' });
            doc.setFontSize(8);
            doc.text(Companyreportdetails.registrationAddress, centerX, 27, { align: 'center' });

            let cin = Companyreportdetails?.cinNumber;
            if (typeof cin === 'string' && cin.trim().length > 0) {
              doc.text(`CIN : ${cin}`, centerX, 32, { align: 'center' });
            }

            doc.setFontSize(14);
            doc.text(reportName, centerX, 38, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Month : ' + month, 15, 44);
            doc.text('Branch : ' + Companyreportdetails.branchName, pageWidth - 15, 44, { align: 'right' });
            doc.setDrawColor(0, 0, 0);
            // pdfInMM = 233;
            pdfInMM = doc.internal.pageSize.getWidth();
            // doc.line(10, 46, (pdfInMM - lMargin - rMargin), 46);
            doc.line(10, 46, doc.internal.pageSize.getWidth() - 10, 46);
          }

          if (pagetype == "landscape") {
            //  pdfInMM = 315;
            const centerX = pageWidth / 2;
            doc.addImage(kapil_logo, 'JPEG', 10, 10, 20, 20);
            doc.setTextColor('black');
            doc.text(Companyreportdetails.companyName, centerX, 22, { align: 'center' });
            doc.setFontSize(10);
            doc.text(Companyreportdetails.registrationAddress, centerX, 27, { align: 'center' });

            let cin = Companyreportdetails?.cinNumber;
            if (typeof cin === 'string' && cin.trim().length > 0) {
              doc.text(`CIN : ${cin}`, centerX, 33, { align: 'center' });
            }

            doc.setFontSize(14);
            doc.text(reportName, centerX, 40, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Date : ' + month, 15, 46);
            doc.text('Branch : ' + Companyreportdetails.branchName, pageWidth - 15, 46, { align: 'right' });
            // pdfInMM = 315;
            pdfInMM = doc.internal.pageSize.getWidth();
            doc.setDrawColor(0, 0, 0);
            // doc.line(10, 48, (pdfInMM - lMargin - rMargin), 48);
            doc.line(10, 48, pdfInMM - 10, 48);
          }
        } else {
          data.settings.margin.top = 20;
          data.settings.margin.bottom = 15;
        }

        var pageCount = doc.getNumberOfPages();
        let page = "Page " + pageCount + " of " + totalPagesExp;

        doc.line(5, pageHeight - 10, (pdfInMM - lMargin - rMargin), pageHeight - 10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("Printed on : " + today, data.settings.margin.left, pageHeight - 5);
        doc.text(page, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      },
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    // autoTable(doc, {
    //   columns: gridheaders,
    //   body: gridData,
    //   theme: 'grid',
    //   rowPageBreak: 'avoid',

    //   headStyles: {
    //     fillColor: this.pdfProperties("Header Color"),
    //     halign: this.pdfProperties("Header Alignment") as 'left' | 'center' | 'right',
    //     fontSize: Number(this.pdfProperties("Header Fontsize"))
    //   },

    //   styles: {
    //     cellWidth: 'wrap',
    //     fontSize: Number(this.pdfProperties("Cell Fontsize")),

    //     overflow: 'linebreak'
    //   },


    //   columnStyles: colWidthHeight,
    //   startY: 48,
    //   showHead: 'everyPage',
    //   showFoot: 'lastPage',

    //   didDrawPage: (data) => {
    //     const pageWidth = doc.internal.pageSize.getWidth();
    //     const pageHeight = doc.internal.pageSize.getHeight();

    //     doc.setFont('helvetica', 'bold');

    //     if (doc.getNumberOfPages() === 1) {
    //       doc.setFontSize(15);

    //       doc.addImage(kapil_logo, 'JPEG', 10, 5, 20, 20);
    //       doc.text(Companyreportdetails?.companyName  ?? '', 60, 10);

    //       doc.setFontSize(14);
    //       doc.text(reportName, 87, 30);

    //       doc.line(10, 45, pageWidth - rMargin, 45);
    //     }

    //     const page = `Page ${doc.getNumberOfPages()}`;
    //     doc.setFontSize(10);
    //     doc.text("Printed on : " + today, data.settings.margin.left, pageHeight - 5);
    //     doc.text(page, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
    //   }
    // });
    // if (typeof doc.putTotalPages === 'function') {
    //    ;
    //   doc.putTotalPages(totalPagesExp);

    // }
    if (printorpdf == "Pdf") {
      doc.save('' + reportName + '.pdf');
    }
    if (printorpdf == "Print") {
      this.setiFrameForPrint(doc);
    }

  }
  downloadgstprintpdf(
    reportName: string,
    month: string,
    gridData: any[],
    gridheaders: string[],
    colWidthHeight: any,
    pagetype: 'a4' | 'landscape',
    printorpdf: 'Pdf' | 'Print'
  ): void {

    // const address: string = this.getcompanyaddress() ?? '';
    const companyDetails: any = this._getCompanyDetails() ?? {};

    const companyName: string = companyDetails?.companyName ?? '';
    const cinNo: string = companyDetails?.cinNumber ?? '';
    const branchName: string = companyDetails?.branchName ?? '';
    const address: string = companyDetails?.registrationAddress ?? '';

    const doc = new jsPDF({
      orientation: pagetype === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const totalPagesExp = '{total_pages_count_string}';
    const today: string | number = this.pdfProperties('Date') ?? '';
    const currencyformat: string = this.currencysymbol ?? '';
    const rupeeImage: any = this._getRupeeSymbol();
    const kapilLogo: any = this.getKapilGroupLogo();

    const lMargin = 15;
    const rMargin = 15;
    let pdfInMM = 0;

    autoTable(doc, {
      head: [gridheaders],
      body: gridData,
      theme: 'grid',
      startY: 48,
      showHead: 'everyPage',
      columnStyles: colWidthHeight,
      tableWidth: pagetype === 'landscape'
        ? doc.internal.pageSize.getWidth() - 30
        : doc.internal.pageSize.getWidth() - 30,

      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },

      styles: {
        cellPadding: 1,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellWidth: 'auto',
        overflow: 'linebreak',
        minCellWidth: 10,
      },
      margin: { left: 15, right: 15 },

      didDrawPage: (data: any) => {

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFont('helvetica', 'normal');

        if (doc.getNumberOfPages() === 1) {

          doc.setFontSize(15);

          if (pagetype === 'a4') {

            if (kapilLogo) {
              doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);
            }

            if (companyName) {
              doc.text(companyName, pageWidth / 2, 10, { align: 'center' });
            }

            doc.setFontSize(9);

            if (address) {
              doc.text(address, pageWidth / 2, 16, { align: 'center' });
            }

            if (cinNo) {
              doc.text(`CIN : ${cinNo}`, pageWidth / 2, 21, { align: 'center' });
            }

            doc.setFontSize(14);
            doc.text(reportName, pageWidth / 2, 30, { align: 'center' });

            doc.setFontSize(10);

            if (branchName) {
              doc.text(`Branch : ${branchName}`, pageWidth - 20, 40, { align: 'right' });
            }

            pdfInMM = pageWidth;
            doc.line(10, 45, pdfInMM - 10, 45);
          }

          if (pagetype === 'landscape') {

            if (kapilLogo) {
              doc.addImage(kapilLogo, 'JPEG', 15, 5, 25, 20);
            }

            if (companyName) {
              doc.text(companyName, pageWidth / 2, 10, { align: 'center' });
            }

            doc.setFontSize(10);

            if (address) {
              doc.text(address.substring(0, 150), pageWidth / 2, 16, { align: 'center' });
            }

            if (cinNo) {
              doc.text(`CIN : ${cinNo}`, pageWidth / 2, 21, { align: 'center' });
            }

            doc.setFontSize(14);
            doc.text(reportName, pageWidth / 2, 30, { align: 'center' });

            doc.setFontSize(10);

            if (month) {
              doc.text(`Month : ${month}`, 15, 40);
            }

            if (branchName) {
              doc.text(`Branch : ${branchName}`, pageWidth - 15, 40, { align: 'right' });
            }

            pdfInMM = pageWidth;
            doc.line(10, 45, pdfInMM - 10, 45);
          }

        } else {
          data.settings.margin.top = 20;
          data.settings.margin.bottom = 15;
        }

        // Footer
        let pageText = `Page ${doc.getNumberOfPages()}`;
        if (typeof doc.putTotalPages === 'function') {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(10, pageHeight - 10, pdfInMM - 10, pageHeight - 10);

        doc.setFontSize(9);
        doc.text(`Printed on : ${today}`, 15, pageHeight - 5);
        doc.text(pageText, pageWidth - 15, pageHeight - 5, { align: 'right' });
      },

      didDrawCell: (data: any) => {

        if (
          reportName === 'GST Report' &&
          data.cell.section === 'body' &&
          [9, 10, 11, 12].includes(data.column.index)
        ) {
          if (data.cell.raw && currencyformat === '₹' && rupeeImage && data.cell.textPos) {
            const textPos = data.cell.textPos;
            doc.addImage(
              rupeeImage,
              'PNG',
              textPos.x - data.cell.contentWidth,
              textPos.y + 0.5,
              1.5,
              1.5
            );
          }
        }
      }
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    }

    if (printorpdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  downloadtdsaccountingpdf(
    reportName: string,
    grouptype: string,
    from: string,
    to: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: 'a4' | 'landscape',
    betweenorason: string,
    fromdate: string,
    todate: string,
    printorpdf: 'Pdf' | 'Print'
  ): void {

    const company = this._getCompanyDetails();
    const address = this.getcompanyaddress();
    const companyName = company?.companyName ?? '';
    const companyAddress = company?.registrationAddress ?? '';
    const companyCIN = company?.cinNumber ?? '';
    const companyBranch = company?.branchName ?? '';
    const doc = new jsPDF({
      orientation: pagetype === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');
    const kapilLogo = this.getKapilGroupLogo();
    const currencyformat = this.currencysymbol;
    const rupeeImage = this._getRupeeSymbol();

    const lMargin = 15;
    const rMargin = 15;
    let pdfInMM = pagetype === 'landscape' ? 315 : 233;

    autoTable(doc, {
      head: [gridheaders],
      body: gridData,
      theme: 'grid',
      startY: 48,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },
      styles: {
        cellPadding: 1,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellWidth: 'wrap',

        overflow: 'linebreak'
      },
      columnStyles: colWidthHeight,

      didDrawPage: (data: any) => {

        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();

        if (doc.getNumberOfPages() === 1) {

          doc.setFont('helvetica', 'normal');
          doc.setTextColor('black');
          doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);

          if (pagetype === 'a4') {

            // doc.setFontSize(15);
            // doc.text(company?.pCompanyName ?? '', 60, 10);

            // doc.setFontSize(8);
            // doc.text(address, 40, 17);

            // if (company?.pCinNo ?? '') {
            //   doc.text('CIN : ' + company?.pCinNo, 85, 22);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              pageWidth / 2, 21,
              { align: 'center' }
            );
            doc.text(`CIN : ${companyCIN}`, pageWidth / 2, 26, { align: 'center' });

            doc.setFontSize(14);
            doc.text(reportName, 90, 35);

            doc.setFontSize(10);
            // doc.text('Branch : ' + company?.pBranchname, 163, 40);
            doc.text('Branch : ' + companyBranch, 163, 40);

            if (grouptype === 'Between') {
              doc.text(`Between :` + from + ' And ' + to, 15, 40);
            } else if (grouptype === 'Ason' && from) {
              doc.text('As on : ' + from, 15, 40);
            }

          } else {

            // doc.setFontSize(15);
            // doc.text(company?.pCompanyName ?? '', 110, 10);

            // doc.setFontSize(10);
            // doc.text(address.substring(0, 150), 150, 15, { align: 'center' });

            // if (company?.pCinNo ?? '') {
            //   doc.text('CIN : ' + company?.pCinNo, 125, 20);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              pageWidth / 2, 21,
              { align: 'center' }
            );
            doc.text(`CIN : ${companyCIN}`, pageWidth / 2, 26, { align: 'center' });

            doc.setFontSize(14);
            doc.text(reportName, 130, 33);

            doc.setFontSize(10);
            // doc.text('Branch : ' + company?.pBranchname, 235, 40);
            doc.text(`Branch: ${companyBranch}`, 235, 40);

            if (grouptype === 'Between') {
              doc.text('Between : ' + from + ' And ' + to, 15, 40);
            } else if (grouptype === 'Ason' && from) {
              doc.text('As on : ' + from, 15, 40);
            }

            if (reportName === 'TDS Report' || reportName === 'TDS Report (Summary)') {
              doc.text('Section Name - ' + fromdate, 15, 35);
            }
          }

          doc.line(10, 45, pdfInMM - lMargin - rMargin, 45);
        }

        let pageText = 'Page ' + doc.getNumberOfPages();
        if (typeof doc.putTotalPages === 'function') {
          pageText += ' of ' + totalPagesExp;
        }

        doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
        doc.setFontSize(10);
        doc.text('Printed on : ' + today, 10, pageHeight - 5);
        doc.text(pageText, pageWidth - 35, pageHeight - 5);
      },

      willDrawCell: (data: any) => {
        if (data.row.index === gridData.length - 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
        }
      },

      // didDrawCell: (data) => {
      //   if (
      //     (data.column.index === 2 || data.column.index === 3 || data.column.index === 5) &&
      //     data.section === 'body'
      //   ) {
      //     if (this.currencysymbol === '₹') {
      //       const x = data.cell.x + 2;
      //       const y = data.cell.y + data.cell.height / 2;
      //       doc.addImage(rupeeImage, x, y - 2, 3, 3);
      //     }
      //   }
      // }

      didDrawCell: (data: any) => {

        const currencyColumns =
          reportName === 'TDS Report'
            ? [6, 7, 8]
            : [3, 4, 5];

        if (
          (data.column.index === 6 || data.column.index === 7 || data.column.index === 8) &&
          data.section === 'body'
        ) {
          if (this.currencysymbol === '₹') {
            const x = data.cell.x + 2;
            const y = data.cell.y + data.cell.height / 2;
            doc.addImage(rupeeImage, x, y - 1.5, 1.5, 1.5);
          }
        }

        if (
          currencyColumns.includes(data.column.index) &&
          data.cell.section === 'body' &&
          data.cell.raw &&
          currencyformat === '₹'
        ) {

          const textPos = data.cell.textPos;
          if (!textPos) return;

          if (data.row.index === gridData.length - 1) {
            doc.setFont('helvetica', 'bold');
            doc.addImage(rupeeImage, textPos.x - data.cell.contentWidth - 4, textPos.y + 0.7, 2, 2);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.addImage(rupeeImage, textPos.x - data.cell.contentWidth, textPos.y + 0.5, 1.5, 1.5);
          }
        }
      }
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(reportName + '.pdf');
    }

    if (printorpdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  setiFrameForPrint(doc: any) {
    ;
    const iframe = document.createElement('iframe');
    iframe.id = "iprint";
    iframe.name = "iprint";
    iframe.src = doc.output('bloburl');
    iframe.setAttribute('style', 'display: none;');
    document.body.appendChild(iframe);
    // iframe.contentWindow.print();
    iframe.contentWindow?.print();
  }
  _downloadGSTVOucherReport2(
    reportName: string,
    gridData: RowInput[],
    gridheaders: ColumnInput[],
    colWidthHeight: any,
    pagetype: 'a4' | 'letter' | 'legal',
    betweenorason: string,
    fromdate: string,
    todate: string,
    printorpdf: 'Pdf' | 'Print',
    gstvoucherprintdata: any[],
    SubscriberImage: string | undefined,
    companydata: any,
    showgrid1: boolean,
    totalamtBeforeTax: number,
    totaligstamt: number,
    totalCGSTAmt: number,
    totalSGSTAmt: number,
    totalTaxAmt: number,
    totalamtAfterTax: number,
    gsthideshow: boolean,
    otherstate: boolean,
    AmtnubertoWords: string,
    totaldiscountAmt: number,
    proundoff_amount: number,
    invoice_tds_amount: number,
    totalamount_after_tax: number
  ): void {

    const company: any = this._getCompanyDetails();
    let address = company?.registrationAddress || this.getcompanyaddress() || '';
    address = address.replace(/,\s*$/, '');
    if (address) address += '.';

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: pagetype });
    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFont('times', 'normal');
    doc.setFontSize(15);
    doc.text(company?.companyName ?? '', pageWidth / 2, 10, { align: 'center' });

    doc.setFontSize(8);
    doc.text(address.substring(0, 115), pageWidth / 2, 15, { align: 'center' });
    doc.text(address.substring(115), pageWidth / 2, 18, { align: 'center' });

    if (company?.cinNumber) {
      doc.text(`CIN : ${company?.cinNumber ?? ''}`, pageWidth / 2, 22, { align: 'center' });
    }

    doc.setFontSize(14);
    doc.text(reportName, 15, 30);

    if (betweenorason === 'Between') {
      doc.text(`Between: ${fromdate} And ${todate}`, 15, 40);
    } else if (fromdate) {
      doc.text(`As on: ${fromdate}`, 15, 40);
    }

    doc.line(10, 37, pageWidth - 10, 37);

    autoTable(doc, {
      columns: gridheaders,
      body: gridData,
      startY: 75,
      theme: 'grid',
      styles: {
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellPadding: 1
      },
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: 'center'
      },
      columnStyles: colWidthHeight,
      didDrawPage: (data) => {
        let page = `Page ${doc.getNumberOfPages()}`;
        if (typeof doc.putTotalPages === 'function') {
          page += ` of ${totalPagesExp}`;
        }

        doc.setFontSize(9);
        doc.text(`Printed on: ${today}`, 14, pageHeight - 5);
        doc.text(page, pageWidth - 30, pageHeight - 5);
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text('Total Discount Amount:', 15, finalY);
    doc.text(this.convertAmountToPdfFormat(totaldiscountAmt), 70, finalY);

    doc.text('Total Amount Before Tax:', 15, finalY + 7);
    doc.text(this.convertAmountToPdfFormat(totalamtBeforeTax), 70, finalY + 7);

    if (gsthideshow) {
      doc.text('CGST:', 15, finalY + 14);
      doc.text(this.convertAmountToPdfFormat(totalCGSTAmt), 70, finalY + 14);

      doc.text('SGST:', 15, finalY + 21);
      doc.text(this.convertAmountToPdfFormat(totalSGSTAmt), 70, finalY + 21);
    } else {
      doc.text('IGST:', 15, finalY + 14);
      doc.text(this.convertAmountToPdfFormat(totaligstamt), 70, finalY + 14);
    }

    doc.text('Total Tax Amount:', 15, finalY + 28);
    doc.text(this.convertAmountToPdfFormat(totalTaxAmt), 70, finalY + 28);

    doc.setFont('times', 'bold');
    doc.text('Total Amount After Tax:', 15, finalY + 35);
    doc.text(this.convertAmountToPdfFormat(totalamtAfterTax), 70, finalY + 35);

    doc.setFont('times', 'normal');
    doc.text(`Amount in Words: ${AmtnubertoWords}`, 15, finalY + 45);

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setiFrameForPrint(doc);
    }
  }
  getDateObjectFromDataBase(date: any): Date | null {
    if (!date) return null;

    try {
      // If already a Date object
      if (date instanceof Date) {
        return date;
      }

      // If string like "2024-01-31T00:00:00"
      if (typeof date === 'string') {
        return new Date(date);
      }

      // If numeric timestamp
      if (typeof date === 'number') {
        return new Date(date);
      }

      return null;
    } catch (error) {
      console.error('Invalid date received from DB:', date);
      return null;
    }
  }
  getUsername(): string | null {

    return sessionStorage.getItem('username');
  }

  // getCreatedBy(): any {
  //   const userId = sessionStorage.getItem('LoginUserid');
  //   return userId ??  '';
  //   //JSON.parse(userId).toString() :
  // }
  //   getCreatedBy(): number | null {
  //   const data = sessionStorage.getItem('CompanyDetails');

  //   if (!data) return null;

  //   try {
  //     const parsed = JSON.parse(data);
  //     return parsed.branchId ?? null;
  //   } catch {
  //     return null;
  //   }
  // }

  getIpAddress(): string {
    const ip = sessionStorage.getItem('ipaddress');
    return ip ?? '';
  }
  showInfoMessage(errormsg: string) {

    this.messageService?.add({ severity: 'info', summary: 'info', detail: errormsg, life: this.messageShowTimeOut });
  }


  //     getValidationMessage(formcontrol: AbstractControl, errorkey: string, lablename: string, key: string, skipKey: string):
  //      string {
  //     let errormessage;
  // let error1=formcontrol.errors;

  //     if (errorkey == 'required')
  //       errormessage = lablename + ' Required';
  //     if (errorkey == 'email' || errorkey == 'pattern')
  //       errormessage = 'Invalid ' + lablename;
  //     if (errorkey == 'minlength') {
  //       // let length = error1[errorkey].requiredLength;
  //     const length = error1[errorkey].requiredLength;
  //       errormessage = 'Enter the data with minimum(' + length + ') fixed length'
  //     }
  //     if (errorkey == 'maxlength' && key != skipKey) {
  //       let length = formcontrol.errors[errorkey].requiredLength;
  //       // errormessage = lablename + ' Must Have ' + length + ' Letters';
  //       errormessage = 'Enter the data with maximum(' + length + ') fixed length'
  //     }
  //     if (errorkey == 'maxlength' && key == skipKey) {
  //       errormessage = 'Invalid ' + lablename;
  //     }
  //     return errormessage;
  //   }



  getValidationMessage(
    formcontrol: AbstractControl,
    errorkey: string,
    lablename: string,
    key: string,
    skipKey: string
  ): string {

    const errors = formcontrol.errors;

    if (!errors || !errors[errorkey]) {
      return '';
    }

    if (errorkey === 'required') {
      return `${lablename} Required`;
    }

    if (errorkey === 'email' || errorkey === 'pattern') {
      return `Invalid ${lablename}`;
    }

    if (errorkey === 'minlength') {
      const length = errors[errorkey].requiredLength;
      return `Enter the data with minimum (${length}) fixed length`;
    }

    if (errorkey === 'maxlength' && key !== skipKey) {
      const length = errors[errorkey].requiredLength;
      return `Enter the data with maximum (${length}) fixed length`;
    }

    if (errorkey === 'maxlength' && key === skipKey) {
      return `Invalid ${lablename}`;
    }

    return '';
  }




  public currencyFormat(value: any) {
    if (value == null) { value = "0"; }
    else {
      value = parseFloat(value.toString().replace(/,/g, ""));
    }
    value = value.toLocaleString("en", { useGrouping: false, minimumFractionDigits: 0 })
    let withNegativeData: any;
    var result: any;
    //let currencyformat= this.cookieservice.get("savedformat")
    let currencyformat;
    // if (this.currencysymbol == "₹") {
    //   currencyformat = "India"
    // } else {
    //   currencyformat = "other"
    // }
    currencyformat = this.currencysymbol === "₹" ? "India" : "other";

    if (currencyformat == "India") {
      if (value < 0) {
        let stringData = value.toString();
        withNegativeData = stringData.substring(1, stringData.length);
        result = withNegativeData.toString().split('.');
      }
      else if (value >= 0) {
        result = value.toString().split('.');
      }
      var lastThree = result[0].substring(result[0].length - 3);
      var otherNumbers = result[0].substring(0, result[0].length - 3);
      if (otherNumbers != '')
        lastThree = ',' + lastThree;
      var output = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
      if (result.length > 1) {
        output += "." + result[1];
      }
      if (value >= 0) {
        return output
      }
      else if (value < 0) {
        output = '-' + '' + output;
        return output
      }
      // }
    }
    else {
      // this.symbol = this.cookieservice.get("symbolofcurrency")
      var result = value.toString().split('.');
      var lastThree = result[0].substring(result[0].length - 3);
      var otherNumbers = result[0].substring(0, result[0].length - 3);
      if (otherNumbers != '')
        lastThree = ',' + lastThree;
      var output = otherNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + lastThree;
      if (result.length > 1) {
        output += "." + result[1];
      }
      return output
      //return this.symbol+"  "+output
    }

  }
  getFormatDateNormal(date: any): string | null {
    if (date != null && date != '' && date != undefined)
      return this.datepipe.transform(date, 'yyyy-MM-dd');
    else
      return null;
  }
  // getFormatDateNormal(date: any): string | null {
  //   if (date != null && date != '' && date != undefined)
  //     return this.datepipe.transform(date, 'yyyy-MM-dd');
  //   else
  //     return null;
  // }
  removeCommasInAmount(value: string | number): string {
    return String(value).replace(/,/g, '');
  }
  //   public removeCommasInAmount(value:any) {
  //   if (this.isNullOrEmptyString(value))
  //     value = 0;
  //   return parseFloat(value.toString().replace(/,/g, ""))
  //   // let a = value.split(',')
  //   // let b = a.join('')
  //   // let c = b
  //   // return c;
  // }
  isNullOrEmpty(value: string | number | null | undefined): boolean {
    // null or undefined → true
    if (value == null) return true;

    // number → not empty
    if (typeof value === 'number') return false;

    // string → check empty or only whitespace
    return value.trim() === '';
  }

  fileUploadS3(formName: string, data: any) {
    const urldata = environment.apiUrl;
    const headers = new HttpHeaders({ Authorization: `Bearer ${currentAccessToken()}` });

    return this.http.get(urldata).pipe(
      mergeMap((json: any) =>
        this.http.post(`${json[0]['api']}/uploadFile/${formName}`, data, { headers }).pipe(
          // this.http.post(`${json[0]['ApiHostUrl']}/uploadFile/${formName}`, data).pipe(
          map(this.extractData),
          catchError(this.handleError)
        )
      )
    );
  }
  _MultipleGroupingGridExportData(
    gridData: any[],
    groupedCol: string,
    isGroupedColDate: boolean
  ): any[] {
    const groupedByCol: Record<string, any[]> = {};
    const groupedByTransaction: Record<string, any[]> = {};
    const groupKeys: string[] = [];
    const transactionKeys: string[] = [];
    const finalList: any[] = [];

    // 1️⃣ Group data by column and transaction
    for (const row of gridData) {
      const groupColValue = isGroupedColDate
        ? this.getFormatDateGlobal(row[groupedCol])
        : row[groupedCol];

      const transactionNo = row["ptransactionno"];

      // Group by column
      if (!groupedByCol[groupColValue]) {
        groupedByCol[groupColValue] = [{ ...row }];
        groupKeys.push(groupColValue);
      } else {
        groupedByCol[groupColValue].push(row);
      }

      // Group by transaction
      if (!groupedByTransaction[transactionNo]) {
        groupedByTransaction[transactionNo] = [{ ...row }];
        transactionKeys.push(transactionNo);
      } else {
        groupedByTransaction[transactionNo].push(row);
      }
    }

    // 2️⃣ Add transaction-level headers
    for (const txKey of transactionKeys) {
      const transactionRows = groupedByTransaction[txKey];
      transactionRows.forEach((row, idx) => {
        if (idx === 0) {
          row["group"] = {
            content: `               ${row["ptransactionno"]}`,
            colSpan: 15,
            styles: { halign: "left", fontStyle: "bold", textColor: "#663300" },
          };
        }
        finalList.push(row);
      });
    }

    // 3️⃣ Build final grouped array
    const newDataArray: any[] = [];

    for (const key of groupKeys) {
      // Add group header
      newDataArray.push({
        group: {
          content: `${key}`,
          colSpan: 15,
          styles: { halign: "left", fontStyle: "bold", textColor: "#009933" },
        },
      });

      // Add rows belonging to this group
      for (const row of finalList) {
        const rowGroupValue = isGroupedColDate
          ? this.getFormatDateGlobal(row[groupedCol])
          : row[groupedCol];

        if (rowGroupValue === key) {
          newDataArray.push(row);
        }
      }
    }

    return newDataArray;
  }

  //   _JvListdownloadReportsPdf(
  //     reportName: string,
  //     gridData: any[],
  //     gridHeaders: any[],
  //     colWidthHeight: any,
  //     pageType: 'a4' | 'landscape',
  //     betweenOrAsOn: 'Between' | 'As On',
  //     fromDate: string,
  //     toDate: string,
  //     printOrPdf: 'Pdf' | 'Print'
  //   ) {
  //     const address = this.getcompanyaddress();
  //     const Companyreportdetails = this._getCompanyDetails();
  //     const currencySymbol = this.currencysymbol;
  //     const totalPagesExp = '{total_pages_count_string}';
  //     const today = this.pdfProperties('Date');
  //     const kapilLogo = this.getKapilGroupLogo();
  //     const rupeeImage = this._getRupeeSymbol();
  //     const companyName = Companyreportdetails?.companyName ?? '';
  // const companyAddress = Companyreportdetails?.registrationAddress ?? '';
  // const companyCIN = Companyreportdetails?.cinNumber ?? '';
  // const companyBranch = Companyreportdetails?.branchName ?? '';

  //     const doc = new jsPDF({
  //       orientation: pageType === 'landscape' ? 'landscape' : 'portrait',
  //       unit: 'mm',
  //       format: 'a4',
  //       putOnlyUsedFonts: true,
  //       compress: true,
  //     });

  //     const autoTableOptions: any = {
  //       columns: gridHeaders,
  //       body: gridData,
  //       theme: 'grid',
  //       // headStyles: {
  //       //   fillColor: this.pdfProperties('Header Color'),
  //       //   halign: this.pdfProperties('Header Alignment'),
  //       //   fontSize: this.pdfProperties('Header Fontsize'),
  //       // }
  //       headStyles: {
  //         fillColor: this.pdfProperties('Header Color'),
  //         halign: 'center',
  //         fontSize: 15,
  //         fontStyle: 'bold'
  //       },
  //       styles: {
  //         cellPadding: 2,
  //         // fontSize: this.pdfProperties('Cell Fontsize'),
  //         fontSize: 11,
  //         cellWidth: 'wrap',
  //         overflow: 'linebreak',
  //         rowPageBreak: 'avoid',
  //       },
  //       columnStyles: {
  //         0: { cellWidth: 'auto' },
  //         1: { cellWidth: 60, halign: 'right' },
  //         2: { cellWidth: 60, halign: 'right' },
  //       },
  //       tableWidth: 'auto',
  //       margin: { left: 10, right: 10 },
  //       startY: 52,
  //       showHead: 'everyPage',
  //       showFoot: 'lastPage',
  //       didDrawPage: (data: any) => {
  //         const pageSize = doc.internal.pageSize;
  //         const pageWidth = pageSize.width || pageSize.getWidth();
  //         const pageHeight = pageSize.height || pageSize.getHeight();
  //         const lMargin = 15;
  //         const rMargin = 15;
  //         const pdfInMM = pageType === 'landscape' ? 315 : 233;

  //         // Header
  //         doc.setFont('Times', 'normal');
  //         if ((doc.internal as any).getNumberOfPages() === 1) {
  //           doc.setFontSize(pageType === 'landscape' ? 16 : 20);
  //           doc.addImage(kapilLogo, 'JPEG', 10, pageType === 'landscape' ? 5 : 15, 20, 20);
  //           doc.setTextColor('black');
  //           // doc.text(Companyreportdetails?.pCompanyName ?? '', pageWidth / 2, pageType === 'landscape' ? 10 : 15, { align: 'center' });
  //           // doc.setFontSize(14);
  //           // doc.text(address.substring(0, 150), pageWidth / 2, pageType === 'landscape' ? 15 : 24, { align: 'center' });

  //           // if (Companyreportdetails?.pCinNo ?? '') {
  //           //   doc.text('CIN : ' + Companyreportdetails.pCinNo, pageWidth / 2, pageType === 'landscape' ? 20 : 28, { align: 'center' });
  //           // }
  //           const yBase = pageType === 'landscape' ? 10 : 15;

  //           doc.setFont('helvetica', 'bold');
  //           doc.setFontSize(16);
  //           doc.text(companyName, pageWidth / 2, yBase, { align: 'center' });

  //           doc.setFont('helvetica', 'normal');
  //           doc.setFontSize(9);
  //           doc.text(
  //             companyAddress,
  //             pageWidth / 2,
  //             yBase + 6,
  //             { align: 'center' }
  //           );

  //           doc.text(
  //             `CIN :${companyCIN}`,
  //             pageWidth / 2,
  //             yBase + 11,
  //             { align: 'center' }
  //           );
  //           doc.setFontSize(22);
  //           doc.text(reportName, pageWidth / 2, pageType === 'landscape' ? 30 : 38, { align: 'center' });

  //           // doc.setFontSize(14);
  //           // doc.text('Branch : ' + Companyreportdetails?.pBranchname, pageType === 'landscape' ? 235 : 163, pageType === 'landscape' ? 40 : 47);
  //           doc.setFontSize(10);
  //           doc.setFont('helvetica', 'normal');
  //           doc.text(
  //             `Branch : ${companyBranch}`,
  //             pageWidth - 15,
  //             yBase + 30,
  //             { align: 'right' }
  //           );

  //           if (betweenOrAsOn === 'Between') {
  //             doc.text(`Between  : ${fromDate}  And  ${toDate}`, 15, pageType === 'landscape' ? 40 : 47);
  //           } else if (betweenOrAsOn === 'As On' && fromDate) {
  //             doc.text(`As on  : ${fromDate}`, 15, pageType === 'landscape' ? 40 : 47);
  //           }

  //           doc.setDrawColor(0, 0, 0);
  //           doc.line(10, pageType === 'landscape' ? 45 : 50, pdfInMM - lMargin - rMargin, pageType === 'landscape' ? 45 : 50);
  //         }

  //         // Footer
  //         const page = `Page ${(doc.internal as any).getNumberOfPages()} of ${totalPagesExp}`;
  //         doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
  //         doc.setFontSize(14);
  //         doc.text(`Printed on : ${today}`, lMargin, pageHeight - 5);
  //         doc.text(page, pageWidth - rMargin - 20, pageHeight - 5);
  //       },
  //       willDrawCell: (data: any) => {
  //         const isSpanRow = data.cell.colSpan === 3 || data.cell.colSpan === 15;

  //         if (isSpanRow) {
  //           data.cell.styles.fontStyle = 'bold';
  //           data.cell.styles.fontSize = 11;
  //           data.cell.styles.halign = 'left';
  //           data.cell.styles.fillColor = [240, 240, 240];
  //           return;
  //         }

  //         if (reportName === 'PAYMENT VOUCHER LIST') {
  //           if (data.cell.raw === '0' || data.cell.raw === '0.00') {
  //             data.cell.text[0] = '';
  //           }
  //         } else {
  //           if (data.column.index === 0 && data.section === 'body') {
  //             data.cell.styles.fontSize = 11;
  //           }
  //           if ((data.column.index === 1 || data.column.index === 2) && data.section === 'body') {
  //             data.cell.styles.fontSize = 11;
  //             data.cell.styles.halign = 'right';
  //             const rawVal = String(data.cell.raw ?? '').trim();
  //             if (rawVal === '' || rawVal === '0' || rawVal === '0.00') {
  //               data.cell.text[0] = '';
  //             }
  //           }
  //         }
  //       },
  //       didDrawCell: (data: any) => {
  //       // const isSpanRow = data.cell.colSpan === 3 || data.cell.colSpan === 15;
  //       //   if (isSpanRow) return;

  //       //   if ((data.column.index === 1 || data.column.index === 2) && data.cell.section === 'body') {
  //       //     const rawVal = String(data.cell.raw ?? '').trim();
  //       //     if (rawVal === '' || rawVal === '0' || rawVal === '0.00') return;

  //       //     const padding = data.cell.padding;
  //       //     let paddingLeft = 2;
  //       //     if (typeof padding === 'number') {
  //       //       paddingLeft = padding;
  //       //     } else if (padding && typeof padding === 'object') {
  //       //       paddingLeft = (padding as any).left ?? 2;
  //       //     }

  //       //     const x = data.cell.x + paddingLeft;
  //       //     const y = data.cell.y + data.cell.height / 2 - 1;

  //       //     doc.addImage(rupeeImage, 'PNG', x, y, 1.7, 1.7);
  //       //   }
  //       },
  //     };


  //     autoTable(doc, autoTableOptions);

  //     // Put total pages
  //     if ((doc as any).putTotalPages) {
  //       (doc as any).putTotalPages(totalPagesExp);
  //     }

  //     if (printOrPdf === 'Pdf') {
  //       doc.save(`${reportName}.pdf`);
  //     } else if (printOrPdf === 'Print') {
  //       this.setiFrameForPrint(doc);
  //     }
  //   }
  _JvListdownloadReportsPdf(
    reportName: string,
    gridData: any[],
    gridHeaders: any[],
    colWidthHeight: any,
    pageType: 'a4' | 'landscape',
    betweenOrAsOn: 'Between' | 'As On',
    fromDate: string,
    toDate: string,
    printOrPdf: 'Pdf' | 'Print'
  ) {
    const address = this.getcompanyaddress();
    const Companyreportdetails = this._getCompanyDetails();
    const currencySymbol = this.currencysymbol;
    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');
    const kapilLogo = this.getKapilGroupLogo();
    const rupeeImage = this._getRupeeSymbol();
    const companyName = Companyreportdetails?.companyName ?? '';
    const companyAddress = Companyreportdetails?.registrationAddress ?? '';
    const companyCIN = Companyreportdetails?.cinNumber ?? '';
    const companyBranch = Companyreportdetails?.branchName ?? '';

    const formatIndianCurrency = (value: string): string => {
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      const formatted = num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `\u20B9 ${formatted}`;
    };

    const doc = new jsPDF({
      orientation: pageType === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      compress: true,
    });

    const autoTableOptions: any = {
      columns: gridHeaders,
      body: gridData,
      theme: 'grid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: 'center',
        fontSize: 11,
        fontStyle: 'bold',
      },
      styles: {
        cellPadding: 2,
        fontSize: 11,
        cellWidth: 'wrap',
        overflow: 'linebreak',
        rowPageBreak: 'avoid',
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 60, halign: 'right' },
        2: { cellWidth: 60, halign: 'right' },
      },
      tableWidth: 'auto',
      margin: { left: 10, right: 10 },
      startY: 52,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      didDrawPage: (data: any) => {
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.width || pageSize.getWidth();
        const pageHeight = pageSize.height || pageSize.getHeight();
        const lMargin = 15;
        const rMargin = 15;
        const pdfInMM = pageType === 'landscape' ? 315 : 233;

        doc.setFont('Times', 'normal');
        if ((doc.internal as any).getNumberOfPages() === 1) {
          doc.setFontSize(pageType === 'landscape' ? 16 : 20);
          doc.addImage(kapilLogo, 'JPEG', 10, pageType === 'landscape' ? 5 : 15, 20, 20);
          doc.setTextColor('black');

          const yBase = pageType === 'landscape' ? 10 : 15;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text(companyName, pageWidth / 2, yBase, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(companyAddress, pageWidth / 2, yBase + 6, { align: 'center' });
          doc.text(`CIN :${companyCIN}`, pageWidth / 2, yBase + 11, { align: 'center' });

          doc.setFontSize(22);
          doc.text(reportName, pageWidth / 2, pageType === 'landscape' ? 30 : 38, { align: 'center' });

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text(`Branch : ${companyBranch}`, pageWidth - 15, yBase + 30, { align: 'right' });

          if (betweenOrAsOn === 'Between') {
            doc.text(`Between  : ${fromDate}  And  ${toDate}`, 15, pageType === 'landscape' ? 40 : 47);
          } else if (betweenOrAsOn === 'As On' && fromDate) {
            doc.text(`As on  : ${fromDate}`, 15, pageType === 'landscape' ? 40 : 47);
          }

          doc.setDrawColor(0, 0, 0);
          doc.line(10, pageType === 'landscape' ? 45 : 50, pdfInMM - lMargin - rMargin, pageType === 'landscape' ? 45 : 50);
        }

        const page = `Page ${(doc.internal as any).getNumberOfPages()} of ${totalPagesExp}`;
        doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, lMargin, pageHeight - 5);
        doc.text(page, pageWidth - rMargin - 20, pageHeight - 5);
      },

      willDrawCell: (data: any) => {
        const isSpanRow = data.cell.colSpan === 3 || data.cell.colSpan === 15;

        if (isSpanRow) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
          data.cell.styles.halign = 'left';
          data.cell.styles.fillColor = [240, 240, 240];
          return;
        }

        if (data.section !== 'body') return;

        if (data.column.index === 0) {
          data.cell.styles.fontSize = 11;
          data.cell.styles.halign = 'left';
        }

        if (data.column.index === 1 || data.column.index === 2) {
          data.cell.styles.fontSize = 11;
          data.cell.styles.halign = 'right';

          const rawVal = String(data.cell.raw ?? '').trim();

          if (rawVal === '' || rawVal === '0' || rawVal === '0.00') {
            data.cell.text[0] = '';
            return;
          }

          const num = parseFloat(rawVal);
          if (!isNaN(num)) {
            const formatted = num.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            data.cell.text[0] = `${formatted}`;
          }
        }
      },

      didDrawCell: (data: any) => {
        const isSpanRow = data.cell.colSpan === 3 || data.cell.colSpan === 15;
        if (isSpanRow) return;
        if (data.section !== 'body') return;
        if (data.column.index !== 1 && data.column.index !== 2) return;

        const text = data.cell.text?.[0] ?? '';
        if (!text || text === '') return;

        doc.addImage(
          rupeeImage,
          'PNG',
          data.cell.x + 2,
          data.cell.y + (data.cell.height / 2) - 1.5,
          3,
          3
        );
      },
    };

    autoTable(doc, autoTableOptions);

    if ((doc as any).putTotalPages) {
      (doc as any).putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else if (printOrPdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  _downloadTrialBalanceReportsPdf(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: 'a4' | 'landscape',
    betweenorason: string,
    fromdate: string,
    todate: string,
    printorpdf: string,
    totalamounts: any
  ): void {

    const address = this.getcompanyaddress();
    const Companyreportdetails = this._getCompanyDetails();
    const currencyformat = this.currencysymbol;
    const today = this.pdfProperties('Date');
    const kapil_logo = this.getKapilGroupLogo();
    const rupeeImage = this._getRupeeSymbol();
    const companyName = Companyreportdetails?.companyName ?? '';
    const companyAddress = Companyreportdetails?.registrationAddress ?? '';
    const companyCIN = Companyreportdetails?.cinNumber ?? '';
    const companyBranch = Companyreportdetails?.branchName ?? '';

    const orientation = pagetype === 'landscape' ? 'landscape' : 'portrait';

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4'
    });

    const totalPagesExp = '{total_pages_count_string}';
    const lMargin = 15;
    const rMargin = 15;
    let pdfInMM = pagetype === 'landscape' ? 315 : 233;

    autoTable(doc, {
      // columns: gridheaders,
      head: [gridheaders],
      body: gridData,
      theme: 'grid',

      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: 'center',
        fontSize: 11
      },
      rowPageBreak: 'avoid',
      styles: {
        cellPadding: 1,
        fontSize: 10,
        cellWidth: 'wrap',

        overflow: 'linebreak'
      },

      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto', halign: 'right', minCellWidth: 35 },
        2: { cellWidth: 'auto', halign: 'right', minCellWidth: 35 }
      },

      startY: 48,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      didDrawPage: (data: any) => {


        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.width;
        const pageHeight = pageSize.height;

        doc.setFont('helvetica', 'normal');
        if (doc.getNumberOfPages() === 1) {
          if (pagetype === 'a4') {

            doc.addImage(kapil_logo, 'JPEG', 10, 5, 20, 20);
            // doc.setFontSize(15);
            // doc.text(Companyreportdetails?.pCompanyName ?? '', 72, 10);

            // doc.setFontSize(8);
            // const address1 = address.substr(0, 115);
            // const address2 = address.substring(115);
            // doc.text(address1, 110, 15, { align: 'center' });
            // doc.text(address2, 110, 18);

            // if (Companyreportdetails?.pCinNo ?? '') {
            //   doc.text(`CIN : ${Companyreportdetails?.pCinNo ?? ''}`, 90, 22);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 105, 15, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              105, 21,
              { align: 'center' }
            );
            doc.text(`CIN : ${companyCIN}`, 105, 26, { align: 'center' });


            doc.setFontSize(14);
            doc.text(reportName, 90, 33);

            doc.setFontSize(10);
            // doc.text(`Branch : ${Companyreportdetails?.pBranchname ?? ''}`, 160, 40);
            doc.text(`Branch : ${companyBranch}`, 160, 40);

            if (betweenorason === 'Between') {
              doc.text(`Between : ${fromdate} And ${todate}`, 15, 40);
            } else if (fromdate) {
              doc.text(`As on : ${fromdate}`, 15, 40);
            }

            doc.line(10, 45, pdfInMM - lMargin - rMargin, 45);
          }

          if (pagetype === 'landscape') {

            doc.addImage(kapil_logo, 'JPEG', 20, 15, 20, 20);
            doc.setFontSize(15);
            doc.text(Companyreportdetails?.companyName ?? '', 110, 20);

            doc.setFontSize(10);
            doc.text(address, 80, 27);

            if (Companyreportdetails?.cinNumber) {
              doc.text(`CIN : ${Companyreportdetails?.cinNumber ?? ''}`, 125, 32);
            }

            doc.setFontSize(14);
            doc.text(reportName, 130, 42);

            doc.setFontSize(10);
            doc.text(`Branch : ${Companyreportdetails?.branchName ?? ''}`, 235, 50);

            if (betweenorason === 'Between') {
              doc.text(`Between : ${fromdate} And ${todate}`, 15, 50);
            } else if (fromdate) {
              doc.text(`As on : ${fromdate}`, 15, 50);
            }

            doc.line(10, 52, pdfInMM - lMargin - rMargin, 52);
          }
        }
        data.settings.margin.top = 48;
        data.settings.margin.bottom = 15;

        let pageText = `Page ${doc.getNumberOfPages()}`;
        if ((doc as any).putTotalPages) {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, data.settings.margin.left, pageHeight - 5);
        doc.text(pageText, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      },

      willDrawCell: (data: any) => {
        if (data.row.index === gridData.length - 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
        }
      },

      didDrawCell: (data: any) => {
        if (
          (data.column.index === 1 || data.column.index === 2) &&
          data.cell.section === 'body' &&
          data.row.index !== gridData.length - 1 &&
          currencyformat === '₹' &&
          data.cell.raw !== ''
        ) {
          // const pos = data.cell.textPos;
          // doc.setFont('helvetica', 'normal');
          // doc.addImage(
          //   rupeeImage,
          //   pos.x - data.cell.contentWidth,
          //   pos.y + 0.5,
          //   1.5,
          //   1.5
          // );
          const padding = data.cell.padding;
          let paddingLeft = 2;
          if (typeof padding === 'number') {
            paddingLeft = padding;
          } else if (padding && typeof padding === 'object') {
            paddingLeft = (padding as any).left ?? 2;
          }

          const x = data.cell.x + paddingLeft;
          const y = data.cell.y + data.cell.height / 2 - 1;

          doc.setFont('helvetica', 'normal');
          doc.addImage(rupeeImage, 'PNG', x, y, 1.5, 1.5);
        }
      }
    });

    if ((doc as any).putTotalPages) {
      (doc as any).putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setiFrameForPrint(doc);
    }
  }

  // ===================================================================
  // PRINT SUPPORT (UNCHANGED LOGIC)
  // ===================================================================
  // setiFrameForPrint(doc: jsPDF): void {
  //   const iframe = document.createElement('iframe');
  //   iframe.style.display = 'none';
  //   const blobUrl = doc.output('bloburl');
  //   iframe.src = blobUrl.toString();
  //   document.body.appendChild(iframe);
  //   iframe.contentWindow?.print();
  // }

  // getcompanyaddress(): string { return ''; }
  // _getCompanyDetails(): any { return {}; }
  // getKapilGroupLogo(): string { return ''; }
  // _getRupeeSymbol(): string { return ''; }
  // pdfProperties(key: string): any { return ''; }





  removeCommasForEntredNumber(enteredNumber: any) {
    return this.removeCommasInAmount(enteredNumber);
  }
  getFormatDateYYYMMDD(date: Date | string | null | undefined): string | null {
    if (!date) {
      return null;
    }

    return this.datepipe.transform(date, 'yyyy-MM-dd');
  }
  _downloadBRSReportsPdf(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: any,
    betweenorason: string,
    fromdate: string,
    todate: string,
    BankBalance: any,
    chequesdepositedbutnotcredited: any,
    CHEQUESISSUEDBUTNOTCLEARED: any,
    balanceperbankbook: any,
    printorpdf: string,
    bankname: string
  ) {

    const doc = new jsPDF({
      orientation: pagetype === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties("Date");
    const currencyformat = this.currencysymbol;
    const kapil_logo = this.getKapilGroupLogo();
    const Companyreportdetails = this._getCompanyDetails();
    const companyName = Companyreportdetails?.companyName ?? '';
    const companyAddress = Companyreportdetails?.registrationAddress ?? '';
    const companyCIN = Companyreportdetails?.cinNumber ?? '';
    const companyBranch = Companyreportdetails?.branchName ?? '';
    const rupeeImage = this._getRupeeSymbol();

    let pageHeight = doc.internal.pageSize.getHeight();
    let pageWidth = doc.internal.pageSize.getWidth();
    const fmt = (val: any): string => {
      const num = parseFloat(String(val));
      if (isNaN(num)) return String(val);
      return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    autoTable(doc, {
      head: [gridheaders],
      body: gridData,
      startY: 46,
      theme: 'grid',

      headStyles: {
        fillColor: this.pdfProperties("Header Color") as any,
        halign: (this.pdfProperties("Header Alignment") as 'left' | 'center' | 'right') ?? 'center',
        fontSize: Number(this.pdfProperties("Header Fontsize")) || 10
      },

      styles: {
        fontSize: Number(this.pdfProperties("Cell Fontsize")) || 7,
        cellPadding: 1,
        overflow: 'linebreak'
      },
      bodyStyles: {
        fontSize: 8,
      },

      columnStyles: {
        0: { halign: 'center' as const },
        1: { halign: 'center' as const },
        3: { halign: 'right' as const, cellWidth: 30, minCellWidth: 20 }
      },

      didDrawPage: (data) => {
        const centerX = pageWidth / 2;
        if (data.pageNumber === 1) {
          doc.addImage(kapil_logo, 'JPEG', 15, 5, 20, 20);

          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text(companyName, centerX, 15, { align: 'center' });

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(
            companyAddress,
            centerX,
            21,
            { align: 'center' }
          );

          doc.text(`CIN : ${companyCIN}`, centerX, 26, { align: 'center' });




          doc.setFont('times', 'bold');
          doc.setFontSize(10);
          doc.text(`Bank Reconciliation - ${bankname}`, centerX, 34, { align: 'center' });

          doc.setFontSize(10);
          if (betweenorason === "Between") {
            doc.text(`Between : ${fromdate} And ${todate}`, 15, 40);
          } else {
            doc.text(`As On : ${fromdate}`, 15, 40);
          }
          doc.text(`Branch : ${companyBranch}`, pageWidth - 15, 41, { align: 'right' });

          doc.setLineWidth(0.3);
          doc.line(15, 43, pageWidth - 15, 43);
        }

        // doc.addImage(kapil_logo, 'JPEG', pageWidth - 40, 10, 20, 20);

        let str = "Page " + doc.getNumberOfPages();
        if (typeof doc.putTotalPages === 'function') {
          str = str + " of " + totalPagesExp;
        }

        doc.setFontSize(9);
        doc.text("Printed on : " + today, 15, pageHeight - 10);
        doc.text(str, pageWidth - 40, pageHeight - 10);
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 15;

    const addCurrencyIcon = (y: number) => {
      if (currencyformat === "₹") {
        doc.text("₹", 90, y);
      }
    };

    if (finalY + 50 > pageHeight) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const addAmountLine = (label: string, amount: any, y: number) => {
      doc.text(`${label} :`, 15, y);
      doc.addImage(rupeeImage, 'PNG', 91, y - 2.5, 3, 3);
      doc.text(fmt(amount), 95, y);
    };

    addAmountLine('Balance as per bank book', BankBalance, finalY);
    addAmountLine('Less: Cheques deposited but not credited', chequesdepositedbutnotcredited, finalY + 8);
    addAmountLine('Add: Cheques issued but not cleared', CHEQUESISSUEDBUTNOTCLEARED, finalY + 16);
    addAmountLine('Balance as per pass book / statement', balanceperbankbook, finalY + 24);


    doc.text("Account Officer", 15, finalY + 50);
    doc.text("Manager", pageWidth / 2 - 20, finalY + 50);
    doc.text("Verified by", pageWidth - 50, finalY + 50);

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === "Pdf") {
      doc.save(`${reportName}.pdf`);
    }

    if (printorpdf === "Print") {
      this.setiFrameForPrint(doc);
    }
  }

  //   _downloadChequesOnHandReportsPdf(
  //     reportName: string,
  //     gridData: any[],
  //     gridHeaders: string[],
  //     colWidthHeight: any,
  //     pageType: 'portrait' | 'landscape',
  //     betweenOrAsOn: string,
  //     fromDate: string,
  //     toDate: string,
  //     printOrPdf: 'Pdf' | 'Print',
  //     chequesAmt: string
  //   ): void {

  //     const companyDetails = this._getCompanyDetails();
  //     const address = this.getcompanyaddress();
  //     const companyName = companyDetails?.companyName ?? '';
  // const companyAddress = companyDetails?.registrationAddress ?? '';
  // const companyCIN = companyDetails?.cinNumber ?? '';
  // const companyBranch = companyDetails?.branchName ?? '';

  //     const doc = new jsPDF({
  //       orientation: pageType
  //     });

  //     const totalPagesExp = '{total_pages_count_string}';
  //     const today = this.pdfProperties('Date');

  //     const kapilLogo = this.getKapilGroupLogo();
  //     const currencyFormat = this.currencysymbol;
  //     const rupeeImage = this._getRupeeSymbol();

  //     const lMargin = 15;
  //     const rMargin = 15;

  //     let pdfWidth = 315;
  //     let pageHeight = 0;

  //     autoTable(doc, {
  //       head: [gridHeaders],
  //       body: gridData,
  //       theme: 'grid',

  //       startY: 48,

  //       styles: {
  //         fontSize: Number(this.pdfProperties('Cell Fontsize')),
  //         cellPadding: 1,
  //         overflow: 'linebreak'
  //       },

  //       headStyles: {
  //         fillColor: this.pdfProperties('Header Color'),
  //         halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
  //         fontSize: Number(this.pdfProperties('Header Fontsize'))
  //       },

  //       columnStyles: {
  //         0: { cellWidth: 180 }, 
  //         1: { cellWidth: 45 },  
  //         2: { cellWidth: 45 },  
  //       },

  //       didDrawPage: (data) => {

  //         const pageSize = doc.internal.pageSize;
  //         const pageWidth = pageSize.getWidth();
  //         pageHeight = pageSize.getHeight();

  //         doc.setFont('helvetica', 'normal');
  //         doc.setFontSize(15);

  //         if (doc.getNumberOfPages() === 1) {

  //           doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);

  //           doc.text(companyDetails?.companyName ?? '', 110, 10);

  //           doc.setFontSize(10);
  //           doc.text(address, 80, 15);

  //           if (companyDetails?.cinNumber ?? '') {
  //             doc.text(`CIN : ${companyDetails?.cinNumber}`, 125, 20);
  //           }

  //           doc.setFontSize(14);
  //           doc.text(reportName, 125, 30);

  //           doc.setFontSize(10);
  //           doc.text(
  //             `Branch : ${companyDetails?.branchName}`,
  //             235,
  //             40
  //           );

  //           if (betweenOrAsOn === 'Between') {
  //             doc.text(
  //               `Between : ${fromDate} And ${toDate}`,
  //               15,
  //               40
  //             );
  //           } else {
  //             doc.text(`As On : ${fromDate}`, 15, 40);
  //           }

  //           doc.line(
  //             10,
  //             45,
  //             pdfWidth - lMargin - rMargin,
  //             45
  //           );
  //         }

  //         let pageText =
  //           `Page ${doc.getNumberOfPages()}`;

  //         if (typeof doc.putTotalPages === 'function') {
  //           pageText += ` of ${totalPagesExp}`;
  //         }

  //         doc.line(
  //           5,
  //           pageHeight - 10,
  //           pdfWidth - lMargin - rMargin,
  //           pageHeight - 10
  //         );

  //         doc.setFontSize(10);
  //         doc.text(
  //           `Printed on : ${today}`,
  //           data.settings.margin.left,
  //           pageHeight - 5
  //         );

  //         doc.text(
  //           pageText,
  //           pageWidth - 35,
  //           pageHeight - 5
  //         );
  //       },

  //       didDrawCell: (data) => {

  //         if (
  //           (data.column.index === 3 ||
  //             data.column.index === 6) &&
  //           data.section === 'body'
  //         ) {

  //           if (currencyFormat === '₹') {

  //             const x = data.cell.x + 1;
  //             const y = data.cell.y + data.cell.height / 2;

  //             doc.addImage(
  //               rupeeImage,
  //               'JPEG',
  //               x,
  //               y - 1,
  //               1.5,
  //               1.5
  //             );
  //           }
  //         }
  //       }
  //     });

  //     const finalY =
  //       (doc as any).lastAutoTable.finalY;

  //     doc.setFontSize(10);

  //     if (finalY + 80 < pageHeight - 20) {

  //       doc.text('Cheques Total : ', 220, finalY + 10);

  //       if (currencyFormat === '₹') {
  //         doc.addImage(
  //           rupeeImage,
  //           'JPEG',
  //           245,
  //           finalY + 8.5,
  //           1.5,
  //           1.5
  //         );
  //       }

  //       doc.text(chequesAmt, 248, finalY + 10);

  //       doc.text(
  //         'Accounts Officer',
  //         25,
  //         finalY + 100
  //       );

  //       doc.text(
  //         'Verified By',
  //         200,
  //         finalY + 100
  //       );
  //     } else {

  //       doc.addPage();

  //       doc.text('Cheques Total : ', 220, 10);
  //       doc.text(chequesAmt, 248, 10);

  //       doc.text('Accounts Officer', 25, 100);
  //       doc.text('Verified By', 200, 100);
  //     }

  //     if (typeof doc.putTotalPages === 'function') {
  //       doc.putTotalPages(totalPagesExp);
  //     }

  //     if (printOrPdf === 'Pdf') {
  //       doc.save(`${reportName}.pdf`);
  //     }

  //     if (printOrPdf === 'Print') {
  //       this.setiFrameForPrint(doc);
  //     }
  //   }
  // _downloadChequesOnHandReportsPdf(
  //   reportName: string,
  //   gridData: any[],
  //   gridHeaders: string[],
  //   colWidthHeight: any,
  //   pageType: 'portrait' | 'landscape',
  //   betweenOrAsOn: string,
  //   fromDate: string,
  //   toDate: string,
  //   printOrPdf: 'Pdf' | 'Print',
  //   chequesAmt: string
  // ): void {

  //   const companyDetails = this._getCompanyDetails();
  //   const address = this.getcompanyaddress();
  //   const companyName = companyDetails?.companyName ?? '';
  //   const companyAddress = companyDetails?.registrationAddress ?? '';
  //   const companyCIN = companyDetails?.cinNumber ?? '';
  //   const companyBranch = companyDetails?.branchName ?? '';

  //   const doc = new jsPDF({ orientation: pageType });

  //   const totalPagesExp = '{total_pages_count_string}';
  //   const today = this.pdfProperties('Date');

  //   const kapilLogo = this.getKapilGroupLogo();
  //   const currencyFormat = this.currencysymbol;
  //   const rupeeImage = this._getRupeeSymbol();

  //   const lMargin = 10;
  //   const rMargin = 10;

  //   let pageHeight = 0;

  //   autoTable(doc, {
  //     head: [gridHeaders],
  //     body: gridData,
  //     theme: 'grid',
  //     startY: 48,

  //     styles: {
  //       fontSize: Number(this.pdfProperties('Cell Fontsize')),
  //       cellPadding: 1,
  //       overflow: 'linebreak'
  //     },

  //     headStyles: {
  //       fillColor: this.pdfProperties('Header Color'),
  //       halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
  //       fontSize: Number(this.pdfProperties('Header Fontsize'))
  //     },

  //     columnStyles: colWidthHeight,

  //     didDrawPage: (data) => {
  //       const pageSize = doc.internal.pageSize;
  //       const pageWidth = pageSize.getWidth();
  //       pageHeight = pageSize.getHeight();

  //       doc.setFont('helvetica', 'normal');
  //       doc.setFontSize(15);

  //       if (doc.getNumberOfPages() === 1) {
  //         doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);

  //         doc.text(companyDetails?.companyName ?? '', pageWidth / 2, 10, { align: 'center' });

  //         doc.setFontSize(10);
  //         doc.text(address, pageWidth / 2, 15, { align: 'center' });

  //         if (companyDetails?.cinNumber ?? '') {
  //           doc.text(`CIN : ${companyDetails?.cinNumber}`, pageWidth / 2, 20, { align: 'center' });
  //         }

  //         doc.setFontSize(14);
  //         doc.text(reportName, pageWidth / 2, 30, { align: 'center' });

  //         doc.setFontSize(10);
  //         doc.text(`Branch : ${companyDetails?.branchName}`, pageWidth - rMargin, 40, { align: 'right' });

  //         if (betweenOrAsOn === 'Between') {
  //           doc.text(`Between : ${fromDate} And ${toDate}`, lMargin, 40);
  //         } else {
  //           doc.text(`As On : ${fromDate}`, lMargin, 40);
  //         }

  //         doc.line(lMargin, 45, pageWidth - rMargin, 45);
  //       }

  //       let pageText = `Page ${doc.getNumberOfPages()}`;
  //       if (typeof doc.putTotalPages === 'function') {
  //         pageText += ` of ${totalPagesExp}`;
  //       }

  //       doc.line(lMargin, pageHeight - 10, pageWidth - rMargin, pageHeight - 10);

  //       doc.setFontSize(10);
  //       doc.text(`Printed on : ${today}`, data.settings.margin.left, pageHeight - 5);
  //       doc.text(pageText, pageWidth - 35, pageHeight - 5);
  //     },

  //     // didDrawCell: (data) => {
  //     //   if (
  //     //     (data.column.index === 3 || data.column.index === 6) &&
  //     //     data.section === 'body'
  //     //   ) {
  //     didDrawCell: (data) => {
  //       if (
  //         data.column.index === 5 &&
  //         data.section === 'body'
  //       ) {
  //         if (currencyFormat === '₹') {
  //           const x = data.cell.x + 1;
  //           const y = data.cell.y + data.cell.height / 2;
  //           doc.addImage(rupeeImage, 'JPEG', x, y - 1, 2, 2);
  //         }
  //       }
  //     }
  //   });

  //   const finalY = (doc as any).lastAutoTable.finalY;
  //   const pageSize = doc.internal.pageSize;
  //   const pageWidth = pageSize.getWidth();

  //   doc.setFontSize(10);

  //   if (finalY + 80 < pageHeight - 20) {
  //     doc.text('Cheques Total : ', pageWidth - 70, finalY + 10);

  //     if (currencyFormat === '₹') {
  //       doc.addImage(rupeeImage, 'JPEG', pageWidth - 42, finalY + 8.5, 2, 2);
  //     }

  //     doc.text(chequesAmt, pageWidth - 40, finalY + 10);

  //     doc.text('Accounts Officer', 25, finalY + 50);
  //     doc.text('Verified By', pageWidth - 60, finalY + 50);
  //   } else {
  //     doc.addPage();

  //     doc.text('Cheques Total : ', pageWidth - 70, 10);

  //     if (currencyFormat === '₹') {
  //       doc.addImage(rupeeImage, 'JPEG', pageWidth - 42, 8.5, 2, 2);
  //     }

  //     doc.text(chequesAmt, pageWidth - 40, 10);

  //     doc.text('Accounts Officer', 25, 100);
  //     doc.text('Verified By', pageWidth - 60, 100);
  //   }

  //   if (typeof doc.putTotalPages === 'function') {
  //     doc.putTotalPages(totalPagesExp);
  //   }

  //   if (printOrPdf === 'Pdf') {
  //     doc.save(`${reportName}.pdf`);
  //   }

  //   if (printOrPdf === 'Print') {
  //     this.setiFrameForPrint(doc);
  //   }
  // }

  _downloadChequesOnHandReportsPdf(
    reportName: string,
    gridData: any[],
    gridHeaders: string[],
    colWidthHeight: any,
    pageType: 'portrait' | 'landscape',
    betweenOrAsOn: string,
    fromDate: string,
    toDate: string,
    printOrPdf: 'Pdf' | 'Print',
    chequesAmt: string
  ): void {

    const companyDetails = this._getCompanyDetails();
    const address = this.getcompanyaddress();
    const companyName = companyDetails?.companyName ?? '';
    const companyAddress = companyDetails?.registrationAddress ?? '';
    const companyCIN = companyDetails?.cinNumber ?? '';
    const companyBranch = companyDetails?.branchName ?? '';

    const doc = new jsPDF({ orientation: pageType });

    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');

    const kapilLogo = this.getKapilGroupLogo();
    const currencyFormat = this.currencysymbol;
    const rupeeImage = this._getRupeeSymbol();

    const lMargin = 10;
    const rMargin = 10;

    let pageHeight = 0;

    autoTable(doc, {
      head: [gridHeaders],
      body: gridData,
      theme: 'grid',
      startY: 48,

      styles: {
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellPadding: 1,
        overflow: 'linebreak'
      },

      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },

      columnStyles: colWidthHeight,

      didDrawPage: (data) => {
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        pageHeight = pageSize.getHeight();

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(15);

        if (doc.getNumberOfPages() === 1) {
          doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);

          doc.text(companyDetails?.companyName ?? '', pageWidth / 2, 10, { align: 'center' });

          doc.setFontSize(10);
          doc.text(address, pageWidth / 2, 15, { align: 'center' });

          if (companyDetails?.cinNumber ?? '') {
            doc.text(`CIN : ${companyDetails?.cinNumber}`, pageWidth / 2, 20, { align: 'center' });
          }

          doc.setFontSize(14);
          doc.text(reportName, pageWidth / 2, 30, { align: 'center' });

          doc.setFontSize(10);
          doc.text(`Branch : ${companyDetails?.branchName}`, pageWidth - rMargin, 40, { align: 'right' });

          if (betweenOrAsOn === 'Between') {
            doc.text(`Between : ${fromDate} And ${toDate}`, lMargin, 40);
          } else {
            doc.text(`As On : ${fromDate}`, lMargin, 40);
          }

          doc.line(lMargin, 45, pageWidth - rMargin, 45);
        }

        let pageText = `Page ${doc.getNumberOfPages()}`;
        if (typeof doc.putTotalPages === 'function') {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(lMargin, pageHeight - 10, pageWidth - rMargin, pageHeight - 10);

        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, data.settings.margin.left, pageHeight - 5);
        doc.text(pageText, pageWidth - 35, pageHeight - 5);
      },



      didDrawCell: (data) => {
        if (
          data.column.index === 5 &&
          data.section === 'body'
        ) {
          if (currencyFormat === '₹') {
            const x = data.cell.x + 2;
            const y = data.cell.y + data.cell.height / 2;
            doc.addImage(rupeeImage, 'JPEG', x, y - 1, 2, 2);
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    const pageSize = doc.internal.pageSize;
    const pageWidth = pageSize.getWidth();

    doc.setFontSize(10);

    if (finalY + 80 < pageHeight - 20) {
      doc.text('Cheques Total : ', pageWidth - 70, finalY + 10);
      doc.text(chequesAmt, pageWidth - 40, finalY + 10);

      doc.text('Accounts Officer', 25, finalY + 50);
      doc.text('Verified By', pageWidth - 60, finalY + 50);
    } else {
      doc.addPage();

      doc.text('Cheques Total : ', pageWidth - 70, 10);
      doc.text(chequesAmt, pageWidth - 40, 10);

      doc.text('Accounts Officer', 25, 100);
      doc.text('Verified By', pageWidth - 60, 100);
    }

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    }

    if (printOrPdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }





  transform(items: any[], searchText: string, columnName: string): any[] {

    if (!items) return [];
    if (!searchText) return items;
    searchText = searchText.toString().toLowerCase();
    return items.filter(it => {
      return it[columnName].toString().toLowerCase().startsWith(searchText);
      //return it[columnName].toString().toLowerCase().includes(searchText);
    });
  }

  GetGlobalBanks(): Observable<any> {
    ;
    return this.getAPI('/Common/GetGlobalBanks', '', 'NO');
  }
  GetGlobalUPINames(): Observable<any> {
    ;
    return this.getAPI('/Common/GetGlobalUPINames', '', 'NO');
  }
  //  _MultipleGroupingGridExportData(griddata:any, groupdcol:any, isgroupedcolDate:any) {
  //    ;

  //   let a = [];
  //   let Ajv = [];
  //   let keys = [];
  //   let Jvlist = [];
  //   for (var i = 0; i < griddata.length; i++) {
  //     let Jsongroupcol;
  //     let Ajvlistgroupcol;
  //     if (isgroupedcolDate == true) {
  //       //Jsongroupcol = formatDate(griddata[i][groupdcol], 'dd-MM-yyyy', 'en-IN');
  //       Jsongroupcol = this.getFormatDateGlobal(griddata[i][groupdcol]);
  //       Ajvlistgroupcol = griddata[i]["ptransactionno"];
  //     }
  //     else {
  //       Jsongroupcol = griddata[i][groupdcol];
  //       Ajvlistgroupcol = griddata[i]["ptransactionno"];
  //     }

  //     if (!a[Jsongroupcol]) {


  //       keys.push(Jsongroupcol);
  //       let k = { ...griddata[i] }
  //       a[Jsongroupcol] = [k];

  //     }
  //     a[Jsongroupcol].push(griddata[i]);


  //     if (!Ajv[Ajvlistgroupcol]) {

  //       Jvlist.push(Ajvlistgroupcol);
  //       let k = { ...griddata[i] }
  //       Ajv[Ajvlistgroupcol] = [k];
  //     }

  //     Ajv[Ajvlistgroupcol].push(griddata[i]);
  //   }

  //   let final = [];
  //   for (var j = 0; j < Jvlist.length; j++) {

  //     let keypair = Ajv[Jvlist[j]]
  //     for (var k = 0; k < keypair.length; k++) {
  //       let groupcolHead

  //       if (k == 0) {
  //         if (isgroupedcolDate == true) {
  //           // groupcolHead = formatDate(keypair[k][groupdcol], 'dd-MM-yyyy', 'en-IN');
  //           groupcolHead = (keypair[k]["ptransactionno"]);
  //         }
  //         else {
  //           groupcolHead = keypair[k]["ptransactionno"];
  //         }
  //         keypair[k]["group"] = {
  //           content: '               ' + groupcolHead + '',
  //           colSpan: 15,
  //           styles: { halign: 'left', fontStyle: 'bold', textColor: "#663300" }
  //         };
  //       }
  //       final.push(keypair[k])
  //     }
  //   }
  //    ;
  //   let NewdataArray = [];
  //   for (var RRR = 0; RRR < keys.length; RRR++) {
  //     let KeysN = keys[RRR];
  //     NewdataArray.push({
  //       group: {
  //         content: '' + KeysN + '',
  //         colSpan: 15,
  //         styles: { halign: 'left', fontStyle: 'bold', textColor: "#009933" }
  //       }
  //     });
  //     for (var AAA = 0; AAA < final.length; AAA++) {

  //       if (KeysN == this.getFormatDateGlobal(final[AAA][groupdcol])) {

  //         NewdataArray.push(final[AAA]);
  //       }

  //     }

  //   }
  //   return NewdataArray;

  // }


  hrmsjvtypes = [
    { "name": 'ESI', "value": 'ESI' },
    { "name": 'PROVIDENT FUND', "value": 'PF' },
    { "name": 'AO ALLOWANCES', "value": 'AO ALLOWANCES' },
    { "name": 'PROFISSIONAL TAX', "value": 'PT' },
    { "name": 'VDA', "value": 'VDA' },
    { "name": 'HRA', "value": 'HRA' },
    { "name": 'CHIT ACT ALLOWANCE', "value": 'CHIT ACT' },
    { "name": 'PRO ALLOWANCE', "value": 'PRO' },
    { "name": 'FOREMAN ALLOWANCE', "value": 'FOREMAN' },
    { "name": 'DRIVER ALLOWANCE', "value": 'DRIVER ALLOWANCE' },
    { "name": 'LOYALTY ALLOWANCES', "value": 'LOYALTY ALLOWANCES' },
    { "name": 'VEHICLE ALLOWANCE', "value": 'VEHICLE' },
    { "name": 'RISK ALLOWANCE', "value": 'RISK ALLOWANCE' },
    { "name": 'BIDPAYABLE ALLOWANCE', "value": 'BID PAYABLE' },
    { "name": 'ASSISTANT - AO ALLOWANCE', "value": 'ASSISTANT-AO' },
    { "name": 'CHILDREN EDUCATION ALLOWANCE', "value": 'CHILDREN EDUCATION' },
    { "name": 'CITY ALLOWANCE', "value": 'CITY ALLOWANCE' },
    { "name": 'WASHING ALLOWANCE', "value": 'WASHING ALLOWANCE' },
    { "name": 'CONVEYANCE ALLOWANCE', "value": 'CONVEYANCE ALLOWANCE' },
    { "name": 'SPECIAL ALLOWANCE', "value": 'SPECIAL ALLOWANCE' },
    { "name": 'STAFF SALARIES', "value": 'STAFF SALARIES' },
    { "name": 'WELFARE-INSURANCE', "value": 'WELFARE-INSURANCE' },
    { "name": 'COLLECTION TARGET DEDUCTION', "value": 'COLLECTION TARGET DEDUCTION' },
    { "name": 'REAL ESTATE DEDUCTION', "value": 'REAL ESTATE DEDUCTION' },
    { "name": 'TARGET RELEASE', "value": 'TARGET RELEASE' }

  ]

  exceptionHandlingMessages(formName: string, methodName: string, errorMessage: string) {
    this.messageService?.add({ severity: 'error', summary: 'Error!', detail: errorMessage, life: 2500 });
  }
  getFormatDate1(date: Date | string | null): string | null {

    if (!date) return null;

    const dateFormat = sessionStorage.getItem('dateformat');

    if (dateFormat === 'DD-MMM-YYYY') {
      return this.datepipe.transform(date, 'dd-MM-yyyy');
    }

    return this.datepipe.transform(date, 'yyyy-MM-dd');
  }
  GetUPIClearedData_SummaryReport(
    fromDate: string | null,
    toDate: string | null
  ): Observable<any> {

    let params = new HttpParams()
      .set('BranchSchema', this.getschemaname())
      .set('fromdate', fromDate ?? '')
      .set('todate', toDate ?? '');

    return this.http.get<any>(
      '/ChequesOnHand/GetUPIClearedData_SummaryReport',
      { params }
    );
  }
  _OnlineSettlementReportPdf(
    reportName: string,
    gridData: any[],
    gridHeaders: string[],
    colWidthHeight: any,
    pageType: 'a4' | 'landscape',
    betweenOrAsOn: 'Between' | 'As On',
    fromDate: string,
    toDate: string,
    printOrPdf: 'Pdf' | 'Print',
    amount?: string
  ): void {
    ;

    const company = this._getCompanyDetails();
    const address = this.getcompanyaddress();
    const today = this.pdfProperties('Date');
    const logo = this.getKapilGroupLogo();
    const currencySymbol = this.currencysymbol;
    const companyName = company?.companyName ?? '';
    const companyAddress = company?.registrationAddress ?? '';
    const companyCIN = company?.cinNumber ?? '';
    const companyBranch = company?.branchName ?? '';

    const doc = new jsPDF({
      orientation: pageType === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const totalPagesExp = '{total_pages_count_string}';

    autoTable(doc, {
      head: [gridHeaders],
      body: gridData,
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: (this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right') ?? 'center',
        fontSize: Number(this.pdfProperties('Header Fontsize')) || 10
      },
      styles: {
        fontSize: Number(this.pdfProperties('Cell Fontsize')) || 9,
        cellPadding: 1,
        overflow: 'linebreak'
      },
      columnStyles: colWidthHeight,
      didDrawPage: (data: any) => {

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(14);

        if (logo) {
          doc.addImage(logo, 'JPEG', 10, 5, 25, 15);
        }

        // doc.text(company?.pCompanyName ?? '', pageWidth / 2, 10, { align: 'center' });

        // doc.setFontSize(8);
        // doc.text(address, pageWidth / 2, 15, { align: 'center' });

        // if (company?.pCinNo ?? '') {
        //   doc.text(`CIN : ${company?.pCinNo ?? ''}`, pageWidth / 2, 20, { align: 'center' });
        // }
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(
          companyAddress,
          pageWidth / 2, 21,
          { align: 'center' }
        );
        doc.text(`CIN : ${companyCIN}`, pageWidth / 2, 26, { align: 'center' });


        doc.setFontSize(12);
        doc.text(reportName, pageWidth / 2, 35, { align: 'center' });

        doc.setFontSize(9);

        if (betweenOrAsOn === 'Between') {
          doc.text(`Between : ${fromDate}  And  ${toDate}`, 14, 34);
        } else if (betweenOrAsOn === 'As On' && fromDate) {
          doc.text(`As On : ${fromDate}`, 14, 34);
        }

        // doc.text(`Branch : ${company?.pBranchname ?? ''}`, pageWidth - 14, 34, { align: 'right' });
        doc.text(`Branch : ${companyBranch}`, pageWidth - 14, 34, { align: 'right' });

        doc.line(10, 36, pageWidth - 10, 36);

        const pageNumber = doc.getNumberOfPages();
        let pageText = `Page ${pageNumber}`;

        if (typeof doc.putTotalPages === 'function') {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);

        doc.setFontSize(9);
        doc.text(`Printed on : ${today}`, 10, pageHeight - 6);
        doc.text(pageText, pageWidth - 10, pageHeight - 6, { align: 'right' });
      }
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setiFrameForPrint(doc);
    }
  }


  isNullOrEmptyString(value: any): boolean {
    let isvalid = false;
    if (value == undefined || value == '' || value == null)
      isvalid = true;
    return isvalid;
  }
  _downloadReportsPdf(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: Record<string, any>,
    pagetype: 'a4' | 'landscape',
    betweenorason: string,
    fromdate: string,
    todate: string,
    printorpdf: 'Pdf' | 'Print'
  ) {
    const Companyreportdetails = this._getCompanyDetails();
    const address = this.getcompanyaddress() || '';  // defensive default
    const username = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const kapil_logo = this.getKapilGroupLogo();
    const currencyformat = this.currencysymbol || '';
    const rupeeImage = this._getRupeeSymbol();
    const today = this.pdfProperties('Date');
    const companyName = Companyreportdetails?.companyName ?? '';
    const companyAddress = Companyreportdetails?.registrationAddress ?? '';
    const companyCIN = Companyreportdetails?.cinNumber ?? '';
    const companyBranch = Companyreportdetails?.branchName ?? '';

    const doc = new jsPDF({
      format: pagetype,
      orientation: pagetype === 'landscape' ? 'landscape' : 'portrait',
    });

    const lMargin = 15;
    const rMargin = 15;

    const totalPagesExp = '{total_pages_count_string}';
    const cleanedGridData = gridData.map(row => {
      const cleaned = { ...row };
      Object.keys(cleaned).forEach(key => {
        if (typeof cleaned[key] === 'string') {
          cleaned[key] = cleaned[key].replace(/₹/g, '').trim();
        }
      });
      return cleaned;
    });

    const mergedColumnStyles = {
      ...colWidthHeight,
      3: {
        ...colWidthHeight[3],
        cellPadding: { top: 0.5, bottom: 0.5, left: 6, right: 1 },
      },
    };

    autoTable(doc, {
      columns: gridheaders,
      // body: gridData,
      body: cleanedGridData,
      theme: 'grid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize')) || 10,
      },
      styles: {
        fontSize: 8,
        cellPadding: 0.5,
        overflow: 'linebreak',
        rowPageBreak: 'avoid',
      } as any,
      // columnStyles: colWidthHeight,
      columnStyles: mergedColumnStyles,
      startY: 48,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      didDrawPage: (data) => {
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.width;
        const pageHeight = pageSize.height;
        const centerX = pageWidth / 2;

        if (doc.getNumberOfPages() === 1) {
          doc.setFontSize(15);
          if (kapil_logo) {
            doc.addImage(kapil_logo, 'JPEG', 10, 5, 20, 20);
          }

          doc.setTextColor('black');
          // doc.text(Companyreportdetails?.pCompanyName ?? '', 72, 10);
          // doc.setFontSize(8);

          // const address1 = address.substr(0, 115);
          // const address2 = address.substring(115);
          // doc.text(address1, 110, 15, { align: 'center' });
          // doc.text(address2, 110, 18);

          // const cinNo = Companyreportdetails?.pCinNo ?? '';
          // if (cinNo) {
          //   doc.text('CIN: ' + cinNo, 90, 22);
          // }
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text(companyName, centerX, 14, { align: 'center' });
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(
            companyAddress,
            centerX, 20,
            { align: 'center' }
          );
          doc.text(`CIN : ${companyCIN}`, centerX, 26, { align: 'center' });


          doc.setFontSize(14);
          // doc.text(reportName, 90, 30);
          doc.setFont('helvetica', 'bold');
          doc.text(reportName, centerX, 33, { align: 'center' });
          doc.setFont('helvetica', 'normal');

          // const branchName = Companyreportdetails?.pBranchname ?? '';
          // if (branchName) {
          //   doc.text('Branch: ' + branchName, 163, 40);
          // }
          const rMargin = 15;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');

          doc.text(
            `Branch : ${companyBranch}`,
            pageWidth - rMargin,
            40,
            { align: 'right' }
          );

          if (betweenorason === 'Between') {
            doc.text(`Between: ${fromdate ?? ''} And ${todate ?? ''}`, 15, 40);
          } else if (betweenorason === 'As On' && fromdate) {
            doc.text(`As on: ${fromdate ?? ''}`, 15, 40);
          }

          doc.setDrawColor(0, 0, 0);
          doc.line(10, 45, pageWidth - lMargin - rMargin, 45);
        }

        const internalDoc: any = doc.internal;
        let pageStr = 'Page ' + internalDoc.getNumberOfPages();

        if (typeof internalDoc.putTotalPages === 'function') {
          pageStr += ' of ' + totalPagesExp;
        }


        doc.setFontSize(10);
        doc.setDrawColor(0, 0, 0);

        doc.line(lMargin, pageHeight - 10, pageWidth - rMargin, pageHeight - 10);

        doc.text(`Printed on: ${today}, User: ${username.pEmployeeName || ''}`, lMargin, pageHeight - 5);

        // doc.text(pageStr, pageWidth - rMargin - doc.getTextWidth(pageStr), pageHeight - 5);
        doc.text(pageStr, pageWidth - rMargin, pageHeight - 5, { align: 'right' });

      },
      willDrawCell: (data) => {
        // Bold last row for PS List
        if (data.row.index === gridData.length - 1 && reportName === 'PS List') {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
        }
      },
      // didDrawCell: (data) => {
      //   const td = data.cell.raw;
      //   // const rupeeColumns = [1, 2, 3, 4, 5, 6, 12]; 
      //   const rupeeColumns = [3];

      //   if (td && currencyformat === '₹' && rupeeColumns.includes(data.column.index)) {
      //     if (rupeeImage) {

      //       // let paddingLeft = 2;
      //       // if (typeof data.cell.padding === 'number') {
      //       //   const x = data.cell.x + paddingLeft;
      //       // } else if (typeof data.cell.padding === 'function') {
      //       //   paddingLeft = data.cell.padding('left');
      //       // }
      //       let paddingLeft = 2;
      // const padding = data.cell.padding;
      // if (typeof padding === 'number') {
      //   paddingLeft = padding;
      // } else if (padding && typeof padding === 'object') {
      //   paddingLeft = (padding as any).left ?? 2;
      // }

      //       const x = data.cell.x + paddingLeft;
      //       const y = data.cell.y + data.cell.height / 2 - 0.5; // vertically center
      //       const size = 2.5; // image size in mm

      //       // Add rupee image
      //       doc.addImage(rupeeImage, 'PNG', x, y, size, size);
      //     }
      //   }
      // },
      didDrawCell: (data) => {
        const rupeeColumns = [3];

        if (
          data.cell.raw &&
          currencyformat === '₹' &&
          rupeeColumns.includes(data.column.index) &&
          rupeeImage
        ) {

          let paddingLeft = 2;
          const padding = data.cell.padding;
          if (typeof padding === 'number') {
            paddingLeft = padding;
          } else if (padding && typeof padding === 'object') {
            paddingLeft = (padding as any).left ?? 2;
          }

          const size = 2.5;
          const x = data.cell.x + paddingLeft;
          const y = data.cell.y + (data.cell.height - size) / 2;

          doc.addImage(rupeeImage, 'PNG', x, y, size, size);
        }
      },


    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else if (printorpdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  _groupwiseSummaryExport_pendingtransfer(griddata: any, groupdcol: any, groupdsummarycol: string, isgroupedcolDate: boolean) {

    let a: any = {};
    let keys: any[] = [];

    for (let i = 0; i < griddata.length; i++) {
      let Jsongroupcol = isgroupedcolDate
        ? this.getFormatDateGlobal(griddata[i][groupdcol])
        : griddata[i][groupdcol];

      if (!a[Jsongroupcol]) {
        keys.push(Jsongroupcol);
        a[Jsongroupcol] = [];
      }
      a[Jsongroupcol].push(griddata[i]);
    }

    // Add empty row at end of each group
    for (let key of keys) {
      a[key].push({});
    }

    let final: any[] = [];

    for (let key of keys) {
      let keypair = a[key];
      let agesum = 0;

      for (let k = 0; k < keypair.length; k++) {

        // Group Header
        if (k === 0) {
          let groupcolHead = isgroupedcolDate
            ? this.getFormatDateGlobal(keypair[k][groupdcol])
            : keypair[k][groupdcol];

          final.push([
            {
              content: '' + groupcolHead + '',
              colSpan: 13,
              styles: { halign: 'left', fillColor: "#e6f7ff" }
            }
          ]);

          continue;
        }

        // Empty row (separator)
        if (k === keypair.length - 1) {
          final.push([
            {
              content: 'Total: ' + this.convertAmountToPdfFormat(agesum),
              colSpan: 13,
              styles: { halign: 'center', fillColor: "#ffffb3" }
            }
          ]);
          continue;
        }

        // Sum
        agesum += Number(keypair[k][groupdsummarycol] || 0);

        // Normal data row
        final.push([
          keypair[k].branchName,
          keypair[k].chitNo,
          keypair[k].subscriberName,
          keypair[k].chitstatus,
          keypair[k].receiptNo,
          keypair[k].date,
          keypair[k].trdate,
          keypair[k].amount,
          keypair[k].totaldays,
          keypair[k].pduemonths,
          keypair[k].reference_number,
          keypair[k].cheque_date,
          keypair[k].bankName
        ]);
      }
    }

    return final;
  }

  _groupwiseSummaryExportDataTrialBalance(
    gridData: Record<string, any>[],
    groupedCol: string,
    debitField: string,
    creditField: string,
    isGroupedColDate = false
  ): Record<string, any>[] {

    const groupedMap: Record<string, any[]> = {};
    const keys: string[] = [];

    for (const row of gridData) {
      const groupValue = isGroupedColDate
        ? this.getFormatDateGlobal(row[groupedCol])
        : row[groupedCol];

      if (!groupedMap[groupValue]) {
        keys.push(groupValue);
        groupedMap[groupValue] = [];
      }

      groupedMap[groupValue].push(row);
    }

    const final: Record<string, any>[] = [];

    for (const key of keys) {
      const groupRows = groupedMap[key];

      let debitSum = 0;
      let creditSum = 0;

      final.push({
        group: {
          content: key,
          colSpan: 3,
          styles: { halign: 'left', fillColor: '#e6f7ff', fontStyle: 'bold' }
        }
      });

      for (const row of groupRows) {
        debitSum += Number(row[debitField] ?? 0);
        creditSum += Number(row[creditField] ?? 0);
        final.push(row);
      }

      // final.push({
      //   group: {
      //     content: `Total: ${this.currencyformat(debitSum)}   ${this.currencyformat(creditSum)}`,
      //     colSpan: 3,
      //     styles: { halign: 'right', fillColor: '#ffffb3' }
      //   }
      // });
      final.push({
        isGroupFooter: true,
        pdebitamount: debitSum,
        pcreditamount: creditSum
      });
    }

    return final;
  }

  // _groupwiseSummaryExportDataTB(
  //   gridData: Record<string, any>[],
  //   groupedCol: string,
  //   basicsalary: string,
  //   vda: string,
  //   arrears: string,
  //   absent: string,
  //   total: string,
  //   bonus: string,
  //   sumString: string,
  //   isGroupedColDate = false
  // ): Record<string, any>[] {
  //    ;

  //   const groupedMap: Record<string, Record<string, any>[]> = {};
  //   const keys: string[] = [];

  //   for (const row of gridData) {
  //     const groupValue = isGroupedColDate
  //       ? this.getFormatDateGlobal(row[groupedCol])
  //       : row[groupedCol];

  //     if (!groupedMap[groupValue]) {
  //       keys.push(groupValue);
  //       groupedMap[groupValue] = [{ ...row }];
  //     }

  //     groupedMap[groupValue].push(row);
  //   }

  //   for (const key of keys) {
  //     groupedMap[key].push({});
  //   }

  //   const final: Record<string, any>[] = [];

  //   for (const key of keys) {
  //     const groupRows = groupedMap[key];

  //     let basicSum = 0;
  //     let vdaSum = 0;
  //     let arrearsSum = 0;
  //     let absentSum = 0;
  //     let totalSum = 0;
  //     let bonusSum = 0;

  //     for (let i = 0; i < groupRows.length; i++) {
  //       const row = groupRows[i];

  //       if (i !== 0 && i !== groupRows.length - 1) {
  //         basicSum += Number(row[basicsalary] ?? 0);
  //         vdaSum += Number(row[vda] ?? 0);
  //         arrearsSum += Number(row[arrears] ?? 0);
  //         absentSum += Number(row[absent] ?? 0);
  //         totalSum += Number(row[total] ?? 0);
  //         bonusSum += Number(row[bonus] ?? 0);
  //       }

  //       if (i === 0) {
  //         const groupHeader = isGroupedColDate
  //           ? this.getFormatDateGlobal(row[groupedCol])
  //           : row[groupedCol];

  //         row['group'] = {
  //           content: `${groupHeader}`,
  //           colSpan: 8,
  //           styles: { halign: 'left', fillColor: '#e6f7ff', fontStyle: 'bold', fontSize: 9 }
  //         };
  //       }

  //       if (i === groupRows.length - 1) {
  //         row['group'] = {
  //           content:
  //             `${this.currencyFormat(basicSum)}  ` +
  //             `${this.currencyFormat(vdaSum)}  ` +
  //             `${this.currencyFormat(arrearsSum)}  ` +
  //             `${this.currencyFormat(absentSum)}  ` +
  //             `${this.currencyFormat(totalSum)}  ` +
  //             `${this.currencyFormat(bonusSum)}`,
  //           colSpan: 7,
  //           styles: { halign: 'right', fillColor: '#ffffb3' }
  //         };
  //       }

  //       final.push(row);
  //     }
  //   }

  //   return final;
  // }
  _groupwiseSummaryExportDataTB(
    griddata: any[],
    groupdcol: string,
    debitamount1: string,
    creditamount1: string,
    debitamount2: string,
    creditamount2: string,
    debittotal: string,
    credittotal: string,
    sumstring: string,
    isgroupedcolDate: boolean
  ): any[] {
    const groupMap = new Map<string, any[]>();

    for (const row of griddata) {
      const groupKey: string = isgroupedcolDate
        ? this.getFormatDateGlobal(row[groupdcol])
        : String(row[groupdcol] ?? '');

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(row);
    }

    const final: any[] = [];

    for (const [groupKey, rows] of groupMap.entries()) {
      final.push({
        isGroupHeader: true,
        groupLabel: groupKey,
        group: {
          content: groupKey,
          colSpan: 7,
          styles: {
            halign: 'left',
            fillColor: '#e6f7ff',
            fontStyle: 'bold',
            fontSize: 9,
          },
        }
      });

      let d1Sum = 0, c1Sum = 0, d2Sum = 0, c2Sum = 0, dtSum = 0, ctSum = 0;

      for (const row of rows) {
        d1Sum += parseFloat(row[debitamount1]) || 0;
        c1Sum += parseFloat(row[creditamount1]) || 0;
        d2Sum += parseFloat(row[debitamount2]) || 0;
        c2Sum += parseFloat(row[creditamount2]) || 0;
        dtSum += parseFloat(row[debittotal]) || 0;
        ctSum += parseFloat(row[credittotal]) || 0;
        final.push(row);
      }

      final.push({
        isSubtotal: true,
        accountname: `${groupKey} Total`,
        [debitamount1]: d1Sum,
        [creditamount1]: c1Sum,
        [debitamount2]: d2Sum,
        [creditamount2]: c2Sum,
        [debittotal]: dtSum,
        [credittotal]: ctSum,
      });
    }

    return final;
  }



  // _getGroupingGridExportData<T extends Record<string, any>>(
  //   gridData: T[],
  //   groupedCol: keyof T,
  //   isGroupedColDate: boolean
  // ): T[] {
  //    ;

  //   if (!gridData?.length) return [];

  //   const groupedMap = new Map<string, T[]>();

  //   // 🔹 Grouping
  //   for (const item of gridData) {
  //     const rawValue = item[groupedCol];

  //     const groupKey = isGroupedColDate
  //       ? this.getFormatDateGlobal(rawValue)
  //       : String(rawValue);

  //     if (!groupedMap.has(groupKey)) {
  //       groupedMap.set(groupKey, []);
  //     }

  //     groupedMap.get(groupKey)!.push({ ...item }); // clone to avoid mutation
  //   }

  //   const finalResult: T[] = [];

  //   // 🔹 Build final array with group headers
  //   groupedMap.forEach((items, key) => {
  //     items.forEach((item, index) => {
  //       if (index === 0) {
  //         const groupHeader = isGroupedColDate
  //           ? this.getFormatDateGlobal(item[groupedCol])
  //           : String(item[groupedCol]);

  //         (item as any).group = {
  //           content: groupHeader,
  //           colSpan: 17,
  //           styles: {
  //             halign: 'left',
  //             fillColor: '#e6f7ff'
  //           }
  //         };
  //       }

  //       finalResult.push(item);
  //     });
  //   });

  //   return finalResult;
  // }
  _getGroupingGridExportData<T extends Record<string, any>>(
    gridData: T[],
    groupedCol: keyof T,
    isGroupedColDate: boolean
  ): T[] {

    if (!gridData?.length) return [];

    const groupedMap = new Map<string, T[]>();

    for (const item of gridData) {

      const rawValue = item[groupedCol];

      const groupKey = isGroupedColDate
        ? this.getFormatDateGlobal(rawValue)
        : String(rawValue);

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }

      groupedMap.get(groupKey)!.push({ ...item });
    }

    const finalResult: T[] = [];

    groupedMap.forEach((items) => {

      items.forEach((item, index) => {

        if (index === 0) {

          const groupHeader = isGroupedColDate
            ? this.getFormatDateGlobal(item[groupedCol])
            : String(item[groupedCol]);

          //   (item as any).group = {
          //     content: groupHeader,
          //     colSpan: 8,
          //     styles: {
          //       halign: 'left',
          //       fillColor: '#e6f7ff'
          //     }
          //   };
          // }
          finalResult.push({
            group: { content: groupHeader, colSpan: 8, styles: { halign: 'left', fillColor: '#e6f7ff' } }
          } as any);
        }

        delete (item as any).group;

        finalResult.push(item);
      });
    });

    return finalResult;
  }
  _downloadDayBookReportsPdf(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: any,
    betweenorason: string,
    fromdate: string,
    todate: string,
    Secondreportname: string,
    secondgridrows: any[],
    secondgridheaders: any[],
    SecondcolWidthHeight: any,
    receiptamt: any,
    paidamt: any,
    printorpdf: string
  ): void {

    const address = this.getcompanyaddress();
    const currencyformat = this.currencysymbol;
    const Companyreportdetails = this._getCompanyDetails();
    const doc = new jsPDF(pagetype);
    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');
    const kapil_logo = this.getKapilGroupLogo();
    const companyName = Companyreportdetails?.companyName ?? '';
    const companyAddress = Companyreportdetails?.registrationAddress ?? '';
    const companyCIN = Companyreportdetails?.cinNumber ?? '';
    const companyBranch = Companyreportdetails?.branchName ?? '';

    const lMargin = 15;
    const rMargin = 15;
    let pdfInMM: number;

    autoTable(doc, {
      columns: gridheaders,
      body: gridData,
      theme: 'grid',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },
      styles: {
        cellPadding: 1,
        fontSize: 8,
        cellWidth: 'wrap',

        overflow: 'linebreak'
      },
      columnStyles: colWidthHeight,
      startY: 62,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      didDrawPage: (data: any) => {

        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();

        if (doc.getNumberOfPages() === 1) {

          doc.setFontSize(15);

          if (pagetype === 'a4') {

            doc.addImage(kapil_logo, 'JPEG', 10, 15, 20, 20);
            // doc.text(Companyreportdetails?.pCompanyName??'', 60, 20);
            // doc.setFontSize(8);
            // doc.text(address, 40, 27);

            // if (Companyreportdetails?.pCinNo??'') {
            //   doc.text('CIN : ' + Companyreportdetails?.pCinNo, 85, 32);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 105, 15, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              105,
              21,
              { align: 'center' }
            );

            doc.text(`CIN : ${companyCIN}`, 105, 26, { align: 'center' });

            doc.setFontSize(14);
            doc.text(reportName, 90, 42);

            // doc.setFontSize(10);
            // doc.text('Branch : ' + Companyreportdetails?.pBranchname, 163, 50);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Branch : ${companyBranch}`, 160, 57);

            //           if (betweenorason === 'Between' && fromdate && todate) {
            //             doc.text('Between : ' + fromdate + ' And ' + todate, 15, 50);
            //           } else if (betweenorason === 'As On' && fromdate) {
            //             doc.text('As on : ' + fromdate, 15, 50);
            //           } else if (fromdate && todate) {
            //   doc.text('Between : ' + fromdate + ' And ' + todate, 15, 50);
            // }
            if (betweenorason === 'As On' && fromdate) {
              doc.setFontSize(9);
              doc.text('As On : ' + fromdate, 15, 50);
            } else if (betweenorason === 'Between' && fromdate && todate) {
              doc.setFontSize(9);
              doc.text('Between : ' + fromdate + ' And ' + todate, 15, 50);
            } else if (fromdate && todate) {
              doc.setFontSize(9);
              doc.text('As on : ' + fromdate + ' And ' + todate, 15, 50);
            }

            pdfInMM = 233;
            doc.line(10, 53, pdfInMM - lMargin - rMargin, 53);
          }

          if (pagetype === 'landscape') {

            doc.addImage(kapil_logo, 'JPEG', 20, 5, 20, 20);
            // doc.text(Companyreportdetails?.pCompanyName??'', 110, 10);
            // doc.setFontSize(10);
            // doc.text(address.substring(0, 150), 150, 15, { align: 'center' });

            // if (Companyreportdetails?.pCinNo??'') {
            //   doc.text('CIN : ' + Companyreportdetails?.pCinNo, 115, 20);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, pageWidth / 2, 15, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              pageWidth / 2,
              21,
              { align: 'center' }
            );

            doc.text(`CIN : ${companyCIN}`, pageWidth / 2, 26, { align: 'center' });

            doc.setFontSize(14);
            doc.text(reportName, 130, 35);
            doc.text('Form XV', 132, 40);

            // doc.setFontSize(10);
            // doc.text('Branch : ' + Companyreportdetails?.pBranchname, 235, 50);

            if (betweenorason === 'Between') {
              doc.setFontSize(9);
              doc.text('Between : ' + fromdate + ' And ' + todate, 15, 50);
            } else if (betweenorason === 'As On' && fromdate) {
              doc.setFontSize(9);
              doc.text('As on : ' + fromdate, 15, 50);
            }
            doc.setFontSize(9);
            doc.text(
              `Branch : ${companyBranch}`,
              pageWidth - 15,
              50,
              { align: 'right' }
            );

            pdfInMM = 315;
            doc.line(10, 53, pdfInMM - lMargin - rMargin, 53);

            doc.text('Receipts', 90, 60);
            doc.text('Payments', 190, 60);
          }
        }

        let page = 'Page ' + doc.getNumberOfPages();
        if (typeof doc.putTotalPages === 'function') {
          page += ' of ' + totalPagesExp;
        }

        doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
        doc.setFontSize(10);
        doc.text(page, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      }
    });

    autoTable(doc, {
      columns: secondgridheaders,
      body: secondgridrows,
      theme: 'striped',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },
      styles: {
        cellPadding: 1,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellWidth: 'wrap',

        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 35, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      },
      startY: (doc as any).lastAutoTable.finalY + 20,
      showHead: 'everyPage',
      showFoot: 'lastPage',
      didDrawPage: (data: any) => {

        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();

        let page = 'Page ' + doc.getNumberOfPages();
        if (typeof doc.putTotalPages === 'function') {
          page += ' of ' + totalPagesExp;
        }

        doc.setFontSize(10);
        doc.text('Printed on : ' + today, data.settings.margin.left, pageHeight - 5);
        doc.text(page, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      }
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(reportName + '.pdf');
    }

    if (printorpdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  _downloadReportsPdfAccountSummaryason(
    reportName: string,
    gridData: any[],
    gridHeaders: any[],
    columnStyles: any,
    pageType: 'a4' | 'landscape',
    betweenOrAsOn: 'Between' | 'As On',
    fromDate: string,
    toDate: string,
    printOrPdf: 'Pdf' | 'Print'
  ): void {

    const address = this.getcompanyaddress();
    const companyDetails = this._getCompanyDetails();
    const currencySymbol = this.currencysymbol;
    const companyName = companyDetails?.companyName ?? '';
    const companyAddress = companyDetails?.registrationAddress ?? '';
    const companyCIN = companyDetails?.cinNumber ?? '';
    const companyBranch = companyDetails?.branchName ?? '';

    const doc = new jsPDF({
      orientation: pageType === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const rupeeImage = this._getRupeeSymbol();
    const kapilLogo = this.getKapilGroupLogo();
    const today = this.pdfProperties('Date');
    const totalPagesExp = '{total_pages_count_string}';

    const lMargin = 15;
    const rMargin = 15;
    let pdfWidth = pageType === 'landscape' ? 315 : 233;

    autoTable(doc, {
      head: [gridHeaders],
      body: gridData,
      theme: 'grid',
      startY: 48,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      styles: {
        cellPadding: 1,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellWidth: 'wrap',
        overflow: 'linebreak'
      },

      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right' | 'justify',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },

      columnStyles: columnStyles,

      didDrawPage: (data: any) => {

        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();

        doc.setFont('helvetica', 'normal');

        // HEADER ONLY FIRST PAGE
        if (doc.getNumberOfPages() === 1) {

          if (pageType === 'a4') {

            doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);
            // doc.setFontSize(15);
            // doc.text(companyDetails?.pCompanyName ?? '', 60, 10);

            // doc.setFontSize(8);
            // doc.text(address, 30, 15);

            // if (companyDetails?.pCinNo) {
            //   doc.text(`CIN : ${companyDetails?.pCinNo ?? ''}`, 85, 20);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, 105, 15, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              105,
              21,
              { align: 'center' }
            );
            doc.text(`CIN : ${companyCIN}`, 105, 26, { align: 'center' });

            doc.setFontSize(14);
            doc.text(reportName, 85, 35);

            doc.setFontSize(10);
            // doc.text(`Branch : ${companyDetails?.pBranchname ?? ''}`, 155, 40);
            doc.text(`Branch : ${companyBranch}`, 155, 40);

            if (betweenOrAsOn === 'Between') {
              doc.text(`Between : ${fromDate} And ${toDate}`, 10, 40);
            } else if (betweenOrAsOn === 'As On' && fromDate) {
              doc.text(`As On : ${fromDate}`, 10, 40);
            }

            doc.line(10, 45, (pdfWidth - lMargin - rMargin), 45);
          }

          if (pageType === 'landscape') {

            doc.addImage(kapilLogo, 'JPEG', 20, 15, 20, 20);
            doc.setFontSize(15);
            doc.text(companyName, 110, 20);

            doc.setFontSize(10);
            doc.text(companyAddress, 70, 27);

            if (companyCIN) {
              doc.text(`CIN : ${companyCIN}`, 125, 32);
            }

            doc.setFontSize(14);
            doc.text(reportName, 125, 42);

            doc.setFontSize(10);
            doc.text(`Branch : ${companyBranch}`, 235, 47);

            if (betweenOrAsOn === 'Between') {
              doc.text(`Between : ${fromDate} And ${toDate}`, 15, 47);
            } else if (betweenOrAsOn === 'As On' && fromDate) {
              doc.text(`As On : ${fromDate}`, 15, 47);
            }

            doc.line(10, 50, (pdfWidth - lMargin - rMargin), 50);
          }

        } else {
          data.settings.margin.top = 20;
          data.settings.margin.bottom = 15;
        }

        // FOOTER
        let pageText = `Page ${doc.getNumberOfPages()}`;

        if (typeof (doc as any).putTotalPages === 'function') {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(5, pageHeight - 10, (pdfWidth - lMargin - rMargin), pageHeight - 10);

        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, data.settings.margin.left, pageHeight - 5);
        doc.text(pageText, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      },

      willDrawCell: (data: any) => {
        if (data.row.index === gridData.length - 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
        }
      },

      didDrawCell: (data: any) => {

        if (
          (data.column.index === 2 || data.column.index === 3) &&
          data.cell.section === 'body'
        ) {

          const cellValue = data.cell.raw;
          if (!cellValue || currencySymbol !== '₹') return;

          // if (cellValue && currencySymbol === '₹') {

          //   const textPos = data.cell.textPos;

          //   doc.addImage(
          //     rupeeImage,
          //     textPos.x - data.cell.contentWidth,
          //     textPos.y + 0.5,
          //     1.5,
          //     1.5
          //   );
          // }
          const padding = data.cell.padding;
          let paddingLeft = 2;
          if (typeof padding === 'number') {
            paddingLeft = padding;
          } else if (padding && typeof padding === 'object') {
            paddingLeft = (padding as any).left ?? 2;
          }

          const x = data.cell.x + paddingLeft;
          const y = data.cell.y + data.cell.height / 2 - 1;

          doc.addImage(rupeeImage, 'PNG', x, y, 1.5, 1.5);
        }
      }

    });

    if (typeof (doc as any).putTotalPages === 'function') {
      (doc as any).putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    }

    if (printOrPdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  _downloadReportsPdfAccountSummary(
    reportName: string,
    gridData: any[],
    gridHeaders: any[],
    columnStyles: any,
    pageType: 'a4' | 'landscape',
    betweenOrAsOn: 'Between' | 'As On',
    fromDate: string,
    toDate: string,
    printOrPdf: 'Pdf' | 'Print'
  ): void {

    const address: string = this.getcompanyaddress();
    const companyDetails = this._getCompanyDetails();
    const currencySymbol: string | null = this.currencysymbol;
    const companyName = companyDetails?.companyName ?? '';
    const companyAddress = companyDetails?.registrationAddress ?? '';
    const companyCIN = companyDetails?.cinNumber ?? '';
    const companyBranch = companyDetails?.branchName ?? '';

    const doc = new jsPDF({
      orientation: pageType === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const rupeeImage = this._getRupeeSymbol();
    const kapilLogo = this.getKapilGroupLogo();
    const today = this.pdfProperties('Date');
    const totalPagesExp = '{total_pages_count_string}';

    const lMargin = 15;
    const rMargin = 15;
    const pdfWidth = pageType === 'landscape' ? 315 : 233;

    autoTable(doc, {

      head: [gridHeaders],
      body: gridData,
      theme: 'grid',
      startY: 48,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      styles: {
        cellPadding: 1,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellWidth: 'wrap',
        overflow: 'linebreak'
      },

      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right' | 'justify',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },

      columnStyles: columnStyles,

      didDrawPage: (data: any) => {

        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();

        doc.setFont('helvetica', 'normal');

        // HEADER ONLY ON FIRST PAGE
        if (doc.getNumberOfPages() === 1) {

          if (pageType === 'a4') {

            doc.addImage(kapilLogo, 'JPEG', 10, 15, 20, 20);
            // doc.setFontSize(15);
            // doc.text(companyDetails?.pCompanyName ?? '', 60, 20);

            // doc.setFontSize(8);
            // doc.text(address, 40, 27, { align: 'left' });

            // if (companyDetails?.pCinNo) {
            //   doc.text(`CIN : ${companyDetails?.pCinNo ?? ''}`, 85, 32);
            // }

            doc.setFontSize(14);
            doc.text(reportName, 90, 42);

            doc.setFontSize(10);
            doc.text(`Branch : ${companyBranch}`, 163, 47);

            if (betweenOrAsOn === 'Between') {
              doc.text(`Between : ${fromDate} And ${toDate}`, 15, 47);
            } else if (betweenOrAsOn === 'As On' && fromDate) {
              doc.text(`As On : ${fromDate}`, 15, 47);
            }

            doc.line(10, 50, pdfWidth - lMargin - rMargin, 50);
          }

          if (pageType === 'landscape') {
            const centerX = pageWidth / 2;

            doc.addImage(kapilLogo, 'JPEG', 10, 5, 20, 20);
            // doc.setFontSize(15);
            // doc.text(companyDetails?.pCompanyName ?? '', 110, 10);

            // doc.setFontSize(10);
            // const trimmedAddress = address?.substring(0, 150) ?? '';
            // doc.text(trimmedAddress, 150, 15, { align: 'center' });

            // if (companyDetails?.pCinNo) {
            //   doc.text(`CIN : ${companyDetails?.pCinNo ?? ''}`, 125, 20);
            // }
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, centerX, 15, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              centerX,
              21,
              { align: 'center' }
            );
            doc.text(`CIN : ${companyCIN}`, centerX, 26, { align: 'center' });


            doc.setFontSize(14);
            doc.text(reportName, 125, 35);

            doc.setFontSize(10);
            // doc.text(`Branch : ${companyDetails?.pBranchname ?? ''}`, 235, 40);
            doc.text(`Branch : ${companyBranch}`, 235, 40);

            if (betweenOrAsOn === 'Between') {
              doc.text(`Between : ${fromDate} And ${toDate}`, 15, 40);
            } else if (betweenOrAsOn === 'As On' && fromDate) {
              doc.text(`As On : ${fromDate}`, 15, 40);
            }

            doc.line(10, 45, pdfWidth - lMargin - rMargin, 45);
          }

        } else {
          data.settings.margin.top = 20;
          data.settings.margin.bottom = 15;
        }

        // FOOTER
        let pageText = `Page ${doc.getNumberOfPages()}`;

        if (typeof (doc as any).putTotalPages === 'function') {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(5, pageHeight - 10, pdfWidth - lMargin - rMargin, pageHeight - 10);

        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, data.settings.margin.left, pageHeight - 5);
        doc.text(pageText, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      },

      willDrawCell: (data: any) => {
        if (data.row.index === gridData.length - 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
        }
      },

      didDrawCell: (data: any) => {

        const isAmountColumn =
          [2, 3, 4, 5].includes(data.column.index) &&
          data.cell.section === 'body';

        if (!isAmountColumn) return;

        const cellValue = data.cell.raw;

        if (!cellValue || currencySymbol !== '₹') return;

        // const textPos = data.cell.textPos;

        // const isLastRow = data.row.index === gridData.length - 1;

        // doc.setFont('helvetica', isLastRow ? 'bold' : 'normal');

        // doc.addImage(
        //   rupeeImage,
        //   textPos.x - data.cell.contentWidth + (isLastRow ? 3 : 0),
        //   textPos.y + (isLastRow ? 0.7 : 0.5),
        //   isLastRow ? 2 : 1.5,
        //   isLastRow ? 2 : 1.5
        // );
        const padding = data.cell.padding;
        let paddingLeft = 2;
        if (typeof padding === 'number') {
          paddingLeft = padding;
        } else if (padding && typeof padding === 'object') {
          paddingLeft = (padding as any).left ?? 2;
        }

        const x = data.cell.x + paddingLeft;
        const y = data.cell.y + data.cell.height / 2 - 1;

        const isLastRow = data.row.index === gridData.length - 1;

        doc.setFont('helvetica', isLastRow ? 'bold' : 'normal');

        const size = isLastRow ? 2 : 1.5;
        doc.addImage(rupeeImage, 'PNG', x, y, size, size);
      }

    });

    if (typeof (doc as any).putTotalPages === 'function') {
      (doc as any).putTotalPages(totalPagesExp);
    }

    if (printOrPdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    }

    if (printOrPdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  _setCompanyDetails() {
    // this.comapnydetails = JSON.parse(sessionStorage.getItem("companydetails") ?? '');
    const raw = sessionStorage.getItem("CompanyDetails");
    this.comapnydetails = raw ? JSON.parse(raw) : {};
  }
  _downloadGridPdf1(
    reportName: any,
    gridData: any[],
    gridheaders: any,
    colWidthHeight: any,
    pagetype: any,
    printorpdf: string,
    Narration: any,
    JVNumber: any,
    Jvdate: any,
    printeddate: any,
    postedby: any,
    paidTo: any,
    amountInWords: any,
    modeOfPayment?: string,
    referenceInfo?: string
  ) {

    const address = this.getcompanyaddress();
    const Companyreportdetails =
      this._getCompanyDetails();

    const doc = new jsPDF(pagetype);

    const totalPagesExp =
      '{total_pages_count_string}';

    const today =
      this.pdfProperties('Date');

    const currencyformat =
      this.currencysymbol;

    const rupeeImage =
      this._getRupeeSymbol();

    const kapil_logo =
      this.getKapilGroupLogo();
    const companyName = Companyreportdetails?.companyName ?? '';
    const companyAddress = Companyreportdetails?.registrationAddress ?? '';
    const companyCIN = Companyreportdetails?.cinNumber ?? '';
    const companyBranch = Companyreportdetails?.branchName ?? '';

    const lMargin = 15;
    const rMargin = 15;

    let pdfInMM: number;

    autoTable(doc, {

      head: [gridheaders],
      body: gridData,

      theme: 'grid',
      rowPageBreak: 'avoid',

      headStyles: {
        fillColor:
          this.pdfProperties('Header Color'),
        halign:
          this.pdfProperties(
            'Header Alignment'
          ) as 'left' | 'right' | 'center',
        fontSize:
          Number(this.pdfProperties(
            'Header Fontsize'
          ))
      },

      styles: {
        cellWidth: 'wrap',
        fontSize:
          Number(this.pdfProperties(
            'Cell Fontsize'
          )),

        overflow: 'linebreak'
      },

      columnStyles: colWidthHeight,

      startY: 62,

      margin: {
        right: 10,
        left: 10
      },

      showHead: 'everyPage',

      didDrawPage: (data: any) => {

        const pageSize =
          doc.internal.pageSize;

        const pageWidth =
          pageSize.getWidth();

        const pageHeight =
          pageSize.getHeight();

        doc.setFont('helvetica', 'normal');

        if (
          doc.getNumberOfPages() === 1
        ) {

          doc.setFontSize(15);

          if (pagetype === 'a4') {

            doc.addImage(
              kapil_logo,
              'JPEG',
              10,
              5, 20, 20
            );

            // doc.text(
            //   Companyreportdetails?.pCompanyName ?? '',
            //   72,
            //   10
            // );

            // doc.setFontSize(8);

            // const address1 =
            //   address.substr(0, 115);

            // doc.text(
            //   address1,
            //   110,
            //   15,
            //   { align: 'center' }
            // );

            // const address2 =
            //   address.substring(115);

            // doc.text(
            //   address2,
            //   110,
            //   18
            // );

            // if (
            //   Companyreportdetails?.pCinNo ?? ''
            // ) {
            //   doc.text(
            //     'CIN : ' +
            //     Companyreportdetails?.pCinNo,
            //     90,
            //     20
            //   );
            // }
            const pageSize = doc.internal.pageSize;
            const pageWidth = pageSize.getWidth();
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(companyName, pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(
              companyAddress,
              pageWidth / 2, 21,
              { align: 'center' }
            );
            doc.text(`CIN : ${companyCIN}`, pageWidth / 2, 26, { align: 'center' });

            doc.setFontSize(14);

            doc.text(
              reportName,
              87,
              33
            );

            doc.setFontSize(10);

            // doc.text(
            //   'Branch : ' +
            //   Companyreportdetails?.pBranchname,
            //   150,
            //   35
            // );
            doc.text(
              `Branch : ${companyBranch}`,
              150,
              35
            );

            doc.text(
              'Voucher No:' + JVNumber,
              15,
              45
            );
            if (reportName !== 'Journal Voucher') {
              doc.text(
                'Paid To : ' + paidTo,
                15,
                50
              );
            }
            //             if (modeOfPayment && reportName !== 'Journal Voucher') {
            //   const mopLabel = 'Mode of Payment : ' + modeOfPayment.toUpperCase();
            //   const refPart = referenceInfo ? '  (' + referenceInfo + ')' : '';
            //   doc.text(mopLabel + refPart, 15, 55);
            // }

            doc.text(
              'Date : ' + Jvdate,
              160,
              45
            );

            pdfInMM = 233;

            doc.line(10, 39, pageWidth - 10, 39);
          }

          if (pagetype === 'landscape') {

            doc.addImage(
              kapil_logo,
              'JPEG',
              20,
              15,
              20,
              20
            );

            doc.text(
              Companyreportdetails?.companyName ?? '',
              110,
              20
            );

            doc.setFontSize(10);

            doc.text(
              address,
              80,
              27
            );

            if (
              Companyreportdetails?.cinNumber ?? ''
            ) {
              doc.text(
                'CIN : ' +
                Companyreportdetails?.cinNumber,
                125,
                32
              );
            }

            doc.setFontSize(14);

            doc.text(
              reportName,
              130,
              42
            );

            doc.text(
              'Branch : ' +
              Companyreportdetails?.branchName,
              235,
              50
            );

            pdfInMM = 315;

            doc.line(10, 48, pageWidth - 10, 48);
          }
        }

        let page =
          'Page ' +
          doc.getNumberOfPages();

        if (
          typeof doc.putTotalPages ===
          'function'
        ) {
          page =
            page +
            ' of ' +
            totalPagesExp;
        }

        doc.line(5, pageHeight - 10, pageWidth - 5, pageHeight - 10);

        doc.setFontSize(10);

        doc.text(
          'Printed on : ' + today,
          data.settings.margin.left,
          pageHeight - 5
        );

        doc.text(
          page,
          pageWidth -
          data.settings.margin.right -
          20,
          pageHeight - 5
        );
      },

      didDrawCell: (data: any) => {

        if (
          (data.column.index === 1 ||
            data.column.index === 2) &&
          data.cell.section === 'body' &&
          reportName ===
          'Journal Voucher'
        ) {

          const td =
            data.cell.raw;

          if (
            td &&
            currencyformat === '₹'
          ) {

            const textPos =
              data.cell.textPos;

            if (!textPos || textPos.x === undefined || textPos.y === undefined) return;

            doc.addImage(
              rupeeImage,
              textPos.x -
              data.cell.contentWidth,
              textPos.y + 0.5,
              1.5,
              1.5
            );
          }
        }
      }
    });
    const finalY = (doc as any).lastAutoTable?.finalY ?? 60;
    if (reportName !== 'Journal Voucher') {
      doc.setFontSize(10);

      doc.text(
        'Amount In Words : ' + amountInWords,
        15,
        finalY + 10
      );
    }
    // const finalY = (doc as any).lastAutoTable?.finalY ?? 60;
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(10);
    const narrationY = finalY + 20;

    // doc.text('Narration : ', 15, finalY + 20);
    doc.text('Narration : ', 15, narrationY);

    doc.setFont('helvetica', 'normal');
    // const Content = String(Narration ?? '');
    // const P1Lines = doc.splitTextToSize(Content, 155); 
    const narrationText = String(Narration ?? '');
    const narrationLines = doc.splitTextToSize(narrationText, 140);
    doc.text(narrationLines, 45, narrationY);
    const narrationEndY = narrationY + (narrationLines.length * 5);
    if (modeOfPayment && reportName !== 'Journal Voucher') {
      const mopLabel = 'Mode of Payment : ' + modeOfPayment.toUpperCase();
      const refPart = referenceInfo ? '  (' + referenceInfo + ')' : '';
      doc.text(mopLabel + refPart, 15, narrationEndY + 5);
    }
    const sigY = narrationEndY + 15;
    if (sigY + 20 > pageHeight) {
      doc.addPage();
    }

    // this.addWrappedText({
    //   text: P1Lines,
    //   textWidth: 155,
    //   doc,
    //   fontSize: 9,
    //   fontType: 'normal',
    //   lineSpacing: 4,
    //   xPosition: 40,
    //   initialYPosition: finalY + 15,
    //   pageWrapInitialYPosition: 15
    // });

    // const narrationLineCount = P1Lines.length;
    // const narrationEndY = finalY + 15 + (narrationLineCount * 4);

    doc.text('(Approved By)', 25, sigY);
    doc.text('(Verified By)', 95, sigY);
    doc.text(String(postedby ?? ''), 160, sigY - 6); // posted-by name above label
    doc.text('(Posted By)', 160, sigY);
    if (
      typeof doc.putTotalPages ===
      'function'
    ) {
      doc.putTotalPages(
        totalPagesExp
      );
    }

    if (printorpdf === 'Pdf') {
      doc.save(reportName + '.pdf');
    }

    if (printorpdf === 'Print') {
      this.setiFrameForPrint(doc);
    }
  }
  _downloadPFStatementReportsPdf(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: any,
    betweenorason: any,
    fromdate: any,
    todate: any,
    totalContribution: any,
    employerContribution: any,
    employeeContribution: any,
    pfContribution: any,
    printorpdf: 'Pdf' | 'Print',
    monthstatus: boolean
  ) {

    const address = this.getcompanyaddress();
    const company = this._getCompanyDetails();

    const doc = new jsPDF({ orientation: pagetype });

    const today = this.pdfProperties("Date");
    const logo = this.getKapilGroupLogo();
    const rupeeImage = this._getRupeeSymbol();
    const currency = this.currencysymbol;

    const totalPagesExp = '{total_pages_count_string}';

    // ✅ TABLE
    autoTable(doc, {
      head: [gridheaders],
      body: gridData,
      startY: 48,
      theme: 'grid',

      styles: {
        fontSize: Number(this.pdfProperties("Cell Fontsize")),
        cellPadding: 2
      },

      headStyles: {
        fillColor: this.pdfProperties("Header Color"),
        halign: 'center',
        fontSize: Number(this.pdfProperties("Header Fontsize"))
      },

      didDrawPage: (data) => {

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // ✅ HEADER
        doc.setFontSize(14);

        if (logo) {
          doc.addImage(logo, 'JPEG', 10, 5, 20, 20);
        }

        doc.text(company?.pCompanyName || '', pageWidth / 2, 10, { align: 'center' });

        doc.setFontSize(9);
        doc.text(address || '', pageWidth / 2, 15, { align: 'center' });

        if (company?.pCinNo) {
          doc.text(`CIN: ${company.pCinNo}`, pageWidth / 2, 20, { align: 'center' });
        }

        doc.setFontSize(12);
        doc.text(reportName, pageWidth / 2, 30, { align: 'center' });

        doc.setFontSize(9);
        doc.text(`Branch: ${company?.pBranchname || ''}`, pageWidth - 20, 40, { align: 'right' });

        if (betweenorason === "Between") {
          doc.text(`Between: ${fromdate} - ${todate}`, 15, 40);
        } else if (fromdate) {
          doc.text(`As on: ${fromdate}`, 15, 40);
        }

        // Line
        doc.line(10, 45, pageWidth - 10, 45);

        // ✅ FOOTER
        const page = doc.getNumberOfPages();
        let pageText = `Page ${page}`;

        if (typeof doc.putTotalPages === 'function') {
          pageText += ` of ${totalPagesExp}`;
        }

        doc.line(10, pageHeight - 10, pageWidth - 10, pageHeight - 10);

        doc.setFontSize(8);
        doc.text(`Printed on: ${today}`, 10, pageHeight - 5);
        doc.text(pageText, pageWidth - 20, pageHeight - 5, { align: 'right' });
      }
    });

    // ✅ FINAL Y POSITION
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);

    // ✅ TOTALS
    doc.text(`Total: ${totalContribution}`, 30, finalY);
    doc.text(`Employer Contribution: ${employerContribution}`, 30, finalY + 6);
    doc.text(`Employee Contribution: ${employeeContribution}`, 30, finalY + 12);
    doc.text(`Total PF: ${pfContribution}`, 30, finalY + 18);

    // ✅ EXTRA FIELDS
    doc.text("Cheque NO.", 15, finalY + 30);
    doc.text("Bank", 115, finalY + 30);

    doc.text("A.G.M", 15, finalY + 55);
    doc.text("R.M", 95, finalY + 55);
    doc.text("Manager", 165, finalY + 55);
    doc.text("Account Officer", 225, finalY + 55);

    // ✅ PAGE COUNT FIX
    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    // ✅ ACTION
    if (printorpdf === "Pdf") {
      doc.save(`${reportName}.pdf`);
    } else {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  }
  dateFormatForGrid(date: Date): string | null {
    const format = sessionStorage.getItem('dateformat') || 'DD-MMM-YYYY';

    const formatMap: Record<string, string> = {
      'MM DD YYYY': 'MM dd yyyy',
      'DD MM YYYY': 'dd MM yyyy',
      'YYYY MM DD': 'yyyy MM dd',
      'DD/MM/YYYY': 'dd/MM/yyyy',
      'MM/DD/YYYY': 'MM/dd/yyyy',
      'YYYY/MM/DD': 'yyyy/MM/dd',
      'DD-MM-YYYY': 'dd-MM-yyyy',
      'MM-DD-YYYY': 'MM-dd-yyyy',
      'YYYY-MM-DD': 'yyyy-MM-dd',
      'DD-MMM-YYYY': 'dd-MMM-yyyy',
      'MMM-DD-YYYY': 'MMM-dd-yyyy',
      'YYYY-MMM-DD': 'yyyy-MMM-dd'
    };

    const angularFormat = formatMap[format] || 'dd-MMM-yyyy';

    return this.datepipe.transform(date, angularFormat);
  }
  _downLoadEarnedLeavesPDF(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: 'a4' | 'landscape',
    betweenorason: string,
    fromdate: string,
    todate: any,
    printorpdf: 'Pdf' | 'Print'
  ): void {

    const address = this.getcompanyaddress();
    const company = this._getCompanyDetails();
    const doc = new jsPDF({ orientation: pagetype === 'landscape' ? 'landscape' : 'portrait' });

    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');
    const logo = this.getKapilGroupLogo();
    const rupeeImage = this._getRupeeSymbol();

    autoTable(doc, {
      head: [gridheaders],
      body: gridData,

      theme: 'grid',

      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },

      styles: {
        cellPadding: 2,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        overflow: 'linebreak'
      },

      columnStyles: colWidthHeight,
      startY: 50,

      didDrawPage: (data) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        doc.setFontSize(14);
        doc.text(company.pCompanyName, pageWidth / 2, 10, { align: 'center' });

        doc.setFontSize(9);
        doc.text(address, pageWidth / 2, 16, { align: 'center' });

        if (company.pCinNo) {
          doc.text(`CIN: ${company.pCinNo}`, pageWidth / 2, 21, { align: 'center' });
        }

        doc.addImage(logo, 'JPEG', 10, 8, 20, 15);

        doc.setFontSize(12);
        doc.text(reportName, pageWidth / 2, 30, { align: 'center' });

        doc.setFontSize(9);
        doc.text(`Branch: ${company.pBranchname}`, pageWidth - 60, 35);

        if (betweenorason === 'Between') {
          doc.text(`Between: ${fromdate} - ${todate}`, 15, 35);
        } else if (fromdate) {
          doc.text(`As on: ${fromdate}`, 15, 35);
        }

        doc.line(10, 40, pageWidth - 10, 40);

        let page = `Page ${doc.getNumberOfPages()}`;
        if (typeof doc.putTotalPages === 'function') {
          page += ` of ${totalPagesExp}`;
        }

        doc.setFontSize(9);
        doc.text(`Printed on: ${today}`, 15, pageHeight - 5);
        doc.text(page, pageWidth - 40, pageHeight - 5);
      },

      didDrawCell: (data) => {
        if (
          (data.column.index === 2 || data.column.index === 3 || data.column.index === 5) &&
          data.section === 'body'
        ) {
          if (this.currencysymbol === '₹') {
            const x = data.cell.x + 2;
            const y = data.cell.y + data.cell.height / 2;
            doc.addImage(rupeeImage, x, y - 2, 3, 3);
          }
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;

    doc.setFontSize(10);
    doc.text('A.G.M', 15, finalY + 20);
    doc.text('R.M', 80, finalY + 20);
    doc.text('Manager', 140, finalY + 20);
    doc.text('Account Officer', 200, finalY + 20);

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setiFrameForPrint(doc);
    }
  }
  _downLoadLoyaltystatementPDF(
    reportName: string,
    gridData: any[],
    gridheaders: any[],
    colWidthHeight: any,
    pagetype: any,
    betweenorason: any,
    fromdate: any,
    todate: any,
    printorpdf: 'Pdf' | 'Print'
  ) {
    const address = this.getcompanyaddress();
    const companyDetails = this._getCompanyDetails();

    const doc = new jsPDF(pagetype);
    const currencyformat = this.currencysymbol;
    const rupeeImage = this._getRupeeSymbol();
    const totalPagesExp = '{total_pages_count_string}';
    const today = this.pdfProperties('Date');
    const kapil_logo = this.getKapilGroupLogo();

    const lMargin = 15;
    const rMargin = 15;
    let pdfInMM: number;

    autoTable(doc, {
      columns: gridheaders,
      body: gridData,
      theme: 'grid',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: this.pdfProperties('Header Color'),
        halign: this.pdfProperties('Header Alignment') as 'left' | 'center' | 'right',
        fontSize: Number(this.pdfProperties('Header Fontsize'))
      },

      styles: {
        cellPadding: 2,
        fontSize: Number(this.pdfProperties('Cell Fontsize')),
        cellWidth: 'wrap',

        overflow: 'linebreak'
      },
      columnStyles: colWidthHeight,
      startY: 48,
      showHead: 'everyPage',
      showFoot: 'lastPage',

      didDrawPage: (data: any) => {
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.getWidth();
        const pageHeight = pageSize.getHeight();

        doc.setFont('helvetica', 'normal');

        if (doc.getNumberOfPages() === 1) {
          doc.setFontSize(15);

          if (pagetype === 'a4') {
            doc.addImage(kapil_logo, 'JPEG', 10, 15, 20, 20);
            doc.text(companyDetails.pCompanyName, 60, 20);

            doc.setFontSize(8);
            doc.text(address, 40, 27);

            if (companyDetails.pCinNo) {
              doc.text(`CIN : ${companyDetails.pCinNo}`, 85, 32);
            }

            doc.setFontSize(14);
            doc.text(reportName, 70, 42);

            doc.setFontSize(10);
            doc.text(`Branch : ${companyDetails.pBranchname}`, 163, 47);

            if (betweenorason === 'Between') {
              doc.text(`Between : ${fromdate} And ${todate}`, 15, 47);
            } else if (fromdate) {
              doc.text(`As on : ${fromdate}`, 15, 47);
            }

            pdfInMM = 233;
            doc.line(10, 50, pdfInMM - lMargin - rMargin, 50);
          }

          if (pagetype === 'landscape') {
            doc.addImage(kapil_logo, 'JPEG', 10, 5, 20, 20);
            doc.text(companyDetails.pCompanyName, 110, 10);

            doc.setFontSize(10);
            doc.text(address, 80, 15);

            if (companyDetails.pCinNo) {
              doc.text(`CIN : ${companyDetails.pCinNo}`, 125, 20);
            }

            doc.setFontSize(14);
            doc.text(reportName, 130, 30);

            doc.setFontSize(10);
            doc.text(`Branch : ${companyDetails.pBranchname}`, 235, 40);

            if (betweenorason === 'Between') {
              doc.text(`Between : ${fromdate} And ${todate}`, 15, 40);
            } else if (fromdate) {
              doc.text(`As on : ${fromdate}`, 15, 40);
            }

            pdfInMM = 315;
            doc.line(10, 45, pdfInMM - lMargin - rMargin, 45);
          }
        } else {
          data.settings.margin.top = 20;
          data.settings.margin.bottom = 15;
        }

        let page = `Page ${doc.getNumberOfPages()}`;
        if (typeof doc.putTotalPages === 'function') {
          page += ` of ${totalPagesExp}`;
        }

        doc.line(5, pageHeight - 10, pdfInMM - lMargin - rMargin, pageHeight - 10);
        doc.setFontSize(10);
        doc.text(`Printed on : ${today}`, data.settings.margin.left, pageHeight - 5);
        doc.text(page, pageWidth - data.settings.margin.right - 20, pageHeight - 5);
      },

      didDrawCell: (data: any) => {
        if (data.column.index === 2 && data.section === 'body') {
          if (currencyformat === '₹') {
            const pos = data.cell.textPos;
            doc.addImage(rupeeImage, pos.x - data.cell.contentWidth, pos.y + 0.5, 1.7, 1.7);
          }
        }
      }
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    if (printorpdf === 'Pdf') {
      doc.save(`${reportName}.pdf`);
    } else {
      this.setiFrameForPrint(doc);
    }
  }











  // uploadFile(data: FormData) {
  //   const urldata = environment.apiUrl;

  //   return this.http.get(urldata).pipe(
  //     mergeMap((json: any) =>
  //       this.http.post(`${json[0]['api']}/Accounts/upload-logo`, data).pipe(
  //         map(this.extractData),
  //         catchError(this.handleError)
  //       )
  //     )
  //   );
  // }


  uploadFile(data: FormData) {
    const urldata = environment.apiUrl;

    return this.http.get(urldata).pipe(
      mergeMap((json: any) =>
        this.http.post(`${json[0]['apiURL']}/Accounts/upload-logo`, data).pipe(
          map(this.extractData),
          catchError(this.handleError)
        )
      )
    );
  }



  GetDesignations(): Observable<any> {
    return this.getAPI('/Common/GetDesignations', '', 'NO');
  }

  getCountries(): Observable<any[]> {
    return this.getAPI('/Common/getCountry', 'GlobalSchema=' + this.getschemaname(), 'YES');
  }

  getStates(countryId: any): Observable<any[]> {
    return this.getAPI('/Common/getstate', 'GlobalSchema=' + this.getschemaname() + '&id=' + countryId, 'YES');
  }

  getDistricts(stateId: any): Observable<any[]> {
    return this.getAPI('/Common/getDistrict', 'GlobalSchema=' + this.getschemaname() + '&id=' + stateId, 'YES');
  }

  getContactTitles(): Observable<any[]> {
    return this.getAPI('/Common/GetContactTitles', '', 'NO');
  }

  getGlobalBanks(): Observable<any[]> {
    return this.getAPI('/Common/GetGlobalBanks', 'GlobalSchema=' + this.getschemaname(), 'YES');
  }

  getRelationTitles(): Observable<any[]> {
    return this.getAPI('/Common/GetRelationTitles', '', 'NO');
  }

  getAddressType(contactType: string): Observable<any[]> {
    return this.getAPI('/Common/GetAddressType', 'GlobalSchema=' + this.getschemaname() + '&contactType=' + contactType, 'YES');
  }

  getDocumentGroupNames(): Observable<any[]> {
    return this.getAPI('/Common/GetDocumentGroupNames', '', 'NO');
  }

  getEnterpriseType(): Observable<any[]> {
    return this.getAPI('/Common/GetEnterpriseType', '', 'NO');
  }

  getBusinessTypes(): Observable<any[]> {
    return this.getAPI('/Common/GetBusinessTypes', '', 'NO');
  }

  getRoles(): Observable<any[]> {
    return this.getAPI('/Common/GetRoles', 'GlobalSchema=' + this.getschemaname(), 'YES');
  }

  getDesignationsAll(): Observable<any[]> {
    return this.getAPI('/Common/GetDesignationsALL', '', 'NO');
  }


  getBranches(): Observable<any[]> {
    return this.getAPI('/Common/GetBranches', 'GlobalSchema=' + this.getschemaname(), 'YES');
  }

  getQualifications(): Observable<any[]> {
    return this.getAPI('/Common/ViewQualificationDetails', '', 'NO');
  }

  getDocumentProofs(docId: number): Observable<any[]> {
    return this.getAPI('/Common/GetDocumentProofs', 'GlobalSchema=' + this.getschemaname() + '&docId=' + docId, 'YES');
  }


  viewContact(contactId: number): Observable<any> {
    return this.getAPI('/ContactMaster/ViewContact', 'GlobalSchema=' + this.getschemaname() + '&refernceid=' + contactId, 'YES');
  }



  setPageModel(pageCriteria: PageCriteria, total: number): number[] {
    pageCriteria.pageSize = total > 0 && total < 10 ? total : 10;
    pageCriteria.offset = 0;
    pageCriteria.pageNumber = 1;
    pageCriteria.footerPageHeight = 50;

    if (total <= 0) return [10];
    else if (total < 10) return [total];
    else if (total === 10) return [10];
    else if (total <= 20) return [10, total];
    else if (total <= 50) return [10, 20, total];
    else return [10, 20, 50];
  }




}
