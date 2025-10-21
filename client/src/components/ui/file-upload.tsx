import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from './button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onTextChange: (text: string) => void;
  text: string;
  accept?: string;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, onTextChange, text, accept = '.txt,.doc,.docx,.pdf', disabled }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    disabled
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer ${
          isDragActive 
            ? 'border-primary-400 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        data-testid="file-upload-area"
      >
        <input {...getInputProps()} data-testid="file-upload-input" />
        <div className="text-center">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            Drop files here or{' '}
            <span className="text-primary-600 hover:text-primary-700 font-medium">browse</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">✓ Supports TXT, DOC, DOCX, and PDF files</p>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Type or paste your text here for analysis..."
          className="w-full min-h-[600px] px-4 py-4 text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
          disabled={disabled}
          data-testid="text-input"
        />
        {text && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => onTextChange('')}
            data-testid="clear-text-button"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
