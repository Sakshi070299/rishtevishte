'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ArrowRight, KeyRound, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { AuthResponse } from '@/types'; 
import { OmSymbol } from '@/components/OmSymbol';
import Image from 'next/image';
import Link from 'next/link';

export function AdminAuth() {
  const router = useRouter();
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (mobile.length !== 10) {
      toast.error('Enter valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setDevOtp(null);
    setOtpError(null);
    try {
      const res = (await authApi.sendOtp(mobile, 'ADMIN')) as {
        message: string;
        devOtp?: string;
      };
      toast.success('OTP sent!');
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        toast.info(`Dev OTP: ${res.devOtp}`, { duration: 10000 });
      }
      setStep('otp');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Enter 6-digit OTP');
      return;
    }
    setLoading(true);
    setOtpError(null);
    try {
      const res = (await authApi.verifyOtp(mobile, otp, 'ADMIN')) as AuthResponse;
      login(res.accessToken, res.refreshToken, res.user);
      toast.success('Login successful!');
      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid OTP';
      setOtpError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-3 flex justify-center">
            <Link href={"/"}>
              <Image
                className="size-12 mx-auto"
                src={"/icons/om-icon-v2.png"}
                width={40}
                height={40}
                alt="om-logo"
              />
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-maroon">TheMarriageHome.com</h1>
          <p className="font-hindi text-primary">एडमिन लॉगिन</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-[#E8D5C4] p-8">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} className="text-maroon" />
            <h2 className="text-xl font-bold text-temple-brown">Admin Login</h2>
          </div>
          <p className="font-hindi text-primary text-sm mb-6">एडमिन लॉगिन</p>

          {step === 'mobile' ? (
            <>
              <label className="block text-sm font-medium text-temple-brown-light mb-1.5">
                Mobile Number <span className="font-hindi">मोबाइल नंबर</span>
              </label>
              <div className="flex gap-2 mb-2">
                <span className="flex items-center px-3 bg-cream-dark rounded-lg text-sm font-semibold text-temple-brown">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10-digit number"
                  className="input-field flex-1"
                  autoFocus
                />
              </div>
              <p className="text-xs text-temple-brown-light mb-6">
                We&apos;ll send a 6-digit OTP to this number
              </p>
              <button
                onClick={handleSendOtp}
                disabled={loading || mobile.length !== 10}
                className="btn-primary w-full justify-center"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Phone size={18} />}
                {loading ? 'Sending OTP...' : 'Send OTP'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-temple-brown-light mb-4">
                OTP sent to <strong className="text-temple-brown">+91 {mobile}</strong>
                <button
                  onClick={() => setStep('mobile')}
                  className="text-primary ml-2 underline text-xs"
                >
                  Change
                </button>
              </p>
              <label className="block text-sm font-medium text-temple-brown-light mb-1.5">
                Enter OTP <span className="font-hindi">ओटीपी दर्ज करें</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ''));
                  setOtpError(null);
                }}
                placeholder="6-digit OTP"
                className={`input-field text-center text-2xl tracking-[0.5em] font-bold mb-3 ${otpError ? 'border-red-500' : ''}`}
                autoFocus
              />
              {otpError && <p className="text-xs text-red-600 mb-4">{otpError}</p>}
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full justify-center"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button
                onClick={handleSendOtp}
                className="w-full text-center text-sm text-primary mt-4 hover:underline"
              >
                Resend OTP
              </button>
            </>
          )}
        </div>

        {devOtp && process.env.NODE_ENV !== 'production' && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 text-center">
            Dev Mode: OTP is <strong>{devOtp}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

