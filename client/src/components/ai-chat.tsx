import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  documentText?: string;
  analysisResults?: any;
}

export function AIChat({ documentText, analysisResults }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">AI Chat - Lightning Fast Feedback</h2>
              <p className="text-primary-100 text-sm mt-1">
                Paste huge documents, ask anything, get instant intelligent responses. No restrictions, full context.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {messages.length === 0 && (
            <Card className="bg-white border-2 border-primary-100">
              <CardContent className="p-8 text-center">
                <Sparkles className="h-16 w-16 text-primary-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Welcome to AI Chat - Your Unrestricted Analysis Assistant
                </h3>
                <div className="text-left max-w-2xl mx-auto space-y-3 text-gray-700">
                  <p className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">✓</span>
                    <span><strong>Paste massive documents:</strong> 900 pages? No problem. Instant feedback.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">✓</span>
                    <span><strong>Ask anything:</strong> No safety rails, no censorship, pure intelligence.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">✓</span>
                    <span><strong>Lightning responses:</strong> Get immediate intelligent analysis.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">✓</span>
                    <span><strong>Full context:</strong> The AI remembers everything in this conversation.</span>
                  </p>
                </div>
                <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                  <p className="text-sm font-semibold text-primary-900">Try asking:</p>
                  <p className="text-sm text-primary-700 mt-1">"Analyze this text for genuine insight vs academic jargon"</p>
                  <p className="text-sm text-primary-700">"Is this author actually smart or just using big words?"</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`max-w-4xl ${msg.role === 'user' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    {msg.role === 'assistant' && (
                      <Sparkles className="h-5 w-5 text-primary-600 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold text-sm mb-2 ${msg.role === 'user' ? 'text-primary-100' : 'text-gray-900'}`}>
                        {msg.role === 'user' ? 'You' : 'AI Assistant'}
                      </p>
                      <p className={`whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <Card className="bg-white border-gray-200">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary-600" />
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at Bottom */}
      <div className="border-t bg-white shadow-lg">
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex gap-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Paste your document or ask a question... (supports massive texts)"
              className="resize-none text-lg min-h-[120px] border-2 border-gray-300 focus:border-primary-500"
              rows={4}
              disabled={isLoading}
              data-testid="chat-input"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-primary-600 hover:bg-primary-700 px-8 h-auto text-lg font-bold"
              data-testid="send-message"
            >
              <Send className="h-6 w-6 mr-2" />
              SEND
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            💡 Press Enter to send • Shift+Enter for new line • Paste huge documents directly
          </p>
        </div>
      </div>
    </div>
  );
}
