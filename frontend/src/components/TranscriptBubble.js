import { motion } from "framer-motion";
import { Volume2, Play } from "lucide-react";

export default function TranscriptBubble({ message, index, onPlay, isPlaying, onAutoPlay }) {
  const getInitials = (name) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={`
        flex gap-4 p-6 rounded-lg border message-bubble
        ${message.is_user 
          ? "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.15)]" 
          : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)]"
        }
      `}
      data-testid={`message-${message.id}`}
    >
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-light border border-[rgba(255,255,255,0.12)] shrink-0"
        style={{ background: message.is_user ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)' }}
      >
        <span className="text-[#F5F5F5] opacity-70">{getInitials(message.persona_name)}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-light tracking-wide mb-2 uppercase text-white" style={{ letterSpacing: '0.08em' }} data-testid={`message-persona-${message.id}`}>
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