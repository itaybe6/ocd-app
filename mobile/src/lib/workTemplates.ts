import { supabase } from './supabase';

export type WorkTemplateSchema = 'day_of_month' | 'name';

export type WorkTemplateLite = {
  id: string;
  day_of_month?: number | null;
  name?: string | null;
  created_at?: string | null;
};

export function templateDay(t: WorkTemplateLite): number | null {
  if (typeof t.day_of_month === 'number' && Number.isFinite(t.day_of_month)) return t.day_of_month;
  const name = (t.name ?? '').toString();
  // matches: "תבנית 3", "תבנית 3 משהו", "template 3"
  const m = name.match(/(?:תבנית|template)\s*(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function probeSchema(): Promise<WorkTemplateSchema> {
  const byDay = await supabase.from('work_templates').select('id, day_of_month').limit(1);
  if (!byDay.error) return 'day_of_month';

  const byName = await supabase.from('work_templates').select('id, name').limit(1);
  if (!byName.error) return 'name';

  // prefer first error; both failing usually means table/permissions issue
  throw byDay.error ?? byName.error;
}

export async function fetchWorkTemplatesSorted(): Promise<{ schema: WorkTemplateSchema; templates: WorkTemplateLite[] }> {
  const schema = await probeSchema();

  if (schema === 'day_of_month') {
    const res = await supabase.from('work_templates').select('id, day_of_month, created_at').order('day_of_month', { ascending: true });
    if (res.error) throw res.error;
    return { schema, templates: (res.data ?? []) as any };
  }

  const res = await supabase.from('work_templates').select('id, name, created_at').order('created_at', { ascending: true });
  if (res.error) throw res.error;
  const list = ((res.data ?? []) as any as WorkTemplateLite[]).slice();
  list.sort((a, b) => {
    const da = templateDay(a);
    const db = templateDay(b);
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''));
  });
  return { schema, templates: list };
}

export async function ensureWorkTemplates28(): Promise<{ schema: WorkTemplateSchema; templates: WorkTemplateLite[] }> {
  const { schema, templates } = await fetchWorkTemplatesSorted();

  const existingDays = new Set<number>();
  for (const t of templates) {
    const d = templateDay(t);
    if (d != null) existingDays.add(d);
  }

  const missing = Array.from({ length: 28 }, (_, i) => i + 1).filter((d) => !existingDays.has(d));
  if (!missing.length) return { schema, templates };

  if (schema === 'day_of_month') {
    const ins = await supabase.from('work_templates').insert(missing.map((d) => ({ day_of_month: d })));
    if (ins.error) throw ins.error;
  } else {
    const ins = await supabase.from('work_templates').insert(missing.map((d) => ({ name: `תבנית ${d}` })));
    if (ins.error) throw ins.error;
  }

  return await fetchWorkTemplatesSorted();
}

