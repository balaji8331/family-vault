'use client';

import React from 'react';

export type DecryptStatus = 'fetching' | 'decrypting' | 'rendering' | 'ready' | 'error';

interface DecryptProgressProps {
  status: DecryptStatus;
  errorMsg?: string | null;
  onRetry?: () => void;
}

export default function DecryptProgress({ status, errorMsg, onRetry }: DecryptProgressProps) {
  if (status === 'error') {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-100 dark:border-red-800/50 mt-10">
        <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">Decryption Failed</h2>
        <p className="text-red-600 dark:text-red-300">{errorMsg || 'An unknown error occurred.'}</p>
        {onRetry && (
          <button 
            onClick={onRetry} 
            className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const getStatusText = () => {
    switch (status) {
      case 'fetching':
        return 'Securely fetching encrypted blob...';
      case 'decrypting':
        return 'Decrypting locally with your key...';
      case 'rendering':
        return 'Preparing viewer...';
      default:
        return 'Loading...';
    }
  };

  return (
    <div className="text-center space-y-4 py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      <p className="text-gray-500 dark:text-gray-400 font-medium animate-pulse">
        {getStatusText()}
      </p>
      
      <div className="max-w-xs mx-auto mt-6 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-in-out"
          style={{ 
            width: status === 'fetching' ? '33%' : 
                   status === 'decrypting' ? '66%' : 
                   status === 'rendering' ? '90%' : '100%' 
          }}
        ></div>
      </div>
    </div>
  );
}
