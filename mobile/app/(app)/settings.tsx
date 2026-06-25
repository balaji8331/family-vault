import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useVaultStore } from '../../store/vault.store';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const clearKeys = useVaultStore(s => s.clearKeys);

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

      <TouchableOpacity onPress={handleLogout} className="bg-red-600 p-4 rounded-xl">
        <Text className="text-white text-center font-bold text-lg">Logout & Lock Vault</Text>
      </TouchableOpacity>
    </View>
  );
}
