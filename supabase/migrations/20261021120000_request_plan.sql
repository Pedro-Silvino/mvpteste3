-- Escolha de plano no painel. O cliente PEDE um plano pago (essencial, dossie ou 360); a equipe DataDops ativa
-- depois (organizations.plan só muda por staff/SQL, o cliente não tem UPDATE nessa coluna).
-- Vira um alerta para a equipe (staff lê em public.alerts) + linha em audit_log.
-- Só dono, só conta permanente (sessão anônima não vale: a equipe precisa de um e-mail para responder),
-- e um único pedido aberto por empresa: pedir de novo troca o plano do pedido aberto.
create or replace function public.request_plan(p_org uuid, p_plan text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_msg text;
begin
  if coalesce((select auth.jwt() ->> 'is_anonymous'), 'false')::boolean then
    raise exception 'account_required';
  end if;
  if not public.has_role(p_org, array['owner']) then
    raise exception 'forbidden';
  end if;
  if p_plan is null or p_plan not in ('essencial', 'dossie', '360') then
    raise exception 'invalid_plan';
  end if;

  v_msg := 'Pedido de proposta: plano ' || p_plan;
  update public.alerts set message = v_msg
  where org_id = p_org and resolved_at is null and message like 'Pedido de proposta:%';
  if not found then
    insert into public.alerts (org_id, severity, message) values (p_org, 'info', v_msg);
  end if;
  perform public.log_event(p_org, 'plan.request', p_org::text, jsonb_build_object('plan', p_plan));
end $$;

revoke all on function public.request_plan(uuid, text) from public, anon;
grant execute on function public.request_plan(uuid, text) to authenticated;
