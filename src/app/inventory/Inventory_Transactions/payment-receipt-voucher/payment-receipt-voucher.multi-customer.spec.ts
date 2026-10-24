import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { PaymentReceiptVoucherComponent } from './payment-receipt-voucher';
import { PaymentsService } from '../../Inventory_Shared/payments.service';

// Customer Receipt lets several customers be selected at once. Their
// outstanding invoices are listed together, each receipt mode is assigned to
// one customer, and Save posts one receipt voucher per customer.
describe('PaymentReceiptVoucherComponent — multiple customers on Customer Receipt', () => {
  let fixture: ComponentFixture<PaymentReceiptVoucherComponent>;
  let component: PaymentReceiptVoucherComponent;
  let savePayloads: any[];

  const invoicesByCustomer: Record<number, any[]> = {
    1: [{ invoice_type: 'sales_invoice', invoice_id: 101, invoice_number: 'INV00001/26-27', subtotal_amount: 1000, tax_amount: 0, total_amount: 1000, paid_amount: 0, outstanding: 1000, has_service_item: false }],
    2: [{ invoice_type: 'sales_invoice', invoice_id: 201, invoice_number: 'INV00002/26-27', subtotal_amount: 2500, tax_amount: 0, total_amount: 2500, paid_amount: 0, outstanding: 2500, has_service_item: false }]
  };

  function build(mode: 'pay' | 'receipt'): void {
    savePayloads = [];
    let voucherSeq = 0;
    const stub: Partial<PaymentsService> = {
      getPaymentVouchers: () => of({ success: true, data: [] }) as any,
      getOutstandingInvoices: (_type: any, partyId: number) => of({ success: true, data: invoicesByCustomer[partyId] ?? [] }) as any,
      getTdsCodes: () => of({ success: true, data: [] }) as any,
      getVendorFyPurchaseSummary: () => of({ success: true, data: null }) as any,
      getAvailableNotes: () => of({ success: true, data: [] }) as any,
      getPaymentVoucherAccountSetup: () => of({ banks: [], depositBanks: [], onlinePaymentTypes: [] }) as any,
      getPaymentVoucherBankDetails: () => of({ chequeNumbers: [], upiNames: [] }) as any,
      savePaymentVoucher: (payload: any) => { savePayloads.push(payload); return of({ success: true, data: { voucher_number: `RCPT-${++voucherSeq}` } }) as any; }
    };
    TestBed.configureTestingModule({
      imports: [PaymentReceiptVoucherComponent],
      providers: [
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: { data: of({ mode }) } },
        { provide: PaymentsService, useValue: stub }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentReceiptVoucherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.parties.set([{ id: 1, customer_name: 'Alpha Traders' } as any, { id: 2, customer_name: 'Beta Stores' } as any]);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses a multi-select only on Customer Receipt', () => {
    build('receipt');
    expect(component.multiPartySelect()).toBe(true);
    TestBed.resetTestingModule();
    build('pay');
    expect(component.multiPartySelect()).toBe(false);
  });

  it('lists the outstanding invoices of every selected customer', () => {
    build('receipt');
    component.onPartyChange([1, 2]);
    expect(component.outstandingInvoices().map(i => i.invoice_id)).toEqual([101, 201]);
    expect(component.partyOfInvoice(101)).toBe(1);
    expect(component.partyOfInvoice(201)).toBe(2);
    expect(component.isMultiParty()).toBe(true);
  });

  it('keeps the ticks of a customer that stays selected when another is added or removed', () => {
    build('receipt');
    component.onPartyChange([1]);
    component.toggleInvoice(component.outstandingInvoices()[0], true);
    component.onPartyChange([1, 2]);
    expect(component.selectedInvoiceIds().has(101)).toBe(true);
    component.onPartyChange([1]);
    expect(component.outstandingInvoices().map(i => i.invoice_id)).toEqual([101]);
    expect(component.selectedInvoiceIds().has(101)).toBe(true);
  });

  it('defaults each new receipt mode to the next customer that is still short', () => {
    build('receipt');
    component.onPartyChange([1, 2]);
    component.selectAll(true);
    component.addMode();
    component.addMode();
    expect(component.modeRows().map(r => [r.partyId, r.amount])).toEqual([[1, 1000], [2, 2500]]);
  });

  it('posts one receipt voucher per customer with only that customer\'s invoices and modes', () => {
    build('receipt');
    component.onPartyChange([1, 2]);
    component.selectAll(true);
    component.addMode();
    component.addMode();

    component.save();

    expect(component.saveError()).toBe('');
    expect(savePayloads.length).toBe(2);
    expect(savePayloads.map(p => [p.partyId, p.partyName])).toEqual([[1, 'Alpha Traders'], [2, 'Beta Stores']]);
    expect(savePayloads[0].allocations.map((a: any) => a.invoiceId)).toEqual([101]);
    expect(savePayloads[0].modes.map((m: any) => m.amount)).toEqual([1000]);
    expect(savePayloads[1].allocations.map((a: any) => a.invoiceId)).toEqual([201]);
    expect(savePayloads[1].modes.map((m: any) => m.amount)).toEqual([2500]);
    expect(component.saveMsg()).toContain('RCPT-1, RCPT-2');
  });

  it('blocks Save when a customer\'s invoices have no receipt mode', () => {
    build('receipt');
    component.onPartyChange([1, 2]);
    component.selectAll(true);
    component.addMode(); // covers Alpha Traders only

    component.save();

    expect(savePayloads.length).toBe(0);
    expect(component.saveError()).toContain('Beta Stores');
  });

  it('blocks Save when a receipt mode has no customer picked', () => {
    build('receipt');
    component.onPartyChange([1, 2]);
    component.selectAll(true);
    component.addMode();
    component.addMode();
    component.setModeParty(1, null);

    component.save();

    expect(savePayloads.length).toBe(0);
    expect(component.saveError()).toContain('Select the customer');
  });
});
