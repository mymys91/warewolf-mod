// Ignores taps for a short window after a guarded tap. All handlers wrapped by
// one guard share the window, so a double tap that lands on the button rendered
// in place of the first one is dropped.
export function createTapGuard(ms, clock = Date.now) {
  let until = 0;
  return {
    wrap(fn) {
      return (...args) => {
        const now = clock();
        if (now < until) return;
        until = now + ms;
        fn(...args);
      };
    },
  };
}
