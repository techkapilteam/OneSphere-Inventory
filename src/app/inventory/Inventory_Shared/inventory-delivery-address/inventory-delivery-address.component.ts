import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

// Shared "Delivery Address" fieldset — one implementation used by every
// transaction screen that lets the user enter a delivery address different
// from the party's own master address (Sales Order, Sales Invoice, Delivery
// Challan), instead of each screen carrying its own copy of the same eight
// fields. The Yes/No switch and all field state live on the host screen's
// own InventoryScreenShell (deliveryAddressEnabled()/toggleDeliveryAddress()
// and the plain formValues() 'delivery*' keys) — this component is a thin
// template wrapper around that shared state, bound via [host]="this" the
// same way app-inventory-quick-add-modal is.
@Component({
  selector: 'app-inventory-delivery-address',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './inventory-delivery-address.component.html'
})
export class InventoryDeliveryAddressComponent {
  @Input({ required: true }) host!: any;
  // Sales Invoice only: "Ship Address same as Full Delivery Address" switch
  // (host.shipSameAsDelivery()/toggleShipSameAsDelivery(), formValues
  // 'shipAddress') shown inside this section.
  @Input() showShipAddress = false;
}
