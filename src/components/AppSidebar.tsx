import {
  LayoutDashboard,
  Users,
  IndianRupee,
  CalendarCheck,
  GraduationCap,
  BarChart3,
  MessageCircle,
  LogOut,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Fees", url: "/fees", icon: IndianRupee },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Teachers", url: "/teachers", icon: GraduationCap },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "WhatsApp Logs", url: "/whatsapp-logs", icon: MessageCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { logout } = useAuth();

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-bold tracking-tight">
            {!collapsed && "Yashshree Classes"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
