-- Testes do programa de corretores (migração 20261026000000_partners.sql). Roda depois do 02_features_test.sql, no mesmo banco.
-- Cada linha imprime "ok: ..." ou "FAIL: ..."; o run_local.sh falha se aparecer FAIL.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000d','corretor@seguros.com.br'),
 ('00000000-0000-0000-0000-00000000000e','cliente-e@empresa-e.com.br'),
 ('00000000-0000-0000-0000-00000000000f','cliente-f@empresa-f.com.br'),
 ('00000000-0000-0000-0000-000000000010','anonimo@x.com'),
 ('00000000-0000-0000-0000-000000000011','outro-corretor@seguros.com.br');

-- ===== Cadastro do corretor
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","is_anonymous":false}';
select public.t_fails('P01 nome curto demais', $q$select public.register_partner('A','corretor','')$q$);
select public.t_fails('P02 tipo inválido', $q$select public.register_partner('Corretora Dois','banco','')$q$);
select public.t_fails('P03 SUSEP com letras', $q$select public.register_partner('Corretora Dois','corretor','abc<script>')$q$);
select public.register_partner('Corretora Dois','corretor','1234567890') as code_d \gset
select public.t_eq('P04 código gerado é válido e único', (:'code_d' ~ '^[a-z0-9-]{3,40}$')::text, 'true');
select public.t_fails('P05 mesmo usuário não cria 2ª corretora', $q$select public.register_partner('Outra','corretor','')$q$);
select public.t_eq('P06 corretor enxerga só o próprio vínculo', (select count(*)::text from public.partner_members), '1');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000010","is_anonymous":true}';
select public.t_fails('P07 sessão anônima não vira corretor', $q$select public.register_partner('Corretora Anonima','corretor','')$q$);
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000011","is_anonymous":false}';
select public.register_partner('Corretora Tres','msp','') as code_h \gset
reset role;

-- ===== Nome do corretor para a tela de consentimento (sem login)
set role anon;
select public.t_eq('P08 anônimo lê só o nome pelo código', public.partner_name_by_code(:'code_d'), 'Corretora Dois');
select public.t_eq('P09 código inexistente devolve nulo', public.partner_name_by_code('nao-existe-xyz'), null);
select public.t_fails('P10 anônimo não vê o painel do corretor', $q$select public.partner_overview()$q$);
reset role;

-- ===== Clientes indicados
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","is_anonymous":true}';
select public.create_organization('empresa-e.com.br','','empresa-e.com.br',null,null,:'code_d','1.0') as org_e \gset
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","is_anonymous":false}';
select public.create_organization('empresa-f.com.br','','empresa-f.com.br',null,null,'','1.0') as org_f \gset
reset role;
select public.t_eq('P11 empresa ficou ligada ao corretor', (select (partner_id is not null)::text from public.organizations where id = :'org_e'), 'true');

-- sem consentimento: o corretor vê só o domínio e a etapa
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","is_anonymous":false}';
select public.t_eq('P12 painel lista 1 cliente', (select jsonb_array_length(public.partner_overview() -> 'clients')::text), '1');
select public.t_eq('P13 sem autorização: não compartilhado', (select (public.partner_overview() -> 'clients' -> 0 ->> 'shared')), 'false');
select public.t_eq('P14 sem autorização: nota não aparece', (select (public.partner_overview() -> 'clients' -> 0 -> 'score')::text), null);
select public.t_fails('P15 sem autorização: detalhe bloqueado', format($q$select public.partner_client_detail(%L)$q$, :'org_e'));
select public.t_eq('P16 corretor não lê a tabela da empresa', (select count(*)::text from public.organizations where id = :'org_e'), '0');
select public.t_eq('P17 corretor não lê as autorizações', (select count(*)::text from public.partner_shares), '0');
reset role;

-- cliente autoriza (só quem é dono da empresa, e só se houver corretor)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","is_anonymous":false}';
select public.t_fails('P18 empresa sem corretor não compartilha', format($q$select public.grant_partner_share(%L)$q$, :'org_f'));
select public.t_fails('P19 F não autoriza em nome da E', format($q$select public.grant_partner_share(%L)$q$, :'org_e'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","is_anonymous":true}';
select public.t_eq('P20 cliente vê o nome do corretor e que não compartilhou', (public.org_partner_status(:'org_e') ->> 'name') || ':' || (public.org_partner_status(:'org_e') ->> 'shared'), 'Corretora Dois:false');
select public.t_passes('P21 cliente autoriza o compartilhamento', format($q$select public.grant_partner_share(%L)$q$, :'org_e'));
select public.t_passes('P22 autorizar de novo não duplica nem erra', format($q$select public.grant_partner_share(%L)$q$, :'org_e'));
reset role;
select public.t_eq('P23 uma autorização ativa', (select count(*)::text from public.partner_shares where org_id = :'org_e' and revoked_at is null), '1');

-- dados de exemplo (como o worker gravaria)
update public.assessments set status = 'concluido', score = 72, external_score = 80, completed_at = now() where org_id = :'org_e' and kind = 'express';
insert into public.control_results(assessment_id, control_id, status, source)
  select id, 'C03', 'atende', 'questionario' from public.assessments where org_id = :'org_e' and kind = 'express';
insert into public.control_results(assessment_id, control_id, status, source)
  select id, 'C06', 'nao_atende', 'questionario' from public.assessments where org_id = :'org_e' and kind = 'express';
insert into public.evidence(org_id,control_id,storage_path,file_name,mime,size_bytes,sha256,uploaded_by)
  values (:'org_e','C03',:'org_e'||'/C03/mfa.png','mfa.png','image/png',100,repeat('a',64),'00000000-0000-0000-0000-00000000000e');

-- com consentimento: o corretor vê o diagnóstico e as provas (só metadados)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","is_anonymous":false}';
select public.t_eq('P24 com autorização: compartilhado', (select (public.partner_overview() -> 'clients' -> 0 ->> 'shared')), 'true');
select public.t_eq('P25 nota aparece', (select (public.partner_overview() -> 'clients' -> 0 ->> 'score')), '72');
select public.t_eq('P26 detalhe traz status do controle', (select public.partner_client_detail(:'org_e') -> 'controls' ->> 'C03'), 'atende');
select public.t_eq('P27 detalhe traz o controle com lacuna', (select public.partner_client_detail(:'org_e') -> 'controls' ->> 'C06'), 'nao_atende');
select public.t_eq('P28 detalhe lista a evidência (nome, hash curto)', (select (public.partner_client_detail(:'org_e') -> 'evidence' -> 0 ->> 'file_name') || ':' || (public.partner_client_detail(:'org_e') -> 'evidence' -> 0 ->> 'control_id')), 'mfa.png:C03');
select public.t_eq('P29 detalhe NÃO traz CNPJ nem e-mail', (select (public.partner_client_detail(:'org_e') ? 'cnpj' or public.partner_client_detail(:'org_e') ? 'email')::text), 'false');
reset role;

-- outro corretor e outros usuários continuam sem acesso
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000011","is_anonymous":false}';
select public.t_fails('P30 outro corretor não vê cliente alheio', format($q$select public.partner_client_detail(%L)$q$, :'org_e'));
select public.t_eq('P31 outro corretor tem painel vazio', (select jsonb_array_length(public.partner_overview() -> 'clients')::text), '0');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","is_anonymous":false}';
select public.t_fails('P32 quem não é corretor não abre o painel', $q$select public.partner_overview()$q$);
select public.t_fails('P33 F não vê o status de parceria da E', format($q$select public.org_partner_status(%L)$q$, :'org_e'));
reset role;

-- cliente revoga: o corretor perde o acesso na hora
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","is_anonymous":true}';
select public.t_passes('P34 cliente revoga', format($q$select public.revoke_partner_share(%L)$q$, :'org_e'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","is_anonymous":false}';
select public.t_fails('P35 depois de revogar, detalhe bloqueado', format($q$select public.partner_client_detail(%L)$q$, :'org_e'));
select public.t_eq('P36 depois de revogar, nota some da lista', (select (public.partner_overview() -> 'clients' -> 0 -> 'score')::text), null);
reset role;
select public.t_eq('P37 aceite e revogação ficam na auditoria', (select count(*)::text from public.audit_log where action in ('partner_share.grant','partner_share.revoke') and org_id = :'org_e'), '3');

-- ===== Evidência para cliente indicado por corretor (mesmo no plano grátis)
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","is_anonymous":true}';
select public.t_passes('P38 cliente indicado envia evidência no plano grátis', format($q$insert into storage.objects(bucket_id,name) values ('evidence', %L||'/C06/backup.png')$q$, :'org_e'));
select public.t_passes('P39 e pede o registro', format($q$select public.request_evidence_registration(%L,'C06',%L||'/C06/backup.png','backup.png')$q$, :'org_e', :'org_e'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000f","is_anonymous":false}';
select public.t_fails('P40 cliente sem corretor e sem plano continua bloqueado', format($q$insert into storage.objects(bucket_id,name) values ('evidence', %L||'/C06/backup.png')$q$, :'org_f'));
select public.t_fails('P41 idem no registro', format($q$select public.request_evidence_registration(%L,'C06',%L||'/C06/backup.png','backup.png')$q$, :'org_f', :'org_f'));
reset role;

-- ===== Equipe desativa uma corretora
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","is_anonymous":false}';
select public.t_fails('P42 corretor não ativa/desativa corretora', format($q$select public.staff_set_partner_active((select id from public.partners where code = %L), false)$q$, :'code_d'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","is_anonymous":false}';
select public.t_passes('P43 staff desativa a corretora', format($q$select public.staff_set_partner_active((select id from public.partners where code = %L), false)$q$, :'code_d'));
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","is_anonymous":false}';
select public.t_fails('P44 corretora desativada perde o painel', $q$select public.partner_overview()$q$);
reset role;
set role anon;
select public.t_eq('P45 corretora desativada não aparece no link', public.partner_name_by_code(:'code_d'), null);
select public.t_fails('P46 anon sem grant_partner_share', format($q$select public.grant_partner_share(%L)$q$, :'org_e'));
select public.t_fails('P47 anon sem register_partner', $q$select public.register_partner('Anon Corretora','corretor','')$q$);
reset role;
