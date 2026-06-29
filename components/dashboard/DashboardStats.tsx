'use client';

import React, { useEffect, useState } from 'react';
import { useVaultStore } from '@/store/vault.store';
import { supabase } from '@/lib/supabase/client';

export default function DashboardStats() {
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    sharedWithMe: 0,
    expiringSoon: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      if (!currentUser?.id) return;

      try {
        const { count: totalDocs } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', currentUser.id);

        const { count: sharedDocs } = await supabase
          .from('document_access')
          .select('*', { count: 'exact', head: true })
          .eq('granted_to', currentUser.id);

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const { count: expiringDocs } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', currentUser.id)
          .lte('expiry_date', thirtyDaysFromNow.toISOString())
          .gte('expiry_date', new Date().toISOString());

        setStats({
          totalDocuments: totalDocs || 0,
          sharedWithMe: sharedDocs || 0,
          expiringSoon: expiringDocs || 0,
        });
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm h-32 animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {currentUser?.full_name?.split(' ')[0] || 'User'}!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Here is an overview of your protected documents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Documents" value={stats.totalDocuments} icon={<DocumentIcon className="w-8 h-8" />} color="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard title="Shared With Me" value={stats.sharedWithMe} icon={<UsersIcon className="w-8 h-8" />} color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard title="Expiring Soon" value={stats.expiringSoon} icon={<ClockIcon className="w-8 h-8" />} color="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
      </div>
    </>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center">
      <div className={`p-4 rounded-2xl mr-4 ${color}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      </div>
    </div>
  );
}

// Icons
function DocumentIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function UsersIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function ClockIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
