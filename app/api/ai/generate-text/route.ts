// app/api/ai/generate-text/route.ts
// QuoteWin-style "Generate with AI" endpoint. Powers the Scope of Works,
// About Your Business, and Customer Testimonial buttons in the quote builder.
//
// Uses the Anthropic Messages API directly via fetch — no SDK needed. Haiku
// 4.5 is the right tool for these short marketing/scope blurbs (fast + cheap).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

type GenerateKind = 'scope' | 'about' | 'testimonial';

const PROMPTS: Record<GenerateKind, (ctx: GenerateContext) => string> = {
  scope: ({ projectTitle, lineItems }) =>
    `Write a short, confident "Scope of Works" paragraph for a tradesperson's quote.
Project title: ${projectTitle || 'Renovation project'}.
Line items the trade is delivering:\n${formatLineItems(lineItems)}\n
Keep it 80-140 words, plain prose, no bullet points, no markdown. Mention that
the trade handles every stage in-house and the client has a single point of
contact. End with a sentence about expected duration if it makes sense.`,
  about: ({ projectTitle }) =>
    `Write a short "About Us" blurb for a small Australian trade business that
appears on a quote. Project category context: ${projectTitle || 'general renovation work'}.
Keep it 60-100 words, plain prose, no bullets or markdown. Mention years of
experience, in-house team, full insurance/licensing, and that there's no
sub-contracting. Use first person plural ("we").`,
  testimonial: ({ projectTitle }) =>
    `Invent a realistic-sounding customer testimonial (4-6 sentences) for a
trade business that just completed: ${projectTitle || 'a renovation'}.
Praise quote accuracy, on-site cleanliness, sticking to the timeline, and
finished quality. End with a first name and suburb (e.g. "— Sarah T., Mosman NSW").
Plain prose, in double quotes, no markdown.`,
};

interface GenerateContext {
  projectTitle?: string;
  lineItems?: Array<{ label?: string; description?: string; amount?: number }>;
}

function formatLineItems(items: GenerateContext['lineItems']): string {
  if (!items || items.length === 0) return '(none provided)';
  return items
    .slice(0, 12)
    .map((i) => `- ${i.description || i.label || 'Item'}`)
    .join('\n');
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI generation is not configured on this deployment' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const kind: GenerateKind | undefined = body?.kind;
  if (!kind || !PROMPTS[kind]) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const prompt = PROMPTS[kind]({
    projectTitle: typeof body.projectTitle === 'string' ? body.projectTitle : undefined,
    lineItems: Array.isArray(body.lineItems) ? body.lineItems : undefined,
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        temperature: 0.6,
        system:
          'You write concise, plain-prose copy for trade business quotes. ' +
          'No markdown, no bullet points unless explicitly asked. Return only ' +
          'the requested copy — no preamble like "Here is the…".',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Anthropic API error:', res.status, detail);
      return NextResponse.json({ error: 'Generation failed' }, { status: 502 });
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text!)
      .join('')
      .trim();

    return NextResponse.json({ success: true, text });
  } catch (err) {
    console.error('AI generate error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 });
  }
}
