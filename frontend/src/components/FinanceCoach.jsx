/**
 * FinanceCoach — AI chatbot powered by Anthropic Claude
 * WhatsApp-style chat interface with suggested questions
 * and typing indicator. Calls Claude API from frontend.
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, AlertCircle } from 'lucide-react';

const SYSTEM_PROMPT = `You are SENTINEL's AI Finance Coach, a helpful and protective financial assistant for Indian retail traders. You explain concepts simply, always in a supportive tone, using Indian context (NSE/BSE, INR, SEBI). You never give specific buy/sell recommendations. You always encourage seeking SEBI-registered advice for personalized guidance. Keep responses concise (under 150 words). When asked about the user's trading behavior, remind them to check their behavioral dashboard. If greeted with "Namaste", respond in Hindi.`;

const SUGGESTED_QUESTIONS = [
  { text: "What is F&O trading?", emoji: "📊" },
  { text: "How do I calculate my risk per trade?", emoji: "🎯" },
  { text: "What is a stop loss?", emoji: "🛡️" },
  { text: "Explain options Greeks simply", emoji: "🔢" },
  { text: "Am I overtrading?", emoji: "⚡" },
  { text: "Namaste! 🙏", emoji: "🇮🇳" },
];

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Namaste, Rahul! 🙏 I'm your SENTINEL AI Finance Coach. I can help you understand trading concepts, risk management, and behavioral patterns — all in the Indian market context. Ask me anything!\n\n💡 Remember: I'll never give specific buy/sell recommendations. For personalized advice, always consult a SEBI-registered advisor.",
};

// ── Fallback responses when API key isn't set ──
const FALLBACK_RESPONSES = {
  "what is f&o trading": "**F&O (Futures & Options)** are derivative instruments traded on NSE/BSE.\n\n📌 **Futures**: Agreement to buy/sell an asset at a future date at a fixed price. Requires margin (typically 15-20% of contract value).\n\n📌 **Options**: Right (not obligation) to buy (Call) or sell (Put) at a strike price. You pay a premium.\n\n⚠️ **Risk Warning**: F&O trading involves leverage. Losses can exceed your invested amount. SEBI data shows ~90% of individual F&O traders incur losses.\n\n💡 Start by paper trading on Shoonya's platform before risking real money. Consult a SEBI-registered advisor.",
  "how do i calculate my risk per trade": "**Risk Per Trade Formula** (Position Sizing):\n\n```\nRisk Amount = Portfolio × Risk %\nPosition Size = Risk Amount ÷ (Entry - Stop Loss)\n```\n\n**Example** (₹5,00,000 portfolio, 2% risk):\n- Risk = ₹10,000\n- If buying RELIANCE at ₹2,700 with SL at ₹2,650\n- Position = ₹10,000 ÷ ₹50 = 200 shares\n\n📌 Golden Rules:\n- Never risk more than 1-2% per trade\n- Always set stop losses\n- Check your risk on SENTINEL's dashboard\n\n💡 Your behavioral dashboard shows if you're oversizing positions!",
  "what is a stop loss": "**Stop Loss** automatically exits your position to limit losses.\n\n📌 **Types on NSE/BSE**:\n- **SL-M (Stop Loss Market)**: Triggers a market order at your price\n- **SL-L (Stop Loss Limit)**: Triggers a limit order — may not execute in fast moves\n\n**How to set it**:\n1. Identify support level (technical)\n2. Set SL 1-2% below entry for intraday\n3. Set SL 5-8% below for swing trades\n\n⚠️ **Never move your stop loss further away** — this is how small losses become big ones.\n\n💡 SENTINEL detected that many of your emotional trades had no stop loss. Check your dashboard!",
  "default": "Great question! As your SENTINEL Finance Coach, I'd recommend exploring this topic carefully.\n\n📌 Key things to remember:\n- Always do your own research (DYOR)\n- Check fundamentals on NSE/BSE websites\n- Never invest money you can't afford to lose\n- Set stop losses on every trade\n\n💡 Check your SENTINEL behavioral dashboard for personalized insights about your trading patterns.\n\n🛡️ For personalized advice, consult a SEBI-registered investment advisor. You can find one at sebi.gov.in.",
};

export default function FinanceCoach() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const sendMessage = async (text) => {
    const userMessage = text || input.trim();
    if (!userMessage) return;

    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      // Try OpenAI API
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

      if (!apiKey) {
        // Use fallback responses
        setApiKeyMissing(true);
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

        const lowerText = userMessage.toLowerCase();
        let response = FALLBACK_RESPONSES.default;
        for (const [key, val] of Object.entries(FALLBACK_RESPONSES)) {
          if (key !== 'default' && lowerText.includes(key)) {
            response = val;
            break;
          }
        }
        // Check for Hindi greetings
        if (/namaste|namaskar|नमस्ते/i.test(lowerText)) {
          response = "नमस्ते राहुल! 🙏\n\nमैं SENTINEL का AI Finance Coach हूँ। मैं आपकी ट्रेडिंग से जुड़े सवालों में मदद कर सकता हूँ।\n\n📌 आप मुझसे पूछ सकते हैं:\n- F&O ट्रेडिंग क्या है?\n- Stop loss कैसे लगाएं?\n- Risk management कैसे करें?\n\n💡 याद रखें: मैं कभी specific buy/sell recommendations नहीं दूंगा। Personal advice के लिए SEBI-registered advisor से मिलें।";
        }

        setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        setIsTyping(false);
        return;
      }

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 300,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ]
        }),
      });

      const data = await response.json();
      const assistantMessage = data?.choices?.[0]?.message?.content || 'Sorry, I had trouble processing that. Please try again.';

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please check your internet connection or try again later. In the meantime, check your SENTINEL dashboard for behavioral insights! 📊",
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111118] border border-[#1E1E2A] flex items-center justify-center">
            <Bot size={18} className="text-[#00D26A]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">AI Finance Coach</h2>
            <p className="text-xs text-[#00D26A] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D26A] pulse-subtle" />
              Online
            </p>
          </div>
        </div>
        {apiKeyMissing && (
          <div className="flex items-center gap-1.5 text-xs text-[#FFB020] bg-[#FFB020]/8 px-3 py-1.5 rounded-lg border border-[#FFB020]/15">
            <AlertCircle size={11} />
            Demo mode
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-in-up`}
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start gap-2 max-w-[85%]">
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-[#00D26A]/10 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles size={12} className="text-[#00D26A]" />
                </div>
              )}
              <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-[#1A1A24] border border-[#1E1E2A] flex items-center justify-center shrink-0 mt-1">
                  <User size={12} className="text-[#8B8B9E]" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00D26A]/10 flex items-center justify-center shrink-0 mt-1">
              <Sparkles size={12} className="text-[#00D26A]" />
            </div>
            <div className="chat-bubble-ai py-3 px-4">
              <div className="flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q.text)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#8B8B9E] hover:text-[#F0F0F5] hover:border-[#00D26A]/20 transition flex items-center gap-1.5">
              <span>{q.emoji}</span> {q.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-3 bg-[#111118] border border-[#1E1E2A] rounded-xl px-4 py-2 focus-within:border-[#00D26A]/25 transition-colors">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about trading..."
          className="flex-1 bg-transparent text-sm text-[#F0F0F5] placeholder-[#5A5A6E] outline-none"
          disabled={isTyping}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim() || isTyping}
          className="w-8 h-8 rounded-lg bg-[#00D26A] hover:bg-[#00D26A]/80 flex items-center justify-center transition disabled:opacity-25 disabled:cursor-not-allowed">
          {isTyping ? <Loader2 size={14} className="text-[#0A0A0F] animate-spin" /> : <Send size={14} className="text-[#0A0A0F]" />}
        </button>
      </div>
    </div>
  );
}
