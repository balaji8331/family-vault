import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useVaultStore } from '../../store/vault.store';
import Clipboard from '@react-native-clipboard/clipboard';
import { Users, Copy, UserPlus, LogOut, Trash2 } from 'lucide-react-native';

export default function FamilyScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const setCurrentUser = useVaultStore(s => s.setCurrentUser);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  
  // Forms
  const [joinCode, setJoinCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchFamily = async () => {
    if (!currentUser?.family_id) {
      setLoading(false);
      return;
    }
    try {
      const { data: f } = await supabase.from('families').select('*').eq('id', currentUser.family_id).single();
      setFamily(f);
      
      const { data: m } = await supabase.from('users').select('*').eq('family_id', currentUser.family_id).order('created_at', { ascending: true });
      setMembers(m || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [currentUser?.family_id]);

  const handleCreate = async () => {
    if (!createName) return;
    setActionLoading(true);
    try {
      // Create via API route for consistency (or direct DB if auth header not needed)
      // Wait, in RN we can't easily fetch our own Next.js API unless we know the URL.
      // But wait! The prompt says: "Join with code: TextInput for code, Join button"
      // If we use Supabase directly, we can do it! But the trigger handles the code generation.
      
      const { data: newFamily, error: fError } = await supabase.from('families').insert({ name: createName, created_by: currentUser.id }).select().single();
      if (fError) throw fError;
      
      const { error: uError } = await supabase.from('users').update({ family_id: newFamily.id, role: 'family_admin' }).eq('id', currentUser.id);
      if (uError) throw uError;
      
      setCurrentUser({ ...currentUser, family_id: newFamily.id, role: 'family_admin' });
      Alert.alert('Success', 'Family Space created!');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode) return;
    setActionLoading(true);
    try {
      const { data: f, error: fError } = await supabase.from('families').select('*').eq('family_code', joinCode.toUpperCase()).single();
      if (fError || !f) throw new Error('Invalid family code');
      
      const { error: uError } = await supabase.from('users').update({ family_id: f.id, role: 'member' }).eq('id', currentUser.id);
      if (uError) throw uError;
      
      setCurrentUser({ ...currentUser, family_id: f.id, role: 'member' });
      Alert.alert('Success', `Joined ${f.name}!`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  // STATE 1: No Family
  if (!currentUser?.family_id) {
    return (
      <View className="flex-1 bg-gray-50 p-6 justify-center">
        <View className="bg-white p-6 rounded-3xl shadow-sm mb-6">
          <View className="flex-row items-center mb-4">
            <Users color="#2563eb" size={24} />
            <Text className="text-xl font-bold ml-2">Create Family Space</Text>
          </View>
          <TextInput
            placeholder="Family Name"
            value={createName}
            onChangeText={setCreateName}
            className="bg-gray-100 p-4 rounded-xl mb-4"
          />
          <TouchableOpacity onPress={handleCreate} disabled={actionLoading} className="bg-blue-600 p-4 rounded-xl">
            <Text className="text-white text-center font-bold text-lg">{actionLoading ? 'Wait...' : 'Create'}</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white p-6 rounded-3xl shadow-sm">
          <View className="flex-row items-center mb-4">
            <UserPlus color="#9333ea" size={24} />
            <Text className="text-xl font-bold ml-2">Join Family Space</Text>
          </View>
          <TextInput
            placeholder="VAULT-XXXX"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            className="bg-gray-100 p-4 rounded-xl mb-4 text-center font-mono text-lg tracking-widest"
          />
          <TouchableOpacity onPress={handleJoin} disabled={actionLoading} className="bg-purple-600 p-4 rounded-xl">
            <Text className="text-white text-center font-bold text-lg">{actionLoading ? 'Wait...' : 'Join'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STATE 2: Has Family
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <View className="bg-blue-600 p-6 rounded-3xl shadow-sm mb-6 items-center">
        <Text className="text-2xl font-bold text-white mb-2">{family?.name}</Text>
        <Text className="text-blue-100 mb-4">{members.length} Members</Text>
        
        <View className="bg-white/20 p-4 rounded-2xl flex-row items-center space-x-4 w-full justify-between">
          <View>
            <Text className="text-blue-100 text-xs uppercase mb-1">Family Code</Text>
            <Text className="text-white text-2xl font-mono tracking-widest">{family?.family_code || '---'}</Text>
          </View>
          <TouchableOpacity 
            className="bg-white/30 p-3 rounded-xl"
            onPress={() => {
              Clipboard.setString(family?.family_code || '');
              Alert.alert('Copied', 'Family code copied to clipboard!');
            }}
          >
            <Copy color="white" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <Text className="text-lg font-bold text-gray-900 mb-4 px-2">Members</Text>
      
      <FlatList
        data={members}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View className="bg-white p-4 rounded-2xl mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Text className="text-blue-600 font-bold text-lg">{item.full_name?.charAt(0) || 'U'}</Text>
              </View>
              <View>
                <Text className="font-bold text-gray-900">
                  {item.full_name} {item.id === currentUser.id && '(You)'}
                </Text>
                <Text className="text-gray-500 text-xs capitalize">{item.role.replace('_', ' ')}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
