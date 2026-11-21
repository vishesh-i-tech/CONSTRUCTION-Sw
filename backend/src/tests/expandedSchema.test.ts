import { test } from 'node:test';
import * as assert from 'node:assert';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import {
  organizations,
  users,
  sites,
  workers,
  labourRecords,
  labourEntries,
  vendors,
  materials,
  machinery,
  tools,
  expenseDues,
  clientPayments,
  materialRequests,
  siteTasks,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';

test('Subphase 2.4: Expanded Schema & SiteSaathi Operational/Financial Tables', async () => {
  const db = getDb();
  if (!db) {
    console.log('Skipping live DB expanded schema test (DATABASE_URL not configured)');
    return;
  }

  // 1. Create Organization & Owner
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Integrated Contractors Pvt Ltd' })
    .returning();

  const [owner] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      role: 'owner',
      name: 'Rajesh Sharma',
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      language: 'hi',
    })
    .returning();

  try {
    // 2. Create Site with Extended SiteSaathi attributes
    const [site] = await db
      .insert(sites)
      .values({
        organizationId: org.id,
        name: 'Gaur City Commercial Block C',
        locationText: 'Noida Extension, Sector 4',
        latitude: 28.6012,
        longitude: 77.4285,
        siteType: 'Commercial',
        estimatedBudget: 4500000,
        workStatus: 'ongoing',
        paymentStatus: 'partially_paid',
        clientName: 'Gaur Sons Developers',
        clientPhone: '9876543210',
        startDate: '2026-01-15',
        expectedEndDate: '2026-12-31',
        notes: 'G+4 commercial complex',
      })
      .returning();

    assert.strictEqual(site.siteType, 'Commercial');
    assert.strictEqual(site.estimatedBudget, 4500000);
    assert.strictEqual(site.workStatus, 'ongoing');

    // 3. Create Worker & Attendance (Labour) Records
    const [worker] = await db
      .insert(workers)
      .values({
        organizationId: org.id,
        name: 'Lalu Ram',
        phone: '9812345678',
        role: 'Mason',
        dailyWage: 850,
        skillType: 'Skilled',
      })
      .returning();
    assert.strictEqual(worker.name, 'Lalu Ram');

    const [labourRec] = await db
      .insert(labourRecords)
      .values({
        organizationId: org.id,
        siteId: site.id,
        submittedBy: owner.id,
        recordDate: '2026-11-21',
        totalWorkers: 1,
        totalDailyWage: 850,
        totalPaid: 500,
        notes: 'Brick masonry work started',
      })
      .returning();

    const [entry] = await db
      .insert(labourEntries)
      .values({
        labourRecordId: labourRec.id,
        workerId: worker.id,
        workerName: worker.name,
        role: worker.role,
        attendanceStatus: 'full_day',
        dailyWage: 850,
        paidAmount: 500,
        balanceDue: 350,
        paymentStatus: 'pending',
      })
      .returning();
    assert.strictEqual(entry.balanceDue, 350);

    // 4. Vendors & Materials
    const [vendor] = await db
      .insert(vendors)
      .values({
        organizationId: org.id,
        name: 'Shree Cement & Steel Traders',
        phone: '9988776655',
        tradeSpecialty: 'Cement & TMT Bars',
        materialsSupplied: ['Ultratech Cement', 'Kamdhenu Steel'],
        totalUdhaarBalance: 45000,
      })
      .returning();
    assert.strictEqual(vendor.name, 'Shree Cement & Steel Traders');

    const [material] = await db
      .insert(materials)
      .values({
        organizationId: org.id,
        siteId: site.id,
        vendorId: vendor.id,
        itemName: 'Ultratech Cement PPC',
        quantity: 100,
        unit: 'bags',
        unitPrice: 380,
        totalCost: 38000,
        purchaseDate: '2026-11-21',
        paymentStatus: 'partial',
        paidAmount: 20000,
      })
      .returning();
    assert.strictEqual(material.totalCost, 38000);

    // 5. Machinery & Tools
    const [machine] = await db
      .insert(machinery)
      .values({
        organizationId: org.id,
        siteId: site.id,
        machineType: 'Concrete Mixer',
        fuelLitres: 15,
        fuelCost: 1425,
        rentalHoursOrDays: 1,
        rentalCost: 1500,
        totalCost: 2925,
        logDate: '2026-11-21',
      })
      .returning();
    assert.strictEqual(machine.totalCost, 2925);

    const [tool] = await db
      .insert(tools)
      .values({
        organizationId: org.id,
        siteId: site.id,
        name: 'Drill Machine (Bosch Hammer)',
        quantity: 2,
        size: '13mm',
        dateSent: '2026-11-20',
        expectedReturnDate: '2026-11-30',
        status: 'on_site',
      })
      .returning();
    assert.strictEqual(tool.quantity, 2);

    // 6. Expense Dues & Client Payments
    const [due] = await db
      .insert(expenseDues)
      .values({
        organizationId: org.id,
        siteId: site.id,
        vendorId: vendor.id,
        materialId: material.id,
        title: 'Ultratech Cement Balance',
        category: 'material',
        amountDue: 18000,
        amountPaid: 0,
        dueDate: '2026-12-05',
        status: 'pending',
      })
      .returning();
    assert.strictEqual(due.amountDue, 18000);

    const [payment] = await db
      .insert(clientPayments)
      .values({
        organizationId: org.id,
        siteId: site.id,
        amount: 500000,
        paymentDate: '2026-11-20',
        paymentMode: 'Bank Transfer',
        payerName: 'Gaur Sons Real Estate',
        referenceNo: 'NEFT99221144',
      })
      .returning();
    assert.strictEqual(payment.amount, 500000);

    // 7. Material Requests & Site Tasks
    const [req] = await db
      .insert(materialRequests)
      .values({
        organizationId: org.id,
        siteId: site.id,
        requestedBy: owner.id,
        itemsJson: [{ item: 'Binding Wire', qty: 20, unit: 'kg' }],
        urgency: 'urgent',
        status: 'pending',
      })
      .returning();
    assert.strictEqual(req.urgency, 'urgent');

    const [task] = await db
      .insert(siteTasks)
      .values({
        organizationId: org.id,
        siteId: site.id,
        title: 'Complete First Floor Slab Casting',
        assignedTo: owner.id,
        priority: 'high',
        status: 'in_progress',
        dueDate: '2026-11-25',
      })
      .returning();
    assert.strictEqual(task.status, 'in_progress');
  } finally {
    await db.delete(organizations).where(eq(organizations.id, org.id));
  }
});
