import { motion } from "framer-motion";
import { Button } from "./ui/button";

export default function ModeSelector({ modes, currentMode, onModeChange }) {
  return (
    <div className="flex flex-col gap-0" data-testid="mode-selector">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`
              w-full text-left py-3 px-4 text-sm font-light tracking-wide
              transition-all duration-200 border-l-2
              ${isActive 
                ? "border-[#B87333] bg-[rgba(184,115,51,0.06)] text-[#EAE6DF]" 
                : "border-transparent text-[#9A9AA3] hover:text-[#EAE6DF] hover:bg-[rgba(255,255,255,0.02)]"
              }
            `}
            data-testid={`mode-button-${mode.id}`}
          >
            <div className="flex items-center gap-3">
              {typeof Icon === "string" ? (
                <span className="text-base opacity-60">{Icon}</span>
              ) : (
                <Icon className="w-4 h-4 opacity-60" />
              )}
              <span className="uppercase text-xs" style={{ letterSpacing: '0.05em' }}>{mode.name}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}