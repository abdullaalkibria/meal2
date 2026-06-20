import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { appendRow, getSheetRows, rowToObject, updateRange } from '@/lib/sheets';
import { Bazar, Bills, CookOff, MealCounted, MealLive, MealType, User } from '@/lib/types';
import { approvedBazarTotal, canScan, countedMealTotal, fixedBillTotal, monthKey, parseMonth, rawCount, safeCount, today, yearKey } from '@/lib/calc';

function samePhone(a:any,b:any){return String(a||'').trim()===String(b||'').trim()}
function mealStamp(m: MealLive){ return `${m.date || ''}T${m.updatedAt || ''}`; }
function latestLive(meals: MealLive[], phone: string) {
  return meals.filter(m => samePhone(m.phone, phone)).sort((a,b)=>mealStamp(b).localeCompare(mealStamp(a)))[0];
}
function colMeal(type: MealType) { return type === 'lunch' ? 6 : 7; }
function colScan(type: MealType) { return type === 'lunch' ? 8 : 9; }
function colSource(type: MealType) { return type === 'lunch' ? 10 : 11; }

async function autoApproveOldBazars(hours = 72) {
  const { header, data } = await getSheetRows('DailyBazar');
  if (!header.length || !data.length) return;
  let changed = false;
  const now = Date.now();
  const rows = data.map((r) => {
    const b = rowToObject<Bazar>(header, r);
    const submittedAt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    if (String(b.status || '').trim() === 'pending' && submittedAt && now - submittedAt >= hours * 60 * 60 * 1000) {
      changed = true;
      const copy = [...r];
      while (copy.length < 12) copy.push('');
      copy[8] = 'approved'; copy[10] = new Date().toISOString(); copy[11] = 'AUTO_72H';
      return copy;
    }
    return r;
  });
  if (changed) await updateRange('DailyBazar!A2:L', rows);
}

async function materializeScans(users: User[], liveMeals: MealLive[], settings: Record<string,string>, activeCookOffs: CookOff[]) {
  const date = today();
  const month = monthKey();
  const year = yearKey();
  const canLunch = canScan('lunch', settings);
  const canDinner = canScan('dinner', settings);
  if (!canLunch && !canDinner) return;

  const countedSheet = await getSheetRows('MealCounted');
  const rows = countedSheet.data.map(r => [...r]);
  let changed = false;
  const now = new Date().toISOString();

  function cookOffActive(type: MealType) {
    return activeCookOffs.some(c => c.date === date && c.mealType === type && String(c.isActive || '').trim() === '1');
  }

  for (const usr of users) {
    let idx = rows.findIndex(r => String(r[1] || '') === date && samePhone(r[4], usr.phone));
    if (idx < 0) {
      rows.push([`MC_${date.replace(/-/g,'')}_${usr.phone}`, date, month, year, usr.phone, usr.name, '', '', '', '', '', '', '']);
      idx = rows.length - 1;
      changed = true;
    }
    const row = rows[idx]; while(row.length < 13) row.push('');
    const live = latestLive(liveMeals, usr.phone);

    if (canLunch && String(row[colScan('lunch')] || '').trim() === '') {
      row[colMeal('lunch')] = cookOffActive('lunch') ? '0' : String(safeCount(live?.lunch || 0, Number(settings.maxMealCount || 20) || 20));
      row[colScan('lunch')] = now;
      row[colSource('lunch')] = cookOffActive('lunch') ? 'cook_off' : 'normal_scan';
      row[12] = now;
      changed = true;
    }
    if (canDinner && String(row[colScan('dinner')] || '').trim() === '') {
      row[colMeal('dinner')] = cookOffActive('dinner') ? '0' : String(safeCount(live?.dinner || 0, Number(settings.maxMealCount || 20) || 20));
      row[colScan('dinner')] = now;
      row[colSource('dinner')] = cookOffActive('dinner') ? 'cook_off' : 'normal_scan';
      row[12] = now;
      changed = true;
    }
  }
  if (changed) await updateRange('MealCounted!A2:M', rows);
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const selectedMonth = parseMonth(url.searchParams.get('month'));
    const selectedYear = selectedMonth.slice(0, 4);

    const [u, liveSheet, countedSheetInitial, b, billsRows, settingsRows, cookRows] = await Promise.all([
      getSheetRows('Users'), getSheetRows('MealStatus'), getSheetRows('MealCounted'), getSheetRows('DailyBazar'), getSheetRows('Bills'), getSheetRows('Settings'), getSheetRows('CookOff')
    ]);

    const settings: Record<string,string> = {};
    settingsRows.data.forEach(r => { if (r[0]) settings[String(r[0]).trim()] = String(r[1] ?? '').trim(); });
    await autoApproveOldBazars(Number(settings.autoApproveBazarHours || 72) || 72);

    const users = u.data.map((r) => rowToObject<User>(u.header, r))
      .filter(x => String(x.phone || '').trim() && String(x.authStatus || '').trim() === '1' && String(x.isDeleted || '0') !== '1');
    const allUsers = u.data.map((r) => rowToObject<User>(u.header, r))
      .filter(x => String(x.phone || '').trim() && String(x.isDeleted || '0') !== '1');
    const liveMeals = liveSheet.data.map((r) => rowToObject<MealLive>(liveSheet.header, r)).filter(x => String(x.phone || '').trim());
    const cookOffs = cookRows.data.map((r) => rowToObject<CookOff>(cookRows.header, r)).filter(x => String(x.date || '').trim());
    const activeCookOffs = cookOffs.filter(c => String(c.isActive || '').trim() === '1');

    await materializeScans(users, liveMeals, settings, activeCookOffs);

    // Re-read counted rows after possible scan update.
    const countedSheet = await getSheetRows('MealCounted');
    const counted = countedSheet.data.map((r) => rowToObject<MealCounted>(countedSheet.header, r)).filter(x => String(x.date || '').trim() && String(x.phone || '').trim());
    const bazarSheet = await getSheetRows('DailyBazar');
    const bazars = bazarSheet.data.map((r) => rowToObject<Bazar>(bazarSheet.header, r)).filter(x => String(x.id || '').trim() && String(x.date || '').trim());

    const billRaw = billsRows.data.map((r) => rowToObject<any>(billsRows.header, r)).find((x) => x.month === selectedMonth) || {};
    const fixed: Bills = { month: selectedMonth, year: selectedYear, seatRent: +billRaw.seatRent || 0, utilityBill: +billRaw.utilityBill || 0, wifiBill: +billRaw.wifiBill || 0, cookBill: +billRaw.cookBill || 0, electricityBill: +billRaw.electricityBill || 0 };

    const monthCounted = counted.filter(x => String(x.month || x.date?.slice(0,7)) === selectedMonth);
    const monthBazars = bazars.filter(x => String(x.month || x.date?.slice(0,7)) === selectedMonth);
    const totalMeals = countedMealTotal(monthCounted);
    const totalBazar = approvedBazarTotal(monthBazars);
    const mealRate = totalMeals ? totalBazar / totalMeals : 0;
    const myCounted = monthCounted.filter(x => samePhone(x.phone, user.phone));
    const myMealCount = countedMealTotal(myCounted);
    const myBazar = approvedBazarTotal(monthBazars.filter(x => samePhone(x.phone, user.phone)));
    const mealCost = myMealCount * mealRate;
    const fixedBills = fixedBillTotal(fixed);
    const payable = mealCost + fixedBills;
    const net = payable - myBazar;
    const todayKey = today();

    const todayMeals = users.map((usr, i) => {
      const live = latestLive(liveMeals, usr.phone);
      return { sn: i + 1, name: usr.name, phone: usr.phone, lunch: safeCount(live?.lunch || 0, Number(settings.maxMealCount || 20) || 20), dinner: safeCount(live?.dinner || 0, Number(settings.maxMealCount || 20) || 20) };
    });

    const todayCounted = counted.filter(c => c.date === todayKey);
    const scanStatus = {
      lunchScanned: todayCounted.some(c => String(c.lunchScannedAt || '').trim()),
      dinnerScanned: todayCounted.some(c => String(c.dinnerScannedAt || '').trim()),
      lunchCookOff: activeCookOffs.some(c => c.date === todayKey && c.mealType === 'lunch'),
      dinnerCookOff: activeCookOffs.some(c => c.date === todayKey && c.mealType === 'dinner'),
    };

    const sortedBazars = monthBazars.sort((a:any,b:any)=>String(b.submittedAt||b.id||'').localeCompare(String(a.submittedAt||a.id||'')));
    const myBazarRows = sortedBazars.filter(x => samePhone(x.phone, user.phone));
    const bazarByPerson = users.map(usr => ({ name: usr.name, phone: usr.phone, amount: approvedBazarTotal(monthBazars.filter(x => samePhone(x.phone, usr.phone))) }));

    return NextResponse.json({
      user: { name: user.name, phone: user.phone, role: user.role }, today: todayKey, month: selectedMonth, settings,
      users: allUsers, todayMeals, monthCounted, countedRows: monthCounted,
      summary: { totalMeals, totalBazar, mealRate, myMealCount, myBazar, mealCost, fixedBills, payable, receivable: net < 0 ? Math.abs(net) : 0, due: net > 0 ? net : 0 },
      bazars: sortedBazars, myBazarRows, bazarByPerson, bills: fixed, cookOffs, activeCookOffs, scanStatus
    });
  } catch (e:any) { return NextResponse.json({ error: e?.message || 'Unauthorized' }, { status: 401 }); }
}
