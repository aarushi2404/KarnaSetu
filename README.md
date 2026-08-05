# कर्णSetu (KarnaSetu)

A mobile-first platform connecting NGOs, shelters, donors, volunteers, businesses,
and communities — built with **React Native (Expo) + TypeScript** on the frontend
and **Supabase** (Postgres + Auth + Storage + Edge Functions) on the backend.

This implements the P0 prototype scope from the project proposal:
- Role-based auth (User, NGO, Admin) with `profiles` table
- NGO sign-up with document upload → admin approval queue
- Community feed (stray/found, announcements, adoption, updates)
- Verified-NGO browsing + donation flow (Razorpay integration point stubbed)
- Admin dashboard: approvals + basic analytics
- Edge Function stub that notifies nearby shelters on a new stray/found post

---

## 1. Prerequisites

- Node.js 18+ and npm
- The **Expo Go** app on your phone (iOS/Android) — easiest way to run this, no
  native build tools required — or Android Studio / Xcode if you'd rather use
  an emulator
- A free [Supabase](https://supabase.com) account

---

## 2. Set up the backend (Supabase)

1. Go to [supabase.com](https://supabase.com) → **New Project**. Pick any name/region, set a database password.
2. Once it's provisioned, open **SQL Editor** → **New query**, paste the entire contents of
   `supabase/schema.sql`, and click **Run**. This creates all tables, enums, and Row-Level Security policies.
3. Go to **Storage** → create two buckets:
   - `ngo-docs` (public — used for NGO registration document uploads)
   - `post-media` (public — used for post photos, optional for the prototype)
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
5. (Optional, for the stray-animal notification pipeline) Go to **Edge Functions** and deploy
   `supabase/functions/notify-nearby-shelters` using the Supabase CLI:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy notify-nearby-shelters
   ```
   If you skip this step, the app still works — the invoke call just silently no-ops.

### Creating your first Admin account

The sign-up screen only offers "Individual/Business" or "NGO/Shelter" (admin accounts
should not be self-service). After you sign up once as a normal user:

1. In Supabase Studio → **Table Editor → profiles**, find your row.
2. Change its `role` column from `user` to `admin`.
3. Re-open the app (or sign out/in) — you'll now land on the Admin dashboard.

---

## 3. Set up the frontend (Expo app)

```bash
cd karnasetu
npm install
npx expo install --fix   # aligns every expo-* package to the exact SDK 54 build
cp .env.example .env
```

> This project targets **Expo SDK 54** (React Native 0.81, React 19) to match the current
> Expo Go app. If `npx expo-doctor` flags anything after you `npm install`, run
> `npx expo install --fix` again — it always knows the exact compatible version pins,
> which is more reliable than any versions typed into this README by hand.

Edit `.env` and paste in your Supabase values from step 2.4:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

Then start the dev server:

```bash
npm start
```

This opens the Expo developer tools in your terminal/browser with a QR code.

- **On your phone:** install the **Expo Go** app, then scan the QR code (Android: use the
  Expo Go app's scanner; iOS: use the Camera app).
- **On an Android emulator:** have Android Studio's emulator running, then press `a` in the terminal, or run `npm run android`.
- **On an iOS simulator (Mac only):** press `i`, or run `npm run ios`.
- **In a browser (quick UI check, auth still hits real Supabase):** press `w`, or run `npm run web`.

---

## 4. Try it out

1. Sign up as an **NGO/Shelter**, filling in org name/category and uploading any image as
   a stand-in registration document. You'll land on the NGO dashboard showing
   "⏳ Verification pending."
2. Promote yourself (or a second test account) to `admin` as described above, sign in,
   and **Approve** the NGO from the Admin dashboard's approval queue.
3. Sign up as an **Individual**, go to **Browse NGOs**, and donate a test amount to the
   now-approved NGO.
4. From the User feed, tap **+ Post** → **Stray / Found Animal** to create a report. If you
   deployed the Edge Function and have an approved NGO with `category` containing
   "animal" in the same city, it'll receive a row in `notifications`.

---

## 5. Wiring up real payments (Razorpay)

The donate button currently just inserts a `pending` row into `donations` — this mirrors
the proposal's "Razorpay test-mode integration" milestone without requiring API keys to
run the demo. To go further:

1. Create a [Razorpay](https://razorpay.com) test account, grab your test Key ID/Secret.
2. Add a Supabase Edge Function (`create-razorpay-order`) that creates an order server-side
   using the secret key, and a webhook function (`razorpay-webhook`) that flips
   `donations.status` to `success` and increments `campaigns.raised_amount` when Razorpay
   confirms payment.
3. On the client, replace the `donate()` function in `app/(user)/ngos.tsx` with a call to
   your `create-razorpay-order` function, then open Razorpay's checkout using
   `react-native-razorpay`.

---

## 6. Project structure

```
karnasetu/
├── app/
│   ├── (auth)/         → login, signup
│   ├── (user)/         → individual/business dashboard, feed, browse NGOs
│   ├── (ngo)/          → NGO dashboard (status, post needs, incoming reports)
│   ├── (admin)/        → approval queue + analytics
│   └── _layout.tsx     → auth-aware root router (redirects by role)
├── lib/
│   ├── supabase.ts     → Supabase client + shared TypeScript types
│   └── auth-context.tsx→ session/profile state, used by useAuth()
├── supabase/
│   ├── schema.sql      → tables, enums, RLS policies, storage notes
│   └── functions/
│       └── notify-nearby-shelters/  → Edge Function stub
└── .env.example
```

## 7. What's stubbed vs. fully wired (be upfront about this in your demo)

| Feature | Status |
|---|---|
| Auth, roles, RLS | ✅ Fully working |
| NGO sign-up + doc upload + admin approval | ✅ Fully working |
| Community feed (all 4 post types) | ✅ Fully working |
| Browse verified NGOs + donate | ✅ Working, payment is a DB stub (see §5) |
| Stray/found → shelter notification | ✅ Working if Edge Function deployed, city-match only |
| Food donation board, book/item board, volunteer/CSR cards | 🚧 Schema + RLS ready in `schema.sql`; add screens the same way `ngos.tsx`/`create-post.tsx` were built |
| Push notifications (device-level) | 🚧 `notifications` table + in-app rows exist; wire `expo-notifications` for real push |
