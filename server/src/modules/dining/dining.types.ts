export type TableOperationalStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'BILLED'
  | 'CLEANING'
  | 'OUT_OF_SERVICE';

export type DiningSessionStatus = 'ACTIVE' | 'BILLED' | 'CLOSED' | 'CANCELLED';

export type ServiceRequestType = 'CALL_WAITER' | 'WATER' | 'BILL' | 'CUTLERY' | 'CLEANING';

export type ServiceRequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';

export interface FloorTable {
  activeSessionId?:string|null;
  id: string;
  outletId: string;
  diningZoneId: string;
  zoneName: string;
  zoneCode: string;
  tableNumber: string;
  capacity: number;
  status: TableOperationalStatus;
  currentWaiterName: string | null;
  currentWaiterStaffId?: string | null;
  activeGuestCount?: number;
  isActive: boolean;
}

export interface TableDetailResponse {
  id: string;
  outletId: string;
  zoneId: string;
  zoneName: string;
  zoneCode: string;
  tableNumber: string;
  capacity: number;
  status: TableOperationalStatus;
  currentWaiterStaffId: string | null;
  currentWaiterName: string | null;
  activeSessionId: string | null;
  activeSession?: {
    id: string;
    guestCount: number;
    status: DiningSessionStatus;
    openedAt: string;
    customerName?: string | null;
  } | null;
  isActive: boolean;
}

export interface DiningSessionDetailResponse {
  id: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  customerId: string | null;
  customer?: {
    id: string;
    name: string | null;
    phone: string; // Sanitized/Masked
    email: string | null;
  } | null;
  guestCount: number;
  status: DiningSessionStatus;
  hotelStayId?: string | null;
  openedAt: string;
  closedAt: string | null;
  activeServiceRequests?: ServiceRequestResponse[];
}

export interface ServiceRequestResponse {
  id: string;
  outletId: string;
  diningSessionId: string;
  tableId: string;
  tableNumber: string;
  requestType: ServiceRequestType;
  status: ServiceRequestStatus;
  acknowledgedByStaffId: string | null;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  guestPhone?: string | null;
}

export interface QrResolveResponse {
  tableId: string;
  outletId: string;
  outletName: string;
  zoneId: string;
  zoneName: string;
  tableNumber: string;
  capacity: number;
  status: TableOperationalStatus;
  hasActiveSession: boolean;
  sessionId: string | null;
  token?: string;
  tokenType?: 'Bearer';
}

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  sessionTokenId: string;
  expiresInSeconds: number;
  devOtp?: string;
}

export interface OtpVerifyResponse {
  token: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
}

export interface GuestSessionSummaryResponse {
  sessionId: string;
  outletId: string;
  tableId: string;
  tableNumber: string;
  guestCount: number;
  status: DiningSessionStatus;
  customerName?: string | null;
  openedAt: string;
}
