export type ProductionOrderStatus = "not_started" | "wip" | "partially_completed" | "completed" | "cancelled";

export const PRODUCTION_ORDER_STATUS_LABEL: Record<ProductionOrderStatus, string> = {
  not_started: "Not Started",
  wip: "WIP",
  partially_completed: "Partially Completed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PRODUCTION_ORDER_STATUS_VARIANT: Record<
  ProductionOrderStatus,
  "success" | "default" | "danger" | "warning" | "neutral"
> = {
  not_started: "neutral",
  wip: "warning",
  partially_completed: "default",
  completed: "success",
  cancelled: "danger",
};
