import { useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';
import { useVaultStore } from '../../store/vault.store';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { deriveKeyPBKDF2 } from '../../lib/crypto';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';

export default function AuthCallback() {
  const setMasterKey = useVaultStore(s => s.setMasterKey);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        let sessionError = null;

        // Magic link uses hash fragment, OAuth uses code in query params
        if (url.includes('#access_token=') || url.includes('#type=')) {
          const { error } = await supabase.auth.getSessionFromUrl({
            storeSession: true,
          });
          // Note: In RN, Supabase might not parse it automatically from window.location,
          // so we might need to manually set session or pass the URL if the API supports it.
          // The user requested calling getSessionFromUrl(), so we do.
          if (error) sessionError = error;
        } else if (url.includes('?code=')) {
          const urlObj = new URL(url.replace('#', '?')); // URL polyfill handles some issues
          const code = urlObj.searchParams.get('code');
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) sessionError = error;
          }
        }

        if (sessionError) {
          throw sessionError;
        }

        // 1. Get current session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session found.');

        // 2. Initialize master key
        const storedPassphrase = await SecureStore.getItemAsync('vault_passphrase');
        
        if (storedPassphrase) {
          const salt = new Uint8Array(Buffer.from(session.user.id, 'utf8'));
          const key = await deriveKeyPBKDF2(storedPassphrase, salt);
          setMasterKey(key);
          router.replace('/(app)/dashboard');
        } else {
          // If no password stored, we need to prompt the user
          router.replace('/(auth)/unlock');
        }
      } catch (err: any) {
        Alert.alert('Authentication Error', err.message);
        router.replace('/(auth)/login');
      }
    };

    Linking.getInitialURL().then((url) => {
      handleUrl(url || '');
    });

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}
