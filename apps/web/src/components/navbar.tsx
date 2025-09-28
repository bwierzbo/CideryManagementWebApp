"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ShoppingCart,
  Grape,
  Beaker,
  Package,
  Archive,
  FileText,
  BookOpen,
  Settings,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { useState } from "react";

const navItems = [
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
    name: "Packaging",
    href: "/packaging",
    icon: Package,
    description: "Bottling & Canning",
  },
  {
    name: "Reports",
    href: "/reports",
    icon: FileText,
    description: "COGS & Analytics",
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
];

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
