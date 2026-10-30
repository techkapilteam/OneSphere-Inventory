import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { PaymentReceiptVoucherComponent } from './payment-receipt-voucher';
import { PaymentsService, TdsCode } from '../../Inventory_Shared/payments.service';
import { defaultPaymentModeValue } from '../../../shared/payment-mode-selector/payment-mode-selector.component';

// Item 21: "TDS is applicable only for Services and should be shown
// automatically with the percentage and amount." Pins down: TDS only
// surfaces when a selected allocation carries a Service line
// (has_service_item), never on a Receipt; section options and rates come
// from the live taxation.tds_codes fetch (with a hardcoded fallback only if
// that comes back empty); the amount is a pure computed derivation, never
// manually typed; deselecting the Service invoice clears a stale section pick.
describe('PaymentReceiptVoucherComponent — TDS auto-apply for Services (item 21)', () => {
  let fixture: ComponentFixture<PaymentReceiptVoucherComponent>;
  let component: PaymentReceiptVoucherComponent;

  const SERVICE_INVOICE = {
    invoice_type: 'purchase_invoice', invoice_id: 501, invoice_number: 'PI-501',
    subtotal_amount: 10000, tax_amount: 1800, total_amount: 11800, paid_amount: 0,
    outstanding: 11800, has_service_item: true
  };
  const GOODS_INVOICE = {
    invoice_type: 'purchase_invoice', invoice_id: 502, invoice_number: 'PI-502',
    subtotal_amount: 5000, tax_amount: 900, total_amount: 5900, paid_amount: 0,
    outstanding: 5900, has_service_item: false
  };
  const LIVE_CODES: TdsCode[] = [
    { id: 1, section_code: '194J', description: 'Professional Fees', rate: 10, deductee_type: undefined },
    { id: 2, section_code: '194C', description: 'Contractors', rate: 1, deductee_type: 'Individual/HUF' },
    { id: 3, section_code: '194C', description: 'Contractors', rate: 2, deductee_type: 'Company/Firm/Others' }
  ];

  function build(tdsCodes: TdsCode[]): void {
    const stub: Partial<PaymentsService> = {
      getPaymentVouchers: () => of({ success: true, data: [] }) as any,
      getOutstandingInvoices: () => of({ success: true, data: [SERVICE_INVOICE, GOODS_INVOICE] }) as any,
      getPartyLedgerBalance: () => of({ success: true, data: 0 }) as any,
      getTdsCodes: () => of({ success: true, data: tdsCodes }) as any,
      getAvailableNotes: () => of({ success: true, data: [] }) as any,
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
    (component as any).selectedPartyIds.set([1]);
    (component as any).parties.set([{ id: 1, vendor_name: 'Acme Supplies' } as any]);
    (component as any).outstandingInvoices.set([SERVICE_INVOICE, GOODS_INVOICE]);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('is not applicable with nothing selected', () => {
    build(LIVE_CODES);
    expect(component.hasServiceAllocation()).toBe(false);
    expect(component.tdsApplicable()).toBe(false);
  });

  it('becomes applicable once a Service-carrying invoice is selected', () => {
    build(LIVE_CODES);
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    expect(component.hasServiceAllocation()).toBe(true);
    expect(component.tdsApplicable()).toBe(true);
  });

  it('stays inapplicable when only a Goods invoice is selected', () => {
    build(LIVE_CODES);
    component.toggleInvoice(GOODS_INVOICE as any, true);
    fixture.detectChanges();
    expect(component.hasServiceAllocation()).toBe(false);
  });

  it('is never applicable in receipt mode, even with a service_item flag set', () => {
    build(LIVE_CODES);
    (component as any).mode.set('receipt');
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    expect(component.hasServiceAllocation()).toBe(false);
  });

  it('offers live tds_codes as section options, keyed to disambiguate same-section different rates', () => {
    build(LIVE_CODES);
    const opts = component.tdsSectionOptions();
    expect(opts.map(o => o.value)).toEqual(['194J|', '194C|Individual/HUF', '194C|Company/Firm/Others']);
  });

  it('falls back to the hardcoded list when the live fetch is empty', () => {
    build([]);
    const opts = component.tdsSectionOptions();
    expect(opts.some(o => o.value === '194J')).toBe(true);
  });

  it('auto-computes the TDS amount from the base (GST-excluded) amount x the picked section\'s rate', () => {
    build(LIVE_CODES);
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    component.setTdsSection('194J|');
    fixture.detectChanges();
    // taxableInAllocated = 11800 allocated x (1 - 1800/11800) = 10000; 10% of 10000 = 1000
    expect(component.tdsAmount()).toBeCloseTo(1000, 2);
  });

  it('picks the correct rate for one of two same-section-different-deductee codes', () => {
    build(LIVE_CODES);
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    component.setTdsSection('194C|Individual/HUF');
    fixture.detectChanges();
    expect(component.tdsRate()).toBe(1);
    component.setTdsSection('194C|Company/Firm/Others');
    fixture.detectChanges();
    expect(component.tdsRate()).toBe(2);
  });

  it('is zero until a section is actually picked, even though TDS is applicable', () => {
    build(LIVE_CODES);
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    expect(component.tdsApplicable()).toBe(true);
    expect(component.tdsAmount()).toBe(0);
  });

  it('clears a stale section pick once the Service invoice is deselected', () => {
    build(LIVE_CODES);
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    component.setTdsSection('194J|');
    fixture.detectChanges();
    expect(component.tdsSection()).toBe('194J|');

    component.toggleInvoice(SERVICE_INVOICE as any, false);
    fixture.detectChanges();
    expect(component.hasServiceAllocation()).toBe(false);
    expect(component.tdsSection()).toBe('');
    expect(component.tdsAmount()).toBe(0);
  });

  it('save() blocks with a clear message when TDS applies but no section is picked', () => {
    build(LIVE_CODES);
    component.toggleInvoice(SERVICE_INVOICE as any, true);
    fixture.detectChanges();
    component.addMode();
    // Pay the ₹11,800 by cheque, not cash: the ₹9,999 cash-payment cap is
    // checked before the TDS section, and would otherwise be the message we get.
    component.setModeDetails(0, {
      ...defaultPaymentModeValue(),
      mode: 'BANK', bankSubType: 'CHEQUE',
      bankName: 'HDFC Bank', branchName: 'MG Road', refNumber: '456789', refDate: '2026-09-04',
      modeKey: 'cheque', summary: 'Cheque #456789 · HDFC Bank', isValid: true
    });
    fixture.detectChanges();
    component.save();
    expect(component.saveError()).toContain('TDS section');
  });
});
