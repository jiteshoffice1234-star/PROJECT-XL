import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Volume2,
  Image as ImageIcon,
  Sparkles,
  X,
  Play,
  RotateCcw,
  CheckCircle,
  Copy,
  Download,
  Cpu,
  Layers,
} from 'lucide-react';
import { SheetData } from '../../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface GeminiAIAssistantModalProps {
  isOpen: boolean;
  activeSheet: SheetData;
  activeRowData?: Record<string, any>;
  onClose: () => void;
  defaultTab?: 'chat' | 'tts' | 'image';
}

const ROLES = [
  {
    id: 'architect',
    name: 'Spreadsheet & Automation Architect',
    desc: 'Designs multi-condition rules, lookup hierarchies, and optimal schema layout.',
    system:
      'You are the PROJECT XL Spreadsheet & Automation Architect. Provide precise, actionable advice on spreadsheet rules, conditional party lookups, seller routing, and workflow design. Format clearly.',
  },
  {
    id: 'auditor',
    name: 'Invoice & Reconciliation Auditor',
    desc: 'Audits transaction numbers, invoice sequences, missing sellers, and status codes.',
    system:
      'You are the PROJECT XL Invoice & Reconciliation Auditor. Review invoice registers, spot duplicate numbers, missing party details, and unlinked instructions.',
  },
  {
    id: 'formula',
    name: 'Excel Formula Genius',
    desc: 'Crafts robust Excel formulas like XLOOKUP, INDEX/MATCH, SUMIFS, and dynamic arrays.',
    system:
      'You are the PROJECT XL Excel Formula Genius. Provide exact Excel formulas (SUM, COUNTIF, IF, VLOOKUP, XLOOKUP, IFERROR) ready to paste into the formula bar.',
  },
];

export const GeminiAIAssistantModal: React.FC<GeminiAIAssistantModalProps> = ({
  isOpen,
  activeSheet,
  activeRowData,
  onClose,
  defaultTab = 'chat',
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'tts' | 'image'>(defaultTab);

  // Chat State
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-4-argon' | 'gemini-3.1-flash-lite'>('gemini-3.8-flash');
  const [selectedRole, setSelectedRole] = useState(ROLES[0].id);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your PROJECT XL Intelligence Assistant. How can I assist with your invoice register, Control Center lookup rules, or spreadsheet formulas today?',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // TTS State
  const [ttsText, setTtsText] = useState(
    activeRowData
      ? `Invoice ${activeRowData['INV NUM'] || 'Register'} for party ${activeRowData['PARTY'] || 'Customer'}. Status: ${activeRowData['REMARK'] || 'Pending'}. Instruction: ${activeRowData['INSTRUCTIONS'] || 'Standard'}.`
      : 'Welcome to PROJECT XL. All invoice instructions and seller rules are synchronized.'
  );
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [ttsStyle, setTtsStyle] = useState('Clear, professional spreadsheet assistant');
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Image Generation State (gemini-3-pro-image-preview with 1K, 2K, 4K affordances)
  const [imagePrompt, setImagePrompt] = useState(
    'Professional corporate diamond audit stamp with circular embossed seal, verified watermark text, dark navy and metallic gold accents'
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageAspect, setImageAspect] = useState<'1:1' | '16:9' | '4:3'>('1:1');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoadingChat]);

  if (!isOpen) return null;

  const currentRoleObj = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || isLoadingChat) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoadingChat(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          model: selectedModel,
          systemInstruction: `${currentRoleObj.system}\nActive sheet: ${activeSheet.name}. Columns: ${activeSheet.columns.map((c) => c.name).join(', ')}. Total rows: ${activeSheet.rows.length}.`,
        }),
      });

      const data = await response.json();
      if (response.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${data.error || 'Failed to generate response'}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleGenerateTTS = async () => {
    if (!ttsText.trim() || isGeneratingTTS) return;
    setIsGeneratingTTS(true);
    setAudioUrl(null);

    try {
      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText,
          voice: ttsVoice,
          style: ttsStyle,
        }),
      });

      const data = await response.json();
      if (response.ok && data.audioBase64) {
        const url = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        setAudioUrl(url);
        // Automatically play
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setIsPlayingAudio(true);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
        audio.play();
      } else {
        alert(data.error || 'TTS generation failed');
      }
    } catch (err: any) {
      alert(`TTS error: ${err.message}`);
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          imageSize,
          aspectRatio: imageAspect,
        }),
      });

      const data = await response.json();
      if (response.ok && data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      } else {
        setImageError(data.error || 'Image generation failed');
      }
    } catch (err: any) {
      setImageError(err.message || 'Image generation error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-cyan-400 rounded-xl shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>PROJECT XL Intelligence Suite</span>
                <span className="text-[10px] px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-full font-mono">
                  Gemini Models
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Multi-turn Chatbot, Audio TTS Voice Narration, and High-Resolution Image Generator
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Tab Navigation */}
        <div className="flex items-center px-6 border-b border-neutral-800 bg-neutral-950/50 text-xs">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold border-b-2 transition ${
              activeTab === 'chat'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Gemini Chatbot</span>
          </button>

          <button
            onClick={() => setActiveTab('tts')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold border-b-2 transition ${
              activeTab === 'tts'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Text to Speech (gemini-3.8-flash-tts)</span>
          </button>

          <button
            onClick={() => setActiveTab('image')}
            className={`flex items-center space-x-2 py-3 px-4 font-semibold border-b-2 transition ${
              activeTab === 'image'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>High-Quality Images (1K / 2K / 4K)</span>
          </button>
        </div>

        {/* TAB 1: GEMINI CHATBOT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
            {/* Model & Role Controls */}
            <div className="p-3 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-neutral-400 font-medium">Model:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as any)}
                  className="bg-neutral-950 text-white font-mono text-xs px-2.5 py-1 rounded border border-neutral-700 outline-none focus:border-cyan-500"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (General Tasks)</option>
                  <option value="gemini-4-argon">gemini-4-argon (Complex Logic & Math)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Fast)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-neutral-400 font-medium">Assistant Role:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="bg-neutral-950 text-white text-xs px-2.5 py-1 rounded border border-neutral-700 outline-none focus:border-cyan-500"
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scrollable Conversation Thread */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-3 ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="p-1.5 bg-cyan-950 text-cyan-400 rounded-lg border border-cyan-800 shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 shadow-md whitespace-pre-wrap leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-cyan-600 text-white font-medium rounded-tr-none'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none font-mono text-[11px]'
                    }`}
                  >
                    <div>{m.content}</div>
                    <div className="text-[9px] text-neutral-400 mt-1.5 text-right select-none">{m.timestamp}</div>
                  </div>
                </div>
              ))}

              {isLoadingChat && (
                <div className="flex items-start space-x-3">
                  <div className="p-1.5 bg-cyan-950 text-cyan-400 rounded-lg border border-cyan-800 shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 rounded-tl-none flex items-center space-x-2 text-neutral-400">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-75" />
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-150" />
                    <span className="text-[11px]">Thinking with {selectedModel}...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-4 py-2 bg-neutral-900/60 border-t border-neutral-800 flex items-center space-x-2 overflow-x-auto text-[11px]">
              <span className="text-neutral-500 font-medium shrink-0">Suggestions:</span>
              <button
                onClick={() => handleSendMessage('Analyze the current invoice register for any duplicate invoice numbers or missing party details')}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full shrink-0 transition"
              >
                Audit Invoices for Duplicates
              </button>
              <button
                onClick={() => handleSendMessage('Suggest an XLOOKUP formula to retrieve instruction by party name and seller')}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full shrink-0 transition"
              >
                Suggest XLOOKUP Formula
              </button>
              <button
                onClick={() => handleSendMessage('How should I configure a priority rule for seller AKSHAT under RATNA JEWELS?')}
                className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full shrink-0 transition"
              >
                Explain RATNA JEWELS Rule
              </button>
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center space-x-2">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Ask anything about formulas, instructions, seller rules, or data audits..."
                className="flex-1 bg-neutral-950 text-white px-4 py-2.5 text-xs border border-neutral-700 rounded-xl focus:border-cyan-500 outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoadingChat || !inputPrompt.trim()}
                className="p-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-xl shadow transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TEXT TO SPEECH (gemini-3.8-flash-tts) */}
        {activeTab === 'tts' && (
          <div className="flex-1 p-6 bg-neutral-950 overflow-y-auto space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Voice Narration Engine (gemini-3.8-flash-tts)</h3>
              </div>
              <p className="text-xs text-neutral-400">
                Transforms invoice instructions, status summaries, or reconciliation remarks into natural speech using Gemini 3.8 Flash TTS.
              </p>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Text to Read Aloud:
                </label>
                <textarea
                  rows={4}
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  className="w-full bg-neutral-950 text-white p-3 text-xs border border-neutral-700 rounded-lg focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Voice Persona:</label>
                  <select
                    value={ttsVoice}
                    onChange={(e) => setTtsVoice(e.target.value)}
                    className="w-full bg-neutral-950 text-white p-2 text-xs border border-neutral-700 rounded-lg outline-none"
                  >
                    <option value="Kore">Kore (Balanced, Professional Female)</option>
                    <option value="Puck">Puck (Energetic, Clear Male)</option>
                    <option value="Fenrir">Fenrir (Authoritative Deep Male)</option>
                    <option value="Zephyr">Zephyr (Soft, Calm Female)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Speech Style:</label>
                  <select
                    value={ttsStyle}
                    onChange={(e) => setTtsStyle(e.target.value)}
                    className="w-full bg-neutral-950 text-white p-2 text-xs border border-neutral-700 rounded-lg outline-none"
                  >
                    <option value="Clear, professional spreadsheet assistant">Professional Executive</option>
                    <option value="Urgent dispatch security alert">Urgent Dispatch Alert</option>
                    <option value="Warm and friendly accounting advisor">Friendly Accounting Advisor</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  onClick={handleGenerateTTS}
                  disabled={isGeneratingTTS}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  {isGeneratingTTS ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>{isGeneratingTTS ? 'Generating Speech...' : 'Generate & Play Audio'}</span>
                </button>

                {audioUrl && (
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play();
                      }
                    }}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replay Audio</span>
                  </button>
                )}
              </div>

              {isPlayingAudio && (
                <div className="flex items-center space-x-2 p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-lg text-xs text-cyan-300">
                  <div className="flex space-x-1 items-end h-4">
                    <span className="w-1 h-3 bg-cyan-400 animate-pulse" />
                    <span className="w-1 h-4 bg-cyan-400 animate-pulse delay-75" />
                    <span className="w-1 h-2 bg-cyan-400 animate-pulse delay-150" />
                  </div>
                  <span>Now playing audio via browser AudioContext...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: HIGH QUALITY IMAGE GENERATION (gemini-3-pro-image-preview) */}
        {activeTab === 'image' && (
          <div className="flex-1 p-6 bg-neutral-950 overflow-y-auto space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">High-Quality Image Generator (gemini-3-pro-image-preview)</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded-full font-mono">
                  Configurable Resolution
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Generate high-resolution corporate seals, invoice header watermarks, official approval stamps, or infographic banners.
              </p>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Image Prompt:</label>
                <textarea
                  rows={3}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="w-full bg-neutral-950 text-white p-3 text-xs border border-neutral-700 rounded-lg focus:border-purple-500 outline-none"
                />
              </div>

              {/* Crucial: Resolution Size Affordance (1K, 2K, 4K) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Image Resolution (Required Affordance):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['1K', '2K', '4K'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setImageSize(size)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                          imageSize === size
                            ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                            : 'bg-neutral-950 border-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Aspect Ratio:</label>
                  <select
                    value={imageAspect}
                    onChange={(e) => setImageAspect(e.target.value as any)}
                    className="w-full bg-neutral-950 text-white p-2.5 text-xs border border-neutral-700 rounded-lg outline-none"
                  >
                    <option value="1:1">1:1 Square (Stamp / Avatar / Seal)</option>
                    <option value="16:9">16:9 Landscape (Report Header / Banner)</option>
                    <option value="4:3">4:3 Standard</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  {isGeneratingImage ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isGeneratingImage ? `Rendering in ${imageSize}...` : `Generate Image (${imageSize})`}</span>
                </button>
              </div>

              {imageError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-lg text-xs text-rose-300">
                  {imageError}
                </div>
              )}

              {/* Rendered Image Preview */}
              {generatedImageUrl && (
                <div className="mt-4 p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Generated Asset ({imageSize})</span>
                    <a
                      href={generatedImageUrl}
                      download={`project_xl_asset_${imageSize}.png`}
                      className="flex items-center space-x-1 text-xs text-cyan-400 hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Asset</span>
                    </a>
                  </div>
                  <div className="flex justify-center bg-black/40 rounded-lg p-2 border border-neutral-800">
                    <img
                      src={generatedImageUrl}
                      alt="Generated"
                      className="max-h-80 object-contain rounded-md shadow-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
