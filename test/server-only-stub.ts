// Vitest runs outside Next.js's bundler, which is what actually no-ops the
// real `server-only` package during server compilation. Point the alias
// here instead so pure-logic tests can import server-only modules.
export {};
