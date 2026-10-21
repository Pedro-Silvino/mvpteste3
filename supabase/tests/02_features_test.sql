-- Testes das funcionalidades do painel (migração 20261022000000_features.sql). Roda depois do 01_rls_test.sql,
-- no mesmo banco. Cada linha imprime "ok: ..." ou "FAIL: ..."; o run_local.sh falha se aparecer FAIL.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

create or replace function public.t_fails(label text, stmt text) returns text language plpgsql as $$
begin execute stmt; return 'FAIL: deveria dar erro: ' || label;
exception when others then return 'ok: ' || label; end $$;
create or replace function public.t_passes(label text, stmt text) returns text language plpgsql as $$
begin execute stmt; return 'ok: ' || label;
exception when others then return 'FAIL: ' || label || ' -> ' || sqlerrm; end $$;
create or replace function public.t_eq(label text, got text, want text) returns text language sql as $$
  select case when got is not distinct from want then 'ok: ' || label else 'FAIL: ' || label || ' (veio ' || coalesce(got, 'null') || ', esperado ' || want || ')' end $$;

select id as org_a from public.organizations order by created_at limit 1 \gset
\set ua '00000000-0000-0000-0000-00000000000a'
\set ub '00000000-0000-0000-0000-00000000000b'
\set us '00000000-0000-0000-0000-00000000000c'

-- ===== A (dono, plano grátis, conta permanente)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}';

select public.t_passes('T17 dono completa os dados da empresa', format($q$select public.update_organization_profile(%L,'Empresa A Ltda','12.345.678/0001-90','servicos','11-50')$q$, :'org_a'));
select public.t_eq('T18 CNPJ gravado só com dígitos', (select cnpj from public.organizations where id = :'org_a'), '12345678000190');
select public.t_fails('T19 CNPJ com tamanho errado', format($q$select public.update_organization_profile(%L,'Empresa A','123','servicos','11-50')$q$, :'org_a'));
select public.t_fails('T20 nome curto demais', format($q$select public.update_organization_profile(%L,'A',null,null,null)$q$, :'org_a'));
select public.t_fails('T21 faixa de funcionários inválida', format($q$select public.update_organization_profile(%L,'Empresa A',null,null,'9999')$q$, :'org_a'));
select public.t_fails('T22 cliente não muda o próprio CNPJ direto', format($q$update public.organizations set cnpj='11111111111111' where id=%L$q$, :'org_a'));

select public.t_passes('T23 pedido de plano (conta permanente)', format($q$select public.request_plan(%L,'essencial')$q$, :'org_a'));
select public.t_eq('T24 um pedido aberto, plano atualizado', (select count(*)::text from public.alerts where message like 'Pedido de proposta:%'), '1');
select public.t_passes('T25 pedir outro plano troca o pedido aberto', format($q$select public.request_plan(%L,'dossie')$q$, :'org_a'));
select public.t_eq('T26 continua um pedido, agora dossie', (select count(*)::text || ':' || max(message) from public.alerts where message like 'Pedido de proposta:%'), '1:Pedido de proposta: plano dossie');
select public.t_fails('T27 plano inválido', format($q$select public.request_plan(%L,'gratis')$q$, :'org_a'));
select public.t_fails('T28 cliente não ativa o próprio plano', format($q$select public.staff_set_plan(%L,'360')$q$, :'org_a'));
select public.t_fails('T29 cliente não resolve alerta', format($q$select public.staff_resolve_alert(%L)$q$, (select id from public.alerts limit 1)));

-- plano grátis: sem evidência e sem pedido de documento
select public.t_fails('T30 evidência bloqueada no plano grátis', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06',%L||'/e1.png','e1.png','image/png',10,repeat('a',64))$q$, :'org_a', :'org_a'));
select public.t_fails('T31 upload no Storage bloqueado no plano grátis', format($q$insert into storage.objects(bucket_id,name) values ('evidence', %L||'/livre.png')$q$, :'org_a'));
select public.t_fails('T32 documento bloqueado no plano grátis', format($q$select public.request_document(%L,'politica','{}'::jsonb)$q$, :'org_a'));

-- SOS: qualquer membro abre
select public.t_passes('T33 SOS abre incidente', format($q$select public.open_incident(%L,'Computador do financeiro com tela de resgate')$q$, :'org_a'));
select public.t_fails('T34 SOS com descrição curta', format($q$select public.open_incident(%L,'oi')$q$, :'org_a'));
reset role;
select public.t_eq('T35 SOS gerou alerta crítico', (select count(*)::text from public.alerts where severity = 'critico' and message like 'SOS:%'), '1');

-- ===== A com sessão anônima
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":true}';
select public.t_fails('T36 sessão anônima não pede plano', format($q$select public.request_plan(%L,'essencial')$q$, :'org_a'));
reset role;

-- ===== B (outra empresa) não mexe em nada da A
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","is_anonymous":false}';
select public.t_fails('T37 B não edita dados da A', format($q$select public.update_organization_profile(%L,'Invadida',null,null,null)$q$, :'org_a'));
select public.t_fails('T38 B não pede plano pela A', format($q$select public.request_plan(%L,'360')$q$, :'org_a'));
select public.t_fails('T39 B não abre SOS na A', format($q$select public.open_incident(%L,'tentativa de invasão')$q$, :'org_a'));
select public.t_eq('T40 B não vê alertas da A', (select count(*)::text from public.alerts), '0');
select public.t_eq('T41 B não vê evidência', (select count(*)::text from public.evidence), '0');
reset role;

-- ===== Staff ativa o plano
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","is_anonymous":false}';
select public.t_fails('T42 staff com plano inválido', format($q$select public.staff_set_plan(%L,'ouro')$q$, :'org_a'));
select public.t_passes('T43 staff ativa o plano', format($q$select public.staff_set_plan(%L,'essencial')$q$, :'org_a'));
select public.t_eq('T44 plano mudou', (select plan from public.organizations where id = :'org_a'), 'essencial');
select public.t_eq('T45 pedido de proposta foi resolvido', (select count(*)::text from public.alerts where message like 'Pedido de proposta:%' and resolved_at is null), '0');
select public.t_passes('T46 staff resolve o alerta de SOS', format($q$select public.staff_resolve_alert(%L)$q$, (select id from public.alerts where severity = 'critico' limit 1)));
reset role;

-- ===== A em plano pago
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","is_anonymous":false}';
select public.t_passes('T47 upload no Storage liberado no plano pago', format($q$insert into storage.objects(bucket_id,name) values ('evidence', %L||'/backup.png')$q$, :'org_a'));
select public.t_passes('T48 registro de evidência', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06',%L||'/backup.png','backup.png','image/png',2048,repeat('b',64))$q$, :'org_a', :'org_a'));
select public.t_fails('T49 evidência apontando para pasta de outra empresa', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06','00000000-0000-0000-0000-0000000000ff/x.png','x.png','image/png',10,repeat('c',64))$q$, :'org_a'));
select public.t_fails('T50 tipo de arquivo não permitido', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06',%L||'/x.exe','x.exe','application/x-msdownload',10,repeat('d',64))$q$, :'org_a', :'org_a'));
select public.t_fails('T51 arquivo maior que 10 MB', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06',%L||'/g.pdf','g.pdf','application/pdf',10485761,repeat('e',64))$q$, :'org_a', :'org_a'));
select public.t_fails('T52 hash inválido', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06',%L||'/h.pdf','h.pdf','application/pdf',10,'xyz')$q$, :'org_a', :'org_a'));
select public.t_passes('T53 delete sem política não dá erro, só apaga 0 linhas', 'delete from public.evidence');
select public.t_eq('T54 evidência continua lá', (select count(*)::text from public.evidence), '1');

select public.t_passes('T55 pedido de política', format($q$select public.request_document(%L,'politica','{}'::jsonb)$q$, :'org_a'));
select public.t_passes('T56 pedido repetido não duplica', format($q$select public.request_document(%L,'politica','{}'::jsonb)$q$, :'org_a'));
select public.t_eq('T57 um job de política', (select count(*)::text from public.jobs where kind = 'relatorio' and payload ->> 'document' = 'politica'), '1');
select public.t_fails('T58 designação exige o nome do responsável', format($q$select public.request_document(%L,'designacao','{}'::jsonb)$q$, :'org_a'));
select public.t_passes('T59 designação com responsável', format($q$select public.request_document(%L,'designacao','{"responsavel":"Maria Souza"}'::jsonb)$q$, :'org_a'));
select public.t_fails('T60 tipo de documento inválido', format($q$select public.request_document(%L,'contrato','{}'::jsonb)$q$, :'org_a'));
reset role;

-- ===== B continua sem acesso
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","is_anonymous":false}';
select public.t_fails('T61 B não pede documento da A', format($q$select public.request_document(%L,'politica','{}'::jsonb)$q$, :'org_a'));
select public.t_fails('T62 B não registra evidência na A', format($q$insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256) values (%L,'C06',%L||'/b.png','b.png','image/png',10,repeat('f',64))$q$, :'org_a', :'org_a'));
reset role;

-- ===== Anônimo (role anon) não chama nenhuma função nova
set role anon;
select public.t_fails('T63 anon sem update_organization_profile', format($q$select public.update_organization_profile(%L,'x',null,null,null)$q$, :'org_a'));
select public.t_fails('T64 anon sem staff_set_plan', format($q$select public.staff_set_plan(%L,'360')$q$, :'org_a'));
select public.t_fails('T65 anon sem open_incident', format($q$select public.open_incident(%L,'tentativa anonima')$q$, :'org_a'));
select public.t_fails('T66 anon sem request_document', format($q$select public.request_document(%L,'politica','{}'::jsonb)$q$, :'org_a'));
reset role;
