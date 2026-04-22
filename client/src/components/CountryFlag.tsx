interface CountryFlagProps {
  code: string; // ISO 3166-1 alpha-2 country code (e.g. 'TR', 'US')
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CountryFlag({ code, size = 'md', className = '' }: CountryFlagProps) {
  const lowerCode = code?.toLowerCase() || '';
  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-5 h-4',
    lg: 'w-8 h-6',
  };

  return (
    <span
      className={`fi fi-${lowerCode} ${sizeClasses[size]} inline-block rounded-sm ${className}`}
      role="img"
      aria-label={`${code} flag`}
    />
  );
}
