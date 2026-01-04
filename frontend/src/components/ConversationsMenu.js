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
            className="text-sm uppercase tracking-wider text-[#B87333] hover:text-[#D28C4C] font-light transition-colors duration-200 border border-[rgba(184,115,51,0.2)] px-4 py-2 rounded-lg hover:bg-[rgba(184,115,51,0.05)]"
            data-testid="conversations-menu-button"
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            History
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 bg-[#0D1020] border-r border-[rgba(255,255,255,0.06)]" data-testid="conversations-sheet">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl font-normal text-[#EAE6DF]">Conversations</SheetTitle>
            <SheetDescription className="text-[#9A9AA3] font-light">
              Your saved symposiums
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 flex flex-col gap-3">
            <Button
              onClick={() => {
                onNewConversation();
                setOpen(false);
              }}
              className="w-full gap-2"
              data-testid="new-conversation-button"
            >
              <MessageSquare className="w-4 h-4" />
              New Conversation
            </Button>
            
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-250px)]">
              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No saved conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`
                        relative group rounded-lg border p-3 cursor-pointer
                        transition-all duration-200
                        ${currentConversationId === conv.id
                          ? "bg-primary/20 border-primary/50"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
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
                          <h4 className="font-medium text-sm truncate" data-testid={`conversation-title-${conv.id}`}>
                            {conv.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {conv.mode}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              •
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(conv.updated_at)}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(conv.id);
                          }}
                          data-testid={`delete-conversation-${conv.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
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
        <AlertDialogContent className="glass-panel border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The conversation and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}