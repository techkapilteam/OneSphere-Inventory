import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { InventoryScreenShell } from './inventory-screen-shell';
import { InventoryScreenConfig, stockTransferConfig } from '../inventory-screen.model';

// Coverage for item 12: Stock Transfer -- previously a completely unwired
// screen (no table, no posting logic, sidebar entry disabled). This pins
// down the frontend save-payload construction and saved-record load-back,
// the two custom paths this screen needed (buildStockTransferPayload/
// stockTransferItems is deliberately its own builder rather than routed
// through isPurchaseTransactionKey(), which pulls in vendor/PO-reference
// logic that doesn't apply to a plain From/To warehouse move).
describe('InventoryScreenShell — Stock Transfer (item 12)', () => {
  let fixture: ComponentFixture<InventoryScreenShell>;
  let component: InventoryScreenShell;

  const config: InventoryScreenConfig = {
    key: 'stockTransfer',
    title: 'Stock Transfer',
    subtitle: '',
    kind: 'transaction',
    icon: 'pi pi-arrow-right-arrow-left',
    lineColumns: ['Item / SKU', 'Variant', 'Attribute', 'UOM', 'Qty', 'Batch No', 'Serial No']
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

    (component as any).loadedWarehouseObjects.set([
      { id: 6, warehouse_name: 'Secunderabad' } as any,
      { id: 7, warehouse_name: 'Warangal' } as any
    ]);
    (component as any).loadedProductObjects.set([
      { id: 14, product_name: 'Dell Desktop' } as any
    ]);
  });

  it('builds a stock transfer payload with resolved warehouse ids and a posted flag', () => {
    component.formValues.set({
      transferNo: 'ST-EL-26-00001',
      transferDate: '2026-08-16',
      fromWarehouse: 'Secunderabad',
      toWarehouse: 'Warangal',
      remarks: 'Branch rebalance',
      status: 'Posted'
    });
    component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);

    const payload = (component as any).buildPayload();
    expect(payload.from_warehouse_id).toBe(6);
    expect(payload.to_warehouse_id).toBe(7);
    expect(payload.transfer_number).toBe('ST-EL-26-00001');
    expect(payload.status).toBe('posted');
    expect(payload.post).toBe(true);
    expect(payload.items.length).toBe(1);
    expect(payload.items[0].product_id).toBe(14);
    expect(payload.items[0].qty).toBe(2);
  });

  it('does not set the posted flag for a draft save', () => {
    component.formValues.set({
      fromWarehouse: 'Secunderabad', toWarehouse: 'Warangal', status: 'Draft'
    });
    component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
    const payload = (component as any).buildPayload();
    expect(payload.status).toBe('draft');
    expect(payload.post).toBe(false);
  });

  // Item 4b: Stock Transfer's Serial No column now goes through the same
  // real picker (openSerialPicker()/lineSerialUnitsMap) as GRN/DC/SI/PR/SR,
  // instead of parsing a comma-separated free-text cell -- these two now
  // pin down that stockTransferItems() reads lineSerialUnitsMap directly,
  // mirroring every other screen's builder.
  it('reads serial_numbers from lineSerialUnitsMap (the real serial picker), not free text', () => {
    component.formValues.set({ fromWarehouse: 'Secunderabad', toWarehouse: 'Warangal' });
    component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
    (component as any).lineSerialUnitsMap.set({ 0: ['SN-001', 'SN-002'] });
    const payload = (component as any).buildPayload();
    expect(payload.items[0].serial_numbers).toEqual(['SN-001', 'SN-002']);
  });

  it('leaves serial_numbers null when nothing has been picked for the row', () => {
    component.formValues.set({ fromWarehouse: 'Secunderabad', toWarehouse: 'Warangal' });
    component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
    const payload = (component as any).buildPayload();
    expect(payload.items[0].serial_numbers).toBeNull();
  });

  it('loads a saved stock transfer record back into the form and line items', () => {
    component.savedRecordObjects.set([{
      id: 1, transfer_number: 'ST-EL-26-00001', transfer_date: '2026-08-16',
      from_warehouse_name: 'Secunderabad', to_warehouse_name: 'Warangal',
      status: 'posted',
      items: [{ product_name: 'Dell Desktop', uom_name: 'Nos', qty: 2, serial_numbers: ['SN-001', 'SN-002'] }]
    }]);
    component.editRecordByRow(['ST-EL-26-00001']);
    expect(component.formValues()['fromWarehouse']).toBe('Secunderabad');
    expect(component.formValues()['toWarehouse']).toBe('Warangal');
    expect(component.entryLineRows().length).toBe(1);
    expect(component.entryLineRows()[0][0]).toBe('Dell Desktop');
  });

  it('reports a posted stock transfer as posted', () => {
    component.formValues.set({ status: 'Posted' });
    expect(component.isCurrentRecordPosted()).toBe(true);
  });

  it('reports a draft stock transfer as not posted', () => {
    component.formValues.set({ status: 'Draft' });
    expect(component.isCurrentRecordPosted()).toBe(false);
  });

  // Workstream 3: Stock Transfer previously had no way to actually Post --
  // draft-only, even though sp_save_stock_transfer/fn_post_stock_transfer
  // already fully support it server-side. These pin down the new
  // forceStatusAllowed whitelist entry + the saveStockTransferDraft()/
  // postStockTransfer()/postStockTransferRecordByRow() wrapper methods,
  // mirrored from GRN's own equivalents.
  describe('Post workflow (Workstream 3)', () => {
    beforeEach(() => {
      component.formValues.set({
        transferNo: 'ST-EL-26-00002',
        transferDate: '2026-08-26',
        fromWarehouse: 'Secunderabad',
        toWarehouse: 'Warangal'
      });
      component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
    });

    it('stockTransferIsPostedForm() reflects formValues()["status"]', () => {
      component.formValues.update(v => ({ ...v, status: 'Posted' }));
      expect((component as any).stockTransferIsPostedForm()).toBe(true);
      component.formValues.update(v => ({ ...v, status: 'Draft' }));
      expect((component as any).stockTransferIsPostedForm()).toBe(false);
    });

    it('postStockTransfer() forces the payload status to posted via saveConfigRecord', () => {
      // mockImplementation: this test is only about the wrapper's delegation
      // contract (right status forwarded), not the full save pipeline --
      // letting the real body run would attempt a live HTTP save.
      const saveConfigRecordSpy = vi.spyOn(component, 'saveConfigRecord').mockImplementation(() => {});
      component.postStockTransfer();
      expect(saveConfigRecordSpy).toHaveBeenCalledWith('posted');
    });

    it('saveStockTransferDraft() forces the payload status to draft via saveConfigRecord', () => {
      const saveConfigRecordSpy = vi.spyOn(component, 'saveConfigRecord').mockImplementation(() => {});
      component.saveStockTransferDraft();
      expect(saveConfigRecordSpy).toHaveBeenCalledWith('draft');
    });

    it('postStockTransfer() refuses to re-post an already-posted transfer', () => {
      component.formValues.update(v => ({ ...v, status: 'Posted' }));
      const saveConfigRecordSpy = vi.spyOn(component, 'saveConfigRecord');
      component.postStockTransfer();
      expect(saveConfigRecordSpy).not.toHaveBeenCalled();
      expect(component.saveError()).toContain('already posted');
    });

    it('postStockTransferRecordByRow() loads the record then posts it', () => {
      component.savedRecordObjects.set([{
        id: 5, transfer_number: 'ST-EL-26-00003', status: 'draft',
        from_warehouse_name: 'Secunderabad', to_warehouse_name: 'Warangal',
        items: [{ product_name: 'Dell Desktop', uom_name: 'Nos', qty: 1 }]
      }]);
      const editSpy = vi.spyOn(component, 'editRecordByRow');
      const saveConfigRecordSpy = vi.spyOn(component, 'saveConfigRecord').mockImplementation(() => {});
      component.postStockTransferRecordByRow(['ST-EL-26-00003']);
      expect(editSpy).toHaveBeenCalledWith(['ST-EL-26-00003']);
      expect(saveConfigRecordSpy).toHaveBeenCalledWith('posted');
    });

    it('isStockTransferDraftRow() is true only for a draft-status row, false for a posted one', () => {
      component.savedRecordObjects.set([
        { id: 5, transfer_number: 'ST-DRAFT', status: 'draft', items: [] },
        { id: 6, transfer_number: 'ST-POSTED', status: 'posted', items: [] }
      ]);
      expect(component.isStockTransferDraftRow(['ST-DRAFT'])).toBe(true);
      expect(component.isStockTransferDraftRow(['ST-POSTED'])).toBe(false);
    });
  });

  // Workstream 3: cheap client-side mirror of fn_post_stock_transfer's own
  // "From Warehouse and To Warehouse cannot be the same" exception
  // (141_stock_transfer.sql), surfaced before any round-trip.
  describe('From = To Warehouse guard (Workstream 3)', () => {
    it('blocks a save when From and To Warehouse resolve to the same warehouse', () => {
      component.formValues.set({ fromWarehouse: 'Secunderabad', toWarehouse: 'Secunderabad' });
      component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
      const payload = (component as any).buildPayload();
      expect((component as any).validatePayload(payload)).toBe('From Warehouse and To Warehouse cannot be the same.');
    });

    it('allows a save when From and To Warehouse are different', () => {
      component.formValues.set({ fromWarehouse: 'Secunderabad', toWarehouse: 'Warangal' });
      component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
      const payload = (component as any).buildPayload();
      expect((component as any).validatePayload(payload)).not.toContain('cannot be the same');
    });
  });

  // Workstream E: Stock Transfer branch-primary support. A branch with zero
  // linked warehouses (e.g. Head Office) or exactly one (auto-collapses, the
  // same rule GRN/PI/Delivery Challan's merged picker already applies) is now
  // a valid location on either side of a transfer, instead of the picker
  // only ever accepting a specific Warehouse. Backed by migration 160
  // (fn_post_stock_transfer rewired onto inventory.fn_upsert_stock_balance)
  // and buildStockTransferPayload()'s new resolveMergedLocation() resolution
  // -- verified live separately (posting a real branch-only transfer).
  describe('Branch-primary support (Workstream E)', () => {
    // Distinct branch_id namespace from the outer describe's plain
    // Secunderabad(6)/Warangal(7) warehouses (which carry no branch link at
    // all) so this block's fixtures can't accidentally collide with them.
    const KUKATPALLY_WH = { id: 40, warehouse_name: 'Kukatpally WH', branch_id: 31 } as any;
    const DUAL_WH_A = { id: 41, warehouse_name: 'Dual WH A', branch_id: 32 } as any;
    const DUAL_WH_B = { id: 42, warehouse_name: 'Dual WH B', branch_id: 32 } as any;

    const HEAD_OFFICE_BRANCH = { id: 30, branch_id: 30, branch_name: 'Head Office' } as any; // zero linked warehouses
    const KUKATPALLY_BRANCH = { id: 31, branch_id: 31, branch_name: 'Kukatpally' } as any; // exactly one (KUKATPALLY_WH)
    const DUAL_BRANCH = { id: 32, branch_id: 32, branch_name: 'Dual Branch' } as any; // two linked warehouses -- ambiguous
    const VIZAG_BRANCH = { id: 33, branch_id: 33, branch_name: 'Vizag' } as any; // zero linked warehouses, distinct from Head Office

    beforeEach(() => {
      (component as any).loadedWarehouseObjects.set([
        { id: 6, warehouse_name: 'Secunderabad' } as any,
        { id: 7, warehouse_name: 'Warangal' } as any,
        KUKATPALLY_WH, DUAL_WH_A, DUAL_WH_B
      ]);
      (component as any).loadedBranchObjects.set([HEAD_OFFICE_BRANCH, KUKATPALLY_BRANCH, DUAL_BRANCH, VIZAG_BRANCH]);
      component.entryLineRows.set([['Dell Desktop', '', '', 'Nos', '2', '', '']]);
    });

    it('resolves a From branch with zero linked warehouses straight to branch_id -- no warehouse required', () => {
      component.formValues.set({ fromWarehouse: 'Head Office', toWarehouse: 'Warangal' });
      const payload = (component as any).buildPayload();
      expect(payload.from_warehouse_id).toBeFalsy();
      expect(payload.from_branch_id).toBe(30);
      expect(payload.from_branch_name).toBe('Head Office');
      expect(payload.to_warehouse_id).toBe(7);
      expect(payload.to_branch_id).toBeNull();
      expect((component as any).validatePayload(payload)).toBe('');
    });

    // Full Warehouse/Branch Independence: a branch with exactly one linked
    // warehouse no longer auto-collapses into it -- it posts/transfers
    // branch-only, directly, exactly like a branch with zero or several
    // linked warehouses.
    it('a branch with exactly one linked warehouse posts branch-only now, no longer auto-collapsed into it', () => {
      component.formValues.set({ fromWarehouse: 'Head Office', toWarehouse: 'Kukatpally' });
      const payload = (component as any).buildPayload();
      expect(payload.to_warehouse_id).toBeFalsy();
      expect(payload.to_branch_id).toBe(31);
      expect(payload.to_branch_name).toBe('Kukatpally');
      expect((component as any).validatePayload(payload)).toBe('');
    });

    // A branch with several linked warehouses used to be refused as
    // ambiguous; there is nothing left to disambiguate now that a branch
    // pick is always valid on its own (fn_post_stock_transfer, migration 160,
    // already posts straight against a Branch on either side).
    it('a branch with several linked warehouses is no longer ambiguous on the From side -- transfers branch-only', () => {
      component.formValues.set({ fromWarehouse: 'Dual Branch', toWarehouse: 'Warangal' });
      const payload = (component as any).buildPayload();
      expect(payload.from_warehouse_id).toBeFalsy();
      expect(payload.from_branch_id).toBe(32);
      expect(payload.from_branch_name).toBe('Dual Branch');
      expect((component as any).validatePayload(payload)).toBe('');
    });

    it('a branch with several linked warehouses is no longer ambiguous on the To side -- transfers branch-only', () => {
      component.formValues.set({ fromWarehouse: 'Head Office', toWarehouse: 'Dual Branch' });
      const payload = (component as any).buildPayload();
      expect(payload.to_warehouse_id).toBeFalsy();
      expect(payload.to_branch_id).toBe(32);
      expect(payload.to_branch_name).toBe('Dual Branch');
      expect((component as any).validatePayload(payload)).toBe('');
    });

    it('allows two different branch-only locations on From and To', () => {
      component.formValues.set({ fromWarehouse: 'Head Office', toWarehouse: 'Vizag' });
      const payload = (component as any).buildPayload();
      expect(payload.from_branch_id).toBe(30);
      expect(payload.to_branch_id).toBe(33);
      expect((component as any).validatePayload(payload)).toBe('');
    });

    // The same-branch guard itself (From Branch == To Branch) lives in
    // fn_post_stock_transfer (migration 160), not in this client-side
    // validatePayload() -- verified live, not here; see the migration's own
    // header comment and the plan's Workstream E verification steps. This
    // pins down that a genuinely different branch on each side is NOT
    // wrongly blocked by anything client-side.
  });

  // Item 4a: Stock Transfer's From location gets the same "available stock
  // here" hint DC/SI already show on their own outward qty column --
  // salesOutwardStockControlState()'s gate was widened to include
  // 'stockTransfer', reusing the exact same hint-building pattern rather
  // than a new one.
  describe('Available-stock hint on the From location (item 4a)', () => {
    beforeEach(() => {
      (component as any).loadedProductObjects.set([{ id: 14, product_name: 'Dell Desktop' } as any]);
    });

    it('shows "Available here" for the From Warehouse, scoped to that warehouse\'s own stock', () => {
      component.formValues.set({ fromWarehouse: 'Secunderabad', toWarehouse: 'Warangal' });
      const row = ['Dell Desktop', '', '', 'Nos', '2', '', ''];
      component.entryLineRows.set([row]);
      (component as any).availableStockCache.set({
        [(component as any).availableStockKey(14, null)]: [
          { warehouse_id: 6, warehouse_name: 'Secunderabad', available: 15 },
          { warehouse_id: 7, warehouse_name: 'Warangal', available: 40 }
        ]
      });

      const state = (component as any).salesOutwardStockControlState('Qty', row, 4);
      expect(state.message).toBe('Available here: 15 Nos');
      expect(state.severity).toBe('info');
    });

    it('warns "Short by X here" when the From location cannot cover the transfer qty', () => {
      component.formValues.set({ fromWarehouse: 'Secunderabad', toWarehouse: 'Warangal' });
      const row = ['Dell Desktop', '', '', 'Nos', '20', '', ''];
      component.entryLineRows.set([row]);
      (component as any).availableStockCache.set({
        [(component as any).availableStockKey(14, null)]: [
          { warehouse_id: 6, warehouse_name: 'Secunderabad', available: 5 },
          { warehouse_id: 7, warehouse_name: 'Warangal', available: 40 }
        ]
      });

      const state = (component as any).salesOutwardStockControlState('Qty', row, 4);
      expect(state.severity).toBe('warn');
      expect(state.message).toContain('Short by 15');
      expect(state.message).toContain('Warangal: 40');
    });

    it('works the same way when the From side resolves to a Branch instead of a Warehouse', () => {
      (component as any).loadedBranchObjects.set([{ id: 30, branch_id: 30, branch_name: 'Head Office' } as any]);
      component.formValues.set({ fromWarehouse: 'Head Office', toWarehouse: 'Warangal' });
      const row = ['Dell Desktop', '', '', 'Nos', '2', '', ''];
      component.entryLineRows.set([row]);
      (component as any).availableStockCache.set({
        [(component as any).availableStockKey(14, null)]: [
          { warehouse_id: null, branch_id: 30, branch_name: 'Head Office', available: 9 }
        ]
      });

      const state = (component as any).salesOutwardStockControlState('Qty', row, 4);
      expect(state.message).toBe('Available here: 9 Nos');
    });
  });

  // Item 4b: Stock Transfer's Serial No column now uses the same real
  // picker (InventorySerialPickerModalComponent / openSerialPicker() /
  // lineSerialUnitsMap) as GRN/DC/SI/PR/SR, instead of a plain free-text
  // cell with no picker wired in at all.
  describe('Serial picker wiring (item 4b)', () => {
    beforeEach(() => {
      (component as any).loadedProductObjects.set([
        { id: 14, product_name: 'Dell Desktop' } as any,
        { id: 20, product_name: 'Serial Router', serial_applicable: true } as any
      ]);
    });

    it('resolveHeaderLocationForSerialPicker() reads Stock Transfer\'s own "fromWarehouse" field (not "warehouse")', () => {
      component.formValues.set({ fromWarehouse: 'Secunderabad' });
      const resolved = (component as any).resolveHeaderLocationForSerialPicker();
      expect(resolved.warehouseId).toBe(6);
      expect(resolved.branchId).toBeNull();
    });

    it('resolveHeaderLocationForSerialPicker() resolves a Branch-selected From side too', () => {
      (component as any).loadedBranchObjects.set([{ id: 30, branch_id: 30, branch_name: 'Head Office' } as any]);
      component.formValues.set({ fromWarehouse: 'Head Office' });
      const resolved = (component as any).resolveHeaderLocationForSerialPicker();
      expect(resolved.warehouseId).toBeNull();
      expect(resolved.branchId).toBe(30);
    });

    it('isSerialApplicableRow()/lineGridColumnIsSerialPicker() recognize the Serial No column for a serial-tracked product', () => {
      const row = ['Serial Router', '', '', 'Nos', '1', '', ''];
      expect((component as any).isSerialApplicableRow(row)).toBe(true);
      expect(component.lineGridColumnIsSerialPicker('Serial No')).toBe(true);
    });

    it('re-opening a saved draft restores lineSerialUnitsMap from the record\'s serial_numbers (no more "0 entered" on reload)', () => {
      component.savedRecordObjects.set([{
        id: 2, transfer_number: 'ST-EL-26-00002', transfer_date: '2026-08-16',
        from_warehouse_name: 'Secunderabad', to_warehouse_name: 'Warangal',
        status: 'draft',
        items: [{ product_name: 'Serial Router', uom_name: 'Nos', qty: 2, serial_numbers: ['SN-100', 'SN-101'] }]
      }]);

      component.editRecordByRow(['ST-EL-26-00002']);

      expect((component as any).lineSerialUnitsMap()[0]).toEqual(['SN-100', 'SN-101']);
    });

    it('re-saving a re-opened draft resends the restored serials, not null', () => {
      component.savedRecordObjects.set([{
        id: 2, transfer_number: 'ST-EL-26-00002', transfer_date: '2026-08-16',
        from_warehouse_name: 'Secunderabad', to_warehouse_name: 'Warangal',
        status: 'draft',
        items: [{ product_name: 'Serial Router', uom_name: 'Nos', qty: 2, serial_numbers: ['SN-100', 'SN-101'] }]
      }]);
      component.editRecordByRow(['ST-EL-26-00002']);

      const payload = (component as any).buildPayload();

      expect(payload.items[0].serial_numbers).toEqual(['SN-100', 'SN-101']);
    });
  });

  // Bug-fix report follow-up (2026-08-27): the reported "Insufficient stock
  // ... available 0" failure traced back to historical inv_stock_balance
  // rows missing attribute_id/attribute_value (a pre-migration-159/163 data
  // gap in fn_post_pi_stock/fn_post_grn_stock, fixed there going forward) --
  // NOT a bug in Stock Transfer's own warehouse/branch resolution, which was
  // verified correct end-to-end. Two narrow UX changes shipped alongside
  // that investigation are covered below: the stale "Warehouse"-only labels,
  // and making the From/To pickers live-mutually-exclusive.
  it('labels both location fields "... Warehouse / Branch", not the stale "... Warehouse" wording', () => {
    const fromField = stockTransferConfig.fields?.find(f => f.key === 'fromWarehouse');
    const toField = stockTransferConfig.fields?.find(f => f.key === 'toWarehouse');
    expect(fromField?.label).toBe('From Warehouse / Branch');
    expect(toField?.label).toBe('To Warehouse / Branch');
  });

  describe('Mutually exclusive From/To pickers', () => {
    const fields = [
      { key: 'fromWarehouse', label: 'From Warehouse / Branch', type: 'select' as const, options: [], addMaster: 'Location' },
      { key: 'toWarehouse', label: 'To Warehouse / Branch', type: 'select' as const, options: [], addMaster: 'Location' }
    ];

    beforeEach(() => {
      component.config = { ...config, fields };
      (component as any).loadedWarehouseObjects.set([
        { id: 6, warehouse_name: 'Secunderabad' } as any,
        { id: 7, warehouse_name: 'Warangal' } as any,
        // Deliberately shares its display name with a BRANCH below, to prove
        // exclusion is by resolved {type, id}, never by label text alone.
        { id: 50, warehouse_name: 'Kukatpally' } as any
      ]);
      (component as any).loadedBranchObjects.set([
        { id: 60, branch_id: 60, branch_name: 'Kukatpally' } as any,
        { id: 61, branch_id: 61, branch_name: 'Head Office' } as any
      ]);
      // mergedLocationEntries() (the merged Warehouse/Branch picker's single
      // source of truth) takes its label lists from these two option-string
      // signals, then decorates each label with {type, id} by matching it
      // back against loadedWarehouseObjects/loadedBranchObjects above.
      (component as any).warehouseOptionList.set(['Secunderabad', 'Warangal', 'Kukatpally']);
      (component as any).branchOptionList.set(['Kukatpally', 'Head Office']);
    });

    function optionsFor(key: 'fromWarehouse' | 'toWarehouse'): string[] {
      return component.displayFields().find((f: any) => f.key === key)?.options || [];
    }

    function groupedOptionsFor(key: 'fromWarehouse' | 'toWarehouse'): any[] {
      const field = fields.find(candidate => candidate.key === key);
      return (component as any).locationGroupsForField(field);
    }

    it('offers every Warehouse and Branch on From, but only Branches on To, when neither is picked yet', () => {
      component.formValues.set({});
      expect(optionsFor('fromWarehouse')).toEqual(['Secunderabad', 'Warangal', 'Kukatpally', 'Head Office']);
      expect(optionsFor('toWarehouse')).toEqual(['Kukatpally', 'Head Office']);
      expect(groupedOptionsFor('toWarehouse').every(option => option.type === 'branch')).toBe(true);
    });

    it('removes the location picked on To from the From options', () => {
      component.formValues.set({ toWarehouse: 'Head Office' });
      expect(optionsFor('fromWarehouse')).not.toContain('Head Office');
      expect(optionsFor('fromWarehouse')).toEqual(['Secunderabad', 'Warangal', 'Kukatpally']);

      component.formValues.set({ fromWarehouse: 'Secunderabad' });
      expect(optionsFor('toWarehouse')).toEqual(['Kukatpally', 'Head Office']);
    });

    it('removes a Branch picked on From from the To options', () => {
      component.formValues.set({ fromWarehouse: 'Head Office' });
      expect(optionsFor('toWarehouse')).not.toContain('Head Office');
      expect(optionsFor('toWarehouse')).toEqual(['Kukatpally']);
    });

    it('keeps a saved transfer\'s Warehouse on To so it still shows when opened for edit', () => {
      component.formValues.set({ toWarehouse: 'Warangal' });
      expect(optionsFor('toWarehouse')).toEqual(['Warangal', 'Kukatpally', 'Head Office']);
    });

    it('resolves a To label shared by a Warehouse and a Branch to the Branch', () => {
      const resolved = (component as any).resolveStockTransferToLocation('Kukatpally');
      expect(resolved.type).toBe('branch');
      expect(resolved.branch?.branch_id).toBe(60);
    });

    it('removes the selected location from the grouped ng-select options the template renders', () => {
      component.formValues.set({ fromWarehouse: 'Head Office' });
      expect(groupedOptionsFor('toWarehouse').map(option => option.label)).not.toContain('Head Office');

      component.formValues.set({ toWarehouse: 'Warangal' });
      expect(groupedOptionsFor('fromWarehouse').map(option => option.label)).not.toContain('Warangal');
    });

    // The crux of "compare by resolved type+id, not name": a Warehouse and a
    // Branch both named "Kukatpally" exist. Picking the WAREHOUSE on one side
    // must not remove the label "Kukatpally" from the other side entirely --
    // the BRANCH "Kukatpally" is a different location and must stay pickable.
    it('does not exclude a same-named Branch when the Warehouse of that name was picked (and vice versa)', () => {
      component.formValues.set({ toWarehouse: 'Kukatpally' }); // To is branch-only, so this resolves to the BRANCH (id 60)
      const fromOptions = optionsFor('fromWarehouse');
      // "Kukatpally" is still offered on From -- there it refers to the WAREHOUSE (id 50), a distinct location from the Branch chosen on To.
      expect(fromOptions).toContain('Kukatpally');
      expect(fromOptions).toEqual(['Secunderabad', 'Warangal', 'Kukatpally', 'Head Office']);
    });

    it('does not exclude anything when the other side holds a value that resolves to no master row', () => {
      component.formValues.set({ toWarehouse: 'Nonexistent Place' });
      expect(optionsFor('fromWarehouse')).toEqual(['Secunderabad', 'Warangal', 'Kukatpally', 'Head Office']);
    });

    // Live UX bug report ("from/to warehouse hard to select, too hard"),
    // root-caused 2026-08-28: displayFields() runs on every change-detection
    // pass, and the From/To ng-selects bind [items]="field.options" straight
    // off its output. Every other merged-picker screen (GRN/PI/DC/PR/SI) hands
    // ng-select a real computed()'s cached array, so repeated reads return the
    // SAME array instance and ng-select's [items] setter sees no change. This
    // field used to be backed by a plain method that called
    // Array.from(new Set(...)) fresh on every single invocation -- a brand
    // new array reference on every keystroke/digest anywhere on the page,
    // even with zero actual change in state, which made ng-select repeatedly
    // reset its open/filtered/highlighted state (that's the "too hard to
    // select" symptom). Fixed by moving the computation behind two computed()
    // signals (stockTransferFromWarehouseOptions/stockTransferToWarehouseOptions).
    // This test locks in the fix: two reads with no state change in between
    // must return the identical array instance, not just an equal one.
    it('returns the SAME array instance across repeated reads when nothing changed (ng-select referential-stability fix)', () => {
      component.formValues.set({ toWarehouse: 'Warangal' });
      const first = optionsFor('fromWarehouse');
      const second = optionsFor('fromWarehouse');
      expect(second).toBe(first);

      const firstTo = optionsFor('toWarehouse');
      const secondTo = optionsFor('toWarehouse');
      expect(secondTo).toBe(firstTo);
    });

    it('returns a NEW array instance once the other side\'s selection actually changes', () => {
      component.formValues.set({ toWarehouse: 'Warangal' });
      const before = optionsFor('fromWarehouse');

      component.formValues.set({ toWarehouse: 'Secunderabad' });
      const after = optionsFor('fromWarehouse');

      expect(after).not.toBe(before);
      expect(after).not.toContain('Secunderabad');
    });
  });
});
