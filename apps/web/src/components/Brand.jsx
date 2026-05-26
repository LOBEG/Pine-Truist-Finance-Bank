/**
 * Brand components: BrandMark (pine-tree-in-shield SVG) and BrandLogo (mark + wordmark).
 * variant="dark"  → pine-800 background, white text (default)
 * variant="light" → white/transparent background, pine-800 text
 * variant="color" → pine-700 background, gold wordmark
 */

export function BrandMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Shield */}
      <path d="M50 4 L90 18 L90 56 Q90 80 50 96 Q10 80 10 56 L10 18 Z" fill="#225f37" />
      {/* Pine tree — trunk */}
      <rect x="44" y="72" width="12" height="16" rx="3" fill="#e0b94a" />
      {/* Pine tree — bottom tier */}
      <polygon points="50,30 66,58 34,58" fill="#e0b94a" />
      {/* Pine tree — middle tier */}
      <polygon points="50,16 63,42 37,42" fill="#e0b94a" opacity="0.85" />
    </svg>
  );
}

export function BrandLogo({ variant = 'dark', className = '' }) {
  const isDark = variant === 'dark' || variant === 'color';
  const textColor = variant === 'light' ? 'text-pine-800' : 'text-white';
  const subColor =
    variant === 'color' ? 'text-gold-400' : variant === 'light' ? 'text-pine-600' : 'text-pine-200';

  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <BrandMark size={34} />
      <span className="flex flex-col leading-tight">
        <span className={`font-extrabold text-base tracking-tight ${textColor}`}>Pine Truist</span>
        <span className={`text-[10px] font-semibold uppercase tracking-widest ${subColor}`}>
          Finance Bank
        </span>
      </span>
    </span>
  );
}
