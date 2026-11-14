import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { forkJoin, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { InventoryConfigService, ProductItem, VendorItem } from '../../Inventory_Shared/inventory-config.service';
import { PurchaseOrder, PurchaseRequisition, PrItem } from '../../Inventory_Shared/inventory-transactions.service';
import { requestForQuotationConfig } from '../../Inventory_Shared/inventory-screen.model';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';

interface VariantAttrSelection {
  name: string;
  value: string;
  options: string[];
  isAuto: boolean;
}

interface RfqLineItem {
  productId: number | null;
  product: string;
  productCode: string;
  description: string;
  variantId: number | null;
  variant: string;
  variantOptions: Array<{ id: number; label: string; variant_name: string }>;
  attributeId: number | null;
  attributeName: string;
  attributeValue: string;
  attributeSelections: VariantAttrSelection[];
  qty: number | null;
  uomId: number | null;
  uom: string;
  uomOptions: string[];
  currentStock: number | null;
  reorderLevel: number;
  targetRate: number | null;
  vendorRate: number | null;
  gstRate: number | null;
  gstInclusive: boolean;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  leadTime: string;
  remarks: string;
}

interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

interface RfqVendorTrackRow {
  vendorName: string;
  vendorCode: string;
  email: string;
  gstin: string;
  status: string;
  link: string;
  sentAt: string;
  receivedAt: string;
  record: any | null;
}

interface RfqComparisonGroup {
  key: string;
  label: string;
  count: number;
}

interface RfqRecordGroup {
  key: string;
  prRef: string;
  source: string;
  date: string;
  records: any[];
}

interface RfqComparisonRow {
  record: any;
  vendorName: string;
  currency: string;
  total: number;
  taxAmount: number;
  leadDays: number | null;
  status: string;
  notes: string;
}

interface QuotationLineEntry {
  itemIndex: number;
  productName: string;
  variantName: string;
  qty: number;
  uom: string;
  vendorRate: number | null;
  gstInclusive: boolean;
  gstRate: number | null;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  leadTime: string;
}

type RfqSourceMode = 'pr' | 'direct';

@Component({
  selector: 'app-inventory-request-for-quotation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent],
  templateUrl: './request-for-quotation.html'
})
export class InventoryRequestForQuotationComponent extends InventoryScreenShell implements OnInit {
  override readonly config = requestForQuotationConfig;

  private readonly rfqDestroyRef = inject(DestroyRef);
  private readonly rfqConfigService = inject(InventoryConfigService);

  readonly rfqTodayDate = new Date();
  readonly approvedPrs = signal<PurchaseRequisition[]>([]);
  readonly approvedPrLoading = signal(false);
  readonly rfqVendorRecords = signal<VendorItem[]>([]);
  readonly prPickerOpen = signal(false);
  readonly selectedPr = signal<PurchaseRequisition | null>(null);
  readonly expandedPrId = signal<number | null>(null);
  readonly rfqItems = signal<RfqLineItem[]>([]);
  readonly rfqSourceMode = signal<RfqSourceMode>('direct');
  readonly selectedVendorNames = signal<string[]>([]);
  readonly currencyMenuOpen = signal(false);
  readonly selectedCurrency = signal<CurrencyOption>({ code: 'INR', symbol: '\u20b9', label: 'Indian Rupee' });
  readonly selectedComparisonGroup = signal('');
  readonly poConfirmRecord = signal<any | null>(null);
  readonly poDraftLoading = signal(false);
  readonly poPreviewOpen = signal(false);
  readonly poPreviewRecord = signal<any | null>(null);

  readonly quotationPopupOpen = signal(false);
  readonly quotationPopupRecord = signal<any | null>(null);
  readonly quotationGroupRecords = signal<any[]>([]);
  readonly quotationLines = signal<QuotationLineEntry[]>([]);
  readonly quotationReceivedDate = signal<Date>(new Date());
  readonly quotationRef = signal('');
  readonly quotationNotes = signal('');
  readonly quotationSaving = signal(false);

  readonly currencyOptions: CurrencyOption[] = [
    { code: 'INR', symbol: '\u20b9', label: 'Indian Rupee' },
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'EUR', symbol: '\u20ac', label: 'Euro' },
    { code: 'GBP', symbol: '\u00a3', label: 'British Pound' },
    { code: 'AED', symbol: 'AED', label: 'UAE Dirham' }
  ];

  readonly rfqRecords = computed(() => {
    const segId = this.currentSegmentId;
    return this.savedRecordObjects().filter(record => {
      const recordSegId = Number(record.segment_id ?? record.segmentId);
      return !segId || !Number.isFinite(recordSegId) || recordSegId === segId;
    });
  });

  readonly rfqProductNames = computed(() =>
    this.productNamesForTransaction('requestForQuotation')
  );

  readonly rfqGroupedRecords = computed<RfqRecordGroup[]>(() => {
    const map = new Map<string, RfqRecordGroup>();
    for (const record of this.rfqRecords()) {
      const key = this.rfqGroupKey(record);
      if (map.has(key)) {
        map.get(key)!.records.push(record);
      } else {
        map.set(key, {
          key,
          prRef: record.pr_number || record.prNumber || '',
          source: record.source_type || record.sourceType || (record.pr_number ? 'PR' : 'Direct'),
          date: record.rfq_date || '',
          records: [record]
        });
      }
    }
    return Array.from(map.values());
  });

  readonly rfqComparisonGroups = computed<RfqComparisonGroup[]>(() => {
    const map = new Map<string, RfqComparisonGroup>();
    for (const record of this.rfqRecords()) {
      const key = this.rfqGroupKey(record);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          label: this.rfqGroupLabel(record, key),
          count: 1
        });
      }
    }
    return Array.from(map.values());
  });

  readonly activeComparisonGroupKey = computed(() =>
    this.selectedComparisonGroup() || this.rfqComparisonGroups()[0]?.key || ''
  );

  readonly comparisonRecords = computed(() => {
    const key = this.activeComparisonGroupKey();
    if (!key) return [];
    return this.rfqRecords().filter(record => this.rfqGroupKey(record) === key && String(record.vendor_name || '').trim());
  });

  readonly comparisonRows = computed<RfqComparisonRow[]>(() =>
    this.comparisonRecords().map(record => ({
      record,
      vendorName: record.vendor_name || '-',
      currency: record.currency || 'INR',
      total: this.rfqRecordTotal(record),
      taxAmount: this.rfqRecordTaxAmount(record),
      leadDays: this.rfqRecordLeadDays(record),
      status: this.rfqStatusLabel(record.status),
      notes: record.negotiation_notes || record.negotiationNotes || ''
    })).sort((a, b) => (a.total > 0 && b.total > 0) ? a.total - b.total : 0)
  );

  readonly bestComparisonScore = computed(() => {
    const totals = this.comparisonRows().map(row => row.total).filter(t => t > 0);
    return totals.length ? Math.min(...totals) : null;
  });

  readonly worstComparisonScore = computed(() => {
    const totals = this.comparisonRows().map(row => row.total).filter(t => t > 0);
    return totals.length ? Math.max(...totals) : null;
  });

  readonly rfqVendorTrackingRows = computed<RfqVendorTrackRow[]>(() => {
    const names = this.rfqVendorNamesForTracking();
    return names.map(name => {
      const vendor = this.rfqVendorBySelection(name);
      const record = this.rfqRecordForVendor(name);
      return {
        vendorName: vendor?.vendor_name || name,
        vendorCode: vendor?.vendor_code || '-',
        email: vendor?.email || vendor?.contact_email || '-',
        gstin: vendor?.gstin || '-',
        status: record ? this.rfqStatusLabel(record.status) : 'Ready',
        link: record?.vendor_response_link || record?.vendorResponseLink || this.vendorResponseLinkFor(name, this.currentRfqGroupDraft()),
        sentAt: record?.sent_at || record?.sentAt || '-',
        receivedAt: record?.response_received_at || record?.responseReceivedAt || '-',
        record
      };
    });
  });

  override ngOnInit(): void {
    super.ngOnInit();
    this.ensureRfqDefaults();
    this.loadApprovedPrs();
    this.loadRfqVendors();
  }

  override onSegmentChangedByUser(segment: string): void {
    super.onSegmentChangedByUser(segment);
    this.loadApprovedPrs();
    this.loadRfqVendors();
    this.clearSelectedPr();
  }

  private ensureRfqDefaults(): void {
    const values = this.formValues();
    if (!values['rfqDate']) this.collectFormField('rfqDate', new Date());
    if (!values['status']) this.collectFormField('status', 'sent');
    if (!values['currency']) this.collectFormField('currency', this.selectedCurrency().code);
    if (!values['sendChannel']) this.collectFormField('sendChannel', 'Email');
    if (!this.rfqItems().length) this.rfqItems.set([this.newRfqItem()]);
  }

  private newRfqItem(): RfqLineItem {
    return {
      productId: null,
      product: '',
      productCode: '',
      description: '',
      variantId: null,
      variant: '',
      variantOptions: [],
      attributeId: null,
      attributeName: '',
      attributeValue: '',
      attributeSelections: [],
      qty: null,
      uomId: null,
      uom: '',
      uomOptions: [],
      currentStock: null,
      reorderLevel: 0,
      targetRate: null,
      vendorRate: null,
      gstRate: 0,
      gstInclusive: false,
      cgstRate: null,
      sgstRate: null,
      igstRate: null,
      leadTime: '',
      remarks: ''
    };
  }

  loadApprovedPrs(openPickerWhenAvailable = false): void {
    this.approvedPrLoading.set(true);
    this.txService.getPurchaseRequisitions('approved', this.currentSegmentId)
      .pipe(takeUntilDestroyed(this.rfqDestroyRef))
      .subscribe({
        next: res => {
          this.approvedPrLoading.set(false);
          const approved = res.success ? (res.data || []).filter(pr => this.rfqIsApproved(pr.status)) : [];
          this.approvedPrs.set(approved);
          if (openPickerWhenAvailable) {
            if (approved.length) {
              this.prPickerOpen.set(true);
            } else {
              this.prPickerOpen.set(false);
              this.rfqSourceMode.set('direct');
              this.clearSelectedPr();
            }
          }
        },
        error: err => {
          this.approvedPrLoading.set(false);
          this.approvedPrs.set([]);
          this.prPickerOpen.set(false);
          this.saveError.set(this.apiErrorMessage(err, 'Approved PRs could not be loaded.'));
        }
      });
  }

  private loadRfqVendors(): void {
    this.rfqConfigService.getVendors(this.currentSegmentId, true)
      .pipe(takeUntilDestroyed(this.rfqDestroyRef))
      .subscribe({
        next: res => this.rfqVendorRecords.set(res.success ? (res.data || []) : []),
        error: () => this.rfqVendorRecords.set([])
      });
  }

  openPrPicker(): void {
    this.rfqSourceMode.set('pr');
    this.prPickerOpen.set(false);
    this.loadApprovedPrs(true);
  }

  closePrPicker(): void {
    this.prPickerOpen.set(false);
  }

  togglePrExpand(pr: PurchaseRequisition): void {
    this.expandedPrId.update(current => current === pr.id ? null : pr.id);
  }

  isPrExpanded(pr: PurchaseRequisition): boolean {
    return this.expandedPrId() === pr.id;
  }

  selectPr(pr: PurchaseRequisition): void {
    this.rfqSourceMode.set('pr');
    this.selectedPr.set(pr);
    this.collectFormField('prId', pr.id);
    this.collectFormField('prReference', pr.pr_number);
    this.collectFormField('sourceType', 'PR');
    this.collectFormField('segmentId', pr.segment_id ?? null);
    if (pr.segment_name) this.collectFormField('segment', pr.segment_name);
    if (pr.required_by) this.collectFormField('estdDeliveryDate', new Date(pr.required_by));
    const items = (pr.items || []).map(item => this.rfqLineFromPrItem(item));
    this.rfqItems.set(items.length ? items : [this.newRfqItem()]);
    this.closePrPicker();
  }

  clearSelectedPr(): void {
    this.selectedPr.set(null);
    this.collectFormField('prId', null);
    this.collectFormField('prReference', '');
    this.collectFormField('sourceType', 'DIRECT');
    if (this.rfqSourceMode() === 'direct') this.rfqItems.set([this.newRfqItem()]);
  }

  onRfqVendorSelectionChange(value: string[] | string | null): void {
    const names = this.normalizeVendorNames(value);
    this.selectedVendorNames.set(names);
    const first = names[0] || '';
    const vendor = this.rfqVendorBySelection(first);
    this.collectFormField('vendor', vendor?.vendor_name || first || null);
    this.collectFormField('vendorId', vendor?.id ?? null);
    this.collectFormField('vendorGstin', vendor?.gstin || null);
    if (vendor?.payment_term_name && !this.formValues()['paymentTerms']) {
      this.collectFormField('paymentTerms', vendor.payment_term_name);
    }
  }

  onRfqProductSelect(rowIndex: number, productName: string | null): void {
    const product = this.rfqProductBySelection(productName);
    this.rfqItems.update(rows => {
      const updated = [...rows];
      updated[rowIndex] = product ? this.rfqLineFromProduct(product, updated[rowIndex]) : this.newRfqItem();
      return updated;
    });
  }

  onRfqUomChange(rowIndex: number, uomName: string | null): void {
    const row = this.rfqItems()[rowIndex];
    const product = row.productId ? this.loadedProductObjects().find(p => Number(p.id) === Number(row.productId)) : null;
    const uomId = this.productUomIdForSelection(product, uomName, 'requestForQuotation');
    this.updateRfqItem(rowIndex, 'uom', uomName || '');
    this.updateRfqItem(rowIndex, 'uomId', uomId);
  }

  onRfqVariantChange(rowIndex: number, variantId: number | null): void {
    this.rfqItems.update(rows => {
      const updated = [...rows];
      const row = updated[rowIndex];
      const option = row.variantOptions.find(item => Number(item.id) === Number(variantId));
      const attrs = this.buildVariantAttributeSelections(variantId);
      updated[rowIndex] = {
        ...row,
        variantId: variantId ?? null,
        variant: option?.variant_name || option?.label || '',
        attributeSelections: attrs,
        attributeName: attrs[0]?.name || row.attributeName || '',
        attributeValue: attrs.map(attr => attr.value ? `${attr.name}: ${attr.value}` : attr.name).filter(Boolean).join(' | ')
      };
      return updated;
    });
  }

  private rfqLineFromProduct(product: ProductItem, existing?: RfqLineItem): RfqLineItem {
    const purchaseUom = this.defaultProductUomForTransaction(product, 'requestForQuotation');
    const gstRate = Number(product.gst_rate ?? existing?.gstRate ?? 0) || 0;
    return {
      ...(existing || this.newRfqItem()),
      productId: product.id,
      product: product.product_name,
      productCode: product.product_code || product.sku || '',
      description: product.description || existing?.description || '',
      uom: purchaseUom.name,
      uomId: purchaseUom.id,
      uomOptions: this.productUomOptionsForTransaction(product, 'requestForQuotation'),
      variantId: null,
      variant: '',
      variantOptions: this.productVariantOptionObjects(product),
      attributeSelections: [],
      currentStock: null,
      reorderLevel: Number(product.reorder_level ?? 0),
      gstRate,
      cgstRate: gstRate ? gstRate / 2 : null,
      sgstRate: gstRate ? gstRate / 2 : null,
      igstRate: gstRate || null
    };
  }

  private rfqLineFromPrItem(item: PrItem): RfqLineItem {
    const product = this.loadedProductObjects().find(p =>
      Number(p.id) === Number(item.product_id) || this.rfqKey(p.product_name) === this.rfqKey(item.product_name)
    );
    const base = product ? this.rfqLineFromProduct(product) : this.newRfqItem();
    return {
      ...base,
      productId: item.product_id ?? base.productId,
      product: item.product_name || base.product,
      productCode: item.product_code || base.productCode,
      variantId: item.variant_id ?? null,
      variant: item.variant_name || '',
      attributeId: item.attribute_id ?? null,
      attributeName: item.attribute_name || '',
      attributeValue: item.attribute_value || '',
      qty: Number(item.required_qty || 0) || null,
      uomId: item.uom_id ?? base.uomId,
      uom: item.uom_name || base.uom,
      targetRate: item.estimated_rate ?? null,
      vendorRate: null,
      leadTime: '',
      remarks: item.remarks || ''
    };
  }

  private buildVariantAttributeSelections(variantId: number | null): VariantAttrSelection[] {
    if (!variantId) return [];
    const variantObj = this.findVariantById(variantId);
    if (!variantObj?.attributes?.length) return [];
    const grouped = new Map<string, string[]>();
    for (const attr of variantObj.attributes) {
      const name = (attr.attribute_name || '').trim();
      const val = (attr.attribute_value || '').trim();
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

  addRfqRow(): void {
    this.rfqItems.update(rows => [...rows, this.newRfqItem()]);
  }

  removeRfqRow(index: number): void {
    this.rfqItems.update(rows => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [this.newRfqItem()];
    });
  }

  clearRfqRow(index: number): void {
    this.rfqItems.update(rows => {
      const next = [...rows];
      next[index] = this.newRfqItem();
      return next;
    });
  }

  updateRfqItem<K extends keyof RfqLineItem>(index: number, key: K, value: RfqLineItem[K]): void {
    this.rfqItems.update(rows => {
      const next = [...rows];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  selectCurrency(option: CurrencyOption): void {
    this.selectedCurrency.set(option);
    this.collectFormField('currency', option.code);
    this.currencyMenuOpen.set(false);
  }

  currencySymbol(): string {
    return this.selectedCurrency().symbol;
  }

  rfqStockControlHint(item: RfqLineItem): string {
    return this.rfqStockControlState(item)?.message || '';
  }

  rfqStockControlHintClass(item: RfqLineItem): string {
    const state = this.rfqStockControlState(item);
    if (!state) return '';
    if (state.severity === 'error') return 'inventory-stock-hint inventory-hint-error';
    if (state.severity === 'warn') return 'inventory-stock-hint inventory-hint-warn';
    return 'inventory-stock-hint';
  }

  private rfqStockControlState(item: RfqLineItem): { message: string; severity: 'info' | 'warn' | 'error' } | null {
    const product = item.productId
      ? this.loadedProductObjects().find(p => Number(p.id) === Number(item.productId))
      : this.rfqProductBySelection(item.product);
    if (!product || product.tracks_inventory === false || product.is_service) return null;

    const limits = this.productStockLimitsForLine(product, item.variantId, this.rfqAttributeValueForPayload(item));
    const uom = String(item.uom || '').trim() || product.base_uom_name || product.base_uom_symbol || '';
    const factor = this.productUomConversionFactorForSelection(product, uom, 'requestForQuotation');
    const valueInUom = (value: number) => factor > 0 ? value / factor : value;
    const qty = Number(item.qty || 0);
    const fmt = (value: number) => this.rfqFormatStockQty(valueInUom(value));
    const uomLabel = uom ? ` ${uom}` : '';

    if (!(limits.maxStock > 0)) {
      return {
        message: 'Max stock not configured',
        severity: qty > 0 ? 'error' : 'warn'
      };
    }

    const hasLimits = [limits.minStock, limits.maxStock, limits.reorderLevel, limits.reorderQty].some(value => Number(value) > 0);
    if (!hasLimits) return null;

    if (qty > 0) {
      if (limits.maxStock > 0 && qty > valueInUom(limits.maxStock)) {
        return { message: `Above max ${fmt(limits.maxStock)}${uomLabel}`, severity: 'error' };
      }
      if (limits.minStock > 0 && qty < valueInUom(limits.minStock)) {
        return { message: `Below min ${fmt(limits.minStock)}${uomLabel}`, severity: 'warn' };
      }
      if (limits.reorderLevel > 0 && qty < valueInUom(limits.reorderLevel)) {
        return { message: `Below reorder ${fmt(limits.reorderLevel)}${uomLabel}`, severity: 'warn' };
      }
    }

    const parts: string[] = [];
    if (limits.minStock > 0) parts.push(`Min ${fmt(limits.minStock)}`);
    if (limits.maxStock > 0) parts.push(`Max ${fmt(limits.maxStock)}`);
    if (limits.reorderLevel > 0) parts.push(`Reorder ${fmt(limits.reorderLevel)}`);
    if (limits.reorderQty > 0) parts.push(`ROQ ${fmt(limits.reorderQty)}`);
    return parts.length ? { message: `${parts.join(' | ')}${uomLabel}`, severity: 'info' } : null;
  }

  private rfqFormatStockQty(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 1000) / 1000;
    return rounded.toLocaleString('en-IN', { maximumFractionDigits: 3 });
  }

  saveRfq(): void {
    if (this.isSaving()) return;
    this.saveError.set('');
    this.saveMsg.set('');

    const validItems = this.rfqItems().filter(item => item.product && Number(item.qty || 0) > 0);
    if (!validItems.length) {
      this.saveError.set('Add at least one RFQ item with quantity greater than 0.');
      return;
    }

    const stockBlocked = validItems.find(item => this.rfqStockControlState(item)?.severity === 'error');
    if (stockBlocked) {
      const hint = this.rfqStockControlHint(stockBlocked);
      const action = hint === 'Max stock not configured'
        ? 'Set Max Stock in Product Master before procurement.'
        : 'Reduce the qty before saving.';
      this.saveError.set(`"${stockBlocked.product}": ${hint}. ${action}`);
      return;
    }

    const vendorNames = this.selectedVendorNames().length
      ? this.selectedVendorNames()
      : this.normalizeVendorNames(this.formValues()['vendor']);
    if (!vendorNames.length) {
      this.saveError.set('Select at least one vendor for RFQ.');
      return;
    }

    const isEditing = !!this.editingId();
    const vendorsForSave = isEditing ? [vendorNames[0]] : vendorNames;
    const groupNumber = this.currentRfqGroupDraft();
    this.collectFormField('rfqGroupNo', groupNumber);
    this.isSaving.set(true);

    const calls = vendorsForSave.map((vendorName, index) => {
      const payload = this.buildRfqPayload(vendorName, validItems, groupNumber, vendorsForSave.length, isEditing, index);
      return this.txService.saveRfq(payload, isEditing ? this.editingId() : null);
    });

    forkJoin(calls)
      .pipe(takeUntilDestroyed(this.rfqDestroyRef))
      .subscribe({
        next: responses => {
          this.isSaving.set(false);
          const failed = responses.find(res => !res.success || !res.data);
          if (failed) {
            this.saveError.set(failed.message || 'Unable to save RFQ.');
            return;
          }

          const msg = isEditing
            ? 'Vendor quotation updated.'
            : `RFQ sent to ${responses.length} vendor${responses.length === 1 ? '' : 's'}.`;
          this.clearConfigForm();
          this.saveMsg.set(msg);
          this.loadApiRecords();
          setTimeout(() => this.saveMsg.set(''), 3500);
        },
        error: err => {
          this.isSaving.set(false);
          this.saveError.set(this.apiErrorMessage(err, 'Unable to save RFQ.'));
        }
      });
  }

  private buildRfqPayload(
    vendorName: string,
    validItems: RfqLineItem[],
    groupNumber: string,
    vendorCount: number,
    isEditing: boolean,
    vendorIndex: number
  ): Record<string, any> {
    const values = this.formValues();
    const selectedVendor = this.rfqVendorBySelection(vendorName);
    const canUseManualRfqNo = isEditing || vendorCount === 1;
    const rfqNo = canUseManualRfqNo ? this.rfqNumberValue() || null : null;

    return {
      id: isEditing ? this.editingId() : null,
      segment_id: this.currentSegmentId || values['segmentId'] || null,
      segment_name: this.selectedSegment() || values['segment'] || null,
      rfq_number: rfqNo,
      rfq_group_number: groupNumber,
      rfq_date: this.rfqDateValue('rfqDate'),
      source_type: this.selectedPr() ? 'PR' : 'DIRECT',
      pr_id: Number(values['prId']) || this.selectedPr()?.id || null,
      pr_number: values['prReference'] || null,
      vendor_id: selectedVendor?.id ?? null,
      vendor_name: selectedVendor?.vendor_name || vendorName,
      vendor_gstin: selectedVendor?.gstin || null,
      delivery_location: values['deliveryLocation'] || null,
      estd_delivery_date: this.rfqDateValue('estdDeliveryDate'),
      payment_terms: values['paymentTerms'] || selectedVendor?.payment_term_name || null,
      currency: this.selectedCurrency().code,
      send_channel: values['sendChannel'] || 'Email',
      vendor_response_link: this.vendorResponseLinkFor(selectedVendor?.vendor_name || vendorName, groupNumber, vendorIndex),
      remarks: values['termsConditions'] || values['remarks'] || null,
      status: this.rfqStatusForApi(values['status'] || 'sent'),
      selected_for_po: !!values['selectedForPo'],
      items: validItems.map((item, index) => ({
        sno: index + 1,
        product_id: item.productId,
        product_name: item.product,
        product_code: item.productCode || null,
        variant_id: item.variantId,
        variant_name: item.variant || null,
        uom_id: item.uomId,
        uom_name: item.uom || null,
        attribute_id: item.attributeId,
        attribute_name: item.attributeName || null,
        attribute_value: this.rfqAttributeValueForPayload(item),
        required_qty: Number(item.qty || 0),
        target_rate: item.targetRate,
        vendor_rate: item.vendorRate,
        gst_rate: Number(item.gstRate || 0),
        gst_inclusive: !!item.gstInclusive || !!values['gstInclusive'],
        cgst_rate: item.cgstRate,
        sgst_rate: item.sgstRate,
        igst_rate: item.igstRate,
        lead_time: item.leadTime || null,
        remarks: item.remarks || null
      }))
    };
  }

  editRfqRecord(record: any): void {
    this.editingId.set(Number(record.id));
    this.selectedPr.set(null);
    this.applyRfqRecordToForm(record, false);
  }

  createVendorRfqFromRecord(record: any): void {
    this.editingId.set(null);
    this.selectedPr.set(this.findApprovedPrForRecord(record));
    this.applyRfqRecordToForm(record, true);
    this.saveError.set('');
    this.saveMsg.set(`Ready to add another vendor RFQ for ${record.pr_number || record.rfq_group_number || 'selected items'}.`);
    setTimeout(() => this.saveMsg.set(''), 3000);
  }

  private applyRfqRecordToForm(record: any, copyForNewVendor: boolean): void {
    const currency = record.currency || 'INR';
    this.rfqSourceMode.set(record.pr_id || record.pr_number ? 'pr' : 'direct');
    this.selectedVendorNames.set(copyForNewVendor ? [] : this.normalizeVendorNames(record.vendor_name));
    this.formValues.set({
      segment: record.segment_name || this.selectedSegment(),
      segmentId: record.segment_id ?? null,
      rfqNo: copyForNewVendor ? '' : (record.rfq_number || ''),
      rfqGroupNo: record.rfq_group_number || record.rfqGroupNumber || '',
      rfqDate: record.rfq_date ? new Date(record.rfq_date) : new Date(),
      sourceType: record.source_type || record.sourceType || (record.pr_number ? 'PR' : 'DIRECT'),
      vendorId: copyForNewVendor ? null : record.vendor_id ?? null,
      vendor: copyForNewVendor ? '' : record.vendor_name || '',
      vendorGstin: copyForNewVendor ? '' : record.vendor_gstin || '',
      prId: record.pr_id ?? null,
      prReference: record.pr_number || '',
      deliveryLocation: record.delivery_location || '',
      estdDeliveryDate: (record.estd_delivery_date || record.estdDeliveryDate) ? new Date(record.estd_delivery_date || record.estdDeliveryDate) : null,
      paymentTerms: record.payment_terms || '',
      sendChannel: record.send_channel || record.sendChannel || 'Email',
      status: copyForNewVendor ? 'sent' : (record.status || 'draft'),
      currency,
      selectedForPo: !!(record.selected_for_po ?? record.selectedForPo),
      termsConditions: record.remarks || ''
    });
    this.selectedCurrency.set(this.currencyOptions.find(c => c.code === currency) || this.currencyOptions[0]);
    const items = (record.items || []).map((item: any) => this.rfqLineFromSavedItem(item, copyForNewVendor));
    this.rfqItems.set(items.length ? items : [this.newRfqItem()]);
  }

  private rfqLineFromSavedItem(item: any, copyForNewVendor = false): RfqLineItem {
    const productName = item.product_name || item.productName || '';
    const product = this.rfqProductBySelection(productName);
    const base = product ? this.rfqLineFromProduct(product) : this.newRfqItem();
    return {
      ...base,
      productId: item.product_id ?? item.productId ?? base.productId,
      product: product?.product_name || productName,
      productCode: item.product_code || item.productCode || base.productCode,
      variantId: item.variant_id ?? item.variantId ?? null,
      variant: item.variant_name || item.variantName || '',
      attributeId: item.attribute_id ?? item.attributeId ?? null,
      attributeName: item.attribute_name || item.attributeName || '',
      attributeValue: item.attribute_value || item.attributeValue || '',
      qty: Number(item.required_qty ?? item.requiredQty ?? 0) || null,
      uomId: item.uom_id ?? item.uomId ?? base.uomId,
      uom: item.uom_name || item.uomName || base.uom,
      targetRate: item.target_rate ?? item.targetRate ?? null,
      vendorRate: copyForNewVendor ? null : item.vendor_rate ?? item.vendorRate ?? null,
      gstRate: item.gst_rate ?? item.gstRate ?? base.gstRate ?? 0,
      gstInclusive: !!(item.gst_inclusive ?? item.gstInclusive),
      cgstRate: item.cgst_rate ?? item.cgstRate ?? base.cgstRate ?? null,
      sgstRate: item.sgst_rate ?? item.sgstRate ?? base.sgstRate ?? null,
      igstRate: item.igst_rate ?? item.igstRate ?? base.igstRate ?? null,
      leadTime: copyForNewVendor ? '' : item.lead_time || item.leadTime || '',
      remarks: item.remarks || ''
    };
  }

  mockSendRfq(record: any): void {
    const channel = record.send_channel || record.sendChannel || 'Email';
    this.saveMsg.set(`${record.rfq_number || 'RFQ'} ${channel} trigger queued for ${record.vendor_name || 'vendor'}.`);
    setTimeout(() => this.saveMsg.set(''), 3000);
  }

  showVendorLink(record: any): void {
    const link = record.vendor_response_link || record.vendorResponseLink || this.vendorResponseLinkFor(record.vendor_name, this.rfqGroupKey(record));
    this.saveMsg.set(`Vendor response link: ${link}`);
    setTimeout(() => this.saveMsg.set(''), 6000);
  }

  setComparisonGroup(key: string): void {
    this.selectedComparisonGroup.set(key || '');
  }

  updateComparisonNote(record: any, notes: string): void {
    this.savedRecordObjects.update(records => records.map(item =>
      Number(item.id) === Number(record.id) ? { ...item, negotiation_notes: notes } : item
    ));
  }

  saveNegotiationNote(record: any): void {
    const current = this.savedRecordObjects().find(item => Number(item.id) === Number(record.id)) || record;
    const payload = this.rfqPayloadFromRecord(current, {
      negotiation_notes: current.negotiation_notes || current.negotiationNotes || null
    });
    this.txService.saveRfq(payload, Number(current.id))
      .pipe(takeUntilDestroyed(this.rfqDestroyRef))
      .subscribe({
        next: res => {
          if (!res.success) {
            this.saveError.set(res.message || 'Unable to save negotiation note.');
            return;
          }
          this.saveMsg.set('Negotiation note saved.');
          this.loadApiRecords();
          setTimeout(() => this.saveMsg.set(''), 2500);
        },
        error: err => this.saveError.set(this.apiErrorMessage(err, 'Unable to save negotiation note.'))
      });
  }

  openSelectVendorConfirm(row: RfqComparisonRow): void {
    this.poConfirmRecord.set(row.record);
  }

  closeSelectVendorConfirm(): void {
    if (this.poDraftLoading()) return;
    this.poConfirmRecord.set(null);
  }

  confirmSelectVendorForPo(): void {
    const record = this.poConfirmRecord();
    if (!record || this.poDraftLoading()) return;
    this.poDraftLoading.set(true);
    this.saveError.set('');
    const acceptedPayload = this.rfqPayloadFromRecord(record, { status: 'accepted', selected_for_po: true });
    const poPayload = this.poPayloadFromRfq(record);

    this.txService.saveRfq(acceptedPayload, Number(record.id))
      .pipe(
        switchMap(() => this.txService.savePurchaseOrder(poPayload)),
        takeUntilDestroyed(this.rfqDestroyRef)
      )
      .subscribe({
        next: res => {
          this.poDraftLoading.set(false);
          if (!res.success || !res.data) {
            this.saveError.set(res.message || 'Unable to generate PO draft.');
            return;
          }
          this.poConfirmRecord.set(null);
          this.poPreviewRecord.set(this.poPreviewFromResponse(res.data, poPayload, record));
          this.poPreviewOpen.set(true);
          this.saveMsg.set('PO draft generated from selected vendor quote.');
          this.loadApiRecords();
          setTimeout(() => this.saveMsg.set(''), 3500);
        },
        error: err => {
          this.poDraftLoading.set(false);
          this.saveError.set(this.apiErrorMessage(err, 'Unable to generate PO draft.'));
        }
      });
  }

  closePoPreview(): void {
    this.poPreviewOpen.set(false);
    this.poPreviewRecord.set(null);
  }

  async downloadPoPdf(): Promise<void> {
    const po = this.poPreviewRecord();
    if (!po) return;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(15);
    doc.text(`Purchase Order Preview - ${po.po_number || 'Draft'}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Vendor: ${po.vendor_name || '-'}`, 14, 25);
    doc.text(`RFQ: ${po.rfq_number || '-'}`, 14, 31);
    doc.text(`Payment Terms: ${po.payment_terms || '-'}`, 14, 37);
    autoTable(doc, {
      startY: 45,
      head: [['#', 'Product', 'Qty', 'UOM', 'Rate', 'GST %', 'Amount']],
      body: (po.items || []).map((item: any, index: number) => [
        index + 1,
        item.product_name || '',
        item.qty || 0,
        item.uom_name || '',
        // No ₹ on the PDF (user request 2026-11-14); screen keeps it.
        this.money(item.rate || 0, po.currency || 'INR').replace(/₹\s*/g, ''),
        item.gst_rate || 0,
        this.money(item.amount || 0, po.currency || 'INR').replace(/₹\s*/g, '')
      ])
    });
    const finalY = (doc as any).lastAutoTable?.finalY || 55;
    doc.text(`Total: ${this.money(po.total_amount || 0, po.currency || 'INR').replace(/₹\s*/g, '')}`, 14, finalY + 10);
    doc.save(`${po.po_number || 'po-preview'}.pdf`);
  }

  sendPoToVendor(): void {
    const po = this.poPreviewRecord();
    if (!po) return;
    this.saveMsg.set(`PO ${po.po_number || 'draft'} send trigger queued for ${po.vendor_name || 'vendor'}.`);
    setTimeout(() => this.saveMsg.set(''), 3500);
  }

  rfqRecordRow(record: any): string[] {
    return [record.rfq_number || ''];
  }

  rfqItemCount(record: any): number {
    return (record.items || []).length;
  }

  prItemAttributeText(item: any): string {
    const name = String(item?.attribute_name || item?.attributeName || '').trim();
    const value = String(item?.attribute_value || item?.attributeValue || '').trim();
    if (name && value && !value.includes(':')) return `${name}: ${value}`;
    return value || name || '-';
  }

  prRfqCount(pr: PurchaseRequisition): number {
    return this.rfqRecords().filter(record =>
      Number(record.pr_id) === Number(pr.id) || record.pr_number === pr.pr_number
    ).length;
  }

  prRfqVendorText(pr: PurchaseRequisition): string {
    const vendors = this.rfqRecords()
      .filter(record => Number(record.pr_id) === Number(pr.id) || record.pr_number === pr.pr_number)
      .map(record => String(record.vendor_name || '').trim())
      .filter(Boolean);
    return vendors.length ? vendors.join(', ') : '-';
  }

  rfqLineTotal(item: RfqLineItem): number {
    const qty = Number(item.qty || 0);
    const rate = Number(item.vendorRate ?? item.targetRate ?? 0);
    const gst = Number(item.gstRate || 0);
    const gross = qty * rate;
    if (!gross) return 0;
    if (item.gstInclusive) return this.round2(gross);
    return this.round2(gross + (gross * gst / 100));
  }

  rfqRecordTotal(record: any): number {
    return this.round2((record.items || []).reduce((sum: number, item: any) => {
      const savedTotal = Number(item.line_total ?? item.lineTotal);
      if (Number.isFinite(savedTotal) && savedTotal > 0) return sum + savedTotal;
      const qty = Number(item.required_qty ?? item.requiredQty ?? 0);
      const rate = Number(item.vendor_rate ?? item.vendorRate ?? item.target_rate ?? item.targetRate ?? 0);
      const gst = Number(item.gst_rate ?? item.gstRate ?? 0);
      const gross = qty * rate;
      const inclusive = !!(item.gst_inclusive ?? item.gstInclusive ?? record.gst_inclusive ?? record.gstInclusive);
      return sum + (inclusive ? gross : gross + (gross * gst / 100));
    }, 0));
  }

  rfqRecordTaxAmount(record: any): number {
    return this.round2((record.items || []).reduce((sum: number, item: any) => {
      const savedTax = Number(item.tax_amount ?? item.taxAmount);
      if (Number.isFinite(savedTax) && savedTax > 0) return sum + savedTax;
      const qty = Number(item.required_qty ?? item.requiredQty ?? 0);
      const rate = Number(item.vendor_rate ?? item.vendorRate ?? item.target_rate ?? item.targetRate ?? 0);
      const gst = Number(item.gst_rate ?? item.gstRate ?? 0);
      const gross = qty * rate;
      const inclusive = !!(item.gst_inclusive ?? item.gstInclusive ?? record.gst_inclusive ?? record.gstInclusive);
      if (!gross || !gst) return sum;
      return sum + (inclusive ? gross - (gross / (1 + gst / 100)) : gross * gst / 100);
    }, 0));
  }

  comparisonScoreClass(row: RfqComparisonRow): string {
    const best = this.bestComparisonScore();
    const worst = this.worstComparisonScore();
    if (best !== null && row.total === best) return 'rfq-score-best';
    if (worst !== null && row.total === worst && best !== worst) return 'rfq-score-worst';
    return '';
  }

  priceBarWidth(row: RfqComparisonRow): string {
    const max = Math.max(...this.comparisonRows().map(item => item.total), 0);
    if (!max || !row.total) return '4%';
    return `${Math.max(4, Math.round((row.total / max) * 100))}%`;
  }

  trackingStatusClass(status: string): string {
    const key = this.rfqKey(status);
    if (key.includes('response') || key.includes('accepted')) return 'rfq-track-good';
    if (key.includes('sent')) return 'rfq-track-info';
    if (key.includes('cancel')) return 'rfq-track-bad';
    return 'rfq-track-muted';
  }

  money(value: any, currency = this.selectedCurrency().code): string {
    const amount = Number(value || 0);
    const symbol = this.currencyOptions.find(item => item.code === currency)?.symbol || currency || '';
    return `${symbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  rfqStatusLabel(status: string): string {
    const key = String(status || '').toLowerCase().replace(/[_\s]+/g, '');
    if (key === 'responsereceived') return 'Response Received';
    if (key === 'selectedforpo') return 'Selected For PO';
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Draft';
  }

  private rfqPayloadFromRecord(record: any, overrides: Record<string, any> = {}): Record<string, any> {
    return {
      id: record.id,
      segment_id: record.segment_id ?? record.segmentId ?? null,
      rfq_number: record.rfq_number || record.rfqNumber || null,
      rfq_group_number: record.rfq_group_number || record.rfqGroupNumber || null,
      rfq_date: record.rfq_date || record.rfqDate || null,
      source_type: record.source_type || record.sourceType || (record.pr_number ? 'PR' : 'DIRECT'),
      pr_id: record.pr_id ?? record.prId ?? null,
      pr_number: record.pr_number || record.prNumber || null,
      vendor_id: record.vendor_id ?? record.vendorId ?? null,
      vendor_name: record.vendor_name || record.vendorName || null,
      vendor_gstin: record.vendor_gstin || record.vendorGstin || null,
      delivery_location: record.delivery_location || record.deliveryLocation || null,
      estd_delivery_date: record.estd_delivery_date || record.estdDeliveryDate || null,
      vendor_quote_ref: record.vendor_quote_ref || record.vendorQuoteRef || null,
      payment_terms: record.payment_terms || record.paymentTerms || null,
      currency: record.currency || 'INR',
      send_channel: record.send_channel || record.sendChannel || 'Email',
      vendor_response_link: record.vendor_response_link || record.vendorResponseLink || null,
      negotiation_notes: record.negotiation_notes || record.negotiationNotes || null,
      selected_for_po: !!(record.selected_for_po ?? record.selectedForPo),
      remarks: record.remarks || null,
      status: record.status || 'sent',
      items: (record.items || []).map((item: any, index: number) => ({
        sno: index + 1,
        product_id: item.product_id ?? item.productId ?? null,
        product_name: item.product_name || item.productName || '',
        product_code: item.product_code || item.productCode || null,
        variant_id: item.variant_id ?? item.variantId ?? null,
        variant_name: item.variant_name || item.variantName || null,
        uom_id: item.uom_id ?? item.uomId ?? null,
        uom_name: item.uom_name || item.uomName || null,
        attribute_id: item.attribute_id ?? item.attributeId ?? null,
        attribute_name: item.attribute_name || item.attributeName || null,
        attribute_value: item.attribute_value || item.attributeValue || null,
        required_qty: Number(item.required_qty ?? item.requiredQty ?? 0),
        target_rate: item.target_rate ?? item.targetRate ?? null,
        vendor_rate: item.vendor_rate ?? item.vendorRate ?? null,
        gst_rate: Number(item.gst_rate ?? item.gstRate ?? 0),
        gst_inclusive: !!(item.gst_inclusive ?? item.gstInclusive),
        cgst_rate: item.cgst_rate ?? item.cgstRate ?? null,
        sgst_rate: item.sgst_rate ?? item.sgstRate ?? null,
        igst_rate: item.igst_rate ?? item.igstRate ?? null,
        lead_time: item.lead_time || item.leadTime || null,
        remarks: item.remarks || null
      })),
      ...overrides
    };
  }

  private poPayloadFromRfq(record: any): Record<string, any> {
    const items = (record.items || []).map((item: any, index: number) => {
      const qty = Number(item.required_qty ?? item.requiredQty ?? 0);
      const rate = Number(item.vendor_rate ?? item.vendorRate ?? item.target_rate ?? item.targetRate ?? 0);
      const gst = Number(item.gst_rate ?? item.gstRate ?? 0);
      return {
        sno: index + 1,
        product_id: item.product_id ?? item.productId ?? null,
        product_name: item.product_name || item.productName || '',
        product_code: item.product_code || item.productCode || null,
        variant_id: item.variant_id ?? item.variantId ?? null,
        variant_name: item.variant_name || item.variantName || null,
        uom_id: item.uom_id ?? item.uomId ?? null,
        uom_name: item.uom_name || item.uomName || null,
        attribute_id: item.attribute_id ?? item.attributeId ?? null,
        attribute_name: item.attribute_name || item.attributeName || null,
        attribute_value: item.attribute_value || item.attributeValue || null,
        qty,
        rate,
        discount_pct: 0,
        gst_rate: gst,
        warehouse_name: record.delivery_location || record.deliveryLocation || null,
        amount: this.round2(qty * rate + (qty * rate * gst / 100))
      };
    });

    return {
      po_date: new Date().toISOString().slice(0, 10),
      expected_delivery: this.poExpectedDelivery(record),
      segment_id: record.segment_id ?? record.segmentId ?? null,
      rfq_id: record.id,
      rfq_number: record.rfq_number || record.rfqNumber || null,
      vendor_id: record.vendor_id ?? record.vendorId ?? null,
      vendor_name: record.vendor_name || record.vendorName || null,
      vendor_gstin: record.vendor_gstin || record.vendorGstin || null,
      warehouse_name: record.delivery_location || record.deliveryLocation || null,
      currency: record.currency || 'INR',
      payment_terms: record.payment_terms || record.paymentTerms || null,
      reference_no: record.rfq_group_number || record.rfqGroupNumber || record.pr_number || record.prNumber || null,
      terms_conditions: record.remarks || record.negotiation_notes || record.negotiationNotes || null,
      status: 'draft',
      items
    };
  }

  private poPreviewFromResponse(po: PurchaseOrder, payload: Record<string, any>, record: any): any {
    const items = payload['items'] || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0);
    const tax = items.reduce((sum: number, item: any) => sum + (Number(item.qty || 0) * Number(item.rate || 0) * Number(item.gst_rate || 0) / 100), 0);
    return {
      ...po,
      po_number: po.po_number || 'Draft PO',
      vendor_name: po.vendor_name || payload['vendor_name'] || record.vendor_name,
      vendor_gstin: po.vendor_gstin || payload['vendor_gstin'] || record.vendor_gstin,
      rfq_number: po.rfq_number || payload['rfq_number'] || record.rfq_number,
      payment_terms: po.payment_terms || payload['payment_terms'] || record.payment_terms,
      currency: po.currency || payload['currency'] || record.currency || 'INR',
      items,
      subtotal: po.subtotal || this.round2(subtotal),
      tax_amount: po.tax_amount || this.round2(tax),
      total_amount: po.total_amount || this.round2(subtotal + tax)
    };
  }

  private poExpectedDelivery(record: any): string | null {
    const lead = this.rfqRecordLeadDays(record);
    if (lead && lead > 0) {
      const date = new Date();
      date.setDate(date.getDate() + lead);
      return date.toISOString().slice(0, 10);
    }
    return record.estd_delivery_date || record.estdDeliveryDate || null;
  }

  private rfqAttributeValueForPayload(item: RfqLineItem): string | null {
    const selected = item.attributeSelections
      .filter(attr => attr.value && attr.value.trim())
      .map(attr => `${attr.name}: ${attr.value.trim()}`);
    if (selected.length) return selected.join(' | ');
    return item.attributeValue || null;
  }

  private currentRfqGroupDraft(): string {
    const values = this.formValues();
    const existing = String(values['rfqGroupNo'] || '').trim();
    if (existing) return existing;
    const manual = String(values['rfqNo'] || '').trim();
    if (manual && this.selectedVendorNames().length > 1) return manual;
    const seg = this.rfqGroupSegmentCode();
    const now = new Date();
    const stamp = [
      String(now.getFullYear()).slice(2),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('');
    return `RFQ-GRP-${seg}-${stamp}`;
  }

  private rfqGroupSegmentCode(): string {
    const selected = String(this.selectedSegment() || 'GEN').trim();
    const words = selected.split(/\s+/).filter(Boolean);
    const code = words.length > 1 ? words.map(word => word[0]).join('') : selected.slice(0, 3);
    return (code || 'GEN').replace(/[^a-z0-9]/gi, '').toUpperCase();
  }

  private vendorResponseLinkFor(vendorName: string, groupNumber: string, index = 0): string {
    const group = encodeURIComponent(groupNumber || 'rfq');
    const vendor = encodeURIComponent(String(vendorName || `vendor-${index + 1}`).trim().toLowerCase().replace(/\s+/g, '-'));
    return `/vendor/rfq-response/${group}/${vendor}`;
  }

  private rfqVendorNamesForTracking(): string[] {
    const selected = this.selectedVendorNames();
    if (selected.length) return selected;
    const group = this.currentRfqGroupDraft();
    const fromGroup = this.rfqRecords()
      .filter(record => this.rfqGroupKey(record) === group)
      .map(record => String(record.vendor_name || '').trim())
      .filter(Boolean);
    if (fromGroup.length) return [...new Set(fromGroup)];
    const current = String(this.formValues()['vendor'] || '').trim();
    return current ? [current] : [];
  }

  private rfqRecordForVendor(vendorName: string): any | null {
    const group = this.currentRfqGroupDraft();
    const vendorKey = this.rfqKey(vendorName);
    const prNo = String(this.formValues()['prReference'] || '').trim();
    return this.rfqRecords().find(record => {
      const sameVendor = this.rfqKey(record.vendor_name) === vendorKey;
      const sameGroup = group && this.rfqGroupKey(record) === group;
      const samePr = prNo && record.pr_number === prNo;
      return sameVendor && (sameGroup || samePr);
    }) || null;
  }

  private rfqProductBySelection(value: any): ProductItem | null {
    const selected = this.rfqKey(value);
    if (!selected) return null;
    return this.loadedProductObjects().find(product =>
      this.rfqKey(product.product_name) === selected
      || this.rfqKey(product.product_code) === selected
      || this.rfqKey(product.sku) === selected
    ) ?? null;
  }

  private rfqVendorBySelection(value: any): VendorItem | null {
    const selected = this.rfqKey(value);
    if (!selected) return null;
    return this.rfqVendorRecords().find(vendor =>
      this.rfqVendorSelectionCandidates(vendor).some(candidate => this.rfqKey(candidate) === selected)
    ) ?? null;
  }

  private rfqVendorPhone(vendor: VendorItem | null | undefined): string {
    return String(vendor?.mobile || vendor?.contact_mobile || '').trim();
  }

  private rfqVendorOptionLabel(vendor: VendorItem): string {
    const name = String(vendor.vendor_name || vendor.vendor_code || '').trim();
    const phone = this.rfqVendorPhone(vendor);
    return [name, phone].filter(Boolean).join(' | ');
  }

  private rfqVendorSelectionCandidates(vendor: VendorItem): string[] {
    const name = String(vendor.vendor_name || '').trim();
    const code = String(vendor.vendor_code || '').trim();
    const phone = this.rfqVendorPhone(vendor);
    const contactName = String(vendor.contact_name || '').trim();
    const label = this.rfqVendorOptionLabel(vendor);
    return [label, name, code, phone, contactName, phone && name ? `${phone} | ${name}` : '']
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  private normalizeVendorNames(value: string[] | string | null | undefined): string[] {
    const raw = Array.isArray(value) ? value : value ? [value] : [];
    const seen = new Set<string>();
    return raw
      .map(item => String(item || '').trim())
      .filter(item => {
        const key = this.rfqKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private findApprovedPrForRecord(record: any): PurchaseRequisition | null {
    const prId = Number(record.pr_id ?? record.prId);
    const prNo = String(record.pr_number || record.prNumber || '').trim();
    return this.approvedPrs().find(pr =>
      (Number.isFinite(prId) && Number(pr.id) === prId) || (!!prNo && pr.pr_number === prNo)
    ) ?? null;
  }

  private rfqGroupKey(record: any): string {
    return String(
      record?.rfq_group_number
      || record?.rfqGroupNumber
      || record?.pr_number
      || record?.prNumber
      || record?.rfq_number
      || record?.rfqNumber
      || ''
    ).trim();
  }

  private rfqGroupLabel(record: any, key: string): string {
    const pr = record.pr_number || record.prNumber;
    if (record.rfq_group_number || record.rfqGroupNumber) return `${key}${pr ? ` / ${pr}` : ''}`;
    return key;
  }

  private rfqRecordLeadDays(record: any): number | null {
    const days = (record.items || [])
      .map((item: any) => this.rfqTextDays(item.lead_time || item.leadTime))
      .filter((item: number | null): item is number => item !== null && item > 0);
    return days.length ? Math.min(...days) : null;
  }

  private rfqTextDays(value: any): number | null {
    const match = String(value || '').match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const days = Number(match[1]);
    return Number.isFinite(days) ? days : null;
  }

  private rfqStatusForApi(status: any): string {
    return String(status || 'draft').trim().toLowerCase().replace(/\s+/g, '_');
  }

  private rfqIsApproved(status: any): boolean {
    return String(status || '').toLowerCase().replace(/\s+/g, '') === 'approved';
  }

  private rfqNumberValue(): string {
    return String(this.formValues()['rfqNo'] || '').trim();
  }

  private rfqDateValue(key: string): string | null {
    const value = this.formValues()[key];
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  private round2(value: number): number {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  rfqEstdLeadDays(): number | null {
    const estd = this.formValues()['estdDeliveryDate'];
    if (!estd) return null;
    const estdDate = estd instanceof Date ? estd : new Date(String(estd));
    if (Number.isNaN(estdDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((estdDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  }

  private rfqKey(value: any): string {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  openQuotationEntry(record: any): void {
    const groupKey = this.rfqGroupKey(record);
    const groupRecords = groupKey
      ? this.rfqRecords().filter(r => this.rfqGroupKey(r) === groupKey && String(r.vendor_name || '').trim())
      : [];
    this.quotationGroupRecords.set(groupRecords.length > 1 ? groupRecords : []);
    this.loadQuotationFromRecord(record);
    this.quotationPopupOpen.set(true);
  }

  loadQuotationFromRecord(record: any): void {
    const lines: QuotationLineEntry[] = (record.items || []).map((item: any, i: number) => ({
      itemIndex: i,
      productName: item.product_name || item.productName || '',
      variantName: item.variant_name || item.variantName || '',
      qty: Number(item.required_qty ?? item.requiredQty ?? 0),
      uom: item.uom_name || item.uomName || '',
      vendorRate: item.vendor_rate ?? item.vendorRate ?? null,
      gstInclusive: !!(item.gst_inclusive ?? item.gstInclusive),
      gstRate: item.gst_rate ?? item.gstRate ?? null,
      cgstRate: item.cgst_rate ?? item.cgstRate ?? null,
      sgstRate: item.sgst_rate ?? item.sgstRate ?? null,
      igstRate: item.igst_rate ?? item.igstRate ?? null,
      leadTime: item.lead_time || item.leadTime || ''
    }));
    this.quotationLines.set(lines);
    this.quotationReceivedDate.set(new Date());
    this.quotationRef.set(record.vendor_quote_ref || record.vendorQuoteRef || '');
    this.quotationNotes.set(record.negotiation_notes || record.negotiationNotes || '');
    this.quotationPopupRecord.set(record);
  }

  closeQuotationEntry(): void {
    if (this.quotationSaving()) return;
    this.quotationPopupOpen.set(false);
    this.quotationPopupRecord.set(null);
    this.quotationLines.set([]);
  }

  updateQuotationLine(index: number, key: keyof QuotationLineEntry, value: any): void {
    this.quotationLines.update(lines => {
      const next = [...lines];
      const numKeys: Array<keyof QuotationLineEntry> = ['vendorRate', 'gstRate', 'cgstRate', 'sgstRate', 'igstRate'];
      const parsed = numKeys.includes(key) ? (value === null || value === '' ? null : Number(value)) : value;
      next[index] = { ...next[index], [key]: parsed };
      if (key === 'gstRate') {
        const gst = Number(parsed || 0);
        next[index] = { ...next[index], cgstRate: gst ? this.round2(gst / 2) : null, sgstRate: gst ? this.round2(gst / 2) : null, igstRate: gst || null };
      }
      return next;
    });
  }

  quotationLineAmount(line: QuotationLineEntry): number {
    const qty = Number(line.qty || 0);
    const rate = Number(line.vendorRate || 0);
    const gst = Number(line.gstRate || 0);
    const gross = qty * rate;
    if (!gross) return 0;
    return this.round2(line.gstInclusive ? gross : gross + (gross * gst / 100));
  }

  quotationTotal(): number {
    return this.round2(this.quotationLines().reduce((sum, line) => sum + this.quotationLineAmount(line), 0));
  }

  saveQuotationEntry(): void {
    const record = this.quotationPopupRecord();
    if (!record || this.quotationSaving()) return;
    this.quotationSaving.set(true);
    this.saveError.set('');

    const lines = this.quotationLines();
    const updatedItems = (record.items || []).map((item: any, i: number) => {
      const line = lines[i];
      if (!line) return item;
      return {
        sno: i + 1,
        product_id: item.product_id ?? item.productId ?? null,
        product_name: item.product_name || item.productName || '',
        product_code: item.product_code || item.productCode || null,
        variant_id: item.variant_id ?? item.variantId ?? null,
        variant_name: item.variant_name || item.variantName || null,
        uom_id: item.uom_id ?? item.uomId ?? null,
        uom_name: item.uom_name || item.uomName || null,
        attribute_id: item.attribute_id ?? item.attributeId ?? null,
        attribute_name: item.attribute_name || item.attributeName || null,
        attribute_value: item.attribute_value || item.attributeValue || null,
        required_qty: Number(item.required_qty ?? item.requiredQty ?? 0),
        target_rate: item.target_rate ?? item.targetRate ?? null,
        vendor_rate: line.vendorRate,
        gst_inclusive: line.gstInclusive,
        gst_rate: line.gstRate,
        cgst_rate: line.cgstRate,
        sgst_rate: line.sgstRate,
        igst_rate: line.igstRate,
        lead_time: line.leadTime || null,
        line_total: this.quotationLineAmount(line),
        remarks: item.remarks || null
      };
    });

    const payload = this.rfqPayloadFromRecord(record, {
      status: 'response_received',
      vendor_quote_ref: this.quotationRef() || null,
      negotiation_notes: this.quotationNotes() || record.negotiation_notes || null,
      items: updatedItems
    });

    this.txService.saveRfq(payload, Number(record.id))
      .pipe(takeUntilDestroyed(this.rfqDestroyRef))
      .subscribe({
        next: res => {
          this.quotationSaving.set(false);
          if (!res.success) {
            this.saveError.set(res.message || 'Unable to save quotation.');
            return;
          }
          this.saveMsg.set(`Quotation from ${record.vendor_name || 'vendor'} recorded successfully.`);
          this.closeQuotationEntry();
          this.loadApiRecords();
          setTimeout(() => this.saveMsg.set(''), 3500);
        },
        error: err => {
          this.quotationSaving.set(false);
          this.saveError.set(this.apiErrorMessage(err, 'Unable to save quotation.'));
        }
      });
  }

  override clearConfigForm(): void {
    super.clearConfigForm();
    this.selectedPr.set(null);
    this.rfqSourceMode.set('direct');
    this.selectedVendorNames.set([]);
    this.rfqItems.set([this.newRfqItem()]);
    this.selectedCurrency.set(this.currencyOptions[0]);
    this.currencyMenuOpen.set(false);
    this.ensureRfqDefaults();
  }
}
