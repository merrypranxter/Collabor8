import { useState, useRef, useEffect } from "react";
import { Play, Pause, X, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PodcastPlayer({ messages, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const speakableMessages = messages.filter(m => !m.is_user && m.content);

  useEffect(() => {
    if (isPlaying && currentIndex < speakableMessages.length) {
      playCurrentMessage();
    }
  }, [currentIndex, isPlaying]);

  const playCurrentMessage = async () => {
    if (currentIndex >= speakableMessages.length) {
      setIsPlaying(false);
      setCurrentIndex(0);
      return;
    }

    const message = speakableMessages[currentIndex];
    setIsLoading(true);

    try {
      // Announce speaker
      const announcement = `${message.persona_name} says...`;
      const announcementResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: announcement, voice: 'alloy' })
      });
      
      if (!announcementResponse.ok) throw new Error('TTS failed');
      
      const announcementData = await announcementResponse.json();
      
      // Play announcement
      const announcementAudio = new Audio(announcementData.audio);
      await new Promise((resolve) => {
        announcementAudio.onended = resolve;
        announcementAudio.play();
      });

      // Generate message audio
      const messageResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/tts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: message.content.slice(0, 4000),
          voice: message.persona_name.toLowerCase().includes('terenc') ? 'onyx' :
                 message.persona_name.toLowerCase().includes('buddha') ? 'fable' :
                 message.persona_name.toLowerCase().includes('jung') ? 'echo' :
                 message.persona_name.toLowerCase().includes('watts') ? 'shimmer' : 'alloy'
        })
      });

      if (!messageResponse.ok) throw new Error('TTS failed');
      
      const messageData = await messageResponse.json();
      
      // Play message
      audioRef.current = new Audio(messageData.audio);
      audioRef.current.onended = () => {
        setCurrentIndex(prev => prev + 1);
      };
      
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          const prog = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setProgress(prog || 0);
        }
      };
      
      await audioRef.current.play();
      setIsLoading(false);
      
    } catch (error) {
      console.error('Podcast player error:', error);
      setIsLoading(false);
      setCurrentIndex(prev => prev + 1); // Skip to next
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (currentIndex >= speakableMessages.length) {
        setCurrentIndex(0);
      }
    }
  };

  const currentMessage = speakableMessages[currentIndex];
  const totalMessages = speakableMessages.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4"
      >
        <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.15)] rounded-lg shadow-2xl p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#A855F7]" />
              <span className="text-sm font-light text-[#F5F5F5]">Podcast Mode</span>
            </div>
            <button
              onClick={onClose}
              className="text-[#A1A1A1] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current message */}
          <div className="mb-3">
            <div className="text-xs text-[#A1A1A1] mb-1">
              {currentIndex + 1} of {totalMessages}
            </div>
            {currentMessage && (
              <div className="text-sm text-[#F5F5F5] font-light">
                <span style={{ color: currentMessage.persona_color }} className="font-normal">
                  {currentMessage.persona_name}:
                </span>{' '}
                {currentMessage.content.slice(0, 100)}
                {currentMessage.content.length > 100 && '...'}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-[#A855F7] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlayPause}
              disabled={isLoading}
              className="w-12 h-12 rounded-full bg-[#A855F7] hover:bg-[#9333EA] flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6 text-white" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
