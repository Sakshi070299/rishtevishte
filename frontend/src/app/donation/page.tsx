"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Heart,
  Loader2,
  History,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
} from "lucide-react";
import { donationsApi, isAuthenticated } from "@/lib/api";
import { OmSymbol } from "@/components/OmSymbol";
import type { Donation, PaginatedResponse } from "@/types";
import Image from "next/image";
import Link from "next/link";

const AMOUNTS = [101, 501, 1100, 5100];

// Load Razorpay checkout script
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

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle,
    className: "text-green-600 bg-green-50",
  },
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "text-amber-600 bg-amber-50",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    className: "text-red-600 bg-red-50",
  },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── DONATION HISTORY SECTION ───────────────────────
function DonationHistory({ refreshKey }: { refreshKey: number }) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const loggedIn = isAuthenticated();
  const copyRegistrationNumber = async (registrationNumber: string) => {
    try {
      await navigator.clipboard.writeText(registrationNumber);
      toast.success("Registration number copied");
    } catch {
      toast.error("Could not copy registration number");
    }
  };

  const fetchDonations = useCallback(async () => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = (await donationsApi.list(
        `page=${page}&limit=5`,
      )) as PaginatedResponse<Donation>;
      setDonations(res.data);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch {
      // silently fail — user may not have donations
    } finally {
      setLoading(false);
    }
  }, [page, loggedIn]);

  useEffect(() => {
    fetchDonations();
  }, [fetchDonations, refreshKey]);

  if (!loggedIn) return null;

  if (loading) {
    return (
      <div className="mt-12 max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-maroon" size={24} />
        </div>
      </div>
    );
  }

  if (donations.length === 0 && page === 1) {
    return (
      <div className="mt-12 max-w-2xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-4">
          <History size={20} className="text-maroon" />
          <h3 className="text-lg font-bold text-temple-brown">
            Your Donations
          </h3>
          <span className="font-hindi text-sm text-temple-brown-light">
            · आपका दान
          </span>
        </div>
        <div className="card-temple text-center py-10">
          <IndianRupee
            size={32}
            className="mx-auto mb-3 text-temple-brown-light opacity-40"
          />
          <p className="text-temple-brown-light text-sm">
            No donations yet. Your first contribution will appear here.
          </p>
        </div>
      </div>
    );
  }

  const completedTotal = donations
    .filter((d) => d.paymentStatus === "COMPLETED")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="mt-12 max-w-2xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={20} className="text-maroon" />
          <h3 className="text-lg font-bold text-temple-brown">
            Your Donations
          </h3>
          <span className="font-hindi text-sm text-temple-brown-light">
            · आपका दान
          </span>
        </div>
        <span className="text-xs text-temple-brown-light">{total} total</span>
      </div>

      {/* Summary strip */}
      {completedTotal > 0 && (
        <div className="bg-gradient-to-r from-maroon to-primary rounded-xl px-5 py-3 mb-4 flex items-center justify-between text-white">
          <span className="text-sm font-medium opacity-90">
            Total Contributed
          </span>
          <span className="text-xl font-bold">
            ₹{(completedTotal / 100).toLocaleString("en-IN")}
          </span>
        </div>
      )}

      {/* Donation cards */}
      <div className="space-y-3">
        {donations.map((d) => {
          const status =
            STATUS_CONFIG[d.paymentStatus] || STATUS_CONFIG.PENDING;
          const StatusIcon = status.icon;
          const registrationNumber = d.profile?.registrationNumber;
          return (
            <div
              key={d.id}
              className="card-temple !p-3 sm:!p-4 flex items-center gap-2.5 sm:gap-4"
            >
              {/* Left — Icon */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${status.className}`}
              >
                <StatusIcon size={18} />
              </div>

              {/* Center — Details */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-temple-brown">
                    ₹{(d.amount / 100).toLocaleString("en-IN")}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.type === "REGISTRATION"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-orange-50 text-orange-600"
                      }`}
                  >
                    {d.type === "REGISTRATION" ? "Registration" : "General"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2 mt-2">
                  <span className="text-xs text-temple-brown-light">
                    {formatDate(d.createdAt)}
                  </span>
                  <span className="text-xs text-temple-brown-light opacity-50 hidden sm:block">
                    ·
                  </span>
                  <span className="text-xs text-temple-brown-light">
                    {formatTime(d.createdAt)}
                  </span>
                  {registrationNumber && (
                    <>
                      <span className="text-xs text-temple-brown-light opacity-50 hidden sm:block">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyRegistrationNumber(registrationNumber)
                        }
                        className="text-xs text-temple-brown-light truncate hover:text-maroon transition-colors cursor-pointer"
                        title="Click to copy registration number"
                      >
                        {registrationNumber}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right — Status */}
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-[#E8D5C4] disabled:opacity-30 hover:bg-white transition-colors"
          >
            <ChevronLeft size={16} className="text-temple-brown" />
          </button>
          <span className="text-sm text-temple-brown-light">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-[#E8D5C4] disabled:opacity-30 hover:bg-white transition-colors"
          >
            <ChevronRight size={16} className="text-temple-brown" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN DONATION PAGE ─────────────────────────────
export default function DonationPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorMobile, setDonorMobile] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handleDonate = async () => {
    const amount = selected || parseInt(custom);
    if (!amount || amount < 1) {
      toast.error("Please select or enter a donation amount");
      return;
    }

    setLoading(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error(
          "Failed to load payment gateway. Please check your internet connection.",
        );
        return;
      }

      const order = (await donationsApi.create({
        type: "GENERAL",
        amount,
        donorName: donorName || undefined,
        donorMobile: donorMobile || undefined,
        donorEmail: donorEmail || undefined,
      })) as CreateOrderResponse;

      const options = {
        key: order.key,
        amount: order.amount * 100,
        currency: order.currency,
        name: "TheMarriageHome.com",
        description: "Donation — TheMarriageHome.com",
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            await donationsApi.verify({
              donationId: order.donationId,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewayOrderId: response.razorpay_order_id,
              gatewaySignature: response.razorpay_signature,
            });
            toast.success(
              "Donation successful! Thank you for your generous contribution.",
            );
            setSelected(null);
            setCustom("");
            setDonorName("");
            setDonorMobile("");
            setDonorEmail("");
            setRefreshKey((k) => k + 1);
          } catch {
            toast.error(
              "Payment verification failed. Please contact support.",
            );
          }
        },
        prefill: {
          name: donorName || undefined,
          contact: donorMobile || undefined,
          email: donorEmail || undefined,
        },
        theme: {
          color: "#8B1A1A",
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled.");
            setRefreshKey((k) => k + 1);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        toast.error(
          response.error?.description || "Payment failed. Please try again.",
        );
        setRefreshKey((k) => k + 1);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Donation Form */}
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <Link href={"/"}>
            <Image
              className="size-12"
              src="/icons/marriagehome-logo.png"
              width={40}
              height={40}
              alt="om-logo"
            />
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-maroon mb-1">Support Us</h2>
        <p className="font-hindi text-primary mb-2">सहयोग करें</p>
        <p className="text-sm text-temple-brown-light mb-8">
          Your donations help maintain the platform, support community services,
          and organize events.
        </p>

        <div className="flex gap-3 justify-center flex-wrap mb-6">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setSelected(a);
                setCustom("");
              }}
              className={`px-6 py-3 rounded-xl font-bold text-lg border-2 transition-all ${selected === a
                ? "border-gold bg-gold text-temple-brown"
                : "border-gold/30 bg-white text-temple-brown hover:border-gold"
                }`}
            >
              ₹{a.toLocaleString("en-IN")}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-sm text-temple-brown-light">or custom:</span>
          <input
            type="number"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setSelected(null);
            }}
            placeholder="₹ Amount"
            className="input-field w-40 text-center text-lg"
          />
        </div>

        <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
          <input
            type="text"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="Your Name (optional)"
            className="input-field w-full"
          />
          <input
            type="tel"
            value={donorMobile}
            onChange={(e) => setDonorMobile(e.target.value)}
            placeholder="Mobile Number (optional)"
            className="input-field w-full"
          />
          <input
            type="email"
            value={donorEmail}
            onChange={(e) => setDonorEmail(e.target.value)}
            placeholder="Email (optional, for receipt)"
            className="input-field w-full"
          />
        </div>

        <button
          onClick={handleDonate}
          disabled={loading}
          className="btn-gold text-lg px-10 py-4"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Heart size={20} />
          )}
          {loading ? "Processing..." : "Donate Now / दान करें"}
        </button>

        <p className="text-xs text-temple-brown-light mt-6">
          🔒 Secure payment via Razorpay.
        </p>
      </div>

      {/* Donation History */}
      <DonationHistory refreshKey={refreshKey} />
    </div>
  );
}
