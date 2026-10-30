import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  BatteryMedium,
  Play,
  Pause,
  Square,
  StepForward,
  RotateCcw,
  Sliders,
  Activity,
  FolderArchive,
  Bot,
  Layers,
  MapPin,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  BookOpen,
  RefreshCw,
  Radio,
  X,
  ChevronUp,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Pseudosection } from './components/Pseudosection';
import { ContactTestView } from './components/ContactTestView';
import { SurveyConfigView } from './components/SurveyConfigView';
import { FilesView } from './components/FilesView';
import { AIAssistantView } from './components/AIAssistantView';
import { RollAlongModal } from './components/RollAlongModal';
import { FieldNotesModal, FieldNote } from './components/FieldNotesModal';
import { ReportModal } from './components/ReportModal';
import { SurveyFinalizedModal } from './components/SurveyFinalizedModal';
import { QuadripolePoint, SequenceConfig } from './utils/ert-math';
import { beeper } from './utils/audio-beeper';

interface InstrumentStatus {
  connected: boolean;
  connecting: boolean;
  ssid: string;
  ip: string;
  signalDbm: number;
  firmware: string;
  batteryInternal: number;
  batteryExternal: number;
  gpsStatus: string;
  gpsSatellites: number;
  transmitterPowerW: number;
  maxVoltageVp: number;
  channels: number;
  temperatureC: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'survey' | 'contact' | 'config' | 'files' | 'ai'>('survey');
  const [isSunlightMode, setIsSunlightMode] = useState(false);
  const [showChannelsDrawer, setShowChannelsDrawer] = useState(false);

  // Modals
  const [isRollAlongOpen, setIsRollAlongOpen] = useState(false);
  const [isFieldNotesOpen, setIsFieldNotesOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isFinalizedModalOpen, setIsFinalizedModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 4500);
  };

  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>([
    {
      id: '1',
      stationOrElectrode: 'Pica #18',
      timestamp: '10:14',
      text: 'Zona de suelo seco pedregoso; humectado con solución salina.',
      category: 'contact',
    },
    {
      id: '2',
      stationOrElectrode: 'Pica #41',
      timestamp: '10:28',
      text: 'Afloramiento de cuarcitas con fracturas subverticales.',
      category: 'geology',
    },
  ]);

  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    beeper.enabled = !soundMuted;
  }, [soundMuted]);

  useEffect(() => {
    if (isSunlightMode) {
      document.body.classList.add('sunlight-mode');
    } else {
      document.body.classList.remove('sunlight-mode');
    }
  }, [isSunlightMode]);

  // Telemetry state
  const [instrument, setInstrument] = useState<InstrumentStatus>({
    connected: true,
    connecting: false,
    ssid: 'SuperSting-R8',
    ip: '192.168.1.1',
    signalDbm: -58,
    firmware: '4.2',
    batteryInternal: 12.6,
    batteryExternal: 12.4,
    gpsStatus: '3D Fix',
    gpsSatellites: 9,
    transmitterPowerW: 200,
    maxVoltageVp: 800,
    channels: 8,
    temperatureC: 28.4,
  });

  // Survey session state
  const [isRunning, setIsRunning] = useState(false);
  const [points, setPoints] = useState<QuadripolePoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [lastBatch, setLastBatch] = useState<QuadripolePoint[]>([]);
  const [activeElectrodes, setActiveElectrodes] = useState<{ tx: number[]; rx: number[] }>({
    tx: [],
    rx: [],
  });

  // Survey configuration
  const [config, setConfig] = useState<SequenceConfig & { jobName: string }>({
    jobName: 'LINEA01',
    arrayType: 'dd',
    electrodes: 56,
    spacing: 5,
    nMax: 8,
    maxCurrent: 500,
    measureTime: 1.2,
    isIP: false,
    ipCycle: 2,
    stackCycles: 4,
    errorThreshold: 2.0,
  });

  // Contact test results
  const [contactSummary, setContactSummary] = useState<any | null>(null);
  const [isLoadingContact, setIsLoadingContact] = useState(false);

  // Pseudosection display options
  const [viewMode, setViewMode] = useState<'rho' | 'ip'>('rho');
  const [selectedPoint, setSelectedPoint] = useState<QuadripolePoint | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchState = async () => {
    try {
      const [instRes, surveyRes] = await Promise.all([
        fetch('/api/instrument/status'),
        fetch('/api/survey/state'),
      ]);
      const instData = await instRes.json();
      const surveyData = await surveyRes.json();

      if (instData.status === 'ok') setInstrument(instData.instrument);
      if (surveyData.status === 'ok') {
        setIsRunning(surveyData.isRunning);
        setCurrentIndex(surveyData.currentIndex);
        setTotalPoints(surveyData.totalPoints);
        setPoints(surveyData.points || []);
        setConfig(surveyData.config);
        setActiveElectrodes(surveyData.activeElectrodes || { tx: [], rx: [] });
        setLastBatch(surveyData.lastBatch || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchState();

    const es = new EventSource('/api/survey/events');
    eventSourceRef.current = es;

    es.addEventListener('shot_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCurrentIndex(data.currentIndex);
        setTotalPoints(data.totalPoints);
        setActiveElectrodes(data.activeElectrodes || { tx: [], rx: [] });
        setLastBatch(data.batch || []);
        if (data.batch) {
          beeper.playShotBeep();
          setPoints((prev) => {
            const next = [...prev];
            data.batch.forEach((pt: QuadripolePoint, idx: number) => {
              const globalIdx = data.currentIndex - data.batch.length + idx;
              next[globalIdx] = pt;
            });
            return next;
          });
        }
        if (data.batteryInternal) {
          setInstrument((prev) => ({
            ...prev,
            batteryInternal: data.batteryInternal,
            batteryExternal: data.batteryExternal ?? prev.batteryExternal,
          }));
        }
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('survey_started', () => {
      setIsRunning(true);
      fetchState();
    });

    es.addEventListener('survey_paused', () => setIsRunning(false));
    es.addEventListener('survey_stopped', () => {
      setIsRunning(false);
      fetchState();
    });
    es.addEventListener('survey_completed', () => {
      setIsRunning(false);
      beeper.playCompletionChirp();
      fetchState();
    });

    es.addEventListener('remeasure_completed', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        fetchState();
        beeper.playShotBeep();
        if (data.remeasuredCount > 0) {
          showToast(`✓ Remedición completada: ${data.remeasuredCount} puntos actualizados. Error reducido a ${data.newAvgErr}%.`, 'success');
        }
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('instrument_state', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setInstrument((prev) => ({ ...prev, ...data }));
      } catch (err) {
        console.error(err);
      }
    });

    es.addEventListener('contact_test_results', (e: MessageEvent) => {
      try {
        const summary = JSON.parse(e.data);
        setContactSummary(summary);
        if (summary.over10k > 0) beeper.playWarningBuzz();
      } catch (err) {
        console.error(err);
      }
    });

    const interval = setInterval(() => {
      fetch('/api/instrument/status')
        .then((r) => r.json())
        .then((d) => {
          if (d.status === 'ok') setInstrument(d.instrument);
        })
        .catch(() => {});
    }, 5000);

    return () => {
      clearInterval(interval);
      es.close();
    };
  }, []);

  const toggleConnection = async () => {
    try {
      const action = instrument.connected ? 'disconnect' : 'connect';
      const res = await fetch('/api/instrument/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setInstrument((prev) => ({ ...prev, connected: data.connected }));
        if (!data.connected) setIsRunning(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartSurvey = async () => {
    try {
      const res = await fetch('/api/survey/start', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        setIsRunning(true);
        beeper.playShotBeep();
        showToast('✓ Adquisición iniciada. Disparando secuencia multicanal...', 'info');
        fetchState();
      } else if (data.error) {
        showToast(`Aviso: ${data.error}`, 'warning');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de conexión con el SuperSting.', 'warning');
    }
  };

  const handlePauseSurvey = async () => {
    try {
      const res = await fetch('/api/survey/pause', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        setIsRunning(false);
        showToast('Adquisición en pausa.', 'info');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopSurvey = async () => {
    try {
      const res = await fetch('/api/survey/stop', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        setIsRunning(false);
        beeper.playCompletionChirp();
        await fetchState();
        setIsFinalizedModalOpen(true);
        showToast(
          `✓ Línea finalizada. ${data.recordedPoints || points.length} puntos guardados en ${data.filename || config.jobName + '.stg'}.`,
          'success'
        );
      }
    } catch (e) {
      console.error(e);
      showToast('Error al comunicar finalización con el instrumento.', 'warning');
    }
  };

  const handleStepSurvey = async () => {
    try {
      const res = await fetch('/api/survey/step', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        beeper.playShotBeep();
        showToast(`Disparo de 8 canales completado (+8 lecturas).`, 'info');
        fetchState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemeasure = async () => {
    try {
      showToast('Ejecutando remedición de puntos ruidosos (restacking)...', 'info');
      const res = await fetch('/api/survey/remeasure', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        beeper.playShotBeep();
        await fetchState();
        if (data.remeasuredCount > 0) {
          showToast(
            `✓ Remedición exitosa: ${data.remeasuredCount} puntos recalculados. Error promedio reducido a ${data.newAvgErr}%.`,
            'success'
          );
        } else {
          showToast(
            `✓ Control QC Óptimo: Todos los puntos tienen error < ${data.threshold}%. Sin anomalías detectadas.`,
            'info'
          );
        }
      }
    } catch (e) {
      console.error(e);
      showToast('Error al comunicar con el equipo para remedir.', 'warning');
    }
  };

  const handleRunContactTest = async () => {
    setIsLoadingContact(true);
    try {
      const res = await fetch('/api/instrument/contact-test', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok') {
        setContactSummary(data.summary);
        if (data.summary.over10k > 0) beeper.playWarningBuzz();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingContact(false);
    }
  };

  const handleSaveConfig = async (newCfg: SequenceConfig & { jobName: string }) => {
    try {
      const res = await fetch('/api/survey/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCfg),
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setConfig(data.config);
        fetchState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNote = (note: Omit<FieldNote, 'id' | 'timestamp'>) => {
    const newNote: FieldNote = {
      ...note,
      id: `${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setFieldNotes((prev) => [newNote, ...prev]);
  };

  const handleDeleteNote = (id: string) => {
    setFieldNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleApplyRollAlong = async (newJobName: string) => {
    const updated = { ...config, jobName: newJobName };
    await handleSaveConfig(updated);
  };

  const progressPct = totalPoints > 0 ? Math.round((currentIndex / totalPoints) * 100) : 0;
  const avgError =
    points.length > 0
      ? (points.reduce((acc, p) => acc + (p.err || 0), 0) / points.length).toFixed(2)
      : '0.00';

  return (
    <div
      className={`h-[100dvh] w-full max-h-[100dvh] flex flex-col overflow-hidden select-none transition-colors font-sans ${
        isSunlightMode ? 'bg-[#f8fafc] text-black' : 'bg-[#06090f] text-[#dce7f5]'
      }`}
    >
      {/* 1. Executive Instrument Top Telemetry Bezel (40px) */}
      <header
        className={`h-10 px-2 sm:px-4 flex items-center justify-between border-b shrink-0 z-30 transition-colors shadow-md ${
          isSunlightMode
            ? 'bg-white border-black text-black'
            : 'bg-gradient-to-r from-[#0a101b] via-[#0e1726] to-[#0a101b] border-[#18273e] text-white'
        }`}
      >
        {/* Brand & Connection Instrument Tag */}
        <div className="flex items-center gap-2">
          <div
            className={`px-1.5 py-0.5 rounded flex items-center gap-1.5 font-mono font-bold text-xs border tracking-wider shadow-sm ${
              isSunlightMode
                ? 'bg-black text-white border-black'
                : 'bg-gradient-to-b from-sky-500/20 to-blue-700/30 text-sky-300 border-sky-400/40 shadow-sky-950/40'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="tracking-tighter">R8/IP</span>
          </div>

          <div className="flex flex-col">
            <span className="font-extrabold text-xs tracking-tight uppercase leading-none">SuperSting</span>
            <span className="hidden sm:inline text-[8px] font-mono opacity-50 tracking-widest uppercase">8-CH MULTICHANNEL</span>
          </div>

          {/* Wi-Fi Status Tag */}
          <button
            onClick={toggleConnection}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
              instrument.connected
                ? isSunlightMode
                  ? 'bg-emerald-100 text-emerald-950 border-black'
                  : 'bg-[#092219] text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-950/40'
                : isSunlightMode
                ? 'bg-red-100 text-red-950 border-black'
                : 'bg-[#291017] text-rose-300 border-rose-500/60'
            }`}
          >
            {instrument.connected ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="hidden xs:inline">Conectado ({instrument.signalDbm}dBm)</span>
                <span className="xs:hidden">Enlace</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-500" />
                <span className="hidden xs:inline">Sin Enlace</span>
                <span className="xs:hidden">Off</span>
              </>
            )}
          </button>
        </div>

        {/* Center Hardware Telemetry HUD (Tablet / Desktop view) */}
        <div className="hidden md:flex items-center gap-4 text-[10px] font-mono font-semibold opacity-90">
          <div className="flex items-center gap-1.5">
            <BatteryMedium className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              BAT: <strong className="text-emerald-400">{instrument.batteryInternal}V</strong> (Ext: {instrument.batteryExternal}V)
            </span>
          </div>

          <span className="opacity-30">│</span>

          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>
              GPS: <strong className="text-amber-400">{instrument.gpsStatus}</strong> ({instrument.gpsSatellites} SATS)
            </span>
          </div>

          <span className="opacity-30">│</span>

          <div className="flex items-center gap-1">
            <span>TX: <strong className="text-cyan-400">{instrument.transmitterPowerW}W</strong></span>
            <span className="opacity-60">·</span>
            <span>{instrument.temperatureC}°C</span>
          </div>
        </div>

        {/* Quick Instrument Utilities (Sunlight Mode, QC, Notes, Sound) */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          {/* Sunlight Mode Toggle Button */}
          <button
            onClick={() => setIsSunlightMode(!isSunlightMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded border font-bold cursor-pointer transition-all ${
              isSunlightMode
                ? 'bg-amber-400 text-black border-black shadow'
                : 'bg-[#101b2c] text-amber-300 border-amber-500/40 hover:bg-[#182942]'
            }`}
            title="Modo Sol Alto Contraste"
          >
            {isSunlightMode ? <Sun className="w-3 h-3 fill-current text-black" /> : <Moon className="w-3 h-3 text-amber-400" />}
            <span className="hidden sm:inline">{isSunlightMode ? 'Sol' : 'Noche'}</span>
          </button>

          {/* Field Notes Modal Button */}
          <button
            onClick={() => setIsFieldNotesOpen(true)}
            className={`px-2 py-1 rounded border font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              isSunlightMode
                ? 'bg-slate-100 border-black text-black'
                : 'bg-[#101b2c] border-[#1d2f4a] text-slate-200 hover:text-white'
            }`}
            title="Libreta de Notas de Terreno"
          >
            <BookOpen className="w-3 h-3 text-amber-400" />
            <span className="hidden lg:inline">Notas ({fieldNotes.length})</span>
          </button>

          {/* QC Campaign Report Modal Button */}
          <button
            onClick={() => setIsReportOpen(true)}
            className={`px-2 py-1 rounded border font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              isSunlightMode
                ? 'bg-emerald-100 border-black text-emerald-950'
                : 'bg-[#0a201b] border-emerald-500/50 text-emerald-300 hover:bg-[#0e2a24]'
            }`}
            title="Certificado de Campaña y Control de Calidad (QC)"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="hidden md:inline">Reporte QC</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className={`p-1 rounded border cursor-pointer transition-colors ${
              isSunlightMode ? 'border-black hover:bg-slate-200' : 'border-[#18283e] hover:bg-slate-800'
            }`}
            title={soundMuted ? 'Beeper silenciado' : 'Beeper activo'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* Floating High-Contrast Toast Notification */}
      {toast && (
        <div className="absolute top-11 inset-x-2 z-50 flex justify-center pointer-events-none animate-in fade-in duration-200">
          <div
            className={`pointer-events-auto px-4 py-2.5 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-mono font-bold max-w-lg ${
              toast.type === 'success'
                ? isSunlightMode
                  ? 'bg-emerald-100 text-emerald-950 border-black ring-1 ring-black'
                  : 'bg-[#081f18] text-emerald-200 border-emerald-400 shadow-emerald-950/70 ring-1 ring-emerald-500/30'
                : toast.type === 'warning'
                ? isSunlightMode
                  ? 'bg-amber-100 text-amber-950 border-black ring-1 ring-black'
                  : 'bg-[#291b0c] text-amber-200 border-amber-400 shadow-amber-950/70 ring-1 ring-amber-500/30'
                : isSunlightMode
                ? 'bg-slate-100 text-slate-950 border-black ring-1 ring-black'
                : 'bg-[#0d1c30] text-cyan-200 border-cyan-400 shadow-cyan-950/70 ring-1 ring-cyan-500/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => setToast(null)} className="p-0.5 hover:opacity-75 shrink-0 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Executive Stage (Fitted 100% viewport) */}
      <div className="flex-1 min-h-0 flex flex-col p-1 sm:p-2 overflow-hidden">
        {activeTab === 'survey' && (
          <div className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-hidden">
            {/* Top Command Context Bar */}
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center justify-between text-[10px] sm:text-[11px] font-mono shrink-0 shadow-sm ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#0a101b] border-[#18273e] text-white'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-extrabold text-cyan-400 text-xs sm:text-sm tracking-tight">{config.jobName}</span>
                <span className="opacity-40">│</span>
                <span className="opacity-80">
                  {config.arrayType.toUpperCase()} · {config.electrodes} Picas (Δa={config.spacing}m)
                </span>
                <span className="hidden sm:inline opacity-40">│</span>
                <span className="hidden sm:inline font-bold text-purple-400">
                  {config.isIP ? 'POLARIZACIÓN INDUCIDA (TDIP)' : 'RESISTIVIDAD MULTICANAL'}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <span>
                  Progreso: <strong className="text-cyan-400">{progressPct}%</strong> ({currentIndex}/{totalPoints})
                </span>
                <span className="hidden xs:inline opacity-40">│</span>
                <span className="hidden xs:inline">
                  RMS Err: <strong className={Number(avgError) > 2 ? 'text-amber-400' : 'text-emerald-400'}>{avgError}%</strong>
                </span>
                <span className="opacity-40">│</span>
                <span
                  className={`font-bold flex items-center gap-1.5 ${
                    isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRunning ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  {isRunning ? 'ADQUIRIENDO' : 'LISTO'}
                </span>
              </div>
            </div>

            {/* Middle Main Pseudosection Graph (Takes remaining vertical space!) */}
            <Pseudosection
              points={points}
              totalElectrodes={config.electrodes}
              spacing={config.spacing}
              activeElectrodes={activeElectrodes}
              selectedPoint={selectedPoint}
              onSelectPoint={setSelectedPoint}
              viewMode={viewMode}
              onToggleViewMode={setViewMode}
              errorThreshold={config.errorThreshold || 2.0}
              isSunlightMode={isSunlightMode}
              fieldNotes={fieldNotes}
              lastBatch={lastBatch}
            />

            {/* Bottom Docked Field Control Strip */}
            <div
              className={`p-2 rounded-xl border flex flex-col gap-2 shrink-0 shadow-xl ${
                isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#09101a] border-[#18273e] text-white'
              }`}
            >
              {/* Single-Line Glowing Progress Bar */}
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden border ${
                  isSunlightMode ? 'bg-slate-200 border-black' : 'bg-[#060b13] border-[#142033]'
                }`}
              >
                <div
                  style={{ width: `${progressPct}%` }}
                  className={`h-full transition-all duration-300 ${
                    isSunlightMode ? 'bg-black' : 'bg-gradient-to-r from-blue-600 via-sky-400 to-emerald-400'
                  }`}
                />
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                {/* Primary Large Play/Pause Button */}
                {!isRunning ? (
                  <button
                    onClick={handleStartSurvey}
                    disabled={!instrument.connected}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold min-h-[42px] cursor-pointer btn-tactile border ${
                      !instrument.connected
                        ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 border-slate-400 cursor-not-allowed'
                        : isSunlightMode
                        ? 'bg-black text-white border-black hover:bg-slate-800'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white border-emerald-400/60 shadow-lg shadow-emerald-950/60'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current text-white" />
                    <span>INICIAR DISPAROS</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePauseSurvey}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold min-h-[42px] cursor-pointer btn-tactile bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white border border-amber-400/60 shadow-lg shadow-amber-950/60"
                  >
                    <Pause className="w-4 h-4 fill-current text-white" />
                    <span>PAUSAR ADQUISICIÓN</span>
                  </button>
                )}

                {/* Secondary Fast Burst Buttons */}
                <button
                  onClick={handleStepSurvey}
                  disabled={isRunning}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold min-h-[42px] border cursor-pointer btn-tactile flex items-center gap-1.5 ${
                    isSunlightMode
                      ? 'bg-slate-100 hover:bg-slate-200 border-black text-black'
                      : 'bg-[#101b2c] hover:bg-[#182840] border-[#1d2f4a] text-slate-100'
                  }`}
                  title="Disparo manual individual de 8 canales"
                >
                  <StepForward className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Paso (8CH)</span>
                  <span className="sm:hidden">Paso</span>
                </button>

                <button
                  onClick={handleRemeasure}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold min-h-[42px] border cursor-pointer btn-tactile flex items-center gap-1.5 ${
                    isSunlightMode
                      ? 'bg-amber-100 hover:bg-amber-200 border-black text-black font-extrabold'
                      : 'bg-[#1e1a14] hover:bg-[#2b241c] border-amber-500/50 text-amber-300'
                  }`}
                  title="Remedir puntos ruidosos (error repeat > 2%)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Remedir</span>
                </button>

                <button
                  onClick={handleStopSurvey}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold min-h-[42px] border cursor-pointer btn-tactile flex items-center gap-1.5 ${
                    isSunlightMode
                      ? 'bg-rose-100 hover:bg-rose-200 border-black text-rose-950 font-extrabold'
                      : 'bg-[#241318] hover:bg-[#331b22] border-rose-500/50 text-rose-300'
                  }`}
                  title="Finalizar levantamiento y generar archivo .STG"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
                  <span className="hidden sm:inline">Finalizar</span>
                </button>

                {/* Roll-Along Button */}
                <button
                  onClick={() => setIsRollAlongOpen(true)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold min-h-[42px] border cursor-pointer btn-tactile hidden sm:flex items-center gap-1.5 ${
                    isSunlightMode
                      ? 'bg-slate-100 border-black text-black'
                      : 'bg-[#101b2c] border-[#1d2f4a] text-blue-300 hover:bg-[#182840]'
                  }`}
                  title="Avance de Cable Roll-Along"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Roll-Along</span>
                </button>

                {/* QC Report Modal Button */}
                <button
                  onClick={() => setIsReportOpen(true)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold min-h-[42px] border cursor-pointer btn-tactile hidden xs:flex items-center gap-1.5 ${
                    isSunlightMode
                      ? 'bg-emerald-100 border-black text-emerald-950'
                      : 'bg-[#0a201b] border-emerald-500/50 text-emerald-300 hover:bg-[#0e2a24]'
                  }`}
                  title="Certificado de Campaña y Control de Calidad (QC)"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Reporte QC</span>
                </button>

                {/* 8-Channels Drawer Button */}
                {lastBatch.length > 0 && (
                  <button
                    onClick={() => setShowChannelsDrawer(!showChannelsDrawer)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold min-h-[42px] border cursor-pointer btn-tactile flex items-center gap-1.5 ${
                      showChannelsDrawer
                        ? 'bg-blue-600 text-white border-blue-400'
                        : isSunlightMode
                        ? 'bg-slate-100 border-black text-black'
                        : 'bg-[#101b2c] border-[#1d2f4a] text-cyan-400'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>8CH</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inner Scrolling for Setup, Contact Test, Files, and AI tabs */}
        {activeTab !== 'survey' && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {activeTab === 'contact' && (
              <ContactTestView
                isConnected={instrument.connected}
                contactSummary={contactSummary}
                onRunContactTest={handleRunContactTest}
                isLoadingContact={isLoadingContact}
                isSunlightMode={isSunlightMode}
              />
            )}
            {activeTab === 'config' && (
              <SurveyConfigView
                config={config}
                onSaveConfig={handleSaveConfig}
                onStartSurveyAfterConfig={() => {
                  setActiveTab('survey');
                  handleStartSurvey();
                }}
                isConnected={instrument.connected}
                isSunlightMode={isSunlightMode}
              />
            )}
            {activeTab === 'files' && <FilesView isSunlightMode={isSunlightMode} />}
            {activeTab === 'ai' && (
              <AIAssistantView
                surveyConfig={config}
                pointsCount={points.length}
                contactSummary={contactSummary}
                points={points}
                isSunlightMode={isSunlightMode}
              />
            )}
          </div>
        )}
      </div>

      {/* 3. Docked Bottom App Navigation Dock (44px) */}
      <nav
        className={`h-11 px-2 flex items-center justify-around border-t shrink-0 z-30 shadow-lg ${
          isSunlightMode ? 'bg-white border-black text-black' : 'bg-[#070b13] border-[#152338] text-[#8ca4c3]'
        }`}
      >
        <button
          onClick={() => setActiveTab('survey')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all cursor-pointer relative ${
            activeTab === 'survey'
              ? isSunlightMode
                ? 'text-black bg-slate-100 border-t-2 border-black'
                : 'text-sky-400 bg-sky-500/10 border-t-2 border-sky-400'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Adquisición</span>
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all cursor-pointer relative ${
            activeTab === 'contact'
              ? isSunlightMode
                ? 'text-black bg-slate-100 border-t-2 border-black'
                : 'text-emerald-400 bg-emerald-500/10 border-t-2 border-emerald-400'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>QC Picas</span>
          {contactSummary?.badElectrodes?.length > 0 && (
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all cursor-pointer relative ${
            activeTab === 'config'
              ? isSunlightMode
                ? 'text-black bg-slate-100 border-t-2 border-black'
                : 'text-purple-400 bg-purple-500/10 border-t-2 border-purple-400'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Tendido</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all cursor-pointer relative ${
            activeTab === 'files'
              ? isSunlightMode
                ? 'text-black bg-slate-100 border-t-2 border-black'
                : 'text-amber-400 bg-amber-500/10 border-t-2 border-amber-400'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>Archivos</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center justify-center flex-1 h-full text-[10px] font-bold transition-all cursor-pointer relative ${
            activeTab === 'ai'
              ? isSunlightMode
                ? 'text-black bg-slate-100 border-t-2 border-black'
                : 'text-indigo-400 bg-indigo-500/10 border-t-2 border-indigo-400'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Asistente IA</span>
        </button>
      </nav>

      {/* Floating 8-Channel Oscilloscope Drawer Modal */}
      {showChannelsDrawer && lastBatch.length > 0 && (
        <div className="fixed inset-x-2 bottom-14 z-50 p-3 rounded-2xl border shadow-2xl bg-[#09111d] border-blue-500/40 text-white max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-1.5 mb-2 font-mono text-xs">
            <span className="font-bold flex items-center gap-1.5 text-cyan-400">
              <Radio className="w-4 h-4" />
              Lectura Simultánea 8 Canales (A={lastBatch[0]?.p[0]} B={lastBatch[0]?.p[1]} · {lastBatch[0]?.i} mA)
            </span>
            <button onClick={() => setShowChannelsDrawer(false)} className="p-1 hover:bg-slate-800 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            {lastBatch.map((pt, idx) => (
              <div key={pt.id} className="p-2 rounded bg-[#0f1b2d] border border-[#1b2b41]">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-cyan-400 font-bold">CH{idx + 1}</span>
                  <span className={pt.err > 2 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{pt.err}%</span>
                </div>
                <div className="text-[11px] font-bold text-amber-300">{pt.rho} Ω·m</div>
                <div className="text-[9px] opacity-75">{pt.v} mV · {pt.p[2]}-{pt.p[3]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roll-Along Modal */}
      <RollAlongModal
        isOpen={isRollAlongOpen}
        onClose={() => setIsRollAlongOpen(false)}
        currentElectrodes={config.electrodes}
        spacing={config.spacing}
        currentJobName={config.jobName}
        isSunlightMode={isSunlightMode}
        onApplyRollAlong={handleApplyRollAlong}
      />

      {/* Field Notes Modal */}
      <FieldNotesModal
        isOpen={isFieldNotesOpen}
        onClose={() => setIsFieldNotesOpen(false)}
        notes={fieldNotes}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        isSunlightMode={isSunlightMode}
        totalElectrodes={config.electrodes}
      />

      {/* QC & Exploration Campaign Certificate Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        config={config}
        points={points}
        contactSummary={contactSummary}
        instrument={instrument}
        isSunlightMode={isSunlightMode}
      />

      {/* Survey Finalized Modal */}
      <SurveyFinalizedModal
        isOpen={isFinalizedModalOpen}
        onClose={() => setIsFinalizedModalOpen(false)}
        config={config}
        points={points}
        currentIndex={currentIndex}
        totalPoints={totalPoints}
        isSunlightMode={isSunlightMode}
        onOpenQCReport={() => setIsReportOpen(true)}
        onGoToFiles={() => setActiveTab('files')}
      />
    </div>
  );
}
