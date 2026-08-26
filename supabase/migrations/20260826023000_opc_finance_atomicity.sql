-- Orange Pro Clean GmbH
-- Transaction boundaries for quotes/invoices and idempotent quote -> invoice conversion.

begin;
set local time zone 'Europe/Zurich';

create or replace function public.opc_finance_actor_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when lower(coalesce(s.role,'')) in ('owner','inhaber') then 'owner'
    when lower(coalesce(s.role,'')) in ('admin','administrator') then 'admin'
    when lower(coalesce(s.role,'')) in ('dispatch','dispatcher','disposition') then 'dispatch'
    else lower(coalesce(s.role,''))
  end
  from public.opc_staff_roles s
  where s.user_id = auth.uid()
    and s.status in ('active','aktiv','enabled')
    and coalesce(s.can_access_portal,true) = true
  order by s.created_at desc nulls last
  limit 1;
$$;

grant execute on function public.opc_finance_actor_role() to authenticated;

create or replace function public.opc_assert_finance_actor(p_owner_only boolean default false)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  v_role := public.opc_finance_actor_role();
  if p_owner_only then
    if v_role <> 'owner' then
      raise exception 'Nur Owner dürfen diese Rechnungsaktion ausführen.' using errcode = '42501';
    end if;
  elsif v_role not in ('owner','admin','dispatch') then
    raise exception 'Keine Berechtigung für diese Finanzaktion.' using errcode = '42501';
  end if;
end
$$;

grant execute on function public.opc_assert_finance_actor(boolean) to authenticated;

create or replace function public.opc_insert_quote_item_from_json(p_quote_id uuid, p_item jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.opc_quote_items (
    quote_id, sort_order, item_type, title, description, quantity, unit,
    unit_price_chf, discount_chf, tax_rate, subtotal_chf, tax_chf, total_chf, metadata
  ) values (
    p_quote_id,
    coalesce((p_item->>'sort_order')::integer,1),
    coalesce(nullif(p_item->>'item_type',''),'service'),
    coalesce(nullif(p_item->>'title',''),'Position'),
    nullif(p_item->>'description',''),
    coalesce((p_item->>'quantity')::numeric,1),
    coalesce(nullif(p_item->>'unit',''),'pauschal'),
    coalesce((p_item->>'unit_price_chf')::numeric,0),
    coalesce((p_item->>'discount_chf')::numeric,0),
    coalesce((p_item->>'tax_rate')::numeric,8.1),
    coalesce((p_item->>'subtotal_chf')::numeric,0),
    coalesce((p_item->>'tax_chf')::numeric,0),
    coalesce((p_item->>'total_chf')::numeric,0),
    coalesce(p_item->'metadata','{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.opc_insert_invoice_item_from_json(p_invoice_id uuid, p_item jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.opc_invoice_items (
    invoice_id, quote_item_id, sort_order, title, description, quantity, unit,
    unit_price_chf, discount_chf, tax_rate, subtotal_chf, tax_chf, total_chf, metadata
  ) values (
    p_invoice_id,
    case when coalesce(p_item->>'quote_item_id','') ~* '^[0-9a-f-]{36}$' then (p_item->>'quote_item_id')::uuid else null end,
    coalesce((p_item->>'sort_order')::integer,1),
    coalesce(nullif(p_item->>'title',''),'Position'),
    nullif(p_item->>'description',''),
    coalesce((p_item->>'quantity')::numeric,1),
    coalesce(nullif(p_item->>'unit',''),'pauschal'),
    coalesce((p_item->>'unit_price_chf')::numeric,0),
    coalesce((p_item->>'discount_chf')::numeric,0),
    coalesce((p_item->>'tax_rate')::numeric,8.1),
    coalesce((p_item->>'subtotal_chf')::numeric,0),
    coalesce((p_item->>'tax_chf')::numeric,0),
    coalesce((p_item->>'total_chf')::numeric,0),
    coalesce(p_item->'metadata','{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.opc_create_quote_atomic(p_quote jsonb, p_items jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quote public.opc_quotes%rowtype;
  v_item jsonb;
begin
  perform public.opc_assert_finance_actor(false);
  if p_quote is null or jsonb_typeof(p_quote) <> 'object' then raise exception 'Ungültige Offertendaten.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Ungültige Offertenpositionen.'; end if;

  insert into public.opc_quotes (
    client_id, contact_id, client_site_id, status, quote_type, title, language, currency,
    issue_date, valid_until, intro_text, scope_text, service_description_mode,
    service_description_template_id, service_description_text, terms_text, payment_terms,
    acceptance_terms, internal_notes, customer_notes, client_snapshot, site_snapshot,
    estimated_hours, estimated_staff_count, subtotal_chf, discount_chf, tax_rate,
    tax_chf, total_chf, metadata
  ) values (
    nullif(p_quote->>'client_id','')::uuid,
    nullif(p_quote->>'contact_id','')::uuid,
    nullif(p_quote->>'client_site_id','')::uuid,
    coalesce(nullif(p_quote->>'status',''),'draft'),
    coalesce(nullif(p_quote->>'quote_type',''),'standard'),
    coalesce(nullif(p_quote->>'title',''),'Reinigungsleistung'),
    coalesce(nullif(p_quote->>'language',''),'de'),
    coalesce(nullif(p_quote->>'currency',''),'CHF'),
    nullif(p_quote->>'issue_date','')::date,
    nullif(p_quote->>'valid_until','')::date,
    nullif(p_quote->>'intro_text',''), nullif(p_quote->>'scope_text',''),
    coalesce(nullif(p_quote->>'service_description_mode',''),'embedded'),
    nullif(p_quote->>'service_description_template_id','')::uuid,
    nullif(p_quote->>'service_description_text',''), nullif(p_quote->>'terms_text',''),
    nullif(p_quote->>'payment_terms',''), nullif(p_quote->>'acceptance_terms',''),
    nullif(p_quote->>'internal_notes',''), nullif(p_quote->>'customer_notes',''),
    coalesce(p_quote->'client_snapshot','{}'::jsonb), coalesce(p_quote->'site_snapshot','{}'::jsonb),
    nullif(p_quote->>'estimated_hours','')::numeric,
    nullif(p_quote->>'estimated_staff_count','')::integer,
    coalesce((p_quote->>'subtotal_chf')::numeric,0), coalesce((p_quote->>'discount_chf')::numeric,0),
    coalesce((p_quote->>'tax_rate')::numeric,8.1), coalesce((p_quote->>'tax_chf')::numeric,0),
    coalesce((p_quote->>'total_chf')::numeric,0), coalesce(p_quote->'metadata','{}'::jsonb)
  ) returning * into v_quote;

  for v_item in select value from jsonb_array_elements(p_items) loop
    perform public.opc_insert_quote_item_from_json(v_quote.id, v_item);
  end loop;

  insert into public.opc_quote_events(quote_id, client_id, event_type, message, new_status)
  values (v_quote.id, v_quote.client_id, 'created', 'Offerte erstellt.', v_quote.status);

  return jsonb_build_object(
    'quote', to_jsonb(v_quote),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.opc_quote_items i where i.quote_id=v_quote.id),'[]'::jsonb)
  );
end
$$;

grant execute on function public.opc_create_quote_atomic(jsonb,jsonb) to authenticated;

create or replace function public.opc_save_quote_atomic(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb,
  p_event jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quote public.opc_quotes%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_now timestamptz := now();
begin
  perform public.opc_assert_finance_actor(false);
  perform 1 from public.opc_quotes where id=p_quote_id for update;
  if not found then raise exception 'Offerte wurde nicht gefunden.'; end if;

  update public.opc_quotes q set
    status = coalesce(nullif(p_quote->>'status',''),q.status),
    title = coalesce(nullif(p_quote->>'title',''),q.title),
    quote_type = coalesce(nullif(p_quote->>'quote_type',''),q.quote_type),
    issue_date = coalesce(nullif(p_quote->>'issue_date','')::date,q.issue_date),
    valid_until = nullif(p_quote->>'valid_until','')::date,
    intro_text = p_quote->>'intro_text', scope_text = p_quote->>'scope_text',
    service_description_mode = coalesce(nullif(p_quote->>'service_description_mode',''),q.service_description_mode),
    service_description_template_id = nullif(p_quote->>'service_description_template_id','')::uuid,
    service_description_text = p_quote->>'service_description_text', terms_text = p_quote->>'terms_text',
    payment_terms = p_quote->>'payment_terms', acceptance_terms = p_quote->>'acceptance_terms',
    internal_notes = p_quote->>'internal_notes', customer_notes = p_quote->>'customer_notes',
    subtotal_chf = coalesce((p_quote->>'subtotal_chf')::numeric,q.subtotal_chf),
    discount_chf = coalesce((p_quote->>'discount_chf')::numeric,q.discount_chf),
    tax_rate = coalesce((p_quote->>'tax_rate')::numeric,q.tax_rate),
    tax_chf = coalesce((p_quote->>'tax_chf')::numeric,q.tax_chf),
    total_chf = coalesce((p_quote->>'total_chf')::numeric,q.total_chf),
    sent_at = case when (p_quote ? 'sent_at') then nullif(p_quote->>'sent_at','')::timestamptz else q.sent_at end,
    accepted_at = case when (p_quote ? 'accepted_at') then nullif(p_quote->>'accepted_at','')::timestamptz else q.accepted_at end,
    invoiced_at = case when (p_quote ? 'invoiced_at') then nullif(p_quote->>'invoiced_at','')::timestamptz else q.invoiced_at end,
    metadata = case when p_quote ? 'metadata' then coalesce(p_quote->'metadata','{}'::jsonb) else q.metadata end,
    updated_at = v_now
  where q.id=p_quote_id returning * into v_quote;

  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_item_id := null;
    if coalesce(v_item->>'id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_item_id := (v_item->>'id')::uuid;
    end if;

    if v_item_id is null then
      perform public.opc_insert_quote_item_from_json(p_quote_id,v_item);
    else
      update public.opc_quote_items i set
        sort_order=coalesce((v_item->>'sort_order')::integer,i.sort_order),
        item_type=coalesce(nullif(v_item->>'item_type',''),i.item_type),
        title=coalesce(nullif(v_item->>'title',''),i.title), description=v_item->>'description',
        quantity=coalesce((v_item->>'quantity')::numeric,i.quantity), unit=coalesce(nullif(v_item->>'unit',''),i.unit),
        unit_price_chf=coalesce((v_item->>'unit_price_chf')::numeric,i.unit_price_chf),
        discount_chf=coalesce((v_item->>'discount_chf')::numeric,i.discount_chf),
        tax_rate=coalesce((v_item->>'tax_rate')::numeric,i.tax_rate), subtotal_chf=coalesce((v_item->>'subtotal_chf')::numeric,i.subtotal_chf),
        tax_chf=coalesce((v_item->>'tax_chf')::numeric,i.tax_chf), total_chf=coalesce((v_item->>'total_chf')::numeric,i.total_chf),
        metadata=case when v_item ? 'metadata' then coalesce(v_item->'metadata','{}'::jsonb) else i.metadata end,
        updated_at=v_now
      where i.id=v_item_id and i.quote_id=p_quote_id;
      if not found then raise exception 'Offertenposition gehört nicht zu dieser Offerte.'; end if;
    end if;
  end loop;

  if p_event is not null then
    insert into public.opc_quote_events(quote_id,client_id,event_type,message,previous_status,new_status,metadata)
    values (
      p_quote_id,v_quote.client_id,coalesce(nullif(p_event->>'event_type',''),'updated'),
      nullif(p_event->>'message',''),nullif(p_event->>'previous_status',''),nullif(p_event->>'new_status',''),
      coalesce(p_event->'metadata','{}'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'quote',to_jsonb(v_quote),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.opc_quote_items i where i.quote_id=p_quote_id),'[]'::jsonb)
  );
end
$$;

grant execute on function public.opc_save_quote_atomic(uuid,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.opc_create_invoice_atomic(p_invoice jsonb,p_items jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.opc_invoices%rowtype;
  v_item jsonb;
begin
  perform public.opc_assert_finance_actor(true);
  if p_invoice is null or jsonb_typeof(p_invoice)<>'object' then raise exception 'Ungültige Rechnungsdaten.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Ungültige Rechnungspositionen.'; end if;

  insert into public.opc_invoices(
    quote_id,job_id,client_id,contact_id,client_site_id,status,invoice_type,title,language,currency,
    issue_date,due_date,client_snapshot,site_snapshot,quote_snapshot,job_snapshot,intro_text,payment_terms,internal_notes,
    subtotal_chf,discount_chf,tax_rate,tax_chf,total_chf,paid_chf,balance_chf,metadata
  ) values (
    nullif(p_invoice->>'quote_id','')::uuid,nullif(p_invoice->>'job_id','')::uuid,nullif(p_invoice->>'client_id','')::uuid,
    nullif(p_invoice->>'contact_id','')::uuid,nullif(p_invoice->>'client_site_id','')::uuid,
    coalesce(nullif(p_invoice->>'status',''),'draft'),coalesce(nullif(p_invoice->>'invoice_type',''),'standard'),
    coalesce(nullif(p_invoice->>'title',''),'Rechnung'),coalesce(nullif(p_invoice->>'language',''),'de'),coalesce(nullif(p_invoice->>'currency',''),'CHF'),
    nullif(p_invoice->>'issue_date','')::date,nullif(p_invoice->>'due_date','')::date,
    coalesce(p_invoice->'client_snapshot','{}'::jsonb),coalesce(p_invoice->'site_snapshot','{}'::jsonb),
    coalesce(p_invoice->'quote_snapshot','{}'::jsonb),coalesce(p_invoice->'job_snapshot','{}'::jsonb),
    p_invoice->>'intro_text',p_invoice->>'payment_terms',p_invoice->>'internal_notes',
    coalesce((p_invoice->>'subtotal_chf')::numeric,0),coalesce((p_invoice->>'discount_chf')::numeric,0),coalesce((p_invoice->>'tax_rate')::numeric,8.1),
    coalesce((p_invoice->>'tax_chf')::numeric,0),coalesce((p_invoice->>'total_chf')::numeric,0),coalesce((p_invoice->>'paid_chf')::numeric,0),
    coalesce((p_invoice->>'balance_chf')::numeric,0),coalesce(p_invoice->'metadata','{}'::jsonb)
  ) returning * into v_invoice;

  for v_item in select value from jsonb_array_elements(p_items) loop
    perform public.opc_insert_invoice_item_from_json(v_invoice.id,v_item);
  end loop;

  return jsonb_build_object('invoice',to_jsonb(v_invoice),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.opc_invoice_items i where i.invoice_id=v_invoice.id),'[]'::jsonb));
end
$$;

grant execute on function public.opc_create_invoice_atomic(jsonb,jsonb) to authenticated;

create or replace function public.opc_save_invoice_atomic(p_invoice_id uuid,p_invoice jsonb,p_items jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.opc_invoices%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_now timestamptz := now();
begin
  perform public.opc_assert_finance_actor(false);
  perform 1 from public.opc_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Rechnung wurde nicht gefunden.'; end if;

  update public.opc_invoices i set
    status=coalesce(nullif(p_invoice->>'status',''),i.status),invoice_type=coalesce(nullif(p_invoice->>'invoice_type',''),i.invoice_type),
    title=coalesce(nullif(p_invoice->>'title',''),i.title),issue_date=coalesce(nullif(p_invoice->>'issue_date','')::date,i.issue_date),
    due_date=nullif(p_invoice->>'due_date','')::date,intro_text=p_invoice->>'intro_text',payment_terms=p_invoice->>'payment_terms',
    internal_notes=p_invoice->>'internal_notes',discount_chf=coalesce((p_invoice->>'discount_chf')::numeric,i.discount_chf),
    tax_rate=coalesce((p_invoice->>'tax_rate')::numeric,i.tax_rate),subtotal_chf=coalesce((p_invoice->>'subtotal_chf')::numeric,i.subtotal_chf),
    tax_chf=coalesce((p_invoice->>'tax_chf')::numeric,i.tax_chf),total_chf=coalesce((p_invoice->>'total_chf')::numeric,i.total_chf),
    paid_chf=coalesce((p_invoice->>'paid_chf')::numeric,i.paid_chf),balance_chf=coalesce((p_invoice->>'balance_chf')::numeric,i.balance_chf),
    sent_at=case when p_invoice ? 'sent_at' then nullif(p_invoice->>'sent_at','')::timestamptz else i.sent_at end,
    paid_at=case when p_invoice ? 'paid_at' then nullif(p_invoice->>'paid_at','')::timestamptz else i.paid_at end,
    metadata=case when p_invoice ? 'metadata' then coalesce(p_invoice->'metadata','{}'::jsonb) else i.metadata end,updated_at=v_now
  where i.id=p_invoice_id returning * into v_invoice;

  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_item_id:=null;
    if coalesce(v_item->>'id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_item_id:=(v_item->>'id')::uuid; end if;
    if v_item_id is null then
      perform public.opc_insert_invoice_item_from_json(p_invoice_id,v_item);
    else
      update public.opc_invoice_items x set
        quote_item_id=case when coalesce(v_item->>'quote_item_id','') ~* '^[0-9a-f-]{36}$' then (v_item->>'quote_item_id')::uuid else x.quote_item_id end,
        sort_order=coalesce((v_item->>'sort_order')::integer,x.sort_order),title=coalesce(nullif(v_item->>'title',''),x.title),description=v_item->>'description',
        quantity=coalesce((v_item->>'quantity')::numeric,x.quantity),unit=coalesce(nullif(v_item->>'unit',''),x.unit),
        unit_price_chf=coalesce((v_item->>'unit_price_chf')::numeric,x.unit_price_chf),discount_chf=coalesce((v_item->>'discount_chf')::numeric,x.discount_chf),
        tax_rate=coalesce((v_item->>'tax_rate')::numeric,x.tax_rate),subtotal_chf=coalesce((v_item->>'subtotal_chf')::numeric,x.subtotal_chf),
        tax_chf=coalesce((v_item->>'tax_chf')::numeric,x.tax_chf),total_chf=coalesce((v_item->>'total_chf')::numeric,x.total_chf),
        metadata=case when v_item ? 'metadata' then coalesce(v_item->'metadata','{}'::jsonb) else x.metadata end,updated_at=v_now
      where x.id=v_item_id and x.invoice_id=p_invoice_id;
      if not found then raise exception 'Rechnungsposition gehört nicht zu dieser Rechnung.'; end if;
    end if;
  end loop;

  return jsonb_build_object('invoice',to_jsonb(v_invoice),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.opc_invoice_items i where i.invoice_id=p_invoice_id),'[]'::jsonb));
end
$$;

grant execute on function public.opc_save_invoice_atomic(uuid,jsonb,jsonb) to authenticated;

create or replace function public.opc_convert_quote_to_invoice_atomic(p_quote_id uuid,p_invoice jsonb,p_items jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quote public.opc_quotes%rowtype;
  v_invoice public.opc_invoices%rowtype;
  v_item jsonb;
  v_now timestamptz := now();
begin
  perform public.opc_assert_finance_actor(false);
  select * into v_quote from public.opc_quotes where id=p_quote_id for update;
  if v_quote.id is null then raise exception 'Offerte wurde nicht gefunden.'; end if;

  select * into v_invoice from public.opc_invoices where quote_id=p_quote_id order by created_at asc limit 1;
  if v_invoice.id is not null then
    if v_quote.status <> 'invoiced' then
      update public.opc_quotes set status='invoiced',invoiced_at=coalesce(invoiced_at,v_now),updated_at=v_now where id=p_quote_id;
    end if;
    return jsonb_build_object('invoice',to_jsonb(v_invoice),'existing',true);
  end if;

  insert into public.opc_invoices(
    quote_id,job_id,client_id,contact_id,client_site_id,status,invoice_type,title,language,currency,issue_date,due_date,
    client_snapshot,site_snapshot,quote_snapshot,job_snapshot,intro_text,payment_terms,internal_notes,
    subtotal_chf,discount_chf,tax_rate,tax_chf,total_chf,paid_chf,balance_chf,metadata
  ) values (
    p_quote_id,nullif(p_invoice->>'job_id','')::uuid,v_quote.client_id,
    coalesce(nullif(p_invoice->>'contact_id','')::uuid,v_quote.contact_id),coalesce(nullif(p_invoice->>'client_site_id','')::uuid,v_quote.client_site_id),
    'draft',coalesce(nullif(p_invoice->>'invoice_type',''),'standard'),coalesce(nullif(p_invoice->>'title',''),'Rechnung'),
    coalesce(nullif(p_invoice->>'language',''),v_quote.language,'de'),coalesce(nullif(p_invoice->>'currency',''),v_quote.currency,'CHF'),
    nullif(p_invoice->>'issue_date','')::date,nullif(p_invoice->>'due_date','')::date,
    coalesce(p_invoice->'client_snapshot',v_quote.client_snapshot,'{}'::jsonb),coalesce(p_invoice->'site_snapshot',v_quote.site_snapshot,'{}'::jsonb),
    coalesce(p_invoice->'quote_snapshot','{}'::jsonb),coalesce(p_invoice->'job_snapshot','{}'::jsonb),p_invoice->>'intro_text',p_invoice->>'payment_terms',p_invoice->>'internal_notes',
    coalesce((p_invoice->>'subtotal_chf')::numeric,v_quote.subtotal_chf,0),coalesce((p_invoice->>'discount_chf')::numeric,v_quote.discount_chf,0),
    coalesce((p_invoice->>'tax_rate')::numeric,v_quote.tax_rate,8.1),coalesce((p_invoice->>'tax_chf')::numeric,v_quote.tax_chf,0),
    coalesce((p_invoice->>'total_chf')::numeric,v_quote.total_chf,0),coalesce((p_invoice->>'paid_chf')::numeric,0),coalesce((p_invoice->>'balance_chf')::numeric,v_quote.total_chf,0),
    coalesce(p_invoice->'metadata','{}'::jsonb)
  ) returning * into v_invoice;

  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    perform public.opc_insert_invoice_item_from_json(v_invoice.id,v_item);
  end loop;

  update public.opc_quotes
  set status='invoiced', accepted_at=coalesce(accepted_at,v_now), invoiced_at=coalesce(invoiced_at,v_now), updated_at=v_now
  where id=p_quote_id;

  insert into public.opc_quote_events(quote_id,client_id,event_type,message,previous_status,new_status,metadata)
  values (p_quote_id,v_quote.client_id,'invoice_created','Rechnung '||coalesce(v_invoice.invoice_number,'')||' erstellt.',v_quote.status,'invoiced',jsonb_build_object('invoice_id',v_invoice.id));

  return jsonb_build_object('invoice',to_jsonb(v_invoice),'existing',false);
end
$$;

grant execute on function public.opc_convert_quote_to_invoice_atomic(uuid,jsonb,jsonb) to authenticated;

commit;
