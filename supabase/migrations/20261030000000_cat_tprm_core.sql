-- CAT-TPRM, ciclo 1: tiers B2B, cofre de evidências imutável (WORM) e módulo de fornecedores (TPRM).
-- Princípios mantidos: RLS em toda tabela; escrita sensível só por função security definer ou pelo worker (service role);
-- fornecedor (sem login) acessa só o próprio assessment, por token de uso único guardado como hash.

-- ---------------------------------------------------------------------
-- 1. Tiers B2B (core, pro, scale). Os valores antigos continuam válidos até o Pedro definir a migração comercial
--    (o código existente usa 'express' como "grátis" e "<> express" como "pago").
-- ---------------------------------------------------------------------
alter table public.organizations drop constraint organizations_plan_check;
alter table public.organizations add constraint organizations_plan_check
  check (plan in ('express', 'essencial', 'dossie', '360', 'core', 'pro', 'scale'));

create or replace function public.org_can_use_vault(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o where o.id = p_org and o.plan in ('pro', 'scale', 'dossie', '360'));
$$;
revoke execute on function public.org_can_use_vault(uuid) from public, anon;
grant execute on function public.org_can_use_vault(uuid) to authenticated;

create or replace function public.org_can_use_tprm(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o where o.id = p_org and o.plan in ('scale', '360'));
$$;
revoke execute on function public.org_can_use_tprm(uuid) from public, anon;
grant execute on function public.org_can_use_tprm(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Cofre de evidências (WORM: grava uma vez, lê quantas vezes quiser)
-- ---------------------------------------------------------------------
create table public.evidence_vault (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete restrict,
  title             text not null check (char_length(title) between 3 and 160),
  category          text not null check (category in ('politica', 'backup', 'mfa', 'patch', 'continuidade', 'treinamento', 'contrato', 'laudo', 'outro')),
  file_path         text not null check (file_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._/-]{1,255}$' and file_path not like '%..%'),
  file_hash_sha256  text not null check (file_hash_sha256 ~ '^[a-f0-9]{64}$'),
  metadata          jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 8192),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  check (split_part(file_path, '/', 1) = organization_id::text)
);
create index on public.evidence_vault (organization_id, category, created_at desc);
create index on public.evidence_vault (file_hash_sha256);
alter table public.evidence_vault enable row level security;
create policy vault_select on public.evidence_vault for select to authenticated
  using (public.is_member(organization_id) or public.is_staff());
-- Sem política de insert/update/delete: a escrita passa só por vault_register (abaixo) ou pelo worker (service role).
revoke all on public.evidence_vault from anon, authenticated;
grant select on public.evidence_vault to authenticated;

create or replace function public.evidence_vault_worm()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'WORM Violation: Evidence cannot be modified or deleted';
end $$;

create trigger evidence_vault_no_change
  before update or delete on public.evidence_vault
  for each row execute function public.evidence_vault_worm();
create trigger evidence_vault_no_truncate
  before truncate on public.evidence_vault
  for each statement execute function public.evidence_vault_worm();

-- Registro de uma evidência (o hash é calculado pelo servidor que recebeu o arquivo; aqui só se valida e grava).
create or replace function public.vault_register(
  p_org uuid, p_title text, p_category text, p_file_path text, p_hash text, p_metadata jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.has_role(p_org, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  if not public.org_can_use_vault(p_org) then raise exception 'plan_required'; end if;
  insert into public.evidence_vault (organization_id, title, category, file_path, file_hash_sha256, metadata, created_by)
  values (p_org, trim(p_title), p_category, p_file_path, lower(p_hash), coalesce(p_metadata, '{}'::jsonb), (select auth.uid()))
  returning id into v_id;
  perform public.log_event(p_org, 'vault.register', v_id::text, jsonb_build_object('category', p_category, 'sha256', lower(p_hash)));
  return v_id;
end $$;
revoke all on function public.vault_register(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.vault_register(uuid, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. TPRM: fornecedores, avaliações e provas
-- ---------------------------------------------------------------------
create table public.vendor_organizations (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null check (char_length(name) between 2 and 160),
  domain            text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  criticality       text not null default 'media' check (criticality in ('baixa', 'media', 'alta')),
  status            text not null default 'convidado' check (status in ('convidado', 'em_andamento', 'concluido', 'homologado', 'reprovado')),
  tprm_score        int check (tprm_score between 0 and 100),
  last_assessed_at  timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  unique (organization_id, domain)
);
create index on public.vendor_organizations (organization_id);
alter table public.vendor_organizations enable row level security;
create policy vendor_select on public.vendor_organizations for select to authenticated
  using (public.is_member(organization_id) or public.is_staff());
revoke all on public.vendor_organizations from anon, authenticated;
grant select on public.vendor_organizations to authenticated;

create table public.vendor_assessments (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendor_organizations(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  token_hash        text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_expires_at  timestamptz not null default now() + interval '30 days',
  revoked_at        timestamptz,
  status            text not null default 'pendente' check (status in ('pendente', 'enviada', 'expirada')),
  answers           jsonb not null default '{}'::jsonb check (pg_column_size(answers) <= 32768),
  answers_score     int check (answers_score between 0 and 100),
  external_score    int check (external_score between 0 and 100),
  tprm_score        int check (tprm_score between 0 and 100),
  submitted_at      timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);
create index on public.vendor_assessments (vendor_id, created_at desc);
create index on public.vendor_assessments (organization_id);
alter table public.vendor_assessments enable row level security;
-- O token_hash nunca sai pela API: a coluna não é concedida ao cliente.
create policy vassess_select on public.vendor_assessments for select to authenticated
  using (public.is_member(organization_id) or public.is_staff());
revoke all on public.vendor_assessments from anon, authenticated;
grant select (id, vendor_id, organization_id, token_expires_at, revoked_at, status, answers_score, external_score,
              tprm_score, submitted_at, created_at) on public.vendor_assessments to authenticated;

create table public.vendor_evidence_links (
  id                uuid primary key default gen_random_uuid(),
  assessment_id     uuid not null references public.vendor_assessments(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  control_id        text not null check (control_id ~ '^C[0-9]{2}$'),
  file_name         text not null check (char_length(file_name) between 1 and 160),
  file_path         text not null check (file_path ~ '^[0-9a-f-]{36}/vendors/[A-Za-z0-9._/-]{1,255}$' and file_path not like '%..%'),
  file_hash_sha256  text not null check (file_hash_sha256 ~ '^[a-f0-9]{64}$'),
  vault_id          uuid references public.evidence_vault(id) on delete restrict,
  created_at        timestamptz not null default now(),
  check (split_part(file_path, '/', 1) = organization_id::text)
);
create index on public.vendor_evidence_links (assessment_id);
create index on public.vendor_evidence_links (organization_id);
alter table public.vendor_evidence_links enable row level security;
create policy vlink_select on public.vendor_evidence_links for select to authenticated
  using (public.is_member(organization_id) or public.is_staff());
-- Gravação só pelo servidor (rota do portal que valida o token e calcula o hash).
revoke all on public.vendor_evidence_links from anon, authenticated;
grant select on public.vendor_evidence_links to authenticated;

-- ---------------------------------------------------------------------
-- 4. Funções do TPRM
-- ---------------------------------------------------------------------
create or replace function public.add_vendor(p_org uuid, p_name text, p_domain text, p_criticality text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.has_role(p_org, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  if not public.org_can_use_tprm(p_org) then raise exception 'plan_required'; end if;
  if (select count(*) from public.vendor_organizations where organization_id = p_org) >= 200 then raise exception 'limit_vendors'; end if;
  insert into public.vendor_organizations (organization_id, name, domain, criticality, created_by)
  values (p_org, trim(p_name), lower(trim(p_domain)), coalesce(p_criticality, 'media'), (select auth.uid()))
  returning id into v_id;
  perform public.log_event(p_org, 'vendor.add', v_id::text, '{}'::jsonb);
  return v_id;
end $$;
revoke all on function public.add_vendor(uuid, text, text, text) from public, anon;
grant execute on function public.add_vendor(uuid, text, text, text) to authenticated;

-- Gera o convite do fornecedor. O token aparece uma vez; no banco fica só o SHA-256.
create or replace function public.create_vendor_assessment(p_vendor uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_token text;
begin
  select organization_id into v_org from public.vendor_organizations where id = p_vendor;
  if v_org is null or not public.has_role(v_org, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  if not public.org_can_use_tprm(v_org) then raise exception 'plan_required'; end if;
  update public.vendor_assessments set revoked_at = now()
   where vendor_id = p_vendor and status = 'pendente' and revoked_at is null;
  v_token := 'vnd_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.vendor_assessments (vendor_id, organization_id, token_hash, created_by)
  values (p_vendor, v_org, encode(extensions.digest(v_token, 'sha256'), 'hex'), (select auth.uid()));
  update public.vendor_organizations set status = 'convidado' where id = p_vendor and status in ('convidado', 'concluido', 'homologado', 'reprovado');
  perform public.log_event(v_org, 'vendor.invite', p_vendor::text, '{}'::jsonb);
  return v_token;
end $$;
revoke all on function public.create_vendor_assessment(uuid) from public, anon;
grant execute on function public.create_vendor_assessment(uuid) to authenticated;

create or replace function public.revoke_vendor_assessment(p_assessment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.vendor_assessments where id = p_assessment;
  if v_org is null or not public.has_role(v_org, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  update public.vendor_assessments set revoked_at = now() where id = p_assessment and revoked_at is null;
  perform public.log_event(v_org, 'vendor.revoke', p_assessment::text, '{}'::jsonb);
end $$;
revoke all on function public.revoke_vendor_assessment(uuid) from public, anon;
grant execute on function public.revoke_vendor_assessment(uuid) to authenticated;

-- Visão do fornecedor (sem login): só nome do fornecedor, nome do contratante, situação e respostas já dadas.
create or replace function public.vendor_get_assessment(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v record;
begin
  if p_token is null or p_token !~ '^vnd_[a-f0-9]{64}$' then return null; end if;
  select a.id, a.status, a.answers, a.token_expires_at, vo.name as vendor_name, o.name as org_name
    into v
    from public.vendor_assessments a
    join public.vendor_organizations vo on vo.id = a.vendor_id
    join public.organizations o on o.id = a.organization_id
   where a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and a.revoked_at is null and a.token_expires_at > now();
  if not found then return null; end if;
  return jsonb_build_object('id', v.id, 'status', v.status, 'answers', v.answers,
                            'vendor_name', v.vendor_name, 'org_name', v.org_name, 'expires_at', v.token_expires_at);
end $$;
revoke all on function public.vendor_get_assessment(text) from public;
grant execute on function public.vendor_get_assessment(text) to anon, authenticated;

-- Envio das respostas (uma única vez). Respostas: {"C01": "sim"|"parcial"|"nao"|"nao_sei", ...}
create or replace function public.vendor_submit_assessment(p_token text, p_answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_vendor uuid; v_org uuid; v_key text; v_val jsonb;
begin
  if p_token is null or p_token !~ '^vnd_[a-f0-9]{64}$' then raise exception 'invalid_token'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 32768 then raise exception 'invalid_answers'; end if;
  for v_key, v_val in select * from jsonb_each(p_answers) loop
    if v_key !~ '^C[0-9]{2}$' or jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') not in ('sim', 'parcial', 'nao', 'nao_sei') then
      raise exception 'invalid_answers';
    end if;
  end loop;
  select a.id, a.vendor_id, a.organization_id into v_id, v_vendor, v_org
    from public.vendor_assessments a
   where a.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and a.revoked_at is null and a.token_expires_at > now() and a.status = 'pendente'
   for update;
  if v_id is null then raise exception 'invalid_token'; end if;
  update public.vendor_assessments set answers = p_answers, status = 'enviada', submitted_at = now() where id = v_id;
  update public.vendor_organizations set status = 'em_andamento' where id = v_vendor;
  perform public.log_event(v_org, 'vendor.submit', v_id::text, '{}'::jsonb);
end $$;
revoke all on function public.vendor_submit_assessment(text, jsonb) from public;
grant execute on function public.vendor_submit_assessment(text, jsonb) to anon, authenticated;
