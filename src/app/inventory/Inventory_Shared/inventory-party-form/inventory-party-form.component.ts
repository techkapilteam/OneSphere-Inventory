import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { InventoryBankDetailsComponent } from '../inventory-bank-details/inventory-bank-details.component';
import { InventoryGstinListComponent } from '../inventory-gstin-list/inventory-gstin-list.component';

// Items 24/25: the single Vendor/Customer field set, shared between the
// real Master screens (vendor-master.html/customer-master.html) and the
// quick-add modal's Vendor/Customer branches, which previously hand-
// maintained a reduced, drifted-apart copy (missing Payment Terms,
// structured Bank Details, Shipping Address, Contact Person Mapping).
// Thin-wrapper convention like app-inventory-bank-details: reads/writes
// the host screen's own formValues()/collectFormField() rather than a
// private FormGroup, so both a Master screen and a transaction screen's
// quick-add modal can embed it identically.
@Component({
  selector: 'app-inventory-party-form',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule, InventoryGstinListComponent, InventoryBankDetailsComponent],
  templateUrl: './inventory-party-form.component.html'
})
export class InventoryPartyFormComponent {
  @Input({ required: true }) host!: any;
  @Input({ required: true }) partyKind!: 'vendor' | 'customer' | 'channelPartner';
  @Input() partyLabel = 'Vendor';
  // '' on Master (unprefixed keys, matches today's saved data exactly);
  // 'quickVendor'/'quickCustomer' inside the quick-add modal, so this
  // shares the host transaction screen's own formValues() bag without
  // colliding with its top-level fields (e.g. Sales Order's own
  // 'customer' field vs this component's pfx('name')).
  @Input() keyPrefix = '';
  // Master binds Name/Code through formValues() (no separate free-text
  // Name field -- picking a Global Contact IS how Name gets set); quick-add
  // binds through the shared quickAddName()/quickAddCode() signals used by
  // every other quick-add master type, plus its own free-text Name input
  // for genuinely new parties not yet in Global Contact.
  @Input() nameCodeMode: 'formValues' | 'quickAddSignals' = 'formValues';

  private readonly categoryOptionsByKind: Record<'vendor' | 'customer' | 'channelPartner', string[]> = {
    vendor: ['Supplier', 'Service Provider', 'Contractor', 'Manufacturer', 'Broker', 'Channel Partner', 'Food Supplier', 'Beverage Supplier'],
    customer: ['Dealer', 'Corporate Client', 'Tenant', 'Property Buyer', 'Project Client', 'Restaurant Guest', 'Banquet Client', 'Hotel Guest'],
    channelPartner: ['Referral Partner', 'Broker', 'Dealer', 'Affiliate', 'Channel Partner', 'Distributor']
  };

  get categoryOptions(): string[] {
    return this.categoryOptionsByKind[this.partyKind];
  }

  // Quick-add Vendor (the (+) beside Party / Vendor on transaction screens):
  // PAN and at least one GSTIN / State row are mandatory -- enforced in
  // host.saveQuickVendor(); this only drives the asterisks.
  get taxIdsRequired(): boolean {
    return this.nameCodeMode === 'quickAddSignals' && this.partyKind === 'vendor';
  }

  get showPriceList(): boolean {
    return this.partyKind === 'customer';
  }

  pfx(field: string): string {
    return this.keyPrefix ? this.keyPrefix + field[0].toUpperCase() + field.slice(1) : field;
  }

  // Master kept its historical, party-kind-specific key ('vendorCategory'
  // vs 'customerCategory', a pre-existing quirk from before this
  // component existed) so existing saved data needs no migration;
  // quick-add never had a Category field before this rebuild, so it gets
  // a clean prefixed key instead.
  categoryKey(): string {
    if (this.keyPrefix) return this.pfx('category');
    if (this.partyKind === 'vendor') return 'vendorCategory';
    if (this.partyKind === 'channelPartner') return 'partnerCategory';
    return 'customerCategory';
  }

  selectedContact(): any {
    if (this.nameCodeMode === 'quickAddSignals') {
      if (this.partyKind === 'vendor') return this.host.quickVendorLinkedContact();
      if (this.partyKind === 'channelPartner') return this.host.quickChannelPartnerLinkedContact();
      return this.host.quickCustomerLinkedContact();
    }
    return this.host.selectedPartyContact();
  }

  onContactChange(contact: any): void {
    if (this.nameCodeMode === 'quickAddSignals') {
      if (this.partyKind === 'vendor') this.host.selectQuickVendorContact(contact);
      else if (this.partyKind === 'channelPartner') this.host.selectQuickChannelPartnerContact(contact);
      else this.host.selectQuickCustomerContact(contact);
    } else {
      this.host.selectPartyContact(contact);
    }
  }
}
