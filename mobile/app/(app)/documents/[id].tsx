import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useVaultStore } from '../../../store/vault.store';
import { decryptFile, unwrapKeyMobile } from '../../../lib/crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { Share, Download } from 'lucide-react-native';
import { Buffer } from 'buffer';

export default function DocumentViewer() {
  const { id } = useLocalSearchParams();
  const currentUser = useVaultStore(s => s.currentUser);
  const masterKey = useVaultStore(s => s.masterKey);
  const [doc, setDoc] = useState<any>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);

  useEffect(() => {
    async function loadDoc() {
      if (!id || !masterKey) return;
      
      const { data: document } = await supabase.from('documents').select('*').eq('id', id).single();
      if (!document) return;
      setDoc(document);

      // Get wrapped key
      const { data: access, error: accessError } = await supabase.from('document_access').select('wrapped_key').eq('document_id', id).eq('granted_to', currentUser.id).single();
      
      if (accessError || !access?.wrapped_key) {
        Alert.alert('Error', 'Encryption key not found. You may not have access.');
        return;
      }

      const wrappedKeyBytes = Buffer.from(access.wrapped_key, 'base64');
      // Buffer may be a view into a shared pool — copy to a tightly-bounded ArrayBuffer.
      const wrappedKeyAb = wrappedKeyBytes.buffer.slice(
        wrappedKeyBytes.byteOffset,
        wrappedKeyBytes.byteOffset + wrappedKeyBytes.byteLength,
      );
      const docKeyBuffer = unwrapKeyMobile(wrappedKeyAb, masterKey);

      const { data: blob } = await supabase.storage.from('documents').download(document.file_path);
      if (!blob) return;

      const arrayBuffer = await blob.arrayBuffer();
      const decrypted = await decryptFile(new Uint8Array(arrayBuffer), Buffer.from(document.iv, 'base64'), docKeyBuffer);

      const uri = FileSystem.cacheDirectory + document.file_name;
      await FileSystem.writeAsStringAsync(uri, Buffer.from(decrypted).toString('base64'), { encoding: FileSystem.EncodingType.Base64 });
      setFileUri(uri);
    }
    
    loadDoc();
  }, [id, masterKey]);

  const handleDownload = async () => {
    if (!fileUri || !doc) return;
    const dest = FileSystem.documentDirectory + doc.file_name;
    await FileSystem.copyAsync({ from: fileUri, to: dest });
    Alert.alert('Success', 'File downloaded to device storage.');
  };

  const openPdf = async () => {
    if (fileUri) await Linking.openURL(fileUri);
  };

  if (!doc) return <View className="flex-1 justify-center items-center"><Text>Loading...</Text></View>;

  return (
    <ScrollView className="flex-1 bg-white">
      {fileUri ? (
        doc.mime_type.startsWith('image/') ? (
          <Image source={{ uri: fileUri }} className="w-full h-64 bg-gray-100" resizeMode="contain" />
        ) : (
          <TouchableOpacity onPress={openPdf} className="w-full h-64 bg-gray-100 justify-center items-center">
            <Text className="text-blue-600 font-bold text-lg">Tap to Open PDF</Text>
          </TouchableOpacity>
        )
      ) : (
        <View className="w-full h-64 bg-gray-100 justify-center items-center"><Text>Decrypting...</Text></View>
      )}

      <View className="p-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">{doc.file_name}</Text>
        <Text className="text-gray-500 capitalize mb-6">{doc.doc_type}</Text>

        <View className="bg-gray-50 p-4 rounded-xl mb-6">
          <Text className="text-xs text-gray-500 mb-1">Extracted Name</Text>
          <Text className="font-medium text-gray-900 mb-3">{doc.extracted_name || 'N/A'}</Text>
          
          <Text className="text-xs text-gray-500 mb-1">Expiry Date</Text>
          <Text className="font-medium text-gray-900">{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'None'}</Text>
        </View>

        <View className="flex-row space-x-4">
          <TouchableOpacity onPress={handleDownload} className="flex-1 bg-blue-600 p-4 rounded-xl flex-row justify-center items-center">
            <Download size={20} color="white" />
            <Text className="text-white font-bold ml-2">Download</Text>
          </TouchableOpacity>
          {doc.owner_id === currentUser?.id && (
            <TouchableOpacity className="flex-1 bg-green-600 p-4 rounded-xl flex-row justify-center items-center">
              <Share size={20} color="white" />
              <Text className="text-white font-bold ml-2">Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
