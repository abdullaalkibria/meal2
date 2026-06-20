import { Bazar, Bills, MealCounted, MealType } from './types';

export const TZ = 'Asia/Dhaka';

export function dhakaNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

export function dateKey(d = dhakaNow()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthKey(d = dhakaNow()) {
  return dateKey(d).slice(0, 7);
}

export function yearKey(d = dhakaNow()) {
  return String(d.getFullYear());
}

export function today() {
  return dateKey();
}

export function parseMonth(input?: string | null) {
  const m = String(input || '').trim();
  return /^\d{4}-\d{2}$/.test(m) ? m : monthKey();
}

export function parseDate(input?: string | null) {
  const d = String(input || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today();
}

export function timeToMinutes(t: string | undefined, fallback: string) {
  const value = String(t || fallback).trim();
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return timeToMinutes(fallback, '00:00');
  return h * 60 + m;
}

export function currentMinutes() {
  const now = dhakaNow();
  return now.getHours() * 60 + now.getMinutes();
}

export function isLocked(mealType: MealType, settings: Record<string, string>) {
  const current = currentMinutes();
  const start = mealType === 'lunch'
    ? timeToMinutes(settings.lunchLockStart || settings.LunchLockStart, '10:00')
    : timeToMinutes(settings.dinnerLockStart || settings.DinnerLockStart, '18:00');
  const end = mealType === 'lunch'
    ? timeToMinutes(settings.lunchLockEnd || settings.LunchLockEnd, '13:00')
    : timeToMinutes(settings.dinnerLockEnd || settings.DinnerLockEnd, '21:00');
  return current >= start && current < end;
}

export function canScan(mealType: MealType, settings: Record<string, string>) {
  const current = currentMinutes();
  const start = mealType === 'lunch'
    ? timeToMinutes(settings.lunchLockStart || settings.LunchLockStart, '10:00')
    : timeToMinutes(settings.dinnerLockStart || settings.DinnerLockStart, '18:00');
  return current >= start;
}

export function lockMessage(mealType: MealType, settings: Record<string, string>) {
  const start = mealType === 'lunch' ? (settings.lunchLockStart || '10:00') : (settings.dinnerLockStart || '18:00');
  const end = mealType === 'lunch' ? (settings.lunchLockEnd || '13:00') : (settings.dinnerLockEnd || '21:00');
  return `${mealType === 'lunch' ? 'Lunch' : 'Dinner'} editing is locked from ${start} to ${end}. Bazar/cooking count is already being finalized.`;
}

export function safeCount(value: any, max = 20) {
  const n = Math.floor(Number(value || 0));
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > max) return max;
  return n;
}

export function rawCount(value: any) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function countedMealTotal(rows: MealCounted[]) {
  return rows.reduce((s, m) => s + rawCount(m.lunch) + rawCount(m.dinner), 0);
}

export function approvedBazarTotal(bazars: Bazar[]) {
  return bazars
    .filter((b) => String(b.status || '').trim() === 'approved')
    .reduce((s, b) => s + Number(b.amount || 0), 0);
}

export function fixedBillTotal(b: Bills) {
  return Number(b.seatRent || 0) + Number(b.utilityBill || 0) + Number(b.wifiBill || 0) + Number(b.cookBill || 0) + Number(b.electricityBill || 0);
}
