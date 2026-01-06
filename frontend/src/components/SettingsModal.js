import { useState, useEffect } from "react";
import { Volume2, VolumeX, Sparkles, Save } from "lucide-react";
import { Button } from "./ui/button";
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

export default function SettingsModal({ open, onClose, onSaveSettings }) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [defaultMode, setDefaultMode] = useState("Creativity Collaboration");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('collabor8_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setAudioEnabled(settings.audioEnabled ?? true);
      setAutoPlayAudio(settings.autoPlayAudio ?? false);
      setDefaultMode(settings.defaultMode || "Creativity Collaboration");
      setAutoScroll(settings.autoScroll ?? true);
    }
  }, [open]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const settings = {
      audioEnabled,
      autoPlayAudio,
      defaultMode,
      autoScroll
    };

    // Save to localStorage
    localStorage.setItem('collabor8_settings', JSON.stringify(settings));

    // Notify parent component
    if (onSaveSettings) {
      await onSaveSettings(settings);
    }

    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal text-[#F5F5F5]">
            Settings
          </DialogTitle>
          <DialogDescription className="text-[#A1A1A1] font-light">
            Customize your Collabor8 experience
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-6 mt-6">
          {/* Audio Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Audio Settings
            </h3>

            <div className="flex items-center justify-between p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)]">
              <div>
                <Label className="text-sm text-[#F5F5F5]">Enable Audio</Label>
                <p className="text-xs text-[#A1A1A1] font-light">Play text-to-speech for persona messages</p>
              </div>
              <button
                type="button"
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  audioEnabled ? 'bg-[#4ADE80]' : 'bg-[rgba(255,255,255,0.1)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    audioEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)]">
              <div>
                <Label className="text-sm text-[#F5F5F5]">Auto-Play Messages</Label>
                <p className="text-xs text-[#A1A1A1] font-light">Automatically play audio for new messages</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPlayAudio(!autoPlayAudio)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoPlayAudio ? 'bg-[#4ADE80]' : 'bg-[rgba(255,255,255,0.1)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoPlayAudio ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Conversation Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Conversation Settings
            </h3>

            <div className="space-y-2">
              <Label className="text-sm font-light text-[#F5F5F5]">Default Conversation Mode</Label>
              <Select value={defaultMode} onValueChange={setDefaultMode}>
                <SelectTrigger className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[rgba(255,255,255,0.08)]">
                  <SelectItem value="Creativity Collaboration" className="text-[#F5F5F5] font-light">
                    Creativity Collaboration
                  </SelectItem>
                  <SelectItem value="Shoot-the-Shit" className="text-[#F5F5F5] font-light">
                    Shoot-the-Shit
                  </SelectItem>
                  <SelectItem value="Unhinged" className="text-[#F5F5F5] font-light">
                    Unhinged
                  </SelectItem>
                  <SelectItem value="Socratic Debate" className="text-[#F5F5F5] font-light">
                    Socratic Debate
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#666] font-light">The mode that new conversations start with</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)]">
              <div>
                <Label className="text-sm text-[#F5F5F5]">Auto-Scroll Chat</Label>
                <p className="text-xs text-[#A1A1A1] font-light">Automatically scroll to new messages</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoScroll ? 'bg-[#4ADE80]' : 'bg-[rgba(255,255,255,0.1)]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoScroll ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* App Info */}
          <div className="pt-4 border-t border-[rgba(255,255,255,0.08)]">
            <div className="text-center space-y-1">
              <p className="text-xs text-[#666] font-light">Collabor8 Persona Arena</p>
              <p className="text-xs text-[#666] font-light">Version 1.0.0</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] text-[#A1A1A1] hover:bg-[rgba(255,255,255,0.04)]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(255,255,255,0.12)]"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
