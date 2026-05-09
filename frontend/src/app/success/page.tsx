'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const regId = searchParams.get('regId') || 'RS-' + new Date().getFullYear() + '-XXX';

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30 animate-bounce">
          <CheckCircle size={40} />
        </div>
        <h1 className="text-2xl font-bold text-maroon mb-2">Registration Successful!</h1>
        <p className="font-hindi text-primary text-lg mb-2">आपका विवाह पंजीकरण सफल हुआ!</p>
        <p className="text-sm text-temple-brown-light mb-1">
          Your matrimony profile has been registered and payment received. The temple committee will begin matching.
        </p>
        <p className="font-hindi text-sm text-temple-brown-light mb-6">
          मंदिर समिति आपके रिश्ते की खोज शुरू करेगी।
        </p>
        <div className="inline-block bg-cream-dark border border-[#E8D5C4] rounded-xl px-6 py-3 mb-6">
          <p className="text-xs text-temple-brown-light">Registration ID</p>
          <p className="text-lg font-bold text-maroon tracking-wider">{regId}</p>
        </div>
        <br />
        <div className="flex gap-3 justify-center">
          <Link href="/profiles" className="btn-primary">View My Profiles</Link>
          <Link href="/dashboard" className="btn-outline">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
