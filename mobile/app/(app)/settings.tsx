import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useVaultStore } from '../../store/vault.store';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import Clipboard from '@react-native-clipboard/clipboard';

export default function SettingsScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const clearKeys = useVaultStore(s => s.clearKeys);
  const [family, setFamily] = React.useState<any>(null);
  const [memberCount, setMemberCount] = React.useState(0);

  React.useEffect(() => {
    if (currentUser?.family_id) {
      supabase.from('families').select('*').eq('id', currentUser.family_id).single().then(({ data }) => setFamily(data));
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('family_id', currentUser.family_id).then(({ count }) => setMemberCount(count || 0));
    }
  }, [currentUser?.family_id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearKeys();
    await SecureStore.deleteItemAsync('vault_salt');
    await SecureStore.deleteItemAsync('vault_passphrase');
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 p-6 bg-gray-50">
      <View className="bg-white p-6 rounded-2xl shadow-sm mb-6">
        <Text className="text-sm text-gray-500 mb-1">Name</Text>
        <Text className="text-lg font-semibold text-gray-900 mb-4">{currentUser?.full_name}</Text>
        
        <Text className="text-sm text-gray-500 mb-1">Email</Text>
        <Text className="text-lg font-semibold text-gray-900 mb-4">{currentUser?.email || 'N/A'}</Text>
        
        <Text className="text-sm text-gray-500 mb-1">Phone</Text>
        <Text className="text-lg font-semibold text-gray-900 mb-4">{currentUser?.phone || 'N/A'}</Text>

        <Text className="text-sm text-gray-500 mb-1">Role</Text>
        <Text className="text-lg font-semibold text-gray-900 capitalize">{currentUser?.role.replace('_', ' ')}</Text>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm mb-6">
        <Text className="text-xl font-bold text-gray-900 mb-4">Family Space</Text>
        
        {!currentUser?.family_id ? (
          <View>
            <Text className="text-gray-500 mb-4">You are not part of any family space.</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/family')} className="bg-blue-100 p-3 rounded-xl mb-3">
              <Text className="text-blue-600 font-semibold text-center">Create Family</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(app)/family')} className="bg-purple-100 p-3 rounded-xl">
              <Text className="text-purple-600 font-semibold text-center">Join with Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text className="text-sm text-gray-500 mb-1">Family Name</Text>
            <Text className="text-lg font-semibold text-gray-900 mb-4">{family?.name || 'Loading...'}</Text>
            
            <Text className="text-sm text-gray-500 mb-1">Family Code</Text>
            <View className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200 mb-4">
              <Text className="text-lg font-mono tracking-widest text-gray-900">{family?.family_code || '---'}</Text>
              <TouchableOpacity onPress={() => {
                Clipboard.setString(family?.family_code || '');
                Alert.alert('Copied', 'Family code copied to clipboard');
              }}>
                <Text className="text-blue-600 font-semibold">Copy</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-sm text-gray-500 mb-4">{memberCount} Members</Text>
            
            <TouchableOpacity onPress={() => router.push('/(app)/family')} className="bg-gray-100 p-3 rounded-xl">
              <Text className="text-gray-900 font-semibold text-center">Manage Family</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity onPress={handleLogout} className="bg-red-600 p-4 rounded-xl">
        <Text className="text-white text-center font-bold text-lg">Logout & Lock Vault</Text>
      </TouchableOpacity>
    </View>
  );
}
