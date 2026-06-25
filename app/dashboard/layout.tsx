'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import KeyInitModal from '@/components/auth/KeyInitModal';
import { logAuditEvent } from '@/lib/audit';
import { startKeepAlive, startAutoLogout } from '@/lib/session';
import * as Dialog from '@radix-ui/react-dialog';
import { Home, FileText, Upload, Users, Settings, Shield, Menu, X, BarChart2 } from 'lucide-react';
import SearchBar from '@/components/search/SearchBar';
import QueryProvider from '@/components/providers/QueryProvider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  
  const setCurrentUser = useVaultStore((state) => state.setCurrentUser);
  const sessionReady = useVaultStore((state) => state.sessionReady);
  const clearSession = useVaultStore((state) => state.clearSession);
  const currentUser = useVaultStore((state) => state.currentUser);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.push('/login');
        return;
      }

      const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', { 
        user_id: user.id 
      });

      if (roleError || !roleData || roleData.length === 0) {
        router.push('/login');
        return;
      }

      const role = roleData[0].role;
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, family_id')
        .eq('id', user.id)
        .single();

      setCurrentUser({
        id: user.id,
        email: user.email || '',
        role: role,
        family_id: profile?.family_id || null,
        full_name: profile?.full_name || ''
      });

      setLoading(false);
    }

    checkSession();
  }, [router, setCurrentUser]);

  useEffect(() => {
    if (!currentUser) return;
    
    const cleanupKeepAlive = startKeepAlive();
    const cleanupAutoLogout = startAutoLogout(() => {
      // Prevent logout if currently uploading
      if (useVaultStore.getState().isUploading) return;
      
      logAuditEvent('auto_logout', 'session', currentUser.id);
      clearSession();
      router.push('/login');
    });

    return () => {
      cleanupKeepAlive();
      cleanupAutoLogout();
    };
  }, [currentUser, clearSession, router]);

  const handleLogout = async () => {
    await logAuditEvent('logout', 'system', currentUser?.id || 'unknown');
    await supabase.auth.signOut();
    clearSession();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const isAdminOrSuperAdmin = currentUser?.role === 'family_admin' || currentUser?.role === 'super_admin';

  const navLinks = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/dashboard/documents', label: 'Documents', icon: FileText },
    { href: '/dashboard/upload', label: 'Upload', icon: Upload },
    ...(isAdminOrSuperAdmin ? [{ href: '/dashboard/family', label: 'Family', icon: Users }] : []),
    ...(isAdminOrSuperAdmin ? [{ href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 }] : []),
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  const renderNavLinks = (onClick?: () => void) => (
    <nav className="flex-1 px-4 py-4 space-y-2">
      {navLinks.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClick}
            className={`
              flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors
              ${isActive 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}
            `}
          >
            <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row pb-16 md:pb-0">
      {!sessionReady && <KeyInitModal />}

      {/* Mobile Header with Hamburger Sheet */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex justify-between items-center fixed top-0 w-full z-40">
        <span className="text-xl font-bold text-gray-800 dark:text-white">FamilyVault</span>
        
        <Dialog.Root open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <Dialog.Trigger asChild>
            <button className="text-gray-500 hover:text-gray-700 dark:text-gray-300 p-2 -mr-2">
              <Menu className="w-6 h-6" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm transition-opacity" />
            <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-3/4 max-w-sm bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 p-6 animate-in slide-in-from-right sm:duration-300">
              <div className="flex items-center justify-between mb-8">
                <Dialog.Title className="text-2xl font-bold text-blue-600 dark:text-blue-400">Vault Menu</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-gray-400 hover:text-gray-500 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              {renderNavLinks(() => setIsSidebarOpen(false))}
              <div className="mt-8 px-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                  Logout
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex-shrink-0 flex-col fixed inset-y-0 z-30">
        <div className="p-6">
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">FamilyVault</span>
        </div>
        {renderNavLinks()}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64 pt-16 md:pt-0">
        <header className="hidden md:flex bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 px-6 py-4 items-center justify-between sticky top-0 z-20">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex-shrink-0 mr-4">
            {navLinks.find(l => l.href === pathname)?.label || 'Dashboard'}
          </h2>
          <div className="flex-1 max-w-2xl px-4">
            <SearchBar />
          </div>
          <div className="flex items-center space-x-4 flex-shrink-0">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {currentUser?.full_name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <QueryProvider>
            {children}
          </QueryProvider>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around items-center p-2 pb-safe z-40">
        {navLinks.slice(0, 5).map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-lg transition-colors ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'fill-blue-100 dark:fill-blue-900/50' : ''}`} />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
