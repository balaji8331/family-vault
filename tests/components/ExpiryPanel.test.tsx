import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExpiryPanel from '../../components/dashboard/ExpiryPanel';
import { createClient } from '../../lib/supabase/server';

vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe('ExpiryPanel Server Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockSupabase = (documents: any[] | null, user: any = { id: 'user1' }) => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { full_name: 'Test Owner' } }),
          };
        }
        if (table === 'documents') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: documents, error: null }),
          };
        }
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);
  };

  it('renders empty state when no documents are expiring', async () => {
    setupMockSupabase([]);

    // Resolving Server Component manually for tests
    const Panel = await ExpiryPanel();
    render(Panel as React.ReactElement);

    expect(screen.getByText('All your documents are up to date.')).toBeDefined();
    expect(screen.getByText('Up to date')).toBeDefined();
  });

  it('renders documents with correct urgency groupings', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const getDaysAway = (days: number) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString();
    };

    setupMockSupabase([
      { id: '1', file_name: 'Doc 1 (Critical)', doc_type: 'Passport', expiry_date: getDaysAway(2), owner_id: 'user1' },
      { id: '2', file_name: 'Doc 2 (Warning)', doc_type: 'License', expiry_date: getDaysAway(10), owner_id: 'user1' },
      { id: '3', file_name: 'Doc 3 (Upcoming)', doc_type: 'Insurance', expiry_date: getDaysAway(20), owner_id: 'user1' },
    ]);

    const Panel = await ExpiryPanel();
    render(Panel as React.ReactElement);

    expect(screen.getByText('Expiring Soon')).toBeDefined();
    
    // Critical (<=7)
    expect(screen.getByText('Critical')).toBeDefined();
    expect(screen.getByText('Doc 1 (Critical)')).toBeDefined();
    expect(screen.getByText(/2 days? left/)).toBeDefined();

    // Warning (8-14)
    expect(screen.getByText('Warning')).toBeDefined();
    expect(screen.getByText('Doc 2 (Warning)')).toBeDefined();
    expect(screen.getByText(/10 days? left/)).toBeDefined();

    // Upcoming (15-30)
    expect(screen.getByText('Upcoming')).toBeDefined();
    expect(screen.getByText('Doc 3 (Upcoming)')).toBeDefined();
    expect(screen.getByText(/20 days? left/)).toBeDefined();
  });
});
