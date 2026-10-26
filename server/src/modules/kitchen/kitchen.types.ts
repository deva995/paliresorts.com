export type KotStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export type KotItemStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface KitchenStation {
  id: string;
  outletId: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface KotItemResponse {
  id: string;
  kotId: string;
  orderItemId: string;
  itemName: string;
  quantity: number;
  customizationNotes: string | null;
  status: KotItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface KotResponse {
  id: string;
  outletId: string;
  orderId: string;
  stationId: string;
  stationCode: string;
  stationName: string;
  kotNumber: number;
  locationLabelSnapshot: string;
  status: KotStatus;
  acceptedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: KotItemResponse[];
}

export interface GenerateKotsResult {
  kots: KotResponse[];
  orderId: string;
  orderStatus: string;
}
