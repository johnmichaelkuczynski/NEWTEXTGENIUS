export interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
}

export class TextProcessor {
  static chunkText(text: string, minChunkSize = 500, maxChunkSize = 1000): TextChunk[] {
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

  static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  static async delay(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  static calculateChunkCount(text: string): number {
    const wordCount = this.countWords(text);
    return wordCount > 1000 ? Math.ceil(wordCount / 750) : 1;
  }
}
