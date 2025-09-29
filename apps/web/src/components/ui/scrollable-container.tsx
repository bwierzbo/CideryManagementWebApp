"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollableContainerProps
  extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string;
  showScrollIndicators?: boolean;
  children: React.ReactNode;
}

export const ScrollableContainer = React.forwardRef<
  HTMLDivElement,
  ScrollableContainerProps
>(
  (
    {
      className,
      children,
      maxHeight = "16rem",
      showScrollIndicators = true,
      ...props
    },
    ref,
  ) => {
    const [canScrollUp, setCanScrollUp] = React.useState(false);
    const [canScrollDown, setCanScrollDown] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const checkScrollability = React.useCallback(() => {
      const element = scrollRef.current;
      if (!element) return;

      const { scrollTop, scrollHeight, clientHeight } = element;
      setCanScrollUp(scrollTop > 0);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 1);
    }, []);

    React.useEffect(() => {
      const element = scrollRef.current;
      if (!element) return;

      // Check initial scrollability
      setTimeout(checkScrollability, 0); // Delay to ensure DOM is rendered

      // Add scroll listener
      element.addEventListener("scroll", checkScrollability);

      // Check scrollability when content changes
      const observer = new ResizeObserver(checkScrollability);
      observer.observe(element);

      return () => {
        element.removeEventListener("scroll", checkScrollability);
        observer.disconnect();
      };
    }, [checkScrollability, children]);

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {/* Top scroll indicator */}
        {showScrollIndicators && canScrollUp && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background via-background/80 to-transparent h-6 flex items-start justify-center pt-1">
            <div className="bg-muted/50 rounded-full p-1 shadow-sm">
              <ChevronUp className="w-3 h-3 text-muted-foreground animate-pulse" />
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight }}>
          {children}
        </div>

        {/* Bottom scroll indicator */}
        {showScrollIndicators && canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background via-background/80 to-transparent h-6 flex items-end justify-center pb-1">
            <div className="bg-muted/50 rounded-full p-1 shadow-sm">
              <ChevronDown className="w-3 h-3 text-muted-foreground animate-pulse" />
            </div>
          </div>
        )}
      </div>
    );
  },
);

ScrollableContainer.displayName = "ScrollableContainer";
