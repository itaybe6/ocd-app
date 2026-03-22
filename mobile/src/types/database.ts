export type UserRole = 'admin' | 'worker' | 'customer';

export type UserRow = {
  id: string;
  phone: string;
  password?: string;
  role: UserRole;
  name: string;
  address?: string | null;
  price?: number | null;
  avatar_url?: string | null;
  created_at?: string;
};

export type OneTimeCustomerRow = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

export type ServicePointRow = {
  id: string;
  customer_id: string;
  device_type: string;
  scent_type: string;
  refill_amount: number;
  notes?: string | null;
  created_at?: string;
};

export type JobStatus = 'pending' | 'completed';

export type JobRow = {
  id: string;
  customer_id?: string | null;
  one_time_customer_id?: string | null;
  worker_id: string;
  date: string; // ISO
  status: JobStatus;
  notes?: string | null;
  order_number?: number | null;
  created_at?: string;
};

export type JobServicePointRow = {
  id: string;
  job_id: string;
  service_point_id: string;
  image_url?: string | null;
  custom_refill_amount?: number | null;
};

export type InstallationJobRow = {
  id: string;
  customer_id?: string | null;
  one_time_customer_id?: string | null;
  worker_id: string;
  date: string; // ISO
  status: JobStatus;
  notes?: string | null;
  order_number?: number | null;
  created_at?: string;
};

export type InstallationDeviceRow = {
  id: string;
  installation_job_id: string;
  device_name: string;
  image_url?: string | null;
};

export type SpecialJobRow = {
  id: string;
  worker_id: string;
  date: string; // ISO
  status: JobStatus;
  job_type: string;
  battery_type?: 'AA' | 'DC' | null;
  image_url?: string | null;
  notes?: string | null;
  order_number?: number | null;
  created_at?: string;
};

export type WorkTemplateRow = {
  id: string;
  day_of_month: number; // 1..28
  created_at?: string;
};

export type TemplateStationRow = {
  id: string;
  template_id: string;
  order: number;
  customer_id?: string | null;
  worker_id?: string | null;
  scheduled_time: string; // HH:mm
  created_at?: string;
};

export type WorkScheduleRow = {
  id: string;
  date: string; // yyyy-MM-dd
  template_id: string;
  created_at?: string;
};

export type SupportTicketRow = {
  id: string;
  customer_name: string;
  phone: string;
  description: string;
  is_new: boolean;
  created_at?: string;
};

export const BATTERY_TYPES = ['AA', 'DC'] as const;

