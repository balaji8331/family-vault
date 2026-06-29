import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../../lib/supabase';
import { deriveKeyPBKDF2 } from '../../lib/crypto';
import { useVaultStore } from '../../store/vault.store';
import { router } from 'expo-router';
import { Buffer } from 'buffer';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// Reminder: Add exp-familyvault://auth/callback to Supabase redirect URLs
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          Alert.alert('Session Expired', 'Please login with email again.');
          return;
        }

        const storedPassphrase = await SecureStore.getItemAsync('vault_passphrase');
        
        if (storedPassphrase) {
          const salt = new Uint8Array(Buffer.from(session.user.id, 'utf8'));
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
    const redirectUrl = AuthSession.makeRedirectUri({
      scheme: 'exp-familyvault',
      path: 'auth/callback'
    });
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { 
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false,
      }
    });
    setLoading(false);
    
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Check your email', 'We sent you a magic link!');
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/auth/callback');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'exp-familyvault',
        path: 'auth/callback'
      });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const code = url.searchParams.get('code');
          if (code) {
            const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (codeErr) throw codeErr;
            
            router.replace('/auth/callback');
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Google Login Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, backgroundColor: 'white' }}>
        <Text className="text-3xl font-bold text-center mb-8 text-blue-600">FamilyVault</Text>
        
        {hasBiometrics && (
          <TouchableOpacity 
            className="bg-blue-600 p-4 rounded-xl mb-6"
            onPress={handleBiometricLogin}
            disabled={loading}
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
          editable={!loading}
        />

        <TouchableOpacity 
          className="bg-gray-800 p-4 rounded-xl mb-4"
          onPress={handleMagicLink}
          disabled={loading}
        >
          <Text className="text-white text-center font-bold text-lg">
            {loading ? 'Processing...' : 'Send Magic Link'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-white border border-gray-300 p-4 rounded-xl flex-row justify-center items-center mb-8"
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-gray-800 text-center font-bold text-lg">Continue with Google</Text>
          )}
        </TouchableOpacity>

        {/* Developer Test Login Section */}
        <View className="mt-4 pt-6 border-t border-gray-200">
          <Text className="text-center text-gray-500 mb-4 font-medium uppercase text-xs">Developer Test Login</Text>
          <Text className="mb-2 text-gray-700 font-medium">Password (Testing Only)</Text>
          <TextInput 
            className="bg-gray-100 p-4 rounded-xl mb-4"
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />
          <TouchableOpacity 
            className="bg-purple-600 p-4 rounded-xl"
            onPress={handlePasswordLogin}
            disabled={loading}
          >
            <Text className="text-white text-center font-bold text-lg">
              {loading ? 'Logging in...' : 'Login with Password'}
            </Text>
          </TouchableOpacity>
          <Text className="text-center text-gray-400 text-xs mt-3">
            This section is only for testing while native build is being set up. It can be removed in production.
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
