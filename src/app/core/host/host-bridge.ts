import { Injectable } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Observable, throwError } from 'rxjs';

/*
 * OneSphere-Inventory runs only inside OneSphere-Accounts (the shell). Every
 * permission decision, auth state and Settings / subscription API call is
 * owned by the shell and published on `window.__oneSphereHost` by its
 * HostBridgeService (OneSphere-Accounts/src/app/core/services/host-bridge.service.ts).
 *
 * This file is Inventory's ONLY link to it: no permission rules, no session
 * parsing and no Settings HTTP clients live in this app. The interfaces below
 * are the contract (types only, erased at runtime) — keep them in step with
 * the shell's OneSphereHostBridge.
 */

// ── Contract ─────────────────────────────────────────────────────────────────

export interface PermissionFlags {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface BranchResponse {
  id: number;
  companyId: number;
  branchCode: string;
  branchName: string;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  isHeadOffice: boolean;
  isDefault: boolean;
  status: string;
}

export interface BranchUpsertRequest {
  branchCode: string;
  branchName: string;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  isHeadOffice: boolean;
  status: string;
}

export interface UserResponse {
  id: number;
  companyId: number;
  username: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  loginIdentifier: string;
  isSuperAdmin: boolean;
  hasPassword: boolean;
  status: string;
  lastLoginAt?: string | null;
  branches: BranchResponse[];
  modules: Array<{ id: number; moduleCode: string; moduleName: string; status: string }>;
  roles: Array<{ id: number; roleCode: string; roleName: string; roleType: string; status: string }>;
}

export interface ModulePricingItem {
  id: number;
  moduleCode: string;
  moduleName: string;
  icon?: string;
  isCore: boolean;
  monthlyPrice: number;
  subscribed: boolean;
}

export interface SubscriptionPlan {
  planId?: number;
  subscriptionStatus: string;
  maxBranches: number;
  maxUsers: number;
  currentBranchCount: number;
  currentUserCount: number;
  modules: ModulePricingItem[];
}

interface OneSphereHostBridge {
  readonly version: number;
  readonly auth: {
    getAccessToken(): string | null;
  };
  readonly access: {
    can(screenCode: string, action?: keyof PermissionFlags): boolean;
    isCompanyAdmin(): boolean;
    warnRestricted(pageKey: string): void;
  };
  readonly accessControl: {
    getUsers(): Observable<ApiResponse<UserResponse[]>>;
    getBranches(): Observable<ApiResponse<BranchResponse[]>>;
    createBranch(request: BranchUpsertRequest): Observable<ApiResponse<BranchResponse>>;
  };
  readonly subscription: {
    getSubscription(): Observable<{ success: boolean; data: SubscriptionPlan }>;
  };
}

const HOST_MISSING = 'OneSphere-Inventory must be opened through OneSphere-Accounts (the shell) — the host bridge is not available.';

/** The shell's bridge, or null when this bundle isn't running inside the shell. */
function host(): OneSphereHostBridge | null {
  const bridge = (window as unknown as Record<string, OneSphereHostBridge | undefined>)['__oneSphereHost'];
  if (bridge) return bridge;
  console.error(HOST_MISSING);
  return null;
}

// ── Login token ─────────────────────────────────────────────────────────────

/**
 * The shell's live access token (it lives only in the shell's memory, never
 * sessionStorage or a cookie). Most Inventory calls don't need this: any
 * HttpClient request without its own Authorization header gets the token from
 * the shell's interceptor, including the 401 refresh-and-retry. Only services
 * that build their own Authorization header must use this, otherwise they'd
 * send an empty `Bearer ` that the interceptor won't overwrite.
 */
export function currentAccessToken(): string {
  return host()?.auth.getAccessToken() ?? '';
}

// ── Admin ───────────────────────────────────────────────────────────────────

/**
 * Company Admin (or Super Admin), as decided by the shell. This is the only
 * "admin" Inventory screens recognise: it unlocks grid Edit/Delete, Product
 * Master editing, Interbranch Sale, any-location Stock Transfer and
 * company-wide report scope.
 */
export function isCompanyAdmin(): boolean {
  return host()?.access.isCompanyAdmin() ?? false;
}

// ── Facades with the names Inventory screens already inject ─────────────────

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Screen permission from the shell (Company/Super Admin always true). */
  can(screenCode: string, action: keyof PermissionFlags = 'view'): boolean {
    return host()?.access.can(screenCode, action) ?? false;
  }
}

@Injectable({ providedIn: 'root' })
export class AccessControlService {
  getUsers(): Observable<ApiResponse<UserResponse[]>> {
    return host()?.accessControl.getUsers() ?? throwError(() => new Error(HOST_MISSING));
  }

  getBranches(): Observable<ApiResponse<BranchResponse[]>> {
    return host()?.accessControl.getBranches() ?? throwError(() => new Error(HOST_MISSING));
  }

  createBranch(request: BranchUpsertRequest): Observable<ApiResponse<BranchResponse>> {
    return host()?.accessControl.createBranch(request) ?? throwError(() => new Error(HOST_MISSING));
  }
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  getSubscription(): Observable<{ success: boolean; data: SubscriptionPlan }> {
    return host()?.subscription.getSubscription() ?? throwError(() => new Error(HOST_MISSING));
  }
}

// ── Route guards (used by inventory_routs.ts) ───────────────────────────────
// Blocking of locked side-menu screens is done once, by the shell's
// screenAccessGuard on every /dashboard/** route. These only add the shell's
// non-blocking "Access restricted" warning for a screen the role can't view
// (e.g. Inventory screens that aren't side-menu items), exactly as before.

export const screenPermissionGuard = (screenCode: string): CanActivateFn => (_route, state) => {
  const bridge = host();
  if (bridge && !bridge.access.can(screenCode, 'view')) bridge.access.warnRestricted(state.url);
  return true;
};

const REPORT_SLUG_SCREEN_CODES: Record<string, string> = {
  'stock-summary': 'INV_R_STOCK_SUMMARY',
  'stock-ledger': 'INV_R_STOCK_LEDGER',
  'warehouse-wise-stock': 'INV_R_WAREHOUSE_STOCK',
  'purchase-order-register': 'INV_R_PO_REGISTER',
  'grn-register': 'INV_R_GRN_REGISTER',
  'purchase-invoice-register': 'INV_R_PI_REGISTER',
  'sales-order-register': 'INV_R_SO_REGISTER',
  'delivery-challan-register': 'INV_R_DC_REGISTER',
  'sales-invoice-register': 'INV_R_SI_REGISTER',
  'hsn-summary': 'INV_R_HSN_SUMMARY',
  'batch-serial-expiry': 'INV_R_BATCH_SERIAL_EXPIRY',
  'product-profitability': 'INV_R_PRODUCT_PROFIT',
  'low-stock-alert': 'INV_R_LOW_STOCK',
  'pending-document': 'INV_R_PENDING_DOC',
  'inventory-audit-trail': 'INV_R_AUDIT_TRAIL',
  // Aliases also accepted by findInventoryReport() in inventory-report.registry.ts
  'stock-availability-report': 'INV_R_STOCK_SUMMARY',
  'hsn-sac-report': 'INV_R_HSN_SUMMARY'
};

/** Same as screenPermissionGuard for the single dynamic `:reportKey` report route. */
export const reportPermissionGuard: CanActivateFn = (route, state) => {
  const screenCode = REPORT_SLUG_SCREEN_CODES[route.paramMap.get('reportKey') ?? ''];
  const bridge = host();
  if (screenCode && bridge && !bridge.access.can(screenCode, 'view')) bridge.access.warnRestricted(state.url);
  return true;
};
