import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { InventoryReportPageComponent } from './inventory-report-page';
import { INVENTORY_REPORTS } from '../shared/inventory-report.registry';

// Round 1 of "Warehouse/Branch independent stock".
//
// Branch and Warehouse are offered as ONE combined multiselect, but the actual
// row filtering goes through rowFieldsForFilter(). Its branchId entry was an
// empty array, and matchesValueFilter() treats "no fields" as "matches" — so
// picking a Branch filtered NOTHING, silently returning every row as though no
// filter had been applied. Warehouse worked because its entry lists real row
// field names. This pins the fix, and the reports whose location column is now
// labelled for both kinds of location.
describe('InventoryReportPageComponent — Branch filter actually filters', () => {
  let fixture: ComponentFixture<InventoryReportPageComponent>;
  let component: InventoryReportPageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryReportPageComponent],
      providers: [
        provideHttpClient(),
        DatePipe,
        { provide: MessageService, useValue: { add: () => {}, addAll: () => {}, clear: () => {} } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ reportKey: 'warehouse-wise-stock' })) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryReportPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const rowFields = (key: string): string[] => (component as any).rowFieldsForFilter(key);

  it('maps branchId to real row field names instead of an empty list', () => {
    expect(rowFields('branchId').length).toBeGreaterThan(0);
    // 'branch' is the field the stock reports now return (Warehouse-wise
    // Stock, Low Stock Alert, Stock Ledger).
    expect(rowFields('branchId')).toContain('branch');
  });

  it('covers the transfer legs the way warehouseId does', () => {
    expect(rowFields('branchId')).toContain('fromBranch');
    expect(rowFields('branchId')).toContain('toBranch');
  });

  it('leaves the warehouseId mapping untouched', () => {
    expect(rowFields('warehouseId')).toEqual(
      ['warehouse', 'location', 'fromWarehouse', 'toWarehouse', 'store']
    );
  });

  describe('matchesValueFilter with a branch selection', () => {
    const matches = (row: any, values: string[]): boolean =>
      (component as any).matchesValueFilter(row, 'branchId', values);

    it('keeps a row whose branch matches the selection', () => {
      expect(matches({ branch: 'Head Office', warehouse: 'Secunderabad' }, ['Head Office'])).toBe(true);
    });

    // The actual regression: this used to return true, so selecting a branch
    // showed every row in the report.
    it('drops a row whose branch does not match the selection', () => {
      expect(matches({ branch: 'Kompally', warehouse: 'Secunderabad' }, ['Head Office'])).toBe(false);
    });

    it('still keeps rows that carry no branch data at all', () => {
      // No branch field present -> nothing to filter on, row is kept. This is
      // the pre-existing "no haystack" allowance and must not change, or every
      // warehouse-only row would vanish the moment a branch was picked.
      expect(matches({ warehouse: 'Secunderabad' }, ['Head Office'])).toBe(true);
    });
  });

  describe('apiFilters', () => {
    const apiFilters = (): Record<string, unknown> => (component as any).apiFilters();

    beforeEach(() => {
      (component as any).masterOptionIds.set({
        branchId: { 'Head Office': 37, Hanamkonda: 38 },
        warehouseId: { Secunderabad: 20 },
        segmentId: { Electronics: 10 }
      });
    });

    it('sends a single selected branch label as its backend branch id', () => {
      component.updateFilter('branchId', ['Head Office']);

      expect(apiFilters()['branchId']).toBe('37');
      expect(component.filters()['branchId']).toEqual(['Head Office']);
    });

    it('does not send a comma-list when more than one branch is selected', () => {
      component.updateFilter('branchId', ['Head Office', 'Hanamkonda']);

      expect(apiFilters()['branchId']).toBe('');
      expect(component.filters()['branchId']).toEqual(['Head Office', 'Hanamkonda']);
    });

    it('keeps mixed branch and warehouse selections on the client side only', () => {
      component.updateBranchWarehouse([
        { label: 'Head Office', key: 'branchId', group: 'Branch' },
        { label: 'Secunderabad', key: 'warehouseId', group: 'Warehouse' }
      ]);

      const filters = apiFilters();
      expect(filters['branchId']).toBe('');
      expect(filters['warehouseId']).toBe('');
      expect(component.filters()['branchId']).toEqual(['Head Office']);
      expect(component.filters()['warehouseId']).toEqual(['Secunderabad']);
    });
  });
});

describe('Inventory report registry — location column reads for both kinds of location', () => {
  const labelFor = (reportKey: string): string | undefined =>
    INVENTORY_REPORTS.find(r => r.key === reportKey)
      ?.columns.find(c => c.key === 'warehouse')?.label;

  it('labels the location column "Warehouse / Branch" on the stock reports', () => {
    expect(labelFor('warehouseWiseStock')).toBe('Warehouse / Branch');
    expect(labelFor('lowStockAlert')).toBe('Warehouse / Branch');
    expect(labelFor('batchSerialExpiry')).toBe('Warehouse / Branch');
  });

  it('does not show a location column on the Stock Ledger report', () => {
    expect(labelFor('stockLedger')).toBeUndefined();
  });

  // Label-only change: the row field the column reads must stay 'warehouse',
  // because that is the key every one of these report payloads still returns.
  it('keeps the underlying column key as warehouse', () => {
    for (const key of ['warehouseWiseStock', 'lowStockAlert', 'batchSerialExpiry']) {
      const report = INVENTORY_REPORTS.find(r => r.key === key);
      expect(report?.columns.some(c => c.key === 'warehouse')).toBe(true);
    }
  });
});
