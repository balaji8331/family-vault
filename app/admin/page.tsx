'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { Users, FileText, Database, ShieldAlert, Activity, ChevronDown, ChevronRight, Trash2, Ban } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export default function SuperAdminPage() {
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  
  // Platform Stats
  const [stats, setStats] = useState({
    totalFamilies: 0,
    totalUsers: 0,
    totalDocuments: 0,
    totalStorage: 0,
    expiringDocs: 0,
    newFamilies: 0
  });

  // Families
  const [families, setFamilies] = useState<any[]>([]);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Record<string, any[]>>({});
  
  // Create Family
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newFamilyCode, setNewFamilyCode] = useState<string | null>(null);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState({ family: '', action: '' });

  // Platform Health
  const [health, setHealth] = useState({
    lastEdgeRun: null as string | null,
    failedAudits: 0,
    storageByFamily: [] as any[]
  });

  useEffect(() => {
    async function fetchData() {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.push('/login');
        return;
      }
      
      const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', { user_id: user.id });
      if (roleError || !roleData || roleData.length === 0 || roleData[0].role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }

      // 1. Stats
      const [{ count: fCount }, { count: uCount }, { data: docs }, { count: expDocs }, { count: newFCount }] = await Promise.all([
        supabase.from('families').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('documents').select('file_size_bytes'),
        supabase.from('documents').select('*', { count: 'exact', head: true }).lt('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('families').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setDate(1)).toISOString())
      ]);

      const totalStorage = docs?.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0) || 0;
      
      setStats({
        totalFamilies: fCount || 0,
        totalUsers: uCount || 0,
        totalDocuments: docs?.length || 0,
        totalStorage,
        expiringDocs: expDocs || 0,
        newFamilies: newFCount || 0
      });

      // 2. Families
      const { data: familyData } = await supabase.from('families').select('*').order('created_at', { ascending: false });
      
      if (familyData) {
        const enrichedFamilies = await Promise.all(familyData.map(async (f) => {
          const [{ count: mCount }, { data: fDocs }] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('family_id', f.id),
            supabase.from('documents').select('file_size_bytes').eq('family_id', f.id)
          ]);
          return {
            ...f,
            memberCount: mCount || 0,
            documentCount: fDocs?.length || 0,
            storageUsed: fDocs?.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0) || 0
          };
        }));
        setFamilies(enrichedFamilies);
        
        setHealth(prev => ({
          ...prev,
          storageByFamily: enrichedFamilies.map(f => ({ name: f.name || f.id, bytes: f.storageUsed }))
        }));
      }

      // 3. Audit Logs
      const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
      setAuditLogs(logs || []);

      // 4. Health
      const { data: edgeRun } = await supabase.from('audit_logs').select('created_at').eq('action', 'expiry_reminder_sent').order('created_at', { ascending: false }).limit(1);
      const { count: failedCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).ilike('metadata::text', '%error%');

      setHealth(prev => ({
        ...prev,
        lastEdgeRun: edgeRun?.[0]?.created_at || null,
        failedAudits: failedCount || 0
      }));

      setLoading(false);
    }

    fetchData();
  }, [router]);

  const toggleFamilyExpand = async (familyId: string) => {
    if (expandedFamily === familyId) {
      setExpandedFamily(null);
      return;
    }
    
    if (!familyMembers[familyId]) {
      const { data } = await supabase.from('users').select('*').eq('family_id', familyId);
      setFamilyMembers(prev => ({ ...prev, [familyId]: data || [] }));
    }
    setExpandedFamily(familyId);
  };

  const handleSuspend = async (familyId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'unsuspend' : 'suspend'} this family?`)) return;
    
    try {
      const res = await fetch('/api/admin/suspend-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, adminId: currentUser?.id })
      });
      if (res.ok) {
        setFamilies(families.map(f => f.id === familyId ? { ...f, suspended: !currentStatus } : f));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (familyId: string) => {
    if (!confirm('DANGER: Are you sure you want to completely delete this family and all their data? This cannot be undone.')) return;
    
    try {
      const res = await fetch('/api/admin/delete-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, adminId: currentUser?.id })
      });
      if (res.ok) {
        setFamilies(families.filter(f => f.id !== familyId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim() || !currentUser) return;
    
    setIsCreating(true);
    setCreateError(null);
    setNewFamilyCode(null);
    
    try {
      const res = await fetch('/api/admin/create-family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFamilyName, adminId: currentUser.id })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create family');
      
      setNewFamilyCode(data.family.family_code);
      
      // Add to table
      setFamilies([{
        ...data.family,
        memberCount: 0,
        documentCount: 0,
        storageUsed: 0,
        suspended: false
      }, ...families]);
      
      setStats(prev => ({
        ...prev,
        totalFamilies: prev.totalFamilies + 1,
        newFamilies: prev.newFamilies + 1
      }));
      
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const exportCSV = () => {
    const csv = ['ID,Actor,Family,Action,Target Type,Target ID,Date'];
    auditLogs.forEach(l => {
      csv.push(`${l.id},${l.actor_id},${l.family_id},${l.action},${l.target_type},${l.target_id},${l.created_at}`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit_logs.csv';
    a.click();
  };

  if (loading) return <div className="p-8 text-center">Loading super admin...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin Console</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Platform overview and family management.</p>
      </div>

      {/* 1. Platform Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Families</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalFamilies}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-green-600 mt-4">+{stats.newFamilies} this month</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalUsers}</h3>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Documents</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalDocuments}</h3>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-yellow-600 mt-4">{stats.expiringDocs} expiring in 30d</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Storage</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatBytes(stats.totalStorage)}</h3>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
              <Database className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Platform Health (Moved up for visibility) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-500" />
            Platform Health
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Last Edge Function Run</p>
            <p className="font-semibold dark:text-white">{health.lastEdgeRun ? new Date(health.lastEdgeRun).toLocaleString() : 'Never'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Failed Audits</p>
            <p className="font-semibold text-red-500">{health.failedAudits}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Top Storage User</p>
            <p className="font-semibold dark:text-white">
              {health.storageByFamily.sort((a,b) => b.bytes - a.bytes)[0]?.name || 'N/A'} 
              ({formatBytes(health.storageByFamily.sort((a,b) => b.bytes - a.bytes)[0]?.bytes || 0)})
            </p>
          </div>
        </div>
      </div>

      {/* 2. Families Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Families</h2>
          <button 
            onClick={() => {
              setNewFamilyName('');
              setCreateError(null);
              setNewFamilyCode(null);
              setCreateModalOpen(true);
            }} 
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
          >
            <Users className="w-4 h-4 mr-2" />
            Provision Family Space
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="p-4 text-sm font-medium text-gray-500">Name / ID</th>
                <th className="p-4 text-sm font-medium text-gray-500">Family Code</th>
                <th className="p-4 text-sm font-medium text-gray-500">Members</th>
                <th className="p-4 text-sm font-medium text-gray-500">Documents</th>
                <th className="p-4 text-sm font-medium text-gray-500">Storage</th>
                <th className="p-4 text-sm font-medium text-gray-500">Status</th>
                <th className="p-4 text-sm font-medium text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {families.map((family) => (
                <React.Fragment key={family.id}>
                  <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-4">
                      <button onClick={() => toggleFamilyExpand(family.id)} className="flex items-center text-left font-medium text-gray-900 dark:text-white hover:text-blue-600">
                        {expandedFamily === family.id ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                        {family.name || family.id.substring(0, 8)}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-300">{family.family_code || '---'}</span>
                        {family.family_code && (
                          <button onClick={() => {
                            navigator.clipboard.writeText(family.family_code);
                            alert('Code copied!');
                          }} className="text-gray-400 hover:text-blue-500 transition-colors">
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{family.memberCount}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{family.documentCount}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-300">{formatBytes(family.storageUsed)}</td>
                    <td className="p-4">
                      {family.suspended ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">Suspended</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">Active</span>
                      )}
                    </td>
                    <td className="p-4 flex justify-end space-x-2">
                      <button 
                        onClick={() => handleSuspend(family.id, family.suspended)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title={family.suspended ? "Unsuspend" : "Suspend"}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(family.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Family"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  {expandedFamily === family.id && (
                    <tr className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700">
                      <td colSpan={7} className="p-4 pl-10">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Members:</h4>
                          {familyMembers[family.id]?.map((m) => (
                            <div key={m.id} className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                              <span className="w-48 font-medium">{m.full_name || 'N/A'}</span>
                              <span className="w-32 capitalize">{m.role.replace('_', ' ')}</span>
                              <span>{m.email || 'No email'}</span>
                              {m.passkey_registered && <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded">Passkey</span>}
                            </div>
                          ))}
                          {(!familyMembers[family.id] || familyMembers[family.id].length === 0) && (
                            <p className="text-sm text-gray-500">No members found.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Global Audit Log */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2 text-blue-500" />
            Global Audit Log
          </h2>
          <button onClick={exportCSV} className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors">
            Export CSV
          </button>
        </div>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex space-x-4">
          <input 
            type="text" 
            placeholder="Filter by action..." 
            value={auditFilter.action}
            onChange={e => setAuditFilter(prev => ({...prev, action: e.target.value}))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white outline-none"
          />
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm">
              <tr>
                <th className="p-3 font-medium text-gray-500">Date</th>
                <th className="p-3 font-medium text-gray-500">Action</th>
                <th className="p-3 font-medium text-gray-500">Family ID</th>
                <th className="p-3 font-medium text-gray-500">Actor</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.filter(l => l.action.includes(auditFilter.action)).map((log) => (
                <tr key={log.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="p-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-3 font-medium text-gray-900 dark:text-white">{log.action}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{log.family_id?.substring(0,8) || 'N/A'}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{log.actor_id?.substring(0,8) || 'System'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Create Family Modal */}
      <Dialog.Root open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 z-50">
            <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Provision Family Space
            </Dialog.Title>
            
            {!newFamilyCode ? (
              <form onSubmit={handleCreateFamily} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create a new family vault space. This will generate a unique access code you can share with the family members. You will not be automatically added to this space.
                </p>
                <div>
                  <input 
                    type="text" 
                    placeholder="Family Name (e.g., The Smiths)" 
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {createError && <p className="text-red-500 text-sm">{createError}</p>}
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isCreating}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isCreating ? 'Provisioning...' : 'Provision Space'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center space-y-6 py-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Space Created!</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Share this code with the family so they can join.</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold tracking-widest text-gray-900 dark:text-white">
                    {newFamilyCode}
                  </span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(newFamilyCode);
                      alert('Code copied!');
                    }}
                    className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded-lg transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <button 
                  onClick={() => setCreateModalOpen(false)}
                  className="w-full py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium"
                >
                  Done
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
