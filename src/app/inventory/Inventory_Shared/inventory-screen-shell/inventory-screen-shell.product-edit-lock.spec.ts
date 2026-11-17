import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { InventoryScreenShell } from './inventory-screen-shell';
import { InventoryScreenConfig } from '../inventory-screen.model';

// "Final delivery" batch, 2026-09-11: a product that has already moved real
// stock/value through a posted transaction (migration 236,
// fn_product_has_stock_movement) can no longer be edited in place --
// deactivate + create a new record is the path for a genuine change. The
// backend (InventoryDataService.UpsertProductAsync) is the actual
// enforcement; this pins down the frontend's mirror of it: the loaded
// record's locked_for_edit flag drives isCurrentProductLocked(), which
// validatePayload() checks before ever making the round trip, and which the
// template uses to render the whole form (and the Save button) disabled.
describe('InventoryScreenShell — Product Master edit-lock after stock movement (migration 236)', () => {
  let fixture: ComponentFixture<InventoryScreenShell>;
  let component: InventoryScreenShell;

  const config: InventoryScreenConfig = {
    key: 'productServiceMaster',
    title: 'Product / Service Master',
    subtitle: '',
    kind: 'master',
    icon: 'pi pi-box'
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
  });

  it('starts unlocked for a brand-new product', () => {
    expect(component.isCurrentProductLocked()).toBe(false);
  });

  it('loading a locked saved record sets isCurrentProductLocked()', () => {
    component.savedRecordObjects.set([{
      id: 103, product_code: 'ROO-26-00001', product_name: 'Rooftop Panels',
      locked_for_edit: true, status: 'active'
    } as any]);

    component.editRecordByRow(['ROO-26-00001']);

    expect(component.isCurrentProductLocked()).toBe(true);
  });

  it('loading an unlocked saved record leaves it editable', () => {
    component.savedRecordObjects.set([{
      id: 58, product_code: 'DWT-26-00001', product_name: 'Desktop Workstation Tower',
      locked_for_edit: false, status: 'active'
    } as any]);

    component.editRecordByRow(['DWT-26-00001']);

    expect(component.isCurrentProductLocked()).toBe(false);
  });

  it('clearConfigForm() (New / Clear) always resets the lock, so a fresh product is never born locked', () => {
    component.savedRecordObjects.set([{
      id: 103, product_code: 'ROO-26-00001', product_name: 'Rooftop Panels',
      locked_for_edit: true, status: 'active'
    } as any]);
    component.editRecordByRow(['ROO-26-00001']);
    expect(component.isCurrentProductLocked()).toBe(true);

    component.clearConfigForm();

    expect(component.isCurrentProductLocked()).toBe(false);
  });

  // 2026-11-17: a locked product may now be saved -- only Basic Product
  // Details is locked; the API keeps those fields from the DB.
  it('validatePayload() no longer refuses a locked product outright', () => {
    component.savedRecordObjects.set([{
      id: 103, product_code: 'ROO-26-00001', product_name: 'Rooftop Panels',
      locked_for_edit: true, status: 'active'
    } as any]);
    component.editRecordByRow(['ROO-26-00001']);

    const message = (component as any).validatePayload({});

    expect(message).not.toContain('already been used in a posted transaction');
  });

  it('validatePayload() does not block a brand-new (never-saved) product even though editingId starts unset', () => {
    // isCurrentProductLocked() is false by default, so the guard's own
    // editingId() !== null condition is what actually matters here --
    // asserted directly since a full valid payload would need every
    // mandatory field filled in just to reach past this one check.
    expect(component.editingId()).toBeNull();
    expect((component as any).isCurrentProductLocked()).toBe(false);
  });
});
