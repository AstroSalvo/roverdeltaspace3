import { Camera, Gauge, RotateCcw, Triangle } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { WHEEL_COUNT } from "./constants";
import { createEngine, EMPTY_HUD, type EngineHandle, type HudSnapshot } from "./engine";

const CAM_LABELS = ["Inseguimento", "Alta", "Vicina", "POV"];

function useEngineHud(engine: EngineHandle | null): HudSnapshot {
  return useSyncExternalStore(
    (cb) => (engine ? engine.subscribe(cb) : () => {}),
    () => engine?.getHud() ?? EMPTY_HUD,
    () => EMPTY_HUD,
  );
}

function fmt(n: number, d = 1) {
  return n.toFixed(d);
}

function deg(rad: number) {
  return ((rad * 180) / Math.PI).toFixed(0);
}

function heading(yaw: number) {
  const d = ((-yaw * 180) / Math.PI + 360) % 360;
  return d.toFixed(0);
}

export function LunarSim() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const [engine, setEngine] = useState<EngineHandle | null>(null);
  const [started, setStarted] = useState(false);
  const hud = useEngineHud(engine);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = createEngine(canvas, () => {});
    engineRef.current = handle;
    setEngine(handle);
    return () => {
      handle.dispose();
      engineRef.current = null;
      setEngine(null);
    };
  }, []);

  const start = useCallback(() => {
    engineRef.current?.setPlaying(true);
    setStarted(true);
    wrapRef.current?.focus();
  }, []);

  useEffect(() => {
    if (started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "KeyW" || e.code === "Space") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, start]);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      className="relative h-dvh w-full overflow-hidden bg-bg text-fg outline-none"
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {started ? <Hud hud={hud} engine={engine} /> : <StartOverlay onStart={start} />}
      {started ? <TouchPad engine={engine} /> : null}
    </div>
  );
}

function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-end justify-center bg-bg/55 p-4 pb-8 sm:items-center sm:pb-4">
      <div className="w-full max-w-lg rounded-xl border border-line bg-surface/90 p-6 sm:p-8">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          DeltaSpace · Ambiente di sviluppo 2026
        </p>
        <h1 className="mt-3 font-sans text-2xl font-medium tracking-tight text-fg sm:text-3xl">
          Ambiente di Sviluppo
          <span className="mt-1 block text-xl sm:text-2xl">Rover DeltaSpace 2026</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Banco di prova della regolite. Rover a quattro gambe indipendenti: ogni ruota segue la
          superficie reale della roccia, senza attraversarla.
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-2 font-mono text-xs text-faint sm:text-sm">
          <li className="rounded-md border border-line bg-elevated px-3 py-2 text-muted">
            WASD / frecce — guida
          </li>
          <li className="rounded-md border border-line bg-elevated px-3 py-2 text-muted">
            Spazio — stiva alta
          </li>
          <li className="rounded-md border border-line bg-elevated px-3 py-2 text-muted">
            Ctrl — accovaccia
          </li>
          <li className="rounded-md border border-line bg-elevated px-3 py-2 text-muted">
            C camera / POV · R reset
          </li>
        </ul>
        <button
          type="button"
          onClick={onStart}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-opacity duration-150 ease-out hover:opacity-90"
        >
          Avvia ambiente
        </button>
      </div>
    </div>
  );
}

function Hud({ hud, engine }: { hud: HudSnapshot; engine: EngineHandle | null }) {
  const kmh = Math.abs(hud.speed) * 3.6;
  const adapting = hud.maxLift > 0.12;
  const camName = CAM_LABELS[hud.camera] ?? "Camera";

  return (
    <>
      {hud.pov ? <PovFrame /> : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="rounded-lg border border-line bg-surface/80 px-3 py-2">
          <p className="font-mono text-xs tracking-widest text-faint uppercase">DeltaSpace 2026</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {fmt(hud.x, 1)} m · {fmt(hud.z, 1)} m
          </p>
        </div>
        <div className="flex gap-2">
          <Stat icon={<Gauge className="size-3.5" />} label="Velocità" value={`${fmt(kmh, 1)} km/h`} />
          <Stat icon={<Triangle className="size-3.5" />} label="Prua" value={`${heading(hud.yaw)}°`} />
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 bottom-28 left-3 z-10 flex flex-col gap-3 sm:right-auto sm:bottom-4 sm:left-4 sm:w-[22rem]">
        <div className="rounded-lg border border-line bg-surface/80 p-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-widest text-faint uppercase">
              Sollevamento ruote
            </p>
            <p className={`font-mono text-xs ${adapting ? "text-ok" : "text-faint"}`}>
              {adapting ? "Gambe in adattamento" : "Regolite piana"}
            </p>
          </div>
          <div className="mt-3 flex items-end gap-2">
            {hud.wheels.map((w) => (
              <WheelBar key={w.id} wheel={w} />
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-xs text-faint">
            <span>g 1.62 m/s²</span>
            <span>
              pitch {deg(hud.pitch)}° · roll {deg(hud.roll)}°
            </span>
            <span>
              {hud.contacts}/{WHEEL_COUNT} contatto
            </span>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute top-3 right-3 z-10 hidden flex-col gap-2 sm:top-4 sm:right-4 sm:flex">
        <IconBtn label={`Camera ${camName}`} onClick={() => engine?.cycleCamera()}>
          <Camera className="size-4" />
        </IconBtn>
        <IconBtn label="Reset" onClick={() => engine?.reset()}>
          <RotateCcw className="size-4" />
        </IconBtn>
        <p className="pointer-events-none text-center font-mono text-[10px] tracking-widest text-faint uppercase">
          {camName}
        </p>
      </div>
    </>
  );
}

function PovFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[9]">
      <div className="absolute top-16 left-1/2 -translate-x-1/2 font-mono text-xs tracking-[0.28em] text-fg/70 uppercase">
        CAM · POV
      </div>
      <div className="absolute top-[18%] left-[8%] size-8 border-t border-l border-fg/35" />
      <div className="absolute top-[18%] right-[8%] size-8 border-t border-r border-fg/35" />
      <div className="absolute bottom-[22%] left-[8%] size-8 border-b border-l border-fg/35" />
      <div className="absolute bottom-[22%] right-[8%] size-8 border-b border-r border-fg/35" />
      <div className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-x-0 top-1/2 h-px bg-fg/40" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-fg/40" />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface/80 px-3 py-2">
      <p className="flex items-center gap-1.5 font-mono text-xs tracking-widest text-faint uppercase">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-fg">{value}</p>
    </div>
  );
}

function WheelBar({
  wheel,
}: {
  wheel: { id: string; label: string; lift: number; compression: number };
}) {
  const h = Math.min(1, wheel.lift / 0.7);
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="relative h-16 w-full overflow-hidden rounded-sm bg-elevated">
        <div
          className="absolute inset-x-0 bottom-0 bg-primary"
          style={{ height: `${Math.max(6, h * 100)}%`, opacity: 0.35 + h * 0.65 }}
        />
      </div>
      <span className="font-mono text-xs text-faint">{wheel.id}</span>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-md border border-line bg-surface text-fg transition-opacity duration-150 hover:opacity-90"
    >
      {children}
    </button>
  );
}

function TouchPad({ engine }: { engine: EngineHandle | null }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const el = stickRef.current;
      if (!el || !engine) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const max = r.width * 0.38;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const m = Math.hypot(dx, dy);
      if (m > max && m > 0) {
        dx = (dx / m) * max;
        dy = (dy / m) * max;
      }
      const nx = dx / max;
      const ny = dy / max;
      setKnob({ x: dx, y: dy, active: true });
      engine.setTouch(-ny, -nx, true);
    },
    [engine],
  );

  const end = useCallback(() => {
    setKnob({ x: 0, y: 0, active: false });
    engine?.setTouch(0, 0, false);
  }, [engine]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-end justify-between px-4 sm:hidden">
      <div
        ref={stickRef}
        className="pointer-events-auto relative size-28 rounded-full border border-line bg-surface/70"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!knob.active && !(e.buttons & 1)) return;
          apply(e.clientX, e.clientY);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          className="absolute top-1/2 left-1/2 size-11 rounded-full bg-primary/80"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
      <div className="pointer-events-auto flex flex-col gap-2">
        <IconBtn label="Camera" onClick={() => engine?.cycleCamera()}>
          <Camera className="size-4" />
        </IconBtn>
        <IconBtn label="Reset" onClick={() => engine?.reset()}>
          <RotateCcw className="size-4" />
        </IconBtn>
      </div>
    </div>
  );
}
