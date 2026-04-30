import "dotenv/config"

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

import { formatChunkCitation, retrieveDocs } from "@/lib/rag/retrieve"

const TOOL_NAME = "search_grapesjs_docs"

const server = new Server(
  { name: "grapesjs-docs", version: "0.1.0" },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: TOOL_NAME,
      description:
        "Search the GrapesJS documentation via local RAG. Returns the top-k chunks with source URLs and similarity. Call this whenever answering questions about GrapesJS APIs, plugins, blocks, components, commands, or runtime behavior — prefer it over guessing or web search.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language question or keywords.",
          },
          k: {
            type: "number",
            description: "Number of chunks to return (default 5, max 20).",
            minimum: 1,
            maximum: 20,
          },
        },
        required: ["query"],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== TOOL_NAME) {
    throw new Error(`Unknown tool: ${req.params.name}`)
  }

  const args = (req.params.arguments ?? {}) as { query?: unknown; k?: unknown }
  const query = typeof args.query === "string" ? args.query : ""
  const k = typeof args.k === "number" ? Math.min(Math.max(args.k, 1), 20) : 5

  if (!query.trim()) {
    return {
      isError: true,
      content: [{ type: "text", text: "`query` must be a non-empty string." }],
    }
  }

  const chunks = await retrieveDocs(query, k)
  if (chunks.length === 0) {
    return { content: [{ type: "text", text: "No matches." }] }
  }

  const text = chunks
    .map(
      (c, i) =>
        `## Result ${i + 1} — ${formatChunkCitation(c)} (sim=${c.similarity.toFixed(3)})\n\n${c.content}`
    )
    .join("\n\n---\n\n")

  return { content: [{ type: "text", text }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
// stdout is reserved for MCP protocol frames — log to stderr only.
console.error("[mcp-rag] grapesjs-docs server connected on stdio")
