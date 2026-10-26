export type TaskType = 'CHECKOUT_CLEANING' | 'STAYOVER_CLEANING' | 'DEEP_CLEANING';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'INSPECTED';

export type MaintenanceCategory = 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'FURNITURE' | 'OTHER';

export type MaintenanceSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MaintenanceStatus = 'REPORTED' | 'IN_REPAIR' | 'RESOLVED';

export interface HousekeepingTaskResponse {
  id: string;
  roomId: string;
  taskType: TaskType;
  assignedStaffId: string | null;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  inspectedByStaffId: string | null;
  inspectedAt: string | null;
  notes: string | null;
  createdAt: string;
  room?: {
    id: string;
    roomNumber: string;
    roomType: string;
    floor: number;
    status: string;
  };
  assignedStaffName?: string | null;
  inspectedByStaffName?: string | null;
}

export interface RoomStatusHistoryResponse {
  id: string;
  roomId: string;
  fromStatus: string;
  toStatus: string;
  changedByStaffId: string;
  createdAt: string;
  changedByStaffName?: string | null;
}

export interface MaintenanceIssueResponse {
  id: string;
  roomId: string | null;
  outletId: string | null;
  category: MaintenanceCategory;
  severity: MaintenanceSeverity;
  description: string;
  status: MaintenanceStatus;
  reportedByStaffId: string;
  resolvedByStaffId: string | null;
  createdAt: string;
  roomNumber?: string | null;
  outletName?: string | null;
  reportedByStaffName?: string | null;
  resolvedByStaffName?: string | null;
}
