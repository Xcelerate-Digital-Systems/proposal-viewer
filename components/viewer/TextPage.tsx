// components/viewer/TextPage.tsx
'use client';

import { CompanyBranding, deriveBorderColor, ProposalTextPage } from '@/hooks/useProposal';
import { resolveDynamicField } from '@/components/admin/text-editor/DynamicFieldExtension';

interface TextPageProps {
  textPage: ProposalTextPage;
  branding: CompanyBranding;
  clientName?: string;
  companyName?: string;
  userName?: string;
  proposalTitle?: string;
}

// TipTap JSON node type
interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
}

// Render TipTap JSON content to React elements with branded styling
function renderNode(
  node: TipTapNode,
  branding: CompanyBranding,
  context: { clientName?: string; companyName?: string; userName?: string; proposalTitle?: string },
  key: number | string,
  textColor: string,
  muted: string,
  accent: string,
  border: string,
): React.ReactNode {
  if (!node) return null;

  // Text node
  if (node.type === 'text') {
    let element: React.ReactNode = node.text || '';

    // Apply marks (bold, italic, underline, strike, link, code)
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'bold':
            element = <strong key={`mark-${key}`}>{element}</strong>;
            break;
          case 'italic':
            element = <em key={`mark-${key}`}>{element}</em>;
            break;
          case 'underline':
            element = <u key={`mark-${key}`}>{element}</u>;
            break;
          case 'strike':
            element = <s key={`mark-${key}`}>{element}</s>;
            break;
          case 'link':
            element = (
              <a
                key={`mark-${key}`}
                href={mark.attrs?.href as string}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: accent, textDecoration: 'underline' }}
              >
                {element}
              </a>
            );
            break;
          case 'code':
            element = (
              <code
                key={`mark-${key}`}
                style={{
                  backgroundColor: `${textColor}10`,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: '0.85em',
                }}
              >
                {element}
              </code>
            );
            break;
        }
      }
    }

    return element;
  }

  // Dynamic field node
  if (node.type === 'dynamicField') {
    const resolved = resolveDynamicField(node.attrs?.field as string || '', context);
    return (
      <span key={key} style={{ fontWeight: 600, color: accent }}>
        {resolved}
      </span>
    );
  }

  // Container nodes - render children
  const children = node.content?.map((child: TipTapNode, i: number) =>
    renderNode(child, branding, context, `${key}-${i}`, textColor, muted, accent, border)
  );

  const textAlign = node.attrs?.textAlign || 'left';
  const baseStyle = { textAlign: textAlign as 'left' | 'center' | 'right' };

  switch (node.type) {
    case 'doc':
      return <>{children}</>;

    case 'paragraph':
      return (
        <p
          key={key}
          style={{
            ...baseStyle,
            color: textColor,
            fontSize: 14,
            lineHeight: 1.8,
            margin: '0.5em 0',
          }}
        >
          {children || '\u00A0'}
        </p>
      );

    case 'heading': {
      const level = node.attrs?.level || 1;
      const sizes: Record<number, number> = { 1: 24, 2: 20, 3: 17 };
      const weights: Record<number, number> = { 1: 700, 2: 600, 3: 600 };
      const margins: Record<number, string> = { 1: '1em 0 0.5em', 2: '0.8em 0 0.4em', 3: '0.6em 0 0.3em' };
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      return (
        <Tag
          key={key}
          style={{
            ...baseStyle,
            color: textColor,
            fontSize: sizes[level as number] || 20,
            fontWeight: weights[level as number] || 600,
            margin: margins[level as number] || '0.8em 0 0.4em',
            lineHeight: 1.3,
            fontFamily: 'var(--font-display), system-ui, sans-serif',
          }}
        >
          {children}
        </Tag>
      );
    }

    case 'bulletList':
      return (
        <ul
          key={key}
          style={{
            color: textColor,
            paddingLeft: '1.5em',
            margin: '0.5em 0',
            listStyleType: 'disc',
          }}
        >
          {children}
        </ul>
      );

    case 'orderedList':
      return (
        <ol
          key={key}
          style={{
            color: textColor,
            paddingLeft: '1.5em',
            margin: '0.5em 0',
            listStyleType: 'decimal',
          }}
        >
          {children}
        </ol>
      );

    case 'listItem':
      return (
        <li key={key} style={{ margin: '0.25em 0', fontSize: 14, lineHeight: 1.7 }}>
          {children}
        </li>
      );

    case 'blockquote':
      return (
        <blockquote
          key={key}
          style={{
            borderLeft: `3px solid ${accent}`,
            paddingLeft: '1em',
            margin: '0.5em 0',
            color: muted,
            fontStyle: 'italic',
          }}
        >
          {children}
        </blockquote>
      );

    case 'horizontalRule':
      return (
        <hr
          key={key}
          style={{
            border: 'none',
            borderTop: `1px solid ${border}`,
            margin: '1.5em 0',
          }}
        />
      );

    case 'codeBlock':
      return (
        <pre
          key={key}
          style={{
            backgroundColor: `${textColor}08`,
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '1em',
            margin: '0.5em 0',
            fontSize: 13,
            lineHeight: 1.5,
            overflowX: 'auto',
            color: textColor,
          }}
        >
          <code>{children}</code>
        </pre>
      );

    default:
      return children || null;
  }
}

export default function TextPage({ textPage, branding, clientName, companyName, userName, proposalTitle }: TextPageProps) {
  const bgPrimary = branding.bg_primary || '#0f0f0f';
  const bgSecondary = branding.bg_secondary || '#141414';
  const accent = branding.accent_color || '#ff6700';
  const textColor = branding.sidebar_text_color || '#ffffff';
  const border = deriveBorderColor(bgSecondary);
  const muted = `${textColor}99`;

  const context = { clientName, companyName, userName, proposalTitle };
  const doc = textPage.content as TipTapNode;

  return (
    <div
      className="w-full min-h-full flex items-start justify-center py-8 lg:py-12 px-4 sm:px-6"
      style={{ backgroundColor: bgPrimary }}
    >
      <div
        className="w-full max-w-[700px] rounded-xl overflow-hidden"
        style={{ backgroundColor: bgSecondary, border: `1px solid ${border}` }}
      >
        {/* Header accent bar */}
        <div className="h-1" style={{ backgroundColor: accent }} />

        <div className="p-6 sm:p-8 lg:p-10">
          {/* Title */}
          {textPage.title && (
            <div className="mb-6">
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]"
                style={{ color: textColor }}
              >
                {textPage.title}
              </h1>
            </div>
          )}

          {/* Content */}
          <div>
            {doc && renderNode(doc, branding, context, 'root', textColor, muted, accent, border)}
          </div>
        </div>
      </div>
    </div>
  );
}