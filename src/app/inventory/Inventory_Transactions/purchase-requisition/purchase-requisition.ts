import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { ProductItem, BranchInvItem } from '../../Inventory_Shared/inventory-config.service';
import { purchaseRequisitionConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { AccessControlService, UserResponse } from '../../../core/host/host-bridge';

export interface VariantAttrSelection {
  name: string;
  value: string;
  options: string[];
  isAuto: boolean;
}

export interface PrLineItem {
  productId: number | null;
  product: string;
  productCode: string;
  description: string;
  uom: string;
  uomId: number | null;
  uomOptions: string[];
  variantId: number | null;
  variant: string;
  variantOptions: Array<{ id: number; label: string; variant_name: string }>;
  attributeSelections: VariantAttrSelection[];
  savedAttributeName?: string;
  savedAttributeValue?: string;
  hasSerial: boolean;
  valuationMethod: string;
  trackingMethod: string;
  requestQty: number | null;
  remarks: string;
  minStock: number;
  maxStock: number;
  reorderLevel: number;
}

@Component({
  selector: 'app-inventory-purchase-requisition',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent],
  templateUrl: './purchase-requisition.html'
})
export class InventoryPurchaseRequisitionComponent extends InventoryScreenShell implements OnInit {
  override readonly config = purchaseRequisitionConfig;

  private readonly prDestroyRef = inject(DestroyRef);
  private readonly accessControl = inject(AccessControlService);

  // All active users — loaded on init for Requested By dropdown
  readonly prAllUsers = signal<UserResponse[]>([]);

  readonly prTodayDate = new Date();
  readonly prDetailModalOpen = signal(false);
  readonly prDetailRecord = signal<any | null>(null);
  readonly prDetailItems = signal<PrLineItem[]>([]);
  readonly prDetailError = signal('');
  readonly prDetailPriority = signal<string>('Medium');
  readonly prDetailRequiredBy = signal<Date | null>(null);
  readonly prDetailRemarks = signal<string>('');

  // ── Department options: pre-seeded, user can add new via addTag ────────────
  readonly prDepartmentOptions = signal<string[]>([
    'Admin', 'Accounts & Finance', 'Purchase', 'Sales', 'Marketing',
    'Production', 'Quality Control', 'Warehouse / Stores',
    'Kitchen', 'Housekeeping', 'IT', 'Maintenance', 'HR', 'Operations', 'Security'
  ]);

  addDepartmentTag = (name: string) => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    if (!this.prDepartmentOptions().some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      this.prDepartmentOptions.update(opts => [...opts, trimmed]);
    }
    return trimmed;
  };

  // ── Branch filtered by selected segment ─────────────────────────────────
  readonly prFilteredBranchOptions = computed((): string[] => {
    const segmentName = this.transactionSegmentValue();
    if (!segmentName) return [];
    return this.loadedBranchObjects()
      .filter(branch => this.prBranchMatchesSegment(branch, segmentName))
      .map(b => b.branch_name || b.branch_code)
      .filter(Boolean) as string[];
  });

  // ── Branch → selected branch object ─────────────────────────────────────
  readonly prSelectedBranch = computed((): BranchInvItem | null => {
    const name = this.formValues()['branch'];
    if (!name) return null;
    return this.prFindBranchBySelection(name);
  });

  // When branch changes, auto-fill Requested By with first user of that branch
  onPrBranchChange(branchName: string | null): void {
    this.collectFormField('branch', branchName);
    const branchObj = this.prFindBranchBySelection(branchName);
    const firstUser = branchObj ? this.prUsersForBranch(branchObj)[0] : null;
    this.collectFormField('requestedBy', firstUser?.fullName ?? null);
  }

  // Requested By options: users assigned to the selected branch (all active users if no branch)
  readonly prRequestedByOptions = computed((): string[] => {
    const branch = this.prSelectedBranch();
    return [...new Set(this.prUsersForBranch(branch).map(u => u.fullName).filter(Boolean))];
  });

  // Detail line below Requested By showing mobile / email from the selected user
  readonly prRequestedByDetail = computed((): string => {
    const selected = this.formValues()['requestedBy'] as string | undefined;
    if (!selected) return '';
    const user = this.prAllUsers().find(u => u.fullName === selected);
    if (!user) return '';
    const parts: string[] = [];
    if (user.mobile) parts.push(user.mobile);
    if (user.email) parts.push(user.email);
    return parts.join(' · ');
  });

  // ── Line items ─────────────────────────────────────────────────────────────
  readonly prLineItems = signal<PrLineItem[]>([this.newPrItem()]);

  private newPrItem(): PrLineItem {
    return {
      productId: null, product: '', productCode: '', description: '',
      uom: '', uomId: null, uomOptions: [],
      variantId: null, variant: '', variantOptions: [], attributeSelections: [],
      savedAttributeName: '', savedAttributeValue: '',
      hasSerial: false,
      valuationMethod: '', trackingMethod: '',
      requestQty: null, remarks: '',
      minStock: 0, maxStock: 0, reorderLevel: 0
    };
  }

  private buildVariantAttributeSelections(variantId: number | null): VariantAttrSelection[] {
    if (!variantId) return [];
    const variantObj = this.findVariantById(variantId);
    if (!variantObj?.attributes?.length) return [];
    const grouped = new Map<string, string[]>();
    for (const attr of variantObj.attributes) {
      const name = (attr.attribute_name || '').trim();
      const val  = (attr.attribute_value || '').trim();
      if (!name) continue;
      if (!grouped.has(name)) grouped.set(name, []);
      if (val && !grouped.get(name)!.includes(val)) grouped.get(name)!.push(val);
    }
    return Array.from(grouped.entries()).map(([name, options]) => ({
      name,
      options,
      value: options.length === 1 ? options[0] : '',
      isAuto: options.length <= 1
    }));
  }

  // ── Product names from API (segment-filtered via base class loadSegmentScopedLookups) ─
  readonly prProductNames = computed(() =>
    this.productNamesForTransaction('purchaseRequisition')
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  override ngOnInit(): void {
    super.ngOnInit();
    this.collectFormField('prDate', new Date());
    if (!this.formValues()['approvalStatus']) {
      this.collectFormField('approvalStatus', 'Draft');
    }
    // Load users for Requested By dropdown
    firstValueFrom(this.accessControl.getUsers())
      .then(res => {
        this.prAllUsers.set(res.data?.filter(u => u.status === 'active') ?? []);
        this.ensurePrRequestedByForBranch();
      })
      .catch(() => {});
  }

  // ── Product selection — auto-bind all master fields ───────────────────────
  onPrProductSelect(rowIndex: number, productName: string | null): void {
    const product: ProductItem | undefined = productName
      ? this.loadedProductObjects().find(p => p.product_name === productName)
      : undefined;

    this.prLineItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = product ? this.prLineItemFromProduct(product, updated[rowIndex]) : this.newPrItem();
      return updated;
    });
  }

  onPrVariantChange(rowIndex: number, variantId: number | null): void {
    this.prLineItems.update(rows => {
      const updated = [...rows];
      const row = updated[rowIndex];
      const option = row.variantOptions.find(o => o.id === variantId);
      const attributeSelections = this.buildVariantAttributeSelections(variantId);
      updated[rowIndex] = this.prApplyStockLimits({ ...row, variantId: variantId ?? null, variant: option?.variant_name ?? '', attributeSelections });
      return updated;
    });
  }

  onPrAttrChange(rowIndex: number, attrName: string, value: string | null): void {
    this.prLineItems.update(rows => {
      const updated = [...rows];
      const row = updated[rowIndex];
      updated[rowIndex] = this.prApplyStockLimits({
        ...row,
        attributeSelections: row.attributeSelections.map(a =>
          a.name === attrName ? { ...a, value: value || '' } : a
        )
      });
      return updated;
    });
  }

  onPrUomChange(rowIndex: number, uomName: string | null): void {
    const row = this.prLineItems()[rowIndex];
    const product = row.productId ? this.loadedProductObjects().find(p => p.id === row.productId) : null;
    const uomId = this.productUomIdForSelection(product, uomName, 'purchaseRequisition');
    this.prLineItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = { ...updated[rowIndex], uom: uomName || '', uomId };
      return updated;
    });
  }

  private buildTrackingLabel(p: ProductItem): string {
    const parts: string[] = [];
    if (p.serial_applicable) parts.push('Serial No.');
    if (p.batch_applicable)  parts.push('Batch');
    if (p.expiry_applicable) parts.push('Expiry');
    if (p.qc_required)       parts.push('QC');
    return parts.join(' + ');
  }

  private prAttributeSelectionText(row: PrLineItem): string {
    const selected = row.attributeSelections
      .filter(attr => String(attr.value || '').trim())
      .map(attr => `${attr.name}: ${String(attr.value || '').trim()}`);
    if (selected.length) return selected.join(' | ');
    return row.savedAttributeValue || '';
  }

  private prApplyStockLimits(row: PrLineItem): PrLineItem {
    const product = row.productId ? this.loadedProductObjects().find(p => Number(p.id) === Number(row.productId)) : null;
    const limits = this.productStockLimitsForLine(product, row.variantId, this.prAttributeSelectionText(row));
    return {
      ...row,
      minStock: limits.minStock,
      maxStock: limits.maxStock,
      reorderLevel: limits.reorderLevel
    };
  }

  prStockInfo(row: PrLineItem): string {
    if (!row.product) return '';
    const product = row.productId ? this.loadedProductObjects().find(p => p.id === row.productId) : null;
    const factor = this.prUomConversionFactor(product, row.uomId, row.uom);
    const fmt = (n: number) => factor > 1 ? String(Math.round((n / factor) * 100) / 100) : String(n);
    const uomLabel = row.uom ? ` ${row.uom}` : '';
    return `Min: ${fmt(row.minStock)} | Max: ${fmt(row.maxStock)} | Reorder: ${fmt(row.reorderLevel)}${uomLabel}`;
  }

  private prUomConversionFactor(product: any, uomId: number | null, uomName: string): number {
    if (!product?.uom_conversions?.length) return 1;
    const eq = (a: any) => String(a || '').trim().toLowerCase() === String(uomName || '').trim().toLowerCase();
    const isBase = eq(product.base_uom_name) || eq(product.base_uom_symbol)
      || (uomId != null && uomId === Number(product.base_uom_id));
    if (isBase) return 1;
    const conv = product.uom_conversions.find((c: any) =>
      (uomId != null && c.from_uom_id != null && Number(c.from_uom_id) === Number(uomId))
      || eq(c.from_uom_name) || eq(c.from_uom_symbol) || eq(c.alt_uom_name) || eq(c.alt_uom)
    );
    return Number(conv?.conversion_factor) > 0 ? Number(conv.conversion_factor) : 1;
  }

  // Returns a warning string if the entered qty violates master stock limits
  prQtyWarning(row: PrLineItem): string {
    const qty = row.requestQty ?? 0;
    if (!row.product || qty <= 0) return '';
    if (!(row.maxStock > 0)) return 'Max stock not configured';
    const product = row.productId ? this.loadedProductObjects().find(p => p.id === row.productId) : null;
    const factor = this.prUomConversionFactor(product, row.uomId, row.uom);
    const maxInUom = factor > 1 ? Math.round((row.maxStock / factor) * 100) / 100 : row.maxStock;
    const reorderInUom = factor > 1 ? Math.round((row.reorderLevel / factor) * 100) / 100 : row.reorderLevel;
    if (row.maxStock > 0 && qty > maxInUom) {
      return `Exceeds max stock limit (${maxInUom} ${row.uom})`;
    }
    if (row.reorderLevel > 0 && qty < reorderInUom) {
      return `Below reorder level (${reorderInUom} ${row.uom}) — consider requesting at least ${reorderInUom}`;
    }
    return '';
  }

  prQtyWarnClass(row: PrLineItem): string {
    const qty = row.requestQty ?? 0;
    if (!row.product || qty <= 0) return '';
    if (!(row.maxStock > 0)) return 'inventory-hint-error';
    const product = row.productId ? this.loadedProductObjects().find(p => p.id === row.productId) : null;
    const factor = this.prUomConversionFactor(product, row.uomId, row.uom);
    const maxInUom = factor > 1 ? Math.round((row.maxStock / factor) * 100) / 100 : row.maxStock;
    const reorderInUom = factor > 1 ? Math.round((row.reorderLevel / factor) * 100) / 100 : row.reorderLevel;
    if (row.maxStock > 0 && qty > maxInUom) return 'inventory-hint-error';
    if (row.reorderLevel > 0 && qty < reorderInUom) return 'inventory-hint-warn';
    return '';
  }

  private prStockLimitInSelectedUom(row: PrLineItem, value: number): number {
    const product = row.productId ? this.loadedProductObjects().find(p => p.id === row.productId) : null;
    const factor = this.prUomConversionFactor(product, row.uomId, row.uom);
    return factor > 1 ? Math.round((value / factor) * 100) / 100 : value;
  }

  // ── Row editing ────────────────────────────────────────────────────────────
  updatePrField<K extends keyof PrLineItem>(rowIndex: number, field: K, value: PrLineItem[K]): void {
    this.prLineItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  }

  addPrRow(): void {
    this.prLineItems.update(rows => [...rows, this.newPrItem()]);
  }

  removePrRow(index: number): void {
    if (this.prLineItems().length > 1) {
      this.prLineItems.update(rows => rows.filter((_, i) => i !== index));
    }
  }

  clearPrRow(index: number): void {
    this.prLineItems.update(rows => {
      const updated = [...rows];
      updated[index] = this.newPrItem();
      return updated;
    });
  }

  openSavedPrItemsByRow(row: string[]): void {
    const record = this.savedRecordObjects().find(r => r.pr_number === row[0] || r.prNumber === row[0]);
    if (!record) return;

    const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Medium';
    const items = (record.items || []).map((item: any) => this.prLineItemFromSavedItem(item));
    this.prDetailRecord.set(record);
    this.prDetailItems.set(items.length ? items : [this.newPrItem()]);
    this.prDetailPriority.set(cap(record.priority || 'medium'));
    this.prDetailRequiredBy.set(record.required_by ? new Date(record.required_by) : null);
    this.prDetailRemarks.set(record.remarks || '');
    this.prDetailError.set('');
    this.prDetailModalOpen.set(true);
  }

  closePrDetailModal(): void {
    this.prDetailModalOpen.set(false);
    this.prDetailRecord.set(null);
    this.prDetailItems.set([]);
    this.prDetailPriority.set('Medium');
    this.prDetailRequiredBy.set(null);
    this.prDetailRemarks.set('');
    this.prDetailError.set('');
  }

  readonly prDetailTitle = computed(() => {
    const record = this.prDetailRecord();
    return record?.pr_number || record?.prNumber || 'Saved PR';
  });

  readonly prDetailStatus = computed(() => {
    const s = String(this.prDetailRecord()?.status || 'draft');
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  readonly prDetailCanApprove = computed(() => {
    const s = (this.prDetailRecord()?.status || '').toLowerCase().replace(/\s+/g, '');
    return !!this.prDetailRecord() && s !== 'approved' && s !== 'cancelled';
  });

  readonly prDetailCanCancel = computed(() => {
    const s = (this.prDetailRecord()?.status || '').toLowerCase().replace(/\s+/g, '');
    return !!this.prDetailRecord() && s !== 'cancelled';
  });

  onPrDetailEdit(): void {
    const record = this.prDetailRecord();
    if (!record) return;
    const prNo = record.pr_number || record.prNumber || '';
    this.closePrDetailModal();
    this.editRecordByRow([prNo]);
  }

  onPrDetailApprove(): void {
    const record = this.prDetailRecord();
    if (!record) return;
    const prNo = record.pr_number || record.prNumber || '';
    this.closePrDetailModal();
    this.approvePrByRow([prNo]);
  }

  onPrDetailCancel(): void {
    const record = this.prDetailRecord();
    if (!record) return;
    const prNo = record.pr_number || record.prNumber || '';
    this.closePrDetailModal();
    this.cancelPurchaseRecordByRow([prNo]);
  }

  updatePrDetailField<K extends keyof PrLineItem>(rowIndex: number, field: K, value: PrLineItem[K]): void {
    this.prDetailItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = { ...updated[rowIndex], [field]: value };
      return updated;
    });
  }

  onPrDetailProductSelect(rowIndex: number, productName: string | null): void {
    const product: ProductItem | undefined = productName
      ? this.loadedProductObjects().find(p => p.product_name === productName)
      : undefined;

    this.prDetailItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = product ? this.prLineItemFromProduct(product, updated[rowIndex]) : this.newPrItem();
      return updated;
    });
  }

  onPrDetailUomChange(rowIndex: number, uomName: string | null): void {
    const row = this.prDetailItems()[rowIndex];
    const product = row.productId ? this.loadedProductObjects().find(p => p.id === row.productId) : null;
    const uomId = this.productUomIdForSelection(product, uomName, 'purchaseRequisition');
    this.prDetailItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = { ...updated[rowIndex], uom: uomName || '', uomId };
      return updated;
    });
  }

  onPrDetailVariantChange(rowIndex: number, variantId: number | null): void {
    this.prDetailItems.update(rows => {
      const updated = [...rows];
      const row = updated[rowIndex];
      const option = row.variantOptions.find(o => o.id === variantId);
      const attributeSelections = this.buildVariantAttributeSelections(variantId);
      updated[rowIndex] = this.prApplyStockLimits({ ...row, variantId: variantId ?? null, variant: option?.variant_name ?? '', attributeSelections });
      return updated;
    });
  }

  onPrDetailAttrChange(rowIndex: number, attrName: string, value: string | null): void {
    this.prDetailItems.update(rows => {
      const updated = [...rows];
      const row = updated[rowIndex];
      updated[rowIndex] = this.prApplyStockLimits({
        ...row,
        attributeSelections: row.attributeSelections.map(a =>
          a.name === attrName ? { ...a, value: value || '' } : a
        )
      });
      return updated;
    });
  }

  addPrDetailRow(): void {
    this.prDetailItems.update(rows => [...rows, this.newPrItem()]);
  }

  clearPrDetailRow(index: number): void {
    this.prDetailItems.update(rows => {
      const updated = [...rows];
      updated[index] = this.newPrItem();
      return updated;
    });
  }

  removePrDetailRow(index: number): void {
    this.prDetailItems.update(rows => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [this.newPrItem()];
    });
  }

  savePrDetailItems(): void {
    const record = this.prDetailRecord();
    if (!record?.id || this.isSaving()) return;

    const validItems = this.prDetailItems().filter(item => item.product && (item.requestQty ?? 0) > 0);
    if (!validItems.length) {
      this.prDetailError.set('Add at least one product with Request Qty greater than 0.');
      return;
    }

    const payload = {
      id: record.id,
      segment_id: record.segment_id ?? record.segmentId ?? null,
      segment_name: record.segment_name || record.segmentName || null,
      branch_id: this.prBranchIdFromRecord(record),
      pr_number: record.pr_number || record.prNumber || null,
      pr_date: record.pr_date || record.prDate || null,
      department: record.department || null,
      requested_by: record.requested_by || record.requestedBy || null,
      required_by: this.prDetailRequiredBy() ? (this.prDetailRequiredBy() as Date).toISOString().split('T')[0] : (record.required_by || record.requiredBy || null),
      priority: (this.prDetailPriority() || 'medium').toLowerCase(),
      remarks: this.prDetailRemarks() || null,
      status: record.status || 'draft',
      items: validItems.map((item, index) => {
        const allAttrs = this.prAttributePayloadParts(item);
        return {
          sno: index + 1,
          product_id:      item.productId,
          product_name:    item.product,
          product_code:    item.productCode || null,
          variant_id:      item.variantId ?? null,
          variant_name:    this.prVariantPayloadName(item),
          uom_id:          item.uomId || null,
          uom_name:        item.uom || null,
          attribute_name:  null,
          attribute_value: allAttrs.join(' | ') || null,
          required_qty:    item.requestQty ?? 0,
          estimated_rate:  null,
          remarks:         item.remarks || item.description || null
        };
      })
    };

    this.isSaving.set(true);
    this.prDetailError.set('');
    this.txService.savePurchaseRequisition(payload, Number(record.id))
      .pipe(takeUntilDestroyed(this.prDestroyRef))
      .subscribe({
        next: res => {
          this.isSaving.set(false);
          if (!res.success || !res.data) {
            this.prDetailError.set(res.message || 'Unable to update requested items.');
            return;
          }

          this.savedRecordObjects.update(records => records.map(item => Number(item.id) === Number(res.data?.id) ? res.data : item));
          this.saveMsg.set('Requested items updated.');
          this.closePrDetailModal();
          this.loadApiRecords();
          setTimeout(() => this.saveMsg.set(''), 3000);
        },
        error: err => {
          this.isSaving.set(false);
          this.prDetailError.set(this.apiErrorMessage(err, 'Unable to update requested items.'));
        }
      });
  }

  private prLineItemFromSavedItem(item: any): PrLineItem {
    const productName = item.product_name || item.productName || '';
    const product = this.loadedProductObjects().find(p =>
      p.id === (item.product_id ?? item.productId) || p.product_name === productName
    );
    const row = product ? this.prLineItemFromProduct(product) : this.newPrItem();
    const savedVariantId = this.prNormalizeId(item.variant_id ?? item.variantId);
    let attributeSelections = this.buildVariantAttributeSelections(savedVariantId ? Number(savedVariantId) : null);
    const savedAttrName  = (item.attribute_name  || item.attributeName  || '').trim();
    const savedAttrValue = (item.attribute_value || item.attributeValue || '').trim();
    attributeSelections = this.prApplySavedAttributes(attributeSelections, savedAttrName, savedAttrValue);
    const variantName = item.variant_name || item.variantName || this.prVariantNameForId(savedVariantId) || '';

    return this.prApplyStockLimits({
      ...row,
      productId:           item.product_id ?? item.productId ?? row.productId,
      product:             product?.product_name || productName,
      productCode:         item.product_code || item.productCode || row.productCode,
      description:         item.description || product?.description || '',
      uom:                 item.uom_name || item.uomName || row.uom,
      uomId:               item.uom_id ?? item.uomId ?? row.uomId,
      variantId:           savedVariantId,
      variant:             variantName,
      attributeSelections,
      savedAttributeName:   savedAttrName,
      savedAttributeValue:  this.prSavedAttributePayloadValue(savedAttrName, savedAttrValue),
      requestQty:          Number(item.required_qty ?? item.requiredQty ?? 0) || null,
      remarks:             item.remarks || ''
    });
  }

  private prNormalizeId(value: any): number | null {
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private prVariantNameForId(variantId: number | null): string {
    if (!variantId) return '';
    return this.findVariantById(Number(variantId))?.variant_name || '';
  }

  private prVariantPayloadName(item: PrLineItem): string | null {
    return item.variant || this.prVariantNameForId(item.variantId) || null;
  }

  private prSavedAttributePayloadValue(name: string, value: string): string {
    if (!value) return '';
    if (value.includes(':') || value.includes('|') || !name) return value;
    return `${name}: ${value}`;
  }

  private prParseSavedAttributeMap(name: string, value: string): Map<string, string> {
    const mapped = new Map<string, string>();
    const rawValue = value.trim();
    const rawName = name.trim();
    if (!rawValue) return mapped;

    for (const part of rawValue.split('|').map(x => x.trim()).filter(Boolean)) {
      const idx = part.indexOf(':');
      if (idx > -1) {
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key && val) mapped.set(this.prLooseKey(key), val);
      }
    }

    if (!mapped.size && rawName) {
      mapped.set(this.prLooseKey(rawName), rawValue);
    }

    return mapped;
  }

  private prApplySavedAttributes(selections: VariantAttrSelection[], name: string, value: string): VariantAttrSelection[] {
    if (!value) return selections;
    const mapped = this.prParseSavedAttributeMap(name, value);

    if (!selections.length) {
      const fallbackName = name || 'Attribute';
      return [{
        name: fallbackName,
        value: this.prSavedAttributePayloadValue(name, value),
        options: [this.prSavedAttributePayloadValue(name, value)],
        isAuto: true
      }];
    }

    if (!mapped.size && selections.length === 1) {
      return selections.map(attr => ({ ...attr, value }));
    }

    return selections.map(attr => {
      const saved = mapped.get(this.prLooseKey(attr.name));
      return saved ? { ...attr, value: saved } : attr;
    });
  }

  private prAttributePayloadParts(item: PrLineItem): string[] {
    const selected = item.attributeSelections
      .filter(a => a.value && a.value.trim())
      .map(a => `${a.name}: ${a.value.trim()}`);
    if (item.savedAttributeValue && selected.length === 1) {
      const attrName = item.attributeSelections[0]?.name || '';
      if (selected[0] === item.savedAttributeValue || selected[0] === `${attrName}: ${item.savedAttributeValue}`) {
        return [item.savedAttributeValue];
      }
    }
    if (selected.length) return selected;
    return item.savedAttributeValue ? [item.savedAttributeValue] : [];
  }

  private prLineItemFromProduct(product: ProductItem, existing?: PrLineItem): PrLineItem {
    const purchaseUom = this.defaultProductUomForTransaction(product, 'purchaseRequisition');
    return this.prApplyStockLimits({
      ...(existing || this.newPrItem()),
      productId:           product.id,
      product:             product.product_name,
      productCode:         product.product_code || '',
      description:         product.description || existing?.description || '',
      uom:                 purchaseUom.name,
      uomId:               purchaseUom.id,
      uomOptions:          this.productUomOptionsForTransaction(product, 'purchaseRequisition'),
      variantId:           null,
      variant:             '',
      variantOptions:      this.productVariantOptionObjects(product),
      attributeSelections: [],
      hasSerial:           !!product.serial_applicable,
      valuationMethod:     product.valuation_method || '',
      trackingMethod:      this.buildTrackingLabel(product),
      minStock:            product.min_stock_level ?? 0,
      maxStock:            product.max_stock_level ?? 0,
      reorderLevel:        product.reorder_level ?? 0
    });
  }

  private prBranchIdFromRecord(record: any): number | null {
    const rawId = Number(record.branch_id ?? record.branchId);
    const branchName = String(record.branch_name || record.branchName || '').trim();
    const branch = this.loadedBranchObjects().find(item =>
      (Number.isFinite(rawId) && rawId > 0 && (Number(item.branch_id) === rawId || Number(item.id) === rawId))
      || (!!branchName && item.branch_name === branchName)
    );
    const branchId = Number(branch?.branch_id ?? rawId);
    return Number.isFinite(branchId) && branchId > 0 ? branchId : null;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  savePr(): void {
    if (this.isSaving()) return;
    const v = this.formValues();
    this.saveError.set('');
    this.saveMsg.set('');

    if (!v['segment'])    { this.saveError.set('Business Segment is required.');  return; }
    if (!v['department']) { this.saveError.set('Department is required.'); return; }

    const validItems = this.prLineItems().filter(r => r.product && (r.requestQty ?? 0) > 0);
    if (!validItems.length) {
      this.saveError.set('Add at least one product with Request Qty greater than 0.');
      return;
    }

    // Block if any row exceeds the master max stock limit
    const missingMax = validItems.find(r => !(r.maxStock > 0));
    if (missingMax) {
      this.saveError.set(`"${missingMax.product}": Max stock is not configured in Product Master. Set Max Stock before procurement.`);
      return;
    }

    const overMax = validItems.find(r => r.maxStock > 0 && (r.requestQty ?? 0) > this.prStockLimitInSelectedUom(r, r.maxStock));
    if (overMax) {
      const maxInUom = this.prStockLimitInSelectedUom(overMax, overMax.maxStock);
      this.saveError.set(
        `"${overMax.product}": Request Qty (${overMax.requestQty}) exceeds max stock limit (${maxInUom} ${overMax.uom}). Reduce the qty before saving.`
      );
      return;
    }

    // Expose valid items for the purchasePrItems() override, then call base save
    this._validPrItems = validItems;
    this.saveConfigRecord();
  }

  private _validPrItems: PrLineItem[] = [];

  protected override purchasePrItems(): any[] {
    return this._validPrItems.map((item, index) => {
      const allAttrs = this.prAttributePayloadParts(item);
      return {
        sno: index + 1,
        product_id:     item.productId,
        product_name:   item.product,
        product_code:   item.productCode || null,
        variant_id:     item.variantId ?? null,
        variant_name:   this.prVariantPayloadName(item),
        uom_id:         item.uomId || null,
        uom_name:       item.uom || null,
        attribute_name:  null,
        attribute_value: allAttrs.join(' | ') || null,
        required_qty:   item.requestQty ?? 0,
        estimated_rate: null,
        remarks:        item.remarks || item.description || null,
      };
    });
  }

  protected override validatePrRequestedBy(payload: Record<string, any>): string {
    const requested = String(payload['requested_by'] ?? '').trim();
    if (!requested) return 'Requested By is required for Purchase Requisition.';
    const branch = this.prSelectedBranch();
    const eligible = this.prUsersForBranch(branch);
    if (!eligible.some(u => u.fullName === requested)) {
      return 'Requested By must be a user assigned to the selected Branch.';
    }
    return '';
  }

  private prLooseKey(value: any): string {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private prBranchMatchesSegment(branch: BranchInvItem, segmentName: string): boolean {
    return this.prLooseKey(branch.segment_name) === this.prLooseKey(segmentName);
  }

  private prFindBranchBySelection(value: any): BranchInvItem | null {
    const key = this.prLooseKey(value);
    if (!key) return null;
    return this.loadedBranchObjects().find(branch =>
      this.prLooseKey(branch.branch_name) === key
      || this.prLooseKey(branch.branch_code) === key
    ) ?? null;
  }

  private prBranchIds(branch: BranchInvItem | null): number[] {
    return [branch?.branch_id, branch?.id]
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0);
  }

  private prUserBelongsToBranch(user: UserResponse, branch: BranchInvItem | null): boolean {
    if (!branch) return true;
    const branchIds = this.prBranchIds(branch);
    const branchKeys = new Set(
      [branch.branch_name, branch.branch_code]
        .map(value => this.prLooseKey(value))
        .filter(Boolean)
    );

    return (user.branches || []).some(userBranch => {
      const raw = userBranch as any;
      const userBranchId = Number(raw.id ?? raw.branchId ?? raw.branch_id);
      const userBranchKeys = [
        raw.branchName,
        raw.branch_name,
        raw.branchCode,
        raw.branch_code
      ].map(value => this.prLooseKey(value)).filter(Boolean);

      return (Number.isFinite(userBranchId) && branchIds.includes(userBranchId))
        || userBranchKeys.some(key => branchKeys.has(key));
    });
  }

  private prUsersForBranch(branch: BranchInvItem | null): UserResponse[] {
    const users = this.prAllUsers();
    return branch ? users.filter(user => this.prUserBelongsToBranch(user, branch)) : users;
  }

  private ensurePrRequestedByForBranch(): void {
    const branch = this.prSelectedBranch();
    if (!branch) return;
    const users = this.prUsersForBranch(branch);
    const current = String(this.formValues()['requestedBy'] || '').trim();
    if (users.some(user => user.fullName === current)) return;
    this.collectFormField('requestedBy', users[0]?.fullName ?? null);
  }

  // Clear PR rows when form resets after save
  override clearConfigForm(): void {
    super.clearConfigForm();
    this._validPrItems = [];
    this.prLineItems.set([this.newPrItem()]);
    this.collectFormField('prDate', new Date());
    this.collectFormField('approvalStatus', 'Draft');
  }

  // ── Saved PR grid: row expand + approve ───────────────────────────────────
  readonly expandedPrId = signal<number | null>(null);
  readonly approvingPrId = signal<number | null>(null);

  private findSavedPrByRow(row: string[]): any {
    return this.savedRecordObjects().find(r => r.pr_number === row[0] || r.prNumber === row[0]);
  }

  private prSavedStatusKey(row: string[]): string {
    const record = this.findSavedPrByRow(row);
    const statusIndex = Math.max((this.config.columns?.length || 1) - 1, 0);
    return this.prLooseKey(record?.status || row[statusIndex] || row[row.length - 1] || '');
  }

  isApprovedPr(row: string[]): boolean {
    return this.prSavedStatusKey(row) === 'approved';
  }

  isCancelledPr(row: string[]): boolean {
    return this.prSavedStatusKey(row) === 'cancelled';
  }

  prApproveActionTitle(row: string[]): string {
    if (this.isApprovedPr(row)) return 'PR approved';
    if (this.isCancelledPr(row)) return 'Approval unavailable for cancelled PR';
    return 'Approve PR';
  }

  prCancelActionTitle(row: string[]): string {
    return this.canCancelPurchaseRow(row) ? 'Cancel PR' : 'Cancel unavailable';
  }

  getRecordId(row: string[]): number | null {
    const record = this.findSavedPrByRow(row);
    return record?.id ? Number(record.id) : null;
  }

  toggleExpandPr(row: string[]): void {
    const record = this.findSavedPrByRow(row);
    if (!record?.id) return;
    const id = Number(record.id);
    this.expandedPrId.update(cur => (cur === id ? null : id));
  }

  isExpandedPr(row: string[]): boolean {
    const record = this.findSavedPrByRow(row);
    return !!record?.id && this.expandedPrId() === Number(record.id);
  }

  getPrExpandedItems(row: string[]): any[] {
    return this.findSavedPrByRow(row)?.items || [];
  }

  prItemVariantText(item: any): string {
    const stored = item?.variant_name || item?.variantName || item?.variant_label || item?.variantLabel;
    if (stored) return stored;
    const variantId = item?.variant_id ?? item?.variantId;
    if (variantId) {
      const master = this.findVariantById(Number(variantId));
      if (master?.variant_name) return master.variant_name;
    }
    return '-';
  }

  prItemAttributeText(item: any): string {
    const name = String(item?.attribute_name || item?.attributeName || '').trim();
    const value = String(item?.attribute_value || item?.attributeValue || '').trim();
    if (name && value) return `${name}: ${value}`;
    return name || value || '-';
  }

  prItemAllAttributesText(item: any): string {
    const savedValue = String(item?.attribute_value || item?.attributeValue || '').trim();
    const savedName  = String(item?.attribute_name  || item?.attributeName  || '').trim();
    // Old format: name + value stored separately → "Color: Red"
    if (savedValue && savedName) return `${savedName}: ${savedValue}`;
    // New format: combined string stored in value → "Model: XMS | Color: Red"
    if (savedValue) return savedValue;
    if (savedName) return savedName;
    // Fallback: compute from variant master
    const variantId = item?.variant_id ?? item?.variantId ?? null;
    if (!variantId) return '—';
    const attrs = this.buildVariantAttributeSelections(Number(variantId));
    const parts = attrs.filter(a => a.value).map(a => `${a.name}: ${a.value}`);
    return parts.length ? parts.join(' | ') : '—';
  }

  canApprovePr(row: string[]): boolean {
    const record = this.findSavedPrByRow(row);
    if (!record?.id) return false;
    const status = (record.status || '').toLowerCase().replace(/\s+/g, '');
    return status !== 'approved' && status !== 'cancelled';
  }

  approvePrByRow(row: string[]): void {
    const record = this.findSavedPrByRow(row);
    if (!record?.id) return;
    const id = Number(record.id);
    this.approvingPrId.set(id);
    const payload = {
      id,
      segment_id: record.segment_id ?? null,
      segment_name: record.segment_name ?? null,
      pr_number: record.pr_number ?? null,
      pr_date: record.pr_date ?? null,
      department: record.department ?? null,
      requested_by: record.requested_by ?? null,
      required_by: record.required_by ?? null,
      priority: record.priority ?? 'medium',
      remarks: record.remarks ?? null,
      status: 'approved',
      items: (record.items || []).map((item: any, idx: number) => ({
        sno: idx + 1,
        product_id: item.product_id ?? item.productId ?? null,
        product_name: item.product_name ?? item.productName ?? null,
        product_code: item.product_code ?? item.productCode ?? null,
        variant_id: item.variant_id ?? item.variantId ?? null,
        variant_name: item.variant_name ?? item.variantName ?? null,
        uom_id: item.uom_id ?? item.uomId ?? null,
        uom_name: item.uom_name ?? item.uomName ?? null,
        attribute_id: item.attribute_id ?? item.attributeId ?? null,
        attribute_name: item.attribute_name ?? item.attributeName ?? null,
        attribute_value: item.attribute_value ?? item.attributeValue ?? null,
        required_qty: item.required_qty ?? item.requiredQty ?? 0,
        estimated_rate: item.estimated_rate ?? item.estimatedRate ?? null,
        remarks: item.remarks ?? null
      }))
    };
    this.txService.savePurchaseRequisition(payload, id)
      .pipe(takeUntilDestroyed(this.prDestroyRef))
      .subscribe({
        next: res => {
          this.approvingPrId.set(null);
          if (res.success) {
            this.savedRecordObjects.update(records =>
              records.map(item => Number(item.id) === id ? { ...item, status: 'approved' } : item)
            );
            this.saveMsg.set('PR approved.');
            this.loadApiRecords();
            setTimeout(() => this.saveMsg.set(''), 3000);
          } else {
            this.saveError.set(res.message || 'Approve failed.');
          }
        },
        error: err => {
          this.approvingPrId.set(null);
          this.saveError.set(this.apiErrorMessage(err, 'Approve failed.'));
        }
      });
  }
}
