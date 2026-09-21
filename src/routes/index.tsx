import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [Sim, setSim] = useState<ComponentType | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@/game/LunarSim").then((mod) => {
      if (alive) setSim(() => mod.LunarSim);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!Sim) return <BootShell />;
  return <Sim />;
}

function BootShell() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
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
            disabled
            className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg opacity-70"
          >
            Caricamento ambiente…
          </button>
        </div>
      </div>
    </div>
  );
}
