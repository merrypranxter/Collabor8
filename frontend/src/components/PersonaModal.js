import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Upload, Image as ImageIcon } from "lucide-react";
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
  const [color, setColor] = useState("#A855F7"); // Default purple
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onSubmit({
      display_name: name,
      type,
      color: color,
      avatar_base64: avatarPreview
    });
    
    setName("");
    setType("historical");
    setColor("#A855F7");
    setAvatarFile(null);
    setAvatarPreview(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#141414] border border-[rgba(255,255,255,0.08)]" data-testid="persona-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal text-[#F5F5F5]">
            Summon a Persona
          </DialogTitle>
          <DialogDescription className="text-[#A1A1A1] font-light">
            Enter a name. The archive will provide their essence.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="persona-name" className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
              Name
            </Label>
            <Input
              id="persona-name"
              placeholder="Socrates, Marie Curie, Gandalf..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
              data-testid="persona-name-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-type" className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
              Type
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light" data-testid="persona-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[rgba(255,255,255,0.08)]">
                <SelectItem value="historical" className="text-[#F5F5F5] font-light">Historical Figure</SelectItem>
                <SelectItem value="fictional" className="text-[#F5F5F5] font-light">Fictional Character</SelectItem>
                <SelectItem value="archetype" className="text-[#F5F5F5] font-light">Archetype</SelectItem>
                <SelectItem value="custom" className="text-[#F5F5F5] font-light">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="persona-role" className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light" data-testid="persona-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[rgba(255,255,255,0.08)]">
                <SelectItem value="leader" className="text-[#F5F5F5] font-light">Leader</SelectItem>
                <SelectItem value="skeptic" className="text-[#F5F5F5] font-light">Skeptic</SelectItem>
                <SelectItem value="builder" className="text-[#F5F5F5] font-light">Builder</SelectItem>
                <SelectItem value="comedian" className="text-[#F5F5F5] font-light">Comedian</SelectItem>
                <SelectItem value="moderator" className="text-[#F5F5F5] font-light">Moderator</SelectItem>
                <SelectItem value="wildcard" className="text-[#F5F5F5] font-light">Wildcard</SelectItem>
                <SelectItem value="participant" className="text-[#F5F5F5] font-light">Participant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm uppercase tracking-wider text-[#A1A1A1] hover:text-[#F5F5F5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
              data-testid="persona-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 py-2 text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] rounded-lg hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-30 disabled:cursor-not-allowed"
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