import React from 'react';
import { Users, FileText, Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface FamilyStatsCardProps {
  family: {
    id: string;
    name: string;
    created_at: string;
    subscription_tier?: string;
  };
  memberCount: number;
  documentCount: number;
}

export default function FamilyStatsCard({ family, memberCount, documentCount }: FamilyStatsCardProps) {
  return (
    <Link 
      href={`/admin/families/${family.id}`}
      className="block bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {family.name}
          </h3>
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="w-3 h-3 mr-1" />
            Created {new Date(family.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center text-gray-500 dark:text-gray-400 mb-2">
            <Users className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Members</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {memberCount}
          </p>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center text-gray-500 dark:text-gray-400 mb-2">
            <FileText className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium uppercase tracking-wider">Documents</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {documentCount}
          </p>
        </div>
      </div>
      
      {family.subscription_tier && (
        <div className="mt-4 flex justify-end">
          <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg capitalize">
            {family.subscription_tier} Tier
          </span>
        </div>
      )}
    </Link>
  );
}
