import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useAcademicYear, ACADEMIC_YEARS } from "@/lib/academic-year-context";
import { useTheme } from "@/lib/theme-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard,
  Users,
  IndianRupee,
  CalendarCheck,
  GraduationCap,
  BarChart3,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Sun,
  Moon,
  User,
  MessageCircle,
  UserCog,
  ScrollText,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Fees", url: "/fees", icon: IndianRupee, adminOnly: true },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Test Reports", url: "/tests", icon: ClipboardList },
  { title: "Teachers", url: "/teachers", icon: GraduationCap, adminOnly: true },
  { title: "WhatsApp", url: "/whatsapp-logs", icon: MessageCircle, adminOnly: true },
];

const settingsItems: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3, adminOnly: true },
  { title: "Users", url: "/users", icon: UserCog, adminOnly: true },
  { title: "Audit", url: "/audit", icon: ScrollText, adminOnly: true },
];

export function AdminTopNav() {
  const location = useLocation();
  const { logout, user, isAdmin } = useAuth();
  const visibleNavItems = navItems.filter((i) => !i.adminOnly || isAdmin);
  const { year, setYear } = useAcademicYear();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(url);
  };

  const isSettingsActive = settingsItems.some((i) => isActive(i.url));

  return (
    <>
      <nav className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between h-14 px-4 gap-2">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <GraduationCap className="h-6 w-6 text-secondary" />
            <span className="hidden sm:inline">Yashshree Classes</span>
          </Link>

          <div className="hidden xl:flex items-center gap-0.5 min-w-0 flex-1 justify-center">
            {visibleNavItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md transition-colors relative whitespace-nowrap ${
                  isActive(item.url)
                    ? "text-secondary"
                    : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
                {isActive(item.url) && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-secondary rounded-full" />
                )}
              </Link>
            ))}

            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium rounded-md transition-colors relative whitespace-nowrap ${
                      isSettingsActive
                        ? "text-secondary"
                        : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                    <ChevronDown className="h-3 w-3 opacity-70" />
                    {isSettingsActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-secondary rounded-full" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {settingsItems.map((item) => (
                    <DropdownMenuItem key={item.url} asChild className="cursor-pointer">
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4 mr-2" />
                        {item.title}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xl:block">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger
                  className="h-8 w-[110px] bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 text-xs font-medium focus:ring-1 focus:ring-secondary"
                  aria-label="Academic Year"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1.5"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline truncate max-w-[140px]">
                    {user?.email?.split("@")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden text-primary-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="xl:hidden border-t border-primary-foreground/10 pb-2 animate-fade-in">
            {visibleNavItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item.url)
                    ? "text-secondary bg-primary-foreground/5"
                    : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/5"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-primary-foreground/60 font-semibold">
                  Settings
                </div>
                {settingsItems.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive(item.url)
                        ? "text-secondary bg-primary-foreground/5"
                        : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/5"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </>
            )}

            <div className="px-4 py-2">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-8 w-full bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 text-xs font-medium" aria-label="Academic Year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </nav>
      <div className="h-0.5 bg-gradient-to-r from-secondary via-accent to-secondary" />
    </>
  );
}
