'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { Users, Loader2 } from 'lucide-react';
import FamilyStatsCard from '@/components/family/FamilyStatsCard';
import { createFamily } from '@/lib/actions/family';

export default function AdminFamiliesPage() {
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [familiesData, setFamiliesData] = useState<any[]>([]);
  
  // Create Form State
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchFamilies = async () => {
    if (currentUser?.role !== 'super_admin') return;
    try {
      const { data: families } = await supabase.from('families').select('*').order('created_at', { ascending: false });
      
      if (!families) return;

      const familyStats = await Promise.all(families.map(async (fam) => {
        const { count: memberCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('family_id', fam.id);
        const { count: documentCount } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('family_id', fam.id);
        
        return {
          family: fam,
          memberCount: memberCount || 0,
          documentCount: documentCount || 0,
        };
      }));

      setFamiliesData(familyStats);
    } catch (err) {
      console.error('Failed to load families:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, [currentUser]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName || !adminEmail || !adminFullName) return;
    
    setCreateLoading(true);
    setCreateError(null);
    
    const { error } = await createFamily(createName, adminEmail, adminFullName);
    
    if (error) {
      setCreateError(error);
      setCreateLoading(false);
    } else {
      setShowCreate(false);
      setCreateName('');
      setAdminEmail('');
      setAdminFullName('');
      fetchFamilies();
      setCreateLoading(false);
    }
  };

  if (currentUser?.role !== 'super_admin') {
    return <div className="p-8 text-center text-red-500">Access Denied. Super Admin only.</div>;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white dark:bg-gray-800 rounded-3xl animate-pulse border border-gray-100 dark:border-gray-700"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Families Overview</h1>
          <p className="text-gray-500 mt-1">Manage all vaults across the system</p>
        </div>
        <button 
          onClick={() => setShowCreate(!showCreate)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center"
        >
          <Users className="w-5 h-5 mr-2" />
          {showCreate ? 'Cancel' : 'New Family Vault'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Create New Family & Assign Admin</h2>
          <form onSubmit={handleCreateFamily} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Family Vault Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Smith Family"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Admin Full Name</label>
              <input
                type="text"
                required
                placeholder="John Smith"
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Admin Email Address</label>
              <input
                type="email"
                required
                placeholder="john@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="md:col-span-3 flex justify-end items-center mt-2">
              {createError && <p className="text-red-500 text-sm mr-4">{createError}</p>}
              <button
                type="submit"
                disabled={createLoading}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center"
              >
                {createLoading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</> : 'Create & Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {familiesData.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 text-lg">No families found in the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {familiesData.map((data) => (
            <FamilyStatsCard 
              key={data.family.id}
              family={data.family}
              memberCount={data.memberCount}
              documentCount={data.documentCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
