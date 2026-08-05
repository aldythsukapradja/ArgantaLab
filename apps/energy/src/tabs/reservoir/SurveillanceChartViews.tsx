// SurveillanceChartViews.tsx — thin React lifecycle shims around the D3 chart classes in
// engine/charts/SurveillanceCharts.ts. Exactly the FieldDev pattern (ProductionChartView):
// mount the class into a div ref, keep its data in sync, destroy on unmount. These
// components own NO drawing logic — every pixel is D3's.
import { useEffect, useRef } from 'react';
import {
  BenchmarkChart, DonutChart, StageChart, VoidageChart, WellBarChart,
  type BenchmarkSpec, type DonutSlice, type VoidageEvent, type VoidagePoint, type WellBar,
} from '../../engine/charts/SurveillanceCharts';

/** THE signature chart: production/injection mirrored bars + the VRR overlay line. */
export function VoidageChartView({ data, events, onPickEvent, xUnit, yUnit, y2Unit }: {
  data: VoidagePoint[]; events: VoidageEvent[]; onPickEvent?: (id: string) => void;
  xUnit?: string; yUnit?: string; y2Unit?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<VoidageChart | null>(null);
  const cb = useRef(onPickEvent);
  cb.current = onPickEvent;
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new VoidageChart(ref.current, { onPickEvent: (id) => cb.current?.(id), xUnit, yUnit, y2Unit });
    return () => { chart.current?.destroy(); chart.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xUnit, yUnit, y2Unit]);
  useEffect(() => { chart.current?.setData(data, events); }, [data, events]);
  return <div className="rms-sd-d3 rms-sd-voidage" ref={ref} />;
}

export function DonutChartView({ slices, centre, sub }: { slices: DonutSlice[]; centre?: string; sub?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<DonutChart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new DonutChart(ref.current);
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setData(slices, centre ?? '', sub ?? ''); }, [slices, centre, sub]);
  return <div className="rms-sd-d3 rms-sd-donut-d3" ref={ref} />;
}

export function BenchmarkChartView({ spec }: { spec: BenchmarkSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<BenchmarkChart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new BenchmarkChart(ref.current);
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setData(spec); }, [spec]);
  return <div className="rms-sd-d3 rms-sd-bench-d3" ref={ref} />;
}

export function WellBarChartView({ rows, onPick }: { rows: WellBar[]; onPick?: (well: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<WellBarChart | null>(null);
  const cb = useRef(onPick);
  cb.current = onPick;
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new WellBarChart(ref.current, (w) => cb.current?.(w));
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setData(rows); }, [rows]);
  return <div className="rms-sd-d3 rms-sd-wells-d3" ref={ref} />;
}

export function StageChartView({ steps, at, ceased }: { steps: Array<{ key: string; at: number }>; at: number; ceased?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<StageChart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new StageChart(ref.current);
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setData(steps, at, ceased); }, [steps, at, ceased]);
  return <div className="rms-sd-d3 rms-sd-stage-d3" ref={ref} />;
}
