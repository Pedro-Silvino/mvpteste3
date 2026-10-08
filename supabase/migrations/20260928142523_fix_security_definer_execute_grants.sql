-- Fecha exposição desnecessária de funções auxiliares via RPC público (advisors T02).
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.has_role(uuid, text[]) from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
;
