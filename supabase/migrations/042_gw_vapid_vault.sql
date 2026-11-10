-- Chiavi VAPID custodite in Supabase Vault: nessuna chiave in GitHub/Netlify.
-- L'RPC è accessibile soltanto dal client service_role del gestionale.
-- RLS non è bypassata: SECURITY INVOKER, con controllo esplicito del ruolo.
create or replace function public.gw_get_vapid_config()
returns jsonb
language plpgsql
stable
security invoker
set search_path = 'pg_catalog', 'pg_temp'
as $$
declare
  v_public text;
  v_private text;
  v_subject text;
begin
  if current_user <> 'service_role' then
    raise exception 'gw_forbidden' using errcode = 'GW403';
  end if;

  select decrypted_secret into v_public
    from vault.decrypted_secrets where name = 'peony_vapid_public_key';
  select decrypted_secret into v_private
    from vault.decrypted_secrets where name = 'peony_vapid_private_key';
  select decrypted_secret into v_subject
    from vault.decrypted_secrets where name = 'peony_vapid_subject';

  if v_public is null or v_private is null then return null; end if;
  return jsonb_build_object(
    'publicKey', v_public, 'privateKey', v_private,
    'subject', coalesce(v_subject, 'mailto:peony.studio.turin@gmail.com')
  );
end;
$$;

revoke all on function public.gw_get_vapid_config() from public, anon, authenticated;
grant execute on function public.gw_get_vapid_config() to service_role;
