import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { analysisRequestSchema, type AnalysisRequest } from "@shared/schema";
import { getQuestions } from "./services/question-sets";
import { LLMClients } from "./services/llm-clients";
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
          message: `Unsupported file type: .${extension}. Please use TXT, DOC, or DOCX files.` 
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

      // Start background processing
      processAnalysisAsync(analysis.id, validatedRequest);

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

  const httpServer = createServer(app);
  return httpServer;
}

async function processAnalysisAsync(
  analysisId: string, 
  request: AnalysisRequest
) {
  const startTime = Date.now();
  
  try {
    const llmClient = new LLMClients();
    const questions = getQuestions(request.evaluationParam, request.analysisMode);

    // Process document 1
    const doc1Results = await processDocument(
      request.document1Text, 
      questions, 
      request.llmProvider, 
      llmClient,
      request.selectedChunks1
    );

    let doc2Results = undefined;
    let comparisonResults = undefined;

    // Process document 2 if dual mode
    if (request.documentMode === 'dual' && request.document2Text) {
      doc2Results = await processDocument(
        request.document2Text, 
        questions, 
        request.llmProvider, 
        llmClient,
        request.selectedChunks2
      );

      // Generate comparison
      comparisonResults = await generateComparison(
        request.document1Text,
        request.document2Text,
        doc1Results,
        doc2Results,
        request.evaluationParam,
        request.llmProvider,
        llmClient
      );
    }

    // Calculate overall score
    const overallScore = calculateOverallScore(doc1Results, doc2Results);
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    // Update analysis with results
    await storage.updateAnalysisResults(analysisId, {
      results: doc1Results,
      document2Results: doc2Results,
      comparisonResults
    }, overallScore, processingTime);

  } catch (error) {
    console.error('Analysis processing error:', error);
    // Update analysis with error status
    await storage.updateAnalysisResults(analysisId, {
      error: error instanceof Error ? error.message : "Analysis failed"
    }, 0, Math.round((Date.now() - startTime) / 1000));
  }
}

async function processDocument(
  text: string,
  questions: string[],
  provider: string,
  llmClient: LLMClients,
  selectedChunks?: number[]
) {
  const allChunks = TextProcessor.chunkText(text);
  
  // If specific chunks are selected, only process those
  const chunksToProcess = selectedChunks && selectedChunks.length > 0 
    ? allChunks.filter(chunk => selectedChunks.includes(chunk.index))
    : allChunks;

  console.log(`Processing ${chunksToProcess.length} chunks out of ${allChunks.length} total chunks`);
  if (selectedChunks && selectedChunks.length > 0) {
    console.log(`Selected chunk indices: ${selectedChunks.join(', ')}`);
  }

  const results = [];

  for (const question of questions) {
    const chunkResults = [];

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      
      try {
        const result = await llmClient.analyzeText(provider, chunk.text, question);
        chunkResults.push({
          chunkIndex: chunk.index, // Use original chunk index
          ...result
        });

        // Wait 3 seconds between chunks to respect rate limits but improve speed
        if (i < chunksToProcess.length - 1) {
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
  evaluationParam: string,
  provider: string,
  llmClient: LLMClients
) {
  const comparisonPrompt = `Compare these two documents based on ${evaluationParam}. 

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

  try {
    const result = await llmClient.analyzeText(provider, comparisonPrompt, 'Provide a comparative analysis');
    
    // Try to parse the explanation as JSON first
    let comparisonResult;
    try {
      comparisonResult = JSON.parse(result.explanation);
    } catch {
      // If that fails, create a structured response
      comparisonResult = {
        explanation: result.explanation,
        scores: {
          document1: Math.round(doc1Results.reduce((sum, r) => sum + r.score, 0) / doc1Results.length),
          document2: Math.round(doc2Results.reduce((sum, r) => sum + r.score, 0) / doc2Results.length)
        }
      };
    }
    
    return comparisonResult;
  } catch (error) {
    console.error('Comparison generation error:', error);
    // Generate a basic comparison based on the individual results
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
  let report = `ORIGINALITY METER ANALYSIS REPORT\n`;
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
      if (result.quotes.length > 0) {
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
      if (result.quotes.length > 0) {
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
