import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Sparkles, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  documentText?: string;
  analysisResults?: any;
  onSendToInput?: (text: string) => void;
}

export function AIChat({ documentText, analysisResults, onSendToInput }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/chat', {
        message: input,
        context: {
          documentText,
          analysisResults
        },
        conversationHistory: messages
      });
      
      const data = await response.json();
      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Error communicating with AI. Please try again.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <Sparkles className="h-16 w-16 text-primary-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">AI Chat - Full Context Awareness</p>
            <p className="text-sm max-w-lg mx-auto">
              I can see your document AND its analysis results. Ask me to:
            </p>
            <ul className="text-sm text-left max-w-md mx-auto mt-3 space-y-1 text-gray-700">
              <li>✓ "Make this smarter"</li>
              <li>✓ "Rewrite to score 95+"</li>
              <li>✓ "What's wrong with my text?"</li>
              <li>✓ "Make it more original/cogent/insightful"</li>
            </ul>
          </div>
        )}
        
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] ${msg.role === 'assistant' ? 'space-y-2' : ''}`}>
                <div
                  className={`rounded-lg px-5 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border-2 border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm font-semibold mb-1 opacity-75">
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'assistant' && onSendToInput && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onSendToInput(msg.content);
                      toast({
                        title: "Sent to input box",
                        description: "AI response has been added to the document input for analysis",
                      });
                    }}
                    className="text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                    data-testid={`send-to-input-${idx}`}
                  >
                    <ArrowUp className="h-4 w-4 mr-1" />
                    Send to Analysis
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border-2 border-gray-200 rounded-lg px-5 py-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type, paste, or upload text (Word/PDF supported)..."
              className="resize-none text-base"
              rows={3}
              disabled={isLoading}
              data-testid="chat-input"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-primary-600 hover:bg-primary-700 px-6 text-base font-semibold"
              data-testid="send-message"
            >
              <Send className="h-5 w-5 mr-2" />
              Send
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Press Enter to send • Shift+Enter for new line • I see your document + analysis results
          </p>
        </div>
      </div>
    </div>
  );
}
