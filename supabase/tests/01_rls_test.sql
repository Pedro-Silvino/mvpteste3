-- Teste de RLS. Linhas marcadas "deve FALHAR" precisam dar erro. Todas as linhas T1..T16 têm resultado esperado no nome.
-- T8, T9, T10, T11, T16 devem ser 0. Rodar após qualquer migração que mexa em permissões.
\set ON_ERROR_STOP 0
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','a@x.com'),
 ('00000000-0000-0000-0000-00000000000b','b@y.com'),
 ('00000000-0000-0000-0000-00000000000c','staff@datadops.com.br');
update public.profiles set is_staff = true where id='00000000-0000-0000-0000-00000000000c';
insert into public.partners(code,name,kind) values ('sincor-bh','Sincor BH','entidade');

-- ===== Usuário A cria empresa
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.create_organization('Empresa A','12.345.678/0001-90','https://www.EmpresaA.com.br/contato','servicos','11-50','SINCOR-BH','1.0') as org_a \gset
select 'T1 dominio normalizado' t, domain, (partner_id is not null) parceiro from public.organizations;
select 'T2 aceites' t, count(*) from public.authorizations;
select 'T3 job scan externo' t, kind, status from public.jobs;
select id as asmt from public.assessments \gset
insert into public.answers(assessment_id,question_id,value) values (:'asmt','C03','sim'),(:'asmt','C06','nao_sei');
select 'T4 respostas' t, count(*) from public.answers;
update public.organizations set plan='360';                                 -- deve FALHAR
update public.organizations set name='Empresa A Ltda';
select 'T5 nome ok / plano intacto' t, name, plan from public.organizations;
update public.assessments set score=100;                                    -- deve FALHAR
select public.create_agent_token(:'org_a','notebook-ti') ~ '^snt_[a-f0-9]{64}$' as "T6 token formato";
select token_hash from public.agent_tokens;                                 -- deve FALHAR
select 'T7 metadados token' t, label from public.agent_tokens;
select public.submit_assessment(:'asmt');
insert into public.answers(assessment_id,question_id,value) values (:'asmt','C01','sim');  -- deve FALHAR (não é mais rascunho)
select public.staff_review_control(:'asmt','C03','atende','x');             -- deve FALHAR (não é staff)
reset role;

-- ===== Usuário B não vê nada da A
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'T8 B ve orgs' t, count(*) from public.organizations;
select 'T9 B ve respostas' t, count(*) from public.answers;
select 'T10 B ve auditoria' t, count(*) from public.audit_log;
select public.submit_assessment(:'asmt');                                   -- deve FALHAR
select public.create_agent_token(:'org_a','hack');                          -- deve FALHAR
insert into public.incidents(org_id,description) values (:'org_a','teste invasor'); -- deve FALHAR
select 'T11 B partners' t, count(*) from public.partners;
reset role;

-- ===== Anônimo
set role anon;
select count(*) from public.organizations;                                  -- deve FALHAR
select public.create_organization('x',null,null,null,null,null,'1');        -- deve FALHAR
reset role;

-- ===== Staff
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select 'T12 staff ve orgs' t, count(*) from public.organizations;
select 'T13 staff ve auditoria' t, count(*) from public.audit_log;
reset role;

-- ===== Storage
insert into storage.objects(bucket_id,name) values ('reports', :'org_a' || '/relatorio.pdf');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select 'T14 A ve PDF' t, count(*) from storage.objects;
insert into storage.objects(bucket_id,name) values ('reports', :'org_a' || '/falso.pdf');    -- deve FALHAR
insert into storage.objects(bucket_id,name) values ('evidence', :'org_a' || '/backup.png');
select 'T15 A envia evidencia' t, count(*) from storage.objects where bucket_id='evidence';
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'T16 B ve PDF da A' t, count(*) from storage.objects;
insert into storage.objects(bucket_id,name) values ('evidence', :'org_a' || '/x.png');       -- deve FALHAR
reset role;
