import {
  User,
  Restaurant,
  DiningReservation,
  RestaurantTable,
  MenuItem,
  MenuCategory,
  Order,
  KitchenTicket,
  Room,
  RoomType,
  Reservation,
  Guest,
  HousekeepingTask,
  MaintenanceRequest,
  InventoryItem,
  PurchaseOrder,
  WasteRecord,
  Employee,
  CustomerProfile,
  Review,
  Complaint,
  PaymentTransaction,
  AuditLog,
  AppNotification,
  WaiterRequest
} from '../types';
import { RESORT_ALL_MENU } from './resortMenuData';

export const INITIAL_RESTAURANTS: Restaurant[] = [
  {
    id: 'rest-1',
    name: 'Pali Resort & Club',
    code: 'PALI-REST-01',
    type: 'Resort Dining',
    address: 'Wing A, Ground Floor, Pali Resort & Club, Mumbai Central',
    contactEmail: 'dining@paliresortnclub.com',
    contactPhone: '+91 98201 11223',
    currency: 'INR (₹)',
    taxRate: 5,
    tablesCount: 20,
    status: 'active',
    ownerName: 'Rajesh Singhania',
    ownerEmail: 'owner@paliresortnclub.com',
    createdAt: '2025-01-10'
  },
  {
    id: 'rest-2',
    name: 'Pali Resort & Club',
    code: 'PALI-REST-02',
    type: 'Lounge Bar',
    address: 'Private Poolside Deck, Pali Resort & Club, Mumbai Central',
    contactEmail: 'deck@paliresortnclub.com',
    contactPhone: '+91 98201 11224',
    currency: 'INR (₹)',
    taxRate: 5,
    tablesCount: 8,
    status: 'active',
    ownerName: 'Ayesha Merchant',
    ownerEmail: 'ayesha@paliresortnclub.com',
    createdAt: '2025-03-15'
  }
];

export const INITIAL_DINING_RESERVATIONS: DiningReservation[] = [
  {
    id: 'res-d1',
    reservationNumber: 'RES-8910',
    restaurantId: 'rest-1',
    guestName: 'Kapil & Ananya Mehra',
    guestPhone: '+91 98200 44321',
    guestEmail: 'kapil.mehra@gmail.com',
    partySize: 4,
    tableNumber: 'T-04',
    date: 'Today',
    time: '08:00 PM',
    section: 'VIP Private Dining',
    specialRequests: 'Anniversary celebration with custom floral centerpiece',
    status: 'confirmed',
    createdAt: 'Yesterday, 04:30 PM'
  },
  {
    id: 'res-d2',
    reservationNumber: 'RES-8911',
    restaurantId: 'rest-1',
    guestName: 'Dr. Siddharth Rao',
    guestPhone: '+91 98201 98765',
    guestEmail: 'siddharth.rao@hospital.org',
    partySize: 2,
    tableNumber: 'T-08',
    date: 'Today',
    time: '08:30 PM',
    section: 'Terrace Garden',
    specialRequests: 'Quiet outdoor table near the garden fountain',
    status: 'confirmed',
    createdAt: 'Today, 11:00 AM'
  },
  {
    id: 'res-d3',
    reservationNumber: 'RES-8912',
    restaurantId: 'rest-1',
    guestName: 'Natasha Wadhwa',
    guestPhone: '+91 98203 11223',
    guestEmail: 'natasha@fintech.io',
    partySize: 6,
    tableNumber: 'T-06',
    date: 'Today',
    time: '09:00 PM',
    section: 'AC Family Lounge',
    specialRequests: 'High chair needed for child',
    status: 'confirmed',
    createdAt: 'Today, 01:15 PM'
  },
  {
    id: 'res-d4',
    reservationNumber: 'RES-8914',
    restaurantId: 'rest-2',
    guestName: 'Sanjay & Priya Kapoor',
    guestPhone: '+91 98204 77889',
    guestEmail: 'sanjay.kapoor@techcorp.com',
    partySize: 4,
    tableNumber: 'OB-05',
    date: 'Today',
    time: '07:30 PM',
    section: 'VIP Private Dining',
    specialRequests: 'Beach sunset view table',
    status: 'confirmed',
    createdAt: 'Today, 02:00 PM'
  }
];

export const DEMO_USERS: User[] = [
  // Super Admin Executive 1 (Primary existing)
  {
    id: 'u-admin',
    name: 'Vikramaditya Oberoi',
    email: '',
    phone: '+91 98201 12345',
    role: 'SUPER_ADMIN',
    roleTitle: 'Chief Executive / Super Admin',
    department: 'Executive Management',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:14 AM',
    permissions: ['All Modules', 'Executive Management', 'Super Admin Operations', 'Multi-Tenant Management']
  },
  // Super Admin Executive 2 (sadmin@paliclub.com preservation)
  {
    id: 'u-sadmin',
    name: 'Chief Super Administrator',
    email: '',
    phone: '+91 98201 99999',
    role: 'SUPER_ADMIN',
    roleTitle: 'Chief Executive / Super Admin',
    department: 'Executive Management',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:14 AM',
    permissions: ['All Modules', 'Executive Management', 'Super Admin Operations', 'Multi-Tenant Management']
  },

  // ==========================================
  // RBAC TEST ACCOUNT 1 — RESTAURANT OWNER
  // ==========================================
  {
    id: 'u-test-owner',
    name: 'Rajesh Singhania (Owner)',
    email: '',
    phone: '+91 98200 11001',
    role: 'RESTAURANT_OWNER',
    roleTitle: 'Restaurant Owner & Partner',
    department: 'Restaurant Management',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:45 AM',
    permissions: ['Restaurant & Dining', 'Kitchen & KDS', 'Waiter & Services']
  },

  // ==========================================
  // RBAC TEST ACCOUNT 2A — CAPTAIN
  // ==========================================
  {
    id: 'u-test-waiter-manager',
    name: 'Amit Deshmukh',
    email: '',
    phone: '+91 98205 56789',
    role: 'WAITER_MANAGER',
    roleTitle: 'CAPTAIN',
    department: 'Captain Floor Management',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    assignedTables: ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08'],
    shiftInfo: 'All Shifts (Supervisory)',
    sectionAssigned: 'All Dining Sections',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:45 AM',
    permissions: ['Captain Floor Supervision', 'Floor Oversight', 'Table Management', 'Bill Audits']
  },

  // ==========================================
  // RBAC TEST ACCOUNT 2B — WAITER (FLOOR)
  // ==========================================
  {
    id: 'u-test-waiter',
    name: 'Rahul Shinde',
    email: '',
    phone: '+91 98205 11223',
    role: 'WAITER',
    roleTitle: 'WAITER',
    department: 'Restaurant Floor Service',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    assignedTables: ['T-01', 'T-02', 'T-03', 'T-04', 'T-05'],
    shiftInfo: 'Morning & Afternoon',
    sectionAssigned: 'Main Dining Section',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 11:00 AM',
    permissions: ['Punch Order', 'Table View', 'Notifications']
  },

  // ==========================================
  // RBAC TEST ACCOUNT 3 — KITCHEN / KDS
  // ==========================================
  {
    id: 'u-test-kitchen',
    name: 'Chef Ranveer Brar (Kitchen)',
    email: '',
    phone: '+91 98204 45678',
    role: 'KITCHEN_USER',
    roleTitle: 'Executive Chef & KDS Lead',
    department: 'Culinary & Kitchen',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 07:15 AM',
    permissions: ['Kitchen & KDS']
  },

  // ==========================================
  // KITCHEN OPERATIONAL IDENTITY 1 — KITCHEN COOKING
  // ==========================================
  {
    id: 'u-kitchen-cooking',
    name: 'Kitchen Cooking',
    email: '',
    phone: '+91 98204 11001',
    role: 'KITCHEN_COOKING',
    roleTitle: 'Line Cooking Chef',
    department: 'Culinary & Cooking',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 08:00 AM',
    permissions: ['Cooking KDS']
  },

  // ==========================================
  // KITCHEN OPERATIONAL IDENTITY 2 — KITCHEN BAR
  // ==========================================
  {
    id: 'u-kitchen-bar',
    name: 'Kitchen Bar',
    email: '',
    phone: '+91 98204 22002',
    role: 'KITCHEN_BAR',
    roleTitle: 'Master Mixologist & Bar Lead',
    department: 'Bar & Cellar',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 08:15 AM',
    permissions: ['Bar & Beverage KDS']
  },

  // ==========================================
  // KITCHEN OPERATIONAL IDENTITY 3 — KITCHEN EXECUTIVE
  // ==========================================
  {
    id: 'u-kitchen-executive',
    name: 'Kitchen Executive',
    email: '',
    phone: '+91 98204 33003',
    role: 'KITCHEN_EXECUTIVE',
    roleTitle: 'Executive Chef Controller',
    department: 'Executive Kitchen Operations',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1581299894007-aaa50297cf16?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 07:45 AM',
    permissions: ['All Kitchen Operational Views', 'Kitchen Central Monitoring']
  },

  // ==========================================
  // KITCHEN OPERATIONAL IDENTITY 4 — BEVERAGES
  // ==========================================
  {
    id: 'u-kitchen-beverages',
    name: 'Beverages',
    email: '',
    phone: '+91 98204 44004',
    role: 'BEVERAGES',
    roleTitle: 'Beverage Specialist',
    department: 'Beverages & Refreshers',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 08:30 AM',
    permissions: ['Beverage Preparation']
  },

  // ==========================================
  // KITCHEN OPERATIONAL IDENTITY 5 — DRINKS
  // ==========================================
  {
    id: 'u-kitchen-drinks',
    name: 'Drinks',
    email: '',
    phone: '+91 98204 55005',
    role: 'DRINKS',
    roleTitle: 'Drinks Specialist',
    department: 'Bar & Drinks',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 08:30 AM',
    permissions: ['Drinks Preparation']
  },

  // Existing Operational Profiles (Preserved)
  {
    id: 'u-owner',
    name: 'Rajesh Singhania',
    email: '',
    phone: '+91 98200 11001',
    role: 'RESTAURANT_OWNER',
    roleTitle: 'Restaurant Owner & Partner',
    department: 'Restaurant Management',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:45 AM',
    permissions: ['Restaurant & Dining', 'Kitchen & KDS', 'Waiter & Services']
  },
  {
    id: 'u-resto',
    name: 'Sanjeev Kapoor',
    email: '',
    phone: '+91 98202 23456',
    role: 'RESTAURANT_OWNER',
    roleTitle: 'Restaurant Partner',
    department: 'Restaurant & Dining',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 09:30 AM'
  },
  {
    id: 'u-cashier',
    name: 'Neha Sharma',
    email: '',
    phone: '+91 98203 34567',
    role: 'CASHIER',
    roleTitle: 'Head Cashier / POS Lead',
    department: 'Finance & Billing',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 08:00 AM'
  },
  {
    id: 'u-chef',
    name: 'Chef Ranveer Brar',
    email: '',
    phone: '+91 98204 45678',
    role: 'KITCHEN_STAFF',
    roleTitle: 'Executive Chef & KDS Lead',
    department: 'Culinary & Kitchen',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 07:15 AM'
  },
  {
    id: 'u-waiter',
    name: 'Amit Deshmukh',
    email: '',
    phone: '+91 98205 56789',
    role: 'WAITER',
    roleTitle: 'WAITER',
    department: 'Restaurant Service',
    branch: 'Pali Resort & Club',
    restaurantId: 'rest-1',
    assignedTables: ['T-01', 'T-02', 'T-03', 'T-04', 'T-05'],
    shiftInfo: 'Morning & Afternoon',
    sectionAssigned: 'Main Dining Section',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 11:00 AM'
  },
  {
    id: 'u-hotel',
    name: 'Rohit Khandelwal',
    email: '',
    phone: '+91 98206 67890',
    role: 'RECEPTIONIST',
    roleTitle: 'Guest Relations Officer',
    department: 'Hospitality & Rooms',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 08:45 AM'
  },
  {
    id: 'u-reception',
    name: 'Ananya Roy',
    email: '',
    phone: '+91 98207 78901',
    role: 'RECEPTIONIST',
    roleTitle: 'Front Desk Officer',
    department: 'Reception & Concierge',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 07:45 AM'
  },
  {
    id: 'u-housekeeping',
    name: 'Sunita Mehra',
    email: '',
    phone: '+91 98208 89012',
    role: 'HOUSEKEEPING',
    roleTitle: 'Housekeeping Supervisor',
    department: 'Housekeeping & Facilities',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 06:30 AM'
  },
  {
    id: 'u-roomservice',
    name: 'Karan Mehra',
    email: '',
    phone: '+91 98209 90123',
    role: 'ROOM_SERVICE',
    roleTitle: 'In-Room Dining Lead',
    department: 'Room Service',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:00 AM'
  },
  {
    id: 'u-inventory',
    name: 'Dinesh Agarwal',
    email: '',
    phone: '+91 98210 01234',
    role: 'CASHIER',
    roleTitle: 'Procurement Officer',
    department: 'Procurement & Warehouse',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 09:10 AM'
  },
  {
    id: 'u-staff',
    name: 'Pooja Bhattacharya',
    email: '',
    phone: '+91 98211 12345',
    role: 'SUPER_ADMIN',
    roleTitle: 'HR Administrator',
    department: 'Human Resources & Roster',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 09:00 AM'
  },
  {
    id: 'u-crm',
    name: 'Kunal Singhania',
    email: '',
    phone: '+91 98212 23456',
    role: 'RESTAURANT_OWNER',
    roleTitle: 'Guest Relations Executive',
    department: 'CRM & Loyalty',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 10:30 AM'
  },
  {
    id: 'u-guest',
    name: 'Aarav Singhania',
    email: '',
    phone: '+91 98213 45678',
    role: 'CUSTOMER',
    roleTitle: 'Resort Dining Guest',
    department: 'Guest Dining',
    branch: 'Pali Resort & Club',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    status: 'active',
    lastLogin: 'Today, 12:30 PM',
  }
];

// Attach demo credentials and demo emails only when VITE_SHOW_DEMO_LOGIN === 'true' (demo only, excluded from production builds)
if (import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true') {
  const DEMO_CREDENTIALS: Record<string, { email?: string; password?: string }> = {
  "u-admin": {
    "email": "admin@paliclub.com",
    "password": "Pali@Admin123"
  },
  "u-sadmin": {
    "email": "sadmin@paliclub.com",
    "password": "Pali@Admin123"
  },
  "u-test-owner": {
    "email": "restaurant.owner@paliclub.test",
    "password": "Pali@Owner123"
  },
  "u-test-waiter-manager": {
    "email": "waitermanager@paliclub.test",
    "password": "Pali@Waiter123"
  },
  "u-test-waiter": {
    "email": "waiter@paliclub.test",
    "password": "Pali@Waiter123"
  },
  "u-test-kitchen": {
    "email": "kitchen@paliclub.test",
    "password": "Pali@Kitchen123"
  },
  "u-kitchen-cooking": {
    "email": "cooking@paliclub.test",
    "password": "Pali@Cooking123"
  },
  "u-kitchen-bar": {
    "email": "bar@paliclub.test",
    "password": "Pali@Bar123"
  },
  "u-kitchen-executive": {
    "email": "executive@paliclub.test",
    "password": "Pali@Exec123"
  },
  "u-kitchen-beverages": {
    "email": "beverages@paliclub.test",
    "password": "Pali@Beverages123"
  },
  "u-kitchen-drinks": {
    "email": "drinks@paliclub.test",
    "password": "Pali@Drinks123"
  },
  "u-owner": {
    "email": "owner@paliclub.com",
    "password": "Pali@Owner123"
  },
  "u-resto": {
    "email": "resto.mgr@paliclub.com"
  },
  "u-cashier": {
    "email": "cashier@paliclub.com"
  },
  "u-chef": {
    "email": "chef@paliclub.com"
  },
  "u-waiter": {
    "email": "waiter@paliclub.com"
  },
  "u-hotel": {
    "email": "hotel.mgr@paliclub.com"
  },
  "u-reception": {
    "email": "frontdesk@paliclub.com"
  },
  "u-housekeeping": {
    "email": "housekeeping@paliclub.com"
  },
  "u-roomservice": {
    "email": "roomservice@paliclub.com"
  },
  "u-inventory": {
    "email": "inventory@paliclub.com"
  },
  "u-staff": {
    "email": "hr@paliclub.com"
  },
  "u-crm": {
    "email": "crm@paliclub.com"
  },
  "u-guest": {
    "email": "guest@paliresortnclub.com",
    "password": "Pali@Customer123"
  }
};

  DEMO_USERS.forEach(u => {
    const cred = DEMO_CREDENTIALS[u.id];
    if (cred) {
      if (cred.email) u.email = cred.email;
      if (cred.password) u.password = cred.password;
    }
  });
}

export const MENU_CATEGORIES: MenuCategory[] = [
  { id: 'cat-1', name: 'Signature Starters', icon: 'Flame', itemCount: 6 },
  { id: 'cat-2', name: 'Clay Oven & Tandoor', icon: 'UtensilsCrossed', itemCount: 6 },
  { id: 'cat-3', name: 'Royal Main Course', icon: 'Soup', itemCount: 8 },
  { id: 'cat-4', name: 'Biryani & Basmati Rice', icon: 'CookingPot', itemCount: 5 },
  { id: 'cat-5', name: 'Artisan Breads', icon: 'Wheat', itemCount: 4 },
  { id: 'cat-6', name: 'South Indian Specials', icon: 'Coffee', itemCount: 5 },
  { id: 'cat-7', name: 'Beverages & Mocktails', icon: 'Wine', itemCount: 6 },
  { id: 'cat-8', name: 'Gourmet Desserts', icon: 'IceCream', itemCount: 4 }
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm-1',
    name: 'Paneer Tikka Angaar',
    categoryId: 'cat-1',
    categoryName: 'Signature Starters',
    description: 'Smoked cottage cheese cubes marinated in Kashmiri chili and crushed spices, roasted in tandoor with capsicum.',
    price: 360,
    isVeg: true,
    isSpicy: true,
    preparationTimeMinutes: 15,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-2',
    name: 'Murgh Malai Tikka',
    categoryId: 'cat-2',
    categoryName: 'Clay Oven & Tandoor',
    description: 'Tender chicken morsels soaked in clotted cream, cardamom, roasted garlic, and mild green chillies.',
    price: 450,
    isVeg: false,
    isSpicy: false,
    preparationTimeMinutes: 18,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-3',
    name: 'Crispy Water Chestnut & Corn',
    categoryId: 'cat-1',
    categoryName: 'Signature Starters',
    description: 'Wok tossed sweet corn and water chestnuts seasoned with cracked pepper, spring onion, and toasted sesame.',
    price: 320,
    isVeg: true,
    isSpicy: false,
    preparationTimeMinutes: 12,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-4',
    name: 'Paneer Butter Masala',
    categoryId: 'cat-3',
    categoryName: 'Royal Main Course',
    description: 'Fresh cottage cheese simmered in a velvety ripe tomato reduction, finished with churned butter and kasoori methi.',
    price: 390,
    isVeg: true,
    isSpicy: false,
    preparationTimeMinutes: 15,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-5',
    name: 'Dal Makhani Heritage',
    categoryId: 'cat-3',
    categoryName: 'Royal Main Course',
    description: 'Slow-simmered black urad lentils, cooked overnight on low embers with butter, cream, and ginger garlic paste.',
    price: 340,
    isVeg: true,
    isSpicy: false,
    preparationTimeMinutes: 10,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-6',
    name: 'Dum Awadhi Gosht Biryani',
    categoryId: 'cat-4',
    categoryName: 'Biryani & Basmati Rice',
    description: 'Fragrant aged Dehradun basmati rice layered with succulent goat meat, saffron milk, brown onions, and rose water.',
    price: 580,
    isVeg: false,
    isSpicy: true,
    preparationTimeMinutes: 20,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-7',
    name: 'Hyderabadi Subz Dum Biryani',
    categoryId: 'cat-4',
    categoryName: 'Biryani & Basmati Rice',
    description: 'Garden fresh vegetables layered with seasoned basmati rice and cooked on slow dum in traditional handi.',
    price: 380,
    isVeg: true,
    isSpicy: true,
    preparationTimeMinutes: 15,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-8',
    name: 'Garlic Butter Naan',
    categoryId: 'cat-5',
    categoryName: 'Artisan Breads',
    description: 'Tandoor baked refined flour bread infused with charred minced garlic, cilantro, and warm dairy butter.',
    price: 90,
    isVeg: true,
    preparationTimeMinutes: 8,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-9',
    name: 'Mysore Masala Ghee Roast Dosa',
    categoryId: 'cat-6',
    categoryName: 'South Indian Specials',
    description: 'Crisp golden fermented rice crepe smeared with fiery red garlic chutney, filled with potato masala, served with sambar.',
    price: 240,
    isVeg: true,
    isSpicy: true,
    preparationTimeMinutes: 12,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-10',
    name: 'Kesariya Shahi Kulfi Falooda',
    categoryId: 'cat-8',
    categoryName: 'Gourmet Desserts',
    description: 'Dense saffron pistachio ice cream topped with cornstarch vermicelli, sabja seeds, and pure Damask rose syrup.',
    price: 210,
    isVeg: true,
    preparationTimeMinutes: 5,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-11',
    name: 'Royal Masala Chai Pot',
    categoryId: 'cat-7',
    categoryName: 'Beverages & Mocktails',
    description: 'Brewed CTC Assam leaves infused with fresh crushed ginger, green cardamom, cloves, and full-fat buffalo milk.',
    price: 140,
    isVeg: true,
    preparationTimeMinutes: 8,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  {
    id: 'm-12',
    name: 'Kokum Jeera Sparkler',
    categoryId: 'cat-7',
    categoryName: 'Beverages & Mocktails',
    description: 'Wild coastal kokum infusion blended with roasted cumin, mint sprigs, black salt, and sparkling soda.',
    price: 180,
    isVeg: true,
    preparationTimeMinutes: 5,
    isAvailable: true,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80',
    taxRate: 5
  },
  ...RESORT_ALL_MENU
];

export const INITIAL_TABLES: RestaurantTable[] = [
  { id: 't-1', restaurantId: 'rest-1', number: 'T-01', capacity: 2, status: 'occupied', section: 'Main Dining', currentOrderId: 'ord-101', guestCount: 2, waiterName: 'Amit Deshmukh', occupiedSince: '45 mins ago' },
  { id: 't-2', restaurantId: 'rest-1', number: 'T-02', capacity: 4, status: 'occupied', section: 'Main Dining', currentOrderId: 'ord-102', guestCount: 4, waiterName: 'Amit Deshmukh', occupiedSince: '20 mins ago' },
  { id: 't-3', restaurantId: 'rest-1', number: 'T-03', capacity: 4, status: 'available', section: 'Main Dining' },
  { id: 't-4', restaurantId: 'rest-1', number: 'T-04', capacity: 6, status: 'billed', section: 'Main Dining', currentOrderId: 'ord-103', guestCount: 5, waiterName: 'Ravi Verma', occupiedSince: '1 hr 10 mins' },
  { id: 't-5', restaurantId: 'rest-1', number: 'T-05', capacity: 2, status: 'available', section: 'Terrace Garden' },
  { id: 't-6', restaurantId: 'rest-1', number: 'T-06', capacity: 4, status: 'occupied', section: 'Terrace Garden', currentOrderId: 'ord-104', guestCount: 3, waiterName: 'Sunil Pawar', occupiedSince: '15 mins ago' },
  { id: 't-7', restaurantId: 'rest-1', number: 'T-07', capacity: 4, status: 'reserved', section: 'Terrace Garden', guestCount: 4, waiterName: 'Sunil Pawar' },
  { id: 't-8', restaurantId: 'rest-1', number: 'T-08', capacity: 8, status: 'available', section: 'AC Family Lounge' },
  { id: 't-9', restaurantId: 'rest-1', number: 'T-09', capacity: 6, status: 'occupied', section: 'AC Family Lounge', currentOrderId: 'ord-105', guestCount: 6, waiterName: 'Amit Deshmukh', occupiedSince: '35 mins ago' },
  { id: 't-10', restaurantId: 'rest-1', number: 'T-10', capacity: 4, status: 'available', section: 'AC Family Lounge' },
  { id: 't-11', restaurantId: 'rest-1', number: 'T-11', capacity: 10, status: 'reserved', section: 'VIP Private Dining', guestCount: 8 },
  { id: 't-12', restaurantId: 'rest-1', number: 'T-12', capacity: 8, status: 'available', section: 'VIP Private Dining' },
  { id: 't-13', restaurantId: 'rest-1', number: 'T-13', capacity: 4, status: 'available', section: 'Main Dining' },
  { id: 't-14', restaurantId: 'rest-1', number: 'T-14', capacity: 6, status: 'available', section: 'Terrace Garden' },
  { id: 't-15', restaurantId: 'rest-1', number: 'T-15', capacity: 4, status: 'occupied', section: 'Terrace Garden', guestCount: 4, waiterName: 'Ravi Verma', occupiedSince: '10 mins ago' },
  { id: 't-16', restaurantId: 'rest-1', number: 'T-16', capacity: 4, status: 'available', section: 'Terrace Garden' },
  { id: 't-17', restaurantId: 'rest-1', number: 'T-17', capacity: 4, status: 'reserved', section: 'AC Family Lounge', guestCount: 4 },
  { id: 't-18', restaurantId: 'rest-1', number: 'T-18', capacity: 8, status: 'available', section: 'AC Family Lounge' },
  { id: 't-19', restaurantId: 'rest-1', number: 'T-19', capacity: 4, status: 'available', section: 'VIP Private Dining' },
  { id: 't-20', restaurantId: 'rest-1', number: 'T-20', capacity: 6, status: 'available', section: 'VIP Private Dining' },
  // Pali Resort & Club - Deck (rest-2) Tables
  { id: 't-201', restaurantId: 'rest-2', number: 'OB-01', capacity: 2, status: 'occupied', section: 'Terrace Garden', guestCount: 2, waiterName: 'Vikram Seth', occupiedSince: '25 mins ago' },
  { id: 't-202', restaurantId: 'rest-2', number: 'OB-02', capacity: 4, status: 'available', section: 'Terrace Garden' },
  { id: 't-203', restaurantId: 'rest-2', number: 'OB-03', capacity: 4, status: 'occupied', section: 'Main Dining', guestCount: 4, waiterName: 'Vikram Seth', occupiedSince: '10 mins ago' },
  { id: 't-204', restaurantId: 'rest-2', number: 'OB-04', capacity: 6, status: 'available', section: 'Main Dining' },
  { id: 't-205', restaurantId: 'rest-2', number: 'OB-05', capacity: 8, status: 'reserved', section: 'VIP Private Dining', guestCount: 6 },
  { id: 't-206', restaurantId: 'rest-2', number: 'OB-06', capacity: 4, status: 'available', section: 'AC Family Lounge' }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-101',
    restaurantId: 'rest-1',
    orderNumber: 'ORD-8821',
    type: 'dine-in',
    tableId: 't-1',
    tableNumber: 'T-01',
    guestName: 'Kapil Dev',
    guestPhone: '+91 98111 22334',
    items: [
      { id: 'oi-1', menuItemId: 'm-1', name: 'Paneer Tikka Angaar', price: 360, quantity: 1, isVeg: true, status: 'served' },
      { id: 'oi-2', menuItemId: 'm-4', name: 'Paneer Butter Masala', price: 390, quantity: 1, isVeg: true, status: 'served' },
      { id: 'oi-3', menuItemId: 'm-8', name: 'Garlic Butter Naan', price: 90, quantity: 2, isVeg: true, status: 'served' }
    ],
    status: 'served',
    paymentStatus: 'pending',
    subtotal: 930,
    gstAmount: 46.5,
    discount: 0,
    grandTotal: 976.5,
    waiterId: 'u-waiter',
    waiterName: 'Amit Deshmukh',
    createdAt: '12:15 PM'
  },
  {
    id: 'ord-102',
    restaurantId: 'rest-1',
    orderNumber: 'ORD-8822',
    type: 'dine-in',
    tableId: 't-2',
    tableNumber: 'T-02',
    guestName: 'Rohan Mehra',
    guestPhone: '+91 98333 44556',
    items: [
      { id: 'oi-4', menuItemId: 'm-2', name: 'Murgh Malai Tikka', price: 450, quantity: 2, isVeg: false, status: 'cooking' as any },
      { id: 'oi-5', menuItemId: 'm-6', name: 'Dum Awadhi Gosht Biryani', price: 580, quantity: 2, isVeg: false, status: 'preparing' }
    ],
    status: 'preparing',
    paymentStatus: 'pending',
    subtotal: 2060,
    gstAmount: 103,
    discount: 0,
    grandTotal: 2163,
    waiterId: 'u-waiter',
    waiterName: 'Amit Deshmukh',
    notes: 'Extra raita with biryani, medium spicy',
    createdAt: '12:45 PM'
  },
  {
    id: 'ord-103',
    restaurantId: 'rest-1',
    orderNumber: 'ORD-8820',
    type: 'dine-in',
    tableId: 't-4',
    tableNumber: 'T-04',
    guestName: 'Meenakshi Iyer',
    items: [
      { id: 'oi-6', menuItemId: 'm-5', name: 'Dal Makhani Heritage', price: 340, quantity: 2, isVeg: true, status: 'served' },
      { id: 'oi-7', menuItemId: 'm-7', name: 'Hyderabadi Subz Dum Biryani', price: 380, quantity: 2, isVeg: true, status: 'served' },
      { id: 'oi-8', menuItemId: 'm-10', name: 'Kesariya Shahi Kulfi Falooda', price: 210, quantity: 3, isVeg: true, status: 'served' }
    ],
    status: 'completed',
    paymentStatus: 'pending',
    subtotal: 2070,
    gstAmount: 103.5,
    discount: 100,
    grandTotal: 2073.5,
    waiterId: 'w-2',
    waiterName: 'Ravi Verma',
    createdAt: '11:50 AM'
  },
  {
    id: 'ord-104',
    restaurantId: 'rest-1',
    orderNumber: 'ORD-8823',
    type: 'room-service',
    roomNumber: 'Room 302',
    guestName: 'Rajesh Singhania',
    items: [
      { id: 'oi-9', menuItemId: 'm-1', name: 'Paneer Tikka Angaar', price: 360, quantity: 1, isVeg: true, status: 'preparing' },
      { id: 'oi-10', menuItemId: 'm-11', name: 'Royal Masala Chai Pot', price: 140, quantity: 2, isVeg: true, status: 'ready' }
    ],
    status: 'preparing',
    paymentStatus: 'pending',
    subtotal: 640,
    gstAmount: 32,
    discount: 0,
    grandTotal: 672,
    createdAt: '01:05 PM'
  },
  {
    id: 'ord-201',
    restaurantId: 'rest-2',
    orderNumber: 'OB-9001',
    type: 'dine-in',
    tableId: 't-201',
    tableNumber: 'OB-01',
    guestName: 'Alok Nath',
    guestPhone: '+91 99887 66554',
    items: [
      { id: 'oi-201', menuItemId: 'm-3', name: 'Tandoori Jumbo Tiger Prawns', price: 680, quantity: 2, isVeg: false, status: 'preparing' },
      { id: 'oi-202', menuItemId: 'm-12', name: 'Fresh Coconut Water Tender', price: 120, quantity: 2, isVeg: true, status: 'ready' }
    ],
    status: 'preparing',
    paymentStatus: 'pending',
    subtotal: 1600,
    gstAmount: 80,
    discount: 0,
    grandTotal: 1680,
    waiterName: 'Vikram Seth',
    createdAt: '01:20 PM'
  },
  // Section 24 Mixed Order Demonstration
  {
    id: 'ord-1055',
    restaurantId: 'rest-1',
    orderNumber: 'ORD-1055',
    billNumber: 'BILL-1055',
    billStatus: 'unbilled',
    type: 'dine-in',
    tableId: 't-4',
    tableNumber: 'T-04',
    guestName: 'Kapil & Ananya Mehra',
    guestPhone: '+91 98200 44321',
    items: [
      { id: 'oi-1055-1', menuItemId: 'm-5', name: 'Butter Chicken Murgh Makhani', price: 420, quantity: 1, isVeg: false, status: 'ready', menuType: 'food', categoryName: 'Royal Main Course' },
      { id: 'oi-1055-2', menuItemId: 'm-8', name: 'Garlic Butter Naan', price: 90, quantity: 2, isVeg: true, status: 'ready', menuType: 'food', categoryName: 'Artisan Breads' },
      { id: 'oi-1055-3', menuItemId: 'm-bar-1', name: 'Spiced Tamarind Whiskey Sour', price: 550, quantity: 1, isVeg: true, status: 'preparing', menuType: 'drink', categoryName: 'Handcrafted Cocktails' },
      { id: 'oi-1055-4', menuItemId: 'm-bev-1', name: 'Fresh Watermelon Mint Juice', price: 180, quantity: 2, isVeg: true, status: 'ready', menuType: 'drink', categoryName: 'Traditional Beverages' },
      { id: 'oi-1055-5', menuItemId: 'm-drk-1', name: 'Kingfisher Ultra Draught Pitcher', price: 650, quantity: 1, isVeg: true, status: 'preparing', menuType: 'drink', categoryName: 'Beers & Draft Brews' }
    ],
    status: 'preparing',
    paymentStatus: 'pending',
    foodSubtotal: 600,
    barSubtotal: 1560,
    subtotal: 2160,
    gstAmount: 108,
    discount: 0,
    grandTotal: 2268,
    waiterName: 'Amit Deshmukh',
    createdAt: '12:50 PM',
    notes: 'Anniversary celebration table. Extra mint on watermelon juice.'
  }
];

export const INITIAL_KITCHEN_TICKETS: KitchenTicket[] = [
  {
    id: 'kt-1',
    restaurantId: 'rest-1',
    orderId: 'ord-102',
    orderNumber: 'KOT-409',
    destination: 'Table T-02',
    tableNumber: 'T-02',
    guestName: 'Rohan Mehra',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Grill & Tandoor',
    stationType: 'cooking',
    items: [
      { id: 'ki-1', name: 'Murgh Malai Tikka', quantity: 2, isVeg: false, status: 'preparing', completed: false },
      { id: 'ki-2', name: 'Dum Awadhi Gosht Biryani', quantity: 2, notes: 'Extra raita with biryani, medium spicy', isVeg: false, status: 'preparing', completed: false }
    ],
    status: 'preparing',
    createdAt: '12:45 PM',
    createdAtTimestamp: Date.now() - 14 * 60 * 1000,
    preparingAtTimestamp: Date.now() - 11 * 60 * 1000,
    elapsedMinutes: 14,
    priority: 'urgent',
    specialInstructions: 'VIP Guests - Table 02. Medium spice, extra salan.',
    allergens: ['EXTRA SPICY']
  },
  {
    id: 'kt-2',
    restaurantId: 'rest-1',
    orderId: 'ord-104',
    orderNumber: 'KOT-410',
    destination: 'Room 302 (Deluxe Suite)',
    roomNumber: 'Room 302',
    guestName: 'Rajesh Singhania',
    waiterName: 'Room Service',
    orderType: 'room-service',
    station: 'Main Curries',
    stationType: 'cooking',
    items: [
      { id: 'ki-3', name: 'Paneer Tikka Angaar', quantity: 1, isVeg: true, status: 'new', completed: false }
    ],
    status: 'new',
    createdAt: '01:05 PM',
    createdAtTimestamp: Date.now() - 6 * 60 * 1000,
    elapsedMinutes: 6,
    priority: 'normal',
    specialInstructions: 'Deliver along with evening newspapers.',
    allergens: ['NO ONION NO GARLIC', 'JAIN PREPARATION']
  },
  {
    id: 'kt-3',
    restaurantId: 'rest-1',
    orderId: 'ord-106',
    orderNumber: 'BEV-408',
    destination: 'Table T-06',
    tableNumber: 'T-06',
    guestName: 'Ananya Sharma',
    waiterName: 'Sunil Pawar',
    orderType: 'dine-in',
    station: 'Beverages Station',
    stationType: 'beverages',
    items: [
      { id: 'ki-6', name: 'Filter Coffee', quantity: 2, isVeg: true, status: 'ready', completed: true },
      { id: 'ki-6b', name: 'Royal Masala Chai Pot', quantity: 1, isVeg: true, status: 'ready', completed: true }
    ],
    status: 'ready',
    createdAt: '12:35 PM',
    createdAtTimestamp: Date.now() - 22 * 60 * 1000,
    readyAtTimestamp: Date.now() - 2 * 60 * 1000,
    elapsedMinutes: 22,
    priority: 'normal',
    specialInstructions: 'Filter coffee extra hot with less brown sugar.',
    allergens: ['NUT ALLERGY']
  },
  {
    id: 'kt-4',
    restaurantId: 'rest-1',
    orderId: 'ord-107',
    orderNumber: 'KOT-411',
    destination: 'Table T-09',
    tableNumber: 'T-09',
    guestName: 'Kunal Kapoor',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Main Curries',
    stationType: 'cooking',
    items: [
      { id: 'ki-7', name: 'Dal Makhani Heritage', quantity: 2, isVeg: true, status: 'accepted', completed: false },
      { id: 'ki-8', name: 'Garlic Butter Naan', quantity: 4, isVeg: true, status: 'accepted', completed: false }
    ],
    status: 'accepted',
    createdAt: '01:12 PM',
    createdAtTimestamp: Date.now() - 4 * 60 * 1000,
    acceptedAtTimestamp: Date.now() - 2 * 60 * 1000,
    elapsedMinutes: 4,
    priority: 'high',
    specialInstructions: 'Crisp naan, less butter on dal.',
    allergens: ['DAIRY PRESENT']
  },
  // Section 24 Mixed Order Station Tickets (All share parent orderId 'ord-1055' at Table T-04)
  {
    id: 'kt-1055-cooking',
    restaurantId: 'rest-1',
    orderId: 'ord-1055',
    orderNumber: 'KOT-1055',
    destination: 'Table T-04',
    tableNumber: 'T-04',
    guestName: 'Kapil & Ananya Mehra',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Cooking Line',
    stationType: 'cooking',
    items: [
      { id: 'ki-1055-1', name: 'Butter Chicken Murgh Makhani', quantity: 1, isVeg: false, status: 'ready', completed: true },
      { id: 'ki-1055-2', name: 'Garlic Butter Naan', quantity: 2, isVeg: true, status: 'ready', completed: true }
    ],
    status: 'ready',
    createdAt: '12:50 PM',
    createdAtTimestamp: Date.now() - 18 * 60 * 1000,
    readyAtTimestamp: Date.now() - 3 * 60 * 1000,
    elapsedMinutes: 18,
    priority: 'high',
    specialInstructions: 'VIP Anniversary - Table T-04. Plated with edible gold leaf.',
    allergens: ['EXTRA SPICY']
  },
  {
    id: 'kt-1055-bar',
    restaurantId: 'rest-1',
    orderId: 'ord-1055',
    orderNumber: 'BOT-1055',
    destination: 'Table T-04',
    tableNumber: 'T-04',
    guestName: 'Kapil & Ananya Mehra',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Bar & Cellar',
    stationType: 'bar',
    items: [
      { id: 'ki-1055-3', name: 'Spiced Tamarind Whiskey Sour', quantity: 1, isVeg: true, status: 'preparing', completed: false }
    ],
    status: 'preparing',
    createdAt: '12:50 PM',
    createdAtTimestamp: Date.now() - 18 * 60 * 1000,
    preparingAtTimestamp: Date.now() - 10 * 60 * 1000,
    elapsedMinutes: 18,
    priority: 'high',
    specialInstructions: 'Flame cinnamon stick aroma on rim.'
  },
  {
    id: 'kt-1055-bev',
    restaurantId: 'rest-1',
    orderId: 'ord-1055',
    orderNumber: 'BEV-1055',
    destination: 'Table T-04',
    tableNumber: 'T-04',
    guestName: 'Kapil & Ananya Mehra',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Beverages Station',
    stationType: 'beverages',
    items: [
      { id: 'ki-1055-4', name: 'Fresh Watermelon Mint Juice', quantity: 2, isVeg: true, status: 'ready', completed: true }
    ],
    status: 'ready',
    createdAt: '12:50 PM',
    createdAtTimestamp: Date.now() - 18 * 60 * 1000,
    readyAtTimestamp: Date.now() - 4 * 60 * 1000,
    elapsedMinutes: 18,
    priority: 'normal',
    specialInstructions: 'Extra crushed fresh mint, chilled copper glasses.'
  },
  {
    id: 'kt-1055-drk',
    restaurantId: 'rest-1',
    orderId: 'ord-1055',
    orderNumber: 'DRK-1055',
    destination: 'Table T-04',
    tableNumber: 'T-04',
    guestName: 'Kapil & Ananya Mehra',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Drinks Station',
    stationType: 'drinks',
    items: [
      { id: 'ki-1055-5', name: 'Kingfisher Ultra Draught Pitcher', quantity: 1, isVeg: true, status: 'preparing', completed: false }
    ],
    status: 'preparing',
    createdAt: '12:50 PM',
    createdAtTimestamp: Date.now() - 18 * 60 * 1000,
    preparingAtTimestamp: Date.now() - 8 * 60 * 1000,
    elapsedMinutes: 18,
    priority: 'normal'
  },
  // Additional Active Station Tickets
  {
    id: 'kt-bar-active-1',
    restaurantId: 'rest-1',
    orderId: 'ord-108',
    orderNumber: 'BOT-1051',
    destination: 'Table T-01',
    tableNumber: 'T-01',
    guestName: 'Kapil Dev',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Bar & Cellar',
    stationType: 'bar',
    items: [
      { id: 'ki-bar-1', name: 'Handcrafted Kokum Martini', quantity: 2, isVeg: true, status: 'new', completed: false },
      { id: 'ki-bar-2', name: 'Bira 91 White Draft Brew', quantity: 1, isVeg: true, status: 'new', completed: false }
    ],
    status: 'new',
    createdAt: '01:15 PM',
    createdAtTimestamp: Date.now() - 5 * 60 * 1000,
    elapsedMinutes: 5,
    priority: 'urgent',
    specialInstructions: 'Ice cold chilled coupe glasses.'
  },
  {
    id: 'kt-bev-active-1',
    restaurantId: 'rest-1',
    orderId: 'ord-109',
    orderNumber: 'BEV-1052',
    destination: 'Table T-08',
    tableNumber: 'T-08',
    guestName: 'Dr. Siddharth Rao',
    waiterName: 'Sunil Pawar',
    orderType: 'dine-in',
    station: 'Beverages Station',
    stationType: 'beverages',
    items: [
      { id: 'ki-bev-1', name: 'Fresh Alphonso Mango Juice', quantity: 2, isVeg: true, status: 'accepted', completed: false },
      { id: 'ki-bev-2', name: 'Diet Coke Soft Drink', quantity: 1, isVeg: true, status: 'accepted', completed: false }
    ],
    status: 'accepted',
    createdAt: '01:10 PM',
    createdAtTimestamp: Date.now() - 8 * 60 * 1000,
    acceptedAtTimestamp: Date.now() - 4 * 60 * 1000,
    elapsedMinutes: 8,
    priority: 'normal',
    specialInstructions: 'No added sugar in mango juice.'
  },
  {
    id: 'kt-drk-active-1',
    restaurantId: 'rest-1',
    orderId: 'ord-110',
    orderNumber: 'DRK-1053',
    destination: 'Table T-05',
    tableNumber: 'T-05',
    guestName: 'Vikram Oberoi',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Drinks Station',
    stationType: 'drinks',
    items: [
      { id: 'ki-drk-1', name: 'Glenfiddich 12 YO Single Malt', quantity: 2, isVeg: true, status: 'preparing', completed: false },
      { id: 'ki-drk-2', name: 'Smoked Tamarind Cocktail', quantity: 1, isVeg: true, status: 'preparing', completed: false }
    ],
    status: 'preparing',
    createdAt: '01:02 PM',
    createdAtTimestamp: Date.now() - 16 * 60 * 1000,
    preparingAtTimestamp: Date.now() - 12 * 60 * 1000,
    elapsedMinutes: 16,
    priority: 'high',
    specialInstructions: 'Single large crystal ice sphere.'
  },
  {
    id: 'kt-5',
    restaurantId: 'rest-1',
    orderId: 'ord-108',
    orderNumber: 'KOT-407',
    destination: 'Table T-01',
    tableNumber: 'T-01',
    guestName: 'Kapil Dev',
    waiterName: 'Amit Deshmukh',
    orderType: 'dine-in',
    station: 'Grill & Tandoor',
    stationType: 'cooking',
    items: [
      { id: 'ki-9', name: 'Paneer Tikka Angaar', quantity: 1, isVeg: true, status: 'completed', completed: true },
      { id: 'ki-10', name: 'Paneer Butter Masala', quantity: 1, isVeg: true, status: 'completed', completed: true }
    ],
    status: 'completed',
    createdAt: '12:15 PM',
    createdAtTimestamp: Date.now() - 45 * 60 * 1000,
    readyAtTimestamp: Date.now() - 30 * 60 * 1000,
    completedAtTimestamp: Date.now() - 25 * 60 * 1000,
    elapsedMinutes: 45,
    priority: 'normal'
  },
  {
    id: 'kt-201',
    restaurantId: 'rest-2',
    orderId: 'ord-201',
    orderNumber: 'KOT-701',
    destination: 'Table OB-01',
    tableNumber: 'OB-01',
    guestName: 'Alok Nath',
    waiterName: 'Vikram Seth',
    orderType: 'dine-in',
    station: 'Grill & Tandoor',
    stationType: 'cooking',
    items: [
      { id: 'ki-201', name: 'Tandoori Jumbo Tiger Prawns', quantity: 2, isVeg: false, status: 'preparing', completed: false },
      { id: 'ki-202', name: 'Fresh Coconut Water Tender', quantity: 2, isVeg: true, status: 'ready', completed: true }
    ],
    status: 'preparing',
    createdAt: '01:20 PM',
    createdAtTimestamp: Date.now() - 5 * 60 * 1000,
    elapsedMinutes: 5,
    priority: 'urgent'
  }
];

export const ROOM_TYPES: RoomType[] = [
  {
    id: 'rt-deluxe',
    name: 'Deluxe City View',
    basePrice: 3800,
    maxOccupancy: 2,
    description: 'Spacious 340 sq.ft room with king bed, smart workstation, Italian marble bathroom, and panoramic city skyline views.',
    amenities: ['High-speed Wi-Fi', 'Smart TV 55"', 'Mini Bar', 'Electronic Safe', 'Rain Shower', 'Complimentary Breakfast'],
    image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'rt-executive',
    name: 'Executive Club Suite',
    basePrice: 6200,
    maxOccupancy: 3,
    description: 'Sumptuous 520 sq.ft suite with private lounge access, separate living area, espresso machine, and premium bath amenities.',
    amenities: ['Club Lounge Access', 'Espresso Machine', 'Bathtub & Rain Shower', 'Complimentary Cocktail Hour', '24/7 Butler Call'],
    image: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'rt-presidential',
    name: 'Presidential Royal Suite',
    basePrice: 11500,
    maxOccupancy: 4,
    description: 'Expansive 1,100 sq.ft duplex suite featuring jacuzzi, walk-in closet, private dining table for 6, and dedicated chauffeur pickup.',
    amenities: ['Private Jacuzzi', 'Dining Room', 'Dedicated Valet & Butler', 'Chauffeur Airport Transfer', 'Complimentary Laundry'],
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_ROOMS: Room[] = [
  { id: 'rm-101', number: '101', typeId: 'rt-deluxe', typeName: 'Deluxe City View', floor: 1, status: 'occupied', basePrice: 3800, features: ['King Bed', 'City View'], bedType: 'King', maxGuests: 2, guestName: 'Dr. Anand Verma', reservationId: 'RES-501' },
  { id: 'rm-102', number: '102', typeId: 'rt-deluxe', typeName: 'Deluxe City View', floor: 1, status: 'available', basePrice: 3800, features: ['Twin Beds', 'Garden View'], bedType: 'Twin', maxGuests: 2 },
  { id: 'rm-103', number: '103', typeId: 'rt-deluxe', typeName: 'Deluxe City View', floor: 1, status: 'cleaning', basePrice: 3800, features: ['King Bed'], bedType: 'King', maxGuests: 2, cleaningStaff: 'Sunita Mehra' },
  { id: 'rm-104', number: '104', typeId: 'rt-deluxe', typeName: 'Deluxe City View', floor: 1, status: 'occupied', basePrice: 3800, features: ['King Bed'], bedType: 'King', maxGuests: 2, guestName: 'Priya Sharma', reservationId: 'RES-502' },
  { id: 'rm-201', number: '201', typeId: 'rt-executive', typeName: 'Executive Club Suite', floor: 2, status: 'occupied', basePrice: 6200, features: ['Club Lounge', 'Living Area'], bedType: 'King', maxGuests: 3, guestName: 'Vikramaditya Singhania', reservationId: 'RES-503' },
  { id: 'rm-202', number: '202', typeId: 'rt-executive', typeName: 'Executive Club Suite', floor: 2, status: 'available', basePrice: 6200, features: ['Club Lounge', 'Balcony'], bedType: 'King', maxGuests: 3 },
  { id: 'rm-203', number: '203', typeId: 'rt-executive', typeName: 'Executive Club Suite', floor: 2, status: 'inspected', basePrice: 6200, features: ['Club Lounge', 'Bathtub'], bedType: 'King', maxGuests: 3 },
  { id: 'rm-204', number: '204', typeId: 'rt-executive', typeName: 'Executive Club Suite', floor: 2, status: 'maintenance', basePrice: 6200, features: ['Club Lounge'], bedType: 'King', maxGuests: 3 },
  { id: 'rm-301', number: '301', typeId: 'rt-presidential', typeName: 'Presidential Royal Suite', floor: 3, status: 'available', basePrice: 11500, features: ['Jacuzzi', 'Private Dining'], bedType: 'Super King', maxGuests: 4 },
  { id: 'rm-302', number: '302', typeId: 'rt-presidential', typeName: 'Presidential Royal Suite', floor: 3, status: 'occupied', basePrice: 11500, features: ['Jacuzzi', 'Duplex', 'Butler'], bedType: 'Super King', maxGuests: 4, guestName: 'Rajesh Singhania', reservationId: 'RES-504' }
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  {
    id: 'res-501',
    bookingNumber: 'RES-501',
    guestName: 'Dr. Anand Verma',
    guestPhone: '+91 98450 12345',
    guestEmail: 'anand.verma@aiims.edu',
    roomNumber: '101',
    roomTypeName: 'Deluxe City View',
    checkInDate: '2026-09-02',
    checkOutDate: '2026-09-05',
    adults: 2,
    children: 0,
    status: 'checked-in',
    totalAmount: 11400,
    paidAmount: 11400,
    paymentStatus: 'paid',
    paymentMethod: 'upi',
    idProofType: 'Aadhaar Card',
    idProofNumber: 'XXXX-XXXX-4812'
  },
  {
    id: 'res-502',
    bookingNumber: 'RES-502',
    guestName: 'Priya Sharma',
    guestPhone: '+91 97110 54321',
    guestEmail: 'priya.sharma@consulting.com',
    roomNumber: '104',
    roomTypeName: 'Deluxe City View',
    checkInDate: '2026-09-03',
    checkOutDate: '2026-09-06',
    adults: 1,
    children: 0,
    status: 'checked-in',
    totalAmount: 11400,
    paidAmount: 5000,
    paymentStatus: 'partial',
    paymentMethod: 'card',
    idProofType: 'Passport',
    idProofNumber: 'Z8941203'
  },
  {
    id: 'res-503',
    bookingNumber: 'RES-503',
    guestName: 'Vikramaditya Singhania',
    guestPhone: '+91 98200 99999',
    guestEmail: 'vikram@singhaniagroup.in',
    roomNumber: '201',
    roomTypeName: 'Executive Club Suite',
    checkInDate: '2026-09-01',
    checkOutDate: '2026-09-04',
    adults: 2,
    children: 1,
    status: 'checked-in',
    totalAmount: 18600,
    paidAmount: 18600,
    paymentStatus: 'paid',
    paymentMethod: 'card',
    specialRequests: 'High floor, late checkout requested'
  },
  {
    id: 'res-504',
    bookingNumber: 'RES-504',
    guestName: 'Rajesh Singhania',
    guestPhone: '+91 98222 33333',
    guestEmail: 'rajesh@singhaniacorp.com',
    roomNumber: '302',
    roomTypeName: 'Presidential Royal Suite',
    checkInDate: '2026-09-03',
    checkOutDate: '2026-09-07',
    adults: 2,
    children: 0,
    status: 'checked-in',
    totalAmount: 46000,
    paidAmount: 46000,
    paymentStatus: 'paid',
    paymentMethod: 'card'
  },
  {
    id: 'res-505',
    bookingNumber: 'RES-505',
    guestName: 'Lt. Col. Sanjeev Nair',
    guestPhone: '+91 98401 77889',
    guestEmail: 'sanjeev.nair@defense.gov.in',
    roomNumber: '202',
    roomTypeName: 'Executive Club Suite',
    checkInDate: '2026-09-04',
    checkOutDate: '2026-09-07',
    adults: 2,
    children: 0,
    status: 'confirmed',
    totalAmount: 18600,
    paidAmount: 5000,
    paymentStatus: 'partial',
    paymentMethod: 'upi'
  }
];

export const INITIAL_GUESTS: Guest[] = [
  {
    id: 'g-1',
    name: 'Dr. Anand Verma',
    phone: '+91 98450 12345',
    email: 'anand.verma@aiims.edu',
    idProofType: 'Aadhaar Card',
    idProofNumber: 'XXXX-XXXX-4812',
    city: 'New Delhi',
    state: 'Delhi',
    vipStatus: true,
    totalVisits: 6,
    totalSpent: 84500,
    lastVisit: '2026-09-02'
  },
  {
    id: 'g-2',
    name: 'Vikramaditya Singhania',
    phone: '+91 98200 99999',
    email: 'vikram@singhaniagroup.in',
    idProofType: 'Passport',
    idProofNumber: 'N4820194',
    city: 'Mumbai',
    state: 'Maharashtra',
    vipStatus: true,
    totalVisits: 14,
    totalSpent: 265000,
    lastVisit: '2026-09-01'
  },
  {
    id: 'g-3',
    name: 'Priya Sharma',
    phone: '+91 97110 54321',
    email: 'priya.sharma@consulting.com',
    idProofType: 'Passport',
    idProofNumber: 'Z8941203',
    city: 'Bengaluru',
    state: 'Karnataka',
    vipStatus: false,
    totalVisits: 3,
    totalSpent: 38200,
    lastVisit: '2026-09-03'
  }
];

export const INITIAL_HOUSEKEEPING_TASKS: HousekeepingTask[] = [
  {
    id: 'hk-1',
    roomNumber: '103',
    roomTypeName: 'Deluxe City View',
    floor: 1,
    assignedToName: 'Sunita Mehra',
    assignedToId: 'u-housekeeping',
    status: 'cleaning',
    priority: 'high',
    scheduledTime: '11:30 AM',
    notes: 'Guest checked out at 11:00 AM. Deep linen replacement.'
  },
  {
    id: 'hk-2',
    roomNumber: '203',
    roomTypeName: 'Executive Club Suite',
    floor: 2,
    assignedToName: 'Ramesh Mali',
    assignedToId: 'emp-5',
    status: 'cleaned',
    priority: 'medium',
    scheduledTime: '12:00 PM',
    notes: 'Ready for supervisor inspection.'
  },
  {
    id: 'hk-3',
    roomNumber: '102',
    roomTypeName: 'Deluxe City View',
    floor: 1,
    assignedToName: 'Sunita Mehra',
    assignedToId: 'u-housekeeping',
    status: 'available',
    priority: 'low',
    scheduledTime: '09:00 AM',
    completedAt: '09:40 AM'
  },
  {
    id: 'hk-4',
    roomNumber: '204',
    roomTypeName: 'Executive Club Suite',
    floor: 2,
    assignedToName: 'Sunita Mehra',
    assignedToId: 'u-housekeeping',
    status: 'dirty',
    priority: 'urgent',
    scheduledTime: '01:30 PM',
    notes: 'AC condensation leak reported, pending maintenance.'
  }
];

export const INITIAL_MAINTENANCE: MaintenanceRequest[] = [
  {
    id: 'mnt-1',
    roomOrArea: 'Room 204',
    issue: 'HVAC fan motor producing vibration hum',
    priority: 'high',
    status: 'in-progress',
    reportedBy: 'Sunita Mehra (Housekeeping)',
    reportedAt: 'Today, 10:15 AM',
    assignedTechnician: 'Manoj HVAC Engineer'
  },
  {
    id: 'mnt-2',
    roomOrArea: 'Main Dining Section',
    issue: 'Table 04 overhead spotlight flickering',
    priority: 'medium',
    status: 'pending',
    reportedBy: 'Amit Deshmukh (Dining Captain)',
    reportedAt: 'Today, 11:45 AM'
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    name: 'Fresh Buffalo Paneer',
    category: 'Produce & Dairy',
    currentStock: 18,
    minStockLevel: 25,
    unit: 'kg',
    unitCost: 320,
    supplierName: 'Amul Dairy Hub Mumbai',
    supplierPhone: '+91 98200 11223',
    lastRestocked: 'Yesterday',
    status: 'low-stock'
  },
  {
    id: 'inv-2',
    name: 'Aged Dehradun Basmati Rice',
    category: 'Grains & Spices',
    currentStock: 140,
    minStockLevel: 50,
    unit: 'kg',
    unitCost: 110,
    supplierName: 'Kalyan Agro Commodities',
    supplierPhone: '+91 98200 44556',
    lastRestocked: '2 days ago',
    status: 'in-stock'
  },
  {
    id: 'inv-3',
    name: 'Premium Kashmiri Saffron',
    category: 'Grains & Spices',
    currentStock: 45,
    minStockLevel: 20,
    unit: 'g',
    unitCost: 280,
    supplierName: 'Pampore Royal Spices',
    supplierPhone: '+91 98200 77889',
    lastRestocked: '1 week ago',
    status: 'in-stock'
  },
  {
    id: 'inv-4',
    name: 'Single Origin Espresso Beans',
    category: 'Beverages',
    currentStock: 4,
    minStockLevel: 10,
    unit: 'kg',
    unitCost: 850,
    supplierName: 'Blue Tokai Roasters',
    supplierPhone: '+91 98200 33221',
    lastRestocked: '5 days ago',
    status: 'low-stock'
  },
  {
    id: 'inv-5',
    name: 'Egyptian Cotton Bath Towels (650 GSM)',
    category: 'Housekeeping & Linens',
    currentStock: 82,
    minStockLevel: 40,
    unit: 'pcs',
    unitCost: 450,
    supplierName: 'Welspun Luxury Textiles',
    supplierPhone: '+91 98200 88990',
    lastRestocked: '3 days ago',
    status: 'in-stock'
  },
  {
    id: 'inv-6',
    name: 'Organic Jasmine Green Tea Sachets',
    category: 'Room Amenities',
    currentStock: 15,
    minStockLevel: 50,
    unit: 'boxes',
    unitCost: 180,
    supplierName: 'Makaibari Organic Teas',
    supplierPhone: '+91 98200 55443',
    lastRestocked: '6 days ago',
    status: 'low-stock'
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-101',
    poNumber: 'PO-2026-089',
    supplierName: 'Amul Dairy Hub Mumbai',
    itemsCount: 4,
    totalAmount: 28400,
    status: 'ordered',
    orderDate: '2026-09-02',
    expectedDelivery: '2026-09-04'
  },
  {
    id: 'po-102',
    poNumber: 'PO-2026-090',
    supplierName: 'Blue Tokai Roasters',
    itemsCount: 2,
    totalAmount: 14500,
    status: 'draft',
    orderDate: '2026-09-03',
    expectedDelivery: '2026-09-06'
  }
];

export const INITIAL_WASTE_RECORDS: WasteRecord[] = [
  {
    id: 'w-1',
    itemName: 'Fresh Buffalo Paneer',
    quantity: 1.8,
    unit: 'kg',
    reason: 'Preparation Waste',
    costLoss: 576,
    recordedBy: 'Chef Ranveer Brar',
    date: 'Today, 10:00 AM'
  },
  {
    id: 'w-2',
    itemName: 'Sweet Lime Batch',
    quantity: 4,
    unit: 'kg',
    reason: 'Spoilage',
    costLoss: 360,
    recordedBy: 'Dinesh Agarwal',
    date: 'Yesterday'
  }
];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    employeeCode: 'GA-001',
    name: 'Vikramaditya Oberoi',
    email: 'admin@paliclub.com',
    phone: '+91 98201 12345',
    role: 'SUPER_ADMIN',
    roleTitle: 'Chief Executive & MD',
    department: 'Executive Management',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 280000,
    joinDate: '2021-04-01',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '08:30 AM',
    attendanceRate: 99
  },
  {
    id: 'emp-2',
    employeeCode: 'GA-014',
    name: 'Chef Ranveer Brar',
    email: 'chef@paliclub.com',
    phone: '+91 98204 45678',
    role: 'KITCHEN_STAFF',
    roleTitle: 'Executive Chef',
    department: 'Kitchen',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 145000,
    joinDate: '2022-08-15',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '07:15 AM',
    attendanceRate: 98
  },
  {
    id: 'emp-3',
    employeeCode: 'GA-022',
    name: 'Neha Sharma',
    email: 'cashier@paliclub.com',
    phone: '+91 98203 34567',
    role: 'CASHIER',
    roleTitle: 'Chief Cashier & Auditor',
    department: 'Accounts',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 48000,
    joinDate: '2023-01-10',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '07:55 AM',
    attendanceRate: 96
  },
  {
    id: 'emp-4',
    employeeCode: 'GA-031',
    name: 'Amit Deshmukh',
    email: 'waiter@paliclub.com',
    phone: '+91 98205 56789',
    role: 'WAITER',
    roleTitle: 'Senior Dining Captain',
    department: 'Restaurant Service',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 32000,
    joinDate: '2023-05-12',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '09:00 AM',
    attendanceRate: 94
  },
  {
    id: 'emp-5',
    employeeCode: 'GA-045',
    name: 'Sunita Mehra',
    email: 'housekeeping@paliclub.com',
    phone: '+91 98208 89012',
    role: 'HOUSEKEEPING',
    roleTitle: 'Housekeeping Incharge',
    department: 'Housekeeping',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 36000,
    joinDate: '2022-11-01',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '06:25 AM',
    attendanceRate: 97
  },
  {
    id: 'emp-6',
    employeeCode: 'GA-051',
    name: 'Master Tandoor & Grill Chef',
    email: 'cooking@paliclub.test',
    phone: '+91 98204 11001',
    role: 'KITCHEN_COOKING',
    roleTitle: 'Line Cooking Chef',
    department: 'Culinary & Cooking',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 52000,
    joinDate: '2023-02-15',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '08:00 AM',
    attendanceRate: 98
  },
  {
    id: 'emp-7',
    employeeCode: 'GA-052',
    name: 'Sommelier & Mixologist',
    email: 'bar@paliclub.test',
    phone: '+91 98204 22002',
    role: 'KITCHEN_BAR',
    roleTitle: 'Bar Lead & Mixologist',
    department: 'Bar & Cellar',
    shift: 'Evening (14:00 - 23:00)',
    monthlySalary: 58000,
    joinDate: '2023-03-01',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '08:15 AM',
    attendanceRate: 99
  },
  {
    id: 'emp-8',
    employeeCode: 'GA-053',
    name: 'Executive Sous Chef Controller',
    email: 'executive@paliclub.test',
    phone: '+91 98204 33003',
    role: 'KITCHEN_EXECUTIVE',
    roleTitle: 'Kitchen Executive Lead',
    department: 'Executive Kitchen Operations',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 110000,
    joinDate: '2022-06-10',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '07:45 AM',
    attendanceRate: 100
  },
  {
    id: 'emp-9',
    employeeCode: 'GA-054',
    name: 'Beverage Barista & Juicer',
    email: 'beverages@paliclub.test',
    phone: '+91 98204 44004',
    role: 'BEVERAGES',
    roleTitle: 'Beverages Specialist',
    department: 'Beverages & Refreshers',
    shift: 'Morning (06:00 - 15:00)',
    monthlySalary: 38000,
    joinDate: '2023-08-20',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '08:30 AM',
    attendanceRate: 95
  },
  {
    id: 'emp-10',
    employeeCode: 'GA-055',
    name: 'Cellar & Draught Specialist',
    email: 'drinks@paliclub.test',
    phone: '+91 98204 55005',
    role: 'DRINKS',
    roleTitle: 'Drinks Specialist',
    department: 'Bar & Drinks',
    shift: 'Evening (14:00 - 23:00)',
    monthlySalary: 40000,
    joinDate: '2023-09-01',
    status: 'active',
    isClockedIn: true,
    clockedInAt: '09:00 AM',
    attendanceRate: 96
  }
];

export const INITIAL_CUSTOMERS: CustomerProfile[] = [
  {
    id: 'crm-1',
    name: 'Vikramaditya Singhania',
    phone: '+91 98200 99999',
    email: 'vikram@singhaniagroup.in',
    tier: 'Diamond',
    points: 8450,
    visitsCount: 14,
    totalSpent: 265000,
    favoriteDish: 'Dum Awadhi Gosht Biryani',
    preferredRoom: 'Presidential Royal Suite 302',
    joinedDate: '2024-02-10'
  },
  {
    id: 'crm-2',
    name: 'Dr. Anand Verma',
    phone: '+91 98450 12345',
    email: 'anand.verma@aiims.edu',
    tier: 'Platinum',
    points: 4120,
    visitsCount: 6,
    totalSpent: 84500,
    favoriteDish: 'Paneer Tikka Angaar',
    preferredRoom: 'Deluxe City View 101',
    joinedDate: '2024-06-18'
  },
  {
    id: 'crm-3',
    name: 'Priya Sharma',
    phone: '+91 97110 54321',
    email: 'priya.sharma@consulting.com',
    tier: 'Gold',
    points: 1850,
    visitsCount: 3,
    totalSpent: 38200,
    favoriteDish: 'Mysore Masala Dosa',
    preferredRoom: 'Deluxe 104',
    joinedDate: '2025-01-22'
  }
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    customerName: 'Dr. Anand Verma',
    rating: 5,
    serviceType: 'Restaurant',
    comment: 'The Awadhi Gosht Biryani and Dal Makhani Heritage are unmatched in Mumbai. Flawless hospitality by dining captain Amit.',
    date: 'Yesterday, 09:30 PM',
    status: 'published',
    response: 'Thank you Dr. Verma, we look forward to hosting your medical conference delegates!'
  },
  {
    id: 'rev-2',
    customerName: 'Lt. Col. Sanjeev Nair',
    rating: 5,
    serviceType: 'Hotel',
    comment: 'Impeccably clean rooms, seamless express check-in at front desk, and peaceful ambiance on the executive floor.',
    date: '2 days ago',
    status: 'published'
  }
];

export const INITIAL_COMPLAINTS: Complaint[] = [
  {
    id: 'cmp-1',
    ticketNo: 'TKT-1042',
    customerName: 'Kunal Kapoor',
    contact: '+91 98200 55112',
    department: 'Restaurant Service',
    description: 'Dessert delivery was delayed by 15 minutes during peak dinner hours on Table T-04.',
    priority: 'medium',
    status: 'resolved',
    date: 'Yesterday',
    resolution: 'Apologized in person, waived off dessert charges, complimentary chef special dessert provided.'
  }
];

export const INITIAL_PAYMENTS: PaymentTransaction[] = [
  {
    id: 'pay-1',
    transactionId: 'TXN-99104',
    invoiceNo: 'INV-2026-8801',
    source: 'Restaurant POS',
    customerName: 'Kapil Dev',
    amount: 976.5,
    method: 'upi',
    status: 'success',
    date: 'Today, 12:55 PM',
    gstAmount: 46.5,
    refNumber: 'UPI/62491048201/YESB'
  },
  {
    id: 'pay-2',
    transactionId: 'TXN-99103',
    invoiceNo: 'INV-2026-8800',
    source: 'Hotel Front Desk',
    customerName: 'Dr. Anand Verma',
    amount: 11400,
    method: 'card',
    status: 'success',
    date: 'Today, 10:20 AM',
    gstAmount: 1368,
    refNumber: 'HDFC-POS-AUTH-94021'
  },
  {
    id: 'pay-3',
    transactionId: 'TXN-99102',
    invoiceNo: 'INV-2026-8799',
    source: 'Room Service',
    customerName: 'Vikramaditya Singhania',
    amount: 1450,
    method: 'room-charge',
    status: 'success',
    date: 'Today, 08:30 AM',
    gstAmount: 72.5,
    refNumber: 'FOLIO-RES-503'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    userId: 'u-admin',
    userName: 'Vikramaditya Oberoi',
    userRole: 'SUPER_ADMIN',
    action: 'System Configuration Updated',
    module: 'Settings & Security',
    details: 'GST rates verified for F&B (5%) and Luxury Accommodation (12%/18%). Cloud backup verified.',
    timestamp: 'Today, 10:15 AM',
    ipAddress: '192.168.1.10',
    status: 'SUCCESS'
  },
  {
    id: 'log-2',
    userId: 'u-cashier',
    userName: 'Neha Sharma',
    userRole: 'CASHIER',
    action: 'Payment Succeeded',
    module: 'Billing & POS',
    details: 'Settled invoice INV-2026-8801 for ₹976.5 via UPI (Ref: UPI/62491048201). Table T-01 cleared.',
    timestamp: 'Today, 12:55 PM',
    ipAddress: '192.168.1.18',
    status: 'SUCCESS'
  },
  {
    id: 'log-3',
    userId: 'u-chef',
    userName: 'Chef Ranveer Brar',
    userRole: 'KITCHEN_STAFF',
    action: 'KDS Order Bumped to Ready',
    module: 'Kitchen & KDS',
    details: 'Completed KOT-408 for Table T-06 (2x Mysore Dosa, 2x Filter Coffee).',
    timestamp: 'Today, 12:35 PM',
    ipAddress: '192.168.1.25',
    status: 'SUCCESS'
  },
  {
    id: 'log-4',
    userId: 'u-reception',
    userName: 'Ananya Roy',
    userRole: 'RECEPTIONIST',
    action: 'Guest Check-in Registered',
    module: 'Front Desk & Rooms',
    details: 'Completed check-in for Dr. Anand Verma into Room 101. Keycard issued.',
    timestamp: 'Today, 10:20 AM',
    ipAddress: '192.168.1.12',
    status: 'SUCCESS'
  },
  {
    id: 'log-5',
    userId: 'u-housekeeping',
    userName: 'Sunita Mehra',
    userRole: 'HOUSEKEEPING',
    action: 'Room Inspection Passed',
    module: 'Housekeeping',
    details: 'Room 203 inspected and certified ready for immediate guest arrival.',
    timestamp: 'Today, 11:10 AM',
    ipAddress: '192.168.1.34',
    status: 'SUCCESS'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-waiter-ready-1',
    title: 'ORDER READY: Table T-02',
    message: 'Table T-02 (Amit Shah): 2x Murgh Malai Tikka, 1x Dal Makhani is READY for service. Please collect from Kitchen pass and serve immediately.',
    type: 'success',
    targetRoles: ['WAITER', 'WAITER_MANAGER', 'RESTAURANT_OWNER', 'SUPER_ADMIN'],
    createdAt: '2 mins ago',
    read: false,
    link: '/waiter/dashboard',
    tableNumber: 'T-02',
    orderId: 'ord-2',
    customerName: 'Amit Shah',
    itemsSummary: '2x Murgh Malai Tikka, 1x Dal Makhani',
    notificationCategory: 'order_ready'
  },
  {
    id: 'notif-waiter-qr-1',
    title: 'QR Order: Table T-04',
    message: 'Table T-04: 3 items (2 Food, 1 Bar) placed via QR menu by Vikramaditya Singhania. Total: ₹1,650.',
    type: 'info',
    targetRoles: ['WAITER', 'WAITER_MANAGER', 'KITCHEN_STAFF', 'SUPER_ADMIN'],
    createdAt: '5 mins ago',
    read: false,
    link: '/waiter/dashboard',
    tableNumber: 'T-04',
    orderId: 'ord-4',
    customerName: 'Vikramaditya Singhania',
    itemsSummary: '2 Food, 1 Bar (1x Butter Chicken, 2x Garlic Naan, 1x Fresh Lime Soda)',
    notificationCategory: 'qr_order'
  },
  {
    id: 'notif-waiter-svc-1',
    title: 'Service Request: Table T-01',
    message: 'Guest at Table T-01 requested: Fresh Water Bottle',
    type: 'warning',
    targetRoles: ['WAITER', 'WAITER_MANAGER', 'SUPER_ADMIN'],
    createdAt: '4 mins ago',
    read: false,
    link: '/waiter/dashboard',
    tableNumber: 'T-01',
    customerName: 'Guest T-01',
    itemsSummary: 'Service: Water',
    notificationCategory: 'service_request'
  },
  {
    id: 'notif-1',
    title: 'New High Priority Order KOT-409',
    message: 'Table T-02 placed an order with 2x Murgh Malai Tikka and 2x Gosht Biryani.',
    type: 'warning',
    targetRoles: ['KITCHEN_STAFF', 'RESTAURANT_OWNER', 'SUPER_ADMIN'],
    createdAt: '14 mins ago',
    read: false,
    link: '/kitchen/orders'
  },
  {
    id: 'notif-2',
    title: 'Low Stock Alert: Buffalo Paneer',
    message: 'Fresh Buffalo Paneer has reached 18kg (Threshold: 25kg). Auto-reorder advised.',
    type: 'warning',
    targetRoles: ['CASHIER', 'RESTAURANT_OWNER', 'SUPER_ADMIN'],
    createdAt: '45 mins ago',
    read: false,
    link: '/inventory/stock'
  },
  {
    id: 'notif-3',
    title: 'Room 103 Ready for Cleaning',
    message: 'Guest checkout completed for Deluxe Room 101. Housekeeping team dispatched.',
    type: 'info',
    targetRoles: ['HOUSEKEEPING', 'SUPER_ADMIN'],
    createdAt: '1 hr ago',
    read: true,
    link: '/housekeeping/cleaning'
  },
  {
    id: 'notif-4',
    title: 'VIP Guest Arrival Notice',
    message: 'Vikramaditya Singhania checked into Presidential Suite 302.',
    type: 'success',
    targetRoles: ['RECEPTIONIST', 'ROOM_SERVICE', 'SUPER_ADMIN'],
    createdAt: '2 hrs ago',
    read: true,
    link: '/hotel/rooms'
  }
];

export const INITIAL_WAITER_REQUESTS: WaiterRequest[] = [
  { id: 'wr-1', tableNumber: 'T-01', requestType: 'Water', requestedAt: '5 mins ago', status: 'pending' },
  { id: 'wr-2', tableNumber: 'T-04', requestType: 'Bill', requestedAt: '12 mins ago', status: 'pending' },
  { id: 'wr-3', tableNumber: 'T-02', requestType: 'Call Waiter', requestedAt: '2 mins ago', status: 'pending' }
];
