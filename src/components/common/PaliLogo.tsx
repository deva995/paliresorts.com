import React from 'react';

interface PaliLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'on-dark' | 'badge' | 'login';
  showTextFallback?: boolean;
}

export const PaliLogo: React.FC<PaliLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'light',
  showTextFallback = false,
}) => {
  // Height sizing
  const sizeClasses = {
    xs: 'h-6 sm:h-7',
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  }[size];

  // Container styling based on background
  if (variant === 'on-dark') {
    return (
      <div className={`inline-flex items-center justify-center bg-white px-3 py-1.5 rounded-xl shadow-sm border border-[#DDD8C9]/80 shrink-0 ${className}`}>
        <img
          src="/palilogo.png"
          alt="Pali Resort & Club • Pali Village"
          className={`${sizeClasses} w-auto object-contain max-w-full`}
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </div>
    );
  }

  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center justify-center bg-white p-2 rounded-2xl shadow-md border border-[#DDD8C9] shrink-0 ${className}`}>
        <img
          src="/palilogo.png"
          alt="Pali Resort & Club • Pali Village"
          className={`${sizeClasses} w-auto object-contain max-w-full`}
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </div>
    );
  }

  if (variant === 'login') {
    return (
      <div className={`inline-flex flex-col items-center justify-center bg-white px-6 py-4 rounded-3xl shadow-xl border border-[#DDD8C9] shrink-0 max-w-xs sm:max-w-sm mx-auto ${className}`}>
        <img
          src="/palilogo.png"
          alt="Pali Resort & Club • Pali Village"
          className="h-20 sm:h-24 w-auto object-contain max-w-full drop-shadow-xs"
          referrerPolicy="no-referrer"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <img
      src="/palilogo.png"
      alt="Pali Resort & Club • Pali Village"
      className={`${sizeClasses} w-auto object-contain shrink-0 ${className}`}
      referrerPolicy="no-referrer"
      loading="eager"
    />
  );
};
