-- Funcionalidades do painel: dados da empresa, staff (plano e alertas), SOS, evidência e pedido de documentos.
-- Princípios do init mantidos: RLS em tudo, escrita sensível só por função com security definer que valida o usuário.

-- Plano pago? (usado nas políticas de evidência e nos pedidos de documento)
create or replace function public.org_is_paid(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizations o where o.id = p_org and o.plan <> 'express');
$$;
revoke execute on function public.org_is_paid(uuid) from public, anon;
grant execute on function public.org_is_paid(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1. Dados da empresa (o dono completa depois do diagnóstico; o CNPJ só muda por aqui)
-- ---------------------------------------------------------------------
create or replace function public.update_organization_profile(
  p_org uuid, p_name text, p_cnpj text, p_sector text, p_employees_range text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
begin
  if not public.has_role(p_org, array['owner']) then raise exception 'forbidden'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if v_cnpj is not null and v_cnpj !~ '^[0-9]{14}$' then raise exception 'invalid_cnpj'; end if;
  update public.organizations
     set name = trim(p_name), cnpj = v_cnpj,
         sector = nullif(trim(coalesce(p_sector, '')), ''),
         employees_range = nullif(trim(coalesce(p_employees_range, '')), '')
   where id = p_org;
  perform public.log_event(p_org, 'org.profile_update', p_org::text, '{}'::jsonb);
end $$;
revoke all on function public.update_organization_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_organization_profile(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Staff: ativar plano e resolver alerta (quem muda organizations.plan é a equipe, nunca o cliente)
-- ---------------------------------------------------------------------
create or replace function public.staff_set_plan(p_org uuid, p_plan text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_plan not in ('express', 'essencial', 'dossie', '360') then raise exception 'invalid_plan'; end if;
  update public.organizations set plan = p_plan where id = p_org;
  if not found then raise exception 'not_found'; end if;
  update public.alerts set resolved_at = now()
   where org_id = p_org and resolved_at is null and message like 'Pedido de proposta:%';
  perform public.log_event(p_org, 'plan.set', p_org::text, jsonb_build_object('plan', p_plan));
end $$;

create or replace function public.staff_resolve_alert(p_alert uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  update public.alerts set resolved_at = now() where id = p_alert and resolved_at is null returning org_id into v_org;
  if v_org is not null then
    perform public.log_event(v_org, 'alert.resolve', p_alert::text, '{}'::jsonb);
  end if;
end $$;

revoke all on function public.staff_set_plan(uuid, text) from public, anon;
revoke all on function public.staff_resolve_alert(uuid) from public, anon;
grant execute on function public.staff_set_plan(uuid, text) to authenticated;
grant execute on function public.staff_resolve_alert(uuid) to authenticated;

-- Novos tipos de job: 'evidencia' (o worker confere e registra o arquivo) e 'aviso' (e-mail para a equipe).
alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('scan_externo', 'processar', 'relatorio', 'mensal', 'evidencia', 'aviso'));

-- ---------------------------------------------------------------------
-- 3. SOS: abre o incidente e avisa a equipe (alerta crítico + e-mail pelo worker). Qualquer membro pode abrir,
--    até 3 por empresa por hora (evita uma enxurrada de alertas críticos).
-- ---------------------------------------------------------------------
create or replace function public.open_incident(p_org uuid, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.is_member(p_org) then raise exception 'forbidden'; end if;
  if (select count(*) from public.incidents where org_id = p_org and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited';
  end if;
  insert into public.incidents (org_id, opened_by, description)
  values (p_org, (select auth.uid()), trim(p_description))
  returning id into v_id;
  insert into public.alerts (org_id, severity, message)
  values (p_org, 'critico', 'SOS: incidente aberto pelo cliente (chamado ' || left(v_id::text, 8) || ')');
  -- o e-mail leva só o número do chamado; a descrição fica no /staff (pode ter dado sensível)
  insert into public.jobs (org_id, kind, payload)
  values (p_org, 'aviso', jsonb_build_object('tipo', 'sos', 'chamado', left(v_id::text, 8)));
  perform public.log_event(p_org, 'incident.open', v_id::text, '{}'::jsonb);
  return v_id;
end $$;
revoke all on function public.open_incident(uuid, text) from public, anon;
grant execute on function public.open_incident(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Evidência: registro de cada arquivo enviado. Só o worker (service role) grava a linha, depois de ler o
--    arquivo do bucket, conferir o tipo real e calcular o SHA-256. O cliente nunca informa o hash.
-- ---------------------------------------------------------------------
create table public.evidence (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  control_id   text not null references public.controls(id),
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 120),
  mime         text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes   int  not null check (size_bytes between 1 and 10485760),
  sha256       text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  uploaded_by  uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now()
);
create index on public.evidence (org_id, control_id);
alter table public.evidence enable row level security;

create policy ev_select on public.evidence for select to authenticated
  using (public.is_member(org_id) or public.is_staff());
-- Sem política de INSERT e sem grant: o cliente não grava a linha (nem com hash inventado).
revoke insert, update, delete on public.evidence from authenticated;

-- O cliente (dono/TI, plano pago) pede o registro de um arquivo que já subiu para a pasta {org}/{controle}/.
create or replace function public.request_evidence_registration(p_org uuid, p_control text, p_path text, p_file_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_org, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  if not public.org_is_paid(p_org) then raise exception 'plan_required'; end if;
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
revoke all on function public.request_evidence_registration(uuid, text, text, text) from public, anon;
grant execute on function public.request_evidence_registration(uuid, text, text, text) to authenticated;

-- Diagnóstico que deu erro: dono/TI pede de novo (volta para 'processando' e ganha um job novo).
create or replace function public.retry_assessment(p_assessment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select id, org_id, kind into a from public.assessments where id = p_assessment and status = 'erro';
  if a.id is null or not public.has_role(a.org_id, array['owner', 'ti']) then raise exception 'forbidden'; end if;
  update public.assessments set status = 'processando' where id = a.id;
  insert into public.jobs (org_id, assessment_id, kind, payload)
  values (a.org_id, a.id,
          case when a.kind = 'mensal' then 'mensal' else 'processar' end,
          case when a.kind = 'completo' then '{"completo": true}'::jsonb else '{}'::jsonb end);
  perform public.log_event(a.org_id, 'assessment.retry', a.id::text, '{}'::jsonb);
end $$;
revoke all on function public.retry_assessment(uuid) from public, anon;
grant execute on function public.retry_assessment(uuid) to authenticated;

-- O upload no Storage também passa a exigir plano pago.
drop policy storage_evidence_insert on storage.objects;
create policy storage_evidence_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (select 1 from public.memberships m
                where m.user_id = (select auth.uid())
                  and m.role in ('owner', 'ti')
                  and m.org_id::text = (storage.foldername(name))[1]
                  and public.org_is_paid(m.org_id))
  );

-- ---------------------------------------------------------------------
-- 5. Documentos: o dono pede, o worker gera (job 'relatorio') e grava em public.documents
-- ---------------------------------------------------------------------
create or replace function public.request_document(p_org uuid, p_kind text, p_params jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text := left(trim(coalesce(p_params ->> 'responsavel', '')), 120);
begin
  if not public.has_role(p_org, array['owner']) then raise exception 'forbidden'; end if;
  if not public.org_is_paid(p_org) then raise exception 'plan_required'; end if;
  if p_kind not in ('politica', 'plano_incidente', 'designacao') then raise exception 'invalid_kind'; end if;
  if p_kind = 'designacao' and char_length(v_name) < 3 then raise exception 'responsavel_required'; end if;
  -- um pedido em andamento por tipo de documento
  if exists (select 1 from public.jobs
             where org_id = p_org and kind = 'relatorio' and status in ('pendente', 'rodando')
               and payload ->> 'document' = p_kind) then
    return;
  end if;
  insert into public.jobs (org_id, kind, payload)
  values (p_org, 'relatorio', jsonb_build_object('document', p_kind, 'responsavel', v_name));
  perform public.log_event(p_org, 'document.request', p_kind, '{}'::jsonb);
end $$;
revoke all on function public.request_document(uuid, text, jsonb) from public, anon;
grant execute on function public.request_document(uuid, text, jsonb) to authenticated;
