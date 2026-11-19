-- Existing projects may have been created from a schema where foreign keys
-- were installed without ON DELETE actions. Keep admin deletion and account
-- cleanup working by aligning those constraints with 0001_initial_schema.sql.

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.sounds drop constraint if exists sounds_created_by_fkey;
alter table public.sounds add constraint sounds_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.videos drop constraint if exists videos_author_id_fkey;
alter table public.videos add constraint videos_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;
alter table public.videos drop constraint if exists videos_sound_id_fkey;
alter table public.videos add constraint videos_sound_id_fkey
  foreign key (sound_id) references public.sounds(id) on delete set null;

alter table public.follows drop constraint if exists follows_follower_id_fkey;
alter table public.follows add constraint follows_follower_id_fkey
  foreign key (follower_id) references public.profiles(id) on delete cascade;
alter table public.follows drop constraint if exists follows_following_id_fkey;
alter table public.follows add constraint follows_following_id_fkey
  foreign key (following_id) references public.profiles(id) on delete cascade;

alter table public.video_likes drop constraint if exists video_likes_user_id_fkey;
alter table public.video_likes add constraint video_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.video_likes drop constraint if exists video_likes_video_id_fkey;
alter table public.video_likes add constraint video_likes_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;

alter table public.comments drop constraint if exists comments_video_id_fkey;
alter table public.comments add constraint comments_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;
alter table public.comments drop constraint if exists comments_author_id_fkey;
alter table public.comments add constraint comments_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;
alter table public.comments drop constraint if exists comments_parent_id_fkey;
alter table public.comments add constraint comments_parent_id_fkey
  foreign key (parent_id) references public.comments(id) on delete cascade;

alter table public.comment_likes drop constraint if exists comment_likes_user_id_fkey;
alter table public.comment_likes add constraint comment_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.comment_likes drop constraint if exists comment_likes_comment_id_fkey;
alter table public.comment_likes add constraint comment_likes_comment_id_fkey
  foreign key (comment_id) references public.comments(id) on delete cascade;

alter table public.conversation_members drop constraint if exists conversation_members_conversation_id_fkey;
alter table public.conversation_members add constraint conversation_members_conversation_id_fkey
  foreign key (conversation_id) references public.conversations(id) on delete cascade;
alter table public.conversation_members drop constraint if exists conversation_members_user_id_fkey;
alter table public.conversation_members add constraint conversation_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.messages drop constraint if exists messages_conversation_id_fkey;
alter table public.messages add constraint messages_conversation_id_fkey
  foreign key (conversation_id) references public.conversations(id) on delete cascade;
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_recipient_id_fkey;
alter table public.notifications add constraint notifications_recipient_id_fkey
  foreign key (recipient_id) references public.profiles(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_actor_id_fkey;
alter table public.notifications add constraint notifications_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
alter table public.notifications drop constraint if exists notifications_video_id_fkey;
alter table public.notifications add constraint notifications_video_id_fkey
  foreign key (video_id) references public.videos(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_comment_id_fkey;
alter table public.notifications add constraint notifications_comment_id_fkey
  foreign key (comment_id) references public.comments(id) on delete cascade;

alter table public.live_streams drop constraint if exists live_streams_host_id_fkey;
alter table public.live_streams add constraint live_streams_host_id_fkey
  foreign key (host_id) references public.profiles(id) on delete cascade;
alter table public.live_messages drop constraint if exists live_messages_stream_id_fkey;
alter table public.live_messages add constraint live_messages_stream_id_fkey
  foreign key (stream_id) references public.live_streams(id) on delete cascade;
alter table public.live_messages drop constraint if exists live_messages_author_id_fkey;
alter table public.live_messages add constraint live_messages_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;
