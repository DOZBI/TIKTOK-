import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';

export interface UserProfile {
  id?: string;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  followingCount: number;
  followersCount: number;
  likesCount: number;
}

export interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: string;
  isLiked?: boolean;
  replies?: Comment[];
}

export interface VideoPost {
  id: string;
  authorId?: string;
  videoUrl: any;
  thumbnailUrl?: string;
  thumbnailUrlLow?: string;
  thumbnailUrlMedium?: string;
  username: string;
  userAvatar: string;
  description: string;
  music: string;
  likes: number;
  commentsCount: number;
  shares: number;
  views: number;
  authorStats?: { following: number; followers: number; likes: number };
  isLiked: boolean;
  isFollowing: boolean;
  comments: Comment[];
  visibility?: 'public' | 'followers' | 'private';
}

interface VideoState {
  isLoggedIn: boolean;
  showAuthModal: boolean;
  login: () => void;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  hydrateSession: () => Promise<void>;
  loadFeed: () => Promise<void>;
  logout: () => Promise<void>;
  incrementView: (id: string) => Promise<void>;
  setShowAuthModal: (show: boolean) => void;
  currentUser: UserProfile;
  updateProfile: (profile: Partial<UserProfile>) => void;
  videos: VideoPost[];
  isFeedLoading: boolean;
  hiddenVideoIds: string[];
  toggleLike: (id: string) => Promise<void>;
  toggleFollow: (id: string) => Promise<void>;
  addComment: (videoId: string, commentText: string) => void;
  toggleCommentLike: (videoId: string, commentId: string) => void;
  replyToComment: (videoId: string, commentId: string, replyText: string) => void;
  addVideo: (video: Omit<VideoPost, 'id' | 'username' | 'userAvatar' | 'likes' | 'commentsCount' | 'shares' | 'views' | 'isLiked' | 'isFollowing' | 'comments'>, visibility?: 'public' | 'followers' | 'private', onProgress?: (progress: number) => void) => Promise<{ error?: string }>;
  hideVideo: (id: string) => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  isLoggedIn: false,
  showAuthModal: false,
  login: () => set({ isLoggedIn: true, showAuthModal: false }),
  signUp: async (email, password, username) => {
    if (!supabase) return { error: 'Supabase n\'est pas configuré. Vérifie ton fichier .env.' };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: username } },
    });
    if (error) return { error: error.message };
    if (data.session) { set({ isLoggedIn: true, showAuthModal: false }); await get().loadFeed(); }
    return { needsEmailConfirmation: !data.session };
  },
  signIn: async (email, password) => {
    if (!supabase) return { error: 'Supabase n\'est pas configuré. Vérifie ton fichier .env.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    set({ isLoggedIn: true, showAuthModal: false });
    await get().loadFeed();
    return {};
  },
  hydrateSession: async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    set({ isLoggedIn: Boolean(data.session) });
    await get().loadFeed();
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ isLoggedIn: Boolean(session) });
      if (session) void get().loadFeed();
      else set({ videos: [] });
    });
  },
  loadFeed: async () => {
    set({ isFeedLoading: true });
    const client = supabase;
    if (!client) {
      set({ isFeedLoading: false });
      return;
    }
    try {
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      const [{ data: profile }, { data: rows, error }] = await Promise.all([
        userId ? client.from('profiles').select('*').eq('id', userId).single() : Promise.resolve({ data: null }),
        client.from('videos').select('*, profiles:author_id(id, username, display_name, bio, avatar_url), sounds(title, artist)').eq('status', 'published').order('created_at', { ascending: false }),
      ]);
      if (error) return;
      const [{ data: followingRows }, { data: likedRows }] = await Promise.all([
        userId ? client.from('follows').select('following_id').eq('follower_id', userId) : Promise.resolve({ data: [] }),
        userId ? client.from('video_likes').select('video_id').eq('user_id', userId) : Promise.resolve({ data: [] }),
      ]);
      const following = new Set((followingRows ?? []).map((row) => row.following_id));
      const liked = new Set((likedRows ?? []).map((row) => row.video_id));
      const ownVideos = (rows ?? []).filter((row) => row.author_id === userId);
      const { count: followersCount } = userId ? await client.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId) : { count: 0 };
      const { count: followingCount } = userId ? await client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId) : { count: 0 };
      const likesCount = ownVideos.reduce((sum, row) => sum + row.likes_count, 0);
      const authorIds = [...new Set((rows ?? []).map((row) => row.author_id))];
      const authorStats = new Map<string, { following: number; followers: number; likes: number }>();
      await Promise.all(authorIds.map(async (authorId) => {
      const [{ count: authorFollowing }, { count: authorFollowers }, { data: authorVideos }] = await Promise.all([
        client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', authorId),
        client.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', authorId),
        client.from('videos').select('likes_count').eq('author_id', authorId),
      ]);
      authorStats.set(authorId, { following: authorFollowing ?? 0, followers: authorFollowers ?? 0, likes: (authorVideos ?? []).reduce((sum, video) => sum + video.likes_count, 0) });
      }));
      set({
      currentUser: {
        id: userId,
        name: profile?.display_name || profile?.username || 'User',
        username: profile?.username || 'user',
        bio: profile?.bio || '', avatar: profile?.avatar_url || '',
        followingCount: followingCount ?? 0, followersCount: followersCount ?? 0, likesCount,
      },
      videos: (rows ?? []).map((row) => ({
        id: row.id, authorId: row.author_id, videoUrl: row.hls_url || row.video_url,
        thumbnailUrl: row.thumbnail_url || undefined, thumbnailUrlLow: row.thumbnail_url_low || undefined, thumbnailUrlMedium: row.thumbnail_url_medium || undefined,
        username: row.profiles?.username ?? 'user', userAvatar: row.profiles?.avatar_url ?? '',
        description: row.description, music: row.sounds?.title ?? 'Original sound',
        likes: row.likes_count, commentsCount: row.comments_count, shares: row.shares_count,
        views: row.views_count, isLiked: liked.has(row.id), isFollowing: following.has(row.author_id), comments: [], authorStats: authorStats.get(row.author_id), visibility: row.visibility,
      })),
      });
    } finally {
      set({ isFeedLoading: false });
    }
  },
  logout: async () => {
    const result = supabase ? await supabase.auth.signOut({ scope: 'local' }) : { error: null };
    set({ isLoggedIn: false, videos: [], showAuthModal: false });
    if (result.error) throw result.error;
  },
  incrementView: async (id) => {
    const video = get().videos.find((item) => item.id === id);
    if (!video) return;
    set((state) => ({ videos: state.videos.map((item) => item.id === id ? { ...item, views: item.views + 1 } : item) }));
    await supabase?.from('videos').update({ views_count: video.views + 1 }).eq('id', id);
  },
  setShowAuthModal: (show) => set({ showAuthModal: show }),
  currentUser: {
    name: 'You Clone',
    username: 'you_clone',
    bio: 'Creating viral short-form contents 🎥⚡ | Tech enthusiast',
    avatar: '',
    followingCount: 0,
    followersCount: 0,
    likesCount: 0,
  },
  updateProfile: (profile) => set((state) => ({ 
    currentUser: { ...state.currentUser, ...profile } 
  })),
  videos: /* Static demo feed removed: data comes from Supabase.
    {
      id: '1',
      videoUrl: require('../../assets/sample.mp4'),
      username: 'neongirl_99',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      description: 'Living in neon lights ✨ #aesthetic #cyberpunk #neon',
      music: 'Original Audio - neongirl_99',
      likes: 124300,
      commentsCount: 384,
      shares: 890,
      isLiked: false,
      isFollowing: false,
      comments: [
        {
          id: 'c1',
          username: 'alex_cyber',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
          text: 'This looks absolutely amazing! Where is this sign?',
          timestamp: '2h ago'
        },
        {
          id: 'c2',
          username: 'lisa_m',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
          text: 'Vibe check passed 🎧🔥',
          timestamp: '5h ago'
        }
      ]
    },
    {
      id: '2',
      videoUrl: require('../../assets/sample.mp4'),
      username: 'dance_dancer',
      userAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop',
      description: 'Late night freestyle choreography! Let me know what you think 💃💃 #dance #music #vibe',
      music: 'Neon Groove - Dance Classics',
      likes: 84300,
      commentsCount: 204,
      shares: 512,
      isLiked: false,
      isFollowing: true,
      comments: [
        {
          id: 'c3',
          username: 'hiphop_kid',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
          text: 'Smoooth moves!',
          timestamp: '1d ago'
        }
      ]
    },
    {
      id: '3',
      videoUrl: require('../../assets/sample.mp4'),
      username: 'skater_pro',
      userAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop',
      description: 'Finally landed this kickflip line 🛹 #skate #skatelife #sports',
      music: 'Skater Punk - The Rockers',
      likes: 198000,
      commentsCount: 1542,
      shares: 4320,
      isLiked: true,
      isFollowing: false,
      comments: [
        {
          id: 'c4',
          username: 'board_rider',
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop',
          text: 'Clean landing bro!',
          timestamp: '3h ago'
        }
      ]
    },
    {
      id: '4',
      videoUrl: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
      username: 'sparkle_girl',
      userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop',
      description: 'Chasing the magic in the dark ✨ #sparkler #nightlife #aesthetic',
      music: 'Chill Ambient - Cloud Nine',
      likes: 310500,
      commentsCount: 948,
      shares: 1205,
      isLiked: false,
      isFollowing: false,
      comments: []
    }
  */ [],
  isFeedLoading: true,
  toggleLike: async (id) => {
    const video = get().videos.find((item) => item.id === id);
    const userId = (await supabase?.auth.getUser())?.data.user?.id;
    if (!video || !userId) return;
    const nextLiked = !video.isLiked;
    set((state) => ({ videos: state.videos.map((item) => item.id === id ? { ...item, isLiked: nextLiked, likes: item.likes + (nextLiked ? 1 : -1) } : item) }));
    if (nextLiked) await supabase?.from('video_likes').insert({ user_id: userId, video_id: id });
    else await supabase?.from('video_likes').delete().eq('user_id', userId).eq('video_id', id);
  },
  toggleFollow: async (id) => {
    const video = get().videos.find((item) => item.id === id);
    const userId = (await supabase?.auth.getUser())?.data.user?.id;
    if (!video || !userId || !video.authorId) return;
    const nextFollowing = !video.isFollowing;
    set((state) => ({ videos: state.videos.map((item) => item.authorId === video.authorId ? { ...item, isFollowing: nextFollowing } : item) }));
    if (nextFollowing) await supabase?.from('follows').insert({ follower_id: userId, following_id: video.authorId });
    else await supabase?.from('follows').delete().eq('follower_id', userId).eq('following_id', video.authorId);
  },
  addComment: (videoId, commentText) => set((state) => ({
    videos: state.videos.map((vid) => {
      if (vid.id === videoId) {
        const newComment: Comment = {
          id: `c_${Date.now()}`,
          username: state.currentUser.username,
          avatar: state.currentUser.avatar,
          text: commentText,
          timestamp: 'Just now',
        };
        return {
          ...vid,
          comments: [newComment, ...vid.comments],
          commentsCount: vid.commentsCount + 1,
        };
      }
      return vid;
    }),
  })),
  toggleCommentLike: (videoId, commentId) => set((state) => ({
    videos: state.videos.map(vid => {
      if (vid.id !== videoId) return vid;
      return {
        ...vid,
        comments: vid.comments.map(c => 
          c.id === commentId ? { ...c, isLiked: !c.isLiked } : c
        )
      };
    })
  })),
  replyToComment: (videoId, commentId, replyText) => set((state) => ({
    videos: state.videos.map(vid => {
      if (vid.id !== videoId) return vid;
      const newReply: Comment = {
        id: `r_${Date.now()}`,
        username: state.currentUser.username,
        avatar: state.currentUser.avatar,
        text: replyText,
        timestamp: 'Just now',
      };
      return {
        ...vid,
        commentsCount: vid.commentsCount + 1,
        comments: vid.comments.map(c => 
          c.id === commentId 
            ? { ...c, replies: [...(c.replies || []), newReply] } 
            : c
        )
      };
    })
  })),
  hiddenVideoIds: [],
  addVideo: async (video, visibility = 'public', onProgress) => {
    if (!supabase) return { error: 'Supabase n\'est pas configuré. Vérifie ton fichier .env.' };

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return { error: 'Tu dois être connecté pour publier une vidéo.' };

    const sourceUri = typeof video.videoUrl === 'string' ? video.videoUrl : null;
    if (!sourceUri) return { error: 'La vidéo sélectionnée est invalide.' };

    const extension = sourceUri.split('?')[0].split('.').pop()?.toLowerCase() || 'mp4';
    const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : 'mp4';
    const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExtension}`;
    const contentType = safeExtension === 'mov' ? 'video/quicktime' : 'video/mp4';

    try {
      onProgress?.(5);
      const fileInfo = await FileSystem.getInfoAsync(sourceUri);
      if (!fileInfo.exists) {
        throw new Error('Le fichier vidéo n’est plus disponible sur l’appareil.');
      }
      const fileSize = 'size' in fileInfo ? fileInfo.size : undefined;
      if (fileSize && fileSize > 100 * 1024 * 1024) {
        throw new Error('La vidéo dépasse la limite de 100 Mo. Choisis une vidéo plus légère.');
      }
      onProgress?.(20);

      const accessToken = sessionData.session?.access_token;
      if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
        throw new Error('La configuration Supabase est incomplète.');
      }

      const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${storagePath
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
      const uploadTask = FileSystem.createUploadTask(uploadUrl, sourceUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': contentType,
          'Cache-Control': '3600',
          'x-upsert': 'false',
        },
      }, (progress) => {
        const total = progress.totalBytesExpectedToSend;
        const percentage = total > 0 ? progress.totalBytesSent / total : 0;
        onProgress?.(20 + Math.round(percentage * 60));
      });
      const uploadResult = await uploadTask.uploadAsync();

      if (!uploadResult) {
        throw new Error("L'upload Supabase n'a renvoyé aucune réponse.");
      }
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`L'upload Supabase a échoué (${uploadResult.status}).`);
      }
      onProgress?.(80);

      const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(storagePath);
      const { data: row, error: insertError } = await supabase
        .from('videos')
        .insert({
          author_id: userId,
          storage_path: storagePath,
          video_url: publicUrlData.publicUrl,
          description: video.description,
          visibility,
          status: 'published',
        })
        .select('id')
        .single();

      if (insertError || !row) {
        await supabase.storage.from('videos').remove([storagePath]);
        throw insertError ?? new Error('La vidéo n’a pas été enregistrée.');
      }

      onProgress?.(95);
      await get().loadFeed();
      onProgress?.(100);
      return {};
    } catch (error) {
      console.error('Video publication failed:', error);
      return { error: error instanceof Error ? error.message : 'La publication a échoué.' };
    }
  },
  hideVideo: (id) => set((state) => ({
    hiddenVideoIds: [...state.hiddenVideoIds, id],
  })),
}));
