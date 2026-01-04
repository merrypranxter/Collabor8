import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "./ui/avatar";

export default function TranscriptBubble({ message, index }) {
  const getInitials = (name) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = [
      "from-purple-500 to-pink-500",
      "from-blue-500 to-cyan-500",
      "from-green-500 to-emerald-500",
      "from-orange-500 to-red-500",
      "from-indigo-500 to-purple-500",
      "from-yellow-500 to-orange-500",
      "from-pink-500 to-rose-500"
    ];
    const colorIndex = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[colorIndex % colors.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        flex gap-4 p-6 rounded-2xl border message-bubble
        ${message.is_user 
          ? "bg-purple-900/20 border-purple-500/20 ml-12" 
          : "bg-white/5 border-white/5"
        }
      `}
      data-testid={`message-${message.id}`}
    >
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(message.persona_name)} text-white text-sm font-bold`}>
          {getInitials(message.persona_name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-base mb-2" data-testid={`message-persona-${message.id}`}>
          {message.persona_name}
        </div>
        <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
          {message.content}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}