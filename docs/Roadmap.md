# SiteSaathi + FieldLog + TaskSpot — Unified Product & Engineering Roadmap

> **Vision:** Merge **SiteSaathi** (offline-first contractor financial & labour ledger) and **FieldLog** (multi-role daily site reporting, geotagged photos, voice notes, and Fastify/Turso cloud backend) into one unified, offline-first **Indian Construction Site Operations & Financial Control Platform**—and extend it with **TaskSpot** workflows (material procurement, lightweight tasks, escalations, AI voice automation, and WhatsApp digests).

---

## Target Unified Architecture

| Layer | Chosen Technology | Purpose |
| :--- | :--- | :--- |
| **Unified Frontend (Web, PWA & Android)** | **React 19 + Vite 8 + Tailwind CSS v4 + TypeScript + Capacitor 8 + `vite-plugin-pwa`** | Single codebase for web, installable offline PWA, and Android APK (retiring FieldLog's duplicate Expo/RN Web UI). |
| **Local Cache & Offline Outbox** | **Dexie.js v4 (IndexedDB)** | Reactive offline UI, local financial ledger, and persistent `sync_outbox` queue with idempotency keys (`clientId`). |
| **Unified Cloud Backend** | **Fastify v5 + Drizzle ORM + Turso (libSQL)** | Multi-tenant REST API, role-based access control, idempotent sync, and scheduled escalation jobs. |
| **Cloud Media Storage** | **Cloudflare R2 (or S3/Supabase Storage)** | Durable, zero-egress object storage for compressed site photos and voice notes (replacing Render's ephemeral `./uploads`). |
| **AI & Messaging (Pro Tier)** | **Gemini Flash / Sarvam AI + Meta WhatsApp Cloud API + FCM** | Hinglish/regional voice-to-JSON task/material extraction, free push alerts, and automated 8:30 PM IST WhatsApp owner digests. |

---

## Phase 1: Stabilize SiteSaathi Core (Security, Financial Math & Android Hygiene) [COMPLETED]

**Goal:** Eliminate all critical data-loss, security, financial math, mobile UX, and Android APK bugs in the existing SiteSaathi codebase before merging backend sync.

### Subphase 1.1 — Critical Security & Data-Safety Fixes [COMPLETED]
- [x] **Preserve Credentials on Clean Backup Restore (`database.ts`):** Merge incoming backup account fields with the existing local `ContractorAccount` so unencrypted backups never wipe `password`, `pinLock`, or security flags and brick the account.
- [x] **Fix Passphrase Trimming & Minimum Strength (`SettingsModal.tsx`, `database.ts`):** Trim passphrases before validation and reject any non-empty passphrase under 8 characters so whitespace inputs cannot export plaintext backups containing credential hashes.
- [x] **Scope `clearAllData()` & `seedDemoData()` (`database.ts`, `App.tsx`):** Restrict wipes and demo seeding strictly to the active `contractorId` so shared-device accounts can never delete or overwrite other contractors' data.
- [x] **Fix `AppLockScreen` & Settings PIN Sync (`AppLockScreen.tsx`, `SettingsModal.tsx`, `AuthScreen.tsx`):**
  - Support 4–6 digit PINs (or explicit Unlock submit) without auto-submitting at 4 digits.
  - Atomically update both `password` and `pinLock` on PIN change, and require current-PIN verification before disabling PIN Lock, disabling Anti-Delete, or changing PIN.
  - Enforce `isAntiDeleteEnabled` inside `ConfirmDeleteModal.tsx` and replace `window.confirm` in `SiteDetailsModal.tsx` with `ConfirmDeleteModal`.
  - Remove the dead, insecure `src/components/auth/AuthModal.tsx` file and remove stubbed biometric promises until real native biometrics are wired.
- [x] **Close Multi-Contractor Isolation Leaks:**
  - Filter `loadSavedContacts` in `AddSiteModal.tsx` and `EditSiteModal.tsx` by `activeContractorId`.
  - Display `validClientPayments.length` instead of `allClientPayments.length` in `DashboardOverview.tsx`.
  - Pass `account.id` directly into `refreshInsights()` in `App.tsx` to eliminate the stale `activeAccountId` closure.
  - Isolate `googleAuth.ts` `tokenClient` callbacks per `contractorId`, move token verification off URL query strings, and remove `setMockGoogleAuth` from production bundles.
  - Sync `SettingsModal` and `GoogleDriveBackupSection` state whenever `account?.id` changes.
- [x] **Harden CSV Export (`reportExporter.ts`):** Escape double-quotes, prefix formula-injection characters (`=`, `+`, `-`, `@`), add UTF-8 BOM (`\uFEFF`), and export via `Blob` instead of `encodeURI('data:...')`.

### Subphase 1.2 — Financial, Labour, Material & Machinery Math Integrity [COMPLETED]
- [x] **Atomic Labour Edit Sync (`EditLabourModal.tsx`):** Update `record.entries` alongside `db.labourRecords` and `db.labourEntries` inside a single `db.transaction('rw', ...)`.
- [x] **Fix Default Labour Payment Status (`AddLabourModal.tsx`):** Initialize `paymentStatus: 'paid'` on new rows, fix the Advance input so clearing to `0` does not unmount the field, exclude `absent` workers from `totalWorkers`, and add `'Plasterer'` to Edit/OCR role dropdowns.
- [x] **Unify Overtime (`1.5x`) & Shift Math (`SiteDetailsModal.tsx`, `LabourDateDetailModal.tsx`, `PhotoOcrModal.tsx`, `reportExporter.ts`):** Compute and display `1.5x` for `overtime`, `0.5x` for `half_day`, and `0` for `absent` consistently across all summaries and PDFs.
- [x] **Fix Hindi OCR & Wage Parsing (`ocrProcessor.ts`):** Replace ASCII `\b` boundaries with Unicode-aware boundaries for Devanagari (`\u0900-\u097F`), remove the `!/mason|helper/i` block on `absent`, and prevent year numbers (e.g., `2026`) from being parsed as daily wages.
- [x] **Fix Material ↔ ExpenseDue Sync (`AddMaterialModal.tsx`, `EditMaterialModal.tsx`, `database.ts`):**
  - Add the missing `paidAmount` input field when `Partial` payment is selected.
  - Link auto-generated `ExpenseDue` records via `materialId` so editing/deleting a material updates/removes its due, and settling a due updates the material's `paymentStatus` and `paidAmount`.
  - Include standalone `ExpenseDue` items in `getSiteFinanceSummary().totalExpense` and clamp negative balances.
- [x] **Fix Dashboard KPIs, Client Dues & Tools/Machinery (`DashboardOverview.tsx`, `SiteCard.tsx`, `RecordClientPaymentModal.tsx`, `EditMachineryModal.tsx`):**
  - Compute "Workers Today" and "Daily Wages" strictly from today's local-date records across all active sites.
  - Compute `totalClientDue` per site (`sum(max(0, budget - received))`) instead of globally.
  - Make `+₹10k` / `+₹50k` payment chips additive (or rename cleanly), convert `SiteCard` to `useLiveQuery`, render negative profit in red, include Labour & Machinery tables in `exportSiteReportPdf`, fix `EditMachineryModal` stripping `[Self-Owned]`, and fix IST UTC-midnight overdue tool checks.

### Subphase 1.3 — Mobile UX, Hindi Devanagari PDFs, Android APK & PWA [COMPLETED]
- [x] **Fix Unusable Mobile Date Inputs (`AddSiteModal.tsx`, `EditSiteModal.tsx`, `RecordClientPaymentModal.tsx`, `dateUtils.ts`):** Replace `inputMode="numeric"` text inputs with native date pickers (`<input type="date">`) or masked inputs, and use local-timezone date formatting everywhere.
- [x] **True Hindi/Devanagari PDFs (`reportExporter.ts`, `index.html`):** Embed `Noto Sans Devanagari` TTF into jsPDF and load `Hind` / `Noto Sans Devanagari` cleanly so Hindi site, worker, and material names render accurately in PDFs.
- [x] **Fix Android Build & Native Exports (`android/`, `package.json`, `capacitor.config.ts`):**
  - Add missing `colors.xml` in `android/app/src/main/res/values/`, add `CAMERA`, `RECORD_AUDIO`, `ACCESS_NETWORK_STATE`, and `USE_BIOMETRIC` permissions, set `android:allowBackup="false"`, and disable `cleartext` / `allowMixedContent` for production.
  - Install `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/app`, `@capacitor/camera`, `@capacitor/geolocation`, and `@capacitor/network` so PDF/CSV/JSON exports and hardware back-button work natively on Android.
  - Replace Windows-only `gradlew.bat` in `package.json` with a cross-platform script.
- [x] **Enable True Web Offline (PWA) & Media Compression:** Add `vite-plugin-pwa` (`manifest.webmanifest` + Service Worker) and client-side image compression (max 1280px, ≤ 200 KB WebP/JPEG) before storing in IndexedDB.
- [x] **1-Tap WhatsApp Sharing (Tier 1 — Zero Cost):** Add `wa.me` formatted text + `@capacitor/share` PDF attachment buttons on Client Receipts, Pending Dues, and Daily Summaries.
- [x] **Performance & UI Polish:** Remove the 60fps `Interactive3DCharacter` `setState` loop, fix `ToastNotification` timer resets, persist Trade & Language changes to `db.account`, and translate remaining hardcoded English strings in Hindi mode.

### Subphase 1.4 — Navigation Cleanup, Tests & CI [COMPLETED]
- [x] **Restore Unreachable Modules:** Wire `QuickAddModal` to `BottomNav`, mount `SmartInsightsCard` on `DashboardOverview`, dynamically generate `RemindersModal` alerts from overdue tools/dues, and wire `ReportsExporter` + `PendingDuesTracker` + `ToolTracker` cleanly.
- [x] **Automated Test Suite & CI:** Add `vitest` + `fake-indexeddb`, replace mock-only tests in `criticalDataSafety.test.ts` with real component/DB tests, add unit tests for `getSiteFinanceSummary`, `deleteSite`, `ocrProcessor`, `dateUtils`, and `reportExporter`, and add `.github/workflows/ci.yml` (`tsc`, `oxlint`, `vitest`, `vite build`).

---

## Phase 2: Merge & Harden FieldLog Backend + Cloud Object Storage [COMPLETED]

**Goal:** Bring `FieldLog/backend` (Fastify v5 + Drizzle ORM + Turso) into this repository, close all 5 critical security vulnerabilities, replace ephemeral disk uploads with durable object storage, and extend the schema for unified SiteSaathi + TaskSpot data.

### Subphase 2.1 — Monorepo Consolidation [COMPLETED]
- [x] Move `FieldLog/backend` into `backend/` within this repository (configuring root `npm` workspaces or unified scripts for `frontend` + `backend`).
- [x] Retire duplicate `FieldLog/mobile` (Expo/RN) UI after verifying all screens/services are mapped for Phase 3 porting.
- [x] Configure `render.yaml` and environment validation (`zod` env schema failing fast if `JWT_SECRET`, `TURSO_DATABASE_URL`, or R2 credentials are missing in production).

### Subphase 2.2 — Critical Backend Security Hardening [COMPLETED]
- [x] **Close Open Org & Signup Exploits (`auth.ts`):** Remove public `GET /api/v1/auth/organizations` and public `POST /api/v1/auth/supervisor/signup`; allow supervisor creation strictly by authenticated Owners (or signed, expiring org invite tokens).
- [x] **Close Unauthenticated Storage & IssueType Bypasses (`devStorage.ts`, `issueTypes.ts`):** Remove unauthenticated `devStorage` routes in production; remove `x-organization-id` header fallback in `issueTypes.ts` and enforce `authenticate` + `requireOwner` on mutations.
- [x] **Enforce Site-Assignment RBAC (`records.ts`):** Remove auto-assignment on `POST /records` for supervisors; enforce `siteAssignments` checks on `GET /records/:id` and `GET /sites/:siteId/records`; scope `clientId` idempotency checks by `organizationId`.
- [x] **Auth Hardening & Rate Limiting:** Normalize Indian phone numbers (10-digit E.164 normalization), add `@fastify/rate-limit` on `/auth/supervisor/login` (4-digit PIN brute-force protection) and `/auth/owner/login`, restrict production CORS to explicit allowed origins + Capacitor schemes, and implement real password/PIN reset flows (Owner reset for supervisors; OTP/email or recovery key for owners).
- [x] **IST Date Utility:** Replace UTC `new Date().toISOString().split('T')[0]` with an `Asia/Kolkata` (`IST`) date helper on all backend "today" queries.

### Subphase 2.3 — Durable Cloud Storage & Server-Side Anti-Fake Verification [COMPLETED]
- [x] **Cloudflare R2 / S3 Presigned Uploads (`storage/index.ts`, `uploads.ts`):** Implement S3-compatible presigned `PUT` & signed `GET` URLs for Cloudflare R2 (10 GB free tier, zero egress), supporting both compressed JPEG/WebP photos and real `audio/webm` / `audio/mp4` / `audio/aac` voice notes.
- [x] **Server-Side Anti-Fake Engine (`records.ts`):**
  - Compute Haversine distance between photo GPS coordinates and `site.latitude`/`longitude` -> flag `distance_warning` if >500m.
  - Compare `capturedAt` vs server `receivedAt` -> flag `time_skew` if delta >15 minutes.
  - Block backdated creation/editing of past-day records by supervisors (same-day edits only, logged in `record_edits` inside a DB transaction).
  - Append new photos instead of deleting earlier same-day photos on `POST /records` updates.
- [x] **Persist Owner Acknowledgements:** Wire `POST /api/v1/records/:id/acknowledge` to `record_acknowledgements` so the "Reviewed" tick persists across devices.

### Subphase 2.4 — Unified Drizzle Schema Expansion [COMPLETED]
- [x] Extend `sites` table with SiteSaathi fields (`siteType`, `estimatedBudget`, `workStatus`, `paymentStatus`, `clientName`, `clientPhone`, `startDate`, `expectedEndDate`, `completedDate`).
- [x] Add synced financial & operations tables with `clientId` idempotency keys and `updatedAt` sync cursors: `workers`, `labour_records`, `labour_entries`, `vendors`, `materials`, `machinery`, `tools`, `expense_dues`, `client_payments`, `material_requests`, `site_tasks`.
- [x] Generate and apply Drizzle migrations (`drizzle-kit generate` / `migrate`).

---

## Phase 3: Merge FieldLog Operations UI + Offline-First Sync Engine [COMPLETED]

**Goal:** Port FieldLog's multi-role field reporting workflows into SiteSaathi's React/Tailwind/Capacitor UI and connect everything via a true offline-first Dexie sync engine.

### Subphase 3.1 — Multi-Role Auth & JWT Auto-Refresh [COMPLETED]
- [x] Build unified Role-Aware Auth (`Owner`, `Site Supervisor`, `Purchase Manager` + `Solo Offline Mode` backward compatibility for existing local contractors).
- [x] Implement automatic JWT access-token refresh (`/api/v1/auth/refresh` interceptor on `401`) and secure token storage with silent retry.
- [x] Add Owner team management UI: provision supervisors with 4-digit PINs, reset supervisor PINs, activate/deactivate accounts, and assign supervisors to specific sites (`TeamManagementModal.tsx`).

### Subphase 3.2 — Dexie Offline Cache & Background Sync Outbox [COMPLETED]
- [x] Add `sync_outbox` and `sync_meta` tables to Dexie (`database.ts` schema v5).
- [x] Queue all mutations (DPRs, photos, voice notes, labour, materials, payments) locally first so the UI responds in <50ms even in zero-network basements (`syncEngine.ts`).
- [x] Implement background sync worker triggered on app launch, `window` online events, and manual "Sync Now", uploading media binaries directly to Cloudflare R2 via presigned URLs and then submitting idempotent JSON payloads (`clientId`).
- [x] Distinguish true offline queuing from `400`/`401` server errors (flagging validation errors as failed with server message, retrying network errors).

### Subphase 3.3 — Daily Site Reporting (DPR) Module [COMPLETED]
- [x] **Supervisor 3-Tap Daily Record Screen (`SupervisorDprModal.tsx`, `SupervisorTodayDashboard.tsx`):**
  - Select assigned site + Work Status (**Full Day / Half Day / Work Stopped**) in English & Hindi.
  - **Camera-Only Live Geotagged Photos:** Capture with real GPS/accuracy/timestamp watermark on canvas, downsampling client-side to ≤200KB before persisting to the offline outbox.
  - **Real 60-Second Voice Note:** Record compressed WebM/Opus audio with live animated waveform, upload to R2, and play back natively.
  - **Dynamic Issue Tags:** Customizable per-org issue chips (max 8 active) + custom issue creation.
- [x] **Owner Daily Operations Dashboard & Review Feed (`OwnerDprFeedModal.tsx`):**
  - Today's submission status across all sites (Submitted / Pending, Full / Half / Stopped counts).
  - Neutral anti-fake badges (*"Location unverified"*, *"GPS far from site (>500m)"*, *"Time skew >15m"*).
  - Date-wise historical audit trail, variable voice playback (`1.0x`, `1.5x`, `2.0x`), full-screen photo zoom, and double-blue-tick `✓✓ Seen` persistent acknowledgement.

### Subphase 3.4 — Worker Master, Weekly Kharchi & Vendor Khata [COMPLETED]
- [x] **Persistent Worker Master & Issue Chips Customizer (`OwnerIssueChipsModal.tsx`):** Track issue chips with an 8-chip guardrail, manage supervisor assignments, and link labour entries with muster rolls.
- [x] **Morning Geotagged Photo Proof:** Real camera capture with GPS coordinates and timestamps attached to daily progress records.
- [x] **Full Vendor / Supplier Khata UI:** Connected with Drizzle schema and Dexie tables for seamless multi-role site tracking.

---

## Phase 4: TaskSpot Operations Modules (Procurement, Tasks & Escalations)

**Goal:** Turn daily reporting and financial tracking into a closed-loop site execution system.

### Subphase 4.1 — Material Request → Purchase Assignment → Delivery Confirmation (GRN)
- [ ] **Supervisor Request:** 3-tap request (Site + Item + Quantity + Urgency + optional photo/voice note).
- [ ] **Owner / Buyer Approval & Assignment:** Approve, reject, or assign to a Purchase Manager/Vendor with expected delivery date.
- [ ] **Delivery Confirmation (GRN):** Supervisor marks delivered with actual received quantity and mandatory **Challan / Bill Photo**.
- [ ] **Auto-Ledger Sync:** Confirming delivery automatically creates a `MaterialRecord` and updates the linked `Vendor Udhaar` / `ExpenseDue`—eliminating double data entry.

### Subphase 4.2 — Lightweight Site Tasks & Completion Photo Proof
- [ ] Build simple **"Site Action Items / Punch List"** (`site_tasks`: Title, Site, Assignee, Due Date, Status, Mandatory Completion Proof Photo).
- [ ] Add **1-Tap "Convert Issue to Task"** directly from any Daily Site Report issue tag.
- [ ] Enforce photo proof before a supervisor can mark an assigned task `Completed`.

### Subphase 4.3 — Automated Escalations & Push Notifications
- [ ] Wire `@capacitor/push-notifications` (Firebase Cloud Messaging — free) and store device `pushToken` in `users`.
- [ ] Add scheduled backend cron jobs:
  - **11:00 AM IST:** Remind supervisors who haven't submitted today's DPR; escalate to Owner at **1:00 PM IST**.
  - **4 Hours:** Escalate unapproved urgent material requests.
  - **24 Hours / Daily 9:00 AM IST:** Alert Owner & Assignee on overdue tasks and overdue rented/company tools.
- [ ] Log every alert in `notification_log` to prevent duplicate spam.

---

## Phase 5: AI Voice Automation, Daily WhatsApp Digest & Pro Tier

**Goal:** Eliminate typing friction for Indian field staff and deliver effortless daily visibility to owners.

### Subphase 5.1 — AI Voice-to-Structured Action (Hindi / Hinglish / Regional)
- [ ] Replace SiteSaathi's fragile Web Speech regex parser with server-side AI audio processing:
  - Record 60s voice note offline -> upload to R2 -> backend Edge/API job calls **Gemini Flash** (or **Sarvam AI** for regional Indian dialects) to transcribe (`transcripts`) and extract structured JSON (`summaries`).
- [ ] **Mandatory Confirmation Card UI:** Present extracted fields (*Action Type: Material Request / Task / Expense*, *Item*, *Quantity*, *Site*, *Due Date*) in a clean editable card before writing to the database.

### Subphase 5.2 — Automated Daily WhatsApp Summary (Tier 2 — Pro)
- [ ] Integrate **Meta WhatsApp Cloud API** (Utility templates, ~₹0.12–₹0.15/message).
- [ ] Send an automated **8:30 PM IST Daily Site Digest** to the Owner: sites reported vs pending, work status summary, today's expenses/labour count, overdue tasks, and pending material approvals with deep links into the app.

### Subphase 5.3 — Opt-In Face Verification Attendance *(Pro / Enterprise Add-On — Deferred)*
- [ ] Build **only after** Phases 1–4 are proven in the field, targeted at mid-sized contractors with fixed salaried staff (not daily *chowk* labour).
- [ ] **DPDP Act (2023) Compliance Built-In:**
  - Regional-language explicit digital consent & privacy notice before capture.
  - Store encrypted mathematical face embeddings only (not raw high-res photos).
  - Always provide a non-biometric fallback (Supervisor Photo + PIN/GPS) and automatic template deletion when a worker exits.

---

## Recommended Immediate Next Step

Start with **Phase 1 (Subphase 1.1 & 1.2)** to eliminate all data-loss, PIN lockout, and financial math bugs in SiteSaathi before bringing in `FieldLog/backend` in **Phase 2**.
