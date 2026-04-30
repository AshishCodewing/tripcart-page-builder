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

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  return docEmbedder().embedDocuments(texts)
}

export async function embedQuery(query: string): Promise<number[]> {
  return queryEmbedder().embedQuery(query)
}
