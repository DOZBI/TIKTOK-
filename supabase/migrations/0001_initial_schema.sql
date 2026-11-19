-- TikTok clone cloud schema for Supabase. Run in Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_.]{3,30}$'),
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.sounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  audio_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  video_url text not null,
  hls_url text,
  dash_url text,
  video_url_low text,
  video_url_medium text,
  thumbnail_url text,
  thumbnail_url_low text,
  thumbnail_url_medium text,
  description text not null default '',
  sound_id uuid references public.sounds(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  status text not null default 'published' check (status in ('draft','published','archived')),
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  shares_count integer not null default 0 check (shares_count >= 0),
  views_count integer not null default 0 check (views_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table if not exists public.video_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  media_url text, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('like','comment','follow','mention','message')),
  video_id uuid references public.videos(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists videos_created_idx on public.videos(created_at desc);
create index if not exists videos_author_idx on public.videos(author_id, created_at desc);
create index if not exists comments_video_idx on public.comments(video_id, created_at desc);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, username, display_name) values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user_' || substr(new.id::text,1,8)), coalesce(new.raw_user_meta_data->>'display_name','')); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.refresh_video_counts() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.videos set likes_count = (select count(*) from public.video_likes where video_id = coalesce(new.video_id, old.video_id)), updated_at = now() where id = coalesce(new.video_id, old.video_id); return coalesce(new, old); end; $$;
drop trigger if exists video_like_count on public.video_likes;
create trigger video_like_count after insert or delete on public.video_likes for each row execute procedure public.refresh_video_counts();
create or replace function public.refresh_comment_count() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.videos set comments_count = (select count(*) from public.comments where video_id = coalesce(new.video_id, old.video_id)), updated_at = now() where id = coalesce(new.video_id, old.video_id); return coalesce(new, old); end; $$;
drop trigger if exists video_comment_count on public.comments;
create trigger video_comment_count after insert or delete on public.comments for each row execute procedure public.refresh_comment_count();

alter table public.profiles enable row level security;
alter table public.sounds enable row level security;
alter table public.videos enable row level security;
alter table public.follows enable row level security;
alter table public.video_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
create policy profiles_read on public.profiles for select using (true);
create policy profiles_write on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy sounds_read on public.sounds for select using (true);
create policy sounds_write on public.sounds for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy videos_read on public.videos for select using (status = 'published' and (visibility = 'public' or author_id = auth.uid() or (visibility = 'followers' and exists (select 1 from public.follows where follower_id = auth.uid() and following_id = author_id))));
create policy videos_insert on public.videos for insert with check (auth.uid() = author_id);
create policy videos_update on public.videos for update using (auth.uid() = author_id);
create policy videos_delete on public.videos for delete using (auth.uid() = author_id);
create policy follows_read on public.follows for select using (auth.uid() = follower_id or auth.uid() = following_id);
create policy follows_write on public.follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy likes_read on public.video_likes for select using (true);
create policy likes_write on public.video_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy comments_read on public.comments for select using (true);
create policy comments_write on public.comments for all using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy comment_likes_read on public.comment_likes for select using (true);
create policy comment_likes_write on public.comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy members_read on public.conversation_members for select using (auth.uid() = user_id or exists (select 1 from public.conversation_members m where m.conversation_id = conversation_members.conversation_id and m.user_id = auth.uid()));
create policy members_write on public.conversation_members for insert with check (auth.uid() = user_id);
create policy messages_read on public.messages for select using (exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
create policy messages_write on public.messages for insert with check (auth.uid() = sender_id and exists (select 1 from public.conversation_members m where m.conversation_id = messages.conversation_id and m.user_id = auth.uid()));
create policy notifications_read on public.notifications for select using (auth.uid() = recipient_id);
create policy notifications_update on public.notifications for update using (auth.uid() = recipient_id);

insert into storage.buckets (id, name, public) values ('videos','videos',true), ('avatars','avatars',true) on conflict (id) do nothing;
drop policy if exists video_uploads on storage.objects;
drop policy if exists video_updates on storage.objects;
drop policy if exists video_deletes on storage.objects;
create policy video_uploads on storage.objects for insert to authenticated with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy video_updates on storage.objects for update to authenticated using (bucket_id = 'videos' and owner_id = auth.uid()::text);
create policy video_deletes on storage.objects for delete to authenticated using (bucket_id = 'videos' and owner_id = auth.uid()::text);
create policy video_public_read on storage.objects for select using (bucket_id in ('videos','avatars'));

alter publication supabase_realtime add table public.videos, public.comments, public.messages, public.notifications;

-- Optional livestream domain used by the live UI.
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(), host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  playback_url text, viewer_count integer not null default 0, started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(), stream_id uuid not null references public.live_streams(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade, body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists live_messages_stream_idx on public.live_messages(stream_id, created_at);
alter table public.live_streams enable row level security;
alter table public.live_messages enable row level security;
create policy live_streams_read on public.live_streams for select using (status in ('scheduled','live') or host_id = auth.uid());
create policy live_streams_write on public.live_streams for all using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy live_messages_read on public.live_messages for select using (true);
create policy live_messages_write on public.live_messages for insert with check (auth.uid() = author_id);
alter publication supabase_realtime add table public.live_streams, public.live_messages;

