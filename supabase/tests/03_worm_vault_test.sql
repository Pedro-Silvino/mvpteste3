-- Testes do cofre WORM e do TPRM (migração 20261030000000_cat_tprm_core.sql). Roda depois do 03_partners_test.sql, no mesmo banco.
-- Cada linha imprime "ok: ..." ou "FAIL: ..."; o run_local.sh falha se aparecer FAIL.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000021','dono-pro@empresa-p.com.br'),
 ('00000000-0000-0000-0000-000000000022','dono-scale@empresa-s.com.br'),
 ('00000000-0000-0000-0000-000000000023','viewer-pro@empresa-p.com.br'),
 ('00000000-0000-0000-0000-000000000024','staff-w@datadops.com.br');
insert into public.profiles(id, is_staff) values ('00000000-0000-0000-0000-000000000024', true)
  on conflict (id) do update set is_staff = true;

insert into public.organizations(id, name, plan, created_by) values
 ('11111111-1111-1111-1111-111111111111', 'Empresa Pro', 'pro', '00000000-0000-0000-0000-000000000021'),
 ('22222222-2222-2222-2222-222222222222', 'Empresa Scale', 'scale', '00000000-0000-0000-0000-000000000022'),
 ('33333333-3333-3333-3333-333333333333', 'Empresa Core', 'core', '00000000-0000-0000-0000-000000000021');
insert into public.memberships(org_id, user_id, role) values
 ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000021', 'owner'),
 ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000023', 'viewer'),
 ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000022', 'owner'),
 ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000021', 'owner');

-- ===== Tiers
select public.t_passes('W01 plano core aceito', $q$update public.organizations set plan = 'core' where id = '33333333-3333-3333-3333-333333333333'$q$);
select public.t_fails('W02 plano inventado recusado', $q$update public.organizations set plan = 'ouro' where id = '33333333-3333-3333-3333-333333333333'$q$);
select public.t_passes('W03 plano legado ainda aceito', $q$update public.organizations set plan = 'express' where id = '33333333-3333-3333-3333-333333333333'$q$);
update public.organizations set plan = 'core' where id = '33333333-3333-3333-3333-333333333333';

-- ===== Cofre: registro
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000021","is_anonymous":false}';
select public.vault_register('11111111-1111-1111-1111-111111111111', 'Política de backup 2026', 'backup',
  '11111111-1111-1111-1111-111111111111/backup/politica.pdf',
  'a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6', '{"versao":"1.0"}'::jsonb) as vid \gset
select public.t_eq('W04 dono do plano pro registra evidência', (:'vid' ~ '^[0-9a-f-]{36}$')::text, 'true');
select public.t_fails('W05 hash inválido recusado', $q$select public.vault_register('11111111-1111-1111-1111-111111111111','Doc','backup','11111111-1111-1111-1111-111111111111/a.pdf','zzz','{}'::jsonb)$q$);
select public.t_fails('W06 caminho de outra empresa recusado', $q$select public.vault_register('11111111-1111-1111-1111-111111111111','Doc','backup','22222222-2222-2222-2222-222222222222/a.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6','{}'::jsonb)$q$);
select public.t_fails('W07 caminho com ".." recusado', $q$select public.vault_register('11111111-1111-1111-1111-111111111111','Doc','backup','11111111-1111-1111-1111-111111111111/../x.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6','{}'::jsonb)$q$);
select public.t_fails('W08 categoria inválida recusada', $q$select public.vault_register('11111111-1111-1111-1111-111111111111','Doc','xpto','11111111-1111-1111-1111-111111111111/a.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6','{}'::jsonb)$q$);
select public.t_fails('W09 empresa de outra conta recusada', $q$select public.vault_register('22222222-2222-2222-2222-222222222222','Doc','backup','22222222-2222-2222-2222-222222222222/a.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6','{}'::jsonb)$q$);
select public.t_fails('W10 plano core não tem cofre', $q$select public.vault_register('33333333-3333-3333-3333-333333333333','Doc','backup','33333333-3333-3333-3333-333333333333/a.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6','{}'::jsonb)$q$);
select public.t_fails('W11 insert direto negado ao cliente', $q$insert into public.evidence_vault(organization_id,title,category,file_path,file_hash_sha256) values ('11111111-1111-1111-1111-111111111111','Doc','backup','11111111-1111-1111-1111-111111111111/a.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6')$q$);
select public.t_eq('W12 dono lê a própria evidência', (select count(*)::text from public.evidence_vault), '1');

-- ===== Cofre: imutabilidade (mesmo com política que permitisse, o gatilho barra)
select public.t_fails('W13 UPDATE barrado pelo cliente', format($q$update public.evidence_vault set title = 'Alterado' where id = %L$q$, :'vid'));
select public.t_fails('W14 DELETE barrado pelo cliente', format($q$delete from public.evidence_vault where id = %L$q$, :'vid'));
reset role;
select public.t_fails('W15 UPDATE barrado até para o dono do banco', format($q$update public.evidence_vault set file_hash_sha256 = repeat('0',64) where id = %L$q$, :'vid'));
select public.t_fails('W16 DELETE barrado até para o dono do banco', format($q$delete from public.evidence_vault where id = %L$q$, :'vid'));
select public.t_fails('W17 TRUNCATE barrado', $q$truncate public.evidence_vault$q$);
select public.t_fails('W18 apagar a empresa com evidência é barrado', $q$delete from public.organizations where id = '11111111-1111-1111-1111-111111111111'$q$);
select public.t_eq('W19 hash segue intacto', (select file_hash_sha256 from public.evidence_vault where id = :'vid'), 'a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6');
select public.t_eq('W20 registro foi para o audit_log', (select count(*)::text from public.audit_log where action = 'vault.register'), '1');

-- ===== Cofre: isolamento
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000022","is_anonymous":false}';
select public.t_eq('W21 outra empresa não vê a evidência', (select count(*)::text from public.evidence_vault), '0');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000023';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000023","is_anonymous":false}';
select public.t_eq('W22 viewer da mesma empresa lê', (select count(*)::text from public.evidence_vault), '1');
select public.t_fails('W23 viewer não registra', $q$select public.vault_register('11111111-1111-1111-1111-111111111111','Doc','backup','11111111-1111-1111-1111-111111111111/b.pdf','a3f5c1d2e4b6a7980b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6','{}'::jsonb)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000024';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000024","is_anonymous":false}';
select public.t_eq('W24 staff lê o cofre', (select count(*)::text from public.evidence_vault), '1');
reset role;
set role anon;
select public.t_fails('W25 anônimo não lê o cofre', $q$select * from public.evidence_vault$q$);
reset role;

-- ===== TPRM: fornecedores e convite
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000022","is_anonymous":false}';
select public.add_vendor('22222222-2222-2222-2222-222222222222', 'Contabilidade Alfa', 'alfa.com.br', 'alta') as vend \gset
select public.t_eq('W26 plano scale cadastra fornecedor', (:'vend' ~ '^[0-9a-f-]{36}$')::text, 'true');
select public.t_fails('W27 fornecedor duplicado recusado', $q$select public.add_vendor('22222222-2222-2222-2222-222222222222','Alfa 2','alfa.com.br','baixa')$q$);
select public.t_fails('W28 domínio inválido recusado', $q$select public.add_vendor('22222222-2222-2222-2222-222222222222','Beta','nao e dominio','baixa')$q$);
select public.t_fails('W29 criticidade inválida recusada', $q$select public.add_vendor('22222222-2222-2222-2222-222222222222','Beta','beta.com.br','extrema')$q$);
select public.create_vendor_assessment(:'vend') as tok \gset
select public.t_eq('W30 token no formato vnd_ + 64 hex', (:'tok' ~ '^vnd_[a-f0-9]{64}$')::text, 'true');
select public.t_fails('W32 cliente não lê token_hash', $q$select token_hash from public.vendor_assessments$q$);
select public.t_fails('W33 cliente não grava prova direto', format($q$insert into public.vendor_evidence_links(assessment_id,organization_id,control_id,file_name,file_path,file_hash_sha256) select id, organization_id, 'C01', 'a.pdf', organization_id::text || '/vendors/a.pdf', repeat('a',64) from public.vendor_assessments where vendor_id = %L$q$, :'vend'));
reset role;
select public.t_eq('W31 só o hash fica no banco', (select count(*)::text from public.vendor_assessments where token_hash = encode(extensions.digest(:'tok','sha256'),'hex')), '1');
reset role;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000021","is_anonymous":false}';
select public.t_fails('W34 plano pro não tem TPRM', $q$select public.add_vendor('11111111-1111-1111-1111-111111111111','Gama','gama.com.br','baixa')$q$);
select public.t_eq('W35 outra empresa não vê fornecedores', (select count(*)::text from public.vendor_organizations), '0');
select public.t_fails('W36 outra empresa não gera convite', format($q$select public.create_vendor_assessment(%L)$q$, :'vend'));
reset role;

-- ===== TPRM: portal do fornecedor (anônimo, só com token)
set role anon;
select public.t_eq('W37 token válido abre a avaliação', (public.vendor_get_assessment(:'tok') ->> 'vendor_name'), 'Contabilidade Alfa');
select public.t_eq('W38 token errado não abre', coalesce(public.vendor_get_assessment('vnd_' || repeat('0',64))::text, 'null'), 'null');
select public.t_eq('W39 formato inválido não abre', coalesce(public.vendor_get_assessment('x')::text, 'null'), 'null');
select public.t_fails('W40 anônimo não lê a tabela', $q$select * from public.vendor_assessments$q$);
select public.t_fails('W41 resposta com valor inválido recusada', format($q$select public.vendor_submit_assessment(%L, '{"C01":"talvez"}'::jsonb)$q$, :'tok'));
select public.t_fails('W42 resposta com controle inválido recusada', format($q$select public.vendor_submit_assessment(%L, '{"X99":"sim"}'::jsonb)$q$, :'tok'));
select public.t_passes('W43 envio válido', format($q$select public.vendor_submit_assessment(%L, '{"C01":"sim","C02":"parcial","C03":"nao"}'::jsonb)$q$, :'tok'));
select public.t_fails('W44 token não serve duas vezes', format($q$select public.vendor_submit_assessment(%L, '{"C01":"nao"}'::jsonb)$q$, :'tok'));
reset role;
select public.t_eq('W45 avaliação ficou enviada', (select status from public.vendor_assessments where vendor_id = :'vend' and revoked_at is null), 'enviada');
select public.t_eq('W46 envio foi para o audit_log', (select count(*)::text from public.audit_log where action = 'vendor.submit'), '1');

-- ===== TPRM: novo convite revoga o anterior; token expirado e revogado não abrem
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000022","is_anonymous":false}';
select public.create_vendor_assessment(:'vend') as tok2 \gset
reset role;
update public.vendor_assessments set token_expires_at = now() - interval '1 day' where token_hash = encode(extensions.digest(:'tok2','sha256'),'hex');
set role anon;
select public.t_eq('W47 token expirado não abre', coalesce(public.vendor_get_assessment(:'tok2')::text, 'null'), 'null');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000022","is_anonymous":false}';
select public.create_vendor_assessment(:'vend') as tok3 \gset
reset role;
select id as aid from public.vendor_assessments where token_hash = encode(extensions.digest(:'tok3','sha256'),'hex') \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000022","is_anonymous":false}';
select public.revoke_vendor_assessment(:'aid');
reset role;
set role anon;
select public.t_eq('W48 token revogado não abre', coalesce(public.vendor_get_assessment(:'tok3')::text, 'null'), 'null');
reset role;
