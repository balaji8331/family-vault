import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { useVaultStore } from '../../store/vault.store';
import { encryptFile } from '../../lib/crypto';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';
import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';

const DOC_TYPES = [
  { name: 'Aadhar', value: 'aadhar' },
  { name: 'Pan', value: 'pan' },
  { name: 'Driving License', value: 'driving_license' },
  { name: 'Passport', value: 'passport' },
  { name: 'Bank Passbook', value: 'bank_passbook' },
  { name: 'Other Document', value: 'other' }
];

export default function UploadScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const masterKey = useVaultStore(s => s.masterKey);
  const [step, setStep] = useState<string | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [existingDocs, setExistingDocs] = useState<any[]>([]);

  useEffect(() => {
    async function fetchExistingDocs() {
      if (!selectedDocType || !currentUser?.id) {
        setExistingDocs([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('documents')
          .select('id, file_name, uploaded_at, file_path')
          .eq('owner_id', currentUser.id)
          .eq('doc_type', selectedDocType)
          .order('uploaded_at', { ascending: false });
        
        if (data) {
          setExistingDocs(data);
        }
      } catch (err) {
        console.error('Error fetching existing docs:', err);
      }
    }
    fetchExistingDocs();
  }, [selectedDocType, currentUser?.id]);

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

              setExistingDocs(prev => prev.filter(d => d.id !== doc.id));
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete document");
            }
          }
        }
      ]
    );
  };

  const processUpload = async (uri: string, name: string, mimeType: string) => {
    if (!masterKey) return Alert.alert('Error', 'Master key not found');
    if (!selectedDocType) return Alert.alert('Error', 'Please select a document type');
    
    try {
      setStep('Encrypting...');
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      const docKey = QuickCrypto.randomBytes(32);
      const { encryptedData, iv } = await encryptFile(uri, docKey.buffer);

      setStep('Uploading...');
      const filePath = `${currentUser.family_id}/${QuickCrypto.randomBytes(16).toString('hex')}.enc`;
      
      // Write encrypted data to a temp file so we can upload it
      const tempUri = FileSystem.cacheDirectory + `encrypted_${Date.now()}.enc`;
      await FileSystem.writeAsStringAsync(tempUri, Buffer.from(encryptedData).toString('base64'), { encoding: FileSystem.EncodingType.Base64 });
      
      const formData = new FormData();
      formData.append('file', { uri: tempUri, name: 'encrypted.enc', type: 'application/octet-stream' } as any);
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, formData);
      
      // Clean up temp file
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      
      if (uploadError) throw uploadError;

      setStep('Saving...');
      // Wrap doc key with master key
      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', Buffer.from(masterKey), iv);
      const w1 = cipher.update(docKey);
      const w2 = cipher.final();
      const wrappedDocKey = Buffer.concat([iv, w1, w2, cipher.getAuthTag()]).toString('base64');

      const { data: doc } = await supabase.from('documents').insert({
        owner_id: currentUser.id,
        family_id: currentUser.family_id,
        file_name: name,
        file_path: filePath,
        file_size_bytes: fileInfo.size,
        mime_type: mimeType,
        iv: Buffer.from(iv).toString('base64'),
        doc_type: selectedDocType,
        key_version: 1
      }).select().single();

      if (doc) {
        await supabase.from('document_access').insert({
          document_id: doc.id,
          granted_to: currentUser.id,
          granted_by: currentUser.id,
          wrapped_key: wrappedDocKey
        });
      }

      setStep(null);
      Alert.alert('Success', 'Document uploaded securely!', [
        { text: 'OK', onPress: () => router.push('/(app)/documents') }
      ]);
    } catch (e: any) {
      setStep(null);
      Alert.alert('Upload Failed', e.message);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync();
    if (!result.canceled && result.assets[0]) {
      processUpload(result.assets[0].uri, result.assets[0].name, result.assets[0].mimeType || 'application/octet-stream');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Camera access is required.');

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      processUpload(result.assets[0].uri, `Scan-${Date.now()}.jpg`, 'image/jpeg');
    }
  };

  if (step) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-lg font-medium text-gray-700">{step}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 pt-6">
      <Text className="text-2xl font-bold text-center mb-6 text-gray-900">Secure Upload</Text>
      
      {!selectedDocType ? (
        <View>
          <Text className="text-gray-600 mb-4 font-medium text-center">Select a document category first:</Text>
          <View className="flex-row flex-wrap justify-between">
            {DOC_TYPES.map(type => (
              <TouchableOpacity 
                key={type.value}
                onPress={() => setSelectedDocType(type.value)}
                className="w-[48%] bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4"
              >
                <Text className="font-semibold text-gray-800 text-center">{type.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View className="pb-10">
          <TouchableOpacity 
            onPress={() => setSelectedDocType(null)}
            className="mb-6 py-2 px-4 border border-gray-300 rounded-full self-start bg-white"
          >
            <Text className="text-gray-600 font-medium text-sm">← Change Category</Text>
          </TouchableOpacity>

          <Text className="text-xl font-bold text-gray-800 mb-6 text-center">
            {DOC_TYPES.find(t => t.value === selectedDocType)?.name}
          </Text>

          <TouchableOpacity onPress={takePhoto} className="bg-blue-600 p-4 rounded-xl mb-4 shadow-sm">
            <Text className="text-white text-center font-bold text-lg">Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={pickDocument} className="bg-gray-800 p-4 rounded-xl shadow-sm mb-8">
            <Text className="text-white text-center font-bold text-lg">Pick File</Text>
          </TouchableOpacity>

          {existingDocs.length > 0 && (
            <View className="mt-4">
              <Text className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Already in Vault</Text>
              {existingDocs.map(doc => (
                <View key={doc.id} className="flex-row items-center justify-between p-4 bg-white rounded-xl mb-3 shadow-sm border border-gray-100">
                  <View className="flex-1 mr-4">
                    <Text className="font-semibold text-gray-900" numberOfLines={1}>{doc.file_name}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</Text>
                  </View>
                  <View className="flex-row space-x-2">
                    <TouchableOpacity 
                      onPress={() => router.push(`/(app)/documents/${doc.id}`)}
                      className="px-3 py-2 bg-purple-50 rounded-lg min-w-[44px] items-center justify-center"
                    >
                      <Text className="text-purple-600 font-medium text-sm">View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDelete(doc)}
                      className="px-3 py-2 bg-red-50 rounded-lg min-w-[44px] items-center justify-center"
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
