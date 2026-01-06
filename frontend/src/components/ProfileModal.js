import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Upload, Lock, Save, X } from "lucide-react";
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

export default function ProfileModal({ open, onClose, user, onUpdateProfile }) {
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setAvatarPreview(user.avatar_base64 || null);
    }
  }, [user]);

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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await onUpdateProfile({
        display_name: displayName,
        avatar_base64: avatarPreview
      });
      
      onClose();
    } catch (err) {
      console.error("Profile update error:", err);
      setError(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      await onUpdateProfile({
        current_password: currentPassword,
        new_password: newPassword
      });
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      onClose();
    } catch (err) {
      console.error("Password change error:", err);
      setError(err.response?.data?.detail || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || user.is_guest) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal text-[#F5F5F5]">
              Profile Settings
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <User className="w-16 h-16 mx-auto mb-4 text-[#666]" />
            <p className="text-[#A1A1A1] mb-4">Guest users cannot edit profiles.</p>
            <p className="text-sm text-[#666]">Register an account to customize your profile.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal text-[#F5F5F5]">
            Profile Settings
          </DialogTitle>
          <DialogDescription className="text-[#A1A1A1] font-light">
            Manage your account and preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-[rgba(255,255,255,0.02)]">
            <TabsTrigger value="profile" className="text-[#A1A1A1] data-[state=active]:text-white data-[state=active]:bg-[rgba(255,255,255,0.08)]">
              Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="text-[#A1A1A1] data-[state=active]:text-white data-[state=active]:bg-[rgba(255,255,255,0.08)]">
              Password
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-6">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
                  Username
                </Label>
                <Input
                  value={user.username}
                  disabled
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#666] font-light"
                />
                <p className="text-xs text-[#666]">Username cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
                  Display Name
                </Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we address you?"
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
                  Profile Avatar
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
                      <User className="w-6 h-6 text-[#A1A1A1]" />
                    </div>
                  )}
                  <label htmlFor="profile-avatar-upload" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition-all">
                      <Upload className="w-4 h-4 text-[#A1A1A1]" />
                      <span className="text-sm text-[#A1A1A1] font-light">
                        {avatarFile ? avatarFile.name : "Upload Avatar"}
                      </span>
                    </div>
                  </label>
                  <input
                    type="file"
                    id="profile-avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {error && <p className="text-[#EF4444] text-sm">{error}</p>}

              <div className="flex gap-3 pt-4">
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
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="password" className="space-y-4 mt-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
                  Current Password
                </Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
                  New Password
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-light text-[#F5F5F5] uppercase tracking-wider">
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] font-light focus:border-white"
                  required
                />
              </div>

              {error && <p className="text-[#EF4444] text-sm">{error}</p>}

              <div className="flex gap-3 pt-4">
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
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
