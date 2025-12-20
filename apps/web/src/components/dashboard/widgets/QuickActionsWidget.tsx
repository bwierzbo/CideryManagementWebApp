"use client";

import Link from "next/link";
import { Zap, ShoppingCart, Grape, Beaker, FileText, Package } from "lucide-react";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface QuickAction {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    icon: ShoppingCart,
    title: "Record Purchase",
    description: "Add new apple purchase",
    href: "/purchase-orders",
    color: "bg-blue-600 hover:bg-blue-700",
  },
  {
    icon: Grape,
    title: "Start Press Run",
    description: "Begin apple processing",
    href: "/pressing",
    color: "bg-purple-600 hover:bg-purple-700",
  },
  {
    icon: Beaker,
    title: "Log Measurement",
    description: "Record batch metrics",
    href: "/cellar",
    color: "bg-green-600 hover:bg-green-700",
  },
  {
    icon: FileText,
    title: "View Reports",
    description: "COGS analysis",
    href: "/reports",
    color: "bg-amber-600 hover:bg-amber-700",
  },
];

interface ActionButtonProps {
  action: QuickAction;
  compact?: boolean;
}

function ActionButton({ action, compact }: ActionButtonProps) {
  const Icon = action.icon;

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        className="w-full justify-start h-auto py-2"
      >
        <Link href={action.href} className="flex items-center gap-2">
          <div
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center text-white",
              action.color
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs">{action.title}</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start h-auto p-4 hover:shadow-md transition-all duration-200 group"
      asChild
    >
      <Link href={action.href}>
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center mr-3 text-white group-hover:scale-110 transition-transform",
            action.color
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-left">
          <div className="font-semibold text-gray-900 group-hover:text-gray-700">
            {action.title}
          </div>
          <div className="text-sm text-gray-500">{action.description}</div>
        </div>
      </Link>
    </Button>
  );
}

/**
 * Quick Actions Widget
 * Provides shortcuts to common tasks
 */
export function QuickActionsWidget({ compact }: WidgetProps) {
  return (
    <WidgetWrapper
      title="Quick Actions"
      icon={Zap}
      compact={compact}
      isEmpty={false}
    >
      <div className={cn("space-y-2", compact && "grid grid-cols-2 gap-2 space-y-0")}>
        {quickActions.map((action, index) => (
          <ActionButton key={index} action={action} compact={compact} />
        ))}
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.QUICK_ACTIONS,
  title: "Quick Actions",
  description: "Shortcuts to common tasks",
  icon: Zap,
  category: "actions",
  component: QuickActionsWidget,
  defaultSize: "sm",
  allowedSizes: ["sm", "md"],
  supportsRefresh: false,
};

registerWidget(config);
