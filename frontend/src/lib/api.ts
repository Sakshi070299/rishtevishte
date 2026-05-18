import Cookies from 'js-cookie';
import type { User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'rishtenate_token';
const USER_KEY = 'rishtenate_user';

const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
const cookieOpts = { secure: isSecure, sameSite: 'strict' as const };

// ─── TOKEN MANAGEMENT ───────────────────────────────

export function getToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

export function setAuth(token: string, user: User) {
  Cookies.set(TOKEN_KEY, token, { ...cookieOpts, expires: 1 });
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  Cookies.remove(TOKEN_KEY);
  Cookies.remove('rishtenate_refresh');
  localStorage.removeItem(USER_KEY);
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── ASSET URL HELPERS ───────────────────────────────

/**
 * Backend returns local upload URLs as "/uploads/..." for dev/self-host.
 * Resolve those to an absolute URL so opening in a new tab works reliably
 * even when frontend and backend are on different origins.
 */
export function resolvePhotoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  // Hard block: never allow base64/data URLs in production flow.
  if (url.startsWith('data:image/')) return undefined;
  if (url.startsWith('/uploads/')) return `${API_ORIGIN}${url}`;
  return url;
}

// ─── UPLOAD API (multipart) ─────────────────────────

export const uploadApi = {
  photo: async (file: File): Promise<{ url: string }> => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${API_URL}/upload/photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data as any)?.message || 'Photo upload failed';
      throw new Error(msg);
    }
    return data as { url: string };
  },
};

// ─── API FETCH WRAPPER ──────────────────────────────

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  noAuth?: boolean;
  skipAuthRedirect?: boolean;
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, noAuth = false, skipAuthRedirect = false } = options;

  const token = getToken();
  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token && !noAuth) {
    fetchHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // ignore non-JSON responses
  }

  if (response.status === 401 && !noAuth && !skipAuthRedirect) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
  }

  if (!response.ok) {
    const parsed = data as Record<string, unknown> | null;
    const msg = (parsed?.message as string) || (response.status === 401 ? 'Unauthorized' : 'API request failed');
    throw new Error(msg);
  }

  return data as T;
}

// ─── AUTH API ───────────────────────────────────────

export const authApi = {
  sendOtp: (mobile: string, loginType = 'USER') =>
    api('/auth/send-otp', { method: 'POST', body: { mobile, loginType }, noAuth: true }),

  verifyOtp: (mobile: string, code: string, loginType = 'USER') =>
    api('/auth/verify-otp', { method: 'POST', body: { mobile, code, loginType }, noAuth: true }),

  getMe: () => api<User>('/auth/me'),

  logout: () => api('/auth/logout', { method: 'POST' }),
};

// ─── PROFILES API ───────────────────────────────────

export const profilesApi = {
  create: (data: unknown, captchaToken?: string) =>
    api('/profiles', {
      method: 'POST',
      body: data,
      headers: captchaToken ? { 'x-captcha-token': captchaToken } : {},
    }),
  list: () => api('/profiles'),
  get: (id: string) => api(`/profiles/${id}`),
  update: (id: string, data: unknown) => api(`/profiles/${id}`, { method: 'PATCH', body: data }),
  settle: (id: string) => api(`/profiles/${id}/settle`, { method: 'PATCH' }),
  deactivate: (id: string) => api(`/profiles/${id}/deactivate`, { method: 'PATCH' }),
  exportData: () => api('/profiles/me/export'),
  expirePendingPayment: () => api('/profiles/me/expire-pending-payment', { method: 'POST', skipAuthRedirect: true }),
};

// ─── SEARCH API ─────────────────────────────────────

export const searchApi = {
  search: (filters: unknown) => api('/search', { method: 'POST', body: filters }),
  remaining: () => api('/search/remaining'),
  access: () =>
    api<{
      role: string;
      isStaff: boolean;
      hasPaidAccess: boolean;
      accessExpiresAt: string | null;
      isUnlocked: boolean;
      accessFeeRupees: number;
      validMonths: number;
    }>('/search/access'),
};

// ─── ACCESS PAYMENT API (₹2100 profile unlock) ──────

export const accessPaymentApi = {
  status: () =>
    api<{
      isUnlocked: boolean;
      isStaff: boolean;
      accessExpiresAt: string | null;
      accessFeeRupees: number;
      validMonths: number;
    }>('/payments/access/status'),
  createOrder: () =>
    api<
      | { alreadyUnlocked: true; expiresAt: string }
      | {
          alreadyUnlocked: false;
          accessPaymentId: string;
          orderId: string;
          amount: number;
          currency: string;
          key: string;
          validMonths: number;
        }
    >('/payments/access/order', { method: 'POST' }),
  verify: (data: {
    accessPaymentId: string;
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature: string;
  }) => api('/payments/access/verify', { method: 'POST', body: data }),
};

// ─── PUBLIC CONTENT API ──────────────────────────────

export const contentApi = {
  get: (key: string) => api<{ content: string }>(`/content/${encodeURIComponent(key)}`, { noAuth: true }),
  gallery: () => api<{ id: string; title: string; titleHi: string; imageUrl: string; sortOrder: number }[]>('/content/gallery', { noAuth: true }),
  banners: () => api<{ id: string; title: string; titleHi: string; imageUrl: string; linkUrl: string | null; sortOrder: number }[]>('/content/banners', { noAuth: true }),
};

// ─── DONATIONS API ──────────────────────────────────

export const donationsApi = {
  create: (data: unknown) => api('/donations', { method: 'POST', body: data, skipAuthRedirect: true }),
  verify: (data: unknown) => api('/donations/verify', { method: 'POST', body: data, skipAuthRedirect: true }),
  list: (params?: string) => api(`/donations${params ? `?${params}` : ''}`),
};

// ─── TEAM API ───────────────────────────────────────

export const teamApi = {
  dashboard: () => api('/team/dashboard'),
  myActivity: (days: number) => api(`/team/my-activity?days=${days}`),
  createProfileOffline: (
    profileData: unknown,
    paymentMethods: Array<"CASH" | "FREE" | "ONLINE">,
    paymentDetails?: {
      cashCollectedBy?: string;
      cashReceiptNo?: string;
      cashAmount?: number;
      onlineProvider?: string;
      onlineRefNo?: string;
      onlineAmount?: number;
      freeAmount?: number;
      freeApprovedBy?: string;
      freeReason?: string;
    },
  ) =>
    api("/team/profiles/register", {
      method: "POST",
      body: { profileData, paymentMethods, paymentDetails },
    }),
  searchProfiles: (params: string) => api(`/team/profiles?${params}`),
  listIncompleteUsers: (params?: string) => api(`/team/incomplete-users${params ? `?${params}` : ""}`),
  editProfile: (id: string, data: unknown) => api(`/team/profiles/${id}`, { method: 'PATCH', body: data }),
  toggleSettled: (id: string, settled: boolean) => api(`/team/profiles/${id}/settle`, { method: 'PATCH', body: { settled } }),
  updateProfileStatus: (id: string, status: string) =>
    api(`/team/profiles/${id}/status`, { method: 'PATCH', body: { status } }),
  exportBatch: (limit: 25 | 50 | 75 | 100) =>
    api(`/team/export?limit=${limit}&_=${Date.now()}`),
  printRegistrations: (from: string, to: string) => api(`/team/print?from=${from}&to=${to}`),
};

// ─── ADMIN API ──────────────────────────────────────

export const adminApi = {
  // Team
  listTeam: () => api('/admin/team'),
  addTeam: (name: string, mobile: string) => api('/admin/team', { method: 'POST', body: { name, mobile } }),
  removeTeam: (id: string) => api(`/admin/team/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => api('/admin/settings'),
  updateSetting: (key: string, value: string) => api('/admin/settings', { method: 'PATCH', body: { key, value } }),
  updateWeeklyLimit: (limit: number) => api('/admin/settings/weekly-limit', { method: 'PATCH', body: { limit } }),

  // Gallery
  getGallery: () => api('/admin/gallery'),
  addGalleryImage: (title: string, titleHi: string, imageUrl: string) =>
    api('/admin/gallery', { method: 'POST', body: { title, titleHi, imageUrl } }),
  deleteGalleryImage: (id: string) => api(`/admin/gallery/${id}`, { method: 'DELETE' }),

  // Banners
  listBanners: () => api('/admin/banners'),
  addBanner: (data: { title: string; titleHi?: string; imageUrl: string; linkUrl?: string }) =>
    api('/admin/banners', { method: 'POST', body: data }),
  deleteBanner: (id: string) => api(`/admin/banners/${id}`, { method: 'DELETE' }),


  // Managers
  listManagers: () => api('/admin/managers'),
  addManager: (name: string, mobile: string) => api('/admin/managers', { method: 'POST', body: { name, mobile } }),
  removeManager: (id: string) => api(`/admin/managers/${id}`, { method: 'DELETE' }),
  // Detailed Reports
  detailedRegistrations: (params?: string) => api(`/admin/reports/registrations-detailed${params ? `?${params}` : ''}`),

  // Sales & Invoices
  salesSummary: (period: string) => api(`/admin/sales?period=${period}`),
  getInvoice: (id: string) => api(`/admin/invoices/${id}`),

  // Reports
  dashboard: () => api('/admin/reports/dashboard'),
  registrationReport: (period: string) => api(`/admin/reports/registrations?period=${period}`),
  donationReport: (period: string) => api(`/admin/reports/donations?period=${period}`),
  teamActivity: (days: number) => api(`/admin/team-activity?days=${days}`),

  // Profiles Management
  listProfiles: (params?: string) => api(`/admin/profiles${params ? `?${params}` : ''}`),
  updateProfileStatus: (id: string, status: string) =>
    api(`/admin/profiles/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteProfile: (id: string) => api(`/admin/profiles/${id}`, { method: 'DELETE' }),

  // Donations Management
  listDonations: (params?: string) => api(`/admin/donations${params ? `?${params}` : ''}`),

  // Notifications
  listNotifications: (params?: string) => api(`/admin/notifications${params ? `?${params}` : ''}`),

  // Users
  listUsers: (params?: string) => api(`/admin/users${params ? `?${params}` : ''}`),
  listIncompleteUsers: (params?: string) => api(`/admin/incomplete-users${params ? `?${params}` : ''}`),

  // Cleanup
  runCleanup: () => api('/admin/cleanup', { method: 'POST' }),
};
