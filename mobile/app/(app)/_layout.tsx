import { Tabs } from 'expo-router';
import { Home, Settings, Users } from 'lucide-react-native';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarStyle: { borderTopWidth: 1, borderTopColor: '#f3f4f6' }
    }}>
      <Tabs.Screen 
        name="dashboard" 
        options={{ 
          title: 'Home', 
          tabBarIcon: ({ color }) => <Home color={color} size={24} /> 
        }} 
      />
      <Tabs.Screen 
        name="family" 
        options={{ 
          title: 'Family', 
          tabBarIcon: ({ color }) => <Users color={color} size={24} /> 
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings', 
          tabBarIcon: ({ color }) => <Settings color={color} size={24} /> 
        }} 
      />
      
      {/* Hide other screens from the tab bar */}
      <Tabs.Screen name="upload" options={{ href: null }} />
      <Tabs.Screen name="documents/index" options={{ href: null }} />
      <Tabs.Screen name="documents/[id]" options={{ href: null }} />
    </Tabs>
  );
}
