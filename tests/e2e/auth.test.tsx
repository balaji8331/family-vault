import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    }
  }
}));

describe('Auth Flow', () => {
  it('renders login options correctly', () => {
    render(<LoginPage />);
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Use Passkey/i)).toBeInTheDocument();
    expect(screen.getByText(/Send Magic Link/i)).toBeInTheDocument();
  });

  it('email login calls signInWithOtp', async () => {
    const { supabase } = await import('@/lib/supabase/client');
    render(<LoginPage />);
    
    // Check Email flow
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.click(screen.getByText(/Send Magic Link/i));
    
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { 
        emailRedirectTo: expect.any(String),
        shouldCreateUser: false 
      }
    });
  });

  it('oauth login calls signInWithOAuth', async () => {
    const { supabase } = await import('@/lib/supabase/client');
    render(<LoginPage />);
    
    fireEvent.click(screen.getByText(/Continue with Google/i));
    
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: expect.any(String),
      }
    });
  });
});
