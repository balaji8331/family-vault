import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { deleteRatelimit, getRealIP } from '@/lib/ratelimit';

export async function DELETE(request: Request) {
  try {
    const ip = getRealIP(request);
    const { success } = await deleteRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    // Initialize regular client (to check auth & RLS)
    const supabase = await createClient();
    
    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership (RLS ensures we can only select it if we own it or are an admin, 
    // but we should strictly check owner_id here before deleting)
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('owner_id, file_path, family_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found or unauthorized' }, { status: 404 });
    }

    // Strictly enforce that only the owner can delete
    if (doc.owner_id !== session.user.id) {
      return NextResponse.json({ error: 'Only the owner can delete this document' }, { status: 403 });
    }

    // Initialize Admin client for operations that might require bypassing RLS if needed, 
    // but here we can just use the user's client since RLS should allow the owner to delete.
    // However, the prompt says "move the delete logic from the client into a server route (more secure)", 
    // Using admin client is safer if RLS on document_access delete isn't fully permissive for owners.
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Delete from Storage
    if (doc.file_path) {
      const { error: storageError } = await supabaseAdmin.storage.from('documents').remove([doc.file_path]);
      if (storageError) throw new Error('Failed to delete file from storage: ' + storageError.message);
    }

    // 2. Delete document_access rows
    const { error: accessError } = await supabaseAdmin.from('document_access').delete().eq('document_id', documentId);
    if (accessError) throw new Error('Failed to clear access lists: ' + accessError.message);

    // 3. Delete document row
    const { error: deleteDocError } = await supabaseAdmin.from('documents').delete().eq('id', documentId);
    if (deleteDocError) throw new Error('Failed to delete document metadata: ' + deleteDocError.message);

    // 4. Log audit event
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: session.user.id,
      family_id: doc.family_id,
      action: 'delete',
      target_type: 'document',
      target_id: documentId,
      metadata: {}
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete Document Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
