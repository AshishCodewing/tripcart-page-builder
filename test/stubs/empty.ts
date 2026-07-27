// Empty module used by vitest.config.ts to alias `server-only` / `client-only`.
// Those packages throw on import outside the right bundler condition (Next sets
// the `react-server` condition; plain Node/Vitest does not), so tests that pull
// a server-only module transitively would crash. Neutralize them here.
export {}
