
import { Injectable } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { CommonService } from '../Common/common.service';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Screen {
  id: string;
  name: string;
  route: string;
  icon?: string;
  group?: string;
  relatedRoutes?: string[];
  disabled?: boolean;
}

export interface SubModule {
  id: string;
  name: string;
  icon?: string;
  screens: Screen[];
}

export interface Module {
  id: string;
  name: string;
  icon?: string;
  subModules: SubModule[];
}

export interface NavigationPath {
  module: Module;
  subModule: SubModule;
  screen: Screen;
}
@Injectable({
    providedIn: 'root'
})

export class NavigationService {

    constructor(private commonService: CommonService) { }


    

      private selectedModuleSubject = new BehaviorSubject<Module | null>(null);
      private selectedSubModuleSubject = new BehaviorSubject<SubModule | null>(null);
      private selectedScreenSubject = new BehaviorSubject<Screen | null>(null);
      public selectedModule$: Observable<Module | null> = this.selectedModuleSubject.asObservable();
      public selectedSubModule$: Observable<SubModule | null> = this.selectedSubModuleSubject.asObservable();
      public selectedScreen$: Observable<Screen | null> = this.selectedScreenSubject.asObservable();
    
      private modulesData: Module[] = [
        {
          id: 'inventory',
          name: 'Inventory',
            subModules: [
            {
              id: 'inventory-dashboard',
              name: 'Dashboard',
              screens: [
                { id: 'inventory-dashboard', name: 'Inventory Summary Dashboard', route: '/dashboard/inventory/inventory-dashboard/dashboard' }
              ]
            },
            {
              id: 'inventory-configuration',
              name: 'Configuration',
              screens: [
                { id: 'business-segments', name: 'Business Segments', route: '/dashboard/inventory/configuration/business-segments' },
                { id: 'warehouse-location-master', name: 'Warehouse Setup', route: '/dashboard/inventory/configuration/warehouse-location-master' },
                { id: 'branch-master', name: 'Branch / Store Setup', route: '/dashboard/inventory/configuration/branch-master' },
                { id: 'tax-code-import', name: 'HSN/SAC Tax Code Import', route: '/dashboard/inventory/configuration/tax-code-import' }
              ]
            },
            {
              id: 'inventory-masters',
              name: 'Masters',
              screens: [
                { id: 'product-service-master', name: 'Product Master', route: '/dashboard/inventory/masters/product-service-master', group: 'Product Config' },
                { id: 'product-type-master', name: 'Product Nature Master', route: '/dashboard/inventory/masters/product-type-master', group: 'Product Config', disabled: true },
                { id: 'category-master', name: 'Product Category', route: '/dashboard/inventory/masters/category-master', group: 'Product Config' },
                { id: 'brand-master', name: 'Brand Master', route: '/dashboard/inventory/masters/brand-master', group: 'Product Config' },
                { id: 'variant-master', name: 'Variant Master', route: '/dashboard/inventory/masters/variant-master', group: 'Product Config' },
                { id: 'attribute-master', name: 'Attribute Master', route: '/dashboard/inventory/masters/attribute-master', group: 'Product Config' },
                { id: 'uom-master', name: 'UOM Master', route: '/dashboard/inventory/masters/uom-master', group: 'Product Config' },
                { id: 'hsn-sac-mapping', name: 'Tax Classification Master', route: '/dashboard/inventory/masters/hsn-sac-mapping', group: 'Product Config' },
                { id: 'barcode-configuration', name: 'Barcode Configuration', route: '/dashboard/inventory/masters/barcode-configuration', group: 'Product Config' },
                { id: 'serial-number-policy', name: 'Serial Number Policy', route: '/dashboard/inventory/masters/serial-number-policy', group: 'Product Config' },
                { id: 'batch-lot-policy', name: 'Batch / Lot Policy', route: '/dashboard/inventory/masters/batch-lot-policy', group: 'Product Config' },
                { id: 'vendor-master', name: 'Vendor Master', route: '/dashboard/inventory/masters/vendor-master', group: 'Party & Commercial Master' },
                { id: 'customer-master', name: 'Customer Master', route: '/dashboard/inventory/masters/customer-master', group: 'Party & Commercial Master' },
                { id: 'channel-partner-master', name: 'Channel Partner Master', route: '/dashboard/inventory/masters/channel-partner-master', group: 'Party & Commercial Master' },
                { id: 'payment-terms-master', name: 'Payment Terms Master', route: '/dashboard/inventory/masters/payment-terms-master', group: 'Party & Commercial Master' },
                { id: 'price-list-master', name: 'Price List Master', route: '/dashboard/inventory/masters/price-list-master', group: 'Party & Commercial Master' },
                { id: 'bom-master', name: 'BOM Master', route: '/dashboard/inventory/masters/bom-master', group: 'Manufacturing Master' },
                { id: 'work-center-master', name: 'Work Center Master', route: '/dashboard/inventory/masters/work-center-master', group: 'Manufacturing Master' },
                { id: 'consumption-type-master', name: 'Consumption Type Master', route: '/dashboard/inventory/masters/consumption-type-master', group: 'Operations Master', disabled: true },
                { id: 'approval-workflow-master', name: 'Approval Workflow Master', route: '/dashboard/inventory/masters/approval-workflow-master', group: 'Operations Master', disabled: true },
                { id: 'transporter-master', name: 'Transporter Master', route: '/dashboard/inventory/masters/transporter-master', group: 'Logistics Master', disabled: true },
                { id: 'vehicle-master', name: 'Vehicle Master', route: '/dashboard/inventory/masters/vehicle-master', group: 'Logistics Master', disabled: true }
              ]
            },
            {
              id: 'inventory-transactions',
              name: 'Transactions',
              screens: [
                // Payments & Receipts
                { id: 'vendor-payment', name: 'Vendor Payment', route: '/dashboard/inventory/transactions/vendor-payment', group: 'Payments & Receipts' },
                { id: 'customer-receipt', name: 'Customer Receipt', route: '/dashboard/inventory/transactions/customer-receipt', group: 'Payments & Receipts' },
                // Procurement
                { id: 'purchase-requisition', name: 'Purchase Requisition', route: '/dashboard/inventory/transactions/purchase-requisition', group: 'Procurement', disabled: true },
                { id: 'request-for-quotation', name: 'Request for Quotation', route: '/dashboard/inventory/transactions/request-for-quotation', group: 'Procurement', disabled: true },
                { id: 'purchase-order', name: 'Purchase Order', route: '/dashboard/inventory/transactions/purchase-order', group: 'Procurement', disabled: true },
                { id: 'goods-receipt', name: 'Goods Receipt Note (GRN)', route: '/dashboard/inventory/transactions/goods-receipt', group: 'Procurement' },
                { id: 'purchase-invoice', name: 'Purchase Invoice', route: '/dashboard/inventory/transactions/purchase-invoice', group: 'Procurement' },
                { id: 'purchase-return', name: 'Purchase Return', route: '/dashboard/inventory/transactions/purchase-return', group: 'Procurement' },
                // Sales
                { id: 'sales-enquiry', name: 'Sales Enquiry', route: '/dashboard/inventory/transactions/sales-enquiry', group: 'Sales', disabled: true },
                { id: 'sales-quotation', name: 'Sales Quotation', route: '/dashboard/inventory/transactions/sales-quotation', group: 'Sales', disabled: true },
                { id: 'sales-order', name: 'Sales Order', route: '/dashboard/inventory/transactions/sales-order', group: 'Sales' },
                { id: 'delivery-challan', name: 'Delivery Challan', route: '/dashboard/inventory/transactions/delivery-challan', group: 'Sales' },
                { id: 'sales-invoice', name: 'Sales Invoice', route: '/dashboard/inventory/transactions/sales-invoice', group: 'Sales' },
                { id: 'sales-return', name: 'Sales Return', route: '/dashboard/inventory/transactions/sales-return', group: 'Sales' },
                // Inventory
                { id: 'stock-transfer', name: 'Stock Transfer', route: '/dashboard/inventory/transactions/stock-transfer', group: 'Inventory' },
                { id: 'stock-adjustment', name: 'Stock Adjustment', route: '/dashboard/inventory/transactions/stock-adjustment', group: 'Inventory' },
                { id: 'opening-stock-entry', name: 'Opening Stock Entry', route: '/dashboard/inventory/transactions/opening-stock-entry', group: 'Inventory' },
                { id: 'cycle-count', name: 'Cycle Count', route: '/dashboard/inventory/transactions/cycle-count', group: 'Inventory', disabled: true },
                // Manufacturing
                { id: 'production-planning', name: 'Production Planning', route: '/dashboard/inventory/transactions/production-planning', group: 'Manufacturing' },
                { id: 'material-issue-production', name: 'Material Issue for Production', route: '/dashboard/inventory/transactions/material-issue-production', group: 'Manufacturing' },
                { id: 'production-entry', name: 'Production Entry', route: '/dashboard/inventory/transactions/production-entry', group: 'Manufacturing' },
                { id: 'production-return', name: 'Production Return', route: '/dashboard/inventory/transactions/production-return', group: 'Manufacturing' },
                // Consumption
                { id: 'material-consumption', name: 'Material Consumption', route: '/dashboard/inventory/transactions/material-consumption', group: 'Consumption', disabled: true },
                { id: 'internal-issue-slip', name: 'Internal Issue Slip', route: '/dashboard/inventory/transactions/internal-issue-slip', group: 'Consumption', disabled: true },
                // Logistics
                { id: 'shipment-entry', name: 'Shipment Entry', route: '/dashboard/inventory/transactions/shipment-entry', group: 'Logistics', disabled: true },
                { id: 'gate-pass', name: 'Gate Pass', route: '/dashboard/inventory/transactions/gate-pass', group: 'Logistics', disabled: true },
                // Financial
                { id: 'debit-note', name: 'Debit Note', route: '/dashboard/inventory/transactions/debit-note', group: 'Financial' },
                { id: 'credit-note', name: 'Credit Note', route: '/dashboard/inventory/transactions/credit-note', group: 'Financial' }
              ]
            },
            {
              id: 'inventory-reports',
              name: 'Reports',
              screens: [
                { id: 'stock-summary', name: 'Stock Summary Report', route: '/dashboard/inventory/reports/stock-summary', group: 'Stock Reports' },
                { id: 'stock-ledger', name: 'Stock Ledger Report', route: '/dashboard/inventory/reports/stock-ledger', group: 'Stock Reports' },
                { id: 'warehouse-wise-stock', name: 'Warehouse-wise Stock Report', route: '/dashboard/inventory/reports/warehouse-wise-stock', group: 'Stock Reports' },
                { id: 'purchase-order-register', name: 'Purchase Order Register', route: '/dashboard/inventory/reports/purchase-order-register', group: 'Purchase Reports' },
                { id: 'grn-register', name: 'GRN Register', route: '/dashboard/inventory/reports/grn-register', group: 'Purchase Reports' },
                { id: 'purchase-invoice-register', name: 'Purchase Invoice Register', route: '/dashboard/inventory/reports/purchase-invoice-register', group: 'Purchase Reports' },
                { id: 'sales-order-register', name: 'Sales Order Register', route: '/dashboard/inventory/reports/sales-order-register', group: 'Sales Reports' },
                { id: 'delivery-challan-register', name: 'Delivery Challan Register', route: '/dashboard/inventory/reports/delivery-challan-register', group: 'Sales Reports' },
                { id: 'sales-invoice-register', name: 'Sale Invoice Register', route: '/dashboard/inventory/reports/sales-invoice-register', group: 'Sales Reports' },
                { id: 'hsn-summary', name: 'HSN/SAC Summary Report', route: '/dashboard/inventory/reports/hsn-summary', group: 'GST & Compliance Reports' },
                { id: 'batch-serial-expiry', name: 'Batch / Serial / Expiry Report', route: '/dashboard/inventory/reports/batch-serial-expiry', group: 'Batch / Serial / Expiry Reports' },
                { id: 'product-profitability', name: 'Product Profitability Report', route: '/dashboard/inventory/reports/product-profitability', group: 'Costing & Profitability Reports' },
                { id: 'low-stock-alert', name: 'Low Stock Alert Report', route: '/dashboard/inventory/reports/low-stock-alert', group: 'Alert & Exception Reports' },
                { id: 'pending-document', name: 'Pending Document Report', route: '/dashboard/inventory/reports/pending-document', group: 'Alert & Exception Reports' },
                { id: 'inventory-audit-trail', name: 'Inventory Audit Trail Report', route: '/dashboard/inventory/reports/inventory-audit-trail', group: 'Audit & Control Reports' }
              ]
            }
          ]
        },
        {
          id: 'settings',
          name: 'Settings',
        subModules: [
            {
              id: 'settings-dashboard',
              name: 'Dashboard',
              screens: [
                { id: 'settings-dashboard', name: 'Settings Dashboard', route: '/dashboard/settings/settings-dashboard/dashboard' }
              ]
            },
            {
              id: 'user-management',
              name: 'User Management',
               screens: [
                { id: 'manage-branches', name: 'Manage Branches', route: '/dashboard/settings/branch-management/manage-branches' },
                { id: 'manage-users', name: 'Manage Users', route: '/dashboard/settings/user-management/manage-users' },
                { id: 'roles-permissions', name: 'Roles & Permissions', route: '/dashboard/settings/user-management/roles-permissions' },
                { id: 'user-activity', name: 'User Activity Log', route: '/dashboard/settings/user-management/user-activity' }
              ]
            },
            {
              id: 'system-config',
              name: 'System Configuration',
               screens: [
                { id: 'general-settings', name: 'General Settings', route: '/dashboard/settings/system-config/general-settings' },
                { id: 'email-config', name: 'Email Configuration', route: '/dashboard/settings/system-config/email-config' },
                { id: 'backup-restore', name: 'Backup & Restore', route: '/dashboard/settings/system-config/backup-restore' }
              ]
            },
            {
              id: 'custom-fields-builder',
              name: 'Custom Fields',
               screens: [
                { id: 'custom-fields-builder', name: 'Custom Fields Builder', route: '/dashboard/settings/custom-fields-builder/builder' }
              ]
            }
          ]
        },
      
      ];

    GetUserRightsBasedonRoleAnduserId(roleId:any, userId:any, branchId:any) {
         ;
        const params = new HttpParams().set('roleId', roleId).set('userId', userId).set('branchId', branchId);
        return this.commonService.getAPI('/Settings/Users/UserRights/GetUserRightsBasedonRoleAnduserId', params, 'YES');
    }
    getUnclearedChequesNotification(BranchSchema:any) {
         ;
        const params = new HttpParams().set('BranchSchema', BranchSchema);
        return this.commonService.getAPI('/Dashboard/getUnclearedChequesNotification', params, 'YES');
    }
    getUnclearedChequesNotificationDiffData(BranchSchema:any) {
         ;
        const params = new HttpParams().set('BranchSchema', BranchSchema);
        return this.commonService.getAPI('/Dashboard/getUnclearedChequesNotificationDiffData', params, 'YES');
    }
    getSubscriberBalanceNotificationDiffData(BranchSchema:any) {
         ;
        const params = new HttpParams().set('BranchSchema', BranchSchema);
        return this.commonService.getAPI('/Dashboard/getSubscriberBalanceNotificationDiffData', params, 'YES');
    }

    ShowApplicationVersionNo() {
         ;
        return this.commonService.getAPI('/Common/GetApplicationVersiono','','NO')
      }
    getSubscriberBalanceNotificationDiffReport(BranchSchema:any) {
         ;
        const params = new HttpParams().set('BranchSchema', BranchSchema);
        return this.commonService.getAPI('/Dashboard/getSubscriberBalanceNotificationDiffReport', params, 'YES');
    }


    
//global_ERP
    
      getModules(): Module[] {
        const allowedModuleIds = this.getAllowedModuleIds();
        if (!allowedModuleIds) return this.modulesData;
        return this.modulesData.filter(module => allowedModuleIds.has(module.id.toLowerCase()));
      }

      /** Add a brand-new top-level module (e.g. a feature module loaded lazily). */
      registerModule(module: Module): void {
        if (this.modulesData.find(m => m.id === module.id)) return;
        this.modulesData.push(module);
      }

      /** Add a sub-module to an existing module. */
      registerSubModule(moduleId: string, subModule: SubModule): void {
        const mod = this.modulesData.find(m => m.id === moduleId);
        if (!mod) return;
        if (mod.subModules.find(s => s.id === subModule.id)) return;
        mod.subModules.push(subModule);
      }

      /** Add or merge screens into an existing sub-module. */
      registerScreens(moduleId: string, subModuleId: string, screens: Screen[]): void {
        const mod = this.modulesData.find(m => m.id === moduleId);
        if (!mod) return;
        const sub = mod.subModules.find(s => s.id === subModuleId);
        if (!sub) return;
        for (const screen of screens) {
          if (!sub.screens.find(s => s.id === screen.id)) {
            sub.screens.push(screen);
          }
        }
      }

      findPathByRoute(route: string): NavigationPath | null {
        const currentRoute = this.normalizeRoute(route);

        for (const module of this.getModules()) {
          for (const subModule of module.subModules) {
            for (const screen of subModule.screens) {
              const screenRoutes = [screen.route, ...(screen.relatedRoutes ?? [])];
              const isMatch = screenRoutes.some(screenRoute =>
                this.routeMatches(currentRoute, screenRoute)
              );

              if (isMatch) {
                return { module, subModule, screen };
              }
            }
          }
        }

        return null;
      }
    
      selectModule(module: Module): void {
        this.selectedModuleSubject.next(module);
        this.selectedSubModuleSubject.next(null);
      }
    
      selectSubModule(subModule: SubModule): void {
        this.selectedSubModuleSubject.next(subModule);
      }
    
      selectScreen(screen: Screen): void {
        this.selectedScreenSubject.next(screen);
      }
    
      getSelectedModule(): Module | null {
        return this.selectedModuleSubject.value;
      }
    
      getSelectedSubModule(): SubModule | null {
        return this.selectedSubModuleSubject.value;
      }
    
      getSelectedScreen(): Screen | null {
        return this.selectedScreenSubject.value;
      }

      private routeMatches(currentRoute: string, screenRoute: string): boolean {
        const normalizedScreenRoute = this.normalizeRoute(screenRoute);
        return currentRoute === normalizedScreenRoute ||
          currentRoute.startsWith(`${normalizedScreenRoute}/`);
      }

      private normalizeRoute(route: string): string {
        const pathOnly = (route || '/').split(/[?#]/)[0] || '/';
        const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
        return withLeadingSlash.replace(/\/+$/, '') || '/';
      }

      private getAllowedModuleIds(): Set<string> | null {
        try {
          const user = JSON.parse(sessionStorage.getItem('authUser') || '{}') as {
            isSuperAdmin?: boolean;
            modules?: Array<{ moduleCode?: string }>;
          };
          const roles = JSON.parse(sessionStorage.getItem('authRoles') || '[]') as Array<{ roleType?: string }>;
          const isCompanyAdmin = user.isSuperAdmin === true ||
            roles.some(role => role.roleType?.toLowerCase() === 'company_admin');
          if (isCompanyAdmin) return null;

          const modules = user.modules ?? [];
          if (modules.length === 0) return null;

          const codeToModuleId: Record<string, string> = {
            ACCOUNTS: 'accounts',
            HRMS: 'hrms',
            INVENTORY: 'inventory',
            SETTINGS: 'settings'
          };

          return new Set(
            modules
              .map(module => codeToModuleId[(module.moduleCode || '').toUpperCase()])
              .filter((value): value is string => !!value)
          );
        } catch {
          return null;
        }
      }
    
}
