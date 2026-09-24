-- =====================================================================
-- Sentinela MVP — migração inicial
-- Princípios: RLS em tudo; cliente só lê o que é da própria organização;
-- escrita sensível só via funções (RPC) ou service role (worker).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Perfis
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  is_staff    boolean not null default false,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Parceiros (corretor, MSP, entidade) e organizações (clientes)
-- ---------------------------------------------------------------------
create table public.partners (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9-]{3,40}$'),
  name        text not null,
  kind        text not null check (kind in ('corretor','msp','entidade','outro')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 160),
  cnpj             text check (cnpj ~ '^[0-9]{14}$'),
  domain           text check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  sector           text check (char_length(sector) <= 60),
  employees_range  text check (employees_range in ('1-10','11-50','51-200','201-500','500+')),
  plan             text not null default 'express' check (plan in ('express','essencial','dossie','360')),
  partner_id       uuid references public.partners(id),
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now()
);
create index on public.organizations (partner_id);

create table public.memberships (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','ti','viewer')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

-- ---------------------------------------------------------------------
-- 3. Funções auxiliares de autorização
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_staff from public.profiles p where p.id = (select auth.uid())), false);
$$;

create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(p_org uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any(p_roles)
  );
$$;

create or replace function public.request_ip()
returns inet language plpgsql stable set search_path = '' as $$
declare v text;
begin
  v := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  return nullif(trim(v), '')::inet;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4. Aceites e autorizações (termos, privacidade, scans)
-- ---------------------------------------------------------------------
create table public.authorizations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  kind         text not null check (kind in ('termos_uso','aviso_privacidade','scan_externo','agente','scan_ativo')),
  doc_version  text not null,
  accepted_by  uuid not null references auth.users(id),
  accepted_at  timestamptz not null default now(),
  ip           inet
);
create index on public.authorizations (org_id);

-- ---------------------------------------------------------------------
-- 5. Catálogo de controles (Base 12)
-- ---------------------------------------------------------------------
create table public.controls (
  id               text primary key check (id ~ '^C[0-9]{2}$'),
  name             text not null,
  area             text not null,
  weight           int  not null check (weight between 1 and 5),
  catalog_version  text not null
);

insert into public.controls (id, name, area, weight, catalog_version) values
  ('C01','Responsável pela segurança','Governança',1,'1.0.0'),
  ('C02','Política de segurança','Governança',1,'1.0.0'),
  ('C03','Verificação em duas etapas (MFA)','Acessos',3,'1.0.0'),
  ('C04','Antivírus em todas as máquinas','Proteção',2,'1.0.0'),
  ('C05','Atualizações em dia','Proteção',2,'1.0.0'),
  ('C06','Backup com cópia separada','Continuidade',3,'1.0.0'),
  ('C07','Teste de restauração','Continuidade',2,'1.0.0'),
  ('C08','Inventário de equipamentos','Ativos',1,'1.0.0'),
  ('C09','Contas de administrador controladas','Acessos',2,'1.0.0'),
  ('C10','Notebooks criptografados','Proteção',1,'1.0.0'),
  ('C11','Treinamento da equipe','Pessoas',1,'1.0.0'),
  ('C12','Plano de incidente','Resposta',1,'1.0.0');

-- ---------------------------------------------------------------------
-- 6. Avaliações, respostas, resultados
-- ---------------------------------------------------------------------
create table public.assessments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  kind            text not null check (kind in ('express','completo','mensal')),
  status          text not null default 'rascunho' check (status in ('rascunho','processando','concluido','erro')),
  score           int  check (score between 0 and 100),
  external_score  int  check (external_score between 0 and 100),
  seal            text not null default 'autoavaliado' check (seal in ('autoavaliado','verificado')),
  catalog_version text not null default '1.0.0',
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index on public.assessments (org_id, created_at desc);

create table public.answers (
  assessment_id  uuid not null references public.assessments(id) on delete cascade,
  question_id    text not null check (question_id ~ '^(C[0-9]{2}|Q_[A-Z_]{2,30})$'),
  value          text not null check (char_length(value) <= 40),
  answered_by    uuid not null default auth.uid() references auth.users(id),
  answered_at    timestamptz not null default now(),
  primary key (assessment_id, question_id)
);

-- Resumo de cada coleta. NUNCA guardar listas de usuários/e-mails aqui.
create table public.scan_results (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  assessment_id      uuid references public.assessments(id) on delete set null,
  module             text not null check (module in ('externo','m365','windows','google')),
  collector_version  text not null,
  device_ref         text check (device_ref ~ '^[a-f0-9]{16,64}$'),  -- hash do hostname, nunca o nome
  summary            jsonb not null,
  sha256             text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  collected_at       timestamptz not null,
  received_at        timestamptz not null default now()
);
create index on public.scan_results (org_id, received_at desc);

create table public.control_results (
  assessment_id    uuid not null references public.assessments(id) on delete cascade,
  control_id       text not null references public.controls(id),
  status           text not null check (status in ('atende','parcial','nao_atende','sem_dado')),
  source           text not null check (source in ('scan','questionario','revisao')),
  divergence       boolean not null default false,
  evidence_sha256  text check (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  note             text check (char_length(note) <= 500),
  reviewed_by      uuid references auth.users(id),
  reviewed_at      timestamptz,
  primary key (assessment_id, control_id)
);

create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  assessment_id  uuid references public.assessments(id) on delete set null,
  kind           text not null check (kind in ('express','completo','mensal','dossie')),
  storage_path   text not null,
  sha256         text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at     timestamptz not null default now()
);
create index on public.reports (org_id, created_at desc);

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  kind          text not null check (kind in ('politica','plano_incidente','designacao')),
  version       int  not null default 1,
  storage_path  text not null,
  sha256        text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  approved_by   uuid references auth.users(id),
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Agente, fila de trabalho, alertas, incidentes, auditoria
-- ---------------------------------------------------------------------
create table public.agent_tokens (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  token_hash    text not null unique,
  label         text check (char_length(label) <= 60),
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '400 days',
  revoked_at    timestamptz,
  last_used_at  timestamptz
);

create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  assessment_id  uuid references public.assessments(id) on delete cascade,
  kind           text not null check (kind in ('scan_externo','processar','relatorio','mensal')),
  status         text not null default 'pendente' check (status in ('pendente','rodando','ok','erro')),
  attempts       int  not null default 0,
  payload        jsonb not null default '{}'::jsonb,
  error          text,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
create index on public.jobs (status, created_at) where status = 'pendente';

create table public.alerts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  control_id   text references public.controls(id),
  severity     text not null check (severity in ('info','atencao','critico')),
  message      text not null check (char_length(message) <= 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index on public.alerts (org_id) where resolved_at is null;

create table public.incidents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  opened_by    uuid not null default auth.uid() references auth.users(id),
  description  text not null check (char_length(description) between 5 and 2000),
  status       text not null default 'aberto' check (status in ('aberto','em_atendimento','encerrado')),
  created_at   timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid references public.organizations(id) on delete set null,
  actor       uuid,
  action      text not null,
  target      text,
  meta        jsonb not null default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index on public.audit_log (org_id, created_at desc);

create or replace function public.log_event(p_org uuid, p_action text, p_target text, p_meta jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (org_id, actor, action, target, meta, ip)
  values (p_org, (select auth.uid()), p_action, p_target, coalesce(p_meta,'{}'::jsonb), public.request_ip());
$$;
revoke all on function public.log_event(uuid, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. RLS — ligado em TODAS as tabelas
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.partners        enable row level security;
alter table public.organizations   enable row level security;
alter table public.memberships     enable row level security;
alter table public.authorizations  enable row level security;
alter table public.controls        enable row level security;
alter table public.assessments     enable row level security;
alter table public.answers         enable row level security;
alter table public.scan_results    enable row level security;
alter table public.control_results enable row level security;
alter table public.reports         enable row level security;
alter table public.documents       enable row level security;
alter table public.agent_tokens    enable row level security;
alter table public.jobs            enable row level security;
alter table public.alerts          enable row level security;
alter table public.incidents       enable row level security;
alter table public.audit_log       enable row level security;

-- Perfis: cada um vê o seu; staff vê todos. Só pode editar o próprio nome.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Parceiros: só staff lê (o código é validado dentro da função create_organization).
create policy partners_staff on public.partners for select to authenticated using (public.is_staff());

-- Organizações: membro ou staff lê. Dono edita só campos descritivos. Criação só via RPC.
create policy org_select on public.organizations for select to authenticated
  using (public.is_member(id) or public.is_staff());
create policy org_update on public.organizations for update to authenticated
  using (public.has_role(id, array['owner'])) with check (public.has_role(id, array['owner']));
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, sector, employees_range) on public.organizations to authenticated;

create policy mem_select on public.memberships for select to authenticated
  using (public.is_member(org_id) or public.is_staff());

create policy auth_select on public.authorizations for select to authenticated
  using (public.is_member(org_id) or public.is_staff());

create policy controls_select on public.controls for select to authenticated using (true);

create policy asmt_select on public.assessments for select to authenticated
  using (public.is_member(org_id) or public.is_staff());

-- Respostas: membro (owner/ti) grava enquanto a avaliação está em rascunho.
create policy ans_select on public.answers for select to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id
                 and (public.is_member(a.org_id) or public.is_staff())));
create policy ans_insert on public.answers for insert to authenticated
  with check (answered_by = (select auth.uid()) and exists (
    select 1 from public.assessments a where a.id = assessment_id
    and a.status = 'rascunho' and public.has_role(a.org_id, array['owner','ti'])));
create policy ans_update on public.answers for update to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id
                 and a.status = 'rascunho' and public.has_role(a.org_id, array['owner','ti'])))
  with check (answered_by = (select auth.uid()));
revoke update on public.answers from authenticated;
grant update (value, answered_at) on public.answers to authenticated;

-- Tabelas escritas só pelo worker (service role). Cliente apenas lê.
create policy scan_select on public.scan_results for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
create policy cres_select on public.control_results for select to authenticated
  using (exists (select 1 from public.assessments a where a.id = assessment_id
                 and (public.is_member(a.org_id) or public.is_staff())));
create policy rep_select on public.reports for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
create policy doc_select on public.documents for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
create policy job_select on public.jobs for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
create policy alert_select on public.alerts for select to authenticated
  using (public.is_member(org_id) or public.is_staff());

-- Token do agente: membro vê metadados, nunca o hash.
create policy tok_select on public.agent_tokens for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
revoke select on public.agent_tokens from authenticated;
grant select (id, org_id, label, created_at, expires_at, revoked_at, last_used_at)
  on public.agent_tokens to authenticated;

-- Incidentes: membro abre e acompanha.
create policy inc_select on public.incidents for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
create policy inc_insert on public.incidents for insert to authenticated
  with check (opened_by = (select auth.uid()) and public.is_member(org_id));

-- Auditoria: só staff lê.
create policy audit_select on public.audit_log for select to authenticated using (public.is_staff());

-- Anônimo não acessa nada.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 9. Funções de negócio (RPC) — todas validam o usuário
-- ---------------------------------------------------------------------

-- Cria empresa + vínculo de dono + aceites + avaliação Express + job de scan externo.
create or replace function public.create_organization(
  p_name text, p_cnpj text, p_domain text, p_sector text, p_employees_range text,
  p_partner_code text, p_terms_version text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_partner uuid;
  v_asmt uuid;
  v_domain text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  -- normaliza domínio: "https://www.Empresa.com.br/contato" -> "empresa.com.br"
  v_domain := lower(trim(coalesce(p_domain, '')));
  v_domain := regexp_replace(v_domain, '^https?://', '');
  v_domain := regexp_replace(v_domain, '[/:?#].*$', '');
  v_domain := regexp_replace(v_domain, '^www\.', '');
  v_domain := nullif(v_domain, '');
  if (select count(*) from public.organizations where created_by = v_uid) >= 3 then
    raise exception 'limit_orgs';
  end if;

  if p_partner_code is not null and p_partner_code <> '' then
    select id into v_partner from public.partners where code = lower(p_partner_code) and active;
  end if;

  insert into public.organizations (name, cnpj, domain, sector, employees_range, partner_id, created_by)
  values (trim(p_name), nullif(regexp_replace(coalesce(p_cnpj,''), '\D', '', 'g'), ''),
          v_domain, p_sector, p_employees_range, v_partner, v_uid)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');

  insert into public.authorizations (org_id, kind, doc_version, accepted_by, ip)
  select v_org, k, p_terms_version, v_uid, public.request_ip()
  from unnest(array['termos_uso','aviso_privacidade','scan_externo']) as k;

  insert into public.assessments (org_id, kind, created_by) values (v_org, 'express', v_uid)
  returning id into v_asmt;

  if v_domain is not null then
    insert into public.jobs (org_id, assessment_id, kind) values (v_org, v_asmt, 'scan_externo');
  end if;

  perform public.log_event(v_org, 'org.create', v_org::text, jsonb_build_object('partner', p_partner_code));
  return v_org;
end $$;

-- Envia o questionário para processamento.
create or replace function public.submit_assessment(p_assessment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.assessments where id = p_assessment and status = 'rascunho';
  if v_org is null or not public.has_role(v_org, array['owner','ti']) then
    raise exception 'forbidden';
  end if;
  update public.assessments set status = 'processando' where id = p_assessment;
  insert into public.jobs (org_id, assessment_id, kind) values (v_org, p_assessment, 'processar');
  perform public.log_event(v_org, 'assessment.submit', p_assessment::text, '{}'::jsonb);
end $$;

-- Gera token do agente. Devolve o texto UMA vez; guarda só o SHA-256.
create or replace function public.create_agent_token(p_org uuid, p_label text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.has_role(p_org, array['owner','ti']) then raise exception 'forbidden'; end if;
  if (select count(*) from public.agent_tokens where org_id = p_org and revoked_at is null) >= 5 then
    raise exception 'limit_tokens';
  end if;
  v_token := 'snt_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.agent_tokens (org_id, token_hash, label, created_by)
  values (p_org, encode(extensions.digest(v_token, 'sha256'), 'hex'), left(p_label, 60), (select auth.uid()));
  insert into public.authorizations (org_id, kind, doc_version, accepted_by, ip)
  values (p_org, 'agente', '1.0', (select auth.uid()), public.request_ip());
  perform public.log_event(p_org, 'agent_token.create', p_label, '{}'::jsonb);
  return v_token;
end $$;

create or replace function public.revoke_agent_token(p_token_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.agent_tokens where id = p_token_id;
  if v_org is null or not public.has_role(v_org, array['owner','ti']) then raise exception 'forbidden'; end if;
  update public.agent_tokens set revoked_at = now() where id = p_token_id and revoked_at is null;
  perform public.log_event(v_org, 'agent_token.revoke', p_token_id::text, '{}'::jsonb);
end $$;

-- Dono aprova documento gerado.
create or replace function public.approve_document(p_document uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.documents where id = p_document;
  if v_org is null or not public.has_role(v_org, array['owner']) then raise exception 'forbidden'; end if;
  update public.documents set approved_by = (select auth.uid()), approved_at = now()
  where id = p_document and approved_at is null;
  perform public.log_event(v_org, 'document.approve', p_document::text, '{}'::jsonb);
end $$;

-- Staff marca controle como revisado (selo Verificado).
create or replace function public.staff_review_control(
  p_assessment uuid, p_control text, p_status text, p_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('atende','parcial','nao_atende','sem_dado') then raise exception 'invalid_status'; end if;
  select org_id into v_org from public.assessments where id = p_assessment;
  update public.control_results
     set status = p_status, source = 'revisao', note = left(p_note, 500),
         reviewed_by = (select auth.uid()), reviewed_at = now()
   where assessment_id = p_assessment and control_id = p_control;
  perform public.log_event(v_org, 'control.review', p_control,
    jsonb_build_object('assessment', p_assessment, 'status', p_status));
end $$;

-- Permissões de execução: só usuários autenticados.
revoke all on function public.create_organization(text,text,text,text,text,text,text) from public, anon;
revoke all on function public.submit_assessment(uuid) from public, anon;
revoke all on function public.create_agent_token(uuid,text) from public, anon;
revoke all on function public.revoke_agent_token(uuid) from public, anon;
revoke all on function public.approve_document(uuid) from public, anon;
revoke all on function public.staff_review_control(uuid,text,text,text) from public, anon;
grant execute on function public.create_organization(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.submit_assessment(uuid) to authenticated;
grant execute on function public.create_agent_token(uuid,text) to authenticated;
grant execute on function public.revoke_agent_token(uuid) to authenticated;
grant execute on function public.approve_document(uuid) to authenticated;
grant execute on function public.staff_review_control(uuid,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Storage — buckets privados, caminho sempre começa com {org_id}/
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('reports',   'reports',   false, 20971520, array['application/pdf']),
  ('documents', 'documents', false, 20971520, array['application/pdf']),
  ('evidence',  'evidence',  false, 10485760, array['application/pdf','image/png','image/jpeg'])
on conflict (id) do nothing;

create policy storage_read on storage.objects for select to authenticated
  using (
    bucket_id in ('reports','documents','evidence')
    and (
      public.is_staff()
      or exists (select 1 from public.memberships m
                 where m.user_id = (select auth.uid())
                   and m.org_id::text = (storage.foldername(name))[1])
    )
  );

-- Cliente (owner/ti) só envia evidência (prints, registros). Relatórios e documentos: só o worker.
create policy storage_evidence_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid())
                  and m.role in ('owner','ti')
                  and m.org_id::text = (storage.foldername(name))[1])
  );
