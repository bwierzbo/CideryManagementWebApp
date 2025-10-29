"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Apple,
  Beaker,
  Droplets,
  Package,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InventoryFABProps {
  activeTab: string;
  onAddApple: () => void;
  onAddAdditive: () => void;
  onAddJuice: () => void;
  onAddPackaging: () => void;
}

export function InventoryFAB({
  activeTab,
  onAddApple,
  onAddAdditive,
  onAddJuice,
  onAddPackaging,
}: InventoryFABProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Handle scroll to show/hide FAB
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
        setIsExpanded(false); // Collapse when hiding
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Close speed dial when clicking outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = () => {
      setIsExpanded(false);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isExpanded]);

  // Don't show FAB on tabs that don't support adding
  if (!["all", "apple", "additives", "juice", "packaging"].includes(activeTab)) {
    return null;
  }

  // Single action mode - direct button for current tab
  // On "all" tab, shows speed dial menu instead of single action
  const getSingleAction = () => {
    switch (activeTab) {
      case "all":
        return { label: "Add Purchase", icon: Plus, action: null, color: "bg-gray-600 hover:bg-gray-700" };
      case "apple":
        return { label: "Add Base Fruit", icon: Apple, action: onAddApple, color: "bg-red-600 hover:bg-red-700" };
      case "additives":
        return { label: "Add Additives", icon: Beaker, action: onAddAdditive, color: "bg-purple-600 hover:bg-purple-700" };
      case "juice":
        return { label: "Add Juice", icon: Droplets, action: onAddJuice, color: "bg-blue-600 hover:bg-blue-700" };
      case "packaging":
        return { label: "Add Packaging", icon: Package, action: onAddPackaging, color: "bg-amber-600 hover:bg-amber-700" };
      default:
        return null;
    }
  };

  const singleAction = getSingleAction();

  if (!singleAction) return null;

  const Icon = singleAction.icon;
  const isAllTab = activeTab === "all";

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
        />
      )}

      {/* FAB Container */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 transition-all duration-300",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Speed Dial Actions */}
        <div
          className={cn(
            "absolute bottom-16 right-0 flex flex-col gap-3 transition-all duration-300",
            isExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          {(isAllTab || activeTab !== "apple") && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 bg-white px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
                Base Fruit
              </span>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg bg-red-600 hover:bg-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddApple();
                  setIsExpanded(false);
                }}
              >
                <Apple className="h-5 w-5" />
              </Button>
            </div>
          )}

          {(isAllTab || activeTab !== "additives") && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 bg-white px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
                Additives
              </span>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAdditive();
                  setIsExpanded(false);
                }}
              >
                <Beaker className="h-5 w-5" />
              </Button>
            </div>
          )}

          {(isAllTab || activeTab !== "juice") && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 bg-white px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
                Juice
              </span>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddJuice();
                  setIsExpanded(false);
                }}
              >
                <Droplets className="h-5 w-5" />
              </Button>
            </div>
          )}

          {(isAllTab || activeTab !== "packaging") && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 bg-white px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
                Packaging
              </span>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-lg bg-amber-600 hover:bg-amber-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPackaging();
                  setIsExpanded(false);
                }}
              >
                <Package className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Main FAB */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all duration-300",
            singleAction.color,
            isExpanded && "rotate-45"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isExpanded) {
              setIsExpanded(false);
            } else if (isAllTab) {
              // On "all" tab, always expand speed dial to choose purchase type
              setIsExpanded(true);
            } else {
              // Primary action: add for current tab
              if (singleAction.action) {
                singleAction.action();
              }
            }
          }}
          onContextMenu={(e) => {
            // Right-click or long-press to expand speed dial
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }}
          aria-label={isExpanded ? "Close menu" : singleAction.label}
        >
          {isExpanded ? (
            <X className="h-6 w-6" />
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </Button>

        {/* Long-press helper tooltip */}
        {!isExpanded && !isAllTab && (
          <div className="absolute -top-12 right-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-md shadow-lg whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            Right-click for more options
          </div>
        )}
      </div>
    </>
  );
}
