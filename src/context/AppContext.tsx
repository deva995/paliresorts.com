import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  UserRole,
  Restaurant,
  DiningReservation,
  RestaurantTable,
  MenuItem,
  MenuCategory,
  Order,
  OrderItem,
  KitchenTicket,
  KitchenTicketStatus,
  Room,
  Reservation,
  Guest,
  HousekeepingTask,
  MaintenanceRequest,
  InventoryItem,
  InventoryLocation,
  InventoryBalance,
  Recipe,
  RecipeIngredient,
  PurchaseOrder,
  WasteRecord,
  Employee,
  CustomerProfile,
  Review,
  Complaint,
  PaymentTransaction,
  AuditLog,
  AppNotification,
  WaiterRequest,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  RoomStatus,
  TableStatus,
  TableBill,
  CustomerDiningSession,
  OTPVerificationRequest,
  QRDiningContext,
  ProductionEvent,
  AggregatedProductionItem,
  SettlementRequest
} from '../types';
import {
  aggregateProductionItems,
  allocatePrepareQuantity,
  allocateReadyQuantity,
  allocateCompleteQuantity,
  allocateRecallQuantity,
  getOfflineEvents,
  saveOfflineEvents,
  getProcessedEventIds,
  markEventIdProcessed
} from '../utils/productionAggregator';
import {
  validateIndianMobile,
  maskMobileNumber,
  OTP_EXPIRATION_MS,
  OTP_MAX_ATTEMPTS,
  isDevelopmentMode
} from '../utils/otpAuth';

import {
  DEMO_USERS,
  INITIAL_RESTAURANTS,
  INITIAL_DINING_RESERVATIONS,
  INITIAL_MENU_ITEMS,
  INITIAL_TABLES,
  INITIAL_ORDERS,
  INITIAL_KITCHEN_TICKETS,
  INITIAL_ROOMS,
  INITIAL_RESERVATIONS,
  INITIAL_GUESTS,
  INITIAL_HOUSEKEEPING_TASKS,
  INITIAL_MAINTENANCE,
  INITIAL_INVENTORY,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_WASTE_RECORDS,
  INITIAL_EMPLOYEES,
  INITIAL_CUSTOMERS,
  INITIAL_REVIEWS,
  INITIAL_COMPLAINTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_NOTIFICATIONS
} from '../data/mockData';
import { guestQrContext } from '../utils/guestQrContext';
import {staffLoadPlan,StaffLoadCoordinator,scopedStaffApi} from '../utils/staffDataLoading';
import { checkRouteAccess, getDefaultDashboardRoute, getRoleLabel, selectPrimaryRole } from '../utils/rbac';
import { enqueueOfflineAction } from '../utils/offlineSync';
import { convertOutletMenuResponse } from '../api/menuAdapter';
import { api, generateIdempotencyKey } from '../api/client';

interface AppContextType {
  currentUser: User;
  isAuthenticated: boolean;
  authRole: UserRole | null;
  isAuthLoading: boolean;
  effectiveRole: UserRole;
  previewRole: UserRole | null;
  exitPreviewRole: () => void;
  currentRoute: string;
  pushRoute: (path: string) => void;
  login: (emailOrPhone: string, password?: string, roleHint?: UserRole) => Promise<{ success: boolean; error?: string; unlockAt?: string; user?: User }>;
  switchRole: (role: UserRole) => void;
  logout: () => void;

  // Restaurant & Menu
  restaurants: Restaurant[];
  activeRestaurantId: string;
  activeRestaurant: Restaurant;
  switchRestaurant: (id: string) => void;
  addRestaurant: (res: Omit<Restaurant, 'id' | 'createdAt'>) => void;

  tables: RestaurantTable[];
  diningZones: Array<{id:string;name:string;code:string}>;
  floorStaff: Array<{id:string;name:string}>;
  deactivateTable: (id:string) => Promise<void>;
  menuItems: MenuItem[];
  menuCategories: MenuCategory[];
  orders: Order[];
  kitchenTickets: KitchenTicket[];
  waiterRequests: WaiterRequest[];
  diningReservations: DiningReservation[];
  restaurantSyncError: string | null;
  refreshRestaurantData: (outletId?: string) => Promise<void>;

  // Hotel & Rooms
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];

  // Operations
  housekeepingTasks: HousekeepingTask[];
  maintenanceRequests: MaintenanceRequest[];
  inventory: InventoryItem[];
  inventoryLocations: InventoryLocation[];
  inventoryBalances: InventoryBalance[];
  recipes: Recipe[];
  purchaseOrders: PurchaseOrder[];
  wasteRecords: WasteRecord[];
  refreshInventoryData: () => Promise<void>;
  createStockTransfer: (itemId: string, sourceLocationId: string, destinationLocationId: string, quantity: number, notes?: string) => Promise<{ success: boolean; error?: string }>;
  createRecipe: (menuItemId: string, name: string, yieldServings?: number, ingredients?: any[]) => Promise<{ success: boolean; error?: string }>;
  updateRecipe: (recipeId: string, name?: string, yieldServings?: number) => Promise<{ success: boolean; error?: string }>;
  addRecipeIngredient: (recipeId: string, inventoryItemId: string, quantityRequired: number, unitOfMeasure: string) => Promise<{ success: boolean; error?: string }>;
  removeRecipeIngredient: (recipeId: string, ingredientId: string) => Promise<{ success: boolean; error?: string }>;

  // HR & CRM
  employees: Employee[];
  refreshStaffData: () => Promise<void>;
  customers: CustomerProfile[];
  reviews: Review[];
  complaints: Complaint[];

  // Finance & System
  payments: PaymentTransaction[];
  auditLogs: AuditLog[];
  notifications: AppNotification[];

  // Interactive Actions
  addOrder: (order: Partial<Order>) => string;
  createRestaurantOrder: (order: Partial<Order>, key:string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<{success:boolean;error?:string}>;
  updateOrderItemStatus: (orderId: string, itemId: string, status: OrderItem['status']) => Promise<{success:boolean;error?:string}>;
  settlePayment: (orderId: string, method: PaymentMethod, amount: number) => void;
  updateKitchenTicketStatus: (ticketId: string, status: KitchenTicketStatus) => Promise<{ success: boolean; error?: string }>;
  updateKitchenItemStatus: (ticketId: string, itemId: string, completed: boolean) => Promise<{ success: boolean; error?: string }>;
  recallKitchenTicket: (ticketId: string) => void;
  cancelKitchenTicket: (ticketId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  updateTableStatus: (tableId: string, status: TableStatus) => Promise<{success:boolean;error?:string}>;
  selfAssignTable: (tableIdOrNumber: string) => Promise<{ success: boolean; error?: string; table?: RestaurantTable }>;
  unassignTable: (tableIdOrNumber: string) => Promise<{ success: boolean; error?: string }>;
  assignTableToWaiter: (tableIdOrNumber: string, waiterName: string, waiterId: string) => Promise<{ success: boolean; error?: string }>;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<{ pendingRevisionId?: string }>;
  toggleMenuItemAvailability: (id: string) => Promise<void>;
  updateMenuItemPricing: (id: string, price: number, taxRate?: number) => Promise<void>;
  addTable: (table: Omit<RestaurantTable, 'id'>) => Promise<void>;
  updateTable: (id: string, updates: Partial<RestaurantTable>) => Promise<void>;
  addDiningReservation: (res: Omit<DiningReservation, 'id' | 'reservationNumber' | 'createdAt'>) => string;
  updateDiningReservationStatus: (id: string, status: DiningReservation['status']) => void;
  seatDiningReservation: (id: string) => void;
  takeWaiterOrder: (tableNumber: string, items: { menuItem: MenuItem; quantity: number; notes?: string }[], notes?: string, isUrgent?: boolean) => string;
  resolveWaiterRequest: (id: string) => Promise<{success:boolean;error?:string}>;
  addReservation: (res: Omit<Reservation, 'id' | 'bookingNumber'>) => string;
  checkInGuest: (reservationId: string, roomNumber: string) => void;
  checkOutGuest: (reservationId: string) => void;
  updateRoomStatus: (roomId: string, status: RoomStatus) => void;
  updateHousekeepingStatus: (taskId: string, status: HousekeepingTask['status']) => void;
  addMaintenanceRequest: (req: Omit<MaintenanceRequest, 'id' | 'reportedAt'>) => void;
  updateStock: (itemId: string, delta: number) => void;
  adjustInventoryStock: (itemId: string, delta: number, reason?: string) => void;
  createPurchaseOrder: (supplierName: string, itemsOrCount: number | Array<any>, totalAmount?: number) => void;
  logWaste: (wasteOrItemId: Omit<WasteRecord, 'id' | 'date'> | string, quantity?: number, reason?: string) => void;
  clockInOutEmployee: (employeeId: string) => void;
  toggleClockIn: (employeeId: string) => void;
  addEmployee: (emp: Omit<Employee, 'id' | 'employeeCode'>) => void;
  respondToReview: (reviewId: string, response: string) => void;
  resolveComplaint: (complaintId: string, resolution: string) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  attendWaiterRequest: (id: string) => Promise<{success:boolean;error?:string}>;
  callWaiter: (tableNumber: string, requestType: 'Water' | 'Call Waiter' | 'Bill' | 'Clean Table' | 'Cutlery') => Promise<{success:boolean;error?:string}>;
  createWaiterRequest: (tableIdOrNum: any, tableNumberOrType?: string, reqTypeOrNotes?: string, notes?: string) => void;
  customerSession: CustomerDiningSession | null;
  activeOtpRequest: OTPVerificationRequest | null;
  selfSeatCustomerFromQr: (tableId: string, outletId: string) => Promise<{success:boolean; error?:string}>;
  sendCustomerOTP: (phone: string, tableId?: string, restaurantId?: string, tableNumber?: string, name?: string) => Promise<{ success: boolean; error?: string; requestId?: string; sessionTokenId?: string }>;
  verifyCustomerOTP: (otp: string, customerName?: string) => Promise<{ success: boolean; session?: CustomerDiningSession; error?: string; isExpired?: boolean; isLocked?: boolean }>;
  resendCustomerOTP: () => Promise<{ success: boolean; error?: string }>;
  endCustomerDiningSession: () => void;
  updateCustomerSessionName: (name: string) => void;
  validateQRContext: (restParam?: string, tableParam?: string, routeParam?: string) => QRDiningContext;
  placeCustomerQROrder: (req: PlaceQROrderRequest) => Promise<PlaceQROrderResult>;
  placeWaiterOrder: (req: PlaceWaiterOrderRequest) => PlaceQROrderResult;
  getTableBill: (tableIdOrNumber: string) => TableBill | null;
  requestTableBill: (tableIdOrNumber: string) => { success: boolean; bill?: TableBill; error?: string };
  updateOrderTip: (orderId: string, tipAmount: number, tipType: 'none' | '5%' | '10%' | '15%' | 'custom', tipPercentage?: number, tipAddedBy?: 'CUSTOMER' | 'WAITER') => void;
  processTablePayment: (orderId: string, method: PaymentMethod, amount: number, tipAmount?: number) => { success: boolean; txnId?: string; error?: string };
  settleTableBill: (orderId: string, method?: PaymentMethod, amount?: number, idempotencyKey?: string) => Promise<{ success: boolean; txnId?: string; error?: string; billSummary?: any }> | { success: boolean; txnId?: string; error?: string };
  settlementRequests: SettlementRequest[];
  fetchSettlementRequests: (outletId?: string) => Promise<void>;
  requestSettlementForSession: (sessionId: string, options?: { paymentMethodPreference?: 'CASH' | 'UPI' | 'CARD' | 'ROOM_FOLIO'; notes?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  updateSettlementRequest: (requestId: string, status: 'ACCEPTED' | 'CANCELLED', reason?: string) => Promise<{ success: boolean; error?: string }>;
  addAuditLog: (action: string, module: string, details: string, status?: 'SUCCESS' | 'WARNING' | 'DENIED') => void;

  // Phase 7: Hybrid Restaurant Kitchen Production System
  isKitchenOffline: boolean;
  toggleKitchenOffline: () => void;
  productionEvents: ProductionEvent[];
  prepareProductionItem: (aggregatedItemId: string, quantityToPrepare: number, userId?: string) => { success: boolean; events: ProductionEvent[]; error?: string };
  readyProductionItem: (aggregatedItemId: string, quantityToReady: number, userId?: string) => { success: boolean; events: ProductionEvent[]; error?: string };
  handoffProductionItem: (aggregatedItemId: string, quantityToComplete: number, userId?: string) => { success: boolean; events: ProductionEvent[]; error?: string };
  recallProductionItem: (aggregatedItemId: string, quantityToRecall: number, reason: string, userId?: string) => { success: boolean; events: ProductionEvent[]; error?: string };
  syncOfflineProductionEvents: () => { syncedCount: number; remainingOffline: number };
  createTestOrdersForPhase7: () => { orderAId: string; orderBId: string };

  // Onboarding Tour Controller
  isTourOpen: boolean;
  openTour: (roleOverride?: UserRole) => void;
  closeTour: () => void;
  tourRoleOverride: UserRole | null;
}

export interface QROrderItemInput {
  menuItemId: string;
  quantity: number;
  selectedPortionLabel?: string;
  notes?: string;
  clientPrice?: number;
}

export interface PlaceQROrderRequest {
  sessionRestaurantId: string;
  sessionTableId: string;
  sessionTableNumber: string;
  attemptedRestaurantId?: string;
  attemptedTableId?: string;
  guestName?: string;
  guestPhone?: string;
  customerId?: string;
  customerSessionId?: string;
  notes?: string;
  items: QROrderItemInput[];
  tipAmount?: number;
  tipType?: 'none' | '5%' | '10%' | '15%' | 'custom';
  tipPercentage?: number;
  tipAddedBy?: 'CUSTOMER';
}

export interface PlaceWaiterOrderRequest {
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  guestName?: string;
  guestPhone?: string;
  roomNumber?: string;
  customerId?: string;
  notes?: string;
  items: QROrderItemInput[];
  tipAmount?: number;
  tipType?: 'none' | '5%' | '10%' | '15%' | 'custom';
  tipPercentage?: number;
  tipAddedBy?: 'WAITER';
}

export interface PlaceQROrderResult {
  success: boolean;
  orderId?: string;
  order?: Order;
  error?: string;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        return window.location.hash.slice(1);
      }
      const path = window.location.pathname;
      if (path && path !== '/') {
        return path + (window.location.search || '');
      }
    }
    return '/super-admin/dashboard';
  });

  const AUTH_STORAGE_KEY = 'pali_auth_session';
  const PREVIEW_STORAGE_KEY = 'pali_role_preview';

  const EMPTY_USER: User = {
    id: '',
    name: '',
    email: '',
    phone: '',
    role: '' as UserRole,
    roleTitle: '',
    department: '',
    branch: '',
    avatar: '',
    status: 'inactive',
    lastLogin: ''
  };

  // User Authentication State - Real server-side session only
  // Pre-login state carries no real role; authenticated only after server validation
  const [currentUser, setCurrentUser] = useState<User>(EMPTY_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<UserRole | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Validate stored session token on page load via GET /auth/me
  useEffect(() => {
    let isMounted = true;
    const validateStoredSession = async () => {
      const token = api.getStaffToken();
      if (!token) {
        if (isMounted && api.getStaffToken()===token) {
          setIsAuthenticated(false);
          setCurrentUser(EMPTY_USER);
          setAuthRole(null);
          setIsAuthLoading(false);
        }
        return;
      }

      try {
        const res = await api.getMe();
        if (isMounted && api.getStaffToken()===token && res && res.staff) {
          const primaryRole = selectPrimaryRole(res.roles || []);
          const serverUser: User = {
            id: res.staff.id,
            name: `${res.staff.firstName || ''} ${res.staff.lastName || ''}`.trim() || res.staff.employeeCode,
            email: res.staff.email || '',
            phone: res.staff.phone || '',
            role: primaryRole,
            roleTitle: getRoleLabel(primaryRole),
            department: '',
            branch: 'Pali Resort & Club',
            restaurantId: res.outlets?.find(outlet=>outlet.isPrimary)?.outletId || res.outlets?.[0]?.outletId || '',
            roles: (res.roles || []).map(role=>role.id),
        permissions: res.permissions || [],
            moduleAccess: res.moduleAccess || {},
            avatar: '/palilogo.png',
            status: 'active',
            lastLogin: new Date().toISOString()
          };
          setActiveRestaurantId(serverUser.restaurantId || '');
          setCurrentUser(serverUser);
          setIsAuthenticated(true);
          setAuthRole(primaryRole);
          setIsAuthLoading(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(serverUser));
          }
        } else if (isMounted && api.getStaffToken()===token) {
          api.setStaffToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
          setIsAuthenticated(false);
          setCurrentUser(EMPTY_USER);
          setAuthRole(null);
          setIsAuthLoading(false);
        }
      } catch (err: any) {
        if (isMounted && api.getStaffToken()===token) {
          // Only clear session on explicit 401 Unauthorized
          if (err?.status === 401) {
            api.setStaffToken(null);
            if (typeof window !== 'undefined') {
              localStorage.removeItem(AUTH_STORAGE_KEY);
            }
            setIsAuthenticated(false);
            setCurrentUser(EMPTY_USER);
            setAuthRole(null);
          }
          // A cached role is never authentication authority after server verification fails.
          setIsAuthenticated(false);
          setCurrentUser(EMPTY_USER);
          setAuthRole(null);
          setIsAuthLoading(false);
        }
      }
    };

    validateStoredSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Super Admin Role Preview state (Super Admin only testing feature)
  const [previewRole, setPreviewRole] = useState<UserRole | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const p = sessionStorage.getItem(PREVIEW_STORAGE_KEY) || sessionStorage.getItem('sqbe_role_preview');
        return (p as UserRole) || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Effective Role: Active role for view rendering and route checking
  // If Super Admin has an active previewRole, effectiveRole is previewRole; otherwise user's real permanent role
  const effectiveRole: UserRole = (currentUser.role === 'SUPER_ADMIN' && previewRole)
    ? previewRole
    : currentUser.role;

  // Multi-Tenant Restaurant / Outlets State
  const [restaurants, setRestaurants] = useState<Restaurant[]>(INITIAL_RESTAURANTS);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string>('rest-1');

  // Dining Reservations State
  const [diningReservations, setDiningReservations] = useState<DiningReservation[]>(INITIAL_DINING_RESERVATIONS);

  // Operational State
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [diningZones, setDiningZones] = useState<Array<{id:string;name:string;code:string}>>([]);
  const [floorStaff, setFloorStaff] = useState<Array<{id:string;name:string}>>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const menuMutationKeys = useRef(new Map<string, { signature: string; key: string }>());
  const [orders, setOrders] = useState<Order[]>([]);
  const [kitchenTickets, setKitchenTickets] = useState<KitchenTicket[]>([]);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [guests, setGuests] = useState<Guest[]>(INITIAL_GUESTS);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>(INITIAL_HOUSEKEEPING_TASKS);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(INITIAL_MAINTENANCE);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [inventoryLocations, setInventoryLocations] = useState<InventoryLocation[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(INITIAL_PURCHASE_ORDERS);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>(INITIAL_WASTE_RECORDS);
  const [employees, setEmployees] = useState<Employee[]>(
    import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true' ? INITIAL_EMPLOYEES : []
  );
  const [customers, setCustomers] = useState<CustomerProfile[]>(INITIAL_CUSTOMERS);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<WaiterRequest[]>([]);
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>([]);
  const [restaurantSyncError, setRestaurantSyncError] = useState<string | null>(null);

  // Phase 7: Customer Dining Session & Mobile OTP State
  const [customerSession, setCustomerSession] = useState<CustomerDiningSession | null>(null);
  useEffect(()=>{
    const restoringToken=api.getGuestToken();
    if(!restoringToken) return;
    let current=true;
    api.getGuestSession().then(session=>{
      if(current && api.getGuestToken()===restoringToken) setCustomerSession({sessionId:session.sessionId,customerId:`guest-${session.sessionId}`,customerName:session.customerName || 'Resort Guest',mobileNumber:'',maskedMobile:'',restaurantId:session.outletId,tableId:session.tableId,tableNumber:session.tableNumber,startedAt:session.openedAt,verifiedAt:new Date().toISOString(),status:'active'});
    }).catch(()=>{if(current && api.getGuestToken()===restoringToken){api.setGuestToken(null);setCustomerSession(null);}});
    return ()=>{current=false;};
  },[]);

  const [activeOtpRequest, setActiveOtpRequest] = useState<OTPVerificationRequest | null>(null);
  const [sessionTokenId, setSessionTokenId] = useState<string | null>(null);
  const [pendingCustomerPhone, setPendingCustomerPhone] = useState<string>('');
  const [pendingCustomerName, setPendingCustomerName] = useState<string>('');

  // Phase 7: Hybrid Restaurant Kitchen Production System
  const [isKitchenOffline, setIsKitchenOffline] = useState<boolean>(false);
  const [productionEvents, setProductionEvents] = useState<ProductionEvent[]>(() => {
    return getOfflineEvents();
  });

  // Onboarding Tour Controller State
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [tourRoleOverride, setTourRoleOverride] = useState<UserRole | null>(null);

  const openTour = (roleOverride?: UserRole) => {
    if (roleOverride) {
      setTourRoleOverride(roleOverride);
    } else {
      setTourRoleOverride(null);
    }
    setIsTourOpen(true);
  };

  const closeTour = () => {
    setIsTourOpen(false);
  };

  // Live Restaurant Data Loader & Synchronization from Backend API
  const loadCoordinator=useRef(new StaffLoadCoordinator()).current;
  const latestLoaders=useRef<{restaurant:(outlet:string)=>Promise<void>;hotel:()=>Promise<void>;inventory:()=>Promise<void>;staff:()=>Promise<void>}>(null!);
  const pollingDelay=useRef(20000);
  pollingDelay.current=/^\/(kitchen|waiter|cashier)(\/|$)/.test(currentRoute)?5000:20000;
  const staffToken=api.getStaffToken();
  const loadOutletId=currentUser.role==='SUPER_ADMIN'?activeRestaurantId:(currentUser.restaurantId||'');
  const departmentArea=/^\/inventory(\/|$)/.test(currentRoute)?'inventory':/^\/(hotel|housekeeping|maintenance)(\/|$)/.test(currentRoute)?'hotel':'operations';
  const loadScope=JSON.stringify([isAuthenticated,isAuthLoading,currentUser.id,currentUser.role,currentUser.roles,currentUser.status,
    currentUser.permissions,currentUser.moduleAccess,loadOutletId,staffToken,departmentArea,currentRoute]);
  const loadGeneration=loadCoordinator.setScope(loadScope);
  const loadPlan=staffLoadPlan(currentUser,isAuthenticated&&!isAuthLoading&&!!staffToken,loadOutletId,departmentArea);
  const isCurrentLoad=()=>loadCoordinator.isCurrent(loadGeneration)&&api.getStaffToken()===staffToken;
  const loadApi=scopedStaffApi(api,isCurrentLoad);
  const loadRestaurantData = async (outletId = loadOutletId) => {
    // Only query staff-protected outlet data if a valid staff token exists
    if (!isCurrentLoad() || !staffToken || outletId!==loadOutletId) {
      return;
    }
    if (isCurrentLoad()) setRestaurantSyncError(null);
    let syncErrorOccurred = false;
    let syncErrorMessage = '';

    try {
      // 1. Fetch live tables from backend
      if (loadPlan.tables) try {
        const tablesRes = await loadApi.getOutletTables(outletId);
        const rawTables = (tablesRes && ((tablesRes as any).tables || tablesRes.items)) || [];
        if (Array.isArray(rawTables)) {
          const mappedTables: RestaurantTable[] = rawTables.map((t: any) => {
            let status: TableStatus = 'available';
            if (t.status === 'OCCUPIED') status = 'occupied';
            else if (t.status === 'RESERVED') status = 'reserved';
            else if (t.status === 'BILLED') status = 'billed';
            else if (t.status === 'DIRTY' || t.status === 'CLEANING') status = 'cleaning';
            else if (t.status === 'OUT_OF_SERVICE') status = 'out_of_service';

            return {
              id: t.id,
              restaurantId: t.outletId,
              number: t.tableNumber,
              capacity: t.capacity,
              status,
              section: t.zoneName || (t.zone as any) || '',
              zoneId: t.diningZoneId,
              currentOrderId: undefined,
              activeSessionId:t.activeSessionId || t.activeSession?.id || undefined,
              guestCount: t.activeGuestCount || t.activeSession?.guestCount,
              waiterName: t.currentWaiterName || t.activeSession?.assignedStaffName || undefined,
              waiterId: t.currentWaiterStaffId || t.activeSession?.assignedStaffId || undefined,
              occupiedSince: t.activeSession?.seatedAt || undefined
            };
          });
          if (isCurrentLoad()) setTables(mappedTables);
        }
      } catch (err: any) {
        syncErrorOccurred = true;
        syncErrorMessage = err.detail || err.message || 'Failed to load tables';
      }

      if (loadPlan.tables) try {
        const [zones,staff] = await Promise.all([
          loadApi.request<{zones:Array<{id:string;name:string;code:string}>}>(`/outlets/${outletId}/zones`),
          loadApi.request<{staff:Array<{id:string;name:string}>}>(`/outlets/${outletId}/floor-staff`)
        ]);
        if (isCurrentLoad()) setDiningZones(zones.zones); if (isCurrentLoad()) setFloorStaff(staff.staff);
      } catch (error:any) { if (isCurrentLoad()) setDiningZones([]); if (isCurrentLoad()) setFloorStaff([]); syncErrorOccurred=true; syncErrorMessage=error.detail || error.message; }

      // 2. Fetch live menu catalog from backend
      if (loadPlan.menu) try {
        const menuRes = await loadApi.getOutletMenu(outletId);
        if (menuRes && Array.isArray(menuRes.items)) {
          const mappedMenu = convertOutletMenuResponse(menuRes).items;
          const categoryResponse = await loadApi.getMenuCategories();
          if (isCurrentLoad()) setMenuCategories(categoryResponse.categories.map(category => ({ id: category.id, name: category.name, icon: 'Utensils', itemCount: mappedMenu.filter(item => item.categoryId === category.id).length })));
          if (isCurrentLoad()) setMenuItems(mappedMenu);
        }
      } catch (err: any) {
        syncErrorOccurred = true;
        syncErrorMessage = syncErrorMessage || (err.detail || err.message || 'Failed to load menu');
      }

      // 3. Fetch live orders from backend
      if (loadPlan.orders) try {
        const ordersRes = await loadApi.listOutletOrders(outletId);
        const rawOrders = (ordersRes && ((ordersRes as any).orders || ordersRes.items)) || [];
        if (Array.isArray(rawOrders)) {
          const mappedOrders: Order[] = rawOrders.map((o: any) => {
            const matchedTable = tables.find(t => t.id === o.tableId || (o.diningSessionId && t.activeSessionId === o.diningSessionId));
            const tableNumber = o.tableNumber || matchedTable?.number || (o.diningSessionId ? `T-${o.diningSessionId.slice(0, 4)}` : 'Takeaway');
            const tableId = o.tableId || matchedTable?.id;
            return {
              id: o.id,
              orderNumber: `ORD-${o.orderNumber || o.id.slice(0, 5).toUpperCase()}`,
              restaurantId: o.outletId,
              tableNumber,
              tableId,
              diningSessionId: o.diningSessionId,
              guestName: o.customerName || (tableNumber && tableNumber !== 'Takeaway' ? `Table ${tableNumber} Guest` : 'Resort Guest'),
              status: (o.status ? o.status.toLowerCase() : 'placed') as OrderStatus,
              orderType: o.orderSource === 'ROOM_SERVICE' ? 'room-service' : 'dine-in',
              items: (o.items || []).map((it: any) => ({
                id: it.id,
                menuItemId: it.menuItemId,
                name: it.itemName || it.itemNameSnapshot || it.name,
                price: (it.unitPricePaise || 0) / 100,
                quantity: it.quantity,
                isVeg: true,
                notes: it.customizationNotes,
                status: (it.status ? it.status.toLowerCase() : 'ordered') as any
              })),
              subtotal: (o.subtotalPaise || 0) / 100,
              tax: (o.taxPaise || 0) / 100,
              gstAmount: (o.taxPaise || 0) / 100,
              discount: (o.discountPaise || 0) / 100,
              tipAmount: 0,
              grandTotal: (o.totalPaise || 0) / 100,
              paymentStatus: (o.status === 'COMPLETED' ? 'paid' : 'pending') as PaymentStatus,
              createdAt: o.createdAt || new Date().toLocaleTimeString()
            };
          });
          if (isCurrentLoad()) setOrders(mappedOrders);
        }
      } catch (err: any) {
        syncErrorOccurred = true;
        syncErrorMessage = syncErrorMessage || (err.detail || err.message || 'Failed to load orders');
      }

      // 4. Fetch live KOTs from backend
      if (loadPlan.kots) try {
        const kotsRes = await loadApi.listOutletKots(outletId);
        const rawKots = (kotsRes && ((kotsRes as any).kots || kotsRes.items)) || [];
        if (Array.isArray(rawKots)) {
          const mappedKots: KitchenTicket[] = rawKots.map((k: any) => {
            let ticketStatus: KitchenTicketStatus = 'new';
            if (k.status === 'ACCEPTED') ticketStatus = 'accepted';
            else if (k.status === 'PREPARING') ticketStatus = 'preparing';
            else if (k.status === 'READY') ticketStatus = 'ready';
            else if (k.status === 'SERVED') ticketStatus = 'completed';
            else if (k.status === 'CANCELLED') ticketStatus = 'cancelled';

            const sCode = (k.stationCode || '').toUpperCase();
            let sType: 'cooking' | 'bar' | 'beverages' | 'drinks' = 'cooking';
            if (sCode === 'BAR') sType = 'bar';
            else if (sCode === 'PANTRY') sType = 'cooking';
            else sType = 'cooking';

            return {
              id: k.id,
              orderId: k.orderId,
              orderNumber: k.kotNumber ? `KOT-${k.kotNumber}` : (k.kotNumber || `KOT-${k.id.slice(0, 4).toUpperCase()}`),
              orderType: (k.orderSource === 'ROOM_SERVICE' ? 'room-service' : 'dine-in') as 'dine-in' | 'takeaway' | 'room-service',
              restaurantId: k.outletId,
              destination: k.locationLabelSnapshot || (k.tableNumber ? `Table ${k.tableNumber}` : (k.roomNumber ? `Room ${k.roomNumber}` : 'Takeaway')),
              tableNumber: k.tableNumber || (k.locationLabelSnapshot?.startsWith('Table ') ? k.locationLabelSnapshot.replace('Table ', '') : undefined),
              roomNumber: k.roomNumber || undefined,
              status: ticketStatus,
              station: k.stationName || k.stationCode || 'Main Kitchen',
              stationId: k.stationId,
              stationCode: k.stationCode,
              stationType: sType,
              createdAt: k.createdAt || new Date().toLocaleTimeString(),
              createdAtTimestamp: new Date(k.createdAt).getTime() || Date.now(),
              elapsedMinutes: 0,
              priority: 'normal' as const,
              items: (k.items || []).map((it: any) => ({
                id: it.id,
                name: it.itemName || it.itemNameSnapshot || it.name,
                quantity: it.quantity,
                notes: it.customizationNotes,
                isVeg: true,
                status: (it.status === 'READY' ? 'ready' : it.status === 'SERVED' ? 'completed' : it.status === 'PREPARING' ? 'preparing' : it.status === 'ACCEPTED' ? 'accepted' : 'new') as any,
                completed: it.status === 'READY' || it.status === 'SERVED'
              }))
            };
          });
          if (isCurrentLoad()) setKitchenTickets(mappedKots);
        }
      } catch (err: any) {
        syncErrorOccurred = true;
        syncErrorMessage = syncErrorMessage || (err.detail || err.message || 'Failed to load KOT tickets');
      }

      // 5. Fetch live service requests from backend
      if (loadPlan.serviceRequests) try {
        const srRes = await loadApi.getOutletServiceRequests(outletId);
        if (srRes && Array.isArray(srRes.items)) {
          const mappedRequests: WaiterRequest[] = srRes.items.map((r) => {
            let reqType: any = 'Call Waiter';
            if (r.requestType === 'WATER') reqType = 'Water';
            else if (r.requestType === 'BILL') reqType = 'Bill';
            else if (r.requestType === 'CLEANING') reqType = 'Clean Table';
            else if (r.requestType === 'CUTLERY') reqType = 'Cutlery';

            return {
              id: r.id,
              tableNumber: r.tableNumber,
              requestType: reqType,
              status: r.status === 'RESOLVED' ? 'attended' : (r.status === 'ACKNOWLEDGED' ? 'attended' : 'pending'),
              requestedAt: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
            };
          });
          if (isCurrentLoad()) setWaiterRequests(mappedRequests);
        }
      } catch (err: any) {
        if (err?.status !== 403) {
          syncErrorOccurred = true;
          syncErrorMessage = syncErrorMessage || (err.detail || err.message || 'Failed to load service requests');
        }
      }

      // 6. Fetch live payments from backend (for cashier / shift closing)
      if (loadPlan.payments) try {
        const payRes = await loadApi.getOutletPayments(outletId);
        if (payRes && Array.isArray(payRes.items)) {
          const mappedPayments: PaymentTransaction[] = payRes.items.map((p) => ({
            id: p.id,
            transactionId: p.transactionReference || p.id.slice(0, 8).toUpperCase(),
            invoiceNo: p.billNumber,
            source: 'Restaurant POS',
            customerName: p.processedByName || 'Guest',
            amount: p.amountPaise / 100,
            method: (p.tenderMethod ? p.tenderMethod.toLowerCase() : 'cash') as any,
            status: (p.status === 'CAPTURED' ? 'success' : (p.status === 'REFUNDED' ? 'refunded' : 'pending')) as any,
            date: p.createdAt ? `${new Date(p.createdAt).toLocaleDateString()}, ${new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Today',
            gstAmount: Number(((p.amountPaise / 100) * 0.05).toFixed(2)),
            refNumber: p.transactionReference || p.id
          }));
          if (isCurrentLoad()) setPayments(mappedPayments);
        }
      } catch (err: any) {
        if (err?.status !== 403) {
          syncErrorOccurred = true;
          syncErrorMessage = syncErrorMessage || (err.detail || err.message || 'Failed to load payments');
        }
      }

      // 7. Fetch live settlement requests (waiter-to-cashier)
      if (loadPlan.settlementRequests) try {
        const sRes = await loadApi.listSettlementRequests(outletId);
        if (sRes && Array.isArray(sRes.items)) {
          if (isCurrentLoad()) setSettlementRequests(sRes.items);
        }
      } catch (err: any) {
        if (err?.status !== 403) {
          syncErrorOccurred = true;
          syncErrorMessage = syncErrorMessage || (err.detail || err.message || 'Failed to load settlement requests');
        }
      }

      if (syncErrorOccurred) {
        if (isCurrentLoad()) setRestaurantSyncError(syncErrorMessage || 'Failed to sync live data with server.');
      } else {
        if (isCurrentLoad()) setRestaurantSyncError(null);
      }
    } catch (err: any) {
      console.warn('Backend sync error:', err);
      if (isCurrentLoad()) setRestaurantSyncError(err.detail || err.message || 'Network error syncing restaurant data');
    }
  };

  const refreshRestaurantData = useCallback((outletId=loadOutletId):Promise<void> =>
    loadCoordinator.run(loadGeneration,'restaurant:'+outletId,()=>latestLoaders.current.restaurant(outletId)),[loadGeneration,loadOutletId]);
  // Live Hotel PMS, Housekeeping & Maintenance Data Loader from Backend API
  const loadHotelData = async () => {
    // Hotel PMS and Housekeeping require staff authentication
    if (!isCurrentLoad() || ![loadPlan.rooms,loadPlan.stays,loadPlan.reservations,loadPlan.housekeeping,loadPlan.maintenance].some(Boolean)) {
      return;
    }
    try {
      // 1. Fetch live hotel rooms and active stays
      const roomsRes = (loadPlan.rooms ? await loadApi.listHotelRooms().catch(() => null) : null);
      const staysRes = (loadPlan.stays ? await loadApi.listHotelStays({ status: 'CHECKED_IN' }).catch(() => null) : null);
      const activeStays = staysRes?.items || [];
      const stayByRoomId = new Map<string, any>(activeStays.map((s: any) => [s.roomId, s]));

      if (roomsRes && Array.isArray(roomsRes.items)) {
        const mappedRooms: Room[] = roomsRes.items.map((r) => {
          let status: RoomStatus = 'available';
          if (r.status === 'OCCUPIED') status = 'occupied';
          else if (r.status === 'DIRTY' || r.status === 'CLEANING') status = 'cleaning';
          else if (r.status === 'INSPECTED') status = 'available';
          else if (r.status === 'MAINTENANCE' || r.status === 'OUT_OF_SERVICE') status = 'maintenance';
          else if (r.status === 'RESERVED') status = 'reserved';

          const activeStay = stayByRoomId.get(r.id);

          return {
            id: r.id,
            number: r.roomNumber,
            floor: r.floor,
            roomTypeId: r.roomTypeId,
            roomTypeName: r.roomTypeName || 'Deluxe Room',
            pricePerNight: (r.basePricePaise || 0) / 100,
            status,
            currentGuestName: activeStay?.guestName || undefined,
            currentGuestPhone: activeStay?.guestPhone || undefined,
            checkInDate: activeStay ? new Date(activeStay.checkInTime).toLocaleDateString() : undefined,
            checkOutDate: activeStay ? new Date(activeStay.expectedCheckOutTime).toLocaleDateString() : undefined,
            stayId: activeStay?.id,
            folioId: activeStay?.folioId,
            folioBalance: activeStay ? (activeStay.folioBalancePaise || 0) / 100 : 0
          };
        });
        if (isCurrentLoad()) setRooms(mappedRooms);
      }

      // 2. Fetch live hotel reservations
      const resRes = (loadPlan.reservations ? await loadApi.listHotelReservations().catch(() => null) : null);
      if (resRes && Array.isArray(resRes.items)) {
        const mappedReservations: Reservation[] = resRes.items.map((res) => ({
          id: res.id,
          bookingReference: res.bookingReference,
          guestName: res.guestName,
          guestPhone: res.guestPhone,
          guestEmail: '',
          roomTypeId: '',
          roomTypeName: res.roomTypeName,
          roomId: res.roomId || undefined,
          roomNumber: res.roomNumber || undefined,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          numberOfGuests: res.adultsCount + (res.childrenCount || 0),
          status: (res.status === 'CONFIRMED' ? 'confirmed' : res.status === 'CHECKED_IN' ? 'checked-in' : res.status === 'CHECKED_OUT' ? 'checked-out' : 'cancelled') as any,
          advancePayment: 0,
          totalAmount: 0,
          createdAt: res.createdAt
        }));
        if (isCurrentLoad()) setReservations(mappedReservations);
      }

      // 3. Fetch live housekeeping tasks
      const hkRes = (loadPlan.housekeeping ? await loadApi.listHousekeepingTasks().catch(() => null) : null);
      if (hkRes && Array.isArray(hkRes.items)) {
        const mappedTasks: HousekeepingTask[] = hkRes.items.map((t) => {
          let status: HousekeepingTask['status'] = 'dirty';
          if (t.status === 'IN_PROGRESS') status = 'cleaning';
          else if (t.status === 'COMPLETED' || t.status === 'INSPECTED') status = 'available';

          return {
            id: t.id,
            roomNumber: t.roomNumber,
            roomTypeName: 'Hotel Room',
            floor: t.floor,
            assignedToName: t.assignedStaffName || 'Housekeeping Staff',
            assignedToId: t.assignedStaffId || '',
            status,
            priority: (t.priority.toLowerCase() || 'normal') as any,
            scheduledTime: 'Turnaround Cleaning',
            notes: t.notes || ''
          };
        });
        if (isCurrentLoad()) setHousekeepingTasks(mappedTasks);
      }

      // 4. Fetch live maintenance issues
      const mntRes = (loadPlan.maintenance ? await loadApi.listMaintenanceIssues().catch(() => null) : null);
      if (mntRes && Array.isArray(mntRes.items)) {
        const mappedIssues: MaintenanceRequest[] = mntRes.items.map((m) => ({
          id: m.id,
          roomOrArea: m.roomNumber ? `Room ${m.roomNumber}` : (m.outletId ? `Outlet ${m.outletId}` : 'Facility Area'),
          issue: m.title + (m.description ? `: ${m.description}` : ''),
          priority: (m.severity.toLowerCase() || 'medium') as any,
          status: (m.status === 'RESOLVED' ? 'resolved' : m.status === 'IN_REPAIR' ? 'in-progress' : 'pending') as any,
          reportedBy: m.reportedByName || 'Staff',
          reportedAt: m.createdAt || 'Recent'
        }));
        if (isCurrentLoad()) setMaintenanceRequests(mappedIssues);
      }
    } catch (err) {
      console.warn('Hotel backend sync error:', err);
    }
  };

  // Live Inventory, Locations, Balances, Movements & Recipes Data Loader from Backend API
  const loadInventoryData = async () => {
    // Inventory and recipes require staff authentication
    if (!isCurrentLoad() || ![loadPlan.inventoryItems,loadPlan.inventoryLocations,loadPlan.inventoryBalances,loadPlan.recipes].some(Boolean)) {
      return;
    }
    try {
      const [itemsRes, locsRes, balancesRes, recipesRes] = await Promise.all([
        (loadPlan.inventoryItems ? loadApi.listInventoryItems({ limit: 100 }).catch(() => null) : Promise.resolve(null)),
        (loadPlan.inventoryLocations ? loadApi.listInventoryLocations().catch(() => null) : Promise.resolve(null)),
        (loadPlan.inventoryBalances ? loadApi.listInventoryBalances({ limit: 100 }).catch(() => null) : Promise.resolve(null)),
        (loadPlan.recipes ? loadApi.listRecipes({ limit: 100 }).catch(() => null) : Promise.resolve(null))
      ]);

      if (locsRes && Array.isArray(locsRes.items)) {
        if (isCurrentLoad()) setInventoryLocations(locsRes.items);
      }

      if (balancesRes && Array.isArray(balancesRes.items)) {
        if (isCurrentLoad()) setInventoryBalances(balancesRes.items);
      }

      if (recipesRes && Array.isArray(recipesRes.items)) {
        if (isCurrentLoad()) setRecipes(recipesRes.items as any);
      }

      if (itemsRes && Array.isArray(itemsRes.items)) {
        const balancesByItemId = new Map<string, number>();
        if (balancesRes && Array.isArray(balancesRes.items)) {
          balancesRes.items.forEach((b: any) => {
            const current = balancesByItemId.get(b.itemId) || 0;
            balancesByItemId.set(b.itemId, current + (Number(b.currentQuantity) || 0));
          });
        }

        const mappedItems: InventoryItem[] = itemsRes.items.map((it: any) => {
          const totalStock = balancesByItemId.has(it.id)
            ? (balancesByItemId.get(it.id) || 0)
            : 0;
          const reorderLevel = Number(it.reorderLevel) || 0;
          let status: InventoryItem['status'] = 'in-stock';
          if (totalStock <= 0) status = 'out-of-stock';
          else if (totalStock <= reorderLevel) status = 'low-stock';

          return {
            id: it.id,
            itemCode: it.itemCode,
            name: it.name,
            category: it.category as any,
            currentStock: totalStock,
            minStockLevel: reorderLevel,
            minStockAlert: reorderLevel,
            unit: it.unitOfMeasure,
            unitCost: (it.unitCostPaise || 0) / 100,
            unitCostPaise: it.unitCostPaise || 0,
            supplierName: 'Approved Central Supplier',
            supplierPhone: '+91 98200 12345',
            lastRestocked: 'Today',
            status,
            isActive: it.isActive
          };
        });
        if (isCurrentLoad()) setInventory(mappedItems);
      }
    } catch (err) {
      console.warn('Inventory backend sync error:', err);
    }
  };

  // Live Staff Roster & Employee Data Loader from Backend API
  const loadStaffData = async () => {
    // Staff roster requires staff authentication
    if (!isCurrentLoad() || !loadPlan.staff) {
      return;
    }
    try {
      const staffRes = await loadApi.listStaff();
      if (staffRes && Array.isArray(staffRes.items)) {
        const mappedEmployees: Employee[] = staffRes.items.map((s) => {
          const primaryRole = (s.roles && s.roles[0]?.id) || 'WAITER';
          const roleLabel = (s.roles && s.roles[0]?.displayName) || primaryRole;
          return {
            id: s.id,
            employeeCode: s.employeeCode,
            name: `${s.firstName} ${s.lastName}`.trim(),
            email: s.email,
            phone: s.phone,
            role: primaryRole as UserRole,
            roleTitle: roleLabel,
            firstName: s.firstName,
            lastName: s.lastName,
            designationId: s.designationId ?? null,
            designationName: s.designationName ?? null,department: (s.outlets || []).map(o => o.name).join(', ') || 'Not assigned',
             shift: 'Morning (06:00 - 15:00)',
             monthlySalary: 0,
             joinDate: '',
             status: s.isActive === false ? 'inactive' : 'active',
             isClockedIn: false,
             attendanceRate: 0
          };
        });
        if (isCurrentLoad()) setEmployees(mappedEmployees);
      }
    } catch (err) {
      console.warn('Staff backend sync error:', err);
    }
  };

  latestLoaders.current={restaurant:loadRestaurantData,hotel:loadHotelData,inventory:loadInventoryData,staff:loadStaffData};
  const refreshHotelData=useCallback(()=>loadCoordinator.run(loadGeneration,'hotel',()=>latestLoaders.current.hotel()),[loadGeneration]);
  const refreshInventoryData=useCallback(()=>loadCoordinator.run(loadGeneration,'inventory',()=>latestLoaders.current.inventory()),[loadGeneration]);
  const refreshStaffData=useCallback(()=>loadCoordinator.run(loadGeneration,'staff',()=>latestLoaders.current.staff()),[loadGeneration]);

  const clearStaffData=()=>{
    setTables([]);setDiningZones([]);setFloorStaff([]);setMenuItems([]);setMenuCategories([]);
    setOrders([]);setKitchenTickets([]);setWaiterRequests([]);setPayments([]);setRestaurantSyncError(null);
    setRooms([]);setReservations([]);setGuests([]);setHousekeepingTasks([]);setMaintenanceRequests([]);
    setInventory([]);setInventoryLocations([]);setInventoryBalances([]);setRecipes([]);setEmployees([]);
    setPurchaseOrders([]);setWasteRecords([]);setDiningReservations([]);
    setAuditLogs([]);setNotifications([]);setCustomers([]);setReviews([]);setComplaints([]);
  };
  // Scope changes invalidate old promises before any new load can commit data.
  useEffect(()=>{
    clearStaffData();
    let disposed=false;
    let nextDepartmentRefresh=0;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const reconcile=async(refreshIdentity=false)=>{
      if(disposed||!isCurrentLoad()||!isAuthenticated||isAuthLoading||!staffToken)return;
      if(refreshIdentity){
        try {
          const identity=await loadApi.getMe();
          const role=selectPrimaryRole(identity.roles||[]);
          const next={...currentUser,role,roleTitle:getRoleLabel(role),roles:(identity.roles||[]).map(r=>r.id),
            restaurantId:identity.outlets?.find(o=>o.isPrimary)?.outletId||identity.outlets?.[0]?.outletId||'',
            permissions:identity.permissions||[],moduleAccess:identity.moduleAccess||{}};
          const access=(u:User)=>JSON.stringify([u.id,u.role,u.roles,u.restaurantId,u.permissions,u.moduleAccess]);
          if(identity.staff.id!==currentUser.id){logout();return;}
          if(access(next)!==access(currentUser)){
            loadCoordinator.invalidate();setCurrentUser(next);setAuthRole(role);
            if(role!=='SUPER_ADMIN')setActiveRestaurantId(next.restaurantId);
            return;
          }
        }catch(error:any){
          if(!isCurrentLoad())return;
          if(error?.status===401){logout();return;}
          clearStaffData();
          // A failed revalidation cannot authorize a new round of department requests.
          if(!disposed)timer=setTimeout(()=>void reconcile(true),pollingDelay.current);
          return;
        }
      }
      const tasks:Promise<void>[]=[];
      if([loadPlan.tables,loadPlan.serviceRequests,loadPlan.menu,loadPlan.orders,loadPlan.kots,loadPlan.payments].some(Boolean))tasks.push(refreshRestaurantData());
      const refreshDepartments=Date.now()>=nextDepartmentRefresh;
      if(refreshDepartments&&[loadPlan.rooms,loadPlan.stays,loadPlan.reservations,loadPlan.housekeeping,loadPlan.maintenance].some(Boolean))tasks.push(refreshHotelData());
      if(refreshDepartments&&[loadPlan.inventoryItems,loadPlan.inventoryLocations,loadPlan.inventoryBalances,loadPlan.recipes].some(Boolean))tasks.push(refreshInventoryData());
      if(
        refreshDepartments &&
        loadPlan.staff &&
        (
          /^\/(staff|users|admin|super-admin|system)(\/|$)/.test(currentRoute) ||
          currentRoute === '/restaurants'
        )
      )tasks.push(refreshStaffData());
      if(refreshDepartments)nextDepartmentRefresh=Date.now()+20000;
      await Promise.allSettled(tasks);
      if(!disposed&&isCurrentLoad())timer=setTimeout(()=>void reconcile(true),pollingDelay.current);
    };
    void reconcile();
    return ()=>{disposed=true;if(timer)clearTimeout(timer);};
  },[loadScope]);
  // Sync Customer Session with session storage (strictly tab-scoped, never localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (customerSession) {
          sessionStorage.setItem('pali_customer_dining_session', JSON.stringify(customerSession));
        } else {
          sessionStorage.removeItem('pali_customer_dining_session');
        }
        localStorage.removeItem('pali_customer_dining_session');
      } catch (e) {
        console.error('Error persisting customer dining session:', e);
      }
    }
  }, [customerSession]);

  /**
   * Validate QR Dining Context.
   * Resolves restaurantId, tableId, tableNumber.
   * If invalid, missing, malformed, or unmapped -> returns isValid: false with clear reason.
   */
  const validateQRContext = (restParam?: string, tableParam?: string, routeParam?: string): QRDiningContext => {
    // 1. Ensure seed data is loaded/available even on a fresh browser with empty localStorage
    const stateRestIds = new Set((restaurants || []).map(r => r.id));
    const effectiveRestaurants = (restaurants && restaurants.length > 0)
      ? [
          ...restaurants,
          ...INITIAL_RESTAURANTS.filter(r => !stateRestIds.has(r.id))
        ]
      : INITIAL_RESTAURANTS;

    const stateTableIds = new Set((tables || []).map(t => t.id));
    const effectiveTables = (tables && tables.length > 0)
      ? [
          ...tables,
          ...INITIAL_TABLES.filter(t => !stateTableIds.has(t.id))
        ]
      : INITIAL_TABLES;

    // Parameter extraction from direct args, window location, or currentRoute
    let extractedRest = restParam?.trim();
    let extractedTable = tableParam?.trim();
    let effectiveRoute = routeParam?.trim() || '';

    if (typeof window !== 'undefined') {
      try {
        let searchStr = window.location.search ? window.location.search.replace(/^\?/, '') : '';
        if (!searchStr && window.location.hash.includes('?')) {
          searchStr = window.location.hash.split('?')[1];
        }
        if (searchStr) {
          const sp = new URLSearchParams(searchStr);
          if (!extractedRest) {
            extractedRest = sp.get('restaurant') || sp.get('restaurantId') || sp.get('r') || undefined;
          }
          if (!extractedTable) {
            extractedTable = sp.get('table') || sp.get('tableNumber') || sp.get('t') || undefined;
          }
        }
        if (!effectiveRoute) {
          if (window.location.hash && window.location.hash.startsWith('#/')) {
            effectiveRoute = window.location.hash.slice(1).split('?')[0];
          } else {
            effectiveRoute = window.location.pathname;
          }
        }
      } catch {
        // ignore
      }
    }

    if (currentRoute) {
      try {
        const [routePath, routeQuery] = currentRoute.split('?');
        if (!effectiveRoute) effectiveRoute = routePath;
        if (routeQuery) {
          const sp = new URLSearchParams(routeQuery);
          if (!extractedRest) {
            extractedRest = sp.get('restaurant') || sp.get('restaurantId') || sp.get('r') || undefined;
          }
          if (!extractedTable) {
            extractedTable = sp.get('table') || sp.get('tableNumber') || sp.get('t') || undefined;
          }
        }
      } catch {
        // ignore
      }
    }

    // Accept both /customer and /customer/qr-ordering routes
    if (effectiveRoute) {
      const cleanRoute = effectiveRoute.split('?')[0].replace(/^#/, '').replace(/\/+$/, '') || '/';
      const isCustomerRoute = 
        cleanRoute === '/customer' || 
        cleanRoute === '/customer/qr-ordering' || 
        cleanRoute.startsWith('/customer') || 
        cleanRoute.startsWith('/qr');

      if (!isCustomerRoute && cleanRoute !== '/') {
        return {
          isValid: false,
          restaurantId: extractedRest || 'rest-1',
          restaurantName: 'Pali Resort & Club',
          tableId: '',
          tableNumber: '',
          taxRate: 5,
          errorReason: 'This QR code route is not valid for dining. Please use /customer or /customer/qr-ordering.'
        };
      }
    }

    const targetRestId = extractedRest || 'rest-1';
    const targetRest = effectiveRestaurants.find(r => r.id.toLowerCase() === targetRestId.toLowerCase()) 
      || effectiveRestaurants.find(r => r.name.toLowerCase().includes(targetRestId.toLowerCase()))
      || effectiveRestaurants[0];

    if (!targetRest) {
      return {
        isValid: false,
        restaurantId: targetRestId,
        restaurantName: 'Pali Resort & Club',
        tableId: '',
        tableNumber: '',
        taxRate: 5,
        errorReason: 'This QR code is not valid for dining. Unrecognized restaurant property.'
      };
    }

    if (!extractedTable) {
      return {
        isValid: false,
        restaurantId: targetRest.id,
        restaurantName: targetRest.name,
        tableId: '',
        tableNumber: '',
        taxRate: targetRest.taxRate ?? 5,
        errorReason: 'This QR code is not valid for dining. No table number found in QR context.'
      };
    }

    const cleanTableParam = extractedTable;

    // 2. Forgiving table normalization: ignores case, punctuation, leading zeros
    // Treats 'T-1', 'T-01', 't1', 't-01', '1', 'Table 1' as identical
    const normalizeTable = (str: string): string => {
      if (!str) return '';
      const clean = str.trim().toLowerCase();
      const match = clean.match(/^([a-z]*)[^a-z0-9]*0*([0-9]+)$/);
      if (match) {
        let prefix = match[1] || 't';
        if (prefix === 'table' || prefix === 'tb') prefix = 't';
        const num = parseInt(match[2], 10);
        return `${prefix}-${num}`;
      }
      return clean.replace(/[^a-z0-9]/g, '');
    };

    const normInput = normalizeTable(cleanTableParam);

    const targetTable = effectiveTables.find(t => {
      const matchesRest = !t.restaurantId || t.restaurantId.toLowerCase() === targetRest.id.toLowerCase();
      if (!matchesRest) return false;

      const normNum = normalizeTable(t.number);
      const normId = normalizeTable(t.id);

      if (t.number.toLowerCase() === cleanTableParam.toLowerCase()) return true;
      if (t.id.toLowerCase() === cleanTableParam.toLowerCase()) return true;
      if (normNum && normNum === normInput) return true;
      if (normId && normId === normInput) return true;
      return false;
    });

    if (!targetTable) {
      return {
        isValid: false,
        restaurantId: targetRest.id,
        restaurantName: targetRest.name,
        tableId: '',
        tableNumber: cleanTableParam,
        taxRate: targetRest.taxRate ?? 5,
        errorReason: `Table '${cleanTableParam}' is not registered at ${targetRest.name}.`
      };
    }

    return {
      isValid: true,
      restaurantId: targetRest.id,
      restaurantName: targetRest.name,
      tableId: targetTable.id,
      tableNumber: targetTable.number,
      taxRate: targetRest.taxRate ?? 5
    };
  };

  /**
   * Dispatches a secure 6-digit OTP for Customer Mobile Verification via server API.
   * Uses one coherent session-only credential pair bound to the server-resolved table.
   */
  const selfSeatCustomerFromQr = async (tableId:string,outletId:string):Promise<{success:boolean;error?:string}> => {
    const credentials = guestQrContext.credentials(tableId,outletId);
    if (!credentials) return {success:false,error:'Scan the original secure QR on your table.'};
    try {
      const seated = await api.guestSelfSeat({...credentials,guestCount:1});
      const current = guestQrContext.credentials(tableId,outletId);
      if (!current || current.qrPublicCode!==credentials.qrPublicCode || current.qrSecretToken!==credentials.qrSecretToken
          || seated.tableId!==tableId || seated.outletId!==outletId) {
        return {success:false,error:'Table QR changed. Scan again.'};
      }
      api.setGuestToken(seated.token);
      const session:CustomerDiningSession = {
        sessionId:seated.sessionId,customerId:`guest-${seated.sessionId}`,customerName:'Resort Guest',
        mobileNumber:'',maskedMobile:'',restaurantId:seated.outletId,tableId:seated.tableId,
        tableNumber:seated.tableNumber,startedAt:seated.openedAt,verifiedAt:'',status:'active'
      };
      setCustomerSession(session);
      return {success:true};
    } catch(error:any) { return {success:false,error:error.detail || error.message || 'Unable to seat this table'}; }
  };

  const sendCustomerOTP = async (phone:string,tableId?:string,restaurantId?:string,tableNumber?:string,name?:string):Promise<{success:boolean;error?:string;requestId?:string;sessionTokenId?:string}> => {
    const validation=validateIndianMobile(phone);
    if(!validation.isValid) return {success:false,error:validation.error};
    const credentials=guestQrContext.credentials(tableId,restaurantId);
    if(!credentials) return {success:false,error:'Please scan the secure ordering QR provided by floor staff. The public menu remains available.'};
    try {
      const res=await api.guestRequestOtp({...credentials,phone:validation.rawDigits,name});
      const currentCredentials=guestQrContext.credentials(tableId,restaurantId);
      if(!currentCredentials || currentCredentials.qrPublicCode!==credentials.qrPublicCode || currentCredentials.qrSecretToken!==credentials.qrSecretToken) return {success:false,error:'The scanned table changed. Please request a new verification code.'};
      setSessionTokenId(res.sessionTokenId);setPendingCustomerPhone(validation.rawDigits);setPendingCustomerName(name || '');
      setActiveOtpRequest({requestId:res.sessionTokenId,mobileNumber:validation.rawDigits,maskedMobile:maskMobileNumber(validation.rawDigits),restaurantId:restaurantId || '',tableId:tableId || '',tableNumber:tableNumber || '',otpCode:'',expiresAt:Date.now()+res.expiresInSeconds*1000,attempts:0,maxAttempts:3,lastSentAt:Date.now(),isDevMode:false,devOtp:res.devOtp});
      return {success:true,requestId:res.sessionTokenId,sessionTokenId:res.sessionTokenId};
    }catch(error:any){return {success:false,error:error.detail || error.message};}
  };
  const verifyCustomerOTP = async (otp:string,customerName?:string):Promise<{success:boolean;session?:CustomerDiningSession;error?:string;isExpired?:boolean;isLocked?:boolean}> => {
    const id=sessionTokenId || activeOtpRequest?.requestId;
    const credentials=guestQrContext.credentials(activeOtpRequest?.tableId,activeOtpRequest?.restaurantId);
    if(!id || !credentials) return {success:false,error:'Request a verification code for this table first.'};
    try {
      const verified=await api.guestVerifyOtp(id,otp);
      const currentCredentials=guestQrContext.credentials(activeOtpRequest?.tableId,activeOtpRequest?.restaurantId);
      if(!currentCredentials || currentCredentials.qrPublicCode!==credentials.qrPublicCode || currentCredentials.qrSecretToken!==credentials.qrSecretToken) {if(api.getGuestToken()===verified.token) api.setGuestToken(null);return {success:false,error:'The scanned table changed. Please request a new verification code.'};}
      const server=await api.getGuestSession();
      if(!guestQrContext.credentials(server.tableId,server.outletId)) {if(api.getGuestToken()===verified.token) api.setGuestToken(null);return {success:false,error:'Verification belongs to a different table. Please scan again.'};}
      if(activeOtpRequest?.tableId && activeOtpRequest.tableId!==server.tableId) {api.setGuestToken(null);return {success:false,error:'Verification belongs to a different table. Please scan again.'};}
      const session:CustomerDiningSession={sessionId:server.sessionId,customerId:`guest-${server.sessionId}`,customerName:customerName?.trim() || pendingCustomerName || server.customerName || 'Resort Guest',mobileNumber:pendingCustomerPhone,maskedMobile:maskMobileNumber(pendingCustomerPhone),restaurantId:server.outletId,tableId:server.tableId,tableNumber:server.tableNumber,startedAt:server.openedAt,verifiedAt:new Date().toISOString(),status:'active'};
      setCustomerSession(session);setActiveOtpRequest(null);setSessionTokenId(null);
      return {success:true,session};
    }catch(error:any){const message=error.detail || error.message;return {success:false,error:message,isExpired:/expired/i.test(message),isLocked:/maximum|exceeded/i.test(message)};}
  };
  const resendCustomerOTP = async ():Promise<{success:boolean;error?:string}> => {
    if(!activeOtpRequest) return {success:false,error:'Request a verification code first.'};
    return sendCustomerOTP(pendingCustomerPhone || activeOtpRequest.mobileNumber,activeOtpRequest.tableId,activeOtpRequest.restaurantId,activeOtpRequest.tableNumber,pendingCustomerName);
  };

  /**
   * Ends current customer dining session and removes credentials from browser storage.
   * Leaves table orders, bills, and table status untouched.
   */
  const endCustomerDiningSession = () => {
    if(api.getGuestToken()) void api.request('/guest/logout',{method:'POST',isGuest:true}).catch(()=>{});
    api.setGuestToken(null);
    if (customerSession) {
      addAuditLog(
        'Customer Session Ended',
        'Customer Dining',
        `Session ended for ${customerSession.customerName} (${customerSession.maskedMobile}) at Table ${customerSession.tableNumber}`,
        'SUCCESS'
      );
    }
    setCustomerSession(null);
    setActiveOtpRequest(null);
    setSessionTokenId(null);setPendingCustomerPhone('');setPendingCustomerName('');
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('pali_customer_dining_session');
        localStorage.removeItem('pali_customer_dining_session');
      } catch (e) {}
    }
  };

  /**
   * Updates customer name in active session and customer record.
   */
  const updateCustomerSessionName = (name: string) => {
    const clean = name.trim();
    if (!clean) return;

    if (customerSession) {
      setCustomerSession(prev => prev ? { ...prev, customerName: clean } : null);
      setCustomers(prev =>
        prev.map(c => c.id === customerSession.customerId ? { ...c, name: clean } : c)
      );
    }
  };


  // Multi-Tenant Scoping:
  // If user is not SUPER_ADMIN, effective restaurant is strictly their assigned restaurantId ('rest-1').
  const effectiveRestaurantId = currentUser.role !== 'SUPER_ADMIN'
    ? (currentUser.restaurantId || 'rest-1')
    : activeRestaurantId;

  const activeRestaurant = restaurants.find(r => r.id === effectiveRestaurantId) || restaurants[0];

  const switchRestaurant = (id: string) => {
    if (currentUser.role !== 'SUPER_ADMIN') {
      console.warn('RBAC Security: Non-Super-Admin accounts cannot switch tenant restaurant');
      return; // Cannot escape tenant
    }
    if(id===activeRestaurantId)return;
    loadCoordinator.invalidate();
    setActiveRestaurantId(id);
    addAuditLog('Tenant Outlets Switched', 'Multi-Tenant', `Switched active restaurant view to ${id}`);
  };

  const addRestaurant = (resData: Omit<Restaurant, 'id' | 'createdAt'>) => {
    const newRest: Restaurant = {
      ...resData,
      id: `rest-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setRestaurants(prev => [...prev, newRest]);
    addAuditLog('Restaurant Provisioned', 'Multi-Tenant', `Created new restaurant outlet: ${newRest.name}`);
  };

  // Sync browser URL with routing
  useEffect(() => {
    const handleUrlChange = () => {
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        setCurrentRoute(window.location.hash.slice(1));
      } else {
        const full = window.location.pathname + (window.location.search || '');
        setCurrentRoute(full);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const pushRoute = (path: string) => {
    setCurrentRoute(path);
    if (typeof window !== 'undefined') {
      const currentFull = window.location.pathname + (window.location.search || '');
      if (currentFull !== path) {
        window.history.pushState({}, '', path);
      }
    }
  };

  const addAuditLog = (action: string, module: string, details: string, status: 'SUCCESS' | 'WARNING' | 'DENIED' = 'SUCCESS') => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module,
      details,
      timestamp: new Date().toISOString(),
      ipAddress: 'Unavailable in browser activity',
      status
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  /**
   * Account-Based Authentication
   * Authenticates against backend Express API POST /api/v1/auth/staff-login
   * Role and permissions come strictly from database records.
   */
  const login = async (
    emailOrPhone: string,
    password?: string
  ): Promise<{ success: boolean; error?: string; unlockAt?: string; user?: User }> => {
    if (!password) {
      return {
        success: false,
        error: 'Password is required to sign in.'
      };
    }

    try {
      const res = await api.staffLogin({
        identifier: emailOrPhone.trim(),
        password
      });

      if (!res || !res.staff) {
        return {
          success: false,
          error: 'Authentication failed. Please check your credentials.'
        };
      }

      const primaryRole = selectPrimaryRole(res.roles || []);
      const sUser: User = {
        id: res.staff.id,
        name: `${res.staff.firstName || ''} ${res.staff.lastName || ''}`.trim() || res.staff.employeeCode,
        email: res.staff.email || '',
        phone: res.staff.phone || '',
        role: primaryRole,
        roleTitle: getRoleLabel(primaryRole),
        department: '',
        branch: 'Pali Resort & Club',
        restaurantId: res.outlets?.find(outlet=>outlet.isPrimary)?.outletId || res.outlets?.[0]?.outletId || '',
        roles: (res.roles || []).map(role=>role.id),
        permissions: res.permissions || [],
        moduleAccess: res.moduleAccess || {},
        avatar: '/palilogo.png',
        status: 'active',
        lastLogin: new Date().toISOString()
      };

      setPreviewRole(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sUser));
      }

      loadCoordinator.invalidate();
      setActiveRestaurantId(sUser.restaurantId || '');
      setCurrentUser(sUser);
      setIsAuthenticated(true);
      setAuthRole(primaryRole);
      setIsAuthLoading(false);

      addAuditLog(`User Authenticated (${sUser.role})`, 'Security & Auth', `Session started by ${sUser.name}`);

      let targetRedirect = getDefaultDashboardRoute(sUser.role);
      if (typeof window !== 'undefined') {
        const savedTarget = sessionStorage.getItem('pali_target_route');
        if (savedTarget && savedTarget !== '/login' && savedTarget !== '/' && checkRouteAccess(savedTarget, primaryRole, sUser).allowed) {
          targetRedirect = savedTarget;
          sessionStorage.removeItem('pali_target_route');
        }
      }
      pushRoute(targetRedirect);

      return {
        success: true,
        user: sUser
      };
    } catch (err: any) {
      const msg = err?.problem?.detail || err?.message || 'Invalid credentials. Please verify your identifier and password.';
      addAuditLog('Authentication Failed', 'Security & Auth', `Failed login attempt for: ${emailOrPhone}`, 'DENIED');
      return {
        success: false,
        error: msg,
        unlockAt: typeof err?.problem?.unlockAt === 'string' ? err.problem.unlockAt : undefined
      };
    }
  };

  /**
   * Super Admin Role Testing / Preview Capability
   * Strictly forbidden for non-Super-Admin accounts. Does NOT modify the database or permanent user.
   */
  const switchRole = (role: UserRole) => {
    if (currentUser.role !== 'SUPER_ADMIN') {
      console.warn('RBAC Security: Non-Super-Admin accounts are strictly forbidden from switching roles.');
      return;
    }

    if (role === 'SUPER_ADMIN') {
      setPreviewRole(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      }
      addAuditLog('Role Preview Ended', 'Security & RBAC', 'Super Admin returned to Super Admin console');
      pushRoute('/super-admin/dashboard');
    } else {
      setPreviewRole(role);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(PREVIEW_STORAGE_KEY, role);
      }
      addAuditLog('Role Preview Started', 'Security & RBAC', `Super Admin previewing operational role: ${role}`);
      pushRoute(getDefaultDashboardRoute(role));
    }
  };

  const exitPreviewRole = () => {
    if (currentUser.role === 'SUPER_ADMIN') {
      setPreviewRole(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      }
      addAuditLog('Role Preview Ended', 'Security & RBAC', 'Super Admin returned to Super Admin console');
      pushRoute('/super-admin/dashboard');
    }
  };

  /**
   * Logout - Clears session and revokes access on the server
   */
  const logout = () => {
    loadCoordinator.invalidate();
    addAuditLog('User Logged Out', 'Security & Auth', `${currentUser.name || 'User'} signed out of session`);
    setIsAuthenticated(false);
    setCurrentUser(EMPTY_USER);
    setAuthRole(null);
    setIsAuthLoading(false);
    api.staffLogout();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    }
    setPreviewRole(null);
    pushRoute('/login');
  };

  const createRestaurantOrder = async (order:Partial<Order>,key:string):Promise<void> => {
    if(!api.getStaffToken()) throw new Error('Staff authorization required.');
    if(!order.tableId) throw new Error('Select a dining table before placing an order.');
    await api.createStaffOrder({outletId:order.restaurantId || activeRestaurantId,tableId:order.tableId,
      items:(order.items || []).map(item=>({menuItemId:item.menuItemId,quantity:item.quantity,notes:item.notes})),specialInstructions:order.notes},
      {idempotencyKey:key});
    await refreshRestaurantData(order.restaurantId || activeRestaurantId);
  };

  const addOrder = (orderData: Partial<Order>): string => {
    const orderNum = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const newId = `ord-${Date.now()}`;
    const targetRestId = orderData.restaurantId || effectiveRestaurantId;
    const targetRest = restaurants.find(r => r.id === targetRestId);
    const taxRate = targetRest?.taxRate ?? 5;

    const subtotal = orderData.items?.reduce((acc, item) => acc + item.price * item.quantity, 0) || 0;
    const gstAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const grandTotal = subtotal + gstAmount;

    const newOrder: Order = {
      id: newId,
      restaurantId: targetRestId,
      orderNumber: orderNum,
      type: orderData.type || 'dine-in',
      tableId: orderData.tableId,
      tableNumber: orderData.tableNumber,
      roomNumber: orderData.roomNumber,
      guestName: orderData.guestName || 'Walk-in Guest',
      items: orderData.items || [],
      status: 'preparing',
      paymentStatus: 'pending',
      subtotal,
      gstAmount,
      discount: 0,
      grandTotal,
      waiterName: currentUser.name,
      createdAt: 'Just now',
      notes: orderData.notes
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update table status if dine-in
    if (orderData.tableNumber) {
      setTables(prev =>
        prev.map(t =>
          t.number === orderData.tableNumber
            ? { ...t, status: 'occupied', currentOrderId: newId, guestCount: 2, occupiedSince: 'Just now' }
            : t
        )
      );
    }

    // Push to KDS
    const newTicket: KitchenTicket = {
      id: `kt-${Date.now()}`,
      restaurantId: targetRestId,
      orderId: newId,
      orderNumber: `KOT-${Math.floor(400 + Math.random() * 99)}`,
      destination: orderData.tableNumber ? `Table ${orderData.tableNumber}` : (orderData.roomNumber || 'Counter / Takeaway'),
      orderType: orderData.type || 'dine-in',
      items: (orderData.items || []).map(i => ({
        id: `ki-${Date.now()}-${i.id}`,
        name: i.name,
        quantity: i.quantity,
        isVeg: i.isVeg,
        notes: i.notes,
        status: 'new'
      })),
      status: 'new',
      createdAt: 'Just now',
      elapsedMinutes: 1,
      priority: 'normal',
      specialInstructions: orderData.notes
    };

    setKitchenTickets(prev => [newTicket, ...prev]);

    // Notify kitchen
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        title: `New Order ${orderNum}`,
        message: `${newTicket.destination}: ${newOrder.items.length} items queued for preparation.`,
        type: 'info',
        targetRoles: ['KITCHEN_STAFF', 'RESTAURANT_MANAGER', 'SUPER_ADMIN'],
        createdAt: 'Just now',
        read: false,
        link: '/kitchen/orders'
      },
      ...prev
    ]);

    addAuditLog('New Order Placed', 'Restaurant & KDS', `Order ${orderNum} placed for ${newTicket.destination} (₹${grandTotal})`);
    return newId;
  };

  /**
   * Authoritative, server-side validated customer QR ordering service.
   * Dispatches order to server via api.guestPlaceOrder without local order creation.
   */
  const placeCustomerQROrder = async (req: PlaceQROrderRequest): Promise<PlaceQROrderResult> => {
    try {
      const idempotencyKey = `qr-${req.sessionTableId || req.sessionTableNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const serverOrder = await api.guestPlaceOrder(
        {
          items: req.items.map(it => ({
            menuItemId: it.menuItemId,
            quantity: it.quantity,
            customizationNotes: it.notes || (it.selectedPortionLabel && it.selectedPortionLabel !== 'Standard' ? it.selectedPortionLabel : undefined)
          })),
          specialInstructions: req.notes
        },
        { idempotencyKey }
      );

      const order: Order = {
        id: serverOrder.id,
        orderNumber: serverOrder.orderNumber ? `ORD-${serverOrder.orderNumber}` : `ORD-${serverOrder.id.slice(-4)}`,
        restaurantId: req.sessionRestaurantId,
        tableId: req.sessionTableId,
        tableNumber: req.sessionTableNumber,
        customerId: req.customerId || `guest-${Date.now()}`,
        customerName: req.guestName || `Table ${req.sessionTableNumber} Guest`,
        items: (serverOrder.items || []).map((it: any) => ({
          id: it.id || `item-${Math.random()}`,
          menuItemId: it.menuItemId || it.menu_item_id,
          name: it.name || it.menuItemName || 'Menu Item',
          quantity: it.quantity,
          price: (it.unitPricePaise || it.pricePaise || 0) / 100,
          totalPrice: (it.totalPricePaise || 0) / 100,
          isVeg: it.isVeg ?? it.is_veg ?? true,
          status: it.status || 'ordered',
          notes: it.customizationNotes || it.notes,
          kitchenStationCode: it.kitchenStationCode,
          round: serverOrder.roundNumber || 1
        })),
        subtotal: (serverOrder.subtotalPaise || 0) / 100,
        tax: (serverOrder.taxPaise || 0) / 100,
        discount: 0,
        tipAmount: 0,
        grandTotal: (serverOrder.totalPaise || 0) / 100,
        status: (serverOrder.status as any) || 'placed',
        paymentStatus: 'pending',
        orderedAt: serverOrder.createdAt || new Date().toISOString(),
        notes: req.notes
      };

      addAuditLog(
        'QR Order Placed',
        'Restaurant & KDS',
        `Order ${order.orderNumber} placed for Table ${req.sessionTableNumber} (Bill: ₹${order.grandTotal})`,
        'SUCCESS'
      );

      return { success: true, orderId: serverOrder.id, order };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to place order with server' };
    }
  };

  /**
   * Authoritative Waiter Order placement service.
   * Associates Customer + Table + Menu (Food & Bar), validates items, merges into active table order,
   * calculates authoritative prices, taxes and tip (with explicit confirmation), and routes to KDS.
   */
  const placeWaiterOrder = (req: PlaceWaiterOrderRequest): PlaceQROrderResult => {
    const targetRest = restaurants.find(r => r.id === req.restaurantId) || activeRestaurant || restaurants[0];
    const targetTable = tables.find(
      t => (t.id === req.tableId || t.number === req.tableNumber) && t.restaurantId === targetRest.id
    );

    if (!targetTable) {
      return { success: false, error: 'Table not found in selected restaurant.' };
    }

    if (!req.items || req.items.length === 0) {
      return { success: false, error: 'Please select items to punch order.' };
    }

    const verifiedOrderItems: OrderItem[] = [];
    for (let i = 0; i < req.items.length; i++) {
      const it = req.items[i];
      if (!it.quantity || it.quantity <= 0) continue;

      const dbItem = menuItems.find(m => m.id === it.menuItemId);
      if (!dbItem) continue;

      let unitPrice = dbItem.price;
      let displayName = dbItem.name;
      if (it.selectedPortionLabel && it.selectedPortionLabel !== 'Standard' && dbItem.portionOptions && dbItem.portionOptions.length > 0) {
        const matched = dbItem.portionOptions.find(
          p => p.label.toLowerCase() === it.selectedPortionLabel?.toLowerCase()
        );
        if (matched) {
          unitPrice = matched.price;
          displayName = `${dbItem.name} (${matched.label})`;
        }
      }

      const isDrink = dbItem.menuType === 'drink' ||
        dbItem.categoryId.includes('spirit') ||
        dbItem.categoryId.includes('scotch') ||
        dbItem.categoryId.includes('wine') ||
        dbItem.categoryId.includes('beer') ||
        dbItem.categoryId.includes('cocktail') ||
        dbItem.categoryId.includes('beverage');

      verifiedOrderItems.push({
        id: `oi-${Date.now()}-${i}`,
        menuItemId: dbItem.id,
        name: displayName,
        price: unitPrice,
        quantity: it.quantity,
        isVeg: dbItem.isVeg,
        notes: it.notes,
        status: 'pending',
        menuType: isDrink ? 'drink' : 'food',
        categoryName: dbItem.categoryName,
        portionLabel: it.selectedPortionLabel
      });
    }

    if (verifiedOrderItems.length === 0) {
      return { success: false, error: 'No valid items could be verified.' };
    }

    const foodItems = verifiedOrderItems.filter(i => i.menuType !== 'drink');
    const barItems = verifiedOrderItems.filter(i => i.menuType === 'drink');
    const newFoodSubtotal = foodItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const newBarSubtotal = barItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const verifiedSubtotal = newFoodSubtotal + newBarSubtotal;
    const taxRate = targetRest.taxRate ?? 5;
    const verifiedGst = Math.round((verifiedSubtotal * taxRate) / 100);
    const requestedTip = Math.max(0, req.tipAmount || 0);

    const existingActiveOrder = orders.find(
      o => (o.tableId === targetTable.id || o.tableNumber === targetTable.number) &&
           o.paymentStatus === 'pending' &&
           o.status !== 'cancelled'
    );

    let activeOrderEntity: Order;
    const orderNum = existingActiveOrder ? existingActiveOrder.orderNumber : `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const billNum = existingActiveOrder?.billNumber || `BILL-${Math.floor(1000 + Math.random() * 9000)}`;

    if (existingActiveOrder) {
      const combinedItems = [...existingActiveOrder.items, ...verifiedOrderItems];
      const combinedFoodItems = combinedItems.filter(i => i.menuType !== 'drink');
      const combinedBarItems = combinedItems.filter(i => i.menuType === 'drink');
      const combinedFoodSubtotal = combinedFoodItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const combinedBarSubtotal = combinedBarItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      const combinedSubtotal = combinedFoodSubtotal + combinedBarSubtotal;
      const combinedGst = Math.round((combinedSubtotal * taxRate) / 100);
      const combinedTip = req.tipAmount !== undefined ? requestedTip : (existingActiveOrder.tipAmount || 0);
      const combinedGrandTotal = combinedSubtotal + combinedGst + combinedTip;

      activeOrderEntity = {
        ...existingActiveOrder,
        items: combinedItems,
        foodSubtotal: combinedFoodSubtotal,
        barSubtotal: combinedBarSubtotal,
        subtotal: combinedSubtotal,
        gstAmount: combinedGst,
        tipAmount: combinedTip,
        tipType: req.tipType || existingActiveOrder.tipType || 'none',
        tipPercentage: req.tipPercentage !== undefined ? req.tipPercentage : existingActiveOrder.tipPercentage,
        tipAddedBy: req.tipAmount !== undefined ? 'WAITER' : existingActiveOrder.tipAddedBy,
        grandTotal: combinedGrandTotal,
        billNumber: billNum,
        guestName: req.guestName?.trim() || existingActiveOrder.guestName,
        guestPhone: req.guestPhone || existingActiveOrder.guestPhone,
        roomNumber: req.roomNumber || existingActiveOrder.roomNumber
      };

      setOrders(prev => prev.map(o => (o.id === existingActiveOrder.id ? activeOrderEntity : o)));
    } else {
      const newId = `ord-${Date.now()}`;
      activeOrderEntity = {
        id: newId,
        restaurantId: targetRest.id,
        orderNumber: orderNum,
        billNumber: billNum,
        billStatus: 'unbilled',
        type: 'dine-in',
        tableId: targetTable.id,
        tableNumber: targetTable.number,
        guestName: req.guestName?.trim() || `Table ${targetTable.number} Guest`,
        guestPhone: req.guestPhone,
        roomNumber: req.roomNumber,
        items: verifiedOrderItems,
        status: 'placed',
        paymentStatus: 'pending',
        foodSubtotal: newFoodSubtotal,
        barSubtotal: newBarSubtotal,
        subtotal: verifiedSubtotal,
        gstAmount: verifiedGst,
        discount: 0,
        tipAmount: requestedTip,
        tipType: req.tipType || (requestedTip > 0 ? 'custom' : 'none'),
        tipPercentage: req.tipPercentage,
        tipAddedBy: requestedTip > 0 ? 'WAITER' : undefined,
        grandTotal: verifiedSubtotal + verifiedGst + requestedTip,
        waiterId: currentUser.id,
        waiterName: currentUser.name || targetTable.waiterName || 'Table Captain',
        createdAt: 'Just now',
        notes: req.notes || 'Waiter Punched KOT'
      };

      setOrders(prev => [activeOrderEntity, ...prev]);
    }

    setTables(prev =>
      prev.map(t =>
        t.id === targetTable.id
          ? {
              ...t,
              status: 'occupied',
              currentOrderId: activeOrderEntity.id,
              guestCount: Math.max(t.guestCount || 1, 2),
              occupiedSince: t.occupiedSince || 'Just now'
            }
          : t
      )
    );

    // KDS Routing: Food to Kitchen, Bar to Bar/Beverage
    const allergenList: string[] = [];
    const notesLower = (req.notes || '').toLowerCase();
    if (notesLower.includes('nut') || notesLower.includes('peanut')) allergenList.push('NUTS ALLERGY');
    if (notesLower.includes('no onion') || notesLower.includes('no garlic')) allergenList.push('NO ONION NO GARLIC');
    if (notesLower.includes('jain')) allergenList.push('JAIN PREPARATION');
    if (notesLower.includes('gluten') || notesLower.includes('celiac')) allergenList.push('GLUTEN FREE');
    if (notesLower.includes('dairy') || notesLower.includes('lactose')) allergenList.push('DAIRY FREE');
    if (notesLower.includes('spicy') || notesLower.includes('spice')) allergenList.push('EXTRA SPICY');

    const nowTs = Date.now();
    const isUrgent = notesLower.includes('urgent') || notesLower.includes('vip') || notesLower.includes('priority');

    if (foodItems.length > 0) {
      const foodTicket: KitchenTicket = {
        id: `kt-${nowTs}-food`,
        restaurantId: targetRest.id,
        orderId: activeOrderEntity.id,
        orderNumber: `KOT-${Math.floor(400 + Math.random() * 99)}`,
        destination: `Table ${targetTable.number}`,
        tableNumber: targetTable.number,
        guestName: req.guestName?.trim() || activeOrderEntity.guestName,
        waiterName: currentUser.name,
        orderType: 'dine-in',
        station: 'Grill & Tandoor',
        items: foodItems.map(i => ({
          id: `ki-${nowTs}-${i.id}`,
          name: i.name,
          quantity: i.quantity,
          isVeg: i.isVeg,
          notes: i.notes,
          status: 'new'
        })),
        status: 'new',
        createdAt: 'Just now',
        createdAtTimestamp: nowTs,
        elapsedMinutes: 0,
        priority: isUrgent ? 'urgent' : 'normal',
        specialInstructions: req.notes,
        allergens: allergenList.length > 0 ? allergenList : undefined
      };
      setKitchenTickets(prev => [foodTicket, ...prev]);
    }

    if (barItems.length > 0) {
      const barTicket: KitchenTicket = {
        id: `kt-${nowTs}-bar`,
        restaurantId: targetRest.id,
        orderId: activeOrderEntity.id,
        orderNumber: `BOT-${Math.floor(500 + Math.random() * 99)}`,
        destination: `Table ${targetTable.number}`,
        tableNumber: targetTable.number,
        guestName: req.guestName?.trim() || activeOrderEntity.guestName,
        waiterName: currentUser.name,
        orderType: 'dine-in',
        station: 'Dessert & Beverages',
        items: barItems.map(i => ({
          id: `ki-${nowTs}-${i.id}`,
          name: i.name,
          quantity: i.quantity,
          isVeg: true,
          notes: i.notes,
          status: 'new'
        })),
        status: 'new',
        createdAt: 'Just now',
        createdAtTimestamp: nowTs,
        elapsedMinutes: 0,
        priority: isUrgent ? 'urgent' : 'normal',
        specialInstructions: req.notes,
        allergens: allergenList.length > 0 ? allergenList : undefined
      };
      setKitchenTickets(prev => [barTicket, ...prev]);
    }

    addAuditLog(
      'Waiter Order Placed',
      'WAITER DASHBOARD',
      `Order ${activeOrderEntity.orderNumber} punched by ${currentUser.name} for Table ${targetTable.number} (₹${activeOrderEntity.grandTotal})`,
      'SUCCESS'
    );

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineAction('WAITER_ORDER', req).catch(err => console.warn('Offline enqueue error:', err));
    }

    return { success: true, orderId: activeOrderEntity.id, order: activeOrderEntity };
  };

  /**
   * Authoritative Single Source of Truth for Table Bills.
   * Synchronized across Customer QR and Waiter views.
   */
  const getTableBill = (tableIdOrNumber: string): TableBill | null => {
    const table = tables.find(
      t => t.id === tableIdOrNumber || t.number.toLowerCase() === tableIdOrNumber.toLowerCase()
    );
    if (!table) return null;

    const order =
      (table.currentOrderId ? orders.find(o => o.id === table.currentOrderId) : null) ||
      orders.find(o => (o.tableId === table.id || o.tableNumber === table.number || (table.activeSessionId && (o as any).diningSessionId === table.activeSessionId)) && o.paymentStatus !== 'paid' && o.status !== 'cancelled') ||
      orders.find(o => (o.tableId === table.id || o.tableNumber === table.number || (table.activeSessionId && (o as any).diningSessionId === table.activeSessionId)) && o.status !== 'cancelled');

    if (!order) return null;

    const rest = restaurants.find(r => r.id === order.restaurantId || r.id === table.restaurantId) || restaurants[0];
    const taxRate = 5; // Statutory 5% GST (2.5% CGST + 2.5% SGST)

    const foodItems = order.items.filter(i => i.menuType !== 'drink');
    const barItems = order.items.filter(i => i.menuType === 'drink');
    const foodSubtotal = order.foodSubtotal ?? foodItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const barSubtotal = order.barSubtotal ?? barItems.reduce((acc, it) => acc + it.price * it.quantity, 0);

    // Calculate in server-authoritative integer paise
    const subtotalPaise = Math.round((foodSubtotal + barSubtotal) * 100);
    const cgstPaise = Math.round((subtotalPaise * 25) / 1000);
    const sgstPaise = Math.round((subtotalPaise * 25) / 1000);
    const grandTotalPaise = subtotalPaise + cgstPaise + sgstPaise;
    const tipAmount = order.tipAmount ?? 0;

    return {
      id: order.id,
      diningSessionId: table.activeSessionId,
      billNumber: order.billNumber || `BILL-${order.orderNumber.replace('ORD-', 'B')}`,
      orderId: order.id,
      tableId: table.id,
      tableNumber: table.number,
      restaurantId: rest.id,
      restaurantName: rest.name,
      guestName: customerSession?.customerName || order.guestName || `Table ${table.number} Guest`,
      guestPhone: customerSession?.mobileNumber || order.guestPhone,
      roomNumber: order.roomNumber,
      foodItems,
      barItems,
      foodSubtotal,
      barSubtotal,
      subtotal: subtotalPaise / 100,
      taxRate,
      taxAmount: (cgstPaise + sgstPaise) / 100,
      tipAmount,
      tipType: order.tipType || (tipAmount > 0 ? 'custom' : 'none'),
      tipPercentage: order.tipPercentage,
      tipAddedBy: order.tipAddedBy,
      grandTotal: grandTotalPaise / 100,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      billStatus: order.billStatus || (table.status === 'billed' ? 'requested' : 'unbilled'),
      createdAt: order.createdAt,
      subtotalPaise,
      cgstPaise,
      sgstPaise,
      grandTotalPaise,
      balancePaise: order.paymentStatus === 'paid' ? 0 : grandTotalPaise,
      paidPaise: order.paymentStatus === 'paid' ? grandTotalPaise : 0
    };
  };

  /**
   * Request bill from customer or waiter side.
   * Creates service request and marks table as billed.
   */
  const requestTableBill = (tableIdOrNumber: string): { success: boolean; bill?: TableBill; error?: string } => {
    const table = tables.find(
      t => t.id === tableIdOrNumber || t.number.toLowerCase() === tableIdOrNumber.toLowerCase()
    );
    if (!table) return { success: false, error: 'Table not found' };

    setTables(prev =>
      prev.map(t => (t.id === table.id ? { ...t, status: 'billed' } : t))
    );

    const activeOrder = orders.find(
      o => (o.tableId === table.id || o.tableNumber === table.number) && o.paymentStatus !== 'paid'
    );

    if (activeOrder) {
      setOrders(prev =>
        prev.map(o => (o.id === activeOrder.id ? { ...o, billStatus: 'requested', billRequestedAt: 'Just now' } : o))
      );
    }

    callWaiter(table.number, 'Bill');
    addAuditLog('Bill Requested', 'Dining & Service', `Table ${table.number} requested active table bill`);

    const bill = getTableBill(table.id);
    return { success: true, bill: bill || undefined };
  };

  /**
   * Update Tip on an existing active order (with audit recording).
   */
  const updateOrderTip = (
    orderId: string,
    tipAmount: number,
    tipType: 'none' | '5%' | '10%' | '15%' | 'custom',
    tipPercentage?: number,
    tipAddedBy: 'CUSTOMER' | 'WAITER' = 'CUSTOMER'
  ) => {
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId || o.orderNumber === orderId) {
          const newTip = Math.max(0, tipAmount);
          const newGrand = o.subtotal + o.gstAmount + newTip;
          return {
            ...o,
            tipAmount: newTip,
            tipType,
            tipPercentage,
            tipAddedBy,
            grandTotal: newGrand
          };
        }
        return o;
      })
    );
    addAuditLog('Tip Updated', 'Dining & Billing', `Tip of ₹${tipAmount} added by ${tipAddedBy} for order ${orderId}`);
  };

  /**
   * Process and settle table payment with full idempotency and receipt tracking.
   */
  const processTablePayment = (_orderId:string,_method:PaymentMethod,_amount:number,_tipAmount?:number):{success:boolean;txnId?:string;error?:string} => ({success:false,error:'Payment must be recorded through authorized cashier billing.'});

  const settleTableBill = async (
    orderId: string,
    method: PaymentMethod = 'cash',
    amount?: number,
    idempotencyKey?: string
  ): Promise<{ success: boolean; txnId?: string; error?: string; billSummary?: any }> => {
    let order = orders.find(o => o.id === orderId || o.orderNumber === orderId);
    let table = tables.find(t => (order && (t.id === order.tableId || t.number === order.tableNumber)) || t.id === orderId || t.number === orderId);

    // If order was not directly matched by ID, try matching via table
    if (!order && table) {
      order = orders.find(o => (o.tableId === table.id || o.tableNumber === table.number || (table.activeSessionId && (o as any).diningSessionId === table.activeSessionId)) && o.paymentStatus !== 'paid');
    }

    if (!order && !table?.activeSessionId) return { success: false, error: 'Order not found' };

    if (!table && order) {
      table = tables.find(t => t.id === order.tableId || t.number === order.tableNumber);
    }
    const key = idempotencyKey || generateIdempotencyKey();

    // Map method to server uppercase tender type
    let serverMethod: 'CASH' | 'CARD' | 'UPI' | 'ROOM_FOLIO' = 'CASH';
    const mLower = method.toLowerCase();
    if (mLower === 'card') serverMethod = 'CARD';
    else if (mLower === 'upi') serverMethod = 'UPI';
    else if (mLower.includes('room') || mLower.includes('folio')) serverMethod = 'ROOM_FOLIO';
    else serverMethod = 'CASH';

    // If staff token exists, call server settlement API
    if (api.getStaffToken()) {
      try {
        let serverRes: any;
        const sessionId = table?.activeSessionId;
        const amountPaise = amount !== undefined ? Math.round(amount * 100) : (order?.grandTotal ? Math.round(order.grandTotal * 100) : undefined);

        if (sessionId) {
          serverRes = await api.settleSessionBill(
            sessionId,
            {
              paymentMethod: serverMethod,
              amountPaise
            },
            { idempotencyKey: key }
          );
        } else if (order?.billNumber && !order.billNumber.startsWith('BILL-ORD')) {
          serverRes = await api.recordBillPayment(
            order.billNumber,
            {
              paymentMethod: serverMethod,
              amountPaise: amountPaise || Math.round((order.grandTotal || 0) * 100)
            },
            { idempotencyKey: key }
          );
        }

        if (serverRes) {
          const billSummary = serverRes.billSummary;
          if(!serverRes.id || serverRes.status!=='CAPTURED') return {success:false,error:'Payment was not captured by the server.'};
          const txnId = serverRes.id;

          // Update order locally from server response
          if (order && billSummary?.balancePaise===0) {
            setOrders(prev =>
              prev.map(o =>
                o.id === order.id
                  ? {
                      ...o,
                      paymentStatus: 'paid',
                      paymentMethod: method,
                      status: 'completed',
                      billStatus: 'settled',
                      grandTotal: billSummary?.grandTotalPaise ? billSummary.grandTotalPaise / 100 : o.grandTotal
                    }
                  : o
              )
            );
          }

          // Free table to available
          const targetTableNum = order?.tableNumber || table?.number;
          const targetTableId = order?.tableId || table?.id;
          if (billSummary?.balancePaise===0 && (targetTableNum || targetTableId)) {
            setTables(prev =>
              prev.map(t =>
                (targetTableNum && t.number === targetTableNum) || (targetTableId && t.id === targetTableId)
                  ? { ...t, status: 'available', currentOrderId: undefined, activeSessionId: undefined }
                  : t
              )
            );
          }

          // Refresh live data from backend
          if (activeRestaurantId) {
            refreshRestaurantData(activeRestaurantId).catch(() => {});
          }

          addAuditLog(
            'Table Payment Settled (Server)',
            'Billing & Payments',
            `Table ${targetTableNum || 'Table'} bill settled via ${serverMethod} on server (Idempotency Key: ${key}). Table freed.`,
            'SUCCESS'
          );

          return { success: true, txnId, billSummary };
        }
      } catch (err: any) {
        const errorMsg = err.detail || err.message || 'Failed to settle bill on server';
        return { success: false, error: errorMsg };
      }
    }

    return {success:false,error:'A persisted bill and authorized staff cashier session are required.'};
  };

  const fetchSettlementRequests = useCallback(async (outletId = loadOutletId) => {
    if (!api.getStaffToken()) return;
    try {
      const res = await api.listSettlementRequests(outletId);
      if (res && Array.isArray(res.items)) {
        setSettlementRequests(res.items);
      }
    } catch {
      // Ignored
    }
  }, [loadOutletId]);

  const requestSettlementForSession = async (
    sessionId: string,
    options?: { paymentMethodPreference?: 'CASH' | 'UPI' | 'CARD' | 'ROOM_FOLIO'; notes?: string }
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      if (!api.getStaffToken()) throw new Error('Staff authorization required.');
      const res = await api.createSettlementRequest(sessionId, options);
      await fetchSettlementRequests();
      await refreshRestaurantData(activeRestaurantId);
      return { success: true, data: res };
    } catch (err: any) {
      const errorMsg = err.detail || err.message || 'Failed to request settlement';
      return { success: false, error: errorMsg };
    }
  };

  const updateSettlementRequest = async (
    requestId: string,
    status: 'ACCEPTED' | 'CANCELLED',
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!api.getStaffToken()) throw new Error('Staff authorization required.');
      await api.updateSettlementRequestStatus(requestId, { status, reason });
      await fetchSettlementRequests();
      await refreshRestaurantData(activeRestaurantId);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err.detail || err.message || 'Failed to update settlement request';
      return { success: false, error: errorMsg };
    }
  };

  const orderMutations = useRef(new Set<string>());
  const updateOrderStatus = async (orderId:string,status:OrderStatus):Promise<{success:boolean;error?:string}> => {
    if(orderMutations.current.has(orderId)) return {success:false,error:'Order update already in progress.'};
    orderMutations.current.add(orderId);
    try {
      if(!api.getStaffToken()) throw new Error('Staff authorization required.');
      const target=status==='completed' ? 'SERVED' : status==='confirmed' ? 'ACCEPTED' : status.toUpperCase();
      if(target==='CANCELLED') await api.cancelOrder(orderId,'Cancelled by authorized staff');
      else await api.updateOrderStatus(orderId,target);
      await refreshRestaurantData(activeRestaurantId);
      return {success:true};
    } catch(err:any) {const error=err.detail || err.message || 'Order update failed.';setRestaurantSyncError(error);return {success:false,error};}
    finally {orderMutations.current.delete(orderId);}
  };
  const updateOrderItemStatus = async (orderId:string,itemId:string,status:OrderItem['status']):Promise<{success:boolean;error?:string}> => {
    try {
      if(!api.getStaffToken()) throw new Error('Staff authorization required.');
      if(status==='cancelled') {
        await api.request(`/orders/${orderId}/items/${itemId}/cancel`,{method:'POST',body:{reason:'Cancelled by authorized staff'}});
        await refreshRestaurantData(activeRestaurantId);return {success:true};
      }
      const tickets=await api.listOutletKots(activeRestaurantId);
      const kot=(tickets.items || []).flatMap((ticket:any)=>ticket.items || []).find((item:any)=>item.orderItemId===itemId);
      if(!kot) throw new Error('Kitchen item not found. Refresh and retry.');
      await api.updateKotItemStatus(kot.id,status.toUpperCase());
      await refreshRestaurantData(activeRestaurantId);return {success:true};
    } catch(err:any) {const error=err.detail || err.message || 'Item update failed.';setRestaurantSyncError(error);return {success:false,error};}
  };

  const settlePayment = (_orderId:string,_method:PaymentMethod,_amount:number):void => {
    throw new Error('Local payment capture is unavailable. Use authorized cashier billing.');
  };

  const updateKitchenTicketStatus = async (ticketId: string, status: KitchenTicketStatus): Promise<{ success: boolean; error?: string }> => {
    if (!api.getStaffToken()) return { success: false, error: 'Staff authorization required.' };
    try {
      if (status === 'accepted') await api.acceptKot(ticketId);
      else if (status === 'preparing') await api.startKot(ticketId);
      else if (status === 'ready') await api.readyKot(ticketId);
      else if (status === 'completed' || status === 'served') await api.serveKot(ticketId);
      else return { success: false, error: 'Unsupported transition. Cancellation requires a recorded reason.' };
      await refreshRestaurantData(activeRestaurantId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.detail || err.message || 'Failed to update ticket status on server' };
    }
  };

  const updateKitchenItemStatus = async (ticketId: string, itemId: string, completed: boolean): Promise<{ success: boolean; error?: string }> => {
    if (!api.getStaffToken()) return { success: false, error: 'Staff authorization required.' };
    const ticket = kitchenTickets.find(t => t.id === ticketId);
    if (!ticket || !ticket.items.some(i => i.id === itemId)) return { success: false, error: 'Kitchen item does not belong to this ticket.' };
    try {
      await api.updateKotItemStatus(itemId, completed ? 'READY' : 'PREPARING');
      await refreshRestaurantData(activeRestaurantId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.detail || err.message || 'Failed to update item status on server' };
    }
  };

  const recallKitchenTicket = (_ticketId: string) => {
    setRestaurantSyncError('Ticket rollback is unavailable. Served tickets are final; create a new authorized order for a remake.');
  };

  const cancelKitchenTicket = async (ticketId: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    if (!api.getStaffToken()) return { success: false, error: 'Staff authorization required.' };
    if (!reason || reason.trim().length < 3 || reason.trim().length > 500) return { success: false, error: 'A cancellation reason of 3 to 500 characters is required.' };
    try {
      await api.cancelKot(ticketId, reason.trim());
      await refreshRestaurantData(activeRestaurantId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.detail || err.message || 'Failed to cancel ticket on server' };
    }
  };

  // Phase 7: Hybrid Restaurant Kitchen Production System Operations
  const toggleKitchenOffline = () => {
    setIsKitchenOffline(prev => {
      const next = !prev;
      addAuditLog(
        next ? 'Kitchen Switched to OFFLINE' : 'Kitchen Switched to ONLINE',
        'Kitchen Production',
        next
          ? 'KDS terminal is now operating offline. Production state stored locally in persistent queue.'
          : 'KDS terminal reconnected to network. Ready to synchronize queued events.'
      );
      return next;
    });
  };

  const prepareProductionItem = (
    aggregatedItemId: string,
    quantityToPrepare: number,
    userId?: string
  ) => {
    const activeItems = aggregateProductionItems(orders, kitchenTickets);
    const item = activeItems.find(i => i.id === aggregatedItemId);
    if (!item) {
      return { success: false, events: [], error: 'Production item not found on active line' };
    }
    if (item.quantityPending <= 0) {
      return { success: false, events: [], error: 'No pending quantity available to prepare' };
    }

    const { events } = allocatePrepareQuantity(
      item,
      quantityToPrepare,
      userId || currentUser.email,
      currentUser.name
    );

    if (events.length === 0) {
      return { success: false, events: [], error: 'Could not allocate preparation quantity' };
    }

    // Apply events to state deterministically
    events.forEach(evt => {
      markEventIdProcessed(evt.eventId);

      // Update Order Items
      setOrders(prev =>
        prev.map(o => {
          if (o.id === evt.orderId) {
            const updatedItems = o.items.map(it => {
              if (it.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...it, status: 'preparing' as const };
              }
              return it;
            });
            let newStatus = o.status;
            if (newStatus === 'placed' || newStatus === 'confirmed') {
              newStatus = 'preparing';
            }
            return { ...o, items: updatedItems, status: newStatus };
          }
          return o;
        })
      );

      // Update KitchenTickets
      setKitchenTickets(prev =>
        prev.map(kt => {
          if (kt.orderId === evt.orderId) {
            const updatedItems = kt.items.map(ki => {
              if (ki.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...ki, status: 'preparing' as const };
              }
              return ki;
            });
            return {
              ...kt,
              items: updatedItems,
              status: kt.status === 'new' || kt.status === 'accepted' ? 'preparing' : kt.status,
              preparingAtTimestamp: kt.preparingAtTimestamp || Date.now()
            };
          }
          return kt;
        })
      );
    });

    if (isKitchenOffline) {
      const offlineEvts = [...getOfflineEvents(), ...events];
      saveOfflineEvents(offlineEvts);
      setProductionEvents(offlineEvts);
    } else {
      setProductionEvents(prev => [...events, ...prev]);
    }

    addAuditLog(
      'Preparation Started',
      'Kitchen Production',
      `Started preparation of ${events.reduce((s, e) => s + e.quantity, 0)}x ${item.menuItemName} (${item.portion})`
    );

    return { success: true, events };
  };

  const readyProductionItem = (
    aggregatedItemId: string,
    quantityToReady: number,
    userId?: string
  ) => {
    const activeItems = aggregateProductionItems(orders, kitchenTickets);
    const item = activeItems.find(i => i.id === aggregatedItemId);
    if (!item) {
      return { success: false, events: [], error: 'Production item not found on active line' };
    }
    if (item.quantityPreparing <= 0) {
      return { success: false, events: [], error: 'No preparing quantity available to mark ready' };
    }

    const { events } = allocateReadyQuantity(
      item,
      quantityToReady,
      userId || currentUser.email,
      currentUser.name
    );

    if (events.length === 0) {
      return { success: false, events: [], error: 'Could not allocate ready quantity' };
    }

    const now = Date.now();
    events.forEach(evt => {
      markEventIdProcessed(evt.eventId);

      // Update Order Items
      setOrders(prev =>
        prev.map(o => {
          if (o.id === evt.orderId) {
            let allItemsReady = true;
            const updatedItems = o.items.map(it => {
              if (it.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...it, status: 'ready' as const };
              }
              if (it.status !== 'ready' && it.status !== 'served') {
                allItemsReady = false;
              }
              return it;
            });

            return {
              ...o,
              items: updatedItems,
              status: allItemsReady ? 'ready' : o.status
            };
          }
          return o;
        })
      );

      // Update KitchenTickets
      setKitchenTickets(prev =>
        prev.map(kt => {
          if (kt.orderId === evt.orderId) {
            const updatedItems = kt.items.map(ki => {
              if (ki.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...ki, status: 'ready' as const, completed: true };
              }
              return ki;
            });
            const allReady = updatedItems.every(i => i.status === 'ready' || i.status === 'completed');
            return {
              ...kt,
              items: updatedItems,
              status: allReady ? 'ready' : kt.status,
              readyAtTimestamp: now
            };
          }
          return kt;
        })
      );

      // Section 19: READY_FOR_SERVICE Event & Waiter Notification
      const isDineIn = evt.serviceType === 'dine-in';
      const destLabel = evt.tableNumber ? `Table ${evt.tableNumber}` : 'Dine-In';

      setNotifications(prev => [
        {
          id: `notif-ready-${evt.eventId}`,
          title: `READY FOR SERVICE: ${destLabel}`,
          message: `${destLabel}: ${evt.quantity} × ${evt.menuItemName} (${item.portion}) marked READY. ${
            isDineIn ? 'Please collect from kitchen counter and deliver.' : 'Ready for customer pickup at takeaway counter.'
          }`,
          type: 'success',
          targetRoles: isDineIn
            ? ['WAITER', 'RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'SUPER_ADMIN']
            : ['RESTAURANT_OWNER', 'RESTAURANT_MANAGER', 'SUPER_ADMIN'],
          createdAt: 'Just now',
          read: false,
          link: '/waiter/orders'
        },
        ...prev
      ]);
    });

    if (isKitchenOffline) {
      const offlineEvts = [...getOfflineEvents(), ...events];
      saveOfflineEvents(offlineEvts);
      setProductionEvents(offlineEvts);
    } else {
      setProductionEvents(prev => [...events, ...prev]);
    }

    addAuditLog(
      'Items Marked Ready',
      'Kitchen Production',
      `Marked ready: ${events.reduce((s, e) => s + e.quantity, 0)}x ${item.menuItemName} (${item.portion})`
    );

    return { success: true, events };
  };

  const handoffProductionItem = (
    aggregatedItemId: string,
    quantityToComplete: number,
    userId?: string
  ) => {
    // Fast Out (Section 13): marks ready items as COMPLETED
    const activeItems = aggregateProductionItems(orders, kitchenTickets);
    const item = activeItems.find(i => i.id === aggregatedItemId);
    if (!item) {
      return { success: false, events: [], error: 'Production item not found on active line' };
    }
    if (item.quantityReady <= 0) {
      return { success: false, events: [], error: 'No ready quantity available to handoff' };
    }

    const { events } = allocateCompleteQuantity(
      item,
      quantityToComplete,
      userId || currentUser.email,
      currentUser.name
    );

    if (events.length === 0) {
      return { success: false, events: [], error: 'Could not allocate complete quantity' };
    }

    events.forEach(evt => {
      markEventIdProcessed(evt.eventId);

      setOrders(prev =>
        prev.map(o => {
          if (o.id === evt.orderId) {
            let allServed = true;
            const updatedItems = o.items.map(it => {
              if (it.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...it, status: 'served' as const };
              }
              if (it.status !== 'served') allServed = false;
              return it;
            });
            return { ...o, items: updatedItems, status: allServed ? 'served' : o.status };
          }
          return o;
        })
      );

      setKitchenTickets(prev =>
        prev.map(kt => {
          if (kt.orderId === evt.orderId) {
            const updatedItems = kt.items.map(ki => {
              if (ki.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...ki, status: 'completed' as const, completed: true };
              }
              return ki;
            });
            const allCompleted = updatedItems.every(i => i.status === 'completed');
            return {
              ...kt,
              items: updatedItems,
              status: allCompleted ? 'completed' : kt.status,
              completedAtTimestamp: Date.now()
            };
          }
          return kt;
        })
      );
    });

    if (isKitchenOffline) {
      const offlineEvts = [...getOfflineEvents(), ...events];
      saveOfflineEvents(offlineEvts);
      setProductionEvents(offlineEvts);
    } else {
      setProductionEvents(prev => [...events, ...prev]);
    }

    addAuditLog(
      'Fast Out / Handoff Completed',
      'Kitchen Production',
      `Handed over / completed: ${events.reduce((s, e) => s + e.quantity, 0)}x ${item.menuItemName} (${item.portion}). Cleared from active line.`
    );

    return { success: true, events };
  };

  const recallProductionItem = (
    aggregatedItemId: string,
    quantityToRecall: number,
    reason: string,
    userId?: string
  ) => {
    // Recall (Section 39)
    const activeItems = aggregateProductionItems(orders, kitchenTickets);
    const item = activeItems.find(i => i.id === aggregatedItemId);
    if (!item) {
      return { success: false, events: [], error: 'Production item not found on active line' };
    }

    const { events } = allocateRecallQuantity(
      item,
      quantityToRecall,
      reason,
      userId || currentUser.email,
      currentUser.name
    );

    if (events.length === 0) {
      return { success: false, events: [], error: 'No valid quantity eligible for recall' };
    }

    events.forEach(evt => {
      markEventIdProcessed(evt.eventId);

      setOrders(prev =>
        prev.map(o => {
          if (o.id === evt.orderId) {
            const updatedItems = o.items.map(it => {
              if (it.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...it, status: 'preparing' as const };
              }
              return it;
            });
            return { ...o, items: updatedItems, status: 'preparing' };
          }
          return o;
        })
      );

      setKitchenTickets(prev =>
        prev.map(kt => {
          if (kt.orderId === evt.orderId) {
            const updatedItems = kt.items.map(ki => {
              if (ki.name.toLowerCase() === evt.menuItemName.toLowerCase()) {
                return { ...ki, status: 'preparing' as const, completed: false };
              }
              return ki;
            });
            return { ...kt, items: updatedItems, status: 'preparing' };
          }
          return kt;
        })
      );
    });

    addAuditLog(
      'Item Recalled',
      'Kitchen Production',
      `Recalled ${events.reduce((s, e) => s + e.quantity, 0)}x ${item.menuItemName}. Reason: ${reason}`,
      'WARNING'
    );

    return { success: true, events };
  };

  const syncOfflineProductionEvents = () => {
    const offlineEvents = getOfflineEvents();
    if (offlineEvents.length === 0) {
      return { syncedCount: 0, remainingOffline: 0 };
    }

    const processedIds = getProcessedEventIds();
    let synced = 0;

    offlineEvents.forEach(evt => {
      // Duplicate protection (Section 36)
      if (!processedIds.has(evt.eventId)) {
        processedIds.add(evt.eventId);
        synced++;
      }
    });

    saveOfflineEvents([]);
    setProductionEvents(prev => [...offlineEvents, ...prev]);

    addAuditLog(
      'Offline Events Synced',
      'Kitchen Production',
      `Synchronized ${synced} offline production events to central database with duplicate protection`
    );

    return { syncedCount: synced, remainingOffline: 0 };
  };

  const createTestOrdersForPhase7 = () => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const orderAId = `ord-test-A-${Date.now()}`;
    const orderBId = `ord-test-B-${Date.now() + 1}`;

    const orderA: Order = {
      id: orderAId,
      restaurantId: 'rest-1',
      orderNumber: `ORD-701`,
      type: 'dine-in',
      tableId: 'tbl-4',
      tableNumber: 'T-04',
      guestName: 'Order A (Table 4)',
      items: [
        {
          id: `item-A-1`,
          menuItemId: 'm-biryani',
          name: 'Chicken Biryani',
          price: 450,
          quantity: 2,
          isVeg: false,
          portionLabel: 'Regular',
          status: 'pending'
        }
      ],
      status: 'placed',
      paymentStatus: 'pending',
      subtotal: 900,
      gstAmount: 45,
      discount: 0,
      grandTotal: 945,
      waiterId: 'waiter-1',
      waiterName: 'Amit Deshmukh',
      createdAt: now
    };

    const orderB: Order = {
      id: orderBId,
      restaurantId: 'rest-1',
      orderNumber: `ORD-702`,
      type: 'dine-in',
      tableId: 'tbl-7',
      tableNumber: 'T-07',
      guestName: 'Order B (Table 7)',
      items: [
        {
          id: `item-B-1`,
          menuItemId: 'm-biryani',
          name: 'Chicken Biryani',
          price: 450,
          quantity: 3,
          isVeg: false,
          portionLabel: 'Regular',
          status: 'pending'
        }
      ],
      status: 'placed',
      paymentStatus: 'pending',
      subtotal: 1350,
      gstAmount: 67.5,
      discount: 0,
      grandTotal: 1417.5,
      waiterId: 'waiter-2',
      waiterName: 'Sunil Pawar',
      createdAt: now
    };

    const ticketA: KitchenTicket = {
      id: `kt-test-A-${Date.now()}`,
      restaurantId: 'rest-1',
      orderId: orderAId,
      orderNumber: 'KOT-701',
      destination: 'Table T-04',
      tableNumber: 'T-04',
      guestName: 'Order A',
      waiterName: 'Amit Deshmukh',
      orderType: 'dine-in',
      station: 'Grill & Tandoor',
      stationType: 'cooking',
      items: [
        { id: `ki-A-1`, name: 'Chicken Biryani', quantity: 2, isVeg: false, status: 'new', portion: 'Regular' }
      ],
      status: 'new',
      createdAt: now,
      createdAtTimestamp: Date.now(),
      elapsedMinutes: 0,
      priority: 'normal'
    };

    const ticketB: KitchenTicket = {
      id: `kt-test-B-${Date.now() + 1}`,
      restaurantId: 'rest-1',
      orderId: orderBId,
      orderNumber: 'KOT-702',
      destination: 'Table T-07',
      tableNumber: 'T-07',
      guestName: 'Order B',
      waiterName: 'Sunil Pawar',
      orderType: 'dine-in',
      station: 'Grill & Tandoor',
      stationType: 'cooking',
      items: [
        { id: `ki-B-1`, name: 'Chicken Biryani', quantity: 3, isVeg: false, status: 'new', portion: 'Regular' }
      ],
      status: 'new',
      createdAt: now,
      createdAtTimestamp: Date.now(),
      elapsedMinutes: 0,
      priority: 'normal'
    };

    setOrders(prev => [orderA, orderB, ...prev]);
    setKitchenTickets(prev => [ticketA, ticketB, ...prev]);

    addAuditLog(
      'Test Orders Created',
      'Kitchen Production',
      'Created Order A (Biryani x2) and Order B (Biryani x3) to test Safe Item Aggregation'
    );

    return { orderAId, orderBId };
  };

  const updateTableStatus = async (tableId:string,status:TableStatus):Promise<{success:boolean;error?:string}> => {
    if (!api.getStaffToken()) return {success:false,error:'Sign in before changing the floor.'};
    try {await api.updateTable(tableId,{status:status.toUpperCase()});await refreshRestaurantData(activeRestaurantId);return {success:true};}
    catch(error:any) {const message=error.detail || error.message;setRestaurantSyncError(message);return {success:false,error:message};}
  };

  const selfAssignTable = async (tableIdOrNumber: string): Promise<{ success: boolean; error?: string; table?: RestaurantTable }> => {
    const target = tables.find(t => t.id === tableIdOrNumber || t.number === tableIdOrNumber);
    if (!target) {
      return { success: false, error: 'Table not found on floor.' };
    }

    if (api.getStaffToken()) {
      try {
        const assignRes = await api.assignTable(target.id, { staffId: currentUser.id });
        if (assignRes && assignRes.success) {
          const updatedTable: RestaurantTable = {
            ...target,
            waiterName: assignRes.currentWaiterName || currentUser.name,
            waiterId: assignRes.currentWaiterStaffId || currentUser.id
          };

          setTables(prev => prev.map(t => (t.id === target.id ? updatedTable : t)));

          const existingAssigned = currentUser.assignedTables || [];
          if (!existingAssigned.includes(target.number)) {
            const newAssigned = [...existingAssigned, target.number];
            const updatedUser: User = {
              ...currentUser,
              assignedTables: newAssigned
            };
            setCurrentUser(updatedUser);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
              } catch (e) {
                console.warn('Storage sync failed', e);
              }
            }
          }

          addAuditLog(
            'Table Self-Assigned',
            'Waiter Operations',
            `Server ${currentUser.name} self-assigned Table ${target.number} (${target.section})`
          );

          // Background refresh to guarantee synchronized state
          refreshRestaurantData(activeRestaurantId).catch(() => {});

          return { success: true, table: updatedTable };
        }
      } catch (err: any) {
        // Concurrency conflict (e.g. 409) or other API failure: refresh floor data so conflict is visible
        refreshRestaurantData(activeRestaurantId).catch(() => {});
        const errorMsg = err.detail || err.message || 'Failed to self-assign table.';
        return {
          success: false,
          error: errorMsg
        };
      }
    }

    // Fallback for offline/mock state
    const hasActiveServer = Boolean(
      target.waiterName &&
      target.waiterName.trim() !== '' &&
      target.waiterName.toLowerCase() !== 'unassigned'
    );

    if (hasActiveServer) {
      if (target.waiterName === currentUser.name) {
        return { success: true, table: target };
      }
      return {
        success: false,
        error: `Conflicting assignment prevented: Table ${target.number} is already assigned to ${target.waiterName}. Only unassigned tables can be self-assigned.`
      };
    }

    const updatedTable: RestaurantTable = {
      ...target,
      waiterName: currentUser.name,
      waiterId: currentUser.id
    };

    setTables(prev => prev.map(t => (t.id === target.id ? updatedTable : t)));

    const existingAssigned = currentUser.assignedTables || [];
    if (!existingAssigned.includes(target.number)) {
      const newAssigned = [...existingAssigned, target.number];
      const updatedUser: User = {
        ...currentUser,
        assignedTables: newAssigned
      };
      setCurrentUser(updatedUser);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
        } catch (e) {
          console.warn('Storage sync failed', e);
        }
      }
    }

    addAuditLog(
      'Table Self-Assigned',
      'Waiter Operations',
      `Server ${currentUser.name} self-assigned Table ${target.number} (${target.section})`
    );

    return { success: true, table: updatedTable };
  };

  const unassignTable = async (tableIdOrNumber: string): Promise<{success:boolean;error?:string}> => {
    const target=tables.find(table=>table.id===tableIdOrNumber || table.number===tableIdOrNumber);
    if (!target || !api.getStaffToken()) return {success:false,error:'Sign in and select a current table.'};
    try { await api.assignTable(target.id,{unassign:true}); await refreshRestaurantData(target.restaurantId || activeRestaurantId); return {success:true}; }
    catch(error:any) { return {success:false,error:error.detail || error.message}; }
  };
  const assignTableToWaiter = async (tableIdOrNumber:string, _waiterName:string, waiterId:string): Promise<{success:boolean;error?:string}> => {
    const target=tables.find(table=>table.id===tableIdOrNumber || table.number===tableIdOrNumber);
    if (!target || !api.getStaffToken() || !floorStaff.some(staff=>staff.id===waiterId)) return {success:false,error:'Select a current outlet staff member and table.'};
    try { await api.assignTable(target.id,{staffId:waiterId}); await refreshRestaurantData(target.restaurantId || activeRestaurantId); return {success:true}; }
    catch(error:any) { return {success:false,error:error.detail || error.message}; }
  };

  const requireMenuSession = () => {
    if (!api.getStaffToken()) throw new Error('Sign in before changing the menu.');
  };
  const menuMutationKey = (operation: string, payload: unknown) => {
    const signature = JSON.stringify(payload);
    const previous = menuMutationKeys.current.get(operation);
    if (previous?.signature === signature) return previous.key;
    const key = generateIdempotencyKey();
    menuMutationKeys.current.set(operation, { signature, key });
    return key;
  };

  const addMenuItem = async (item: Omit<MenuItem, 'id'>): Promise<void> => {
    requireMenuSession();
    const category = menuCategories.find(cat => cat.id === item.categoryId || cat.name === item.categoryName);
    if (!category) throw new Error('Choose a category from the current menu catalog.');
    const operation = `create:${effectiveRestaurantId}`;
    await api.createMenuItem(effectiveRestaurantId, {
      name: item.name, description: item.description, categoryId: category.id,
      priceRupees: item.price, isVegetarian: item.isVeg, isSpicy: item.isSpicy,
      preparationTimeMinutes: item.preparationTimeMinutes, imageUrl: item.image,
      targetKitchenStationCode: item.menuType === 'drink' ? 'BAR' : 'CURRY'
    }, { idempotencyKey: menuMutationKey(operation, item) });
    menuMutationKeys.current.delete(operation);
    await refreshRestaurantData(effectiveRestaurantId);
    addAuditLog('Menu Item Created', 'Restaurant Menu', 'Menu item saved to the catalog');
  };

  const toggleMenuItemAvailability = async (id: string): Promise<void> => {
    requireMenuSession();
    const item = menuItems.find(menuItem => menuItem.id === id);
    if (!item?.id) throw new Error('Menu item is unavailable. Refresh the menu and retry.');
    await api.toggleMenuItemAvailability(effectiveRestaurantId, id, !item.isAvailable);
    await refreshRestaurantData(effectiveRestaurantId);
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>): Promise<{ pendingRevisionId?: string }> => {
    requireMenuSession();
    if (!id) throw new Error('Menu item ID is missing. Refresh the menu and retry.');
    const category = menuCategories.find(cat => cat.id === updates.categoryId || cat.name === updates.categoryName);
    if ((updates.categoryId || updates.categoryName) && !category) throw new Error('Choose a category from the current menu catalog.');
    const operation = `update:${effectiveRestaurantId}:${id}`;
    const result = await api.updateMenuItem(effectiveRestaurantId, id, {
      name: updates.name, description: updates.description, categoryId: category?.id,
      priceRupees: updates.price, isVegetarian: updates.isVeg, isSpicy: updates.isSpicy,
      preparationTimeMinutes: updates.preparationTimeMinutes, imageUrl: updates.image,
      isAvailable: updates.isAvailable, gstRatePercent: updates.taxRate
    }, { idempotencyKey: menuMutationKey(operation, updates) });
    menuMutationKeys.current.delete(operation);
    await refreshRestaurantData(effectiveRestaurantId);
    addAuditLog(result.pendingRevisionId ? 'Menu Change Submitted' : 'Menu Item Updated', 'Restaurant Menu',
      result.pendingRevisionId ? 'Shared catalog change awaits approval' : 'Menu changes saved');
    return { pendingRevisionId: result.pendingRevisionId };
  };

  const addTable = async (tableData: Omit<RestaurantTable,'id'>): Promise<void> => {
    if (!api.getStaffToken()) throw new Error('Sign in before changing the floor.');
    if (!tableData.zoneId || !diningZones.some(zone=>zone.id===tableData.zoneId)) throw new Error('Choose a current outlet dining zone.');
    const outletId=tableData.restaurantId || activeRestaurantId;
    await api.createTable(outletId,{tableNumber:tableData.number,zoneId:tableData.zoneId,capacity:tableData.capacity});
    await refreshRestaurantData(outletId);
  };
  const updateTable = async (id:string, updates:Partial<RestaurantTable>): Promise<void> => {
    if (!api.getStaffToken()) throw new Error('Sign in before changing the floor.');
    await api.updateTable(id,{tableNumber:updates.number,zoneId:updates.zoneId,capacity:updates.capacity,
      status:updates.status?.toUpperCase()});
    await refreshRestaurantData(activeRestaurantId);
  };
  const deactivateTable = async (id:string): Promise<void> => {
    if (!api.getStaffToken()) throw new Error('Sign in before changing the floor.');
    await api.deleteTable(id); await refreshRestaurantData(activeRestaurantId);
  };

  const addReservation = (res: Omit<Reservation, 'id' | 'bookingNumber'>): string => {
    const bookingNumber = `RES-${Math.floor(600 + Math.random() * 400)}`;
    const newId = `res-${Date.now()}`;
    const newRes: Reservation = {
      status: 'confirmed',
      roomNumber: '201',
      ...res,
      id: newId,
      bookingNumber
    };
    setReservations(prev => [newRes, ...prev]);

    // Add guest if not exists
    if (!guests.some(g => g.name.toLowerCase() === res.guestName.toLowerCase())) {
      setGuests(prev => [
        {
          id: `g-${Date.now()}`,
          name: res.guestName,
          phone: res.guestPhone,
          email: res.guestEmail,
          idProofType: res.idProofType || 'Aadhaar Card',
          idProofNumber: res.idProofNumber || 'XXXX-XXXX-1234',
          city: 'Mumbai',
          state: 'Maharashtra',
          vipStatus: false,
          totalVisits: 1,
          totalSpent: res.totalAmount,
          lastVisit: 'Today'
        },
        ...prev
      ]);
    }

    addAuditLog('New Reservation Created', 'Hotel Front Desk', `Reservation ${bookingNumber} created for ${res.guestName} in Room ${res.roomNumber}`);

    // Asynchronously synchronize reservation with backend API
    api.createHotelReservation({
      guestData: {
        firstName: res.guestName.split(' ')[0] || res.guestName,
        lastName: res.guestName.split(' ').slice(1).join(' ') || undefined,
        phone: res.guestPhone,
        email: res.guestEmail
      },
      roomTypeId: res.roomTypeId,
      checkInDate: res.checkInDate,
      checkOutDate: res.checkOutDate,
      adultsCount: res.numberOfGuests || 2,
      specialRequests: res.specialRequests
    }).then(() => {
      refreshHotelData();
    }).catch((err) => {
      console.warn('Backend reservation creation sync deferred:', err);
    });

    return bookingNumber;
  };

  const checkInGuest = (reservationId: string, roomNumber: string) => {
    setReservations(prev =>
      prev.map(r => (r.id === reservationId ? { ...r, status: 'checked-in' } : r))
    );
    setRooms(prev =>
      prev.map(rm => (rm.number === roomNumber ? { ...rm, status: 'occupied', reservationId } : rm))
    );
    addAuditLog('Guest Checked In', 'Front Desk', `Guest checked into Room ${roomNumber}`);

    const targetRoom = rooms.find(rm => rm.number === roomNumber || rm.id === roomNumber);
    const targetRes = reservations.find(r => r.id === reservationId);

    if (targetRoom) {
      api.checkInHotelGuest({
        reservationId: targetRes?.id,
        roomId: targetRoom.id,
        checkOutDate: targetRes?.checkOutDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        guestData: targetRes ? {
          firstName: targetRes.guestName.split(' ')[0] || targetRes.guestName,
          lastName: targetRes.guestName.split(' ').slice(1).join(' ') || undefined,
          phone: targetRes.guestPhone
        } : undefined
      }).then(() => {
        refreshHotelData();
      }).catch((err) => {
        console.warn('Backend check-in sync deferred:', err);
      });
    }
  };

  const checkOutGuest = (reservationIdOrRoomId: string) => {
    const res = reservations.find(r => r.id === reservationIdOrRoomId);
    const targetRoom = rooms.find(rm => rm.id === reservationIdOrRoomId || rm.number === reservationIdOrRoomId || rm.reservationId === reservationIdOrRoomId);

    if (res || targetRoom) {
      const roomNum = res?.roomNumber || targetRoom?.number || '101';
      setReservations(prev =>
        prev.map(r => (r.id === reservationIdOrRoomId ? { ...r, status: 'checked-out' } : r))
      );
      setRooms(prev =>
        prev.map(rm => (rm.number === roomNum ? { ...rm, status: 'cleaning', reservationId: undefined, currentGuestName: undefined } : rm))
      );

      // Create Housekeeping task
      const newHk: HousekeepingTask = {
        id: `hk-${Date.now()}`,
        roomNumber: roomNum,
        roomTypeName: res?.roomTypeName || targetRoom?.roomTypeName || 'Hotel Room',
        floor: parseInt(roomNum[0], 10) || 1,
        assignedToName: 'Housekeeping Staff',
        assignedToId: 'u-housekeeping',
        status: 'dirty',
        priority: 'high',
        scheduledTime: 'Immediate Checkout Turnaround',
        notes: 'Checkout completed. Full sanitization and fresh linens required.'
      };
      setHousekeepingTasks(prev => [newHk, ...prev]);

      addAuditLog('Guest Checked Out', 'Front Desk', `Check-out completed for Room ${roomNum}, room flagged dirty`);

      const stayId = targetRoom?.stayId;
      if (stayId) {
        api.checkOutHotelStay(stayId).then(() => {
          refreshHotelData();
        }).catch((err) => {
          console.warn('Backend checkout sync deferred:', err);
        });
      }
    }
  };

  const updateRoomStatus = (roomId: string, status: RoomStatus) => {
    setRooms(prev =>
      prev.map(rm => (rm.id === roomId || rm.number === roomId ? { ...rm, status } : rm))
    );
    addAuditLog('Room Status Updated', 'Hotel Management', `Room ${roomId} marked as ${status}`);

    const targetRoom = rooms.find(rm => rm.id === roomId || rm.number === roomId);
    if (targetRoom) {
      const apiStatus = status === 'occupied' ? 'OCCUPIED' : status === 'cleaning' ? 'CLEANING' : status === 'maintenance' ? 'MAINTENANCE' : 'AVAILABLE';
      api.updateHotelRoomStatus(targetRoom.id, apiStatus).then(() => {
        refreshHotelData();
      }).catch((err) => {
        console.warn('Backend room status update sync deferred:', err);
      });
    }
  };

  const updateHousekeepingStatus = (taskId: string, status: HousekeepingTask['status']) => {
    setHousekeepingTasks(prev =>
      prev.map(task => {
        if (task.id === taskId) {
          // If available/cleaned, sync room status
          if (status === 'available') {
            setRooms(r => r.map(rm => rm.number === task.roomNumber ? { ...rm, status: 'available' } : rm));
          } else if (status === 'cleaning') {
            setRooms(r => r.map(rm => rm.number === task.roomNumber ? { ...rm, status: 'cleaning' } : rm));
          } else if (status === 'inspected') {
            setRooms(r => r.map(rm => rm.number === task.roomNumber ? { ...rm, status: 'inspected' } : rm));
          }
          return { ...task, status, completedAt: status === 'available' ? 'Just now' : undefined };
        }
        return task;
      })
    );

    if (status === 'cleaning') {
      api.startHousekeepingTask(taskId).then(() => refreshHotelData()).catch(() => {});
    } else if (status === 'available') {
      api.completeHousekeepingTask(taskId).then(() => refreshHotelData()).catch(() => {});
    } else if (status === 'inspected') {
      api.inspectHousekeepingTask(taskId, { passed: true }).then(() => refreshHotelData()).catch(() => {});
    }
  };

  const addMaintenanceRequest = (req: Omit<MaintenanceRequest, 'id' | 'reportedAt'>) => {
    const newReq: MaintenanceRequest = {
      ...req,
      id: `mnt-${Date.now()}`,
      reportedAt: 'Today, Just now'
    };
    setMaintenanceRequests(prev => [newReq, ...prev]);
    addAuditLog('Maintenance Logged', 'Facilities', `Issue logged for ${req.roomOrArea}: ${req.issue}`);

    const targetRoom = rooms.find(r => req.roomOrArea.includes(r.number));
    api.reportMaintenanceIssue({
      roomId: targetRoom?.id,
      title: req.issue,
      description: req.issue,
      category: 'OTHER',
      severity: (req.priority?.toUpperCase() as any) || 'MEDIUM'
    }).then(() => {
      refreshHotelData();
    }).catch(() => {});
  };

  const updateStock = (itemId: string, delta: number) => {
    setInventory(prev =>
      prev.map(item => {
        if (item.id === itemId) {
          const newStock = Math.max(0, item.currentStock + delta);
          let status: InventoryItem['status'] = 'in-stock';
          if (newStock === 0) status = 'out-of-stock';
          else if (newStock <= item.minStockLevel) status = 'low-stock';
          return { ...item, currentStock: newStock, status };
        }
        return item;
      })
    );
  };

  const adjustInventoryStock = (itemId: string, delta: number, reason?: string) => {
    updateStock(itemId, delta);
    const item = inventory.find(i => i.id === itemId);
    const actionDesc = delta >= 0 ? `Restocked +${delta}` : `Adjusted ${delta}`;
    addAuditLog('Inventory Stock Adjusted', 'Procurement & Stock', `${actionDesc} ${item?.unit || 'units'} of ${item?.name || itemId}${reason ? ` (${reason})` : ''}`);

    const locId = inventoryLocations[0]?.id || '00000000-0000-0000-0000-000000000001';
    api.createStockMovement({
      itemId,
      locationId: locId,
      movementType: delta >= 0 ? 'PURCHASE' : 'ADJUSTMENT',
      quantity: Math.abs(delta),
      notes: reason || 'Inventory Stock Adjustment'
    }).then(() => {
      refreshInventoryData();
    }).catch((err) => {
      console.warn('Backend stock movement recording failed:', err);
    });
  };

  const createPurchaseOrder = (
    supplierName: string,
    itemsOrCount: number | Array<any>,
    maybeTotalAmount?: number
  ) => {
    let itemsCount = 1;
    let totalAmount = 0;

    if (Array.isArray(itemsOrCount)) {
      itemsCount = itemsOrCount.length;
      totalAmount = maybeTotalAmount ?? itemsOrCount.reduce((sum, item) => {
        const itemTotal = item.total ?? item.totalCost ?? ((item.unitCost || item.price || 0) * (item.quantity || 1));
        return sum + itemTotal;
      }, 0);
    } else {
      itemsCount = typeof itemsOrCount === 'number' ? itemsOrCount : 1;
      totalAmount = typeof maybeTotalAmount === 'number' ? maybeTotalAmount : 0;
    }

    const newPO: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: `PO-2026-0${Math.floor(100 + Math.random() * 900)}`,
      supplierName,
      itemsCount,
      totalAmount,
      status: 'ordered',
      orderDate: 'Today',
      expectedDelivery: 'In 2 days'
    };
    setPurchaseOrders(prev => [newPO, ...prev]);
    addAuditLog('Purchase Order Raised', 'Procurement', `PO ${newPO.poNumber} issued to ${supplierName} for ₹${totalAmount}`);
  };

  const logWaste = (
    wasteOrItemId: Omit<WasteRecord, 'id' | 'date'> | string,
    quantity?: number,
    reason?: string
  ) => {
    const locId = inventoryLocations[0]?.id || '00000000-0000-0000-0000-000000000001';

    if (typeof wasteOrItemId === 'string') {
      const item = inventory.find(i => i.id === wasteOrItemId);
      const qty = quantity || 1;
      const costLoss = (item?.unitCost || 0) * qty;
      const normalizedReason: WasteRecord['reason'] =
        reason?.includes('Prep') ? 'Preparation Waste' :
        reason?.includes('Expir') ? 'Expired' :
        reason?.includes('Damage') ? 'Damage' : 'Spoilage';

      const record: WasteRecord = {
        id: `w-${Date.now()}`,
        itemName: item?.name || 'Raw Material',
        quantity: qty,
        unit: item?.unit || 'kg',
        costLoss,
        reason: normalizedReason,
        recordedBy: currentUser.name,
        date: 'Today, Just now'
      };
      setWasteRecords(prev => [record, ...prev]);
      updateStock(wasteOrItemId, -qty);
      addAuditLog('Waste Recorded', 'Inventory Loss Control', `Recorded ${qty} ${record.unit} of ${record.itemName} (₹${costLoss})`);

      api.createStockMovement({
        itemId: wasteOrItemId,
        locationId: locId,
        movementType: 'WASTAGE',
        quantity: qty,
        notes: reason || normalizedReason
      }).then(() => {
        refreshInventoryData();
      }).catch(() => {});
    } else {
      const record: WasteRecord = {
        ...wasteOrItemId,
        id: `w-${Date.now()}`,
        date: 'Today, Just now'
      };
      setWasteRecords(prev => [record, ...prev]);
      const matchedItem = inventory.find(i => i.name.toLowerCase() === wasteOrItemId.itemName.toLowerCase());
      if (matchedItem) {
        updateStock(matchedItem.id, -wasteOrItemId.quantity);
        api.createStockMovement({
          itemId: matchedItem.id,
          locationId: locId,
          movementType: 'WASTAGE',
          quantity: wasteOrItemId.quantity,
          notes: wasteOrItemId.reason
        }).then(() => {
          refreshInventoryData();
        }).catch(() => {});
      }
      addAuditLog('Waste Recorded', 'Inventory Loss Control', `Recorded ${wasteOrItemId.quantity} ${wasteOrItemId.unit} of ${wasteOrItemId.itemName} (₹${wasteOrItemId.costLoss})`);
    }
  };

  const createStockTransfer = async (
    itemId: string,
    sourceLocationId: string,
    destinationLocationId: string,
    quantity: number,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.createStockTransfer({
        itemId,
        sourceLocationId,
        destinationLocationId,
        quantity,
        notes
      });
      await refreshInventoryData();
      addAuditLog('Stock Transfer Completed', 'Inventory Transfers', `Transferred ${quantity} units of item ${itemId}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Transfer failed' };
    }
  };

  const createRecipe = async (
    menuItemId: string,
    name: string,
    yieldServings: number = 1,
    ingredients?: any[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.createRecipe({
        menuItemId,
        name,
        yieldServings,
        ingredients
      });
      await refreshInventoryData();
      addAuditLog('Recipe Created', 'Kitchen & BOM', `Created recipe ${name} for menu item`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Recipe creation failed' };
    }
  };

  const updateRecipe = async (
    recipeId: string,
    name?: string,
    yieldServings?: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.updateRecipe(recipeId, { name, yieldServings });
      await refreshInventoryData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Recipe update failed' };
    }
  };

  const addRecipeIngredient = async (
    recipeId: string,
    inventoryItemId: string,
    quantityRequired: number,
    unitOfMeasure: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.addRecipeIngredient(recipeId, {
        inventoryItemId,
        quantityRequired,
        unitOfMeasure
      });
      await refreshInventoryData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to add ingredient' };
    }
  };

  const removeRecipeIngredient = async (
    recipeId: string,
    ingredientId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.removeRecipeIngredient(recipeId, ingredientId);
      await refreshInventoryData();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove ingredient' };
    }
  };

  const clockInOutEmployee = (employeeId: string) => {
    setEmployees(prev =>
      prev.map(emp => {
        if (emp.id === employeeId) {
          const isClocked = !emp.isClockedIn;
          return {
            ...emp,
            isClockedIn: isClocked,
            clockedInAt: isClocked ? 'Just now' : undefined
          };
        }
        return emp;
      })
    );
  };

  const toggleClockIn = (employeeId: string) => {
    clockInOutEmployee(employeeId);
  };

  const addEmployee = (emp: Omit<Employee, 'id' | 'employeeCode'>) => {
    const newEmp: Employee = {
      ...emp,
      id: `emp-${Date.now()}`,
      employeeCode: `GA-${Math.floor(100 + Math.random() * 900)}`
    };
    setEmployees(prev => [...prev, newEmp]);
    addAuditLog('Staff Member Onboarded', 'Human Resources', `Created employee ${emp.name} (${emp.roleTitle})`);
  };

  const respondToReview = (reviewId: string, response: string) => {
    setReviews(prev =>
      prev.map(rev => (rev.id === reviewId ? { ...rev, status: 'responded', response } : rev))
    );
    addAuditLog('Review Responded', 'Guest CRM', `Responded to review ${reviewId}`);
  };

  const resolveComplaint = (complaintId: string, resolution: string) => {
    setComplaints(prev =>
      prev.map(cmp => (cmp.id === complaintId ? { ...cmp, status: 'resolved', resolution } : cmp))
    );
    addAuditLog('Complaint Resolved', 'Guest Relations', `Ticket ${complaintId} marked resolved`);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const attendWaiterRequest = async (id:string):Promise<{success:boolean;error?:string}> => {
    try {if(!api.getStaffToken()) throw new Error('Staff authorization required.');
      await api.resolveServiceRequest(id);await refreshRestaurantData(effectiveRestaurantId);return {success:true};
    }catch(err:any){const error=err.detail || err.message || 'Service request update failed.';setRestaurantSyncError(error);return {success:false,error};}
  };
  const resolveWaiterRequest = attendWaiterRequest;

  const addDiningReservation = (res: Omit<DiningReservation, 'id' | 'reservationNumber' | 'createdAt'>): string => {
    const newId = `res-d-${Date.now()}`;
    const reservationNumber = `RES-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReservation: DiningReservation = {
      ...res,
      id: newId,
      reservationNumber,
      restaurantId: res.restaurantId || effectiveRestaurantId,
      status: 'confirmed',
      createdAt: 'Just now'
    };
    setDiningReservations(prev => [newReservation, ...prev]);
    addAuditLog('Dining Reservation Created', 'Restaurant & Dining', `Reservation ${reservationNumber} for ${res.guestName}`);
    return newId;
  };

  const updateDiningReservationStatus = (id: string, status: DiningReservation['status']) => {
    setDiningReservations(prev =>
      prev.map(r => (r.id === id ? { ...r, status } : r))
    );
  };

  const seatDiningReservation = (id: string) => {
    const res = diningReservations.find(r => r.id === id);
    if (!res) return;
    setDiningReservations(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'seated' } : r))
    );
    const matchedTable = tables.find(t => t.number === res.tableNumber);
    if (matchedTable) {
      updateTableStatus(matchedTable.id, 'occupied');
    }
    addAuditLog('Reservation Seated', 'Restaurant & Dining', `Guest ${res.guestName} seated at Table ${res.tableNumber}`);
  };

  const updateMenuItemPricing = async (id: string, price: number, taxRate?: number): Promise<void> => {
    await updateMenuItem(id, { price, taxRate });
  };

  const takeWaiterOrder = (
    tableNumber: string,
    items: { menuItem: MenuItem; quantity: number; notes?: string }[],
    notes?: string,
    isUrgent?: boolean
  ): string => {
    const table = tables.find(t => t.number === tableNumber);
    const orderId = addOrder({
      tableNumber,
      tableId: table?.id,
      guestName: `Table ${tableNumber} Guest`,
      items: items.map((it, idx) => ({
        id: `oi-${Date.now()}-${idx}`,
        menuItemId: it.menuItem.id,
        name: it.menuItem.name,
        price: it.menuItem.price,
        quantity: it.quantity,
        isVeg: it.menuItem.isVeg,
        notes: it.notes,
        status: 'preparing'
      })),
      notes
    });

    // Auto-dispatch ticket directly to KDS
    const ticketId = `kt-${Date.now()}`;
    const newTicket: KitchenTicket = {
      id: ticketId,
      restaurantId: effectiveRestaurantId,
      orderId,
      orderNumber: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      destination: `Table ${tableNumber}`,
      tableNumber,
      orderType: 'dine-in',
      items: items.map(it => ({
        id: `ki-${Date.now()}-${it.menuItem.id}`,
        name: it.menuItem.name,
        quantity: it.quantity,
        notes: it.notes,
        isVeg: it.menuItem.isVeg,
        status: 'new'
      })),
      status: 'new',
      createdAt: 'Just now',
      elapsedMinutes: 0,
      priority: isUrgent ? 'urgent' : 'normal',
      specialInstructions: notes,
      station: 'Main Curries'
    };
    setKitchenTickets(prev => [newTicket, ...prev]);

    if (table) {
      updateTableStatus(table.id, 'occupied');
    }

    addAuditLog('Waiter Placed Order', 'Waiter & Services', `Order punched for Table ${tableNumber} (${items.length} items)`);
    return orderId;
  };

  const callWaiter = async (tableNumber:string,requestType:'Water'|'Call Waiter'|'Bill'|'Clean Table'|'Cutlery'):Promise<{success:boolean;error?:string}> => {
    try {
      const table=tables.find(t=>t.number===tableNumber && t.restaurantId===activeRestaurantId);
      if(!table || !api.getStaffToken()) throw new Error('Select a table in your authorized outlet.');
      const types={'Water':'WATER','Call Waiter':'CALL_WAITER','Bill':'BILL','Clean Table':'CLEANING','Cutlery':'CUTLERY'};
      await api.request(`/tables/${table.id}/service-requests`,{method:'POST',body:{requestType:types[requestType]}});
      await refreshRestaurantData(activeRestaurantId);return {success:true};
    }catch(err:any){const error=err.detail || err.message || 'Service request failed.';setRestaurantSyncError(error);return {success:false,error};}
  };

  const createWaiterRequest = async (
    tableIdOrNum: any,
    tableNumberOrType?: string,
    reqTypeOrNotes?: string,
    _notes?: string
  ) => {
    let tableNum = 'T-01';
    let type: any = 'Call Waiter';
    let notes: string | undefined = undefined;

    if (typeof tableIdOrNum === 'object' && tableIdOrNum !== null) {
      tableNum = tableIdOrNum.tableNumber || tableIdOrNum.tableId || 'T-01';
      type = tableIdOrNum.type || tableIdOrNum.requestType || 'Call Waiter';
      notes = tableIdOrNum.notes;
    } else {
      tableNum = tableIdOrNum;
      if (tableNumberOrType && ['Water', 'Call Waiter', 'Bill', 'Clean Table', 'Cutlery', 'water', 'bill', 'call-waiter'].includes(tableNumberOrType)) {
        type = tableNumberOrType;
      } else if (tableNumberOrType && reqTypeOrNotes) {
        tableNum = tableNumberOrType;
        type = reqTypeOrNotes;
      }
      notes = _notes;
    }

    const normalizedType: 'Water' | 'Call Waiter' | 'Bill' | 'Clean Table' | 'Cutlery' =
      type === 'water' || type === 'Water' ? 'Water' :
      type === 'bill' || type === 'Bill' ? 'Bill' :
      type === 'clean' || type === 'Clean Table' ? 'Clean Table' :
      type === 'cutlery' || type === 'Cutlery' ? 'Cutlery' :
      'Call Waiter';

    const result=await callWaiter(tableNum, normalizedType);
    if(!result.success) return;
    addAuditLog('Waiter Service Request', 'WAITER DASHBOARD', `Table ${tableNum} requested: ${normalizedType}${notes ? ` (${notes})` : ''}`, 'SUCCESS');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        authRole,
        isAuthLoading,
        effectiveRole,
        previewRole,
        exitPreviewRole,
        currentRoute,
        pushRoute,
        login,
        switchRole,
        logout,
        restaurants,
        activeRestaurantId,
        activeRestaurant,
        switchRestaurant,
        addRestaurant,
        tables,
        menuItems,
        menuCategories,
        diningZones,
        floorStaff,
        deactivateTable,
        orders,
        kitchenTickets,
        waiterRequests,
        diningReservations,
        restaurantSyncError,
        refreshRestaurantData,
        rooms,
        reservations,
        guests,
        housekeepingTasks,
        maintenanceRequests,
        inventory,
        inventoryLocations,
        inventoryBalances,
        recipes,
        purchaseOrders,
        wasteRecords,
        refreshInventoryData,
        createStockTransfer,
        createRecipe,
        updateRecipe,
        addRecipeIngredient,
        removeRecipeIngredient,
        employees,
        customers,
        reviews,
        complaints,
        payments,
        auditLogs,
        notifications,
        addOrder,
        createRestaurantOrder,
        placeCustomerQROrder,
        placeWaiterOrder,
        getTableBill,
        requestTableBill,
        updateOrderTip,
        processTablePayment,
        settleTableBill,
        settlementRequests,
        fetchSettlementRequests,
        requestSettlementForSession,
        updateSettlementRequest,
        updateOrderStatus,
        updateOrderItemStatus,
        settlePayment,
        updateKitchenTicketStatus,
        updateKitchenItemStatus,
        recallKitchenTicket,
        cancelKitchenTicket,
        updateTableStatus,
        selfAssignTable,
        unassignTable,
        assignTableToWaiter,
        addMenuItem,
        updateMenuItem,
        toggleMenuItemAvailability,
        updateMenuItemPricing,
        addTable,
        updateTable,
        addDiningReservation,
        updateDiningReservationStatus,
        seatDiningReservation,
        takeWaiterOrder,
        resolveWaiterRequest,
        addReservation,
        checkInGuest,
        checkOutGuest,
        updateRoomStatus,
        updateHousekeepingStatus,
        addMaintenanceRequest,
        updateStock,
        adjustInventoryStock,
        createPurchaseOrder,
        logWaste,
        clockInOutEmployee,
        toggleClockIn,
        addEmployee,
        refreshStaffData,
        respondToReview,
        resolveComplaint,
        markNotificationRead,
        clearAllNotifications,
        attendWaiterRequest,
        callWaiter,
        createWaiterRequest,
        customerSession,
        activeOtpRequest,
        selfSeatCustomerFromQr,
        sendCustomerOTP,
        verifyCustomerOTP,
        resendCustomerOTP,
        endCustomerDiningSession,
        updateCustomerSessionName,
        validateQRContext,
        addAuditLog,

        // Phase 7: Hybrid Restaurant Kitchen Production System
        isKitchenOffline,
        toggleKitchenOffline,
        productionEvents,
        prepareProductionItem,
        readyProductionItem,
        handoffProductionItem,
        recallProductionItem,
        syncOfflineProductionEvents,
        createTestOrdersForPhase7,

        // Onboarding Tour Controller
        isTourOpen,
        openTour,
        closeTour,
        tourRoleOverride
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
