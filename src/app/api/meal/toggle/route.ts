import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { appendRow, getSheetRows, rowToObject, updateRange } from '@/lib/sheets';
import { MealLive } from '@/lib/types';
import { isLocked, lockMessage, safeCount, today, monthKey, yearKey } from '@/lib/calc';

function samePhone(a: any, b: any) {
  return String(a || '').trim() === String(b || '').trim();
}

function mealStamp(m: MealLive) {
  return `${m.date || ''}T${m.updatedAt || ''}`;
}

function latestLiveRowIndex(data: any[][], header: any[], phone: string) {
  let best = -1;
  let bestStamp = '';
  data.forEach((r, idx) => {
    const row = rowToObject<MealLive>(header, r);
    if (samePhone(row.phone, phone)) {
      const st = mealStamp(row);
      if (best < 0 || st.localeCompare(bestStamp) > 0) {
        best = idx;
        bestStamp = st;
      }
    }
  });
  return best;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as { mealType: 'lunch'|'dinner', value?: boolean, count?: number };
    const { mealType } = body;
    if (!['lunch', 'dinner'].includes(mealType)) return NextResponse.json({ error: 'Invalid meal type' }, { status: 400 });

    const settingsRows = await getSheetRows('Settings');
    const settings: Record<string, string> = {};
    settingsRows.data.forEach(r => { if (r[0]) settings[String(r[0]).trim()] = String(r[1] ?? '').trim(); });

    if (isLocked(mealType, settings)) {
      return NextResponse.json({ error: lockMessage(mealType, settings) }, { status: 423 });
    }

    const maxMeal = Number(settings.maxMealCount || 20) || 20;
    const newCount = body.count !== undefined ? safeCount(body.count, maxMeal) : (body.value ? 1 : 0);
    const { header, data } = await getSheetRows('MealStatus');
    const idx = latestLiveRowIndex(data, header, user.phone);
    const now = new Date().toISOString();

    if (idx >= 0) {
      const row = [...data[idx]];
      while (row.length < 9) row.push('');
      row[1] = today();
      row[2] = monthKey();
      row[3] = yearKey();
      row[4] = user.phone;
      row[5] = user.name;
      row[mealType === 'lunch' ? 6 : 7] = String(newCount);
      row[8] = now;
      await updateRange(`MealStatus!A${idx + 2}:I${idx + 2}`, [row]);
    } else {
      await appendRow('MealStatus!A:I', [
        `LIVE_${user.phone}`, today(), monthKey(), yearKey(), user.phone, user.name,
        mealType === 'lunch' ? String(newCount) : '0',
        mealType === 'dinner' ? String(newCount) : '0',
        now,
      ]);
    }

    return NextResponse.json({ ok: true, message: `${mealType === 'lunch' ? 'Lunch' : 'Dinner'} live meal plan updated. Calculation will use only the next lock scan.` });
  } catch(e: any) {
    return NextResponse.json({ error: e?.message || 'Meal update failed' }, { status: 401 });
  }
}
