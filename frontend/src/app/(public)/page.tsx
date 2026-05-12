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
  Users,
  Search,
  CheckCircle,
} from "lucide-react";
import { isAuthenticated, contentApi } from "@/lib/api";

const INTRO_CARDS = [
  {
    icon: Shield,
    title: "Verified Profiles",
    hi: "सत्यापित प्रोफाइल",
    desc: "Every profile goes through a careful review process to ensure genuine and trustworthy connections for your family.",
  },
  {
    icon: Heart,
    title: "Perfect Matchmaking",
    hi: "सही जोड़ा",
    desc: "Our smart search helps you find compatible matches based on your preferences, values, and family expectations.",
  },
  {
    icon: Users,
    title: "Community Trust",
    hi: "समुदाय का विश्वास",
    desc: "Thousands of families trust TheMarriageHome.com to find meaningful and lasting matrimonial connections.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    num: "1",
    title: "Create Profile",
    hi: "प्रोफाइल बनाएं",
    desc: "Register and create a detailed biodata with personal, family, and professional information.",
  },
  {
    num: "2",
    title: "Upload Photo",
    hi: "फोटो अपलोड करें",
    desc: "Add a recent photograph to your profile for better visibility and matching.",
  },
  {
    num: "3",
    title: "Search Matches",
    hi: "जोड़ा खोजें",
    desc: "Browse and search profiles that match your preferences and requirements.",
  },
  {
    num: "4",
    title: "Get Connected",
    hi: "जुड़ें",
    desc: "Find your perfect match and take the first step towards your forever home.",
  },
] as const;

const TESTIMONIALS = [
  {
    name: "Rajesh & Priya Sharma",
    loc: "Delhi",
    text: "We found our perfect match through TheMarriageHome.com. The platform is very user-friendly and the profiles are genuine and trustworthy.",
    hi: "हमें यहाँ से सही जोड़ा मिला।",
    initials: "RS",
  },
  {
    name: "Amit & Sunita Verma",
    loc: "Ghaziabad",
    text: "Very trustworthy service. We appreciate the ease of searching profiles and the quality of matches available on the platform.",
    hi: "बहुत भरोसेमंद सेवा।",
    initials: "AV",
  },
  {
    name: "Suresh & Meena Gupta",
    loc: "Noida",
    text: "TheMarriageHome.com made our search so easy. The platform truly understands the value of family bonds and meaningful connections.",
    hi: "हमारा रिश्ता यहीं से तय हुआ।",
    initials: "SG",
  },
] as const;

const FAQS = [
  {
    q: "What is TheMarriageHome.com?",
    qh: "TheMarriageHome.com क्या है?",
    a: "TheMarriageHome.com is a premium matrimony platform that helps families connect for matrimonial purposes in a respectful and trustworthy environment.",
    ah: "TheMarriageHome.com एक प्रीमियम विवाह मंच है, जिसमें परिवारों को वैवाहिक संबंधों के लिए एक विश्वसनीय और सम्मानजनक वातावरण में जोड़ने का अवसर दिया जाता है।",
  },
  {
    q: "How can I register?",
    qh: "रजिस्ट्रेशन कैसे करें?",
    a: "You can register anytime through our website TheMarriageHome.com, which is available 24x7. Simply create an account and fill in your profile details.",
    ah: "आप हमारी वेबसाइट TheMarriageHome.com पर किसी भी दिन, किसी भी समय (24x7) रजिस्ट्रेशन कर सकते हैं।",
  },
  {
    q: "Can I view profiles without payment?",
    qh: "क्या बिना भुगतान के प्रोफाइल देख सकते हैं?",
    a: "Yes! You can browse and view profiles without any payment. Contact details are protected for privacy and are shared only when both parties express interest.",
    ah: "हाँ! आप बिना किसी भुगतान के प्रोफाइल देख सकते हैं। संपर्क विवरण गोपनीयता के लिए सुरक्षित रखे जाते हैं।",
  },
  {
    q: "Are the profiles verified?",
    qh: "क्या प्रोफाइल सत्यापित हैं?",
    a: "We encourage genuine profiles and review submissions. However, participants are advised to do their own due diligence before proceeding.",
    ah: "हम वास्तविक प्रोफाइल को प्रोत्साहित करते हैं। कृपया स्वयं जांच-पड़ताल अवश्य करें।",
  },
  {
    q: "Is my contact information safe?",
    qh: "क्या मेरी संपर्क जानकारी सुरक्षित है?",
    a: "Yes. Mobile numbers and email addresses are hidden from profile viewers to protect your privacy. Only registered users can browse profiles.",
    ah: "हाँ। मोबाइल नंबर और ईमेल पते प्रोफाइल देखने वालों से छिपे रहते हैं।",
  },
  {
    q: "What documents are required for registration?",
    qh: "रजिस्ट्रेशन के लिए कौन-कौन से दस्तावेज चाहिए?",
    a: "Basic details such as name, age, contact information, and other relevant matrimonial details are required along with a recent photograph.",
    ah: "नाम, आयु, संपर्क विवरण और अन्य वैवाहिक जानकारी की आवश्यकता होती है।",
  },
] as const;

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
          light ? "text-gold" : "text-primary",
        ].join(" ")}
      >
        {hi}
      </p>
      <h2
        className={[
          "text-3xl md:text-4xl font-extrabold",
          light ? "text-white" : "text-navy",
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
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-navy text-sm sm:text-base leading-snug">
            {faq.q}
          </p>
          <p className="font-hindi text-primary text-xs sm:text-sm mt-0.5 opacity-80">
            {faq.qh}
          </p>
        </div>
        <ChevronDown
          size={20}
          className={[
            "flex-shrink-0 mt-0.5 text-primary transition-transform duration-300",
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
        <div className="px-6 pb-5 pt-0 border-t border-gray-100">
          <p className="text-gray-600 text-sm leading-relaxed mt-4">
            {faq.a}
          </p>
          <p className="font-hindi text-primary/70 text-xs mt-2">
            {faq.ah}
          </p>
        </div>
      </div>
    </div>
  );
}

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
      {/* HERO SECTION */}
      <section
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy via-navy-dark to-[#0a1628] text-white"
        aria-label="Hero"
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(197,150,44,0.12),transparent_65%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a1628]/60 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-20">
          <div className="mb-6" aria-hidden="true">
            <Image
              className="mx-auto"
              src="/icons/marriagehome-logo.png"
              width={160}
              height={160}
              alt="TheMarriageHome.com"
              unoptimized
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none mb-2">
            The<span className="text-gold">Marriage</span><span className="text-primary">Home</span><span className="text-gold">.com</span>
          </h1>
          <p className="font-hindi text-gold text-2xl md:text-3xl font-bold mb-4">
            अपना जीवनसाथी खोजें
          </p>

          <p className="text-white/70 text-base md:text-lg max-w-lg mx-auto leading-relaxed mb-10">
            Find Your Forever Home — Premium matrimony platform connecting families for meaningful and lasting relationships.
          </p>

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
              Learn More
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-12 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={14} />
              Verified Profiles
            </span>
            <span className="flex items-center gap-1.5">
              <Shield size={14} />
              Privacy Protected
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              Trusted by Families
            </span>
          </div>
        </div>
      </section>

      {/* BANNER CAROUSEL */}
      {banners.length > 0 && (
        <section className="bg-cream-dark" aria-label="Announcements">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="relative rounded-2xl overflow-hidden shadow-lg">
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

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-4 pt-10">
                <p className="text-white font-semibold text-sm sm:text-base drop-shadow">
                  {banners[bannerIndex].title}
                </p>
                {banners[bannerIndex].titleHi && (
                  <p className="font-hindi text-gold text-xs sm:text-sm drop-shadow">
                    {banners[bannerIndex].titleHi}
                  </p>
                )}

                {banners.length > 1 && (
                  <div className="flex gap-1.5 mt-2">
                    {banners.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setBannerIndex(i)}
                        aria-label={`Go to banner ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === bannerIndex ? 'w-6 bg-gold' : 'w-1.5 bg-white/50 hover:bg-white/80'}`}
                      />
                    ))}
                  </div>
                )}
              </div>

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

      {/* INTRO CARDS */}
      <section className="section-container" aria-label="About TheMarriageHome">
        <SectionHeader hi="हमारे बारे में" en="Why TheMarriageHome.com?" />
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {INTRO_CARDS.map(({ icon: Icon, title, hi, desc }) => (
            <div key={title} className="card-temple group text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                <Icon size={28} className="text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-navy mb-1">{title}</h3>
              <p className="font-hindi text-primary text-base mb-3">{hi}</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-cream-dark" aria-label="How it works">
        <div className="section-container">
          <SectionHeader hi="प्रक्रिया" en="How It Works" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map(({ num, title, hi, desc }, idx) => (
              <div key={num} className="relative text-center group">
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

                <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-extrabold mx-auto mb-4 shadow-lg shadow-primary/30 group-hover:-translate-y-1 transition-transform duration-300">
                  {num}
                </div>

                <h3 className="font-bold text-navy text-base mb-1">
                  {title}
                </h3>
                <p className="font-hindi text-primary text-sm mb-2">{hi}</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/register" className="btn-primary text-base px-8 py-4">
              Start Registration
            </Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-container" aria-label="Testimonials">
        <SectionHeader hi="सफल विवाह" en="Success Stories" />
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map(({ name, loc, text, hi, initials }) => (
            <div key={name} className="card-temple flex flex-col">
              <Quote
                size={32}
                className="text-primary/20 mb-3 flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-3">
                &ldquo;{text}&rdquo;
              </p>
              <p className="font-hindi text-primary/70 text-xs mb-5 leading-relaxed">
                &ldquo;{hi}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-navy text-white flex items-center justify-center text-xs font-bold flex-shrink-0"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-navy text-sm leading-snug truncate">
                    {name}
                  </p>
                  <p className="text-gray-400 text-xs">{loc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      {galleryImages.length > 0 && (
        <section className="bg-cream-dark" aria-label="Gallery preview">
          <div className="section-container">
            <SectionHeader hi="गैलरी" en="Gallery" />
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
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-white font-semibold text-sm leading-snug">
                      {title}
                    </p>
                    <p className="font-hindi text-gold text-xs mt-0.5">
                      {titleHi}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Link href="/gallery" className="btn-outline">
                View Full Gallery
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
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

      {/* CTA SECTION */}
      <section
        className="bg-gradient-to-br from-navy via-navy-dark to-[#0a1628] relative overflow-hidden"
        aria-label="Call to action"
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,rgba(194,24,91,0.08),transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-20">
          <div className="mb-5" aria-hidden="true">
            <Link href="/">
              <Image
                className="mx-auto h-16 w-auto"
                src="/icons/marriagehome-logo.png"
                width={60}
                height={60}
                alt="TheMarriageHome.com"
                unoptimized
              />
            </Link>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            Start Your Journey Today
          </h2>
          <p className="font-hindi text-gold text-xl md:text-2xl mb-5">
            आज ही अपनी खोज शुरू करें
          </p>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Join thousands of families who found their perfect match on TheMarriageHome.com. Register now and take the first step towards finding your forever home.
          </p>

          <Link
            href="/register"
            className="btn-gold text-base px-10 py-4 shadow-xl shadow-black/30"
          >
            <Heart size={20} aria-hidden="true" />
            Register Now
          </Link>
        </div>
      </section>

      {/* CONTACT PREVIEW */}
      <section className="section-container" aria-label="Contact us">
        <div className="max-w-2xl mx-auto text-center">
          <SectionHeader hi="हमसे संपर्क करें" en="Get In Touch" />

          <div className="card-temple inline-flex flex-col items-center gap-4 px-10 py-8 w-full">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Heart size={26} className="text-primary" aria-hidden="true" />
            </div>

            <div className="text-center space-y-1">
              <p className="font-semibold text-navy text-base leading-snug">
                TheMarriageHome.com
              </p>
              <p className="text-gray-500 text-sm">
                Find Your Forever Home
              </p>
              <p className="font-hindi text-primary text-sm mt-2">
                अपना जीवनसाथी खोजें
              </p>
            </div>

            <div className="w-12 h-px bg-gray-200" aria-hidden="true" />

            <Link href="/contact" className="btn-primary">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
