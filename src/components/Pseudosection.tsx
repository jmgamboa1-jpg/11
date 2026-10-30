import React, { useMemo, useState, useRef, useEffect } from 'react';
import { QuadripolePoint, estimate2DInversion } from '../utils/ert-math';
import { FieldNote } from './FieldNotesModal';
import { IPDecayCurveView } from './IPDecayCurveView';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  Grid,
  CircleDot,
  Volume2,
  VolumeX,
  Zap,
  Mountain,
  Palette,
  Crosshair,
} from 'lucide-react';
import { beeper } from '../utils/audio-beeper';

interface PseudosectionProps {
  points: QuadripolePoint[];
  totalElectrodes: number;
  spacing: number;
  activeElectrodes: { tx: number[]; rx: number[] };
  selectedPoint: QuadripolePoint | null;
  onSelectPoint: (p: QuadripolePoint | null) => void;
  viewMode: 'rho' | 'ip';
  onToggleViewMode: (mode: 'rho' | 'ip') => void;
  errorThreshold: number;
  isSunlightMode: boolean;
  fieldNotes?: FieldNote[];
  lastBatch?: QuadripolePoint[];
}

// 1. Classic Geophysical Turbo Colormap
function getResistivityColorDark(rho: number): string {
  if (rho <= 0) return '#334155';
  const minLog = Math.log10(10);
  const maxLog = Math.log10(1200);
  const curLog = Math.log10(Math.max(10, Math.min(1200, rho)));
  const t = Math.max(0, Math.min(1, (curLog - minLog) / (maxLog - minLog)));

  if (t < 0.25) {
    const s = t / 0.25;
    return `rgb(${Math.round(14 + s * (6 - 14))}, ${Math.round(92 + s * (182 - 92))}, ${Math.round(230 + s * (212 - 230))})`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return `rgb(${Math.round(6 + s * (34 - 6))}, ${Math.round(182 + s * (197 - 182))}, ${Math.round(212 + s * (94 - 212))})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return `rgb(${Math.round(34 + s * (234 - 34))}, ${Math.round(197 + s * (179 - 197))}, ${Math.round(94 + s * (8 - 94))})`;
  } else {
    const s = (t - 0.75) / 0.25;
    return `rgb(${Math.round(234 + s * (225 - 234))}, ${Math.round(179 + s * (29 - 179))}, ${Math.round(8 + s * (72 - 8))})`;
  }
}

// 2. Viridis Scientific Perceptually Uniform Colormap
function getViridisColor(val: number, min = 10, max = 1200, isLog = true): string {
  if (val <= 0) return '#334155';
  const minL = isLog ? Math.log10(min) : min;
  const maxL = isLog ? Math.log10(max) : max;
  const curL = isLog ? Math.log10(Math.max(min, Math.min(max, val))) : Math.max(min, Math.min(max, val));
  const t = Math.max(0, Math.min(1, (curL - minL) / (maxL - minL)));

  // Viridis approximation: Purple -> Teal -> Green -> Yellow
  if (t < 0.33) {
    const s = t / 0.33;
    return `rgb(${Math.round(68 - s * 20)}, ${Math.round(1 + s * 80)}, ${Math.round(84 + s * 60)})`;
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    return `rgb(${Math.round(48 + s * 2)}, ${Math.round(81 + s * 95)}, ${Math.round(144 - s * 30)})`;
  } else {
    const s = (t - 0.66) / 0.34;
    return `rgb(${Math.round(50 + s * 203)}, ${Math.round(176 + s * 55)}, ${Math.round(114 - s * 78)})`;
  }
}

// 3. High-Contrast Solar Colormap
function getResistivityColorSunlight(rho: number): string {
  if (rho <= 0) return '#64748b';
  const minLog = Math.log10(10);
  const maxLog = Math.log10(1200);
  const curLog = Math.log10(Math.max(10, Math.min(1200, rho)));
  const t = Math.max(0, Math.min(1, (curLog - minLog) / (maxLog - minLog)));

  if (t < 0.25) {
    const s = t / 0.25;
    return `rgb(${Math.round(2 + s * 10)}, ${Math.round(50 + s * 110)}, ${Math.round(210 + s * 20)})`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return `rgb(${Math.round(12 + s * 180)}, ${Math.round(160 + s * 50)}, ${Math.round(230 - s * 190)})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return `rgb(${Math.round(192 + s * 45)}, ${Math.round(210 - s * 80)}, ${Math.round(40 - s * 25)})`;
  } else {
    const s = (t - 0.75) / 0.25;
    return `rgb(${Math.round(237 - s * 30)}, ${Math.round(130 - s * 110)}, ${Math.round(15 + s * 10)})`;
  }
}

function getIPColorDark(ip: number): string {
  const t = Math.max(0, Math.min(1, ip / 28));
  if (t < 0.33) {
    const s = t / 0.33;
    return `rgb(${Math.round(30 + s * 70)}, ${Math.round(80 + s * 140)}, ${Math.round(180 - s * 40)})`;
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    return `rgb(${Math.round(100 + s * 140)}, ${Math.round(220 - s * 50)}, ${Math.round(140 - s * 120)})`;
  } else {
    const s = (t - 0.66) / 0.34;
    return `rgb(${Math.round(240 + s * 15)}, ${Math.round(170 - s * 140)}, ${Math.round(20 + s * 100)})`;
  }
}

function getIPColorSunlight(ip: number): string {
  const t = Math.max(0, Math.min(1, ip / 28));
  if (t < 0.5) {
    const s = t / 0.5;
    return `rgb(${Math.round(10 + s * 140)}, ${Math.round(80 + s * 110)}, ${Math.round(220 - s * 80)})`;
  } else {
    const s = (t - 0.5) / 0.5;
    return `rgb(${Math.round(150 + s * 95)}, ${Math.round(190 - s * 170)}, ${Math.round(140 - s * 110)})`;
  }
}

export const Pseudosection: React.FC<PseudosectionProps> = ({
  points,
  totalElectrodes,
  spacing,
  activeElectrodes,
  selectedPoint,
  onSelectPoint,
  viewMode,
  onToggleViewMode,
  errorThreshold,
  isSunlightMode,
  fieldNotes = [],
  lastBatch = [],
}) => {
  const [zoom, setZoom] = useState(1);
  const [filterHighError, setFilterHighError] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<QuadripolePoint | null>(null);

  // Visualization modes: 'points' | 'mesh' | 'inversion'
  const [displayMode, setDisplayMode] = useState<'points' | 'mesh' | 'inversion'>('points');
  const [paletteType, setPaletteType] = useState<'geophysical' | 'viridis'>('geophysical');
  const [withTopography, setWithTopography] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isIPDecayOpen, setIsIPDecayOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 260 });

  useEffect(() => {
    beeper.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const lineLength = (totalElectrodes - 1) * spacing;
  const maxZ = useMemo(() => {
    if (points.length === 0) return 30;
    return Math.max(...points.map((p) => p.z), 25);
  }, [points]);

  const filteredPoints = useMemo(() => {
    if (!filterHighError) return points;
    return points.filter((p) => p.err <= errorThreshold);
  }, [points, filterHighError, errorThreshold]);

  // Inversion model estimated points
  const inversionModel = useMemo(() => {
    if (displayMode !== 'inversion') return [];
    return estimate2DInversion(filteredPoints);
  }, [displayMode, filteredPoints]);

  const padLeft = dimensions.width < 500 ? 38 : 50;
  const padRight = dimensions.width < 500 ? 18 : 32;
  const padTop = dimensions.height < 220 ? 20 : 28;
  const padBottom = dimensions.height < 220 ? 22 : 30;

  const plotW = Math.max(100, dimensions.width - padLeft - padRight);
  const plotH = Math.max(60, dimensions.height - padTop - padBottom);

  const scaleX = (x: number) => padLeft + (x / Math.max(10, lineLength)) * plotW;
  const scaleY = (z: number, topoOffset = 0) => {
    const base = padTop + (z / Math.max(5, maxZ)) * plotH;
    return withTopography ? base + topoOffset : base;
  };

  const getColor = (val: number) => {
    if (viewMode === 'ip') {
      return isSunlightMode ? getIPColorSunlight(val) : getIPColorDark(val);
    }
    if (paletteType === 'viridis') {
      return getViridisColor(val);
    }
    return isSunlightMode ? getResistivityColorSunlight(val) : getResistivityColorDark(val);
  };

  // 2D Continuous Geological Contour Mesh Generator
  const contourCells = useMemo(() => {
    if (displayMode === 'points' || filteredPoints.length < 12) return [];
    const cols = dimensions.width < 500 ? 20 : 36;
    const rows = dimensions.height < 220 ? 7 : 11;
    const cellW = plotW / cols;
    const cellH = plotH / rows;
    const cells: { x: number; y: number; w: number; h: number; color: string; val: number }[] = [];

    const activeDataset = displayMode === 'inversion' ? inversionModel : filteredPoints;

    for (let c = 0; c < cols; c++) {
      const realX = ((c + 0.5) / cols) * lineLength;
      for (let r = 0; r < rows; r++) {
        const realZ = ((r + 0.5) / rows) * maxZ;

        let weightSum = 0;
        let valSum = 0;
        for (let i = 0; i < activeDataset.length; i++) {
          const pt = activeDataset[i];
          const distSq = Math.pow(pt.x - realX, 2) + Math.pow((pt.z - realZ) * 2.4, 2);
          if (distSq < 1e-4) {
            valSum = displayMode === 'inversion' ? (pt as any).trueRho : viewMode === 'rho' ? (pt as any).rho : ((pt as any).ip ?? 0);
            weightSum = 1;
            break;
          }
          const w = 1 / Math.pow(distSq, 1.25);
          weightSum += w;
          valSum += w * (displayMode === 'inversion' ? (pt as any).trueRho : viewMode === 'rho' ? (pt as any).rho : ((pt as any).ip ?? 0));
        }

        const interpolatedVal = weightSum > 0 ? valSum / weightSum : 100;

        cells.push({
          x: padLeft + c * cellW,
          y: padTop + r * cellH,
          w: cellW + 0.5,
          h: cellH + 0.5,
          color: getColor(interpolatedVal),
          val: interpolatedVal,
        });
      }
    }
    return cells;
  }, [displayMode, filteredPoints, inversionModel, dimensions, plotW, plotH, lineLength, maxZ, viewMode, paletteType, isSunlightMode]);

  const activeInspection = hoveredPoint || selectedPoint;

  // Quadripole electrode positions on cable for the inspected point
  const inspectedElectrodes = useMemo(() => {
    if (!activeInspection || !activeInspection.p || activeInspection.p.length < 4) return null;
    const [a, b, m, n] = activeInspection.p;
    return {
      aX: scaleX((a - 1) * spacing),
      bX: scaleX((b - 1) * spacing),
      mX: scaleX((m - 1) * spacing),
      nX: scaleX((n - 1) * spacing),
      a, b, m, n,
    };
  }, [activeInspection, spacing, padLeft, plotW, lineLength]);

  return (
    <div
      className={`flex-1 min-h-0 flex flex-col rounded-xl border transition-colors shadow-2xl overflow-hidden select-none ${
        isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#080d16] border-[#18273d] text-[#e2ecf8]'
      }`}
    >
      {/* 1. Precision Top Control Strip */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between gap-2 border-b shrink-0 ${
          isSunlightMode ? 'border-black bg-slate-100' : 'border-[#152338] bg-[#09111c]'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-bold text-[11px] sm:text-xs tracking-tight uppercase">
              {viewMode === 'rho' ? 'Tomografía 2D · ρa' : 'Polarización Inducida · Ma'}
            </span>
          </div>

          <span
            className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
              isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#101b2c] border-[#1d2f4a] text-cyan-300'
            }`}
          >
            {filteredPoints.length} Quadripolos
          </span>
        </div>

        {/* Toolbar Segmented Controls */}
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-mono">
          {/* Display Mode: Ptos / Malla / Inversión 2D */}
          <div
            className={`flex rounded-md p-0.5 border ${
              isSunlightMode ? 'bg-slate-200 border-black' : 'bg-[#0d1624] border-[#1b2b41]'
            }`}
          >
            <button
              onClick={() => setDisplayMode('points')}
              className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                displayMode === 'points'
                  ? isSunlightMode
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-sky-600 text-white shadow-sm shadow-sky-950'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Puntos de medición cuadripolar discretos"
            >
              Ptos
            </button>
            <button
              onClick={() => setDisplayMode('mesh')}
              className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                displayMode === 'mesh'
                  ? isSunlightMode
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Malla continua 2D interpolada"
            >
              Malla
            </button>
            <button
              onClick={() => setDisplayMode('inversion')}
              className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                displayMode === 'inversion'
                  ? isSunlightMode
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-purple-600 text-white shadow-sm shadow-purple-950'
                  : 'opacity-70 hover:opacity-100'
              }`}
              title="Inversión preliminar de resistividad L2"
            >
              Inversión 2D
            </button>
          </div>

          {/* Palette Selector */}
          <button
            onClick={() => setPaletteType(paletteType === 'geophysical' ? 'viridis' : 'geophysical')}
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              paletteType === 'viridis'
                ? isSunlightMode
                  ? 'bg-black text-white border-black'
                  : 'bg-indigo-600 text-white border-indigo-500'
                : isSunlightMode
                ? 'bg-white border-black text-black'
                : 'bg-[#101b2c] border-[#1d2f4a] text-slate-300 hover:text-white'
            }`}
            title="Alternar paleta Viridis / Geofísica Estándar"
          >
            <Palette className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">{paletteType === 'viridis' ? 'Viridis' : 'Geofísica'}</span>
          </button>

          {/* Topography Correction Button */}
          <button
            onClick={() => setWithTopography(!withTopography)}
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              withTopography
                ? isSunlightMode
                  ? 'bg-amber-400 text-black border-black font-extrabold'
                  : 'bg-amber-600 text-white border-amber-500'
                : isSunlightMode
                ? 'bg-white border-black text-black'
                : 'bg-[#101b2c] border-[#1d2f4a] text-slate-300 hover:text-white'
            }`}
            title="Corrección Topográfica del Terreno"
          >
            <Mountain className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Topo</span>
          </button>

          {/* TDIP Button */}
          {lastBatch.some((p) => p.ip !== undefined) && (
            <button
              onClick={() => setIsIPDecayOpen(true)}
              className="px-2 py-0.5 rounded bg-purple-600/30 border border-purple-500/50 text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
              title="Curvas de decaimiento IP M1-M6"
            >
              <Zap className="w-3 h-3 text-purple-400" />
              <span>IP TD</span>
            </button>
          )}

          {/* Error filter */}
          <button
            onClick={() => setFilterHighError(!filterHighError)}
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              filterHighError
                ? isSunlightMode
                  ? 'bg-red-100 text-red-900 border-black font-extrabold'
                  : 'bg-rose-950/60 border-rose-500 text-rose-300'
                : isSunlightMode
                ? 'bg-white border-black text-black'
                : 'bg-[#101b2c] border-[#1d2f4a] text-slate-300 hover:text-white'
            }`}
            title="Filtrar mediciones con error repeat > umbral"
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>&gt;{errorThreshold}%</span>
          </button>

          {/* Stepper Zoom */}
          <div
            className={`flex items-center gap-1 border rounded-md px-1 py-0.5 ${
              isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1624] border-[#1b2b41]'
            }`}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.8, Number((z - 0.2).toFixed(1))))}
              className="px-1 font-bold hover:text-cyan-400 cursor-pointer"
            >
              -
            </button>
            <span className="text-[9px] font-bold min-w-[28px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.2).toFixed(1))))}
              className="px-1 font-bold hover:text-cyan-400 cursor-pointer"
            >
              +
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
              title="Restablecer escala al 100%"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Surface Multi-Conductor Cable & Electrode Status Line */}
      <div
        className={`px-3 py-1 border-b flex items-center justify-between text-[9px] font-mono shrink-0 ${
          isSunlightMode ? 'bg-slate-200 border-black text-black' : 'bg-[#070b13] border-[#131f31] text-[#93a7c2]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse inline-block" />
            <span>CABLE MULTICONDUCTOR {totalElectrodes} PICAS (Δa={spacing}m):</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-red-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block shadow-sm shadow-red-500" />
              Tx A-B
            </span>
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400" />
              Rx M-N (8 CH)
            </span>
            {displayMode === 'inversion' && (
              <span className="text-purple-400 font-bold">● Modelo de Inversión Gauss-Newton L2</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 font-bold">
          <span className="opacity-75">Estación: 0.0m</span>
          <span>────────</span>
          <span className="text-amber-400">{lineLength}.0m</span>
        </div>
      </div>

      {/* 3. Main Tomogram Graph Stage */}
      <div ref={containerRef} className="flex-1 min-h-0 relative w-full h-full overflow-hidden bg-carbon-texture">
        {/* Floating Precision Telemetry HUD Card */}
        {activeInspection && (
          <div
            className={`absolute top-2 right-2 z-20 p-2 sm:p-2.5 rounded-xl border text-[9px] sm:text-[10px] font-mono shadow-2xl transition-all ${
              isSunlightMode
                ? 'bg-white/95 border-black text-black ring-1 ring-black/10'
                : 'bg-[#080e18]/95 backdrop-blur-md border-cyan-500/50 text-slate-100 shadow-cyan-950/60 ring-1 ring-cyan-500/20'
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-cyan-500/30 pb-1 mb-1 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-cyan-400 uppercase">Pto #{activeInspection.id}</span>
              </div>
              <span className="text-amber-400 text-xs font-black">
                {viewMode === 'rho' ? `${activeInspection.rho} Ω·m` : `${activeInspection.ip || 0} mV/V`}
              </span>
              {selectedPoint && (
                <button
                  onClick={() => onSelectPoint(null)}
                  className="opacity-70 hover:opacity-100 p-0.5 hover:bg-slate-700/50 rounded cursor-pointer"
                  title="Cerrar inspección"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
              <div>
                <span className="opacity-60">X:</span> <strong>{activeInspection.x}m</strong>
              </div>
              <div>
                <span className="opacity-60">Z:</span> <strong>-{activeInspection.z}m</strong>
              </div>
              <div>
                <span className="opacity-60">Vp:</span> <strong>{activeInspection.v} mV</strong>
              </div>
              <div>
                <span className="opacity-60">In:</span> <strong>{activeInspection.i} mA</strong>
              </div>
              <div>
                <span className="opacity-60">Picas:</span>{' '}
                <strong className="text-cyan-300">
                  {activeInspection.p ? `${activeInspection.p[0]}-${activeInspection.p[1]} / ${activeInspection.p[2]}-${activeInspection.p[3]}` : '--'}
                </strong>
              </div>
              <div>
                <span className="opacity-60">Error:</span>{' '}
                <strong className={activeInspection.err > errorThreshold ? 'text-rose-400' : 'text-emerald-400'}>
                  {activeInspection.err}%
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* SVG Container with zoom transform */}
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: '100%', height: '100%' }}
          className="transition-transform duration-100"
        >
          <svg
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="w-full h-full cursor-crosshair"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              {/* Point gradient glows */}
              <radialGradient id="ptGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
              </radialGradient>

              {/* Inverted trapezoid theoretical depth coverage mask */}
              <clipPath id="coverageClip">
                <polygon
                  points={`
                    ${padLeft},${padTop}
                    ${dimensions.width - padRight},${padTop}
                    ${dimensions.width - padRight - plotW * 0.18},${dimensions.height - padBottom}
                    ${padLeft + plotW * 0.18},${dimensions.height - padBottom}
                  `}
                />
              </clipPath>
            </defs>

            {/* Base Background */}
            <rect
              x="0"
              y="0"
              width={dimensions.width}
              height={dimensions.height}
              fill={isSunlightMode ? '#ffffff' : '#070b13'}
            />

            {/* Continuous Contour Mesh with theoretical depth clipping */}
            {displayMode !== 'points' && (
              <g clipPath="url(#coverageClip)" opacity="0.92">
                {contourCells.map((cell, idx) => (
                  <rect key={idx} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={cell.color} />
                ))}
              </g>
            )}

            {/* Inverted Trapezoid Boundary Outline */}
            <polygon
              points={`
                ${padLeft},${padTop}
                ${dimensions.width - padRight},${padTop}
                ${dimensions.width - padRight - plotW * 0.18},${dimensions.height - padBottom}
                ${padLeft + plotW * 0.18},${dimensions.height - padBottom}
              `}
              fill="none"
              stroke={isSunlightMode ? '#94a3b8' : '#1a283e'}
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />

            {/* Depth Lines (Z) */}
            {[5, 10, 15, 20, 25, 30].map((zVal) => {
              if (zVal > maxZ + 2) return null;
              const y = scaleY(zVal);
              return (
                <g key={`z-${zVal}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={dimensions.width - padRight}
                    y2={y}
                    stroke={isSunlightMode ? '#cbd5e1' : '#142033'}
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill={isSunlightMode ? '#000000' : '#718ba8'}
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    -{zVal}m
                  </text>
                </g>
              );
            })}

            {/* Distance Gridlines (X) */}
            {Array.from({ length: Math.floor(lineLength / (dimensions.width < 500 ? 50 : 25)) + 1 }).map((_, i) => {
              const xVal = i * (dimensions.width < 500 ? 50 : 25);
              const x = scaleX(xVal);
              return (
                <g key={`x-${xVal}`}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={dimensions.height - padBottom}
                    stroke={isSunlightMode ? '#cbd5e1' : '#142033'}
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={dimensions.height - padBottom + 12}
                    textAnchor="middle"
                    fill={isSunlightMode ? '#000000' : '#718ba8'}
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    {xVal}m
                  </text>
                </g>
              );
            })}

            {/* Surface Line with physical Cable rendering */}
            <line
              x1={padLeft}
              y1={padTop}
              x2={dimensions.width - padRight}
              y2={padTop}
              stroke={isSunlightMode ? '#000000' : '#38bdf8'}
              strokeWidth="2.5"
            />
            <text
              x={padLeft - 6}
              y={padTop + 3}
              textAnchor="end"
              fill={isSunlightMode ? '#000000' : '#38bdf8'}
              fontSize="8.5"
              fontWeight="bold"
              fontFamily="monospace"
            >
              0.0m
            </text>

            {/* Electrodes on Cable */}
            {Array.from({ length: totalElectrodes }).map((_, idx) => {
              const elNum = idx + 1;
              const elX = scaleX(idx * spacing);
              const isTx = activeElectrodes.tx.includes(elNum);
              const isRx = activeElectrodes.rx.includes(elNum);
              const isInspected =
                inspectedElectrodes &&
                (inspectedElectrodes.a === elNum ||
                  inspectedElectrodes.b === elNum ||
                  inspectedElectrodes.m === elNum ||
                  inspectedElectrodes.n === elNum);

              let fillColor = isSunlightMode ? '#475569' : '#334155';
              let r = 2;
              if (isTx) {
                fillColor = '#ef4444';
                r = 4;
              } else if (isRx) {
                fillColor = '#38bdf8';
                r = 3.5;
              } else if (isInspected) {
                fillColor = '#f59e0b';
                r = 3.5;
              }

              return (
                <g key={`el-${elNum}`}>
                  <circle
                    cx={elX}
                    cy={padTop}
                    r={r}
                    fill={fillColor}
                    stroke={isSunlightMode ? '#000000' : '#080d16'}
                    strokeWidth="1"
                  />
                  {/* Number key electrode labels */}
                  {(elNum === 1 || elNum === totalElectrodes || elNum % 10 === 0) && (
                    <text
                      x={elX}
                      y={padTop - 6}
                      textAnchor="middle"
                      fill={isSunlightMode ? '#000000' : '#718ba8'}
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {elNum}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Field Notes Pins */}
            {fieldNotes.map((note) => {
              const match = note.stationOrElectrode.match(/\d+/);
              if (!match) return null;
              const elIdx = Math.max(1, Math.min(totalElectrodes, parseInt(match[0], 10)));
              const pinX = scaleX((elIdx - 1) * spacing);
              return (
                <g key={note.id}>
                  <circle cx={pinX} cy={padTop - 5} r="3.5" fill="#f59e0b" stroke="#000" strokeWidth="0.8" />
                  <line x1={pinX} y1={padTop - 5} x2={pinX} y2={padTop} stroke="#f59e0b" strokeWidth="1" />
                </g>
              );
            })}

            {/* Quadripole Geometric Ray Paths to Inspected Point (Geophysical sensitivity focus) */}
            {inspectedElectrodes && activeInspection && (
              <g opacity="0.85">
                {/* Ray from Tx A & B to Quadripole Point */}
                <line
                  x1={inspectedElectrodes.aX}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={scaleY(activeInspection.z)}
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <line
                  x1={inspectedElectrodes.bX}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={scaleY(activeInspection.z)}
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                {/* Ray from Rx M & N to Quadripole Point */}
                <line
                  x1={inspectedElectrodes.mX}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={scaleY(activeInspection.z)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <line
                  x1={inspectedElectrodes.nX}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={scaleY(activeInspection.z)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              </g>
            )}

            {/* Active Crosshair Projection */}
            {activeInspection && (
              <g>
                <line
                  x1={scaleX(activeInspection.x)}
                  y1={padTop}
                  x2={scaleX(activeInspection.x)}
                  y2={dimensions.height - padBottom}
                  stroke={isSunlightMode ? '#000000' : '#38bdf8'}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <line
                  x1={padLeft}
                  y1={scaleY(activeInspection.z)}
                  x2={dimensions.width - padRight}
                  y2={scaleY(activeInspection.z)}
                  stroke={isSunlightMode ? '#000000' : '#38bdf8'}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              </g>
            )}

            {/* Measured Quadripole Data Points */}
            {displayMode !== 'mesh' &&
              filteredPoints.map((pt) => {
                const cx = scaleX(pt.x);
                const cy = scaleY(pt.z);
                const isSelected = selectedPoint?.id === pt.id;
                const isHighErr = pt.err > errorThreshold;
                const color = getColor(viewMode === 'rho' ? pt.rho : (pt.ip ?? 0));

                return (
                  <g
                    key={pt.id}
                    onClick={() => onSelectPoint(isSelected ? null : pt)}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    className="cursor-pointer"
                  >
                    {/* Outer Selection Aura */}
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={dimensions.width < 500 ? 7 : 9}
                        fill="none"
                        stroke={isSunlightMode ? '#000000' : '#38bdf8'}
                        strokeWidth="2.5"
                      />
                    )}

                    {/* Point Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? (dimensions.width < 500 ? 4.5 : 6) : dimensions.width < 500 ? 3.2 : 4.4}
                      fill={color}
                      stroke={isHighErr ? '#ef4444' : isSunlightMode ? '#000000' : '#070b13'}
                      strokeWidth={isHighErr || isSunlightMode ? 1.5 : 0.8}
                    />

                    {/* Inner Gemstone Highlight */}
                    {!isSunlightMode && (
                      <circle
                        cx={cx - 1}
                        cy={cy - 1}
                        r={dimensions.width < 500 ? 1 : 1.5}
                        fill="#ffffff"
                        opacity="0.6"
                      />
                    )}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      {/* 4. Precision Geophysical Colorbar & Calibration Strip */}
      <div
        className={`px-3 py-1.5 border-t flex flex-wrap items-center justify-between text-[9px] font-mono shrink-0 gap-2 ${
          isSunlightMode ? 'bg-slate-200 border-black text-black' : 'bg-[#070b13] border-[#131f31] text-[#93a7c2]'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-tight text-slate-300">
            {viewMode === 'rho' ? 'Escala Calibrada ρa (Ω·m):' : 'Escala Cargabilidad Ma (mV/V):'}
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-sky-400 font-bold">{viewMode === 'rho' ? '10' : '0'}</span>
            <div
              className={`h-2.5 w-28 sm:w-48 rounded border relative ${
                isSunlightMode ? 'border-black' : 'border-slate-700'
              }`}
              style={{
                background:
                  viewMode === 'rho'
                    ? paletteType === 'viridis'
                      ? 'linear-gradient(to right, rgb(68,1,84), rgb(48,81,144), rgb(50,176,114), rgb(253,231,37))'
                      : isSunlightMode
                      ? 'linear-gradient(to right, rgb(2,50,210), rgb(12,160,230), rgb(192,210,40), rgb(237,130,15), rgb(207,20,25))'
                      : 'linear-gradient(to right, rgb(14,92,230), rgb(6,182,212), rgb(34,197,94), rgb(234,179,8), rgb(225,29,72))'
                    : 'linear-gradient(to right, rgb(30,80,180), rgb(100,220,140), rgb(240,170,20), rgb(255,30,120))',
              }}
            />
            <span className="text-rose-500 font-bold">{viewMode === 'rho' ? '>1200' : '>28'}</span>
          </div>
        </div>

        {/* Lithological Indicators */}
        <div className="flex items-center gap-3 font-semibold text-[9px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-500" />
            Conductor (Limo / Agua)
          </span>
          <span className="opacity-40">│</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Moderado
          </span>
          <span className="opacity-40">│</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500" />
            Resistivo (Roca Dura / Basalto)
          </span>
        </div>
      </div>

      {/* IP Decay Curve Modal */}
      {isIPDecayOpen && (
        <IPDecayCurveView
          batch={lastBatch.length > 0 ? lastBatch : points.slice(-8)}
          isSunlightMode={isSunlightMode}
          onClose={() => setIsIPDecayOpen(false)}
        />
      )}
    </div>
  );
};
