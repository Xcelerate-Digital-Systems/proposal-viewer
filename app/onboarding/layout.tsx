// app/onboarding/layout.tsx
// Stand-alone layout — no admin sidebar, no AuthGuard wrapper. The page
// itself handles its own auth + completion checks so it can redirect
// straight to /login or / without flashing the wizard chrome.

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-teal">{children}</div>;
}
