// Retired: the legacy helper could mutate a customer using only a public key.
// Membership changes now require a verified payment or authenticated cancel.
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: 'Diagnostic retired' }), {
  status: 410, headers: { 'content-type': 'application/json' },
}));
