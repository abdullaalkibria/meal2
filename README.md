# MessCore Meal Management System V6

Next.js + Google Sheets + Vercel meal management system.

## Core architecture

- `MealStatus` = live editable meal plan. It powers **My Current Meal Plan** and **Real-time Meal Status** only.
- `MealCounted` = scanned/finalized meal count. It powers **Monthly Meal Calculation**, meal rate, meal cost, due and receivable.
- `CookOff` = admin interrupt. It forces one date's lunch/dinner counted value to zero, but never changes live meal plans.

## Install locally

```powershell
npm install
cp .env.example .env.local
npm run dev
```

## Required env

```env
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
ADMIN_PHONE=01518469198
JWT_SECRET=long_secret_here
```

## GitHub deploy

Do not commit `.env.local`, `.next`, `node_modules`, `.vercel`.

```powershell
git init
git branch -M main
git add .
git commit -m "Initial MessCore V6"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Then import the repo in Vercel and add the same environment variables in Vercel Project Settings.
