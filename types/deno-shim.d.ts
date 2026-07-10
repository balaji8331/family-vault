// Ambient shim for the Deno global.
//
// A few modules under lib/ (e.g. lib/email/resend.ts) are designed to run in BOTH the
// Node/Next.js runtime and Supabase Edge (Deno) functions. They feature-detect Deno at
// runtime via `typeof Deno !== 'undefined'` and fall back to Node APIs otherwise. This
// declaration lets the Node `tsc` type-check those guarded references without pulling in
// the full Deno type library. At runtime under Node, `Deno` is simply undefined.
declare const Deno: {
  env: { get(key: string): string | undefined };
} | undefined;
