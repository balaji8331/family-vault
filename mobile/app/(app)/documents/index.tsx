import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useVaultStore } from '../../../store/vault.store';
import { FileText, Search, AlertTriangle } from 'lucide-react-native';

export default function DocumentsScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDocs = async () => {
    if (!currentUser) return;
    const { data: shared } = await supabase.from('document_access').select('document_id').eq('granted_to', currentUser.id);
    const sharedIds = shared?.map(s => s.document_id) || [];

    let query = supabase.from('documents').select('*');
    if (sharedIds.length > 0) {
      query = query.or(`owner_id.eq.${currentUser.id},id.in.(${sharedIds.join(',')})`);
    } else {
      query = query.eq('owner_id', currentUser.id);
    }
    
    if (search) {
      query = query.textSearch('search_vector', search, { type: 'websearch' });
    }

    const { data } = await query.order('uploaded_at', { ascending: false });
    setDocuments(data || []);
  };

  useEffect(() => {
    fetchDocs();
  }, [currentUser, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDocs();
    setRefreshing(false);
  };

  const getExpiryColor = (dateStr: string) => {
    if (!dateStr) return 'transparent';
    const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (days < 0) return 'bg-red-500';
    if (days < 30) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 p-3 rounded-xl">
          <Search size={20} color="#9ca3af" />
          <TextInput 
            className="ml-2 flex-1" 
            placeholder="Search documents..." 
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={documents}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            className="bg-white p-4 rounded-xl shadow-sm mb-3 flex-row items-center"
            onPress={() => router.push(`/(app)/documents/${item.id}`)}
          >
            <View className="p-3 bg-gray-50 rounded-lg">
              <FileText size={24} color="#6b7280" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="font-semibold text-gray-900">{item.file_name}</Text>
              <Text className="text-gray-500 text-xs capitalize">{item.doc_type}</Text>
            </View>
            {item.expiry_date && (
              <View className={`w-3 h-3 rounded-full ${getExpiryColor(item.expiry_date)}`} />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text className="text-center text-gray-500 mt-10">No documents found.</Text>}
      />
    </View>
  );
}
