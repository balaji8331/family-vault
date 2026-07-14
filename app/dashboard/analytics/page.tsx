'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useVaultStore } from '@/store/vault.store';
import dynamic from 'next/dynamic';
import { getDocumentsByType, getUploadActivity, getExpiryTimeline, getStorageUsage } from '@/lib/analytics';
import { supabase } from '@/lib/supabase/client';
import { AlertTriangle, Clock, HardDrive, FileText, User } from 'lucide-react';

// Recharts components must be dynamically imported to avoid SSR hydration mismatch
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ec4899'];

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useVaultStore((state) => state.currentUser);
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    byType: [],
    activity: [],
    expiry: [],
    storage: { total_bytes: 0, by_type: [] }
  });
  const [stats, setStats] = useState({
    mostUploadedType: '',
    avgAgeDays: 0,
    topUploader: '',
    nextExpiring: null as any
  });
  const [activeExpiryMonth, setActiveExpiryMonth] = useState<string | null>(null);
  const [expiringDocsList, setExpiringDocsList] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    
    if (currentUser.role === 'member') {
      router.push('/dashboard');
      return;
    }

    const familyId = (currentUser.role === 'super_admin' ? searchParams.get('familyId') : null) || currentUser.family_id;
    if (!familyId) return;

    async function loadData() {
      const [byType, activity, expiry, storage] = await Promise.all([
        getDocumentsByType(familyId!),
        getUploadActivity(familyId!),
        getExpiryTimeline(familyId!),
        getStorageUsage(familyId!)
      ]);

      setData({ byType, activity, expiry, storage });

      // Calculate stats
      const mostUploadedType = [...byType].sort((a,b) => b.count - a.count)[0]?.doc_type || 'N/A';
      
      const { data: rawDocs } = await supabase.from('documents').select('uploaded_at, owner_id, file_name, expiry_date').eq('family_id', familyId!);
      let avgAgeDays = 0;
      let topUploader = 'N/A';
      let nextExpiring = null;
      
      if (rawDocs && rawDocs.length > 0) {
        const now = Date.now();
        const totalAge = rawDocs.reduce((acc, doc) => acc + (now - new Date(doc.uploaded_at).getTime()), 0);
        avgAgeDays = Math.round(totalAge / rawDocs.length / (1000 * 60 * 60 * 24));

        const uploaders = rawDocs.reduce((acc: any, doc) => {
          acc[doc.owner_id] = (acc[doc.owner_id] || 0) + 1;
          return acc;
        }, {});
        const topUploaderId = Object.keys(uploaders).sort((a,b) => uploaders[b] - uploaders[a])[0];
        
        if (topUploaderId) {
          const { data: user } = await supabase.from('users').select('full_name').eq('id', topUploaderId).single();
          if (user) topUploader = user.full_name;
        }

        const expDocs = rawDocs.filter(d => d.expiry_date && new Date(d.expiry_date).getTime() > now).sort((a,b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());
        if (expDocs.length > 0) {
          const d = expDocs[0];
          const daysLeft = Math.ceil((new Date(d.expiry_date!).getTime() - now) / (1000 * 60 * 60 * 24));
          nextExpiring = { name: d.file_name, daysLeft };
        }
      }

      setStats({ mostUploadedType, avgAgeDays, topUploader, nextExpiring });
      setLoading(false);
    }

    loadData();
  }, [currentUser, router, searchParams]);

  const handleBarClick = async (data: any) => {
    setActiveExpiryMonth(data.month);
    if (!currentUser?.family_id) return;
    
    // Parse the month string e.g. "Jun 2026"
    const [mStr, yStr] = data.month.split(' ');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthIdx = months.indexOf(mStr);
    
    const start = new Date(parseInt(yStr), monthIdx, 1).toISOString();
    const end = new Date(parseInt(yStr), monthIdx + 1, 0).toISOString();
    
    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, expiry_date')
      .eq('family_id', currentUser.family_id)
      .gte('expiry_date', start)
      .lte('expiry_date', end);
      
    setExpiringDocsList(docs || []);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const SOFT_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB
  const storagePercent = Math.min(100, Math.round((data.storage.total_bytes / SOFT_LIMIT_BYTES) * 100));

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Family Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Insights into your family's document vault.</p>
      </div>

      {storagePercent > 80 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-yellow-800">Storage Warning</h3>
            <p className="text-sm text-yellow-700 mt-1">Your family is using {storagePercent}% of the 1GB soft limit. Consider deleting unused documents.</p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-2">Most Uploaded Type</p>
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-blue-500 mr-3" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{stats.mostUploadedType}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-2">Avg Document Age</p>
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-green-500 mr-3" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgAgeDays} days</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-2">Top Uploader</p>
          <div className="flex items-center">
            <User className="w-8 h-8 text-purple-500 mr-3" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{stats.topUploader}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-500 mb-2">Next Expiring</p>
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-orange-500 mr-3" />
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                {stats.nextExpiring ? stats.nextExpiring.name : 'None'}
              </h3>
              <p className="text-xs text-orange-600">{stats.nextExpiring ? `in ${stats.nextExpiring.daysLeft} days` : 'All good'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Documents by Type */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Documents by Type</h2>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.byType} dataKey="count" nameKey="doc_type" cx="50%" cy="50%" outerRadius={100} label>
                {data.byType.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Upload Activity */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Upload Activity (Last 12 Weeks)</h2>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.activity}>
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Expiry Timeline */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-auto min-h-[24rem]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Expiry Timeline (Next 12 Months)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.expiry}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" onClick={handleBarClick} cursor="pointer">
                  {data.expiry.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.count >= 3 ? '#ef4444' : entry.count > 0 ? '#eab308' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {activeExpiryMonth && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Expiring in {activeExpiryMonth}</h3>
                <button onClick={() => setActiveExpiryMonth(null)} className="text-xs text-blue-500">Clear</button>
              </div>
              <ul className="space-y-2">
                {expiringDocsList.length === 0 ? <li className="text-sm text-gray-500">No documents</li> :
                 expiringDocsList.map(doc => (
                  <li key={doc.id} className="flex justify-between text-sm">
                    <span className="truncate w-3/4 dark:text-gray-300">{doc.file_name}</span>
                    <span className="text-gray-500">{new Date(doc.expiry_date).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Chart 4: Storage Usage */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
            Storage Usage
            <span className="text-sm font-normal text-gray-500">{formatBytes(data.storage.total_bytes)} / 1 GB</span>
          </h2>
          <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie
                data={[{ name: 'Used', value: data.storage.total_bytes }, { name: 'Free', value: Math.max(0, SOFT_LIMIT_BYTES - data.storage.total_bytes) }]}
                cx="50%"
                cy="50%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={100}
                paddingAngle={0}
                dataKey="value"
              >
                <Cell fill={storagePercent > 80 ? '#ef4444' : '#2563eb'} />
                <Cell fill="#e5e7eb" />
              </Pie>
              <Tooltip formatter={(value) => formatBytes(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center -mt-16">
            <p className="text-3xl font-bold dark:text-white">{storagePercent}%</p>
            <p className="text-sm text-gray-500">Used</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <React.Suspense fallback={<div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}>
      <AnalyticsContent />
    </React.Suspense>
  )
}
