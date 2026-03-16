# SPEC.md — מיפוי מערכת מקור לפי קבצים (Web)

> המסמך הזה הוא “מקור אמת” למיפוי מערכת ה‑Web הקיימת, לצורך שכפול ל‑React Native (Expo).
> אין כאן קוד מקור, רק מפרט והתנהגות לפי קבצים/מסכים/שאילתות.

## 1) קבצי תשתית (Web)

### src/main.tsx
- Entry point: מרנדר `<App/>` + import ל-`index.css`

### src/index.css
- Tailwind base/components/utilities
- RTL: `html { direction: rtl; font-family: 'Heebo' }`
- `body`: `bg-gray-950`
- Scrollbar custom
- קלאסים reusable:
  - `.card` (bg gray-850, rounded, border gray-800)
  - `.btn-primary`
  - `.input`
  - `.table-header`/`.table-cell`/`.table-row`
  - `.modal` + `.modal-content`
  - `.form-group`/`.form-grid`/`.flex-layout`

### src/App.tsx
- React Router: `BrowserRouter` + `Routes`
- Providers: `AuthProvider`, `LoadingProvider`, `Toaster` (`react-hot-toast`)
- Routes:
  - `/login` => `Login`
  - Admin:
    - `/admin` => `Dashboard`
    - `/admin/users` => `Users`
    - `/admin/jobs` => `Jobs`
    - `/admin/add-jobs` => `AddJobs`
    - `/admin/job-execution` => `JobExecution`
    - `/admin/work-templates` => `WorkTemplates`
    - `/admin/work-schedule` => `WorkSchedule`
    - `/admin/daily-schedule` => `DailySchedule`
    - `/admin/support` => `Support`
    - `/admin/reports` => `Reports`
    - `/admin/device-installation` => `DeviceInstallation`
    - `/admin/installation-jobs` => `InstallationJobs`
    - `/admin/devices-and-scents` => `DevicesAndScents`
  - Worker:
    - `/worker` => `worker/Schedule`
    - `/worker/jobs` => `worker/Jobs`
  - Customer:
    - `/customer` => `customer/Profile`
    - `/customer/services` => `customer/Services`
    - `/customer/support` => `customer/Support`
  - `/` => redirect `/login`
- Guard: `<RequireAuth role="...">` — אם user לא מחובר => `/login`, אם role לא מתאים => `/{user.role}`

### src/components/AuthProvider.tsx
- Context: `user` + `setUser`
- Persistence: `localStorage` key `"user"`
- `RequireAuth(role)`:
  - if `!user` => `Navigate('/login')`
  - if `user.role != role` => `Navigate(\`/${user.role}\`)`
  - else render children

### src/components/LoadingProvider.tsx
- Context: `isLoading` + `setIsLoading`
- UI: overlay fullscreen `bg-gray-950/80` + spinner
- כשהוא פעיל: content opacity `0.5`

### src/components/Layout.tsx
- Shell לכל המסכים (תפריט צד RTL + header + container)
- Navigation דרך `react-router` `useNavigate`/`useLocation`
- Logout: `setUser(null)` + `navigate('/login')` (לא signOut אמיתי)
- תפריטים לפי role:
  - admin:
    - “משימות ריח” `/admin/jobs`
    - “משימות מיוחדות” `/admin/installation-jobs`
    - “הוספת משימות” `/admin/add-jobs`
    - “ביצוע משימות” `/admin/job-execution`
    - “לוח בקרה” `/admin`
    - “לוז יומי” `/admin/daily-schedule`
    - “משתמשים” `/admin/users`
    - “מכשירים וניחוחות” `/admin/devices-and-scents`
    - “תבניות עבודה” `/admin/work-templates`
    - “קווי עבודה” `/admin/work-schedule`
    - “שירות לקוחות” `/admin/support` (עם badge)
    - “דוחות” `/admin/reports`
  - worker:
    - “לוז יומי” `/worker`
    - “היסטוריית משימות” `/worker/jobs`
  - customer:
    - “פרופיל” `/customer`
    - “שירותים” `/customer/services`
    - “תמיכה טכנית” `/customer/support`
- Realtime badge logic:
  - admin: count של `support_tickets` where `is_new=true` + subscription `postgres_changes` על `support_tickets`
  - worker: count של pending `installation_jobs` + `special_jobs` להיום לעובד המחובר + subscriptions לשתי הטבלאות
- UI: sidebar fixed right, dark gray, logo, overlay mobile

### src/components/ui/table.tsx
- רכיבי Table ב-HTML (RN יחליף ל-`FlatList`/`SectionList`)

### src/lib/supabase.ts
- `createClient(import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- throw error אם חסר env
- משתמשים ב-storage bucket `"job-images"` ל-public urls

### src/lib/utils.ts
- `cn()` = `twMerge(clsx(...))`

### src/lib/jobScheduler.ts
- `updatePastDueJobs`:
  - מוצא jobs pending עם `date < startOfDay(today)`
  - מעדכן `date` ל"היום באותה שעה", ואם הזמן עבר כבר => מחר
- `initJobScheduler`: מתזמן ריצה יומית ב-22:00  
  (ב-RN עדיף לא לתזמן, או לבצע בזמן פתיחת אפליקציה/פעולה ידנית)

## 2) types/database.ts — Domain + טבלאות
- User: `id`, `phone`, `password`, `role(admin|worker|customer)`, `name`, `address?`, `price?`, `created_at`
- OneTimeCustomer: `id`,`name`,`phone?`,`address?`
- ServicePoint: `id`, `customer_id`, `device_type`, `scent_type`, `refill_amount`, `notes?`, `created_at`
- Job (regular): `id`, `customer_id?`, `one_time_customer_id?`, `worker_id`, `date`, `status(pending|completed)`, `notes?`, `order_number?`, `created_at`
- JobServicePoint: `id`, `job_id`, `service_point_id`, `image_url?`, `custom_refill_amount?`
- InstallationJob + InstallationDevice: `installation_jobs` + `installation_devices(image_url per device)`
- SpecialJob: `special_jobs(job_type, battery_type?, image_url?, order_number?)`
- WorkTemplate / TemplateStation(scheduled_time) / WorkSchedule
- SupportTicket: `support_tickets(customer_name, phone, description, is_new)`

Constants:
- DEVICE_TYPES (strings)
- SCENT_TYPES (strings)
- BATTERY_TYPES `['AA','DC']`
- SPECIAL_JOB_TYPES map to labels עברית
- DEVICE_REFILL_AMOUNTS map (לא חובה אם עובדים עם טבלת devices)

## 3) מסכים (Web) — לפי קבצים
עבור כל מסך: ציין UI/State, שאילתות Supabase, פעולות.

### src/pages/Login.tsx
- login עם phone/password מול `users` table:
  - `select * from users where phone=... single`
  - אם לא קיים => toast error
  - אם password לא תואם => toast error
  - else `setUser(userData)` + redirect ל-from או `/{role}`

### Admin מסכים

#### src/pages/admin/Dashboard.tsx
- jobs החודש (`gte`/`lte` date)
- workers list (`users role=worker`) ואז לכל worker בדיקה jobs pending היום => `activeWorkers`
- customers count (`users role=customer`)
- `totalPointsPrice` = sum(price) ללקוחות
- device distribution = count(`service_points.device_type`)
- recent jobs (jobs join customer/worker, order date desc, limit 3)

#### src/pages/admin/Users.tsx
- users CRUD + filter role + search
- modal details
- modal service points (`service_points` by `customer_id`)
- devices/scents tables ל-dropdowns
- create/update user + create/update `service_points` (delete then insert on edit)
- delete user עם cascade:
  - אם customer: delete `service_points`, delete `job_service_points` של jobs, delete `jobs`, delete `installation_jobs`, delete `special_jobs`, delete `template_stations`
  - אם worker: delete `jobs` assigned, `installation_jobs` assigned, `special_jobs` assigned, `template_stations` assigned
  - ואז delete `users` row

#### src/pages/admin/Jobs.tsx
- unified list: `jobs` + `installation_jobs`(+devices) + `special_jobs`
- filters: date/status/type/search
- group by date (`yyyy-MM-dd`)
- view service points modal (regular)
- edit regular (update `jobs` date/worker/status/notes)
- edit special (update `special_jobs`)
- delete regular (delete `job_service_points` then `jobs`)
- delete installation/special (delete from their table)
- view images:
  - regular: `job_service_points.image_url` (gallery next)
  - special: `special_jobs.image_url`
  - installation: `installation_devices.image_url`

#### src/pages/admin/AddJobs.tsx
- create regular/installation/special + optional `one_time_customer`
- `scheduledTime` sets hours/minutes on date
- regular:
  - insert `jobs`
  - insert `job_service_points` with `custom_refill_amount` only if differs
- installation:
  - insert `installation_jobs`
  - insert `installation_devices` list
- special:
  - insert `special_jobs` with `job_type` + `battery_type` if batteries

#### src/pages/admin/JobExecution.tsx
- list regular jobs with filters
- execution modal:
  - fetch `job_service_points` join `service_point`
  - upload compressed image -> storage `job-images` -> update `job_service_points.image_url`
  - complete job -> update `jobs.status=completed`

#### src/pages/admin/WorkTemplates.tsx
- templates 1..28: אם חסר template => create
- stations CRUD:
  - insert with next order + `scheduled_time` default `09:00`
  - update `customer_id`/`worker_id`
  - update `scheduled_time` (`HH:mm`)
  - delete station
- fetch customers/workers lists

#### src/pages/admin/WorkSchedule.tsx
- monthly calendar view
- assign template:
  - upsert `work_schedules(date, template_id)`
  - fetch `template_stations` join `customer.service_points`
  - create jobs per station with `scheduled_time`
  - create `job_service_points` per `service_point`
- remove template:
  - find `template_id` for date
  - delete `job_service_points` for matched pending jobs
  - delete pending jobs matched by `customer_id+worker_id` within day range
  - delete `work_schedules` row

#### src/pages/admin/DailySchedule.tsx
- daily view regular+special+installation
- filter by worker
- ordering: `order_number` nulls last then time
- edit time for regular job => update `jobs.date` (only time changes)

#### src/pages/admin/Reports.tsx
- pick customer
- fetch completed jobs
- for each job fetch `job_service_points` join `service_point.refill_amount`
- compute sum per job and total
- show customer price

#### src/pages/admin/Support.tsx
- list `support_tickets` order `created_at desc`
- realtime subscription
- mark `is_new=false` for new tickets on fetch
- search by name/phone/description
- modal full description
- delete ticket

#### src/pages/admin/DeviceInstallation.tsx
- create `installation_job` simple (`09:00`)

#### src/pages/admin/InstallationJobs.tsx
- manage `installation_jobs` + `special_jobs` unified
- filters
- details modal
- view image `publicUrl`
- delete

#### src/pages/admin/DevicesAndScents.tsx
- CRUD devices(name, refill_amount) and scents(name)
- delete device:
  - count `service_points` where `device_type == device.name`
  - if count>0 show modal warning: delete `service_points` then device

### Worker מסכים

#### src/pages/worker/Schedule.tsx
- fetch pending regular+installation+special for `worker_id` for selected day
- unify list with type tag
- filter by type
- service points modal
- execute regular job modal (upload images per point + complete)
- summaries:
  - scent summary: sum by `scent_type` across `job_service_points` (custom or default refill)
  - equipment summary: count installation devices
  - batteries summary: count AA/DC for special batteries

#### src/pages/worker/Jobs.tsx
- history for regular + installation + special with filters date/status/type
- view images:
  - regular gallery from `job_service_points`
  - special/installation `image_url`
- execute pending:
  - regular: upload per point + complete job
  - special: upload 1 image -> update `special_jobs.image_url` -> complete `special_jobs`
  - installation: upload per device -> update `installation_devices.image_url` -> complete `installation_job`

### Customer מסכים

#### src/pages/customer/Profile.tsx
- load customer name+price + `service_points`
- inline edit `scent_type` per `service_point` (dropdown SCENT_TYPES) -> update `service_points`

#### src/pages/customer/Services.tsx
- list customer jobs with filters date/status + join worker(name)
- completed: view images from `job_service_points` gallery

#### src/pages/customer/Support.tsx
- form submit -> insert `support_tickets` (`is_new=true`) + info box

---

# סוף SPEC.md
