// Lifted exactly from Beacon Design System.dc.html — do not re-pick colors.
export const color = {
  base: '#101114', // app background, never lighter
  panel: '#16181C', // cards, sheets, list surfaces
  textPrimary: '#F2F1EC',
  textMuted: '#A9ACA8',
  ember: '#FF5A36', // time-critical ONLY: countdowns, lock warnings, urgent push
  verified: '#3ED598', // confirmed / verified / all-clear
  hairline: 'rgba(242,241,236,0.12)',
} as const;

export const font = {
  display: 'Rajdhani_600SemiBold',
  displayBold: 'Rajdhani_700Bold',
  displayMedium: 'Rajdhani_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const numericStyle = {
  fontVariant: ['tabular-nums' as const],
};

// 4pt grid, 390pt mobile base width per BUILD.md section 6.
export const space = (n: number) => n * 4;
