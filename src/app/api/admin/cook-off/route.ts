import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { appendRow, getSheetRows, rowToObject, updateRange } from '@/lib/sheets';
import { CookOff, MealCounted, MealType, User } from '@/lib/types';
import { parseDate } from '@/lib/calc';

function samePhone(a: any, b: any) { return String(a || '').trim() === String(b || '').trim(); }
function mealCol(type: MealType) { return type === 'lunch' ? 6 : 7; }
function scannedCol(type: MealType) { return type === 'lunch' ? 8 : 9; }
function sourceCol(type: MealType) { return type === 'lunch' ? 10 : 11; }
function requiredText(type: MealType) { return type === 'lunch' ? 'NO LUNCH COOKED' : 'NO DINNER COOKED'; }
function undoText(type: MealType) { return type === 'lunch' ? 'UNDO LUNCH COOK OFF' : 'UNDO DINNER COOK OFF'; }

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const action = String(body.action || 'activate');
    const mealType = String(body.mealType || '') as MealType;
    if (!['lunch', 'dinner'].includes(mealType)) return NextResponse.json({ error: 'Invalid meal type' }, { status: 400 });
    const date = parseDate(body.date);
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);
    const confirmText = String(body.confirmText || '').trim();
    const now = new Date().toISOString();

    const [usersRows, countedRows, cookRows] = await Promise.all([
      getSheetRows('Users'), getSheetRows('MealCounted'), getSheetRows('CookOff')
    ]);
    const users = usersRows.data.map(r => rowToObject<User>(usersRows.header, r))
      .filter(u => String(u.phone || '').trim() && String(u.authStatus || '').trim() === '1' && String(u.isDeleted || '0') !== '1');
    const counted = countedRows.data.map(r => rowToObject<MealCounted>(countedRows.header, r));
    const cookOffs = cookRows.data.map(r => rowToObject<CookOff>(cookRows.header, r));

    const activeIdx = cookOffs.findIndex(c => c.date === date && c.mealType === mealType && String(c.isActive || '').trim() === '1');

    if (action === 'undo') {
      if (confirmText !== undoText(mealType)) return NextResponse.json({ error: `Type exactly: ${undoText(mealType)}` }, { status: 400 });
      if (activeIdx < 0) return NextResponse.json({ error: 'No active cook-off found for this date/meal' }, { status: 404 });
      const active = cookOffs[activeIdx];
      let backup: any[] = [];
      try { backup = JSON.parse(active.backupJson || '[]'); } catch { backup = []; }
      const rows = countedRows.data.map(r => [...r]);
      for (const item of backup) {
        const phone = String(item.phone || '').trim();
        const idx = rows.findIndex(r => String(r[1] || '') === date && samePhone(r[4], phone));
        const value = item[mealType] ?? '';
        if (idx >= 0) {
          const row = rows[idx]; while(row.length < 13) row.push('');
          row[mealCol(mealType)] = String(value || '0');
          row[scannedCol(mealType)] = item[mealType + 'ScannedAt'] || now;
          row[sourceCol(mealType)] = 'undo_restore';
          row[12] = now;
        } else if (item.existed) {
          await appendRow('MealCounted!A:M', [
            `MC_${date.replace(/-/g,'')}_${phone}`, date, month, year, phone, item.name || '',
            mealType === 'lunch' ? String(value || '0') : '0',
            mealType === 'dinner' ? String(value || '0') : '0',
            mealType === 'lunch' ? (item.lunchScannedAt || now) : '',
            mealType === 'dinner' ? (item.dinnerScannedAt || now) : '',
            mealType === 'lunch' ? 'undo_restore' : '',
            mealType === 'dinner' ? 'undo_restore' : '',
            now,
          ]);
        }
      }
      if (rows.length) await updateRange('MealCounted!A2:M', rows);
      const cookRow = [...cookRows.data[activeIdx]]; while(cookRow.length < 13) cookRow.push('');
      cookRow[5] = '0'; cookRow[9] = admin.phone; cookRow[10] = now; cookRow[12] = now;
      await updateRange(`CookOff!A${activeIdx + 2}:M${activeIdx + 2}`, [cookRow]);
      return NextResponse.json({ ok: true, message: `${mealType} cook-off undo restored counted values only. Live plans were not changed.` });
    }

    if (confirmText !== requiredText(mealType)) return NextResponse.json({ error: `Type exactly: ${requiredText(mealType)}` }, { status: 400 });
    if (activeIdx >= 0) return NextResponse.json({ error: 'Cook-off is already active for this date/meal' }, { status: 409 });

    const rows = countedRows.data.map(r => [...r]);
    const backup: any[] = [];

    for (const u of users) {
      const idx = rows.findIndex(r => String(r[1] || '') === date && samePhone(r[4], u.phone));
      if (idx >= 0) {
        const row = rows[idx]; while(row.length < 13) row.push('');
        backup.push({ phone: u.phone, name: u.name, existed: true, lunch: row[6] || '0', dinner: row[7] || '0', lunchScannedAt: row[8] || '', dinnerScannedAt: row[9] || '' });
        row[mealCol(mealType)] = '0';
        row[scannedCol(mealType)] = now;
        row[sourceCol(mealType)] = 'cook_off';
        row[12] = now;
      } else {
        backup.push({ phone: u.phone, name: u.name, existed: false, lunch: '', dinner: '', lunchScannedAt: '', dinnerScannedAt: '' });
        await appendRow('MealCounted!A:M', [
          `MC_${date.replace(/-/g,'')}_${u.phone}`, date, month, year, u.phone, u.name,
          mealType === 'lunch' ? '0' : '0', mealType === 'dinner' ? '0' : '0',
          mealType === 'lunch' ? now : '', mealType === 'dinner' ? now : '',
          mealType === 'lunch' ? 'cook_off' : '', mealType === 'dinner' ? 'cook_off' : '', now,
        ]);
      }
    }
    if (rows.length) await updateRange('MealCounted!A2:M', rows);
    await appendRow('CookOff!A:M', [
      Date.now().toString(), date, month, year, mealType, '1', body.reason || 'Cook did not come', admin.phone, now, '', '', JSON.stringify(backup), now
    ]);
    return NextResponse.json({ ok: true, message: `No ${mealType} cooked marked. Counted meals set to 0 only in processing layer. Live plans were not changed.` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Cook-off action failed' }, { status: 403 });
  }
}
