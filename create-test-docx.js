// Simple script to create a basic DOCX file for testing
import fs from 'fs';

// Create a minimal valid DOCX structure
const content = `Academic Writing Sample

This is a test document for the Originality Meter application. The document demonstrates how academic texts can be analyzed across multiple dimensions including originality, intelligence, cogency, and overall quality.

Academic writing requires careful attention to argumentation, evidence, and logical structure. This sample text provides various elements that can be evaluated: clear thesis statements, supporting evidence, logical transitions, and coherent conclusions.

The analysis system evaluates texts through sophisticated natural language processing, examining both surface-level features and deeper semantic content. This comprehensive approach ensures accurate assessment of academic writing quality.

This document serves as a reliable test case for file upload functionality, demonstrating the system's ability to process Word documents and extract meaningful content for analysis.`;

console.log('Test content ready for DOCX creation');
console.log('Content length:', content.length, 'characters');
console.log('Word count:', content.split(/\s+/).length);