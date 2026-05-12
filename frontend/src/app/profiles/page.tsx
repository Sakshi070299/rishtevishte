"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye,
  Edit,
  Download,
  Printer,
  Lock,
  AlertCircle,
  Loader2,
  X,
  User,
  CreditCard,
} from "lucide-react";
import { profilesApi, donationsApi, resolvePhotoUrl } from "@/lib/api";
import type { Profile } from "@/types";
import { downloadBiodata } from "@/lib/download-biodata";
import { formatDate } from "date-fns";
import { ViewModal } from "@/components/ViewModal";

const REGISTRATION_FEE = 2100;
const PAYMENT_WINDOW_MINUTES = 15;

function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface CreateOrderResponse {
  donationId: string;
  orderId: string;
  amount: number;
  currency: string;
  key: string;
}

// ─── HELPERS ──────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  SETTLED: "bg-blue-100 text-blue-700",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-700",
  INACTIVE: "bg-gray-100 text-gray-700",
};

// ─── VIEW PROFILE MODAL ──────────────────────────────



// ─── BIODATA HTML (for download & print) ─────────────


export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [now, setNow] = useState(Date.now());
  const expiryTriggeredRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (expiryTriggeredRef.current) return;
    const hasExpiredPending = profiles.some((p) => {
      if (p.status !== "PENDING_PAYMENT") return false;
      const createdAtMs = new Date(p.createdAt).getTime();
      const deadlineMs = createdAtMs + PAYMENT_WINDOW_MINUTES * 60_000;
      return now >= deadlineMs;
    });

    if (!hasExpiredPending) return;

    expiryTriggeredRef.current = true;
    (async () => {
      try {
        const res = (await profilesApi.expirePendingPayment()) as { expired?: boolean };
        if (res?.expired) {
          toast.error("Payment time expired. Your pending profile has been deleted.");
          const fresh = (await profilesApi.list()) as Profile[];
          setProfiles(fresh);
          return;
        }
      } catch {
        // ignore; server cron will handle shortly
      }
    })();
  }, [now, profiles, router]);

  useEffect(() => {
    profilesApi
      .list()
      .then((data) => setProfiles(data as Profile[]))
      .catch(() => toast.error("Failed to load profiles"))
      .finally(() => setLoading(false));
  }, []);

  const handlePay = async (profile: Profile) => {
    setPaying(profile.id);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load payment gateway");
        return;
      }

      const order = (await donationsApi.create({
        profileId: profile.id,
        type: "REGISTRATION",
        amount: REGISTRATION_FEE,
      })) as CreateOrderResponse;

      const options = {
        key: order.key,
        amount: order.amount * 100,
        currency: order.currency,
        name: "TheMarriageHome.com",
        description: `Registration Fee — ${profile.registrationNumber}`,
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            await donationsApi.verify({
              donationId: order.donationId,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewayOrderId: response.razorpay_order_id,
              gatewaySignature: response.razorpay_signature,
            });
            toast.success("Payment successful! Profile is now active.");
            setProfiles((prev) =>
              prev.map((p) =>
                p.id === profile.id ? { ...p, status: "ACTIVE" } : p,
              ),
            );
            router.push(`/success?regId=${profile.registrationNumber}`);
          } catch {
            toast.error(
              "Payment verification failed. Please contact support.",
            );
          }
        },
        prefill: {
          contact: profile.guardianPhone || undefined,
          email: profile.guardianEmail || undefined,
        },
        theme: { color: "#1B2A4A" },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Payment initiation failed");
    } finally {
      setPaying(null);
    }
  };

  const handleSettle = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to mark this profile as Settled? This will lock the profile and no new inquiries will be allowed.\n\nक्या आप सुनिश्चित हैं?",
      )
    )
      return;
    try {
      await profilesApi.settle(id);
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "SETTLED" } : p)),
      );
      toast.success("Profile marked as Settled");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );

  if (profiles.length === 0)
    return (
      <div className="text-center py-20">
        <AlertCircle
          size={48}
          className="text-temple-brown-light mx-auto mb-4 opacity-40"
        />
        <h3 className="font-bold text-temple-brown mb-1">No Profiles Yet</h3>
        <p className="text-sm text-temple-brown-light mb-4">
          You haven&apos;t registered any bride or groom profiles yet.
        </p>
        <a href="/register" className="btn-primary">
          Create New Profile
        </a>
      </div>
    );

  return (
    <>
      <div className="space-y-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`bg-white rounded-xl shadow-md border p-5 ${profile.status === "SETTLED" ? "border-green-300 bg-green-50/30" : "border-[#E8D5C4]"}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-temple-brown text-lg">
                  {profile.fullName}
                </h3>
                <p className="text-xs text-temple-brown-light">
                  {profile.registrationNumber} · {profile.gender} · Created{" "}
                  {fmtDate(profile.createdAt)}
                </p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex flex-nowrap text-nowrap items-center ${STATUS_STYLE[profile.status] || "bg-gray-100 text-gray-700"}`}
              >
                {profile.status === "SETTLED" && (
                  <Lock size={10} className="inline mr-1" />
                )}
                {profile.status.replace("_", " ")}
              </span>

            </div>

            <div className="grid sm:grid-cols-3 gap-2 text-sm text-temple-brown-light mb-4">
              <div>
                Father:{" "}
                <strong className="text-temple-brown">
                  {profile.fatherName}
                </strong>
              </div>
              <div>
                DOB:{" "}
                <strong className="text-temple-brown">
                  {fmtDate(profile.dateOfBirth)}
                </strong>
              </div>
              <div>
                Phone:{" "}
                <strong className="text-temple-brown">
                  {profile.guardianPhone}
                </strong>
              </div>
            </div>

            {/* Pending Payment Banner */}
            {profile.status === "PENDING_PAYMENT" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-yellow-600 shrink-0" />
                  <p className="text-xs text-yellow-800">
                    {(() => {
                      const createdAtMs = new Date(profile.createdAt).getTime();
                      const deadlineMs = createdAtMs + PAYMENT_WINDOW_MINUTES * 60_000;
                      const left = deadlineMs - now;
                      const expired = left <= 0;
                      return (
                        <>
                          Payment pending. Pay <strong>₹{REGISTRATION_FEE}</strong> to activate your profile.
                          <span className="block mt-1">
                            Time left:{" "}
                            <strong className={expired ? "text-red-700" : "text-yellow-900"}>
                              {formatCountdown(left)}
                            </strong>{" "}
                            (15 minutes from registration)
                          </span>
                          <span className="font-hindi block text-yellow-700 mt-1">
                            प्रोफ़ाइल सक्रिय करने के लिए ₹{REGISTRATION_FEE} का भुगतान करें। शेष समय:{" "}
                            <strong className={expired ? "text-red-700" : "text-yellow-900"}>
                              {formatCountdown(left)}
                            </strong>
                          </span>
                        </>
                      );
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => handlePay(profile)}
                  disabled={paying === profile.id}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors"
                >
                  {paying === profile.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CreditCard size={14} />
                  )}
                  {paying === profile.id
                    ? "Processing..."
                    : `Pay ₹${REGISTRATION_FEE}`}
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-[#E8D5C4] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max min-w-full gap-2 items-center justify-center sm:justify-end [&>*]:shrink-0">
                <button
                  onClick={() => setViewProfile(profile)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 flex items-center gap-1"
                >
                  <Eye size={12} /> View
                </button>
                {profile.status !== "SETTLED" && (
                  <a
                    href={`/register?edit=${profile.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 font-medium hover:bg-blue-500/20 flex items-center gap-1"
                  >
                    <Edit size={12} /> Edit
                  </a>
                )}
                {profile.status === "ACTIVE" && (
                  <button
                    onClick={() => downloadBiodata(profile)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 font-medium hover:bg-green-500/20 flex items-center gap-1"
                  >
                    <Download size={12} /> Download
                  </button>
                )}
                {profile.status === "ACTIVE" && (
                  <button
                    onClick={() => handleSettle(profile.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 font-medium hover:bg-red-500/20 flex items-center gap-1 sm:ml-auto"
                  >
                    <Lock size={12} /> Mark Settled
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View Modal */}
      {viewProfile && (
        <ViewModal profile={viewProfile} onClose={() => setViewProfile(null)} showContactDetails={true} />
      )}
    </>
  );
}
