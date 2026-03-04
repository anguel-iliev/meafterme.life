'use client';
import { useEffect } from 'react';

// /app/create-profile redirects to /app/ — profile is the memory gallery
export default function CreateProfilePage() {
  useEffect(() => {
    window.location.replace('/app/');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-brand-400/30 border-t-brand-400 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Пренасочване…</p>
      </div>
    </div>
  );
}
