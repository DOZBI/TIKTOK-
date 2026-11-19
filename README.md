# TikTok Clone (React Native + Expo Web)

A stunning, high-fidelity TikTok frontend clone built completely from scratch using **Expo (v56)**, **React Native**, and **NativeWind (Tailwind CSS)**. This project focuses on delivering a deeply immersive UI/UX that mirrors the real application, packed with smooth animations and complex interactions.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)

## ✨ Features

- **Endless Vertical Feed:** A fully functional, infinitely scrolling `FlatList` with precise snapping physics and autoplaying videos.
- **Global Authentication Wall:** A mock `Zustand` global state that locks interaction (likes, comments, following) behind a beautiful Auth Modal.
- **Video Studio (Camera):** A mock video creation workflow with draggable text stickers, simulated filters, and a trending sound selection modal.
- **Immersive Livestreams:** A mocked Live Broadcasting environment featuring an infinitely looping background video, auto-scrolling chat, and Reanimated flying gift/heart animations.
- **Advanced Search Engine:** A Discover tab equipped with an interactive tabbed layout (Top, Users, Videos).
- **Direct Messaging:** An inbox and messaging UI for chatting.
- **Deep Linking Navigation:** Built with Expo Router for robust file-based routing.

## 🛠️ Tech Stack

- **Framework:** [Expo](https://expo.dev/) (SDK 56) & [React Native](https://reactnative.dev/)
- **Navigation:** [Expo Router](https://docs.expo.dev/router/introduction/) (v3)
- **Styling:** [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **Media Playback:** `expo-video`
- **Animations:** `react-native-reanimated` & `expo-haptics`
- **Icons:** `lucide-react-native`

## 🚀 Getting Started

This application is highly optimized for the Web browser but is perfectly primed for native iOS/Android compilation.

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-github-url>
   cd tiktok-clone
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npx expo start
   ```

4. **Run on Web:**
   Press `w` in the terminal to open the app in your browser. 
   *(Note: Because this is a mobile clone, be sure to resize your browser window to a tall, narrow mobile aspect ratio, or use Chrome DevTools' Device Toolbar to simulate a phone!)*

## 📂 Project Structure

- `/src/app` - Expo Router file-based navigation (Tabs, Modals, Dynamic Routes).
- `/src/components` - Reusable UI components (VideoPost, AuthModal, LiveStreamModal).
- `/src/store` - Global state management using Zustand (`useVideoStore.ts`).
- `/assets` - Local video and image assets.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License
This project is open source and available under the [MIT License](LICENSE).

## Supabase cloud setup

The cloud foundation is ready in `src/lib/supabase.ts` and `supabase/migrations/0001_initial_schema.sql`.

1. Create a Supabase project and copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` with the project URL and public anon/publishable key. Never use `service_role` in the mobile app.
3. Run the SQL migration in Supabase Dashboard > SQL Editor (or with the Supabase CLI).
4. Install dependencies with `npm install` and start with `npx expo start`.

When credentials are absent, the app keeps its local demo feed. Once credentials are present, import `supabase` or `requireSupabase()` from `src/lib/supabase.ts` in data services. The SQL migration creates profiles, videos, sounds, follows, likes, comments/replies, conversations, messages, notifications, media buckets, RLS policies, counters, and realtime publication entries.

## Déploiement Web avec GitHub et Netlify

L’export statique Expo v56 est configuré pour être publié depuis `dist/`.

1. Poussez le dépôt sur GitHub. Le workflow `Web build` lance `npm ci` puis `npm run build:web` à chaque push sur `main` ou `master` et pour chaque pull request.
2. Dans Netlify, choisissez **Add new site > Import an existing project** et connectez le dépôt GitHub.
3. Netlify détecte les paramètres dans `netlify.toml` : commande `npm run build:web`, dossier publié `dist`.
4. Si l’application doit se connecter à Supabase, ajoutez `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans **Site configuration > Environment variables**, puis relancez le déploiement. Ces variables sont intégrées au bundle web : utilisez uniquement la clé publique anon/publishable, avec les règles RLS activées. N’ajoutez jamais de clé `service_role`.

Pour générer le site localement, lancez `npm run build:web`. Le résultat est écrit dans `dist/`.
