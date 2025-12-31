// Shim to enable require() in ESM context for packages that need it (like googleapis)
import { createRequire } from 'node:module';

// Make require available globally for packages that use dynamic require
if (typeof globalThis.require === 'undefined') {
  (globalThis as any).require = createRequire(import.meta.url);
}
