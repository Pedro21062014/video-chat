'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { ChatMessage } from '@/lib/types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      id="chat-panel"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:w-96 bg-[#202124] border-l border-[#3c4043] flex flex-col shadow-2xl transition-transform duration-200"
    >
      {/* Google Meet Chat Header */}
      <div className="p-4 border-b border-[#3c4043] flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[#e8eaed] text-base">Mensagens na chamada</h3>
          <p className="text-xs text-[#9aa0a6] mt-0.5">As mensagens são visíveis para todos</p>
        </div>
        <button
          id="btn-close-chat"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#9aa0a6] p-6">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-[#8ab4f8]" />
            <p className="text-sm">Nenhuma mensagem ainda.</p>
            <p className="text-xs text-[#80868b] mt-1">Envie uma mensagem para a reunião.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#e8eaed]">
                    {isMe ? 'Você' : msg.senderName}
                  </span>
                  <span className="text-[11px] text-[#9aa0a6]">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="text-sm text-[#e8eaed] leading-relaxed break-words bg-[#28292c] p-3 rounded-lg border border-[#3c4043]/50">
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#3c4043] flex items-center gap-2 bg-[#202124]">
        <input
          id="input-chat-message"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enviar uma mensagem para todos..."
          className="flex-1 bg-[#28292c] border border-[#5f6368] focus:border-[#8ab4f8] rounded-full px-4 py-2.5 text-sm text-[#e8eaed] placeholder-[#80868b] focus:outline-none transition-colors"
        />
        <button
          id="btn-send-chat-message"
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-full hover:bg-[#3c4043] disabled:opacity-30 text-[#8ab4f8] transition-colors cursor-pointer"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
