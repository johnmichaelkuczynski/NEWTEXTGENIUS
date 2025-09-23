import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, FileText, CheckSquare, Square } from 'lucide-react';

interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
}

interface ChunkSelectorProps {
  text: string;
  selectedChunks: number[];
  onChunksChange: (selectedChunks: number[]) => void;
  title: string;
  disabled?: boolean;
}

// Helper function to chunk text (matches server-side logic)
function chunkText(text: string, minChunkSize = 500, maxChunkSize = 1000): TextChunk[] {
  const words = text.trim().split(/\s+/);
  const totalWords = words.length;

  if (totalWords <= maxChunkSize) {
    return [{
      index: 0,
      text: text.trim(),
      wordCount: totalWords
    }];
  }

  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  while (currentIndex < totalWords) {
    let chunkSize = Math.min(maxChunkSize, totalWords - currentIndex);
    
    // If remaining words are less than minChunkSize, merge with previous chunk
    if (totalWords - currentIndex < minChunkSize && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const additionalWords = words.slice(currentIndex);
      lastChunk.text += ' ' + additionalWords.join(' ');
      lastChunk.wordCount += additionalWords.length;
      break;
    }

    const chunkWords = words.slice(currentIndex, currentIndex + chunkSize);
    chunks.push({
      index: chunkIndex,
      text: chunkWords.join(' '),
      wordCount: chunkWords.length
    });

    currentIndex += chunkSize;
    chunkIndex++;
  }

  return chunks;
}

export function ChunkSelector({ text, selectedChunks, onChunksChange, title, disabled }: ChunkSelectorProps) {
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (text.trim()) {
      const newChunks = chunkText(text);
      setChunks(newChunks);
      
      // If no chunks are selected and text is chunked, select all by default
      if (selectedChunks.length === 0 && newChunks.length > 1) {
        onChunksChange(newChunks.map(c => c.index));
      } else if (newChunks.length === 1) {
        // For single chunk, always select it
        onChunksChange([0]);
      }
    } else {
      setChunks([]);
      onChunksChange([]);
    }
  }, [text]);

  const handleChunkToggle = (chunkIndex: number, checked: boolean) => {
    if (disabled) return;
    
    if (checked) {
      onChunksChange([...selectedChunks, chunkIndex].sort());
    } else {
      onChunksChange(selectedChunks.filter(idx => idx !== chunkIndex));
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChunksChange(chunks.map(c => c.index));
  };

  const handleSelectNone = () => {
    if (disabled) return;
    onChunksChange([]);
  };

  const toggleChunkExpansion = (chunkIndex: number) => {
    const newExpanded = new Set(expandedChunks);
    if (newExpanded.has(chunkIndex)) {
      newExpanded.delete(chunkIndex);
    } else {
      newExpanded.add(chunkIndex);
    }
    setExpandedChunks(newExpanded);
  };

  const getPreviewText = (text: string, maxLength = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Don't show chunk selector for single chunks or empty text
  if (chunks.length <= 1 || !text.trim()) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {title} - Chunk Selection
            <Badge variant="secondary">{chunks.length} chunks</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              disabled={disabled || selectedChunks.length === chunks.length}
              data-testid="select-all-chunks"
            >
              <CheckSquare className="h-3 w-3 mr-1" />
              All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectNone}
              disabled={disabled || selectedChunks.length === 0}
              data-testid="select-no-chunks"
            >
              <Square className="h-3 w-3 mr-1" />
              None
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Select which parts of the document to analyze. Only selected chunks will be processed.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {chunks.map((chunk) => {
            const isSelected = selectedChunks.includes(chunk.index);
            const isExpanded = expandedChunks.has(chunk.index);
            
            return (
              <div 
                key={chunk.index} 
                className={`border rounded-lg p-3 transition-all ${
                  isSelected ? 'border-primary-300 bg-primary-50' : 'border-gray-200'
                } ${disabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => handleChunkToggle(chunk.index, checked as boolean)}
                    disabled={disabled}
                    className="mt-1"
                    data-testid={`chunk-${chunk.index}-checkbox`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Chunk {chunk.index + 1}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {chunk.wordCount} words
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleChunkExpansion(chunk.index)}
                        className="h-6 w-6 p-0"
                        data-testid={`chunk-${chunk.index}-toggle`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      {isExpanded ? chunk.text : getPreviewText(chunk.text)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {selectedChunks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              <span className="font-medium">{selectedChunks.length}</span> of <span className="font-medium">{chunks.length}</span> chunks selected for analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}