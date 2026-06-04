// lib/branding/index.ts
export {
  hexToRgb,
  rgbToHex,
  hexToRgba,
  withAlpha,
  hexToOklch,
  oklchToHex,
  adjustLightness,
  setLightness,
  setLightnessAndChroma,
  isValidHex,
} from './color-math';

export { generateBrandPalette, type BrandPalette } from './color-palette';
