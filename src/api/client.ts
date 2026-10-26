import type { ServerOutletMenuResponse } from './menuAdapter';
/**
 * Centralized Frontend API Client
 * Pali Resort & Club Operations Platform
 * 
 * Communicates with backend Express API at /api/v1
 * Handles RFC 7807 problem details, staff/guest Bearer tokens, idempotency, and timeouts.
 */

export interface ApiProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public status: number;
  public type: string;
  public title: string;
  public detail: string;
  public problem: ApiProblemDetails;
  public invalidParams?: Array<{ name: string; reason: string }>;

  constructor(message: string, status: number, problem?: Partial<ApiProblemDetails>) {
    const detail = problem?.detail || message;
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.type = problem?.type || 'about:blank';
    this.title = problem?.title || message;
    this.detail = detail;
    this.problem = {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: problem?.instance,
      invalidParams: problem?.invalidParams,
      ...problem
    };
    this.invalidParams = this.problem.invalidParams;
  }
}

export class NetworkError extends Error {
  public isTimeout: boolean;
  public code?: string;
  public status: number;

  constructor(message: string, isTimeout: boolean = false, code?: string) {
    super(message);
    this.name = 'NetworkError';
    this.isTimeout = isTimeout;
    this.code = code;
    this.status = isTimeout ? 408 : 0;
  }
}

const STAFF_TOKEN_KEY = 'pali_staff_token';
const GUEST_TOKEN_KEY = 'pali_guest_token';

// Base URL resolution
const getBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '');
  }
  return '/api/v1';
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  idempotencyKey?: string;
  isGuest?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBaseUrl();
  }

  public getStaffToken(): string | null {
    try {
      return localStorage.getItem(STAFF_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setStaffToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(STAFF_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(STAFF_TOKEN_KEY);
      }
    } catch {
      // Ignore storage quota or access errors
    }
  }

  public getGuestToken(): string | null {
    try {
      return sessionStorage.getItem(GUEST_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  public setGuestToken(token: string | null): void {
    try {
      if (token) {
        sessionStorage.setItem(GUEST_TOKEN_KEY, token);
        localStorage.removeItem(GUEST_TOKEN_KEY);
      } else {
        sessionStorage.removeItem(GUEST_TOKEN_KEY);
        localStorage.removeItem(GUEST_TOKEN_KEY);
      }
    } catch {
      // Ignore storage quota or access errors
    }
  }

  public async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      idempotencyKey,
      isGuest = false,
      timeoutMs = 15000,
      signal
    } = options;

    // Construct URL with query parameters
    let url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (params) {
      const queryParams = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          queryParams.append(key, String(val));
        }
      }
      const qs = queryParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers
    };

    if (body && !(body instanceof FormData)) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    // Attach Bearer token
    if (isGuest) {
      const guestToken = this.getGuestToken();
      if (guestToken) {
        requestHeaders['Authorization'] = `Bearer ${guestToken}`;
      }
    } else {
      const staffToken = this.getStaffToken();
      if (staffToken) {
        requestHeaders['Authorization'] = `Bearer ${staffToken}`;
      }
    }

    // Attach Idempotency Key
    if (idempotencyKey) {
      requestHeaders['Idempotency-Key'] = idempotencyKey;
    } else if (method === 'POST' || method === 'PATCH') {
      // Auto-generate idempotency key for state mutations
      requestHeaders['Idempotency-Key'] = generateIdempotencyKey();
    }

    // Attach Correlation ID
    requestHeaders['X-Correlation-Id'] = generateIdempotencyKey();

    // Timeout controller
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    let combinedSignal = controller.signal;
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timerId);
        throw new NetworkError('Request aborted by caller', false, 'ECONNABORTED');
      }
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
        signal: combinedSignal
      });

      clearTimeout(timerId);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');

      if (!response.ok) {
        let problem: ApiProblemDetails;
        let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;

        if (isJson) {
          try {
            const json = await response.json();
            const detail = json.detail || json.message || errorMessage;
            const title = json.title || response.statusText || 'Error';
            const type = json.type || 'about:blank';
            problem = {
              type,
              title,
              status: typeof json.status === 'number' ? json.status : response.status,
              detail,
              instance: json.instance,
              invalidParams: json.invalidParams || json.errors,
              ...json
            };
            errorMessage = detail;
          } catch {
            problem = {
              type: 'about:blank',
              title: response.statusText || 'Error',
              status: response.status,
              detail: errorMessage
            };
          }
        } else {
          let text = '';
          try {
            text = await response.text();
          } catch {
            // Text read failed
          }
          problem = {
            type: 'about:blank',
            title: response.statusText || 'Error',
            status: response.status,
            detail: text || errorMessage
          };
          errorMessage = problem.detail;
        }

        if (response.status === 401 && !isGuest && this.getStaffToken() && requestHeaders.Authorization===`Bearer ${this.getStaffToken()}`) {
          this.setStaffToken(null);
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('pali_auth_user');
              localStorage.removeItem(STAFF_TOKEN_KEY);
              sessionStorage.removeItem('pali_auth_user');
              if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/customer/')) {
                window.location.href = '/login';
              }
            } catch {
              // Ignore navigation or storage errors
            }
          }
        }

        const unlockAt = response.headers.get('X-Login-Unlock-At');
        if (unlockAt && Number.isFinite(Date.parse(unlockAt))) problem.unlockAt = unlockAt;
        throw new ApiError(errorMessage, response.status, problem);
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      if (isJson) {
        return (await response.json()) as T;
      }

      return (await response.text()) as unknown as T;
    } catch (err: any) {
      clearTimeout(timerId);
      if (err instanceof ApiError) {
        throw err;
      }
      if (err instanceof NetworkError) {
        throw err;
      }
      if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
        throw new NetworkError('Request timed out or was aborted', true, 'ETIMEDOUT');
      }
      throw new NetworkError(err.message || 'Network connection failure', false, 'ENETWORK');
    }
  }

  // ==========================================================================
  // 1. AUTHENTICATION & STAFF
  // ==========================================================================

  public async staffLogin(body: { identifier: string; password: string }) {
    const res = await this.request<{
      token: string;
      staff: {
        id: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
      roles: Array<{ id: string; displayName: string }>;
      permissions: string[];
      moduleAccess?: Record<string, { canView: boolean; canEdit: boolean }>;
      outlets: Array<{ outletId: string; isPrimary: boolean }>;
    }>('/auth/staff-login', {
      method: 'POST',
      body
    });

    if (res?.token) {
      this.setStaffToken(res.token);
    }

    return res;
  }

  public async staffLogout(): Promise<void> {
    const tokenAtLogout = this.getStaffToken();

    try {
      if (tokenAtLogout) {
        await this.request('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenAtLogout}` }
        });
      }
    } catch {
      // The server may already have rejected or expired this session.
    } finally {
      // Never clear a newer session created while logout was in flight.
      if (this.getStaffToken() === tokenAtLogout) {
        this.setStaffToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pali_auth_user');
          sessionStorage.removeItem('pali_auth_user');
        }
      }
    }
  }

  public async getMe() {
    return await this.request<{
      staff: {
        id: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
      roles: Array<{ id: string; displayName: string }>;
      permissions: string[];
      moduleAccess?: Record<string, { canView: boolean; canEdit: boolean }>;
      outlets: Array<{ outletId: string; isPrimary: boolean }>;
    }>('/auth/me');
  }

  public async createStaffUser(body: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    roleId: string;
    password: string;
    outletId?: string;
  }) {
    return await this.request<{
      staff: {
        id: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        role: string;
        isActive: boolean;
      };
    }>('/staff', {
      method: 'POST',
      body
    });
  }

  public async login(body: { emailOrPhoneOrCode?: string; role?: string; pin?: string; password?: string; identifier?: string }) {
    if (body.password && (body.identifier || body.emailOrPhoneOrCode)) {
      return this.staffLogin({
        identifier: (body.identifier || body.emailOrPhoneOrCode)!,
        password: body.password
      });
    }

    const res = await this.request<{
      token: string;
      staff: {
        id: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
      };
      roles: Array<{ id: string; displayName: string }>;
      permissions: string[];
      outlets: Array<{ outletId: string; isPrimary: boolean }>;
    }>('/staff/login', {
      method: 'POST',
      body
    });

    if (res?.token) {
      this.setStaffToken(res.token);
    }
    return res;
  }


  // Restaurant shift and duty roster operations
  public async getStaffShifts(outletId: string) {
    return this.request<{
      shifts: Array<{
        id: string;
        name: string;
        startTime: string;
        endTime: string;
        isOvernight: boolean;
      }>;
      zones: Array<{
        id: string;
        name: string;
        code: string;
      }>;
    }>(`/outlets/${encodeURIComponent(outletId)}/staff-shifts`);
  }

  public async getDutyRoster(outletId: string, date: string) {
    return this.request<{
      date: string;
      items: Array<{
        id: string;
        staffId: string;
        staffName: string;
        roleId: string;
        shiftId: string | null;
        shiftName: string | null;
        zoneId: string | null;
        zoneName: string | null;
        startsAt: string;
        endsAt: string;
        isLocked: boolean;
      }>;
    }>(`/outlets/${encodeURIComponent(outletId)}/duty-roster`, {
      params: { date }
    });
  }

  public async createDutyRosterAssignment(
    outletId: string,
    body: {
      staffId: string;
      roleId: string;
      shiftId: string;
      zoneId?: string | null;
      date: string;
    }
  ) {
    return this.request<{
      assignment: {
        id: string;
        staffId: string;
        roleId: string;
        shiftId: string;
        zoneId: string | null;
        startsAt: string;
        endsAt: string;
      };
    }>(`/outlets/${encodeURIComponent(outletId)}/duty-roster`, {
      method: 'POST',
      body
    });
  }

  public async listAssignableStaffRoles() {
    return this.request<{
      items: Array<{ id: string; displayName: string }>;
      total: number;
    }>('/staff/assignable-roles');
  }

  public async listStaff(params?: { role?: string }) {
    return await this.request<{
      items: Array<{
        id: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        isActive?: boolean;
        roles: Array<{ id: string; displayName: string }>;
        designationId?: string | null;
        designationName?: string | null;
        outlets?: Array<{ id: string; name: string; isPrimary: boolean }>;
      }>;
    }>('/staff', { params });
  }


  public async assignStaffDesignation(
    staffId: string,
    designationId: string | null
  ) {
    return this.request<{
      item: {
        id: string;
        employee_code: string;
        designationId: string | null;
      };
    }>(`/staff/${encodeURIComponent(staffId)}/designation`, {
      method: 'PATCH',
      body: { designationId }
    });
  }


  public async updateStaffProfile(
    id: string,
    body: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    }
  ) {
    return this.request<{ item: { id: string } }>(
      `/staff/${encodeURIComponent(id)}/profile`,
      { method: 'PATCH', body }
    );
  }

  public async getRoleMaster() {
    return this.request<{
      items: Array<{
        id: string;
        name: string;
        departmentId: string | null;
        departmentName: string | null;
        staffCount: number;
        permissionCount: number;
        isSystemRole: boolean;
      }>;
      departments: Array<{ id: string; name: string }>;
      canManage: boolean;
    }>('/staff/role-master');
  }

  public async addRoleMaster(body: {
    name: string;
    departmentId: string;
  }) {
    return this.request<{ id: string }>('/staff/role-master', {
      method: 'POST', body
    });
  }

  public async editRoleMaster(id: string, body: {
    name: string;
    departmentId: string;
  }) {
    return this.request<{ updated: boolean }>(
      `/staff/role-master/${encodeURIComponent(id)}`,
      { method: 'PATCH', body }
    );
  }

  public async removeRoleMaster(id: string) {
    return this.request<{ deleted: boolean }>(
      `/staff/role-master/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  }

  public async listStaffDesignations() {
    return this.request<{
      items: Array<{
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        staffCount: number;
      }>;
    }>('/staff/designations');
  }

  public async createStaffDesignation(body: { code: string; name: string }) {
    return this.request<{ item: { id: string } }>('/staff/designations', {
      method: 'POST',
      body
    });
  }

  public async deleteStaffDesignation(id: string) {
    return this.request<{ deleted: boolean }>(
      `/staff/designations/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
  }

  public async updateStaffDesignation(
    id: string,
    body: { name?: string; isActive?: boolean }
  ) {
    return this.request<{ item: { id: string } }>(
      `/staff/designations/${encodeURIComponent(id)}`,
      { method: 'PATCH', body }
    );
  }

  public logout(): void {
    this.setStaffToken(null);
  }

  // ==========================================================================
  // 2. OUTLETS & RESTAURANT FLOOR
  // ==========================================================================

  public async listOutlets() {
    return await this.request<{
      items: Array<{
        id: string;
        propertyId: string;
        name: string;
        outletType: string;
        invoiceSeriesPrefix: string;
        isActive: boolean;
        operatingHours: any;
      }>;
    }>('/outlets');
  }

  public async getOutletTables(outletId: string) {
    return await this.request<{
      tables: Array<{
        id: string;
        outletId: string;
        diningZoneId?: string;
        zoneName?: string;
        zoneCode?: string;
        tableNumber: string;
        capacity: number;
        status: string;
        currentWaiterName: string | null;
        currentWaiterStaffId?: string | null;
        activeGuestCount?: number;
        activeSessionId?:string|null;
        isActive: boolean;
        zone?: string;
        activeSession?: {
          id: string;
          guestCount: number;
          customerName: string | null;
          customerPhone: string | null;
          status: string;
          seatedAt: string;
          assignedStaffId: string | null;
          assignedStaffName: string | null;
        } | null;
      }>;
      items: Array<any>;
      total: number;
    }>(`/outlets/${outletId}/tables`);
  }

  public async getTableById(tableId: string) {
    return await this.request(`/tables/${tableId}`);
  }

  // Restaurant dining area management
  public async getDiningZones(outletId: string) {
    return this.request<{
      zones: Array<{
        id: string;
        outletId: string;
        name: string;
        code: string;
      }>;
    }>(`/outlets/${encodeURIComponent(outletId)}/zones`);
  }

  public async createDiningZone(
    outletId: string,
    body: {
      name: string;
      code: string;
      displayOrder?: number;
    }
  ) {
    return this.request<{
      id: string;
      outletId: string;
      name: string;
      code: string;
      displayOrder: number;
      isActive: boolean;
    }>(`/outlets/${encodeURIComponent(outletId)}/zones`, {
      method: 'POST',
      body
    });
  }

  public async createTable(outletId: string, body: {
    tableNumber: string;
    zoneId?: string;
    zoneName?: string;
    capacity?: number;
    status?: string;
    isActive?: boolean;
  }) {
    return await this.request<{
      id: string;
      outletId: string;
      diningZoneId: string;
      zoneName: string;
      zoneCode: string;
      tableNumber: string;
      capacity: number;
      status: string;
      currentWaiterName: string | null;
      currentWaiterStaffId: string | null;
      isActive: boolean;
    }>(`/outlets/${outletId}/tables`, {
      method: 'POST',
      body
    });
  }

  public async updateTable(tableId: string, body: {
    tableNumber?: string;
    zoneId?: string;
    zoneName?: string;
    capacity?: number;
    status?: string;
    isActive?: boolean;
  }) {
    return await this.request<{
      id: string;
      outletId: string;
      diningZoneId: string;
      zoneName: string;
      zoneCode: string;
      tableNumber: string;
      capacity: number;
      status: string;
      currentWaiterName: string | null;
      currentWaiterStaffId: string | null;
      isActive: boolean;
    }>(`/tables/${tableId}`, {
      method: 'PUT',
      body
    });
  }

  public async deleteTable(tableId: string) {
    return await this.request<{ success: boolean; tableId: string }>(`/tables/${tableId}`, {
      method: 'DELETE'
    });
  }

  public async assignTable(tableId: string, body?: { staffId?: string; unassign?: boolean }) {
    return await this.request<{
      success: boolean;
      tableId: string;
      tableNumber: string;
      currentWaiterStaffId: string | null;
      currentWaiterName: string | null;
    }>(`/tables/${tableId}/assign`, {
      method: 'POST',
      body: body || {}
    });
  }

  // ==========================================================================
  // 3. DINING SESSIONS & SEATING
  // ==========================================================================

  public async createDiningSession(body: {
    outletId?: string;
    tableId: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    guestCount: number;
    assignedStaffId?: string;
    notes?: string;
  }) {
    const payload: any = {
      outletId: body.outletId || 'rest-1',
      tableId: body.tableId,
      guestCount: body.guestCount || 2
    };
    if (body.customerPhone) {
      payload.customer = {
        phone: body.customerPhone,
        name: body.customerName,
        email: body.customerEmail
      };
    }
    return await this.request<{
      id: string;
      outletId: string;
      tableId: string;
      guestCount: number;
      customerName: string | null;
      customerPhone: string | null;
      status: string;
      seatedAt?: string;
      openedAt?: string;
      assignedStaffId?: string | null;
    }>('/dining-sessions', {
      method: 'POST',
      body: payload
    });
  }

  public async getDiningSession(sessionId: string) {
    return await this.request(`/dining-sessions/${sessionId}`);
  }

  public async listOutletDiningSessions(outletId: string, params?: { status?: string }) {
    return await this.request<{
      items: Array<any>;
      total: number;
    }>(`/outlets/${outletId}/dining-sessions`, { params });
  }

  public async closeDiningSession(sessionId: string, body?: { notes?: string }) {
    return await this.request(`/dining-sessions/${sessionId}/close`, {
      method: 'POST',
      body
    });
  }

  public async cancelDiningSession(sessionId: string, body?: { reason?: string }) {
    return await this.request(`/dining-sessions/${sessionId}/cancel`, {
      method: 'POST',
      body
    });
  }

  public async getOutletServiceRequests(outletId: string, params?: { status?: string | string[]; limit?: number; cursor?: string }) {
    const queryParams: Record<string, any> = {};
    if (params?.status) {
      queryParams.status = Array.isArray(params.status) ? params.status.join(',') : params.status;
    }
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.cursor) queryParams.cursor = params.cursor;

    return await this.request<{
      items: Array<{
        id: string;
        outletId: string;
        diningSessionId: string;
        tableId: string;
        tableNumber: string;
        requestType: string;
        status: string;
        acknowledgedByStaffId: string | null;
        acknowledgedByName: string | null;
        acknowledgedAt: string | null;
        resolvedAt: string | null;
        createdAt: string;
        guestPhone?: string | null;
      }>;
      total: number;
      nextCursor: string | null;
    }>(`/outlets/${outletId}/service-requests`, { params: queryParams });
  }

  public async acknowledgeServiceRequest(requestId: string) {
    return await this.request(`/service-requests/${requestId}/acknowledge`, {
      method: 'POST'
    });
  }

  public async resolveServiceRequest(requestId: string) {
    return await this.request(`/service-requests/${requestId}/resolve`, {
      method: 'POST'
    });
  }

  public async createGuestServiceRequest(body: { requestType: 'CALL_WAITER' | 'WATER' | 'BILL' | 'CUTLERY' | 'CLEANING' }) {
    return await this.request('/guest/service-requests', {
      method: 'POST',
      body,
      isGuest: true
    });
  }

  public async listGuestServiceRequests() {
    return await this.request<{ items: Array<any> }>('/guest/service-requests', {
      isGuest: true
    });
  }

  // ==========================================================================
  // 4. MENU CATALOG
  // ==========================================================================

  public async getOutletMenu(outletId: string) {
    return this.request<ServerOutletMenuResponse>(`/outlets/${outletId}/menu`);
  }

  public async getMenuCategories() {
    return await this.request<{
      categories: Array<{
        id: string;
        name: string;
        displayOrder: number;
        isActive: boolean;
      }>;
    }>('/menu/categories');
  }

  public async createMenuItem(outletId: string, body: {
    name: string;
    description?: string;
    categoryId: string;
    priceRupees?: number;
    basePricePaise?: number;
    isVegetarian?: boolean;
    isVegan?: boolean;
    isSpicy?: boolean;
    preparationTimeMinutes?: number;
    imageUrl?: string;
    targetKitchenStationCode?: string;
    displayOrder?: number;
  }, options?: { idempotencyKey?: string }) {
    return await this.request<any>(`/outlets/${outletId}/menu/items`, {
      method: 'POST',
      body,
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async updateMenuItem(outletId: string, itemId: string, body: {
    name?: string;
    description?: string;
    categoryId?: string;
    priceRupees?: number;
    basePricePaise?: number;
    isVegetarian?: boolean;
    isVegan?: boolean;
    isSpicy?: boolean;
    preparationTimeMinutes?: number;
    imageUrl?: string;
    targetKitchenStationCode?: string;
    displayOrder?: number;
    isAvailable?: boolean;
    gstRatePercent?: number;
  }, options?: { idempotencyKey?: string }) {
    if (!itemId) throw new Error('Menu item ID is missing. Refresh the menu and retry.');
    return await this.request<any>(`/outlets/${outletId}/menu/items/${itemId}`, {
      method: 'PUT',
      body,
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async toggleMenuItemAvailability(outletId: string, itemId: string, isAvailable?: boolean) {
    if (!itemId) throw new Error('Menu item ID is missing. Refresh the menu and retry.');
    return await this.request<{ itemId: string; outletId: string; isAvailable: boolean }>(
      `/outlets/${outletId}/menu/items/${itemId}/availability`,
      {
        method: 'PATCH',
        body: isAvailable !== undefined ? { isAvailable } : {}
      }
    );
  }

  // ==========================================================================
  // 5. ORDERS & ROUNDS
  // ==========================================================================

  public async createStaffOrder(
    body: {
      outletId: string;
      diningSessionId?: string;
      tableId?: string;
      guestCount?: number;
      items: Array<{
        menuItemId: string;
        quantity: number;
        customizationNotes?: string;
        notes?: string;
        portion?: string;
        selectedPortionLabel?: string;
      }>;
      specialInstructions?: string;
    },
    options?: { idempotencyKey?: string }
  ) {
    return await this.request<{
      id: string;
      outletId: string;
      diningSessionId: string | null;
      orderNumber: number;
      roundNumber: number;
      orderSource: string;
      status: string;
      specialInstructions: string | null;
      subtotalPaise: number;
      taxPaise: number;
      totalPaise: number;
      items: Array<{
        id: string;
        menuItemId: string;
        itemNameSnapshot: string;
        unitPricePaise: number;
        gstRateSnapshot: number;
        quantity: number;
        customizationNotes: string | null;
        status: string;
      }>;
      createdAt: string;
    }>('/orders', {
      method: 'POST',
      body,
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async getOrderById(orderId: string) {
    return await this.request(`/orders/${orderId}`);
  }

  public async listOutletOrders(outletId: string, params?: { status?: string; limit?: number }) {
    return await this.request<{
      orders: Array<any>;
      items?: Array<any>;
      total: number;
    }>(`/outlets/${outletId}/orders`, { params });
  }

  public async listSessionOrders(sessionId: string) {
    return await this.request<{
      orders: Array<any>;
      items?: Array<any>;
      total: number;
    }>(`/dining-sessions/${sessionId}/orders`);
  }

  public async cancelOrder(orderId: string, reason: string) {
    return await this.request(`/orders/${orderId}/cancel`, {
      method: 'POST',
      body: { reason }
    });
  }

  public async updateOrderStatus(orderId: string, toStatus: string) {
    return await this.request(`/orders/${orderId}/status`, {
      method: 'POST',
      body: { status: toStatus }
    });
  }

  // ==========================================================================
  // 6. KITCHEN / KDS
  // ==========================================================================

  public async listOutletKots(outletId: string, params?: { stationId?: string; status?: string }) {
    return await this.request<{
      items: Array<{
        id: string;
        kotNumber: string;
        outletId: string;
        orderId: string;
        stationId: string | null;
        stationName: string | null;
        status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
        tableNumber: string | null;
        roomNumber: string | null;
        orderSource: string;
        createdAt: string;
        items: Array<{
          id: string;
          kotId: string;
          orderItemId: string;
          itemName: string;
          quantity: number;
          customizationNotes: string | null;
          status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
        }>;
      }>;
      total: number;
    }>(`/outlets/${outletId}/kots`, { params });
  }

  public async acceptKot(kotId: string) {
    return await this.request(`/kots/${kotId}/accept`, { method: 'POST' });
  }

  public async startKot(kotId: string) {
    return await this.request(`/kots/${kotId}/start`, { method: 'POST' });
  }

  public async readyKot(kotId: string) {
    return await this.request(`/kots/${kotId}/ready`, { method: 'POST' });
  }

  public async serveKot(kotId: string) {
    return await this.request(`/kots/${kotId}/served`, { method: 'POST' });
  }

  public async cancelKot(kotId: string, reason: string) {
    return await this.request(`/kots/${kotId}/cancel`, {
      method: 'POST',
      body: { reason }
    });
  }

  public async updateKotItemStatus(kotItemId: string, status: string) {
    return await this.request(`/kot-items/${kotItemId}/status`, {
      method: 'POST',
      body: { status }
    });
  }

  public async getKitchenStations(outletId: string) {
    return await this.request<Array<{
      id: string;
      outletId: string;
      name: string;
      code: string;
      displayOrder: number;
      isActive: boolean;
    }>>(`/outlets/${outletId}/kitchen/stations`);
  }

  // ==========================================================================
  // 7. BILLING & PAYMENTS
  // ==========================================================================

  public async createSessionBill(sessionId: string, body?: { notes?: string }) {
    return await this.request<{
      id: string;
      billNumber: string;
      outletId: string;
      diningSessionId: string;
      status: string;
      subtotalPaise: number;
      discountPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      serviceChargePaise: number;
      roundOffPaise: number;
      grandTotalPaise: number;
      paidAmountPaise: number;
      outstandingBalancePaise: number;
      items: Array<any>;
      createdAt: string;
    }>(`/dining-sessions/${sessionId}/bills`, {
      method: 'POST',
      body
    });
  }

  public async previewSessionBill(sessionId: string) {
    return await this.request<{
      diningSessionId: string;
      subtotalPaise: number;
      discountPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      serviceChargePaise: number;
      roundOffPaise: number;
      grandTotalPaise: number;
      items: Array<any>;
    }>(`/dining-sessions/${sessionId}/bill-preview`);
  }

  public async getBillById(billId: string) {
    return await this.request<{
      id: string;
      billNumber: string;
      outletId: string;
      diningSessionId: string;
      status: string;
      subtotalPaise: number;
      discountPaise: number;
      cgstPaise: number;
      sgstPaise: number;
      serviceChargePaise: number;
      roundOffPaise: number;
      grandTotalPaise: number;
      paidAmountPaise: number;
      outstandingBalancePaise: number;
      items: Array<any>;
      payments: Array<any>;
      createdAt: string;
    }>(`/bills/${billId}`);
  }

  public async getSessionBills(sessionId: string) {
    return await this.request<{
      items: Array<any>;
      total: number;
    }>(`/dining-sessions/${sessionId}/bills`);
  }

  public async listOutletBills(outletId: string, params?: { status?: string }) {
    return await this.request<{
      items: Array<any>;
      total: number;
    }>(`/outlets/${outletId}/bills`, { params });
  }

  public async finalizeBill(billId: string, body?: { notes?: string }) {
    return await this.request(`/bills/${billId}/finalize`, {
      method: 'POST',
      body
    });
  }

  public async applyBillDiscount(billId: string, body: {
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    reason: string;
  }) {
    return await this.request(`/bills/${billId}/discount`, {
      method: 'POST',
      body
    });
  }

  public async generateSessionBill(
    sessionId: string,
    body?: { notes?: string },
    options?: { idempotencyKey?: string }
  ) {
    return await this.request<any>(`/dining-sessions/${sessionId}/bills`, {
      method: 'POST',
      body,
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async recordBillPayment(
    billId: string,
    body: {
      amountPaise: number;
      paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'ROOM_FOLIO' | 'COMPLIMENTARY';
      referenceNumber?: string;
      transactionReference?: string;
    },
    options?: { idempotencyKey?: string }
  ) {
    return await this.request<any>(`/bills/${billId}/payments`, {
      method: 'POST',
      body: {
        ...body,
        transactionReference: body.transactionReference || body.referenceNumber
      },
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async settleSessionBill(
    sessionId: string,
    body: {
      paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'ROOM_FOLIO';
      amountPaise?: number;
      transactionReference?: string;
      hotelStayId?: string;
      roomId?: string;
      notes?: string;
    },
    options?: { idempotencyKey?: string }
  ) {
    return await this.request<any>(`/dining-sessions/${sessionId}/settle`, {
      method: 'POST',
      body,
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async getOutletPayments(outletId: string, params?: {
    from?: string;
    to?: string;
    method?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  }) {
    return await this.request<{
      items: Array<{
        id: string;
        billId: string;
        outletId: string;
        billNumber: string;
        tableNumber: string | null;
        tenderMethod: string;
        amountPaise: number;
        status: string;
        processedByStaffId: string;
        processedByName: string;
        transactionReference: string | null;
        createdAt: string;
      }>;
      totalsByMethod: Record<string, number>;
      totalAmountPaise: number;
      total: number;
      nextCursor: string | null;
    }>(`/outlets/${outletId}/payments`, { params: params as any });
  }

  public async createSettlementRequest(
    sessionId: string,
    body?: {
      paymentMethodPreference?: 'CASH' | 'UPI' | 'CARD' | 'ROOM_FOLIO';
      notes?: string;
    }
  ) {
    return await this.request<any>(`/dining-sessions/${sessionId}/settlement-request`, {
      method: 'POST',
      body
    });
  }

  public async listSettlementRequests(
    outletId: string,
    params?: { status?: string; limit?: number }
  ) {
    return await this.request<{
      items: Array<any>;
      total: number;
    }>(`/outlets/${outletId}/settlement-requests`, { params });
  }

  public async updateSettlementRequestStatus(
    requestId: string,
    body: {
      status: 'ACCEPTED' | 'CANCELLED';
      reason?: string;
    }
  ) {
    return await this.request<any>(`/settlement-requests/${requestId}/status`, {
      method: 'POST',
      body
    });
  }

  // ==========================================================================
  // 8. GUEST QR DINING (CUSTOMER PORTAL)
  // ==========================================================================

  public async guestResolveTable(
    paramsOrCode: {
      table?: string;
      tableNumber?: string;
      restaurant?: string;
      outletId?: string;
      qrPublicCode?: string;
      qrSecretToken?: string;
    } | string,
    qrSecretToken?: string
  ) {
    const body = typeof paramsOrCode === 'string'
      ? { qrPublicCode: paramsOrCode, qrSecretToken }
      : paramsOrCode;

    const res = await this.request<{
      tableId: string;
      outletId: string;
      outletName: string;
      zoneName: string;
      tableNumber: string;
      capacity: number;
      status: string;
      hasActiveSession: boolean;
      sessionId: string | null;
      token?: string;
      tokenType?: string;
    }>('/guest/table/resolve', {
      isGuest: true,
      method: 'POST',
      body
    });

    return res;
  }

  public async guestSelfSeat(body: { qrPublicCode: string; qrSecretToken: string; guestCount?: number }) {
    return this.request<{
      token: string; sessionId: string; tableId: string; outletId: string;
      tableNumber: string; openedAt: string; expiresInSeconds: number
    }>('/guest/table/self-seat', { isGuest: true, method: 'POST', body });
  }

  public async guestOpenTable(body: {
    table?: string;
    tableNumber?: string;
    restaurant?: string;
    outletId?: string;
    tableId?: string;
    qrPublicCode?: string;
    guestCount?: number;
  }) {
    return await this.request<{
      success: boolean;
      sessionId: string;
      tableId: string;
      tableNumber: string;
      outletId: string;
      guestCount?: number;
      message: string;
    }>('/guest/table/open', {
      method: 'POST',
      body
    });
  }

  public async guestRequestOtp(body: {
    qrPublicCode: string;
    qrSecretToken: string;
    phone: string;
    name?: string;
  }) {
    return await this.request<{
      success: boolean;
      message: string;
      sessionTokenId: string;
      expiresInSeconds: number;
      devOtp?: string;
    }>('/guest/otp/request', {
      isGuest: true,
      method: 'POST',
      body
    });
  }

  public async guestVerifyOtp(sessionTokenId: string, otp: string) {
    const res = await this.request<{
      token: string;
      tokenType: string;
      expiresInSeconds: number;
    }>('/guest/otp/verify', {
      isGuest: true,
      method: 'POST',
      body: { sessionTokenId, otp }
    });

    if (res.token) {
      this.setGuestToken(res.token);
    }
    return res;
  }

  public async getGuestSession() {
    return this.request<{sessionId:string;tableId:string;outletId:string;tableNumber:string;guestCount:number;status:string;customerName?:string;openedAt:string}>('/guest/session',{isGuest:true});
  }

  public async guestPlaceOrder(
    body: {
      items: Array<{
        menuItemId: string;
        quantity: number;
        customizationNotes?: string;
      }>;
      specialInstructions?: string;
    },
    options?: { idempotencyKey?: string }
  ) {
    return await this.request<{
      id: string;
      orderNumber: number;
      roundNumber: number;
      status: string;
      subtotalPaise: number;
      taxPaise: number;
      totalPaise: number;
      items: Array<any>;
      createdAt: string;
    }>('/guest/orders', {
      method: 'POST',
      body,
      isGuest: true,
      idempotencyKey: options?.idempotencyKey
    });
  }

  public async guestListOrders(params?: { status?: string; limit?: number; offset?: number }) {
    return await this.request<{
      orders?: Array<any>;
      items?: Array<any>;
      total: number;
    }>('/guest/orders', {
      params,
      isGuest: true
    });
  }

  public async guestGetBill(): Promise<any> {
    const res = await this.request<any>('/guest/bill', { isGuest: true });
    return res && res.bill ? res.bill : res;
  }

  public async getGuestBill(): Promise<any> {
    return this.guestGetBill();
  }

  public async guestPayBill(body?: {
    paymentMethod?: string;
    transactionReference?: string;
    notes?: string;
  }): Promise<any> {
    return await this.request<any>('/guest/bill/pay', {
      method: 'POST',
      body: body || {},
      isGuest: true
    });
  }

  public async getGuestMenu(params?: {
    table?: string;
    restaurant?: string;
    outletId?: string;
    qrPublicCode?: string;
  }) {
    return await this.request<{
      outletId: string;
      categories: Array<{ id: string; name: string }>;
      items: Array<{
        id: string;
        category: string;
        categoryId?: string;
        name: string;
        description: string;
        price_paise: number;
        pricePaise?: number;
        is_veg: boolean;
        isVeg?: boolean;
        is_available: boolean;
        isAvailable?: boolean;
        image: string;
        imageUrl?: string;
      }>;
    }>('/guest/menu', {
      params,
      isGuest: true
    });
  }

  public async guestCreateServiceRequest(requestType: 'CALL_WAITER' | 'WATER' | 'BILL' | 'CUTLERY' | 'CLEANING') {
    return await this.request<{
      id: string;
      outletId: string;
      diningSessionId: string;
      tableId: string;
      requestType: string;
      status: string;
      createdAt: string;
    }>('/guest/service-requests', {
      method: 'POST',
      body: { requestType },
      isGuest: true
    });
  }

  public async guestListServiceRequests() {
    return await this.request<{
      items: Array<{
        id: string;
        outletId: string;
        diningSessionId: string;
        tableId: string;
        tableNumber: string;
        requestType: string;
        status: string;
        acknowledgedByStaffId: string | null;
        acknowledgedByName: string | null;
        acknowledgedAt: string | null;
        resolvedAt: string | null;
        createdAt: string;
      }>;
      total: number;
    }>('/guest/service-requests', { isGuest: true });
  }

  // ==========================================================================
  // REPORTS & FINANCIAL AGGREGATIONS
  // ==========================================================================

  public async getOutletReportsSummary(outletId: string, params?: { startDate?: string; endDate?: string }) {
    return await this.request<{
      outletId: string;
      outletName: string;
      currency: string;
      period: {
        startDate: string | null;
        endDate: string | null;
      };
      metrics: {
        totalRevenuePaise: number;
        totalRevenueRupees: number;
        totalCapturedPayments: number;
        subtotalPaise: number;
        subtotalRupees: number;
        discountPaise: number;
        discountRupees: number;
        cgstPaise: number;
        cgstRupees: number;
        sgstPaise: number;
        sgstRupees: number;
        totalTaxPaise: number;
        totalTaxRupees: number;
        roundOffPaise: number;
        billCount: number;
        averageCheckRupees: number;
        totalSessions: number;
        totalCovers: number;
      };
      paymentMethods: Array<{
        method: string;
        count: number;
        totalPaise: number;
        totalRupees: number;
      }>;
      topSellingItems: Array<{
        menuItemId: string;
        name: string;
        category: string;
        quantity: number;
        totalRevenuePaise: number;
        totalRevenueRupees: number;
      }>;
    }>(`/outlets/${outletId}/reports/summary`, { params });
  }

  // ==========================================================================
  // 9. HOTEL PMS (ROOMS, GUESTS, RESERVATIONS, CHECK-IN, STAYS, FOLIOS)
  // ==========================================================================

  public async listHotelRooms(params?: { status?: string; floor?: number; roomTypeId?: string; limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        roomNumber: string;
        roomTypeId: string;
        roomTypeName: string;
        floor: number;
        status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY' | 'CLEANING' | 'INSPECTED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
        basePricePaise: number;
        maxOccupancy: number;
        isActive: boolean;
      }>;
      total: number;
    }>('/hotel/rooms', { params });
  }

  public async getHotelRoom(roomId: string) {
    return await this.request<{
      id: string;
      roomNumber: string;
      roomTypeId: string;
      roomTypeName: string;
      floor: number;
      status: string;
      basePricePaise: number;
      maxOccupancy: number;
      isActive: boolean;
    }>(`/hotel/rooms/${roomId}`);
  }

  public async updateHotelRoomStatus(roomId: string, status: string, reason?: string) {
    return await this.request<{
      id: string;
      roomNumber: string;
      status: string;
    }>(`/hotel/rooms/${roomId}/status`, {
      method: 'PATCH',
      body: { status, reason }
    });
  }

  public async listHotelGuests(params?: { search?: string; limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        firstName: string;
        lastName: string | null;
        phone: string;
        email: string | null;
        vipStatus: boolean;
      }>;
      total: number;
    }>('/hotel/guests', { params });
  }

  public async getHotelGuest(guestId: string) {
    return await this.request<{
      id: string;
      firstName: string;
      lastName: string | null;
      phone: string;
      email: string | null;
      vipStatus: boolean;
      totalStays: number;
    }>(`/hotel/guests/${guestId}`);
  }

  public async createHotelGuest(body: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    idProofType?: string;
    idProofNumber?: string;
    address?: string;
  }) {
    return await this.request<{
      id: string;
      firstName: string;
      lastName: string | null;
      phone: string;
      email: string | null;
    }>('/hotel/guests', {
      method: 'POST',
      body
    });
  }

  public async listHotelReservations(params?: { status?: string; search?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        bookingReference: string;
        guestId: string;
        guestName: string;
        guestPhone: string;
        roomId: string | null;
        roomNumber: string | null;
        roomTypeName: string;
        checkInDate: string;
        checkOutDate: string;
        adultsCount: number;
        childrenCount: number;
        status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
        specialRequests: string | null;
        createdAt: string;
      }>;
      total: number;
    }>('/hotel/reservations', { params });
  }

  public async getHotelReservation(reservationId: string) {
    return await this.request<{
      id: string;
      bookingReference: string;
      guestId: string;
      guestName: string;
      guestPhone: string;
      guestEmail: string | null;
      roomId: string | null;
      roomNumber: string | null;
      roomTypeId: string;
      roomTypeName: string;
      checkInDate: string;
      checkOutDate: string;
      adultsCount: number;
      childrenCount: number;
      status: string;
      specialRequests: string | null;
      createdAt: string;
    }>(`/hotel/reservations/${reservationId}`);
  }

  public async createHotelReservation(body: {
    guestId?: string;
    guestData?: {
      firstName: string;
      lastName?: string;
      phone: string;
      email?: string;
      idProofType?: string;
      idProofNumber?: string;
    };
    roomTypeId?: string;
    roomId?: string;
    checkInDate: string;
    checkOutDate: string;
    adultsCount: number;
    childrenCount?: number;
    specialRequests?: string;
  }) {
    return await this.request<{
      id: string;
      bookingReference: string;
      guestId: string;
      roomId: string | null;
      roomTypeName: string;
      checkInDate: string;
      checkOutDate: string;
      status: string;
    }>('/hotel/reservations', {
      method: 'POST',
      body
    });
  }

  public async cancelHotelReservation(reservationId: string) {
    return await this.request<{
      id: string;
      status: 'CANCELLED';
      bookingReference: string;
    }>(`/hotel/reservations/${reservationId}/cancel`, {
      method: 'POST'
    });
  }

  public async checkInHotelGuest(body: {
    reservationId?: string;
    roomId: string;
    guestId?: string;
    guestData?: {
      firstName: string;
      lastName?: string;
      phone: string;
      email?: string;
      idProofType?: string;
      idProofNumber?: string;
    };
    checkOutDate: string;
    adultsCount?: number;
    childrenCount?: number;
    initialDepositPaise?: number;
  }) {
    return await this.request<{
      stay: {
        id: string;
        roomId: string;
        roomNumber: string;
        guestId: string;
        guestName: string;
        checkInTime: string;
        expectedCheckOutTime: string;
        status: 'ACTIVE' | 'CHECKED_OUT' | 'EXTENDED';
      };
      folio: {
        id: string;
        folioNumber: string;
        status: 'OPEN' | 'CLOSED';
        totalChargesPaise: number;
        totalCreditsPaise: number;
        balancePaise: number;
      };
    }>('/hotel/check-in', {
      method: 'POST',
      body
    });
  }

  public async listHotelStays(params?: { status?: string; roomId?: string; limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        roomId: string;
        roomNumber: string;
        guestId: string;
        guestName: string;
        guestPhone: string;
        checkInTime: string;
        expectedCheckOutTime: string;
        actualCheckOutTime: string | null;
        status: 'ACTIVE' | 'CHECKED_OUT' | 'EXTENDED';
        folioId: string;
        folioNumber: string;
        folioStatus: string;
        folioBalancePaise: number;
      }>;
      total: number;
    }>('/hotel/stays', { params });
  }

  public async getHotelStay(stayId: string) {
    return await this.request<{
      id: string;
      roomId: string;
      roomNumber: string;
      guestId: string;
      guestName: string;
      guestPhone: string;
      guestEmail: string | null;
      checkInTime: string;
      expectedCheckOutTime: string;
      actualCheckOutTime: string | null;
      status: string;
      folio: {
        id: string;
        folioNumber: string;
        status: string;
        totalChargesPaise: number;
        totalCreditsPaise: number;
        balancePaise: number;
      };
    }>(`/hotel/stays/${stayId}`);
  }

  public async getHotelStayByRoom(roomId: string) {
    return await this.request<{
      id: string;
      roomId: string;
      roomNumber: string;
      guestId: string;
      guestName: string;
      checkInTime: string;
      expectedCheckOutTime: string;
      status: string;
      folioId: string;
      folioBalancePaise: number;
    }>(`/hotel/rooms/${roomId}/stay`);
  }

  public async getHotelStayFolio(stayId: string) {
    return await this.request<{
      id: string;
      stayId: string;
      folioNumber: string;
      status: string;
      totalChargesPaise: number;
      totalCreditsPaise: number;
      balancePaise: number;
      charges: Array<{
        id: string;
        chargeType: string;
        amountPaise: number;
        description: string;
        postedAt: string;
      }>;
      payments: Array<{
        id: string;
        amountPaise: number;
        paymentMethod: string;
        postedAt: string;
      }>;
    }>(`/hotel/stays/${stayId}/folio`);
  }

  public async getHotelFolio(folioId: string) {
    return await this.request<{
      id: string;
      stayId: string;
      folioNumber: string;
      status: string;
      totalChargesPaise: number;
      totalCreditsPaise: number;
      balancePaise: number;
      charges: Array<any>;
      payments: Array<any>;
    }>(`/hotel/folios/${folioId}`);
  }

  public async postHotelFolioCharge(folioId: string, body: {
    chargeType: 'ROOM_TARIFF' | 'ROOM_SERVICE' | 'LAUNDRY' | 'MINIBAR' | 'DAMAGE' | 'OTHER';
    amountPaise: number;
    description: string;
    referenceId?: string;
  }) {
    return await this.request<{
      id: string;
      folioId: string;
      chargeType: string;
      amountPaise: number;
      description: string;
      postedAt: string;
    }>(`/hotel/folios/${folioId}/charges`, {
      method: 'POST',
      body
    });
  }

  public async checkOutHotelStay(stayId: string, body?: { notes?: string }) {
    return await this.request<{
      stayId: string;
      status: 'CHECKED_OUT';
      checkOutTime: string;
      folioStatus: 'CLOSED';
    }>(`/hotel/stays/${stayId}/checkout`, {
      method: 'POST',
      body
    });
  }

  public async createRoomServiceOrder(body: {
    stayId: string;
    outletId: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      customizationNotes?: string;
    }>;
    specialInstructions?: string;
  }) {
    return await this.request<{
      id: string;
      orderNumber: number;
      status: string;
      subtotalPaise: number;
      taxPaise: number;
      totalPaise: number;
      roomNumber: string;
      items: Array<any>;
    }>('/orders/room-service', {
      method: 'POST',
      body
    });
  }

  // ==========================================================================
  // 10. HOUSEKEEPING & MAINTENANCE
  // ==========================================================================

  public async listHousekeepingTasks(params?: { status?: string; taskType?: string; assignedStaffId?: string; limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        roomId: string;
        roomNumber: string;
        floor: number;
        taskType: 'DAILY_CLEAN' | 'CHECKOUT_TURNOVER' | 'DEEP_CLEAN' | 'TOUCH_UP';
        priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
        status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'INSPECTED';
        assignedStaffId: string | null;
        assignedStaffName: string | null;
        notes: string | null;
        createdAt: string;
      }>;
      total: number;
    }>('/housekeeping/tasks', { params });
  }

  public async getHousekeepingTask(taskId: string) {
    return await this.request<{
      id: string;
      roomId: string;
      roomNumber: string;
      taskType: string;
      priority: string;
      status: string;
      assignedStaffId: string | null;
      assignedStaffName: string | null;
      notes: string | null;
      startedAt: string | null;
      completedAt: string | null;
      inspectedAt: string | null;
    }>(`/housekeeping/tasks/${taskId}`);
  }

  public async createHousekeepingTask(body: {
    roomId: string;
    taskType: 'DAILY_CLEAN' | 'CHECKOUT_TURNOVER' | 'DEEP_CLEAN' | 'TOUCH_UP';
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    notes?: string;
  }) {
    return await this.request<{
      id: string;
      roomId: string;
      taskType: string;
      status: 'PENDING';
    }>('/housekeeping/tasks', {
      method: 'POST',
      body
    });
  }

  public async assignHousekeepingTask(taskId: string, assignedStaffId: string) {
    return await this.request(`/housekeeping/tasks/${taskId}/assign`, {
      method: 'POST',
      body: { assignedStaffId }
    });
  }

  public async startHousekeepingTask(taskId: string) {
    return await this.request(`/housekeeping/tasks/${taskId}/start`, {
      method: 'POST'
    });
  }

  public async completeHousekeepingTask(taskId: string, notes?: string) {
    return await this.request(`/housekeeping/tasks/${taskId}/complete`, {
      method: 'POST',
      body: { notes }
    });
  }

  public async inspectHousekeepingTask(taskId: string, body: { passed: boolean; notes?: string }) {
    return await this.request(`/housekeeping/tasks/${taskId}/inspect`, {
      method: 'POST',
      body
    });
  }

  public async getHotelRoomHistory(roomId: string, params?: { limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        roomId: string;
        fromStatus: string | null;
        toStatus: string;
        changedByStaffName: string | null;
        reason: string | null;
        createdAt: string;
      }>;
      total: number;
    }>(`/hotel/rooms/${roomId}/history`, { params });
  }

  public async listMaintenanceIssues(params?: { status?: string; severity?: string; category?: string; roomId?: string; limit?: number; offset?: number }) {
    return await this.request<{
      items: Array<{
        id: string;
        roomId: string | null;
        roomNumber: string | null;
        outletId: string | null;
        title: string;
        description: string;
        category: 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'CARPENTRY' | 'APPLIANCE' | 'STRUCTURAL' | 'OTHER';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        status: 'REPORTED' | 'IN_REPAIR' | 'RESOLVED';
        reportedByName: string | null;
        createdAt: string;
      }>;
      total: number;
    }>('/maintenance/issues', { params });
  }

  public async getMaintenanceIssue(issueId: string) {
    return await this.request<{
      id: string;
      roomId: string | null;
      roomNumber: string | null;
      title: string;
      description: string;
      category: string;
      severity: string;
      status: string;
      reportedByName: string | null;
      assignedToName: string | null;
      resolutionNotes: string | null;
      resolvedAt: string | null;
      createdAt: string;
    }>(`/maintenance/issues/${issueId}`);
  }

  public async reportMaintenanceIssue(body: {
    roomId?: string;
    outletId?: string;
    title: string;
    description: string;
    category: 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'CARPENTRY' | 'APPLIANCE' | 'STRUCTURAL' | 'OTHER';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }) {
    return await this.request<{
      id: string;
      title: string;
      status: 'REPORTED';
      severity: string;
    }>('/maintenance/issues', {
      method: 'POST',
      body
    });
  }

  public async startMaintenanceRepair(issueId: string) {
    return await this.request(`/maintenance/issues/${issueId}/start-repair`, {
      method: 'POST'
    });
  }

  public async resolveMaintenanceIssue(issueId: string, body: { resolutionNotes: string }) {
    return await this.request(`/maintenance/issues/${issueId}/resolve`, {
      method: 'POST',
      body
    });
  }

  // ==========================================================================
  // 11. INVENTORY & RECIPES / BOM (DOMAIN M)
  // ==========================================================================

  public async listInventoryItems(params?: {
    category?: string;
    isActive?: boolean;
    belowReorderLevel?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.request<{
      items: Array<{
        id: string;
        itemCode: string;
        name: string;
        category: string;
        unitOfMeasure: string;
        reorderLevel: number;
        unitCostPaise: number;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
    }>('/inventory/items', { params });
  }

  public async getInventoryItem(itemId: string) {
    return await this.request<{
      id: string;
      itemCode: string;
      name: string;
      category: string;
      unitOfMeasure: string;
      reorderLevel: number;
      unitCostPaise: number;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/inventory/items/${itemId}`);
  }

  public async createInventoryItem(body: {
    itemCode: string;
    name: string;
    category: 'FOOD_GRAINS' | 'DAIRY' | 'MEAT' | 'LIQUOR' | 'BEVERAGES' | 'CLEANING' | 'LINEN' | 'OTHER';
    unitOfMeasure: string;
    reorderLevel?: number;
    unitCostPaise?: number;
    isActive?: boolean;
  }) {
    return await this.request<{
      id: string;
      itemCode: string;
      name: string;
      category: string;
      unitOfMeasure: string;
      reorderLevel: number;
      unitCostPaise: number;
      isActive: boolean;
    }>('/inventory/items', {
      method: 'POST',
      body
    });
  }

  public async updateInventoryItem(itemId: string, body: {
    itemCode?: string;
    name?: string;
    category?: string;
    unitOfMeasure?: string;
    reorderLevel?: number;
    unitCostPaise?: number;
    isActive?: boolean;
  }) {
    return await this.request<{
      id: string;
      itemCode: string;
      name: string;
      category: string;
      unitOfMeasure: string;
      reorderLevel: number;
      unitCostPaise: number;
      isActive: boolean;
    }>(`/inventory/items/${itemId}`, {
      method: 'PATCH',
      body
    });
  }

  public async listInventoryLocations(params?: {
    outletId?: string;
    isCentral?: boolean;
    isActive?: boolean;
  }) {
    return await this.request<{
      items: Array<{
        id: string;
        name: string;
        outletId: string | null;
        isCentral: boolean;
        isActive: boolean;
      }>;
      total: number;
    }>('/inventory/locations', { params });
  }

  public async getInventoryLocation(locationId: string) {
    return await this.request<{
      id: string;
      name: string;
      outletId: string | null;
      isCentral: boolean;
      isActive: boolean;
    }>(`/inventory/locations/${locationId}`);
  }

  public async listInventoryBalances(params?: {
    locationId?: string;
    outletId?: string;
    itemId?: string;
    category?: string;
    belowReorderLevel?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return await this.request<{
      items: Array<{
        id: string;
        itemId: string;
        locationId: string;
        currentQuantity: number;
        itemName?: string;
        itemCode?: string;
        category?: string;
        unitOfMeasure?: string;
        reorderLevel?: number;
        unitCostPaise?: number;
        locationName?: string;
      }>;
      total: number;
    }>('/inventory/balances', { params });
  }

  public async getItemBalances(itemId: string) {
    return await this.request<{
      items: Array<{
        id: string;
        itemId: string;
        locationId: string;
        currentQuantity: number;
        locationName?: string;
      }>;
      total: number;
    }>(`/inventory/items/${itemId}/balances`);
  }

  public async createStockMovement(body: {
    itemId: string;
    locationId: string;
    movementType: 'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT' | 'WASTAGE' | 'RETURN';
    quantity: number;
    referenceDocument?: string;
    notes?: string;
  }) {
    return await this.request<{
      id: string;
      itemId: string;
      locationId: string;
      movementType: string;
      quantity: number;
      referenceDocument?: string;
      notes?: string;
      createdAt: string;
    }>('/inventory/movements', {
      method: 'POST',
      body
    });
  }

  public async createStockTransfer(body: {
    itemId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
    referenceDocument?: string;
    notes?: string;
  }) {
    return await this.request<{
      transferGroupId: string;
      outwardMovementId: string;
      inwardMovementId: string;
      itemId: string;
      sourceLocationId: string;
      destinationLocationId: string;
      quantity: number;
    }>('/inventory/transfers', {
      method: 'POST',
      body
    });
  }

  public async listRecipes(params?: {
    menuItemId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.request<{
      items: Array<{
        id: string;
        menuItemId: string;
        menuItemName?: string;
        name: string;
        yieldServings: number;
        createdAt: string;
        ingredients?: Array<{
          id: string;
          inventoryItemId: string;
          inventoryItemName?: string;
          quantityRequired: number;
          unitOfMeasure: string;
        }>;
      }>;
      total: number;
    }>('/recipes', { params });
  }

  public async getRecipe(recipeId: string) {
    return await this.request<{
      id: string;
      menuItemId: string;
      menuItemName?: string;
      name: string;
      yieldServings: number;
      createdAt: string;
      ingredients: Array<{
        id: string;
        inventoryItemId: string;
        inventoryItemName?: string;
        quantityRequired: number;
        unitOfMeasure: string;
      }>;
    }>(`/recipes/${recipeId}`);
  }

  public async getRecipeByMenuItem(menuItemId: string) {
    return await this.request<{
      id: string;
      menuItemId: string;
      name: string;
      yieldServings: number;
      createdAt: string;
      ingredients: Array<{
        id: string;
        inventoryItemId: string;
        inventoryItemName?: string;
        quantityRequired: number;
        unitOfMeasure: string;
      }>;
    }>(`/menu-items/${menuItemId}/recipe`);
  }

  public async createRecipe(body: {
    menuItemId: string;
    name: string;
    yieldServings?: number;
    ingredients?: Array<{
      inventoryItemId: string;
      quantityRequired: number;
      unitOfMeasure: string;
    }>;
  }) {
    return await this.request<{
      id: string;
      menuItemId: string;
      name: string;
      yieldServings: number;
    }>('/recipes', {
      method: 'POST',
      body
    });
  }

  public async updateRecipe(recipeId: string, body: {
    name?: string;
    yieldServings?: number;
  }) {
    return await this.request<{
      id: string;
      menuItemId: string;
      name: string;
      yieldServings: number;
    }>(`/recipes/${recipeId}`, {
      method: 'PATCH',
      body
    });
  }

  public async addRecipeIngredient(recipeId: string, body: {
    inventoryItemId: string;
    quantityRequired: number;
    unitOfMeasure: string;
  }) {
    return await this.request<{
      id: string;
      recipeId: string;
      inventoryItemId: string;
      quantityRequired: number;
      unitOfMeasure: string;
    }>(`/recipes/${recipeId}/ingredients`, {
      method: 'POST',
      body
    });
  }

  public async updateRecipeIngredient(recipeId: string, ingredientId: string, body: {
    quantityRequired?: number;
    unitOfMeasure?: string;
  }) {
    return await this.request<{
      id: string;
      recipeId: string;
      inventoryItemId: string;
      quantityRequired: number;
      unitOfMeasure: string;
    }>(`/recipes/${recipeId}/ingredients/${ingredientId}`, {
      method: 'PATCH',
      body
    });
  }

  public async removeRecipeIngredient(recipeId: string, ingredientId: string) {
    return await this.request(`/recipes/${recipeId}/ingredients/${ingredientId}`, {
      method: 'DELETE'
    });
  }

  // ==========================================================================
  // Super Admin Controls: Module Access & Roster
  // ==========================================================================

  public async listCanonicalModules() {
    return await this.request<{
      modules: Array<{
        id: string;
        name: string;
        description: string;
        viewPermissions: string[];
        editPermissions: string[];
      }>;
    }>('/super-admin/modules');
  }

  public async getStaffModuleAccess(staffId: string, outletId?: string) {
    const query = outletId ? `?outletId=${encodeURIComponent(outletId)}` : '';
    return await this.request<{
      staff: {
        id: string;
        employeeCode: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        isActive: boolean;
      };
      roles: Array<{ id: string; displayName: string }>;
      outletId: string | null;
      modules: Array<{
        id: string;
        name: string;
        description: string;
        roleBaseline: { canView: boolean; canEdit: boolean };
        override: { canView: boolean; canEdit: boolean } | null;
        effective: { canView: boolean; canEdit: boolean };
      }>;
    }>(`/super-admin/module-access/${staffId}${query}`);
  }

  public async updateStaffModuleAccess(staffId: string, body: {
    outletId?: string | null;
    modules: Array<{
      module: string;
      canView: boolean;
      canEdit: boolean;
    }>;
  }) {
    return await this.request<{
      success: boolean;
      message: string;
      staffId: string;
      outletId: string | null;
      appliedCount: number;
    }>(`/super-admin/module-access/${staffId}`, {
      method: 'PUT',
      body
    });
  }

  public async listSuperAdminUsers(filters?: {
    role?: string;
    isActive?: 'true' | 'false' | 'all';
    search?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.role && filters.role !== 'all') params.append('role', filters.role);
    if (filters?.isActive && filters.isActive !== 'all') params.append('isActive', filters.isActive);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.request<{ users: SuperAdminUserItem[] }>(`/super-admin/users${query}`);
  }

  public async createSuperAdminUser(body: CreateSuperAdminUserPayload) {
    return await this.request<{ user: SuperAdminUserItem }>('/super-admin/users', {
      method: 'POST',
      body
    });
  }

  public async updateSuperAdminUser(id: string, body: UpdateSuperAdminUserPayload) {
    return await this.request<{ user: SuperAdminUserItem }>(`/super-admin/users/${id}`, {
      method: 'PATCH',
      body
    });
  }

  public async deactivateSuperAdminUser(id: string) {
    return await this.request<{ success: boolean; message: string; id: string; isActive: boolean }>(
      `/super-admin/users/${id}/deactivate`,
      { method: 'POST' }
    );
  }

  public async reactivateSuperAdminUser(id: string) {
    return await this.request<{ success: boolean; message: string; id: string; isActive: boolean }>(
      `/super-admin/users/${id}/reactivate`,
      { method: 'POST' }
    );
  }

  public async resetSuperAdminUserPassword(id: string, password: string) {
    return await this.request<{ success: boolean; message: string; id: string }>(
      `/super-admin/users/${id}/reset-password`,
      {
        method: 'POST',
        body: { password }
      }
    );
  }

  // ==========================================================================
  // PHASE 3: SUPER ADMIN OUTLET MANAGEMENT
  // ==========================================================================

  public async listSuperAdminOutlets(filters?: {
    isActive?: 'true' | 'false' | 'all';
    search?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.isActive && filters.isActive !== 'all') params.append('isActive', filters.isActive);
    if (filters?.search) params.append('search', filters.search);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.request<{ outlets: SuperAdminOutletItem[] }>(`/super-admin/outlets${query}`);
  }

  public async createSuperAdminOutlet(body: CreateSuperAdminOutletPayload) {
    return await this.request<{ outlet: SuperAdminOutletItem }>('/super-admin/outlets', {
      method: 'POST',
      body
    });
  }

  public async updateSuperAdminOutlet(id: string, body: UpdateSuperAdminOutletPayload) {
    return await this.request<{ outlet: SuperAdminOutletItem }>(`/super-admin/outlets/${id}`, {
      method: 'PATCH',
      body
    });
  }

  public async deactivateSuperAdminOutlet(id: string) {
    return await this.request<{ success: boolean; message: string; id: string }>(
      `/super-admin/outlets/${id}/deactivate`,
      { method: 'POST' }
    );
  }

  public async reactivateSuperAdminOutlet(id: string) {
    return await this.request<{ success: boolean; message: string; id: string }>(
      `/super-admin/outlets/${id}/reactivate`,
      { method: 'POST' }
    );
  }
}

export interface SuperAdminUserItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
  isLocked: boolean;
  passwordFailedAttempts: number;
  passwordLockedUntil: string | null;
  roles: Array<{ id: string; displayName: string }>;
  outlets: Array<{ id: string; name: string; isPrimary: boolean }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSuperAdminUserPayload {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  password: string;
  outletId?: string;
}

export interface UpdateSuperAdminUserPayload {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  roleId?: string;
  outletId?: string;
}

export interface SuperAdminOutletItem {
  id: string;
  propertyId: string;
  name: string;
  outletType: string;
  invoiceSeriesPrefix: string;
  isActive: boolean;
  operatingHours: {
    opens: string;
    closes: string;
  };
  createdAt: string;
  updatedAt?: string;
  tablesCount: number;
  stationsCount: number;
  activeSessionsCount: number;
}

export interface CreateSuperAdminOutletPayload {
  id?: string;
  name: string;
  outletType: string;
  invoiceSeriesPrefix: string;
  operatingHours?: {
    opens: string;
    closes: string;
  };
}

export interface UpdateSuperAdminOutletPayload {
  name?: string;
  outletType?: string;
  invoiceSeriesPrefix?: string;
  operatingHours?: {
    opens: string;
    closes: string;
  };
}

export const api = new ApiClient();


