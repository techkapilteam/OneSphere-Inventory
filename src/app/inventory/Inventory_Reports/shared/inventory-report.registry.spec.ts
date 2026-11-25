import { findInventoryReport, INVENTORY_REPORT_GROUPS, INVENTORY_REPORTS, inventoryReportGroupTitle } from './inventory-report.registry';

describe('Inventory Audit Trail Report (registry)', () => {
  const report = findInventoryReport('inventory-audit-trail');

  it('registers the Audit & Control group', () => {
    expect(INVENTORY_REPORT_GROUPS.some(group => group.id === 'auditControl')).toBe(true);
  });

  it('is discoverable by slug and belongs to the auditControl group', () => {
    expect(report.slug).toBe('inventory-audit-trail');
    expect(report.groupId).toBe('auditControl');
    expect(inventoryReportGroupTitle(report.groupId)).toBe('Audit & Control Reports');
  });

  it('is discoverable by key too', () => {
    expect(findInventoryReport('auditTrail').slug).toBe('inventory-audit-trail');
  });

  it('is included in the master report list exactly once', () => {
    const matches = INVENTORY_REPORTS.filter(item => item.slug === 'inventory-audit-trail');
    expect(matches.length).toBe(1);
  });

  it('falls back to the first report when the slug is unknown (findInventoryReport contract)', () => {
    expect(findInventoryReport('does-not-exist')).toBe(INVENTORY_REPORTS[0]);
  });
});
