import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../api/client';

type Estado = 'operativo' | 'caido' | 'sin_datos';

interface StatusItem {
  nombre: string | null;
  url: string;
  estado: Estado;
}

const detallesEstado: Record<Estado, { etiqueta: string; clase: string }> = {
  operativo: {
    etiqueta: 'Operativo',
    clase: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  },
  caido: {
    etiqueta: 'Caído',
    clase: 'border-red-500/20 bg-red-500/10 text-red-400',
  },
  sin_datos: {
    etiqueta: 'Sin datos',
    clase: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  },
};

export default function GlobalStatus() {
  const [items, setItems] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const response = await api.get<StatusItem[]>('/status/global', { timeout: 10000 });
        if (active) {
          setItems(response.data);
          setError('');
        }
      } catch (err: unknown) {
        if (active) {
          const detail = isAxiosError<{ detail?: string }>(err)
            ? err.response?.data?.detail
            : undefined;
          setError(detail || 'No se pudo cargar el estado global. Intenta de nuevo más tarde.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchStatus();
    const interval = window.setInterval(() => void fetchStatus(), 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[450px] w-[900px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[160px]" />
      <div className="pointer-events-none fixed bottom-[-150px] left-1/2 z-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/[0.12] blur-[140px]" />

      <header className="relative z-10 flex w-full items-center justify-between p-6">
        <div className="font-mono text-sm font-semibold uppercase tracking-widest text-gray-400">
          Sentinela
        </div>
        <a
          href="https://app.sentinela.my/"
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-gray-300 shadow-lg backdrop-blur-md transition-all hover:bg-white/[0.08] hover:text-white"
        >
          Volver a inicio
        </a>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-8">
        <div className="mb-8">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-gray-400">
            Sentinela · Estado público
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Estado global</h1>
          <p className="mt-3 text-sm text-gray-400">
            Disponibilidad de los servicios verificados incluidos en el estado global.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-12 text-center font-mono text-sm text-gray-400">
            Cargando estado de los servicios...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-10 text-center">
            <h2 className="font-semibold text-white">Aún no hay servicios en el estado global</h2>
            <p className="mt-2 text-sm text-gray-400">
              Los servicios verificados que sus propietarios incluyan aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const status = detallesEstado[item.estado];
              return (
                <li
                  key={item.url}
                  className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    {item.nombre && <p className="truncate font-medium text-white">{item.nombre}</p>}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block truncate text-sm text-gray-400 transition-colors hover:text-gray-200 ${item.nombre ? 'mt-1' : ''}`}
                    >
                      {item.url}
                    </a>
                  </div>
                  <span
                    className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${status.clase}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {status.etiqueta}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
