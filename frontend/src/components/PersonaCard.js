import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";

export default function PersonaCard({ persona, isActive, onClick, isSpeaking, onDelete, showDelete }) {
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        relative overflow-hidden rounded-lg border cursor-pointer group
        transition-all duration-200
        ${isActive 
          ? "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)]" 
          : "bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.08)]"
        }
      `}
      data-testid={`persona-card-${persona.id}`}
    >
      <div className="p-4 flex items-center gap-3" onClick={onClick}>
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-light border border-[rgba(255,255,255,0.15)] overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
        >
          {persona.avatar_url || persona.avatar_base64 ? (
            <img 
              src={persona.avatar_url || persona.avatar_base64} 
              alt={persona.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[#F5F5F5] opacity-80">{getInitials(persona.display_name)}</span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-light text-sm tracking-wide truncate text-[#F5F5F5]" data-testid={`persona-name-${persona.id}`}>
            {persona.display_name}
          </h4>
          <p className="text-xs text-[#A1A1A1] truncate uppercase" style={{ letterSpacing: '0.05em' }} data-testid={`persona-role-${persona.id}`}>
            {persona.role_in_arena}
          </p>
        </div>
        
        {isActive && (
          <div className="persona-status-active" data-testid={`persona-active-${persona.id}`} />
        )}
      </div>
      
      {showDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(persona.id);
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-[rgba(0,0,0,0.8)] hover:bg-[rgba(220,38,38,0.2)] border border-[rgba(220,38,38,0.3)]"
          data-testid={`delete-persona-${persona.id}`}
        >
          <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
        </button>
      )}
    </motion.div>
  );
}