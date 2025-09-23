import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { ChunkSelector } from '@/components/chunk-selector';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface DocumentInputProps {
  title: string;
  text: string;
  onTextChange: (text: string) => void;
  selectedChunks: number[];
  onChunksChange: (chunks: number[]) => void;
  required?: boolean;
  disabled?: boolean;
}

export function DocumentInput({ title, text, onTextChange, selectedChunks, onChunksChange, required, disabled }: DocumentInputProps) {
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiRequest('POST', '/api/upload', formData);
      const result = await response.json();

      onTextChange(result.text);
      
      toast({
        title: "File uploaded successfully",
        description: `Extracted ${result.wordCount} words from ${result.filename}`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive",
      });
    }
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chunkCount = wordCount > 1000 ? Math.ceil(wordCount / 750) : 1;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
            {required && <span className="text-sm font-normal text-gray-500 ml-2">(Required)</span>}
          </h3>
          {text.trim() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTextChange('')}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              data-testid="clear-document"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        <FileUpload
          onFileSelect={handleFileSelect}
          onTextChange={onTextChange}
          text={text}
          disabled={disabled}
        />
        
        <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
          <span data-testid="word-count">Word count: {wordCount}</span>
          {wordCount > 1000 && (
            <span className="text-orange-600" data-testid="chunk-info">
              Will be processed in {chunkCount} chunks
            </span>
          )}
        </div>
        
        <ChunkSelector
          text={text}
          selectedChunks={selectedChunks}
          onChunksChange={onChunksChange}
          title={title}
          disabled={disabled}
        />
      </CardContent>
    </Card>
  );
}
