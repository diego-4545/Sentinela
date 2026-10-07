import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

                                                                 
interface CheckDetail {
  id: string;
  timestamp: string;
  exitoso: boolean;
  status_code: number | null;
  tiempo_respuesta_ms: number | null;
  tipo_error: string | null;
}

interface Monitor {
  id: string;
  nombre: string;
  url: string;
  activo: boolean;
  verified: boolean;
  ultimo_check?: CheckDetail;
}

const formatTimestamp = (timestamp: string) => {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);
  const date = new Date(hasTimezone ? timestamp : `${timestamp}Z`);
  return date.toLocaleTimeString();
};

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const fetchMonitors = async () => {
    try {
      setError('');
      const response = await api.get('/monitors');
      setMonitors(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudieron cargar los monitores de infraestructura.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!newUrl.trim() || !urlRegex.test(newUrl)) {
      setModalError('Por favor, introduce una URL válida (ej. https://mi-sitio.com).');
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/monitors', { nombre: newName, url: newUrl });
      setNewName('');
      setNewUrl('');
      setShowModal(false);
      fetchMonitors();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Error al crear el monitor. Verifica los datos.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalActive = monitors.filter(m => m.activo).length;
  const totalVerified = monitors.filter(m => m.verified).length;

  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500 selection:text-white">
      
      {                                                                                          }
      <div className="fixed inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-blue-500/20 blur-[160px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-500/[0.12] blur-[140px] rounded-full pointer-events-none z-0"></div>

      {                         }
      <div className="relative z-20 w-full p-6 flex justify-between items-center">
        <div className="font-mono text-sm tracking-widest text-gray-400 uppercase font-semibold">
          Sentinela
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            to="/status/global" 
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0c0c0c] border border-blue-500/20 hover:bg-blue-500/10 transition-all"
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

      {                         }
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-6 pb-16">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Monitores</h1>
            <p className="text-sm text-gray-400">Supervisión activa de latencia y servicios en tiempo real.</p>
          </div>
          <button
            onClick={() => { setModalError(''); setShowModal(true); }}
            className="bg-white text-black hover:bg-gray-200 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Monitor
          </button>
        </div>

        {                                                                      }
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-[#0c0c0c] border border-blue-500/20 relative overflow-hidden shadow-xl">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Total Registrados</p>
            <p className="text-3xl font-bold mt-2 text-white">{monitors.length}</p>
          </div>
          <div className="p-5 rounded-2xl bg-[#0c0c0c] border border-blue-500/20 relative overflow-hidden shadow-xl">
            <p className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Activos
            </p>
            <p className="text-3xl font-bold mt-2 text-emerald-400">{totalActive}</p>
          </div>
          <div className="p-5 rounded-2xl bg-[#0c0c0c] border border-blue-500/20 relative overflow-hidden shadow-xl">
            <p className="text-xs font-mono text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Verificados
            </p>
            <p className="text-3xl font-bold mt-2 text-blue-400">{totalVerified}</p>
          </div>
        </div>

        {                        }
        <div className="bg-[#0c0c0c] border border-blue-500/20 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="p-16 text-center text-gray-500 text-sm">Sincronizando infraestructura...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-400 text-sm flex flex-col items-center gap-2">
              <span>{error}</span>
              <button onClick={fetchMonitors} className="text-xs text-blue-400 hover:underline mt-2">Reintentar conexión</button>
            </div>
          ) : monitors.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-gray-400 text-sm mb-3">No hay ningún monitor activo en este momento.</p>
              <button
                onClick={() => { setModalError(''); setShowModal(true); }}
                className="text-xs text-blue-400 hover:underline font-medium"
              >
                Configura tu primer servicio ahora
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-mono text-gray-400 uppercase bg-black/40">
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6">Verificación</th>
                    <th className="py-4 px-6">Nombre</th>
                    <th className="py-4 px-6">Endpoint / URL</th>
                    <th className="py-4 px-6">Latencia</th>
                    <th className="py-4 px-6">Última revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {monitors.map((mon) => {
                    const isFailing = mon.ultimo_check && !mon.ultimo_check.exitoso;

                    return (
                      <tr key={mon.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            isFailing 
                              ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                              : mon.activo 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isFailing ? 'bg-red-400' : mon.activo ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`}></span>
                            {isFailing ? 'Caído' : mon.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            mon.verified 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {mon.verified ? 'Verificado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-white">
                          <Link to={`/monitors/${mon.id}`} className="hover:text-blue-400 transition-colors underline decoration-dotted underline-offset-4">
                            {mon.nombre}
                          </Link>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs text-gray-400">{mon.url}</td>
                        <td className="py-4 px-6 font-mono text-xs text-gray-300">
                          {mon.ultimo_check?.tiempo_respuesta_ms != null ? `${mon.ultimo_check.tiempo_respuesta_ms}ms` : '—'}
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-500">
                          {mon.ultimo_check?.timestamp ? formatTimestamp(mon.ultimo_check.timestamp) : 'Sin revisiones aún'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0c0c0c] border border-blue-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-t-2xl"></div>

            <h3 className="text-lg font-bold mb-1 mt-1">Registrar Nuevo Monitor</h3>
            <p className="text-xs text-gray-400 mb-5">Ingresa los detalles del servicio que rastreará Sentinela.</p>

            {modalError && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/[0.04] border border-red-500/20 text-red-400 text-[13px] flex items-center gap-3">
                <svg className="w-4 h-4 shrink-0 text-red-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMonitor} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Nombre del servicio</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="Ej. API Principal"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">URL de destino</label>
                <input
                  type="url"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="https://api.sentinela.my/health"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  {submitting ? 'Guardando...' : 'Crear Monitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}