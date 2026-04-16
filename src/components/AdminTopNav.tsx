import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  GraduationCap,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Students & Fees", url: "/students-fees", icon: Users },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Teachers", url: "/teachers", icon: GraduationCap },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const ACADEMIC_YEARS = ["2026-27", "2025-26", "2024-25"];

export function AdminTopNav() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [academicYear, setAcademicYear] = useState("2026-27");

  const isActive = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(url);
  };

  return (
    <>
      <nav className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <GraduationCap className="h-6 w-6 text-secondary" />
            <span className="hidden sm:inline">Yashshree Classes</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors relative ${
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

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Academic Year dropdown */}
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="hidden sm:block bg-primary-foreground/10 text-primary-foreground text-xs font-medium rounded-md px-2 py-1.5 border border-primary-foreground/20 focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y} className="bg-primary text-primary-foreground">{y}</option>
              ))}
            </select>
            <span className="hidden lg:inline text-xs text-primary-foreground/60 truncate max-w-[160px]">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Logout</span>
            </Button>

            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-primary-foreground/10 pb-2 animate-fade-in">
            {navItems.map((item) => (
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
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
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
      {/* Brand accent line */}
      <div className="h-0.5 bg-gradient-to-r from-secondary via-accent to-secondary" />
    </>
  );
}
