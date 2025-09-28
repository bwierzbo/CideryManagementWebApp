"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SelectContent } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ScrollableSelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectContent> {
  showScrollIndicators?: boolean;
  maxHeight?: string;
}

export const ScrollableSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectContent>,
  ScrollableSelectContentProps
>(
  (
    {
      className,
      children,
      showScrollIndicators = true,
      maxHeight = "200px",
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
      checkScrollability();

      // Add scroll listener
      element.addEventListener("scroll", checkScrollability);

      // Check scrollability when content changes
      const observer = new ResizeObserver(checkScrollability);
      observer.observe(element);

      return () => {
        element.removeEventListener("scroll", checkScrollability);
        observer.disconnect();
      };
    }, [checkScrollability]);

    return (
      <SelectContent
        ref={ref}
        className={cn("relative p-0", className)}
        {...props}
      >
        <div className="relative">
          {/* Top scroll indicator */}
          {showScrollIndicators && canScrollUp && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background to-transparent h-4 flex items-start justify-center">
              <ChevronUp className="w-3 h-3 text-muted-foreground animate-pulse" />
            </div>
          )}

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            className="overflow-y-auto px-1 py-1"
            style={{ maxHeight }}
          >
            {children}
          </div>

          {/* Bottom scroll indicator */}
          {showScrollIndicators && canScrollDown && (
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background to-transparent h-4 flex items-end justify-center">
              <ChevronDown className="w-3 h-3 text-muted-foreground animate-pulse" />
            </div>
          )}
        </div>
      </SelectContent>
    );
  },
);

ScrollableSelectContent.displayName = "ScrollableSelectContent";
