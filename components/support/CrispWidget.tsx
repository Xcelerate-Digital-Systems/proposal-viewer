// components/support/CrispWidget.tsx
//
// Loads the Crisp chat widget for in-app support. Renders nothing (and
// loads no script) if NEXT_PUBLIC_CRISP_WEBSITE_ID is unset — keeps the
// admin layout dependency-free until you're ready to take support.
//
// When loaded, identifies the signed-in user to Crisp so inbound chats
// have email + name attached automatically.

'use client';

import { useEffect } from 'react';

const CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;

declare global {
  interface Window {
    $crisp?: unknown[][];
    CRISP_WEBSITE_ID?: string;
  }
}

interface CrispWidgetProps {
  userEmail?: string;
  userName?: string;
  companyName?: string;
}

let loaded = false;

function loadCrispScript() {
  if (loaded || typeof window === 'undefined' || !CRISP_WEBSITE_ID) return;
  loaded = true;
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
  const s = document.createElement('script');
  s.src = 'https://client.crisp.chat/l.js';
  s.async = true;
  document.head.appendChild(s);
}

export function CrispWidget({ userEmail, userName, companyName }: CrispWidgetProps) {
  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;
    loadCrispScript();
  }, []);

  useEffect(() => {
    if (!CRISP_WEBSITE_ID || typeof window === 'undefined' || !window.$crisp) return;
    if (userEmail) {
      window.$crisp.push(['set', 'user:email', [userEmail]]);
    }
    if (userName) {
      window.$crisp.push(['set', 'user:nickname', [userName]]);
    }
    if (companyName) {
      window.$crisp.push(['set', 'user:company', [[companyName]]]);
    }
  }, [userEmail, userName, companyName]);

  return null;
}
