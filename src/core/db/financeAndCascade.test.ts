/// <reference types="node" />
import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

// Shim window and localStorage for Node.js test environment
if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { db } from './database';
import type {
  Site,
  LabourRecord,
  LabourEntry,
  MaterialRecord,
  MachineryRecord,
  ExpenseDue,
} from '../../types/index';

test('1. getSiteFinanceSummary computes labour overtime 1.5x, materials, machinery, dues accurately', async () => {
  const testSiteId = `test-site-${Date.now()}`;
  const site: Site = {
    id: testSiteId,
    name: 'Greenfield Residency Tower A',
    location: 'Sector 62, Noida',
    siteType: 'Residential',
    estimatedBudget: 100000,
    startDate: '2026-10-01',
    workStatus: 'ongoing',
    paymentStatus: 'unpaid',
    contractorId: 'contractor-finance-test',
    createdAt: new Date().toISOString(),
  };
  await db.sites.put(site);

  // Labour record with diverse shifts: full (1.0x), half (0.5x), overtime (1.5x), absent (0x)
  const labourRecordId = `lr-${Date.now()}`;
  const entries: LabourEntry[] = [
    {
      id: `entry-1`,
      recordId: labourRecordId,
      workerName: 'Mukesh Mason',
      role: 'Mason',
      attendanceStatus: 'full_day',
      dailyWage: 900,
      paidAmount: 900,
      balanceDue: 0,
      paymentStatus: 'paid',
    },
    {
      id: `entry-2`,
      recordId: labourRecordId,
      workerName: 'Suresh Helper',
      role: 'Helper',
      attendanceStatus: 'half_day',
      dailyWage: 300,
      paidAmount: 300,
      balanceDue: 0,
      paymentStatus: 'paid',
    },
    {
      id: `entry-3`,
      recordId: labourRecordId,
      workerName: 'Ramesh Welder',
      role: 'Welder',
      attendanceStatus: 'overtime',
      dailyWage: 1500, // 1.5x of 1000
      paidAmount: 1000,
      balanceDue: 500,
      paymentStatus: 'pending',
    },
    {
      id: `entry-4`,
      recordId: labourRecordId,
      workerName: 'Dinesh Absent',
      role: 'Helper',
      attendanceStatus: 'absent',
      dailyWage: 0,
      paidAmount: 0,
      balanceDue: 0,
      paymentStatus: 'unpaid',
    },
  ];
  // Total daily wage = 900 + 300 + 1500 + 0 = 2700
  // Total paid = 900 + 300 + 1000 = 2200
  const labourRecord: LabourRecord = {
    id: labourRecordId,
    siteId: testSiteId,
    date: '2026-10-15',
    entries,
    totalWorkers: 3, // Mukesh, Suresh, Ramesh (excluding absent Dinesh)
    totalDailyWage: 2700,
    totalPaid: 2200,
  };
  await db.labourRecords.put(labourRecord);

  // Material: 100 bags cement @ 400 = 40,000 (Paid: 25,000, Due: 15,000)
  const materialRecord: MaterialRecord = {
    id: `mat-${Date.now()}`,
    siteId: testSiteId,
    itemName: 'UltraTech Cement',
    quantity: 100,
    unit: 'bags',
    unitPrice: 400,
    totalCost: 40000,
    paidAmount: 25000,
    paymentStatus: 'partial',
    purchaseDate: '2026-10-15',
  };
  await db.materials.put(materialRecord);

  // Machinery: Mixer machine rent = 5,000
  const machineryRecord: MachineryRecord = {
    id: `mach-${Date.now()}`,
    siteId: testSiteId,
    machineType: 'Concrete Mixer',
    totalCost: 5000,
    logDate: '2026-10-15',
  };
  await db.machinery.put(machineryRecord);

  // Standalone expense due: Municipal permit fee = 3,000 (Paid: 1,000, Due: 2,000)
  const dueRecord: ExpenseDue = {
    id: `due-${Date.now()}`,
    siteId: testSiteId,
    title: 'Municipal Site Water Connection',
    category: 'other',
    amountDue: 3000,
    amountPaid: 1000,
    status: 'pending',
    dueDate: '2026-11-01',
  };
  await db.dues.put(dueRecord);

  // Expected Total Expense:
  // Labour: 2700
  // Materials: 40000
  // Machinery: 5000
  // Standalone Dues: 3000
  // Total: 50,700
  // Net Profit: 100,000 - 50,700 = 49,300
  const summary = await db.getSiteFinanceSummary(testSiteId);
  assert.ok(summary, 'Summary should be generated');
  assert.strictEqual(summary.site.estimatedBudget, 100000, 'Total contract matches estimated budget');
  assert.strictEqual(summary.labourCost, 2700, 'Labour expense equals sum of payable wages');
  assert.strictEqual(summary.materialCost, 40000, 'Material expense equals material totalCost');
  assert.strictEqual(summary.machineryCost, 5000, 'Machinery expense equals totalCost');
  assert.strictEqual(summary.totalExpense, 50700, 'Total expense sums all 4 cost streams');
  assert.strictEqual(summary.estimatedProfit, 49300, 'Net profit correctly subtracts totalExpense from budget');
  assert.strictEqual(summary.profitMarginPercent, 49.3, 'Profit margin percentage is 49.3%');
});

test('2. SettleDue synchronizes paid amounts to linked MaterialRecord', async () => {
  const siteId = `site-settle-${Date.now()}`;
  const matId = `mat-settle-${Date.now()}`;
  const dueId = `due-settle-${Date.now()}`;

  const material: MaterialRecord = {
    id: matId,
    siteId,
    itemName: 'TMT Rebars 12mm',
    quantity: 2,
    unit: 'tons',
    unitPrice: 60000,
    totalCost: 120000,
    paidAmount: 60000,
    paymentStatus: 'partial',
    purchaseDate: '2026-10-10',
  };
  await db.materials.put(material);

  const due: ExpenseDue = {
    id: dueId,
    siteId,
    materialId: matId,
    title: 'TMT Rebars 12mm',
    category: 'material',
    amountDue: 120000,
    amountPaid: 60000,
    status: 'pending',
    dueDate: '2026-10-25',
  };
  await db.dues.put(due);

  // Settle remaining 60,000
  await db.settleDue(dueId, 60000);

  const updatedDue = await db.dues.get(dueId);
  assert.strictEqual(updatedDue?.status, 'paid', 'Due is marked paid');
  assert.strictEqual(updatedDue?.amountPaid, 120000, 'Due amountPaid is 120000');

  const updatedMat = await db.materials.get(matId);
  assert.strictEqual(updatedMat?.paymentStatus, 'paid', 'Linked material status updated to paid');
  assert.strictEqual(updatedMat?.paidAmount, 120000, 'Linked material paidAmount updated to 120000');
});

test('3. deleteMaterial cascade-deletes linked ExpenseDue', async () => {
  const matId = `mat-del-${Date.now()}`;
  const dueId = `due-del-${Date.now()}`;

  await db.materials.put({
    id: matId,
    siteId: 'site-temp',
    itemName: 'River Sand',
    quantity: 1,
    unit: 'truck',
    unitPrice: 18000,
    totalCost: 18000,
    paidAmount: 0,
    paymentStatus: 'pending',
    purchaseDate: '2026-10-12',
  });

  await db.dues.put({
    id: dueId,
    siteId: 'site-temp',
    materialId: matId,
    title: 'River Sand Bill',
    category: 'material',
    amountDue: 18000,
    amountPaid: 0,
    status: 'pending',
    dueDate: '2026-10-30',
  });

  await db.deleteMaterial(matId);

  const deletedMat = await db.materials.get(matId);
  assert.strictEqual(deletedMat, undefined, 'Material record deleted');

  const linkedDue = await db.dues.get(dueId);
  assert.strictEqual(linkedDue, undefined, 'Linked due cascade-deleted');
});

test('4. deleteSite cascades and deletes all child records of the site, keeping others intact', async () => {
  const targetSiteId = `site-to-delete-${Date.now()}`;
  const safeSiteId = `site-to-preserve-${Date.now()}`;

  // Create both sites
  await db.sites.put({
    id: targetSiteId,
    name: 'Target Demolition Site',
    location: 'Delhi',
    siteType: 'Commercial',
    estimatedBudget: 50000,
    contractorId: 'c-test',
    startDate: '2026-10-01',
    workStatus: 'ongoing',
    paymentStatus: 'unpaid',
    createdAt: new Date().toISOString(),
  });
  await db.sites.put({
    id: safeSiteId,
    name: 'Safe Preserved Site',
    location: 'Delhi',
    siteType: 'Commercial',
    estimatedBudget: 50000,
    contractorId: 'c-test',
    startDate: '2026-10-01',
    workStatus: 'ongoing',
    paymentStatus: 'unpaid',
    createdAt: new Date().toISOString(),
  });

  // Put records in both sites
  const targetMatId = `mat-target-${Date.now()}`;
  const safeMatId = `mat-safe-${Date.now()}`;
  await db.materials.put({ id: targetMatId, siteId: targetSiteId, itemName: 'Bricks', quantity: 1000, unit: 'pieces', unitPrice: 8, totalCost: 8000, paidAmount: 8000, paymentStatus: 'paid', purchaseDate: '2026-10-01' });
  await db.materials.put({ id: safeMatId, siteId: safeSiteId, itemName: 'Bricks', quantity: 1000, unit: 'pieces', unitPrice: 8, totalCost: 8000, paidAmount: 8000, paymentStatus: 'paid', purchaseDate: '2026-10-01' });

  const targetToolId = `tool-target-${Date.now()}`;
  const safeToolId = `tool-safe-${Date.now()}`;
  await db.tools.put({ id: targetToolId, siteId: targetSiteId, name: 'Vibrator needle', quantity: 2, dateSent: '2026-10-01', expectedReturnDate: '2026-10-20', status: 'on_site' });
  await db.tools.put({ id: safeToolId, siteId: safeSiteId, name: 'Vibrator needle', quantity: 2, dateSent: '2026-10-01', expectedReturnDate: '2026-10-20', status: 'on_site' });

  const targetDueId = `due-target-${Date.now()}`;
  const safeDueId = `due-safe-${Date.now()}`;
  await db.dues.put({ id: targetDueId, siteId: targetSiteId, title: 'Target due', category: 'other', amountDue: 5000, amountPaid: 0, status: 'pending', dueDate: '2026-10-30' });
  await db.dues.put({ id: safeDueId, siteId: safeSiteId, title: 'Safe due', category: 'other', amountDue: 5000, amountPaid: 0, status: 'pending', dueDate: '2026-10-30' });

  // Delete target site
  await db.deleteSite(targetSiteId);

  // Target site and its children must be gone
  assert.strictEqual(await db.sites.get(targetSiteId), undefined, 'Target site deleted');
  assert.strictEqual(await db.materials.get(targetMatId), undefined, 'Target material cascade-deleted');
  assert.strictEqual(await db.tools.get(targetToolId), undefined, 'Target tool cascade-deleted');
  assert.strictEqual(await db.dues.get(targetDueId), undefined, 'Target due cascade-deleted');

  // Safe site and its children must remain intact!
  assert.ok(await db.sites.get(safeSiteId), 'Safe site preserved');
  assert.ok(await db.materials.get(safeMatId), 'Safe material preserved');
  assert.ok(await db.tools.get(safeToolId), 'Safe tool preserved');
  assert.ok(await db.dues.get(safeDueId), 'Safe due preserved');
});
