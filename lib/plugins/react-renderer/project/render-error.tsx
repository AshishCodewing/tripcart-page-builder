// Fallback rendered when RenderProject can't satisfy the request (no pages,
// missing pageId, missing componentId, …). Consumers can override via
// `config.errorComponent`; the default is a minimal text node so the failure
// is at least visible.

import type { RenderErrorProps } from "../types"

export const RenderError = (
  props: RenderErrorProps & { config?: import("../types").RendererReactOptions }
) => {
  const { config, errorType } = props
  const Custom = config?.errorComponent
  if (Custom) return <Custom {...props} />
  return <div>Error: {errorType}</div>
}
