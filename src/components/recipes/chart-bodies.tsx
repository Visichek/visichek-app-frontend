"use client";

// Single barrel for the recharts-using chart bodies. Every wrapper in this
// folder dynamic-imports from THIS module (not from each impl file) so all
// three lazy chunks resolve to the same webpack chunk. Without that, each
// `next/dynamic(() => import("./time-series-chart-impl"))` creates its own
// chunk and webpack ships a fresh copy of recharts (plus its lodash dep)
// inside each one — verified via `npm run analyze`. Sharing the import
// specifier collapses them into a single async chunk that the first chart
// on the page loads, and every other chart on that page reuses.
export { TimeSeriesChartBody } from "./time-series-chart-impl";
export { HeatmapBarsBody } from "./heatmap-bars-impl";
export { DistributionPieBody } from "./distribution-pie-impl";
