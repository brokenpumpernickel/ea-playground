/** Numbers as the screen shows them: up to three decimals, with no trailing zeros (0.8, 0.144, 576). */
export const num = (v: number): string => String(Math.round(v * 1000) / 1000);
