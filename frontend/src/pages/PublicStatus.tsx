import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

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
    const fetchData = async () => {
      try {
        setLoading(true);
        const monitorResponse = await api.get(`/monitors/${id}`);
        
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

                        
  const isFailing = monitor?.ultimo_check && !monitor.ultimo_check.exitoso;
  const maxChecks = estadisticas ? Math.max(1, ...estadisticas.timeline.map((b) => b.checks)) : 1;

                                                                       
  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
      
      {                                       }
      <div className="fixed inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[140px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-150px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-500/[0.07] blur-[140px] rounded-full pointer-events-none z-0"></div>

      {                         }
      <div className="relative z-20 w-full p-6 flex justify-between items-center">
        <div className="font-mono text-sm tracking-widest text-blue-400 uppercase font-semibold">
          Sentinela
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0c0c0c] border border-white/10 shadow-xl"
          >
            Volver al Panel
          </Link>
        </div>
      </div>

      {                        }
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-6">
        
        {loading && !monitor ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400 font-mono text-sm animate-pulse">Obteniendo estado del sistema...</div>
          </div>
        ) : error || !monitor ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20 shadow-xl max-w-md">
              {error || 'Monitor no encontrado'}
            </div>
            <Link to="/" className="mt-6 text-sm text-blue-400 hover:underline">Volver al inicio</Link>
          </div>
        ) : (
          <>
            {                          }
            <div className="mb-10 text-center sm:text-left">
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center sm:justify-start gap-3 mb-2">
                <span className="relative flex h-4 w-4">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isFailing ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-4 w-4 ${isFailing ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                </span>
                {monitor.nombre}
              </h1>
              <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-gray-400 hover:text-white hover:underline decoration-white/30 underline-offset-4 transition-colors">
                {monitor.url}
              </a>
            </div>

            {                                  }
            <div className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-sm font-mono text-gray-400 uppercase tracking-widest font-semibold">Diagnóstico del último check</h2>
                
                {monitor.ultimo_check ? (
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    isFailing ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-[#0f291e] text-emerald-400 border-emerald-500/20'
                  }`}>
                    STATUS: {isFailing ? 'ERROR' : 'OK'}
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-black/40 text-gray-400 border border-white/10">
                    STATUS: PENDIENTE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#121212] border border-white/5 rounded-xl p-5">
                  <p className="text-xs text-gray-500 mb-2 font-mono">Tiempo de Respuesta</p>
                  <p className="text-2xl font-bold text-white font-mono">
                    {monitor.ultimo_check?.tiempo_respuesta_ms != null ? `${monitor.ultimo_check.tiempo_respuesta_ms} ` : '—'}
                    {monitor.ultimo_check?.tiempo_respuesta_ms != null && <span className="text-lg text-gray-500 font-mono font-normal">ms</span>}
                  </p>
                </div>
                
                <div className="bg-[#121212] border border-white/5 rounded-xl p-5">
                  <p className="text-xs text-gray-500 mb-2 font-mono">Código HTTP</p>
                  <p className={`text-2xl font-bold font-mono ${isFailing ? 'text-red-400' : 'text-white'}`}>
                    {monitor.ultimo_check?.status_code || monitor.ultimo_check?.tipo_error || '—'}
                  </p>
                </div>

                <div className="bg-[#121212] border border-white/5 rounded-xl p-5">
                  <p className="text-xs text-gray-500 mb-2 font-mono">Última revisión</p>
                  <p className="text-sm font-mono text-gray-300 leading-relaxed mt-1">
                    {monitor.ultimo_check ? fechaLocal(monitor.ultimo_check.timestamp) : 'Sin revisiones aún'}
                  </p>
                </div>
              </div>
            </div>

            {                                                       }
            {!monitor.verified ? (
              <div className="flex flex-col items-center justify-center p-10 bg-[#0c0c0c] border border-white/[0.08] rounded-2xl text-center shadow-2xl mt-8">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
                  <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Historial Protegido</h2>
                <p className="text-gray-400 text-sm max-w-md">
                  Las métricas detalladas y el historial de este monitor están ocultos. El propietario debe verificar la propiedad del dominio.
                </p>
              </div>
            ) : (
              estadisticas && (
                <div className="space-y-8 animate-fade-in mt-10">
                  
                  {                         }
                  <div className="flex justify-end">
                    <div className="flex shrink-0 rounded-lg border border-white/10 bg-[#0c0c0c] p-1 shadow-xl">
                      {periodos.map((opcion) => (
                        <button
                          key={opcion.valor}
                          onClick={() => setPeriodo(opcion.valor)}
                          className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${periodo === opcion.valor ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                          {opcion.etiqueta}
                        </button>
                      ))}
                    </div>
                  </div>

                  {                                        }
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-white/[0.08] relative overflow-hidden group shadow-xl">
                      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                      <p className="text-xs text-gray-500 uppercase font-mono mb-2">Checks exitosos</p>
                      <p className="text-4xl font-bold text-white">
                        {estadisticas.porcentaje_exitosos === null ? '—' : `${estadisticas.porcentaje_exitosos.toFixed(2)}%`}
                      </p>
                      <p className="text-xs text-gray-400 mt-3">
                        {estadisticas.checks_exitosos} de {estadisticas.checks_total} checks
                      </p>
                    </div>
                    
                    <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-white/[0.08] relative overflow-hidden group shadow-xl">
                      <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                      <p className="text-xs text-gray-500 uppercase font-mono mb-2">Checks fallidos</p>
                      <p className="text-4xl font-bold text-red-400">{estadisticas.checks_fallidos}</p>
                      <p className="text-xs text-gray-400 mt-3">En el período seleccionado</p>
                    </div>
                    
                    <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-white/[0.08] relative overflow-hidden group shadow-xl">
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                      <p className="text-xs text-gray-500 uppercase font-mono mb-2">Latencia p95</p>
                      <p className="text-4xl font-bold text-white">
                        {estadisticas.latencia_p95_ms === null ? '—' : `${estadisticas.latencia_p95_ms}`}<span className="text-xl text-gray-500 font-normal">{estadisticas.latencia_p95_ms === null ? '' : ' ms'}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-3">
                        Promedio: {estadisticas.latencia_promedio_ms === null ? '—' : `${estadisticas.latencia_promedio_ms} ms`}
                      </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-white/[0.08] relative overflow-hidden group shadow-xl">
                      <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                      <p className="text-xs text-gray-500 uppercase font-mono mb-2">Incidentes iniciados</p>
                      <p className="text-4xl font-bold text-white">{estadisticas.incidentes_iniciados}</p>
                      <p className="text-xs text-gray-400 mt-3">
                        {estadisticas.incidentes_abiertos} abiertos · {formatearDuracion(estadisticas.tiempo_caido_segundos)} de caída
                      </p>
                    </div>
                  </div>

                  {                      }
                  <div className="p-6 rounded-2xl bg-[#0c0c0c] border border-white/[0.08] shadow-xl relative">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-6">Historial de Checks Visual</h3>
                    
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
          </>
        )}
      </main>
    </div>
  );
}