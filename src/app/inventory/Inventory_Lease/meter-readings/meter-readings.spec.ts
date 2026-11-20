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
