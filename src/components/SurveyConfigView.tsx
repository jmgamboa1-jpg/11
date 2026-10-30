import React, { useState, useEffect } from 'react';
import { SequenceConfig } from '../utils/ert-math';
import { Sliders, Play, Calculator, FileUp, CheckCircle } from 'lucide-react';

interface SurveyConfigViewProps {
  config: SequenceConfig & { jobName: string };
  onSaveConfig: (cfg: SequenceConfig & { jobName: string }) => Promise<void>;
  onStartSurveyAfterConfig: () => void;
  isConnected: boolean;
  isSunlightMode: boolean;
}

export const SurveyConfigView: React.FC<SurveyConfigViewProps> = ({
  config,
  onSaveConfig,
  onStartSurveyAfterConfig,
  isConnected,
  isSunlightMode,
}) => {
  const [form, setForm] = useState(config);
  const [previewSummary, setPreviewSummary] = useState<any | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cmdFileContent, setCmdFileContent] = useState('');
  const [cmdFileName, setCmdFileName] = useState('CUSTOM.cmd');
  const [cmdUploadMsg, setCmdUploadMsg] = useState<string | null>(null);

  const calculateSequence = async (targetCfg: typeof form) => {
    try {
      const res = await fetch('/api/survey/sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetCfg),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setPreviewSummary(data.summary);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setForm(config);
    calculateSequence(config);
  }, [config]);

  const handleChange = (field: string, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    calculateSequence(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveConfig(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleUploadCmd = async () => {
    if (!cmdFileContent.trim()) return;
    try {
      const res = await fetch('/api/files/upload-cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: cmdFileName, content: cmdFileContent }),
      });
      const data = await res.json();
      setCmdUploadMsg(data.message || 'Comandos guardados en el R8');
      setTimeout(() => setCmdUploadMsg(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuration Form Card */}
      <form
        onSubmit={handleSave}
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-4 ${
            isSunlightMode ? 'border-black' : 'border-[#1b2b41]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold uppercase tracking-tight">
              Parámetros de Tendido y Secuencia
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Guardado en SuperSting
              </span>
            )}
            <button
              type="submit"
              className={`px-4 py-2.5 rounded-lg text-xs font-bold shadow transition-all min-h-[40px] border ${
                isSunlightMode
                  ? 'bg-black text-white border-black hover:bg-slate-800'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
              }`}
            >
              Aplicar a Memoria R8
            </button>
            <button
              type="button"
              onClick={onStartSurveyAfterConfig}
              disabled={!isConnected}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold min-h-[40px] transition-all border ${
                !isConnected
                  ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed'
                  : isSunlightMode
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-black'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Iniciar Adquisición
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Nombre de Línea
            </label>
            <input
              type="text"
              value={form.jobName}
              onChange={(e) => handleChange('jobName', e.target.value.toUpperCase())}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black focus:border-blue-700'
                  : 'bg-[#070e17] border-[#1b2e49] text-white focus:border-blue-500'
              }`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Arreglo Geofísico
            </label>
            <select
              value={form.arrayType}
              onChange={(e) => handleChange('arrayType', e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value="dd">Dipole-Dipole (Multicanal 8CH)</option>
              <option value="wenner">Wenner Alpha</option>
              <option value="schlumberger">Wenner-Schlumberger</option>
              <option value="gradient">Gradient Array</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Cantidad de Picas
            </label>
            <select
              value={form.electrodes}
              onChange={(e) => handleChange('electrodes', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={28}>28 Electrodos (1 Carrete)</option>
              <option value={56}>56 Electrodos (2 Carretes estándar)</option>
              <option value={84}>84 Electrodos (3 Carretes)</option>
              <option value={112}>112 Electrodos (4 Carretes)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Espaciamiento Unitario "a" (m)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="25"
              value={form.spacing}
              onChange={(e) => handleChange('spacing', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Separación Máxima n-Factor
            </label>
            <input
              type="number"
              min="2"
              max="14"
              value={form.nMax || 8}
              onChange={(e) => handleChange('nMax', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Límite Corriente de Inyección
            </label>
            <select
              value={form.maxCurrent || 500}
              onChange={(e) => handleChange('maxCurrent', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={100}>100 mA</option>
              <option value={200}>200 mA</option>
              <option value={500}>500 mA (Recomendado)</option>
              <option value={1000}>1000 mA (1.0 A)</option>
              <option value={2000}>2000 mA (2.0 A)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Tiempo Medición (s)
            </label>
            <select
              value={form.measureTime || 1.2}
              onChange={(e) => handleChange('measureTime', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={0.8}>0.8 s (Rápido)</option>
              <option value={1.2}>1.2 s (Estándar)</option>
              <option value={2.0}>2.0 s (Alta precisión)</option>
              <option value={3.6}>3.6 s (Filtro 50/60 Hz)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-80">
              Ciclos de Stack (Promediado)
            </label>
            <select
              value={form.stackCycles || 4}
              onChange={(e) => handleChange('stackCycles', Number(e.target.value))}
              className={`w-full rounded-lg px-3 py-2 text-sm font-mono border font-bold focus:outline-none ${
                isSunlightMode
                  ? 'bg-slate-100 border-black text-black'
                  : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            >
              <option value={2}>2 Stacks</option>
              <option value={4}>4 Stacks (Recomendado)</option>
              <option value={6}>6 Stacks</option>
              <option value={8}>8 Stacks (Bajo ruido)</option>
            </select>
          </div>

          {/* IP Mode Checkbox */}
          <div
            className={`sm:col-span-2 flex items-center gap-3 p-3 rounded-lg border ${
              isSunlightMode ? 'bg-slate-100 border-black' : 'bg-[#070e17] border-[#1b2e49]'
            }`}
          >
            <input
              type="checkbox"
              id="isIPCheck"
              checked={Boolean(form.isIP)}
              onChange={(e) => handleChange('isIP', e.target.checked)}
              className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="isIPCheck" className="text-xs cursor-pointer select-none">
              <span className="font-bold block text-purple-700 dark:text-purple-300">
                Activar Polarización Inducida (IP / Cargabilidad)
              </span>
              <span className="opacity-80">
                Adquiere decaimiento transitorio en ventanas M1 a M6 (dominio de tiempo).
              </span>
            </label>
          </div>
        </div>

        {/* Live Calculation Strip */}
        {previewSummary && (
          <div
            className={`mt-5 p-4 rounded-xl border ${
              isSunlightMode ? 'bg-slate-50 border-black' : 'bg-[#08101a] border-[#16273e]'
            }`}
          >
            <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-emerald-500" />
              Pre-cálculo Geofísico de Adquisición
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono text-xs">
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Puntos Totales</span>
                <span className="text-base font-bold text-cyan-600 dark:text-cyan-300">
                  {previewSummary.totalPoints}
                </span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Disparos (8CH)</span>
                <span className="text-base font-bold">{previewSummary.groupsOf8}</span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Longitud Línea</span>
                <span className="text-base font-bold text-amber-600 dark:text-amber-300">
                  {previewSummary.lineLengthM} m
                </span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Prof. Teórica</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-300">
                  ~{previewSummary.approxDepthM} m
                </span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Tiempo Estimado</span>
                <span className="text-base font-bold text-purple-600 dark:text-purple-300">
                  {previewSummary.estimatedMinutes} min
                </span>
              </div>
              <div
                className={`p-2.5 rounded border ${
                  isSunlightMode ? 'bg-white border-black' : 'bg-[#0d1829] border-[#1a2d48]'
                }`}
              >
                <span className="text-[10px] font-bold uppercase opacity-70 block">Memoria R8</span>
                <span className="text-base font-bold text-blue-600 dark:text-blue-300">
                  {previewSummary.memoryPct}%
                </span>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Upload Custom CMD Sequence */}
      <div
        className={`rounded-xl border p-5 shadow-xl transition-colors ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0b1320] border-[#1e2e46] text-white'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <FileUp className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Secuencias Propietarias .CMD (AGI Command Creator)
          </h3>
        </div>
        <p className="text-xs opacity-80 mb-3">
          Permite cargar scripts de roll-along o matrices mixtas generadas en software de gabinete.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase mb-1 opacity-80">
              Nombre de Archivo (.cmd)
            </label>
            <input
              type="text"
              value={cmdFileName}
              onChange={(e) => setCmdFileName(e.target.value)}
              className={`w-full rounded-lg px-3 py-2 text-xs font-mono border font-bold focus:outline-none mb-2 ${
                isSunlightMode ? 'bg-slate-100 border-black text-black' : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            />
            <button
              onClick={handleUploadCmd}
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors border ${
                isSunlightMode
                  ? 'bg-black text-white border-black hover:bg-slate-800'
                  : 'bg-[#1a2c49] text-indigo-200 border-indigo-500/30 hover:bg-[#253f69]'
              }`}
            >
              Guardar en Memoria R8
            </button>
            {cmdUploadMsg && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-2">
                {cmdUploadMsg}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase mb-1 opacity-80">
              Contenido de Disparos (A, B, M, N por renglón)
            </label>
            <textarea
              rows={4}
              value={cmdFileContent}
              onChange={(e) => setCmdFileContent(e.target.value)}
              placeholder="1, 2, 3, 4&#10;1, 2, 4, 5&#10;1, 2, 5, 6"
              className={`w-full rounded-lg p-2.5 text-xs font-mono border focus:outline-none ${
                isSunlightMode ? 'bg-slate-100 border-black text-black' : 'bg-[#070e17] border-[#1b2e49] text-white'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
