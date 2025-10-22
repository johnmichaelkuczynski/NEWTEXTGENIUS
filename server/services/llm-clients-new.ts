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
    
    let prompt = '';

    if (phase === 1) {
      // ULTRA-AGGRESSIVE SCORING ENFORCEMENT - FIRST AND CRYSTAL CLEAR
      prompt += `🚨 SCORING SEMANTICS - THIS IS NOT NEGOTIABLE 🚨

WHAT A SCORE MEANS (READ THIS 3 TIMES):
• Score of 96/100 = Only 4% of humans are smarter = GENUINELY EXCEPTIONAL INTELLIGENCE
• Score of 85/100 = 15% are smarter = WELL ABOVE AVERAGE  
• Score of 73/100 = 27% are smarter = SLIGHTLY ABOVE AVERAGE
• Score of 50/100 = 50% are smarter = EXACTLY AVERAGE
• Score of 25/100 = 75% are smarter = WELL BELOW AVERAGE (BORDERLINE RETARDED)

⛔ FORBIDDEN BEHAVIOR ⛔
NEVER give "safe" scores in the 70-85 range to avoid commitment. That is HEDGING and is WRONG.
If you're unsure, go LOWER (≤65) or HIGHER (≥90). No middle ground.

📊 CORRECT SCORING FOR CLEAR CASES:
✓ Genuine philosophical insight (original ideas, coherent logic) → 90-100
✓ Mediocre but coherent everyday writing → 45-55  
✓ Phony academic jargon (no actual insight, buzzwords) → 0-40

🔍 CALIBRATION TEST - THIS TEXT MUST SCORE ≤40:
"${PHONY_PARADIGM}"
(It sounds smart but has zero actual insight - just references to doctrines without developing ideas)

===== NOW ANALYZE THIS TEXT =====

${text}

===== ANSWER ALL ${questions.length} QUESTIONS BELOW =====

`;
      questions.forEach((question, index) => {
        prompt += `${index + 1}. ${question}\n\n`;
      });

      // Add assessment-specific instructions
      if (assessmentType === 'cognitive') {
        prompt += getScoringInstructions();
        prompt += getCognitiveMetapoints();
      } else if (assessmentType === 'psychological') {
        prompt += getPsychologicalInstructions();
      } else if (assessmentType === 'psychopathological') {
        prompt += getPsychopathologicalInstructions();
      }

      prompt += `\n\n===== REQUIRED RESPONSE FORMAT =====

For EACH of the ${questions.length} questions above:

Question [N]: [question text]
Score: [0-100]
Reasoning: [WHY this score - be specific]

After answering ALL ${questions.length} questions:

OVERALL SCORE: [0-100]
SUMMARY: [comprehensive assessment]

⚠️ FINAL REMINDERS:
• Midrange scores (70-85) only if genuinely justified - otherwise go lower or higher
• ${questions.length} questions MUST ALL be answered individually
• Score reflects percentile: 96 = top 4%, 50 = exactly average, 25 = bottom 25%`;
      
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

  /**
   * Simple chat interface - unrestricted direct access
   */
  async chat(
    message: string,
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<string> {
    if (!this.anthropic) throw new Error('Anthropic API key not configured');

    // Build messages array from conversation history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: message }
    ];

    const response = await this.anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: messages,
    });

    const textContent = response.content.find(block => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : 'No response generated';
  }
}
