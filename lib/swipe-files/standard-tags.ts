// Standard angle categories surfaced in every swipe tag dropdown.
// Kept alongside the other swipe-files config so the in-app editor, the
// Chrome extension, and the tags API all read from one source of truth.
//
// Company-specific custom tags still work — these are merged on top.

export const STANDARD_SWIPE_TAGS: readonly string[] = [
  '🧠 Clarity & Value',
  '💪 Identity & Alignment',
  '⚔️ Enemy / Contrarian',
  '📊 Proof & Transformation',
  '⚙️ Mechanism / Education',
  '💥 Pattern Interrupt & Curiosity',
  '⏰ Offer & Urgency',
  '❤️ Emotional Resonance',
  '🔮 Novelty / Futureproof',
] as const;
