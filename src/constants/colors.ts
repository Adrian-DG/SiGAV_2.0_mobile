/**
 * COMIPOL (Comisión Militar y Policial) institutional color palette.
 * Base hues sampled directly from the official crest (assets/images/brand/comipol-crest.png):
 * institutional blue, eagle-wreath green, and the MOPC orange band.
 * Each hue is expanded into a 50–900 tint/shade scale for UI use (surfaces, borders, states).
 */

type ColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const blue: ColorScale = {
  50: '#ebf1f7',
  100: '#d5e2ee',
  200: '#aac5dd',
  300: '#7da6cb',
  400: '#4680b5',
  500: '#05539B',
  600: '#044785',
  700: '#043c70',
  800: '#03305a',
  900: '#022544',
};

export const green: ColorScale = {
  50: '#ebf3ef',
  100: '#d4e6dd',
  200: '#a8ccbc',
  300: '#7ab298',
  400: '#42916c',
  500: '#006A39',
  600: '#005b31',
  700: '#004c29',
  800: '#003d21',
  900: '#002f19',
};

export const orange: ColorScale = {
  50: '#fef4eb',
  100: '#fce9d4',
  200: '#fad2a8',
  300: '#f7ba7a',
  400: '#f39d42',
  500: '#EF7B00',
  600: '#ce6a00',
  700: '#ac5900',
  800: '#8b4700',
  900: '#693600',
};

export const gray: ColorScale = {
  50: '#f2f3f4',
  100: '#e3e5e7',
  200: '#c7cacf',
  300: '#aaaeb6',
  400: '#868c97',
  500: '#5B6472',
  600: '#4e5662',
  700: '#424852',
  800: '#353a42',
  900: '#282c32',
};

export const red: ColorScale = {
  50: '#fceeee',
  100: '#f8dada',
  200: '#f1b6b6',
  300: '#ea8f8f',
  400: '#e16060',
  500: '#D62828',
  600: '#b82222',
  700: '#9a1d1d',
  800: '#7c1717',
  900: '#5e1212',
};

export const amber: ColorScale = {
  50: '#fef8eb',
  100: '#fdf0d4',
  200: '#fbe2a8',
  300: '#f8d27a',
  400: '#f5bf42',
  500: '#F2A900',
  600: '#d09100',
  700: '#ae7a00',
  800: '#8c6200',
  900: '#6a4a00',
};

/**
 * Semantic aliases. Screens should reference these, not the raw scales above,
 * so a future re-brand only touches this block.
 */
export const Palette = {
  primary: blue,
  secondary: green,
  accent: orange,
  neutral: gray,
  success: green,
  warning: amber,
  danger: red,
  info: blue,

  white: '#ffffff',
  black: '#000000',
} as const;
