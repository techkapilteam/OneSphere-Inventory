import { DatePipe } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { PaymentReceiptVoucherComponent } from './payment-receipt-voucher';
import { PaymentsService } from '../../Inventory_Shared/payments.service';

// Settlement on the Receipt / Payment screen: invoices netted off against credit / debit notes with no cash
// or bank mode. The same screen and the same save; only the settlement controls are shown while it is on.
describe('PaymentReceiptVoucherComponent — Settlement', () => {
  let fixture: ComponentFixture<PaymentReceiptVoucherComponent>;
  let component: PaymentReceiptVoucherComponent;
  let savePayloads: any[];

  function build(noteOutstanding: number): void {
    savePayloads = [];
    const stub: Partial<PaymentsService> = {
      getPaymentVouchers: () => of({ success: true, data: [] }) as any,
      getOutstandingInvoices: () => of({ success: true, data: [
        { invoice_type: 'sales_invoice', invoice_id: 101, invoice_number: 'INV00001/26-27', subtotal_amount: 1000, tax_amount: 0, total_amount: 1000, paid_amount: 0, outstanding: 1000, has_service_item: false }
      ] }) as any,
      getPartyLedgerBalance: () => of({ success: true, data: 0 }) as any,
      getTdsCodes: () => of({ success: true, data: [] }) as any,
      getVendorFyPurchaseSummary: () => of({ success: true, data: null }) as any,
      getAvailableNotes: () => of({ success: true, data: [
        { note_type: 'credit_note', note_id: 55, note_number: 'CN-1', total_amount: noteOutstanding, applied_amount: 0, outstanding: noteOutstanding }
      ] }) as any,
      getPaymentVoucherAccountSetup: () => of({ banks: [], depositBanks: [], onlinePaymentTypes: [] }) as any,
      getPaymentVoucherBankDetails: () => of({ chequeNumbers: [], upiNames: [] }) as any,
      savePaymentVoucher: (payload: any) => { savePayloads.push(payload); return of({ success: true, data: { voucher_number: 'RCPT-1' } }) as any; }
    };
    TestBed.configureTestingModule({
      imports: [PaymentReceiptVoucherComponent],
      providers: [provideHttpClient(), DatePipe, { provide: ActivatedRoute, useValue: { data: of({ mode: 'receipt' }) } }, { provide: PaymentsService, useValue: stub }]
    }).compileComponents();
    fixture = TestBed.createComponent(PaymentReceiptVoucherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.parties.set([{ id: 1, customer_name: 'Alpha Traders' } as any]);
    component.onPartyChange([1]);
    component.toggleInvoice(component.outstandingInvoices()[0], true);
    component.toggleNote(component.availableNotes()[0], true);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('settles an invoice against an equal credit note with no mode', () => {
    build(1000);
    component.toggleSettlement();
    component.settle();
    expect(component.saveError()).toBe('');
    expect(savePayloads.length).toBe(1);
    expect(savePayloads[0].modes).toEqual([]);
    expect(savePayloads[0].allocations.map((a: any) => [a.invoiceType, a.allocatedAmount])).toEqual([['sales_invoice', 1000], ['credit_note', 1000]]);
    expect(component.saveMsg()).toContain('settled successfully');
  });

  it('refuses a note larger than the invoice and tells the user what to apply', () => {
    build(1500);
    component.toggleSettlement();
    component.settle();
    expect(savePayloads.length).toBe(0);
    expect(component.saveError()).toContain('more than');
    expect(component.saveError()).toContain('Reduce the Apply Amount');
    component.setNoteApply(component.availableNotes()[0], '1000');
    component.settle();
    expect(savePayloads.length).toBe(1);
  });

  it('refuses a note smaller than the invoice (the balance needs a receipt mode)', () => {
    build(400);
    component.toggleSettlement();
    component.settle();
    expect(savePayloads.length).toBe(0);
    expect(component.saveError()).toContain('do not cover');
  });

  it('while on, only the settlement controls are shown; turning it on clears any modes', () => {
    build(1000);
    component.addMode();
    expect(component.modeRows().length).toBe(1);
    component.toggleSettlement();
    fixture.detectChanges();
    expect(component.modeRows().length).toBe(0);
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Confirm Settlement');
    expect(text).not.toContain('Save & Post');
    expect(text).not.toContain('Add Receipt Mode');
    component.toggleSettlement();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Save & Post Receipt');
  });

  it('errors raise a timed toast (the X to close comes with the toast) as well as the message signal', () => {
    build(400);
    const toast = fixture.debugElement.injector.get(MessageService);
    const add = vi.spyOn(toast, 'add');
    component.toggleSettlement();
    component.settle();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', life: 7000 }));
  });
});
