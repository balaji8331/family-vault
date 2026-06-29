'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { Users, UserPlus, ShieldAlert, ArrowLeft } from 'lucide-react';
import MemberCard from '@/components/family/MemberCard';
import InviteMemberModal from '@/components/family/InviteMemberModal';

export default function SuperAdminFamilyDrilldown() {
  const { familyId } = useParams();
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);
  
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const fetchFamilyDetails = async () => {
    if (currentUser?.role !== 'super_admin') return;
    try {
      const { data: familyData } = await supabase.from('families').select('*').eq('id', familyId).single();
      setFamily(familyData);

      // Explicit selection: DO NOT SELECT trusted_device_token
      const { data: membersData } = await supabase
        .from('users')
        .select('id, full_name, role, passkey_registered, created_at, email')
        .eq('family_id', familyId)
        .order('created_at', { ascending: true });
        
      setMembers(membersData || []);
    } catch (err) {
      console.error('Failed to load family details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilyDetails();
  }, [currentUser, familyId]);

  if (currentUser?.role !== 'super_admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Super Admin only.</div>;
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-white dark:bg-gray-800 rounded-3xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <button 
        onClick={() => router.push('/admin/families')}
        className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Families
      </button>

      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-8 relative">
        <div className="absolute top-0 right-0 p-4">
          <span className="flex items-center text-xs font-bold px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full border border-red-200 dark:border-red-800/50">
            <ShieldAlert className="w-3 h-3 mr-1.5" /> SUPER ADMIN OVERRIDE
          </span>
        </div>
        <div className="p-8 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
          <h1 className="text-3xl font-bold mb-2 pr-40">{family?.name || 'Unknown Family'}</h1>
          <p className="text-gray-400 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            {members.length} member{members.length !== 1 && 's'}
          </p>
        </div>
      </div>

      {/* Members List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Members</h2>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Add Member
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {members.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No members found.</div>
          ) : (
            members.map((member) => (
              <MemberCard 
                key={member.id} 
                member={member} 
                currentUserId={currentUser!.id} 
                currentUserRole={currentUser!.role}
                onRefresh={fetchFamilyDetails}
              />
            ))
          )}
        </div>
      </div>

      {showInviteModal && (
        <InviteMemberModal 
          familyId={familyId as string} 
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            fetchFamilyDetails();
          }}
        />
      )}
    </div>
  );
}
