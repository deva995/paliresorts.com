export type UserRole =
  | 'SUPER_ADMIN'
  | 'RESTAURANT_OWNER'
  | 'RESTAURANT_MANAGER'
  | 'CASHIER'
  | 'KITCHEN_USER'
  | 'KITCHEN_STAFF'
  | 'KITCHEN_COOKING'
  | 'KITCHEN_BAR'
  | 'KITCHEN_EXECUTIVE'
  | 'BEVERAGES'
  | 'DRINKS'
  | 'WAITER'
  | 'WAITER_MANAGER'
  | 'SENIOR_CAPTAIN'
  | 'RECEPTIONIST'
  | 'HOUSEKEEPING'
  | 'ROOM_SERVICE'
  | 'CUSTOMER';

export type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'MANAGE';

export interface Restaurant {
  id: string;
  name: string;
  code: string;
  type: 'Resort Dining' | 'Boutique Cafe' | 'Fine Dining' | 'Lounge Bar';
  address: string;
  contactEmail: string;
  contactPhone: string;
  currency: string;
  taxRate: number;
  tablesCount: number;
  status: 'active' | 'inactive';
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
}

export interface ModuleAccessStatus {
  canView: boolean;
  canEdit: boolean;
}

export interface ModuleAccessItem {
  id: string;
  name: string;
  description: string;
  roleBaseline: ModuleAccessStatus;
  override: ModuleAccessStatus | null;
  effective: ModuleAccessStatus;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  branch: string;
  restaurantId?: string; // Tenant Scoping: scopes data to this restaurant
  roles?: string[]; // All authenticated server roles, including endpoint-specific exclusions
  permissions?: string[]; // Granular RBAC permissions
  moduleAccess?: Record<string, ModuleAccessStatus>; // Effective module view & edit overrides
  password?: string; // Auth password credential (for development / test environment)
  avatar: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  assignedTables?: string[];
  shiftInfo?: string;
  sectionAssigned?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  icon: string;
  allowedRoles: UserRole[];
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'billed' | 'cleaning' | 'out_of_service';

export interface RestaurantTable {
  id: string;
  restaurantId?: string;
  number: string;
  capacity: number;
  status: TableStatus;
  section: string;
  zoneId?: string;
  currentOrderId?: string;
  activeSessionId?: string;
  guestCount?: number;
  waiterName?: string;
  waiterId?: string;
  occupiedSince?: string;
}

export interface WaiterServiceVisibility {
  waiterId: string;
  waiterName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  department?: string;
  shiftInfo?: string;
  assignedTableCount: number;
  assignedTableNumbers: string[];
  currentlyServingCount: number;
  currentlyServingTables: string[];
  servedCompletedCount: number;
  servedCompletedTables: string[];
  pendingServiceCount: number;
  pendingRequests: WaiterRequest[];
  activeOrdersCount: number;
  activeOrdersTotal: number;
}

export interface MenuItem {
  id: string;
  restaurantId?: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  price: number;
  isVeg: boolean;
  isSpicy?: boolean;
  preparationTimeMinutes: number;
  isAvailable: boolean;
  image: string;
  taxRate: number; // e.g. 5 for 5% GST
  portionOptions?: { label: string; price: number }[];
  menuType?: 'food' | 'drink';
  subCategory?: string;
  isChefSpecial?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  notes?: string;
  status: 'ordered' | 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  menuType?: 'food' | 'drink';
  categoryName?: string;
  portionLabel?: string;
  round?: number;
}

export type OrderStatus = 'placed' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'room-charge' | 'split';
export type KitchenTicketStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'served' | 'cancelled';

export interface Order {
  diningSessionId?: string;
  id: string;
  restaurantId?: string;
  orderNumber: string;
  type?: 'dine-in' | 'takeaway' | 'room-service';
  tableId?: string;
  tableNumber?: string;
  roomNumber?: string;
  customerId?: string;
  customerName?: string;
  guestName?: string;
  guestPhone?: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  subtotal: number;
  foodSubtotal?: number;
  barSubtotal?: number;
  gstAmount?: number;
  tax?: number;
  discount: number;
  tipAmount?: number;
  tipType?: 'none' | '5%' | '10%' | '15%' | 'custom';
  tipPercentage?: number;
  tipAddedBy?: 'CUSTOMER' | 'WAITER';
  grandTotal: number;
  waiterId?: string;
  waiterName?: string;
  notes?: string;
  createdAt?: string;
  orderedAt?: string;
  billNumber?: string;
  billStatus?: 'unbilled' | 'requested' | 'generated' | 'settled';
  billRequestedAt?: string;
}

export interface TableBill {
  billNumber: string;
  orderId: string;
  tableId: string;
  tableNumber: string;
  restaurantId: string;
  restaurantName: string;
  guestName: string;
  guestPhone?: string;
  roomNumber?: string;
  foodItems: OrderItem[];
  barItems: OrderItem[];
  foodSubtotal: number;
  barSubtotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  tipAmount: number;
  tipType: 'none' | '5%' | '10%' | '15%' | 'custom';
  tipPercentage?: number;
  tipAddedBy?: 'CUSTOMER' | 'WAITER';
  grandTotal: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  billStatus: 'unbilled' | 'requested' | 'generated' | 'settled';
  createdAt: string;
  // Authoritative server integer paise figures
  id?: string;
  diningSessionId?: string;
  subtotalPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  grandTotalPaise?: number;
  balancePaise?: number;
  paidPaise?: number;
}

export interface SettlementRequest {
  id: string;
  outletId: string;
  diningSessionId: string;
  tableId: string;
  tableNumber: string;
  billId: string | null;
  invoiceNumber: string | null;
  subtotalPaise: number;
  grandTotalPaise: number;
  balancePaise: number;
  requestedByStaffId: string;
  requestedByStaffName: string;
  paymentMethodPreference: 'CASH' | 'UPI' | 'CARD' | 'ROOM_FOLIO' | null;
  notes: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  resolvedByStaffId: string | null;
  resolvedByStaffName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenItem {
  id: string;
  name: string;
  quantity: number;
  portion?: string;
  modifiers?: string[];
  notes?: string;
  isVeg: boolean;
  status: 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  completed?: boolean;
}

export type ProductionStatus = 'pending' | 'preparing' | 'ready' | 'completed';

export type KitchenStationType = 'cooking' | 'bar' | 'beverages' | 'drinks';

export interface ProductionOrderItemRef {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  serviceType: 'dine-in' | 'takeaway' | 'room-service';
  tableId?: string;
  tableNumber?: string;
  roomNumber?: string;
  customerId?: string;
  customerName?: string;
  waiterId?: string;
  waiterName?: string;
  quantityTotal: number;
  quantityPending: number;
  quantityPreparing: number;
  quantityReady: number;
  quantityCompleted: number;
  portion?: string;
  modifiers?: string[];
  specialInstructions?: string;
  allergenInformation?: string[];
  stationType: 'cooking' | 'bar' | 'beverages' | 'drinks';
  stationName: string;
  createdAt: string;
  createdAtTimestamp: number;
  updatedAtTimestamp: number;
}

export interface AggregatedProductionItem {
  id: string; // composite key: menuItemName + portion + modifiersKey + stationType + serviceType
  menuItemId: string;
  menuItemName: string;
  portion?: string;
  modifiers?: string[];
  modifiersKey: string;
  stationType: 'cooking' | 'bar' | 'beverages' | 'drinks';
  stationName: string;
  stationCode?: string;
  serviceType: 'dine-in' | 'takeaway' | 'room-service';
  isVeg: boolean;
  specialInstructions?: string[];
  allergenInformation?: string[];

  // Production Quantities
  quantityPending: number;
  quantityPreparing: number;
  quantityReady: number;
  quantityCompleted: number;
  totalActive: number;

  // Time metrics
  oldestPendingTimestamp: number;
  elapsedMinutes: number;
  delayStatus: 'normal' | 'warning' | 'delayed'; // <10m normal, 10-15m warning, >15m delayed

  // Full order-level traceability
  orderRefs: ProductionOrderItemRef[];
}

export interface ProductionEvent {
  eventId: string;
  restaurantId: string;
  eventType: 'ITEM_PREPARING_STARTED' | 'ITEM_READY' | 'ITEM_COMPLETED' | 'ITEM_RECALLED';
  aggregatedItemId: string;
  menuItemId: string;
  menuItemName: string;
  portion?: string;
  quantity: number;
  orderId: string;
  orderItemId: string;
  tableNumber?: string;
  serviceType: 'dine-in' | 'takeaway' | 'room-service';
  stationType: 'cooking' | 'bar' | 'beverages' | 'drinks';
  userId: string;
  userName: string;
  timestamp: number;
  deviceId: string;
  syncStatus: 'synced' | 'pending_sync';
  recallReason?: string;
}

export interface KitchenTicket {
  id: string;
  restaurantId?: string;
  orderId: string;
  orderNumber: string;
  destination: string; // e.g. "Table T-04" or "Room 302"
  tableNumber?: string;
  roomNumber?: string;
  guestName?: string;
  waiterName?: string;
  orderType: 'dine-in' | 'takeaway' | 'room-service';
  items: KitchenItem[];
  status: 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  createdAt: string;
  createdAtTimestamp?: number;
  acceptedAtTimestamp?: number;
  preparingAtTimestamp?: number;
  readyAtTimestamp?: number;
  completedAtTimestamp?: number;
  elapsedMinutes: number;
  priority: 'normal' | 'high' | 'urgent';
  specialInstructions?: string;
  station?: 'Grill & Tandoor' | 'Main Curries' | 'Dessert & Beverages' | 'Cold Prep' | 'Bar & Drinks' | string;
  stationType?: 'cooking' | 'bar' | 'beverages' | 'drinks';
  stationId?: string;
  stationCode?: string;
  allergens?: string[];
}

export interface DiningReservation {
  id: string;
  reservationNumber: string;
  restaurantId?: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  partySize: number;
  tableNumber: string;
  date: string;
  time: string;
  section: string;
  specialRequests?: string;
  status: 'confirmed' | 'seated' | 'cancelled' | 'completed';
  createdAt: string;
}

export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'inspected' | 'maintenance' | 'reserved';

export interface Room {
  id: string;
  number: string;
  typeId?: string;
  typeName?: string;
  floor: number;
  status: RoomStatus;
  basePrice?: number;
  pricePerNight?: number;
  features?: string[];
  bedType?: string;
  maxGuests?: number;
  guestName?: string;
  reservationId?: string;
  cleaningStaff?: string;
  roomTypeId?: string;
  roomTypeName?: string;
  currentGuestName?: string;
  currentGuestPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  housekeeperAssigned?: string;
  stayId?: string;
  folioId?: string;
  folioBalance?: number;
}

export interface RoomType {
  id: string;
  name: string;
  basePrice: number;
  maxOccupancy: number;
  description: string;
  amenities: string[];
  image: string;
}

export interface Reservation {
  id: string;
  bookingNumber?: string;
  bookingReference?: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  roomId?: string;
  roomNumber?: string;
  roomTypeId?: string;
  roomTypeName?: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  numberOfGuests?: number;
  status: 'confirmed' | 'checked-in' | 'checked-out' | 'cancelled';
  totalAmount?: number;
  advancePayment?: number;
  paidAmount?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  idProofType?: string;
  idProofNumber?: string;
  specialRequests?: string;
  createdAt?: string;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string;
  idProofType: string;
  idProofNumber: string;
  city: string;
  state: string;
  vipStatus: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string;
}

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  roomTypeName: string;
  floor: number;
  assignedToName: string;
  assignedToId: string;
  status: 'dirty' | 'assigned' | 'cleaning' | 'cleaned' | 'inspected' | 'available';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledTime: string;
  completedAt?: string;
  notes?: string;
}

export interface MaintenanceRequest {
  id: string;
  roomOrArea: string;
  issue: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'resolved';
  reportedBy: string;
  reportedAt: string;
  assignedTechnician?: string;
}

export interface InventoryItem {
  id: string;
  itemCode?: string;
  name: string;
  category: 'Produce & Dairy' | 'Grains & Spices' | 'Beverages' | 'Meat & Poultry' | 'Room Amenities' | 'Housekeeping & Linens' | string;
  currentStock: number;
  minStockLevel: number;
  minStockAlert?: number;
  unit: string;
  unitCost: number;
  unitCostPaise?: number;
  supplierName: string;
  supplierPhone?: string;
  lastRestocked: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  isActive?: boolean;
}

export interface InventoryLocation {
  id: string;
  name: string;
  outletId: string | null;
  isCentral: boolean;
  isActive: boolean;
}

export interface InventoryBalance {
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
}

export interface RecipeIngredient {
  id: string;
  recipeId?: string;
  inventoryItemId: string;
  inventoryItemName?: string;
  quantityRequired: number;
  unitOfMeasure: string;
}

export interface Recipe {
  id: string;
  menuItemId: string;
  menuItemName?: string;
  name: string;
  yieldServings: number;
  ingredients?: RecipeIngredient[];
  createdAt?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  itemsCount: number;
  totalAmount: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  orderDate: string;
  expectedDelivery: string;
}

export interface WasteRecord {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  reason: 'Spoilage' | 'Preparation Waste' | 'Expired' | 'Damage';
  costLoss: number;
  recordedBy: string;
  date: string;
}

export interface Employee {
  firstName?: string;
  lastName?: string;
  designationId?: string | null;
  designationName?: string | null;

  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  shift: 'Morning (06:00 - 15:00)' | 'Evening (14:00 - 23:00)' | 'Night (22:00 - 07:00)';
  monthlySalary: number;
  joinDate: string;
  status: 'active' | 'on-leave' | 'inactive';
  isClockedIn: boolean;
  clockedInAt?: string;
  attendanceRate: number;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  points: number;
  loyaltyPoints?: number;
  visitsCount: number;
  totalVisits?: number;
  totalSpent: number;
  favoriteDish: string;
  preferredRoom: string;
  joinedDate: string;
  notes?: string;
}

export type Customer = CustomerProfile;

export interface Review {
  id: string;
  customerName: string;
  rating: number; // 1 to 5
  serviceType: 'Restaurant' | 'Hotel' | 'Room Service';
  comment: string;
  date: string;
  status: 'published' | 'responded';
  response?: string;
}

export interface Complaint {
  id: string;
  ticketNo: string;
  customerName: string;
  contact: string;
  department: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  date: string;
  resolution?: string;
}

export interface PaymentTransaction {
  id: string;
  transactionId: string;
  invoiceNo: string;
  source: 'Restaurant POS' | 'Hotel Front Desk' | 'Room Service' | 'Online QR';
  customerName: string;
  amount: number;
  method: PaymentMethod;
  status: 'success' | 'pending' | 'refunded';
  date: string;
  gstAmount: number;
  refNumber: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: string;
  details: string;
  timestamp: string;
  ipAddress: string;
  status: 'SUCCESS' | 'WARNING' | 'DENIED';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  targetRoles: UserRole[];
  createdAt: string;
  read: boolean;
  link?: string;
  tableNumber?: string;
  orderId?: string;
  ticketId?: string;
  customerName?: string;
  itemsSummary?: string;
  notificationCategory?: 'order_ready' | 'qr_order' | 'service_request' | 'bill_request' | 'general';
}

export interface WaiterRequest {
  id: string;
  tableNumber: string;
  requestType: 'Water' | 'Call Waiter' | 'Bill' | 'Clean Table' | 'Cutlery';
  requestedAt: string;
  status: 'pending' | 'attended';
}

// ==========================================
// Phase 7: Customer Mobile & OTP Verification
// ==========================================

export interface CustomerDiningSession {
  sessionId: string;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  maskedMobile: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  startedAt: string;
  verifiedAt: string;
  status: 'active' | 'completed' | 'expired';
}

export interface OTPVerificationRequest {
  requestId: string;
  mobileNumber: string;
  maskedMobile: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  otpCode: string;
  expiresAt: number; // 5 min timeout
  attempts: number;
  maxAttempts: number; // 3 attempts limit
  lastSentAt: number;
  isDevMode: boolean;
  devOtp?: string;
}

export interface QRDiningContext {
  isValid: boolean;
  restaurantId: string;
  restaurantName: string;
  tableId: string;
  tableNumber: string;
  taxRate: number;
  errorReason?: string;
}
