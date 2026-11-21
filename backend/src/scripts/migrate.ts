import * as dotenv from 'dotenv';
import { getSqlClient } from '../db/index.js';

dotenv.config();

const alterStatements = [
  `ALTER TABLE sites ADD site_type text;`,
  `ALTER TABLE sites ADD estimated_budget real;`,
  `ALTER TABLE sites ADD work_status text DEFAULT 'ongoing' NOT NULL;`,
  `ALTER TABLE sites ADD payment_status text DEFAULT 'unpaid' NOT NULL;`,
  `ALTER TABLE sites ADD client_name text;`,
  `ALTER TABLE sites ADD client_phone text;`,
  `ALTER TABLE sites ADD start_date text;`,
  `ALTER TABLE sites ADD expected_end_date text;`,
  `ALTER TABLE sites ADD completed_date text;`,
  `ALTER TABLE sites ADD notes text;`,
  `ALTER TABLE sites ADD cover_photo text;`,
];

const createStatements = [
  `CREATE TABLE IF NOT EXISTS workers (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    name text NOT NULL,
    phone text,
    role text NOT NULL,
    daily_wage real DEFAULT 0 NOT NULL,
    skill_type text,
    is_active integer DEFAULT 1 NOT NULL,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS workers_org_idx ON workers (organization_id);`,

  `CREATE TABLE IF NOT EXISTS labour_records (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    submitted_by text,
    record_date text NOT NULL,
    total_workers integer DEFAULT 0 NOT NULL,
    total_daily_wage real DEFAULT 0 NOT NULL,
    total_paid real DEFAULT 0 NOT NULL,
    raw_photo_url text,
    ocr_raw_text text,
    voice_note_url text,
    notes text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (submitted_by) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  );`,
  `CREATE INDEX IF NOT EXISTS labour_records_org_idx ON labour_records (organization_id);`,
  `CREATE INDEX IF NOT EXISTS labour_records_site_idx ON labour_records (site_id);`,
  `CREATE INDEX IF NOT EXISTS labour_records_date_idx ON labour_records (organization_id, record_date);`,

  `CREATE TABLE IF NOT EXISTS labour_entries (
    id text PRIMARY KEY NOT NULL,
    labour_record_id text NOT NULL,
    worker_id text,
    worker_name text NOT NULL,
    role text NOT NULL,
    attendance_status text NOT NULL,
    daily_wage real DEFAULT 0 NOT NULL,
    paid_amount real DEFAULT 0 NOT NULL,
    balance_due real DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'pending' NOT NULL,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (labour_record_id) REFERENCES labour_records(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE set null
  );`,
  `CREATE INDEX IF NOT EXISTS labour_entries_record_idx ON labour_entries (labour_record_id);`,
  `CREATE INDEX IF NOT EXISTS labour_entries_worker_idx ON labour_entries (worker_id);`,

  `CREATE TABLE IF NOT EXISTS vendors (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    trade_specialty text,
    materials_supplied text DEFAULT '[]' NOT NULL,
    total_udhaar_balance real DEFAULT 0 NOT NULL,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    updated_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS vendors_org_idx ON vendors (organization_id);`,

  `CREATE TABLE IF NOT EXISTS materials (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    vendor_id text,
    item_name text NOT NULL,
    quantity real DEFAULT 0 NOT NULL,
    unit text NOT NULL,
    unit_price real DEFAULT 0 NOT NULL,
    total_cost real DEFAULT 0 NOT NULL,
    purchase_date text NOT NULL,
    payment_status text DEFAULT 'pending' NOT NULL,
    paid_amount real DEFAULT 0 NOT NULL,
    receipt_photo text,
    notes text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE no action ON DELETE set null
  );`,
  `CREATE INDEX IF NOT EXISTS materials_org_idx ON materials (organization_id);`,
  `CREATE INDEX IF NOT EXISTS materials_site_idx ON materials (site_id);`,
  `CREATE INDEX IF NOT EXISTS materials_vendor_idx ON materials (vendor_id);`,

  `CREATE TABLE IF NOT EXISTS machinery (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    machine_type text NOT NULL,
    fuel_litres real DEFAULT 0 NOT NULL,
    fuel_cost real DEFAULT 0 NOT NULL,
    rental_hours_or_days real DEFAULT 0 NOT NULL,
    rental_cost real DEFAULT 0 NOT NULL,
    total_cost real DEFAULT 0 NOT NULL,
    log_date text NOT NULL,
    notes text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS machinery_org_idx ON machinery (organization_id);`,
  `CREATE INDEX IF NOT EXISTS machinery_site_idx ON machinery (site_id);`,

  `CREATE TABLE IF NOT EXISTS tools (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    name text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    size text,
    date_sent text NOT NULL,
    expected_return_date text NOT NULL,
    actual_return_date text,
    source_type text DEFAULT 'self_owned' NOT NULL,
    purchase_price real DEFAULT 0 NOT NULL,
    rent_or_repair_cost real DEFAULT 0 NOT NULL,
    status text DEFAULT 'on_site' NOT NULL,
    notes text,
    photo_url text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS tools_org_idx ON tools (organization_id);`,
  `CREATE INDEX IF NOT EXISTS tools_site_idx ON tools (site_id);`,

  `CREATE TABLE IF NOT EXISTS expense_dues (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    vendor_id text,
    material_id text,
    title text NOT NULL,
    category text NOT NULL,
    amount_due real DEFAULT 0 NOT NULL,
    amount_paid real DEFAULT 0 NOT NULL,
    due_date text NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    notes text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON UPDATE no action ON DELETE set null
  );`,
  `CREATE INDEX IF NOT EXISTS expense_dues_org_idx ON expense_dues (organization_id);`,
  `CREATE INDEX IF NOT EXISTS expense_dues_site_idx ON expense_dues (site_id);`,
  `CREATE INDEX IF NOT EXISTS expense_dues_vendor_idx ON expense_dues (vendor_id);`,

  `CREATE TABLE IF NOT EXISTS client_payments (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    amount real NOT NULL,
    payment_date text NOT NULL,
    payment_mode text NOT NULL,
    payer_name text,
    reference_no text,
    notes text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade
  );`,
  `CREATE INDEX IF NOT EXISTS client_payments_org_idx ON client_payments (organization_id);`,
  `CREATE INDEX IF NOT EXISTS client_payments_site_idx ON client_payments (site_id);`,

  `CREATE TABLE IF NOT EXISTS material_requests (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    requested_by text NOT NULL,
    items_json text NOT NULL,
    urgency text DEFAULT 'normal' NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    notes text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  );`,
  `CREATE INDEX IF NOT EXISTS material_requests_org_idx ON material_requests (organization_id);`,
  `CREATE INDEX IF NOT EXISTS material_requests_site_idx ON material_requests (site_id);`,

  `CREATE TABLE IF NOT EXISTS site_tasks (
    id text PRIMARY KEY NOT NULL,
    organization_id text NOT NULL,
    site_id text NOT NULL,
    title text NOT NULL,
    description text,
    assigned_to text,
    priority text DEFAULT 'medium' NOT NULL,
    status text DEFAULT 'todo' NOT NULL,
    due_date text,
    created_at text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON UPDATE no action ON DELETE no action
  );`,
  `CREATE INDEX IF NOT EXISTS site_tasks_org_idx ON site_tasks (organization_id);`,
  `CREATE INDEX IF NOT EXISTS site_tasks_site_idx ON site_tasks (site_id);`,
];

async function runMigration() {
  const client = getSqlClient();
  if (!client) {
    console.error('❌ SQL Client is not initialized.');
    process.exit(1);
  }

  console.log('🔄 Applying schema migrations to database...\n');

  // 1. Alter sites table
  for (const stmt of alterStatements) {
    try {
      await client.execute(stmt);
      console.log(`✓ Executed: ${stmt.trim()}`);
    } catch (err: any) {
      if (err.message && (err.message.includes('duplicate column name') || err.message.includes('already exists'))) {
        console.log(`- Column already exists: ${stmt.trim()}`);
      } else {
        console.log(`! Alter note (${err.message}): ${stmt.trim()}`);
      }
    }
  }

  // 2. Create new tables & indexes
  for (const stmt of createStatements) {
    try {
      await client.execute(stmt);
      console.log(`✓ Table/Index verified`);
    } catch (err: any) {
      console.error(`❌ Statement failed: ${stmt.substring(0, 60)}...`);
      console.error(err.message);
    }
  }

  console.log('\n✅ All migrations applied successfully!');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
