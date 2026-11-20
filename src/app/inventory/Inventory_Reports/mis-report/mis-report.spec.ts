import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { MisReportComponent } from './mis-report';
import { AuthService } from '../../../core/host/host-bridge';
import { InventoryReportsService, MisReport } from '../shared/inventory-reports.service';

// Item: MIS Report -- Admin-only, so the component's own explicit
// authService.can('INV_R_MIS','view') gate is the thing most worth covering
// here (screenPermissionGuard on the route is non-blocking, so this
// in-component check is the real enforcement). Also covers the
// company-wide + segment figures landing in the right signals, and the
// error path.
describe('MisReportComponent', () => {
  let fixture: ComponentFixture<MisReportComponent>;
  let component: MisReportComponent;
  let getMisReportCalls: Array<{ dateFrom?: string; dateTo?: string }>;
  let misReportResult: MisReport;

  function buildReport(overrides: Partial<MisReport> = {}): MisReport {
    return {
      financialYear: '2026-2027',
      dateFrom: '2026-04-01',
      dateTo: '2027-03-31',
      companyWide: {
        sales: 3430000,
        purchases: 2530000,
        stockValue: 1820000,
        payables: 850000,
        receivables: 677000,
        payablesAgeing: [{ bucket: '0-30', amount: 500000 }, { bucket: '31-60', amount: 350000 }],
        receivablesAgeing: [{ bucket: '0-30', amount: 400000 }, { bucket: '31-60', amount: 277000 }],
        topSellingProducts: [{ productName: 'LED Display 32 inch', amount: 1512000, qty: 48 }]
      },
      segments: [
        { segmentId: 1, segmentName: 'Electronics', sales: 2450000, purchases: 1820000, payables: 640000, receivables: 512000 },
        { segmentId: 2, segmentName: 'Agro Product', sales: 980000, purchases: 710000, payables: 210000, receivables: 165000 }
      ],
      ...overrides
    };
  }

  function configure(canView: boolean, reportsServiceStub: Partial<InventoryReportsService>): Promise<void> {
    return TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [MisReportComponent],
        providers: [
          provideHttpClient(),
          { provide: AuthService, useValue: { can: () => canView } },
          { provide: InventoryReportsService, useValue: reportsServiceStub }
        ]
      })
      .compileComponents()
      .then(() => {
        fixture = TestBed.createComponent(MisReportComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
      });
  }

  beforeEach(async () => {
    getMisReportCalls = [];
    misReportResult = buildReport();

    const reportsServiceStub: Partial<InventoryReportsService> = {
      getMisReport: (dateFrom?: string, dateTo?: string) => {
        getMisReportCalls.push({ dateFrom, dateTo });
        return of(misReportResult);
      }
    };

    await configure(true, reportsServiceStub);
  });

  it('renders the blocked message and never calls the service when the user lacks INV_R_MIS view access', async () => {
    getMisReportCalls = [];
    await configure(false, { getMisReport: () => { throw new Error('should not be called'); } });

    expect(component.canView()).toBe(false);
    expect(getMisReportCalls.length).toBe(0);
    const blocked = fixture.nativeElement.querySelector('.mis-blocked');
    expect(blocked).toBeTruthy();
    expect(blocked.textContent).toContain('Admin access required');
  });

  it('auto-loads the report on init for an Admin-permissioned user', () => {
    expect(component.canView()).toBe(true);
    expect(getMisReportCalls).toEqual([{ dateFrom: undefined, dateTo: undefined }]);
    expect(component.hasResult()).toBe(true);
  });

  it('populates company-wide KPI figures from the response', () => {
    const cw = component.companyWide()!;
    expect(cw.sales).toBe(3430000);
    expect(cw.purchases).toBe(2530000);
    expect(cw.stockValue).toBe(1820000);
    expect(cw.payables).toBe(850000);
    expect(cw.receivables).toBe(677000);
  });

  it('populates the segment breakdown from the response', () => {
    const segments = component.segments();
    expect(segments.length).toBe(2);
    expect(segments[0].segmentName).toBe('Electronics');
    expect(component.segmentChartLabels()).toEqual(['Electronics', 'Agro Product']);
    expect(component.segmentChartSeries()).toEqual([
      { label: 'Sales', data: [2450000, 980000] },
      { label: 'Purchases', data: [1820000, 710000] }
    ]);
  });

  it('generate() passes the selected date range through to the service', () => {
    component.onDateFromChange('2026-04-01');
    component.onDateToChange('2026-08-18');

    component.generate();

    expect(getMisReportCalls[getMisReportCalls.length - 1]).toEqual({ dateFrom: '2026-04-01', dateTo: '2026-08-18' });
  });

  it('generate() surfaces a friendly error and leaves report null when the service fails', async () => {
    await configure(true, { getMisReport: () => throwError(() => ({ error: { message: 'boom' } })) });

    expect(component.report()).toBeNull();
    expect(component.loaded()).toBe(true);
    expect(component.errorMessage()).toBe('boom');
  });

  it('formatCurrency() renders a rupee-prefixed, locale-formatted amount', () => {
    expect(component.formatCurrency(850000)).toBe('Rs. 8,50,000');
    expect(component.formatCurrency(null)).toBe('Rs. 0');
  });
});
