import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { PaymentReceiptVoucherComponent } from './payment-receipt-voucher';
import { PaymentsService, VendorFyPurchaseSummary } from '../../Inventory_Shared/payments.service';

// Item 22: "TCS ... applicable only for a Vendor who has transacted with us
// more than 50 lakhs in a single financial year. It will be enabled for
// them ... show the hint ... provide a small text box to enter the
// percentage ... show the TCS value for deduction."
//
// Unlike item 21's TDS (per-invoice Service gate, rate from a master),
// this is vendor-level (fetched once per selected party, not per
// allocation) and the percentage is manually typed, no rate lookup.
describe('PaymentReceiptVoucherComponent — TCS vendor FY threshold (item 22)', () => {
  let fixture: ComponentFixture<PaymentReceiptVoucherComponent>;
  let component: PaymentReceiptVoucherComponent;

  const CROSSED: VendorFyPurchaseSummary = {
    vendor_id: 1, financial_year: '2026-2027', cumulative_purchase_amount: 5200000,
    threshold_amount: 5000000, threshold_crossed: true
  };
  const NOT_CROSSED: VendorFyPurchaseSummary = {
    vendor_id: 2, financial_year: '2026-2027', cumulative_purchase_amount: 1200000,
    threshold_amount: 5000000, threshold_crossed: false
  };

  function build(summary: VendorFyPurchaseSummary | null): void {
    const stub: Partial<PaymentsService> = {
      getPaymentVouchers: () => of({ success: true, data: [] }) as any,
      getOutstandingInvoices: () => of({ success: true, data: [] }) as any,
      getPartyLedgerBalance: () => of({ success: true, data: 0 }) as any,
      getTdsCodes: () => of({ success: true, data: [] }) as any,
      getAvailableNotes: () => of({ success: true, data: [] }) as any,
      getVendorFyPurchaseSummary: () => of({ success: true, data: summary }) as any,
      // The component loads the Accounts bank/cheque-book masters on construction.
      getPaymentVoucherAccountSetup: () => of({ banks: [], depositBanks: [], onlinePaymentTypes: [] }) as any,
      getPaymentVoucherBankDetails: () => of({ chequeNumbers: [], upiNames: [] }) as any
    };
    TestBed.configureTestingModule({
      imports: [PaymentReceiptVoucherComponent],
      providers: [
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: { data: of({ mode: 'pay' }) } },
        { provide: PaymentsService, useValue: stub }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentReceiptVoucherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.parties.set([{ id: 1, vendor_name: 'Acme Supplies' } as any, { id: 2, vendor_name: 'Small Vendor' } as any]);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('is not applicable before a vendor is selected', () => {
    build(null);
    expect(component.tcsThresholdCrossed()).toBe(false);
  });

  it('becomes applicable once the selected vendor has crossed ₹50L this FY', () => {
    build(CROSSED);
    component.onPartyChange(1);
    fixture.detectChanges();
    expect(component.vendorFySummary()).toEqual(CROSSED);
    expect(component.tcsThresholdCrossed()).toBe(true);
  });

  it('stays inapplicable for a vendor under the threshold', () => {
    build(NOT_CROSSED);
    component.onPartyChange(2);
    fixture.detectChanges();
    expect(component.tcsThresholdCrossed()).toBe(false);
  });

  it('is never applicable in receipt mode', () => {
    build(CROSSED);
    (component as any).mode.set('receipt');
    component.onPartyChange(1);
    fixture.detectChanges();
    expect(component.tcsThresholdCrossed()).toBe(false);
  });

  it('is zero until a percentage is actually typed, even though applicable', () => {
    build(CROSSED);
    component.onPartyChange(1);
    fixture.detectChanges();
    expect(component.tcsThresholdCrossed()).toBe(true);
    expect(component.tcsAmount()).toBe(0);
  });

  it('computes the TCS amount from the manually-typed percentage x the payment amount', () => {
    build(CROSSED);
    component.onPartyChange(1);
    component.quickAmount.set(100000);
    component.setTcsPercentage('1');
    fixture.detectChanges();
    expect(component.tcsAmount()).toBeCloseTo(1000, 2);
  });

  it('recomputes live as the percentage input changes', () => {
    build(CROSSED);
    component.onPartyChange(1);
    component.quickAmount.set(100000);
    component.setTcsPercentage('1');
    fixture.detectChanges();
    expect(component.tcsAmount()).toBeCloseTo(1000, 2);
    component.setTcsPercentage('0.5');
    fixture.detectChanges();
    expect(component.tcsAmount()).toBeCloseTo(500, 2);
  });

  it('resets the FY summary and typed percentage when switching to a different vendor', () => {
    build(CROSSED);
    component.onPartyChange(1);
    component.setTcsPercentage('1');
    fixture.detectChanges();
    expect(component.tcsPercentageInput()).toBe('1');

    component.onPartyChange(null);
    fixture.detectChanges();
    expect(component.vendorFySummary()).toBeNull();
    expect(component.tcsPercentageInput()).toBe('');
    expect(component.tcsThresholdCrossed()).toBe(false);
  });

  it('save() does not require a TCS percentage even when the threshold is crossed (it is an optional deduction, not mandatory)', () => {
    build(CROSSED);
    component.onPartyChange(1);
    component.quickAmount.set(50000);
    component.addMode();
    fixture.detectChanges();
    component.save();
    expect(component.saveError()).not.toContain('TCS');
  });
});
