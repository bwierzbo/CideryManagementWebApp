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
  Archive,
  FileText,
  BookOpen,
  Settings,
  Menu,
  X,
  Building2,
  User,
  LogOut,
  ChevronDown,
  Shield,
  Users,
  Activity,
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

  // Define navItems inside component to avoid SSR/client mismatch
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
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Grape className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
                  CideryCraft
                </h1>
                <p className="text-xs text-gray-500 -mt-1">Management System</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 group relative",
                    isActive
                      ? "bg-amber-50 text-amber-700 shadow-sm"
                      : "text-gray-600 hover:text-amber-600 hover:bg-gray-50",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 mb-1 transition-transform group-hover:scale-110",
                      isActive ? "text-amber-600" : "text-gray-500",
                    )}
                  />
                  <span className="font-semibold">{item.name}</span>
                  {isActive && (
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-amber-600 rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* User Menu */}
            <div className="ml-4 pl-4 border-l border-gray-200 flex items-center space-x-3">
              <SessionIndicator />
              {session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-amber-600 hover:bg-gray-50 transition-colors">
                      <User className="w-5 h-5" />
                      <span className="max-w-[100px] truncate">{session.user?.name || session.user?.email}</span>
                      <Badge variant={getRoleBadgeVariant(session.user?.role || "viewer")} className="text-xs">
                        {session.user?.role}
                      </Badge>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div>
                        <p className="font-medium">{session.user?.name}</p>
                        <p className="text-xs text-gray-500">{session.user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center cursor-pointer">
                        <User className="w-4 h-4 mr-2" />
                        Profile Settings
                      </Link>
                    </DropdownMenuItem>
                    {session.user?.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center cursor-pointer">
                          <Users className="w-4 h-4 mr-2" />
                          Manage Users
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="text-red-600 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  href="/auth/signin"
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-amber-600 hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-amber-600 hover:bg-gray-50 transition-colors"
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
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-amber-50 text-amber-700 border-l-4 border-amber-600"
                        : "text-gray-700 hover:text-amber-600 hover:bg-gray-50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 mr-3",
                        isActive ? "text-amber-600" : "text-gray-500",
                      )}
                    />
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Mobile User Menu */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                {session ? (
                  <>
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-700">{session.user?.name}</p>
                      <p className="text-xs text-gray-500">{session.user?.email}</p>
                      <Badge variant={getRoleBadgeVariant(session.user?.role || "viewer")} className="text-xs mt-1">
                        {session.user?.role}
                      </Badge>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-amber-600 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-5 h-5 mr-3 text-gray-500" />
                      <div>
                        <div className="font-semibold">Profile</div>
                        <div className="text-xs text-gray-500">Manage your account</div>
                      </div>
                    </Link>
                    {session.user?.role === "admin" && (
                      <Link
                        href="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-amber-600 hover:bg-gray-50 transition-colors"
                      >
                        <Users className="w-5 h-5 mr-3 text-gray-500" />
                        <div>
                          <div className="font-semibold">Manage Users</div>
                          <div className="text-xs text-gray-500">Admin only</div>
                        </div>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        signOut({ callbackUrl: "/auth/signin" });
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center w-full px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <div className="font-semibold">Sign Out</div>
                        <div className="text-xs text-red-500">End your session</div>
                      </div>
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/signin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:text-amber-600 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5 mr-3 text-gray-500" />
                    <div>
                      <div className="font-semibold">Sign In</div>
                      <div className="text-xs text-gray-500">Access your account</div>
                    </div>
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
