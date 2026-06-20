export type Role = 'admin' | 'user';
export type MealType = 'lunch' | 'dinner';

export type User = {
  id: string;
  name: string;
  phone: string;
  password?: string;
  passwordHash?: string;
  role: Role;
  authStatus: '0' | '1' | string;
  createdAt: string;
  deletedAt?: string;
  isDeleted?: '0' | '1' | string;
};

// LIVE editable peripheral state. Never use this for money/monthly calculation.
export type MealLive = {
  id: string;
  date: string;
  month: string;
  year: string;
  phone: string;
  name: string;
  lunch: string;
  dinner: string;
  updatedAt: string;
};

// SCANNED / latched processing state. Only this is used for money/monthly calculation.
export type MealCounted = {
  id: string;
  date: string;
  month: string;
  year: string;
  phone: string;
  name: string;
  lunch: string;
  dinner: string;
  lunchScannedAt: string;
  dinnerScannedAt: string;
  lunchSource: string;
  dinnerSource: string;
  updatedAt: string;
};

export type Bazar = {
  id: string;
  date: string;
  month: string;
  year: string;
  phone: string;
  name: string;
  amount: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  submittedAt: string;
  verifiedAt: string;
  verifiedBy: string;
};

export type Bills = {
  month: string;
  year: string;
  seatRent: number;
  utilityBill: number;
  wifiBill: number;
  cookBill: number;
  electricityBill: number;
  updatedAt?: string;
};

export type CookOff = {
  id: string;
  date: string;
  month: string;
  year: string;
  mealType: MealType;
  isActive: '0' | '1' | string;
  reason: string;
  createdBy: string;
  createdAt: string;
  undoneBy: string;
  undoneAt: string;
  backupJson: string;
  updatedAt: string;
};
