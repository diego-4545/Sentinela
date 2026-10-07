import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

                                              
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, ingresa un correo válido con "@" y un dominio.');
      return;
    }

    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      login(response.data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Credenciales inválidas. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
                                                                                  
    <div className="relative min-h-screen bg-[#050505] text-white flex flex-col items-center pt-24 md:pt-[12vh] overflow-hidden font-sans">
      
      {                               }
      <div className="absolute inset-0 z-0 h-full w-full bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      {                         }
      <div className="fixed top-[-100px] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-blue-500/20 blur-[160px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-500/[0.12] blur-[140px] rounded-full pointer-events-none z-0"></div>

      {                         }
      <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
        <div className="font-mono text-sm tracking-widest text-gray-400 uppercase font-semibold">
          Sentinela
        </div>
        <Link 
          to="/status/global" 
          className="group flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] transition-all backdrop-blur-md"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
            Estado Global
          </span>
        </Link>
      </div>

      {                                         }
      <div className="relative z-10 w-full max-w-[360px] px-4">
        <div className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3 drop-shadow-sm">
            Bienvenido
          </h1>
          <p className="text-gray-400 text-sm">
            Inicia sesión para monitorear tu infraestructura.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/[0.04] border border-red-500/20 text-red-400 text-[13px] flex items-center gap-3 backdrop-blur-sm">
            <svg className="w-4 h-4 shrink-0 text-red-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-gray-300">Email de operador</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:bg-white/[0.05] transition-all"
              placeholder="usuario@sentinela.my"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-gray-300 block">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:bg-white/[0.05] transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black hover:bg-gray-200 font-semibold py-3 rounded-lg text-sm transition-colors mt-2 disabled:opacity-50 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            {loading ? 'Autenticando...' : 'Entrar al sistema'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            ¿No tienes acceso?{' '}
            <Link to="/register" className="text-white hover:underline transition-all font-medium">
              Crea una cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}