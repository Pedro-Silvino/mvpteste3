-- Programa de corretores: cadastro do corretor, vínculo de usuários, autorização do cliente para compartilhar o
-- diagnóstico, painel de clientes indicados e evidência liberada para cliente indicado (mesmo no plano grátis).
-- Princípios mantidos: RLS em tudo; leitura sensível só por função security definer que valida o usuário (D06);
-- o corretor só vê dados da empresa depois que o dono da empresa autoriza (LGPD), e isso pode ser revogado.

-- ---------------------------------------------------------------------
-- 1. Corretora: SUSEP opcional e vínculo de usuários
-- ---------------------------------------------------------------------
alter table public.partners
  add column susep text check (susep is null or susep ~ '^[0-9]{1,20}$'),
  add column created_by uuid references auth.users(id);

create table public.partner_members (
  partner_id  uuid not null references public.partners(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (partner_id, user_id)
);
create index on public.partner_members (user_id);
alter table public.partner_members enable row level security;
create policy pm_select on public.partner_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());
revoke insert, update, delete on public.partner_members from authenticated;

-- Autorização do cliente: sem linha ativa aqui, o corretor não vê nada além do domínio e da etapa.
create table public.partner_shares (
  org_id      uuid primary key references public.organizations(id) on delete cascade,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  granted_by  uuid not null references auth.users(id),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
alter table public.partner_shares enable row level security;
create policy ps_select on public.partner_shares for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
revoke insert, update, delete on public.partner_shares from authenticated;

create or replace function public.is_partner_member(p_partner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.partner_members m where m.partner_id = p_partner and m.user_id = (select auth.uid()));
$$;
revoke execute on function public.is_partner_member(uuid) from public, anon;
grant execute on function public.is_partner_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Cadastro do corretor (conta permanente; sessão anônima não vale)
-- ---------------------------------------------------------------------
create or replace function public.register_partner(p_name text, p_kind text, p_susep text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_base text;
  v_code text;
  v_partner uuid;
  v_susep text := nullif(trim(coalesce(p_susep, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false')::boolean then raise exception 'account_required'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 or char_length(trim(p_name)) > 120 then raise exception 'invalid_name'; end if;
  if p_kind not in ('corretor', 'msp') then raise exception 'invalid_kind'; end if;
  if v_susep is not null and v_susep !~ '^[0-9]{1,20}$' then raise exception 'invalid_susep'; end if;
  if exists (select 1 from public.partner_members where user_id = v_uid) then raise exception 'already_partner'; end if;

  -- código do link de indicação: nome sem acento/símbolos + sufixo aleatório (não adivinhável)
  v_base := left(regexp_replace(lower(translate(trim(p_name),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g'), 24);
  v_base := trim(both '-' from v_base);
  if char_length(v_base) < 2 then v_base := 'corretor'; end if;
  loop
    v_code := v_base || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6);
    exit when not exists (select 1 from public.partners where code = v_code);
  end loop;

  insert into public.partners (code, name, kind, susep, created_by)
  values (v_code, trim(p_name), p_kind, v_susep, v_uid)
  returning id into v_partner;
  insert into public.partner_members (partner_id, user_id, role) values (v_partner, v_uid, 'owner');
  perform public.log_event(null, 'partner.register', v_partner::text, jsonb_build_object('kind', p_kind));
  return v_code;
end $$;
revoke all on function public.register_partner(text, text, text) from public, anon;
grant execute on function public.register_partner(text, text, text) to authenticated;

-- Nome da corretora pelo código do link (para a tela de consentimento, antes do login). Só devolve o nome.
create or replace function public.partner_name_by_code(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select p.name from public.partners p where p.code = lower(trim(coalesce(p_code, ''))) and p.active;
$$;
revoke all on function public.partner_name_by_code(text) from public;
grant execute on function public.partner_name_by_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Autorização do cliente (dono da empresa)
-- ---------------------------------------------------------------------
create or replace function public.grant_partner_share(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_partner uuid;
begin
  if not public.has_role(p_org, array['owner']) then raise exception 'forbidden'; end if;
  select partner_id into v_partner from public.organizations where id = p_org;
  if v_partner is null then raise exception 'no_partner'; end if;
  insert into public.partner_shares (org_id, partner_id, granted_by)
  values (p_org, v_partner, (select auth.uid()))
  on conflict (org_id) do update
    set partner_id = excluded.partner_id, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null
    where public.partner_shares.revoked_at is not null;  -- já ativa: não muda nada (nem a data)
  perform public.log_event(p_org, 'partner_share.grant', v_partner::text, '{}'::jsonb);
end $$;

create or replace function public.revoke_partner_share(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_org, array['owner']) then raise exception 'forbidden'; end if;
  update public.partner_shares set revoked_at = now() where org_id = p_org and revoked_at is null;
  perform public.log_event(p_org, 'partner_share.revoke', p_org::text, '{}'::jsonb);
end $$;

-- O cliente vê quem é o corretor e se já autorizou.
create or replace function public.org_partner_status(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_member(p_org) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
           'name', p.name,
           'shared', exists (select 1 from public.partner_shares s where s.org_id = o.id and s.revoked_at is null))
    into r
    from public.organizations o join public.partners p on p.id = o.partner_id
   where o.id = p_org;
  return r;  -- nulo = empresa sem corretor
end $$;

revoke all on function public.grant_partner_share(uuid) from public, anon;
revoke all on function public.revoke_partner_share(uuid) from public, anon;
revoke all on function public.org_partner_status(uuid) from public, anon;
grant execute on function public.grant_partner_share(uuid) to authenticated;
grant execute on function public.revoke_partner_share(uuid) to authenticated;
grant execute on function public.org_partner_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Painel do corretor. Nunca devolve CNPJ, e-mail, nome de pessoa nem o arquivo da evidência.
-- ---------------------------------------------------------------------
-- Fotografia de uma empresa autorizada (uso interno; sem EXECUTE para o cliente).
create or replace function public.partner_client_snapshot(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_asmt record;
  v_controls jsonb := '{}'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
  v_devices int := 0;
  v_ext jsonb;
begin
  select id, kind, status, score, external_score, completed_at into v_asmt
    from public.assessments where org_id = p_org and status = 'concluido'
   order by created_at desc limit 1;
  if v_asmt.id is not null then
    select coalesce(jsonb_object_agg(control_id, status), '{}'::jsonb) into v_controls
      from public.control_results where assessment_id = v_asmt.id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'control_id', control_id, 'file_name', file_name, 'created_at', created_at, 'sha256', left(sha256, 12))
           order by created_at desc), '[]'::jsonb) into v_evidence
    from public.evidence where org_id = p_org;
  select count(distinct device_ref) into v_devices
    from public.scan_results where org_id = p_org and module = 'windows' and device_ref is not null;
  select summary -> 'checks' into v_ext
    from public.scan_results where org_id = p_org and module = 'externo' order by received_at desc limit 1;
  return jsonb_build_object(
    'score', v_asmt.score,
    'external_score', v_asmt.external_score,
    'assessment_kind', v_asmt.kind,
    'completed_at', v_asmt.completed_at,
    'controls', v_controls,
    'evidence', v_evidence,
    'collector_devices', v_devices,
    'external_checks', v_ext);
end $$;
revoke all on function public.partner_client_snapshot(uuid) from public, anon, authenticated;

create or replace function public.my_partner_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  select m.partner_id into v
    from public.partner_members m join public.partners p on p.id = m.partner_id
   where m.user_id = (select auth.uid()) and p.active;
  if v is null then raise exception 'forbidden'; end if;
  return v;
end $$;
revoke all on function public.my_partner_id() from public, anon, authenticated;

create or replace function public.partner_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_partner uuid := public.my_partner_id();
  v_info jsonb;
  v_clients jsonb;
begin
  select jsonb_build_object('name', name, 'code', code, 'kind', kind) into v_info from public.partners where id = v_partner;
  select coalesce(jsonb_agg(row order by created desc), '[]'::jsonb) into v_clients from (
    select o.created_at as created,
           jsonb_build_object(
             'org_id', o.id, 'domain', o.domain, 'created_at', o.created_at,
             'shared', (s.org_id is not null and s.revoked_at is null),
             'stage', case
                        when a.status = 'concluido' then 'concluido'
                        when a.status in ('processando') then 'processando'
                        else 'iniciado' end
           ) || case when s.org_id is not null and s.revoked_at is null
                     then public.partner_client_snapshot(o.id) - 'external_checks' - 'evidence' || jsonb_build_object(
                            'evidence_controls', (select coalesce(jsonb_agg(distinct e.control_id), '[]'::jsonb) from public.evidence e where e.org_id = o.id))
                     else '{}'::jsonb end as row
      from public.organizations o
      left join public.partner_shares s on s.org_id = o.id and s.partner_id = v_partner
      left join lateral (
        select status from public.assessments x where x.org_id = o.id and x.kind = 'express' order by created_at desc limit 1
      ) a on true
     where o.partner_id = v_partner
  ) t;
  return jsonb_build_object('partner', v_info, 'clients', v_clients);
end $$;

create or replace function public.partner_client_detail(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_partner uuid := public.my_partner_id();
  v_org record;
begin
  select o.id, o.domain, o.name, o.sector, o.employees_range, o.plan, o.created_at into v_org
    from public.organizations o
    join public.partner_shares s on s.org_id = o.id and s.revoked_at is null and s.partner_id = v_partner
   where o.id = p_org and o.partner_id = v_partner;
  if v_org.id is null then raise exception 'forbidden'; end if;
  perform public.log_event(p_org, 'partner.view_client', v_partner::text, '{}'::jsonb);
  return jsonb_build_object(
    'org_id', v_org.id, 'domain', v_org.domain, 'name', v_org.name, 'sector', v_org.sector,
    'employees_range', v_org.employees_range, 'plan', v_org.plan, 'created_at', v_org.created_at
  ) || public.partner_client_snapshot(p_org);
end $$;

revoke all on function public.partner_overview() from public, anon;
revoke all on function public.partner_client_detail(uuid) from public, anon;
grant execute on function public.partner_overview() to authenticated;
grant execute on function public.partner_client_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Equipe ativa/desativa corretora (desativada: perde o painel e o link deixa de atribuir clientes)
-- ---------------------------------------------------------------------
create or replace function public.staff_set_partner_active(p_partner uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  update public.partners set active = p_active where id = p_partner;
  if not found then raise exception 'not_found'; end if;
  perform public.log_event(null, 'partner.set_active', p_partner::text, jsonb_build_object('active', p_active));
end $$;
revoke all on function public.staff_set_partner_active(uuid, boolean) from public, anon;
grant execute on function public.staff_set_partner_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Evidência: liberada para plano pago OU empresa indicada por corretor.
--    (Substitui a exigência de plano pago da migração features; só o worker grava a linha, como antes.)
-- ---------------------------------------------------------------------
create or replace function public.org_can_collect_evidence(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o where o.id = p_org and (o.plan <> 'express' or o.partner_id is not null));
$$;
revoke execute on function public.org_can_collect_evidence(uuid) from public, anon;
grant execute on function public.org_can_collect_evidence(uuid) to authenticated;

drop policy storage_evidence_insert on storage.objects;
create policy storage_evidence_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid())
                  and m.role in ('owner', 'ti')
                  and m.org_id::text = (storage.foldername(name))[1]
                  and public.org_can_collect_evidence(m.org_id))
  );

create or replace function public.request_evidence_registration(p_org uuid, p_control text, p_path text, p_file_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_org, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  if not public.org_can_collect_evidence(p_org) then raise exception 'plan_required'; end if;
  if coalesce(p_control, '') !~ '^C[0-9]{2}$' then raise exception 'invalid_control'; end if;
  if p_path is null or p_path not like p_org::text || '/' || p_control || '/%'
     or p_path like '%..%' or position('/' in substr(p_path, char_length(p_org::text || '/' || p_control || '/') + 1)) > 0 then
    raise exception 'invalid_path';
  end if;
  insert into public.jobs (org_id, kind, payload)
  values (p_org, 'evidencia', jsonb_build_object(
    'path', p_path, 'control', p_control,
    'file_name', left(trim(coalesce(p_file_name, '')), 120), 'uploaded_by', (select auth.uid())));
  perform public.log_event(p_org, 'evidence.request', p_path, '{}'::jsonb);
end $$;
