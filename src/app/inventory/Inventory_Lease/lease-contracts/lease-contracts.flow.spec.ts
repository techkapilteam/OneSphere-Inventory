import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LeaseMeterService } from '../lease-meter.service';
import { InventoryLeaseContractsComponent } from './lease-contracts';

// Functional checks of the contract screen's two grids with a stubbed API.
describe('InventoryLeaseContractsComponent flows', () => {
  let c: any;
  let api: LeaseMeterService;

  const copies = {
    id: 11, product_name: 'Copies', product_code: 'SRV-1', sku: 'SRV-1', base_uom_name: 'Each',
    applicable_variants: [
      { id: 3, variant_name: 'A3', variant_label: 'A3', is_default: false },
      { id: 4, variant_name: 'A4', variant_label: 'A4', is_default: true }
    ]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryLeaseContractsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), DatePipe]
    }).compileComponents();
    api = TestBed.inject(LeaseMeterService);
    vi.spyOn(api, 'getContracts').mockReturnValue(of({ success: true, message: '', data: [] }));
    vi.spyOn(api, 'getAvailableAssets').mockReturnValue(of({
      success: true, message: '', data: [
        { product_id: 7, product_name: 'Bajaj Auto Rickshaw', product_code: 'AST-7', serial_unit_id: 101, asset_ref: 'TS09AB1234', serial_tracked: true, identifier_label: 'RC No', location_name: 'Main Warehouse' },
        { product_id: 7, product_name: 'Bajaj Auto Rickshaw', product_code: 'AST-7', serial_unit_id: 102, asset_ref: 'TS09AB5678', serial_tracked: true, identifier_label: 'RC No', location_name: 'Main Warehouse' },
        { product_id: 8, product_name: 'Water Dispenser', product_code: 'AST-8', serial_unit_id: null, asset_ref: null, serial_tracked: false, identifier_label: 'Asset No', location_name: null }
      ]
    }));
    const fixture = TestBed.createComponent(InventoryLeaseContractsComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    c.loadedProductObjects.set([copies]);
  });

  it('meter row: product + variant from the shared grid become the contract meter', () => {
    c.setEntryLineCell(0, 0, 'Copies');
    c.setEntryLineCell(0, 1, 'A3');
    const extra = c.leaseMeter(0);
    extra.rates[0].rate = 0.5;
    const { meters, problem } = c.leaseCollectMeters();
    expect(problem).toBeNull();
    expect(meters.length).toBe(1);
    expect(meters[0].charge_product_id).toBe(11);
    expect(meters[0].variant_id).toBe(3);
    expect(meters[0].variant_name).toBe('A3');
    expect(meters[0].meter_label).toBe('Copies');
    expect(meters[0].rates[0].rate).toBe(0.5);
  });

  it('meter row without a rate (and no slabs) is refused; blank rows are ignored', () => {
    expect(c.leaseCollectMeters().meters.length).toBe(0);
    c.setEntryLineCell(0, 0, 'Copies');
    expect(c.leaseCollectMeters().problem).toContain('enter the rate');
  });

  it('opening a saved contract puts its meters back into the shared grid rows', () => {
    vi.spyOn(api, 'getContract').mockReturnValue(of({
      success: true, message: '', data: {
        id: 9, contract_no: 'LSE-26-00009', customer_id: 1, contract_type: 'rent_usage', start_date: '2026-11-01', billing_cycle: 'monthly', billing_mode: 'arrears',
        fixed_rent_amount: 0, rent_product_id: null, status: 'active',
        meters: [{ id: 5, charge_product_id: 11, charge_product_name: 'Copies', variant_id: 3, variant_name: 'A3', opening_reading: 100, meter_label: 'Printer 1 A3',
          rates: [{ effective_from: '2026-11-01', rate: 0.5, free_qty: 0, min_charge: 0, slabs: [] }] }],
        assets: [{ id: 2, contract_id: 9, product_id: 7, product_name: 'Bajaj Auto Rickshaw', asset_ref: 'TS09AB1234', customer_id: 1, handover_date: '2026-11-01', status: 'on_lease',
          rent_applicable: true, rent_uom_id: 3, rent_unit_name: 'Per Day', rent_rate: 400 }]
      }
    } as any));
    c.leaseOpen(9);
    const rows = c.directEntryLineRows();
    expect(rows.length).toBe(1);
    expect(rows[0][0]).toBe('Copies');
    expect(rows[0][1]).toBe('A3');
    expect(c.leaseMeter(0).meter_label).toBe('Printer 1 A3');
    expect(c.leaseAssets[0].rent_applicable).toBe(true);
    expect(c.leaseAssets[0].rent_rate).toBe(400);
  });

  it('asset picking: product first, then the RC / serial numbers received; each ticked number is its own row', () => {
    const products = c.leaseAssetProductRows();
    expect(products.map((p: any) => p.name)).toEqual(['Bajaj Auto Rickshaw', 'Water Dispenser']);
    expect(products[0].sub).toContain('RC No');
    expect(products[0].sub).toContain('2 in stock');

    c.leaseAddAssetRow();
    c.leaseOnAssetProductPicked(0, 7);
    expect(c.leaseAssets[0].serial_tracked).toBe(true);
    expect(c.leaseAssets[0].identifier_label).toBe('RC No');
    expect(c.leaseUnitPickerFor()).toBe(0);          // goes straight to the RC number picker
    expect(c.leaseUnitLabel()).toBe('RC No');
    expect(c.leaseUnitRows().map((r: any) => r.name)).toEqual(['TS09AB1234', 'TS09AB5678']);

    c.leaseAssets[0].rent_applicable = true; c.leaseAssets[0].rent_uom_id = 3; c.leaseAssets[0].rent_rate = 400;
    c.leaseOnUnitsPicked(0, [101, 102]);
    expect(c.leaseAssets.length).toBe(2);
    expect(c.leaseAssets.map((a: any) => a.asset_ref)).toEqual(['TS09AB1234', 'TS09AB5678']);
    expect(c.leaseAssets[1].rent_rate).toBe(400);    // the second unit inherits the rent terms
    // numbers already used on this form are not offered again: with both used, the rickshaw is no longer listed
    expect(c.leaseAssetProductRows().map((p: any) => p.name)).toEqual(['Water Dispenser']);
  });

  it('a non-serial asset takes a typed asset number', () => {
    c.leaseAddAssetRow();
    c.leaseOnAssetProductPicked(0, 8);
    expect(c.leaseAssets[0].serial_tracked).toBe(false);
    expect(c.leaseUnitPickerFor()).toBeNull();
  });


  it('site address: the customer address by default, or a separate installation address with its state', () => {
    c.leaseDraft.customer_id = 1;
    expect(c.deliveryAddressEnabled()).toBe(true);   // address block is shown once a customer is chosen
    c.formValues.update((v: any) => ({ ...v, deliveryStreet: 'Plot 1, Station Road', deliveryState: 'Telangana', deliveryCity: 'Warangal', deliveryPincode: '506002' }));
    let site = c.leaseSiteFields();
    expect(site.site_address).toBe('Plot 1, Station Road');
    expect(site.site_state).toBe('Telangana');
    expect(site.site_city).toBe('Warangal');

    c.formValues.update((v: any) => ({ ...v, shipSameAsDelivery: 'No', shipAddress: '3rd Floor, MG Road, Bengaluru 560001', shipState: 'Karnataka' }));
    site = c.leaseSiteFields();
    expect(site.site_address).toBe('3rd Floor, MG Road, Bengaluru 560001');
    expect(site.site_state).toBe('Karnataka');
    // no Karnataka GSTIN on this customer: a notice that the bill uses the customer's own state
    expect(c.shipStateMismatchMessage()).toContain('no GSTIN registered in Karnataka');
    // the installation address and state are mandatory when it differs from the customer's address
    c.formValues.update((v: any) => ({ ...v, shipAddress: '' }));
    expect(c.leaseValidate()).toContain('installation address');
  });

  it('rent applicable without a rental unit / rate is refused', () => {
    c.leaseDraft.customer_id = 1;
    c.leaseAddAssetRow();
    c.leaseOnAssetProductPicked(0, 8);
    c.leaseAssets[0].asset_ref = 'WD-1';
    c.leaseAssets[0].rent_applicable = true;
    expect(c.leaseValidate()).toContain('rental unit');
    c.leaseAssets[0].rent_uom_id = 3;
    expect(c.leaseValidate()).toContain('rent rate');
    c.leaseAssets[0].rent_rate = 300;
    expect(c.leaseValidate()).toBeNull();
  });
});
