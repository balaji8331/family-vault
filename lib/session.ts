import { supabase } from '@/lib/supabase/client';

export function startKeepAlive() {
  // Call supabase.auth.getSession() every 4 minutes (240,000 ms)
  const intervalId = setInterval(async () => {
    try {
      await supabase.auth.getSession();
    } catch (err) {
      console.error('Keep-alive failed', err);
    }
  }, 4 * 60 * 1000);

  return () => clearInterval(intervalId);
}

export function startAutoLogout(onLogout: () => void, timeoutMinutes = 30) {
  let timeoutId: NodeJS.Timeout;

  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      onLogout();
    }, timeoutMinutes * 60 * 1000);
  };

  const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];

  // Setup initial timeout and event listeners
  resetTimeout();
  events.forEach((event) => {
    window.addEventListener(event, resetTimeout, { passive: true });
  });

  return () => {
    clearTimeout(timeoutId);
    events.forEach((event) => {
      window.removeEventListener(event, resetTimeout);
    });
  };
}
