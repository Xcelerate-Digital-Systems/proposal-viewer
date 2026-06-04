// lib/branding/color-math.ts
// OKLCH-based color manipulation for perceptually uniform shade generation.

// ─── Hex ↔ RGB ──────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(b).toString(16).padStart(2, '0')
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return hex.slice(0, 7) + a.toString(16).padStart(2, '0');
}

// ─── sRGB ↔ Linear ─────────────────────────────────────────────────────────

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ─── Linear RGB ↔ OKLab ────────────────────────────────────────────────────

function linearRgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2024326363 * g + 0.6892648819 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// ─── OKLab ↔ OKLCH ─────────────────────────────────────────────────────────

type OKLCH = { L: number; C: number; H: number };

function oklabToOklch(L: number, a: number, b: number): OKLCH {
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function oklchToOklab(lch: OKLCH): [number, number, number] {
  const hRad = (lch.H * Math.PI) / 180;
  return [lch.L, lch.C * Math.cos(hRad), lch.C * Math.sin(hRad)];
}

// ─── Hex ↔ OKLCH (convenience) ─────────────────────────────────────────────

export function hexToOklch(hex: string): OKLCH {
  const [r, g, b] = hexToRgb(hex);
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const [L, a, ob] = linearRgbToOklab(lr, lg, lb);
  return oklabToOklch(L, a, ob);
}

function isInGamut(r: number, g: number, b: number): boolean {
  return r >= -0.001 && r <= 1.001 && g >= -0.001 && g <= 1.001 && b >= -0.001 && b <= 1.001;
}

export function oklchToHex(lch: OKLCH): string {
  let { L, C, H } = lch;
  L = Math.max(0, Math.min(1, L));

  const [labL, labA, labB] = oklchToOklab({ L, C, H });
  let [lr, lg, lb] = oklabToLinearRgb(labL, labA, labB);

  if (!isInGamut(lr, lg, lb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      const [mL, mA, mB] = oklchToOklab({ L, C: mid, H });
      const [mr, mg, mb] = oklabToLinearRgb(mL, mA, mB);
      if (isInGamut(mr, mg, mb)) {
        lo = mid;
        lr = mr;
        lg = mg;
        lb = mb;
      } else {
        hi = mid;
      }
    }
  }

  return rgbToHex(linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb));
}

// ─── High-level shade operations ────────────────────────────────────────────

export function adjustLightness(hex: string, delta: number): string {
  const lch = hexToOklch(hex);
  return oklchToHex({ ...lch, L: lch.L + delta });
}

export function setLightness(hex: string, targetL: number): string {
  const lch = hexToOklch(hex);
  return oklchToHex({ ...lch, L: targetL });
}

export function setLightnessAndChroma(hex: string, targetL: number, targetC: number): string {
  const lch = hexToOklch(hex);
  return oklchToHex({ L: targetL, C: targetC, H: lch.H });
}

export function isValidHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color);
}
