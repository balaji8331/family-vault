import React, { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import AuditFilters from '@/components/audit/AuditFilters';
import AuditLogRow, { type AuditLogEntry } from '@/components/audit/AuditLogRow';
import AuditLogTable from '@/components/audit/AuditLogTable';
import AuditPagination from '@/components/audit/AuditPagination';
import type { AuditFilters as AuditFilterType } from '@/lib/actions/audit';

const PAGE_SIZE = 50;

interface AuditPageProps {
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
    action?: string;
    actor?: string;
    targetType?: string;
    familyFilter?: string;
  }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  // Get user role & family_id from DB — never from URL params
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id, role, family_id, full_name')
    .eq('id', user.id)
    .single();

  if (dbError || !dbUser) redirect('/login');

  // Role gate: members cannot see audit logs
  if (dbUser.role === 'member') redirect('/dashboard');

  // Safely parse and validate page param — must be non-negative integer
  const params = await searchParams;
  const rawPage = parseInt(params.page ?? '0', 10);
  const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
  const rangeStart = page * PAGE_SIZE;
  const rangeEnd = rangeStart + PAGE_SIZE - 1;

  // Build filters from URL params
  const filters: AuditFilterType = {
    from: params.from || undefined,
    to: params.to || undefined,
    action: params.action || undefined,
    actor: params.actor || undefined,
    targetType: params.targetType || undefined,
  };

  const isSuperAdmin = dbUser.role === 'super_admin';
  
  // For Super Admin: allow family filter via URL (it's a filter, not a security boundary)
  // For Family Admin: ALWAYS use their own family_id — URL param ignored
  const scopedFamilyId = isSuperAdmin
    ? (params.familyFilter || null) // super_admin can filter but can also see all
    : dbUser.family_id; // family_admin: always derived from session, never URL

  // Build the audit_logs query with single JOIN to avoid N+1
  let query = supabase
    .from('audit_logs')
    .select(`
      id,
      family_id,
      action,
      target_type,
      target_id,
      metadata,
      created_at,
      actor:users!actor_id (
        full_name,
        role
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  // Scope by family
  if (!isSuperAdmin) {
    // family_admin sees ONLY their own family — derived from session
    query = query.eq('family_id', scopedFamilyId);
  } else if (scopedFamilyId) {
    // super_admin optional family filter
    query = query.eq('family_id', scopedFamilyId);
  }

  // Apply URL filters
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to + 'T23:59:59.999Z');
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.targetType) query = query.eq('target_type', filters.targetType);

  // Server-side pagination with .range()
  query = query.range(rangeStart, rangeEnd);

  const { data: rawLogs, count, error: logsError } = await query;

  if (logsError) {
    console.error('Audit log fetch error:', logsError);
  }

  // Flatten joined actor fields & apply in-memory actor name filter
  let logs: AuditLogEntry[] = (rawLogs || []).map((log: any) => ({
    id: log.id,
    family_id: log.family_id,
    action: log.action,
    target_type: log.target_type,
    target_id: log.target_id,
    metadata: log.metadata,
    created_at: log.created_at,
    actor_name: log.actor?.full_name ?? null,
    actor_role: log.actor?.role ?? null,
  }));

  // Actor name filter applied in-memory (join field limitation)
  if (filters.actor) {
    const actorLower = filters.actor.toLowerCase();
    logs = logs.filter((l) => l.actor_name?.toLowerCase().includes(actorLower));
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch all families for Super Admin family dropdown
  let families: { id: string; name: string }[] = [];
  if (isSuperAdmin) {
    const { data: famData } = await supabase.from('families').select('id, name').order('name');
    families = famData || [];
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-500" />
            Audit Logs
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? 'System-wide activity across all families'
              : 'Activity within your family vault'}
          </p>
        </div>
      </div>

      {/* Filters (client component — updates URL, triggers server re-render) */}
      <Suspense>
        <AuditFilters
          families={families}
          isSuperAdmin={isSuperAdmin}
        />
      </Suspense>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{totalCount}</span> total log{totalCount !== 1 ? 's' : ''}
          {totalPages > 1 && (
            <span className="ml-2">· Page <span className="font-semibold text-gray-900 dark:text-white">{page + 1}</span> of {totalPages}</span>
          )}
        </p>
      </div>

      {/* Interactive table with drawer (client wrapper) */}
      <Suspense>
        <AuditLogTable
          logs={logs}
          isSuperAdmin={isSuperAdmin}
          currentFilters={filters}
          currentPage={page}
          totalCount={totalCount}
          onPageChange={() => {}}
        />
      </Suspense>

      {/* Server-side pagination (client component using URL params) */}
      <Suspense>
        <AuditPagination currentPage={page} totalPages={totalPages} />
      </Suspense>
    </div>
  );
}
