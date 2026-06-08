import { TaskType } from "@google/generative-ai"
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"

export const EMBEDDING_MODEL = "gemini-embedding-001"
export const EMBEDDING_DIMS = 3072

let docClient: GoogleGenerativeAIEmbeddings | null = null
let queryClient: GoogleGenerativeAIEmbeddings | null = null

function ensureKey(): string {
  const key = process.env.GOOGLE_API_KEY
  if (!key) {
    throw new Error(
      "GOOGLE_API_KEY is required for Google AI Studio embeddings. Set it in .env."
    )
  }
  return key
}

function makeClient(taskType: TaskType): GoogleGenerativeAIEmbeddings {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: ensureKey(),
    model: EMBEDDING_MODEL,
    taskType,
  })
}

function docEmbedder(): GoogleGenerativeAIEmbeddings {
  if (!docClient) docClient = makeClient(TaskType.RETRIEVAL_DOCUMENT)
  return docClient
}

function queryEmbedder(): GoogleGenerativeAIEmbeddings {
  if (!queryClient) queryClient = makeClient(TaskType.RETRIEVAL_QUERY)
  return queryClient
}

// Gemini's free tier returns empty vectors when rate-limited (no error thrown).
// Chunk into small batches with a delay between calls. One retry per batch on
// empty-vector responses catches the occasional transient miss.
const EMBED_BATCH_SIZE = 20
const EMBED_INTER_BATCH_DELAY_MS = 1500

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms))

async function embedSlice(slice: string[]): Promise<number[][]> {
  let vecs = await docEmbedder().embedDocuments(slice)
  const emptyIdx = vecs
    .map((v, i) => (v.length === 0 ? i : -1))
    .filter((i) => i >= 0)
  if (emptyIdx.length > 0) {
    await sleep(EMBED_INTER_BATCH_DELAY_MS * 2)
    const retryTexts = emptyIdx.map((i) => slice[i])
    const retryVecs = await docEmbedder().embedDocuments(retryTexts)
    vecs = vecs.map((v, i) => {
      const r = emptyIdx.indexOf(i)
      return r >= 0 ? retryVecs[r] : v
    })
  }
  return vecs
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const slice = texts.slice(i, i + EMBED_BATCH_SIZE)
    const vecs = await embedSlice(slice)
    out.push(...vecs)
    if (i + EMBED_BATCH_SIZE < texts.length) {
      await sleep(EMBED_INTER_BATCH_DELAY_MS)
    }
  }
  return out
}

export async function embedQuery(query: string): Promise<number[]> {
  return queryEmbedder().embedQuery(query)
}
