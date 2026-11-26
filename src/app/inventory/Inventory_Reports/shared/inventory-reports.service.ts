import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { CommonService } from '../../../core/services/Common/common.service';
import {
  InventoryReportApiResponse,
  InventoryReportDefinition,
  InventoryReportFilterValue,
  InventoryReportFilters,
  InventoryReportRow
} from './inventory-report.models';

// Backs GET /api/reports/stock-valuation-comparison
// (inventory.sp_get_stock_valuation_comparison, 151_stock_valuation_
// comparison_report.sql) -- a read-only, per-product "what would each
// valuation method say" comparison. Doesn't fit InventoryReportRow's flat
// table shape, so it's a dedicated response type rather than reusing the
// generic report models.
export interface StockValuationCostLayer {
  id: number;
  receivedAt: string;
  receivedQty: number;
  remainingQty: number;
  unitCost: number;
  sourceDocType: string | null;
  sourceDocId: number | null;
}

export interface StockValuationMethodResult {
  costConsumed: number;
  avgRate: number;
  remainingQty: number;
  remainingValue: number;
  shortfallQty: number;
}

export interface StockValuationComparison {
  productId: number;
  productCode: string;
  productName: string;
  valuationMethod: string;
  uom: string | null;
  currentCostPrice: number;
  hypotheticalQty: number;
  totalRemainingQty: number;
  totalRemainingValue: number;
  layers: StockValuationCostLayer[];
  fifo: StockValuationMethodResult;
  lifo: StockValuationMethodResult;
  weightedAverage: StockValuationMethodResult;
}

// Backs GET /api/reports/mis-report (inventory.sp_get_mis_report,
// 153_mis_report.sql) -- Admin-only (screen code INV_R_MIS). Combined
// company-wide snapshot + per-segment breakdown, doesn't fit InventoryReportRow's
// flat table shape either, so it gets its own response type same as
// StockValuationComparison above.
export interface MisReportAgeingBucket {
  bucket: string;
  amount: number;
}

export interface MisReportTopProduct {
  productName: string;
  amount: number;
  qty: number;
}

export interface MisReportCompanyWide {
  sales: number;
  purchases: number;
  stockValue: number;
  payables: number;
  receivables: number;
  payablesAgeing: MisReportAgeingBucket[];
  receivablesAgeing: MisReportAgeingBucket[];
  topSellingProducts: MisReportTopProduct[];
}

export interface MisReportSegment {
  segmentId: number | null;
  segmentName: string | null;
  sales: number;
  purchases: number;
  payables: number;
  receivables: number;
}

export interface MisReport {
  financialYear: string;
  dateFrom: string;
  dateTo: string;
  companyWide: MisReportCompanyWide;
  segments: MisReportSegment[];
}

// Backs GET /api/reports/profit-loss (inventory.sp_get_profit_loss_report,
// 311_profit_loss_report.sql). Two-sided Trading + P&L / Balance Sheet built
// from accounts total transactions -- not the flat report-page table shape.
export type ProfitLossReportType = 'IE' | 'AL';
export type ProfitLossSection = 'TRADING_EXP' | 'TRADING_INC' | 'PL_EXP' | 'PL_INC' | 'LIAB' | 'ASSET';

export interface ProfitLossColumn {
  key: string;
  label: string;
  fromDate: string | null;
  toDate: string;
}

export interface ProfitLossLine {
  section: ProfitLossSection;
  groupName: string;
  /** Schedule TB sub group (chart subgroupname); '' when the ledger has none. */
  subGroupName?: string;
  head: string;
  sort: number;
  amounts: Record<string, number>;
}

export interface ProfitLossReport {
  reportType: ProfitLossReportType;
  columns: ProfitLossColumn[];
  lines: ProfitLossLine[];
  unmapped: Array<{ head: string; amount: number }>;
  message: string;
}

// Backs GET /api/reports/ageing-analysis (inventory.sp_get_ageing_analysis_report,
// 312_ageing_analysis_report.sql): the open bills (FIFO) of every party ledger
// under SUNDRY DEBITORS (customer) / SUNDRY CREDITORS (vendor) as on a date,
// each already put into one of the company's ageing slabs. Grand Total = Trial
// Balance. The age columns come from the procedure, not from the screen.
export type AgeingPartyType = 'customer' | 'vendor';

export interface AgeingColumn {
  index: number;
  label: string;
  fromDays: number;
  toDays: number | null;
}

export interface AgeingAnalysisRow {
  /** Party ledger id. */
  accountId: number;
  party: string;
  /** Transaction (voucher / invoice) no. of the open bill. */
  invoiceNo: string;
  invoiceDate: string | null;
  ageDays: number;
  /** Open amount on the head's normal side; negative = advance. */
  dueAmount: number;
  /** Index into AgeingAnalysisReport.columns. */
  bucket: number;
}

export interface AgeingAnalysisReport {
  partyType: AgeingPartyType;
  asOnDate: string;
  columns: AgeingColumn[];
  totals: number[];
  dueAmount: number;
  rows: AgeingAnalysisRow[];
  message: string;
}

// Backs GET /api/reports/productwise-ageing (inventory.sp_get_productwise_ageing_report,
// 314_productwise_ageing_report.sql): each product's closing stock as on a date
// (= Stock Summary qty / value) split into the company's ageing slabs by the
// date of the inwards still in hand (FIFO). qty / value are per column.
export interface ProductwiseAgeingRow {
  productId: number;
  productCode: string;
  product: string;
  category: string;
  uom: string;
  closingQty: number;
  stockValue: number;
  qty: number[];
  value: number[];
}

export interface ProductwiseAgeingReport {
  asOnDate: string;
  columns: AgeingColumn[];
  totals: number[];
  stockValue: number;
  closingQty: number;
  excludedCount: number;
  excludedValue: number;
  rows: ProductwiseAgeingRow[];
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class InventoryReportsService {
  constructor(private readonly commonService: CommonService) {}

  getStockValuationComparison(productId: number, hypotheticalQty: number): Observable<StockValuationComparison> {
    const params = new HttpParams()
      .set('productId', String(productId))
      .set('hypotheticalQty', String(hypotheticalQty));

    return this.commonService.getAPI('/reports/stock-valuation-comparison', params, 'YES').pipe(
      map((response: { data?: StockValuationComparison }) => {
        if (!response?.data) throw new Error('No data returned for stock valuation comparison.');
        return response.data;
      }),
      catchError(error => throwError(() => error))
    );
  }

  getMisReport(dateFrom?: string, dateTo?: string): Observable<MisReport> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);

    return this.commonService.getAPI('/reports/mis-report', params, 'YES').pipe(
      map((response: { data?: MisReport }) => {
        if (!response?.data) throw new Error('No data returned for MIS report.');
        return response.data;
      }),
      catchError(error => throwError(() => error))
    );
  }

  getProfitLoss(reportType: ProfitLossReportType, fromDate: Date, toDate: Date, branchId?: number | null): Observable<ProfitLossReport> {
    let params = new HttpParams()
      .set('reportType', reportType)
      .set('fromDate', this.toDateParam(fromDate))
      .set('toDate', this.toDateParam(toDate));
    if (branchId) params = params.set('branchId', String(branchId));

    return this.commonService.getAPI('/reports/profit-loss', params, 'YES').pipe(
      map((response: { message?: string; data?: ProfitLossLine[]; summary?: { reportType?: ProfitLossReportType; columns?: ProfitLossColumn[]; unmapped?: Array<{ head: string; amount: number }> } }) => ({
        reportType: response?.summary?.reportType ?? reportType,
        columns: response?.summary?.columns ?? [],
        lines: Array.isArray(response?.data) ? response.data : [],
        unmapped: response?.summary?.unmapped ?? [],
        message: String(response?.message ?? '')
      })),
      catchError(error => throwError(() => error))
    );
  }

  getAgeingAnalysis(asOnDate: Date, partyType: AgeingPartyType, branchId?: number | null): Observable<AgeingAnalysisReport> {
    let params = new HttpParams()
      .set('toDate', this.toDateParam(asOnDate))
      .set('partyType', partyType);
    if (branchId) params = params.set('branchId', String(branchId));

    return this.commonService.getAPI('/reports/ageing-analysis', params, 'YES').pipe(
      map((response: { message?: string; data?: AgeingAnalysisRow[]; summary?: { asOnDate?: string; partyType?: AgeingPartyType; columns?: AgeingColumn[]; totals?: number[]; dueAmount?: number } }) => ({
        partyType: response?.summary?.partyType ?? partyType,
        asOnDate: response?.summary?.asOnDate ?? this.toDateParam(asOnDate),
        columns: response?.summary?.columns ?? [],
        totals: (response?.summary?.totals ?? []).map(Number),
        dueAmount: Number(response?.summary?.dueAmount ?? 0),
        rows: Array.isArray(response?.data) ? response.data : [],
        message: String(response?.message ?? '')
      })),
      catchError(error => throwError(() => error))
    );
  }

  /** productIds empty = All products. */
  getProductwiseAgeing(asOnDate: Date, productIds: number[] = [], branchId?: number | null): Observable<ProductwiseAgeingReport> {
    let params = new HttpParams().set('toDate', this.toDateParam(asOnDate));
    const ids = productIds.filter(id => id > 0);
    if (ids.length) params = params.set('productIds', ids.join(','));
    if (branchId) params = params.set('branchId', String(branchId));

    type Summary = { asOnDate?: string; columns?: AgeingColumn[]; totals?: number[]; stockValue?: number; closingQty?: number; excludedCount?: number; excludedValue?: number };
    return this.commonService.getAPI('/reports/productwise-ageing', params, 'YES').pipe(
      map((response: { message?: string; data?: ProductwiseAgeingRow[]; summary?: Summary }) => ({
        asOnDate: response?.summary?.asOnDate ?? this.toDateParam(asOnDate),
        columns: response?.summary?.columns ?? [],
        totals: (response?.summary?.totals ?? []).map(Number),
        stockValue: Number(response?.summary?.stockValue ?? 0),
        closingQty: Number(response?.summary?.closingQty ?? 0),
        excludedCount: Number(response?.summary?.excludedCount ?? 0),
        excludedValue: Number(response?.summary?.excludedValue ?? 0),
        rows: (Array.isArray(response?.data) ? response.data : []).map(r => ({
          ...r,
          closingQty: Number(r.closingQty) || 0,
          stockValue: Number(r.stockValue) || 0,
          qty: (r.qty ?? []).map(Number),
          value: (r.value ?? []).map(Number)
        })),
        message: String(response?.message ?? '')
      })),
      catchError(error => throwError(() => error))
    );
  }
  contextDefaults(): InventoryReportFilters {
    return {
      companyId: this.commonService.getCompanyCode(),
      branchId: this.commonService.getBranchCode(),
      createdBy: String(this.commonService.getCreatedBy() ?? ''),
      financialYear: this.currentFinancialYear()
    };
  }

  getReport(
    report: InventoryReportDefinition,
    filters: InventoryReportFilters,
    page: number,
    pageSize: number
  ): Observable<InventoryReportApiResponse> {
    const params = this.buildParams(filters, page, pageSize);

    // commonService.getAPI() prepends sessionStorage['apiURL'], which already
    // ends in "/api" — a leading "/api/" here doubled the path to
    // "/api/api/reports/...", 404ing every report regardless of backend.
    return this.commonService
      .getAPI(`/reports/${report.endpoint}`, params, 'YES')
      .pipe(
        map(response => this.normalizeResponse(response)),
        catchError(error => throwError(() => error))
      );
  }

  private buildParams(filters: InventoryReportFilters, page: number, pageSize: number): HttpParams {
    const contextParams: Record<string, string> = {
      globalSchema: this.commonService.getschemaname(),
      branchSchema: this.commonService.getbranchname(),
      userId: this.storageValue('userId'),
      roleId: this.storageValue('roleId'),
      page: String(page),
      pageSize: String(pageSize)
    };

    let params = new HttpParams();

    Object.entries({ ...contextParams, ...filters }).forEach(([key, value]) => {
      const normalizedValue = this.paramValue(value);
      if (normalizedValue && normalizedValue !== 'All') {
        params = params.set(key, normalizedValue);
      }
    });

    return params;
  }

  private paramValue(value: InventoryReportFilterValue): string {
    if (Array.isArray(value)) {
      return value
        .map(item => String(item ?? '').trim())
        .filter(item => item && item !== 'All')
        .join(',');
    }

    if (value instanceof Date) {
      return this.toDateParam(value);
    }

    return String(value ?? '').trim();
  }

  private normalizeResponse(response: unknown): InventoryReportApiResponse {
    if (Array.isArray(response)) {
      return {
        success: true,
        message: '',
        data: response as InventoryReportRow[],
        summary: {},
        totalRecords: response.length
      };
    }

    const value = (response ?? {}) as Partial<InventoryReportApiResponse> & {
      totalrecords?: number;
      total?: number;
      rows?: InventoryReportRow[];
    };

    const data = Array.isArray(value.data)
      ? value.data
      : Array.isArray(value.rows)
        ? value.rows
        : [];

    return {
      success: value.success !== false,
      message: String(value.message ?? ''),
      data,
      summary: (value.summary ?? {}) as Record<string, string | number>,
      totalRecords: Number(value.totalRecords ?? value.totalrecords ?? value.total ?? data.length)
    };
  }

  private storageValue(key: string): string {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(key) ?? '';
  }

  private currentFinancialYear(): string {
    const today = new Date();
    const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  }

  private toDateParam(value: Date): string {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
}
