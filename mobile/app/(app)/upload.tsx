import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { useVaultStore } from '../../store/vault.store';
import { encryptFile } from '../../lib/crypto';
import QuickCrypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer';

export default function UploadScreen() {
  const currentUser = useVaultStore(s => s.currentUser);
  const masterKey = useVaultStore(s => s.masterKey);
  const [step, setStep] = useState<string | null>(null);

  const processUpload = async (uri: string, name: string, mimeType: string) => {
    if (!masterKey) return Alert.alert('Error', 'Master key not found');
    
    try {
      setStep('Encrypting...');
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      const docKey = QuickCrypto.randomBytes(32);
      const { encryptedData, iv } = await encryptFile(uri, docKey.buffer);

      setStep('Uploading...');
      const filePath = `${currentUser.family_id}/${QuickCrypto.randomBytes(16).toString('hex')}.enc`;
      
      const formData = new FormData();
      formData.append('file', { uri, name: 'encrypted.enc', type: 'application/octet-stream' } as any);
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, formData);
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
        doc_type: 'other',
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
      Alert.alert('Success', 'Document uploaded securely!');
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
    <View className="flex-1 justify-center px-8 bg-gray-50">
      <Text className="text-2xl font-bold text-center mb-8">Secure Upload</Text>
      
      <TouchableOpacity onPress={takePhoto} className="bg-blue-600 p-4 rounded-xl mb-4">
        <Text className="text-white text-center font-bold text-lg">Take Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={pickDocument} className="bg-gray-800 p-4 rounded-xl">
        <Text className="text-white text-center font-bold text-lg">Pick File</Text>
      </TouchableOpacity>
    </View>
  );
}
