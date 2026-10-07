import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isValidMonitorId } from '../utils/monitorId';

interface Monitor {
  id: string;
  nombre: string;
  url: string;
  verified: boolean;
  ultimo_check?: {
    timestamp: string;
    exitoso: boolean;
    ssl_dias_restantes: number | null;
    ssl_dominio_coincide: boolean | null;
    ssl_emisor: string | null;
    ssl_autofirmado: boolean | null;
  };
}

type Periodo = '24h' | '7d' | '30d';
type EstadoCheck = 'todos' | 'exitosos' | 'fallidos';

interface UltimoCheckDetalle {
  id: string;
  timestamp: string;
  exitoso: boolean;
  status_code: number | null;
  tiempo_respuesta_ms: number | null;
  tipo_error: string | null;
}

interface Estadisticas {
  periodo: Periodo;
  desde: string;
  hasta: string;
  checks_total: number;
  checks_exitosos: number;
  checks_fallidos: number;
  porcentaje_exitosos: number | null;
  latencia_promedio_ms: number | null;
  latencia_p50_ms: number | null;
  latencia_p95_ms: number | null;
  codigos_http: { codigo: number; cantidad: number }[];
  errores: { tipo: string; cantidad: number }[];
  incidentes_iniciados: number;
  incidentes_abiertos: number;
  tiempo_caido_segundos: number;
  ssl: {
    dias_restantes: number | null;
    emisor: string | null;
    dominio_coincide: boolean | null;
    autofirmado: boolean | null;
  };
  timeline: {
    timestamp: string;
    checks: number;
    exitosos: number;
    latencia_promedio_ms: number | null;
  }[];
}

interface PaginaChecks {
  items: UltimoCheckDetalle[];
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
}

const periodos: { valor: Periodo; etiqueta: string }[] = [
  { valor: '24h', etiqueta: '24 horas' },
  { valor: '7d', etiqueta: '7 días' },
  { valor: '30d', etiqueta: '30 días' },
];

const fechaLocal = (timestamp: string) => {
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  return date.toLocaleString('es-MX');
};

const formatearDuracion = (totalSegundos: number) => {
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  if (horas > 0) return `${horas} h ${minutos} min`;
  if (minutos > 0) return `${minutos} min`;
  return `${totalSegundos} s`;
};

                                
const TooltipAyuda = ({ texto }: { texto: React.ReactNode }) => (
  <div className="group relative cursor-help inline-flex items-center ml-2">
    <svg className="w-3.5 h-3.5 text-gray-500 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#121212] border border-white/10 text-xs text-gray-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl z-50 font-normal normal-case tracking-normal leading-relaxed">
      {texto}
    </div>
  </div>
);

export default function MonitorStats() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const invalidMonitorId = !isValidMonitorId(id);
  
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('24h');
  const [estadoCheck, setEstadoCheck] = useState<EstadoCheck>('todos');
  const [paginaChecks, setPaginaChecks] = useState(1);
  const [checksPaginados, setChecksPaginados] = useState<PaginaChecks | null>(null);
  const [loadingChecks, setLoadingChecks] = useState(true);
  const [checksError, setChecksError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

                                       
  const [hoveredBucket, setHoveredBucket] = useState<Estadisticas['timeline'][0] | null>(null);

  useEffect(() => {
    let active = true;
    if (invalidMonitorId) {
      setError('El ID del monitor no tiene un formato válido.');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const fetchData = async () => {
      try {
        const [monitorResponse, statsResponse] = await Promise.all([
          api.get(`/monitors/${id}`),
          api.get(`/monitors/${id}/stats`, { params: { periodo } }),
        ]);
        if (active) {
          setMonitor(monitorResponse.data);
          setEstadisticas(statsResponse.data);
          setError('');
        }
      } catch (err: any) {
        if (active) setError(err.response?.data?.detail || 'No se pudieron cargar las estadísticas.');
      } finally {
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    fetchData();
    const interval = window.setInterval(fetchData, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id, periodo, invalidMonitorId]);

  useEffect(() => {
    let active = true;
    if (invalidMonitorId) {
      setChecksError('El ID del monitor no tiene un formato válido.');
      setLoadingChecks(false);
      return () => {
        active = false;
      };
    }

    const fetchChecks = async () => {
      setLoadingChecks(true);
      try {
        const response = await api.get(`/monitors/${id}/checks/paginated`, {
          params: {
            periodo,
            estado: estadoCheck,
            pagina: paginaChecks,
            por_pagina: 20,
          },
        });
        if (active) {
          setChecksPaginados(response.data);
          setChecksError('');
        }
      } catch (err: any) {
        if (active) setChecksError(err.response?.data?.detail || 'No se pudo cargar el registro de checks.');
      } finally {
        if (active) setLoadingChecks(false);
      }
    };

    fetchChecks();
    const interval = window.setInterval(fetchChecks, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id, periodo, estadoCheck, paginaChecks, invalidMonitorId]);

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#050505] font-sans text-white">
        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[450px] w-[900px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[160px]" />
        <div className="pointer-events-none fixed bottom-[-150px] left-1/2 z-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/[0.12] blur-[140px]" />

        <div className="relative z-20 flex w-full items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/monitors/${id}`)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0c0c0c] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:text-white"
            >
              &larr; Volver
            </button>
            <div className="hidden font-mono text-sm font-semibold uppercase tracking-widest text-gray-400 sm:block">
              Sentinela
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/status/global"
              className="group flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#0c0c0c] px-4 py-2 transition-all hover:bg-white/[0.08]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-gray-300 transition-colors group-hover:text-white">
                Estado Global
              </span>
            </Link>

            <button
              onClick={logout}
              className="rounded-full border border-red-500/20 bg-red-500/[0.04] px-4 py-2 text-xs font-medium text-red-400 transition-all hover:bg-red-500/[0.08]"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        <main className="relative z-10 mx-auto max-w-5xl px-6 pt-6">
          <div className="p-20 text-center text-sm text-gray-500">Cargando métricas...</div>
        </main>
      </div>
    );
  }

  if (error || !monitor || !estadisticas) {
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
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Estadísticas</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {invalidMonitorId ? 'Monitor no reconocido' : 'Estadísticas no disponibles'}
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-gray-400">
              {invalidMonitorId
                ? 'El ID del monitor no tiene un formato válido.'
                : 'No pudimos cargar las estadísticas de este monitor. Comprueba que siga disponible y vuelve a intentarlo.'}
            </p>
            <p role="alert" className="mt-4 rounded-lg border border-white/5 bg-black/30 px-4 py-3 text-xs text-gray-500">
              {error || 'No se encontró la información solicitada.'}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {!invalidMonitorId && (
                <button
                  onClick={() => navigate(0)}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Reintentar
                </button>
              )}
              <a
                href="https://app.sentinela.my/"
                className="inline-flex items-center justify-center rounded-lg border border-white bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg transition-colors hover:bg-gray-200"
              >
                Ir a página principal
              </a>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const maxChecks = Math.max(1, ...estadisticas.timeline.map((bucket) => bucket.checks));

  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
      
      {                                       }
      <div className="fixed inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-blue-500/20 blur-[160px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-500/[0.12] blur-[140px] rounded-full pointer-events-none z-0"></div>

      {                    }
      <div className="relative z-20 w-full p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/monitors/${id}`)}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c0c0c] border border-white/10"
          >
            &larr; Volver
          </button>
          <div className="font-mono text-sm font-semibold uppercase tracking-widest text-gray-400">
            Sentinela
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            to="/status/global" 
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0c0c0c] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
              Estado Global
            </span>
          </Link>

          <button
            onClick={logout}
            className="px-4 py-2 rounded-full bg-red-500/[0.04] border border-red-500/20 hover:bg-red-500/[0.08] text-red-400 text-xs font-medium transition-all"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-6">
        
        {                       }
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-white/10">
          <div className="min-w-0 flex-1 pr-4">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Estadísticas Avanzadas
            </h1>
            <p className="font-mono text-sm text-gray-400 mt-2 truncate flex items-center gap-2">
              <span className="text-white font-sans font-semibold">{monitor.nombre}</span> — {monitor.url}
            </p>
          </div>
          <div className="flex shrink-0 rounded-lg border border-white/10 bg-[#0c0c0c] p-1">
            {periodos.map((opcion) => (
              <button
                key={opcion.valor}
                onClick={() => {
                  setPeriodo(opcion.valor);
                  setPaginaChecks(1);
                }}
                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${periodo === opcion.valor ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-5 text-xs text-gray-500">
          {fechaLocal(estadisticas.desde)} – {fechaLocal(estadisticas.hasta)} · Actualizado en tiempo real
        </p>

        {                                               }
        {!monitor.verified ? (
          <div className="mt-12 flex flex-col items-center justify-center p-10 bg-white/[0.02] border border-white/10 backdrop-blur-sm rounded-2xl max-w-lg mx-auto text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Métricas Protegidas</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Para proteger la privacidad de las métricas de red de este servidor, Sentinela requiere que demuestres que eres el administrador del dominio.
            </p>
            <button
              onClick={() => navigate(`/monitors/${id}`)}
              className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-gray-200 transition-colors"
            >
              Ir a Verificar Dominio
            </button>
          </div>
        ) : (
          
          <div className="space-y-6">
            
            {                                    }
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">Resumen del período</h3>
            {estadisticas.checks_total === 0 && (
              <div className="mb-6 rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-6 text-center text-sm text-gray-400 backdrop-blur-sm">
                Aún no hay checks registrados en este período.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              
              <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                <p className="text-xs text-gray-500 uppercase font-mono mb-2">Checks exitosos</p>
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-bold text-white">
                    {estadisticas.porcentaje_exitosos === null ? '—' : `${estadisticas.porcentaje_exitosos.toFixed(2)}%`}
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {estadisticas.checks_exitosos} de {estadisticas.checks_total} checks
                </p>
              </div>
              
              <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <p className="text-xs text-gray-500 uppercase font-mono mb-2">Checks fallidos</p>
                <p className="text-4xl font-bold text-red-400">{estadisticas.checks_fallidos}</p>
                <p className="text-xs text-gray-400 mt-3">En el período seleccionado</p>
              </div>
              
              <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <p className="text-xs text-gray-500 uppercase font-mono mb-2">Latencia p95</p>
                <p className="text-4xl font-bold text-white">
                  {estadisticas.latencia_p95_ms === null ? '—' : `${estadisticas.latencia_p95_ms}`}<span className="text-xl text-gray-500 font-normal">{estadisticas.latencia_p95_ms === null ? '' : ' ms'}</span>
                </p>
                <p className="text-xs text-gray-400 mt-3">
                  Promedio: {estadisticas.latencia_promedio_ms === null ? '—' : `${estadisticas.latencia_promedio_ms} ms`}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:border-white/20 transition-colors shadow-xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                <p className="text-xs text-gray-500 uppercase font-mono mb-2">Incidentes iniciados</p>
                <p className="text-4xl font-bold text-white">{estadisticas.incidentes_iniciados}</p>
                <p className="text-xs text-gray-400 mt-3">
                  {estadisticas.incidentes_abiertos} abiertos · {formatearDuracion(estadisticas.tiempo_caido_segundos)} de caída
                </p>
              </div>

            </div>

            {                                   }
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {                            }
              <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm shadow-xl">
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-6 flex items-center">
                  Rendimiento y Latencia
                  <TooltipAyuda texto={<><strong>Latencia:</strong> Es el tiempo que tarda tu servidor en responder a las peticiones.<br/><br/><strong>p50 (Mediana):</strong> Significa que el 50% de las veces tu sitio cargó más rápido que este tiempo.<br/><strong>p95:</strong> Significa que el 95% de las veces tu sitio cargó más rápido que este tiempo (sirve para ver si los usuarios con conexiones más lentas sufren retrasos severos).</>} />
                </h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                      <p className="text-sm font-medium text-gray-300">Latencia promedio</p>
                      <p className="text-xs text-gray-500 mt-1">En el período seleccionado</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white font-mono">
                        {estadisticas.latencia_promedio_ms === null ? '—' : `${estadisticas.latencia_promedio_ms} ms`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-400">p50 (Mediana - Tráfico normal)</span>
                      <span className="font-mono text-white">{estadisticas.latencia_p50_ms === null ? '—' : `${estadisticas.latencia_p50_ms} ms`}</span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: estadisticas.latencia_p50_ms === null || estadisticas.latencia_p95_ms === null ? '0%' : `${Math.min(100, estadisticas.latencia_p50_ms / Math.max(estadisticas.latencia_p95_ms, 1) * 100)}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-gray-400">p95 (Picos - Tráfico lento)</span>
                      <span className="font-mono text-amber-400">{estadisticas.latencia_p95_ms === null ? '—' : `${estadisticas.latencia_p95_ms} ms`}</span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: estadisticas.latencia_p95_ms === null ? '0%' : '100%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {                        }
              <div className="space-y-6">
                
                {                             }
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm shadow-xl">
                  <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-5 flex items-center">
                    Distribución de Códigos HTTP
                    <TooltipAyuda texto={<><strong>Códigos 2xx (Éxito):</strong> La petición se completó correctamente.<br/><strong>Códigos 3xx (Redirecciones):</strong> El recurso fue movido a otra URL.<br/><strong>Códigos 4xx (Errores del Cliente):</strong> Errores como 404 (No Encontrado) o 401 (No Autorizado). Tu servidor funciona, pero la ruta falló.<br/><strong>Códigos 5xx (Errores del Servidor):</strong> Fallas críticas en tu código o base de datos (Ej. 500, 502).<br/><strong>Timeout / Red:</strong> El servidor apagado o DNS no configurado.</>} />
                  </h3>
                  
                  <div className="space-y-3">
                    {estadisticas.codigos_http.length === 0 && estadisticas.errores.length === 0 ? (
                      <p className="text-xs text-gray-500">Sin respuestas o errores registrados.</p>
                    ) : (
                      <>
                        {estadisticas.codigos_http.map((item) => (
                          <div key={item.codigo} className={`flex justify-between items-center p-2.5 rounded border text-sm ${item.codigo >= 500 ? 'bg-red-500/10 border-red-500/20' : item.codigo >= 400 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-black/20 border-white/5'}`}>
                            <span className={`font-semibold flex items-center gap-2 ${item.codigo >= 500 ? 'text-red-400' : item.codigo >= 400 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              <span className={`w-2 h-2 rounded-full ${item.codigo >= 500 ? 'bg-red-500' : item.codigo >= 400 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                              HTTP {item.codigo}
                            </span>
                            <span className="font-mono text-gray-400">{item.cantidad} checks</span>
                          </div>
                        ))}
                        {estadisticas.errores.map((item) => (
                          <div key={item.tipo} className="flex justify-between items-center p-2.5 rounded bg-red-500/10 border border-red-500/20 text-sm">
                            <span className="text-red-400 font-semibold">{item.tipo.replace(/_/g, ' ')}</span>
                            <span className="font-mono text-red-400">{item.cantidad} checks</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {               }
                <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm shadow-xl flex items-center justify-between">
                  <div className="min-w-0 flex-1 pr-4">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Certificado SSL</h3>
                    <p className="text-sm text-white truncate" title={estadisticas.ssl.emisor || ''}>{estadisticas.ssl.emisor || 'No disponible'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase text-gray-500 mb-1">Días Restantes</p>
                    <p className={`font-mono text-lg font-bold ${estadisticas.ssl.dias_restantes !== null && estadisticas.ssl.dias_restantes < 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {estadisticas.ssl.dias_restantes ?? '—'}
                    </p>
                  </div>
                </div>
                
              </div>
            </div>

            {                                    }
            <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm shadow-xl mt-6 relative">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-6">Historial de Checks Visual</h3>
              
              {                                                                           }
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
                <span>{fechaLocal(estadisticas.desde)}</span>
                <span>Ahora</span>
              </div>
            </div>

            {                                                              }
            <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/10 backdrop-blur-sm shadow-xl mt-6 overflow-hidden">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest">Registro Detallado (Últimos escaneos)</h3>
                <div className="flex w-fit rounded-lg border border-white/10 bg-black/20 p-1" role="group" aria-label="Filtrar checks por estado">
                  {([
                    { value: 'todos', label: 'Todos' },
                    { value: 'exitosos', label: 'Exitosos' },
                    { value: 'fallidos', label: 'Fallidos' },
                  ] as const).map((opcion) => (
                    <button
                      key={opcion.value}
                      type="button"
                      aria-pressed={estadoCheck === opcion.value}
                      onClick={() => {
                        setEstadoCheck(opcion.value);
                        setPaginaChecks(1);
                      }}
                      className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${estadoCheck === opcion.value ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      {opcion.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="text-xs uppercase bg-black/40 text-gray-500 border-b border-white/5">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-tl-lg">Fecha y Hora</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Latencia</th>
                      <th className="px-4 py-3 font-medium rounded-tr-lg">Detalle (Código / Error)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingChecks ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Cargando checks...</td>
                      </tr>
                    ) : checksError ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-red-400">{checksError}</td>
                      </tr>
                    ) : checksPaginados?.items.length ? (
                      checksPaginados.items.map((check) => (
                        <tr key={check.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{fechaLocal(check.timestamp)}</td>
                          <td className="px-4 py-3">
                            {check.exitoso ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Fallo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">{check.tiempo_respuesta_ms ? `${check.tiempo_respuesta_ms} ms` : '—'}</td>
                          <td className="px-4 py-3">
                            {check.tipo_error ? (
                              <span className="text-red-400 text-xs">{check.tipo_error}</span>
                            ) : (
                              <span className="text-gray-300 font-mono text-xs">HTTP {check.status_code || '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">No hay checks para este período y filtro.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-white/5 pt-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {checksPaginados?.total
                    ? `Mostrando ${(checksPaginados.pagina - 1) * checksPaginados.por_pagina + 1}–${Math.min(checksPaginados.pagina * checksPaginados.por_pagina, checksPaginados.total)} de ${checksPaginados.total} checks`
                    : 'Mostrando 0 checks'}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPaginaChecks((pagina) => Math.max(1, pagina - 1))}
                    disabled={loadingChecks || paginaChecks <= 1}
                    className="rounded-md border border-white/10 px-3 py-2 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span>Página {paginaChecks} de {Math.max(checksPaginados?.total_paginas ?? 0, 1)}</span>
                  <button
                    type="button"
                    onClick={() => setPaginaChecks((pagina) => pagina + 1)}
                    disabled={loadingChecks || paginaChecks >= (checksPaginados?.total_paginas ?? 0)}
                    className="rounded-md border border-white/10 px-3 py-2 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}