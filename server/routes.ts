import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analysisRequestSchema, type AnalysisRequest } from "@shared/schema";
import { LLMClients } from "./services/llm-clients-new";
import { TextProcessor } from "./services/text-processor";
import { FileParser } from "./services/file-parser";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for large documents
    fieldSize: 50 * 1024 * 1024
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // File upload endpoint
  app.post("/api/upload", upload.single('file'), async (req: Request & { file?: Express.Multer.File }, res) => {
    try {
      console.log('Upload request received:', {
        hasFile: !!req.file,
        filename: req.file?.originalname,
        mimetype: req.file?.mimetype,
        size: req.file?.size
      });

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const extension = req.file.originalname.toLowerCase().split('.').pop();
      console.log('File extension:', extension);

      if (!FileParser.validateFileType(req.file.originalname)) {
        return res.status(400).json({ 
          message: `Unsupported file type: .${extension}. Please use TXT, DOC, DOCX, or PDF files.` 
        });
      }

      // Add MIME type validation for better security
      if (!FileParser.validateMimeType(req.file.originalname, req.file.mimetype)) {
        return res.status(400).json({ 
          message: "Invalid file format. Please ensure the file is a valid TXT, DOC, DOCX, or PDF file." 
        });
      }

      const text = await FileParser.parseFile(req.file.buffer, req.file.originalname);
      
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ 
          message: "File appears to be empty or could not be read." 
        });
      }

      const wordCount = TextProcessor.countWords(text);
      const chunkCount = TextProcessor.calculateChunkCount(text);

      console.log('File processed successfully:', {
        filename: req.file.originalname,
        wordCount,
        chunkCount,
        textLength: text.length
      });

      res.json({
        text,
        wordCount,
        chunkCount,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error('File upload error:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        filename: req.file?.originalname
      });
      
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process file" 
      });
    }
  });

  // Start analysis endpoint
  app.post("/api/analysis", async (req, res) => {
    try {
      const validatedRequest = analysisRequestSchema.parse(req.body);

      // Create analysis record
      const analysis = await storage.createAnalysis(validatedRequest);

      // Start background processing with a small delay to allow SSE connection
      setTimeout(() => {
        processAnalysisAsync(analysis.id, validatedRequest);
      }, 1000);

      res.json({ 
        analysisId: analysis.id,
        message: "Analysis started successfully" 
      });
    } catch (error) {
      console.error('Analysis start error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid request" 
      });
    }
  });

  // Get analysis status/results
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      res.json(analysis);
    } catch (error) {
      console.error('Get analysis error:', error);
      res.status(500).json({ 
        message: "Failed to retrieve analysis" 
      });
    }
  });

  // Streaming analysis endpoint for real-time updates
  app.get("/api/analysis/:id/stream", (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable buffering for nginx/proxies
    });

    const analysisId = req.params.id;
    let isConnected = true;
    
    // Send initial connection event
    const sendEvent = (data: any) => {
      if (!isConnected) return false;
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch (error) {
        console.error('Failed to write to stream:', error);
        isConnected = false;
        return false;
      }
    };

    sendEvent({ type: 'connected', analysisId });
    
    // Register this stream for progress updates
    activeStreams.set(analysisId, sendEvent);

    // Send heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (!sendEvent({ type: 'heartbeat' })) {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send heartbeat every 30 seconds

    // Set up polling to check for updates
    const pollInterval = setInterval(async () => {
      try {
        const analysis = await storage.getAnalysis(analysisId);
        if (analysis && isConnected) {
          if (!sendEvent({ type: 'update', analysis: analysis })) {
            clearInterval(pollInterval);
            clearInterval(heartbeatInterval);
            return;
          }
          
          // If analysis is complete, close the stream
          if (analysis.overallScore !== null && analysis.overallScore !== undefined) {
            clearInterval(pollInterval);
            clearInterval(heartbeatInterval);
            sendEvent({ type: 'complete' });
            res.end();
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        if (isConnected) {
          sendEvent({ type: 'error', error: 'Failed to get analysis updates' });
          res.end();
        }
      }
    }, 2000); // Poll every 2 seconds to reduce server load

    // Clean up on client disconnect
    const cleanup = () => {
      isConnected = false;
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      activeStreams.delete(analysisId); // Remove from active streams
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('close', cleanup);
  });

  // Download report endpoint
  app.get("/api/analysis/:id/report", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      if (!analysis.results || !analysis.overallScore) {
        return res.status(400).json({ message: "Analysis not yet complete" });
      }

      const report = generateTextReport(analysis);
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${analysis.id}.txt"`);
      res.send(report);
    } catch (error) {
      console.error('Download report error:', error);
      res.status(500).json({ 
        message: "Failed to generate report" 
      });
    }
  });

  // AI Chat endpoint - FULLY FUNCTIONAL
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context, conversationHistory } = req.body;
      
      if (!message?.trim()) {
        return res.status(400).json({ message: "Message required" });
      }

      // Build context-aware system prompt
      let systemPrompt = "You are a brilliant AI assistant with FULL CONTEXT of the user's document and its analysis. ";
      
      if (context?.documentText) {
        systemPrompt += `\n\n📄 USER'S DOCUMENT (Full Context):\n${context.documentText.substring(0, 10000)}\n\n`;
      }
      
      if (context?.analysisResults) {
        const score = context.analysisResults.overallScore || 0;
        systemPrompt += `\n\n📊 ANALYSIS RESULTS:\n`;
        systemPrompt += `Overall Score: ${score}/100\n`;
        systemPrompt += `This means ${100 - score}% of people outperform this text on the measured parameters.\n\n`;
        
        if (context.analysisResults.results && context.analysisResults.results.length > 0) {
          systemPrompt += `Detailed Findings:\n`;
          context.analysisResults.results.slice(0, 3).forEach((r: any) => {
            systemPrompt += `- ${r.question}: Score ${r.score}/100\n`;
          });
        }
      }
      
      systemPrompt += `\n\n💡 YOUR CAPABILITIES:
- Rewrite the text to be smarter, more original, more cogent, more insightful
- Explain what's wrong with the current text and how to fix it
- Generate entirely new versions based on the user's goals
- Answer any question about the text or analysis
- No restrictions, no canned responses - full creative freedom

Be DIRECT and HELPFUL. If they say "make it smarter", do it immediately. If they say "rewrite to score 95+", rewrite it.`;

      const llmClient = new LLMClients();
      const response = await llmClient.chat(
        message,
        systemPrompt,
        conversationHistory || []
      );

      res.json({ response });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Chat failed"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Global map to track active streams for real-time progress updates
const activeStreams = new Map<string, (data: any) => boolean>();

function sendProgressUpdate(analysisId: string, progressData: any) {
  const sendEvent = activeStreams.get(analysisId);
  if (sendEvent) {
    sendEvent({
      type: 'progress',
      analysisId,
      ...progressData
    });
  }
}

async function processAnalysisAsync(
  analysisId: string, 
  request: AnalysisRequest
) {
  const startTime = Date.now();
  
  try {
    // Use NEW schema fields
    console.log(`🔍 RAW REQUEST assessmentMode: "${request.assessmentMode}" (type: ${typeof request.assessmentMode})`);
    console.log(`🔍 FULL REQUEST:`, JSON.stringify(request, null, 2));
    
    const assessmentMode = request.assessmentMode || 'normal';
    const assessmentType = request.assessmentType;
    console.log(`🔍 Assessment: ${assessmentType} | Mode: ${assessmentMode}`);

    sendProgressUpdate(analysisId, {
      status: 'starting',
      message: 'Initializing cognitive protocol analysis...',
      currentStep: 'preparation'
    });

    // Process document 1 using NEW protocol system
    sendProgressUpdate(analysisId, {
      status: 'processing_document_1',
      message: `Starting ${assessmentType} analysis...`,
      currentStep: 'document_1'
    });

    const doc1Results = await processDocumentWithProtocol(
      request.document1Text, 
      assessmentType,
      assessmentMode,
      request.llmProvider,
      request.selectedChunks1,
      analysisId
    );

    let doc2Results = undefined;
    let comparisonResults = undefined;

    // Process document 2 if dual mode
    if (request.documentMode === 'dual' && request.document2Text) {
      sendProgressUpdate(analysisId, {
        status: 'processing_document_2',
        message: `Analyzing secondary document...`,
        currentStep: 'document_2'
      });

      doc2Results = await processDocumentWithProtocol(
        request.document2Text, 
        assessmentType,
        assessmentMode,
        request.llmProvider,
        request.selectedChunks2,
        analysisId
      );

      sendProgressUpdate(analysisId, {
        status: 'generating_comparison',
        message: 'Generating document comparison analysis...',
        currentStep: 'comparison'
      });

      // Generate comparison
      comparisonResults = await generateComparison(
        request.document1Text,
        request.document2Text,
        doc1Results,
        doc2Results,
        request.assessmentType,
        request.llmProvider
      );
    }

    sendProgressUpdate(analysisId, {
      status: 'finalizing',
      message: 'Calculating final scores and generating report...',
      currentStep: 'finalization'
    });

    // Calculate overall score
    const overallScore = calculateOverallScore(doc1Results, doc2Results);
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    // Update analysis with results
    await storage.updateAnalysisResults(analysisId, {
      results: doc1Results,
      document2Results: doc2Results,
      comparisonResults
    }, overallScore, processingTime);

    sendProgressUpdate(analysisId, {
      status: 'completed',
      message: 'Analysis completed successfully!',
      currentStep: 'completed',
      overallScore,
      processingTime
    });

  } catch (error) {
    console.error('Analysis processing error:', error);
    // Update analysis with error status
    await storage.updateAnalysisResults(analysisId, {
      error: error instanceof Error ? error.message : "Analysis failed"
    }, 0, Math.round((Date.now() - startTime) / 1000));
  }
}

// NEW PROTOCOL-BASED PROCESSING FUNCTION
// Uses EXACT protocols with NO simplifying
async function processDocumentWithProtocol(
  text: string,
  assessmentType: 'cognitive' | 'psychological' | 'psychopathological',
  assessmentMode: 'normal' | 'comprehensive',
  provider: string,
  selectedChunks?: number[],
  analysisId?: string
) {
  // Use the NEW protocol-compliant LLM client
  const newClient = new LLMClients();
  
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

async function processDocument(
  text: string,
  questions: string[],
  provider: string,
  llmClient: LLMClients,
  selectedChunks?: number[],
  analysisId?: string,
  analysisMode: string = 'comprehensive'
) {
  const allChunks = TextProcessor.chunkText(text);
  
  // ⚡ BULLETPROOF QUICK MODE: Fast sequential processing with no hangs
  if (analysisMode === 'quick') {
    console.log('⚡ BULLETPROOF QUICK MODE: Ultra-fast sequential processing');
    
    // Use first chunk only
    const targetChunk = allChunks[0];
    const results = [];
    
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'quick_analysis',
        message: 'Running ultra-fast analysis...',
        currentStep: 'fast_processing',
        totalQuestions: questions.length
      });
    }

    // Process questions one by one for reliability - much faster than parallel hangs
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`⚡ QUICK Q${i+1}/${questions.length}: ${question}`);
      
      // Send progress update BEFORE starting the question
      if (analysisId) {
        sendProgressUpdate(analysisId, {
          status: 'processing_question', 
          message: `Question ${i + 1}/${questions.length}: ${question}`,
          currentStep: 'question_analysis',
          currentQuestion: question,
          questionIndex: i + 1,
          totalQuestions: questions.length,
          chunkIndex: 1,
          totalChunks: 1
        });
      }

      try {
        const result = await llmClient.analyzeTextStream(provider, targetChunk.text, question, (streamChunk: string) => {
          if (analysisId) {
            sendProgressUpdate(analysisId, {
              type: 'progress',
              status: 'streaming',
              message: `Question ${i + 1}/${questions.length}: ${question}`,
              currentStep: 'streaming_response',
              currentQuestion: question,
              questionIndex: i + 1,
              totalQuestions: questions.length,
              chunkIndex: 1,
              totalChunks: 1,
              streamChunk: streamChunk,
              questionId: `q${i}`
            });
          }
        });

        results.push({
          question,
          score: result.score,
          explanation: result.explanation,
          chunkResults: [{
            chunkIndex: targetChunk.index,
            text: targetChunk.text.substring(0, 200) + '...',
            score: result.score,
            explanation: result.explanation
          }]
        });
        
        console.log(`⚡ QUICK Q${i+1} COMPLETE: Score ${result.score}`);
        
        // Send completion update for this question
        if (analysisId) {
          sendProgressUpdate(analysisId, {
            status: 'question_completed',
            message: `Completed: ${question}`,
            currentStep: 'question_completed',
            currentQuestion: question,
            questionIndex: i + 1,
            totalQuestions: questions.length,
            score: result.score
          });
        }
        
      } catch (error) {
        console.error(`⚡ QUICK Q${i+1} ERROR:`, error);
        results.push({
          question,
          score: 0,
          explanation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          chunkResults: [{
            chunkIndex: targetChunk.index,
            text: targetChunk.text.substring(0, 200) + '...',
            score: 0,
            explanation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        });
      }
    }

    console.log(`⚡ BULLETPROOF QUICK MODE COMPLETE: ${results.length} questions processed`);
    
    // Send final completion status
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'completed',
        message: 'Quick analysis complete!',
        currentStep: 'complete',
        questionIndex: questions.length,
        totalQuestions: questions.length
      });
    }
    
    return results;
  }

  // COMPREHENSIVE MODE: Original sequential processing
  const chunksToProcess = selectedChunks && selectedChunks.length > 0 
    ? allChunks.filter(chunk => selectedChunks.includes(chunk.index))
    : allChunks;

  console.log(`Processing ${chunksToProcess.length} chunks out of ${allChunks.length} total chunks`);
  if (selectedChunks && selectedChunks.length > 0) {
    console.log(`Selected chunk indices: ${selectedChunks.join(', ')}`);
  }

  const results = [];

  for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
    const question = questions[questionIndex];
    const chunkResults = [];

    // Send progress update for current question
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'processing_question',
        message: `Analyzing: ${question}`,
        currentStep: 'question_analysis',
        currentQuestion: question,
        questionIndex: questionIndex + 1,
        totalQuestions: questions.length,
        chunksToProcess: chunksToProcess.length
      });
    }

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      
      // Send progress for current chunk within question
      if (analysisId) {
        sendProgressUpdate(analysisId, {
          status: 'processing_chunk',
          message: `Question ${questionIndex + 1}/${questions.length}: Processing chunk ${i + 1}/${chunksToProcess.length}`,
          currentStep: 'chunk_analysis',
          currentQuestion: question,
          questionIndex: questionIndex + 1,
          totalQuestions: questions.length,
          chunkIndex: i + 1,
          totalChunks: chunksToProcess.length
        });
      }
      
      try {
        const result = await llmClient.analyzeTextStream(provider, chunk.text, question, (streamChunk: string) => {
          // Send streaming text to the frontend
          if (analysisId) {
            sendProgressUpdate(analysisId, {
              type: 'progress',
              status: 'streaming',
              message: `Question ${questionIndex + 1}/${questions.length}: Processing chunk ${i + 1}/${chunksToProcess.length}`,
              currentStep: 'streaming_response',
              currentQuestion: question,
              questionIndex: questionIndex + 1,
              totalQuestions: questions.length,
              chunkIndex: i + 1,
              totalChunks: chunksToProcess.length,
              streamChunk: streamChunk
            });
          }
        });
        chunkResults.push({
          chunkIndex: chunk.index, // Use original chunk index
          ...result
        });

        // Wait 3 seconds between chunks to respect rate limits but improve speed
        // Skip delays in quick mode for maximum speed
        if (i < chunksToProcess.length - 1 && analysisMode !== 'quick') {
          await TextProcessor.delay(3);
        }
      } catch (error) {
        console.error(`Error processing chunk ${chunk.index} for question "${question}":`, error);
        chunkResults.push({
          chunkIndex: chunk.index,
          score: 0,
          explanation: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          quotes: []
        });
      }
    }

    // Amalgamate results for this question
    const amalgamatedResult = amalgamateChunkResults(question, chunkResults);
    results.push(amalgamatedResult);

    // Send progress update after completing each question
    if (analysisId) {
      sendProgressUpdate(analysisId, {
        status: 'question_completed',
        message: `Completed: ${question}`,
        currentStep: 'question_completed',
        currentQuestion: question,
        questionIndex: questionIndex + 1,
        totalQuestions: questions.length,
        score: amalgamatedResult.score
      });
    }
  }

  return results;
}

function amalgamateChunkResults(question: string, chunkResults: any[]) {
  // Calculate average score
  const validResults = chunkResults.filter(r => r.score > 0);
  const averageScore = validResults.length > 0 
    ? Math.round(validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length)
    : 0;

  // Combine explanations
  const explanations = chunkResults
    .filter(r => r.explanation && !r.explanation.startsWith('Error:'))
    .map(r => r.explanation);

  const combinedExplanation = explanations.length > 0
    ? explanations.join('\n\n')
    : 'Unable to generate explanation due to processing errors.';

  // Combine quotes
  const allQuotes = chunkResults
    .flatMap(r => r.quotes || [])
    .filter(quote => quote && quote.trim().length > 0);

  return {
    question,
    score: averageScore,
    explanation: combinedExplanation,
    quotes: allQuotes
  };
}

async function generateComparison(
  doc1Text: string,
  doc2Text: string,
  doc1Results: any[],
  doc2Results: any[],
  assessmentType: string,
  provider: string
) {
  const comparisonPrompt = `Compare these two documents based on ${assessmentType}. 

Document 1 Results:
${JSON.stringify(doc1Results, null, 2)}

Document 2 Results:
${JSON.stringify(doc2Results, null, 2)}

Provide a comparative analysis in JSON format:
{
  "explanation": "[detailed comparison explanation]",
  "scores": {
    "document1": [overall score for document 1],
    "document2": [overall score for document 2]
  }
}`;

  // Generate basic comparison based on scores
  const doc1Avg = Math.round(doc1Results.reduce((sum, r) => sum + r.score, 0) / doc1Results.length);
  const doc2Avg = Math.round(doc2Results.reduce((sum, r) => sum + r.score, 0) / doc2Results.length);
  
  let comparisonText = `Document 1 averaged ${doc1Avg}/100 across all evaluated criteria. Document 2 averaged ${doc2Avg}/100. `;
  if (doc1Avg > doc2Avg) {
    comparisonText += `Document 1 performed stronger overall, scoring ${doc1Avg - doc2Avg} points higher on average.`;
  } else if (doc2Avg > doc1Avg) {
    comparisonText += `Document 2 performed stronger overall, scoring ${doc2Avg - doc1Avg} points higher on average.`;
  } else {
    comparisonText += `Both documents performed similarly across the evaluated criteria.`;
  }
  
  return {
    explanation: comparisonText,
    scores: {
      document1: doc1Avg,
      document2: doc2Avg
    }
  };
}

function calculateOverallScore(doc1Results: any[], doc2Results?: any[]): number {
  // For dual mode, don't calculate an overall score - comparison should show separate scores
  if (doc2Results) {
    return 0; // No overall score for dual mode
  }
  
  // For single mode, calculate average of all question scores
  const doc1Score = doc1Results.reduce((sum, r) => sum + r.score, 0) / doc1Results.length;
  return Math.round(doc1Score);
}

function generateTextReport(analysis: any): string {
  const results = analysis.results;
  let report = `TEXT GENIUS ANALYSIS REPORT\n`;
  report += `=====================================\n\n`;
  report += `Analysis ID: ${analysis.id}\n`;
  report += `Date: ${new Date(analysis.createdAt).toLocaleString()}\n`;
  report += `Document Mode: ${analysis.documentMode}\n`;
  report += `LLM Provider: ${analysis.llmProvider}\n`;
  report += `Evaluation Parameter: ${analysis.evaluationParam}\n`;
  report += `Analysis Mode: ${analysis.analysisMode}\n`;
  report += `Overall Score: ${analysis.overallScore}/100\n`;
  report += `Processing Time: ${analysis.processingTime} seconds\n\n`;

  if (results.results) {
    report += `DOCUMENT 1 ANALYSIS\n`;
    report += `===================\n\n`;
    
    results.results.forEach((result: any, index: number) => {
      report += `Question ${index + 1}: ${result.question}\n`;
      report += `Score: ${result.score}/100\n`;
      report += `Explanation: ${result.explanation}\n`;
      if (result.quotes && result.quotes.length > 0) {
        report += `Key Quotes:\n`;
        result.quotes.forEach((quote: string) => {
          report += `  - "${quote}"\n`;
        });
      }
      report += `\n`;
    });
  }

  if (results.document2Results) {
    report += `DOCUMENT 2 ANALYSIS\n`;
    report += `===================\n\n`;
    
    results.document2Results.forEach((result: any, index: number) => {
      report += `Question ${index + 1}: ${result.question}\n`;
      report += `Score: ${result.score}/100\n`;
      report += `Explanation: ${result.explanation}\n`;
      if (result.quotes && result.quotes.length > 0) {
        report += `Key Quotes:\n`;
        result.quotes.forEach((quote: string) => {
          report += `  - "${quote}"\n`;
        });
      }
      report += `\n`;
    });
  }

  if (results.comparisonResults) {
    report += `COMPARATIVE ANALYSIS\n`;
    report += `====================\n\n`;
    report += `${results.comparisonResults.explanation}\n\n`;
    report += `Comparative Scores:\n`;
    report += `Document 1: ${results.comparisonResults.scores.document1}/100\n`;
    report += `Document 2: ${results.comparisonResults.scores.document2}/100\n`;
  }

  return report;
}
