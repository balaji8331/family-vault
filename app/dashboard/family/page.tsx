'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { Users, UserPlus, Copy, LogOut, Trash2 } from 'lucide-react';

export default function FamilyPage() {
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  
  // State 1: No Family
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // State 2: Has Family
  const [family, setFamily] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchFamily = async () => {
    if (!currentUser) return;
    try {
      if (!currentUser.family_id) {
        setLoading(false);
        return;
      }

      const { data: familyData } = await supabase.from('families').select('*').eq('id', currentUser.family_id).single();
      setFamily(familyData);

      const { data: membersData } = await supabase.from('users').select('id, full_name, role, passkey_registered, created_at, email').eq('family_id', currentUser.family_id).order('created_at', { ascending: true });
      setMembers(membersData || []);
    } catch (err) {
      console.error('Failed to load family:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamily();
  }, [currentUser]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/family/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Update local state
      useVaultStore.getState().setCurrentUser({ ...currentUser, family_id: data.family_id, role: 'family_admin' });
      window.location.reload(); // Refresh to catch new states
    } catch (err: any) {
      setErrorMsg(err.message);
      setActionLoading(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/family/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_code: joinCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err.message);
      setActionLoading(false);
    }
  };

  const handleLeaveFamily = async () => {
    if (!confirm('Are you sure you want to leave this family? You will lose access to all shared documents.')) return;
    try {
      const res = await fetch('/api/family/leave', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDissolveFamily = async () => {
    const confirmText = prompt('DANGER: Type "DISSOLVE" to confirm deleting this family and all its data.');
    if (confirmText !== 'DISSOLVE') return;
    
    try {
      const res = await fetch('/api/admin/delete-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: currentUser.family_id, adminId: currentUser.id })
      });
      if (!res.ok) throw new Error('Failed to dissolve family');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyCode = () => {
    if (family?.family_code) {
      navigator.clipboard.writeText(family.family_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareInvite = () => {
    const text = `Join my FamilyVault space! Use code: ${family?.family_code} at ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'Join FamilyVault', text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Invite message copied to clipboard!');
    }
  };

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
      await supabase.from('users').update({ family_id: null, role: 'member' }).eq('id', id);
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

  // STATE 1: No Family (Onboarding)
  if (!currentUser?.family_id) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Welcome to FamilyVault</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">To get started, create a new family space or join an existing one.</p>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl text-center font-medium">
            {errorMsg}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Family */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Family Space</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 flex-1">Start a new secure vault for your family. You will be set as the Family Admin.</p>
            
            <form onSubmit={handleCreateFamily} className="space-y-4">
              <input 
                type="text" 
                placeholder="Family Name (e.g. Smith Family)" 
                required
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit" 
                disabled={actionLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-colors"
              >
                {actionLoading ? 'Creating...' : 'Create Family'}
              </button>
            </form>
          </div>

          {/* Join Family */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6">
              <UserPlus className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Join Family Space</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 flex-1">Have a code from a family member? Enter it below to join their secure vault.</p>
            
            <form onSubmit={handleJoinFamily} className="space-y-4">
              <input 
                type="text" 
                placeholder="VAULT-XXXX" 
                required
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 uppercase text-center font-mono text-lg tracking-widest"
              />
              <button 
                type="submit" 
                disabled={actionLoading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-colors"
              >
                {actionLoading ? 'Joining...' : 'Join Family'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // STATE 2: Has Family (Dashboard)
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-8 bg-gradient-to-br from-blue-600 to-blue-800 flex flex-col md:flex-row justify-between items-center text-white">
          <div className="mb-6 md:mb-0 text-center md:text-left">
            <h1 className="text-3xl font-bold mb-2">{family?.name || 'My Family'}</h1>
            <p className="text-blue-100 flex items-center justify-center md:justify-start">
              <Users className="w-5 h-5 mr-2" />
              {members.length} member{members.length !== 1 && 's'}
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex flex-col items-center">
            <p className="text-blue-100 text-sm font-medium mb-2 uppercase tracking-wider">Family Code</p>
            <div className="flex items-center space-x-3">
              <span className="text-2xl font-mono font-bold tracking-widest">{family?.family_code || '---'}</span>
              <button 
                onClick={copyCode}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                title="Copy Code"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
            {copied && <span className="absolute -top-8 bg-black/70 text-white text-xs px-2 py-1 rounded">Copied!</span>}
            <button 
              onClick={shareInvite}
              className="mt-4 w-full py-2 bg-white text-blue-800 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
            >
              Share Invite
            </button>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Members</h2>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          {members.map((member: any, index: number) => (
            <div key={member.id} className={`p-6 flex items-center justify-between ${index !== members.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg mr-4 uppercase">
                  {member.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    {member.full_name || 'Unnamed User'}
                    {member.id === currentUser?.id && <span className="ml-2 text-xs font-medium px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">You</span>}
                    {member.passkey_registered && (
                      <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Passkey</span>
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
                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Panel (Admin Only) */}
      {(currentUser?.role === 'family_admin' || currentUser?.role === 'super_admin') && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Invite via Email</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">Send a direct email invitation if you prefer not to share the code directly.</p>
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

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-4">Danger Zone</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleLeaveFamily}
            className="flex-1 py-3 bg-white dark:bg-gray-800 text-red-600 border border-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl font-semibold transition-colors flex justify-center items-center"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Leave Family
          </button>
          
          {(currentUser?.role === 'family_admin' || currentUser?.role === 'super_admin') && (
            <button 
              onClick={handleDissolveFamily}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors flex justify-center items-center"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Dissolve Family Space
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
