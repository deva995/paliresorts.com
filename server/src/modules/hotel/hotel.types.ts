export type RoomStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEANING'
  | 'INSPECTED'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE';

export type IdProofType = 'AADHAAR' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID';

export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW';

export type StayStatus = 'CHECKED_IN' | 'CHECKED_OUT';

export type FolioStatus = 'OPEN' | 'LOCKED' | 'SETTLED';

export type ChargeType = 'ROOM_TARIFF' | 'RESTAURANT_DINING' | 'LAUNDRY' | 'SPA' | 'MINIBAR';

export interface HotelRoomResponse {
  id: string;
  propertyId: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  status: RoomStatus;
  baseTariffPaise: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HotelGuestResponse {
  id: string;
  firstName: string;
  lastName: string;
  phone: string; // Masked for privacy
  email: string | null;
  idProofType: IdProofType;
  nationality: string;
  createdAt: string;
  updatedAt: string;
}

export interface HotelReservationResponse {
  id: string;
  propertyId: string;
  guestId: string;
  bookingReference: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  status: ReservationStatus;
  createdAt: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
}

export interface HotelStayResponse {
  id: string;
  roomId: string;
  guestId: string;
  reservationId: string | null;
  checkInAt: string;
  expectedCheckOutAt: string;
  actualCheckOutAt: string | null;
  status: StayStatus;
  createdAt: string;
  updatedAt: string;
  room?: {
    id: string;
    roomNumber: string;
    roomType: string;
    floor: number;
    baseTariffPaise: number;
  };
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  folio?: {
    id: string;
    status: FolioStatus;
    totalChargesPaise: number;
    totalPaymentsPaise: number;
    outstandingBalancePaise: number;
  };
}

export interface RoomFolioResponse {
  id: string;
  stayId: string;
  status: FolioStatus;
  totalChargesPaise: number;
  totalPaymentsPaise: number;
  outstandingBalancePaise: number;
  createdAt: string;
  updatedAt: string;
  charges?: FolioChargeResponse[];
}

export interface FolioChargeResponse {
  id: string;
  folioId: string;
  chargeType: ChargeType;
  outletId: string | null;
  billId: string | null;
  amountPaise: number;
  description: string;
  postedByStaffId: string;
  createdAt: string;
  outletName?: string | null;
  postedByStaffName?: string | null;
}
