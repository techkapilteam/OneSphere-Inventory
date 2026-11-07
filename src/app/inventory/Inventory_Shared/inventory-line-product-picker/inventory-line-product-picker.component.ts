import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, EmbeddedViewRef, Input, OnDestroy, TemplateRef, ViewChild, ViewContainerRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { BranchInvItem, WarehouseItem } from '../inventory-config.service';
import { AvailableStock, InventoryTransactionsService } from '../inventory-transactions.service';
import { VariantAttrSelection } from '../inventory-screen-shell/inventory-screen-shell';

interface WarehouseStockCard {
  key: string;
  warehouseId: number | null;
  warehouseName: string;
  available: number;
  isCurrentWarehouse: boolean;
}

interface BranchStockCard {
  key: string;
  branchId: number | null;
  branchName: string;
  available: number;
  isCurrentBranch: boolean;
}

// Standard product-entry control for every transaction line grid (Purchase
// Invoice, Sales Invoice, Stock Transfer, GRN, Purchase Return, Sales Order,
// Delivery Challan, Sales Return, Stock Adjustment -- rolled out from its
// original 3-screen pilot). Replaces the wide Product ng-select + nested
// Variant/Attribute sub-selects with a compact "+ Product" trigger that opens
// a top modal popup for Product -> Variant -> one-or-more Attributes, shows
// closing stock for the current pick, and offers an informational
// cross-branch stock lookup for the same product (no selection from those
// cards -- lookup only).
//
// Mounted once PER GRID ROW (inside the Product <td>, via @for), same
// @Input({required:true}) host!: any convention as
// InventoryPartyFormComponent / InventoryQuickAddModalComponent /
// InventorySerialPickerModalComponent. It calls only methods the existing
// per-cell widgets already call today -- host.setEntryLineCell() and
// host.setLineAttrValue() -- immediately per pick (not batched), so
// pricing/GST/UOM/MRP recalculation behaves identically to every other
// screen's still-wide dropdown.
//
// Popup root gets classes `inventory-modal inventory-line-product-popup` and
// its header gets `inventory-modal-header` -- both already match app.ts's
// app-wide modal-drag selectors, so dragging by the header works with zero
// changes to app.ts. Position is fixed at the top of the viewport and
// centered horizontally, then clamped with the same 12px padding convention
// app.ts's drag-move handler uses once the user starts dragging.
//
// Deliberately a body-level embedded view, not an Angular CDK Overlay: an
// earlier pass in this same round tried `@angular/cdk/overlay`
// (Overlay.create({hasBackdrop:true, ...})) to get a dimmed backdrop "for
// free". That backfired -- CDK v21's overlay wrapper can promote itself to
// the browser's native Popover-API top layer, while ng-select dropdown
// panels are still ordinary high-z-index nodes. The popup therefore uses
// normal Angular template bindings, but its rendered backdrop/popup nodes
// are moved to document.body so parent stacking contexts in the transaction
// screen cannot paint the shell/breadcrumb above it. The popup's ng-selects
// append their panels to `.inventory-line-product-popup`, keeping options in
// the same modal layer instead of dropping under the backdrop.
@Component({
  selector: 'app-inventory-line-product-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './inventory-line-product-picker.component.html',
  styleUrl: './inventory-line-product-picker.component.scss'
})
export class InventoryLineProductPickerComponent implements OnDestroy {
  @Input({ required: true }) host!: any;
  @Input({ required: true }) rowIndex!: number;
  @Input({ required: true }) column!: string;
  @Input({ required: true }) productColumnIndex!: number;
  @Input({ required: true }) variantColumnIndex!: number;
  @Input({ required: true }) attributeColumnIndex!: number;

  @ViewChild('popupRoot') private readonly popupRootRef?: ElementRef<HTMLElement>;
  @ViewChild('popupTemplate') private readonly popupTemplateRef?: TemplateRef<unknown>;
  @ViewChild('triggerBtn') private readonly triggerBtnRef?: ElementRef<HTMLElement>;

  private readonly txService = inject(InventoryTransactionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documentRef = inject(DOCUMENT);
  private readonly viewContainerRef = inject(ViewContainerRef);

  protected readonly popupLeft = signal(0);
  protected readonly popupTop = signal(0);

  protected readonly currentPickStockRows = signal<AvailableStock[]>([]);
  protected readonly currentPickStockLoading = signal(false);
  protected readonly branchStockRows = signal<AvailableStock[]>([]);
  protected readonly branchStockLoading = signal(false);

  private readonly currentPickQuery$ = new Subject<{ productId: number | null; variantId: number | null; attributeValue: string | null }>();
  private readonly branchQuery$ = new Subject<number | null>();

  // Bound once (not per render) so add/removeEventListener target the same
  // function reference -- mirrors app.ts's own handleModalPointerDown-style
  // convention for module-level document listeners.
  //
  // The popup's ng-select panels are appended to the popup root. Keep the
  // `.ng-dropdown-panel` guard anyway because ng-select still renders that
  // panel outside the individual <ng-select> host element, and the same
  // handler also protects any future append target changes.
  private readonly outsideClickHandler = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    if (this.popupRootRef?.nativeElement.contains(target)) return;
    if (target.closest?.('.inventory-line-product-popup')) return;
    if (this.triggerBtnRef?.nativeElement.contains(target)) return;
    if (target.closest?.('.ng-dropdown-panel')) return;
    this.close();
  };

  constructor() {
    // Both stock queries are plain reads off the existing available-stock
    // endpoint (InventoryTransactionsService.getAvailableStock) -- the same
    // one the shell's own inline stock hint already calls -- injected
    // directly here rather than routed through the shell's private
    // per-line cache, since this popup's own two panels (current-pick vs.
    // cross-branch) need independently-scoped queries.
    this.currentPickQuery$
      .pipe(
        switchMap(query => {
          if (!query.productId) return of<AvailableStock[]>([]);
          this.currentPickStockLoading.set(true);
          return this.txService.getAvailableStock(query).pipe(
            switchMap(res => of(res.data || [])),
            catchError(() => of<AvailableStock[]>([]))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(rows => {
        this.currentPickStockLoading.set(false);
        this.currentPickStockRows.set(rows);
      });

    this.branchQuery$
      .pipe(
        switchMap(productId => {
          if (!productId) return of<AvailableStock[]>([]);
          this.branchStockLoading.set(true);
          // No warehouseId/variantId -- every warehouse row for the product,
          // same shape the shell's own cross-warehouse hint already fetches.
          return this.txService.getAvailableStock({ productId }).pipe(
            switchMap(res => of(res.data || [])),
            catchError(() => of<AvailableStock[]>([]))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(rows => {
        this.branchStockLoading.set(false);
        this.branchStockRows.set(rows);
      });

    // Re-query both panels whenever this row's popup is open and its
    // product/variant/attribute selection changes -- and only then, so the
    // other (closed) row instances mounted alongside this one in the grid
    // never fire a network call.
    effect(() => {
      if (!this.isOpen()) return;
      const productId = this.resolvedProduct()?.id ?? null;
      const variantId = this.resolvedVariantId();
      const attributeValue = this.currentAttributeValue();
      this.currentPickQuery$.next({ productId, variantId, attributeValue });
      this.branchQuery$.next(productId);
    });

    // Outside-click-to-close, added/removed only while this row's popup is
    // actually open -- not a permanent per-row listener (there can be dozens
    // of grid rows, each with its own instance of this component).
    //
    // The ResizeObserver alongside it fixes a real bug caught live: the
    // popup's Product/Variant/Attribute fields and stock panels only exist
    // once picks are made and their async stock query resolves, so a popup
    // opened near the bottom of a scrolled grid can grow noticeably taller
    // AFTER openPopup()'s own one-time reclampToViewport() already ran on
    // an near-empty popup. `position: fixed` doesn't respond to page
    // scrolling either, so without this the "Add Product" footer could end
    // up genuinely unreachable -- not just visually clipped. Re-clamping on
    // every resize (not just once at open) keeps the whole popup, footer
    // included, inside the viewport as it grows or shrinks.
    effect(() => {
      if (this.isOpen()) {
        this.ensurePopupRendered();
        this.documentRef.addEventListener('pointerdown', this.outsideClickHandler, true);
        setTimeout(() => this.attachResizeObserver());
      } else {
        this.documentRef.removeEventListener('pointerdown', this.outsideClickHandler, true);
        this.detachResizeObserver();
        this.destroyPopupView();
      }
    });
  }

  ngOnDestroy(): void {
    this.documentRef.removeEventListener('pointerdown', this.outsideClickHandler, true);
    this.detachResizeObserver();
    this.destroyPopupView();
    this.destroySuggestView();
  }

  private resizeObserver: ResizeObserver | null = null;
  private popupView: EmbeddedViewRef<unknown> | null = null;
  private popupRenderQueued = false;

  private ensurePopupRendered(): void {
    if (this.popupView) return;
    if (!this.popupTemplateRef) {
      this.queuePopupRender();
      return;
    }
    this.popupView = this.viewContainerRef.createEmbeddedView(this.popupTemplateRef);
    this.popupView.detectChanges();
    for (const node of this.popupView.rootNodes) {
      if (node && typeof (node as Node).nodeType === 'number') {
        this.documentRef.body.appendChild(node as Node);
      }
    }
    setTimeout(() => {
      if (!this.isOpen()) return;
      this.popupView?.detectChanges();
      this.reclampToViewport();
      this.attachResizeObserver();
    }, 0);
  }

  private queuePopupRender(): void {
    if (this.popupRenderQueued) return;
    this.popupRenderQueued = true;
    setTimeout(() => {
      this.popupRenderQueued = false;
      if (this.isOpen()) this.ensurePopupRendered();
    }, 0);
  }

  private destroyPopupView(): void {
    const view = this.popupView;
    this.popupView = null;
    this.popupRenderQueued = false;
    if (!view) return;
    const nodes = [...view.rootNodes] as Node[];
    for (const node of nodes) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    view.destroy();
  }

  private popupRootElement(): HTMLElement | null {
    if (this.popupRootRef?.nativeElement) return this.popupRootRef.nativeElement;
    const view = this.popupView;
    if (!view) return null;
    for (const node of view.rootNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.classList.contains('inventory-line-product-popup')) return node;
      const found = node.querySelector<HTMLElement>('.inventory-line-product-popup');
      if (found) return found;
    }
    return null;
  }

  private attachResizeObserver(): void {
    if (this.resizeObserver || !this.isOpen()) return;
    if (typeof ResizeObserver === 'undefined') return; // e.g. this component's own unit-test environment
    const root = this.popupRootElement();
    if (!root) return;
    this.resizeObserver = new ResizeObserver(() => this.reclampToViewport());
    this.resizeObserver.observe(root);
  }

  private detachResizeObserver(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  protected readonly isOpen = computed(() => this.host.activeLineProductPickerRow() === this.rowIndex);

  private readonly row = computed<string[]>(() => this.host.entryLineRows()[this.rowIndex] ?? []);

  protected readonly productValue = computed(() => this.host.lineCellValue(this.row(), this.column));
  protected readonly productOptions = computed<string[]>(() => this.host.lineColumnOptions(this.column, this.row()));

  protected readonly showVariantStep = computed(() =>
    this.variantColumnIndex >= 0 && this.host.lineColumnAppliesToRow(this.row(), 'Variant')
  );
  protected readonly variantValue = computed(() => this.host.lineCellValue(this.row(), 'Variant'));
  protected readonly variantOptions = computed<string[]>(() => this.host.lineColumnOptions('Variant', this.row()));
  protected readonly variantReadonly = computed(() => !!this.host.lineGridCellReadonly(this.rowIndex, this.row(), 'Variant'));

  protected readonly attrSelections = computed<VariantAttrSelection[]>(() =>
    this.host.lineRowAttrSelections(this.rowIndex, this.row()) || []
  );

  private readonly resolvedProduct = computed(() => this.host.findProductBySelection(this.productValue()));

  private readonly resolvedVariantId = computed<number | null>(() => {
    const product = this.resolvedProduct();
    const variantText = this.variantValue();
    if (!product || !variantText) return null;
    const options: Array<{ id: number; label: string; variant_name: string; aliases: string[] }> = this.host.productVariantOptionObjects(product) || [];
    const match = options.find(option => this.host.productVariantOptionMatches(option, variantText));
    return match?.id ?? null;
  });

  // Mirrors InventoryScreenShell's own resolveLineAttribute(): a single
  // selected attribute passes its bare value ("Red"); two or more join as
  // "Name: Value | Name2: Value2" -- the same composite key format the
  // shell's existing stock-hint code already resolves to for a multi-attribute
  // product, so this panel's numbers line up with what the inline hint shows.
  private readonly currentAttributeValue = computed<string | null>(() => {
    const groups = this.attrSelections().filter(attr => String(attr.value || '').trim());
    if (!groups.length) return null;
    if (groups.length === 1) return groups[0].value;
    return groups.map(attr => `${attr.name}: ${attr.value}`).join(' | ');
  });

  protected readonly currentPickTotal = computed(() =>
    this.currentPickStockRows().reduce((sum, row) => sum + Number(row.available || 0), 0)
  );

  // Full Warehouse/Branch Independence: the product-wide (no warehouseId)
  // available-stock rows split into two independent flat lists -- one entry
  // per WAREHOUSE (rows with warehouse_id set) and one entry per BRANCH
  // (rows that carry their own branch_id directly, warehouse_id NULL).
  // Warehouse and Branch are fully independent location concepts now, so
  // there is no more "warehouse -> its branch" grouping here at all: a
  // warehouse's stock only ever shows up in the By Warehouse list, and a
  // branch's own direct stock only ever shows up in the By Branch list.
  // Each sorted by available descending, mirroring the shell's own
  // otherWarehousesWithStock() sort.
  protected readonly warehouseCards = computed<WarehouseStockCard[]>(() => {
    const rows = this.branchStockRows();
    if (!rows.length) return [];
    const byWarehouse = new Map<string, WarehouseStockCard>();
    for (const stockRow of rows) {
      if (stockRow.warehouse_id == null) continue;
      const available = Number(stockRow.available || 0);
      const warehouseId = Number(stockRow.warehouse_id);
      const key = String(warehouseId);
      if (!byWarehouse.has(key)) {
        byWarehouse.set(key, {
          key,
          warehouseId,
          warehouseName: stockRow.warehouse_name || stockRow.location_name || 'Warehouse',
          available: 0,
          isCurrentWarehouse: this.isActiveSessionWarehouse(warehouseId)
        });
      }
      byWarehouse.get(key)!.available += available;
    }
    return Array.from(byWarehouse.values()).sort((a, b) => b.available - a.available);
  });

  protected readonly branchCards = computed<BranchStockCard[]>(() => {
    const rows = this.branchStockRows();
    if (!rows.length) return [];
    const branches: BranchInvItem[] = this.host.loadedBranchObjects() || [];
    const byBranch = new Map<string, BranchStockCard>();
    for (const stockRow of rows) {
      if (stockRow.branch_id == null) continue;
      const available = Number(stockRow.available || 0);
      const branchIdRef = Number(stockRow.branch_id);
      const branch = branches.find(b => Number(b.branch_id) === branchIdRef || Number(b.id) === branchIdRef);
      const resolvedBranchId = branch ? Number(branch.branch_id ?? branch.id) : branchIdRef;
      const key = String(resolvedBranchId);
      const branchName = branch?.branch_name || stockRow.branch_name || stockRow.location_name || 'Branch';
      if (!byBranch.has(key)) {
        byBranch.set(key, {
          key,
          branchId: resolvedBranchId,
          branchName,
          available: 0,
          isCurrentBranch: this.isActiveSessionBranch(resolvedBranchId)
        });
      }
      byBranch.get(key)!.available += available;
    }
    return Array.from(byBranch.values()).sort((a, b) => b.available - a.available);
  });

  private activeLocationKind(): 'warehouse' | 'branch' | '' {
    const kind = String(sessionStorage.getItem('activeLocationKind') || '').trim().toLowerCase();
    return kind === 'warehouse' || kind === 'branch' ? kind : '';
  }

  // Resolves "Current Warehouse"/"Current Branch" off the transaction's own
  // picked location first -- mirrors InventoryScreenShell's own
  // resolvedProductFilterLocation() key->field convention (kept in sync
  // manually here since the shell doesn't expose that private resolver to
  // this component). Only the config.key values this badge has been wired
  // up for are covered here; any other key (raw resolves to '') falls
  // through to the session-based active-location badge below, unchanged.
  private currentTransactionLocationRaw(): string {
    const key = this.host?.config?.key || '';
    const formValues = this.host?.formValues?.() || {};
    const val = (name: string) => String(formValues?.[name] || '').trim();

    if (key === 'purchaseInvoice') return val('receivingLocation') || val('warehouse');
    if (key === 'stockTransfer') return val('fromWarehouse');
    if (key === 'salesInvoice') {
      const interbranch = val('interbranchSale').toLowerCase() === 'yes';
      return interbranch ? val('branch') : val('warehouse');
    }
    return '';
  }

  private currentTransactionLocation(): { warehouseId: number } | { branchId: number } | null {
    const raw = this.currentTransactionLocationRaw();
    if (!raw) return null;

    const warehouses: WarehouseItem[] = this.host?.loadedWarehouseObjects?.() || [];
    const warehouseMatch = warehouses.find(w => String(w?.warehouse_name || '').trim() === raw);
    if (warehouseMatch?.id != null) return { warehouseId: Number(warehouseMatch.id) };

    const branches: BranchInvItem[] = this.host?.loadedBranchObjects?.() || [];
    const branchMatch = branches.find(b => String(b?.branch_name || '').trim() === raw);
    if (branchMatch) {
      const branchId = Number(branchMatch.branch_id ?? branchMatch.id);
      if (Number.isFinite(branchId)) return { branchId };
    }

    return null;
  }

  private isActiveSessionWarehouse(warehouseId: number | null): boolean {
    if (warehouseId == null) return false;
    const transactionLocation = this.currentTransactionLocation();
    if (transactionLocation) return 'warehouseId' in transactionLocation && transactionLocation.warehouseId === warehouseId;
    const kind = this.activeLocationKind();
    if (kind === 'branch') return false;
    const activeId = Number(sessionStorage.getItem('warehouseId') || 0);
    return activeId > 0 && warehouseId === activeId;
  }

  private isActiveSessionBranch(branchId: number | null): boolean {
    if (branchId == null) return false;
    const transactionLocation = this.currentTransactionLocation();
    if (transactionLocation) return 'branchId' in transactionLocation && transactionLocation.branchId === branchId;
    const kind = this.activeLocationKind();
    if (kind === 'warehouse') return false;
    const activeId = Number(sessionStorage.getItem('branchId') || 0);
    return activeId > 0 && branchId === activeId;
  }

  protected readonly triggerLabel = computed(() => {
    const product = this.productValue();
    if (!product) return '+ Product';
    const parts = [product];
    const variant = this.variantValue();
    if (variant) parts.push(variant);
    const label = parts.join(' — ');
    const attrText = this.attrSelections()
      .filter(attr => String(attr.value || '').trim())
      .map(attr => `${attr.name}: ${attr.value}`)
      .join(', ');
    return attrText ? `${label} — ${attrText}` : label;
  });

  protected readonly triggerTitle = computed(() => this.productValue() ? this.triggerLabel() : 'Add product');

  // Workstream 2 Step A: bold product name + small Variant/Attribute
  // subtitle underneath, matching the saved-records drilldown's own
  // <strong>{{ product }}</strong><br><small class="inventory-grid-subtitle">
  // pattern (grnExpandedProductSubtitle() in the shell). Goes through
  // host.productSubtitleFromParts() -- the exact same join rule that method
  // itself now calls -- so the live grid and the drilldown format Variant +
  // Attribute identically. Attributes without a value yet are excluded, same
  // filter triggerLabel() above already applies for the tooltip text.
  protected readonly triggerSubtitle = computed(() => {
    const attrPairs = this.attrSelections()
      .filter(attr => String(attr.value || '').trim())
      .map(attr => ({ name: attr.name, value: attr.value }));
    // Previous: return this.host.productSubtitleFromParts(this.variantValue(), attrPairs);
    const brand = this.host.productBrandForSummary?.(this.resolvedProduct()) || '';
    return this.host.productSubtitleFromParts(this.variantValue(), attrPairs, brand);
  });

  // The method exists on every screen (it's on the shared shell), so its mere
  // presence proved nothing — addProductFromProcurementGrid() silently returns
  // on any screen with no return route registered, which left this button
  // showing and doing absolutely nothing on most transaction screens. Ask the
  // host whether the trip is actually available instead.
  protected readonly canOpenProductConfig = computed(() => {
    const host = this.host;
    if (!host) return false;
    if (typeof host.canAddProductFromThisScreen === 'function') {
      return !!host.canAddProductFromThisScreen();
    }
    return (
      typeof host.addProductFromLineProductPicker === 'function'
      || typeof host.addProductFromProcurementGrid === 'function'
    );
  });

  // `event` is optional because the popup is now also opened programmatically,
  // straight after a product is chosen in the grid cell, when that product
  // still needs a variant or attribute before the line is complete.
  protected openPopup(event?: MouseEvent): void {
    event?.stopPropagation?.();
    const viewportPadding = 12;
    const estimatedWidth = Math.min(680, window.innerWidth - (viewportPadding * 2));
    const left = Math.min(
      Math.max(viewportPadding, (window.innerWidth - estimatedWidth) / 2),
      Math.max(viewportPadding, window.innerWidth - estimatedWidth - viewportPadding)
    );
    const top = viewportPadding;
    this.popupLeft.set(left);
    this.popupTop.set(top);
    this.host.activeLineProductPickerRow.set(this.rowIndex);
    this.ensurePopupRendered();
    // Re-clamp once against the popup's REAL rendered size next tick --
    // opening flush against the right/bottom edge otherwise only fit the
    // estimated width above, not whatever the content actually measures.
    setTimeout(() => this.reclampToViewport(), 0);
  }

  private reclampToViewport(): void {
    const root = this.popupRootElement();
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const viewportPadding = 12;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
    const maxTop = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
    const left = Math.min(Math.max(viewportPadding, rect.left), maxLeft);
    const top = Math.min(Math.max(viewportPadding, rect.top), maxTop);
    if (left !== rect.left) this.popupLeft.set(left);
    if (top !== rect.top) this.popupTop.set(top);
  }

  protected close(): void {
    if (this.host.activeLineProductPickerRow() === this.rowIndex) {
      this.host.activeLineProductPickerRow.set(null);
    }
  }

  protected stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  protected openProductConfig(event: MouseEvent): void {
    event.stopPropagation();
    const host = this.host;
    this.close();
    if (typeof host?.addProductFromLineProductPicker === 'function') {
      host.addProductFromLineProductPicker();
      return;
    }
    if (typeof host?.addProductFromProcurementGrid === 'function') {
      host.addProductFromProcurementGrid();
    }
  }

  // Item 4 nuance: this popup writes each pick straight through to the row
  // as it happens (host.setEntryLineCell()/setLineAttrValue()) -- that part
  // stays unchanged, since Variant/Attribute options are themselves resolved
  // by re-reading the row (host.lineColumnOptions('Variant', row) etc.), so
  // deferring every write to one final batch would break the cascade. What
  // changes is that the popup no longer closes itself the moment the last
  // field lands a value -- it now only closes (finalizing the row) when the
  // user explicitly clicks "Add Product", gated by canAddProduct() below so
  // the button stays disabled until the pick is actually complete for this
  // product (variant required if the step shows and isn't readonly/prefilled;
  // every non-auto, non-readonly attribute must carry a value -- mirrors
  // exactly which fields the template renders as an editable ng-select vs. a
  // static value).
  protected readonly canAddProduct = computed(() => {
    if (!this.productValue()) return false;
    if (this.showVariantStep() && !this.variantReadonly() && !this.variantValue()) return false;
    return this.attrSelections().every(attr =>
      attr.isAuto || this.isAttributeReadonly(attr.name) || String(attr.value || '').trim().length > 0
    );
  });

  protected addProduct(): void {
    if (!this.canAddProduct()) return;
    this.close();
  }

  /** True once a product is chosen but the line still needs a variant or an
   *  attribute value — i.e. there is genuinely something left to pick. */
  protected readonly needsConfiguration = computed(() =>
    !!this.productValue() && !this.canAddProduct()
  );

  /** Whether this row has a variant/attribute step at all, so the cell only
   *  offers a "configure" affordance on products that actually have one. */
  protected readonly hasConfigurableSteps = computed(() =>
    (this.showVariantStep() && !this.variantReadonly()) ||
    this.attrSelections().some(attr => !attr.isAuto && !this.isAttributeReadonly(attr.name))
  );

  // ── Type-to-search product entry, with inline create ─────────────────────
  // Modelled on app-hsn-sac-picker: the typed text is always kept, matches are
  // offered as you type, and when nothing matches you can create the record
  // without leaving the line. Unlike that picker the search is client-side —
  // products are already loaded in full by the shell (host.lineColumnOptions),
  // so there is no endpoint to call and no debounce to wait through.
  protected readonly searchText = signal('');
  protected readonly searchOpen = signal(false);

  /** What the input shows: the typed query while searching, else the picked product. */
  protected readonly inputValue = computed(() =>
    this.searchOpen() ? this.searchText() : (this.productValue() || '')
  );

  protected readonly matches = computed<string[]>(() => {
    const query = this.searchText().trim().toLowerCase();
    const options = this.productOptions();
    if (!query) return options.slice(0, 12);
    return options.filter(option => option.toLowerCase().includes(query)).slice(0, 12);
  });

  private readonly hasExactMatch = computed(() => {
    const typed = this.searchText().trim().toLowerCase();
    if (!typed) return true;
    return this.productOptions().some(option => option.trim().toLowerCase() === typed);
  });

  /** Offer the Product Master trip only once it is clear nothing matches. */
  protected readonly canQuickAddProduct = computed(() =>
    this.canOpenProductConfig()
    && this.searchText().trim().length >= 2
    && !this.hasExactMatch()
  );

  // ── Suggestion panel placement ───────────────────────────────────────────
  // The panel is rendered into document.body and positioned fixed, because the
  // line grid lives inside .tbl-wrap { overflow-x: auto }: an absolutely
  // positioned child of the cell is CLIPPED at the table's edge regardless of
  // its z-index, so raising z-index alone would not have fixed this. Same
  // reason the ng-select this replaced used appendTo="body", and the same
  // treatment the variant popup already gets.
  protected readonly suggestLeft = signal(0);
  protected readonly suggestTop = signal(0);
  protected readonly suggestWidth = signal(260);

  @ViewChild('suggestRoot') private readonly suggestRootRef?: ElementRef<HTMLElement>;
  @ViewChild('suggestTemplate') private readonly suggestTemplateRef?: TemplateRef<unknown>;
  private suggestView: EmbeddedViewRef<unknown> | null = null;

  // Fixed positioning is relative to the viewport, so the panel has to follow
  // the input when anything scrolls — including the grid's own horizontal
  // scroll, which is why this listens in the capture phase.
  private readonly suggestRepositionHandler = (): void => {
    if (!this.searchOpen()) return;
    this.positionSuggest();
  };

  private readonly suggestOutsideClickHandler = (event: PointerEvent): void => {
    const target = event.target as Element | null;
    if (!target) return;
    if (this.suggestRootRef?.nativeElement.contains(target)) return;
    if (target.closest?.('.inventory-line-product-suggest')) return;
    if (this.triggerBtnRef?.nativeElement.contains(target)) return;
    this.closeSearch(true);
  };

  private positionSuggest(): void {
    const input = this.triggerBtnRef?.nativeElement.querySelector('.inventory-line-product-input') as HTMLElement | null;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const padding = 8;
    const width = Math.max(260, Math.min(420, rect.width));
    const panelHeight = this.suggestRootRef?.nativeElement.getBoundingClientRect().height || 240;

    // Flip above the input when there isn't room below it — a line near the
    // bottom of the screen would otherwise open the panel off-screen.
    const below = rect.bottom + 2;
    const flip = below + panelHeight > window.innerHeight - padding && rect.top - panelHeight > padding;

    this.suggestWidth.set(width);
    this.suggestLeft.set(Math.max(padding, Math.min(rect.left, window.innerWidth - width - padding)));
    this.suggestTop.set(flip ? Math.max(padding, rect.top - panelHeight - 2) : below);
  }

  private ensureSuggestRendered(): void {
    if (this.suggestView || !this.suggestTemplateRef) return;
    this.suggestView = this.viewContainerRef.createEmbeddedView(this.suggestTemplateRef);
    this.suggestView.detectChanges();
    for (const node of this.suggestView.rootNodes) {
      if (node && typeof (node as Node).nodeType === 'number') {
        this.documentRef.body.appendChild(node as Node);
      }
    }
    this.documentRef.addEventListener('pointerdown', this.suggestOutsideClickHandler, true);
    window.addEventListener('scroll', this.suggestRepositionHandler, true);
    window.addEventListener('resize', this.suggestRepositionHandler);
    this.positionSuggest();
    // Re-measure once the real content has laid out, so the flip-above
    // decision uses the panel's actual height rather than the estimate.
    setTimeout(() => {
      if (!this.searchOpen()) return;
      this.suggestView?.detectChanges();
      this.positionSuggest();
    }, 0);
  }

  private destroySuggestView(): void {
    this.documentRef.removeEventListener('pointerdown', this.suggestOutsideClickHandler, true);
    window.removeEventListener('scroll', this.suggestRepositionHandler, true);
    window.removeEventListener('resize', this.suggestRepositionHandler);
    const view = this.suggestView;
    this.suggestView = null;
    if (!view) return;
    for (const node of [...view.rootNodes] as Node[]) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    view.destroy();
  }

  private openSearchPanel(): void {
    this.searchOpen.set(true);
    this.ensureSuggestRendered();
  }
  protected onSearchInput(value: string): void {
    this.searchText.set(value ?? '');
    this.openSearchPanel();
    // Retyping invalidates whatever was highlighted — the list underneath has
    // changed — so the highlight goes back to the first match.
    this.activeIndex.set(this.matches().length ? 0 : -1);
    this.suggestView?.detectChanges();
    this.positionSuggest();
  }

  protected onSearchFocus(): void {
    this.searchText.set(this.productValue() || '');
    this.openSearchPanel();
    this.activeIndex.set(this.matches().length ? 0 : -1);
  }

  /** Closing without a pick must not strand a half-typed value in the cell. */
  protected closeSearch(_force = false): void {
    this.searchOpen.set(false);
    this.searchText.set('');
    this.activeIndex.set(-1);
    this.destroySuggestView();
  }

  protected chooseMatch(value: string): void {
    this.closeSearch(true);
    this.pickProduct(value);
  }

  // ── Keyboard navigation ──────────────────────────────────────────────────
  // The cell is a text box so an unknown product can be typed and created
  // inline, but it still has to FEEL like the dropdown it replaced: arrow keys
  // move through the matches, Enter picks the highlighted one, Escape closes.
  // Without this a user had to leave the keyboard and reach for the mouse on
  // every line, which is the opposite of what a line grid is for.
  protected readonly activeIndex = signal(-1);

  protected onSearchKeydown(event: KeyboardEvent): void {
    const list = this.matches();

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();          // don't let the caret jump in the input
        if (!this.searchOpen()) { this.onSearchFocus(); return; }
        if (!list.length) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // Wraps at both ends, so holding one arrow cycles rather than sticking.
        const next = (this.activeIndex() + step + list.length) % list.length;
        this.activeIndex.set(next);
        this.suggestView?.detectChanges();
        this.scrollActiveIntoView();
        return;
      }

      case 'Enter': {
        const index = this.activeIndex();
        if (!this.searchOpen() || index < 0 || index >= list.length) return;
        // Only swallow Enter when it actually picks something, so a form-level
        // Enter still works when the panel is closed or empty.
        event.preventDefault();
        this.chooseMatch(list[index]);
        return;
      }

      case 'Escape': {
        if (!this.searchOpen()) return;
        event.preventDefault();
        this.closeSearch(true);
        return;
      }

      case 'Tab':
        // Leaving the cell should not strand a half-typed query behind.
        if (this.searchOpen()) this.closeSearch(true);
        return;

      default:
        return;
    }
  }

  /** Keeps the highlighted row visible when arrowing past the panel's edge. */
  private scrollActiveIntoView(): void {
    const root = this.suggestRootRef?.nativeElement;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>('.inventory-line-product-suggest-item');
    items.item(this.activeIndex())?.scrollIntoView({ block: 'nearest' });
  }

  // A product carries far more than a name — nature, base UOM, HSN and GST,
  // category, tracking policies — so it is created on the real Product Master
  // screen rather than through a cut-down inline form that would leave a
  // half-configured record behind. The shell snapshots this in-progress
  // document, carries the typed name over so the form opens part-filled, and
  // brings the user back to THIS cell with the new product already in it.
  protected createInProductMaster(): void {
    const name = this.searchText().trim();
    const pendingLine = { rowIndex: this.rowIndex, columnIndex: this.productColumnIndex, productName: name };
    this.closeSearch(true);
    if (typeof this.host?.addProductFromLineProductPicker === 'function') {
      this.host.addProductFromLineProductPicker(pendingLine);
      return;
    }
    this.host?.addProductFromProcurementGrid?.(undefined, pendingLine);
  }

  protected pickProduct(value: string): void {
    this.host.setEntryLineCell(this.rowIndex, this.productColumnIndex, value);
    if (!value) return;

    // Variant options and attribute rows are derived from the product the host
    // has just been given, so let that settle before deciding whether anything
    // is still outstanding. If it is, go straight into the popup rather than
    // making the user find a second control; if the product needs nothing,
    // the pick is finished here and they can move to the next cell.
    setTimeout(() => {
      if (this.needsConfiguration()) this.openPopup();
    });
  }

  protected pickVariant(value: string): void {
    if (this.variantColumnIndex < 0) return;
    this.host.setEntryLineCell(this.rowIndex, this.variantColumnIndex, value);
  }

  protected pickAttribute(name: string, value: string | null): void {
    this.host.setLineAttrValue(this.rowIndex, name, value);
  }

  protected isAttributeReadonly(attrName: string): boolean {
    return !!this.host.lineGridCellReadonly(this.rowIndex, this.row(), attrName);
  }
}
