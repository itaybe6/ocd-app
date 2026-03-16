## Expo React Native (TypeScript) — Admin/Worker/Customer Skeleton

שלד React Native (Expo) לשכפול מערכת קיימת (Web) למובייל:
- **RTL תמידי** + **UI כהה**
- **Role-based navigation**: Admin / Worker / Customer (Drawer ימני)
- **Supabase** (DB + Storage bucket: `job-images`)
- **NativeWind + Tailwind**
- **Toast** (`react-native-toast-message`)

### דרישות
- Node.js (מומלץ 18+)
- Expo Go על המכשיר או אמולטור Android

### התקנה

```bash
cd mobile
npm install
```

### הגדרת Env (חובה)
צור קובץ `.env` בתיקיית `mobile/` לפי `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

לאחר שינוי `.env` צריך לעצור ולהרים מחדש את Expo.

### הרצה

```bash
npm run android
```

או:

```bash
npm start
```

### מבנה חשוב
- קוד האפליקציה נמצא ב-`src/`
- ה-entry של Expo נשאר ב-`App.tsx` ומייצא את `src/App.tsx`
- “מקור אמת” של המערכת המקורית נמצא ב-`SPEC.md`

