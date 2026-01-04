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
      "rgba(184, 115, 51, 0.15)",
      "rgba(154, 154, 163, 0.15)",
      "rgba(197, 90, 74, 0.15)",
      "rgba(210, 140, 76, 0.15)",
    ];
    const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-lg border cursor-pointer
        transition-all duration-200
        ${isActive 
          ? "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)]" 
          : "bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.06)]"
        }
      `}
      data-testid={`persona-card-${persona.id}`}
    >
      <div className="p-4 flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-light border border-[rgba(255,255,255,0.1)]"
          style={{ background: getAvatarColor(persona.display_name) }}
        >
          <span className="text-[#EAE6DF] opacity-80">{getInitials(persona.display_name)}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-light text-sm tracking-wide truncate text-[#EAE6DF]" data-testid={`persona-name-${persona.id}`}>
            {persona.display_name}
          </h4>
          <p className="text-xs text-[#9A9AA3] truncate uppercase" style={{ letterSpacing: '0.05em' }} data-testid={`persona-role-${persona.id}`}>
            {persona.role_in_arena}
          </p>
        </div>
        
        {isActive && (
          <div className="persona-status-copper" data-testid={`persona-active-${persona.id}`} />
        )}
      </div>
    </motion.div>
  );
}