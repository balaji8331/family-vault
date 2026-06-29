'use client';

import React, { useState, useTransition } from 'react';
import { User, Shield, KeyRound, MoreVertical, Loader2 } from 'lucide-react';
import { removeMember, promoteMember, revokeTrustedDevice } from '@/lib/actions/family';

interface Member {
  id: string;
  full_name: string;
  role: string;
  passkey_registered: boolean;
  created_at: string;
  email?: string;
}

interface MemberCardProps {
  member: Member;
  currentUserId: string;
  currentUserRole: string;
  onRefresh: () => void;
}

export default function MemberCard({ member, currentUserId, currentUserRole, onRefresh }: MemberCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSelf = member.id === currentUserId;
  const isAdmin = currentUserRole === 'family_admin' || currentUserRole === 'super_admin';
  const canManage = isAdmin && !isSelf && member.role !== 'super_admin';

  const handleAction = (action: () => Promise<{ error?: string }>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setShowDropdown(false);
    setErrorMsg(null);
    startTransition(async () => {
      const { error } = await action();
      if (error) {
        setErrorMsg(error);
      } else {
        onRefresh();
      }
    });
  };

  return (
    <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
      <div className="flex items-center mb-4 sm:mb-0">
        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg mr-4 uppercase shrink-0">
          {member.full_name?.charAt(0) || 'U'}
        </div>
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              {member.full_name || 'Unnamed User'}
            </h4>
            {isSelf && (
              <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                You
              </span>
            )}
            {member.role === 'super_admin' && (
              <span className="flex items-center text-xs font-medium px-2.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                <Shield className="w-3 h-3 mr-1" /> Super Admin
              </span>
            )}
            {member.role === 'family_admin' && (
              <span className="flex items-center text-xs font-medium px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                <Shield className="w-3 h-3 mr-1" /> Admin
              </span>
            )}
            {member.passkey_registered && (
              <span className="flex items-center text-xs text-green-700 bg-green-50 px-2.5 py-0.5 rounded border border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400">
                <KeyRound className="w-3 h-3 mr-1" /> Passkey
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {member.email ? `${member.email} \u2022 ` : ''}Joined {new Date(member.created_at).toLocaleDateString()}
          </p>
          {errorMsg && <p className="text-sm text-red-500 mt-1">{errorMsg}</p>}
        </div>
      </div>
      
      <div className="flex items-center w-full sm:w-auto justify-end">
        {isPending ? (
          <div className="flex items-center text-gray-500 px-4">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...
          </div>
        ) : (
          canManage && (
            <div className="relative">
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-10 overflow-hidden">
                  <div className="py-1">
                    {member.role === 'member' ? (
                      <button 
                        onClick={() => handleAction(() => promoteMember(member.id, 'family_admin'), `Promote ${member.full_name} to Family Admin?`)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Promote to Admin
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAction(() => promoteMember(member.id, 'member'), `Demote ${member.full_name} to Member?`)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Demote to Member
                      </button>
                    )}
                    
                    <button 
                      onClick={() => handleAction(() => revokeTrustedDevice(member.id), `Revoke trusted device sessions for ${member.full_name}?`)}
                      className="w-full text-left px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    >
                      Revoke Device
                    </button>
                    
                    <button 
                      onClick={() => handleAction(() => removeMember(member.id), `Remove ${member.full_name} from the family?`)}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Remove Member
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
      {/* Click outside overlay */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
