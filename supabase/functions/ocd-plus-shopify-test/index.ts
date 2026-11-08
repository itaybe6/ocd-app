// Retired: the previous diagnostic added and removed a real customer's tag.
// Read-only diagnostics are now protected by the maintenance secret.
Deno.serve(() => new Response(JSON.stringify({ ok: false, error: 'Diagnostic retired' }), {
  status: 410, headers: { 'content-type': 'application/json' },
}));
