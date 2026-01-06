import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Plus, Settings, MessageSquare, Users, Loader2, Maximize2, Minimize2, User, Trash2, Paperclip, X, Image as ImageIcon, Link as LinkIcon, FileText, Volume2, Mic, Square, Play, Download, Share2, Clock, Edit, ChevronDown, UserCircle, LogOut, GripVertical } from "lucide-react";
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
  { id: "Unhinged", name: "Unhinged", icon: Loader2 },
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
  const [editingPersona, setEditingPersona] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [discussionActive, setDiscussionActive] = useState(false);
  const [stopDiscussion, setStopDiscussion] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [expandedModePanel, setExpandedModePanel] = useState(false);
  const [expandedHistoryPanel, setExpandedHistoryPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const userMenuRef = useRef(null);
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
      
      // Prepend persona name announcement
      const textWithIntro = `${personaName} says: ${text}`;
      
      // Call backend TTS endpoint
      const response = await axios.post(`${API}/tts/generate`, {
        text: textWithIntro,
        persona_name: personaName
      });
      
      // Create audio element from base64
      const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
      setCurrentAudio(audio);
      
      audio.onended = () => {
        console.log('Audio ended for message:', messageId);
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
        // Try to continue to next in queue even on error
        playNextInQueue(messageId);
      };
      
      await audio.play();
      console.log('Playing audio for message:', messageId);
      
    } catch (error) {
      console.error('TTS generation failed:', error);
      setPlayingMessageId(null);
      setCurrentAudio(null);
      toast.error("Failed to generate speech");
      // Try to continue to next in queue
      playNextInQueue(messageId);
    }
  };

  // Play next message in auto-play queue
  const playNextInQueue = (currentMessageId) => {
    console.log('playNextInQueue called for:', currentMessageId);
    console.log('Current queue:', autoPlayQueue);
    
    if (autoPlayQueue.length > 0) {
      const currentIndex = autoPlayQueue.findIndex(id => id === currentMessageId);
      console.log('Current index in queue:', currentIndex);
      
      if (currentIndex !== -1 && currentIndex < autoPlayQueue.length - 1) {
        const nextMessageId = autoPlayQueue[currentIndex + 1];
        const nextMessage = messages.find(m => m.id === nextMessageId);
        console.log('Next message:', nextMessage?.persona_name);
        
        if (nextMessage) {
          setTimeout(() => {
            speakMessage(nextMessage.id, nextMessage.content, nextMessage.persona_name);
          }, 800); // Small pause between messages
        } else {
          console.log('Next message not found in messages array');
          setAutoPlayQueue([]);
        }
      } else {
        // Reached end of queue
        console.log('Reached end of queue');
        setAutoPlayQueue([]);
        toast.success('Finished playing all messages');
      }
    } else {
      console.log('Queue is empty');
    }
  };

  // Start auto-play from a specific message
  const startAutoPlay = (startMessageId) => {
    console.log('Starting auto-play from message:', startMessageId);
    const startIndex = messages.findIndex(m => m.id === startMessageId);
    if (startIndex === -1) {
      console.log('Start message not found');
      return;
    }
    
    // Get all non-user messages from this point forward
    const queueIds = messages
      .slice(startIndex)
      .filter(m => !m.is_user)
      .map(m => m.id);
    
    console.log('Created queue with', queueIds.length, 'messages');
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

  // AUTORUN Mode Functions
  const startAutorun = async (durationMinutes) => {
    if (!conversation?.id) {
      toast.error("Create a conversation first");
      return;
    }

    const durationSeconds = durationMinutes * 60;
    setIsAutorunActive(true);
    setAutorunTimeLeft(durationSeconds);
    setAutorunTotalTime(durationSeconds);
    setShowAutorunModal(false);
    
    toast.success(`AUTORUN started for ${durationMinutes} minutes`);

    // Start countdown timer
    autorunTimerRef.current = setInterval(() => {
      setAutorunTimeLeft(prev => {
        if (prev <= 1) {
          stopAutorun();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start autonomous discussion on backend
    try {
      await axios.post(`${API}/chat/autorun`, {
        conversation_id: conversation.id,
        duration_seconds: durationSeconds
      });
    } catch (error) {
      console.error("Autorun failed:", error);
      toast.error("Autorun failed to start");
      stopAutorun();
    }
  };

  const stopAutorun = () => {
    setIsAutorunActive(false);
    setAutorunTimeLeft(0);
    if (autorunTimerRef.current) {
      clearInterval(autorunTimerRef.current);
      autorunTimerRef.current = null;
    }
    
    // Reload messages to get all the new discussion
    if (conversation?.id) {
      loadConversation(conversation.id);
    }
    
    toast.info("AUTORUN stopped");
  };

  // Export Functions
  const exportAsText = () => {
    const text = messages.map(m => 
      `${m.persona_name} (${new Date(m.timestamp).toLocaleString()}):\n${m.content}\n\n`
    ).join('');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collabor8-${conversation?.title || 'conversation'}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Exported as TXT");
  };

  const exportAsPDF = async () => {
    try {
      const response = await axios.post(`${API}/export/pdf`, {
        conversation_id: conversation?.id,
        messages: messages
      }, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collabor8-${conversation?.title || 'conversation'}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Exported as PDF");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("PDF export failed");
    }
  };

  const shareConversation = async () => {
    try {
      const response = await axios.post(`${API}/conversations/${conversation?.id}/share`);
      const shareUrl = `${window.location.origin}/shared/${response.data.share_id}`;
      
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard!");
    } catch (error) {
      console.error("Share failed:", error);
      toast.error("Failed to create share link");
    }
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('collabor8_user');
    setShowUserMenu(false);
    setShowAuthModal(true);
    toast.success("Logged out successfully");
  };

  // Handle persona drag and drop
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(personas);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state immediately for smooth UX
    setPersonas(items);
    
    // Create orders array with new positions
    const orders = items.map((persona, index) => ({
      id: persona.id,
      sort_order: index
    }));
    
    // Send to backend
    try {
      await axios.post(`${API}/personas/reorder`, { orders });
    } catch (error) {
      console.error("Failed to save order:", error);
      toast.error("Failed to save persona order");
      // Revert on error
      const response = await axios.get(`${API}/personas`);
      setPersonas(response.data);
    }
  };

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
      
      // Load existing conversations but don't create a new one yet
      await loadConversations(userData?.id);
      
      toast.success(`Arena initialized! ${response.data.length} personas ready.`);
    } catch (error) {
      console.error("Failed to initialize:", error);
      console.error("Error details:", error.response?.data);
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

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          data: e.target.result,
          description: file.name
        };
        
        // If it's a PDF, extract text
        if (file.type === 'application/pdf') {
          try {
            const response = await axios.post(`${API}/extract-pdf`, {
              pdf_data: e.target.result
            });
            attachment.extractedText = response.data.text;
            attachment.description = `PDF: ${file.name} (${response.data.pages} pages)`;
            toast.success(`PDF text extracted: ${response.data.pages} pages`);
          } catch (error) {
            console.error('PDF extraction failed:', error);
            toast.error('Could not extract PDF text, but file is attached');
          }
        }
        
        setAttachments(prev => [...prev, attachment]);
      };
      reader.readAsDataURL(file);
    }
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
    if (!userInput.trim()) return;
    
    // Stop any ongoing discussion when user sends new message
    setStopDiscussion(true);
    
    setIsLoading(true);
    try {
      let currentConversation = conversation;
      
      // Create a new conversation if this is the first message
      if (!currentConversation) {
        console.log("Creating new conversation...");
        const convResponse = await axios.post(`${API}/conversations`, {
          mode,
          topic: null,
          active_personas: activePersonas,
          user_id: user?.id
        });
        currentConversation = convResponse.data;
        setConversation(currentConversation);
        console.log("✅ New conversation created:", currentConversation.id);
      }
      
      // Save the user message
      const userMessage = await axios.post(`${API}/conversations/${currentConversation.id}/messages`, {
        content: userInput,
        is_user: true
      });
      
      setMessages(prev => [...prev, userMessage.data]);
      const messageContent = userInput;
      const messageAttachments = attachments;
      const isFirstMessage = messages.length === 0;
      setUserInput("");
      setAttachments([]);
      
      setIsGenerating(true);
      
      // Get initial responses from all personas
      const response = await axios.post(`${API}/chat/generate-multi`, {
        conversation_id: currentConversation.id,
        user_message: messageContent,
        attachments: messageAttachments
      });
      
      setMessages(prev => [...prev, ...response.data.responses]);
      setIsGenerating(false);
      
      // Generate AI title immediately if this is the first message
      if (isFirstMessage) {
        console.log("Generating AI title for first message...");
        try {
          const titleResponse = await axios.post(`${API}/chat/generate-title`, {
            conversation_id: currentConversation.id,
            first_message: messageContent
          });
          
          const aiTitle = titleResponse.data.title;
          console.log("✅ AI title generated:", aiTitle);
          
          // Update conversation with AI-generated title
          await axios.put(`${API}/conversations/${currentConversation.id}`, {
            title: aiTitle
          });
          
          setConversation(prev => ({ ...prev, title: aiTitle }));
          
          // Reload conversations to show in history with new title
          await loadConversations(user?.id);
          
          toast.success(`Conversation saved: "${aiTitle}"`);
        } catch (titleError) {
          console.error("Failed to generate title:", titleError);
          // Continue even if title generation fails
        }
      } else {
        // For subsequent messages, just reload conversations to update timestamp
        await loadConversations(user?.id);
      }
      
      // Now continue the discussion - personas respond to each other
      setDiscussionActive(true);
      setStopDiscussion(false);
      
      continueDiscussion(currentConversation.id);
      
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
    // Clear current conversation and messages
    setConversation(null);
    setMessages([]);
    toast.success("New conversation started");
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

  const editPersona = async (personaId, personaData) => {
    try {
      const response = await axios.put(`${API}/personas/${personaId}`, personaData);
      setPersonas(prev => prev.map(p => p.id === personaId ? response.data : p));
      toast.success(`${response.data.display_name} updated`);
    } catch (error) {
      console.error("Failed to edit persona:", error);
      toast.error("Failed to edit persona");
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

  // Filter personas by tag
  const filteredPersonas = tagFilter 
    ? personas.filter(p => p.tags && p.tags.some(tag => tag.includes(tagFilter.toLowerCase())))
    : personas;

  const activePersonaObjects = filteredPersonas.filter(p => activePersonas.includes(p.id));

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
          
          {/* Tag filter in expanded view */}
          {personas.some(p => p.tags && p.tags.length > 0) && (
            <div className="mb-6">
              <input
                type="text"
                placeholder="Filter by tag (e.g., philosophy, science)..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="max-w-md bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-2 text-[#F5F5F5] placeholder:text-[#666] focus:outline-none focus:border-white"
              />
              {tagFilter && (
                <button
                  onClick={() => setTagFilter('')}
                  className="ml-2 text-xs text-[#A1A1A1] hover:text-[#F5F5F5]"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="personas-expanded">
              {(provided) => (
                <div 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto h-[calc(100vh-200px)] scroll-area"
                >
                  {filteredPersonas.map((persona, index) => (
                    <Draggable key={persona.id} draggableId={persona.id} index={index}>
                      {(provided, snapshot) => (
                        <motion.div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`
                            card-subtle p-6 cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-all relative group
                            ${activePersonas.includes(persona.id) ? 'ring-1 ring-white' : ''}
                            ${snapshot.isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''}
                          `}
                          onClick={() => togglePersona(persona.id)}
                        >
                          <div 
                            {...provided.dragHandleProps}
                            className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="w-5 h-5 text-[#666]" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPersona(persona);
                              setShowPersonaModal(true);
                            }}
                            className="absolute top-3 right-14 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-[rgba(0,0,0,0.8)] hover:bg-[rgba(59,130,246,0.2)] border border-[rgba(59,130,246,0.3)]"
                          >
                            <Edit className="w-3.5 h-3.5 text-[#3B82F6]" />
                          </button>
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
                              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-light border border-[rgba(255,255,255,0.15)] shrink-0 overflow-hidden"
                              style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                            >
                              {persona.avatar_url || persona.avatar_base64 ? (
                                <img 
                                  src={persona.avatar_url || persona.avatar_base64} 
                                  alt={persona.display_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[#F5F5F5]">{persona.display_name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                              )}
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
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <button
                    onClick={() => setShowPersonaModal(true)}
                    className="card-subtle p-6 flex flex-col items-center justify-center gap-3 hover:bg-[rgba(255,255,255,0.05)] transition-all border-dashed border-[rgba(255,255,255,0.2)]"
                  >
                    <Plus className="w-8 h-8 text-white" />
                    <span className="text-sm uppercase tracking-wider text-white font-light">Summon New Persona</span>
                  </button>
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
              {isAutorunActive && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] text-[#4ADE80]">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span className="text-sm uppercase tracking-wider font-light">
                    AUTORUN: {Math.floor(autorunTimeLeft / 60)}:{String(autorunTimeLeft % 60).padStart(2, '0')}
                  </span>
                  <button
                    onClick={stopAutorun}
                    className="ml-2 text-xs hover:text-red-400 transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}
              {!isAutorunActive && messages.length > 0 && (
                <>
                  <button
                    onClick={() => setShowAutorunModal(true)}
                    className="text-sm uppercase tracking-wider text-[#4ADE80] hover:text-[#22C55E] font-light transition-colors duration-200 border border-[rgba(34,197,94,0.3)] px-3 py-2 rounded-lg hover:bg-[rgba(34,197,94,0.1)] flex items-center gap-2"
                    title="Start Autonomous Discussion"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">AUTORUN</span>
                  </button>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2"
                    title="Export or Share"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] p-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
                data-testid="expand-button"
                title="Expand Chat"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2"
                  data-testid="user-button"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user?.display_name || "Guest"}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-48 bg-[#141414] border border-[rgba(255,255,255,0.15)] rounded-lg shadow-lg overflow-hidden z-50"
                  >
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        toast.info("Profile settings coming soon!");
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-[#F5F5F5] hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3"
                    >
                      <UserCircle className="w-4 h-4" />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        toast.info("Settings coming soon!");
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-[#F5F5F5] hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    {user && !user.is_guest && (
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-3 text-left text-sm text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors flex items-center gap-3 border-t border-[rgba(255,255,255,0.08)]"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
              
              <ConversationsMenu
                conversations={conversations}
                currentConversationId={conversation?.id}
                onSelectConversation={loadConversation}
                onDeleteConversation={deleteConversation}
                onNewConversation={startNewConversation}
                expanded={expandedHistoryPanel}
                onToggleExpand={() => setExpandedHistoryPanel(!expandedHistoryPanel)}
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
                        onCopy={(text) => {
                          navigator.clipboard.writeText(text);
                          toast.success("Copied to clipboard!");
                        }}
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
            <div className={`card-subtle shrink-0 transition-all ${expandedModePanel ? 'flex-1' : ''}`}>
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="font-display text-lg font-normal text-[#F5F5F5] tracking-wide" data-testid="mode-title">Mode</h3>
                  <button
                    onClick={() => setExpandedModePanel(!expandedModePanel)}
                    className="text-white hover:text-[#E5E5E5] transition-colors"
                    title={expandedModePanel ? "Collapse" : "Expand"}
                  >
                    {expandedModePanel ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
                <ModeSelector modes={modes} currentMode={mode} onModeChange={changeMode} />
                {expandedModePanel && (
                  <div className="mt-4 text-sm text-[#A1A1A1] font-light">
                    <p className="mb-2">Current mode: <span className="text-[#F5F5F5]">{mode}</span></p>
                    <p className="text-xs leading-relaxed">
                      {mode === "Creativity Collaboration" && "Build on ideas, collaborate constructively, and synthesize concepts together."}
                      {mode === "Shoot-the-Shit" && "Casual conversation, tangents welcome. Natural back-and-forth discussion."}
                      {mode === "Unhinged" && "Surreal, satirical exploration of ideas. Maximum creativity and chaos."}
                      {mode === "Socratic Debate" && "Question-driven probing, challenge assumptions, and engage critically."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className={`card-subtle flex flex-col min-h-0 ${expandedModePanel ? '' : 'flex-[4]'}`}>
              <div className="p-5 flex flex-col h-full">
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
                
                {/* Tag filter */}
                {personas.some(p => p.tags && p.tags.length > 0) && (
                  <div className="mb-3 shrink-0">
                    <input
                      type="text"
                      placeholder="Filter by tag..."
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="w-full text-xs bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded px-2 py-1.5 text-[#F5F5F5] placeholder:text-[#666] focus:outline-none focus:border-white"
                    />
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto min-h-0 scroll-area" data-testid="personas-list">
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="personas">
                      {(provided) => (
                        <div 
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="space-y-2 pr-2"
                        >
                          {filteredPersonas.map((persona, index) => (
                            <Draggable key={persona.id} draggableId={persona.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`relative ${snapshot.isDragging ? 'opacity-50' : ''}`}
                                >
                                  <div 
                                    {...provided.dragHandleProps}
                                    className="absolute left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="w-4 h-4 text-[#666]" />
                                  </div>
                                  <PersonaCard
                                    persona={persona}
                                    isActive={activePersonas.includes(persona.id)}
                                    onClick={() => togglePersona(persona.id)}
                                    isSpeaking={false}
                                    showDelete={true}
                                    onDelete={deletePersona}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      <PersonaModal
        open={showPersonaModal}
        onClose={() => {
          setShowPersonaModal(false);
          setEditingPersona(null);
        }}
        onSubmit={(data) => {
          if (editingPersona) {
            editPersona(editingPersona.id, data);
          } else {
            addPersona(data);
          }
          setEditingPersona(null);
        }}
        editingPersona={editingPersona}
      />
      
      <AuthModal
        open={showAuthModal && !user}
        onClose={() => {}}
        onAuth={handleAuth}
      />

      {/* AUTORUN Modal */}
      {showAutorunModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowAutorunModal(false)}>
          <div className="bg-[#141414] border border-[rgba(255,255,255,0.15)] rounded-lg p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-display text-[#F5F5F5] mb-4">AUTORUN Mode</h2>
            <p className="text-[#A1A1A1] mb-6 font-light">
              Let the personas discuss autonomously. Select how long they should talk:
            </p>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[2, 5, 7, 10, 15, 20, 30, 60].map(mins => (
                <button
                  key={mins}
                  onClick={() => startAutorun(mins)}
                  className="p-4 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(34,197,94,0.1)] hover:border-[rgba(34,197,94,0.3)] transition-all text-[#F5F5F5] font-light"
                >
                  {mins}m
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAutorunModal(false)}
              className="w-full py-2 text-sm uppercase tracking-wider text-[#A1A1A1] hover:text-[#F5F5F5] font-light transition-colors border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
          <div className="bg-[#141414] border border-[rgba(255,255,255,0.15)] rounded-lg p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-display text-[#F5F5F5] mb-4">Export & Share</h2>
            <p className="text-[#A1A1A1] mb-6 font-light">
              Save or share this conversation
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { exportAsText(); setShowExportModal(false); }}
                className="w-full py-3 px-4 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition-all text-[#F5F5F5] font-light flex items-center gap-3"
              >
                <FileText className="w-5 h-5" />
                <span>Export as TXT</span>
              </button>
              <button
                onClick={() => { exportAsPDF(); setShowExportModal(false); }}
                className="w-full py-3 px-4 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition-all text-[#F5F5F5] font-light flex items-center gap-3"
              >
                <Download className="w-5 h-5" />
                <span>Export as PDF</span>
              </button>
              <button
                onClick={() => { shareConversation(); setShowExportModal(false); }}
                className="w-full py-3 px-4 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition-all text-[#F5F5F5] font-light flex items-center gap-3"
              >
                <Share2 className="w-5 h-5" />
                <span>Share Link</span>
              </button>
            </div>
            <button
              onClick={() => setShowExportModal(false)}
              className="w-full mt-4 py-2 text-sm uppercase tracking-wider text-[#A1A1A1] hover:text-[#F5F5F5] font-light transition-colors border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}