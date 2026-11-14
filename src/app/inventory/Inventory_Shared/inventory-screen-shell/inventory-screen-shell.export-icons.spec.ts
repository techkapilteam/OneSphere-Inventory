import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { InventoryScreenShell } from './inventory-screen-shell';
import { InventoryScreenConfig } from '../inventory-screen.model';

// The Print / Export PDF / Export Excel toolbar icons above every
// transaction screen's "Existing Saved" grid.
//
// SUPERSEDES item 16. That requirement tied these icons to the status of the
// record open in the FORM above the grid: a Draft there hid export on a grid
// full of posted documents that had nothing to do with it. Because the form
// sits on a fresh Draft most of the time, the icons were hidden almost always
// -- on the very grid they belong to. The two are unrelated, so the gate is
// gone: saved records are exportable whatever the form happens to be doing.
//
// Nothing is lost by showing them: runGridToolbarAction() already reports
// "No rows available for this action." when the grid is empty, and the
// document-format screens still ask the user to expand a row first.
describe('InventoryScreenShell — grid toolbar export icons', () => {
  let fixture: ComponentFixture<InventoryScreenShell>;
  let component: InventoryScreenShell;

  const config: InventoryScreenConfig = {
    key: 'purchaseOrder',
    title: 'Purchase Order',
    subtitle: '',
    kind: 'transaction',
    icon: 'pi pi-shopping-bag'
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

  it('shows the icons while the form holds a Draft — the saved grid is independent of it', () => {
    component.formValues.set({ status: 'Draft' });
    expect(component.showGridToolbarExportIcons()).toBe(true);
  });

  it('shows the icons when a Posted record is open', () => {
    component.formValues.set({ status: 'Posted' });
    expect(component.showGridToolbarExportIcons()).toBe(true);
  });

  it('shows the icons before any record has been loaded and status is blank', () => {
    component.formValues.set({});
    expect(component.showGridToolbarExportIcons()).toBe(true);
  });

  it('shows the icons regardless of status casing', () => {
    component.formValues.set({ status: 'draft' });
    expect(component.showGridToolbarExportIcons()).toBe(true);
  });

  it('shows the icons for any other status, such as Cancelled', () => {
    component.formValues.set({ status: 'Cancelled' });
    expect(component.showGridToolbarExportIcons()).toBe(true);
  });

  it('does not depend on config.key — purchaseOrder has no isCurrentRecordPosted() wiring', () => {
    // purchaseOrder falls through isCurrentRecordPosted()'s default case
    // (always false); the icons must not follow it.
    expect(component.isCurrentRecordPosted()).toBe(false);
    expect(component.showGridToolbarExportIcons()).toBe(true);
  });
});
