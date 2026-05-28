// components/ui/AppLoader.tsx
'use client';

export default function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark">
      <div className="flex flex-col items-center gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-agencyviz.svg"
          alt="AgencyViz"
          className="h-8 opacity-90"
        />
        <div className="relative w-8 h-8">
          <div
            className="absolute inset-0 rounded-full border-2 border-surface-dark-accent/20"
          />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-surface-dark-accent animate-spin"
          />
        </div>
      </div>
    </div>
  );
}
