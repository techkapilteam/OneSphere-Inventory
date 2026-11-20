import { Injectable, computed, inject, signal } from '@angular/core';
import { CustomerItem, InventoryConfigService, ProductItem, ProductTypeItem, UomItem } from '../Inventory_Shared/inventory-config.service';

export interface LeaseCustomerOption {
  id: number;
  /** "CODE - NAME (GSTIN)": the code and GSTIN keep customers with the same name distinguishable. */
  label: string;
  name: string;
  gstin: string;
}

/**
 * Customers and products for the lease screens. Which products are offered is decided by the
 * Product Type flags (is_lease_charge / is_leasable) read from the backend, not by nature names.
 */
@Injectable({ providedIn: 'root' })
export class LeaseLookups {
  private readonly config = inject(InventoryConfigService);

  readonly customers = signal<LeaseCustomerOption[]>([]);
  /** UOM master: the Rental Unit of a leased asset's rent is picked from here. */
  readonly uoms = signal<UomItem[]>([]);
  private readonly products = signal<ProductItem[]>([]);
  private readonly natures = signal<ProductTypeItem[]>([]);
  private loaded = false;

  readonly chargeProducts = computed(() => this.byNatureFlag('is_lease_charge'));
  readonly leasableProducts = computed(() => this.byNatureFlag('is_leasable'));

  private byNatureFlag(flag: 'is_lease_charge' | 'is_leasable'): ProductItem[] {
    const names = new Set(this.natures().filter(n => !!n[flag]).map(n => n.type_name));
    return this.products().filter(p => !!p.product_nature_name && names.has(p.product_nature_name));
  }

  load(force = false): void {
    if (this.loaded && !force) return;
    this.loaded = true;
    this.config.getCustomers(null).subscribe({
      next: res => this.customers.set((res.data ?? [])
        .filter(c => (c as any).status !== 'inactive')
        .map(c => this.toOption(c))),
      error: () => { this.loaded = false; }
    });
    this.config.getProducts(null).subscribe({ next: res => this.products.set(res.data ?? []), error: () => { this.loaded = false; } });
    this.config.getUoms(false).subscribe({ next: res => this.uoms.set((res.data ?? []).filter(u => u.status !== 'inactive')), error: () => { this.loaded = false; } });
    this.config.getProductTypes(true).subscribe({ next: res => this.natures.set(res.data ?? []), error: () => { this.loaded = false; } });
  }

  private toOption(c: CustomerItem): LeaseCustomerOption {
    const gstin = c.gstin ? ` (${c.gstin})` : '';
    return { id: c.id, name: c.customer_name, gstin: c.gstin ?? '', label: `${c.customer_code} - ${c.customer_name}${gstin}` };
  }
}
