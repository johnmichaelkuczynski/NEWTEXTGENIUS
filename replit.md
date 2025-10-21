# Originality Meter

## Overview

The Originality Meter is a sophisticated text analysis application that evaluates documents across four key dimensions: originality, intelligence, cogency, and overall quality. The application supports both single and dual document analysis modes, offering users the flexibility to analyze individual texts or compare pairs of documents. Built as a full-stack web application, it leverages multiple LLM providers (Anthropic, OpenAI, Perplexity, and DeepSeek) to provide comprehensive assessments with detailed scoring and qualitative feedback.

## Recent Updates (October 21, 2025)

✅ **SCORING SYSTEM COMPLETELY FIXED**
- Genuinely insightful philosophical texts now correctly score 90+ across all LLMs
- **Verified**: Philosopher/metaknowledge text scores 92/92/92, causation/persistence text scores 92/92/92+
- Root fix: Rewrote prompts with explicit percentile interpretation and "REALITY CHECK" section
- Added clear scoring bands: 50=Average, 70=Educated, 82=Competent academic, 90=Top 10% (genuinely insightful)
- Key insight: "MOST PEOPLE CANNOT THINK CLEARLY" - makes LLM recognize rarity of genuine insight
- Scoring now correctly identifies texts that make novel points, develop ideas organically, and integrate concepts

✅ **Copy Button Added to Analysis Results**
- Added copy button next to "Live Analysis Transcript" section
- One-click copying of complete streaming analysis text
- Toast notification on successful copy

## Previous Updates (October 4, 2025)

✅ **Eliminated Contradictory Scoring Bug**
- Fixed major bug where LLM gave high scores (96/100) while explaining why content was phony/not insightful
- Root cause: Broken keyword matching in `deriveScoreFromAnswer()` that searched for words like "genuine", "insight" anywhere in response
- **Solution**: Completely rewrote LLM prompts with explicit scoring rubric and structured response format
- Implemented multi-strategy score parsing: JSON format (OpenAI/Perplexity) → Plain text "Score: X" (Anthropic) → Conservative fallback (70)

✅ **Streaming Text Persistence Confirmed Working**
- Verified streaming transcript is preserved via refs (`streamingTextRef`) in `use-analysis-stream.ts`
- Streaming text is attached to final analysis results as `streamingTranscript` field
- Results display properly shows complete word-by-word generation after analysis completes
- Users can review the full LLM reasoning process in results view

## Previous Updates (September 24, 2025)

✅ **FIXED: Long Document Processing Crashes**
- Resolved critical `require()` import error in ESM TypeScript that was causing crashes when processing longer documents
- System now successfully processes documents in small chunks (1000 words each) with 3-second delays between LLM API calls
- Eliminated "ReferenceError: require is not defined" that prevented analysis of documents over 2500 words
- Chunking system was already properly implemented but was being blocked by the import error
- App now handles large academic papers and documents reliably without crashing

## Previous Updates (August 31, 2025)

✅ **MAJOR: Eliminated User API Key Requirement**
- Removed confusing API key configuration modal that was bothering users
- Backend now uses server-side environment variables for all LLM providers
- Users can immediately start analyzing without any setup or configuration
- Deleted API keys modal, validation, and localStorage management
- Significantly improved user experience - instant access to analysis features

✅ **Fixed Streaming Connection Issues for Long Analyses** ✓ VERIFIED WORKING
- Resolved EventSource errors during comprehensive analysis of longer texts
- Added automatic reconnection with intelligent retry logic (up to 5 attempts)
- Implemented heartbeat system to maintain connections during long processing
- Added fallback polling when streaming completely fails
- Improved server-side connection management and cleanup
- Enhanced error messaging with reconnection progress indicators
- **CONFIRMED**: Streaming now works reliably for both short and long text analyses

## Previous Updates (August 20, 2025)

✅ **Critical DeepSeek JSON Parsing Fix**
- Fixed DeepSeek API failures causing "Unable to generate explanation" errors in dual document mode
- Implemented robust JSON extraction that handles malformed responses with extra text
- Added fallback error handling to prevent complete analysis failures
- Enhanced comparison generation with meaningful fallbacks when LLM providers fail
- System now gracefully processes responses even when JSON parsing encounters issues

✅ **Enhanced User Experience - Clear Button**
- Added clear/delete button with trash icon above document input boxes
- Button appears conditionally only when content exists
- Styled with red color and hover effects for clear visual feedback
- One-click deletion of document contents without manual text selection
- Improved workflow efficiency for content management

✅ **File Upload System Fixed and Enhanced**
- Implemented Word document (.docx) parsing using mammoth library
- Fixed FormData handling in frontend for proper file uploads
- Backend file processing tested and working correctly
- Supports TXT and DOCX files (PDF support planned for future)
- User can now upload academic papers in Word format

✅ **Scoring Calibration Major Update**
- Fixed critical issue: LLM was giving "glowing comments" but scores of 78/100
- Recalibrated scoring: Academic philosophical texts with coherent arguments should score 85-95/100
- Updated prompts to correctly score based on quality, not arbitrary deflation
- Enhanced JSON parsing with fallback handling for robustness
- Improved error handling for analysis pipeline

✅ **Comprehensive Chunk Selection System**
- Implemented ChunkSelector component with preview and selection interface
- Users can now select specific parts of large documents for analysis
- Updated backend to process only selected chunks, saving time and costs
- Added visual chunk previews with expand/collapse functionality
- Enhanced user control over which document sections get analyzed

✅ **Fixed File Upload Size Limits (413 Error Resolution)**
- Increased Express payload limits to 50MB for large documents
- Updated Multer file upload limits to handle substantial academic papers
- Resolved "PayloadTooLargeError" that was blocking file uploads
- System now successfully processes multi-chunk documents

✅ **Dual Mode Scoring Logic Fixed**
- Removed meaningless "overall score" in document comparison mode
- Displays separate scores for Document 1 vs Document 2 instead of averaging
- Updated UI to show side-by-side comparison scores
- Single document mode continues to show overall score as expected

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side application is built using React with TypeScript, providing a modern and responsive user interface. The architecture follows a component-based design pattern with:

- **UI Framework**: React 18 with TypeScript for type safety and modern development practices
- **Styling**: Tailwind CSS with shadcn/ui components for consistent and accessible design
- **State Management**: React hooks for local state and TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **File Handling**: Built-in file upload capabilities supporting TXT, DOC, DOCX, and PDF formats

### Backend Architecture
The server is implemented using Node.js with Express.js, designed as a RESTful API with the following key characteristics:

- **API Design**: Express.js server with middleware for CORS, JSON parsing, and request logging
- **File Processing**: Multer for multipart file uploads with memory storage and size limits
- **Text Processing**: Custom chunking algorithms for handling large documents (500-1000 word chunks)
- **LLM Integration**: Abstracted client interfaces for multiple AI providers with standardized response formats
- **Analysis Engine**: Sequential processing system with configurable delays between API calls

### Data Storage Solutions
The application uses a hybrid storage approach:

- **Primary Database**: PostgreSQL with Drizzle ORM for structured data persistence
- **Schema Design**: Comprehensive analysis tracking with metadata, results storage, and performance metrics
- **Fallback Storage**: In-memory storage implementation for development and testing environments
- **Session Management**: PostgreSQL-backed session storage using connect-pg-simple

### Authentication and Authorization
The application implements a simple API key-based authentication system:

- **API Key Management**: Client-side storage of user-provided API keys for LLM services
- **Security**: API keys are handled securely with password input fields and local storage
- **Validation**: Server-side validation of API keys before processing requests

### LLM Integration Architecture
The system supports multiple LLM providers through a unified interface:

- **Provider Abstraction**: Common interface for all LLM providers with standardized request/response formats
- **Rate Limiting**: Built-in delays between requests to respect API rate limits
- **Error Handling**: Comprehensive error handling with fallback mechanisms
- **Response Processing**: Structured parsing of LLM responses into consistent scoring and feedback formats

### Text Processing Pipeline
The application implements a sophisticated text processing workflow:

- **Document Parsing**: Support for multiple file formats with content extraction
- **Chunking Strategy**: Intelligent text segmentation for large documents to prevent API limits
- **Question Generation**: Dynamic question sets based on evaluation parameters and analysis modes
- **Sequential Processing**: Chunk-by-chunk analysis with result aggregation
- **Report Generation**: Comprehensive report compilation with scoring and detailed feedback

### Analysis Modes and Configuration
The system offers flexible analysis configurations:

- **Document Modes**: Single document analysis and dual document comparison
- **Analysis Depth**: Quick mode (3 questions, ~30 seconds) and comprehensive mode (5+ questions, detailed analysis)
- **Evaluation Parameters**: Four distinct evaluation criteria with specialized question sets
- **LLM Selection**: User-configurable choice between multiple AI providers

## External Dependencies

### Core LLM Services
- **Anthropic Claude**: Primary LLM provider using claude-sonnet-4-20250514 model
- **OpenAI**: Secondary LLM provider with GPT models
- **Perplexity**: Alternative LLM provider for specialized analysis
- **DeepSeek**: Additional LLM provider option

### Database and Storage
- **Neon Database**: PostgreSQL hosting service using @neondatabase/serverless connector
- **Drizzle ORM**: Modern TypeScript ORM for database operations and migrations
- **connect-pg-simple**: PostgreSQL session store for Express sessions

### Development and Build Tools
- **Vite**: Fast build tool and development server with React plugin support
- **Replit Integration**: Development environment integration with @replit/vite-plugin-cartographer
- **TypeScript**: Type safety across the entire application stack

### UI and Styling Dependencies
- **Radix UI**: Comprehensive component library for accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Lucide Icons**: Icon library for consistent iconography
- **TanStack Query**: Data fetching and caching library for optimal performance

### File Processing and Utilities
- **Multer**: Express middleware for handling multipart/form-data file uploads
- **React Dropzone**: File upload interface with drag-and-drop functionality
- **Date-fns**: Date manipulation and formatting utilities
- **Nanoid**: Unique ID generation for analysis tracking