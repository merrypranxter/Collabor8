import { useState } from "react";
import { motion } from "framer-motion";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export default function AuthModal({ open, onClose, onAuth }) {
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      await onAuth("login", { username: loginUsername, password: loginPassword });
      onClose();
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = err.response?.data?.detail || err.message || "Login failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      await onAuth("register", { 
        username: registerUsername, 
        password: registerPassword,
        display_name: registerDisplayName 
      });
      onClose();
    } catch (err) {
      console.error("Register error:", err);
      const errorMessage = err.response?.data?.detail || err.message || "Registration failed. Username may already exist.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    try {
      await onAuth("guest", { display_name: guestName || "Guest" });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to continue as guest");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#141414] border border-[rgba(255,255,255,0.08)]" data-testid="auth-modal">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal text-[#F5F5F5] mb-2">
            Join the Symposium
          </DialogTitle>
          <DialogDescription className="text-[#A1A1A1] font-light">
            Sign in to save your conversations across time
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="guest" className="mt-4">
          <TabsList className="grid w-full grid-cols-3 bg-[rgba(255,255,255,0.02)]">
            <TabsTrigger value="guest" className="text-[#A1A1A1] data-[state=active]:text-white data-[state=active]:bg-[rgba(255,255,255,0.08)]">Guest</TabsTrigger>
            <TabsTrigger value="login" className="text-[#A1A1A1] data-[state=active]:text-white data-[state=active]:bg-[rgba(255,255,255,0.08)]">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="text-[#A1A1A1] data-[state=active]:text-white data-[state=active]:bg-[rgba(255,255,255,0.08)]">Register</TabsTrigger>
          </TabsList>
          
          <TabsContent value="guest" className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">Display Name (Optional)</Label>
              <Input
                placeholder="How shall we address you?"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
              />
            </div>
            <Button
              onClick={handleGuest}
              disabled={isLoading}
              className="w-full py-3 text-sm uppercase tracking-wider bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] text-white hover:bg-[rgba(255,255,255,0.12)] font-light"
            >
              {isLoading ? "Entering..." : "Continue as Guest"}
            </Button>
            <p className="text-xs text-[#A1A1A1] text-center font-light">Guest conversations are not saved</p>
          </TabsContent>
          
          <TabsContent value="login" className="space-y-4 mt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">Username</Label>
                <Input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light focus:border-[#B87333]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">Password</Label>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light focus:border-[#B87333]"
                  required
                />
              </div>
              {error && <p className="text-[#C55A4A] text-sm font-light">{error}</p>}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 text-sm uppercase tracking-wider bg-[rgba(184,115,51,0.08)] border border-[rgba(184,115,51,0.2)] text-[#B87333] hover:bg-[rgba(184,115,51,0.12)] font-light"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="register" className="space-y-4 mt-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">Username</Label>
                <Input
                  type="text"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light focus:border-[#B87333]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">Display Name</Label>
                <Input
                  type="text"
                  value={registerDisplayName}
                  onChange={(e) => setRegisterDisplayName(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light focus:border-[#B87333]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#EAE6DF] uppercase tracking-wider">Password</Label>
                <Input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] text-[#EAE6DF] font-light focus:border-[#B87333]"
                  required
                />
              </div>
              {error && <p className="text-[#C55A4A] text-sm font-light">{error}</p>}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 text-sm uppercase tracking-wider bg-[rgba(184,115,51,0.08)] border border-[rgba(184,115,51,0.2)] text-[#B87333] hover:bg-[rgba(184,115,51,0.12)] font-light"
              >
                {isLoading ? "Creating..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}