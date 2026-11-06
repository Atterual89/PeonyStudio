import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client service role riservato al gestionale. Le tabelle gw_ non hanno
// policy RLS e nessun privilegio per anon/authenticated: si raggiungono solo
// da qui. Mai importare questo modulo da un client component.

let client: SupabaseClient | null = null;

export function getGestionaleDb(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Gestionale: variabili Supabase lato server mancanti.");
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}
