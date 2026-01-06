import { motion } from "framer-motion";
import { Volume2, Play, Copy } from "lucide-react";

export default function TranscriptBubble({ message, index, onPlay, isPlaying, onAutoPlay, onCopy }) {
  const getInitials = (name) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(168, 85, 247, ${alpha})`;
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  };

  // Get color from persona or use defaults
  const getPersonaColor = (message) => {
    if (message.is_user) {
      return {
        bg: 'rgba(59, 130, 246, 0.15)',
        border: 'rgba(59, 130, 246, 0.4)',
        text: '#60A5FA',
        avatar: 'rgba(59, 130, 246, 0.25)'
      };
    }

    // Use custom color from persona if available
    const personaColor = message.persona_color || message.color || "#A855F7";
    
    return {
      bg: hexToRgba(personaColor, 0.12),
      border: hexToRgba(personaColor, 0.3),
      text: personaColor,
      avatar: hexToRgba(personaColor, 0.2)
    };
  };

  const colors = getPersonaColor(message);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="flex gap-4 p-6 rounded-lg border message-bubble"
      style={{
        background: colors.bg,
        borderColor: colors.border
      }}
      data-testid={`message-${message.id}`}
    >
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-light border shrink-0"
        style={{ 
          background: colors.avatar,
          borderColor: colors.border
        }}
      >
        <span style={{ color: colors.text }}>{getInitials(message.persona_name)}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div 
          className="text-sm font-light tracking-wide mb-2 uppercase" 
          style={{ letterSpacing: '0.08em', color: colors.text }} 
          data-testid={`message-persona-${message.id}`}
        >
          {message.persona_name}
        </div>
        <div className="text-[#F5F5F5] text-base font-light leading-relaxed whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
          {message.content}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <div className="text-xs text-[#A1A1A1] font-light">
            {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
          
          {!message.is_user && (
            <div className="flex gap-2">
              <button
                onClick={() => onPlay(message.id, message.content, message.persona_name)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  isPlaying 
                    ? 'bg-[rgba(59,130,246,0.2)] border border-[rgba(59,130,246,0.4)] text-[#3B82F6]' 
                    : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-[#A1A1A1] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.15)]'
                }`}
                title="Play this message"
              >
                <Volume2 className="w-3 h-3" />
                {isPlaying ? 'Playing' : 'Play'}
              </button>
              
              <button
                onClick={() => onAutoPlay(message.id)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-[#A1A1A1] hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.15)] transition-all"
                title="Auto-play from here"
              >
                <Play className="w-3 h-3" />
                Play All
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}