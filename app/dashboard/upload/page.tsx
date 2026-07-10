'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { generateDocumentKey, encryptFile, wrapKey } from '@/lib/crypto';
import { compressImage, compressPDF, compressDOCX, compressTXT } from '@/lib/compress';
import { extractDocumentMetadata } from '@/lib/ocr';
import { logAuditEvent } from '@/lib/audit';
import { ErrorToast } from '@/components/ui/ErrorToast';
import * as Dialog from '@radix-ui/react-dialog';
import { Trash2 } from 'lucide-react';

// Helper to convert an ArrayBuffer to a Base64 string for database storage.
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

const DEFAULT_DOC_TYPES = [
  { name: 'Aadhar', value: 'aadhar' },
  { name: 'Pan', value: 'pan' },
  { name: 'Ration Card', value: 'ration_card' },
  { name: 'Driving License', value: 'driving_license' },
  { name: 'Voter ID', value: 'voter_id' },
  { name: 'Date Of Birth Certificate', value: 'dob_certificate' },
  { name: 'Cast Certificate', value: 'cast_certificate' },
  { name: '10th Marklist', value: '10th_marklist' },
  { name: '12th Marklist', value: '12th_marklist' },
  { name: 'Degree Certificate', value: 'degree_certificate' },
  { name: 'Degree Marsheet', value: 'degree_marsheet' },
  { name: 'Degree TC', value: 'degree_tc' },
  { name: 'Vehical RC', value: 'vehical_rc' },
  { name: '12th TC', value: '12th_tc' },
  { name: 'Passport', value: 'passport' },
  { name: 'Bank Passbook', value: 'bank_passbook' },
  { name: 'Other Document', value: 'other' }
];

export default function UploadPage() {
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);
  const masterKey = useVaultStore((state) => state.masterKey);
  const setIsUploading = useVaultStore((state) => state.setIsUploading);
  
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'compressing' | 'scanning' | 'encrypting' | 'uploading' | 'saving' | 'done'>('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [docTypesList, setDocTypesList] = useState<{name: string, value: string}[]>(DEFAULT_DOC_TYPES);
  const [fetchingTypes, setFetchingTypes] = useState(true);

  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  
  // Delete Modal State
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    async function fetchDocTypes() {
      try {
        const { data, error } = await supabase
          .from('document_types')
          .select('name, value')
          .order('name', { ascending: true });
          
        if (!error && data && data.length > 0) {
          const combined = [...DEFAULT_DOC_TYPES];
          const existingValues = new Set(combined.map(t => t.value));
          
          data.forEach(t => {
            if (!existingValues.has(t.value)) {
              combined.push(t);
            }
          });
          
          setDocTypesList(combined);
        }
      } catch (err) {
        console.error('Failed to fetch document types', err);
      } finally {
        setFetchingTypes(false);
      }
    }
    fetchDocTypes();
  }, []);

  React.useEffect(() => {
    async function fetchExistingDocs() {
      if (!selectedDocType || !currentUser?.id) {
        setExistingDocs([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('documents')
          .select('id, file_name, uploaded_at, expiry_date')
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = async () => {
    if (!documentToDelete?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/delete-document?id=${documentToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setExistingDocs(docs => docs.filter(d => d.id !== documentToDelete.id));
      setDocumentToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete the document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const ACCEPTED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword',                                                       // .doc (legacy)
    'text/plain',                                                               // .txt
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (ACCEPTED_MIME_TYPES.includes(droppedFile.type)) {
        if (droppedFile.type === 'application/msword') {
          setError('Legacy .doc files are not supported. Please convert to .docx and try again.');
          return;
        }
        setFile(droppedFile);
      } else {
        setError('Only PDF, DOCX, TXT, JPG, and PNG files are accepted.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!currentUser || !masterKey) {
      setError('Vault is not unlocked or session is invalid.');
      return;
    }
    
    setStatus('encrypting');
    setError(null);
    setIsUploading(true);
    
    try {
      // 1. Compress / pre-process the file based on MIME type
      setStatus('compressing');
      let optimizedFile = file;
      if (file.type.startsWith('image/')) {
        optimizedFile = await compressImage(file);
      } else if (file.type === 'application/pdf') {
        optimizedFile = await compressPDF(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.toLowerCase().endsWith('.docx')
      ) {
        // DOCX is already a ZIP archive — pass through without re-compression
        optimizedFile = await compressDOCX(file);
      } else if (file.type === 'text/plain') {
        // TXT files are tiny — pass through unchanged
        optimizedFile = await compressTXT(file);
      }
      
      // 2. OCR Scan
      setStatus('scanning');
      setOcrProgress(0);
      const metadata = await extractDocumentMetadata(optimizedFile, docType, (progress) => {
        setOcrProgress(progress);
      });
      
      // 3. Generate document key
      setStatus('encrypting');
      const docKey = await generateDocumentKey();
      
      // 4. Encrypt the file
      const { encryptedData, iv } = await encryptFile(optimizedFile, docKey);
      
      // 5. Wrap the document key using master key
      const wrappedKeyBuffer = await wrapKey(docKey, masterKey);
      
      // 6. Convert IV and Wrapped Key to Base64
      const ivBase64 = arrayBufferToBase64(iv);
      const wrappedKeyBase64 = arrayBufferToBase64(wrappedKeyBuffer);
      
      // 7. Upload encrypted blob
      setStatus('uploading');
      const fileId = crypto.randomUUID();
      const storagePath = `${currentUser.id}/${fileId}.enc`;
      
      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob);
        
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      
      // 8. Insert into documents table
      setStatus('saving');
      
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          id: fileId,
          owner_id: currentUser.id,
          family_id: currentUser.family_id,
          file_name: file.name, // Keep original name, but use optimized size
          file_path: storagePath,
          file_size_bytes: optimizedFile.size,
          mime_type: optimizedFile.type,
          iv: ivBase64,
          key_version: 1,
          doc_type: docType,
          extracted_name: metadata.extracted_name,
          extracted_doc_number: metadata.extracted_doc_number,
          expiry_date: expiryDate ? new Date(expiryDate).toISOString() : (metadata.expiry_date ? new Date(metadata.expiry_date).toISOString() : null),
        });
        
      if (docError) throw new Error(`Failed to save metadata: ${docError.message}`);
      
      // 7. Insert into document_access table for the owner
      const { error: keyError } = await supabase
        .from('document_access')
        .insert({
          document_id: fileId,
          granted_to: currentUser.id,
          granted_by: currentUser.id,
          wrapped_key: wrappedKeyBase64
        });
        
      if (keyError) throw new Error(`Failed to save encryption key: ${keyError.message}`);
      
      // 9. Log audit event
      await logAuditEvent('upload', 'document', fileId, { file_name: file.name, size: optimizedFile.size });
      
      setStatus('done');
      
      setTimeout(() => {
        router.push('/dashboard/documents');
      }, 1500);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during upload.');
      setStatus('idle');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = docTypesList.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {status === 'idle' && !selectedDocType && (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 tracking-tight">
                Secure a New Document
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-3 max-w-2xl">
                Choose a category below to securely encrypt your file before it ever leaves your device.
              </p>
            </div>
            
            <div className="relative w-full md:w-80 group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
              </div>
              <input 
                type="text"
                placeholder="Find a document type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 min-h-[48px] bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white transition-all placeholder-gray-400 shadow-sm hover:shadow-md"
              />
            </div>
          </div>

          {fetchingTypes ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
              <p className="text-gray-500 font-medium animate-pulse">Loading vault categories...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredDocs.map((type, i) => {
                const style = getGradientForDoc(type.value);
                const [gradFrom, gradTo, textCol, ringCol] = style.split(' ');
                
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      setDocType(type.value);
                      setSelectedDocType(type.value);
                    }}
                    className="relative overflow-hidden group p-6 bg-white dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700 rounded-3xl text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-500/30 flex flex-col items-start h-40 animate-in fade-in zoom-in-95"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* Glowing Orb Background effect */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradFrom} ${gradTo} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -mr-12 -mt-12 pointer-events-none`}></div>
                    
                    <div className={`mb-auto p-3 rounded-2xl bg-gradient-to-br ${gradFrom} ${gradTo} ring-1 ${ringCol} shadow-inner`}>
                      <div className={textCol}>
                        {getIconForDoc(type.value)}
                      </div>
                    </div>
                    
                    <span className="font-semibold text-gray-900 dark:text-white text-[15px] leading-tight tracking-tight z-10 mt-2">
                      {type.name}
                    </span>
                  </button>
                );
              })}
              {filteredDocs.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-lg">No document types found matching "{searchQuery}".</p>
                  <button onClick={() => setSearchQuery('')} className="mt-2 text-purple-600 font-medium hover:underline">Clear search</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(selectedDocType || status !== 'idle') && (
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
          
          {status === 'idle' && (
            <button 
              onClick={() => setSelectedDocType(null)}
              className="mb-6 px-4 py-2 min-h-[48px] text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full font-medium flex items-center transition-all shadow-sm hover:shadow group"
            >
              <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Choose a different category
            </button>
          )}

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-2xl shadow-xl border border-gray-100 dark:border-gray-700 rounded-[2rem] overflow-hidden p-8 relative">
            
            {/* Ambient Background for Modal */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 pointer-events-none"></div>

            {error && (
              <ErrorToast message={error} onClose={() => setError(null)} />
            )}

            {status === 'idle' ? (
              <div className="space-y-8 relative z-10">
                
                {/* Header specifically for selected type */}
                <div className="flex items-center space-x-4 border-b border-gray-100 dark:border-gray-700 pb-6">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-2xl ring-1 ring-purple-500/20">
                    {getIconForDoc(selectedDocType!)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {docTypesList.find(t => t.value === selectedDocType)?.name || selectedDocType}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ready to securely encrypt and store.</p>
                  </div>
                </div>

                {!file ? (
                  <div>
                    <div 
                      className={`border-2 border-dashed rounded-[2rem] p-8 md:p-12 text-center transition-all duration-300 cursor-pointer md:cursor-default relative ${
                        isDragging 
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 scale-[1.02]' 
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-700/30'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-white dark:ring-gray-800">
                        <CloudArrowUpIcon className="w-10 h-10" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tap to select or Drop your file here</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">Supports PDF, DOCX, TXT, JPG, PNG up to 10MB. Encrypted locally before upload — the server never sees your file.</p>
                      
                      <div className="flex flex-col sm:flex-row justify-center items-stretch gap-4 relative z-10" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all"
                        >
                          Browse Files
                        </button>
                        <button 
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] bg-purple-600 text-white sm:bg-white sm:text-gray-700 sm:dark:bg-gray-800 sm:border-2 sm:border-gray-200 sm:dark:border-gray-700 sm:hover:border-gray-300 sm:dark:hover:border-gray-600 sm:dark:text-gray-200 font-bold sm:font-semibold rounded-2xl shadow-lg sm:shadow-sm transition-all flex items-center justify-center order-first sm:order-last"
                        >
                          <CameraIcon className="w-6 h-6 sm:w-5 sm:h-5 mr-2" />
                          Take Photo
                        </button>
                      </div>
                      
                      <input type="file" className="hidden" ref={fileInputRef} accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp" onChange={handleFileSelect} />
                      <input type="file" className="hidden" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileSelect} />
                    </div>

                    {/* Existing Documents of Same Type */}
                    {existingDocs.length > 0 && (
                      <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Already in Vault</h3>
                        <div className="space-y-3">
                          {existingDocs.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">{doc.file_name}</span>
                                <span className="text-xs text-gray-500 mt-1">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex space-x-2">
                                <button 
                                  onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                                  className="px-4 py-2 min-w-[36px] min-h-[36px] text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 rounded-xl transition-colors flex items-center justify-center"
                                >
                                  View
                                </button>
                                <button 
                                  onClick={() => setDocumentToDelete(doc)}
                                  className="px-3 py-2 min-w-[36px] min-h-[36px] text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-xl transition-colors flex items-center justify-center"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="flex items-center">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mr-4">
                          <DocumentIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white truncate max-w-xs md:max-w-md">{file.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button onClick={() => setFile(null)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 p-2.5 rounded-xl transition-colors" title="Remove File">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Does this document expire? (Optional)</label>
                      <input 
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full px-5 py-4 min-h-[48px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white font-medium shadow-sm transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">We'll alert you 30 days before it expires.</p>
                    </div>
                    
                    <button 
                      onClick={handleUpload}
                      className="w-full py-4 min-h-[56px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-purple-500/25 text-lg transition-all flex items-center justify-center group"
                    >
                      <LockClosedIcon className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
                      Encrypt & Secure Document
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center relative z-10">
                <div className="mb-10 relative w-32 h-32 mx-auto">
                  {status === 'done' ? (
                    <div className="absolute inset-0 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 animate-in zoom-in spin-in-12 duration-500 ring-8 ring-green-50 dark:ring-green-900/20">
                      <CheckIcon className="w-16 h-16" />
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 border-8 border-gray-100 dark:border-gray-800 rounded-full"></div>
                      <div className="absolute inset-0 border-8 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 rounded-full m-2 shadow-inner">
                        <LockClosedIcon className="w-10 h-10 animate-pulse" />
                      </div>
                    </>
                  )}
                </div>
                
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
                  {status === 'compressing' && 'Optimizing...'}
                  {status === 'scanning' && `Scanning Document... ${ocrProgress}%`}
                  {status === 'encrypting' && 'Encrypting Locally...'}
                  {status === 'uploading' && 'Uploading Secure Blob...'}
                  {status === 'saving' && 'Saving Metadata...'}
                  {status === 'done' && 'Secured Successfully!'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-lg max-w-sm mx-auto">
                  {status === 'compressing' && 'Compressing the file to save space.'}
                  {status === 'scanning' && 'Running local OCR to securely extract metadata.'}
                  {status === 'encrypting' && 'Applying zero-knowledge AES-GCM encryption natively on your device.'}
                  {status === 'uploading' && 'Transferring the encrypted chunk directly to your private vault storage.'}
                  {status === 'saving' && 'Storing document metadata and securing your mapped cryptographic keys.'}
                  {status === 'done' && 'Your document is now locked in the vault.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal using Radix Dialog */}
      <Dialog.Root open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm transition-opacity" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Delete Document?</Dialog.Title>
              <Dialog.Description className="text-gray-500 dark:text-gray-400 mb-8">
                This will permanently delete the file <span className="font-semibold text-gray-700 dark:text-gray-300">"{documentToDelete?.file_name}"</span>. This action cannot be undone.
              </Dialog.Description>
              <div className="flex space-x-4 w-full">
                <Dialog.Close asChild>
                  <button className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-xl transition-colors min-h-[48px]">
                    Cancel
                  </button>
                </Dialog.Close>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors min-h-[48px]"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}

// Map Functions
const getIconForDoc = (value: string) => {
  if (['aadhar', 'pan', 'voter_id', 'passport', 'ration_card'].includes(value)) return <IdentificationIcon className="w-7 h-7" />;
  if (value.includes('marklist') || value.includes('degree') || value.includes('10th') || value.includes('12th') || value.includes('tc')) return <AcademicCapIcon className="w-7 h-7" />;
  if (value.includes('driving') || value.includes('vehical')) return <KeyIcon className="w-7 h-7" />;
  if (value.includes('bank')) return <BanknotesIcon className="w-7 h-7" />;
  return <DocumentIcon className="w-7 h-7" />;
};

const getGradientForDoc = (value: string) => {
  if (['aadhar', 'pan', 'voter_id', 'passport', 'ration_card'].includes(value)) return 'from-blue-500/20 to-indigo-500/20 text-indigo-600 dark:text-indigo-400 ring-indigo-500/30';
  if (value.includes('marklist') || value.includes('degree') || value.includes('10th') || value.includes('12th') || value.includes('tc')) return 'from-purple-500/20 to-pink-500/20 text-fuchsia-600 dark:text-fuchsia-400 ring-fuchsia-500/30';
  if (value.includes('driving') || value.includes('vehical')) return 'from-orange-500/20 to-amber-500/20 text-orange-600 dark:text-orange-400 ring-orange-500/30';
  if (value.includes('bank')) return 'from-emerald-500/20 to-teal-500/20 text-teal-600 dark:text-teal-400 ring-teal-500/30';
  return 'from-gray-500/20 to-slate-500/20 text-gray-600 dark:text-gray-400 ring-gray-500/30';
};

// Icons
function CloudArrowUpIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>; }
function CameraIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function DocumentIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function LockClosedIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>; }
function CheckIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>; }
function IdentificationIcon(props: any) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>; }
function AcademicCapIcon(props: any) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>; }
function KeyIcon(props: any) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>; }
function BanknotesIcon(props: any) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>; }
function SearchIcon(props: any) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>; }
