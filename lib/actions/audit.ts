'use server';

import { createClient } from '@/lib/supabase/server';

export interface AuditFilters {
  from?: string;
  to?: string;
  action?: string;
  actor?: string;
  targetType?: string;
}

/** Escapes a single CSV cell value per RFC 4180 */
function escapeCSVCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, double-quote, or newline — wrap in double-quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportAuditLogsCsv(
  filters: AuditFilters
): Promise<{ csv?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Re-verify super_admin role server-side — never trust client-passed role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Not authenticated' };

    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (dbError || !dbUser) return { error: 'User record not found' };
    if (dbUser.role !== 'super_admin') return { error: 'Access denied. Super Admin only.' };

    // Build query with join
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
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to + 'T23:59:59.999Z');
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.targetType) query = query.eq('target_type', filters.targetType);
    // actor name filter — handled by fetching all then filtering (supabase join filter limitation)

    const { data: logs, error: logsError } = await query;
    if (logsError) return { error: logsError.message };

    // Optionally filter by actor name in memory (since it's a join)
    let filteredLogs = logs || [];
    if (filters.actor) {
      const actorLower = filters.actor.toLowerCase();
      filteredLogs = filteredLogs.filter((log: any) =>
        log.actor?.full_name?.toLowerCase().includes(actorLower)
      );
    }

    // CSV header
    const headers = ['timestamp', 'actor_name', 'actor_role', 'action', 'target_type', 'target_id', 'metadata', 'family_id'];
    const rows = filteredLogs.map((log: any) => [
      escapeCSVCell(log.created_at),
      escapeCSVCell(log.actor?.full_name),
      escapeCSVCell(log.actor?.role),
      escapeCSVCell(log.action),
      escapeCSVCell(log.target_type),
      escapeCSVCell(log.target_id),
      escapeCSVCell(log.metadata ? JSON.stringify(log.metadata) : ''),
      escapeCSVCell(log.family_id),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    return { csv };
  } catch (err: any) {
    return { error: err.message };
  }
}
