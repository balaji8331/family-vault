import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../lib/supabase';
import { deriveKeyPBKDF2 } from '../../lib/crypto';
import { useVaultStore } from '../../store/vault.store';
import { router } from 'expo-router';
import { Buffer } from 'buffer';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const setMasterKey = useVaultStore(s => s.setMasterKey);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);
    })();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock FamilyVault',
        disableDeviceFallback: true,
      });

      if (result.success) {
        const storedSaltBase64 = await SecureStore.getItemAsync('vault_salt');
        const storedPassphrase = await SecureStore.getItemAsync('vault_passphrase');
        
        if (storedSaltBase64 && storedPassphrase) {
          const salt = new Uint8Array(Buffer.from(storedSaltBase64, 'base64'));
          const key = await deriveKeyPBKDF2(storedPassphrase, salt);
          setMasterKey(key);
          router.replace('/(app)/dashboard');
        } else {
          Alert.alert('Setup Required', 'Please login with email first to setup your vault.');
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Biometric authentication failed.');
    }
  };

  const handleMagicLink = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'familyvault://dashboard' }
    });
    setLoading(false);
    
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Check your email', 'We sent you a magic link!');
  };

  return (
    <View className="flex-1 justify-center px-8 bg-white">
      <Text className="text-3xl font-bold text-center mb-8 text-blue-600">FamilyVault</Text>
      
      {hasBiometrics && (
        <TouchableOpacity 
          className="bg-blue-600 p-4 rounded-xl mb-6"
          onPress={handleBiometricLogin}
        >
          <Text className="text-white text-center font-bold text-lg">Login with Face ID / Fingerprint</Text>
        </TouchableOpacity>
      )}

      <View className="flex-row items-center mb-6">
        <View className="flex-1 h-px bg-gray-300" />
        <Text className="mx-4 text-gray-500">OR</Text>
        <View className="flex-1 h-px bg-gray-300" />
      </View>

      <Text className="mb-2 text-gray-700 font-medium">Email Address</Text>
      <TextInput 
        className="bg-gray-100 p-4 rounded-xl mb-6"
        placeholder="you@family.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TouchableOpacity 
        className="bg-gray-800 p-4 rounded-xl"
        onPress={handleMagicLink}
        disabled={loading}
      >
        <Text className="text-white text-center font-bold text-lg">
          {loading ? 'Sending...' : 'Send Magic Link'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
