import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "./ui/avatar";

export default function PersonaCard({ persona, isActive, onClick, isSpeaking }) {
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
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl border cursor-pointer
        transition-all duration-300 group
        ${isActive 
          ? "bg-card/80 border-primary/50 shadow-lg glow-border" 
          : "bg-card/50 border-white/10 hover:bg-card/70 hover:border-white/20"
        }
        ${isSpeaking ? "persona-active" : ""}
      `}
      data-testid={`persona-card-${persona.id}`}
    >
      <div className="p-4 flex items-center gap-3">
        <Avatar className="w-12 h-12">
          <AvatarFallback className={`bg-gradient-to-br ${getAvatarColor(persona.display_name)} text-white font-bold`}>
            {getInitials(persona.display_name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-bold text-sm truncate" data-testid={`persona-name-${persona.id}`}>
            {persona.display_name}
          </h4>
          <p className="text-xs text-muted-foreground truncate" data-testid={`persona-role-${persona.id}`}>
            {persona.role_in_arena}
          </p>
        </div>
        
        {isSpeaking && (
          <div className="flex gap-1">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0 }}
              className="w-2 h-2 rounded-full bg-primary"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
              className="w-2 h-2 rounded-full bg-primary"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          </div>
        )}
        
        {isActive && !isSpeaking && (
          <div className="w-2 h-2 rounded-full bg-green-500" data-testid={`persona-active-${persona.id}`} />
        )}
      </div>
      
      {isActive && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent origin-left"
        />
      )}
    </motion.div>
  );
}