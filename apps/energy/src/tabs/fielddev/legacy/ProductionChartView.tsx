// ProductionChartView.tsx (1e) — thin React lifecycle shim around the D3
// ProductionChart class: mounts it into a div ref, keeps its data + playhead in sync
// with props, and tears it down on unmount. All rendering/DOM ownership lives in the
// D3 class (engine/charts/ProductionChart.ts) — this component owns none of it.
import { useEffect, useRef } from 'react';
import { ProductionChart, type ProdPoint } from '../../../engine/charts/ProductionChart';

export function ProductionChartView({ data, playheadPvi, onScrub }: {
  data: ProdPoint[];
  playheadPvi: number | null;
  onScrub?: (pvi: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ProductionChart | null>(null);
  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;

  useEffect(() => {
    if (!ref.current) return;
    chart.current = new ProductionChart(ref.current, { onScrub: (pvi) => onScrubRef.current?.(pvi) });
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);

  useEffect(() => { chart.current?.setData(data); }, [data]);
  useEffect(() => { chart.current?.setPlayheadPvi(playheadPvi); }, [playheadPvi]);

  return <div ref={ref} style={{ width: '100%', height: '100%', minHeight: 0 }} />;
}
