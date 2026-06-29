'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, AlertTriangle, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchDocuments, Document } from '@/lib/search';
import { useVaultStore } from '@/store/vault.store';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentUser = useVaultStore((state) => state.currentUser);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && 
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, currentUser?.id],
    queryFn: () => searchDocuments(debouncedQuery, currentUser?.family_id || '', currentUser?.id || ''),
    enabled: debouncedQuery.length > 0 && !!currentUser?.id,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || !results) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex].id);
      } else if (results.length > 0) {
        handleSelect(results[0].id);
      }
    }
  };

  const handleSelect = (id: string) => {
    setIsOpen(false);
    setQuery('');
    setDebouncedQuery('');
    router.push(`/dashboard/documents/${id}`);
  };

  return (
    <div className="relative w-full max-w-md hidden md:block z-50">
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search documents... (Cmd+K)"
          className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 rounded-xl text-sm outline-none transition-colors dark:text-white"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button 
            onClick={() => { setQuery(''); setDebouncedQuery(''); inputRef.current?.focus(); }}
            className="absolute right-3 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && query.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-96 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : results && results.length > 0 ? (
            <ul className="py-2">
              {results.map((doc, idx) => (
                <li 
                  key={doc.id}
                  onClick={() => handleSelect(doc.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between ${
                    selectedIndex === idx ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center overflow-hidden">
                    <FileText className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {doc.file_name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{doc.doc_type}</p>
                    </div>
                  </div>
                  {doc.expiry_date && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                    <div title="Expiring soon">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
