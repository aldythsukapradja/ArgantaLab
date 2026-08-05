// The chart contract lives in its own leaf module so the three group files never
// import each other. Hanging it off GroupBasin made registry → GroupBasin →
// (GroupSystem, GroupOpportunity) → GroupBasin a cycle, and the CHARTS binding
// evaluated as undefined at runtime even though tsc was happy with it.
export interface ChartProps {
  /** The scope name from the header bar — a province, AU or basin. */
  scope: string;
}
