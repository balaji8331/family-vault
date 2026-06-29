import React, { useEffect, useState } from 'react';
import { View, Text, SectionList, TextInput, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useVaultStore } from '../../../store/vault.store';
import { 
  FileText, Search, Share2, Trash2, ChevronDown, ChevronRight,
  IdCard, CreditCard, BookOpen, Car, Shield, Home, Truck, Baby, 
  Heart, Landmark, Activity, Plane
} from 'lucide-react-native';

const DOC_TYPE_ICONS: Record<string, any> = {
  aadhaar: IdCard,
  pan: CreditCard,
  passport: BookOpen,
  driving_license: Car,
  insurance: Shield,
  property: Home,
  vehicle_rc: Truck,
  birth_certificate: Baby,
  marriage_certificate: Heart,
  bank_statement: Landmark,
  medical: Activity,
  visa: Plane,
  other: FileText,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN Card',
  passport: 'Passport',
  driving_license: 'Driving License',
  insurance: 'Insurance',
  property: 'Property Documents',
  vehicle_rc: 'Vehicle RC',
  birth_certificate: 'Birth Certificate',
  marriage_certificate: 'Marriage Certificate',
  bank_statement: 'Bank Statement',
  medical: 'Medical Records',
  visa: 'Visa',
  other: 'Other',
};

export default function DocumentsScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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
    
    // Fallback filter if search_vector isn't fully working
    let finalData = data || [];
    if (search) {
      const lowerSearch = search.toLowerCase();
      finalData = finalData.filter(d => 
        d.file_name.toLowerCase().includes(lowerSearch) || 
        (d.doc_type && d.doc_type.toLowerCase().includes(lowerSearch))
      );
    }
    
    setDocuments(finalData);
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

  const handleDelete = (doc: any) => {
    Alert.alert(
      "Delete Document?",
      `This will permanently delete "${doc.file_name}". This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Delete from Storage
              if (doc.file_path) {
                await supabase.storage.from('documents').remove([doc.file_path]);
              }
              // 2. Delete Access
              await supabase.from('document_access').delete().eq('document_id', doc.id);
              // 3. Delete Document
              const { error } = await supabase.from('documents').delete().eq('id', doc.id);
              if (error) throw error;

              setDocuments(prev => prev.filter(d => d.id !== doc.id));
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete document");
            }
          }
        }
      ]
    );
  };

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: prev[title] === false ? true : false
    }));
  };

  // Group Documents
  const sharedDocs = documents.filter(doc => doc.owner_id !== currentUser?.id);
  const ownDocs = documents.filter(doc => doc.owner_id === currentUser?.id);
  
  const groupedDocs: Record<string, any[]> = {};
  ownDocs.forEach(doc => {
    const type = doc.doc_type || 'other';
    if (!groupedDocs[type]) groupedDocs[type] = [];
    groupedDocs[type].push(doc);
  });

  const sections: any[] = [];
  
  if (sharedDocs.length > 0) {
    sections.push({ title: 'shared', data: sharedDocs, icon: Share2, label: 'Shared With Me' });
  }

  const standardGroups = Object.keys(DOC_TYPE_LABELS).filter(k => k !== 'other');
  standardGroups.forEach(type => {
    if (groupedDocs[type] && groupedDocs[type].length > 0) {
      sections.push({ 
        title: type, 
        data: groupedDocs[type], 
        icon: DOC_TYPE_ICONS[type], 
        label: DOC_TYPE_LABELS[type] 
      });
    }
  });

  if (groupedDocs['other'] && groupedDocs['other'].length > 0) {
    sections.push({ title: 'other', data: groupedDocs['other'], icon: FileText, label: 'Other' });
  }

  const renderItem = ({ item, section }: { item: any, section: any }) => {
    if (expandedSections[section.title] === false) return null;
    const isShared = item.owner_id !== currentUser?.id;
    
    return (
      <View className="bg-white rounded-xl shadow-sm mb-3 mx-4 overflow-hidden border border-gray-100">
        <TouchableOpacity 
          className="p-4 flex-row items-center"
          onPress={() => router.push(`/(app)/documents/${item.id}`)}
        >
          <View className={`p-3 rounded-lg ${isShared ? 'bg-purple-50' : 'bg-gray-50'}`}>
            <FileText size={24} color={isShared ? '#9333ea' : '#6b7280'} />
          </View>
          <View className="ml-4 flex-1">
            <Text className="font-semibold text-gray-900" numberOfLines={1}>{item.file_name}</Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-gray-500 text-xs capitalize">{item.doc_type || 'Unknown'}</Text>
              <Text className="text-gray-400 text-xs mx-2">•</Text>
              <Text className="text-gray-500 text-xs">{new Date(item.uploaded_at).toLocaleDateString()}</Text>
            </View>
          </View>
          {item.expiry_date && (
            <View className={`w-3 h-3 rounded-full ${getExpiryColor(item.expiry_date)} ml-2`} />
          )}
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View className="flex-row border-t border-gray-100">
          <TouchableOpacity 
            className="flex-1 py-3 flex-row items-center justify-center border-r border-gray-100"
            onPress={() => router.push(`/(app)/documents/${item.id}`)}
          >
            <Text className="text-blue-600 font-medium">View</Text>
          </TouchableOpacity>
          {!isShared && (
            <TouchableOpacity 
              className="flex-1 py-3 flex-row items-center justify-center"
              onPress={() => handleDelete(item)}
            >
              <Trash2 size={16} color="#dc2626" className="mr-2" />
              <Text className="text-red-600 font-medium">Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 p-3 rounded-xl">
          <Search size={20} color="#9ca3af" />
          <TextInput 
            className="ml-2 flex-1 text-base text-gray-900" 
            placeholder="Search documents..." 
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 16 }}
        stickySectionHeadersEnabled={false}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => {
          const Icon = section.icon;
          const isExpanded = expandedSections[section.title] !== false;
          const isShared = section.title === 'shared';
          
          return (
            <TouchableOpacity 
              className="flex-row items-center justify-between px-4 py-3 mb-2"
              onPress={() => toggleSection(section.title)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center">
                <View className={`p-2 rounded-lg ${isShared ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  <Icon size={20} color={isShared ? '#9333ea' : '#2563eb'} />
                </View>
                <Text className="font-semibold text-gray-900 text-lg ml-3">{section.label}</Text>
                <View className="bg-gray-200 rounded-full px-2 py-0.5 ml-2">
                  <Text className="text-xs text-gray-600 font-medium">{section.data.length}</Text>
                </View>
              </View>
              {isExpanded ? <ChevronDown size={20} color="#9ca3af" /> : <ChevronRight size={20} color="#9ca3af" />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text className="text-center text-gray-500 mt-10">No documents found.</Text>}
      />
    </View>
  );
}
