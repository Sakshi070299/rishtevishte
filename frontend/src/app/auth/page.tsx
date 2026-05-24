"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuthResponse } from "@/types";
import { OmSymbol } from "@/components/OmSymbol";
import Image from "next/image";
import Link from "next/link";

type LoginType = "USER" | "TEAM";

function AuthPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const typeParam = (params.get("type") || "USER").toUpperCase();
  const initialType: LoginType = typeParam === "TEAM" ? "TEAM" : "USER";

  const [loginType, setLoginType] = useState<LoginType>(initialType);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (mobile.length !== 10) {
      toast.error("Enter valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    setDevOtp(null);
    setOtpError(null);
    try {
      const res = (await authApi.sendOtp(mobile, loginType)) as {
        message: string;
        devOtp?: string;
      };
      toast.success("OTP sent!");
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        toast.info(`Dev OTP: ${res.devOtp}`, { duration: 10000 });
      }
      setStep("otp");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setLoading(true);
    setOtpError(null);
    try {
      const res = (await authApi.verifyOtp(
        mobile,
        otp,
        loginType,
      )) as AuthResponse;

      // Use AuthContext login — stores both tokens + starts auto-refresh timer
      login(res.accessToken, res.refreshToken, res.user);
      toast.success("Login successful!");

      // Route based on role
      switch (res.user.role) {
        case "ADMIN":
          router.push("/admin");
          break;
        case "TEAM":
          router.push("/team");
          break;
        default:
          router.push("/dashboard");
          break;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid OTP";
      setOtpError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const LABELS: Record<
    LoginType,
    { title: string; hi: string; color: string }
  > = {
    USER: { title: "User Login", hi: "उपयोगकर्ता लॉगिन", color: "bg-primary" },
    TEAM: { title: "Team Login", hi: "टीम लॉगिन", color: "bg-blue-600" },
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-3 flex justify-center">
            <Link href={"/"}>
              <Image
                className="size-12 h-20 w-40 mx-auto"
                src={"/icons/marriagehome-logo.png"}
                width={40}
                height={40}
                alt="TheMarriageHome logo"
              />
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-maroon">TheMarriageHome.com</h1>
          <p className="font-hindi text-primary">रिश्तेसेतु — विवाह सेवा</p>
        </div>

        {/* Login Type Tabs */}
        <div className="flex gap-1 bg-cream-dark p-1 mb-6 rounded-lg">
          {(["USER", "TEAM"] as LoginType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setLoginType(type);
                setStep("mobile");
                setOtp("");
                setOtpError(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${loginType === type
                ? `${LABELS[type].color} text-white shadow-md`
                : "text-temple-brown-light hover:bg-white/50"
                }`}
            >
              {type === "USER" ? "👤" : "👥"} {type}
            </button>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-lg border border-[#E8D5C4] p-8">
          <h2 className="text-xl font-bold text-temple-brown mb-1">
            {LABELS[loginType].title}
          </h2>

          <p className="font-hindi text-primary text-sm mb-6">
            {LABELS[loginType].hi}
          </p>

          {step === "mobile" ? (
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
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
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
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Phone size={18} />
                )}
                {loading ? "Sending OTP..." : "Send OTP"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-temple-brown-light mb-4">
                OTP sent to{" "}
                <strong className="text-temple-brown">+91 {mobile}</strong>
                <button
                  onClick={() => setStep("mobile")}
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
                  setOtp(e.target.value.replace(/\D/g, ""));
                  setOtpError(null);
                }}
                placeholder="6-digit OTP"
                className={`input-field text-center text-2xl tracking-[0.5em] font-bold mb-3 ${otpError ? "border-red-500" : ""}`}
                autoFocus
              />
              {/* {otpError && (
                <p className="text-xs text-red-600 mb-4">{otpError}</p>
              )} */}
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full justify-center"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <KeyRound size={18} />
                )}
                {loading ? "Verifying..." : "Verify & Login"}
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

        {/* Dev Mode Notice */}
        {devOtp && process.env.NODE_ENV !== "production" && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 text-center">
            Dev Mode: OTP is <strong>{devOtp}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthPageFallback() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-temple-brown">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-hindi">लोड हो रहा है…</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
