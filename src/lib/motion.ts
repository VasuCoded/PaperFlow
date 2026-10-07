/**
 * The app's one easing curve and set of durations, for the motion library.
 * The CSS has the same values as --ease, --dur-fast, --dur and --dur-slow
 * (src/styles/paperflow.css); keep the two in step.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  fast: 0.12,
  base: 0.2,
  slow: 0.28,
} as const;

export const TRANSITION = { duration: DUR.base, ease: EASE } as const;
