import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type BroadcastRequest = {
  title: string;
  body: string;
  scope?: 'general' | 'product';
  productHandle?: string | null;
  productHandles?: string[] | null;
  productTitle?: string | null;
  imageUrl?: string | null;
  scheduleAt?: string | null; // ISO
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

function normalizeHandles(payload: BroadcastRequest): string[] {
  const handles: string[] = [];
  const single = (payload.productHandle ?? null) ? String(payload.productHandle).trim() : '';
  if (single) handles.push(single);
  if (Array.isArray(payload.productHandles)) {
    for (const h of payload.productHandles) {
      const v = (h ?? null) ? String(h).trim() : '';
      if (v) handles.push(v);
    }
  }
  return Array.from(new Set(handles));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: 405, headers: corsHeaders() });
  }

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

  let payload: BroadcastRequest;
  try {
    payload = (await req.json()) as BroadcastRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
  }

  const title = (payload.title ?? '').trim();
  const body = (payload.body ?? '').trim();
  const handles = normalizeHandles(payload);
  const primaryHandle = handles[0] ?? null;
  const productTitle = (payload.productTitle ?? null) ? String(payload.productTitle).trim() : null;
  const imageUrl = (payload.imageUrl ?? null) ? String(payload.imageUrl).trim() : null;
  const scheduleAtRaw = (payload.scheduleAt ?? null) ? String(payload.scheduleAt).trim() : '';

  if (!title || !body) {
    return jsonResponse(
      { error: 'Missing required fields: title, body' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // If scheduleAt is provided and is in the future, enqueue instead of sending immediately.
  if (scheduleAtRaw) {
    const d = new Date(scheduleAtRaw);
    if (Number.isNaN(d.getTime())) {
      return jsonResponse({ error: 'Invalid scheduleAt' }, { status: 400, headers: corsHeaders() });
    }
    const now = Date.now();
    if (d.getTime() > now + 5_000) {
      const scope: 'general' | 'product' = payload.scope === 'product' || handles.length ? 'product' : 'general';
      const { data: job, error: jobErr } = await supabaseAdmin
        .from('push_notification_jobs')
        .insert({
          title,
          body,
          image_url: imageUrl,
          scope,
          product_handles: handles.length ? handles : null,
          scheduled_for: d.toISOString(),
          status: 'scheduled',
        })
        .select('id, scheduled_for')
        .single();
      if (jobErr) {
        return jsonResponse({ error: jobErr.message }, { status: 500, headers: corsHeaders() });
      }
      return jsonResponse(
        { mode: 'scheduled', jobId: (job as any)?.id ?? null, scheduledFor: (job as any)?.scheduled_for ?? null },
        { headers: corsHeaders() },
      );
    }
  }

  const sentAt = new Date().toISOString();
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('push_notifications')
    .insert({
      title,
      body,
      image_url: imageUrl,
      product_handle: primaryHandle,
      product_title: productTitle,
      sent_at: sentAt,
    })
    .select('id')
    .maybeSingle();

  if (insertErr) {
    return jsonResponse({ error: insertErr.message }, { status: 500, headers: corsHeaders() });
  }

  const notificationId = (inserted as any)?.id ?? null;

  let tokens: string[] = [];
  try {
    tokens = await readAllTokens(supabaseAdmin);
  } catch (e: any) {
    if (notificationId) {
      await supabaseAdmin
        .from('push_notifications')
        .update({ errors: { fetchTokens: e?.message ?? String(e) }, error_count: 1 })
        .eq('id', notificationId);
    }
    return jsonResponse({ error: e?.message ?? String(e) }, { status: 500, headers: corsHeaders() });
  }

  if (!tokens.length) {
    if (notificationId) {
      await supabaseAdmin
        .from('push_notifications')
        .update({ total_tokens: 0, success_count: 0, error_count: 0 })
        .eq('id', notificationId);
    }
    return jsonResponse({ totalTokens: 0, successCount: 0, errorCount: 0 }, { headers: corsHeaders() });
  }

  const scope: 'general' | 'product' = payload.scope === 'product' || handles.length ? 'product' : 'general';
  const baseMessage: Record<string, unknown> = {
    title,
    body,
    sound: 'default',
    channelId: 'marketing',
    data: {
      type: scope,
      ...(primaryHandle ? { productHandle: primaryHandle } : {}),
      ...(handles.length > 1 ? { productHandles: handles } : {}),
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

  return jsonResponse(
    {
      mode: 'sent',
      notificationId,
      totalTokens: tokens.length,
      successCount,
      errorCount,
      removedInvalidTokens: Array.from(new Set(invalidTokens)).length,
    },
    { headers: corsHeaders() },
  );
});

