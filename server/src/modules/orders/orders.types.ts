export type OrderSource = 'CUSTOMER_QR' | 'WAITER_POS' | 'ROOM_SERVICE' | 'COUNTER_POS';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export type OrderItemStatus =
  | 'PLACED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  portion?: string;
  customizationNotes?: string;
}

export interface CreateStaffOrderInput {
  outletId: string;
  diningSessionId: string;
  items: OrderItemInput[];
  specialInstructions?: string;
}

export interface CreateGuestOrderInput {
  items: OrderItemInput[];
  specialInstructions?: string;
}

export interface OrderItemResponse {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPricePaise: number;
  gstRate: number;
  totalPricePaise: number;
  customizationNotes: string | null;
  status: OrderItemStatus;
  cancelledReason?: string | null;
}

export interface OrderResponse {
  id: string;
  outletId: string;
  diningSessionId: string | null;
  tableId?: string | null;
  tableNumber?: string | null;
  customerName?: string | null;
  hotelStayId?: string | null;
  roomId?: string | null;
  orderNumber: number;
  roundNumber: number;
  orderSource: OrderSource;
  status: OrderStatus;
  specialInstructions: string | null;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  items: OrderItemResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistoryResponse {
  id: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  changedByStaffId: string | null;
  notes: string | null;
  createdAt: string;
}
