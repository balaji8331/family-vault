'use client';

import React, { useState, useTransition } from 'react';
import { X, Loader2 } from 'lucide-react';
import { inviteMember } from '@/lib/actions/family';

interface InviteMemberModalProps {
  familyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteMemberModal({ familyId, onClose, onSuccess }: InviteMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;
    
    setErrorMsg(null);
    startTransition(async () => {
      const { error } = await inviteMember(familyId, fullName, email);
      if (error) {
        setErrorMsg(error);
      } else {
        onSuccess();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Invite Member</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            They will receive a secure magic link to join this vault.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Sending Invite...
                </>
              ) : (
                'Send Invitation'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
