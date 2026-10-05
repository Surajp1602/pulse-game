// Mirrors server/challenges.js needlePosition: a triangle wave from 0 to 1 and back each period.
export function needlePos({ period }, t) {
  const phase = (((t % period) + period) % period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
