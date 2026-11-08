import { Tabs, useRouter } from 'expo-router';
import { Home, Search, Plus, MessageSquare, User } from 'lucide-react-native';
import { View } from 'react-native';
import { useVideoStore } from '../../store/useVideoStore';

export default function TabsLayout() {
  const router = useRouter();
  const { isLoggedIn, setShowAuthModal } = useVideoStore();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#888888',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 0.5,
          borderTopColor: '#1a1a1a',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: () => (
            <View className="bg-white px-3 py-1 rounded-lg border-l-2 border-cyan-400 border-r-2 border-pink-500 justify-center items-center h-8 w-11 mt-1">
              <Plus size={18} color="#000000" strokeWidth={3} />
            </View>
          ),
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            if (!isLoggedIn) {
              setShowAuthModal(true);
            } else {
              router.push('/camera');
            }
          },
        })}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color }) => <MessageSquare size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
