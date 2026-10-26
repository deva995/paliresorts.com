import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  Compass,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Building2,
  UtensilsCrossed,
  CreditCard,
  ChefHat,
  ConciergeBell,
  Hotel,
  Sparkles,
  BedDouble,
  QrCode,
  ShieldCheck,
  TrendingUp,
  FileBarChart,
  Users,
  Layers,
  ArrowRight,
  Check,
  Smartphone,
  Eye,
  Store,
  Clock,
  Printer,
  Bell,
  RefreshCw,
  Zap,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

export interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  targetRoute: string;
  description: string;
  highlights: string[];
  shortcutHint?: string;
  proTip?: string;
  previewType:
    | 'multi-tenant'
    | 'analytics'
    | 'rbac'
    | 'table-map'
    | 'kds-ticket'
    | 'pos-billing'
    | 'waiter-bell'
    | 'frontdesk-rooms'
    | 'housekeeping-board'
    | 'roomservice-tray'
    | 'customer-qr';
}

export interface RoleTourConfig {
  role: UserRole;
  displayName: string;
  department: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: OnboardingStep[];
}

export const ROLE_TOUR_CONFIGS: Record<string, RoleTourConfig> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    displayName: 'Super Admin & Executive Controller',
    department: 'Executive Governance & SaaS Management',
    tagline: 'Multi-outlet tenant oversight, financial analytics, RBAC permissions, and system compliance.',
    icon: ShieldCheck,
    steps: [
      {
        id: 'sa-outlets',
        title: 'Multi-Property & Tenant Isolation',
        subtitle: 'Centralized Resort Outlets',
        category: 'Outlet Architecture',
        targetRoute: '/restaurants',
        description: 'Manage multiple hospitality properties—such as Pali Resort & Club, Pali Village, and Poolside Lounge—under a single unified platform. Each outlet operates with isolated menu items, tables, staff, and financial reporting.',
        highlights: [
          'Instant 1-click active outlet switching from the top header',
          'Complete multi-tenant data isolation with zero data leakage',
          'Individual outlet tax rates, currencies, and table counts'
        ],
        shortcutHint: 'Header Outlet Switcher',
        proTip: 'Use the top-right outlet selector to simulate operations for specific resort venues.',
        previewType: 'multi-tenant'
      },
      {
        id: 'sa-analytics',
        title: 'Consolidated Executive Intelligence',
        subtitle: 'Enterprise Revenue Pulse',
        category: 'Financial Analytics',
        targetRoute: '/super-admin/dashboard',
        description: 'Real-time telemetry on gross resort turnover, ADR (Average Daily Rate), RevPAR, table covers, active KOT tickets, and departmental staffing levels across all properties.',
        highlights: [
          'Live gross revenue, covers, and room occupancy rates',
          'Inter-departmental performance index (F&B, Front Desk, Housekeeping)',
          'Comparative daily, weekly, and monthly growth trends'
        ],
        shortcutHint: 'Default Admin Dashboard',
        proTip: 'Click on any KPI widget in the executive dashboard to inspect detailed breakdown tables.',
        previewType: 'analytics'
      },
      {
        id: 'sa-rbac',
        title: 'Granular RBAC & Role Preview Mode',
        subtitle: 'Security & Access Control',
        category: 'Platform Security',
        targetRoute: '/roles',
        description: 'Enforce enterprise-grade security across 16+ defined hospitality roles. The live Role Preview Simulator lets you instantly experience the system through the eyes of a Waiter, Chef, Cashier, or Receptionist.',
        highlights: [
          'Strict module-level route guards preventing unauthorized access',
          'Live Role Preview mode with top banner indicator',
          'Fine-grained permissions for actions: View, Create, Edit, Settle, Manage'
        ],
        shortcutHint: 'Roles & Permissions View',
        proTip: 'Test staff workflows without signing out by activating the Role Preview simulator.',
        previewType: 'rbac'
      },
      {
        id: 'sa-gst',
        title: 'Statutory GST & Financial Reporting',
        subtitle: 'Audit & Compliance',
        category: 'Tax & Compliance',
        targetRoute: '/reports/gst',
        description: 'Comprehensive statutory tax reports configured for Indian GST regulations. Generate compliant GSTR-1 and GSTR-3B records with bifurcated 5% F&B and 12%/18% accommodation tax slabs.',
        highlights: [
          'Statutory GSTR-1 and GSTR-3B tax compliance logs',
          'Bifurcated CGST, SGST, and SAC/HSN code tracking',
          'Executive P&L statements and operational EBITDA analysis'
        ],
        shortcutHint: 'Reports -> GST Compliance',
        proTip: 'Export monthly GST reports in standard CSV/PDF formats for statutory filing.',
        previewType: 'analytics'
      },
      {
        id: 'sa-audit',
        title: 'Enterprise Audit Trail & Cloud Sync',
        subtitle: 'Security Timeline & Health',
        category: 'System Governance',
        targetRoute: '/audit-logs',
        description: 'Maintain an immutable, timestamped audit log of all critical operations—including bill discounts, item voids, price modifications, and offline synchronization events.',
        highlights: [
          'Cryptographically ordered audit log with user and IP attribution',
          'Real-time offline queue synchronization status indicator',
          'Comprehensive emergency rollback and incident investigation'
        ],
        shortcutHint: 'Audit Logs Navigation',
        proTip: 'Type ⌘K and enter "audit" to jump straight into the enterprise security trail.',
        previewType: 'analytics'
      }
    ]
  },

  RESTAURANT_OWNER: {
    role: 'RESTAURANT_OWNER',
    displayName: 'Restaurant Owner & General Manager',
    department: 'F&B Operations & Dining Experience',
    tagline: 'Floor plan orchestration, live order flow, digital menu engineering, and customer analytics.',
    icon: UtensilsCrossed,
    steps: [
      {
        id: 'ro-overview',
        title: 'Live Dining Operations Hub',
        subtitle: 'Real-Time Dining Telemetry',
        category: 'F&B Dashboard',
        targetRoute: '/restaurant/dashboard',
        description: 'Your central command for resort dining. Monitor live active tables, occupied covers, ongoing kitchen tickets, today’s gross dining sales, and average guest turn-around time in real time.',
        highlights: [
          'Live table occupancy and dining covers index',
          'Current kitchen pipeline with active preparation timers',
          'Hourly sales velocity and average check size'
        ],
        shortcutHint: 'Restaurant Dashboard',
        proTip: 'Pin high-turnover tables to keep watch during peak holiday dinners.',
        previewType: 'analytics'
      },
      {
        id: 'ro-floor',
        title: 'Floor Plan & Section Management',
        subtitle: 'Dynamic Table Layout',
        category: 'Floor Operations',
        targetRoute: '/restaurant/tables',
        description: 'Oversee all dining sections: Main Dining, Terrace Garden, AC Family Lounge, and VIP Private Dining. Tables dynamically reflect live statuses: Available (Green), Occupied (Red), Billed (Yellow), or Reserved (Blue).',
        highlights: [
          'Color-coded table status indicators with real-time updates',
          'Direct table selection for instant order punching or bill reviews',
          'Assigned server and guest count tracking per table'
        ],
        shortcutHint: 'Table Floor Map',
        proTip: 'Click any table to view the active order items, current dining duration, and assigned waiter.',
        previewType: 'table-map'
      },
      {
        id: 'ro-orders',
        title: 'Live Order Stream & POS Orchestration',
        subtitle: 'Order Pipeline & Dispatch',
        category: 'Order Management',
        targetRoute: '/restaurant/orders',
        description: 'Orchestrate Dine-in, Takeaway, and Room Service orders from a unified stream. Dispatch digital KOT/BOT tickets to culinary and bar lines with zero delay or confusion.',
        highlights: [
          'Multi-channel order ingestion (Waiter POS, Guest QR, Room Phone)',
          'Instant KOT generation with spice levels and special cooking notes',
          'Course pacing (Appetizers first, Main courses on hold)'
        ],
        shortcutHint: 'Live Orders View',
        proTip: 'Filter by "Active" to see only orders currently cooking or awaiting delivery.',
        previewType: 'kds-ticket'
      },
      {
        id: 'ro-menu',
        title: 'Digital Menu Engineering & Tax Slabs',
        subtitle: 'Catalog & Portion Control',
        category: 'Menu Management',
        targetRoute: '/restaurant/menu',
        description: 'Manage your culinary catalog with portion pricing (Regular, Half, Full), dietary tags (Veg, Non-Veg, Chef Special), 5% GST tax slabs, and instant 1-tap 86-item availability toggles.',
        highlights: [
          'Portion-based price matrices with automated tax calculation',
          'Instant 1-tap item availability toggle for out-of-stock ingredients',
          'Chef specials, category ordering, and mouth-watering imagery'
        ],
        shortcutHint: 'Menu Catalog',
        proTip: 'Toggle "Unavailable" immediately if an ingredient runs out during evening rush.',
        previewType: 'customer-qr'
      },
      {
        id: 'ro-crm',
        title: 'Guest CRM & VIP Dining History',
        subtitle: 'Guest Loyalty & Feedback',
        category: 'Customer Loyalty',
        targetRoute: '/crm/customers',
        description: 'Delight returning patrons with rich dining histories, favorite dishes, allergen alerts, VIP tier badges, and direct guest review feedback.',
        highlights: [
          'Guest dining histories, lifetime spend, and visit frequencies',
          'Allergy notes and dietary preferences displayed for servers',
          'Direct guest reviews and resolution management'
        ],
        shortcutHint: 'CRM & Guest Directory',
        proTip: 'Check guest VIP tags to prepare complimentary welcome drinks for frequent visitors.',
        previewType: 'analytics'
      }
    ]
  },

  CASHIER: {
    role: 'CASHIER',
    displayName: 'Head Cashier & Billing POS Lead',
    department: 'Finance, Billing & Settlement',
    tagline: 'Fast table billing, multi-channel payment settlements, split checks, and statutory GST invoices.',
    icon: CreditCard,
    steps: [
      {
        id: 'cs-pos',
        title: 'Active Tables Billing Queue',
        subtitle: 'Consolidated Table Folio',
        category: 'POS Billing',
        targetRoute: '/cashier/pos',
        description: 'Instantly view all tables requesting settlement or with active dining orders. Consolidated KOT items, food vs beverage split, and 5% GST calculations are updated in real-time.',
        highlights: [
          'One-tap table checkout selection with itemized summary',
          'Automated 5% GST and optional service charge calculation',
          'Clear status alerts for tables ready to pay'
        ],
        shortcutHint: 'POS Cashier Register',
        proTip: 'Tables with gold highlight have requested the bill via their mobile QR menu.',
        previewType: 'pos-billing'
      },
      {
        id: 'cs-payments',
        title: 'Multi-Method Cashless & Cash Settlements',
        subtitle: 'Flexible Payment Processing',
        category: 'Payment Terminal',
        targetRoute: '/cashier/pos',
        description: 'Accept dynamic UPI QR Codes (PhonePe, GPay, Paytm), card payments via EDC terminal, cash with instant change-return calculation, or charge directly to a hotel room folio.',
        highlights: [
          'Real-time dynamic UPI QR code generator on customer screen',
          'Cash tender calculator with automatic change return math',
          'Direct posting to guest hotel room folio upon verification'
        ],
        shortcutHint: 'Payment Selector Modal',
        proTip: 'For hotel guests, enter their room number to bill directly to their room checkout folio.',
        previewType: 'pos-billing'
      },
      {
        id: 'cs-split',
        title: 'Bill Splitting & Approved Discounts',
        subtitle: 'Split Checks & Vouchers',
        category: 'Bill Customization',
        targetRoute: '/cashier/pos',
        description: 'Effortlessly split bills by equal shares or individual items when groups dine together. Apply promotional discounts or manager vouchers with audit tracking.',
        highlights: [
          'Equal share splitting or item-by-item assignment',
          'Configurable percentage or fixed rupee promo discounts',
          'Transparent tip collection allocated directly to service staff'
        ],
        shortcutHint: 'Split Bill Controller',
        proTip: 'Tips collected are tracked per waiter and reported in shift summaries.',
        previewType: 'pos-billing'
      },
      {
        id: 'cs-invoice',
        title: 'Official GST Invoices & Thermal Printing',
        subtitle: 'Compliant Tax Invoices',
        category: 'Invoicing & Receipts',
        targetRoute: '/cashier/pos',
        description: 'Generate standard 80mm thermal receipts with GSTIN details, SAC codes, and CGST/SGST breakdowns. Send paperless digital receipts via SMS/WhatsApp or reprint anytime.',
        highlights: [
          'Standard 80mm thermal printer format with resort branding',
          'Statutory GST compliance with SAC 9963 / 9964 codes',
          'Instant digital receipt links for paperless checkout'
        ],
        shortcutHint: 'Print Receipt / Done',
        proTip: 'Print a duplicate copy with guest signature for card and room charges.',
        previewType: 'pos-billing'
      },
      {
        id: 'cs-closure',
        title: 'Shift Closure & Cash Drop Reconciliation',
        subtitle: 'End-of-Day Audit',
        category: 'Cash Reconciliation',
        targetRoute: '/reports/gst',
        description: 'Reconcile daily card, UPI, cash, and room charges at shift end. Identify discrepancies immediately and print the official Z-Report summary.',
        highlights: [
          'Opening cash float vs closing drawer reconciliation',
          'Bifurcated tender report (UPI, Card, Cash, Room Charge)',
          'Zero-discrepancy daily handovers for smooth accounting'
        ],
        shortcutHint: 'Shift End Settlement',
        proTip: 'Always perform cash drop reconciliation before logging out at shift end.',
        previewType: 'analytics'
      }
    ]
  },

  KITCHEN: {
    role: 'KITCHEN_USER',
    displayName: 'Culinary Line & KDS Lead',
    department: 'Culinary & Kitchen Display System (KDS)',
    tagline: 'Paperless live KDS tickets, line station routing, batch production aggregator, and dispatch alerts.',
    icon: ChefHat,
    steps: [
      {
        id: 'kt-kds',
        title: 'Live Incoming KOT & BOT Tickets',
        subtitle: 'Paperless Kitchen Stream',
        category: 'Kitchen Display',
        targetRoute: '/kitchen/kds',
        description: 'Paperless, real-time incoming tickets with color-coded preparation timers (Green < 10m, Amber < 20m, Red overdue). View table number, waiter name, and guest special cooking requests.',
        highlights: [
          'Live ticket stream with zero paper delay or lost orders',
          'Elapsed preparation timers with urgency color highlighting',
          'Custom chef notes, spice levels, and allergy warnings'
        ],
        shortcutHint: 'Kitchen KDS View',
        proTip: 'Tickets turn amber after 10 minutes and red after 20 minutes to prioritize older orders.',
        previewType: 'kds-ticket'
      },
      {
        id: 'kt-routing',
        title: 'Station Isolation & Course Pacing',
        subtitle: 'Multi-Station Routing',
        category: 'Kitchen Stations',
        targetRoute: '/kitchen/kds',
        description: 'Orders are automatically filtered to the right station: Cooking Line for hot foods, Bar & Dispense for cocktails and beverages. Starters and main courses are logically sequenced.',
        highlights: [
          'Dedicated views for Cooking Line, Bar & Drinks, and Beverages',
          'Paced course delivery (Appetizers fired first, Mains on hold)',
          'Executive central monitor for the Head Chef to oversee all lines'
        ],
        shortcutHint: 'Station Filter Tabs',
        proTip: 'Switch between Cooking and Bar tabs to view station-specific workloads.',
        previewType: 'kds-ticket'
      },
      {
        id: 'kt-aggregator',
        title: 'Batch Cooking Aggregator',
        subtitle: 'Production Optimization',
        category: 'Batch Production',
        targetRoute: '/kitchen/kds',
        description: 'Cook smarter by aggregating identical dishes across all active tickets. See total counts—like "8x Paneer Tikka" or "12x Butter Naan"—in a single consolidated batch preparation view.',
        highlights: [
          'Bulk preparation optimization for high-volume items',
          'Cross-ticket item consolidation without ticket hunting',
          'Prevents preparing the same dish multiple times separately'
        ],
        shortcutHint: 'Production Aggregator Tab',
        proTip: 'Use batch cooking during peak weekend rush hours to cut average cooking time by 35%.',
        previewType: 'kds-ticket'
      },
      {
        id: 'kt-ready',
        title: 'Item Completion & Instant Callout',
        subtitle: 'Floor Waiter Dispatch',
        category: 'Order Dispatch',
        targetRoute: '/kitchen/kds',
        description: 'Tap individual items or "Mark Ticket Ready" as dishes leave the pass. This triggers an immediate audio chime and notification on the assigned waiter\'s device.',
        highlights: [
          '1-tap individual item & full ticket completion',
          'Instant audio/visual alert to floor servers for pickup',
          'Tracks kitchen preparation speed and velocity metrics'
        ],
        shortcutHint: 'Green Ready Button',
        proTip: 'Marking items ready immediately alerts the floor waiter so food reaches guests piping hot.',
        previewType: 'kds-ticket'
      },
      {
        id: 'kt-offline',
        title: 'Zero-Downtime Offline Mode',
        subtitle: 'Local Resilience Engine',
        category: 'Kitchen Reliability',
        targetRoute: '/kitchen/kds',
        description: 'If the resort Wi-Fi blips during heavy dinner service, offline mode kicks in automatically. Actions are safely queued in local browser memory and synced once reconnected.',
        highlights: [
          'Continuous kitchen ticket processing during network drops',
          'Clear offline banner indicator with manual sync control',
          'Automatic reconciliation with cloud database when back online'
        ],
        shortcutHint: 'Offline Sync Banner',
        proTip: 'The amber offline banner indicates tickets are queued locally; tap "Sync Now" when online.',
        previewType: 'kds-ticket'
      }
    ]
  },

  WAITER: {
    role: 'WAITER',
    displayName: 'Floor Service & Guest Relations',
    department: 'Restaurant Floor Service & Hospitality',
    tagline: 'Visual table floor plan, mobile order punching, live kitchen ready alerts, and guest service calls.',
    icon: ConciergeBell,
    steps: [
      {
        id: 'wt-floor',
        title: 'Floor Layout & Table Oversight',
        subtitle: 'Section Management',
        category: 'Floor Service',
        targetRoute: '/waiter/dashboard',
        description: 'View your assigned dining section at a glance. Visual status flags identify open tables ready for seating, occupied tables enjoying meals, and tables awaiting the bill.',
        highlights: [
          'Section filtering (Main Dining, Terrace Garden, VIP Dining)',
          'Clear occupancy indicators and guest party counts',
          'Quick table assignment for newly seated guests'
        ],
        shortcutHint: 'Waiter Dashboard',
        proTip: 'Green tables are clean and available; Red tables have active guests dining.',
        previewType: 'table-map'
      },
      {
        id: 'wt-orders',
        title: 'Digital Order Punching & Modifiers',
        subtitle: 'Table-Side Ordering',
        category: 'Order Taking',
        targetRoute: '/waiter/dashboard',
        description: 'Punch orders directly at the table. Search items with instant autocomplete, specify spice levels (Mild, Medium, Spicy), add dietary notes, and fire KOT straight to kitchen.',
        highlights: [
          'Lightning-fast item search with visual category navigation',
          'Custom cooking instructions, portion sizes, and allergen notes',
          'Instant KOT dispatch to kitchen without walking to POS'
        ],
        shortcutHint: '"Take Order" on Table Card',
        proTip: 'Add special guest notes like "Less oil" or "Extra crispy" to avoid kitchen errors.',
        previewType: 'customer-qr'
      },
      {
        id: 'wt-calls',
        title: 'Live Guest Call & Service Bell',
        subtitle: 'Digital Guest Requests',
        category: 'Guest Assistance',
        targetRoute: '/waiter/dashboard',
        description: 'Receive immediate notifications when guests scan their table QR code and tap "Call Waiter", "Water Refill", "Cutlery Request", or "Request Bill".',
        highlights: [
          'Instant table bell alerts with audible chime',
          'Categorized service requests (Water, Cutlery, Service, Bill)',
          '1-tap acknowledgement and instant resolution tracking'
        ],
        shortcutHint: 'Service Requests Panel',
        proTip: 'Acknowledge service requests within 60 seconds to ensure high guest satisfaction ratings.',
        previewType: 'waiter-bell'
      },
      {
        id: 'wt-pickup',
        title: 'Kitchen Pickup Notifications',
        subtitle: 'Hot Food Expediting',
        category: 'Food Pickup',
        targetRoute: '/waiter/dashboard',
        description: 'Never let hot food sit on the pass. As soon as the chef marks dishes "Ready" in the KDS, your dashboard updates with table number and items ready for pickup.',
        highlights: [
          'Immediate notification the second chef plates an item',
          'Prevents cold food and dining delays for guests',
          'Clear pickup station guidance (Kitchen Pass vs Bar Counter)'
        ],
        shortcutHint: 'Top Notification Bell',
        proTip: 'Collect food from the kitchen pass immediately when you see the green ready icon.',
        previewType: 'kds-ticket'
      },
      {
        id: 'wt-bill',
        title: 'Table Check & Payment Handover',
        subtitle: 'Bill Presentment & Tips',
        category: 'Checkout Support',
        targetRoute: '/waiter/dashboard',
        description: 'Present itemized checks to guests, apply tip percentages (5%, 10%, 15%), and seamlessly notify the cashier or present digital UPI payment.',
        highlights: [
          'Consolidated multi-order checks with itemized breakdown',
          'Tip calculator with 1-tap percentages or custom amounts',
          'Direct cashier settlement coordination or QR UPI payment'
        ],
        shortcutHint: '"View Bill" Button',
        proTip: 'Guests can also pay directly on their mobile phone by scanning their table QR code.',
        previewType: 'pos-billing'
      }
    ]
  },

  RECEPTIONIST: {
    role: 'RECEPTIONIST',
    displayName: 'Front Desk & Hospitality Reception',
    department: 'Front Office & Guest Relations',
    tagline: 'Room availability grid, express check-in/out, reservation calendar, and centralized guest folios.',
    icon: Hotel,
    steps: [
      {
        id: 'rc-rooms',
        title: 'Room Inventory & Live Availability',
        subtitle: 'Resort Room Matrix',
        category: 'Room Inventory',
        targetRoute: '/hotel/rooms',
        description: 'Interactive visual matrix of all resort cottages, luxury suites, and villas. Track status: Vacant Clean, Occupied, Reserved, or Under Maintenance in real time.',
        highlights: [
          'Instant room status overview with floor and category filters',
          'Deluxe Cottages, Royal Suites, and Poolside Villas management',
          'Quick room details and active guest occupancy info'
        ],
        shortcutHint: 'Rooms Grid',
        proTip: 'Green indicates Vacant Clean rooms ready for immediate check-in.',
        previewType: 'frontdesk-rooms'
      },
      {
        id: 'rc-checkin',
        title: 'Fast Guest Registration & Folio',
        subtitle: 'Express Check-In / Out',
        category: 'Guest Check-In',
        targetRoute: '/hotel/rooms',
        description: 'Effortlessly check in arriving guests with verified ID details, allocate room keys, collect advance deposits, and initiate the guest billing folio.',
        highlights: [
          'Streamlined guest check-in with government ID verification',
          'Advance deposit collection and key assignment',
          'Express 1-click checkout with zero delays'
        ],
        shortcutHint: '"Check In" on Room Card',
        proTip: 'Link arriving guests with existing CRM records to preserve loyalty points.',
        previewType: 'frontdesk-rooms'
      },
      {
        id: 'rc-bookings',
        title: 'Booking Calendar & Stays',
        subtitle: 'Reservation Management',
        category: 'Reservations',
        targetRoute: '/hotel/reservations',
        description: 'Manage direct walk-ins and advance bookings. Assign specific rooms, manage stay extensions, and accommodate special guest requests.',
        highlights: [
          'Central reservation calendar with occupancy forecasting',
          'Room night calculations and rate package rules',
          'Automated booking confirmation and arrival schedule'
        ],
        shortcutHint: 'Reservations Tab',
        proTip: 'Check the arrival schedule every morning to arrange airport transfers.',
        previewType: 'frontdesk-rooms'
      },
      {
        id: 'rc-folio',
        title: 'Unified Inter-Department Billing',
        subtitle: 'Centralized Room Folios',
        category: 'Room Billing',
        targetRoute: '/hotel/rooms',
        description: 'Guests can charge restaurant meals, poolside bar drinks, and spa treatments straight to their room number. The consolidated folio settles upon checkout.',
        highlights: [
          'Centralized guest folio combining room and F&B charges',
          'Automatic verification of guest name before charging room',
          'Comprehensive GST invoices generated upon departure'
        ],
        shortcutHint: 'Guest Folio Modal',
        proTip: 'All restaurant checks charged to a room appear on the room folio with signed digital slips.',
        previewType: 'pos-billing'
      },
      {
        id: 'rc-vip',
        title: 'VIP Guest Relations & Hospitality CRM',
        subtitle: 'Personalized Hospitality',
        category: 'Guest Preferences',
        targetRoute: '/crm/customers',
        description: 'Keep track of VIP preferences, anniversaries, dietary needs, and stay history to ensure memorable luxury hospitality experiences.',
        highlights: [
          'VIP guest recognition and personalized amenity welcome',
          'Special dates (anniversaries, birthdays) highlighted',
          'Historical stay records and preference logs'
        ],
        shortcutHint: 'Guest CRM Directory',
        proTip: 'Flag honeymoon couples to schedule complimentary floral arrangements with Housekeeping.',
        previewType: 'analytics'
      }
    ]
  },

  HOUSEKEEPING: {
    role: 'HOUSEKEEPING',
    displayName: 'Housekeeping & Facility Operations',
    department: 'Housekeeping & Facilities Maintenance',
    tagline: 'Room turnover board, rapid status lifecycle, linen/amenities replenishment, and work orders.',
    icon: Sparkles,
    steps: [
      {
        id: 'hk-board',
        title: 'Housekeeping Operations Board',
        subtitle: 'Room Turnover Priorities',
        category: 'Turnover Management',
        targetRoute: '/housekeeping/dashboard',
        description: 'Real-time board showing rooms needing cleaning after check-out, stay-over cleaning, and priority turnover for expected VIP arrivals.',
        highlights: [
          'Categorized room queues (Dirty, In Progress, Clean, Inspected)',
          'Priority indicators for upcoming arrivals and VIP suites',
          'Room attendant assignment and turnover pacing'
        ],
        shortcutHint: 'Housekeeping Board',
        proTip: 'Prioritize rooms marked with "Upcoming Arrival" so guests can check in early.',
        previewType: 'housekeeping-board'
      },
      {
        id: 'hk-status',
        title: '1-Tap Room Status Lifecycle',
        subtitle: 'Rapid Status Updates',
        category: 'Room Status',
        targetRoute: '/housekeeping/dashboard',
        description: 'Update rooms from "Dirty" to "Cleaning in Progress" to "Clean & Inspected" with one tap. Front Desk is notified immediately that the room is ready for occupancy.',
        highlights: [
          'Instant status synchronization with Front Desk reception',
          'Quality inspection verification checklist',
          'Eliminates unnecessary phone calls between departments'
        ],
        shortcutHint: 'Status Action Buttons',
        proTip: 'Always mark "Clean" when finished, and supervisor marks "Inspected".',
        previewType: 'housekeeping-board'
      },
      {
        id: 'hk-amenities',
        title: 'Inventory & Amenity Restock',
        subtitle: 'Linen & Consumables Tracking',
        category: 'Amenity Restock',
        targetRoute: '/inventory/items',
        description: 'Log replenishment of bed linens, bath towels, and luxury toiletries. Automatically alerts inventory managers when stock runs below safety levels.',
        highlights: [
          'Standard amenity replenishment packs for suites and villas',
          'Low stock alerts for housekeeping central store',
          'Minibar consumption logging for billing'
        ],
        shortcutHint: 'Inventory Catalog',
        proTip: 'Report low shampoo or towel stocks before the weekend rush.',
        previewType: 'housekeeping-board'
      },
      {
        id: 'hk-maintenance',
        title: 'Immediate Fault Reporting',
        subtitle: 'Facility Work Orders',
        category: 'Engineering & Maintenance',
        targetRoute: '/housekeeping/dashboard',
        description: 'Notice a leaking faucet, noisy air conditioner, or faulty lighting during room cleaning? Dispatch a maintenance work order immediately to resort engineering.',
        highlights: [
          'Direct maintenance work order dispatch to engineering',
          'Severity ratings (Urgent, High, Normal)',
          'Tracks repair completion and room re-certification'
        ],
        shortcutHint: '"Report Issue" Button',
        proTip: 'Urgent issues place the room on "Out of Order" to prevent accidental booking.',
        previewType: 'housekeeping-board'
      }
    ]
  },

  ROOM_SERVICE: {
    role: 'ROOM_SERVICE',
    displayName: 'In-Room Dining & Butler Dispatch',
    department: 'In-Room Dining & Guest Room Service',
    tagline: 'Suite order orchestration, butler tray staging, in-suite delivery verification, and tray clearance.',
    icon: BedDouble,
    steps: [
      {
        id: 'rs-queue',
        title: 'Incoming Suite Food Orders',
        subtitle: 'In-Room Dining Queue',
        category: 'Order Dispatch',
        targetRoute: '/room-service/dashboard',
        description: 'Receive food & beverage orders placed from luxury villas and rooms via phone or guest QR code. Review room number, guest name, and delivery notes.',
        highlights: [
          'Live order queue with prominent room number badges',
          'Guest delivery instructions (e.g., "Knock gently, baby sleeping")',
          'Direct kitchen line dispatch with delivery promise times'
        ],
        shortcutHint: 'Room Service Board',
        proTip: 'Check the delivery timer to ensure meals arrive within the 30-minute promise window.',
        previewType: 'roomservice-tray'
      },
      {
        id: 'rs-staging',
        title: 'Butler Tray Staging & Pickup',
        subtitle: 'Quality & Setup Standards',
        category: 'Tray Staging',
        targetRoute: '/room-service/dashboard',
        description: 'Monitor kitchen progress in real-time. Once the chef marks items ready, assemble the butler tray or heated food trolley with fresh linens, cutlery, and condiments.',
        highlights: [
          'Real-time kitchen ready notifications for in-room orders',
          'Quality checklist before leaving the kitchen staging area',
          'Condiment, bread basket, and warm beverage setups'
        ],
        shortcutHint: 'Staging Area Queue',
        proTip: 'Ensure heated cloches are placed on hot mains before leaving the kitchen.',
        previewType: 'roomservice-tray'
      },
      {
        id: 'rs-delivery',
        title: 'Guest Handover & Charge Posting',
        subtitle: 'Suite Delivery Confirmation',
        category: 'Delivery Verification',
        targetRoute: '/room-service/dashboard',
        description: 'Deliver hot food to the guest suite. Confirm delivery on your device to automatically post the meal charges to the guest\'s hotel room folio.',
        highlights: [
          '1-tap delivery confirmation upon guest handover',
          'Automatic room charge posting with digital audit log',
          'Guest signature or contactless room verification'
        ],
        shortcutHint: '"Mark Delivered" Button',
        proTip: 'Always greet the guest by surname: "Good evening Mr. Oberoi, your dining order has arrived."',
        previewType: 'roomservice-tray'
      },
      {
        id: 'rs-clearance',
        title: 'Room Clearance Scheduling',
        subtitle: 'Tray & Trolley Retrieval',
        category: 'Tray Retrieval',
        targetRoute: '/room-service/dashboard',
        description: 'Track completed orders and receive tray clearance requests from guests. Pick up tableware to keep corridors and luxury suites pristine.',
        highlights: [
          'Scheduled tray retrieval reminders after 45 minutes',
          'Guest clearance request alerts from table QR codes',
          'Maintains pristine resort corridors and suite environments'
        ],
        shortcutHint: 'Clearance Queue',
        proTip: 'Retrieve trays promptly so resort corridors remain quiet and elegant.',
        previewType: 'roomservice-tray'
      }
    ]
  },

  CUSTOMER: {
    role: 'CUSTOMER',
    displayName: 'Guest Digital Dining Experience',
    department: 'Guest Self-Service & QR Dining',
    tagline: 'Contactless QR table ordering, mobile OTP verification, live KOT tracking, and cashless bill settlement.',
    icon: QrCode,
    steps: [
      {
        id: 'cs-qr',
        title: 'Interactive Digital Menu',
        subtitle: 'Contactless QR Ordering',
        category: 'Digital Menu',
        targetRoute: '/customer/qr-ordering',
        description: 'Scan table QR code to browse our culinary creations with rich food photography, spicy/veg dietary flags, chef specials, and portion options.',
        highlights: [
          'High-resolution food photos and detailed descriptions',
          'Filter by Veg, Non-Veg, Drinks & Chef Specials',
          'Easy customization and cooking notes'
        ],
        shortcutHint: 'Scan Table QR Code',
        proTip: 'Look for the gold "Chef Special" badge for our signature resort delicacies.',
        previewType: 'customer-qr'
      },
      {
        id: 'cs-otp',
        title: 'Secure Mobile Dining Session',
        subtitle: 'Fast OTP Verification',
        category: 'Session Security',
        targetRoute: '/customer/qr-ordering',
        description: 'Enter your mobile number and verify with an instant 6-digit OTP to unlock ordering, track food, and link to your table\'s unified bill.',
        highlights: [
          'Instant SMS OTP verification without passwords',
          'Safe and authenticated table session',
          'Seamless returning guest recognition and loyalty rewards'
        ],
        shortcutHint: 'Mobile OTP Screen',
        proTip: 'In development mode, enter any 6 digits (e.g. 123456) to proceed instantly.',
        previewType: 'customer-qr'
      },
      {
        id: 'cs-track',
        title: 'Live Kitchen Status Tracking',
        subtitle: 'Real-Time Order Journey',
        category: 'Live Order Tracker',
        targetRoute: '/customer/qr-ordering',
        description: 'Watch your order journey in real-time as the chefs receive, prepare, and plate your food. Clear progress bar keeps you informed.',
        highlights: [
          'Confirmed -> Cooking -> Ready to Serve live progress',
          'Estimated preparation countdown timers',
          'Add extra items or drinks to the same table anytime'
        ],
        shortcutHint: '"Track Order" Button',
        proTip: 'You can order appetizers first, and order your main course anytime during dinner.',
        previewType: 'kds-ticket'
      },
      {
        id: 'cs-bill',
        title: 'Call Waiter & Unified Table Bill',
        subtitle: 'Cashless Bill Settlement',
        category: 'Bill & Service',
        targetRoute: '/customer/qr-ordering',
        description: 'Request water or service without waving. When ready, view your consolidated itemized bill, choose a tip, and pay smoothly via UPI or card.',
        highlights: [
          'One-tap "Call Waiter" or "Refill Water" service requests',
          'Itemized bill review with 5% GST breakdown',
          'Instant cashless payment via UPI, Card, or Net Banking'
        ],
        shortcutHint: '"View Bill" Button',
        proTip: 'Tap "Call Waiter" on your phone anytime you need assistance or extra napkins.',
        previewType: 'pos-billing'
      }
    ]
  }
};

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: UserRole;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  initialRole
}) => {
  const { currentUser, effectiveRole, pushRoute } = useApp();

  // Resolve active tour configuration
  const defaultRoleKey = initialRole || effectiveRole || currentUser.role || 'SUPER_ADMIN';

  // Normalize role key (e.g. KITCHEN_STAFF -> KITCHEN, WAITER_MANAGER -> WAITER)
  const getNormalizedRoleKey = (role: string): string => {
    if (
      role.startsWith('KITCHEN') ||
      role === 'BEVERAGES' ||
      role === 'DRINKS'
    ) {
      return 'KITCHEN';
    }
    if (role === 'WAITER' || role === 'WAITER_MANAGER') {
      return 'WAITER';
    }
    if (role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (role === 'RESTAURANT_OWNER') return 'RESTAURANT_OWNER';
    if (role === 'CASHIER') return 'CASHIER';
    if (role === 'RECEPTIONIST') return 'RECEPTIONIST';
    if (role === 'HOUSEKEEPING') return 'HOUSEKEEPING';
    if (role === 'ROOM_SERVICE') return 'ROOM_SERVICE';
    if (role === 'CUSTOMER') return 'CUSTOMER';
    return 'SUPER_ADMIN';
  };

  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(() =>
    getNormalizedRoleKey(defaultRoleKey)
  );
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState<boolean>(false);

  // Synchronize when initialRole or effectiveRole changes
  useEffect(() => {
    if (isOpen) {
      const normalized = getNormalizedRoleKey(initialRole || effectiveRole || currentUser.role);
      setSelectedRoleKey(normalized);
      setCurrentStepIndex(0);
    }
  }, [isOpen, initialRole, effectiveRole, currentUser.role]);

  const activeConfig = ROLE_TOUR_CONFIGS[selectedRoleKey] || ROLE_TOUR_CONFIGS.SUPER_ADMIN;
  const currentStep = activeConfig.steps[currentStepIndex] || activeConfig.steps[0];
  const totalSteps = activeConfig.steps.length;
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Close & store preference
  const handleClose = useCallback(() => {
    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem(`pali_tour_dismissed_${currentUser.id}`, 'true');
    }
    onClose();
  }, [dontShowAgain, currentUser.id, onClose]);

  // Next / Prev step navigation
  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Finished tour
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Navigate to feature directly
  const handleGoToFeature = () => {
    if (currentStep?.targetRoute) {
      pushRoute(currentStep.targetRoute);
      handleClose();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentStepIndex < totalSteps - 1) {
          setCurrentStepIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStepIndex > 0) {
          setCurrentStepIndex(prev => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, totalSteps, handleClose]);

  if (!isOpen) return null;

  const RoleIcon = activeConfig.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      className="fixed inset-0 z-50 bg-[#163024]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 font-sans"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full border border-[#DDD8C9] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Top Header Banner */}
        <div className="bg-[#163024] text-[#F7F4EC] px-5 sm:px-7 py-4 flex items-center justify-between border-b border-[#C5A86A]/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C5A86A]/20 border border-[#C5A86A]/40 flex items-center justify-center shrink-0">
              <RoleIcon className="w-5 h-5 text-[#C5A86A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A86A]">
                  Pali Platform Tour
                </span>
                <span className="text-[#DDD8C9]/40 text-xs">/</span>
                <span className="text-xs text-[#DDD8C9] font-medium hidden sm:inline">
                  Role-Guided Walkthrough
                </span>
              </div>
              <h2
                id="onboarding-tour-title"
                className="text-base sm:text-lg font-bold text-[#F7F4EC] tracking-tight flex items-center gap-2"
              >
                <span>{activeConfig.displayName}</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Role Switcher Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleDropdown(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs text-[#F7F4EC] font-semibold transition-colors cursor-pointer"
                title="Switch Tour Perspective"
              >
                <Eye className="w-3.5 h-3.5 text-[#C5A86A]" />
                <span className="hidden sm:inline">Switch Role</span>
                <ChevronRight className="w-3.5 h-3.5 rotate-90 text-[#C5A86A]" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden z-50 text-[#1D241F] animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3 bg-[#F7F4EC] border-b border-[#DDD8C9]">
                    <p className="text-[10px] font-bold text-[#163024] uppercase tracking-wider">
                      Explore Other Role Tours
                    </p>
                    <p className="text-[11px] text-[#687067]">
                      See how other staff experience PALI
                    </p>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-[#DDD8C9]/40">
                    {Object.entries(ROLE_TOUR_CONFIGS).map(([key, config]) => {
                      const ItemIcon = config.icon;
                      const isSelected = selectedRoleKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedRoleKey(key);
                            setCurrentStepIndex(0);
                            setShowRoleDropdown(false);
                          }}
                          className={`w-full flex items-center gap-3 p-2.5 text-xs text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#163024]/10 text-[#163024] font-bold'
                              : 'hover:bg-[#F7F4EC] text-[#1D241F]'
                          }`}
                        >
                          <div className="p-1.5 rounded-lg bg-[#163024]/5 shrink-0">
                            <ItemIcon className="w-4 h-4 text-[#526B4A]" />
                          </div>
                          <div className="truncate flex-1">
                            <p className="truncate font-semibold">{config.displayName}</p>
                            <p className="text-[10px] text-[#687067] truncate">{config.department}</p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#C5A86A] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-[#DDD8C9] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              aria-label="Close Tour"
              title="Close Tour (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Progress Bar & Step Tracker */}
        <div className="bg-[#F7F4EC] border-b border-[#DDD8C9] px-5 sm:px-7 py-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#163024]">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <span className="text-[#DDD8C9] text-xs">·</span>
              <span className="text-xs text-[#526B4A] font-semibold">
                {currentStep.category}
              </span>
            </div>

            {/* Clickable Step Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {activeConfig.steps.map((s, idx) => {
                const isCurrent = idx === currentStepIndex;
                const isPast = idx < currentStepIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    title={s.title}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      isCurrent
                        ? 'w-8 bg-[#163024]'
                        : isPast
                        ? 'w-3 bg-[#C5A86A]'
                        : 'w-2 bg-[#DDD8C9] hover:bg-[#DDD8C9]/80'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Smooth progress bar */}
          <div className="w-full bg-[#DDD8C9]/60 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#C5A86A] h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Tour Body (Split: Details on Left, Interactive Mock Widget on Right) */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Explanatory Content */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-bold text-[#526B4A] uppercase tracking-wider block">
                  {currentStep.subtitle}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#163024] tracking-tight mt-0.5">
                  {currentStep.title}
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-[#3E4A3F] leading-relaxed">
                {currentStep.description}
              </p>

              {/* Core Feature Highlights */}
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-bold text-[#163024] uppercase tracking-wider">
                  Key Capabilities
                </p>
                <ul className="space-y-2">
                  {currentStep.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-[#1D241F]">
                      <div className="w-4 h-4 rounded-full bg-[#526B4A]/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#526B4A] stroke-[3]" />
                      </div>
                      <span className="leading-snug">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Shortcut or Pro Tip */}
              {currentStep.proTip && (
                <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] text-xs text-[#526B4A] flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#C5A86A] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#163024]">Operational Pro-Tip:</strong>{' '}
                    <span>{currentStep.proTip}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action: Take Me There */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoToFeature}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#F7F4EC] hover:bg-[#ede8db] border border-[#DDD8C9] rounded-xl text-xs font-bold text-[#163024] transition-all cursor-pointer group"
              >
                <span>Open {currentStep.title} in App</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#C5A86A] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right Column: Visual Interactive Mock Widget */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="bg-[#F7F4EC] rounded-2xl p-4 sm:p-5 border border-[#DDD8C9] shadow-sm flex flex-col h-full justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#DDD8C9]">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#163024] uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-[#C5A86A]" />
                  <span>Feature Visual Demo</span>
                </div>
                {currentStep.shortcutHint && (
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-white rounded border border-[#DDD8C9] text-[#687067]">
                    {currentStep.shortcutHint}
                  </span>
                )}
              </div>

              {/* Render domain-specific mock preview */}
              <div className="py-4 my-auto">
                <StepInteractiveMock previewType={currentStep.previewType} step={currentStep} />
              </div>

              <div className="pt-3 border-t border-[#DDD8C9] text-[10px] text-[#687067] flex items-center justify-between">
                <span>Pali Resort & Club Architecture</span>
                <span className="font-mono text-[#526B4A]">Live Module</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Navigation Footer */}
        <div className="bg-white border-t border-[#DDD8C9] px-5 sm:px-7 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Left: Dismiss on Startup Checkbox */}
          <label className="flex items-center gap-2 text-xs text-[#687067] select-none cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-[#DDD8C9] text-[#163024] focus:ring-[#163024] cursor-pointer"
            />
            <span>Don't show this tour automatically on login</span>
          </label>

          {/* Right: Prev, Next & Skip buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-2 text-xs font-semibold text-[#687067] hover:text-[#163024] transition-colors cursor-pointer"
            >
              Skip Tour
            </button>

            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                currentStepIndex === 0
                  ? 'opacity-40 cursor-not-allowed bg-slate-50 border-[#DDD8C9] text-slate-400'
                  : 'bg-white hover:bg-[#F7F4EC] border-[#DDD8C9] text-[#1D241F]'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-[#F7F4EC] bg-[#163024] hover:bg-[#0f2219] transition-all shadow-md cursor-pointer group"
            >
              <span>{currentStepIndex === totalSteps - 1 ? 'Finish & Explore' : 'Next Step'}</span>
              <ChevronRight className="w-4 h-4 text-[#C5A86A] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// INTERACTIVE MOCK PREVIEW WIDGETS
// ==========================================
interface StepInteractiveMockProps {
  previewType: OnboardingStep['previewType'];
  step: OnboardingStep;
}

const StepInteractiveMock: React.FC<StepInteractiveMockProps> = ({ previewType }) => {
  // Mini interactive state for table map
  const [activeTableState, setActiveTableState] = useState<'available' | 'occupied'>('occupied');
  const [isReadyItem, setIsReadyItem] = useState<boolean>(false);
  const [selectedOutlet, setSelectedOutlet] = useState<'rest-1' | 'rest-2'>('rest-1');

  switch (previewType) {
    case 'multi-tenant':
      return (
        <div className="space-y-3">
          <div className="p-3 bg-white rounded-xl border border-[#DDD8C9] shadow-xs">
            <p className="text-[10px] font-bold text-[#687067] uppercase tracking-wider mb-2">
              Outlet Isolation Selector
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedOutlet('rest-1')}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer border ${
                  selectedOutlet === 'rest-1'
                    ? 'border-[#163024] bg-[#163024]/5 font-bold text-[#163024]'
                    : 'border-[#DDD8C9] bg-white text-[#1D241F]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-[#C5A86A]" />
                  <span>Pali Resort & Club (Fine Dining)</span>
                </div>
                {selectedOutlet === 'rest-1' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#526B4A]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedOutlet('rest-2')}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer border ${
                  selectedOutlet === 'rest-2'
                    ? 'border-[#163024] bg-[#163024]/5 font-bold text-[#163024]'
                    : 'border-[#DDD8C9] bg-white text-[#1D241F]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-[#C5A86A]" />
                  <span>Pali Poolside Lounge Bar</span>
                </div>
                {selectedOutlet === 'rest-2' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#526B4A]" />
                )}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#526B4A] italic text-center">
            Tap either outlet above to simulate tenant switching
          </p>
        </div>
      );

    case 'analytics':
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-white rounded-xl border border-[#DDD8C9]">
              <span className="text-[10px] text-[#687067] uppercase font-bold tracking-wider">
                Gross Turnover
              </span>
              <p className="text-base font-bold text-[#163024] mt-1">₹1,48,250</p>
              <span className="text-[10px] text-[#526B4A] font-semibold">↑ +14.2% today</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#DDD8C9]">
              <span className="text-[10px] text-[#687067] uppercase font-bold tracking-wider">
                Active Covers
              </span>
              <p className="text-base font-bold text-[#163024] mt-1">42 Guests</p>
              <span className="text-[10px] text-[#C5A86A] font-semibold">12 Dining Tables</span>
            </div>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-[#DDD8C9] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#526B4A] animate-pulse" />
              <span className="font-semibold text-[#1D241F]">GST Compliance Status</span>
            </div>
            <span className="text-[10px] font-bold text-[#526B4A] bg-[#526B4A]/10 px-2 py-0.5 rounded">
              GSTR-1 Ready
            </span>
          </div>
        </div>
      );

    case 'table-map':
      return (
        <div className="space-y-3">
          <div className="p-3 bg-white rounded-xl border border-[#DDD8C9] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#687067]">
                Floor Plan Demo (Click to Toggle)
              </span>
              <span className="text-[10px] font-semibold text-[#526B4A]">Main Dining</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveTableState(prev => (prev === 'occupied' ? 'available' : 'occupied'))
                }
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  activeTableState === 'occupied'
                    ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                }`}
              >
                <div className="text-xs">T-04</div>
                <div className="text-[9px] uppercase tracking-wider mt-0.5">
                  {activeTableState === 'occupied' ? 'Occupied (4)' : 'Available'}
                </div>
              </button>
              <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-center">
                <div className="text-xs font-bold text-emerald-900">T-05</div>
                <div className="text-[9px] text-emerald-700 uppercase tracking-wider mt-0.5">
                  Available
                </div>
              </div>
              <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50 text-center">
                <div className="text-xs font-bold text-amber-900">T-06</div>
                <div className="text-[9px] text-amber-700 uppercase tracking-wider mt-0.5">
                  Bill Done
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#526B4A] italic text-center">
            Tap Table T-04 above to toggle between Available and Occupied
          </p>
        </div>
      );

    case 'kds-ticket':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#163024]">KOT #8912</span>
              <span className="text-[10px] text-[#687067] font-mono">· Table 04</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              <Clock className="w-3 h-3" />
              <span>08:14</span>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1D241F]">1x Paneer Tikka Angara</span>
              <span className="text-[10px] text-amber-700 font-bold">Extra Spicy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1D241F]">2x Butter Garlic Naan</span>
              <span className="text-[10px] text-[#687067]">Crisp</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsReadyItem(prev => !prev)}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isReadyItem
                ? 'bg-emerald-600 text-white'
                : 'bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isReadyItem ? 'Dispatched to Waiter!' : 'Mark Ticket Ready'}</span>
          </button>
        </div>
      );

    case 'pos-billing':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
            <span className="font-bold text-[#163024]">Table 04 · Final Bill</span>
            <span className="font-mono text-[#526B4A] font-bold">INV-9041</span>
          </div>
          <div className="space-y-1 text-[#687067]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono text-[#1D241F] font-semibold">₹1,240.00</span>
            </div>
            <div className="flex justify-between">
              <span>5% GST (CGST + SGST):</span>
              <span className="font-mono text-[#1D241F] font-semibold">₹62.00</span>
            </div>
            <div className="flex justify-between font-bold text-[#163024] pt-1 border-t border-[#DDD8C9]">
              <span>Grand Total:</span>
              <span className="font-mono text-sm">₹1,302.00</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1">
            <span className="p-1 text-center bg-[#F7F4EC] rounded text-[10px] font-bold text-[#163024] border border-[#DDD8C9]">
              UPI QR
            </span>
            <span className="p-1 text-center bg-white rounded text-[10px] font-semibold text-[#687067] border border-[#DDD8C9]">
              Card EDC
            </span>
            <span className="p-1 text-center bg-white rounded text-[10px] font-semibold text-[#687067] border border-[#DDD8C9]">
              Room Folio
            </span>
          </div>
        </div>
      );

    case 'waiter-bell':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
            <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
            <div className="flex-1">
              <p className="font-bold">Table T-02 Calling Waiter</p>
              <p className="text-[10px] text-amber-700">Water Refill requested 30s ago</p>
            </div>
          </div>
          <button
            type="button"
            className="w-full py-1.5 bg-[#526B4A] hover:bg-[#3e5237] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Acknowledge & Clear Bell
          </button>
        </div>
      );

    case 'frontdesk-rooms':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
            <span className="font-bold text-[#163024]">Room 204 · Deluxe Suite</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              Vacant Clean
            </span>
          </div>
          <p className="text-[#687067] text-[11px]">
            King Bed · Private Balcony · Forest View · Floor 2
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              className="flex-1 py-1.5 bg-[#163024] text-[#F7F4EC] rounded-lg font-bold text-xs cursor-pointer"
            >
              Express Check-In
            </button>
          </div>
        </div>
      );

    case 'housekeeping-board':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
            <span className="font-bold text-[#163024]">Villa 12 · Priority Turnover</span>
            <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
              Dirty
            </span>
          </div>
          <p className="text-[11px] text-[#687067]">
            VIP Arrival scheduled at 02:00 PM · Bed linens & luxury toiletries restocked
          </p>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              className="py-1.5 bg-[#F7F4EC] text-[#163024] font-bold rounded-lg border border-[#DDD8C9]"
            >
              Start Cleaning
            </button>
            <button
              type="button"
              className="py-1.5 bg-[#526B4A] text-white font-bold rounded-lg"
            >
              Mark Inspected
            </button>
          </div>
        </div>
      );

    case 'roomservice-tray':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD8C9]">
            <span className="font-bold text-[#163024]">Suite 302 · In-Room Dining</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              Ready for Tray
            </span>
          </div>
          <div className="space-y-1 text-[#687067] text-[11px]">
            <p>1x Pali Signature Thali</p>
            <p>1x Fresh Mint Limeade</p>
          </div>
          <button
            type="button"
            className="w-full py-1.5 bg-[#163024] text-white font-bold rounded-lg text-xs"
          >
            Dispatch Butler Tray
          </button>
        </div>
      );

    case 'customer-qr':
      return (
        <div className="bg-white rounded-xl p-3.5 border border-[#DDD8C9] shadow-xs space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#163024]">Murgh Dum Biryani</span>
            <span className="font-bold text-[#163024]">₹480</span>
          </div>
          <p className="text-[11px] text-[#687067]">
            Fragrant basmati rice layered with spiced tender chicken and saffron.
          </p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
              Chef Special
            </span>
            <button
              type="button"
              className="px-3 py-1 bg-[#163024] text-white font-bold rounded-lg text-xs"
            >
              + Add to Cart
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
};
