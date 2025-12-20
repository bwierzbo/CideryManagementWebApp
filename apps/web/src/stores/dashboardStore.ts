import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { WidgetInstance, WidgetSize, DashboardLayout } from "@/components/dashboard/widgets/types";
import { WIDGET_IDS } from "@/components/dashboard/widgets/registry";

/**
 * Default widget layout for new users
 */
const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: "1", widgetId: WIDGET_IDS.CRITICAL_ALERTS, size: "full", order: 0 },
  { id: "2", widgetId: WIDGET_IDS.PRODUCTION_STATUS, size: "md", order: 1 },
  { id: "3", widgetId: WIDGET_IDS.TODAYS_TASKS, size: "md", order: 2 },
  { id: "4", widgetId: WIDGET_IDS.QUICK_ACTIONS, size: "sm", order: 3 },
  { id: "5", widgetId: WIDGET_IDS.VESSEL_MAP, size: "md", order: 4 },
  { id: "6", widgetId: WIDGET_IDS.FERMENTATION_HEALTH, size: "md", order: 5 },
  { id: "7", widgetId: WIDGET_IDS.ACTIVE_CARBONATIONS, size: "md", order: 6 },
  { id: "8", widgetId: WIDGET_IDS.FINISHED_GOODS, size: "md", order: 7 },
  { id: "9", widgetId: WIDGET_IDS.COGS_SUMMARY, size: "md", order: 8 },
  { id: "10", widgetId: WIDGET_IDS.RAW_MATERIALS, size: "md", order: 9 },
];

interface DashboardState {
  /** Current layout */
  layout: DashboardLayout;
  /** Whether the dashboard is in edit mode */
  isEditing: boolean;
  /** Currently selected widget for editing */
  selectedWidgetId: string | null;

  // Actions
  /** Set the entire layout */
  setLayout: (layout: DashboardLayout) => void;
  /** Add a widget to the dashboard */
  addWidget: (widgetId: string, size?: WidgetSize) => void;
  /** Remove a widget from the dashboard */
  removeWidget: (instanceId: string) => void;
  /** Update a widget's size */
  updateWidgetSize: (instanceId: string, size: WidgetSize) => void;
  /** Update a widget's settings */
  updateWidgetSettings: (instanceId: string, settings: Record<string, unknown>) => void;
  /** Reorder widgets */
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  /** Toggle edit mode */
  toggleEditMode: () => void;
  /** Select a widget for editing */
  selectWidget: (instanceId: string | null) => void;
  /** Reset to default layout */
  resetToDefault: () => void;
}

/**
 * Generate a unique ID for widget instances
 */
function generateId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create the default layout
 */
function createDefaultLayout(): DashboardLayout {
  return {
    id: "default",
    name: "Default",
    widgets: DEFAULT_WIDGETS,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Dashboard store for managing widget layout and preferences.
 * Persists to localStorage for now; will sync to database later.
 */
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layout: createDefaultLayout(),
      isEditing: false,
      selectedWidgetId: null,

      setLayout: (layout) =>
        set({
          layout: { ...layout, updatedAt: new Date() },
        }),

      addWidget: (widgetId, size = "md") =>
        set((state) => {
          const maxOrder = Math.max(
            ...state.layout.widgets.map((w) => w.order),
            -1
          );
          const newWidget: WidgetInstance = {
            id: generateId(),
            widgetId,
            size,
            order: maxOrder + 1,
          };
          return {
            layout: {
              ...state.layout,
              widgets: [...state.layout.widgets, newWidget],
              updatedAt: new Date(),
            },
          };
        }),

      removeWidget: (instanceId) =>
        set((state) => ({
          layout: {
            ...state.layout,
            widgets: state.layout.widgets.filter((w) => w.id !== instanceId),
            updatedAt: new Date(),
          },
          selectedWidgetId:
            state.selectedWidgetId === instanceId
              ? null
              : state.selectedWidgetId,
        })),

      updateWidgetSize: (instanceId, size) =>
        set((state) => ({
          layout: {
            ...state.layout,
            widgets: state.layout.widgets.map((w) =>
              w.id === instanceId ? { ...w, size } : w
            ),
            updatedAt: new Date(),
          },
        })),

      updateWidgetSettings: (instanceId, settings) =>
        set((state) => ({
          layout: {
            ...state.layout,
            widgets: state.layout.widgets.map((w) =>
              w.id === instanceId
                ? { ...w, settings: { ...w.settings, ...settings } }
                : w
            ),
            updatedAt: new Date(),
          },
        })),

      reorderWidgets: (fromIndex, toIndex) =>
        set((state) => {
          const widgets = [...state.layout.widgets].sort(
            (a, b) => a.order - b.order
          );
          const [moved] = widgets.splice(fromIndex, 1);
          widgets.splice(toIndex, 0, moved);

          // Update order values
          const reordered = widgets.map((w, i) => ({ ...w, order: i }));

          return {
            layout: {
              ...state.layout,
              widgets: reordered,
              updatedAt: new Date(),
            },
          };
        }),

      toggleEditMode: () =>
        set((state) => ({
          isEditing: !state.isEditing,
          selectedWidgetId: state.isEditing ? null : state.selectedWidgetId,
        })),

      selectWidget: (instanceId) =>
        set({ selectedWidgetId: instanceId }),

      resetToDefault: () =>
        set({
          layout: createDefaultLayout(),
          isEditing: false,
          selectedWidgetId: null,
        }),
    }),
    {
      name: "cidery-dashboard",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        layout: state.layout,
      }),
    }
  )
);

/**
 * Hook to get sorted widgets
 */
export function useSortedWidgets(): WidgetInstance[] {
  const widgets = useDashboardStore((state) => state.layout.widgets);
  return [...widgets].sort((a, b) => a.order - b.order);
}
