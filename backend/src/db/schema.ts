import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// 1. ORGANIZATIONS
export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// 2. USERS
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role').$type<'owner' | 'supervisor'>().notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  language: text('language').default('hi').notNull(),
  pushToken: text('push_token'),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('users_org_idx').on(table.organizationId),
  index('users_phone_idx').on(table.phone),
]);

// 3. SITES (Extended with SiteSaathi financial & operational tracking)
export const sites = sqliteTable('sites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  locationText: text('location_text').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  siteType: text('site_type').$type<
    | 'Building'
    | 'Residential'
    | 'Commercial'
    | 'Road'
    | 'Dam'
    | 'Bridge'
    | 'Renovation'
    | 'Industrial'
    | 'Apartment'
    | 'Other'
  >(),
  estimatedBudget: real('estimated_budget'),
  workStatus: text('work_status')
    .$type<'planning' | 'ongoing' | 'completed' | 'on_hold'>()
    .default('ongoing')
    .notNull(),
  paymentStatus: text('payment_status')
    .$type<'unpaid' | 'partially_paid' | 'paid'>()
    .default('unpaid')
    .notNull(),
  clientName: text('client_name'),
  clientPhone: text('client_phone'),
  startDate: text('start_date'),
  expectedEndDate: text('expected_end_date'),
  completedDate: text('completed_date'),
  notes: text('notes'),
  coverPhoto: text('cover_photo'),
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('sites_org_idx').on(table.organizationId),
]);

// 4. SITE ASSIGNMENTS
export const siteAssignments = sqliteTable('site_assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  uniqueIndex('unique_site_user').on(table.siteId, table.userId),
  index('site_assignments_user_idx').on(table.userId),
]);

// 5. DAILY RECORDS
export const dailyRecords = sqliteTable('daily_records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text('client_id').notNull().unique(), // Client-generated UUID for idempotency
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  submittedBy: text('submitted_by')
    .notNull()
    .references(() => users.id),
  recordDate: text('record_date').notNull(), // YYYY-MM-DD
  status: text('status').$type<'full' | 'half' | 'stopped'>().notNull(),
  capturedAt: text('captured_at').notNull(),
  receivedAt: text('received_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  flags: text('flags', { mode: 'json' }).$type<Record<string, any>>().default({}).notNull(),
  missingPhoto: integer('missing_photo', { mode: 'boolean' }).default(false).notNull(),
  missingVoice: integer('missing_voice', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  uniqueIndex('unique_site_record_date').on(table.siteId, table.recordDate),
  index('records_org_date_idx').on(table.organizationId, table.recordDate),
  index('records_site_idx').on(table.siteId),
]);

// 6. ISSUE TYPES (Customizable per Organization, max 8 active visible)
export const issueTypes = sqliteTable('issue_types', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  labelHi: text('label_hi').notNull(),
  labelEn: text('label_en').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('issue_types_org_idx').on(table.organizationId),
  index('issue_types_sort_idx').on(table.organizationId, table.sortOrder),
]);

// 7. RECORD ISSUES
export const recordIssues = sqliteTable('record_issues', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  issueTypeId: text('issue_type_id')
    .notNull()
    .references(() => issueTypes.id, { onDelete: 'restrict' }),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('record_issues_record_idx').on(table.recordId),
  index('record_issues_type_idx').on(table.issueTypeId),
]);

// 8. MEDIA (Photos & Audio)
export const media = sqliteTable('media', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'photo' | 'audio'>().notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  durationSeconds: integer('duration_seconds'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracyM: real('accuracy_m'),
  capturedAt: text('captured_at').notNull(),
  flags: text('flags', { mode: 'json' }).$type<Record<string, any>>().default({}).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('media_record_idx').on(table.recordId),
]);

// 9. TRANSCRIPTS
export const transcripts = sqliteTable('transcripts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  audioMediaId: text('audio_media_id')
    .notNull()
    .references(() => media.id, { onDelete: 'cascade' }),
  language: text('language').default('hi').notNull(),
  rawText: text('raw_text').notNull(),
  status: text('status').$type<'pending' | 'done' | 'failed'>().notNull(),
  provider: text('provider').notNull(),
  error: text('error'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('transcripts_record_idx').on(table.recordId),
]);

// 10. SUMMARIES
export const summaries = sqliteTable('summaries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  summaryText: text('summary_text').notNull(),
  materialMentions: text('material_mentions', { mode: 'json' }).$type<any[]>().default([]).notNull(),
  modelInfo: text('model_info').notNull(),
  status: text('status').$type<'pending' | 'done' | 'failed'>().notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('summaries_record_idx').on(table.recordId),
]);

// 11. RECORD EDITS (Audit trail for same-day updates)
export const recordEdits = sqliteTable('record_edits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  editedBy: text('edited_by')
    .notNull()
    .references(() => users.id),
  changeJson: text('change_json', { mode: 'json' }).$type<Record<string, any>>().notNull(),
  editedAt: text('edited_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('record_edits_record_idx').on(table.recordId),
]);

// 12. RECORD ACKNOWLEDGEMENTS (Owner "Seen" tick)
export const recordAcknowledgements = sqliteTable('record_acknowledgements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text('record_id')
    .notNull()
    .references(() => dailyRecords.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  seenAt: text('seen_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  replyMediaId: text('reply_media_id').references(() => media.id),
}, (table) => [
  index('acknowledgements_record_idx').on(table.recordId),
]);

// 13. NOTIFICATION LOG
export const notificationLog = sqliteTable('notification_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  sentAt: text('sent_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  status: text('status').$type<'sent' | 'failed'>().notNull(),
}, (table) => [
  index('notifications_user_idx').on(table.userId),
]);

// 14. WORKERS (Labour roster per organization)
export const workers = sqliteTable('workers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role').notNull(),
  dailyWage: real('daily_wage').default(0).notNull(),
  skillType: text('skill_type'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('workers_org_idx').on(table.organizationId),
]);

// 15. LABOUR RECORDS (Daily attendance & wage sessions per site)
export const labourRecords = sqliteTable('labour_records', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  submittedBy: text('submitted_by').references(() => users.id),
  recordDate: text('record_date').notNull(), // YYYY-MM-DD
  totalWorkers: integer('total_workers').default(0).notNull(),
  totalDailyWage: real('total_daily_wage').default(0).notNull(),
  totalPaid: real('total_paid').default(0).notNull(),
  rawPhotoUrl: text('raw_photo_url'),
  ocrRawText: text('ocr_raw_text'),
  voiceNoteUrl: text('voice_note_url'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('labour_records_org_idx').on(table.organizationId),
  index('labour_records_site_idx').on(table.siteId),
  index('labour_records_date_idx').on(table.organizationId, table.recordDate),
]);

// 16. LABOUR ENTRIES (Individual line items in attendance register)
export const labourEntries = sqliteTable('labour_entries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  labourRecordId: text('labour_record_id')
    .notNull()
    .references(() => labourRecords.id, { onDelete: 'cascade' }),
  workerId: text('worker_id').references(() => workers.id, { onDelete: 'set null' }),
  workerName: text('worker_name').notNull(),
  role: text('role').notNull(),
  attendanceStatus: text('attendance_status')
    .$type<'full_day' | 'half_day' | 'absent' | 'overtime'>()
    .notNull(),
  dailyWage: real('daily_wage').default(0).notNull(),
  paidAmount: real('paid_amount').default(0).notNull(),
  balanceDue: real('balance_due').default(0).notNull(),
  paymentStatus: text('payment_status')
    .$type<'paid' | 'unpaid' | 'advance' | 'pending'>()
    .default('pending')
    .notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('labour_entries_record_idx').on(table.labourRecordId),
  index('labour_entries_worker_idx').on(table.workerId),
]);

// 17. VENDORS (Suppliers & subcontractors)
export const vendors = sqliteTable('vendors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  tradeSpecialty: text('trade_specialty'),
  materialsSupplied: text('materials_supplied', { mode: 'json' }).$type<string[]>().default([]).notNull(),
  totalUdhaarBalance: real('total_udhaar_balance').default(0).notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('vendors_org_idx').on(table.organizationId),
]);

// 18. MATERIALS (Purchases and material usage per site)
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  vendorId: text('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  itemName: text('item_name').notNull(),
  quantity: real('quantity').default(0).notNull(),
  unit: text('unit').notNull(),
  unitPrice: real('unit_price').default(0).notNull(),
  totalCost: real('total_cost').default(0).notNull(),
  purchaseDate: text('purchase_date').notNull(), // YYYY-MM-DD
  paymentStatus: text('payment_status')
    .$type<'paid' | 'pending' | 'partial'>()
    .default('pending')
    .notNull(),
  paidAmount: real('paid_amount').default(0).notNull(),
  receiptPhoto: text('receipt_photo'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('materials_org_idx').on(table.organizationId),
  index('materials_site_idx').on(table.siteId),
  index('materials_vendor_idx').on(table.vendorId),
]);

// 19. MACHINERY (Equipment and heavy machinery rentals/logs)
export const machinery = sqliteTable('machinery', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  machineType: text('machine_type').notNull(),
  fuelLitres: real('fuel_litres').default(0).notNull(),
  fuelCost: real('fuel_cost').default(0).notNull(),
  rentalHoursOrDays: real('rental_hours_or_days').default(0).notNull(),
  rentalCost: real('rental_cost').default(0).notNull(),
  totalCost: real('total_cost').default(0).notNull(),
  logDate: text('log_date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('machinery_org_idx').on(table.organizationId),
  index('machinery_site_idx').on(table.siteId),
]);

// 20. TOOLS (Tool inventory, dispatch, return tracking)
export const tools = sqliteTable('tools', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  size: text('size'),
  dateSent: text('date_sent').notNull(),
  expectedReturnDate: text('expected_return_date').notNull(),
  actualReturnDate: text('actual_return_date'),
  sourceType: text('source_type')
    .$type<'self_owned' | 'purchased_for_site'>()
    .default('self_owned')
    .notNull(),
  purchasePrice: real('purchase_price').default(0).notNull(),
  rentOrRepairCost: real('rent_or_repair_cost').default(0).notNull(),
  status: text('status')
    .$type<'on_site' | 'returned' | 'overdue'>()
    .default('on_site')
    .notNull(),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('tools_org_idx').on(table.organizationId),
  index('tools_site_idx').on(table.siteId),
]);

// 21. EXPENSE DUES (Udhaar tracking for vendors, materials, subcontract)
export const expenseDues = sqliteTable('expense_dues', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  vendorId: text('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  materialId: text('material_id').references(() => materials.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  category: text('category')
    .$type<'material' | 'tool_rent' | 'machinery' | 'labour' | 'subcontract' | 'other'>()
    .notNull(),
  amountDue: real('amount_due').default(0).notNull(),
  amountPaid: real('amount_paid').default(0).notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status')
    .$type<'pending' | 'paid' | 'overdue'>()
    .default('pending')
    .notNull(),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('expense_dues_org_idx').on(table.organizationId),
  index('expense_dues_site_idx').on(table.siteId),
  index('expense_dues_vendor_idx').on(table.vendorId),
]);

// 22. CLIENT PAYMENTS (Incoming payments and installments from clients)
export const clientPayments = sqliteTable('client_payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  paymentDate: text('payment_date').notNull(),
  paymentMode: text('payment_mode').notNull(),
  payerName: text('payer_name'),
  referenceNo: text('reference_no'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('client_payments_org_idx').on(table.organizationId),
  index('client_payments_site_idx').on(table.siteId),
]);

// 23. MATERIAL REQUESTS (Supervisor requests for site supplies)
export const materialRequests = sqliteTable('material_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  requestedBy: text('requested_by')
    .notNull()
    .references(() => users.id),
  itemsJson: text('items_json', { mode: 'json' }).$type<any[]>().notNull(),
  urgency: text('urgency')
    .$type<'low' | 'normal' | 'urgent'>()
    .default('normal')
    .notNull(),
  status: text('status')
    .$type<'pending' | 'approved' | 'rejected' | 'fulfilled'>()
    .default('pending')
    .notNull(),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('material_requests_org_idx').on(table.organizationId),
  index('material_requests_site_idx').on(table.siteId),
]);

// 24. SITE TASKS (Action items and milestones)
export const siteTasks = sqliteTable('site_tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: text('assigned_to').references(() => users.id),
  priority: text('priority')
    .$type<'low' | 'medium' | 'high'>()
    .default('medium')
    .notNull(),
  status: text('status')
    .$type<'todo' | 'in_progress' | 'done'>()
    .default('todo')
    .notNull(),
  dueDate: text('due_date'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => [
  index('site_tasks_org_idx').on(table.organizationId),
  index('site_tasks_site_idx').on(table.siteId),
]);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  sites: many(sites),
  dailyRecords: many(dailyRecords),
  issueTypes: many(issueTypes),
  workers: many(workers),
  vendors: many(vendors),
}));

export const issueTypesRelations = relations(issueTypes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [issueTypes.organizationId],
    references: [organizations.id],
  }),
  recordIssues: many(recordIssues),
}));

export const recordIssuesRelations = relations(recordIssues, ({ one }) => ({
  record: one(dailyRecords, {
    fields: [recordIssues.recordId],
    references: [dailyRecords.id],
  }),
  issueType: one(issueTypes, {
    fields: [recordIssues.issueTypeId],
    references: [issueTypes.id],
  }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sites.organizationId],
    references: [organizations.id],
  }),
  assignments: many(siteAssignments),
  records: many(dailyRecords),
  labourRecords: many(labourRecords),
  materials: many(materials),
  machinery: many(machinery),
  tools: many(tools),
  expenseDues: many(expenseDues),
  clientPayments: many(clientPayments),
  materialRequests: many(materialRequests),
  siteTasks: many(siteTasks),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  assignments: many(siteAssignments),
  submittedRecords: many(dailyRecords),
  materialRequests: many(materialRequests),
}));

export const dailyRecordsRelations = relations(dailyRecords, ({ one, many }) => ({
  site: one(sites, {
    fields: [dailyRecords.siteId],
    references: [sites.id],
  }),
  submitter: one(users, {
    fields: [dailyRecords.submittedBy],
    references: [users.id],
  }),
  issues: many(recordIssues),
  mediaList: many(media),
  transcript: one(transcripts),
  summary: one(summaries),
  edits: many(recordEdits),
  acknowledgements: many(recordAcknowledgements),
}));

export const workersRelations = relations(workers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workers.organizationId],
    references: [organizations.id],
  }),
  labourEntries: many(labourEntries),
}));

export const labourRecordsRelations = relations(labourRecords, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [labourRecords.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [labourRecords.siteId],
    references: [sites.id],
  }),
  submitter: one(users, {
    fields: [labourRecords.submittedBy],
    references: [users.id],
  }),
  entries: many(labourEntries),
}));

export const labourEntriesRelations = relations(labourEntries, ({ one }) => ({
  labourRecord: one(labourRecords, {
    fields: [labourEntries.labourRecordId],
    references: [labourRecords.id],
  }),
  worker: one(workers, {
    fields: [labourEntries.workerId],
    references: [workers.id],
  }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [vendors.organizationId],
    references: [organizations.id],
  }),
  materials: many(materials),
  expenseDues: many(expenseDues),
}));

export const materialsRelations = relations(materials, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [materials.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [materials.siteId],
    references: [sites.id],
  }),
  vendor: one(vendors, {
    fields: [materials.vendorId],
    references: [vendors.id],
  }),
  expenseDues: many(expenseDues),
}));

export const machineryRelations = relations(machinery, ({ one }) => ({
  organization: one(organizations, {
    fields: [machinery.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [machinery.siteId],
    references: [sites.id],
  }),
}));

export const toolsRelations = relations(tools, ({ one }) => ({
  organization: one(organizations, {
    fields: [tools.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [tools.siteId],
    references: [sites.id],
  }),
}));

export const expenseDuesRelations = relations(expenseDues, ({ one }) => ({
  organization: one(organizations, {
    fields: [expenseDues.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [expenseDues.siteId],
    references: [sites.id],
  }),
  vendor: one(vendors, {
    fields: [expenseDues.vendorId],
    references: [vendors.id],
  }),
  material: one(materials, {
    fields: [expenseDues.materialId],
    references: [materials.id],
  }),
}));

export const clientPaymentsRelations = relations(clientPayments, ({ one }) => ({
  organization: one(organizations, {
    fields: [clientPayments.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [clientPayments.siteId],
    references: [sites.id],
  }),
}));

export const materialRequestsRelations = relations(materialRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [materialRequests.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [materialRequests.siteId],
    references: [sites.id],
  }),
  requester: one(users, {
    fields: [materialRequests.requestedBy],
    references: [users.id],
  }),
}));

export const siteTasksRelations = relations(siteTasks, ({ one }) => ({
  organization: one(organizations, {
    fields: [siteTasks.organizationId],
    references: [organizations.id],
  }),
  site: one(sites, {
    fields: [siteTasks.siteId],
    references: [sites.id],
  }),
  assignee: one(users, {
    fields: [siteTasks.assignedTo],
    references: [users.id],
  }),
}));
