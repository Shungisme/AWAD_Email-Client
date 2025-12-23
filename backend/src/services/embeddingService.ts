import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Embedding Service for Semantic Search
 * Generates vector embeddings using Google Gemini's text-embedding-004 model
 */
class EmbeddingService {
  private model = "text-embedding-004"; // 768 dimensions, free tier available

  /**
   * Generate embedding for email content (subject + body)
   * @param subject Email subject
   * @param body Email body (can be truncated for performance)
   * @returns Vector embedding (768 dimensions)
   */
  async generateEmailEmbedding(
    subject: string,
    body: string
  ): Promise<number[]> {
    try {
      // Combine subject and body with weight on subject
      // Truncate body to 8000 characters to stay within token limits
      const text = `Subject: ${subject}\n\n${body.substring(0, 8000)}`;

      const model = genAI.getGenerativeModel({ model: this.model });
      const result = await model.embedContent(text);

      return result.embedding.values;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate email embedding");
    }
  }

  /**
   * Generate embedding for a search query
   * @param query User's search query
   * @returns Vector embedding (768 dimensions)
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: this.model });
      const result = await model.embedContent(query);

      return result.embedding.values;
    } catch (error) {
      console.error("Error generating query embedding:", error);
      throw new Error("Failed to generate query embedding");
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vecA First vector
   * @param vecB Second vector
   * @returns Similarity score between -1 and 1 (higher is more similar)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default new EmbeddingService();
