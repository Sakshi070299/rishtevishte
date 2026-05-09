// ═══════════════════════════════════════════════════════
// FEATURE 1 (Frontend): reCAPTCHA v3 Integration
// Auto-loads script, provides token for form submissions
// ═══════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback } from 'react';

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
// ─── Load reCAPTCHA script once ─────────────────────
let loaded = false;
function loadRecaptchaScript() {
  if (loaded || !SITE_KEY || typeof window === 'undefined') return;
  loaded = true;

  const script = document.createElement('script');
  script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  script.async = true;
  document.head.appendChild(script);
}

// ─── Hook to get CAPTCHA token ──────────────────────
export function useCaptcha() {
  useEffect(() => {
    loadRecaptchaScript();
  }, []);

  const getToken = useCallback(async (action: string = 'submit'): Promise<string> => {
    if (!SITE_KEY) return 'dev-no-captcha-configured';

    return new Promise((resolve) => {
      if (typeof window.grecaptcha === 'undefined') {
        resolve('captcha-not-loaded');
        return;
      }
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(SITE_KEY, { action });
          resolve(token);
        } catch {
          resolve('captcha-error');
        }
      });
    });
  }, []);

  return { getToken, isConfigured: !!SITE_KEY };
}
