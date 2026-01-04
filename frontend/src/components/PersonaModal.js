import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export default function PersonaModal({ open, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("historical");
  const [role, setRole] = useState("participant");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSubmit({
      display_name: name,
      type,
      role_in_arena: role
    });
    
    setName("");
    setType("historical");
    setRole("participant");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] glass-panel border-white/20" data-testid="persona-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Summon a Persona
          </DialogTitle>
          <DialogDescription>
            Enter a name of a real or fictional character. The AI will automatically fill in their details.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="persona-name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="persona-name"
              placeholder="e.g., Socrates, Marie Curie, Gandalf..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10"
              data-testid="persona-name-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-type" className="text-sm font-medium">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-white/5 border-white/10" data-testid="persona-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="historical">Historical Figure</SelectItem>
                <SelectItem value="fictional">Fictional Character</SelectItem>
                <SelectItem value="archetype">Archetype</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-role" className="text-sm font-medium">
              Role in Arena
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-white/5 border-white/10" data-testid="persona-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leader">Leader</SelectItem>
                <SelectItem value="skeptic">Skeptic</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
                <SelectItem value="comedian">Comedian</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="wildcard">Wildcard</SelectItem>
                <SelectItem value="participant">Participant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="persona-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={!name.trim()}
              data-testid="persona-submit-button"
            >
              <Sparkles className="w-4 h-4" />
              Summon
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}