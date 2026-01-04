import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

export default function ConversationsMenu({ 
  conversations, 
  currentConversationId, 
  onSelectConversation, 
  onDeleteConversation,
  onNewConversation 
}) {
  const [deleteId, setDeleteId] = useState(null);
  const [open, setOpen] = useState(false);

  const handleDelete = async (id) => {
    await onDeleteConversation(id);
    setDeleteId(null);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] px-4 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
            data-testid="conversations-menu-button"
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            History
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 bg-[#141414] border-r border-[rgba(255,255,255,0.08)]" data-testid="conversations-sheet">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl font-normal text-[#F5F5F5]">Conversations</SheetTitle>
            <SheetDescription className="text-[#A1A1A1] font-light">
              Your saved symposiums
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => {
                onNewConversation();
                setOpen(false);
              }}
              className="w-full py-3 text-sm uppercase tracking-wider text-white hover:text-[#E5E5E5] font-light transition-colors duration-200 border border-[rgba(255,255,255,0.15)] rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
              data-testid="new-conversation-button"
            >
              + New Symposium
            </button>
            
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-250px)] scroll-area">
              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-[#A1A1A1] font-light text-sm">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`
                        relative group rounded-lg border p-3 cursor-pointer
                        transition-all duration-200
                        ${currentConversationId === conv.id
                          ? "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)]"
                          : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)]"
                        }
                      `}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setOpen(false);
                      }}
                      data-testid={`conversation-item-${conv.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-light text-sm truncate text-[#F5F5F5]" data-testid={`conversation-title-${conv.id}`}>
                            {conv.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[#A1A1A1] font-light uppercase" style={{ letterSpacing: '0.05em' }}>
                              {conv.mode}
                            </span>
                            <span className="text-xs text-[#A1A1A1]">
                              •
                            </span>
                            <span className="text-xs text-[#A1A1A1] font-light">
                              {formatDate(conv.updated_at)}
                            </span>
                          </div>
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 text-[#DC2626] hover:text-[#EF4444] transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(conv.id);
                          }}
                          data-testid={`delete-conversation-${conv.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#141414] border border-[rgba(255,255,255,0.08)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#F5F5F5] font-display font-normal">Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A1A1A1] font-light">
              This action cannot be undone. The conversation will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#F5F5F5] hover:bg-[rgba(255,255,255,0.04)]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteId)}
              className="bg-[rgba(220,38,38,0.15)] border border-[rgba(220,38,38,0.3)] text-[#DC2626] hover:bg-[rgba(220,38,38,0.25)]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}