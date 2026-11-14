import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import {
  InventoryConfigService, SegmentItem, WarehouseItem
} from '../../Inventory_Shared/inventory-config.service';
import { applyInventoryTextCase, toInventoryTitleCase } from '../../Inventory_Shared/inventory-text-case.util';
import { warehouseLocationMasterConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { attachInventorySaveToast } from '../../Inventory_Shared/inventory-save-toast/inventory-save-toast.component';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const CAPACITY_UNITS = ['sqft', 'sqyd', 'acres', 'gunta', 'cents', 'custom'];

@Component({
  selector: 'app-inventory-warehouse',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, InventoryScreenShell],
  templateUrl: './warehouse-location-master.html'
})
export class InventoryWarehouseLocationMasterComponent implements OnInit {
  private svc = inject(InventoryConfigService);

  // ── Form state ────────────────────────────────────────────────────────
  segmentId          = signal<number | null>(null);
  warehouseName      = signal('');
  warehouseCode      = signal('');
  state              = signal('');
  district           = signal('');
  address            = signal('');
  city               = signal('');
  pincode            = signal('');
  capacity           = signal<number | null>(null);
  capacityUnit       = signal('sqft');
  customCapacityUnit = signal('');
  isDefault          = signal(false);
  status             = signal('active');
  editingId          = signal<number | null>(null);

  // ── Reference lists / grids ───────────────────────────────────────────
  segments          = signal<SegmentItem[]>([]);
  savedWarehouses   = signal<WarehouseItem[]>([]);
  pendingWarehouses = signal<any[]>([]);

  readonly existingMatches = computed(() => {
    const q = this.warehouseName().trim().toLowerCase();
    const selectedSegmentId = this.segmentId();
    if (q.length < 2) return [];
    return this.savedWarehouses().filter(w =>
      (!selectedSegmentId || w.segment_id === selectedSegmentId) &&
      w.warehouse_name.toLowerCase().includes(q) && w.id !== this.editingId()
    );
  });

  readonly visibleSavedWarehouses = computed(() => {
    return this.savedWarehouses();
  });

  readonly segmentOptions = computed(() =>
    this.segments().map(item => item.segment_name).filter(Boolean)
  );
  readonly segmentCount = computed(() => this.segmentOptions().length);
  readonly selectedSegment = computed(() =>
    this.segments().find(item => item.id === this.segmentId())?.segment_name ?? ''
  );

  // ── Page state ────────────────────────────────────────────────────────
  loading   = signal(true);
  saving    = signal(false);
  saveMsg   = signal('');
  saveError = signal('');

  constructor() {
    attachInventorySaveToast(this.saveMsg, this.saveError);
  }

  readonly indianStates  = INDIAN_STATES;
  readonly capacityUnits = CAPACITY_UNITS;
  readonly warehouseLocationMasterConfig = warehouseLocationMasterConfig;

  ngOnInit(): void {
    forkJoin({
      segments:   this.svc.getSegments(),
      warehouses: this.svc.getWarehouses(true)
    }).subscribe({
      next: ({ segments, warehouses }) => {
        this.segments.set(segments.data          ?? []);
        this.savedWarehouses.set(warehouses.data ?? []);
        this.applyDefaultSegment();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSegmentChangedByUser(segmentName: string): void {
    const segment = this.segments().find(item => item.segment_name === segmentName);
    this.segmentId.set(segment?.id ?? null);
  }

  onNameChange(name: string): void {
    const normalizedName = toInventoryTitleCase(name ?? '');
    this.warehouseName.set(normalizedName);
    if (!this.editingId()) {
      this.warehouseCode.set(this.autoCode(normalizedName));
    }
  }

  onCodeChange(code: string): void {
    this.warehouseCode.set(String(applyInventoryTextCase(code ?? '', 'upper')));
  }

  onStateChange(value: string): void {
    this.state.set(toInventoryTitleCase(value ?? ''));
  }

  onDistrictChange(value: string): void {
    this.district.set(toInventoryTitleCase(value ?? ''));
  }

  onCityChange(value: string): void {
    this.city.set(toInventoryTitleCase(value ?? ''));
  }

  onAddressChange(value: string): void {
    this.address.set(String(applyInventoryTextCase(value ?? '', 'sentence')));
  }

  onCustomCapacityUnitChange(value: string): void {
    this.customCapacityUnit.set(toInventoryTitleCase(value ?? ''));
  }

  private autoCode(name: string): string {
    const words = name.trim().replace(/[^A-Za-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0);
    let base: string;
    if (words.length >= 2) {
      base = words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
    } else if (words.length === 1) {
      base = words[0].substring(0, 3).toUpperCase();
    } else {
      return '';
    }
    const total = this.savedWarehouses().length + this.pendingWarehouses().length;
    const seq = String(total + 1).padStart(3, '0');
    return `${base}-${seq}`;
  }

  effectiveCapacityUnit(): string {
    return this.capacityUnit() === 'custom' ? this.customCapacityUnit() : this.capacityUnit();
  }

  addToPending(): void {
    if (!this.warehouseName().trim()) {
      this.saveError.set('Warehouse name is required');
      return;
    }
    this.saveError.set('');
    const seg = this.segments().find(s => s.id === this.segmentId());

    this.pendingWarehouses.update(rows => [...rows, {
      _key:           Date.now(),
      _editId:        this.editingId(),
      segment_id:     this.segmentId(),
      _segment_name:  seg?.segment_name ?? '',
      warehouse_name: this.warehouseName().trim(),
      warehouse_code: this.warehouseCode(),
      state:          this.state(),
      district:       this.district(),
      address:        this.address(),
      city:           this.city(),
      pincode:        this.pincode(),
      capacity:       this.capacity(),
      capacity_unit:  this.effectiveCapacityUnit(),
      is_default:     this.isDefault(),
      status:         this.status()
    }]);
    this.clearForm();
  }

  removePending(key: number): void {
    this.pendingWarehouses.update(rows => rows.filter(r => r._key !== key));
  }

  clearForm(): void {
    this.warehouseName.set(''); this.warehouseCode.set('');
    this.state.set(''); this.district.set(''); this.address.set('');
    this.city.set(''); this.pincode.set(''); this.capacity.set(null);
    this.capacityUnit.set('sqft'); this.customCapacityUnit.set('');
    this.isDefault.set(false); this.status.set('active');
    this.editingId.set(null); this.saveError.set('');
  }

  saveAll(): void {
    if (!this.pendingWarehouses().length) return;
    this.saving.set(true); this.saveMsg.set(''); this.saveError.set('');

    const batch = this.pendingWarehouses().map(r => ({
      ...(r._editId ? { id: r._editId } : {}),
      segment_id:     r.segment_id    ?? undefined,
      warehouse_name: r.warehouse_name,
      warehouse_code: r.warehouse_code || undefined,
      state:          r.state          || undefined,
      district:       r.district       || undefined,
      address:        r.address        || undefined,
      city:           r.city           || undefined,
      pincode:        r.pincode        || undefined,
      capacity:       r.capacity       ?? undefined,
      capacity_unit:  r.capacity_unit  || undefined,
      is_default:     r.is_default,
      status:         r.status
    }));

    this.svc.batchSaveWarehouses(batch).subscribe({
      next: res => {
        this.pendingWarehouses.set([]);
        this.savedWarehouses.set(res.data ?? []);
        this.svc.getWarehouses(true).subscribe({
          next: latest => this.savedWarehouses.set(latest.data ?? res.data ?? []),
          error: () => {}
        });
        this.saving.set(false);
        this.saveMsg.set(`${batch.length} warehouse(s) saved successfully`);
        setTimeout(() => this.saveMsg.set(''), 4000);
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(err?.error?.title ?? err?.error?.message ?? 'Save failed');
      }
    });
  }

  segmentName(id: number | null | undefined): string {
    if (!id) return '—';
    return this.segments().find(s => s.id === id)?.segment_name ?? '—';
  }

  editWarehouse(wh: WarehouseItem): void {
    this.editingId.set(wh.id);
    this.segmentId.set(wh.segment_id ?? null);
    this.warehouseName.set(wh.warehouse_name);
    this.warehouseCode.set(wh.warehouse_code);
    this.state.set(wh.state      ?? '');
    this.district.set(wh.district  ?? '');
    this.address.set(wh.address    ?? '');
    this.city.set(wh.city          ?? '');
    this.pincode.set(wh.pincode    ?? '');
    this.capacity.set(wh.capacity  ?? null);
    this.isDefault.set(wh.is_default);
    this.status.set(wh.status);

    const knownUnits = ['sqft', 'sqyd', 'acres', 'gunta', 'cents'];
    if (wh.capacity_unit && !knownUnits.includes(wh.capacity_unit)) {
      this.capacityUnit.set('custom');
      this.customCapacityUnit.set(wh.capacity_unit);
    } else {
      this.capacityUnit.set(wh.capacity_unit ?? 'sqft');
      this.customCapacityUnit.set('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private applyDefaultSegment(): void {
    if (this.segmentId() || !this.segments().length) return;
    this.segmentId.set(this.segments()[0].id);
  }
}
