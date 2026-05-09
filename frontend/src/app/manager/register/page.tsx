'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import RegisterForm from '@/components/RegisterForm';

export default function ManagerRegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-gray-500">Loading form...</span>
      </div>
    }>
      <RegisterForm successRedirect="/manager/profiles" mode="staff" />
    </Suspense>
  );
}
