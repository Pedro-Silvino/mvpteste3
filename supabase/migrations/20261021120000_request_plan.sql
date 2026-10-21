-- Pedido de proposta depois do diagnóstico: o dono da empresa pede para receber os tutoriais e
-- contratar. Vira um alerta para a equipe DataDops (staff lê em public.alerts) + linha em audit_log.
-- Só dono, só conta permanente (sessão anônima não vale: a equipe precisa de um e-mail para responder),
-- e um único pedido aberto por empresa.
create or replace function public.request_plan(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false')::boolean then
    raise exception 'account_required';
  end if;
  if not public.has_role(p_org, array['owner']) then
    raise exception 'forbidden';
  end if;
  if exists (
    select 1 from public.alerts
    where org_id = p_org and resolved_at is null and message like 'Pedido de proposta:%'
  ) then
    return;
  end if;
  insert into public.alerts (org_id, severity, message)
  values (p_org, 'info', 'Pedido de proposta: o cliente quer receber os tutoriais e contratar o Sentinela.');
  perform public.log_event(p_org, 'plan.request', p_org::text, '{}'::jsonb);
end $$;

revoke all on function public.request_plan(uuid) from public, anon;
grant execute on function public.request_plan(uuid) to authenticated;
