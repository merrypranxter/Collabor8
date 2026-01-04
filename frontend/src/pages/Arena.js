import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Plus, Settings, MessageSquare, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PersonaCard from "../components/PersonaCard";
import TranscriptBubble from "../components/TranscriptBubble";
import ModeSelector from "../components/ModeSelector";
import PersonaModal from "../components/PersonaModal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const modes = [
  { id: "Creativity Collaboration", name: "Creativity", icon: Sparkles },
  { id: "Shoot-the-Shit", name: "Casual", icon: MessageSquare },
  { id: "Unhinged", name: "Unhinged", icon: "🌀" },
  { id: "Socratic Debate", name: "Debate", icon: Users },
];

export default function Arena() {
  const [personas, setPersonas] = useState([]);
  const [activePersonas, setActivePersonas] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("Creativity Collaboration");
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    initializeArena();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeArena = async () => {
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
        active_personas: defaultActive
      });
      console.log("Conversation created:", convResponse.data);
      setConversation(convResponse.data);
      
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
      setUserInput("");
      
      generatePersonaResponse();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePersonaResponse = async () => {
    if (activePersonas.length === 0 || !conversation) return;
    
    setIsGenerating(true);
    
    const nextPersonaId = activePersonas[currentPersonaIndex % activePersonas.length];
    setCurrentPersonaIndex(prev => prev + 1);
    
    try {
      const allMessages = await axios.get(`${API}/conversations/${conversation.id}/messages`);
      
      const response = await axios.post(`${API}/chat/generate`, {
        conversation_id: conversation.id,
        persona_id: nextPersonaId,
        context_messages: allMessages.data.map(m => ({
          persona_name: m.persona_name,
          content: m.content
        }))
      });
      
      setMessages(prev => [...prev, response.data]);
    } catch (error) {
      console.error("Failed to generate response:", error);
      toast.error("Failed to generate persona response");
    } finally {
      setIsGenerating(false);
    }
  };

  const changeMode = async (newMode) => {
    setMode(newMode);
    if (conversation) {
      try {
        await axios.post(`${API}/conversations`, {
          mode: newMode,
          topic: conversation.topic,
          active_personas: activePersonas
        });
        toast.success(`Switched to ${newMode} mode`);
      } catch (error) {
        console.error("Failed to change mode:", error);
      }
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
  const currentSpeaker = activePersonaObjects[currentPersonaIndex % activePersonaObjects.length];

  return (
    <div className="min-h-screen relative z-10" data-testid="arena-container">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-screen p-4 lg:p-8 overflow-hidden">
        <div className="col-span-1 lg:col-span-9 flex flex-col h-full relative z-10" data-testid="main-stage">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-2" data-testid="arena-title">
              Collabor8
            </h1>
            <p className="text-muted-foreground text-lg" data-testid="arena-subtitle">
              Where history's greatest minds converge
            </p>
          </motion.div>

          <div className="glass-panel rounded-2xl p-6 flex-1 flex flex-col overflow-hidden" data-testid="chat-container">
            <div className="flex-1 overflow-y-auto pr-4 scroll-area" ref={scrollRef} data-testid="messages-scroll-area">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center h-full text-muted-foreground"
                    data-testid="empty-state"
                  >
                    <div className="text-center space-y-4">
                      <Sparkles className="w-16 h-16 mx-auto opacity-50" />
                      <p className="text-xl">Begin the conversation...</p>
                      <p className="text-sm">Ask a question or share a thought</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-4" data-testid="messages-list">
                    {messages.map((msg, idx) => (
                      <TranscriptBubble key={msg.id} message={msg} index={idx} />
                    ))}
                    {isGenerating && (
                    {isGenerating && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-muted-foreground"
                        data-testid="generating-indicator"
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">
                          {currentSpeaker?.display_name || "Persona"} is thinking...
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex gap-3" data-testid="input-container">
              <Input
                placeholder="Speak to the symposium..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 bg-white/5 border-white/10 focus:border-primary"
                disabled={isLoading || isGenerating}
                data-testid="message-input"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || isGenerating || !userInput.trim()}
                className="px-6"
                data-testid="send-button"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-3 flex flex-col gap-4 h-full z-20" data-testid="controls-panel">
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="font-display text-2xl font-bold mb-4" data-testid="mode-title">Mode</h3>
            <ModeSelector modes={modes} currentMode={mode} onModeChange={changeMode} />
          </div>

          <div className="glass-panel rounded-2xl p-6 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-2xl font-bold" data-testid="personas-title">Personas</h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setShowPersonaModal(true)}
                data-testid="add-persona-button"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto" data-testid="personas-list">
              <div className="space-y-3 pr-2">
                {personas.map(persona => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    isActive={activePersonas.includes(persona.id)}
                    onClick={() => togglePersona(persona.id)}
                    isSpeaking={currentSpeaker?.id === persona.id && isGenerating}
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