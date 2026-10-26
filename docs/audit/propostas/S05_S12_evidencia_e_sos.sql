-- PROPOSTA (auditoria 2026-10-21) — NÃO É MIGRAÇÃO, NÃO APLICAR SEM O "OK" DO PEDRO.
-- Fica fora de supabase/migrations de propósito. Como 20261022000000_features.sql ainda NÃO foi aplicada no remoto,
-- o caminho mais limpo é incorporar estas mudanças nela antes de aplicar (ou criar uma migração nova com `supabase migration new`).

-- ---------------------------------------------------------------------
-- S05 — evidência: o cliente não grava mais a linha de `evidence` direto.
-- Hoje `ev_insert` deixa owner/ti inserir pelo PostgREST com sha256/mime/size_bytes que ele mesmo escolhe.
-- Depois: o navegador sobe o arquivo (como hoje) e pede o registro; o WORKER (service role) baixa, confere o tipo
-- real pelos bytes, calcula o SHA-256 e grava a linha. O hash passa a ser sempre do servidor.
-- ---------------------------------------------------------------------
drop policy if exists ev_insert on public.evidence;
revoke insert on public.evidence from authenticated;

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('scan_externo','processar','relatorio','mensal','evidencia'));

create or replace function public.request_evidence_registration(p_org uuid, p_control text, p_path text, p_file_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_org, array['owner','ti']) then raise exception 'forbidden'; end if;
  if not public.org_is_paid(p_org) then raise exception 'plan_required'; end if;
  if p_control !~ '^C[0-9]{2}$' or p_path not like p_org::text || '/' || p_control || '/%' or p_path like '%..%' then
    raise exception 'invalid_path';
  end if;
  insert into public.jobs (org_id, kind, payload)
  values (p_org, 'evidencia', jsonb_build_object('path', p_path, 'control', p_control,
          'file_name', left(trim(p_file_name), 120), 'uploaded_by', (select auth.uid())));
  perform public.log_event(p_org, 'evidence.request', p_path, '{}'::jsonb);
end $$;
revoke all on function public.request_evidence_registration(uuid, text, text, text) from public, anon;
grant execute on function public.request_evidence_registration(uuid, text, text, text) to authenticated;
-- Código que acompanha (não feito nesta auditoria): job 'evidencia' no worker (download do bucket, detect_mime, sha256,
-- insert com service role) e a server action registerEvidence chamando esta RPC em vez do insert.

-- ---------------------------------------------------------------------
-- S12 — SOS: no máximo 3 chamados por empresa por hora (evita spam de alerta crítico para a equipe).
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
  perform public.log_event(p_org, 'incident.open', v_id::text, '{}'::jsonb);
  return v_id;
end $$;
