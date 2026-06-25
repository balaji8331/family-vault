'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';

export default function FamilyPage() {
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const fetchFamily = async () => {
      if (!currentUser) return;
      try {
        let query = supabase.from('users').select('id, full_name, role, email, passkey_registered, created_at');
        
        if (currentUser.role !== 'super_admin') {
          if (!currentUser.family_id) {
            setLoading(false);
            return;
          }
          query = query.eq('family_id', currentUser.family_id);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching family members:', error);
        } else {
          setMembers(data || []);
        }
      } catch (err) {
        console.error('Failed to load family:', err);
      } finally {
        setLoading(false);
      }
    }
    
  useEffect(() => {
    fetchFamily();
  }, [currentUser]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !currentUser) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          familyId: currentUser.family_id,
          role: inviteRole,
          inviterId: currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invite user');

      setInviteSuccess(true);
      setInviteEmail('');
      fetchFamily();
      setTimeout(() => setShowInviteForm(false), 2000);
    } catch (err: any) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await supabase.from('users').delete().eq('id', id);
      setMembers(members.filter(m => m.id !== id));
    } catch (err) {
      console.error('Failed to remove member', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-white dark:bg-gray-800 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Family Members</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage access for your trusted family members.</p>
        </div>
        {(currentUser?.role === 'family_admin' || currentUser?.role === 'super_admin') && (
          <button 
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center"
          >
            <UserAddIcon className="w-5 h-5 mr-2" />
            Invite Member
          </button>
        )}
      </div>

      {showInviteForm && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Invite New Member</h3>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
            <input 
              type="email" 
              required
              placeholder="Email address" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <select 
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="member">Member</option>
              <option value="family_admin">Family Admin</option>
            </select>
            <button 
              type="submit" 
              disabled={inviting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl shadow-sm transition-colors"
            >
              {inviting ? 'Inviting...' : 'Send Invite'}
            </button>
          </form>
          {inviteError && <p className="mt-3 text-red-500 text-sm">{inviteError}</p>}
          {inviteSuccess && <p className="mt-3 text-green-500 text-sm">Invitation sent successfully!</p>}
        </div>
      )}

      {members.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6">
            <UsersIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No members yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
            You haven't invited anyone to your family vault yet. Invite your spouse, parents, or children to share documents securely.
          </p>
          <button onClick={() => setShowInviteForm(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors inline-flex items-center">
            <UserAddIcon className="w-5 h-5 mr-2" />
            Invite Family Member
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {members.map((member: any) => (
            <div key={member.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg mr-4 uppercase">
                  {member.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    {member.full_name || 'Unnamed User'}
                    {member.id === currentUser?.id && <span className="ml-2 text-xs font-medium px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">You</span>}
                    {member.passkey_registered && (
                      <span className="ml-2 flex items-center text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Passkey
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {member.email ? `${member.email} \u2022 ` : ''}Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg capitalize">
                  {member.role.replace('_', ' ')}
                </span>
                {(currentUser?.role === 'family_admin' || currentUser?.role === 'super_admin') && member.id !== currentUser?.id && (
                  <button 
                    onClick={() => handleRemove(member.id)}
                    className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                    title="Remove member"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Icons
function UsersIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function UserAddIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>; }
