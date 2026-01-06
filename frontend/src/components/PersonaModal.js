import { useState, useEffect } from "react";
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

export default function PersonaModal({ open, onClose, onSubmit, editingPersona }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("historical");
  const [color, setColor] = useState("#A855F7"); // Default purple
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Update form when editing persona changes
  useEffect(() => {
    if (editingPersona) {
      setName(editingPersona.display_name || "");
      setType(editingPersona.type || "historical");
      setColor(editingPersona.color || "#A855F7");
      setAvatarPreview(editingPersona.avatar_url || editingPersona.avatar_base64 || null);
    } else {
      setName("");
      setType("historical");
      setColor("#A855F7");
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [editingPersona]);

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
            {editingPersona ? "Edit Persona" : "Summon a Persona"}
          </DialogTitle>
          <DialogDescription className="text-[#A1A1A1] font-light">
            {editingPersona ? "Update the persona's appearance and details." : "Enter a name. The archive will provide their essence."}
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
            <Label htmlFor="persona-color" className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
              Color
            </Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                id="persona-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 rounded border border-[rgba(255,255,255,0.15)] bg-transparent cursor-pointer"
                data-testid="persona-color-picker"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#A855F7"
                className="flex-1 bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="persona-avatar" className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
              Avatar (Optional)
            </Label>
            <div className="flex gap-3 items-center">
              {avatarPreview ? (
                <div className="relative">
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-16 h-16 rounded-full object-cover border border-[rgba(255,255,255,0.15)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-[rgba(255,255,255,0.15)] flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-[#A1A1A1]" />
                </div>
              )}
              <label htmlFor="avatar-upload" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition-all">
                  <Upload className="w-4 h-4 text-[#A1A1A1]" />
                  <span className="text-sm text-[#A1A1A1] font-light">
                    {avatarFile ? avatarFile.name : "Upload Image"}
                  </span>
                </div>
              </label>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                data-testid="persona-avatar-input"
              />
            </div>
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