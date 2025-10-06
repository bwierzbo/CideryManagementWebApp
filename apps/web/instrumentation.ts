export async function register() {
  // Polyfill self as global for server-side bundles
  if (typeof self === 'undefined') {
    (global as any).self = global;
  }
}
