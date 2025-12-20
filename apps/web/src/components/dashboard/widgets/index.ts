// Types
export * from "./types";

// Registry
export { widgetRegistry, registerWidget, WIDGET_IDS } from "./registry";
export type { WidgetId } from "./registry";

// Components
export { WidgetWrapper } from "./WidgetWrapper";

// Widget components - import to register them
import "./ProductionStatusWidget";
import "./TodaysTasksWidget";
import "./CriticalAlertsWidget";
import "./QuickActionsWidget";
import "./RawMaterialsWidget";
import "./FinishedGoodsWidget";
import "./VesselMapWidget";
import "./FermentationHealthWidget";
import "./ActiveCarbonationsWidget";
import "./COGSSummaryWidget";

// Re-export widget components for direct use
export { ProductionStatusWidget } from "./ProductionStatusWidget";
export { TodaysTasksWidget } from "./TodaysTasksWidget";
export { CriticalAlertsWidget } from "./CriticalAlertsWidget";
export { QuickActionsWidget } from "./QuickActionsWidget";
export { RawMaterialsWidget } from "./RawMaterialsWidget";
export { FinishedGoodsWidget } from "./FinishedGoodsWidget";
export { VesselMapWidget } from "./VesselMapWidget";
export { FermentationHealthWidget } from "./FermentationHealthWidget";
export { ActiveCarbonationsWidget } from "./ActiveCarbonationsWidget";
export { COGSSummaryWidget } from "./COGSSummaryWidget";
