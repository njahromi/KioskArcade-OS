import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, HardDrive, Wifi, FolderOpen, AlertTriangle } from 'lucide-react';
import { runWebglSelfTest } from '../utils/webglSelfTest';

interface BootHealthGateProps {
  readonly onPassed: () => void;
}

const BootHealthGate: React.FC<BootHealthGateProps> = ({ onPassed }) => {
  const onPassedRef = useRef(onPassed);
  onPassedRef.current = onPassed;

  const [running, setRunning] = useState(false);
  const [mainResult, setMainResult] = useState<Awaited<
    ReturnType<typeof window.electronAPI.health.runChecks>
  > | null>(null);
  const [webgl, setWebgl] = useState<ReturnType<typeof runWebglSelfTest> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAll = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const m = await window.electronAPI.health.runChecks();
      setMainResult(m);
      const w = runWebglSelfTest();
      setWebgl(w);
      if (m.allPassed && w.ok) {
        onPassedRef.current();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void runAll();
  }, [runAll]);

  const passed = mainResult?.allPassed === true && webgl?.ok === true;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="text-amber-400" size={28} />
          <h1 className="text-2xl font-bold">System health check</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6">
          This kiosk runs a quick check before opening to the public. Use &quot;Retry&quot; after fixing any
          issues.
        </p>

        <ul className="space-y-3 mb-6 text-sm">
          <li className="flex items-center gap-2">
            <HardDrive size={18} className={mainResult?.diskOk ? 'text-emerald-400' : 'text-slate-500'} />
            <span>
              Disk free:{' '}
              {mainResult ? `${mainResult.diskFreeMb.toFixed(0)} MB` : running ? '…' : '—'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Wifi size={18} className={mainResult?.networkOk ? 'text-emerald-400' : 'text-slate-500'} />
            <span>
              Network:{' '}
              {mainResult?.networkOk
                ? mainResult.networkLatencyMs != null
                  ? `${mainResult.networkLatencyMs} ms`
                  : 'OK'
                : mainResult?.networkError ?? '—'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <FolderOpen size={18} className={mainResult?.gamesDirOk ? 'text-emerald-400' : 'text-slate-500'} />
            <span>Games folder: {mainResult ? (mainResult.gamesDirOk ? 'readable' : 'error') : '—'}</span>
          </li>
          <li className="flex items-center gap-2">
            <Activity size={18} className={webgl?.ok ? 'text-emerald-400' : 'text-slate-500'} />
            <span>WebGL: {webgl ? (webgl.ok ? 'OK' : webgl.error ?? 'failed') : '—'}</span>
          </li>
        </ul>

        {mainResult && mainResult.errors.length > 0 && (
          <div className="mb-4 rounded-lg bg-red-950/50 border border-red-800/60 p-3 text-sm text-red-100">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <ul className="list-disc pl-4 space-y-1">
                {mainResult.errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 text-sm text-red-300 flex items-center gap-2">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {!passed && (
          <button
            type="button"
            onClick={() => void runAll()}
            disabled={running}
            className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 font-semibold text-white"
          >
            {running ? 'Running checks…' : 'Retry checks'}
          </button>
        )}
      </div>
    </div>
  );
};

export default BootHealthGate;
