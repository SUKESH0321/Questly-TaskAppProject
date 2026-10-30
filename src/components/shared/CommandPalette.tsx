import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Bell,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTheme } from "@/lib/theme";

export const OPEN_PALETTE_EVENT = "questly:open-palette";

/** Ctrl/Cmd+K quick actions: jump anywhere, search tasks, switch theme, sign out. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { isDark, setPref } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    setQuery("");
    fn();
  };

  const itemClass =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer text-foreground aria-selected:bg-muted [&_svg]:text-muted-foreground aria-selected:[&_svg]:text-primary";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Quick actions"
      overlayClassName="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[14vh] z-[101] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift animate-pop-in"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search size={18} className="text-muted-foreground shrink-0" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search tasks or jump to…"
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden sm:block rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          esc
        </kbd>
      </div>
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          Nothing matches. Press Enter on "Search tasks" to look for it.
        </Command.Empty>

        {query.trim() && (
          <Command.Group heading="Search" className="px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
            <Command.Item
              value={`search tasks ${query}`}
              forceMount
              className={itemClass}
              onSelect={() => run(() => navigate(`/tasks?search=${encodeURIComponent(query.trim())}`))}
            >
              <Search size={17} />
              Search tasks for "{query.trim()}"
            </Command.Item>
          </Command.Group>
        )}

        <Command.Group heading="Go to" className="px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/home"))}>
            <Home size={17} /> Home
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/tasks"))}>
            <MapPin size={17} /> Browse tasks
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/tasks/create"))}>
            <Plus size={17} /> Post a task
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/messages"))}>
            <MessageSquare size={17} /> Messages
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/notifications"))}>
            <Bell size={17} /> Notifications
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/profile"))}>
            <User size={17} /> Profile
          </Command.Item>
          <Command.Item className={itemClass} onSelect={() => run(() => navigate("/settings"))}>
            <Settings size={17} /> Settings
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Actions" className="px-1 text-xs text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2">
          <Command.Item className={itemClass} onSelect={() => run(() => setPref(isDark ? "light" : "dark"))}>
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
            {isDark ? "Switch to light mode" : "Switch to dark mode"}
          </Command.Item>
          <Command.Item
            className={itemClass}
            onSelect={() =>
              run(() => {
                logout();
                navigate("/login", { replace: true });
              })
            }
          >
            <LogOut size={17} /> Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
