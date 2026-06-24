import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startKeepAlive, startAutoLogout } from '@/lib/session';
import { supabase } from '@/lib/supabase/client';

describe('Session Module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startKeepAlive calls getSession every 4 minutes', () => {
    const cleanup = startKeepAlive();
    
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    
    // Fast forward 4 minutes
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    
    // Fast forward another 4 minutes
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(2);
    
    cleanup();
  });

  it('startKeepAlive cleanup stops interval', () => {
    const cleanup = startKeepAlive();
    cleanup();
    
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
  });

  it('startAutoLogout fires after 30 minutes of inactivity', () => {
    const onLogout = vi.fn();
    const cleanup = startAutoLogout(onLogout, 30);
    
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(onLogout).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(1 * 60 * 1000);
    expect(onLogout).toHaveBeenCalledTimes(1);
    
    cleanup();
  });

  it('startAutoLogout resets timer on mousemove', () => {
    const onLogout = vi.fn();
    const cleanup = startAutoLogout(onLogout, 30);
    
    vi.advanceTimersByTime(15 * 60 * 1000);
    
    // Simulate mouse movement
    window.dispatchEvent(new Event('mousemove'));
    
    vi.advanceTimersByTime(20 * 60 * 1000);
    
    // Total time is 35 minutes, but due to reset at 15m, it hasn't reached 30m since reset
    expect(onLogout).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(10 * 60 * 1000); // 30m since reset
    expect(onLogout).toHaveBeenCalledTimes(1);
    
    cleanup();
  });

  it('startAutoLogout cleanup removes event listeners', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    const cleanup = startAutoLogout(vi.fn(), 30);
    cleanup();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });
});
