// components/viewer/HtmlPage.tsx
'use client';

import { useMemo } from 'react';

interface HtmlPageProps {
  html: string;
  orientation?: 'portrait' | 'landscape';
}

export default function HtmlPage({ html, orientation = 'portrait' }: HtmlPageProps) {
  const srcdoc = useMemo(() => {
    const width = orientation === 'landscape' ? 1120 : 816;
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1a1a1a;
    overflow-x: hidden;
  }
</style>
</head>
<body>${html}</body>
</html>`;
  }, [html, orientation]);

  return (
    <div className="w-full min-h-full flex items-start justify-center">
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-same-origin"
        className="w-full border-0"
        style={{
          minHeight: '100vh',
          background: 'transparent',
          display: 'block',
        }}
        title="HTML page"
      />
    </div>
  );
}
