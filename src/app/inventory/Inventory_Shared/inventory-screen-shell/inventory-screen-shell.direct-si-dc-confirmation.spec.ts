import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { InventoryScreenShell } from './inventory-screen-shell';
import { InventoryScreenConfig } from '../inventory-screen.model';

// Coverage for item 30: posting a genuinely Direct Sales Invoice (no SO
// reference, no line already carrying a dc_item_id) offers a 3-way choice
// -- Only Invoice / Invoice with DC / Separate DC -- instead of saving
// straight through. An SI created WITH an SO reference, or one that already
// references an existing DC (flow E), must skip the popup entirely and
// behave byte-for-byte as before this feature existed -- most tests here
// exist specifically to pin that negative case down, not just the new
// on-behaviour.
describe('InventoryScreenShell — Direct Sales Invoice / DC confirmation (item 30)', () => {
  let fixture: ComponentFixture<InventoryScreenShell>;
  let component: InventoryScreenShell;

  const config: InventoryScreenConfig = {
    key: 'salesInvoice',
    title: 'Sales Invoice',
    subtitle: '',
    kind: 'transaction',
    icon: 'pi pi-receipt',
    lineColumns: ['Item / SKU', 'Variant', 'Attribute', 'UOM', 'Qty', 'Rate', 'MRP', 'Selling Price', 'Disc %', 'GST', 'Batch No', 'Serial No', 'Expiry Date', 'Warehouse', 'Amount']
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryScreenShell],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryScreenShell);
    component = fixture.componentInstance;
    component.config = config;
    fixture.detectChanges();

    (component as any).loadedProductObjects.set([
      { id: 14, product_name: 'LED Display 32 inch', product_code: 'LED-32' } as any
    ]);
    (component as any).loadedWarehouseObjects.set([
      { id: 101, warehouse_name: 'HYD Main WH' } as any
    ]);
  });

  function directSiForm(): void {
    component.formValues.set({
      warehouse: 'HYD Main WH', warehouseId: 101,
      customer: 'Acme', channelPartner: 'Direct', status: 'Posted'
    });
    component.entryLineRows.set([
      ['LED Display 32 inch', '', '', 'Nos', '10', '100', '', '', '', '', '', '', '', '', '1000']
    ]);
  }

  describe('isDirectSalesInvoicePayload() detection', () => {
    it('is true for an SI payload with no so_id and no dc_item_id on any line', () => {
      const payload = { so_id: null, items: [{ dc_item_id: null }, { dc_item_id: undefined }] };
      expect((component as any).isDirectSalesInvoicePayload(payload)).toBe(true);
    });

    it('is false when so_id is set (SI was created WITH an SO reference)', () => {
      const payload = { so_id: 55, items: [{ dc_item_id: null }] };
      expect((component as any).isDirectSalesInvoicePayload(payload)).toBe(false);
    });

    it('is false when any line already carries a dc_item_id (flow E — Invoice to DC)', () => {
      const payload = { so_id: null, items: [{ dc_item_id: null }, { dc_item_id: 77 }] };
      expect((component as any).isDirectSalesInvoicePayload(payload)).toBe(false);
    });

    it('is false on any screen other than salesInvoice', () => {
      component.config = { ...config, key: 'deliveryChallan' };
      expect((component as any).isDirectSalesInvoicePayload({ so_id: null, items: [] })).toBe(false);
    });
  });

  describe('saveConfigRecord() gating', () => {
    it('shows the 3-way popup for a genuinely Direct SI and does not proceed until it resolves', async () => {
      directSiForm();
      const dcChoiceSpy = vi.spyOn(component as any, 'confirmDirectSiDcChoice').mockReturnValue(new Promise(() => {}));
      const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks');

      component.saveConfigRecord('posted');
      await Promise.resolve(); await Promise.resolve();

      expect(dcChoiceSpy).toHaveBeenCalledTimes(1);
      expect(runChecksSpy).not.toHaveBeenCalled();
    });

    it('skips the popup and behaves unchanged when the SI has an SO reference', async () => {
      directSiForm();
      component.formValues.update(v => ({ ...v, soId: 501, soReference: 'SO-26-00001' }));
      const dcChoiceSpy = vi.spyOn(component as any, 'confirmDirectSiDcChoice');
      const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks').mockImplementation(() => {});

      component.saveConfigRecord('posted');
      await Promise.resolve();

      expect(dcChoiceSpy).not.toHaveBeenCalled();
      expect(runChecksSpy).toHaveBeenCalledTimes(1);
      expect(runChecksSpy.mock.calls[0][3]).toBeUndefined();
    });

    it('skips the popup and behaves unchanged when a line already references a DC (flow E)', async () => {
      directSiForm();
      (component as any).lineRefItemIdMap.set({ 0: { dcItemId: 909 } });
      const dcChoiceSpy = vi.spyOn(component as any, 'confirmDirectSiDcChoice');
      const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks').mockImplementation(() => {});

      component.saveConfigRecord('posted');
      await Promise.resolve();

      expect(dcChoiceSpy).not.toHaveBeenCalled();
      expect(runChecksSpy).toHaveBeenCalledTimes(1);
    });

    it('cancelling the popup reverts the forced status and never proceeds to save', async () => {
      directSiForm();
      vi.spyOn(component as any, 'confirmDirectSiDcChoice').mockResolvedValue(null);
      const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks');

      component.saveConfigRecord('posted');
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

      expect(runChecksSpy).not.toHaveBeenCalled();
    });

    it('"Only Invoice" proceeds with no postSaveAction (undefined) — no DC follow-up at all', async () => {
      directSiForm();
      vi.spyOn(component as any, 'confirmDirectSiDcChoice').mockResolvedValue('onlyInvoice');
      const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks').mockImplementation(() => {});

      component.saveConfigRecord('posted');
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

      expect(runChecksSpy).toHaveBeenCalledTimes(1);
      expect(runChecksSpy.mock.calls[0][3]).toBeUndefined();
    });

    it('"Invoice with DC" and "Separate DC" both proceed with a defined postSaveAction function', async () => {
      for (const choice of ['invoiceWithDc', 'separateDc'] as const) {
        directSiForm();
        vi.spyOn(component as any, 'confirmDirectSiDcChoice').mockResolvedValue(choice);
        const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks').mockImplementation(() => {});

        component.saveConfigRecord('posted');
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

        expect(typeof runChecksSpy.mock.calls[0][3]).toBe('function');
        vi.restoreAllMocks();
      }
    });

    it('the real confirm/resolve dialog pair opens with the popup and closes it once a choice is made', async () => {
      directSiForm();
      const runChecksSpy = vi.spyOn(component as any, 'runSalesInvoicePostChecks').mockImplementation(() => {});

      component.saveConfigRecord('posted');
      await Promise.resolve();

      const dialog = component.directSiDcDialog();
      expect(dialog).not.toBeNull();
      expect(dialog!.title.toLowerCase()).toContain('delivery challan');

      component.resolveDirectSiDcDialog('separateDc');
      await Promise.resolve(); await Promise.resolve();

      expect(component.directSiDcDialog()).toBeNull();
      expect(runChecksSpy).toHaveBeenCalledTimes(1);
      expect(typeof runChecksSpy.mock.calls[0][3]).toBe('function');
    });
  });

  describe('buildDirectSiDcPostSaveAction()', () => {
    const siPayload = {
      segment_id: 1, segment_name: 'Electronics',
      customer_id: 88, customer_name: 'Acme',
      channel_partner_id: 5, channel_partner_name: 'Direct',
      warehouse_id: 101, warehouse_name: 'HYD Main WH',
      vehicle_no: 'TS09AB1234',
      doc_number: 'SI-26-00010'
    };
    const savedSi = { id: 501, doc_number: 'SI-26-00010', items: [{ id: 9001, sno: 1 }] };

    beforeEach(() => {
      directSiForm();
    });

    it('returns undefined for "onlyInvoice" — no DC follow-up wired at all', () => {
      const action = (component as any).buildDirectSiDcPostSaveAction('onlyInvoice', siPayload);
      expect(action).toBeUndefined();
    });

    // Previous: it('"invoiceWithDc": prints the SI immediately, saves+posts a DC, and prints the DC once saved', async () => {
    it('"invoiceWithDc": prints the SI immediately, saves+posts a DC, and does NOT print the DC', async () => {
      const printSpy = vi.spyOn(component as any, 'printAutoGeneratedDocument').mockImplementation(() => {});
      const dcSpy = vi.spyOn((component as any).txService, 'saveDeliveryChallan')
        .mockReturnValue(of({ success: true, data: { id: 701, dc_number: 'DC-26-00010' } }));

      const action = (component as any).buildDirectSiDcPostSaveAction('invoiceWithDc', siPayload);
      action!(savedSi);
      await Promise.resolve(); await Promise.resolve();

      expect(printSpy).toHaveBeenCalledWith('salesInvoice', savedSi);
      expect(dcSpy).toHaveBeenCalledTimes(1);
      expect((dcSpy.mock.calls[0][0] as any)['status']).toBe('posted');
      // Previous: expect(printSpy).toHaveBeenCalledWith('deliveryChallan', { id: 701, dc_number: 'DC-26-00010' });
      expect(printSpy).toHaveBeenCalledTimes(1);
      expect(printSpy).not.toHaveBeenCalledWith('deliveryChallan', expect.anything());
    });

    it('"separateDc": prints only the SI, saves the DC as Draft, and does NOT print the DC', async () => {
      const printSpy = vi.spyOn(component as any, 'printAutoGeneratedDocument').mockImplementation(() => {});
      const dcSpy = vi.spyOn((component as any).txService, 'saveDeliveryChallan')
        .mockReturnValue(of({ success: true, data: { id: 702, dc_number: 'DC-26-00011' } }));

      const action = (component as any).buildDirectSiDcPostSaveAction('separateDc', siPayload);
      action!(savedSi);
      await Promise.resolve(); await Promise.resolve();

      expect((dcSpy.mock.calls[0][0] as any)['status']).toBe('draft');
      expect(printSpy).toHaveBeenCalledTimes(1);
      expect(printSpy).toHaveBeenCalledWith('salesInvoice', savedSi);
    });

    it('surfaces an error message when the DC auto-create fails, without touching the already-posted SI', async () => {
      vi.spyOn(component as any, 'printAutoGeneratedDocument').mockImplementation(() => {});
      vi.spyOn((component as any).txService, 'saveDeliveryChallan')
        .mockReturnValue(throwError(() => ({ error: { message: 'DB error' } })));

      const action = (component as any).buildDirectSiDcPostSaveAction('invoiceWithDc', siPayload);
      action!(savedSi);
      await Promise.resolve(); await Promise.resolve();

      expect(component.saveError()).toContain('DB error');
    });

    // Regression: postSaveAction always runs AFTER finishSave(), and
    // finishSave() calls clearConfigForm() — which resets entryLineRows()
    // to a single blankLineRow() (defaulting Product to the grid's first
    // scoped option and Qty to '1') and empties lineSerialUnitsMap(). A
    // lazy read inside the returned closure picked up that wiped state
    // instead of what was actually invoiced: the real root cause behind
    // DC-26-00002/3/4/7 shipping with dispatch_qty 1 and no serials
    // regardless of the source invoice's real quantity/serials — invisible
    // in a tiny test catalog where "first scoped product" often coincided
    // with the real one, and the proximate cause of a since-fixed
    // "Serial / IMEI count doesn't match" error on the auto-created DC.
    it('captures the invoiced line items and serials at build time, unaffected by a clearConfigForm() that runs before the action fires', async () => {
      (component as any).loadedProductObjects.set([
        { id: 14, product_name: 'LED Display 32 inch', product_code: 'LED-32', serial_applicable: true } as any
      ]);
      component.entryLineRows.set([
        ['LED Display 32 inch', '', '', 'Nos', '2', '100', '', '', '', '', '', '', '', '', '200']
      ]);
      (component as any).lineSerialUnitsMap.set({ 0: ['SN-1', 'SN-2'] });

      const dcSpy = vi.spyOn((component as any).txService, 'saveDeliveryChallan')
        .mockReturnValue(of({ success: true, data: { id: 703, dc_number: 'DC-26-00012' } }));
      vi.spyOn(component as any, 'printAutoGeneratedDocument').mockImplementation(() => {});

      // Built while the grid still holds the real, user-entered data —
      // exactly where saveConfigRecord() actually calls it, before the
      // save (and finishSave()'s clearConfigForm()) has run.
      const action = (component as any).buildDirectSiDcPostSaveAction('invoiceWithDc', siPayload);

      // Simulates finishSave() -> clearConfigForm() firing before
      // postSaveAction, exactly as executeSaveConfigRecord() does.
      component.entryLineRows.set([['', '', '', '', '1', '', '', '', '', '', '', '', '', '', '0']]);
      (component as any).lineSerialUnitsMap.set({});

      action!(savedSi);
      await Promise.resolve(); await Promise.resolve();

      const dcPayload = dcSpy.mock.calls[0][0] as any;
      expect(dcPayload.items.length).toBe(1);
      expect(dcPayload.items[0].product_name).toBe('LED Display 32 inch');
      expect(dcPayload.items[0].dispatch_qty).toBe(2);
      expect(dcPayload.items[0].serial_numbers).toEqual(['SN-1', 'SN-2']);
    });
  });

  describe('buildAutoDeliveryChallanPayload()', () => {
    beforeEach(() => {
      directSiForm();
    });

    it('omits the header-level si_id/si_number (literal "not required" instruction) but sets each item\'s si_item_id back to the SI item it came from', () => {
      const siPayload = {
        segment_id: 1, segment_name: 'Electronics',
        customer_id: 88, customer_name: 'Acme',
        channel_partner_id: 5, channel_partner_name: 'Direct',
        warehouse_id: 101, warehouse_name: 'HYD Main WH',
        vehicle_no: 'TS09AB1234', doc_number: 'SI-26-00010'
      };
      const savedSi = { id: 501, doc_number: 'SI-26-00010', items: [{ id: 9001, sno: 1 }] };

      const dcPayload = (component as any).buildAutoDeliveryChallanPayload(
        siPayload, savedSi, 'posted', (component as any).salesLineItems(), (component as any).lineSerialUnitsMap()
      );

      // Header-level reference: deliberately not carried -- purely a
      // display/traceability field per the user's literal instruction.
      expect(dcPayload.si_id).toBeNull();
      expect(dcPayload.si_number).toBeNull();
      expect(dcPayload.so_id).toBeNull();
      expect(dcPayload.so_number).toBeNull();
      // Left null so the backend's own DC-numbering sequence scan assigns
      // it (sp_save_delivery_challan) -- client-side generateTransactionDocNumber()
      // would miscount here since it reads whichever screen's records are
      // currently loaded (still the SI's, not the DC's, at this point).
      expect(dcPayload.dc_number).toBeNull();
      expect(dcPayload.customer_id).toBe(88);
      expect(dcPayload.channel_partner_id).toBe(5);
      expect(dcPayload.from_warehouse_id).toBe(101);
      expect(dcPayload.from_warehouse_name).toBe('HYD Main WH');
      expect(dcPayload.status).toBe('posted');
      expect(dcPayload.remarks).toContain('SI-26-00010');

      // Item-level backlink: deliberately set -- load-bearing for
      // fn_post_delivery_challan_dispatch's si_item_id IS NULL guard, which
      // otherwise double-decrements stock already moved at SI-post time.
      expect(dcPayload.items.length).toBe(1);
      expect(dcPayload.items[0].si_item_id).toBe(9001);
      expect(dcPayload.items[0].so_item_id).toBeNull();
      expect(dcPayload.items[0].dispatch_qty).toBe(10);
      expect(dcPayload.items[0].so_qty).toBe(0);
      expect(dcPayload.items[0].product_id).toBe(14);
    });

    it('carries over branch_id/branch_name when the source SI was Branch-located (no warehouse) -- a location-less DC cannot be posted or found on the DC screen', () => {
      const siPayload = {
        segment_id: 1, segment_name: 'Electronics',
        customer_id: 88, customer_name: 'Acme',
        branch_id: 12, branch_name: 'SECUNDERABAD HO',
        warehouse_id: null, warehouse_name: null,
        doc_number: 'SI-26-00002'
      };
      const savedSi = { id: 501, doc_number: 'SI-26-00002', items: [{ id: 9001, sno: 1 }] };

      const dcPayload = (component as any).buildAutoDeliveryChallanPayload(
        siPayload, savedSi, 'posted', (component as any).salesLineItems(), (component as any).lineSerialUnitsMap()
      );

      expect(dcPayload.branch_id).toBe(12);
      expect(dcPayload.branch_name).toBe('SECUNDERABAD HO');
      expect(dcPayload.from_warehouse_id).toBeNull();
      expect(dcPayload.from_warehouse_name).toBeNull();
    });

    it('still carries over from_warehouse_id/from_warehouse_name (and leaves branch null) when the source SI was Warehouse-located', () => {
      const siPayload = {
        customer_id: 88, customer_name: 'Acme',
        warehouse_id: 101, warehouse_name: 'HYD Main WH',
        branch_id: null, branch_name: null,
        doc_number: 'SI-26-00010'
      };
      const savedSi = { id: 501, doc_number: 'SI-26-00010', items: [{ id: 9001, sno: 1 }] };

      const dcPayload = (component as any).buildAutoDeliveryChallanPayload(
        siPayload, savedSi, 'posted', (component as any).salesLineItems(), (component as any).lineSerialUnitsMap()
      );

      expect(dcPayload.from_warehouse_id).toBe(101);
      expect(dcPayload.from_warehouse_name).toBe('HYD Main WH');
      expect(dcPayload.branch_id).toBeNull();
      expect(dcPayload.branch_name).toBeNull();
    });

    it('maps multiple DC line items to the corresponding SI item ids in sno order, even if the API returned them out of order', () => {
      component.entryLineRows.set([
        ['LED Display 32 inch', '', '', 'Nos', '10', '100', '', '', '', '', '', '', '', '', '1000'],
        ['LED Display 32 inch', '', '', 'Nos', '5', '100', '', '', '', '', '', '', '', '', '500']
      ]);
      const siPayload = { customer_id: 88, warehouse_id: 101 };
      const savedSi = { items: [{ id: 9002, sno: 2 }, { id: 9001, sno: 1 }] };

      const dcPayload = (component as any).buildAutoDeliveryChallanPayload(
        siPayload, savedSi, 'draft', (component as any).salesLineItems(), (component as any).lineSerialUnitsMap()
      );

      expect(dcPayload.items[0].si_item_id).toBe(9001);
      expect(dcPayload.items[1].si_item_id).toBe(9002);
      expect(dcPayload.items[0].dispatch_qty).toBe(10);
      expect(dcPayload.items[1].dispatch_qty).toBe(5);
      expect(dcPayload.status).toBe('draft');
    });
  });
});
