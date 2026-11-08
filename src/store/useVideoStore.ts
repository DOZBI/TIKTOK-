import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  name: string;
  username: string;
  bio: string;
  avatar: string;
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
  videoUrl: any;
  username: string;
  userAvatar: string;
  description: string;
  music: string;
  likes: number;
  commentsCount: number;
  shares: number;
  isLiked: boolean;
  isFollowing: boolean;
  comments: Comment[];
}

interface VideoState {
  isLoggedIn: boolean;
  showAuthModal: boolean;
  login: () => void;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  hydrateSession: () => Promise<void>;
  logout: () => void;
  setShowAuthModal: (show: boolean) => void;
  currentUser: UserProfile;
  updateProfile: (profile: Partial<UserProfile>) => void;
  videos: VideoPost[];
  hiddenVideoIds: string[];
  toggleLike: (id: string) => void;
  toggleFollow: (id: string) => void;
  addComment: (videoId: string, commentText: string) => void;
  toggleCommentLike: (videoId: string, commentId: string) => void;
  replyToComment: (videoId: string, commentId: string, replyText: string) => void;
  addVideo: (video: Omit<VideoPost, 'id' | 'username' | 'userAvatar' | 'likes' | 'commentsCount' | 'shares' | 'isLiked' | 'isFollowing' | 'comments'>) => void;
  hideVideo: (id: string) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
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
    if (data.session) set({ isLoggedIn: true, showAuthModal: false });
    return { needsEmailConfirmation: !data.session };
  },
  signIn: async (email, password) => {
    if (!supabase) return { error: 'Supabase n\'est pas configuré. Vérifie ton fichier .env.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    set({ isLoggedIn: true, showAuthModal: false });
    return {};
  },
  hydrateSession: async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    set({ isLoggedIn: Boolean(data.session) });
    supabase.auth.onAuthStateChange((_event, session) => set({ isLoggedIn: Boolean(session) }));
  },
  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ isLoggedIn: false });
  },
  setShowAuthModal: (show) => set({ showAuthModal: show }),
  currentUser: {
    name: 'You Clone',
    username: 'you_clone',
    bio: 'Creating viral short-form contents 🎥⚡ | Tech enthusiast',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop',
  },
  updateProfile: (profile) => set((state) => ({ 
    currentUser: { ...state.currentUser, ...profile } 
  })),
  videos: [
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
  ],
  toggleLike: (id) => set((state) => ({
    videos: state.videos.map((vid) =>
      vid.id === id
        ? {
            ...vid,
            isLiked: !vid.isLiked,
            likes: vid.isLiked ? vid.likes - 1 : vid.likes + 1,
          }
        : vid
    ),
  })),
  toggleFollow: (id) => set((state) => ({
    videos: state.videos.map((vid) =>
      vid.id === id ? { ...vid, isFollowing: !vid.isFollowing } : vid
    ),
  })),
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
  addVideo: (video) => set((state) => ({
    videos: [
      {
        ...video,
        username: state.currentUser.username,
        userAvatar: state.currentUser.avatar,
        id: `v_${Date.now()}`,
        likes: 0,
        commentsCount: 0,
        shares: 0,
        isLiked: false,
        isFollowing: false,
        comments: [],
      },
      ...state.videos,
    ],
  })),
  hideVideo: (id) => set((state) => ({
    hiddenVideoIds: [...state.hiddenVideoIds, id],
  })),
}));
