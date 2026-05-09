const SIZE_CLASS = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
  hero: 'text-7xl',
} as const;

export type OmSymbolSize = keyof typeof SIZE_CLASS;

type OmSymbolProps = {
  className?: string;
  size?: OmSymbolSize;
};



/** Golden 3D-style Om (ॐ) — replaces folded-hands emoji in header/hero branding. */
export function OmSymbol({ className = '', size = 'md' }: OmSymbolProps) {
  return (
    <span
      className={`select-none inline-block font-serif leading-none ${SIZE_CLASS[size]} ${className}`}
      style={{
        color: '#E8C547',
        textShadow:
          '0 1px 0 rgba(255,255,255,0.35), 0 2px 0 #8B6914, 0 4px 12px rgba(0,0,0,0.45), 0 0 24px rgba(212,160,23,0.35)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
      }}
      aria-hidden
    >
      ॐ
    </span>
  );
}
