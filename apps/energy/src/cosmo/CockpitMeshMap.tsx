import { useEffect, useRef } from 'react';
import {
  geoContains, geoEqualEarth, geoGraticule10, geoPath,
} from 'd3-geo';
import type { CockpitSelection } from './CockpitMap';
import type { GeoCollection, WorldProvinceProps } from '../world/types';
import './cockpit-map.css';

type FieldProps = { id: string; name: string; type: string; source: string; country?: string; basin?: string };
const base = import.meta.env.BASE_URL || '/';

export function CockpitMeshMap({
  dark, onSelect,
}: {
  dark: boolean;
  onSelect: (selection: CockpitSelection | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};
    const boot = async () => {
      const [provinceResponse, fieldResponse] = await Promise.all([
        fetch(`${base}world/provinces.geojson`),
        fetch(`${base}osdu/cockpit-points.geojson`),
      ]);
      const provinces = await provinceResponse.json() as GeoCollection<WorldProvinceProps>;
      const allPoints = await fieldResponse.json() as GeoCollection<FieldProps>;
      const fields = allPoints.features.filter((feature) => feature.properties.type === 'Field');
      if (disposed || !canvasRef.current) return;

      const context = canvas.getContext('2d');
      if (!context) return;
      const projection = geoEqualEarth();
      const path = geoPath(projection, context);
      let scaleFactor = 1;
      let rotation: [number, number] = [0, 0];
      let pointerDown: [number, number] | null = null;
      let moved = false;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        projection.fitExtent([[42, 28], [rect.width - 42, rect.height - 28]], { type: 'Sphere' });
        projection.scale(projection.scale() * scaleFactor).rotate(rotation);
        draw();
      };
      const draw = () => {
        const { width, height } = canvas.getBoundingClientRect();
        context.clearRect(0, 0, width, height);
        context.beginPath();
        path({ type: 'Sphere' });
        context.fillStyle = dark ? '#061a25' : '#e6f3f1';
        context.fill();
        context.strokeStyle = dark ? 'rgba(94,234,212,.34)' : 'rgba(8,127,120,.24)';
        context.lineWidth = .6;
        context.beginPath();
        path(geoGraticule10());
        context.stroke();
        for (const feature of provinces.features) {
          context.beginPath();
          path(feature as never);
          context.fillStyle = dark ? 'rgba(15,181,166,.11)' : 'rgba(15,181,166,.07)';
          context.fill();
          context.strokeStyle = dark ? 'rgba(94,234,212,.8)' : 'rgba(8,127,120,.72)';
          context.lineWidth = .85;
          context.stroke();
        }
        context.fillStyle = '#fbbf24';
        for (const field of fields) {
          if (!field.geometry || field.geometry.type !== 'Point') continue;
          const point = projection(field.geometry.coordinates as [number, number]);
          if (!point) continue;
          context.beginPath();
          context.arc(point[0], point[1], scaleFactor > 1.5 ? 2.2 : 1.25, 0, Math.PI * 2);
          context.fill();
        }
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      const down = (event: PointerEvent) => {
        pointerDown = [event.clientX, event.clientY];
        moved = false;
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!pointerDown) return;
        const dx = event.clientX - pointerDown[0];
        const dy = event.clientY - pointerDown[1];
        if (Math.hypot(dx, dy) > 3) moved = true;
        rotation = [rotation[0] + dx / 3, Math.max(-70, Math.min(70, rotation[1] - dy / 3))];
        projection.rotate(rotation);
        pointerDown = [event.clientX, event.clientY];
        draw();
      };
      const up = (event: PointerEvent) => {
        if (!moved) {
          const rect = canvas.getBoundingClientRect();
          const coordinate = projection.invert?.([event.clientX - rect.left, event.clientY - rect.top]);
          const province = coordinate && provinces.features.find((feature) => geoContains(feature as never, coordinate));
          if (province) {
            const p = province.properties;
            selectRef.current({
              id: p.prvCode,
              name: p.prvName,
              type: 'Petroleum province',
              source: 'USGS World Petroleum Assessment',
              detail: [
                ['Code', p.prvCode],
                ['BOE mean', p.boeMean == null ? 'Not assessed' : `${p.boeMean.toLocaleString()} MMBOE`],
              ],
            });
          } else selectRef.current(null);
        }
        pointerDown = null;
      };
      const wheel = (event: WheelEvent) => {
        event.preventDefault();
        const oldScale = projection.scale();
        scaleFactor = Math.max(.75, Math.min(5, scaleFactor * (event.deltaY > 0 ? .9 : 1.1)));
        projection.scale(oldScale * (event.deltaY > 0 ? .9 : 1.1));
        draw();
      };
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('wheel', wheel, { passive: false });
      resize();
      cleanup = () => {
        observer.disconnect();
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('wheel', wheel);
      };
    };
    void boot();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [dark]);

  return <canvas ref={canvasRef} className="aeck-mesh-map" aria-label="D3 Equal Earth petroleum mesh with field locations" />;
}
