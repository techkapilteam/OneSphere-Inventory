import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { InventoryScreenShell } from './inventory-screen-shell';
import { InventoryScreenConfig } from '../inventory-screen.model';

// Server-assigned document numbers.
//
// generateTransactionDocNumber() builds a number from the row count of THIS
// grid, and the grid is filtered to the session's active Branch/Warehouse
// (sp_get_sales_invoices). The uniqueness constraints are company-wide
// (uq_sales_invoice_doc = UNIQUE (company_id, doc_number)). So as soon as a
// company has documents in a second location the per-location count stops
// matching the company-wide sequence and every save collides with 23505 —
// live example, company 108: INV-26-00001 at Warehouse 29 and INV-26-00002 at
// Branch 126, so a user in either location computes 1+1 and sends a number
// that already exists.
//
// The sales family therefore sends null and lets
// inventory.fn_resolve_sales_doc_number allocate (migration 227). The purchase
// family MUST keep generating client-side: sp_save_grn,
// sp_save_purchase_invoice and the rest have no server-side generator, so a
// null number would break them. That split is what these tests pin down.
describe('InventoryScreenShell — server-assigned document numbers', () => {
  let fixture: ComponentFixture<InventoryScreenShell>;
  let component: InventoryScreenShell;

  const cfg = (key: string, title: string): InventoryScreenConfig => ({
    key, title, subtitle: '', kind: 'transaction', icon: 'pi pi-file',
    lineColumns: ['Item / SKU', 'UOM', 'Qty', 'Rate', 'Amount']
  });

  const create = async (config: InventoryScreenConfig) => {
    await TestBed.configureTestingModule({
      imports: [InventoryScreenShell],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryScreenShell);
    component = fixture.componentInstance;
    component.config = config;
    fixture.detectChanges();
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  describe('Sales Invoice (server allocates)', () => {
    beforeEach(async () => { await create(cfg('salesInvoice', 'Sales Invoice')); });

    it('sends null when the user has not typed a number', () => {
      expect(component.serverDocNo('invoiceNo')).toBeNull();
    });

    it('sends a number the user did type', () => {
      component.formValues.set({ invoiceNo: 'MY-OWN-0001' });
      expect(component.serverDocNo('invoiceNo')).toBe('MY-OWN-0001');
    });

    it('trims, and treats whitespace as untyped', () => {
      component.formValues.set({ invoiceNo: '   ' });
      expect(component.serverDocNo('invoiceNo')).toBeNull();

      component.formValues.set({ invoiceNo: '  INV-X-1  ' });
      expect(component.serverDocNo('invoiceNo')).toBe('INV-X-1');
    });

    it('shows a blank field on a new document rather than a guess the server will override', () => {
      expect(component.transactionNumberValue({ key: 'invoiceNo', label: 'Invoice No' })).toBe('');
    });

    it('explains the blank field in the placeholder', () => {
      const ph = component.transactionNumberPlaceholder({ key: 'invoiceNo', label: 'Invoice No' });
      expect(ph).toContain('assigned on save');
    });

    it('still shows the real number once the document exists', () => {
      component.editingId.set(41);
      component.formValues.set({ invoiceNo: 'INV-26-00007' });
      expect(component.transactionNumberValue({ key: 'invoiceNo', label: 'Invoice No' })).toBe('INV-26-00007');
    });
  });

  describe('Purchase family (client still generates — regression guard)', () => {
    it('Goods Receipt still produces a client-side number', async () => {
      await create(cfg('goodsReceipt', 'Goods Receipt Note'));
      const v = component.transactionNumberValue({ key: 'grnNo', label: 'GRN Number' });
      expect(v).not.toBe('');
      expect(v).toMatch(/-\d{2}-\d{5}$/);
    });

    it('Purchase Invoice still produces a client-side number', async () => {
      await create(cfg('purchaseInvoice', 'Purchase Invoice'));
      expect(component.transactionNumberValue({ key: 'piNo', label: 'PI Number' })).not.toBe('');
    });

    it('Purchase Return still produces a client-side number', async () => {
      await create(cfg('purchaseReturn', 'Purchase Return'));
      expect(component.transactionNumberValue({ key: 'returnNo', label: 'Return Number' })).not.toBe('');
    });
  });

  describe('Validation', () => {
    // Previous: PI Number / PI Date were the mandatory pair.
    // it('requires a PI Number and PI Date', async () => {
    //   await create(cfg('purchaseInvoice', 'Purchase Invoice'));
    //   const validate = (component as any).validatePayload.bind(component);
    //   const basePayload = { vendor_name: 'Acme Vendor', branch_id: 1, status: 'draft' };
    //
    //   expect(validate(basePayload)).toBe('Invoice no. is required for Purchase Invoice.');
    //   expect(validate({ ...basePayload, pi_number: 'PI-00001' }))
    //     .toBe('Invoice date is required for Purchase Invoice.');
    // });
    it('requires Vendor Invoice No and Date, not PI Number / PI Date', async () => {
      await create(cfg('purchaseInvoice', 'Purchase Invoice'));
      const validate = (component as any).validatePayload.bind(component);
      // One item line: the "add at least one line" check runs before the header checks.
      const basePayload = {
        vendor_name: 'Acme Vendor', branch_id: 1, status: 'draft',
        items: [{ product_name: 'X', qty: 1, rate: 1 }]
      };

      expect(validate(basePayload)).toBe('Vendor Invoice No. is required for Purchase Invoice.');
      expect(validate({ ...basePayload, vendor_invoice_no: 'VINV-1' }))
        .toBe('Vendor Invoice Date is required for Purchase Invoice.');
    });

    it('no longer blocks a new Sales Invoice for a blank number', async () => {
      await create(cfg('salesInvoice', 'Sales Invoice'));
      // The number is the server's job now; demanding one here blocked every save.
      const msg = (component as any).configRecordValidationMessage?.({
        doc_number: null, doc_date: '2026-09-09', items: [{ product_name: 'X', qty: 1, rate: 1 }]
      });
      expect(String(msg ?? '')).not.toContain('Invoice No. is required');
    });
  });
});
