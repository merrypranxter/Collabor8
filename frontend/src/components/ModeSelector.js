import { motion } from "framer-motion";
import { Button } from "./ui/button";

export default function ModeSelector({ modes, currentMode, onModeChange }) {
  return (
    <div className="flex flex-col gap-2" data-testid="mode-selector">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        
        return (
          <motion.div key={mode.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={isActive ? "default" : "ghost"}
              className={`
                w-full justify-start gap-3 h-12 text-left font-medium
                ${isActive 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "hover:bg-white/5"
                }
              `}
              onClick={() => onModeChange(mode.id)}
              data-testid={`mode-button-${mode.id}`}
            >
              {typeof Icon === "string" ? (
                <span className="text-xl">{Icon}</span>
              ) : (
                <Icon className="w-5 h-5" />
              )}
              <span>{mode.name}</span>
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}