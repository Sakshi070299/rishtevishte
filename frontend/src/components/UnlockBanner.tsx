"use client";

import { useState, useCallback } from "react";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { accessPaymentApi, getUser } from "@/lib/api";

interface UnlockBannerProps {
  /** Server-known unlock status. If true, the banner renders a small "unlocked until …" badge. */
  isUnlocked: boolean;
  /** Date (ISO string) the access expires. Shown when unlocked. */
  accessExpiresAt?: string | null;
  /** Fee shown on the CTA. Defaults to ₹2100. */
  feeRupees?: number;
  /** Optional callback after a successful unlock so the parent can refetch its data. */
  onUnlocked?: () => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (document.getElementById("razorpay-script")) return resolve(true);
    const s = document.createElement("script");
    s.id = "razorpay-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function UnlockBanner({
  isUnlocked,
  accessExpiresAt,
  feeRupees = 2100,
  onUnlocked,
}: UnlockBannerProps) {
  const [busy, setBusy] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) {
        toast.error("Could not load payment SDK");
        return;
      }

      const order = await accessPaymentApi.createOrder();
      if ("alreadyUnlocked" in order && order.alreadyUnlocked) {
        toast.success("You're already unlocked");
        onUnlocked?.();
        return;
      }

      const user = getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key: order.key,
        amount: order.amount * 100,
        currency: order.currency,
        order_id: order.orderId,
        name: "Mandir Matrimony",
        description: `Profile View Access — ${order.validMonths} months`,
        prefill: {
          name: user?.name || "",
          contact: user?.mobile || "",
          email: user?.email || "",
        },
        theme: { color: "#8B1A1A" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async (response: any) => {
          try {
            await accessPaymentApi.verify({
              accessPaymentId: order.accessPaymentId,
              gatewayOrderId: response.razorpay_order_id,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewaySignature: response.razorpay_signature,
            });
            toast.success("Profiles unlocked for 6 months 🎉");
            onUnlocked?.();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Verification failed");
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      // Keep busy=true until Razorpay modal opens. Reset on dismiss/error.
      setTimeout(() => setBusy(false), 1500);
    }
  }, [busy, onUnlocked]);

  if (isUnlocked) {
    const ts = accessExpiresAt ? new Date(accessExpiresAt) : null;
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 text-emerald-900">
        <ShieldCheck size={20} className="shrink-0" />
        <p className="text-sm">
          Full profile access unlocked
          {ts && (
            <span className="text-emerald-700">
              {" "}
              · valid till {ts.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-rose-50 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Lock size={20} />
        </div>
        <div>
          <p className="font-semibold text-temple-brown text-sm md:text-base">
            Full profile view करने के लिए ₹{feeRupees} का payment करें
          </p>
          <p className="text-xs md:text-sm text-temple-brown/70 mt-0.5">
            One-time unlock — 6 months तक सभी profiles photo, mobile, family details समेत
            देख सकेंगे।
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleUnlock}
        disabled={busy}
        className="bg-[#8B1A1A] hover:bg-[#5a0f0f] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2 shadow-sm transition-all duration-200 shrink-0"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        {busy ? "Opening…" : `Unlock for ₹${feeRupees}`}
      </button>
    </div>
  );
}

/**
 * Inline placeholder shown in place of a locked field (mobile, photo, etc.)
 * Keeps the card layout intact while clearly communicating the gate.
 */
export function LockedField({ label = "Pay ₹2100 to view" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
      <Lock size={11} />
      {label}
    </span>
  );
}
