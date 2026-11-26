import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InventoryLeaseBillingComponent } from './lease-billing';

// Billing: pick the customer (shared picker), then the running contracts grid; no tabs / bulk mode.
describe('InventoryLeaseBillingComponent (shared shell)', () => {
  it('renders the customer picker and the ready-to-invoice grid only', async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryLeaseBillingComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), DatePipe]
    }).compileComponents();
    const fixture = TestBed.createComponent(InventoryLeaseBillingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.bodyFieldByKey('customer')?.addMaster).toBe('Customer');
    expect(el.textContent).toContain('Ready to Invoice');
    expect(el.textContent).toContain('Billing History');
    expect(el.textContent).not.toContain('All due contracts');
    expect(el.textContent).not.toContain('One contract');
  });
});
