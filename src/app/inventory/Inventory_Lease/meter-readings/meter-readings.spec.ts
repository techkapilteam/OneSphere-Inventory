import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LeaseMeterService } from '../lease-meter.service';
import { InventoryMeterReadingsComponent } from './meter-readings';

describe('InventoryMeterReadingsComponent', () => {
  let c: any;
  let api: LeaseMeterService;
  let fixture: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryMeterReadingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), DatePipe]
    }).compileComponents();
    api = TestBed.inject(LeaseMeterService);
    vi.spyOn(api, 'getContracts').mockReturnValue(of({ success: true, message: '', data: [] }));
    vi.spyOn(api, 'getContract').mockReturnValue(of({
      success: true, message: '', data: {
        id: 9, contract_no: 'LSE-26-00009', meters: [
          { id: 1, meter_label: 'Printer Copies', variant_name: 'A4', unit_name: 'Copy', opening_reading: 100, charge_product_id: 11, status: 'active' },
          { id: 2, meter_label: 'Printer Copies', variant_name: 'A3', unit_name: 'Copy', opening_reading: 0, charge_product_id: 11, status: 'active' }
        ]
      }
    } as any));
    vi.spyOn(api, 'getReadings').mockReturnValue(of({ success: true, message: '', data: [
      { id: 50, lease_meter_id: 1, reading_date: '2026-11-01', reading_value: 250, status: 'verified' }
    ] } as any));
    fixture = TestBed.createComponent(InventoryMeterReadingsComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    c.selectContract(9);
  });

  it('binds every meter item of the contract as a row, variants included', () => {
    expect(c.rows().length).toBe(2);
    expect(c.meterName(c.rows()[0].meter)).toBe('Printer Copies - A4');
    expect(c.meterName(c.rows()[1].meter)).toBe('Printer Copies - A3');
  });

  it('previous comes from the last reading, else the opening reading; usage is live', () => {
    expect(c.previousOf(c.rows()[0].meter)).toBe(250);
    expect(c.previousOf(c.rows()[1].meter)).toBe(0);
    c.rows()[0].value = 400;
    expect(c.usageOf(c.rows()[0])).toBe('150');
  });

  it('a usage-quantity entry needs no counter: previous is ignored, usage is the quantity, and the meter remembers the mode', () => {
    c.rows()[1].type = 'usage';
    c.rows()[1].value = 12;
    expect(c.usageOf(c.rows()[1])).toBe('12');
    const save = vi.spyOn(api, 'saveReading').mockImplementation((b: any) => of({ success: true, message: '', data: { id: 7 } } as any));
    vi.spyOn(api, 'verifyReadings').mockReturnValue(of({ success: true, message: '', data: { verified: 1, requested: 1 } }));
    c.save();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ lease_meter_id: 2, reading_value: 12, reading_type: 'usage' }));
    // usage entries do not become the "previous" counter value; the next entry defaults to usage for that meter
    c.readings.set([{ id: 60, lease_meter_id: 2, reading_date: '2026-11-20', reading_value: 12, reading_type: 'usage', status: 'verified' }]);
    expect(c.previousOf(c.rows()[1].meter)).toBe(0);
    expect(c.defaultTypeOf(c.rows()[1].meter)).toBe('usage');
    expect(c.defaultTypeOf(c.rows()[0].meter)).toBe('normal');
  });


  it('has no Void; the latest unbilled reading of a meter can be corrected in place', () => {
    c.readings.set([
      { id: 50, lease_meter_id: 1, reading_date: '2026-11-01', reading_value: 250, reading_type: 'normal', status: 'billed' },
      { id: 51, lease_meter_id: 1, reading_date: '2026-11-10', reading_value: 300, reading_type: 'normal', status: 'verified' },
      { id: 52, lease_meter_id: 2, reading_date: '2026-11-10', reading_value: 40, reading_type: 'normal', status: 'billed' }
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Void');
    expect(c.canEditReading(c.readings()[1])).toBe(true);    // latest of meter 1, verified
    expect(c.canEditReading(c.readings()[0])).toBe(false);   // older / billed
    expect(c.editableOf(c.rows()[1].meter)).toBe(false);     // meter 2: its latest is billed

    const save = vi.spyOn(api, 'saveReading').mockImplementation((b: any) => of({ success: true, message: '', data: { id: b.id, status: 'verified' } } as any));
    const verify = vi.spyOn(api, 'verifyReadings');
    c.editLast(c.rows()[0]);
    expect(c.rows()[0].value).toBe(300);
    expect(c.previousOf(c.rows()[0].meter, c.rows()[0].editId)).toBe(250);   // continues from the reading before it
    c.rows()[0].value = 320;
    c.save();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 51, lease_meter_id: 1, reading_value: 320 }));
    expect(verify).not.toHaveBeenCalled();                   // already verified: nothing to verify again
  });

  it('inside billing: only that customer contracts are offered, and a single contract is opened for them', async () => {
    const f2 = TestBed.createComponent(InventoryMeterReadingsComponent);
    f2.componentRef.setInput('embedded', true);
    (api.getContracts as any).mockReturnValue(of({ success: true, message: '', data: [
      { id: 9, contract_no: 'LSE-9', customer_id: 1, customer_name: 'Alpha', status: 'active' },
      { id: 10, contract_no: 'LSE-10', customer_id: 2, customer_name: 'Beta', status: 'active' }
    ] }));
    f2.detectChanges();
    f2.componentRef.setInput('customerId', 1);
    f2.detectChanges();
    const c2: any = f2.componentInstance;
    expect(c2.contractOptions().map((o: any) => o.id)).toEqual([9]);
    expect(c2.contractId()).toBe(9);
    f2.componentRef.setInput('customerId', 2);
    expect(c2.contractOptions().map((o: any) => o.id)).toEqual([10]);
    expect(f2.nativeElement.textContent).not.toContain('Reading History');
  });

  it('saves all filled rows and verifies them; refuses a lower reading', () => {
    const save = vi.spyOn(api, 'saveReading').mockImplementation((b: any) => of({ success: true, message: '', data: { id: b.lease_meter_id * 10 } } as any));
    const verify = vi.spyOn(api, 'verifyReadings').mockReturnValue(of({ success: true, message: '', data: { verified: 2, requested: 2 } }));
    c.rows()[0].value = 100;
    c.save();
    expect(c.error()).toContain('lower than the previous');
    expect(save).not.toHaveBeenCalled();

    c.rows()[0].value = 400; c.rows()[1].value = 55;
    c.save();
    expect(save).toHaveBeenCalledTimes(2);
    expect(verify).toHaveBeenCalledWith([10, 20]);
    expect(c.message()).toContain('2 reading(s) saved and verified');
  });
});
