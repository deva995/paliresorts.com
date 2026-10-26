export interface MenuCategory {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EffectiveMenuItem {
  itemId: string;
  name: string;
  description: string | null;
  effectivePricePaise: number;
  gstRatePercent: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  preparationTimeMinutes: number;
  imageUrl: string | null;
  isAvailable: boolean;
  kitchenStationCode: string;
  displayOrder: number;
  category: {
    id: string;
    name: string;
    code: string;
    displayOrder: number;
  };
}

export interface GroupedCategoryMenu {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  items: EffectiveMenuItem[];
}

export interface OutletMenuResponse {
  outletId: string;
  categories: GroupedCategoryMenu[];
  items: EffectiveMenuItem[];
}

export interface OutletAllocationDetail {
  outletId: string;
  outletName?: string;
  priceOverridePaise: number | null;
  effectivePricePaise: number;
  isAvailable: boolean;
  kitchenStationOverrideCode: string | null;
  displayOrder: number;
}

export interface MenuItemDetailResponse {
  id: string;
  propertyId: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    code: string;
  };
  name: string;
  description: string | null;
  basePricePaise: number;
  gstRatePercent: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  preparationTimeMinutes: number;
  imageUrl: string | null;
  targetKitchenStationCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  outletAllocations: OutletAllocationDetail[];
}

export type MenuRevisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProposedMasterItemData {
  name?: string;
  description?: string | null;
  basePricePaise?: number;
  gstRatePercent?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isSpicy?: boolean;
  preparationTimeMinutes?: number;
  imageUrl?: string | null;
  targetKitchenStationCode?: string;
  isActive?: boolean;
  categoryId?: string;
}

export interface ProposedOutletItemData {
  priceOverridePaise?: number | null;
  isAvailable?: boolean;
  kitchenStationOverrideCode?: string | null;
  displayOrder?: number;
}

export interface MenuRevisionApprovalRecord {
  id: string;
  revisionId: string;
  action: 'APPROVED' | 'REJECTED';
  reviewedByStaffId: string;
  reviewerName?: string;
  reviewNotes: string | null;
  reviewedAt: string;
}

export interface MenuRevisionResponse {
  id: string;
  menuItemId: string;
  menuItemName?: string;
  outletId: string | null;
  revisionNumber: number;
  changeSummary: string;
  proposedData: ProposedMasterItemData | ProposedOutletItemData;
  previousData: Record<string, unknown>;
  status: MenuRevisionStatus;
  effectiveFrom: string | null;
  submittedByStaffId: string;
  submitterName?: string;
  createdAt: string;
  approvals?: MenuRevisionApprovalRecord[];
}
