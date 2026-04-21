import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useAcademicYear, ACADEMIC_YEARS } from "@/lib/academic-year-context";
import { useTheme } from "@/lib/theme-context";
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
  { title: "Reports", url: "/reports", icon: BarChart3, adminOnly: true },
  { title: "WhatsApp", url: "/whatsapp-logs", icon: MessageCircle, adminOnly: true },
  { title: "Users", url: "/users", icon: UserCog, adminOnly: true },
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

  return (
    <>
      <nav className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <GraduationCap className="h-6 w-6 text-secondary" />
            <span className="hidden sm:inline">Yashshree Classes</span>
          </Link>

          <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
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
          </div>

          <div className="flex items-center gap-2">
            {/* Year dropdown lives in topbar from lg+ to avoid duplication with mobile menu */}
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="hidden lg:block bg-primary-foreground/10 text-primary-foreground text-xs font-medium rounded-md px-2 py-1.5 border border-primary-foreground/20 focus:outline-none focus:ring-1 focus:ring-secondary"
              title="Academic Year"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y} className="bg-primary text-primary-foreground">{y}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={toggleTheme}
              title="Toggle theme"
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
              className="lg:hidden text-primary-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-primary-foreground/10 pb-2 animate-fade-in">
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
            <div className="px-4 py-2">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-primary-foreground/10 text-primary-foreground text-xs font-medium rounded-md px-2 py-1.5 border border-primary-foreground/20"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-primary text-primary-foreground">{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </nav>
      <div className="h-0.5 bg-gradient-to-r from-secondary via-accent to-secondary" />
    </>
  );
}
