import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  AssessmentType,
  AssessmentMode,
  getProtocolQuestions,
  getCognitiveMetapoints,
  getScoringInstructions,
  getPsychologicalInstructions,
  getPsychopathologicalInstructions,
  getPhase2Pushback,
  getPhase3WalmartMetric,
  getPhase4Validation,
  PHONY_PARADIGM
} from './protocols';

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export interface LLMResponse {
  score: number;
  explanation: string;
  quotes: string[];
}

export class LLMClients {
  private anthropic?: Anthropic;
  private openai?: OpenAI;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  /**
   * Map ZHI providers to actual API providers
   */
  private mapProvider(zhiProvider: string): string {
    const mapping: Record<string, string> = {
      'zhi1': 'openai',
      'zhi2': 'anthropic',
      'zhi3': 'deepseek',
      'zhi4': 'perplexity'
    };
    return mapping[zhiProvider] || zhiProvider;
  }

  /**
   * Analyze text using the EXACT protocol with NO modifications
   */
  async analyzeTextStream(
    zhiProvider: string,
    text: string,
    assessmentType: AssessmentType,
    assessmentMode: AssessmentMode,
    onStream: (chunk: string) => void,
    phase: number = 1,
    previousScore?: number
  ): Promise<LLMResponse> {
    const provider = this.mapProvider(zhiProvider);
    const prompt = this.buildProtocolPrompt(text, assessmentType, assessmentMode, phase, previousScore);
    
    let result: LLMResponse;

    switch (provider) {
      case 'anthropic':
        result = await this.callAnthropicStream(prompt, onStream);
        break;
      case 'openai':
        result = await this.callOpenAIStream(prompt, onStream);
        break;
      case 'perplexity':
        result = await this.callPerplexityStream(prompt, onStream);
        break;
      case 'deepseek':
        result = await this.callDeepSeekStream(prompt, onStream);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // NO HARDCODED LOGIC - Trust LLM output completely
    return result;
  }

  /**
   * Build prompt using EXACT protocol questions - NO SIMPLIFYING
   */
  private buildProtocolPrompt(
    text: string,
    assessmentType: AssessmentType,
    assessmentMode: AssessmentMode,
    phase: number = 1,
    previousScore?: number
  ): string {
    const questions = getProtocolQuestions(assessmentType);
    
    let prompt = `TEXT TO ANALYZE:\n${text}\n\n`;

    if (phase === 1) {
      // Phase 1: ALL questions verbatim
      prompt += `QUESTIONS TO ANSWER:\n\n`;
      questions.forEach((question, index) => {
        prompt += `${index + 1}. ${question}\n\n`;
      });

      // Add assessment-specific instructions
      if (assessmentType === 'cognitive') {
        prompt += getScoringInstructions();
        prompt += getCognitiveMetapoints();
        prompt += `\n\nPHONY PARADIGM (must score ≤65):\n${PHONY_PARADIGM}\n\n`;
      } else if (assessmentType === 'psychological') {
        prompt += getPsychologicalInstructions();
      } else if (assessmentType === 'psychopathological') {
        prompt += getPsychopathologicalInstructions();
      }

      prompt += `\nANSWER FORMAT:\nFor each question, provide:\n- Score: [0-100]\n- Explanation: [Your answer]\n\nThen provide OVERALL SCORE and SUMMARY.`;
      
    } else if (phase === 2 && previousScore !== undefined) {
      // Phase 2: Pushback if score < 95
      prompt += getPhase2Pushback(previousScore, assessmentType);
      
    } else if (phase === 3 && previousScore !== undefined) {
      // Phase 3: Walmart Metric Enforcement
      prompt += getPhase3WalmartMetric(previousScore, assessmentType);
      
    } else if (phase === 4) {
      // Phase 4: Final Validation
      prompt += getPhase4Validation(assessmentType);
    }

    return prompt;
  }

  private async callAnthropicStream(prompt: string, onStream: (chunk: string) => void): Promise<LLMResponse> {
    if (!this.anthropic) throw new Error('Anthropic API key not configured');

    const stream = await this.anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000, // Increased for ALL questions
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullText += chunk;
        onStream(chunk);
      }
    }

    // Parse score from response - NO HARDCODED MANIPULATION
    const score = this.extractScore(fullText);
    return { score, explanation: fullText, quotes: [] };
  }

  private async callOpenAIStream(prompt: string, onStream: (chunk: string) => void): Promise<LLMResponse> {
    if (!this.openai) throw new Error('OpenAI API key not configured');

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 8000,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullText += content;
      onStream(content);
    }

    const score = this.extractScore(fullText);
    return { score, explanation: fullText, quotes: [] };
  }

  private async callPerplexityStream(prompt: string, onStream: (chunk: string) => void): Promise<LLMResponse> {
    const perplexityOpenAI = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai'
    });

    const stream = await perplexityOpenAI.chat.completions.create({
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 8000,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullText += content;
      onStream(content);
    }

    const score = this.extractScore(fullText);
    return { score, explanation: fullText, quotes: [] };
  }

  private async callDeepSeekStream(prompt: string, onStream: (chunk: string) => void): Promise<LLMResponse> {
    const deepseekOpenAI = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com'
    });

    const stream = await deepseekOpenAI.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      max_tokens: 8000,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullText += content;
      onStream(content);
    }

    const score = this.extractScore(fullText);
    return { score, explanation: fullText, quotes: [] };
  }

  /**
   * Extract score from LLM response - NO MANIPULATION
   * Trust what the LLM says
   */
  private extractScore(text: string): number {
    // Try to find "OVERALL SCORE: XX" or "Overall Score: XX"
    const overallMatch = text.match(/OVERALL\s+SCORE[:\s]+(\d+)/i);
    if (overallMatch) {
      return parseInt(overallMatch[1], 10);
    }

    // Try to find "Score: XX/100" or "Score: XX"
    const scoreMatches = text.match(/Score[:\s]+(\d+)/gi);
    if (scoreMatches && scoreMatches.length > 0) {
      // Get the last score mentioned (usually the overall)
      const lastScore = scoreMatches[scoreMatches.length - 1];
      const match = lastScore.match(/(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    // If no score found, return 70 as conservative fallback
    console.warn('Could not extract score from LLM response, using fallback');
    return 70;
  }
}
