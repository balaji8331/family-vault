import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useVaultStore } from '../../store/vault.store';
import { FileText, Users, AlertTriangle, Plus } from 'lucide-react-native';

export default function DashboardScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const [stats, setStats] = useState({ total: 0, shared: 0, expiring: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    
    async function fetchDashboard() {
      // Stats
      const [owned, shared, expiring] = await Promise.all([
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('owner_id', currentUser.id),
        supabase.from('document_access').select('*', { count: 'exact', head: true }).eq('granted_to', currentUser.id),
        supabase.from('documents').select('*', { count: 'exact', head: true }).eq('family_id', currentUser.family_id).lt('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
      ]);
      setStats({ total: owned.count || 0, shared: shared.count || 0, expiring: expiring.count || 0 });

      // Recent
      const { data } = await supabase.from('documents').select('*').eq('family_id', currentUser.family_id).order('uploaded_at', { ascending: false }).limit(5);
      setRecent(data || []);
    }
    fetchDashboard();
  }, [currentUser]);

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Hello, {currentUser?.full_name?.split(' ')[0]}</Text>
        
        <View className="flex-row flex-wrap justify-between mb-8">
          <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm mb-4">
            <View className="bg-blue-100 p-2 rounded-lg self-start mb-2"><FileText size={24} color="#2563eb" /></View>
            <Text className="text-3xl font-bold">{stats.total}</Text>
            <Text className="text-gray-500">My Docs</Text>
          </View>
          <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm mb-4">
            <View className="bg-green-100 p-2 rounded-lg self-start mb-2"><Users size={24} color="#16a34a" /></View>
            <Text className="text-3xl font-bold">{stats.shared}</Text>
            <Text className="text-gray-500">Shared</Text>
          </View>
          <View className="w-[48%] bg-white p-4 rounded-2xl shadow-sm">
            <View className="bg-red-100 p-2 rounded-lg self-start mb-2"><AlertTriangle size={24} color="#dc2626" /></View>
            <Text className="text-3xl font-bold">{stats.expiring}</Text>
            <Text className="text-gray-500">Expiring</Text>
          </View>
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-4">Recent Documents</Text>
        {recent.map(doc => (
          <TouchableOpacity 
            key={doc.id} 
            className="bg-white p-4 rounded-xl shadow-sm mb-3 flex-row items-center"
            onPress={() => router.push(`/(app)/documents/${doc.id}`)}
          >
            <FileText size={24} color="#6b7280" />
            <View className="ml-4 flex-1">
              <Text className="font-semibold text-gray-900">{doc.file_name}</Text>
              <Text className="text-gray-500 text-xs capitalize">{doc.doc_type}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity 
        className="absolute bottom-6 right-6 bg-blue-600 p-4 rounded-full shadow-lg"
        onPress={() => router.push('/(app)/upload')}
      >
        <Plus size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}
