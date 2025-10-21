import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentMode: text("document_mode").notNull(), // 'single' | 'dual'
  llmProvider: text("llm_provider").notNull(), // 'zhi1' | 'zhi2' | 'zhi3' | 'zhi4' (OpenAI, Anthropic, DeepSeek, Perplexity)
  assessmentType: text("assessment_type").notNull(), // 'cognitive' | 'psychological' | 'psychopathological'
  assessmentMode: text("assessment_mode").notNull(), // 'normal' | 'comprehensive'
  document1Text: text("document1_text").notNull(),
  document2Text: text("document2_text"),
  status: text("status").default("pending"), // pending, processing, complete, error
  results: jsonb("results").notNull(),
  overallScore: integer("overall_score"),
  processingTime: integer("processing_time"), // in seconds
  phaseResults: jsonb("phase_results"), // For comprehensive mode: stores results from all 4 phases
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).pick({
  documentMode: true,
  llmProvider: true,
  assessmentType: true,
  assessmentMode: true,
  document1Text: true,
  document2Text: true,
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

// API Request/Response Types
export const analysisRequestSchema = z.object({
  documentMode: z.enum(['single', 'dual']),
  llmProvider: z.enum(['zhi1', 'zhi2', 'zhi3', 'zhi4']),
  assessmentType: z.enum(['cognitive', 'psychological', 'psychopathological']),
  assessmentMode: z.enum(['normal', 'comprehensive']),
  document1Text: z.string().min(1),
  document2Text: z.string().optional(),
  selectedChunks1: z.array(z.number()).optional(), // Array of chunk indices to analyze for document 1
  selectedChunks2: z.array(z.number()).optional(), // Array of chunk indices to analyze for document 2
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

export const chunkResultSchema = z.object({
  chunkIndex: z.number(),
  score: z.number().min(0).max(100),
  explanation: z.string(),
  quotes: z.array(z.string()),
  question: z.string(),
});

export type ChunkResult = z.infer<typeof chunkResultSchema>;

export const analysisResultSchema = z.object({
  id: z.string(),
  overallScore: z.number(),
  processingTime: z.number(),
  results: z.array(z.object({
    question: z.string(),
    score: z.number(),
    explanation: z.string(),
    quotes: z.array(z.string()),
  })),
  document2Results: z.array(z.object({
    question: z.string(),
    score: z.number(),
    explanation: z.string(),
    quotes: z.array(z.string()),
  })).optional(),
  comparisonResults: z.object({
    explanation: z.string(),
    scores: z.object({
      document1: z.number(),
      document2: z.number(),
    }),
  }).optional(),
  streamingTranscript: z.string().optional(), // Live analysis transcript that persists after completion
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

