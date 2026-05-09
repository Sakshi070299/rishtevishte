"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Star,
  Heart,
  Shield,
  Quote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Gift,
} from "lucide-react";
import { isAuthenticated, contentApi } from "@/lib/api";

// ─── Data ─────────────────────────────────────────────────────────────────────

const INTRO_CARDS = [
  {
    icon: Star,
    title: "Ancient Heritage",
    hi: "प्राचीन विरासत",
    desc: "Established centuries ago, our temple stands as a beacon of faith and devotion. The sacred 51-ft Hanuman Ji Murti is a symbol of divine strength and blessings.",
  },
  {
    icon: Heart,
    title: "Community Service",
    hi: "समुदाय सेवा",
    desc: "Serving thousands of devotees daily. From daily aarti to major festivals, we bring together families under the divine umbrella of Hanuman Ji's grace.",
  },
  {
    icon: Shield,
    title: "Matrimony Service",
    hi: "विवाह सेवा",
    desc: "RishteNate is our sacred mission to unite families. Under the blessings of Bajrangbali, we facilitate meaningful matrimonial connections within our community.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    num: "1",
    title: "Fill Biodata",
    hi: "बायोडाटा भरें",
    desc: "Complete your detailed biodata with personal, family, and professional information.",
  },
  {
    num: "2",
    title: "Upload Photo",
    hi: "फोटो अपलोड करें",
    desc: "Add a recent passport-size photograph to your profile for better matching.",
  },
  {
    num: "3",
    title: "Pay ₹2100",
    hi: "₹2100 भुगतान करें",
    desc: "One-time registration fee via secure Razorpay gateway. No hidden charges.",
  },
  {
    num: "4",
    title: "Get Matched",
    hi: "जोड़ा पाएं",
    desc: "Temple committee reviews profiles and facilitates sacred introductions.",
  },
] as const;

const TESTIMONIALS = [
  {
    name: "Rajesh & Priya Sharma",
    loc: "Delhi",
    text: "We found our perfect match through the temple's matrimony service. The committee was very supportive and the entire process was transparent and trustworthy.",
    hi: "मंदिर की विवाह सेवा से हमें सही जोड़ा मिला।",
    initials: "RS",
  },
  {
    name: "Amit & Sunita Verma",
    loc: "Ghaziabad",
    text: "Very trustworthy service. We appreciate the efforts of the temple committee in bringing our families together with dignity and grace.",
    hi: "बहुत भरोसेमंद सेवा।",
    initials: "AV",
  },
  {
    name: "Suresh & Meena Gupta",
    loc: "Noida",
    text: "The blessing of Hanuman Ji made our match possible. RishteNate is a sacred platform that truly understands the value of family bonds.",
    hi: "हनुमान जी के आशीर्वाद से हमारा रिश्ता तय हुआ।",
    initials: "SG",
  },
] as const;


const FAQS = [
  {
    q: "What is the Rishte Naate Program?",
    qh: "रिश्ता-नाता कार्यक्रम क्या है?",
    a: "It is a temple-based initiative to help families connect for matrimonial purposes in a respectful and spiritual environment.",
    ah: "यह मंदिर द्वारा आयोजित एक कार्यक्रम है, जिसमें परिवारों को वैवाहिक संबंधों के लिए एक पवित्र और सम्मानजनक वातावरण में जोड़ने का अवसर दिया जाता है।",
  },
  {
    q: "What is the registration fee?",
    qh: "रजिस्ट्रेशन फीस क्या है?",
    a: "The registration fee is 2100₹ , which is valid for 6 months from the date of registration.The amount is treated as a donation for temple development and is non-refundable and non-transferable.",
    ah: "रजिस्ट्रेशन फीस ₹2100 है, जो 6 महीने तक मान्य रहती है। यह राशि मंदिर के विकास हेतु दान के रूप में मानी जाती है और नॉन-रिफंडेबल (वापसी योग्य नहीं) व नॉन-ट्रांसफरेबल (हस्तांतरण योग्य नहीं) है।",
  },
  {
    q: "How can we register?",
    qh: "रजिस्ट्रेशन कैसे करें ?",
    children: (
      <>
        <ul className="list-disc list-inside">
          <li className="text-temple-brown/80 text-sm leading-relaxed mt-2">
            <span className="font-bold">Offline Registration:</span> You can visit the temple only on Sundays,
            between 10:00 AM to 2:00 PM.
          </li>
          <li className="text-temple-brown/80 text-sm leading-relaxed mt-2">
            <span className="font-bold">Online Registration:</span> You can register anytime through our website:
            <a href="www.rishtenate.org">www.rishtenate.org</a>, which is
            available 24x7 (all days, all time).
          </li>
          <li className="font-hindi text-primary/70 text-xs mt-2">
            <span className="font-bold">ऑफलाइन रजिस्ट्रेशन:</span> आप मंदिर में केवल रविवार को, सुबह 10:00 बजे से
            दोपहर 2:00 बजे तक आ सकते हैं।
          </li>
          <li className="font-hindi text-primary/70 text-xs mt-2">
            <span className="font-bold">ऑनलाइन रजिस्ट्रेशन:</span> आप हमारी वेबसाइट{" "}
            <a href="www.rishtenate.org">www.rishtenate.org</a>
            पर किसी भी दिन, किसी भी समय (24x7) रजिस्ट्रेशन कर सकते हैं।
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "Does the temple verify the profiles of bride/groom?",
    qh: "क्या मंदिर वर-वधु की जानकारी की जांच करता है?",
    a: "No. The temple and its sewadar do not guarantee or verify any profile. Participants must do their own background checks.",
    ah: "नहीं। मंदिर या उसके सेवेदार किसी भी जानकारी की गारंटी या सत्यापन नहीं करते। कृपया स्वयं जांच-पड़ताल करें।",
  },
  {
    q: "Can we take photos of forms or records inside the temple?",
    qh: "क्या हम मंदिर में फॉर्म या दस्तावेज की फोटो ले सकते हैं?",
    a: "No. Photography of forms or any documents is strictly prohibited. Violation may lead to cancellation of registration.",
    ah: "नहीं। मंदिर परिसर में किसी भी फॉर्म या दस्तावेज की फोटो लेना सख्त मना है। ऐसा करने पर रजिस्ट्रेशन रद्द किया जा सकता है।",
  },
  {
    q: "What are the timings of the program?",
    qh: "कार्यक्रम का समय क्या है?",
    a: "The program is held every Sunday only, from 10:00 AM to 2:00 PM at the temple premises.",
    ah: "यह कार्यक्रम केवल हर रविवार को सुबह 10:00 बजे से दोपहर 2:00 बजे तक आयोजित किया जाता है।",
  },
  {
    q: "Can we visit the temple on other days for this program?",
    qh: "क्या हम अन्य दिनों में भी इस कार्यक्रम के लिए आ सकते हैं?",
    a: "No. The Rishte Naate program is conducted only on Sundays.",
    ah: "नहीं। यह कार्यक्रम केवल रविवार को ही होता है।",
  },
  {
    q: "What documents are required for registration?",
    qh: "रजिस्ट्रेशन के लिए कौन-कौन से दस्तावेज चाहिए?",
    a: "Basic details such as name, age, contact information, and other relevant matrimonial details are required. (Exact requirements may be informed at the temple.)",
    ah: "नाम, आयु, संपर्क विवरण और अन्य वैवाहिक जानकारी की आवश्यकता होती है। (पूरी जानकारी मंदिर में दी जाएगी)",
  },
  {
    q: "Can registration be transferred to another person?",
    qh: "क्या रजिस्ट्रेशन किसी और को ट्रांसफर किया जा सकता है?",
    a: "No. Registration is non-transferable.",
    ah: "नहीं, रजिस्ट्रेशन ट्रांसफर नहीं किया जा सकता।",
  },
  {
    q: "What happens if rules are violated?",
    qh: "नियमों का उल्लंघन होने पर क्या होगा?",
    a: "The temple reserves the right to cancel the registration without prior notice in case of any rule violation.",
    ah: "नियमों का उल्लंघन होने पर मंदिर को बिना पूर्व सूचना के रजिस्ट्रेशन रद्द करने का अधिकार है।",
  },
] as const;

// ─── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({
  hi,
  en,
  light = false,
}: {
  hi: string;
  en: string;
  light?: boolean;
}) {
  return (
    <div className="text-center mb-12">
      <p
        className={[
          "font-hindi text-lg tracking-wider mb-1",
          light ? "text-gold-light" : "text-primary",
        ].join(" ")}
      >
        {hi}
      </p>
      <h2
        className={[
          "text-3xl md:text-4xl font-extrabold",
          light ? "text-white" : "text-maroon",
        ].join(" ")}
      >
        {en}
      </h2>
      <div
        className={[
          "w-16 h-1 rounded-full mx-auto mt-4",
          light ? "bg-gold" : "bg-primary",
        ].join(" ")}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({
  faq,
  open,
  onToggle,
}: {
  faq: (typeof FAQS)[number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-[#E8D5C4] rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-temple-brown text-sm sm:text-base leading-snug">
            {faq.q}
          </p>
          <p className="font-hindi text-primary text-xs sm:text-sm mt-0.5 opacity-80">
            {faq.qh}
          </p>
        </div>
        <ChevronDown
          size={20}
          className={[
            "flex-shrink-0 mt-0.5 text-maroon transition-transform duration-300",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>

      <div
        className={[
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="px-6 pb-5 pt-0 border-t border-[#E8D5C4]/60">
          {"children" in faq ? (
            <div className="text-temple-brown/80 text-sm leading-relaxed mt-4">
              {faq.children}
            </div>
          ) : (
            <>
              <p className="text-temple-brown/80 text-sm leading-relaxed mt-4">
                {faq.a}
              </p>
              <p className="font-hindi text-primary/70 text-xs mt-2">
                {faq.ah}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Home Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ id: string; title: string; titleHi: string; imageUrl: string }[]>([]);
  const [banners, setBanners] = useState<{ id: string; title: string; titleHi: string; imageUrl: string; linkUrl: string | null }[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    contentApi.gallery()
      .then((data) => setGalleryImages(data.slice(0, 4)))
      .catch(() => { });
    contentApi.banners()
      .then((data) => setBanners(data))
      .catch(() => { });
  }, []);

  // Auto-rotate banners every 5s
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  function toggleFaq(idx: number) {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  }

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          1. HERO SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-maroon via-maroon-dark to-[#2A0808] text-white"
        aria-label="Hero"
      >
        {/* Radial glow overlay */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(212,160,23,0.14),transparent_65%)]"
          aria-hidden="true"
        />
        {/* Subtle bottom fade */}
        <div
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#2A0808]/60 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-20">
          <div className="mb-5" aria-hidden="true">
            {/* <Image
              className="size-20 mx-auto"
              src={"/icons/om-icon-v2.png"}
              width={80}
              height={80}
              alt="om-logo"
            /> */}
            <Image
              className="mx-auto"
              src={"/icons/ram-logo.png"}
              width={180}
              height={180}
              alt="om-logo"
            />
          </div>

          {/* Sanskrit greeting */}
          <p className="font-hindi text-gold text-xl md:text-2xl tracking-widest mb-4">
            ।। जय श्री राम ।।
          </p>

          {/* Brand name */}
          {/* <div className="flex items-center gap-4 justify-center pb-4">
            <Image
              src={"/icons/ram-logo.png"}
              width={180}
              height={180}
              alt="om-logo"
            /> */}
          <div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-none mb-2">
              RishteNate
            </h1>
            <p className="font-hindi text-gold text-3xl md:text-4xl font-bold mb-4">
              रिश्तेसेतु
            </p>
          </div>
          {/* </div> */}

          {/* Temple name */}
          <p className="font-hindi text-gold-light text-lg md:text-xl mb-2">
            मंदिर
          </p>

          {/* Subtitle */}
          <p className="text-white/70 text-base md:text-lg max-w-lg mx-auto leading-relaxed mb-10">
            Temple Matrimony Platform — Find your perfect match with the sacred
            blessings of Bajrangbali
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="btn-primary text-base px-8 py-4 shadow-xl shadow-primary/30 hover:shadow-primary/50"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/auth"
                className="btn-primary text-base px-8 py-4 shadow-xl shadow-primary/30 hover:shadow-primary/50"
              >
                Login / Register
              </Link>
            )}

            <Link
              href="/about"
              className="border-2 border-white/40 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 hover:border-white/60 transition-all duration-300 inline-flex items-center gap-2"
            >
              About Temple
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-12 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">🛕</span>
              Geeta Colony, East Delhi
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">📿</span>
              Famous 51-ft Hanuman Murti
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">👥</span>
              Dharmik Ramlila Committee
            </span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          1.5 BANNER CAROUSEL
      ════════════════════════════════════════════════════════════════ */}
      {banners.length > 0 && (
        <section className="bg-[#FFF8F0]" aria-label="Announcements">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
              {/* Current banner image */}
              {(() => {
                const b = banners[bannerIndex];
                const img = (
                  <img
                    key={b.id}
                    src={b.imageUrl}
                    alt={b.title}
                    className="w-full object-cover transition-opacity duration-500"
                    style={{ aspectRatio: '16/6', maxHeight: 360 }}
                  />
                );
                return b.linkUrl ? (
                  <a href={b.linkUrl} target="_blank" rel="noopener noreferrer">{img}</a>
                ) : img;
              })()}

              {/* Bottom overlay with title + dots */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
                <p className="text-white font-semibold text-sm sm:text-base drop-shadow">
                  {banners[bannerIndex].title}
                </p>
                {banners[bannerIndex].titleHi && (
                  <p className="font-hindi text-[#F5E6B8] text-xs sm:text-sm drop-shadow">
                    {banners[bannerIndex].titleHi}
                  </p>
                )}

                {/* Dots */}
                {banners.length > 1 && (
                  <div className="flex gap-1.5 mt-2">
                    {banners.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setBannerIndex(i)}
                        aria-label={`Go to banner ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === bannerIndex ? 'w-6 bg-[#D4A017]' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Prev / Next arrows */}
              {banners.length > 1 && (
                <>
                  <button
                    onClick={() => setBannerIndex((prev) => (prev - 1 + banners.length) % banners.length)}
                    aria-label="Previous banner"
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => setBannerIndex((prev) => (prev + 1) % banners.length)}
                    aria-label="Next banner"
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════
          2. INTRO CARDS
      ════════════════════════════════════════════════════════════════ */}
      <section className="section-container" aria-label="About RishteNate">
        <SectionHeader hi="हमारे बारे में" en="Why RishteNate?" />
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {INTRO_CARDS.map(({ icon: Icon, title, hi, desc }) => (
            <div key={title} className="card-temple group text-center">
              {/* Icon circle */}
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                <Icon size={28} className="text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-maroon mb-1">{title}</h3>
              <p className="font-hindi text-primary text-base mb-3">{hi}</p>
              <p className="text-temple-brown/70 text-sm leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          3. HOW IT WORKS
      ════════════════════════════════════════════════════════════════ */}
      <section className="bg-cream-dark" aria-label="How it works">
        <div className="section-container">
          <SectionHeader hi="प्रक्रिया" en="How It Works" />

          {/* Steps grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map(({ num, title, hi, desc }, idx) => (
              <div key={num} className="relative text-center group">
                {/* Connector line (desktop only, not on last item) */}
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-7 left-[calc(50%+2rem)] right-[-calc(50%-2rem)] h-px bg-primary/20"
                    aria-hidden="true"
                    style={{
                      width: "calc(100% - 4rem)",
                      left: "calc(50% + 2rem)",
                    }}
                  />
                )}

                {/* Number circle */}
                <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-extrabold mx-auto mb-4 shadow-lg shadow-primary/30 group-hover:-translate-y-1 transition-transform duration-300">
                  {num}
                </div>

                <h3 className="font-bold text-maroon text-base mb-1">
                  {title}
                </h3>
                <p className="font-hindi text-primary text-sm mb-2">{hi}</p>
                <p className="text-temple-brown/70 text-sm leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link href="/register" className="btn-primary text-base px-8 py-4">
              Start Registration →
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          4. TESTIMONIALS
      ════════════════════════════════════════════════════════════════ */}
      <section className="section-container" aria-label="Testimonials">
        <SectionHeader hi="सफल विवाह" en="Success Stories" />
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map(({ name, loc, text, hi, initials }) => (
            <div key={name} className="card-temple flex flex-col">
              {/* Quote icon */}
              <Quote
                size={32}
                className="text-primary/20 mb-3 flex-shrink-0"
                aria-hidden="true"
              />

              {/* English testimonial */}
              <p className="text-temple-brown/80 text-sm leading-relaxed flex-1 mb-3">
                &ldquo;{text}&rdquo;
              </p>

              {/* Hindi testimonial */}
              <p className="font-hindi text-primary/70 text-xs mb-5 leading-relaxed">
                &ldquo;{hi}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#E8D5C4]">
                {/* Avatar placeholder */}
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon to-maroon-dark text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-temple-brown text-sm leading-snug truncate">
                    {name}
                  </p>
                  <p className="text-temple-brown/50 text-xs">{loc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          5. GALLERY PREVIEW
      ════════════════════════════════════════════════════════════════ */}
      <section className="bg-cream-dark" aria-label="Gallery preview">
        <div className="section-container">
          <SectionHeader hi="मंदिर दर्शन" en="Temple Gallery" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {galleryImages.map(({ id, title, titleHi, imageUrl }) => (
              <div
                key={id}
                className="relative group rounded-xl overflow-hidden aspect-[4/3] shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer"
              >
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  unoptimized
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-maroon-dark/90 via-maroon/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <p className="text-white font-semibold text-sm leading-snug">
                    {title}
                  </p>
                  <p className="font-hindi text-gold-light text-xs mt-0.5">
                    {titleHi}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/gallery" className="btn-outline">
              View Full Gallery →
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          6. FAQ
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="section-container"
        aria-label="Frequently asked questions"
      >
        <SectionHeader hi="सामान्य प्रश्न" en="Frequently Asked Questions" />
        <div className="max-w-3xl mx-auto space-y-3">
          {FAQS.map((faq, idx) => (
            <FaqItem
              key={faq.q}
              faq={faq}
              open={openFaq === idx}
              onToggle={() => toggleFaq(idx)}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          7. DONATION CTA
      ════════════════════════════════════════════════════════════════ */}
      <section
        className="bg-gradient-to-br from-maroon via-maroon-dark to-[#2A0808] relative overflow-hidden"
        aria-label="Donation call to action"
      >
        {/* Decorative radial glow */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(212,160,23,0.10),transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-20">
          <div className="mb-5" aria-hidden="true">
            <Link href={"/"}>
              <Image
                className="size-14 mx-auto"
                src={"/icons/om-icon-v2.png"}
                width={40}
                height={40}
                alt="om-logo"
              />
            </Link>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            Support the Temple
          </h2>
          <p className="font-hindi text-gold text-xl md:text-2xl mb-5">
            मंदिर का सहयोग करें
          </p>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Your generous donation helps maintain the sacred premises, fund
            community events, and carry forward the divine legacy of Prachin
            Sidh Hanuman Mandir.
          </p>

          <Link
            href="/donation"
            className="btn-gold text-base px-10 py-4 shadow-xl shadow-black/30 hover:shadow-gold/20"
          >
            <Gift size={20} aria-hidden="true" />
            Donate Now
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          8. CONTACT PREVIEW
      ════════════════════════════════════════════════════════════════ */}
      <section className="section-container" aria-label="Visit us">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader hi="हमसे मिलें" en="Visit Us" />

          <div className="card-temple inline-flex flex-col items-center gap-4 px-10 py-8 w-full">
            {/* Map pin icon */}
            <div className="w-14 h-14 rounded-full bg-maroon/10 flex items-center justify-center flex-shrink-0">
              <MapPin size={26} className="text-maroon" aria-hidden="true" />
            </div>

            {/* Address */}
            <address className="not-italic text-center space-y-1">
              <p className="font-semibold text-temple-brown text-base leading-snug">
                Mandir
              </p>
              <p className="text-temple-brown/80 text-sm">
                Geeta Colony, Ram Lila Ground Chowk, East Delhi — 110031
              </p>
              <p className="font-hindi text-primary text-sm mt-2">
                मंदिर
              </p>
              <p className="font-hindi text-primary text-sm mt-2">गीता कॉलोनी, राम लीला ग्राउंड चौक, पूर्वी दिल्ली - 110031
              </p>
            </address>

            {/* Separator */}
            <div className="w-12 h-px bg-[#E8D5C4]" aria-hidden="true" />

            <Link href="/contact" className="btn-primary">
              Full Contact Details →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
