-- Direct message conversation access and safe, idempotent one-to-one creation.
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members member
    where member.conversation_id = target_conversation_id and member.user_id = auth.uid()
  );
$$;
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists conversations_read on public.conversations;
create policy conversations_read on public.conversations
  for select using (public.is_conversation_member(conversations.id));

drop policy if exists members_read on public.conversation_members;
create policy members_read on public.conversation_members
  for select using (public.is_conversation_member(conversation_id));

drop policy if exists members_write on public.conversation_members;
create policy members_write on public.conversation_members
  for insert with check (false);

create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  found_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'A different recipient is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(current_user_id::text, target_user_id::text) || ':' || greatest(current_user_id::text, target_user_id::text), 0));

  select conversation.id into found_conversation_id
  from public.conversations conversation
  where (
    select count(*) from public.conversation_members member
    where member.conversation_id = conversation.id
  ) = 2
  and exists (
    select 1 from public.conversation_members member
    where member.conversation_id = conversation.id and member.user_id = current_user_id
  )
  and exists (
    select 1 from public.conversation_members member
    where member.conversation_id = conversation.id and member.user_id = target_user_id
  )
  limit 1;

  if found_conversation_id is null then
    insert into public.conversations default values returning id into found_conversation_id;
    insert into public.conversation_members (conversation_id, user_id)
      values (found_conversation_id, current_user_id), (found_conversation_id, target_user_id);
  end if;

  return found_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

drop policy if exists messages_update_read on public.messages;
create policy messages_update_read on public.messages
  for update using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));
