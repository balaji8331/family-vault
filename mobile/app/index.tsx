import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useVaultStore } from '../store/vault.store';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { sessionReady, setCurrentUser, setSessionReady } = useVaultStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Fetch user from public.users
        supabase.from('users').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setCurrentUser(data);
              setSessionReady(true);
            }
          });
      } else {
        setSessionReady(false);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        supabase.from('users').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setCurrentUser(data);
              setSessionReady(true);
            }
          });
      } else {
        setCurrentUser(null);
        setSessionReady(false);
      }
    });
  }, []);

  if (sessionReady === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (sessionReady) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
