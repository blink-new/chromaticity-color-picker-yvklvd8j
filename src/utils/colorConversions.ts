// Color space conversion utilities for chromaticity diagram
export interface XYZColor {
  x: number;
  y: number;
  z: number;
}

export interface xyColor {
  x: number;
  y: number;
  Y: number; // luminance
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface LABColor {
  l: number;
  a: number;
  b: number;
}

export interface OKLCHColor {
  l: number;
  c: number;
  h: number;
}

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export type ColorSpace = 'sRGB' | 'P3' | 'Rec2020' | 'XYZ' | 'LAB' | 'OKLCH';

// CIE 1931 XYZ color matching functions (simplified)
export const D65_WHITE_POINT = { x: 0.3127, y: 0.3290, Y: 1.0 };

// sRGB working space matrix
const sRGB_MATRIX = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.2040, 1.0570]
];

// P3 working space matrix
const P3_MATRIX = [
  [2.4934, -0.9313, -0.4027],
  [-0.8295, 1.7627, 0.0236],
  [0.0358, -0.0761, 0.9569]
];

// Rec2020 working space matrix
const REC2020_MATRIX = [
  [1.7167, -0.3557, -0.2534],
  [-0.6667, 1.6165, 0.0158],
  [0.0176, -0.0428, 0.9421]
];

// Convert XYZ to xyY chromaticity coordinates
export function XYZToxyY(xyz: XYZColor): xyColor {
  const sum = xyz.x + xyz.y + xyz.z;
  if (sum === 0) return { x: 0, y: 0, Y: 0 };
  
  return {
    x: xyz.x / sum,
    y: xyz.y / sum,
    Y: xyz.y
  };
}

// Convert xyY to XYZ
export function xyYToXYZ(xyY: xyColor): XYZColor {
  if (xyY.y === 0) return { x: 0, y: 0, z: 0 };
  
  const Y = xyY.Y;
  const x = (xyY.x * Y) / xyY.y;
  const z = ((1 - xyY.x - xyY.y) * Y) / xyY.y;
  
  return { x, y: Y, z };
}

// Convert XYZ to RGB for a given color space
export function XYZToRGB(xyz: XYZColor, colorSpace: ColorSpace = 'sRGB'): RGBColor {
  let matrix: number[][];
  
  switch (colorSpace) {
    case 'P3':
      matrix = P3_MATRIX;
      break;
    case 'Rec2020':
      matrix = REC2020_MATRIX;
      break;
    default:
      matrix = sRGB_MATRIX;
  }
  
  const r = matrix[0][0] * xyz.x + matrix[0][1] * xyz.y + matrix[0][2] * xyz.z;
  const g = matrix[1][0] * xyz.x + matrix[1][1] * xyz.y + matrix[1][2] * xyz.z;
  const b = matrix[2][0] * xyz.x + matrix[2][1] * xyz.y + matrix[2][2] * xyz.z;
  
  return { r, g, b };
}

// Convert RGB to XYZ for a given color space
export function RGBToXYZ(rgb: RGBColor, colorSpace: ColorSpace = 'sRGB'): XYZColor {
  let matrix: number[][];
  
  switch (colorSpace) {
    case 'P3':
      matrix = [
        [0.4865, 0.2657, 0.1982],
        [0.2290, 0.6917, 0.0793],
        [0.0000, 0.0451, 1.0439]
      ];
      break;
    case 'Rec2020':
      matrix = [
        [0.6370, 0.1446, 0.1689],
        [0.2627, 0.6780, 0.0593],
        [0.0000, 0.0281, 1.0609]
      ];
      break;
    default:
      matrix = [
        [0.4124, 0.3576, 0.1805],
        [0.2126, 0.7152, 0.0722],
        [0.0193, 0.1192, 0.9505]
      ];
  }
  
  const x = matrix[0][0] * rgb.r + matrix[0][1] * rgb.g + matrix[0][2] * rgb.b;
  const y = matrix[1][0] * rgb.r + matrix[1][1] * rgb.g + matrix[1][2] * rgb.b;
  const z = matrix[2][0] * rgb.r + matrix[2][1] * rgb.g + matrix[2][2] * rgb.b;
  
  return { x, y, z };
}

// Gamma correction
export function gammaCorrect(value: number): number {
  if (value <= 0.0031308) {
    return 12.92 * value;
  } else {
    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  }
}

// Inverse gamma correction
export function gammaUncorrect(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  } else {
    return Math.pow((value + 0.055) / 1.055, 2.4);
  }
}

// Convert RGB to HSL
export function RGBToHSL(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
    h /= 6;
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert XYZ to LAB
export function XYZToLAB(xyz: XYZColor): LABColor {
  const xn = 0.95047; // D65 illuminant
  const yn = 1.00000;
  const zn = 1.08883;
  
  const fx = labF(xyz.x / xn);
  const fy = labF(xyz.y / yn);
  const fz = labF(xyz.z / zn);
  
  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  
  return { l, a, b };
}

function labF(t: number): number {
  return t > 0.008856 ? Math.pow(t, 1/3) : 7.787 * t + 16/116;
}

// Convert LAB to OKLCH (approximation)
export function LABToOKLCH(lab: LABColor): OKLCHColor {
  const l = lab.l / 100;
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b) / 100;
  const h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
  
  return { l, c, h: h < 0 ? h + 360 : h };
}

// Generate color in modern CSS formats
export function generateCSSColor(rgb: RGBColor, colorSpace: ColorSpace = 'sRGB'): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.r)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.g)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.b)));
  
  switch (colorSpace) {
    case 'P3':
      return `color(display-p3 ${(r/255).toFixed(4)} ${(g/255).toFixed(4)} ${(b/255).toFixed(4)})`;
    case 'Rec2020':
      return `color(rec2020 ${(r/255).toFixed(4)} ${(g/255).toFixed(4)} ${(b/255).toFixed(4)})`;
    default:
      return `rgb(${r}, ${g}, ${b})`;
  }
}

// Check if color is in gamut for given color space
export function isInGamut(rgb: RGBColor): boolean {
  return rgb.r >= 0 && rgb.r <= 255 && 
         rgb.g >= 0 && rgb.g <= 255 && 
         rgb.b >= 0 && rgb.b <= 255;
}

// Get color temperature from chromaticity coordinates
export function getColorTemperature(x: number, y: number): number {
  const n = (x - 0.3320) / (0.1858 - y);
  return 449 * Math.pow(n, 3) + 3525 * Math.pow(n, 2) + 6823.3 * n + 5520.33;
}

// CIE 1931 chromaticity diagram boundary points (simplified)
export const CHROMATICITY_BOUNDARY = [
  { x: 0.7347, y: 0.2653 }, // 700nm
  { x: 0.2738, y: 0.7174 }, // 546nm
  { x: 0.1666, y: 0.0089 }, // 435nm
  { x: 0.7347, y: 0.2653 }  // back to 700nm
];

// sRGB gamut triangle
export const SRGB_GAMUT = [
  { x: 0.64, y: 0.33 }, // Red
  { x: 0.30, y: 0.60 }, // Green
  { x: 0.15, y: 0.06 }, // Blue
  { x: 0.64, y: 0.33 }  // back to Red
];

// P3 gamut triangle
export const P3_GAMUT = [
  { x: 0.68, y: 0.32 }, // Red
  { x: 0.265, y: 0.69 }, // Green
  { x: 0.15, y: 0.06 }, // Blue
  { x: 0.68, y: 0.32 }  // back to Red
];

// Rec2020 gamut triangle
export const REC2020_GAMUT = [
  { x: 0.708, y: 0.292 }, // Red
  { x: 0.170, y: 0.797 }, // Green
  { x: 0.131, y: 0.046 }, // Blue
  { x: 0.708, y: 0.292 }  // back to Red
];