import { format, isValid, parseISO, startOfDay } from 'date-fns';

export function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  const d = parseISO(input);
  return isValid(d) ? d : new Date(input);
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function yyyyMmDd(d: Date | string | number): string {
  return format(toDate(d), 'yyyy-MM-dd');
}

export function hhMm(d: Date | string | number): string {
  return format(toDate(d), 'HH:mm');
}

export function startOfToday(): Date {
  return startOfDay(new Date());
}

function hmToMinutes(hm: string): number {
  const [hhRaw, mmRaw] = hm.split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function minutesToHm(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function timeSlots(opts?: { startHm?: string; endHm?: string; stepMinutes?: number }): string[] {
  const start = hmToMinutes(opts?.startHm ?? '08:00');
  const end = hmToMinutes(opts?.endHm ?? '20:00');
  const step = Math.max(5, Math.floor(opts?.stepMinutes ?? 30));
  const out: string[] = [];
  if (end < start) return out;
  for (let t = start; t <= end; t += step) out.push(minutesToHm(t));
  return out;
}

