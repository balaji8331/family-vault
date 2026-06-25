import { supabase } from '@/lib/supabase/client';

export async function getDocumentsByType(familyId: string): Promise<{ doc_type: string; count: number }[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('doc_type')
      .eq('family_id', familyId);

    if (error || !data) return [];

    const counts = data.reduce((acc: any, doc) => {
      const type = doc.doc_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(counts).map(key => ({ doc_type: key, count: counts[key] }));
  } catch {
    return [];
  }
}

export async function getUploadActivity(familyId: string): Promise<{ week: string; count: number }[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('uploaded_at')
      .eq('family_id', familyId);

    if (error || !data) return [];

    // Group by week
    const weeks: Record<string, number> = {};
    const now = new Date();
    // Initialize last 12 weeks with 0
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStr = `${d.getFullYear()}-W${getWeekNumber(d)}`;
      weeks[weekStr] = 0;
    }

    data.forEach(doc => {
      const d = new Date(doc.uploaded_at);
      const weekStr = `${d.getFullYear()}-W${getWeekNumber(d)}`;
      if (weeks[weekStr] !== undefined) {
        weeks[weekStr]++;
      }
    });

    return Object.keys(weeks).map(w => ({ week: w, count: weeks[w] }));
  } catch {
    return [];
  }
}

export async function getExpiryTimeline(familyId: string): Promise<{ month: string; count: number }[]> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('expiry_date')
      .eq('family_id', familyId)
      .not('expiry_date', 'is', null);

    if (error || !data) return [];

    const months: Record<string, number> = {};
    const now = new Date();
    // Initialize next 12 months with 0
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      months[monthStr] = 0;
    }

    data.forEach(doc => {
      if (!doc.expiry_date) return;
      const d = new Date(doc.expiry_date);
      const monthStr = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
      if (months[monthStr] !== undefined) {
        months[monthStr]++;
      }
    });

    return Object.keys(months).map(m => ({ month: m, count: months[m] }));
  } catch {
    return [];
  }
}

export async function getStorageUsage(familyId: string): Promise<{ total_bytes: number; by_type: { doc_type: string; bytes: number }[] }> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('doc_type, file_size_bytes')
      .eq('family_id', familyId);

    if (error || !data) return { total_bytes: 0, by_type: [] };

    let total = 0;
    const byType: Record<string, number> = {};

    data.forEach(doc => {
      const size = doc.file_size_bytes || 0;
      total += size;
      const type = doc.doc_type || 'unknown';
      byType[type] = (byType[type] || 0) + size;
    });

    return {
      total_bytes: total,
      by_type: Object.keys(byType).map(key => ({ doc_type: key, bytes: byType[key] }))
    };
  } catch {
    return { total_bytes: 0, by_type: [] };
  }
}

// Helper to get ISO week number
function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return weekNo;
}
