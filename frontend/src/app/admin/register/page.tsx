'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import RegisterForm from '@/components/RegisterForm';

export default function AdminRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-gray-500">Loading form...</span>
        </div>
      }
    >
      <RegisterForm successRedirect="/admin/profiles" mode="staff" />
    </Suspense>
  );
}
