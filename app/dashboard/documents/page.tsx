'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import ExpiryBadge from '@/components/documents/ExpiryBadge';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import DocumentCard from '@/components/documents/DocumentCard';
import { 
  IdCard, CreditCard, BookOpen, Car, Shield, Home, Truck, Baby, 
  Heart, Landmark, Activity, Plane, FileText, Share2, Trash2,
  ChevronDown, ChevronRight, Upload as UploadIcon, Search as SearchIcon,
  GraduationCap, ScrollText, Wallet, Vote, CalendarCheck, Users, BookMarked
} from 'lucide-react';
import ShareDocumentModal from '@/components/documents/ShareDocumentModal';


export interface DocumentRecord {
  id: string;
  owner_id: string;
  family_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  iv: string;
  doc_type: string;
  expiry_date: string | null;
  uploaded_at: string;
}

const DOC_TYPE_ICONS: Record<string, React.ElementType> = {
  aadhar: IdCard,
  pan: CreditCard,
  passport: BookOpen,
  driving_license: Car,
  insurance: Shield,
  property: Home,
  vehicle_rc: Truck,
  vehical_rc: Truck,          // typo variant from upload page
  birth_certificate: Baby,
  dob_certificate: Baby,
  marriage_certificate: Heart,
  bank_statement: Landmark,
  bank_passbook: Wallet,
  medical: Activity,
  visa: Plane,
  ration_card: ScrollText,
  voter_id: Vote,
  cast_certificate: Users,
  '10th_marklist': GraduationCap,
  '12th_marklist': GraduationCap,
  degree_certificate: GraduationCap,
  degree_marsheet: BookMarked,
  degree_tc: ScrollText,
  '12th_tc': ScrollText,
  other: FileText,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhar: 'Aadhaar',
  pan: 'PAN Card',
  passport: 'Passport',
  driving_license: 'Driving License',
  insurance: 'Insurance',
  property: 'Property Documents',
  vehicle_rc: 'Vehicle RC',
  vehical_rc: 'Vehicle RC',
  birth_certificate: 'Birth Certificate',
  dob_certificate: 'Date of Birth Certificate',
  marriage_certificate: 'Marriage Certificate',
  bank_statement: 'Bank Statement',
  bank_passbook: 'Bank Passbook',
  medical: 'Medical Records',
  visa: 'Visa',
  ration_card: 'Ration Card',
  voter_id: 'Voter ID',
  cast_certificate: 'Caste Certificate',
  '10th_marklist': '10th Marklist',
  '12th_marklist': '12th Marklist',
  degree_certificate: 'Degree Certificate',
  degree_marsheet: 'Degree Marksheet',
  degree_tc: 'Degree TC',
  '12th_tc': '12th TC',
  other: 'Other',
};

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useVaultStore((state) => state.currentUser);
  
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  // Delete Modal State
  const [documentToDelete, setDocumentToDelete] = useState<DocumentRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Share Modal State
  const [documentToShare, setDocumentToShare] = useState<DocumentRecord | null>(null);

  useEffect(() => {
    async function fetchDocs() {
      if (!currentUser?.id) return;
      setErrorMsg(null);
      try {
        const { data: ownDocs, error: err1 } = await supabase
          .from('documents')
          .select('*')
          .eq('owner_id', currentUser.id)
          .order('uploaded_at', { ascending: false });

        const { data: accessData } = await supabase
          .from('document_access')
          .select('document_id')
          .eq('granted_to', currentUser.id);

        let sharedDocs: DocumentRecord[] = [];
        if (accessData && accessData.length > 0) {
          const docIds = accessData.map((a: { document_id: string }) => a.document_id);
          const { data: sDocs } = await supabase
            .from('documents')
            .select('*')
            .in('id', docIds)
            .order('uploaded_at', { ascending: false });
          if (sDocs) sharedDocs = sDocs;
        }

        if (err1) {
          console.error('Error fetching documents:', err1);
          setErrorMsg(err1.message);
        } else {
          const allDocs = [...(ownDocs || []), ...sharedDocs];
          const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
          uniqueDocs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
          
          setDocuments(uniqueDocs);
        }
      } catch (err: any) {
        console.error('Failed to load documents:', err);
        setErrorMsg(err.message || 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, [currentUser]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  const handleDelete = async () => {
    if (!documentToDelete?.id) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/delete-document?id=${documentToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setDocuments(docs => docs.filter(d => d.id !== documentToDelete.id));
      queryClient.invalidateQueries({ queryKey: ['search'] });
      setDocumentToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete the document.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-white dark:bg-gray-800 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-6xl mx-auto pb-10">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Error Loading Documents</h3>
          <p className="text-red-600 dark:text-red-300">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // Filtering
  const filteredDocs = documents.filter(doc => 
    doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (doc.doc_type && doc.doc_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Grouping
  const sharedDocs = filteredDocs.filter(doc => doc.owner_id !== currentUser?.id);
  const ownDocs = filteredDocs.filter(doc => doc.owner_id === currentUser?.id);
  
  const groupedDocs: Record<string, DocumentRecord[]> = {};
  ownDocs.forEach(doc => {
    // Normalise: if doc_type isn't in our label map, bucket it under 'other'
    // so it always appears rather than silently vanishing.
    const rawType = doc.doc_type || 'other';
    const type = rawType in DOC_TYPE_LABELS ? rawType : 'other';
    if (!groupedDocs[type]) groupedDocs[type] = [];
    groupedDocs[type].push(doc);
  });

  const canShareDoc = (doc: DocumentRecord) =>
    doc.owner_id === currentUser?.id ||
    currentUser?.role === 'family_admin' ||
    currentUser?.role === 'super_admin';

  const renderDocumentRow = (doc: any, isShared: boolean) => (
    <DocumentCard 
      key={doc.id}
      doc={doc}
      isShared={isShared}
      onView={(id) => router.push(`/dashboard/documents/${id}`)}
      onDelete={setDocumentToDelete}
      onShare={setDocumentToShare}
      canShare={canShareDoc(doc)}
    />
  );

  const renderGroup = (key: string, label: string, Icon: React.ElementType, docs: DocumentRecord[], isShared: boolean = false) => {
    if (docs.length === 0) return null;
    const isExpanded = expandedSections[key] !== false; // Default to true

    return (
      <div key={key} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
        <button 
          onClick={() => toggleSection(key)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isShared ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg flex items-center">
              {label} 
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                {docs.length}
              </span>
            </h3>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </button>
        {isExpanded && (
          <div className="flex flex-col">
            {docs.map(doc => renderDocumentRow(doc, isShared))}
          </div>
        )}
      </div>
    );
  };

  // Render every known doc type that has documents, in the canonical label order.
  // 'other' is always rendered last.
  const standardGroups = Object.keys(DOC_TYPE_LABELS).filter(k => k !== 'other');
  
  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Documents</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your secure identity and family files.</p>
        </div>
        <button onClick={() => router.push('/dashboard/upload')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center min-h-[48px]">
          <UploadIcon className="w-5 h-5 mr-2" />
          <span>Upload New</span>
        </button>
      </div>

      {documents.length > 0 && (
        <div className="mb-6 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Filter documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white shadow-sm"
          />
        </div>
      )}

      {documents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6">
            <FileText className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No documents yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
            You haven't uploaded any documents to your secure vault. Start by uploading an identity card, passport, or policy.
          </p>
          <button onClick={() => router.push('/dashboard/upload')} className="px-6 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors inline-flex items-center">
            <UploadIcon className="w-5 h-5 mr-2" />
            Upload Document
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No documents found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderGroup('shared', 'Shared With Me', Share2, sharedDocs, true)}
          
          {standardGroups.map(type => 
            renderGroup(type, DOC_TYPE_LABELS[type], DOC_TYPE_ICONS[type], groupedDocs[type] || [])
          )}
          
          {renderGroup('other', 'Other', FileText, groupedDocs['other'] || [])}
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
      {/* Share Document Modal */}
      {documentToShare && (
        <ShareDocumentModal
          documentId={documentToShare.id}
          documentName={documentToShare.file_name}
          ownerId={documentToShare.owner_id}
          onClose={() => setDocumentToShare(null)}
        />
      )}

    </div>
  );
}
