// ═══════════════════════════════════════════════════════
// FEATURE 9: Caste Multi-Select Filter Component
// Checkbox-based multi-picker for search
// ═══════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

const CASTES = [
  'Brahmin', 'Rajput', 'Vaishya', 'Agarwal', 'Gupta', 'Baniya',
  'Jat', 'Yadav', 'Kurmi', 'Saini', 'Khatri', 'Arora',
  'Kayastha', 'Tyagi', 'Gujjar', 'Jatav', 'Prajapati',
  'Sharma', 'Verma', 'Singh', 'Thakur', 'Chauhan',
  'Scheduled Caste', 'Scheduled Tribe', 'OBC', 'Other',
];

interface CasteMultiSelectProps {
  selected: string[];
  onChange: (castes: string[]) => void;
}


export function CasteMultiSelect({ selected, onChange }: CasteMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const toggle = (caste: string) => {
    if (selected.includes(caste)) {
      onChange(selected.filter(c => c !== caste));
    } else {
      onChange([...selected, caste]);
    }
  };

  const filtered = CASTES.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-[#6B3A1F] mb-1">
        Caste <span style={{ fontFamily: "'Yatra One', serif", color: '#E8651A' }}>जाति</span>
        <span className="text-[#7A6355] font-normal ml-1">(multi-select)</span>
      </label>

      {/* Selected Tags */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 border-[1.5px] border-[#E8D5C4] rounded-lg text-sm font-sans bg-white text-left flex items-center gap-2 flex-wrap min-h-[42px] hover:border-[#E8651A] transition-colors"
      >
        {selected.length > 0 ? (
          <>
            {selected.map(c => (
              <span
                key={c}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF3EB] text-[#E8651A] rounded-md text-xs font-medium"
              >
                {c}
                <X
                  size={12}
                  className="cursor-pointer hover:text-red-500"
                  onClick={(e) => { e.stopPropagation(); toggle(c); }}
                />
              </span>
            ))}
          </>
        ) : (
          <span className="text-[#7A6355]">Select castes...</span>
        )}
        <ChevronDown size={16} className="ml-auto text-[#7A6355] flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-[#E8D5C4] rounded-lg shadow-lg max-h-64 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-[#E8D5C4]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search caste..."
                className="w-full px-3 py-2 text-sm border border-[#E8D5C4] rounded-md focus:outline-none focus:border-[#E8651A]"
                autoFocus
              />
            </div>

            {/* Options */}
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.map(caste => (
                <label
                  key={caste}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#FFF3EB] cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(caste)}
                    onChange={() => toggle(caste)}
                    className="w-4 h-4 accent-[#E8651A]"
                  />
                  <span className="text-[#2D1810]">{caste}</span>
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-[#7A6355]">No castes found</p>
              )}
            </div>

            {/* Clear All */}
            {selected.length > 0 && (
              <div className="p-2 border-t border-[#E8D5C4]">
                <button
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear all ({selected.length} selected)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
