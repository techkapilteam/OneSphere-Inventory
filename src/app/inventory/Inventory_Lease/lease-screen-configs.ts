import { InventoryScreenConfig } from '../Inventory_Shared/inventory-screen.model';

/* Screen configs for the Lease & Metering pages. They go through the same shared screen shell as
   every other Inventory transaction screen (guide panel, shared quick-add popups, customer picker). */

export const leaseContractConfig: InventoryScreenConfig = {
  key: 'leaseContract',
  title: 'Lease Contracts',
  subtitle: 'Rent out any Fixed Asset: fixed rent, usage by meter, or both. Readings and billing have their own screens.',
  kind: 'transaction',
  icon: 'pi pi-file-edit',
  dependsOn: [
    { name: 'Customer Master', status: 'Ready' },
    { name: 'Fixed Asset (Product Master)', status: 'Required' },
    { name: 'Service item for rent / meter usage (Product Master)', status: 'Required' },
    { name: 'UOM Master', status: 'Ready' }
  ],
  outputImpact: 'Active contracts feed Meter Readings and Lease Billing, which creates the draft Sales Invoice.',
  fields: [
    { key: 'customer', label: 'Customer', type: 'select', options: [], addMaster: 'Customer' }
  ],
  // the meter items: the shared product grid, so the product picker offers Variant / Attribute as on a Sales Invoice line
  lineTitle: 'Meters & Rates',
  lineColumns: ['Product', 'Variant', 'Attribute']
};

function guideOnly(key: string, title: string, subtitle: string, icon: string, outputImpact: string): InventoryScreenConfig {
  return {
    key, title, subtitle, kind: 'transaction', icon,
    dependsOn: [{ name: 'Lease Contracts', status: 'Required' }],
    outputImpact,
    fields: []
  };
}

export const meterReadingConfig = guideOnly('leaseMeterReading', 'Meter Readings',
  'Enter the cumulative reading shown on the meter. Usage is the difference from the previous reading. Only verified readings are billed.',
  'pi pi-pencil', 'Verified readings are billed by Lease Billing.');

export const leaseBillingConfig: InventoryScreenConfig = {
  ...guideOnly('leaseBilling', 'Lease Billing',
    "Pick the customer, then generate the bill of each running contract from the grid. The period comes from the contract's billing cycle; you can also bill part-way through a cycle. A draft Sales Invoice is created for review.",
    'pi pi-receipt', 'Creates a draft Sales Invoice in the Sales Invoice number series.'),
  fields: [{ key: 'customer', label: 'Customer', type: 'select', options: [], addMaster: 'Customer' }]
};

export const leaseReportConfig = guideOnly('leaseReports', 'Lease Reports',
  'Assets on lease, lease history, expiring contracts, unbilled usage and lease revenue.',
  'pi pi-chart-bar', 'Read-only reports.');
