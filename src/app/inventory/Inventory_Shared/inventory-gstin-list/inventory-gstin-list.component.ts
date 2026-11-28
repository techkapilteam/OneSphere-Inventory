import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';

export interface PartyGstinRow {
  stateName: string;
  stateCode: string | null;
  gstin: string;
  isPrimary: boolean;
}

// Shared "GSTIN / State" repeatable list -- item 6: a Vendor/Customer can
// legitimately hold GST registrations in more than one state, so a single
// flat GSTIN field on the party master isn't enough. Lives on Vendor Master
// and Customer Master, same thin-wrapper convention as
// app-inventory-bank-details: bound via [host]="this", reading/writing the
// host screen's own formValues()/collectFormField('gstins', rows) rather
// than a private FormGroup.
//
// Field names here are deliberately camelCase, not the snake_case the SQL
// layer itself uses: this array round-trips through the .NET controller
// (VendorUpsertRequest.Gstins / List<PartyGstinDto>), and ASP.NET Core's
// default System.Text.Json model binder (PropertyNamingPolicy.CamelCase,
// PropertyNameCaseInsensitive) only matches camelCase JSON keys to PascalCase
// C# properties -- a snake_case key like state_name silently fails to bind
// and the field comes through as null, confirmed by direct test against
// System.Text.Json with ASP.NET Core's exact default options. The snake_case
// conversion for Postgres (state_name, is_primary) happens on the .NET side,
// inside InventoryDataService's own _jsonOptions (SnakeCaseLower) when it
// calls sp_upsert_vendor/sp_upsert_customer -- a separate serialization hop
// this component never touches.
//
// One row is always flagged Primary -- that's the value the backend mirrors
// back onto the party's own flat gstin column so every other existing
// consumer of that column (PO/GRN/PI header auto-fill,
// fn_is_interstate_transaction) keeps working unchanged.
@Component({
  selector: 'app-inventory-gstin-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './inventory-gstin-list.component.html'
})
export class InventoryGstinListComponent {
  @Input({ required: true }) host!: any;
  // '' on Vendor/Customer Master (unprefixed 'gstins' key, unchanged from
  // before); 'quickVendor'/'quickCustomer' inside the quick-add modal.
  @Input() keyPrefix = '';
  // Quick-add Vendor: at least one GSTIN / State row is mandatory (enforced
  // in host.saveQuickVendor()); this only drives the asterisk.
  @Input() required = false;

  private key(): string {
    return this.keyPrefix ? this.keyPrefix + 'Gstins' : 'gstins';
  }

  rows(): PartyGstinRow[] {
    const value = this.host.formValues()[this.key()];
    return Array.isArray(value) ? value : [];
  }

  addRow(): void {
    const next: PartyGstinRow[] = [
      ...this.rows(),
      { stateName: '', stateCode: null, gstin: '', isPrimary: this.rows().length === 0 }
    ];
    this.host.collectFormField(this.key(), next);
  }

  removeRow(index: number): void {
    const current = this.rows();
    const removedWasPrimary = current[index]?.isPrimary;
    const next = current.filter((_, i) => i !== index);
    if (removedWasPrimary && next.length && !next.some(row => row.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    this.host.collectFormField(this.key(), next);
  }

  setState(index: number, stateName: string): void {
    this.updateRow(index, { stateName });
  }

  setGstin(index: number, value: string): void {
    const normalized = (value || '').toUpperCase().replace(/\s+/g, '').slice(0, 15);
    const stateCode = normalized.length === 15 && /^[0-9]{2}/.test(normalized) ? normalized.slice(0, 2) : null;
    this.updateRow(index, { gstin: normalized, stateCode });
  }

  setPrimary(index: number): void {
    const next = this.rows().map((row, i) => ({ ...row, isPrimary: i === index }));
    this.host.collectFormField(this.key(), next);
  }

  private updateRow(index: number, patch: Partial<PartyGstinRow>): void {
    const next = this.rows().map((row, i) => (i === index ? { ...row, ...patch } : row));
    this.host.collectFormField(this.key(), next);
  }
}
