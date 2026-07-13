import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I'm your quantitative AI trading desk assistant. Ask me for price predictions, market sentiment, or trade suggestions." }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Mock response for presentation
    setTimeout(() => {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: `Based on my quantitative analysis of the current market structure, I am **bearish** on WTI in the short term. The breakdown below $80 has triggered systematic trend-following algos, and with the Contango steepening in the M1-M3 spread, physical oversupply is evident. I suggest looking for short setups on rallies towards the $78 resistance level.` 
      }])
      setLoading(false)
    }, 1200)
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'fixed',
          bottom: 30,
          right: 30,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: isOpen ? 'var(--red)' : 'linear-gradient(135deg, #00C48F 0%, #0088FF 100%)',
          color: '#fff',
          boxShadow: isOpen 
            ? '0 8px 24px rgba(255, 68, 68, 0.4)' 
            : isHovered 
              ? '0 12px 30px rgba(0, 136, 255, 0.6)'
              : '0 8px 24px rgba(0, 136, 255, 0.4)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isHovered ? 'scale(1.08)' : 'scale(1)'
        }}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 100,
          right: 30,
          width: 380,
          height: 550,
          background: 'rgba(10, 14, 25, 0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            background: 'linear-gradient(to right, rgba(255,255,255,0.02), rgba(255,255,255,0.05))',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}>
            <div style={{ 
              width: 36, height: 36, borderRadius: 12, 
              background: 'linear-gradient(135deg, #00C48F 0%, #0088FF 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 136, 255, 0.3)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>QUANT AI DESK</div>
              <div style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
                System Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {messages.map((m, i) => (
              <div key={i} className="chat-message" style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                background: m.role === 'user' ? 'linear-gradient(135deg, #0088FF 0%, #0066CC 100%)' : 'rgba(255,255,255,0.06)',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: 16,
                borderTopRightRadius: m.role === 'user' ? 4 : 16,
                borderTopLeftRadius: m.role === 'assistant' ? 4 : 16,
                fontSize: 13,
                lineHeight: 1.6,
                boxShadow: m.role === 'user' ? '0 4px 12px rgba(0, 136, 255, 0.2)' : '0 2px 8px rgba(0,0,0,0.2)',
                border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.05)' : 'none'
              }}>
                {m.role === 'user' ? (
                  m.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                )}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-muted)',
                padding: '12px 16px',
                borderRadius: 16,
                borderTopLeftRadius: 4,
                fontSize: 13,
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                gap: 6,
                alignItems: 'center'
              }}>
                <span className="dot-flashing"></span> Calculating...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{
            padding: '16px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 12
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask Quant AI..."
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                padding: '12px 18px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(0, 136, 255, 0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                background: 'linear-gradient(135deg, #00C48F 0%, #0088FF 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 24,
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
                opacity: (loading || !input.trim()) ? 0.5 : 1,
                transition: 'all 0.2s',
                boxShadow: (loading || !input.trim()) ? 'none' : '0 4px 12px rgba(0, 136, 255, 0.3)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Required CSS for animations */}
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dot-flashing {
          position: relative;
          width: 4px;
          height: 4px;
          border-radius: 2px;
          background-color: var(--blue);
          color: var(--blue);
          animation: dot-flashing 1s infinite linear alternate;
          animation-delay: 0.5s;
        }
        .dot-flashing::before, .dot-flashing::after {
          content: '';
          display: inline-block;
          position: absolute;
          top: 0;
          width: 4px;
          height: 4px;
          border-radius: 2px;
          background-color: var(--blue);
          color: var(--blue);
          animation: dot-flashing 1s infinite alternate;
        }
        .dot-flashing::before { left: -8px; animation-delay: 0s; }
        .dot-flashing::after { left: 8px; animation-delay: 1s; }
        @keyframes dot-flashing {
          0% { background-color: var(--blue); }
          50%, 100% { background-color: rgba(0, 136, 255, 0.2); }
        }
        .chat-message p { margin: 0 0 10px 0; }
        .chat-message p:last-child { margin: 0; }
        .chat-message ul, .chat-message ol { margin: 0 0 10px 0; padding-left: 20px; }
        .chat-message li { margin-bottom: 4px; }
        .chat-message strong { color: var(--gold); }
        .chat-message table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
        .chat-message th, .chat-message td { border: 1px solid rgba(255,255,255,0.1); padding: 6px 8px; text-align: left; }
        .chat-message th { background: rgba(255,255,255,0.05); color: var(--gold); }
      `}</style>
    </>
  )
}

