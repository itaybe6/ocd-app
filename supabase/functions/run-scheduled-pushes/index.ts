import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type JobRow = {
  id: string;
  title: string;
  body: string;
  image_url?: string | null;
  scope?: string | null;
  product_handles?: string[] | null;
  scheduled_for: string;
  status: string;
};

type PushTokenRow = { expo_push_token: string };

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
}

async function readAllTokens(supabaseAdmin: any): Promise<string[]> {
  const tokens: string[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from('push_tokens')
      .select('expo_push_token')
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as PushTokenRow[];
    for (const r of rows) {
      const t = (r.expo_push_token ?? '').trim();
      if (t) tokens.push(t);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return Array.from(new Set(tokens));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function sendBroadcast(opts: {
  supabaseAdmin: any;
  title: string;
  body: string;
  imageUrl: string | null;
  scope: 'general' | 'product';
  productHandles: string[];
}) {
  const { supabaseAdmin, title, body, imageUrl, scope, productHandles } = opts;
  const primaryHandle = productHandles[0] ?? null;

  const sentAt = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('push_notifications')
    .insert({
      title,
      body,
      image_url: imageUrl,
      product_handle: primaryHandle,
      product_title: null,
      sent_at: sentAt,
    })
    .select('id')
    .maybeSingle();

  if (insertErr) throw new Error(insertErr.message);
  const notificationId = (inserted as any)?.id ?? null;

  const tokens = await readAllTokens(supabaseAdmin);
  if (!tokens.length) {
    if (notificationId) {
      await supabaseAdmin
        .from('push_notifications')
        .update({ total_tokens: 0, success_count: 0, error_count: 0 })
        .eq('id', notificationId);
    }
    return { notificationId, totalTokens: 0, successCount: 0, errorCount: 0, removedInvalidTokens: 0, errors: null };
  }

  const baseMessage: Record<string, unknown> = {
    title,
    body,
    sound: 'default',
    channelId: 'marketing',
    data: {
      type: scope,
      ...(primaryHandle ? { productHandle: primaryHandle } : {}),
      ...(productHandles.length > 1 ? { productHandles } : {}),
    },
  };
  if (imageUrl) {
    baseMessage.richContent = { image: imageUrl };
  }

  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  const expoHeaders: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  };
  if (expoAccessToken) expoHeaders.authorization = `Bearer ${expoAccessToken}`;

  let successCount = 0;
  let errorCount = 0;
  const invalidTokens: string[] = [];
  const errors: any[] = [];

  const batches = chunk(tokens, 100);
  for (const batch of batches) {
    const messages = batch.map((to) => ({ ...baseMessage, to }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: expoHeaders,
      body: JSON.stringify(messages),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      errorCount += batch.length;
      errors.push({ http: res.status, body: json });
      continue;
    }

    const ticketData = (json?.data ?? []) as any[];
    for (let i = 0; i < ticketData.length; i++) {
      const t = ticketData[i];
      const token = batch[i] ?? '';
      if (t?.status === 'ok') {
        successCount += 1;
        continue;
      }
      errorCount += 1;
      const detailsError = t?.details?.error ?? null;
      if (detailsError === 'DeviceNotRegistered') {
        invalidTokens.push(token);
      }
      errors.push({ token, message: t?.message ?? 'Unknown error', details: t?.details ?? null });
    }
  }

  if (invalidTokens.length) {
    await supabaseAdmin.from('push_tokens').delete().in('expo_push_token', Array.from(new Set(invalidTokens)));
  }

  if (notificationId) {
    await supabaseAdmin
      .from('push_notifications')
      .update({
        total_tokens: tokens.length,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.length ? errors.slice(0, 1000) : null,
      })
      .eq('id', notificationId);
  }

  return {
    notificationId,
    totalTokens: tokens.length,
    successCount,
    errorCount,
    removedInvalidTokens: Array.from(new Set(invalidTokens)).length,
    errors,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, { status: 405, headers: corsHeaders() });

  const adminSecret = Deno.env.get('ADMIN_BROADCAST_SECRET')?.trim();
  if (adminSecret) {
    const provided = (req.headers.get('x-admin-secret') ?? '').trim();
    if (!provided || provided !== adminSecret) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Missing Supabase env' }, { status: 500, headers: corsHeaders() });
  }

  let limit = 20;
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    if (typeof body?.limit === 'number' && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(200, Math.floor(body.limit)));
    }
  } catch {
    // ignore
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const nowIso = new Date().toISOString();
  const { data: due, error: dueErr } = await supabaseAdmin
    .from('push_notification_jobs')
    .select('id, title, body, image_url, scope, product_handles, scheduled_for, status')
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit);
  if (dueErr) return jsonResponse({ error: dueErr.message }, { status: 500, headers: corsHeaders() });

  const jobs = (due ?? []) as JobRow[];
  const results: any[] = [];

  for (const job of jobs) {
    // Try to lock the job
    const { data: locked, error: lockErr } = await supabaseAdmin
      .from('push_notification_jobs')
      .update({ status: 'sending' })
      .eq('id', job.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (lockErr) {
      results.push({ jobId: job.id, status: 'failed_lock', error: lockErr.message });
      continue;
    }
    if (!locked) continue;

    const handles = Array.from(new Set((job.product_handles ?? []).map((h) => String(h ?? '').trim()).filter(Boolean)));
    const scope: 'general' | 'product' = job.scope === 'product' || handles.length ? 'product' : 'general';

    try {
      const res = await sendBroadcast({
        supabaseAdmin,
        title: String(job.title ?? '').trim(),
        body: String(job.body ?? '').trim(),
        imageUrl: (job.image_url ?? null) ? String(job.image_url).trim() : null,
        scope,
        productHandles: handles,
      });
      await supabaseAdmin
        .from('push_notification_jobs')
        .update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          total_tokens: res.totalTokens,
          success_count: res.successCount,
          error_count: res.errorCount,
          errors: res.errors ? res.errors.slice(0, 1000) : null,
        })
        .eq('id', job.id);
      results.push({ jobId: job.id, status: 'sent', notificationId: res.notificationId });
    } catch (e: any) {
      await supabaseAdmin
        .from('push_notification_jobs')
        .update({
          status: 'failed',
          executed_at: new Date().toISOString(),
          errors: [{ message: e?.message ?? String(e) }],
          error_count: 1,
        })
        .eq('id', job.id);
      results.push({ jobId: job.id, status: 'failed', error: e?.message ?? String(e) });
    }
  }

  return jsonResponse(
    {
      now: nowIso,
      dueCount: jobs.length,
      processed: results.length,
      results,
    },
    { headers: corsHeaders() },
  );
});

