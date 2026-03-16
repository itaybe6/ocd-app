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

