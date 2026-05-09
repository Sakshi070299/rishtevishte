'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Save, Loader2 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import 'quill/dist/quill.snow.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Setting {
  key: string;
  value: string;
}

// ─── Content Section ──────────────────────────────────────────────────────────

interface ContentSectionProps {
  label: string;
  labelHindi: string;
  settingKey: string;
  value: string;
  onChange: (val: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}

function ContentSection({
  label,
  labelHindi,
  settingKey,
  value,
  onChange,
  onSave,
  saving,
}: ContentSectionProps) {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<any>(null);
  const isSyncingFromPropsRef = useRef(false);

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ font: [] }],
        [{ size: ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
        ['link'],
      ],
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!editorHostRef.current) return;
      if (quillRef.current) return;

      const mod = await import('quill');
      const Quill = mod.default;
      if (cancelled) return;

      const editor = editorHostRef.current;
      // Quill will create its own toolbar + editor inside this container.
      editor.innerHTML = '';

      quillRef.current = new Quill(editor, {
        theme: 'snow',
        modules: quillModules,
        placeholder: `Enter ${label} content here. HTML is supported.`,
        formats: [
          'header',
          'font',
          'size',
          'bold',
          'italic',
          'underline',
          'strike',
          'color',
          'background',
          'script',
          'align',
          'indent',
          'direction',
          'list',
          'bullet',
          'check',
          'ordered',
          'blockquote',
          'code-block',
          'link',
          'image',
          'video',
        ],
      });

      // Initialize with existing HTML.
      quillRef.current.root.innerHTML = value || '';

      quillRef.current.on('text-change', () => {
        if (isSyncingFromPropsRef.current) return;
        const html = quillRef.current?.root?.innerHTML ?? '';
        onChange(html);
      });
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, [label, onChange, quillModules, value]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const next = value || '';
    const current = quill.root.innerHTML;
    if (current === next) return;

    isSyncingFromPropsRef.current = true;
    quill.root.innerHTML = next;
    isSyncingFromPropsRef.current = false;
  }, [value]);

  return (
    <div
      className="rounded-xl border p-5 shadow-sm"
      style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} style={{ color: '#8B1A1A' }} />
          <div>
            <h2 className="font-bold text-base" style={{ color: '#3D1F0B' }}>
              {label}
            </h2>
            <p className="font-hindi text-xs" style={{ color: '#8B1A1A' }}>
              {labelHindi}
            </p>
          </div>
        </div>
        {/* <span
          className="text-xs px-2 py-0.5 rounded-full font-mono"
          style={{ backgroundColor: 'rgba(139,26,26,0.08)', color: '#8B1A1A' }}
        >
          {settingKey}
        </span> */}
      </div>

      {/* Quill editor (store HTML) */}
      <div
        ref={editorHostRef}
        style={{
          backgroundColor: '#FFFAF5',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          minHeight: 260,
        }}
      />

      {/* Save button */}
      <div className="flex justify-end mt-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-60"
          style={{ backgroundColor: '#8B1A1A', color: '#fff' }}
          onMouseEnter={(e) => {
            if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#6B1414';
          }}
          onMouseLeave={(e) => {
            if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = '#8B1A1A';
          }}
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminContentPage() {
  const [terms, setTerms] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingTerms, setSavingTerms] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // ── Load settings on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const settings = await adminApi.getSettings() as Setting[];
        const termsEntry = settings.find((s) => s.key === 'terms_and_conditions');
        const privacyEntry = settings.find((s) => s.key === 'privacy_policy');
        if (termsEntry) setTerms(termsEntry.value);
        if (privacyEntry) setPrivacy(privacyEntry.value);
      } catch {
        toast.error('Failed to load content settings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save handlers ───────────────────────────────────────────────────────
  async function saveTerms() {
    setSavingTerms(true);
    try {
      await adminApi.updateSetting('terms_and_conditions', terms);
      toast.success('Terms & Conditions saved successfully');
    } catch {
      toast.error('Failed to save Terms & Conditions');
    } finally {
      setSavingTerms(false);
    }
  }

  async function savePrivacy() {
    setSavingPrivacy(true);
    try {
      await adminApi.updateSetting('privacy_policy', privacy);
      toast.success('Privacy Policy saved successfully');
    } catch {
      toast.error('Failed to save Privacy Policy');
    } finally {
      setSavingPrivacy(false);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: '#E8D5C4' }} />
          <div className="h-4 w-72 rounded mt-2 animate-pulse" style={{ backgroundColor: '#E8D5C4' }} />
        </div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-5 shadow-sm animate-pulse"
            style={{ backgroundColor: '#fff', borderColor: '#E8D5C4' }}
          >
            <div className="h-5 w-56 rounded mb-4" style={{ backgroundColor: '#E8D5C4' }} />
            <div className="h-56 rounded-lg" style={{ backgroundColor: '#F5EDE3' }} />
            <div className="flex justify-end mt-3">
              <div className="h-9 w-20 rounded-lg" style={{ backgroundColor: '#E8D5C4' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#8B1A1A' }}>
          Content Management
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B3A1F' }}>
          Edit the Terms &amp; Conditions and Privacy Policy shown to users.
        </p>
      </div>

      {/* Terms & Conditions */}
      <ContentSection
        label="Terms & Conditions"
        labelHindi="नियम और शर्तें"
        settingKey="terms_and_conditions"
        value={terms}
        onChange={setTerms}
        onSave={saveTerms}
        saving={savingTerms}
      />

      {/* Privacy Policy */}
      <ContentSection
        label="Privacy Policy"
        labelHindi="गोपनीयता नीति"
        settingKey="privacy_policy"
        value={privacy}
        onChange={setPrivacy}
        onSave={savePrivacy}
        saving={savingPrivacy}
      />
    </div>
  );
}
