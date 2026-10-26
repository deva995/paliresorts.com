export type InventoryCategory =
  | 'FOOD_GRAINS'
  | 'DAIRY'
  | 'MEAT'
  | 'LIQUOR'
  | 'BEVERAGES'
  | 'CLEANING'
  | 'LINEN'
  | 'OTHER';

export type StockMovementType =
  | 'PURCHASE'
  | 'CONSUMPTION'
  | 'ADJUSTMENT'
  | 'WASTAGE'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

export interface InventoryItemResponse {
  id: string;
  propertyId: string;
  itemCode: string;
  name: string;
  category: InventoryCategory;
  unitOfMeasure: string;
  reorderLevel: number;
  unitCostPaise: number;
  isActive: boolean;
  createdAt: string;
  totalOnHandQuantity?: number;
  isBelowReorderLevel?: boolean;
}

export interface InventoryLocationResponse {
  id: string;
  outletId: string | null;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  outletName?: string | null;
}

export interface InventoryBalanceResponse {
  id: string;
  itemId: string;
  locationId: string;
  quantityOnHand: number;
  lastCountedAt: string | null;
  updatedAt: string;
  item?: {
    id: string;
    itemCode: string;
    name: string;
    category: InventoryCategory;
    unitOfMeasure: string;
    reorderLevel: number;
    unitCostPaise: number;
    isBelowReorderLevel: boolean;
  };
  location?: {
    id: string;
    code: string;
    name: string;
    outletId: string | null;
  };
}

export interface StockMovementResponse {
  id: string;
  itemId: string;
  locationId: string;
  movementType: StockMovementType;
  quantity: number;
  transferGroupId: string | null;
  pairedMovementId: string | null;
  referenceDocument: string | null;
  notes: string | null;
  authorizedByStaffId: string;
  createdAt: string;
  itemName?: string;
  itemCode?: string;
  locationName?: string;
  locationCode?: string;
  outletId?: string | null;
  newBalanceOnHand?: number;
}

export interface TransferResponse {
  transferGroupId: string;
  itemId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  sourceMovementId: string;
  destinationMovementId: string;
  sourceNewBalanceOnHand: number;
  destinationNewBalanceOnHand: number;
  referenceDocument: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RecipeIngredientResponse {
  id: string;
  recipeId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unitOfMeasure: string;
  createdAt: string;
  inventoryItemName?: string;
  inventoryItemCode?: string;
}

export interface RecipeResponse {
  id: string;
  menuItemId: string;
  name: string;
  yieldServings: number;
  createdAt: string;
  menuItemName?: string;
  ingredients: RecipeIngredientResponse[];
}
