// NEW PROTOCOL-BASED PROCESSING FUNCTION
// Uses EXACT protocols with NO simplifying
async function processDocumentWithProtocol(
  text: string,
  assessmentType: 'cognitive' | 'psychological' | 'psychopathological',
  assessmentMode: 'normal' | 'comprehensive',
  provider: string,
  llmClient: any, // Will be new LLM client
  selectedChunks?: number[],
  analysisId?: string
) {
  const { LLMClients: NewLLMClients } = await import('./services/llm-clients-new');
  const newClient = new NewLLMClients();
  
  const allChunks = TextProcessor.chunkText(text);
  const chunksToProcess = selectedChunks && selectedChunks.length > 0 
    ? allChunks.filter(chunk => selectedChunks.includes(chunk.index))
    : [allChunks[0]]; // Use first chunk for normal mode
  
  const textToAnalyze = chunksToProcess.map(c => c.text).join('\n\n');
  
  console.log(`📋 Protocol Analysis: ${assessmentType} | Mode: ${assessmentMode}`);
  
  if (analysisId) {
    sendProgressUpdate(analysisId, {
      status: 'protocol_analysis',
      message: `Running ${assessmentType} protocol (${assessmentMode} mode)...`,
      currentStep: 'phase_1'
    });
  }
  
  let streamingTranscript = '';
  
  // PHASE 1: Run complete protocol with ALL questions
  const phase1Result = await newClient.analyzeTextStream(
    provider,
    textToAnalyze,
    assessmentType,
    assessmentMode,
    (chunk: string) => {
      streamingTranscript += chunk;
      if (analysisId) {
        sendProgressUpdate(analysisId, {
          type: 'progress',
          status: 'streaming',
          message: `${assessmentType} analysis in progress...`,
          currentStep: 'streaming_response',
          streamChunk: chunk,
          phase: 1
        });
      }
    },
    1 // Phase 1
  );
  
  console.log(`✅ Phase 1 complete. Score: ${phase1Result.score}`);
  
  let finalScore = phase1Result.score;
  let finalExplanation = phase1Result.explanation;
  
  // COMPREHENSIVE MODE: Run Phases 2-4 if score < 95
  if (assessmentMode === 'comprehensive' && phase1Result.score < 95) {
    console.log(`🔄 Score ${phase1Result.score} < 95, running Phase 2 (Pushback)...`);
    
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'phase_2',
        message: 'Running pushback protocol...',
        currentStep: 'phase_2'
      });
    }
    
    const phase2Result = await newClient.analyzeTextStream(
      provider,
      textToAnalyze,
      assessmentType,
      assessmentMode,
      (chunk: string) => {
        streamingTranscript += '\n\n--- PHASE 2: PUSHBACK ---\n\n' + chunk;
        if (analysisId) {
          sendProgressUpdate(analysisId, {
            type: 'progress',
            status: 'streaming',
            streamChunk: chunk,
            phase: 2
          });
        }
      },
      2, // Phase 2
      phase1Result.score
    );
    
    console.log(`✅ Phase 2 complete. Score: ${phase2Result.score}`);
    
    // PHASE 3: Walmart Metric
    console.log(`🏪 Running Phase 3 (Walmart Metric)...`);
    
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'phase_3',
        message: 'Applying Walmart metric enforcement...',
        currentStep: 'phase_3'
      });
    }
    
    const phase3Result = await newClient.analyzeTextStream(
      provider,
      textToAnalyze,
      assessmentType,
      assessmentMode,
      (chunk: string) => {
        streamingTranscript += '\n\n--- PHASE 3: WALMART METRIC ---\n\n' + chunk;
        if (analysisId) {
          sendProgressUpdate(analysisId, {
            type: 'progress',
            status: 'streaming',
            streamChunk: chunk,
            phase: 3
          });
        }
      },
      3, // Phase 3
      phase2Result.score
    );
    
    console.log(`✅ Phase 3 complete. Score: ${phase3Result.score}`);
    
    // PHASE 4: Final Validation
    console.log(`✔️ Running Phase 4 (Final Validation)...`);
    
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'phase_4',
        message: 'Final validation...',
        currentStep: 'phase_4'
      });
    }
    
    const phase4Result = await newClient.analyzeTextStream(
      provider,
      textToAnalyze,
      assessmentType,
      assessmentMode,
      (chunk: string) => {
        streamingTranscript += '\n\n--- PHASE 4: FINAL VALIDATION ---\n\n' + chunk;
        if (analysisId) {
          sendProgressUpdate(analysisId, {
            type: 'progress',
            status: 'streaming',
            streamChunk: chunk,
            phase: 4
          });
        }
      },
      4 // Phase 4
    );
    
    console.log(`✅ Phase 4 complete. Final Score: ${phase4Result.score}`);
    
    finalScore = phase4Result.score;
    finalExplanation = streamingTranscript; // Full transcript with all phases
  }
  
  // Return in expected format
  return [{
    question: `${assessmentType.toUpperCase()} PROTOCOL (${assessmentMode} mode)`,
    score: finalScore,
    explanation: finalExplanation,
    quotes: [],
    streamingTranscript: streamingTranscript
  }];
}
