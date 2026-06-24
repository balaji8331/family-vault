'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';

interface FamilyData {
  id: string;
  name: string;
  created_at: string;
  memberCount: number;
  documentCount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFamilies: 0,
    totalMembers: 0,
    totalDocuments: 0,
  });
  const [families, setFamilies] = useState<FamilyData[]>([]);
  
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [newDocType, setNewDocType] = useState('');
  const [addingDocType, setAddingDocType] = useState(false);

  useEffect(() => {
    async function initAdmin() {
      try {
        // 1. Check Supabase session first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }

        // 2. Verify Super Admin role
        let isSuperAdmin = false;
        if (currentUser?.role === 'super_admin') {
          isSuperAdmin = true;
        } else {
          // Fallback to checking the database if store is empty on reload
          const { data: roleData } = await supabase.rpc('get_user_role', { user_id: session.user.id });
          if (roleData === 'super_admin') {
            isSuperAdmin = true;
          }
        }

        if (!isSuperAdmin) {
          router.push('/dashboard');
          return;
        }

        // 3. Fetch Admin Data
        const { count: totalFamilies } = await supabase.from('families').select('*', { count: 'exact', head: true });
        const { count: totalMembers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalDocs } = await supabase.from('documents').select('*', { count: 'exact', head: true });

        setStats({
          totalFamilies: totalFamilies || 0,
          totalMembers: totalMembers || 0,
          totalDocuments: totalDocs || 0,
        });

        const { data: familiesData } = await supabase
          .from('families')
          .select('id, name, created_at')
          .order('created_at', { ascending: false });

        if (familiesData) {
          const enrichedFamilies = await Promise.all(familiesData.map(async (family) => {
            const { count: mCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('family_id', family.id);
            const { count: dCount } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('family_id', family.id);
            return {
              id: family.id,
              name: family.name,
              created_at: family.created_at,
              memberCount: mCount || 0,
              documentCount: dCount || 0,
            };
          }));
          setFamilies(enrichedFamilies);
        }

        // Fetch Document Types
        const { data: docTypes, error: docTypesError } = await supabase
          .from('document_types')
          .select('*')
          .order('name', { ascending: true });
          
        if (!docTypesError && docTypes) {
          setDocumentTypes(docTypes);
        }
        setLoadingTypes(false);

      } catch (error) {
        console.error('Error initializing admin:', error);
      } finally {
        setLoading(false);
      }
    }

    initAdmin();
  }, [router]);

  const handleAddDocType = async () => {
    if (!newDocType.trim() || addingDocType) return;
    setAddingDocType(true);
    try {
      const valueSlug = newDocType.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const { data, error } = await supabase
        .from('document_types')
        .insert({ name: newDocType.trim(), value: valueSlug })
        .select()
        .single();
        
      if (error) throw error;
      setDocumentTypes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDocType('');
    } catch (err) {
      console.error('Failed to add document type:', err);
      alert('Failed to add document type. It may already exist.');
    } finally {
      setAddingDocType(false);
    }
  };

  const handleDeleteDocType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document type?')) return;
    try {
      const { error } = await supabase.from('document_types').delete().eq('id', id);
      if (error) throw error;
      setDocumentTypes(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete document type:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin Console</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Manage FamilyVault platform operations.</p>
          </div>
          <button className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors shadow-sm">
            Create Family
          </button>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Families</h3>
            <span className="text-4xl font-bold text-purple-600 dark:text-purple-400">{stats.totalFamilies}</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Members</h3>
            <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">{stats.totalMembers}</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Documents</h3>
            <span className="text-4xl font-bold text-green-600 dark:text-green-400">{stats.totalDocuments}</span>
          </div>
        </div>

        {/* Families Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Registered Families</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm">
                  <th className="px-6 py-4 font-medium border-b dark:border-gray-700">Family Name</th>
                  <th className="px-6 py-4 font-medium border-b dark:border-gray-700">Members</th>
                  <th className="px-6 py-4 font-medium border-b dark:border-gray-700">Documents</th>
                  <th className="px-6 py-4 font-medium border-b dark:border-gray-700">Created Date</th>
                  <th className="px-6 py-4 font-medium border-b dark:border-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {families.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No families found.
                    </td>
                  </tr>
                ) : (
                  families.map((family) => (
                    <tr key={family.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">{family.name}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{family.memberCount}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{family.documentCount}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {new Date(family.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Document Types Management */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Document Types</h2>
          </div>
          <div className="p-6">
            <div className="flex space-x-4 mb-6">
              <input 
                type="text" 
                placeholder="New Document Type (e.g. Health Record)" 
                className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-900 dark:text-white"
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDocType()}
              />
              <button 
                onClick={handleAddDocType}
                disabled={addingDocType || !newDocType.trim()}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingDocType ? 'Adding...' : 'Add Type'}
              </button>
            </div>

            {loadingTypes ? (
              <div className="text-center py-4 text-gray-500">Loading document types...</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {documentTypes.map(type => (
                  <div key={type.id} className="flex items-center bg-gray-100 dark:bg-gray-700 px-4 py-2 rounded-lg">
                    <span className="text-gray-800 dark:text-gray-200 text-sm font-medium">{type.name}</span>
                    <button 
                      onClick={() => handleDeleteDocType(type.id)}
                      className="ml-3 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                {documentTypes.length === 0 && (
                  <p className="text-sm text-gray-500 w-full text-center py-2">No document types found.</p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
