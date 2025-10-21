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
    <div className="flex flex-col h-full bg-white">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <Sparkles className="h-16 w-16 text-primary-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">Start a conversation</p>
            <p className="text-sm">Ask me anything or send your input/output text for discussion</p>
          </div>
        )}
        
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-5 py-3 ${
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
            💡 Press Enter to send • Shift+Enter for new line • +Ctrl to send input to Chat
          </p>
        </div>
      </div>
    </div>
  );
}
