"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ShoppingCart,
  Grape,
  Beaker,
  Wine,
  Package,
  FileText,
  BookOpen,
  Settings,
  Menu,
  X,
  Building2,
  User,
  LogOut,
  ChevronDown,
  Users,
  Activity,
  Apple,
  History,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SessionIndicator } from "@/components/auth/session-indicator";

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = useMemo(() => [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: BarChart3,
      description: "Overview & Analytics",
    },
    {
      name: "Vendors",
      href: "/vendors",
      icon: Building2,
      description: "Vendor Database",
    },
    {
      name: "Inventory",
      href: "/inventory",
      icon: ShoppingCart,
      description: "Vendor & Orders",
    },
    {
      name: "Pressing",
      href: "/pressing",
      icon: Grape,
      description: "Base Fruit Processing",
    },
    {
      name: "Cellar",
      href: "/cellar",
      icon: Beaker,
      description: "Fermentation & Aging",
    },
    {
      name: "Distillation",
      href: "/distillation",
      icon: Wine,
      description: "Brandy & Pommeau",
    },
    {
      name: "Packaging",
      href: "/packaging",
      icon: Package,
      description: "Bottles & Kegs",
    },
    {
      name: "Reports",
      href: "/reports",
      icon: FileText,
      description: "COGS & Analytics",
    },
    {
      name: "Activity",
      href: "/activity-register",
      icon: Activity,
      description: "Activity Register",
    },
    {
      name: "Audit",
      href: "/audit-trail",
      icon: History,
      description: "Audit Trail",
    },
    {
      name: "Recipes",
      href: "/recipes",
      icon: BookOpen,
      description: "Recipe Management",
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Settings,
      description: "System Settings",
    },
  ], []);

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      admin: "destructive",
      operator: "default",
      viewer: "secondary",
    };
    return variants[role] || "default";
  };

  return (
    <nav className="bg-card/95 backdrop-blur-sm border-b border-border/60 sticky top-0 z-50 shadow-craft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary to-accent shadow-warm transition-transform group-hover:scale-105">
                <Apple className="w-5 h-5 text-primary-foreground" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-display font-bold text-foreground group-hover:text-primary transition-colors">
                  CideryCraft
                </h1>
                <p className="text-2xs font-medium text-muted-foreground -mt-0.5 tracking-wide uppercase">
                  Management System
                </p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {/* Background hover/active state */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-primary/8"
                        : "bg-transparent group-hover:bg-muted/60",
                    )}
                  />

                  {/* Icon */}
                  <Icon
                    className={cn(
                      "relative w-5 h-5 mb-0.5 transition-all duration-200",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground group-hover:scale-110",
                    )}
                  />

                  {/* Label */}
                  <span className="relative font-semibold">{item.name}</span>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="w-px h-8 bg-border/60 mx-3" />

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <SessionIndicator />
              {session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted/60 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <span className="max-w-[100px] truncate hidden xl:inline">
                        {session.user?.name || session.user?.email?.split("@")[0]}
                      </span>
                      <Badge
                        variant={getRoleBadgeVariant(session.user?.role || "viewer")}
                        className="text-2xs px-1.5 py-0"
                      >
                        {session.user?.role}
                      </Badge>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 shadow-craft-md">
                    <DropdownMenuLabel>
                      <div>
                        <p className="font-semibold text-foreground">{session.user?.name}</p>
                        <p className="text-xs text-muted-foreground font-normal">{session.user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center cursor-pointer">
                        <User className="w-4 h-4 mr-2 text-muted-foreground" />
                        Profile Settings
                      </Link>
                    </DropdownMenuItem>
                    {session.user?.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center cursor-pointer">
                          <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                          Manage Users
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href="/auth/signin"
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-border/60 bg-card animate-fade-in">
            <div className="px-2 pt-3 pb-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center mr-3",
                        isActive ? "bg-primary/15" : "bg-muted/50",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-8 bg-primary rounded-full" />
                    )}
                  </Link>
                );
              })}

              {/* Mobile User Menu */}
              <div className="border-t border-border/60 pt-4 mt-4">
                {session ? (
                  <>
                    <div className="px-3 py-3 mb-2 bg-muted/30 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {session.user?.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {session.user?.email}
                          </p>
                        </div>
                        <Badge
                          variant={getRoleBadgeVariant(session.user?.role || "viewer")}
                          className="text-xs"
                        >
                          {session.user?.role}
                        </Badge>
                      </div>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mr-3 bg-muted/50">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold">Profile</div>
                        <div className="text-xs text-muted-foreground">Manage your account</div>
                      </div>
                    </Link>
                    {session.user?.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mr-3 bg-muted/50">
                          <Users className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold">Manage Users</div>
                          <div className="text-xs text-muted-foreground">Admin only</div>
                        </div>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        signOut({ callbackUrl: "/auth/signin" });
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center w-full px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mr-3 bg-destructive/10">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Sign Out</div>
                        <div className="text-xs text-destructive/70">End your session</div>
                      </div>
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/signin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
