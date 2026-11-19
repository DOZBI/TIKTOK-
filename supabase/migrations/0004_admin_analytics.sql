-- Server-side visitor analytics and atomic public video view counting.
create table if not exists public.platform_visitors (
  ip_hash text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visit_count bigint not null default 1 check (visit_count > 0)
);

alter table public.platform_visitors enable row level security;
revoke all on public.platform_visitors from anon, authenticated;
grant all on public.platform_visitors to service_role;

create or replace function public.record_platform_visit(visitor_hash_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.platform_visitors (ip_hash)
  values (visitor_hash_input)
  on conflict (ip_hash) do update
    set last_seen_at = now(), visit_count = public.platform_visitors.visit_count + 1;
end;
$$;
revoke all on function public.record_platform_visit(text) from public, anon, authenticated;
grant execute on function public.record_platform_visit(text) to service_role;

create or replace function public.increment_video_view(video_id_input uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_views integer;
begin
  update public.videos
  set views_count = views_count + 1, updated_at = now()
  where id = video_id_input
    and status = 'published'
    and (
      visibility = 'public'
      or author_id = auth.uid()
      or (visibility = 'followers' and exists (
        select 1 from public.follows
        where follower_id = auth.uid() and following_id = public.videos.author_id
      ))
    )
  returning views_count into new_views;
  return new_views;
end;
$$;
revoke all on function public.increment_video_view(uuid) from public;
grant execute on function public.increment_video_view(uuid) to anon, authenticated;

create or replace function public.admin_metrics()
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'videos', (select count(*) from public.videos),
    'views', (select coalesce(sum(views_count), 0) from public.videos),
    'uniqueVisitors', (select count(*) from public.platform_visitors),
    'visits', (select coalesce(sum(visit_count), 0) from public.platform_visitors)
  );
$$;
revoke all on function public.admin_metrics() from public, anon, authenticated;
grant execute on function public.admin_metrics() to service_role;
