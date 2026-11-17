import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from './inventory-config.service';
import { currentAccessToken } from '../../core/host/host-bridge';

export interface DashboardKpis {
  stock_value: number;
  out_of_stock_count: number;
  pending_purchase_orders: number;
  pending_sales_orders: number;
  pending_dispatch: number;
  today_purchase_value: number;
  today_sales_value: number;
  purchases: number;
  sales: number;
  purchase_returns: number;
  sales_returns: number;
}

export interface DashboardDrilldownRow {
  doc_number?: string;
  date?: string;
  party?: string;
  amount: number;
  status?: string;
}

export interface DashboardMovementPoint {
  date: string;
  inward: number;
  outward: number;
}

export interface DashboardStockRow {
  product_id?: number;
  product_name: string;
  category: string;
  warehouse: string;
  qty_on_hand: number;
  qty_reserved: number;
  value: number;
}

export interface DashboardWarehouseRow {
  warehouse_id: number;
  warehouse_name: string;
  product_count: number;
  total_qty: number;
  total_value: number;
}

export interface DashboardTransactionRow {
  doc_type: string;
  doc_number?: string;
  date?: string;
  party?: string;
  amount: number;
  status?: string;
}

export interface DashboardAgeingBucket {
  bucket: string;
  amount: number;
}

export interface DashboardOutstanding {
  total: number;
  ageing: DashboardAgeingBucket[];
}

export interface DashboardCashFlow {
  paid: number;
  received: number;
}

export interface DashboardSalesTrendPoint {
  date: string;
  sales_amount: number;
  sales_return_amount: number;
}

export interface DashboardTopProductRow {
  product_id?: number;
  product_name: string;
  category: string;
  qty: number;
  amount: number;
}

export interface DashboardReturnedProductRow {
  product_id?: number;
  product_name: string;
  return_qty: number;
  return_amount: number;
  top_reason?: string;
}

export interface DashboardProcurementFunnel {
  po_count: number;
  po_value: number;
  grn_count: number;
  grn_value: number;
  pi_count: number;
  pi_value: number;
}

export interface DashboardSalesFunnel {
  so_count: number;
  dc_count: number;
  si_count: number;
  si_value: number;
}

export interface DashboardPipelineFunnel {
  procurement: DashboardProcurementFunnel;
  sales: DashboardSalesFunnel;
}

// Sales Invoices that, at posting time, drew on GRN-received stock with no
// posted/paid Purchase Invoice against it yet. Standalone endpoint/widget,
// not part of DashboardSummary (see 101_sales_pi_pending_tracking.sql).
export interface SalesPiPendingFlagRow {
  id: number;
  invoice_id: number;
  doc_number?: string;
  product_id?: number;
  product_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  qty_sold: number;
  pending_pi_qty: number;
  flagged_at: string;
}

// Delivery Challan lines dispatched (stock already decremented) but not yet
// invoiced. Live/derived, not a snapshot — standalone endpoint/widget, not
// part of DashboardSummary (see 103_dc_pending_invoice_dashboard.sql).
export interface DcPendingInvoiceLineRow {
  id: number;
  dc_id: number;
  dc_number?: string;
  dc_date?: string;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  product_id?: number;
  product_name?: string;
  dispatch_qty: number;
  invoiced_qty: number;
  pending_qty: number;
}

// Posted Sales Invoice lines where the selling rate fell below the
// product's current cost_price (a floor check, unrelated to MRP). No
// per-line cost-at-time-of-sale is persisted anywhere in this schema, so
// this is CURRENT cost joined against HISTORICAL rate -- accurate for
// recent sales, approximate for older ones (same accepted tradeoff as
// Product Profitability). Live/derived, not a snapshot -- standalone
// endpoint/widget, not part of DashboardSummary (see 155_loss_sales_
// report.sql).
export interface LossSaleFlagRow {
  id: number;
  invoice_id: number;
  doc_number?: string;
  doc_date?: string;
  customer_name?: string;
  product_id?: number;
  product_name?: string;
  qty: number;
  rate: number;
  cost_price: number;
  loss_amount: number;
  loss_percent: number;
}

export interface DashboardSummary {
  kpis: DashboardKpis;
  daily_movement: DashboardMovementPoint[];
  stock_by_product: DashboardStockRow[];
  warehouse_stock: DashboardWarehouseRow[];
  recent_transactions: DashboardTransactionRow[];
  payables: DashboardOutstanding;
  receivables: DashboardOutstanding;
  cash_flow: DashboardCashFlow;
  drilldowns: Record<string, DashboardDrilldownRow[]>;
  sales_returns_trend: DashboardSalesTrendPoint[];
  top_selling_products: DashboardTopProductRow[];
  returned_products: DashboardReturnedProductRow[];
  pipeline_funnel: DashboardPipelineFunnel;
}

@Injectable({ providedIn: 'root' })
export class InventoryDashboardService {
  private readonly http = inject(HttpClient);

  private base(): string { return sessionStorage.getItem('apiURL') || ''; }
  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${currentAccessToken()}` });
  }

  private norm(r: any): DashboardSummary {
    const kpis = r?.kpis ?? {};
    return {
      kpis: {
        stock_value: kpis?.stockValue ?? kpis?.stock_value ?? 0,
        out_of_stock_count: kpis?.outOfStockCount ?? kpis?.out_of_stock_count ?? 0,
        pending_purchase_orders: kpis?.pendingPurchaseOrders ?? kpis?.pending_purchase_orders ?? 0,
        pending_sales_orders: kpis?.pendingSalesOrders ?? kpis?.pending_sales_orders ?? 0,
        pending_dispatch: kpis?.pendingDispatch ?? kpis?.pending_dispatch ?? 0,
        today_purchase_value: kpis?.todayPurchaseValue ?? kpis?.today_purchase_value ?? 0,
        today_sales_value: kpis?.todaySalesValue ?? kpis?.today_sales_value ?? 0,
        purchases: kpis?.purchases ?? 0,
        sales: kpis?.sales ?? 0,
        purchase_returns: kpis?.purchaseReturns ?? kpis?.purchase_returns ?? 0,
        sales_returns: kpis?.salesReturns ?? kpis?.sales_returns ?? 0
      },
      daily_movement: (r?.dailyMovement ?? r?.daily_movement ?? []).map((m: any) => ({
        date: m?.date, inward: m?.inward ?? 0, outward: m?.outward ?? 0
      })),
      stock_by_product: (r?.stockByProduct ?? r?.stock_by_product ?? []).map((s: any) => ({
        product_id: s?.productId ?? s?.product_id,
        product_name: s?.productName ?? s?.product_name ?? '',
        category: s?.category ?? 'Uncategorized',
        warehouse: s?.warehouse ?? '',
        qty_on_hand: s?.qtyOnHand ?? s?.qty_on_hand ?? 0,
        qty_reserved: s?.qtyReserved ?? s?.qty_reserved ?? 0,
        value: s?.value ?? 0
      })),
      warehouse_stock: (r?.warehouseStock ?? r?.warehouse_stock ?? []).map((w: any) => ({
        warehouse_id: w?.warehouseId ?? w?.warehouse_id,
        warehouse_name: w?.warehouseName ?? w?.warehouse_name ?? '',
        product_count: w?.productCount ?? w?.product_count ?? 0,
        total_qty: w?.totalQty ?? w?.total_qty ?? 0,
        total_value: w?.totalValue ?? w?.total_value ?? 0
      })),
      recent_transactions: (r?.recentTransactions ?? r?.recent_transactions ?? []).map((t: any) => ({
        doc_type: t?.docType ?? t?.doc_type ?? '',
        doc_number: t?.docNumber ?? t?.doc_number,
        date: t?.date,
        party: t?.party,
        amount: t?.amount ?? 0,
        status: t?.status
      })),
      payables: this.normOutstanding(r?.payables),
      receivables: this.normOutstanding(r?.receivables),
      cash_flow: {
        paid: r?.cashFlow?.paid ?? r?.cash_flow?.paid ?? 0,
        received: r?.cashFlow?.received ?? r?.cash_flow?.received ?? 0
      },
      drilldowns: this.normDrilldowns(r?.drilldowns),
      sales_returns_trend: (r?.salesReturnsTrend ?? r?.sales_returns_trend ?? []).map((t: any) => ({
        date: t?.date,
        sales_amount: t?.salesAmount ?? t?.sales_amount ?? 0,
        sales_return_amount: t?.salesReturnAmount ?? t?.sales_return_amount ?? 0
      })),
      top_selling_products: (r?.topSellingProducts ?? r?.top_selling_products ?? []).map((p: any) => ({
        product_id: p?.productId ?? p?.product_id,
        product_name: p?.productName ?? p?.product_name ?? '',
        category: p?.category ?? 'Uncategorized',
        qty: p?.qty ?? 0,
        amount: p?.amount ?? 0
      })),
      returned_products: (r?.returnedProducts ?? r?.returned_products ?? []).map((p: any) => ({
        product_id: p?.productId ?? p?.product_id,
        product_name: p?.productName ?? p?.product_name ?? '',
        return_qty: p?.returnQty ?? p?.return_qty ?? 0,
        return_amount: p?.returnAmount ?? p?.return_amount ?? 0,
        top_reason: p?.topReason ?? p?.top_reason
      })),
      pipeline_funnel: this.normPipelineFunnel(r?.pipelineFunnel ?? r?.pipeline_funnel)
    };
  }

  private normPipelineFunnel(f: any): DashboardPipelineFunnel {
    const proc = f?.procurement ?? {};
    const sales = f?.sales ?? {};
    return {
      procurement: {
        po_count: proc?.poCount ?? proc?.po_count ?? 0,
        po_value: proc?.poValue ?? proc?.po_value ?? 0,
        grn_count: proc?.grnCount ?? proc?.grn_count ?? 0,
        grn_value: proc?.grnValue ?? proc?.grn_value ?? 0,
        pi_count: proc?.piCount ?? proc?.pi_count ?? 0,
        pi_value: proc?.piValue ?? proc?.pi_value ?? 0
      },
      sales: {
        so_count: sales?.soCount ?? sales?.so_count ?? 0,
        dc_count: sales?.dcCount ?? sales?.dc_count ?? 0,
        si_count: sales?.siCount ?? sales?.si_count ?? 0,
        si_value: sales?.siValue ?? sales?.si_value ?? 0
      }
    };
  }

  private normDrilldowns(d: any): Record<string, DashboardDrilldownRow[]> {
    const out: Record<string, DashboardDrilldownRow[]> = {};
    if (!d) return out;
    for (const key of Object.keys(d)) {
      out[key] = (d[key] ?? []).map((row: any) => ({
        doc_number: row?.docNumber ?? row?.doc_number,
        date: row?.date,
        party: row?.party,
        amount: row?.amount ?? 0,
        status: row?.status
      }));
    }
    return out;
  }

  private normOutstanding(o: any): DashboardOutstanding {
    return {
      total: o?.total ?? 0,
      ageing: (o?.ageing ?? []).map((a: any) => ({ bucket: a?.bucket ?? '', amount: a?.amount ?? 0 }))
    };
  }

  getDashboardSummary(from?: string, to?: string): Observable<ApiResponse<DashboardSummary>> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ApiResponse<any>>(`${this.base()}/inventory/dashboard/summary`, { headers: this.headers(), params }).pipe(
      map(res => ({ ...res, data: res.data ? this.norm(res.data) : undefined }))
    );
  }

  getSalesPiPendingFlags(limit?: number): Observable<ApiResponse<SalesPiPendingFlagRow[]>> {
    let params = new HttpParams();
    if (limit) params = params.set('limit', String(limit));
    return this.http.get<ApiResponse<any[]>>(`${this.base()}/inventory/dashboard/sales-without-pi`, { headers: this.headers(), params }).pipe(
      map(res => ({
        ...res, data: (res.data ?? []).map((r: any) => ({
          id: r?.id ?? 0,
          invoice_id: r?.invoiceId ?? r?.invoice_id ?? 0,
          doc_number: r?.docNumber ?? r?.doc_number,
          product_id: r?.productId ?? r?.product_id,
          product_name: r?.productName ?? r?.product_name,
          warehouse_id: r?.warehouseId ?? r?.warehouse_id,
          warehouse_name: r?.warehouseName ?? r?.warehouse_name,
          qty_sold: r?.qtySold ?? r?.qty_sold ?? 0,
          pending_pi_qty: r?.pendingPiQty ?? r?.pending_pi_qty ?? 0,
          flagged_at: r?.flaggedAt ?? r?.flagged_at
        }))
      }))
    );
  }

  getDcPendingInvoiceLines(limit?: number): Observable<ApiResponse<DcPendingInvoiceLineRow[]>> {
    let params = new HttpParams();
    if (limit) params = params.set('limit', String(limit));
    return this.http.get<ApiResponse<any[]>>(`${this.base()}/inventory/dashboard/dc-pending-invoice`, { headers: this.headers(), params }).pipe(
      map(res => ({
        ...res, data: (res.data ?? []).map((r: any) => ({
          id: r?.id ?? 0,
          dc_id: r?.dcId ?? r?.dc_id ?? 0,
          dc_number: r?.dcNumber ?? r?.dc_number,
          dc_date: r?.dcDate ?? r?.dc_date,
          customer_name: r?.customerName ?? r?.customer_name,
          warehouse_id: r?.warehouseId ?? r?.warehouse_id,
          warehouse_name: r?.warehouseName ?? r?.warehouse_name,
          product_id: r?.productId ?? r?.product_id,
          product_name: r?.productName ?? r?.product_name,
          dispatch_qty: r?.dispatchQty ?? r?.dispatch_qty ?? 0,
          invoiced_qty: r?.invoicedQty ?? r?.invoiced_qty ?? 0,
          pending_qty: r?.pendingQty ?? r?.pending_qty ?? 0
        }))
      }))
    );
  }

  getLossSalesFlags(limit?: number): Observable<ApiResponse<LossSaleFlagRow[]>> {
    let params = new HttpParams();
    if (limit) params = params.set('limit', String(limit));
    return this.http.get<ApiResponse<any[]>>(`${this.base()}/inventory/dashboard/loss-sales`, { headers: this.headers(), params }).pipe(
      map(res => ({
        ...res, data: (res.data ?? []).map((r: any) => ({
          id: r?.id ?? 0,
          invoice_id: r?.invoiceId ?? r?.invoice_id ?? 0,
          doc_number: r?.docNumber ?? r?.doc_number,
          doc_date: r?.docDate ?? r?.doc_date,
          customer_name: r?.customerName ?? r?.customer_name,
          product_id: r?.productId ?? r?.product_id,
          product_name: r?.productName ?? r?.product_name,
          qty: r?.qty ?? 0,
          rate: r?.rate ?? 0,
          cost_price: r?.costPrice ?? r?.cost_price ?? 0,
          loss_amount: r?.lossAmount ?? r?.loss_amount ?? 0,
          loss_percent: r?.lossPercent ?? r?.loss_percent ?? 0
        }))
      }))
    );
  }
}
