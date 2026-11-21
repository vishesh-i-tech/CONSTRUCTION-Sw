/**
 * SiteSaathi + FieldLog Unified API Client
 * Includes automatic Bearer token injection and JWT auto-refresh on HTTP 401.
 */

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) {
    return (window as any).__API_BASE_URL__;
  }
  // Check Vite env
  try {
    if (import.meta && import.meta.env && import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch {
    // ignore
  }
  // Default to local Fastify backend port
  return 'http://localhost:4000';
};

const TOKEN_STORAGE_KEY = 'sitesaathi_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'sitesaathi_refresh_token';

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
}

export function clearStoredTokens() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Universal fetch wrapper with auto-retry and JWT auto-refresh on 401.
 */
export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; error: null } | { data: null; error: string; statusCode?: number }> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    let res = await fetch(url, { ...options, headers });

    // Handle token expiration with silent refresh
    if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh') && !path.includes('/auth/owner/signup')) {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        clearStoredTokens();
        return { data: null, error: 'Unauthorized: Session expired', statusCode: 401 };
      }

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccess = refreshData.tokens.accessToken;
            const newRefresh = refreshData.tokens.refreshToken;
            storeTokens(newAccess, newRefresh);
            isRefreshing = false;
            onRefreshed(newAccess);
          } else {
            isRefreshing = false;
            clearStoredTokens();
            return { data: null, error: 'Session expired. Please log in again.', statusCode: 401 };
          }
        } catch {
          isRefreshing = false;
          clearStoredTokens();
          return { data: null, error: 'Network error during session refresh.', statusCode: 401 };
        }
      }

      // Wait for the active refresh to finish
      const retryToken = await new Promise<string>((resolve) => {
        subscribeTokenRefresh((newToken) => resolve(newToken));
      });

      headers.set('Authorization', `Bearer ${retryToken}`);
      res = await fetch(url, { ...options, headers });
    }

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg =
        payload?.message ||
        payload?.error ||
        `Request failed with status ${res.status}`;
      return { data: null, error: errMsg, statusCode: res.status };
    }

    return { data: payload as T, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Network request failed' };
  }
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------

export async function apiOwnerSignup(data: {
  companyName: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
}) {
  const res = await apiRequest<{
    message: string;
    organization: { id: string; name: string };
    owner: { id: string; name: string; phone: string; role: 'owner' };
    tokens: { accessToken: string; refreshToken: string };
  }>('/api/v1/auth/owner/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (res.data?.tokens) {
    storeTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
  }
  return res;
}

export async function apiOwnerLogin(phone: string, password?: string) {
  const res = await apiRequest<{
    user: { id: string; name: string; phone: string; role: 'owner'; organizationId: string; organizationName: string };
    tokens: { accessToken: string; refreshToken: string };
  }>('/api/v1/auth/owner/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });

  if (res.data?.tokens) {
    storeTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
  }
  return res;
}

export async function apiSupervisorLogin(phone: string, pin: string) {
  const res = await apiRequest<{
    user: { id: string; name: string; phone: string; role: 'supervisor'; organizationId: string; organizationName: string };
    tokens: { accessToken: string; refreshToken: string };
  }>('/api/v1/auth/supervisor/login', {
    method: 'POST',
    body: JSON.stringify({ phone, pin }),
  });

  if (res.data?.tokens) {
    storeTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
  }
  return res;
}

export async function apiChangeOwnerPassword(oldPassword: string, newPassword: string) {
  return apiRequest('/api/v1/auth/owner/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// -------------------------------------------------------------
// Team / Supervisor Management Endpoints (Owner Only)
// -------------------------------------------------------------

export async function apiGetSupervisors() {
  return apiRequest<{
    supervisors: {
      id: string;
      name: string;
      phone: string;
      role: 'supervisor';
      isActive: boolean;
      language?: string;
      assignedSites: { id: string; name: string }[];
      createdAt: string;
    }[];
  }>('/api/v1/supervisors');
}

export async function apiCreateSupervisor(data: {
  name: string;
  phone: string;
  pin: string;
  language?: string;
}) {
  return apiRequest<{
    message: string;
    supervisor: { id: string; name: string; phone: string; role: 'supervisor' };
  }>('/api/v1/supervisors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiResetSupervisorPin(supervisorId: string, newPin: string) {
  return apiRequest(`/api/v1/supervisors/${supervisorId}/pin`, {
    method: 'PATCH',
    body: JSON.stringify({ newPin }),
  });
}

export async function apiUpdateSupervisorStatus(supervisorId: string, isActive: boolean) {
  return apiRequest(`/api/v1/supervisors/${supervisorId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

// -------------------------------------------------------------
// Sites Endpoints
// -------------------------------------------------------------

export async function apiGetSites(includeArchived = false) {
  return apiRequest<{
    sites: any[];
  }>(`/api/v1/sites?includeArchived=${includeArchived}`);
}

export async function apiCreateSite(siteData: {
  name: string;
  locationText: string;
  latitude?: number;
  longitude?: number;
  siteType?: string;
  estimatedBudget?: number;
  workStatus?: string;
  paymentStatus?: string;
  clientName?: string;
  clientPhone?: string;
  startDate?: string;
  expectedEndDate?: string;
}) {
  return apiRequest<{ site: any }>('/api/v1/sites', {
    method: 'POST',
    body: JSON.stringify(siteData),
  });
}

export async function apiAssignSupervisors(siteId: string, supervisorIds: string[]) {
  return apiRequest(`/api/v1/sites/${siteId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ supervisorIds }),
  });
}

// -------------------------------------------------------------
// Issue Chips Endpoints
// -------------------------------------------------------------

export async function apiGetIssueTypes(activeOnly = true) {
  return apiRequest<{
    issueTypes: {
      id: string;
      organizationId: string;
      labelHi: string;
      labelEn: string;
      icon?: string;
      sortOrder: number;
      isActive: boolean;
      isDefault: boolean;
    }[];
  }>(`/api/v1/issue-types?activeOnly=${activeOnly}`);
}

export async function apiCreateIssueType(data: {
  labelHi: string;
  labelEn: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  return apiRequest<{ issueType: any }>('/api/v1/issue-types', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateIssueType(
  id: string,
  data: {
    labelHi?: string;
    labelEn?: string;
    icon?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
) {
  return apiRequest<{ issueType: any }>(`/api/v1/issue-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// -------------------------------------------------------------
// Presigned Cloud Uploads & Direct Media Transfer
// -------------------------------------------------------------

export async function apiPresignUpload(siteId: string, kind: 'photo' | 'audio', mimeType: string) {
  return apiRequest<{
    uploadUrl: string;
    storageKey: string;
    expiresInSeconds: number;
  }>('/api/v1/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ siteId, kind, mimeType }),
  });
}

export async function apiUploadToR2(uploadUrl: string, blob: Blob, mimeType: string) {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    return res.ok;
  } catch (err) {
    console.warn('R2 upload failed:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Daily Progress Records (DPR) Endpoints
// -------------------------------------------------------------

export async function apiSubmitDailyRecord(recordData: {
  clientId: string;
  siteId: string;
  recordDate: string;
  status: 'full' | 'half' | 'stopped';
  capturedAt: string;
  missingPhoto?: boolean;
  missingVoice?: boolean;
  flags?: Record<string, any>;
  issueTypeIds?: string[];
  photos?: {
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    latitude?: number;
    longitude?: number;
    accuracyM?: number;
    capturedAt: string;
    flags?: Record<string, any>;
  }[];
  audio?: {
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds?: number;
    capturedAt?: string;
  };
}) {
  return apiRequest<{
    message: string;
    record: any;
    isUpdate: boolean;
  }>('/api/v1/records', {
    method: 'POST',
    body: JSON.stringify(recordData),
  });
}

export async function apiGetTodayRecords() {
  return apiRequest<{
    date: string;
    sites: {
      siteId: string;
      siteName: string;
      hasSubmitted: boolean;
      record: any | null;
    }[];
  }>('/api/v1/records/today');
}

export async function apiGetRecordDetails(recordId: string) {
  return apiRequest<{
    record: any;
    issues: any[];
    media: any[];
    acknowledgements?: any[];
  }>(`/api/v1/records/${recordId}`);
}

export async function apiGetSiteRecords(siteId: string) {
  return apiRequest<{
    siteId: string;
    siteName: string;
    totalRecords: number;
    records: any[];
  }>(`/api/v1/sites/${siteId}/records`);
}

export async function apiAcknowledgeRecord(recordId: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    acknowledgement: any;
  }>(`/api/v1/records/${recordId}/acknowledge`, {
    method: 'POST',
  });
}
