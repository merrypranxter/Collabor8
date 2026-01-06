import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Plus, Settings, MessageSquare, Users, Loader2, Maximize2, Minimize2, User, Trash2, Paperclip, X, Image as ImageIcon, Link as LinkIcon, FileText, Volume2, Mic, Square, Play, Download, Share2, Clock } from "lucide-react";
import { toast } from "sonner";
import PersonaCard from "../components/PersonaCard";
import TranscriptBubble from "../components/TranscriptBubble";
import ModeSelector from "../components/ModeSelector";
import PersonaModal from "../components/PersonaModal";
import ConversationsMenu from "../components/ConversationsMenu";
import AuthModal from "../components/AuthModal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const modes = [
  { id: "Creativity Collaboration", name: "Creativity", icon: Sparkles },
  { id: "Shoot-the-Shit", name: "Casual", icon: MessageSquare },
  { id: "Unhinged", name: "Unhinged", icon: "🌀" },
  { id: "Socratic Debate", name: "Debate", icon: Users },
];

export default function Arena() {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [activePersonas, setActivePersonas] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("Creativity Collaboration");
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [discussionActive, setDiscussionActive] = useState(false);
  const [stopDiscussion, setStopDiscussion] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [attachments, setAttachments] = useState([]);
  
  // Audio states
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [autoPlayQueue, setAutoPlayQueue] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [currentAudio, setCurrentAudio] = useState(null);
  
  // AUTORUN states
  const [showAutorunModal, setShowAutorunModal] = useState(false);
  const [isAutorunActive, setIsAutorunActive] = useState(false);
  const [autorunTimeLeft, setAutorunTimeLeft] = useState(0);
  const [autorunTotalTime, setAutorunTotalTime] = useState(0);
  const autorunTimerRef = useRef(null);
  
  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('collabor8_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      initializeArena(JSON.parse(savedUser));
    } else {
      setShowAuthModal(true);
    }
  }, []);

  // Smart autoscroll - only scroll if user is near bottom
  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, shouldAutoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };

  // Voice configuration for each persona
  // Text-to-Speech function using high-quality OpenAI TTS
  const speakMessage = async (messageId, text, personaName) => {
    try {
      // Stop any currently playing speech
      stopAudio();
      
      setPlayingMessageId(messageId);
      toast.success(`Playing ${personaName}'s message...`);
      
      // Call backend TTS endpoint
      const response = await axios.post(`${API}/tts/generate`, {
        text: text,
        persona_name: personaName
      });
      
      // Create audio element from base64
      const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
      setCurrentAudio(audio);
      
      audio.onended = () => {
        setPlayingMessageId(null);
        setCurrentAudio(null);
        // Auto-play next message if in queue
        playNextInQueue(messageId);
      };
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setPlayingMessageId(null);
        setCurrentAudio(null);
        toast.error("Failed to play audio");
      };
      
      audio.play();
      
    } catch (error) {
      console.error('TTS generation failed:', error);
      setPlayingMessageId(null);
      setCurrentAudio(null);
      toast.error("Failed to generate speech");
    }
  };

  // Play next message in auto-play queue
  const playNextInQueue = (currentMessageId) => {
    if (autoPlayQueue.length > 0) {
      const currentIndex = autoPlayQueue.findIndex(id => id === currentMessageId);
      if (currentIndex !== -1 && currentIndex < autoPlayQueue.length - 1) {
        const nextMessageId = autoPlayQueue[currentIndex + 1];
        const nextMessage = messages.find(m => m.id === nextMessageId);
        if (nextMessage) {
          setTimeout(() => {
            speakMessage(nextMessage.id, nextMessage.content, nextMessage.persona_name);
          }, 800); // Small pause between messages
        }
      } else {
        // Reached end of queue
        setAutoPlayQueue([]);
      }
    }
  };

  // Start auto-play from a specific message
  const startAutoPlay = (startMessageId) => {
    const startIndex = messages.findIndex(m => m.id === startMessageId);
    if (startIndex === -1) return;
    
    // Get all non-user messages from this point forward
    const queueIds = messages
      .slice(startIndex)
      .filter(m => !m.is_user)
      .map(m => m.id);
    
    setAutoPlayQueue(queueIds);
    
    const startMessage = messages.find(m => m.id === startMessageId);
    if (startMessage) {
      speakMessage(startMessage.id, startMessage.content, startMessage.persona_name);
    }
  };

  // Stop all audio playback
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setPlayingMessageId(null);
    setCurrentAudio(null);
    setAutoPlayQueue([]);
  };

  // Speech-to-text (Speech Recognition)
  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      toast.success("Listening...");
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setUserInput(prev => prev + finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      toast.error("Speech recognition error");
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAuth = async (type, data) => {
    try {
      let response;
      if (type === "login") {
        response = await axios.post(`${API}/auth/login`, data);
      } else if (type === "register") {
        response = await axios.post(`${API}/auth/register`, data);
      } else if (type === "guest") {
        response = await axios.get(`${API}/auth/guest`);
        response.data.display_name = data.display_name || "Guest";
      }
      
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('collabor8_user', JSON.stringify(userData));
      
      await initializeArena(userData);
      toast.success(`Welcome, ${userData.display_name}!`);
    } catch (error) {
      console.error("Auth failed:", error);
      throw error;
    }
  };

  const loadConversations = async (userId) => {
    try {
      const response = await axios.get(`${API}/conversations`, {
        params: userId ? { user_id: userId } : {}
      });
      setConversations(response.data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  };

  const initializeArena = async (userData) => {
    try {
      console.log("Initializing arena...");
      const seedResponse = await axios.post(`${API}/personas/seed`);
      console.log("Seed response:", seedResponse.data);
      
      const response = await axios.get(`${API}/personas`);
      console.log("Personas fetched:", response.data.length);
      setPersonas(response.data);
      
      const defaultActive = response.data.slice(0, 3).map(p => p.id);
      console.log("Setting active personas:", defaultActive);
      setActivePersonas(defaultActive);
      
      const convResponse = await axios.post(`${API}/conversations`, {
        mode: "Creativity Collaboration",
        topic: null,
        active_personas: defaultActive,
        user_id: userData?.id
      });
      console.log("Conversation created:", convResponse.data);
      setConversation(convResponse.data);
      
      await loadConversations(userData?.id);
      
      toast.success(`Arena initialized! ${response.data.length} personas ready.`);
    } catch (error) {
      console.error("Failed to initialize:", error);
      console.error("Error details:", error.response?.data);
      toast.error(`Failed to initialize: ${error.message}`);
    }
  };

  const togglePersona = async (personaId) => {
    console.log('togglePersona called for:', personaId);
    const newActivePersonas = activePersonas.includes(personaId)
      ? activePersonas.filter(id => id !== personaId)
      : [...activePersonas, personaId];
    
    console.log('New active personas:', newActivePersonas);
    setActivePersonas(newActivePersonas);
    
    // Update the conversation in the backend with new active personas
    if (conversation?.id) {
      try {
        console.log('Updating conversation:', conversation.id);
        console.log('Setting active personas to:', newActivePersonas);
        const response = await axios.put(`${API}/conversations/${conversation.id}`, {
          active_personas: newActivePersonas
        });
        console.log('✅ Active personas updated in backend:', response.data);
      } catch (error) {
        console.error('❌ Failed to update active personas:', error);
        console.error('Error details:', error.response?.data);
      }
    } else {
      console.log('⚠️ No conversation ID available');
    }
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          data: e.target.result,
          description: file.name
        };
        setAttachments(prev => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUrlAttachment = () => {
    const url = prompt("Enter URL:");
    if (url) {
      setAttachments(prev => [...prev, { type: 'url', url, name: url }]);
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!userInput.trim() || !conversation) return;
    
    // Stop any ongoing discussion when user sends new message
    setStopDiscussion(true);
    
    setIsLoading(true);
    try {
      const userMessage = await axios.post(`${API}/conversations/${conversation.id}/messages`, {
        content: userInput,
        is_user: true
      });
      
      setMessages(prev => [...prev, userMessage.data]);
      const messageContent = userInput;
      const messageAttachments = attachments;
      setUserInput("");
      setAttachments([]);
      
      setIsGenerating(true);
      
      // Get initial responses from all personas
      const response = await axios.post(`${API}/chat/generate-multi`, {
        conversation_id: conversation.id,
        user_message: messageContent,
        attachments: messageAttachments
      });
      
      setMessages(prev => [...prev, ...response.data.responses]);
      setIsGenerating(false);
      
      // Now continue the discussion - personas respond to each other
      setDiscussionActive(true);
      setStopDiscussion(false);
      
      continueDiscussion(conversation.id);
      
      await loadConversations(user?.id);
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const continueDiscussion = async (conversationId) => {
    try {
      // Continue for 2 rounds of discussion
      const discussionResponse = await axios.post(`${API}/chat/continue-discussion`, {
        conversation_id: conversationId,
        max_rounds: 2
      });
      
      // Add responses one by one for better UX
      for (const response of discussionResponse.data.responses) {
        if (stopDiscussion) {
          console.log("Discussion stopped by user");
          break;
        }
        setMessages(prev => [...prev, response]);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between messages
      }
      
    } catch (error) {
      console.error("Failed to continue discussion:", error);
    } finally {
      setDiscussionActive(false);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const convResponse = await axios.get(`${API}/conversations/${conversationId}`);
      setConversation(convResponse.data);
      setMode(convResponse.data.mode);
      setActivePersonas(convResponse.data.active_personas);
      
      const messagesResponse = await axios.get(`${API}/conversations/${conversationId}/messages`);
      setMessages(messagesResponse.data);
      
      toast.success("Conversation loaded");
    } catch (error) {
      console.error("Failed to load conversation:", error);
      toast.error("Failed to load conversation");
    }
  };

  const deleteConversation = async (conversationId) => {
    try {
      await axios.delete(`${API}/conversations/${conversationId}`);
      
      if (conversation?.id === conversationId) {
        setMessages([]);
        const response = await axios.post(`${API}/conversations`, {
          mode,
          topic: null,
          active_personas: activePersonas,
          user_id: user?.id
        });
        setConversation(response.data);
      }
      
      await loadConversations(user?.id);
      toast.success("Conversation deleted");
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const startNewConversation = async () => {
    try {
      setMessages([]);
      const response = await axios.post(`${API}/conversations`, {
        mode,
        topic: null,
        active_personas: activePersonas,
        user_id: user?.id
      });
      setConversation(response.data);
      await loadConversations(user?.id);
      toast.success("New conversation started");
    } catch (error) {
      console.error("Failed to start new conversation:", error);
      toast.error("Failed to start new conversation");
    }
  };

  const changeMode = async (newMode) => {
    setMode(newMode);
    if (conversation) {
      toast.success(`Switched to ${newMode} mode`);
    }
  };

  const addPersona = async (personaData) => {
    try {
      const response = await axios.post(`${API}/personas`, personaData);
      setPersonas(prev => [...prev, response.data]);
      setActivePersonas(prev => [...prev, response.data.id]);
      toast.success(`${response.data.display_name} has entered the arena`);
    } catch (error) {
      console.error("Failed to add persona:", error);
      toast.error("Failed to add persona");
    }
  };

  const deletePersona = async (personaId) => {
    try {
      await axios.delete(`${API}/personas/${personaId}`);
      setPersonas(prev => prev.filter(p => p.id !== personaId));
      setActivePersonas(prev => prev.filter(id => id !== personaId));
      toast.success("Persona removed from arena");
    } catch (error) {
      console.error("Failed to delete persona:", error);
      toast.error("Failed to delete persona");
    }
  };

  const activePersonaObjects = personas.filter(p => activePersonas.includes(p.id));

  return (
    <div className="min-h-screen relative z-10" data-testid="arena-container">
      {expandedPanel === 'personas' ? (
        <div className="h-screen p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display text-5xl font-normal text-[#F5F5F5]">Persona Gallery</h1>
            <button
              onClick={() => setExpandedPanel(null)}
              className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] px-4 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
            >
              <Minimize2 className="w-4 h-4 inline mr-2" />
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto h-[calc(100vh-200px)] scroll-area">
            {personas.map(persona => (
              <motion.div
                key={persona.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`
                  card-subtle p-6 cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-all relative group
                  ${activePersonas.includes(persona.id) ? 'ring-1 ring-white' : ''}
                `}
                onClick={() => togglePersona(persona.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Remove ${persona.display_name} from the arena?`)) {
                      deletePersona(persona.id);
                    }
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-[rgba(0,0,0,0.8)] hover:bg-[rgba(220,38,38,0.2)] border border-[rgba(220,38,38,0.3)]"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                </button>
                <div className="flex items-start gap-4 mb-4">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-light border border-[rgba(255,255,255,0.15)] shrink-0"
                    style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                  >
                    <span className="text-[#F5F5F5]">{persona.display_name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-xl font-normal text-[#F5F5F5] mb-1">{persona.display_name}</h3>
                    <p className="text-xs uppercase tracking-wider text-white">{persona.role_in_arena}</p>
                  </div>
                  {activePersonas.includes(persona.id) && (
                    <div className="persona-status-active" />
                  )}
                </div>
                <p className="text-sm text-[#A1A1A1] font-light leading-relaxed mb-3">{persona.bio}</p>
                <div className="text-xs text-[#A1A1A1] font-light">
                  <span className="uppercase tracking-wider">Quirks:</span>
                  <div className="mt-1 space-y-1">
                    {persona.quirks.map((quirk, i) => (
                      <div key={i} className="pl-3">• {quirk}</div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
            <button
              onClick={() => setShowPersonaModal(true)}
              className="card-subtle p-6 flex flex-col items-center justify-center gap-3 hover:bg-[rgba(255,255,255,0.05)] transition-all border-dashed border-[rgba(255,255,255,0.2)]"
            >
              <Plus className="w-8 h-8 text-white" />
              <span className="text-sm uppercase tracking-wider text-white font-light">Summon New Persona</span>
            </button>
          </div>
        </div>
      ) : (
      <div className={`grid grid-cols-1 gap-8 h-screen p-8 overflow-hidden transition-all duration-300 ${isExpanded ? "lg:grid-cols-1" : "lg:grid-cols-12"}`}>
        <div className={`flex flex-col h-full relative z-10 min-h-0 ${isExpanded ? "col-span-1" : "col-span-1 lg:col-span-9"}`} data-testid="main-stage">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <h1 className="font-display text-5xl md:text-7xl font-normal tracking-tight mb-2 text-[#F5F5F5]" data-testid="arena-title">
                Collabor8
              </h1>
              <p className="text-[#A1A1A1] text-base font-light tracking-wide" data-testid="arena-subtitle">
                A symposium across time
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(playingMessageId || autoPlayQueue.length > 0) && (
                <button
                  onClick={stopAudio}
                  className="text-sm uppercase tracking-wider text-[#EF4444] hover:text-[#DC2626] font-light transition-colors duration-200 border border-[rgba(239,68,68,0.3)] px-3 py-2 rounded-lg hover:bg-[rgba(239,68,68,0.1)] flex items-center gap-2 animate-pulse"
                  title="Stop all audio"
                >
                  <Square className="w-4 h-4" />
                  <span className="hidden sm:inline">Stop Audio</span>
                </button>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
                data-testid="expand-button"
                title="Expand Chat"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2"
                data-testid="user-button"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.display_name || "Guest"}</span>
              </button>
              <ConversationsMenu
                conversations={conversations}
                currentConversationId={conversation?.id}
                onSelectConversation={loadConversation}
                onDeleteConversation={deleteConversation}
                onNewConversation={startNewConversation}
              />
            </div>
          </motion.div>

          <div className="card-subtle p-6 flex-1 flex flex-col overflow-hidden min-h-0" data-testid="chat-container">
            <div className="flex-1 overflow-y-auto pr-4 scroll-area min-h-0" ref={scrollRef} onScroll={handleScroll} data-testid="messages-scroll-area">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-[#A1A1A1]"
                    data-testid="empty-state"
                  >
                    <div className="text-center space-y-3">
                      <p className="text-lg font-light tracking-wide">The table awaits...</p>
                      <p className="text-sm font-light">Address the symposium</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-4" data-testid="messages-list">
                    {messages.map((msg, idx) => (
                      <TranscriptBubble 
                        key={msg.id} 
                        message={msg} 
                        index={idx}
                        onPlay={speakMessage}
                        isPlaying={playingMessageId === msg.id}
                        onAutoPlay={startAutoPlay}
                      />
                    ))}
                    {isGenerating && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-[#A1A1A1] px-4"
                        data-testid="generating-indicator"
                      >
                        <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
                        <span className="text-sm font-light ml-2">
                          Contemplating...
                        </span>
                      </motion.div>
                    )}
                    {discussionActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center text-[#A1A1A1] mt-2"
                      >
                        <div className="w-1 h-1 rounded-full bg-[#3B82F6] animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-[#3B82F6] animate-pulse ml-1" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1 h-1 rounded-full bg-[#3B82F6] animate-pulse ml-1" style={{ animationDelay: '0.4s' }} />
                        <span className="text-sm font-light ml-2 text-[#3B82F6]">
                          Personas discussing...
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6" data-testid="input-container">
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded px-3 py-1.5">
                      {att.type === 'image' && <ImageIcon className="w-3 h-3" />}
                      {att.type === 'url' && <LinkIcon className="w-3 h-3" />}
                      {att.type === 'file' && <FileText className="w-3 h-3" />}
                      <span className="text-xs text-[#F5F5F5]">{att.name?.slice(0, 20)}</span>
                      <button onClick={() => removeAttachment(idx)} className="text-[#DC2626] hover:text-[#EF4444]">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.txt,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 h-24 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.05)] transition-all"
                  title="Upload files or images"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={handleUrlAttachment}
                  className="px-3 h-24 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.05)] transition-all"
                  title="Add URL"
                >
                  <LinkIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-3 h-24 rounded-lg transition-all ${
                    isRecording 
                      ? 'bg-[rgba(239,68,68,0.2)] border border-[rgba(239,68,68,0.4)] text-[#EF4444] animate-pulse' 
                      : 'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.05)]'
                  }`}
                  title={isRecording ? "Stop recording" : "Voice input"}
                >
                  {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <textarea
                  placeholder="Address the symposium..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="flex-1 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] focus:border-white rounded-lg p-4 text-base font-light resize-none h-24 focus:outline-none focus:ring-1 focus:ring-white text-[#F5F5F5] placeholder:text-[#A1A1A1] placeholder:font-light transition-all duration-200"
                  disabled={isLoading || isGenerating}
                  data-testid="message-input"
                />
                {discussionActive && (
                  <button
                    onClick={() => setStopDiscussion(true)}
                    className="px-6 h-24 rounded-lg bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.3)] text-[#EF4444] hover:bg-[rgba(220,38,38,0.2)] hover:border-[rgba(220,38,38,0.4)] transition-all duration-200"
                    title="Stop ongoing discussion"
                  >
                    <span className="text-sm uppercase tracking-wider">Stop</span>
                  </button>
                )}
                <button
                  onClick={sendMessage}
                  disabled={isLoading || isGenerating || !userInput.trim()}
                  className="px-6 h-24 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  data-testid="send-button"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {!isExpanded && (
          <div className="col-span-1 lg:col-span-3 flex flex-col gap-6 h-full z-20 overflow-hidden" data-testid="controls-panel">
            <div className="card-subtle p-5 shrink-0">
              <h3 className="font-display text-lg font-normal mb-4 text-[#F5F5F5] tracking-wide" data-testid="mode-title">Mode</h3>
              <ModeSelector modes={modes} currentMode={mode} onModeChange={changeMode} />
            </div>

            <div className="card-subtle p-5 flex-[4] overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="font-display text-lg font-normal text-[#F5F5F5] tracking-wide" data-testid="personas-title">Personas</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedPanel('personas')}
                    className="text-white hover:text-[#E5E5E5] transition-colors"
                    data-testid="expand-personas-button"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowPersonaModal(true)}
                    className="text-xs uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200"
                    data-testid="add-persona-button"
                  >
                    + Summon
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0 scroll-area" data-testid="personas-list">
                <div className="space-y-2 pr-2">
                  {personas.map(persona => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      isActive={activePersonas.includes(persona.id)}
                      onClick={() => togglePersona(persona.id)}
                      isSpeaking={false}
                      showDelete={true}
                      onDelete={deletePersona}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      <PersonaModal
        open={showPersonaModal}
        onClose={() => setShowPersonaModal(false)}
        onSubmit={addPersona}
      />
      
      <AuthModal
        open={showAuthModal && !user}
        onClose={() => {}}
        onAuth={handleAuth}
      />
    </div>
  );
}