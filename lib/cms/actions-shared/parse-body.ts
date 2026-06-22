import { parseProjectPayload } from "../project-payload"

// Extract the optional editor `data` field from a save form. Returns undefined
// when absent/empty (the action preserves the existing tree). The optional
// `validate` hook runs after parsing for content-type-specific guards (e.g.
// pages reject a nested <main>).
export function parseOptionalProjectData(
  form: FormData,
  validate?: (data: object) => void
): object | undefined {
  const dataField = form.get("data")
  if (typeof dataField !== "string" || !dataField.length) return undefined
  const data = parseProjectPayload(dataField)
  validate?.(data)
  return data
}
