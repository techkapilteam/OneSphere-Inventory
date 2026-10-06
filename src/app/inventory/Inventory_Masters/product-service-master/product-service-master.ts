import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { productServiceMasterConfig } from '../../Inventory_Shared/inventory-screen.model';
import { ProductItem } from '../../Inventory_Shared/inventory-config.service';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { HsnSacPickerComponent } from '../../Inventory_Shared/hsn-sac-picker/hsn-sac-picker.component';

@Component({
  selector: 'app-inventory-product-service-master',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent, HsnSacPickerComponent],
  templateUrl: './product-service-master.html'
})
export class InventoryProductServiceMasterComponent extends InventoryScreenShell {
  override readonly config = productServiceMasterConfig;

  readonly pickedVariantId = signal<number | null>(null);
  readonly productNatureGuideVisible = signal(false);

  readonly productMasterSections: { id: string; label: string }[] = [
    { id: 'pm-section-basic', label: 'Basic Product Details' },
    { id: 'pm-section-tax', label: 'Tax Details' },
    { id: 'pm-section-brand', label: 'Brand, Variant & Valuation' },
    { id: 'pm-section-bundle', label: 'Bundle Composition' },
    { id: 'pm-section-stock', label: 'Stock Controls' },
    { id: 'pm-section-tracking', label: 'Tracking Policies' },
    { id: 'pm-section-additional', label: 'Additional Information' },
    { id: 'pm-section-uom', label: 'Alternate UOM' },
  ];
  readonly productMasterActiveSection = signal<string>('pm-section-basic');

  private pmTabsPinned = false;
  private readonly onProductMasterTabsScroll = () => this.syncProductMasterTabsPin();

  constructor() {
    super();
    // Product natures arrive asynchronously (GET /inventory/config/product-types),
    // so apply the default once they're loaded. untracked() keeps this effect
    // from re-running on every form edit -- it only reacts to the natures list.
    effect(() => {
      if (!this.productNatureObjects.length) return;
      untracked(() => this.applyDefaultProductNature());
    });
  }

  // A fresh form (after Save or Clear) gets the default nature again.
  override clearConfigForm(): void {
    super.clearConfigForm();
    this.applyDefaultProductNature();
  }

  // New products default to "Physical Stock". Never overrides a nature that is
  // already set (editing a saved product, or the BOM "Add Product" return flow).
  private applyDefaultProductNature(): void {
    if (this.editingId() !== null) return;
    const values = this.formValues();
    if (values['productNatureId'] || values['productNatureName']) return;
    const nature = this.productNatureObjects.find(n =>
      String(n.type_name || '').trim().toLowerCase() === 'physical stock'
    );
    if (nature) this.onProductNatureChange(nature.id);
  }

  override ngAfterViewInit(): void {
    super.ngAfterViewInit();
    document.querySelector('.content-area')?.addEventListener('scroll', this.onProductMasterTabsScroll, { passive: true } as AddEventListenerOptions);
    window.addEventListener('resize', this.onProductMasterTabsScroll);
    this.syncProductMasterTabsPin();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    document.querySelector('.content-area')?.removeEventListener('scroll', this.onProductMasterTabsScroll);
    window.removeEventListener('resize', this.onProductMasterTabsScroll);
  }

  scrollToProductSection(id: string): void {
    this.productMasterActiveSection.set(id);
    const target = document.getElementById(id);
    const scrollEl = document.querySelector<HTMLElement>('.content-area');
    if (!target) return;
    if (!scrollEl) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Compute the scroll offset directly instead of relying on scroll-margin-top +
    // scrollIntoView: the fixed breadcrumb + tab-bar height is only known at click
    // time, so measuring it here keeps the target's heading from landing behind them.
    const breadcrumbHeight = document.querySelector<HTMLElement>('.breadcrumb-bar')?.getBoundingClientRect().height || 0;
    const tabsHeight = document.getElementById('pm-tabs-bar')?.getBoundingClientRect().height || 0;
    const headerHeight = breadcrumbHeight + tabsHeight + 12;

    const targetOffset = target.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    scrollEl.scrollTo({ top: Math.max(targetOffset - headerHeight, 0), behavior: 'smooth' });
  }

  // Belt-and-suspenders pin: keeps the tab bar visually fixed just below .breadcrumb-bar
  // using measured viewport coordinates, independent of whatever ancestor CSS the
  // shared shell/layout happens to apply (position:sticky alone was not reliably
  // staying pinned across the app's nested grid/flex wrappers).
  private syncProductMasterTabsPin(): void {
    const bar = document.getElementById('pm-tabs-bar');
    const spacer = document.getElementById('pm-tabs-spacer');
    if (!bar || !spacer) return;

    const breadcrumb = document.querySelector<HTMLElement>('.breadcrumb-bar');
    const topOffset = breadcrumb ? breadcrumb.getBoundingClientRect().bottom : 0;

    if (!this.pmTabsPinned) {
      const rect = bar.getBoundingClientRect();
      if (rect.top > topOffset) return;
      this.pmTabsPinned = true;
      spacer.style.height = `${rect.height}px`;
      bar.style.position = 'fixed';
      bar.style.left = `${rect.left}px`;
      bar.style.width = `${rect.width}px`;
      bar.style.top = `${topOffset}px`;
      bar.style.margin = '0';
      bar.style.zIndex = '150';
    } else {
      const spacerRect = spacer.getBoundingClientRect();
      if (spacerRect.top > topOffset) {
        this.pmTabsPinned = false;
        bar.style.position = '';
        bar.style.left = '';
        bar.style.width = '';
        bar.style.top = '';
        bar.style.margin = '';
        bar.style.zIndex = '';
        spacer.style.height = '0';
      } else {
        bar.style.top = `${topOffset}px`;
        bar.style.left = `${spacerRect.left}px`;
        bar.style.width = `${spacerRect.width}px`;
      }
    }
  }

  readonly pickedVariantPreview = computed(() => {
    const id = this.pickedVariantId();
    if (!id) return null;
    const v = this.variantObjects().find(o => o.id === id);
    if (!v) return null;
    const attrItems: { name: string; value: string }[] = (v.attributes || []).length
      ? (v.attributes!).map(a => ({ name: String(a.attribute_name || '').trim(), value: String(a.attribute_value || '').trim() })).filter(a => a.name)
      : v.attribute_name ? [{ name: v.attribute_name, value: v.attribute_value || '' }] : [];
    return { variant: v, attrItems };
  });

  readonly pickedAlreadyAdded = computed(() => {
    const id = this.pickedVariantId();
    return id ? this.selectedApplicableVariants().some(av => av.id === id) : false;
  });

  readonly selectedProductNature = computed(() => {
    const id = this.formValues()['productNatureId'];
    return id ? this.productNatureObjects.find(n => n.id === id) ?? null : null;
  });

  readonly productNatureGuideRows = computed(() =>
    this.productNatureObjects.map(nature => {
      const name = nature.type_name || '';
      const key = name.toLowerCase();
      let impact = nature.description || 'Controls stock, cost, purchase, sale and transaction behavior for this product.';

      if (key === 'physical stock') {
        impact = 'Normal stock item. GRN/opening stock increases stock, sales/dispatch/issue reduces stock, valuation and reorder controls apply.';
      } else if (key === 'raw material') {
        impact = 'Purchased input for production. Stock and cost are tracked, BOM/production can consume it, and it is normally not sold directly.';
      } else if (key === 'finished product' || key === 'finished goods') {
        impact = 'Manufactured output. Production Entry adds it into physical stock, and it becomes available for Sales when sale is allowed.';
      } else if (key === 'sub-finished product' || key === 'semi-finished goods' || key === 'semi-finished / wip') {
        impact = 'Intermediate manufactured stock. Production Entry can create it, and a later BOM or Material Issue can consume it for another finished product.';
      } else if (key === 'consumable') {
        impact = 'Internal-use stock item. Purchased into inventory, issued/consumed by departments or operations, usually not treated as a sales item.';
      } else if (key === 'fixed asset') {
        impact = 'Capital asset. Purchase and stock/serial identity can be tracked, but it is not normal sales stock; useful for asset/service-bundle mapping.';
      } else if (key === 'service') {
        impact = 'Non-stock service. No warehouse stock movement; used for purchase/sales billing, SAC/GST, pricing type and rental/service billing.';
      } else if (key === 'service bundle') {
        impact = 'Sellable package made from mapped assets/services/consumables. The bundle itself has no stock ledger; mapped child items carry tracking.';
      } else if (key === 'digital / subscription') {
        impact = 'Non-physical item or subscription. No warehouse stock movement; used for digital billing, renewals or subscription-style sales/purchase.';
      }

      return {
        id: nature.id,
        name,
        code: nature.type_code,
        impact,
        flags: [
          nature.tracks_inventory ? 'Stock' : 'No Stock',
          nature.tracks_cost ? 'Cost' : 'No Cost',
          nature.allows_purchase ? 'Purchase' : 'No Purchase',
          nature.allows_sale ? 'Sale' : 'No Sale',
          nature.allows_production ? 'Production' : '',
          nature.is_service ? 'Service' : '',
          nature.is_asset ? 'Asset' : ''
        ].filter(Boolean)
      };
    })
  );

  readonly productNatureHints = computed(() => {
    const nature = this.selectedProductNature();
    if (!nature) return [];
    const hints: string[] = this.productNatureGuideRows()
      .filter(row => row.id === nature.id)
      .map(row => row.impact);
    if (nature.tracks_inventory === false) hints.push('Not tracked as stock for this nature.');
    if (nature.allows_production) hints.push('Can be used by manufacturing BOM, planning, issue or output screens depending on the product nature.');
    if (nature.allows_sale === false) hints.push('Not directly sellable - excluded from Sales product pickers.');
    return hints;
  });

  readonly selectedVariantAttributeHint = computed(() =>
    this.selectedApplicableVariantRows()
      .map(av => av.attribute_summary)
      .filter(s => !!s)
      .join(' | ')
  );

  private static readonly PRICING_TYPE_VISIBLE_NATURES = new Set(['Service', 'Service Bundle', 'Digital / Subscription']);
  private static readonly BUNDLE_ELIGIBLE_NATURES = new Set(['Fixed Asset', 'Service', 'Consumable']);

  readonly pricingTypeVisible = computed(() => {
    const natureName = this.selectedProductNature()?.type_name;
    return !!natureName && InventoryProductServiceMasterComponent.PRICING_TYPE_VISIBLE_NATURES.has(natureName);
  });

  readonly rentalUnitVisible = computed(() =>
    this.pricingTypeVisible() && this.formValues()['pricingType'] === 'Rental'
  );

  readonly bundleCompositionVisible = computed(() =>
    this.selectedProductNature()?.type_name === 'Service Bundle'
  );

  readonly bundleSectionExpanded = signal(true);

  readonly bundleEligibleProductOptions = computed(() =>
    this.loadedProductObjects().filter(p =>
      !!p.product_nature_name && InventoryProductServiceMasterComponent.BUNDLE_ELIGIBLE_NATURES.has(p.product_nature_name) && p.id !== this.editingId()
    )
  );

  findBundleEligibleProductById(id: number | null): ProductItem | null {
    if (!id) return null;
    return this.bundleEligibleProductOptions().find(p => p.id === id) ?? null;
  }

  addPickedVariant(): void {
    const id = this.pickedVariantId();
    if (!id || this.pickedAlreadyAdded()) return;
    this.onApplicableVariantIdsChange([...this.selectedApplicableVariantIds(), id]);
    this.pickedVariantId.set(null);
  }
}
