import { type Analysis, type InsertAnalysis } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysis(id: string): Promise<Analysis | undefined>;
  updateAnalysisResults(id: string, results: any, overallScore: number, processingTime: number): Promise<Analysis>;
}

export class MemStorage implements IStorage {
  private analyses: Map<string, Analysis>;

  constructor() {
    this.analyses = new Map();
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const id = randomUUID();
    const analysis: Analysis = {
      id,
      documentMode: insertAnalysis.documentMode,
      llmProvider: insertAnalysis.llmProvider,
      evaluationParam: insertAnalysis.evaluationParam,
      analysisMode: insertAnalysis.analysisMode,
      document1Text: insertAnalysis.document1Text,
      document2Text: insertAnalysis.document2Text || null,
      results: {},
      overallScore: null,
      processingTime: null,
      createdAt: new Date(),
    };
    this.analyses.set(id, analysis);
    return analysis;
  }

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return this.analyses.get(id);
  }

  async updateAnalysisResults(
    id: string,
    results: any,
    overallScore: number,
    processingTime: number
  ): Promise<Analysis> {
    const analysis = this.analyses.get(id);
    if (!analysis) {
      throw new Error("Analysis not found");
    }

    const updatedAnalysis: Analysis = {
      ...analysis,
      results,
      overallScore,
      processingTime,
    };

    this.analyses.set(id, updatedAnalysis);
    return updatedAnalysis;
  }
}

export const storage = new MemStorage();
