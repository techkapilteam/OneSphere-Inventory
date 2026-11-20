import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InventoryLeaseContractsComponent } from './lease-contracts';

// The lease contract screen sits on the shared screen shell (customer picker, quick-add modal), so it
// must construct, render and expose the same customer field the Sales screens use.
describe('InventoryLeaseContractsComponent (shared shell)', () => {
  it('renders the transaction-style header with the shared customer field and quick-add modal', async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryLeaseContractsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), DatePipe]
    }).compileComponents();

    const fixture = TestBed.createComponent(InventoryLeaseContractsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.inventory-transaction-header')).toBeTruthy();
    expect(fixture.componentInstance.bodyFieldByKey('customer')?.addMaster).toBe('Customer');
    expect(el.textContent).toContain('Leased Assets');
    // the exact installation site uses the shared address block
    expect(el.textContent).toContain('Customer Address & Installation Site');
    // meter items use the shared product picker (variant / attribute steps) on the shell's product rows
    expect(el.querySelector('app-inventory-line-product-picker')).toBeTruthy();
    // no contract type / rent item any more: rent is per asset
    expect(el.textContent).not.toContain('Rent Item');
    expect(el.textContent).toContain('Rental Unit');
    expect(el.textContent).toContain('Existing Lease Contracts');
    // the customer "+" is the shared quick-add button
    expect(el.querySelector('.inventory-field-with-add button[title="Add Customer"]')).toBeTruthy();
  });
});
