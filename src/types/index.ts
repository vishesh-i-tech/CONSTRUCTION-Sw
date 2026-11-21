export type TradeCategory =
  | 'construction'
  | 'plumbing'
  | 'electrical'
  | 'painting'
  | 'carpentry'
  | 'fabrication'
  | 'flooring'
  | 'ceiling'
  | 'hvac'
  | 'interior'
  | 'infra';
export type Language = 'hi' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

export type SiteWorkStatus = 'planning' | 'ongoing' | 'completed' | 'on_hold';
export type SitePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';
export type UserRole = 'owner' | 'supervisor' | 'solo';

export interface ContractorAccount {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password?: string;
  trade: TradeCategory;
  language: Language;
  themeMode: ThemeMode;
  companyName?: string;
  pinLock?: string;
  isPinLockEnabled?: boolean;
  isBiometricEnabled?: boolean;
  isAntiDeleteEnabled?: boolean;
  tutorialCompleted: boolean;
  createdAt: string;
  // Phase 3 Multi-Role & Cloud Sync fields
  role?: UserRole;
  organizationId?: string;
  organizationName?: string;
  accessToken?: string;
  refreshToken?: string;
  assignedSiteIds?: string[];
}

export type PaymentMode = 'UPI / Online' | 'Cash' | 'Bank Transfer' | 'Cheque';

export interface ClientPayment {
  id: string;
  siteId: string;
  amount: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  payerName?: string;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
}

export interface Site {
  id: string;
  contractorId: string;
  name: string;
  location: string;
  siteType: 'Building' | 'Residential' | 'Commercial' | 'Road' | 'Dam' | 'Bridge' | 'Renovation' | 'Industrial' | 'Apartment' | 'Other';
  estimatedBudget: number;
  workStatus: SiteWorkStatus;
  paymentStatus: SitePaymentStatus;
  clientName?: string;
  clientPhone?: string;
  startDate: string;
  expectedEndDate?: string;
  completedDate?: string;
  notes?: string;
  coverPhoto?: string;
  voiceNoteUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ToolRecord {
  id: string;
  siteId: string;
  name: string;
  quantity: number;
  size?: string;
  dateSent: string;
  expectedReturnDate: string;
  actualReturnDate?: string | null;
  sourceType?: 'self_owned' | 'purchased_for_site'; // Contractor's own tool dispatched vs newly bought for site
  purchasePrice?: number; // Cost if purchased during site work
  rentOrRepairCost?: number;
  status: 'on_site' | 'returned' | 'overdue';
  notes?: string;
  photoUrl?: string;
}

export interface LabourEntry {
  id: string;
  recordId: string;
  workerName: string;
  role: 'Mason' | 'Helper' | 'Electrician' | 'Plumber' | 'Plasterer' | 'Welder' | 'Carpenter' | 'Painter' | 'Supervisor';
  attendanceStatus: 'full_day' | 'half_day' | 'absent' | 'overtime';
  dailyWage: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus?: 'paid' | 'unpaid' | 'advance' | 'pending';
}

export interface LabourRecord {
  id: string;
  siteId: string;
  date: string;
  rawPhotoUrl?: string;
  ocrRawText?: string;
  totalWorkers: number;
  totalDailyWage: number;
  totalPaid: number;
  notes?: string;
  voiceNoteUrl?: string;
  entries?: LabourEntry[];
}

export interface MaterialRecord {
  id: string;
  siteId: string;
  vendorId?: string;
  itemName: string;
  quantity: number;
  unit: string; // 'plates (4x4)' | 'bags' | 'meters' | 'kg' | 'brass' | 'truck' | 'pieces'
  unitPrice: number;
  totalCost: number;
  purchaseDate: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  paidAmount: number;
  receiptPhoto?: string;
  notes?: string;
}

export interface MachineryRecord {
  id: string;
  siteId: string;
  machineType: 'Concrete Mixer' | 'Tractor' | 'JCB Excavator' | 'Tower Crane' | 'Generator' | 'Breaker' | 'Pipe Threader' | 'Cable Puller' | 'Other';
  fuelLitres?: number;
  fuelCost?: number;
  rentalHoursOrDays?: number;
  rentalCost?: number;
  totalCost: number;
  logDate: string;
  notes?: string;
}

export interface ExpenseDue {
  id: string;
  siteId: string;
  vendorId?: string;
  materialId?: string;
  title: string;
  category: 'material' | 'tool_rent' | 'machinery' | 'labour' | 'subcontract' | 'other';
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  notes?: string;
}

export interface Vendor {
  id: string;
  contractorId: string;
  name: string;
  phone: string;
  tradeSpecialty: string;
  materialsSupplied?: string[];
  totalUdhaarBalance: number;
}

export interface Reminder {
  id: string;
  type: 'tool_overdue' | 'payment_due' | 'completed_site_due' | 'labour_wage';
  title: string;
  description: string;
  siteId: string;
  siteName: string;
  dueDate: string;
  amount?: number;
  isDismissed?: boolean;
}

export interface SmartInsight {
  id: string;
  category: 'budget_alert' | 'tool_overdue' | 'attendance_trend' | 'profit_summary';
  title: string;
  description: string;
  badge: string;
  actionText?: string;
  actionRoute?: string;
}

export interface TradeConfig {
  id: TradeCategory;
  nameEn: string;
  nameHi: string;
  subtitleEn: string;
  subtitleHi: string;
  primaryColor: string;
  badgeBg: string;
  badgeText: string;
  iconName: string;
  quickAddTemplates: {
    titleEn: string;
    titleHi: string;
    category: string;
    defaultCost?: number;
    unit?: string;
  }[];
  customWidgets: string[];
}

// Phase 3 Models for Daily Progress Reporting (DPR), Sync Outbox & Teams

export interface RecordMedia {
  id?: string;
  kind: 'photo' | 'audio';
  storageKey: string;
  url?: string;
  mimeType: string;
  sizeBytes: number;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  capturedAt: string;
  durationSeconds?: number;
  flags?: Record<string, any>;
}

export interface IssueType {
  id: string;
  organizationId: string;
  labelHi: string;
  labelEn: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface RecordAcknowledgement {
  id: string;
  recordId: string;
  ownerId: string;
  seenAt: string;
}

export interface DailyRecord {
  id: string;
  siteId: string;
  siteName?: string;
  recordDate: string; // YYYY-MM-DD
  status: 'full' | 'half' | 'stopped';
  capturedAt: string;
  receivedAt?: string;
  missingPhoto: boolean;
  missingVoice: boolean;
  flags?: Record<string, any>;
  submittedBy: string;
  submitterName?: string;
  clientId: string;
  issues?: { id: string; labelHi: string; labelEn: string; icon?: string }[];
  media?: RecordMedia[];
  acknowledgements?: RecordAcknowledgement[];
  synced?: boolean;
}

export interface SupervisorUser {
  id: string;
  name: string;
  phone: string;
  role: 'supervisor';
  isActive: boolean;
  language?: string;
  assignedSites?: { id: string; name: string }[];
  createdAt: string;
}

export interface SyncOutboxItem {
  id: string;
  entity: 'daily_record' | 'labour' | 'material' | 'payment' | 'due' | 'task' | 'material_request' | 'site_task';
  action: 'create' | 'update' | 'delete';
  payload: any;
  mediaBlobs?: { kind: 'photo' | 'audio'; siteId: string; mimeType: string; dataUrl: string }[];
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

// Phase 4 TaskSpot Operations Models (Material Requests & Site Tasks)

export interface MaterialRequestItem {
  itemName: string;
  quantity: number;
  unit: string;
  estimatedRate?: number;
}

export interface MaterialRequest {
  id: string;
  clientId: string;
  organizationId?: string;
  siteId: string;
  siteName?: string;
  requestedBy: string;
  requestedByName?: string;
  itemsJson: MaterialRequestItem[];
  urgency: 'low' | 'normal' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  notes?: string;
  vendorId?: string;
  vendorName?: string;
  expectedDeliveryDate?: string;
  fulfilledAt?: string;
  challanPhotoKey?: string;
  challanPhotoUrl?: string;
  actualReceivedQuantity?: number;
  unitCost?: number;
  totalCost?: number;
  synced?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SiteTask {
  id: string;
  clientId: string;
  organizationId?: string;
  siteId: string;
  siteName?: string;
  title: string;
  description?: string;
  assignedTo?: string;
  assignedToName?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: string;
  completionPhotoKey?: string;
  completionPhotoUrl?: string;
  completedAt?: string;
  completedBy?: string;
  issueId?: string;
  synced?: boolean;
  createdAt: string;
  updatedAt?: string;
}

