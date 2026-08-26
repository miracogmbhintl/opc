begin;

create or replace function public.opc_create_client_atomic(
  p_client jsonb,
  p_contact jsonb,
  p_site jsonb,
  p_link jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact public.opc_contacts%rowtype;
  v_client public.opc_clients%rowtype;
  v_site public.opc_client_sites%rowtype;
  v_email text := lower(nullif(trim(p_contact->>'email'),''));
  v_phone text := nullif(trim(coalesce(p_contact->>'phone_e164',p_contact->>'phone_raw')),'');
begin
  if p_client is null or jsonb_typeof(p_client) <> 'object' then raise exception 'Ungültige Kundendaten.'; end if;
  if p_contact is null or jsonb_typeof(p_contact) <> 'object' then raise exception 'Ungültige Kontaktdaten.'; end if;
  if p_site is null or jsonb_typeof(p_site) <> 'object' then raise exception 'Ungültige Standortdaten.'; end if;

  if v_email is not null then
    select * into v_contact
    from public.opc_contacts
    where lower(email) = v_email
    order by created_at asc
    limit 1
    for update;
  end if;

  if v_contact.id is null and v_phone is not null then
    select * into v_contact
    from public.opc_contacts
    where phone_raw = v_phone or phone_e164 = v_phone
    order by created_at asc
    limit 1
    for update;
  end if;

  if v_contact.id is null then
    insert into public.opc_contacts (
      full_name, first_name, last_name, company_name, email, phone_raw, phone_e164,
      preferred_language, lifecycle_stage, source_first, source_last, notes, metadata, updated_at
    ) values (
      nullif(p_contact->>'full_name',''), nullif(p_contact->>'first_name',''), nullif(p_contact->>'last_name',''),
      nullif(p_contact->>'company_name',''), v_email, nullif(p_contact->>'phone_raw',''), nullif(p_contact->>'phone_e164',''),
      coalesce(nullif(p_contact->>'preferred_language',''),'de'),
      coalesce(nullif(p_contact->>'lifecycle_stage',''),'client'),
      coalesce(nullif(p_contact->>'source_first',''),'manual_client_create'),
      coalesce(nullif(p_contact->>'source_last',''),'manual_client_create'),
      nullif(p_contact->>'notes',''), coalesce(p_contact->'metadata','{}'::jsonb), now()
    ) returning * into v_contact;
  else
    update public.opc_contacts c set
      full_name = coalesce(nullif(p_contact->>'full_name',''),c.full_name),
      first_name = case when p_contact ? 'first_name' then nullif(p_contact->>'first_name','') else c.first_name end,
      last_name = case when p_contact ? 'last_name' then nullif(p_contact->>'last_name','') else c.last_name end,
      company_name = case when p_contact ? 'company_name' then nullif(p_contact->>'company_name','') else c.company_name end,
      email = case when p_contact ? 'email' then v_email else c.email end,
      phone_raw = case when p_contact ? 'phone_raw' then nullif(p_contact->>'phone_raw','') else c.phone_raw end,
      phone_e164 = case when p_contact ? 'phone_e164' then nullif(p_contact->>'phone_e164','') else c.phone_e164 end,
      preferred_language = coalesce(nullif(p_contact->>'preferred_language',''),c.preferred_language),
      lifecycle_stage = coalesce(nullif(p_contact->>'lifecycle_stage',''),c.lifecycle_stage),
      source_last = coalesce(nullif(p_contact->>'source_last',''),c.source_last),
      notes = case when p_contact ? 'notes' then nullif(p_contact->>'notes','') else c.notes end,
      metadata = case when p_contact ? 'metadata' then coalesce(c.metadata,'{}'::jsonb) || coalesce(p_contact->'metadata','{}'::jsonb) else c.metadata end,
      updated_at = now()
    where c.id = v_contact.id
    returning * into v_contact;
  end if;

  insert into public.opc_clients (
    contact_id, client_type, status, billing_name, billing_email, billing_phone_e164,
    billing_address, internal_notes, metadata, updated_at
  ) values (
    v_contact.id,
    coalesce(nullif(p_client->>'client_type',''),'unknown'),
    coalesce(nullif(p_client->>'status',''),'active'),
    coalesce(nullif(p_client->>'billing_name',''),v_contact.company_name,v_contact.full_name,'Unbenannter Kunde'),
    lower(nullif(p_client->>'billing_email','')),
    nullif(p_client->>'billing_phone_e164',''), nullif(p_client->>'billing_address',''),
    nullif(p_client->>'internal_notes',''), coalesce(p_client->'metadata','{}'::jsonb), now()
  ) returning * into v_client;

  insert into public.opc_client_sites (
    client_id, contact_id, site_name, site_type, status, address_text, postal_code,
    city, country, is_primary, service_requirements, metadata, updated_at
  ) values (
    v_client.id, v_contact.id,
    coalesce(nullif(p_site->>'site_name',''),v_client.billing_name,'Hauptstandort'),
    coalesce(nullif(p_site->>'site_type',''),'other'),
    coalesce(nullif(p_site->>'status',''),'active'),
    nullif(p_site->>'address_text',''), nullif(p_site->>'postal_code',''), nullif(p_site->>'city',''),
    coalesce(nullif(p_site->>'country',''),'CH'), true,
    coalesce(p_site->'service_requirements','{}'::jsonb), coalesce(p_site->'metadata','{}'::jsonb), now()
  ) returning * into v_site;

  insert into public.opc_client_contact_links (
    client_id, contact_id, role_label, is_primary, receives_reports, receives_invoices,
    receives_operations_updates, metadata
  ) values (
    v_client.id, v_contact.id,
    coalesce(nullif(p_link->>'role_label',''),'Hauptkontakt'), true,
    coalesce((p_link->>'receives_reports')::boolean,true),
    coalesce((p_link->>'receives_invoices')::boolean,true),
    coalesce((p_link->>'receives_operations_updates')::boolean,true),
    coalesce(p_link->'metadata','{}'::jsonb)
  );

  return jsonb_build_object(
    'client',to_jsonb(v_client),
    'contact',to_jsonb(v_contact),
    'site',to_jsonb(v_site)
  );
end
$$;

create or replace function public.opc_update_client_atomic(
  p_client_id uuid,
  p_client jsonb,
  p_contact jsonb,
  p_site jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client public.opc_clients%rowtype;
  v_contact public.opc_contacts%rowtype;
  v_site public.opc_client_sites%rowtype;
  v_site_id uuid;
  v_provided_site_id uuid;
begin
  select * into v_client from public.opc_clients where id=p_client_id for update;
  if v_client.id is null then raise exception 'Client not found'; end if;

  if coalesce(p_site->>'primary_site_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_provided_site_id := (p_site->>'primary_site_id')::uuid;
  end if;

  if v_client.contact_id is not null then
    select * into v_contact from public.opc_contacts where id=v_client.contact_id for update;
  end if;

  if v_contact.id is null and (
    coalesce(nullif(p_contact->>'full_name',''),nullif(p_contact->>'company_name',''),nullif(p_contact->>'email',''),nullif(p_contact->>'phone_raw',''),nullif(p_contact->>'phone_e164','')) is not null
  ) then
    insert into public.opc_contacts(full_name,company_name,email,phone_raw,phone_e164,lifecycle_stage,source_first,source_last,metadata,updated_at)
    values (
      nullif(p_contact->>'full_name',''),nullif(p_contact->>'company_name',''),lower(nullif(p_contact->>'email','')),
      nullif(p_contact->>'phone_raw',''),nullif(p_contact->>'phone_e164',''),'client',
      'manual_client_detail_update','manual_client_detail_update',jsonb_build_object('created_from','client_detail_update','client_id',p_client_id),now()
    ) returning * into v_contact;
    update public.opc_clients set contact_id=v_contact.id,updated_at=now() where id=p_client_id returning * into v_client;
  elsif v_contact.id is not null then
    update public.opc_contacts c set
      full_name = case when p_contact ? 'full_name' then nullif(p_contact->>'full_name','') else c.full_name end,
      company_name = case when p_contact ? 'company_name' then nullif(p_contact->>'company_name','') else c.company_name end,
      email = case when p_contact ? 'email' then lower(nullif(p_contact->>'email','')) else c.email end,
      phone_raw = case when p_contact ? 'phone_raw' then nullif(p_contact->>'phone_raw','') else c.phone_raw end,
      phone_e164 = case when p_contact ? 'phone_e164' then nullif(p_contact->>'phone_e164','') else c.phone_e164 end,
      updated_at = now()
    where c.id=v_contact.id returning * into v_contact;
  end if;

  update public.opc_clients c set
    billing_name=coalesce(nullif(p_client->>'billing_name',''),c.billing_name),
    billing_email=case when p_client ? 'billing_email' then lower(nullif(p_client->>'billing_email','')) else c.billing_email end,
    billing_phone_e164=case when p_client ? 'billing_phone_e164' then nullif(p_client->>'billing_phone_e164','') else c.billing_phone_e164 end,
    billing_address=case when p_client ? 'billing_address' then nullif(p_client->>'billing_address','') else c.billing_address end,
    internal_notes=case when p_client ? 'internal_notes' then nullif(p_client->>'internal_notes','') else c.internal_notes end,
    client_type=coalesce(nullif(p_client->>'client_type',''),c.client_type),
    status=coalesce(nullif(p_client->>'status',''),c.status),
    updated_at=now()
  where c.id=p_client_id returning * into v_client;

  if v_provided_site_id is not null then
    select id into v_site_id from public.opc_client_sites where id=v_provided_site_id and client_id=p_client_id for update;
    if v_site_id is null then raise exception 'Primary site does not belong to client.'; end if;
  else
    select id into v_site_id
    from public.opc_client_sites
    where client_id=p_client_id and is_primary=true and status='active'
    order by created_at asc limit 1 for update;

    if v_site_id is null then
      select id into v_site_id from public.opc_client_sites
      where client_id=p_client_id and status<>'archived'
      order by created_at asc limit 1 for update;
    end if;
  end if;

  if v_site_id is null then
    insert into public.opc_client_sites(
      client_id,contact_id,site_name,site_type,status,address_text,postal_code,city,country,is_primary,service_requirements,metadata,updated_at
    ) values (
      p_client_id,v_contact.id,coalesce(nullif(p_site->>'site_name',''),v_client.billing_name,'Hauptstandort'),
      coalesce(nullif(p_site->>'site_type',''),'other'),'active',nullif(p_site->>'address_text',''),
      nullif(p_site->>'postal_code',''),nullif(p_site->>'city',''),coalesce(nullif(p_site->>'country',''),'CH'),true,
      '{}'::jsonb,jsonb_build_object('source','client_detail_manual_edit','created_by',p_actor_user_id),now()
    ) returning * into v_site;
    v_site_id := v_site.id;
  else
    update public.opc_client_sites s set
      contact_id=coalesce(v_contact.id,s.contact_id),
      site_name=coalesce(nullif(p_site->>'site_name',''),s.site_name),
      site_type=coalesce(nullif(p_site->>'site_type',''),s.site_type),
      status=coalesce(nullif(p_site->>'status',''),'active'),
      address_text=case when p_site ? 'address_text' then nullif(p_site->>'address_text','') else s.address_text end,
      postal_code=case when p_site ? 'postal_code' then nullif(p_site->>'postal_code','') else s.postal_code end,
      city=case when p_site ? 'city' then nullif(p_site->>'city','') else s.city end,
      country=coalesce(nullif(p_site->>'country',''),s.country),
      is_primary=true,updated_at=now()
    where s.id=v_site_id and s.client_id=p_client_id returning * into v_site;
  end if;

  update public.opc_client_sites set is_primary=false,updated_at=now()
  where client_id=p_client_id and id<>v_site_id and is_primary=true;

  return jsonb_build_object(
    'client',to_jsonb(v_client),
    'contact',case when v_contact.id is null then null else to_jsonb(v_contact) end,
    'site',to_jsonb(v_site)
  );
end
$$;

revoke all on function public.opc_create_client_atomic(jsonb,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.opc_update_client_atomic(uuid,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.opc_create_client_atomic(jsonb,jsonb,jsonb,jsonb,uuid) to service_role;
grant execute on function public.opc_update_client_atomic(uuid,jsonb,jsonb,jsonb,uuid) to service_role;

commit;
