/* Umgebungs-Helfer. Hier kommt alles hin, was Browser-Eigenschaften abfragt. */

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;
}
