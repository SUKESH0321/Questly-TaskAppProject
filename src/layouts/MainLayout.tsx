import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Bell, User, Home, MapPin, MessageSquare, Plus, Settings, Command, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Logo } from "@/components/shared/Logo";
import { CommandPalette, OPEN_PALETTE_EVENT } from "@/components/shared/CommandPalette";
import { QuestMapBackground } from "@/components/shared/QuestMapBackground";
import { useAuthStore } from "@/stores/authStore";
import api from "@/lib/api";

const mainNav = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/tasks", label: "Tasks", icon: MapPin },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/settings", label: "Settings", icon: Settings },
];

// Mobile tab bar: four tabs around a raised "post" button.
const tabsLeft = mainNav.slice(0, 2);
const tabsRight = [mainNav[2], mainNav[4]];

const UNREAD_POLL_MS = 60_000;
const SIDEBAR_KEY = "questly_sidebar_open";

function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "0";
  } catch {
    return true;
  }
}

function initialsOf(name?: string) {
  return (
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

export default function MainLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);
  // Desktop sidebar slides in and out; the choice is remembered on this device.
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const toggleSidebar = () =>
    setSidebarOpen((open) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, open ? "0" : "1");
      } catch {
        // storage unavailable: the toggle still works for this visit
      }
      return !open;
    });

  const isActive = (path: string) => location.pathname.startsWith(path);
  const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

  // Unread notification count: on navigation, on a timer, and when the
  // notifications page changes read state.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get("/notifications/unread-count")
        .then((res) => {
          if (!cancelled) setUnread(Number(res.data?.count) || 0);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, UNREAD_POLL_MS);
    window.addEventListener("questly:notifications-changed", load);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("questly:notifications-changed", load);
    };
  }, [location.pathname]);

  const roleLabel =
    user?.role === "both" ? "Customer & Tasker" : user?.role === "tasker" ? "Tasker" : "Customer";

  const MobileTab = ({ item }: { item: (typeof mainNav)[number] }) => {
    const active = isActive(item.path);
    return (
      <NavLink
        to={item.path}
        aria-label={item.label}
        className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold"
      >
        {active && (
          <motion.span
            layoutId="tab-pill"
            className="absolute inset-x-2 top-0 h-full rounded-2xl bg-primary/10"
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          />
        )}
        <span className={`relative flex flex-col items-center gap-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}>
          <item.icon size={21} strokeWidth={active ? 2.4 : 2} />
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <div className="relative min-h-screen md:flex">
      <QuestMapBackground />
      <CommandPalette />

      {/* Desktop sidebar */}
      <aside
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`relative z-10 hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-out md:sticky md:top-0 md:block md:h-screen ${sidebarOpen ? "w-[268px]" : "w-0"}`}
      >
        <div className="flex h-full w-[268px] flex-col border-r border-border bg-card/60 px-4 py-6 backdrop-blur">
        <Link to="/home" className="px-2 mb-8">
          <Logo />
        </Link>

        <Button asChild className="mb-6 w-full" size="lg">
          <Link to="/tasks/create">
            <Plus size={18} /> Post a task
          </Link>
        </Button>

        <nav className="flex-1 space-y-1" aria-label="Main">
          {mainNav.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <item.icon size={20} className="relative" />
                <span className="relative">{item.label}</span>
                {item.path === "/notifications" && unread > 0 && (
                  <span className="relative ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft">
          <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{initialsOf(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </Link>
          <ThemeToggle />
        </div>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col pb-28 md:pb-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <Link to="/home" className="md:hidden">
            <Logo />
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="hidden shrink-0 md:inline-flex"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </Button>
          {!sidebarOpen && (
            <Link to="/home" className="hidden shrink-0 md:block" aria-label="Questly home">
              <Logo showWord={false} />
            </Link>
          )}

          <button
            type="button"
            onClick={openPalette}
            className="hidden md:flex h-11 w-full max-w-xl flex-1 items-center gap-3 rounded-xl border border-input bg-card px-3.5 text-sm text-muted-foreground transition-colors hover:border-foreground/25"
          >
            <Search size={17} />
            <span className="flex-1 text-left">Search tasks or jump to…</span>
            <kbd className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px]">
              <Command size={11} /> K
            </kbd>
          </button>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={openPalette}>
              <Search size={20} />
            </Button>
            <ThemeToggle className="md:hidden" />
            <Link
              to="/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link to="/profile" aria-label="Your profile" className="md:hidden">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initialsOf(user?.name)}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
          </div>
        </header>

        <main className="flex-1">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Mobile floating tab bar */}
      <nav
        aria-label="Main"
        className="md:hidden fixed inset-x-3 bottom-3 z-40 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative flex items-center rounded-3xl border border-border bg-card/95 px-2 py-1.5 shadow-lift backdrop-blur-xl">
          {tabsLeft.map((item) => (
            <MobileTab key={item.path} item={item} />
          ))}
          <div className="flex w-16 shrink-0 justify-center">
            <Link
              to="/tasks/create"
              aria-label="Post a task"
              className="-mt-9 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow ring-4 ring-background transition-transform active:scale-90"
            >
              <Plus size={26} strokeWidth={2.6} />
            </Link>
          </div>
          {tabsRight.map((item) => (
            <MobileTab key={item.path} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}
