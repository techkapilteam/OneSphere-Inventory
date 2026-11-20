import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';
import { InventoryLineProductPickerComponent } from '../../Inventory_Shared/inventory-line-product-picker/inventory-line-product-picker.component';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { LeaseDateComponent, LeasePickRow, LeasePickerModalComponent, LeaseRatesModalComponent, LeaseReturnModalComponent } from '../lease-dialogs';
import { LeaseLookups } from '../lease-lookups';
import { LeaseAsset, LeaseContract, LeaseMeter, LeaseMeterService, LeaseRate } from '../lease-meter.service';
import { leaseContractConfig } from '../lease-screen-configs';

/* Everything this screen adds to the shared screen shell is prefixed "lease" so it can never clash with
   (or silently override) one of the shell's own members.

   - Customer, quick-add popups: the shell's own (same as Sales Invoice).
   - Meter items: the shell's own product line grid with the shared product picker, so the Variant and
     Attribute steps work exactly as they do on a Sales Invoice line.
   - Leased assets: this screen's own grid (a Fixed Asset, its serial numbers, rent terms). */

const TYPE_LABEL: Record<string, string> = { rent: 'Fixed rent', usage: 'Usage (meter)', rent_usage: 'Rent + usage' };
const CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' }, { value: 'yearly', label: 'Yearly' }
];
const MODE_OPTIONS = [
  { value: 'arrears', label: 'Arrears (bill after the period)' }, { value: 'advance', label: 'Advance' }
];
const RESUME_KEY = 'lease-contract-resume';

interface AvailableAsset {
  product_id: number; product_name: string; product_code?: string;
  serial_unit_id: number | null; asset_ref: string | null; serial_tracked: boolean;
}
/** One line of the "Leased Assets" grid: either already handed over (saved) or new. */
interface AssetRow {
  id?: number;
  product_id: number | null;
  product_name: string;
  serial_unit_id: number | null;
  serial_tracked: boolean;
  asset_ref: string;
  handover_date: string;
  handover_condition: string;
  return_date?: string | null;
  status?: string;
  rent_applicable: boolean;
  rent_uom_id: number | null;
  rent_rate: number | null;
  /** rent terms as loaded, to know whether a saved asset's rent was changed */
  rentSnapshot?: string;
}

function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function rentKey(a: { rent_applicable: boolean; rent_uom_id: number | null; rent_rate: number | null }): string {
  return `${a.rent_applicable ? 1 : 0}|${a.rent_uom_id ?? ''}|${Number(a.rent_rate) || 0}`;
}

@Component({
  selector: 'app-inventory-lease-contracts',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule, InventoryScreenShell, InventoryQuickAddModalComponent, InventoryLineProductPickerComponent,
    LeaseDateComponent, LeasePickerModalComponent, LeaseRatesModalComponent, LeaseReturnModalComponent
  ],
  template: `
<div class="module-page inventory-page">
  <div class="inventory-shell">
    <app-inventory-screen-shell [config]="config"></app-inventory-screen-shell>

    <section class="inventory-section">
      <div class="inventory-form-locked-wrap" [class.inventory-form-locked]="leaseLocked()" [attr.inert]="leaseLocked() ? '' : null">
        <!-- Header -->
        <div class="inventory-transaction-header">
          <div class="erp-form-group">
            <label class="erp-label">Contract No</label>
            <input class="erp-input" type="text" readonly [value]="leaseDraft.contract_no || ''" placeholder="Auto" />
          </div>
          <div class="erp-form-group">
            <label class="erp-label">Start Date</label>
            <app-lease-date [value]="leaseDraft.start_date" (valueChange)="leaseDraft.start_date = $event || leaseDraft.start_date" />
          </div>
          @if (bodyFieldByKey('customer'); as field) {
            <div class="erp-form-group inventory-header-col-6">
              <label class="erp-label">{{ field.label }}</label>
              <div class="inventory-field-with-add">
                <ng-select class="erp-ng-select inventory-ng-select" appendTo="body"
                  [items]="field.options || []" [searchable]="true" [clearable]="true"
                  [ngModel]="leaseCustomerValue(field)"
                  (ngModelChange)="leasePickCustomer($event)"
                  placeholder="Search name or phone">
                </ng-select>
                @if (field.addMaster) {
                  <button type="button" class="erp-btn btn-white btn-icon"
                    [title]="'Add ' + field.addMaster"
                    (click)="openFieldAddMaster(field)">
                    <i class="pi pi-plus"></i>
                  </button>
                }
              </div>
            </div>
          }
          <div class="erp-form-group">
            <label class="erp-label">Site</label>
            <input class="erp-input" type="text" [(ngModel)]="leaseDraft.site_name" placeholder="Branch / location" />
          </div>
          <div class="erp-form-group">
            <label class="erp-label">End Date</label>
            <app-lease-date [value]="leaseDraft.end_date" (valueChange)="leaseDraft.end_date = $event" />
          </div>
          <div class="erp-form-group">
            <label class="erp-label">Billing Cycle</label>
            <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="leaseCycleOptions" bindLabel="label" bindValue="value"
              [searchable]="false" [clearable]="false" [(ngModel)]="leaseDraft.billing_cycle"></ng-select>
          </div>
          <div class="erp-form-group">
            <label class="erp-label">Billing Mode</label>
            <ng-select class="erp-ng-select inventory-ng-select" appendTo="body" [items]="leaseModeOptions" bindLabel="label" bindValue="value"
              [searchable]="false" [clearable]="false" [(ngModel)]="leaseDraft.billing_mode"></ng-select>
          </div>
          <div class="erp-form-group inventory-header-col-6">
            <label class="erp-label">Remarks</label>
            <input class="erp-input" type="text" [(ngModel)]="leaseDraft.remarks" />
          </div>
        </div>

        <!-- Leased assets -->
        <div class="inventory-line-items grn-grid-compact">
          <div class="inventory-line-title">
            <div>
              <strong>Leased Assets</strong>
              <span>Fixed Assets that are not already on lease. Rent is set per asset: applicable or not, the rental unit (UOM) and the rate.</span>
            </div>
            <div class="inventory-line-title-actions">
              <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Add row" aria-label="Add row" (click)="leaseAddAssetRow()"><i class="pi pi-plus"></i></button>
            </div>
          </div>
          <div class="tbl-wrap">
            <table class="erp-table compact inventory-resizable-table">
              <thead>
                <tr><th class="text-center">Actions</th><th class="text-center">S.No</th><th>Asset</th><th>Asset No / Serial</th><th>Handover Date</th><th>Condition</th><th>Rent</th><th>Rental Unit</th><th>Rent Rate</th><th>Status</th></tr>
              </thead>
              <tbody>
                @for (a of leaseAssets; track $index; let i = $index) {
                  <tr>
                    <td class="text-center">
                      <div class="inventory-row-actions">
                        <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Add row" (click)="leaseAddAssetRow()"><i class="pi pi-plus"></i></button>
                        @if (a.id) {
                          @if (a.status !== 'returned') {
                            <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseReturning.set(a)">{{ a.status === 'under_repair' ? 'Mark returned' : 'Return' }}</button>
                          }
                        } @else {
                          <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Remove row" (click)="leaseAssets.splice(i, 1)"><i class="pi pi-trash"></i></button>
                        }
                      </div>
                    </td>
                    <td class="text-center">{{ i + 1 }}</td>
                    <td class="inventory-line-col-product">
                      @if (a.id) { <span class="inventory-grid-static-value">{{ a.product_name }}</span> }
                      @else {
                        <div class="inventory-field-with-add">
                          <input class="erp-input inventory-grid-input" type="text" readonly [value]="a.product_name" placeholder="Pick asset" (click)="leaseOpenAssetPicker(i)" style="cursor:pointer" />
                          <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Pick asset" (click)="leaseOpenAssetPicker(i)"><i class="pi pi-search"></i></button>
                        </div>
                      }
                    </td>
                    <td>
                      @if (a.id || a.serial_tracked) { <span class="inventory-grid-static-value">{{ a.asset_ref }}</span> }
                      @else { <input class="erp-input inventory-grid-input" type="text" [(ngModel)]="a.asset_ref" placeholder="Asset number / serial" /> }
                    </td>
                    <td style="min-width:150px">
                      @if (a.id) { <span class="inventory-grid-static-value">{{ a.handover_date }}</span> }
                      @else { <app-lease-date [value]="a.handover_date" (valueChange)="a.handover_date = $event || a.handover_date" /> }
                    </td>
                    <td>
                      @if (a.id) { <span class="inventory-grid-static-value">{{ a.handover_condition }}</span> }
                      @else { <input class="erp-input inventory-grid-input" type="text" [(ngModel)]="a.handover_condition" placeholder="e.g. New, toner full" /> }
                    </td>
                    <td>
                      <label class="inventory-labeled-switch yes-no">
                        <input type="checkbox" [checked]="a.rent_applicable" [disabled]="a.status === 'returned'" (change)="a.rent_applicable = $any($event.target).checked" />
                        <span class="inventory-switch-track"><span class="switch-text switch-on">Yes</span><span class="switch-text switch-off">No</span></span>
                      </label>
                    </td>
                    <td style="min-width:150px">
                      @if (a.rent_applicable) {
                        <ng-select class="erp-ng-select inventory-ng-select inventory-grid-select" appendTo="body" [items]="leaseLookups.uoms()" bindLabel="uom_name" bindValue="id"
                          [searchable]="true" [clearable]="false" [(ngModel)]="a.rent_uom_id" [disabled]="a.status === 'returned'" placeholder="Per Month, Per Day, Per Hour..."></ng-select>
                      } @else { <span class="inventory-grid-na">N/A</span> }
                    </td>
                    <td>
                      @if (a.rent_applicable) { <input class="erp-input inventory-grid-input" type="number" min="0" step="0.01" [(ngModel)]="a.rent_rate" [disabled]="a.status === 'returned'" /> }
                      @else { <span class="inventory-grid-na">N/A</span> }
                    </td>
                    <td>{{ a.id ? leaseStatusLabel(a.status) : 'To hand over' }}{{ a.return_date ? ' (' + a.return_date + ')' : '' }}</td>
                  </tr>
                }
                @if (!leaseAssets.length) {
                  <tr><td colspan="10" class="text-center">No assets yet. Click + to add one.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Meters: the shared product grid (product picker with Variant / Attribute) -->
        <div class="inventory-line-items grn-grid-compact">
          <div class="inventory-line-title">
            <div>
              <strong>Meters &amp; Rates</strong>
              <span>Optional. Pick the Service billed by usage (copies, hours, kWh...) with its variant / attribute. Its UOM is the meter unit. Billing uses verified readings.</span>
            </div>
            <div class="inventory-line-title-actions">
              <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Add row" aria-label="Add row" (click)="leaseAddMeterRow()"><i class="pi pi-plus"></i></button>
            </div>
          </div>
          <div class="tbl-wrap">
            <table class="erp-table compact inventory-resizable-table">
              <thead>
                <tr><th class="text-center">Actions</th><th class="text-center">S.No</th><th>Meter Item</th><th>UOM</th><th>Label</th><th>Opening Reading</th><th>Rate / unit</th><th>Free units</th><th>Min. charge</th><th>Rates / Slabs</th></tr>
              </thead>
              <tbody>
                @for (row of directEntryLineRows(); track $index; let i = $index) {
                  @let m = leaseMeter(i);
                  <tr>
                    <td class="text-center">
                      <div class="inventory-row-actions">
                        <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Add row" (click)="leaseAddMeterRow()"><i class="pi pi-plus"></i></button>
                        <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Remove row" (click)="leaseRemoveMeterRow(i)"><i class="pi pi-trash"></i></button>
                      </div>
                    </td>
                    <td class="text-center">{{ i + 1 }}</td>
                    <td class="inventory-line-col-product">
                      <app-inventory-line-product-picker
                        [host]="this" [rowIndex]="i" column="Product"
                        [productColumnIndex]="lineGridSourceColumnIndex('Product')"
                        [variantColumnIndex]="lineGridSourceColumnIndex('Variant')"
                        [attributeColumnIndex]="lineGridSourceColumnIndex('Attribute')">
                      </app-inventory-line-product-picker>
                    </td>
                    <td>{{ leaseUnitOfRow(row) }}</td>
                    <td><input class="erp-input inventory-grid-input" type="text" [(ngModel)]="m.meter_label" /></td>
                    <td><input class="erp-input inventory-grid-input" type="number" min="0" [(ngModel)]="m.opening_reading" /></td>
                    <td>
                      @if (leaseHasSlabs(m)) { <span class="inventory-grid-static-value">Slabs</span> }
                      @else { <input class="erp-input inventory-grid-input" type="number" min="0" step="0.0001" [(ngModel)]="m.rates[0].rate" /> }
                    </td>
                    <td><input class="erp-input inventory-grid-input" type="number" min="0" [(ngModel)]="m.rates[0].free_qty" /></td>
                    <td><input class="erp-input inventory-grid-input" type="number" min="0" [(ngModel)]="m.rates[0].min_charge" /></td>
                    <td><button type="button" class="erp-btn btn-white btn-sm" (click)="leaseRatesFor.set(i)"><i class="pi pi-sliders-h"></i> {{ m.rates.length }} rate{{ m.rates.length === 1 ? '' : 's' }}{{ leaseHasSlabs(m) ? ' + slabs' : '' }}</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      @if (leaseError()) {
        <div class="inventory-save-error"><span>{{ leaseError() }}</span>
          <button type="button" class="inventory-alert-close" (click)="leaseError.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }
      @if (leaseMessage()) {
        <div class="inventory-save-msg"><span>{{ leaseMessage() }}</span>
          <button type="button" class="inventory-alert-close" (click)="leaseMessage.set('')" aria-label="Dismiss"><i class="pi pi-times"></i></button></div>
      }

      <div class="inventory-form-actions">
        <button type="button" class="erp-btn btn-white" (click)="leaseClear()"><i class="pi pi-times"></i> Clear</button>
        @if (!leaseDraft.id || leaseDraft.status === 'draft') {
          <button type="button" class="erp-btn btn-white" [disabled]="leaseSaving() || leaseLocked()" (click)="leaseSave(false)">
            <i [class]="leaseSaving() ? 'pi pi-spin pi-spinner' : 'pi pi-save'"></i> {{ leaseSaving() ? 'Saving...' : leaseDraft.id ? 'Update Draft' : 'Save Draft' }}
          </button>
          <button type="button" class="erp-btn btn-primary" [disabled]="leaseSaving() || leaseLocked()" (click)="leaseSave(true)">
            <i [class]="leaseSaving() ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'"></i> {{ leaseSaving() ? 'Saving...' : 'Save & Activate' }}
          </button>
        } @else {
          <button type="button" class="erp-btn btn-primary" [disabled]="leaseSaving() || leaseLocked()" (click)="leaseSave(false)">
            <i [class]="leaseSaving() ? 'pi pi-spin pi-spinner' : 'pi pi-save'"></i> {{ leaseSaving() ? 'Saving...' : 'Update Contract' }}
          </button>
        }
      </div>
    </section>

    <!-- Existing contracts -->
    <section class="inventory-section">
      <div class="inventory-section-title">
        <div><h3>Existing Lease Contracts</h3><p>Click Edit to load a contract back into the form.</p></div>
      </div>
      <div class="erp-table-toolbar tbl-toolbar-flush">
        <span class="inventory-grid-range">{{ leasePageLabel() }}</span>
        <div class="grid-export-actions">
          <select class="inventory-grid-page-size" [ngModel]="leaseStatusFilter()" (ngModelChange)="leaseStatusFilter.set($event); leasePage.set(0); leaseLoad()">
            <option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option>
            <option value="suspended">Suspended</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
          </select>
          <input class="erp-input inventory-grid-search" type="text" placeholder="Search grid" [ngModel]="leaseSearch()" (ngModelChange)="leaseSearch.set($event); leasePage.set(0)" />
          <span class="inventory-grid-divider"></span>
          <div class="inventory-grid-pager">
            <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Previous page" [disabled]="leasePage() === 0" (click)="leasePage.set(leasePage() - 1)"><i class="pi pi-chevron-left"></i></button>
            <span class="inventory-grid-pager-label">{{ leasePageLabel() }}</span>
            <button type="button" class="erp-btn btn-white btn-icon btn-sm" title="Next page" [disabled]="(leasePage() + 1) * leasePageSize() >= leaseFiltered().length" (click)="leasePage.set(leasePage() + 1)"><i class="pi pi-chevron-right"></i></button>
            <select class="inventory-grid-page-size" [ngModel]="leasePageSize()" (ngModelChange)="leasePageSize.set(+$event); leasePage.set(0)">
              <option [ngValue]="10">10 / page</option><option [ngValue]="25">25 / page</option><option [ngValue]="50">50 / page</option>
            </select>
          </div>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="erp-table compact">
          <thead><tr><th>Contract</th><th>Customer</th><th>Site</th><th>Period</th><th>Billing</th><th>Assets</th><th>Meters</th><th>Billed to</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            @for (c of leasePageRows(); track c.id) {
              <tr>
                <td>{{ c.contract_no }}</td><td>{{ c.customer_name }}</td><td>{{ c.site_name }}</td>
                <td>{{ c.start_date }} → {{ c.end_date || 'open' }}</td><td>{{ c.billing_cycle }} / {{ c.billing_mode }}</td>
                <td>{{ c.asset_count }}</td><td>{{ c.meter_count }}</td><td>{{ c.last_billed_to || '-' }}</td><td>{{ c.status }}</td>
                <td class="d-flex gap-1">
                  <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseOpen(c.id!)"><i class="pi pi-pencil"></i> Edit</button>
                  @if (c.status === 'draft') { <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseSetStatus(c, 'active')">Activate</button> }
                  @if (c.status === 'active') {
                    <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseSetStatus(c, 'suspended')">Suspend</button>
                    <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseSetStatus(c, 'closed')">Close</button>
                  }
                  @if (c.status === 'suspended') {
                    <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseSetStatus(c, 'active')">Resume</button>
                    <button type="button" class="erp-btn btn-white btn-sm" (click)="leaseSetStatus(c, 'closed')">Close</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="10" class="text-center">No lease contracts.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  </div>
</div>

<!-- Popups: the shared quick-add modal (customer, UOM, ...) plus the lease pickers -->
<app-inventory-quick-add-modal [host]="quickAddHost"></app-inventory-quick-add-modal>

@if (leaseAssetPickerFor() !== null) {
  <app-lease-picker-modal title="Pick Asset" subtitle="Fixed Assets marked 'Can Be Leased Out' that are not already on lease. Tick every serial number you are handing over."
    noun="asset" [multi]="true" [rows]="leaseAssetPickRows()" (pickedMany)="leaseOnAssetsPicked(leaseAssetPickerFor()!, $event)"
    (addNew)="leaseAddProduct($event)" (closed)="leaseAssetPickerFor.set(null)" />
}
@if (leaseRatesFor() !== null && leaseMeter(leaseRatesFor()!); as rm) {
  <app-lease-rates-modal [title]="leaseMeterItemName(leaseRatesFor()!)" [unit]="leaseUnitOfRow(directEntryLineRows()[leaseRatesFor()!])" [startDate]="leaseDraft.start_date" [value]="rm.rates"
    (done)="leaseOnRatesDone($event)" (closed)="leaseRatesFor.set(null)" />
}
@if (leaseReturning(); as r) {
  <app-lease-return-modal [assetName]="r.product_name + ' - ' + r.asset_ref" [underRepair]="r.status === 'under_repair'"
    (done)="leaseConfirmReturn(r, $event)" (closed)="leaseReturning.set(null)" />
}`
})
export class InventoryLeaseContractsComponent extends InventoryScreenShell implements OnInit {
  override readonly config = leaseContractConfig;

  private readonly leaseApi = inject(LeaseMeterService);
  readonly leaseLookups = inject(LeaseLookups);
  private readonly leaseRoute = inject(ActivatedRoute);

  readonly leaseCycleOptions = CYCLE_OPTIONS;
  readonly leaseModeOptions = MODE_OPTIONS;

  readonly leaseRows = signal<LeaseContract[]>([]);
  readonly leaseStatusFilter = signal('');
  readonly leaseSearch = signal('');
  readonly leasePage = signal(0);
  readonly leasePageSize = signal(10);
  readonly leaseSaving = signal(false);
  readonly leaseError = signal('');
  readonly leaseMessage = signal('');
  readonly leaseAvailable = signal<AvailableAsset[]>([]);

  readonly leaseAssetPickerFor = signal<number | null>(null);
  readonly leaseRatesFor = signal<number | null>(null);
  readonly leaseReturning = signal<AssetRow | null>(null);
  private readonly leaseLoadedStatus = signal('');
  private leasePendingAssetRow: number | null = null;

  leaseDraft: LeaseContract = this.leaseBlank();
  leaseAssets: AssetRow[] = [];
  /** Extra data of each meter row (label, opening reading, rates ...), kept in step with the shell's product rows. */
  leaseMeters: LeaseMeter[] = [];

  readonly leaseLocked = computed(() => ['closed', 'cancelled'].includes(this.leaseLoadedStatus()));
  readonly leaseFiltered = computed(() => {
    const q = this.leaseSearch().trim().toLowerCase();
    const all = this.leaseRows();
    return q ? all.filter(c => `${c.contract_no} ${c.customer_name} ${c.site_name ?? ''} ${c.status}`.toLowerCase().includes(q)) : all;
  });
  readonly leasePageRows = computed(() => this.leaseFiltered().slice(this.leasePage() * this.leasePageSize(), (this.leasePage() + 1) * this.leasePageSize()));
  readonly leasePageLabel = computed(() => {
    const n = this.leaseFiltered().length;
    if (!n) return '0 of 0';
    const from = this.leasePage() * this.leasePageSize() + 1;
    return `${from}-${Math.min(n, from + this.leasePageSize() - 1)} of ${n}`;
  });

  private leaseCustomerCache: { id: number | null; options: unknown; value: string | null } = { id: null, options: null, value: null };

  constructor() {
    super();
    // The shared Add Customer popup writes the new customer into the shell's "customer" field:
    // follow it so the contract gets that customer.
    effect(() => {
      const picked = this.formValues()['customer'];
      untracked(() => {
        const id = picked ? this.findCustomerBySelection(picked)?.id : null;
        if (id) this.leaseDraft.customer_id = id;
      });
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.leaseLookups.load();
    this.leaseLoad();
    this.leaseLoadAvailable();
    this.leaseRestoreIfReturning();
  }

  /** The meter-item picker offers only Service items that can be billed as rent / usage. */
  override lineColumnOptions(column: string, row?: string[]): string[] {
    if (column.toLowerCase().includes('product')) {
      return this.leaseLookups.chargeProducts().map(p => p.product_name);
    }
    return super.lineColumnOptions(column, row);
  }

  leaseStatusLabel(s?: string): string { return ({ on_lease: 'On lease', returned: 'Returned', under_repair: 'Under repair' } as Record<string, string>)[s ?? ''] ?? (s ?? ''); }

  private leaseBlank(): LeaseContract {
    return {
      customer_id: null, contract_type: 'rent_usage', start_date: today(), end_date: null,
      billing_cycle: 'monthly', billing_mode: 'arrears', fixed_rent_amount: null, rent_product_id: null,
      site_name: '', remarks: ''
    };
  }

  leaseLoad(): void {
    this.leaseApi.getContracts({ status: this.leaseStatusFilter() || undefined }).subscribe({
      next: res => this.leaseRows.set(res.data ?? []),
      error: err => this.leaseError.set(LeaseMeterService.errorMessage(err))
    });
  }

  private leaseLoadAvailable(): void {
    this.leaseApi.getAvailableAssets().subscribe({ next: res => this.leaseAvailable.set(res.data ?? []), error: () => {} });
  }

  // ── customer: same picker as the Sales screens ─────────────────────────
  leaseCustomerValue(field: { options?: string[] }): string | null {
    const id = this.leaseDraft.customer_id;
    const options = field.options ?? [];
    const c = this.leaseCustomerCache;
    if (c.id === id && c.options === options) return c.value;
    const value = id ? (options.find(o => this.findCustomerBySelection(o)?.id === id) ?? null) : null;
    this.leaseCustomerCache = { id, options, value };
    return value;
  }

  leasePickCustomer(value: string | null): void {
    this.collectFormField('customer', value ?? '');
    this.leaseDraft.customer_id = value ? (this.findCustomerBySelection(value)?.id ?? null) : null;
  }

  // ── form state ─────────────────────────────────────────────────────────
  private leaseBlankShellRow(): string[] {
    return new Array((this.config.lineColumns ?? []).length).fill('');
  }

  private leaseResetMeterRows(rows: string[][] = [this.leaseBlankShellRow()]): void {
    this.entryLineRowsKey.set(this.config.key);
    this.lineAttrValueMap.set({});
    this.entryLineRows.set(rows);
  }

  leaseClear(): void {
    this.leaseDraft = this.leaseBlank();
    this.leaseAssets = [];
    this.leaseMeters = [];
    this.leaseResetMeterRows();
    this.leaseLoadedStatus.set('');
    this.collectFormField('customer', '');
    this.leaseError.set(''); this.leaseMessage.set('');
  }

  leaseOpen(id: number, keepMessage = false): void {
    this.leaseError.set('');
    if (!keepMessage) this.leaseMessage.set('');
    this.leaseApi.getContract(id).subscribe({
      next: res => {
        const c = res.data!;
        this.leaseDraft = { ...c, start_date: String(c.start_date).slice(0, 10), end_date: c.end_date ? String(c.end_date).slice(0, 10) : null };
        this.leaseLoadedStatus.set(c.status ?? '');
        this.leaseAssets = (c.assets ?? []).map(a => {
          const row: AssetRow = {
            id: a.id, product_id: a.product_id, product_name: a.product_name ?? '', serial_unit_id: null, serial_tracked: false,
            asset_ref: a.asset_ref, handover_date: String(a.handover_date).slice(0, 10), handover_condition: a.handover_condition ?? '',
            return_date: a.return_date ? String(a.return_date).slice(0, 10) : null, status: a.status,
            rent_applicable: !!a.rent_applicable, rent_uom_id: a.rent_uom_id ?? null, rent_rate: a.rent_rate != null ? Number(a.rent_rate) : null
          };
          row.rentSnapshot = rentKey(row);
          return row;
        });
        // meters: the shared product rows carry item / variant / attribute, the extras carry the rest
        const meters = (c.meters ?? []).map(m => ({
          ...m,
          rates: (m.rates ?? []).length
            ? m.rates.map(r => ({ ...r, effective_from: String(r.effective_from).slice(0, 10), slabs: (r.slabs ?? []).map(s => ({ ...s })) }))
            : [this.leaseNewRate()]
        }));
        this.leaseMeters = meters;
        const cols = (this.config.lineColumns ?? []).map(x => x.toLowerCase());
        const rows = meters.map(m => {
          const r = this.leaseBlankShellRow();
          r[cols.indexOf('product')] = m.charge_product_name ?? '';
          const vi = cols.indexOf('variant');
          if (vi >= 0) r[vi] = m.variant_name ?? '';
          return r;
        });
        this.leaseResetMeterRows(rows.length ? rows : [this.leaseBlankShellRow()]);
        meters.forEach((m, i) => { if (m.attribute_name) this.setLineAttrValue(i, m.attribute_name, m.attribute_value ?? ''); });
        this.leaseLoadAvailable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: err => this.leaseError.set(LeaseMeterService.errorMessage(err))
    });
  }

  private leaseNewRate(): LeaseRate {
    return { effective_from: this.leaseDraft.start_date, rate: null, free_qty: 0, min_charge: 0, slabs: [] };
  }

  // ── assets grid ────────────────────────────────────────────────────────
  leaseAddAssetRow(): void {
    this.leaseAssets.push({
      product_id: null, product_name: '', serial_unit_id: null, serial_tracked: false, asset_ref: '', handover_date: today(), handover_condition: '',
      rent_applicable: false, rent_uom_id: null, rent_rate: null
    });
  }

  leaseOpenAssetPicker(index: number): void { this.leaseAssetPickerFor.set(index); }

  /** Free assets, minus the serial numbers already added on this form. */
  private leaseFreeAssets(): AvailableAsset[] {
    const taken = new Set(this.leaseAssets.filter(a => a.product_id && a.serial_unit_id).map(a => `${a.product_id}|${a.serial_unit_id}`));
    return this.leaseAvailable().filter(a => !(a.serial_unit_id && taken.has(`${a.product_id}|${a.serial_unit_id}`)));
  }

  leaseAssetPickRows(): LeasePickRow[] {
    return this.leaseFreeAssets().map((a, i) => ({
      key: i, code: a.product_code, name: a.product_name, sub: a.asset_ref ? 'Serial ' + a.asset_ref : 'Enter the asset number on the row'
    }));
  }

  /** Each ticked serial number becomes its own leased asset row (the first one fills the row that opened the picker). */
  leaseOnAssetsPicked(index: number, keys: (string | number)[]): void {
    const free = this.leaseFreeAssets();
    const picked = keys.map(k => free[+k]).filter((a): a is AvailableAsset => !!a);
    picked.forEach((a, n) => {
      let row = n === 0 && this.leaseAssets[index] && !this.leaseAssets[index].id && !this.leaseAssets[index].product_id ? this.leaseAssets[index] : null;
      if (!row) {
        this.leaseAddAssetRow();
        row = this.leaseAssets[this.leaseAssets.length - 1];
      }
      row.product_id = a.product_id; row.product_name = a.product_name; row.serial_unit_id = a.serial_unit_id;
      row.serial_tracked = !!a.serial_tracked; row.asset_ref = a.asset_ref ?? '';
    });
    this.leaseAssetPickerFor.set(null);
  }

  leaseConfirmReturn(a: AssetRow, body: { return_date: string; return_condition?: string; new_status: 'returned' | 'under_repair' }): void {
    if (!a.id) return;
    this.leaseError.set(''); this.leaseMessage.set('');
    this.leaseApi.returnAsset(a.id, body).subscribe({
      next: () => { this.leaseReturning.set(null); this.leaseMessage.set(`Asset ${a.asset_ref} updated.`); this.leaseOpen(this.leaseDraft.id!, true); },
      error: err => { this.leaseReturning.set(null); this.leaseError.set(LeaseMeterService.errorMessage(err)); }
    });
  }

  // ── meters grid (shared product rows) ──────────────────────────────────
  /** The extra data of meter row i (created on first use). */
  leaseMeter(i: number): LeaseMeter {
    while (this.leaseMeters.length <= i) {
      this.leaseMeters.push({ meter_def_id: null, meter_label: '', opening_reading: 0, charge_product_id: null, lease_asset_id: null, rates: [this.leaseNewRate()] });
    }
    return this.leaseMeters[i];
  }

  leaseAddMeterRow(): void {
    this.addEntryLineRow();
    this.leaseMeter(this.directEntryLineRows().length - 1);
  }

  leaseRemoveMeterRow(i: number): void {
    this.removeEntryLineRow(i);
    this.leaseMeters.splice(i, 1);
  }

  private leaseRowProduct(row: string[] | undefined) {
    return row ? this.findProductBySelection(this.lineCellValue(row, 'Product')) : null;
  }
  leaseMeterItemName(i: number): string { return this.lineCellValue(this.directEntryLineRows()[i] ?? [], 'Product'); }
  leaseUnitOfRow(row: string[] | undefined): string { return this.leaseRowProduct(row)?.base_uom_name || ''; }
  leaseHasSlabs(m: LeaseMeter): boolean { return m.rates.some(r => (r.slabs ?? []).length > 0); }

  leaseOnRatesDone(rates: LeaseRate[]): void {
    const i = this.leaseRatesFor();
    if (i !== null && this.leaseMeters[i]) this.leaseMeters[i].rates = rates;
    this.leaseRatesFor.set(null);
  }

  // ── "New" product: the same Product Master trip the Sales lines make ───
  /** From this screen's asset picker. */
  leaseAddProduct(typedName: string): void {
    this.leasePendingAssetRow = this.leaseAssetPickerFor();
    this.leaseAssetPickerFor.set(null);
    this.addProductFromProcurementGrid(undefined, { rowIndex: -1, columnIndex: -1, productName: typedName });
  }

  /** Every trip to Product Master (from the shared meter picker too) first keeps this contract's own fields. */
  override addProductFromProcurementGrid(sourceFieldKey?: string, pendingLine?: { rowIndex: number; columnIndex: number; productName: string }): void {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({
        draft: this.leaseDraft, assets: this.leaseAssets, meters: this.leaseMeters,
        assetRow: pendingLine && pendingLine.rowIndex < 0 ? this.leasePendingAssetRow : null, savedAt: Date.now()
      }));
    } catch { /* still make the trip, just without the saved form */ }
    super.addProductFromProcurementGrid(sourceFieldKey, pendingLine);
  }

  /** Back from Product Master: put the contract's own fields back (the shell restores the meter product rows). */
  private leaseRestoreIfReturning(): void {
    const params = this.leaseRoute.snapshot.queryParamMap;
    if (params.get('resumed') !== '1') return;
    let snap: { draft: LeaseContract; assets: AssetRow[]; meters: LeaseMeter[]; assetRow: number | null; savedAt: number } | null = null;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      sessionStorage.removeItem(RESUME_KEY);
      snap = raw ? JSON.parse(raw) : null;
    } catch { snap = null; }
    if (!snap || Date.now() - snap.savedAt > 30 * 60 * 1000) return;

    this.leaseDraft = snap.draft;
    this.leaseAssets = snap.assets;
    this.leaseMeters = snap.meters;
    this.leaseLoadedStatus.set(snap.draft.status ?? '');
    const createdName = (params.get('createdProduct') || '').trim().toLowerCase();
    const assetRow = snap.assetRow;
    if (!createdName || assetRow === null || assetRow === undefined) return;

    // a new Fixed Asset was created for an asset row: wait for it to show in the available list, then drop it in
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      this.leaseApi.getAvailableAssets().subscribe({
        next: res => {
          this.leaseAvailable.set(res.data ?? []);
          const pos = this.leaseFreeAssets().findIndex(a => a.product_name.trim().toLowerCase() === createdName);
          if (pos >= 0 && this.leaseAssets[assetRow]) {
            this.leaseOnAssetsPicked(assetRow, [pos]);
            this.leaseMessage.set('Asset added to the Product Master.');
            clearInterval(timer);
          }
        }
      });
      if (tries >= 8) clearInterval(timer);
    }, 900);
  }

  // ── save ───────────────────────────────────────────────────────────────
  /** Meter rows that have a product, as the contract's meters. */
  private leaseCollectMeters(): { meters: LeaseMeter[]; problem: string | null } {
    const rows = this.directEntryLineRows();
    const meters: LeaseMeter[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const productName = this.lineCellValue(row, 'Product').trim();
      if (!productName) continue;
      const product = this.findProductBySelection(productName);
      if (!product) return { meters, problem: `Meter row ${i + 1}: "${productName}" is not a product.` };
      const extra = this.leaseMeter(i);
      const r = extra.rates[0];
      if (!this.leaseHasSlabs(extra) && !(Number(r?.rate) > 0)) return { meters, problem: `Meter row ${i + 1}: enter the rate per unit or use slabs.` };

      // variant and attribute exactly as the Sales Invoice resolves them from the shared grid row
      const variantText = this.lineCellValue(row, 'Variant').trim();
      const variant = variantText
        ? this.productVariantOptionObjects(product).find(v => this.productVariantOptionMatches(v, variantText)) ?? null
        : null;
      const attr = this.lineRowAttrSelections(i, row).find(a => a.value);
      meters.push({
        ...extra,
        charge_product_id: product.id,
        meter_label: extra.meter_label || product.product_name,
        variant_id: variant?.id ?? null, variant_name: variant?.variant_name ?? (variantText || null),
        attribute_id: null, attribute_name: attr?.name ?? null, attribute_value: attr?.value ?? null
      });
    }
    return { meters, problem: null };
  }

  private leaseValidate(): string | null {
    const d = this.leaseDraft;
    if (!d.customer_id) return 'Select the customer.';
    if (!d.start_date) return 'Start date is required.';
    for (const [i, a] of this.leaseAssets.entries()) {
      if (!a.id) {
        if (!a.product_id) return `Asset row ${i + 1}: pick the asset (or remove the row).`;
        if (!a.asset_ref.trim()) return `Asset row ${i + 1}: enter the asset number / serial.`;
      }
      if (a.rent_applicable && a.status !== 'returned') {
        if (!a.rent_uom_id) return `Asset row ${i + 1}: pick the rental unit (UOM) for the rent.`;
        if (!(Number(a.rent_rate) > 0)) return `Asset row ${i + 1}: enter the rent rate.`;
      }
    }
    return this.leaseCollectMeters().problem;
  }

  async leaseSave(activate: boolean): Promise<void> {
    this.leaseError.set(''); this.leaseMessage.set('');
    const problem = this.leaseValidate();
    if (problem) { this.leaseError.set(problem); return; }

    const wasNew = !this.leaseDraft.id;
    const body: LeaseContract = {
      ...this.leaseDraft,
      status: this.leaseDraft.id ? this.leaseDraft.status : (activate ? 'active' : 'draft'),
      end_date: this.leaseDraft.end_date || null,
      meters: this.leaseCollectMeters().meters.map(m => ({
        ...m,
        opening_reading: Number(m.opening_reading) || 0,
        rates: m.rates.map(r => ({
          effective_from: r.effective_from,
          rate: Number(r.rate) || 0,
          free_qty: Number(r.free_qty) || 0,
          min_charge: Number(r.min_charge) || 0,
          slabs: (r.slabs ?? [])
            .filter(s => s.from_qty !== null && (s.from_qty as any) !== '' && s.slab_rate !== null && (s.slab_rate as any) !== '')
            .map(s => ({ from_qty: Number(s.from_qty), to_qty: s.to_qty === null || (s.to_qty as any) === '' ? null : Number(s.to_qty), slab_rate: Number(s.slab_rate) }))
        }))
      }))
    };

    this.leaseSaving.set(true);
    try {
      const res = await firstValueFrom(this.leaseApi.saveContract(body));
      const saved = res.data!;
      const failures: string[] = [];

      for (const a of this.leaseAssets) {
        try {
          if (!a.id) {
            await firstValueFrom(this.leaseApi.handover({
              contract_id: saved.id!, product_id: a.product_id!, serial_unit_id: a.serial_unit_id,
              asset_ref: a.asset_ref.trim(), handover_date: a.handover_date, handover_condition: a.handover_condition.trim() || undefined,
              rent_applicable: a.rent_applicable, rent_uom_id: a.rent_applicable ? a.rent_uom_id : null, rent_rate: a.rent_applicable ? Number(a.rent_rate) || 0 : 0
            }));
          } else if (a.status !== 'returned' && rentKey(a) !== a.rentSnapshot) {
            await firstValueFrom(this.leaseApi.setAssetRent(a.id, {
              rent_applicable: a.rent_applicable, rent_uom_id: a.rent_applicable ? a.rent_uom_id : null, rent_rate: a.rent_applicable ? Number(a.rent_rate) || 0 : 0
            }));
          }
        } catch (err) { failures.push(`${a.product_name} ${a.asset_ref}: ${LeaseMeterService.errorMessage(err)}`); }
      }

      if (activate && !wasNew && saved.status === 'draft') {
        try { await firstValueFrom(this.leaseApi.setContractStatus(saved.id!, 'active')); }
        catch (err) { failures.push(`Activate: ${LeaseMeterService.errorMessage(err)}`); }
      }

      this.leaseSaving.set(false);
      this.leaseLoad();
      this.leaseLoadAvailable();
      this.leaseOpen(saved.id!, true);
      this.leaseMessage.set(`Contract ${saved.contract_no ?? ''} saved.`);
      if (failures.length) this.leaseError.set('Saved, but: ' + failures.join(' | '));
    } catch (err) {
      this.leaseSaving.set(false);
      this.leaseError.set(LeaseMeterService.errorMessage(err));
    }
  }

  leaseSetStatus(c: LeaseContract, status: string): void {
    if (!c.id) return;
    const verb = ({ active: 'activate', suspended: 'suspend', closed: 'close', cancelled: 'cancel' } as Record<string, string>)[status] ?? status;
    if (!confirm(`Do you want to ${verb} contract ${c.contract_no}?`)) return;
    this.leaseError.set(''); this.leaseMessage.set('');
    this.leaseApi.setContractStatus(c.id, status).subscribe({
      next: () => {
        this.leaseMessage.set(`Contract ${c.contract_no} is now ${status}.`);
        this.leaseLoad();
        if (this.leaseDraft.id === c.id) this.leaseOpen(c.id!, true);
      },
      error: err => this.leaseError.set(LeaseMeterService.errorMessage(err))
    });
  }
}
