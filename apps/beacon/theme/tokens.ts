import { TextStyle } from 'react-native';

// Lifted exactly from Beacon Design System.dc.html — do not re-pick colors.
export const color = {
  base: '#101114', // app background, never lighter
  panel: '#16181C', // cards, sheets, list surfaces
  textPrimary: '#F2F1EC',
  textMuted: '#A9ACA8',
  ember: '#FF5A36', // time-critical ONLY: countdowns, lock warnings, urgent push
  emberHover: '#FF6E4E',
  emberActive: '#E64A28',
  verified: '#3ED598', // confirmed / verified / all-clear
  hairline: 'rgba(242,241,236,0.12)',
  hairlineStrong: 'rgba(242,241,236,0.28)',
  hairlineInput: 'rgba(242,241,236,0.18)',
  fillHover: '#FFFFFF',
  fillActive: '#D8D7D2',
  fillPlaceholder: 'rgba(242,241,236,0.35)',
  fillMuted: 'rgba(242,241,236,0.06)',
  fillMutedStrong: 'rgba(242,241,236,0.1)',
  fillMutedBorder: 'rgba(242,241,236,0.1)',
  emberTint: 'rgba(255,90,54,0.14)',
  emberTintBorder: 'rgba(255,90,54,0.4)',
  emberBorderStrong: 'rgba(255,90,54,0.45)',
  emberBorderSoft: 'rgba(255,90,54,0.4)',
  verifiedTint: 'rgba(62,213,152,0.12)',
  verifiedTintBorder: 'rgba(62,213,152,0.4)',
  verifiedBorderStrong: 'rgba(62,213,152,0.45)',
  neutralBorder: 'rgba(242,241,236,0.22)',
  rowHighlight: 'rgba(242,241,236,0.03)',
} as const;

export const fontFamily = {
  rajdhaniMedium: 'Rajdhani_500Medium',
  rajdhaniSemiBold: 'Rajdhani_600SemiBold',
  rajdhaniBold: 'Rajdhani_700Bold',
  interRegular: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
} as const;

// Back-compat alias used by early scaffold files.
export const font = {
  display: fontFamily.rajdhaniSemiBold,
  displayBold: fontFamily.rajdhaniBold,
  displayMedium: fontFamily.rajdhaniMedium,
  body: fontFamily.interRegular,
  bodyMedium: fontFamily.interMedium,
  bodySemiBold: fontFamily.interSemiBold,
} as const;

export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

// Type scale — section 02 of the design system. Name matches the reference
// labels (D1/D2/D3, B1/B2/B3, Eyebrow, Label) so screens can cite them.
export const type = {
  d1: { fontFamily: fontFamily.rajdhaniBold, fontSize: 40, lineHeight: 42 } as TextStyle,
  d2: { fontFamily: fontFamily.rajdhaniBold, fontSize: 28, lineHeight: 31 } as TextStyle,
  d3: {
    fontFamily: fontFamily.rajdhaniSemiBold,
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: 0.02 * 20,
  } as TextStyle,
  eyebrow: {
    fontFamily: fontFamily.rajdhaniSemiBold,
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0.14 * 12,
    textTransform: 'uppercase',
    color: color.textMuted,
  } as TextStyle,
  b1: { fontFamily: fontFamily.interRegular, fontSize: 16, lineHeight: 24 } as TextStyle,
  b2: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: color.textMuted,
  } as TextStyle,
  b3: { fontFamily: fontFamily.interMedium, fontSize: 13, lineHeight: 19 } as TextStyle,
  label: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 0.16 * 11,
    textTransform: 'uppercase',
    color: color.textMuted,
  } as TextStyle,
  eyebrowSmall: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.16 * 10,
    textTransform: 'uppercase',
    color: color.textMuted,
  } as TextStyle,
  statHero: {
    fontFamily: fontFamily.rajdhaniBold,
    fontSize: 38,
    lineHeight: 38,
    ...tabularNums,
  } as TextStyle,
  lobbyCode: {
    fontFamily: fontFamily.rajdhaniSemiBold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: 0.18 * 30,
    ...tabularNums,
  } as TextStyle,
  tableFigure: {
    fontFamily: fontFamily.interMedium,
    fontSize: 15,
    lineHeight: 21,
    ...tabularNums,
  } as TextStyle,
} as const;

// 4pt grid, 390pt mobile base width per BUILD.md section 6.
export const space = (n: number) => n * 4;

export const radius = {
  buttonCut: 10,
  panelCut: 18,
} as const;

export const minTouch = 48;
