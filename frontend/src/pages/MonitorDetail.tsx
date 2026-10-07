import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isValidMonitorId } from '../utils/monitorId';

interface CheckDetail {
  id: string;
  timestamp: string;
  exitoso: boolean;
  status_code: number | null;
  tiempo_respuesta_ms: number | null;
  tipo_error: string | null;
  detalle_error: string | null;
  ssl_dias_restantes: number | null;
  ssl_dominio_coincide: boolean | null;
  ssl_emisor: string | null;
  ssl_autofirmado: boolean | null;
  headers_seguridad: Record<string, any> | null;
}

interface Monitor {
  id: string;
  nombre: string;
  url: string;
  activo: boolean;
  verified: boolean;
  verification_token: string;
  intervalo_segundos: number;
  incluido_en_status_personal: boolean;
  incluido_en_status_global: boolean;
  ultimo_check?: CheckDetail;
}

type TipoCanalNotificacion = 'email' | 'discord';

interface CanalNotificacion {
  id: string;
  tipo: TipoCanalNotificacion;
  destino: string;
  activo: boolean;
}

const MAX_INTERVALO_SEGUNDOS = 86400;

const formatCheckTime = (timestamp: string) => {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);
  const date = new Date(hasTimezone ? timestamp : `${timestamp}Z`);
  return date.toLocaleString('es-MX');
};

export default function MonitorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const invalidMonitorId = !isValidMonitorId(id);
  
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
                                  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState('');
  const [intervalError, setIntervalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    nombre: '',
    intervalo_segundos: 300 as number | '',
    incluido_en_status_personal: false,
    incluido_en_status_global: false
  });

                                      
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

                                       
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [runningCheck, setRunningCheck] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [updatingMonitor, setUpdatingMonitor] = useState(false);
  const [monitorActionError, setMonitorActionError] = useState('');

                                         
  const [canales, setCanales] = useState<CanalNotificacion[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState('');
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelType, setChannelType] = useState<TipoCanalNotificacion>('email');
  const [channelDestination, setChannelDestination] = useState('');
  const [channelFormError, setChannelFormError] = useState('');
  const [savingChannel, setSavingChannel] = useState(false);
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<CanalNotificacion | null>(null);
  const [deletingChannel, setDeletingChannel] = useState(false);
  const [deleteChannelError, setDeleteChannelError] = useState('');
  
                                   
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareError, setShareError] = useState('');
  const [personalStatusUrl, setPersonalStatusUrl] = useState('');

  const fetchMonitorDetail = async () => {
    if (invalidMonitorId) {
      setError('El ID del monitor no tiene un formato válido.');
      setLoading(false);
      return;
    }

    try {
      setError('');
      const [response, monitorsResponse] = await Promise.all([
        api.get(`/monitors/${id}`),
        api.get('/monitors').catch(() => null),
      ]);
      const latestMonitor = monitorsResponse?.data.find((item: Monitor) => item.id === id);
      setMonitor({ ...response.data, ultimo_check: latestMonitor?.ultimo_check ?? null });
      setEditData({
        nombre: response.data.nombre,
        intervalo_segundos: response.data.intervalo_segundos,
        incluido_en_status_personal: response.data.incluido_en_status_personal,
        incluido_en_status_global: response.data.incluido_en_status_global
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo cargar la información del monitor.');
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    setChannelsLoading(true);
    setChannelsError('');
    try {
      const response = await api.get(`/monitors/${id}/channels`);
      setCanales(response.data);
    } catch (err: any) {
      setChannelsError(err.response?.data?.detail || 'No se pudieron cargar los canales.');
    } finally {
      setChannelsLoading(false);
    }
  };

  useEffect(() => {
    if (invalidMonitorId) {
      setError('El ID del monitor no tiene un formato válido.');
      setLoading(false);
      setChannelsLoading(false);
      return;
    }

    fetchMonitorDetail();
    fetchChannels();
    const interval = window.setInterval(fetchMonitorDetail, 30000);
    return () => window.clearInterval(interval);
  }, [id, invalidMonitorId]);

  const handleCreateChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    setChannelFormError('');
    const destination = channelDestination.trim();

    if (channelType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(destination)) {
        setChannelFormError('Ingresa un correo válido, por ejemplo nombre@dominio.com.');
        return;
      }
    } else if (
      !destination.startsWith('https://discord.com/api/webhooks/') &&
      !destination.startsWith('https://discordapp.com/api/webhooks/')
    ) {
      setChannelFormError('El webhook debe ser una URL de Discord que empiece con https://discord.com/api/webhooks/.');
      return;
    }

    const comparableDestination = channelType === 'email' ? destination.toLowerCase() : destination;
    const duplicate = canales.some((canal) =>
      canal.tipo === channelType &&
      (channelType === 'email' ? canal.destino.trim().toLowerCase() : canal.destino.trim()) === comparableDestination
    );
    if (duplicate) {
      setChannelFormError('Este destino ya está configurado para el monitor.');
      return;
    }
    setSavingChannel(true);
    try {
      await api.post(`/monitors/${id}/channels`, {
        tipo: channelType,
        destino: destination,
      });
      setChannelDestination('');
      setShowChannelModal(false);
      await fetchChannels();
    } catch (err: any) {
      setChannelFormError(err.response?.data?.detail || 'No se pudo guardar el canal.');
    } finally {
      setSavingChannel(false);
    }
  };

  const handleToggleChannel = async (canal: CanalNotificacion) => {
    setUpdatingChannelId(canal.id);
    setChannelsError('');
    try {
      const response = await api.patch(`/monitors/${id}/channels/${canal.id}`, {
        activo: !canal.activo,
      });
      setCanales((current) => current.map((item) => item.id === canal.id ? response.data : item));
    } catch (err: any) {
      setChannelsError(err.response?.data?.detail || 'No se pudo actualizar el canal.');
    } finally {
      setUpdatingChannelId(null);
    }
  };

  const confirmDeleteChannel = async () => {
    if (!channelToDelete) return;
    setDeleteChannelError('');
    setDeletingChannel(true);
    try {
      await api.delete(`/monitors/${id}/channels/${channelToDelete.id}`);
      setCanales((current) => current.filter((item) => item.id !== channelToDelete.id));
      setChannelToDelete(null);
    } catch (err: any) {
      setDeleteChannelError(err.response?.data?.detail || 'No se pudo eliminar el canal.');
    } finally {
      setDeletingChannel(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteError('');
    setDeleting(true);
    try {
      await api.delete(`/monitors/${id}`);
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || 'Error al eliminar el monitor.');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    if (!monitor) return;

    const intervalo = Number(editData.intervalo_segundos);
    const intervaloModificado = intervalo !== monitor.intervalo_segundos;
    if (intervaloModificado && (!Number.isInteger(intervalo) || intervalo < 60 || intervalo > MAX_INTERVALO_SEGUNDOS)) {
      setIntervalError(
        intervalo > MAX_INTERVALO_SEGUNDOS
          ? 'El intervalo máximo es de 86,400 segundos (24 horas).'
          : 'El intervalo debe ser un número entero de al menos 60 segundos.'
      );
      return;
    }
    setIntervalError('');

    const cambios: Partial<Pick<Monitor, 'nombre' | 'intervalo_segundos' | 'incluido_en_status_personal' | 'incluido_en_status_global'>> = {};
    if (editData.nombre !== monitor.nombre) cambios.nombre = editData.nombre;
    if (intervaloModificado) cambios.intervalo_segundos = intervalo;
    if (editData.incluido_en_status_personal !== monitor.incluido_en_status_personal) {
      cambios.incluido_en_status_personal = editData.incluido_en_status_personal;
    }
    if (editData.incluido_en_status_global !== monitor.incluido_en_status_global) {
      cambios.incluido_en_status_global = editData.incluido_en_status_global;
    }

    setSaving(true);
    try {
      await api.patch(`/monitors/${id}`, cambios);
      setShowEditModal(false);
      await fetchMonitorDetail();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const detailMessage = Array.isArray(detail)
        ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join('. ')
        : typeof detail === 'string' ? detail : '';
      setEditError(detailMessage || 'Error al actualizar el monitor.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifyError('');
    setVerifying(true);
    try {
      await api.post(`/monitors/${id}/verify`);
      fetchMonitorDetail();
    } catch (err: any) {
      setVerifyError(err.response?.data?.detail || 'No se pudo verificar. Asegúrate de haber colocado el token correctamente.');
    } finally {
      setVerifying(false);
    }
  };

  const handleRunCheck = async () => {
    setCheckError('');
    setRunningCheck(true);
    try {
      await api.post(`/monitors/${id}/check-now`);
      await fetchMonitorDetail();
    } catch (err: any) {
      setCheckError(err.response?.data?.detail || 'No se pudo ejecutar el check.');
    } finally {
      setRunningCheck(false);
    }
  };

  const handleToggleMonitor = async () => {
    if (!monitor) return;
    setMonitorActionError('');
    setUpdatingMonitor(true);
    try {
      const response = await api.patch(`/monitors/${id}`, { activo: !monitor.activo });
      setMonitor((current) => current ? { ...current, activo: response.data.activo } : current);
    } catch (err: any) {
      setMonitorActionError(err.response?.data?.detail || 'No se pudo actualizar el estado del monitor.');
    } finally {
      setUpdatingMonitor(false);
    }
  };

  const handleDownloadToken = () => {
    if (!monitor) return;
    const blob = new Blob([monitor.verification_token], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinela-verify-${monitor.verification_token}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSharePersonalStatus = async () => {
    setShareError('');
    try {
      if (!monitor) throw new Error('No se encontró el monitor.');
      const statusUrl = new URL(`/status/${monitor.id}`, window.location.origin).toString();
      setPersonalStatusUrl(statusUrl);

      try {
        await navigator.clipboard.writeText(statusUrl);
      } catch {
        const input = document.createElement('textarea');
        input.value = statusUrl;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        let copied: boolean;
        try {
          input.select();
          copied = document.execCommand('copy');
        } finally {
          document.body.removeChild(input);
        }
        if (!copied) throw new Error('El navegador no permitió copiar el enlace.');
      }

      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setShareError('No se pudo copiar el enlace. Usa el enlace mostrado para copiarlo manualmente.');
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
      
      <div className="absolute inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-blue-500/20 blur-[160px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-500/[0.12] blur-[140px] rounded-full pointer-events-none z-0"></div>

      <div className="relative z-20 w-full p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 backdrop-blur-md"
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
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all backdrop-blur-md"
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
            className="px-4 py-2 rounded-full bg-red-500/[0.04] border border-red-500/20 hover:bg-red-500/[0.08] text-red-400 text-xs font-medium transition-all backdrop-blur-md"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-6">
        {loading ? (
          <div className="p-20 text-center text-gray-500 text-sm">Cargando diagnóstico del monitor...</div>
        ) : error ? (
          <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center py-10">
            <section className="w-full rounded-2xl border border-white/10 bg-[#0c0c0c]/90 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_35px_rgba(239,68,68,0.12)]">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 9v3m0 4h.01M10.3 3.9 1.9 18.1A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                </svg>
              </div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Monitor</p>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {invalidMonitorId ? 'Monitor no reconocido' : 'Monitor no encontrado'}
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-gray-400">
                {invalidMonitorId
                  ? 'El ID del monitor no tiene un formato válido.'
                  : 'No pudimos encontrar este monitor. Puede que el enlace sea incorrecto o que ya no tengas acceso.'}
              </p>
              <p role="alert" className="mt-4 rounded-lg border border-white/5 bg-black/30 px-4 py-3 text-xs text-gray-500">
                {error}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {!invalidMonitorId && (
                  <button
                    onClick={() => void fetchMonitorDetail()}
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
          </div>
        ) : monitor ? (
          <div>
            {                                }
            {                                                                   }
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-6 border-b border-white/10 overflow-hidden">
              
              {                                                                    }
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold tracking-tight text-white truncate">{monitor.nombre}</h1>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    monitor.activo ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                    {monitor.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 min-w-0">
                  <p className="font-mono text-sm text-gray-400 truncate">{monitor.url}</p>
                  {monitor.incluido_en_status_personal && (
                    <button
                      onClick={handleSharePersonalStatus}
                      className="shrink-0 flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md text-[11px] font-medium transition-colors border border-blue-500/20"
                      title="Copiar enlace de Estado Personal"
                    >
                      {copiedLink ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          Copiado
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          Compartir Estado
                        </>
                      )}
                    </button>
                  )}
                  {shareError && <span role="alert" className="text-xs text-red-400">{shareError}</span>}
                  {shareError && personalStatusUrl && (
                    <a
                      href={personalStatusUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="basis-full break-all text-xs text-blue-300 underline underline-offset-2"
                    >
                      {personalStatusUrl}
                    </a>
                  )}
                </div>
              </div>

              {                                                                                    }
              <div className="flex items-center gap-2.5 shrink-0 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                <button
                  onClick={handleToggleMonitor}
                  disabled={updatingMonitor}
                  title={updatingMonitor ? 'Actualizando...' : monitor.activo ? 'Pausar monitor' : 'Reanudar monitor'}
                  aria-label={updatingMonitor ? 'Actualizando monitor' : monitor.activo ? 'Pausar monitor' : 'Reanudar monitor'}
                  aria-pressed={monitor.activo}
                  className={`h-10 w-10 shrink-0 rounded-lg border p-0 transition-colors disabled:opacity-50 ${
                    monitor.activo
                      ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  <svg className="mx-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    {monitor.activo ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5v14l11-7z" />
                    )}
                  </svg>
                </button>

                <button
                  onClick={handleRunCheck}
                  disabled={runningCheck}
                  className="bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M5.6 9A7 7 0 0118 6l2 3M4 15l2 3a7 7 0 0012.4-3" />
                  </svg>
                  {runningCheck ? 'Revisando...' : 'Ejecutar check'}
                </button>

                <button
                  onClick={() => navigate(`/monitors/${id}/stats`)}
                  className="bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Estadísticas
                </button>

                <button
                  onClick={() => { setDeleteError(''); setShowDeleteModal(true); }}
                  className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>

                <button
                  onClick={() => {
                    setEditError('');
                    setIntervalError('');
                    setShowEditModal(true);
                  }}
                  className="bg-white text-black hover:bg-gray-200 font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Editar
                </button>
              </div>
            </div>

            {monitorActionError && (
              <p role="alert" className="-mt-5 mb-6 text-xs text-red-400">{monitorActionError}</p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="space-y-6">
                
                {!monitor.verified ? (
                  <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 backdrop-blur-sm space-y-4">
                    <h3 className="text-sm font-semibold text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Verificación Pendiente
                      </span>
                      <div className="group relative cursor-help">
                        <svg className="w-4 h-4 text-amber-400/60 hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-[#1a1a1a] border border-white/10 text-xs text-gray-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl z-50 font-normal leading-relaxed">
                          Para proteger la privacidad de los sitios web, Sentinela requiere que demuestres que eres el administrador del sitio. Sube el archivo .txt a tu servidor o agrega un registro TXT en tu dominio.
                        </div>
                      </div>
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Descarga el archivo y súbelo a la raíz de tu sitio, o copia el texto y agrégalo como un registro DNS TXT en tu dominio.
                    </p>
                    
                    <div className="p-3 bg-black/40 rounded border border-white/5 font-mono text-xs text-amber-200 select-all text-center">
                      {monitor.verification_token}
                    </div>

                    {verifyError && (
                      <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-start gap-2">
                         <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                         <span>{verifyError}</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={handleDownloadToken}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Descargar archivo .txt
                      </button>

                      <button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {verifying ? 'Comprobando...' : 'Comprobar Verificación'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-xl bg-blue-500/5 border border-blue-500/20 backdrop-blur-sm space-y-4">
                    <h3 className="text-sm font-semibold text-blue-400 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Monitor Verificado
                      </span>
                    </h3>
                    <div className="border-t border-blue-500/20 pt-4 space-y-3">
                      <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Estadísticas Rápidas</p>
                      <div className="flex justify-between items-center bg-black/20 p-2.5 rounded border border-white/5">
                        <span className="text-xs text-gray-400">Estado Reciente</span>
                        <span className={`text-xs font-mono ${!monitor.ultimo_check ? 'text-gray-500' : monitor.ultimo_check.exitoso ? 'text-emerald-400' : 'text-red-400'}`}>
                          {!monitor.ultimo_check ? 'Sin revisiones' : monitor.ultimo_check.exitoso ? 'Sin interrupciones' : 'Caídas detectadas'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {                          }
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-sm space-y-4">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                    Visibilidad
                    <div className="group relative cursor-help">
                      <svg className="w-4 h-4 text-gray-500 hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-[#1a1a1a] border border-white/10 text-xs text-gray-300 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl z-50 font-normal normal-case tracking-normal">
                        <strong>Estado Personal:</strong> Una página pública exclusiva para tus servicios. <br/><br/>
                        <strong>Estado Global:</strong> Agrega tu uptime al reporte comunitario de la plataforma de manera segura.
                      </div>
                    </div>
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-gray-400 text-xs">Estado Personal</span>
                      <span className={`text-xs font-medium ${monitor.incluido_en_status_personal ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {monitor.incluido_en_status_personal ? 'Público' : 'Oculto'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-gray-400 text-xs">Página de Estado Global</span>
                      <span className={`text-xs font-medium ${monitor.incluido_en_status_global ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {monitor.incluido_en_status_global ? 'Incluido' : 'No Incluido'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {                                  }
              <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10 backdrop-blur-sm shadow-xl h-full">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center justify-between mb-5">
                    <span>Diagnóstico del Último Check</span>
                    {monitor.ultimo_check?.exitoso ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-mono">Status: OK</span>
                    ) : monitor.ultimo_check ? (
                      <span className="text-xs bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20 font-mono animate-pulse">Fallo detectado</span>
                    ) : (
                      <span className="text-xs text-gray-500 font-mono">Esperando worker...</span>
                    )}
                  </h3>

                  {checkError && (
                    <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                      {checkError}
                    </p>
                  )}

                  {monitor.ultimo_check ? (
                    <div className="space-y-5 text-sm">
                      {monitor.ultimo_check.tipo_error && (
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs space-y-1.5">
                          <p className="font-mono font-bold uppercase tracking-wide flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            Error: {monitor.ultimo_check.tipo_error}
                          </p>
                          <p className="text-gray-300 leading-relaxed opacity-90">{monitor.ultimo_check.detalle_error}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                          <p className="text-xs text-gray-500 mb-1">Tiempo de Respuesta</p>
                          <p className="font-mono text-lg text-white">
                            {monitor.ultimo_check.tiempo_respuesta_ms ? `${monitor.ultimo_check.tiempo_respuesta_ms} ms` : '—'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                          <p className="text-xs text-gray-500 mb-1">Código HTTP</p>
                          <p className="font-mono text-lg text-white">
                            {monitor.ultimo_check.status_code || '—'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
                          <p className="text-xs text-gray-500 mb-1">Última revisión</p>
                          <p className="font-mono text-sm text-white mt-1">
                            {formatCheckTime(monitor.ultimo_check.timestamp)}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10 mt-6">
                        <p className="text-xs font-mono text-gray-400 uppercase mb-3">Seguridad y Certificado SSL</p>
                        {monitor.ultimo_check.ssl_emisor ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="bg-black/20 p-3 rounded border border-white/5">
                              <span className="text-gray-500 block mb-1">Emisor de Autoridad</span>
                              <span className="text-gray-300 font-medium">{monitor.ultimo_check.ssl_emisor}</span>
                            </div>
                            <div className="bg-black/20 p-3 rounded border border-white/5">
                              <span className="text-gray-500 block mb-1">Validez</span>
                              <span className="text-gray-300 font-medium">{monitor.ultimo_check.ssl_dias_restantes} días restantes</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic p-3 bg-white/[0.01] rounded border border-white/5">
                            No disponible o el endpoint no cuenta con conexión HTTPS segura.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                      <p className="text-xs text-gray-500 italic">El worker aún no ha registrado el primer escaneo.</p>
                      <p className="text-xs text-gray-600 mt-1">Espera unos segundos y recarga la página.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {                                                }
            <div className="mt-12 pt-8 border-t border-white/10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Canales de Notificación</h2>
                  <p className="text-sm text-gray-400 mt-1">Configura a dónde enviaremos alertas si este monitor falla (En caso de que no esté verificado no se enviaran notificaciones).</p>
                </div>
                <button
                  onClick={() => {
                    setChannelFormError('');
                    setChannelType('email');
                    setChannelDestination('');
                    setShowChannelModal(true);
                  }}
                  className="bg-white text-black hover:bg-gray-200 font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo Canal
                </button>
              </div>

              {channelsError && (
                <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  <span>{channelsError}</span>
                  <button onClick={fetchChannels} className="shrink-0 underline hover:text-red-300">Reintentar</button>
                </div>
              )}

              {channelsLoading ? (
                <div className="bg-white/[0.01] border border-white/10 rounded-xl p-10 text-center text-xs text-gray-500">
                  Cargando canales...
                </div>
              ) : canales.length === 0 ? (
                <div className="bg-white/[0.01] border border-dashed border-white/10 rounded-xl p-12 text-center flex flex-col items-center">
                  <svg className="w-8 h-8 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm text-gray-300 font-medium">No hay canales configurados</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">No recibirás avisos si este monitor se cae. Añade un correo o Webhook para mantenerte informado.</p>
                </div>
              ) : (
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4">
                  {canales.map(canal => (
                    <div key={canal.id} className="w-full min-w-0 bg-white/[0.02] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3 group hover:bg-white/[0.05] hover:border-white/20 transition-colors backdrop-blur-sm">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block">
                          {canal.tipo} · <span className={canal.activo ? 'text-emerald-400' : 'text-amber-400'}>{canal.activo ? 'Activo' : 'Pausado'}</span>
                        </span>
                        <p className="text-sm text-gray-300 mt-1 truncate" title={canal.destino}>{canal.destino}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleChannel(canal)}
                          disabled={updatingChannelId === canal.id}
                          className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-white transition-colors disabled:opacity-50 border border-white/5"
                          title={canal.activo ? 'Pausar canal' : 'Activar canal'}
                          aria-label={canal.activo ? 'Pausar canal' : 'Activar canal'}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {canal.activo
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />}
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteChannelError('');
                            setChannelToDelete(canal);
                          }}
                          className="p-2 rounded-lg bg-red-500/[0.04] hover:bg-red-500/[0.1] text-red-400 transition-colors disabled:opacity-50 border border-red-500/10"
                          title="Eliminar canal"
                          aria-label="Eliminar canal"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : null}
      </main>

      {                                                                 }
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-xl"></div>
            
            <h3 className="text-lg font-bold mb-1 mt-1">Nuevo Canal de Alerta</h3>
            <p className="text-xs text-gray-400 mb-5">Agrega un destino para recibir notificaciones de caída.</p>

            <form onSubmit={handleCreateChannel} className="space-y-5" noValidate>
              {channelFormError && (
                <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  {channelFormError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Tipo de Canal</label>
                <select
                  value={channelType}
                  onChange={(event) => {
                    setChannelType(event.target.value as TipoCanalNotificacion);
                    setChannelFormError('');
                  }}
                  className="w-full bg-[#0f1115] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all appearance-none [color-scheme:dark]"
                >
                  <option className="bg-[#0f1115] text-white" value="email">Correo Electrónico (Email)</option>
                  <option className="bg-[#0f1115] text-white" value="discord">Discord Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Destino (Correo o URL)</label>
                <input
                  type="text"
                  required
                  value={channelDestination}
                  onChange={(event) => {
                    setChannelDestination(event.target.value);
                    setChannelFormError('');
                  }}
                  placeholder={channelType === 'email' ? 'nombre@dominio.com' : 'https://discord.com/api/webhooks/...'}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowChannelModal(false);
                    setChannelFormError('');
                  }}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingChannel}
                  className="bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50"
                >
                  {savingChannel ? 'Guardando...' : 'Guardar Canal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {channelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-t-xl"></div>

            <h3 className="text-lg font-bold mb-2 mt-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Eliminar Canal de Notificación
            </h3>

            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              ¿Estás seguro de que deseas eliminar este canal <span className="font-mono text-blue-400">{channelToDelete.tipo.toUpperCase()}</span> (<span className="text-white break-all">{channelToDelete.destino}</span>)? Ya no se enviarán alertas a este destino.
            </p>

            {deleteChannelError && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/[0.04] border border-red-500/20 text-red-400 text-xs flex items-center gap-3 backdrop-blur-sm">
                <span>{deleteChannelError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setChannelToDelete(null)}
                disabled={deletingChannel}
                className="px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteChannel}
                disabled={deletingChannel}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {deletingChannel ? 'Eliminando...' : 'Sí, eliminar canal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {                                       }
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115] border border-red-500/20 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-t-xl"></div>
            
            <h3 className="text-lg font-bold mb-2 mt-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Eliminar Monitor
            </h3>
            
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente el monitor <span className="font-bold text-white">"{monitor?.nombre}"</span>? Esta acción no se puede deshacer y borrará todo el historial asociado.
            </p>

            {deleteError && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/[0.04] border border-red-500/20 text-red-400 text-[13px] flex items-center gap-3 backdrop-blur-sm">
                <span className="font-medium">{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {                               }
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-t-xl"></div>
            
            <h3 className="text-lg font-bold mb-1 mt-1">Editar Monitor</h3>
            <p className="text-xs text-gray-400 mb-5">Configura las preferencias y visibilidad del servicio.</p>

            {(editError || intervalError) && (
              <div
                id={intervalError ? 'interval-error' : undefined}
                role="alert"
                className="mb-5 px-4 py-3 rounded-lg bg-red-500/[0.04] border border-red-500/20 text-red-400 text-[13px] flex items-center gap-3 backdrop-blur-sm"
              >
                <svg className="w-4 h-4 shrink-0 text-red-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium">{intervalError || editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-5" noValidate>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Nombre del servicio</label>
                <input
                  type="text"
                  required
                  value={editData.nombre}
                  onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Intervalo de revisión (60-86,400 segundos; máximo 24 horas)</label>
                <input
                  type="number"
                  required
                  min="60"
                  max={MAX_INTERVALO_SEGUNDOS}
                  step="1"
                  value={editData.intervalo_segundos}
                  aria-invalid={Boolean(intervalError)}
                  aria-describedby={intervalError ? 'interval-error' : undefined}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditData({ ...editData, intervalo_segundos: value === '' ? '' : Number(value) });
                    setIntervalError('');
                    setEditError('');
                  }}
                  className={`w-full bg-white/[0.03] border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-mono ${intervalError ? 'border-red-500/60' : 'border-white/10'}`}
                />
              </div>

              <div className="pt-3 border-t border-white/10 space-y-3">
                <p className="text-xs font-mono text-gray-400 uppercase">Visibilidad Pública</p>
                
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editData.incluido_en_status_personal}
                    onChange={(e) => setEditData({ ...editData, incluido_en_status_personal: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 transition-all"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Mostrar en mi Página de Estado Personal</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={Boolean(monitor?.verified && editData.incluido_en_status_global)}
                    disabled={!monitor?.verified}
                    onChange={(e) => setEditData({ ...editData, incluido_en_status_global: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <span className={`text-sm transition-colors ${monitor?.verified ? 'text-gray-300 group-hover:text-white' : 'text-gray-500'}`}>
                    Incluir en el Estado Global {!monitor?.verified && '(verifica el dominio para habilitarlo)'}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  {saving ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}