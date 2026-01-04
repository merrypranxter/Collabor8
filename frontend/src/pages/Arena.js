import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Plus, Settings, MessageSquare, Users, Loader2, Maximize2, Minimize2, User } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('collabor8_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      initializeArena(JSON.parse(savedUser));
    } else {
      setShowAuthModal(true);
    }
  }, []);

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

  const togglePersona = (personaId) => {
    setActivePersonas(prev => {
      if (prev.includes(personaId)) {
        return prev.filter(id => id !== personaId);
      } else {
        return [...prev, personaId];
      }
    });
  };

  const sendMessage = async () => {
    if (!userInput.trim() || !conversation) return;
    
    setIsLoading(true);
    try {
      const userMessage = await axios.post(`${API}/conversations/${conversation.id}/messages`, {
        content: userInput,
        is_user: true
      });
      
      setMessages(prev => [...prev, userMessage.data]);
      const messageContent = userInput;
      setUserInput("");
      
      setIsGenerating(true);
      
      const response = await axios.post(`${API}/chat/generate-multi`, {
        conversation_id: conversation.id,
        user_message: messageContent
      });
      
      setMessages(prev => [...prev, ...response.data.responses]);
      await loadConversations();
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
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
          active_personas: activePersonas
        });
        setConversation(response.data);
      }
      
      await loadConversations();
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
        active_personas: activePersonas
      });
      setConversation(response.data);
      await loadConversations();
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

  const activePersonaObjects = personas.filter(p => activePersonas.includes(p.id));

  return (
    <div className="min-h-screen relative z-10" data-testid="arena-container">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-screen p-8 overflow-hidden">
        <div className="col-span-1 lg:col-span-9 flex flex-col h-full relative z-10 min-h-0" data-testid="main-stage">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 flex items-center justify-between"
          >
            <div>
              <h1 className="font-display text-5xl md:text-7xl font-normal tracking-tight mb-2 text-[#EAE6DF]" data-testid="arena-title">
                Collabor8
              </h1>
              <p className="text-[#9A9AA3] text-base font-light tracking-wide" data-testid="arena-subtitle">
                A symposium across time
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm uppercase tracking-wider text-[#B87333] hover:text-[#D28C4C] font-light transition-colors duration-200 border border-[rgba(184,115,51,0.2)] px-4 py-2 rounded-lg hover:bg-[rgba(184,115,51,0.05)]"
                data-testid="expand-button"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-sm uppercase tracking-wider text-[#B87333] hover:text-[#D28C4C] font-light transition-colors duration-200 border border-[rgba(184,115,51,0.2)] px-4 py-2 rounded-lg hover:bg-[rgba(184,115,51,0.05)] flex items-center gap-2"
                data-testid="user-button"
              >
                <User className="w-4 h-4" />
                {user?.display_name || "Guest"}
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
            <div className="flex-1 overflow-y-auto pr-4 scroll-area min-h-0" ref={scrollRef} data-testid="messages-scroll-area">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-[#9A9AA3]"
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
                      <TranscriptBubble key={msg.id} message={msg} index={idx} />
                    ))}
                    {isGenerating && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-[#9A9AA3] px-4"
                        data-testid="generating-indicator"
                      >
                        <div className="w-1 h-1 rounded-full bg-[#B87333] animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-[#B87333] animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1 h-1 rounded-full bg-[#B87333] animate-pulse" style={{ animationDelay: '0.4s' }} />
                        <span className="text-sm font-light ml-2">
                          Contemplating...
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex gap-3" data-testid="input-container">
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
                className="flex-1 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] focus:border-[#B87333] rounded-lg p-4 text-base font-light resize-none h-24 focus:outline-none focus:ring-1 focus:ring-[#B87333] text-[#EAE6DF] placeholder:text-[#9A9AA3] placeholder:font-light transition-all duration-200"
                disabled={isLoading || isGenerating}
                data-testid="message-input"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || isGenerating || !userInput.trim()}
                className="px-6 h-24 rounded-lg bg-[rgba(184,115,51,0.08)] border border-[rgba(184,115,51,0.2)] text-[#B87333] hover:bg-[rgba(184,115,51,0.12)] hover:border-[rgba(184,115,51,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                data-testid="send-button"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-[#B87333] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-3 flex flex-col gap-6 h-full z-20 overflow-hidden" data-testid="controls-panel">
          <div className="card-subtle p-5 shrink-0">
            <h3 className="font-display text-lg font-normal mb-4 text-[#EAE6DF] tracking-wide" data-testid="mode-title">Mode</h3>
            <ModeSelector modes={modes} currentMode={mode} onModeChange={changeMode} />
          </div>

          <div className="card-subtle p-5 flex-[4] overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-display text-lg font-normal text-[#EAE6DF] tracking-wide" data-testid="personas-title">Personas</h3>
              <button
                onClick={() => setShowPersonaModal(true)}
                className="text-xs uppercase tracking-wider text-[#B87333] hover:text-[#D28C4C] font-light transition-colors duration-200"
                data-testid="add-persona-button"
              >
                + Summon
              </button>
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
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PersonaModal
        open={showPersonaModal}
        onClose={() => setShowPersonaModal(false)}
        onSubmit={addPersona}
      />
    </div>
  );
}