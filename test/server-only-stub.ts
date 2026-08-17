// `server-only` throws on import outside an RSC graph, which is exactly what a
// Vitest run is. Server modules under test still import it for the real build;
// this stub stands in so they can be exercised directly.
export {}
