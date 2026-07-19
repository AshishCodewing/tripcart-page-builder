// Postgres unique-violation detection — the Drizzle/node-postgres replacement
// for Prisma's `PrismaClientKnownRequestError` code `P2002`. node-postgres
// surfaces the raw SQLSTATE on `error.code`; `23505` is unique_violation.
//
// Drizzle wraps driver errors in a `DrizzleQueryError` whose `.cause` is the
// original pg error (especially for failures raised inside a transaction), so
// walk the cause chain rather than only checking the top-level error.
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; current != null && depth < 5; depth++) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === "23505"
    ) {
      return true
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null
  }
  return false
}
