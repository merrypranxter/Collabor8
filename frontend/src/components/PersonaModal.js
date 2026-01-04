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
      <DialogContent className="sm:max-w-[500px] bg-[#0D1020] border border-[rgba(255,255,255,0.06)]" data-testid="persona-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal text-[#EAE6DF]">
            Summon a Persona
          </DialogTitle>
          <DialogDescription className="text-[#9A9AA3] font-light">
            Enter a name. The archive will provide their essence.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="persona-name" className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">
              Name
            </Label>
            <Input
              id="persona-name"
              placeholder="Socrates, Marie Curie, Gandalf..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light focus:border-[#B87333]"
              data-testid="persona-name-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-type" className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light" data-testid="persona-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1020] border-[rgba(255,255,255,0.06)]">
                <SelectItem value="historical" className="text-[#EAE6DF] font-light">Historical Figure</SelectItem>
                <SelectItem value="fictional" className="text-[#EAE6DF] font-light">Fictional Character</SelectItem>
                <SelectItem value="archetype" className="text-[#EAE6DF] font-light">Archetype</SelectItem>
                <SelectItem value="custom" className="text-[#EAE6DF] font-light">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-role" className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light" data-testid="persona-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1020] border-[rgba(255,255,255,0.06)]">
                <SelectItem value="leader" className="text-[#EAE6DF] font-light">Leader</SelectItem>
                <SelectItem value="skeptic" className="text-[#EAE6DF] font-light">Skeptic</SelectItem>
                <SelectItem value="builder" className="text-[#EAE6DF] font-light">Builder</SelectItem>
                <SelectItem value="comedian" className="text-[#EAE6DF] font-light">Comedian</SelectItem>
                <SelectItem value="moderator" className="text-[#EAE6DF] font-light">Moderator</SelectItem>
                <SelectItem value="wildcard" className="text-[#EAE6DF] font-light">Wildcard</SelectItem>
                <SelectItem value="participant" className="text-[#EAE6DF] font-light">Participant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm uppercase tracking-wider text-[#9A9AA3] hover:text-[#EAE6DF] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
              data-testid="persona-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2 text-sm uppercase tracking-wider text-[#B87333] hover:text-[#D28C4C] font-light transition-colors duration-200 border border-[rgba(184,115,51,0.2)] rounded-lg hover:bg-[rgba(184,115,51,0.05)] disabled:opacity-30 disabled:cursor-not-allowed"
              data-testid="persona-submit-button"
            >
              Summon
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}