import { supabase } from '@/lib/supabase/client';

export interface Document {
  id: string;
  owner_id: string;
  family_id: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string;
  iv: string;
  key_version: number;
  doc_type: string;
  extracted_name: string | null;
  extracted_doc_number: string | null;
  expiry_date: string | null;
  notify_enabled: boolean;
  thumbnail_path: string | null;
  uploaded_at: string;
}

export async function searchDocuments(query: string, familyId: string, currentUserId: string): Promise<Document[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    // 1. Fetch document IDs shared with the user
    const { data: sharedAccess, error: accessError } = await supabase
      .from('document_access')
      .select('document_id')
      .eq('granted_to', currentUserId);

    if (accessError) {
      console.error('Error fetching document access:', accessError);
      return [];
    }

    const sharedDocIds = sharedAccess?.map(a => a.document_id) || [];
    
    // 2. Perform search with RLS equivalent filter
    // We filter by: owner_id = currentUser.id OR id IN (sharedDocIds)
    
    let dbQuery = supabase
      .from('documents')
      .select('*')
      .textSearch('search_vector', query, { type: 'websearch' });
      
    if (sharedDocIds.length > 0) {
      dbQuery = dbQuery.or(`owner_id.eq.${currentUserId},id.in.(${sharedDocIds.join(',')})`);
    } else {
      dbQuery = dbQuery.eq('owner_id', currentUserId);
    }
    
    const { data, error } = await dbQuery.order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error searching documents:', error);
      return [];
    }

    return (data as Document[]) || [];
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
