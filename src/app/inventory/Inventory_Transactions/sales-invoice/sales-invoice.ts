import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { DatePickerModule } from 'primeng/datepicker';
import { InventoryScreenShell } from '../../Inventory_Shared/inventory-screen-shell/inventory-screen-shell';
import { salesInvoiceConfig } from '../../Inventory_Shared/inventory-screen.model';
import { OutstandingInvoice } from '../../Inventory_Shared/payments.service';
import { InventoryQuickAddModalComponent } from '../../Inventory_Shared/inventory-quick-add-modal/inventory-quick-add-modal.component';
import { InventorySerialPickerModalComponent } from '../../Inventory_Shared/inventory-serial-picker-modal/inventory-serial-picker-modal.component';
import { InventoryDeliveryAddressComponent } from '../../Inventory_Shared/inventory-delivery-address/inventory-delivery-address.component';
import { InventoryTransportDetailsComponent } from '../../Inventory_Shared/inventory-transport-details/inventory-transport-details.component';
import { InventoryLineProductPickerComponent } from '../../Inventory_Shared/inventory-line-product-picker/inventory-line-product-picker.component';

// Transport Details used to be a Sales-Invoice-only toggle
// (transportDetailsEnabled()/toggleTransportDetails(), backed by plain
// transportMode/vehicleNo formValues() keys) defined here. It's now the
// shared app-inventory-transport-details component (see sales-invoice.html)
// backed by inventory.inv_transport_details and InventoryScreenShell's own
// transportDetailsForm()/transportDetailsSectionEnabled(), the same
// component used across every other goods-moving transaction screen —
// so this subclass no longer needs an override of its own.
@Component({
  selector: 'app-inventory-sales-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule, DatePickerModule, InventoryScreenShell, InventoryQuickAddModalComponent, InventorySerialPickerModalComponent, InventoryDeliveryAddressComponent, InventoryTransportDetailsComponent, InventoryLineProductPickerComponent],
  templateUrl: './sales-invoice.html',
  styles: [`
    // Product Picker popup pilot: this screen's Product column swapped its
    // wide ng-select (+ nested Variant/Attribute sub-selects) for the
    // compact <app-inventory-line-product-picker> trigger button, so the
    // column/row no longer need the width/height the old dropdown required.
    // Scoped to .sales-invoice-line-grid only (added alongside
    // .inventory-line-items in sales-invoice.html) -- mirrors Purchase
    // Invoice's own proven per-screen compaction pattern instead of editing
    // either repo's shared styles.scss, which every other (non-pilot)
    // screen's still-wide dropdown still relies on.
    :host ::ng-deep .sales-invoice-line-grid .erp-table.compact th.inventory-line-col-product,
    :host ::ng-deep .sales-invoice-line-grid .erp-table.compact td.inventory-line-col-product {
      min-width: 200px;
      width: 200px;
    }

    :host ::ng-deep .sales-invoice-line-grid .erp-table.compact td.inventory-line-col-product {
      padding: 5px 4px !important;
      vertical-align: top;
    }

    :host ::ng-deep .sales-invoice-line-grid .inventory-line-product-trigger {
      min-height: 30px;
      padding: 0 8px;
      border-radius: 6px;
      font-size: 12px;
    }
  `]
})
export class InventorySalesInvoiceComponent extends InventoryScreenShell {
  override readonly config = salesInvoiceConfig;

  // Previous Balance: what the customer still owes on earlier posted Sales
  // Invoices — the same outstanding list Customer Receipt reads, so a
  // customer with no earlier invoice (or all paid) shows 0. The invoice
  // being edited is left out of its own previous balance.
  private readonly previousBalanceCustomerId = computed(() => {
    const values = this.formValues();
    return this.findCustomerBySelection(values['customer'])?.id ?? this.optionalNumber(values['customerId']);
  });
  private readonly customerOutstanding = signal<OutstandingInvoice[]>([]);
  readonly previousBalance = computed(() => {
    const editing = this.editingId();
    return this.customerOutstanding()
      .filter(inv => inv.invoice_id !== editing)
      .reduce((sum, inv) => sum + (Number(inv.outstanding) || 0), 0);
  });

  constructor() {
    super();
    effect(onCleanup => {
      const customerId = this.previousBalanceCustomerId();
      this.customerOutstanding.set([]);
      if (!customerId) return;
      const sub = this.paymentsService.getOutstandingInvoices('customer', customerId).subscribe({
        next: res => this.customerOutstanding.set(res.data ?? []),
        error: () => this.customerOutstanding.set([])
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  balanceText(value: number): string {
    const amount = Math.round(value * 100) / 100;
    return Number.isInteger(amount)
      ? `Rs. ${amount.toLocaleString('en-IN')}`
      : `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Post (not Save Draft) opens the posted Sales Invoice as a PDF in a new
  // browser tab, same as Purchase Invoice. The saved record from the API
  // already carries the lines, so no row has to be expanded first.
  protected override afterConfigRecordSaved(savedRecord: any, payload: Record<string, any>, forceDocumentStatus?: 'draft' | 'posted' | 'sent'): void {
    super.afterConfigRecordSaved(savedRecord, payload, forceDocumentStatus);
    if (forceDocumentStatus === 'posted' && (savedRecord?.items || []).length) {
      this.printAutoGeneratedDocument('salesInvoice', savedRecord);
    }
  }
}
