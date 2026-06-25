import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { familyId, adminId } = await request.json();

    if (!familyId || !adminId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify super admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError || adminData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    // 2. Cascade delete
    // Step A: Log the deletion action first
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminId,
      family_id: familyId,
      action: 'delete_family',
      target_type: 'family',
      target_id: familyId,
      metadata: { deleted_at: new Date().toISOString() }
    });

    // Step B: Get all documents for this family to delete storage files
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('id, file_path, thumbnail_path')
      .eq('family_id', familyId);

    const docIds = documents?.map(d => d.id) || [];
    const storagePaths = documents?.map(d => d.file_path).filter(Boolean) as string[] || [];
    const thumbPaths = documents?.map(d => d.thumbnail_path).filter(Boolean) as string[] || [];

    if (storagePaths.length > 0) {
      await supabaseAdmin.storage.from('documents').remove([...storagePaths, ...thumbPaths]);
    }

    // Step C: Delete Junction tables
    if (docIds.length > 0) {
      await supabaseAdmin.from('document_access').delete().in('document_id', docIds);
    }
    
    const { data: users } = await supabaseAdmin.from('users').select('id').eq('family_id', familyId);
    const userIds = users?.map(u => u.id) || [];
    
    if (userIds.length > 0) {
      await supabaseAdmin.from('encryption_keys').delete().in('user_id', userIds);
    }

    // Step D: Delete Documents
    if (docIds.length > 0) {
      await supabaseAdmin.from('documents').delete().in('id', docIds);
    }

    // Step E: Delete Audit Logs (optional, but requested by prompt to cascade to audit_logs)
    await supabaseAdmin.from('audit_logs').delete().eq('family_id', familyId).neq('action', 'delete_family');

    // Step F: Delete Users
    if (userIds.length > 0) {
      // Must also delete from auth.users (Admin API)
      for (const uid of userIds) {
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }
      await supabaseAdmin.from('users').delete().eq('family_id', familyId);
    }

    // Step G: Delete Family
    await supabaseAdmin.from('families').delete().eq('id', familyId);

    return NextResponse.json({ 
      success: true, 
      deletedCounts: { 
        documents: docIds.length, 
        users: userIds.length 
      } 
    });

  } catch (error: any) {
    console.error('Delete Family Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
