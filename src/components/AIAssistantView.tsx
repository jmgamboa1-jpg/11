import React, { useState } from 'react';
import { Sparkles, Bot, RefreshCw } from 'lucide-react';

interface AIAssistantViewProps {
  surveyConfig: any;
  pointsCount: number;
  contactSummary: any;
  points: any[];
  isSunlightMode: boolean;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  surveyConfig,
  pointsCount,
  contactSummary,
  points,
  isSunlightMode,
}) => {
  const [report, setReport] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const rhos = points.map((p) => p.rho).filter((r) => r > 0);
      const minRho = rhos.length ? Math.min(...rhos) : 0;
      const maxRho = rhos.length ? Math.max(...rhos) : 0;
      const avgRho = rhos.length ? Math.round(rhos.reduce((a, b) => a + b, 0) / rhos.length) : 0;

      const ips = points.map((p) => p.ip).filter((v) => v !== undefined && v > 0);
      const maxIP = ips.length ? Math.max(...ips) : undefined;

      const payload = {
        summary: {
          jobName: surveyConfig.jobName,
          arrayType: surveyConfig.arrayType,
          electrodes: surveyConfig.electrodes,
          spacing: surveyConfig.spacing,
          measuredPoints: pointsCount,
          totalLineMeters: (surveyConfig.electrodes - 1) * surveyConfig.spacing,
        },
        anomalies: {
          minResistivity: minRho,
          maxResistivity: maxRho,
          averageResistivity: avgRho,
          maxChargeability: maxIP,
        },
        badElectrodes: contactSummary?.badElectrodes || [],
      };

      const res = await fetch('/api/assistant/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.status === 'ok') {
        setReport(data.interpretation);
        setSource(data.source);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-4 ${
            isSunlightMode ? 'border-black' : 'border-[#1b2b41]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                isSunlightMode
                  ? 'bg-purple-100 border-black text-purple-900'
                  : 'bg-purple-600/20 text-purple-400 border-purple-500/30'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                Asistente Geofísico de Terreno
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    isSunlightMode
                      ? 'bg-purple-200 border-black text-purple-950'
                      : 'bg-purple-900/50 text-purple-300 border-purple-800'
                  }`}
                >
                  Gemini Flash 2.5
                </span>
              </h2>
              <p className="text-xs opacity-80 mt-0.5">
                Diagnóstico geológico preliminar, correlación hidrogeológica y control de calidad (QC).
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={isLoading || pointsCount === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-lg min-h-[44px] border ${
              pointsCount === 0
                ? isSunlightMode
                  ? 'bg-slate-200 text-slate-500 border-slate-400 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'
                : isLoading
                ? 'bg-purple-800 text-white animate-pulse'
                : isSunlightMode
                ? 'bg-purple-900 hover:bg-purple-950 text-white border-black shadow-xl'
                : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-purple-950/40'
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analizando Perfil Tomográfico...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-purple-200" />
                Interpretar Perfil ({pointsCount} Puntos)
              </>
            )}
          </button>
        </div>

        {pointsCount === 0 && (
          <div className="p-4 rounded-lg text-xs opacity-70 text-center font-medium">
            Inicia disparos en "Adquisición en Vivo" para que el modelo interprete las resistividades y cargabilidades medidas.
          </div>
        )}

        {report && (
          <div
            className={`mt-4 p-5 rounded-xl border ${
              isSunlightMode ? 'bg-slate-50 border-black text-black' : 'bg-[#070e17] border-purple-500/40 text-slate-200'
            }`}
          >
            <div
              className={`flex items-center justify-between mb-3 border-b pb-2 text-xs font-bold ${
                isSunlightMode ? 'border-black' : 'border-[#17273e]'
              }`}
            >
              <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Informe Geológico & QC
              </span>
              <span className="text-[10px] font-mono opacity-70">
                {source === 'gemini' ? 'Google Gemini 2.5 Flash' : 'Motor Geofísico de Reglas'}
              </span>
            </div>

            <div className="text-xs leading-relaxed space-y-2 whitespace-pre-wrap font-sans font-medium">
              {report}
            </div>
          </div>
        )}

        {/* Geological Reference Card */}
        <div
          className={`mt-5 p-4 rounded-xl border ${
            isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#08111d] border-[#16253b]'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider block mb-3 opacity-90">
            Escalas Litológicas de Resistividad Típica
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-blue-600 dark:text-blue-400 font-bold block">1 - 30 Ω·m</span>
              <span className="text-[11px] opacity-80">Arcillas saturadas / Salmueras</span>
            </div>
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-cyan-700 dark:text-cyan-400 font-bold block">30 - 150 Ω·m</span>
              <span className="text-[11px] opacity-80">Acuíferos aluviales / Arenas</span>
            </div>
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-yellow-700 dark:text-yellow-400 font-bold block">150 - 500 Ω·m</span>
              <span className="text-[11px] opacity-80">Areniscas / Regolito meteorizado</span>
            </div>
            <div
              className={`p-2.5 rounded border ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0c1626] border-[#182944]'
              }`}
            >
              <span className="text-red-700 dark:text-rose-400 font-bold block">&gt; 800 Ω·m</span>
              <span className="text-[11px] opacity-80">Granito / Basamento cristalino</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
