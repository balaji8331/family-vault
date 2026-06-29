import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../lib/supabase';
import { deriveKeyPBKDF2 } from '../../lib/crypto';
import { useVaultStore } from '../../store/vault.store';
import { router } from 'expo-router';
import { Buffer } from 'buffer';

export default function UnlockScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setMasterKey = useVaultStore(s => s.setMasterKey);

  const handleUnlock = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your master password.');
      return;
    }
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session. Please log in again.');

      // Salt is deterministically the userId, matching Web behavior
      const salt = new Uint8Array(Buffer.from(session.user.id, 'utf8'));
      
      // Derive key
      const key = await deriveKeyPBKDF2(password, salt);
      
      // Store passphrase securely so biometric login can use it later
      await SecureStore.setItemAsync('vault_passphrase', password);
      
      // Save key to Zustand store
      setMasterKey(key);
      
      router.replace('/(app)/dashboard');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to unlock vault.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32, backgroundColor: 'white' }}>
        <Text className="text-3xl font-bold text-center mb-2 text-gray-900">Unlock Vault</Text>
        <Text className="text-center text-gray-600 mb-8">Enter your master password to decrypt your keys locally.</Text>
        
        <TextInput 
          className="bg-gray-100 p-4 rounded-xl mb-6 text-lg"
          placeholder="Master Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          autoFocus
        />

        <TouchableOpacity 
          className="bg-blue-600 p-4 rounded-xl mb-4"
          onPress={handleUnlock}
          disabled={loading}
        >
          <Text className="text-white text-center font-bold text-lg">
            {loading ? 'Decrypting Vault...' : 'Unlock'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
