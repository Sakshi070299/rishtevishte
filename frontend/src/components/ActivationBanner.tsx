"use client";

import { useState } from "react";
import { Banknote, X } from "lucide-react";

export default function ActivationBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  
  return (
    <div className="mb-4 rounded-lg border border-[#E8D5C4] bg-primary-light p-2.5 shadow-sm flex items-center gap-3">
      <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
        <Banknote size={18} className="text-primary" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-temple-brown leading-relaxed">
          Your ID will be activated only after the{" "}
          <span className="font-semibold text-primary">₹2100</span>
          {""} registration fee is paid.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setVisible(false)}
        className="p-1.5 rounded-lg text-temple-brown-light hover:bg-white/80 hover:text-maroon transition shrink-0"
        aria-label="Dismiss notice"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
