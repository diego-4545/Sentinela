import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { isValidMonitorId } from '../utils/monitorId';

                                           
interface UltimoCheckDetalle {
  id?: string;
  timestamp: string;
  exitoso: boolean;
  status_code: number | null;
  tiempo_respuesta_ms: number | null;
  tipo_error: string | null;
}

interface MonitorPublico {
  id: string;
  nombre: string;
  url: string;
  verified: boolean;
  ultimo_check?: UltimoCheckDetalle;
}

type Periodo = '24h' | '7d' | '30d';

interface EstadisticasPublicas {
  checks_total: number;
  checks_exitosos: number;
  checks_fallidos: number;
  porcentaje_exitosos: number | null;
  latencia_promedio_ms: number | null;
  latencia_p50_ms: number | null;
  latencia_p95_ms: number | null;
  incidentes_iniciados: number;
  incidentes_abiertos: number;
  tiempo_caido_segundos: number;
  timeline: {
    timestamp: string;
    checks: number;
    exitosos: number;
    latencia_promedio_ms: number | null;
  }[];
}

const periodos: { valor: Periodo; etiqueta: string }[] = [
  { valor: '24h', etiqueta: '24 horas' },
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
];

const fechaLocal = (timestamp: string) => {
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  return date.toLocaleString('es-MX', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
  });
};

const formatearDuracion = (totalSegundos: number) => {
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  if (horas > 0) return `${horas} h ${minutos} min`;
  if (minutos > 0) return `${minutos} min`;
  return `${totalSegundos} s`;
};

export default function PublicStatus() {
  const { id } = useParams<{ id: string }>();
  
  const [monitor, setMonitor] = useState<MonitorPublico | null>(null);
  const [estadisticas, setEstadisticas] = useState<EstadisticasPublicas | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

                                       
  const [hoveredBucket, setHoveredBucket] = useState<EstadisticasPublicas['timeline'][0] | null>(null);

  useEffect(() => {
    let active = true;
    if (!isValidMonitorId(id)) {
      setMonitor(null);
      setEstadisticas(null);
      setError('El ID del monitor no tiene un formato válido.');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const monitorResponse = await api.get(`/status/${id}`);
        
        if (active) {
          setMonitor(monitorResponse.data);
          
                                                                     
          if (monitorResponse.data.verified) {
            const statsResponse = await api.get(`/monitors/${id}/stats`, { params: { periodo } });
            setEstadisticas(statsResponse.data);
          }
          setError('');
        }
      } catch (err: any) {
        if (active) setError(err.response?.data?.detail || 'No se pudo cargar la información del servicio.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    const interval = window.setInterval(fetchData, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id, periodo]);

  if (loading && !monitor) {
    return (
      <div className="relative min-h-screen bg-[#050505] font-sans text-white">
        <div className="pointer-events-none fixed inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[450px] w-[900px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[160px]" />
        <div className="pointer-events-none fixed bottom-[-150px] left-1/2 z-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/[0.12] blur-[140px]" />

        <div className="relative z-20 flex w-full items-center justify-between p-6">
          <div className="font-mono text-sm font-semibold uppercase tracking-widest text-gray-400">
            Sentinela
          </div>
          <a
            href="https://app.sentinela.my/"
            className="rounded-full border border-blue-500/20 bg-[#0c0c0c] px-4 py-2 text-xs font-medium text-gray-300 shadow-lg transition-all hover:bg-blue-500/10 hover:text-white"
          >
            Ir a página principal
          </a>
        </div>

        <main className="relative z-10 mx-auto max-w-4xl px-6 pt-6">
          <div className="p-20 text-center font-mono text-sm text-gray-500">
            Obteniendo estado del sistema...
          </div>
        </main>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-6 py-12 text-white">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="pointer-events-none fixed left-1/2 top-[-100px] h-[450px] w-[900px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[160px]" />
        <div className="pointer-events-none fixed bottom-[-150px] left-1/2 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/[0.12] blur-[140px]" />

        <main className="relative z-10 w-full max-w-lg">
          <header className="mb-8 text-center">
            <p className="font-mono text-sm font-semibold uppercase tracking-widest text-gray-400">Sentinela</p>
          </header>

          <section className="rounded-2xl border border-white/10 bg-[#0c0c0c]/90 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.12)]">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 9v3m0 4h.01M10.3 3.9 1.9 18.1A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>

            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Estado del servicio</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Monitor no reconocido
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-gray-400">
              El ID del monitor no es válido o el monitor ya no está disponible públicamente.
            </p>
            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-white/5 bg-black/30 px-4 py-3 text-xs text-gray-500">
                {error}
              </p>
            )}

            <a
              href="https://app.sentinela.my/"
              className="mt-8 inline-flex items-center justify-center rounded-lg border border-white bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg transition-colors hover:bg-gray-200"
            >
              Ir a página principal
            </a>
          </section>

          <p className="mt-6 text-center text-xs text-gray-600">Monitoreo confiable con Sentinela</p>
        </main>
      </div>
    );
  }

  const isFailing = monitor.ultimo_check && !monitor.ultimo_check.exitoso;
  const maxChecks = estadisticas ? Math.max(1, ...estadisticas.timeline.map((b) => b.checks)) : 1;

  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
      
      {                                       }
      <div className="fixed inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-blue-500/20 blur-[160px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-500/[0.12] blur-[140px] rounded-full pointer-events-none z-0"></div>

      {                                        }
      <div className="relative z-20 w-full p-6 flex justify-between items-center">
        <div className="font-mono text-sm tracking-widest text-gray-400 uppercase font-semibold">
          Sentinela
        </div>
        
        <div className="flex items-center gap-3">
          <a
            href="https://app.sentinela.my/"
            className="px-4 py-2 rounded-full bg-[#0c0c0c] border border-blue-500/20 hover:bg-blue-500/10 text-gray-300 hover:text-white text-xs font-medium transition-all shadow-lg"
          >
            Ir a página principal
          </a>
        </div>
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pt-6">
        
        {                          }
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2">{monitor.nombre}</h1>
          <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-gray-400 hover:text-white transition-colors">
            {monitor.url}
          </a>
        </div>

        {                                  }
        <div className="bg-white/[0.02] border border-blue-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest font-semibold">Diagnóstico del último check</h2>
            
            {monitor.ultimo_check ? (
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                isFailing ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isFailing ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                Status: {isFailing ? 'Error' : 'OK'}
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/20">
                Esperando datos
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 backdrop-blur-sm">
              <p className="text-xs text-gray-500 mb-2">Tiempo de Respuesta</p>
              <p className="text-2xl font-bold text-white font-mono">
                {monitor.ultimo_check?.tiempo_respuesta_ms != null ? `${monitor.ultimo_check.tiempo_respuesta_ms} ` : '—'}
                {monitor.ultimo_check?.tiempo_respuesta_ms != null && <span className="text-lg text-gray-500 font-sans font-normal">ms</span>}
              </p>
            </div>
            
            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 backdrop-blur-sm">
              <p className="text-xs text-gray-500 mb-2">Código HTTP</p>
              <p className={`text-2xl font-bold font-mono ${isFailing ? 'text-red-400' : 'text-white'}`}>
                {monitor.ultimo_check?.status_code || monitor.ultimo_check?.tipo_error || '—'}
              </p>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 backdrop-blur-sm">
              <p className="text-xs text-gray-500 mb-2">Última revisión</p>
              <p className="text-sm font-mono text-gray-300 leading-relaxed">
                {monitor.ultimo_check ? fechaLocal(monitor.ultimo_check.timestamp) : 'Sin revisiones aún'}
              </p>
            </div>
          </div>
        </div>

        {                                                       }
        {!monitor.verified ? (
          <div className="flex flex-col items-center justify-center p-10 bg-white/[0.01] border border-white/10 backdrop-blur-sm rounded-2xl text-center shadow-2xl mt-8">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Métricas e Historial Protegidos</h2>
            <p className="text-gray-400 text-sm max-w-md">
              El historial de disponibilidad y las métricas de rendimiento de este servicio no son públicos. El administrador debe verificar la propiedad del dominio.
            </p>
          </div>
        ) : (
          estadisticas && (
            <div className="space-y-8 animate-fade-in">
              
              {                         }
              <div className="flex justify-end">
                <div className="flex shrink-0 rounded-lg border border-blue-500/20 bg-[#0c0c0c] p-1 shadow-xl">
                  {periodos.map((opcion) => (
                    <button
                      key={opcion.valor}
                      onClick={() => setPeriodo(opcion.valor)}
                      className={`rounded-md px-4 py-2 text-xs font-medium transition-colors ${periodo === opcion.valor ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                    >
                      {opcion.etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              {                          }
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.08] backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                  <p className="text-xs text-gray-500 uppercase font-mono mb-2">Checks exitosos</p>
                  <p className="text-4xl font-bold text-white">
                    {estadisticas.porcentaje_exitosos === null ? '—' : `${estadisticas.porcentaje_exitosos.toFixed(2)}%`}
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    {estadisticas.checks_exitosos} de {estadisticas.checks_total} checks
                  </p>
                </div>
                
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.08] backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                  <p className="text-xs text-gray-500 uppercase font-mono mb-2">Checks fallidos</p>
                  <p className="text-4xl font-bold text-red-400">{estadisticas.checks_fallidos}</p>
                  <p className="text-xs text-gray-400 mt-3">En el período seleccionado</p>
                </div>
                
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.08] backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                  <p className="text-xs text-gray-500 uppercase font-mono mb-2">Latencia p95</p>
                  <p className="text-4xl font-bold text-white">
                    {estadisticas.latencia_p95_ms === null ? '—' : `${estadisticas.latencia_p95_ms}`}<span className="text-xl text-gray-500 font-normal">{estadisticas.latencia_p95_ms === null ? '' : ' ms'}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    Promedio: {estadisticas.latencia_promedio_ms === null ? '—' : `${estadisticas.latencia_promedio_ms} ms`}
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.08] backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                  <p className="text-xs text-gray-500 uppercase font-mono mb-2">Incidentes iniciados</p>
                  <p className="text-4xl font-bold text-white">{estadisticas.incidentes_iniciados}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    {estadisticas.incidentes_abiertos} abiertos · {formatearDuracion(estadisticas.tiempo_caido_segundos)} de caída
                  </p>
                </div>
              </div>

              {                                          }
              <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.08] backdrop-blur-sm shadow-xl relative">
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-6">Historial de Checks Visual</h3>
                
                {                      }
                <div className="absolute top-4 right-6 min-h-[60px] z-50 pointer-events-none">
                  {hoveredBucket ? (
                    <div className="bg-[#121212] border border-white/10 rounded-lg p-3 text-xs shadow-xl animate-fade-in text-right pointer-events-auto">
                      <p className="text-gray-300 font-semibold mb-1">{fechaLocal(hoveredBucket.timestamp)}</p>
                      <p className="text-gray-400 font-mono">
                        <span className="text-emerald-400">{hoveredBucket.exitosos}</span> / {hoveredBucket.checks} exitosos
                      </p>
                      <p className="text-gray-400 font-mono mt-0.5">Latencia: {hoveredBucket.latencia_promedio_ms ?? '—'} ms</p>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 italic">Pasa el cursor sobre las barras</div>
                  )}
                </div>

                <div className="h-32 flex items-end gap-[2px] w-full mt-8">
                  {estadisticas.timeline.map((bucket) => {
                    const tasaExito = bucket.checks ? bucket.exitosos / bucket.checks : null;
                    const color = tasaExito === null ? 'bg-gray-700' : tasaExito === 1 ? 'bg-emerald-500' : tasaExito === 0 ? 'bg-red-500' : 'bg-amber-400';
                    const height = bucket.checks ? `${Math.max(10, (bucket.checks / maxChecks) * 100)}%` : '6%';
                    
                    return (
                      <div 
                        key={bucket.timestamp} 
                        onMouseEnter={() => setHoveredBucket(bucket)}
                        onMouseLeave={() => setHoveredBucket(null)}
                        className={`flex-1 min-w-0 rounded-t-sm opacity-80 hover:opacity-100 cursor-crosshair transition-opacity ${color}`} 
                        style={{ height }}
                      ></div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-3 font-mono uppercase">
                  <span>Inicio del periodo</span>
                  <span>Ahora</span>
                </div>
              </div>

            </div>
          )
        )}
      </main>
    </div>
  );
}