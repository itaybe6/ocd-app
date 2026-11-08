import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { requireUserFromRequest } from '../_shared/authUser.ts';

const headers = {
  ...CORS_HEADERS,
  'access-control-allow-headers': `${CORS_HEADERS['access-control-allow-headers']}, x-app-session`,
};

function respond(body: unknown, status = 200) {
  return jsonResponse(body, { status, headers });
}

// Identity comes exclusively from the signed app session. The only writable
// field is name; phone, role and membership are never accepted from the client.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return respond({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const supabase = createSupabaseAdmin();
    const user = await requireUserFromRequest(req, supabase);
    if (!user) return respond({ ok: false, error: 'צריך להתחבר מחדש כדי לעדכן פרטים' }, 401);

    const raw = await req.text();
    if (raw.length > 2048) return respond({ ok: false, error: 'הבקשה ארוכה מדי' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return respond({ ok: false, error: 'בקשה לא תקינה' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => key !== 'name')
      || !('name' in body) || typeof body.name !== 'string') {
      return respond({ ok: false, error: 'אפשר לעדכן שם בלבד' }, 400);
    }
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80 || /[\u0000-\u001F\u007F]/.test(name)) {
      return respond({ ok: false, error: 'יש להזין שם באורך 2 עד 80 תווים' }, 400);
    }

    const { data, error } = await supabase.from('users')
      .update({ name })
      .eq('id', user.id)
      .select('id, name')
      .single();
    if (error || !data) return respond({ ok: false, error: 'שמירת השם נכשלה. נסו שוב.' }, 500);

    return respond({ ok: true, profile: { id: data.id, name: data.name } });
  } catch {
    return respond({ ok: false, error: 'לא ניתן לעדכן את הפרטים כרגע. נסו שוב.' }, 500);
  }
});
