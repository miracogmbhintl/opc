-- Orange Pro Clean GmbH
-- AutoAid OAuth credential columns for REST pulling.

alter table if exists public.opc_integration_settings
  add column if not exists access_token_encrypted text,
  add column if not exists access_token_last4 text,
  add column if not exists access_token_set_at timestamptz,
  add column if not exists access_token_expires_at timestamptz,
  add column if not exists refresh_token_encrypted text,
  add column if not exists refresh_token_last4 text,
  add column if not exists refresh_token_set_at timestamptz,
  add column if not exists oauth_client_id text not null default 'connectedCarApi';

update public.opc_integration_settings
set
  api_base_url = 'https://api-production.autoaid.de/cc/v3.0',
  oauth_client_id = coalesce(nullif(oauth_client_id, ''), 'connectedCarApi'),
  settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
    'credential_mode', 'oauth_refresh_token',
    'oauth_endpoint', 'https://oauth.autoaid.de'
  ),
  updated_at = now()
where provider = 'autoaid'
  and (
    api_base_url is null
    or api_base_url = ''
    or api_base_url = 'https://api.autoaid.de'
    or oauth_client_id is null
    or oauth_client_id = ''
  );

comment on column public.opc_integration_settings.access_token_encrypted is
  'Encrypted AutoAid OAuth access token. Short-lived. Decrypted only server-side.';

comment on column public.opc_integration_settings.refresh_token_encrypted is
  'Encrypted AutoAid OAuth refresh token. Used server-side to renew access tokens.';

comment on column public.opc_integration_settings.oauth_client_id is
  'AutoAid OAuth client id, normally connectedCarApi.';
