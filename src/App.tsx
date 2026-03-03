/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI, Type } from "@google/genai";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { angolaData } from './angolaData';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import { 
  BookOpen, 
  PlusCircle, 
  Library, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Download, 
  Eye, 
  Send, 
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Menu,
  X,
  Sparkles,
  FileText,
  MessageSquare,
  Folder,
  Search,
  Moon,
  Sun,
  Mail,
  Edit2,
  Trash2,
  Plus,
  Calendar,
  LayoutDashboard,
  Bell,
  BarChart2,
  Award,
  Camera,
  Globe,
  MapPin,
  Heart,
  Share2,
  ExternalLink,
  Cloud,
  WifiOff
} from 'lucide-react';

// --- Types ---
interface UserData {
  id: number;
  email?: string;
  telefone?: string;
  plano_tipo: string;
  limite_planos: number;
  planos_consumidos: number;
  data_expiracao: string;
  status: string;
  is_admin: number;
  escola?: string;
  professor_nome?: string;
  provincia?: string;
  municipio?: string;
  numero_agente?: string;
  biografia?: string;
  especializacoes?: string;
  foto_url?: string;
  password?: string;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  category: 'MED' | 'Pedagogia' | 'Aviso';
  source?: string;
  date: string;
  is_ai_generated?: number;
}

interface FeedbackItem {
  id: number;
  user_id: number;
  content: string;
  type: string;
  status: string;
  created_at: string;
  professor_nome?: string;
  email?: string;
  telefone?: string;
}

interface PlanHistory {
  id: number;
  content: string;
  metadata: string;
  created_at: string;
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path?: string;
  children?: FileNode[];
}

interface Student {
  id: number;
  name: string;
  classe: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  plan_id?: number;
}

interface QuestionBankItem {
  id: number;
  subject: string;
  classe: string;
  content: string;
  created_at: string;
}

interface CommunityPlan {
  id: number;
  user_id: number;
  plan_id: number;
  title: string;
  subject: string;
  classe: string;
  content: string;
  status: string;
  likes: number;
  created_at: string;
  professor_nome: string;
  escola: string;
  foto_url?: string;
}

// --- UI Components ---

const ToastContext = React.createContext<{
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}>({ addToast: () => {} });

const useToast = () => React.useContext(ToastContext);

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  const bg = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? <CheckCircle size={18} /> : type === 'error' ? <AlertCircle size={18} /> : <MessageSquare size={18} />;

  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.9 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`${bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[300px] z-[9999]`}
    >
      {icon}
      <span className="font-medium text-sm">{message}</span>
      <button onClick={onClose} className="ml-auto hover:bg-white/20 p-1 rounded-lg transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  );
};

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' | 'info' }[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999] pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <Toast message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
);

const DashboardStats = ({ user, theme }: { user: UserData, theme: 'light' | 'dark' }) => {
  const [stats, setStats] = useState<{ plansByMonth: any[], subjectsCount: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/stats/${user.id}`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [user.id]);

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'} shadow-sm`}>
        <h3 className={`text-sm font-bold uppercase tracking-widest mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Produtividade Mensal (Planos)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats?.plansByMonth}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#f3f4f6'} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'} shadow-sm`}>
        <h3 className={`text-sm font-bold uppercase tracking-widest mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Disciplinas mais Lecionadas</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats?.subjectsCount}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="count"
                nameKey="subject"
              >
                {Array.isArray(stats?.subjectsCount) && stats?.subjectsCount.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const NewsFeed = ({ theme }: { theme: 'light' | 'dark' }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new TypeError("Received non-JSON response from server");
        }

        const data = await res.json();
        setNews(data);
      } catch (error) {
        console.error("Failed to fetch news:", error);
        // Optionally set empty news or show error state
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  if (loading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;

  return (
    <div className="space-y-4">
      {Array.isArray(news) && news.map(item => (
        <motion.div 
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-4 rounded-2xl border transition-all hover:shadow-md ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-black/5'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                item.category === 'MED' ? 'bg-blue-100 text-blue-700' : 
                item.category === 'Pedagogia' ? 'bg-emerald-100 text-emerald-700' : 
                'bg-amber-100 text-amber-700'
              }`}>
                {item.category}
              </span>
              <span className="text-[10px] text-gray-400 font-bold">{new Date(item.date).toLocaleDateString()}</span>
            </div>
            {item.is_ai_generated === 1 && (
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                <Sparkles size={10} />
                IA
              </div>
            )}
          </div>
          <div className="mb-2">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Portal Pedagógico Angola</p>
            <h4 className={`font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{item.title}</h4>
          </div>
          <p className="text-xs text-gray-500 line-clamp-3 mb-2">{item.content}</p>
          <div className="flex items-center gap-1 text-[10px] text-gray-400 italic">
            <Globe size={10} />
            Fonte: {item.source || 'Portal Pedagógico Angola'}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const ProfileView = ({ user, onUpdateUser, theme }: { user: UserData, onUpdateUser: (u: UserData) => void, theme: 'light' | 'dark' }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    professor_nome: user.professor_nome || '',
    numero_agente: user.numero_agente || '',
    biografia: user.biografia || '',
    especializacoes: user.especializacoes || '',
    foto_url: user.foto_url || '',
    escola: user.escola || '',
    provincia: user.provincia || '',
    municipio: user.municipio || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id: user.id })
      });
      const data = await res.json();
      if (res.ok) {
        onUpdateUser(data.user);
        addToast("Perfil atualizado com sucesso!", 'success');
      }
    } catch (err) {
      addToast("Erro ao atualizar perfil", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, foto_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      <div className={`p-8 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'} shadow-xl`}>
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-500/20 shadow-xl">
                {formData.foto_url ? (
                  <img src={formData.foto_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <User size={48} />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-emerald-700 transition-all">
                <Camera size={16} />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            </div>
            <div className="text-center">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.professor_nome}</h2>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{user.plano_tipo} Plan</p>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                <input 
                  value={formData.professor_nome} 
                  onChange={e => setFormData(prev => ({ ...prev, professor_nome: e.target.value }))}
                  readOnly={!user.is_admin}
                  className={`w-full px-4 py-3 rounded-xl border ${!user.is_admin ? 'bg-gray-100 cursor-not-allowed text-gray-500' : (theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}`} 
                />
                {!user.is_admin && <p className="text-[10px] text-gray-400 mt-1 italic">* Nome fixo conforme registro. Contacte o admin para alterar.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nº de Agente</label>
                <input 
                  value={formData.numero_agente} 
                  onChange={e => setFormData(prev => ({ ...prev, numero_agente: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Especializações</label>
                <input 
                  value={formData.especializacoes} 
                  onChange={e => setFormData(prev => ({ ...prev, especializacoes: e.target.value }))}
                  placeholder="Ex: Matemática, Alfabetização"
                  className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`} 
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Biografia / Resumo Profissional</label>
                <textarea 
                  rows={3}
                  value={formData.biografia} 
                  onChange={e => setFormData(prev => ({ ...prev, biografia: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Escola</label>
                <input 
                  value={formData.escola} 
                  onChange={e => setFormData(prev => ({ ...prev, escola: e.target.value }))}
                  readOnly={!user.is_admin}
                  className={`w-full px-4 py-3 rounded-xl border ${!user.is_admin ? 'bg-gray-100 cursor-not-allowed text-gray-500' : (theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200')}`} 
                />
                {!user.is_admin && <p className="text-[10px] text-gray-400 mt-1 italic">* Escola fixa conforme registro.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Província</label>
                <input 
                  value={formData.provincia} 
                  onChange={e => setFormData(prev => ({ ...prev, provincia: e.target.value }))}
                  className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`} 
                />
              </div>
              <div className="md:col-span-2">
                <button 
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Components ---

const Logo = ({ size = 32, variant = "default" }: { size?: number, variant?: "default" | "light" }) => {
  const [logo, setLogo] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    fetch('/api/settings/logo')
      .then(res => res.json())
      .then(data => {
        if (data.logo) {
          setLogo(data.logo);
        }
      })
      .catch(err => console.error("Logo fetch error:", err));
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="relative group">
        <div className="relative">
          {logo && !imageError ? (
            <img 
              src={logo} 
              alt="PPA Logo" 
              className="w-14 h-14 object-contain transition-transform group-hover:scale-105 drop-shadow-md" 
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200/50 transition-all group-hover:shadow-emerald-300/50 group-hover:-translate-y-0.5 overflow-hidden relative border border-white/20">
              {/* Stylized Map of Angola Background */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-30 text-amber-400 fill-current scale-110">
                <path d="M45,15 L55,15 L65,25 L75,35 L75,55 L65,75 L45,85 L35,75 L25,55 L25,35 L35,25 Z" />
              </svg>
              
              {/* Central Icon: Book + Lightbulb */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <BookOpen size={24} className="text-white drop-shadow-sm" />
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="relative">
                      <div className="w-5 h-5 bg-amber-300 rounded-full blur-[3px] animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-3 bg-white rounded-t-full rounded-b-sm border-b-2 border-amber-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Decorative Elements from the photo */}
              <div className="absolute top-1 left-1 opacity-60">
                <div className="w-3 h-4 bg-white/20 rounded-sm border border-white/30 flex flex-col gap-0.5 p-0.5">
                  <div className="w-full h-px bg-white/50" />
                  <div className="w-full h-px bg-white/50" />
                  <div className="w-full h-px bg-white/50" />
                </div>
              </div>
              
              <div className="absolute top-1 right-1 opacity-60">
                <div className="text-[6px] font-bold text-white leading-none">ABC</div>
              </div>
              
              <div className="absolute bottom-1 left-1 opacity-60">
                <div className="w-4 h-1 bg-amber-500 rounded-full rotate-45" />
              </div>
            </div>
          )}
          
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center shadow-md">
            <Sparkles size={10} className="text-white" />
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        <h1 className={`font-black text-3xl tracking-tighter leading-none ${variant === 'light' ? 'text-white' : 'text-gray-900'}`}>
          PPA<span className="text-emerald-500">.</span>
        </h1>
        <p className={`text-[11px] uppercase font-extrabold tracking-[0.25em] mt-1 ${variant === 'light' ? 'text-white/60' : 'text-gray-400'}`}>
          Portal Pedagógico
        </p>
      </div>
    </div>
  );
};

const Login = ({ onLogin, theme, toggleTheme }: { onLogin: (user: UserData) => void, theme: 'light' | 'dark', toggleTheme: () => void }) => {
  const { addToast } = useToast();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [escola, setEscola] = useState('');
  const [professorNome, setProfessorNome] = useState('');
  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [plano, setPlano] = useState('Bronze');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState('');

  const handleSolicitarWhatsApp = () => {
    const message = `Olá Prof. António Basto! Sou o professor(a) ${professorNome}. Escola: ${escola}. Província: ${provincia}. Município: ${municipio}. Plano: ${plano}. Contacto: ${identifier}. Gostaria de adquirir o acesso ao Portal Pedagógico Angola.`;
    const url = `https://wa.me/244954458413?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSolicitarSMS = () => {
    const message = `Olá Prof. António Basto! Sou o professor(a) ${professorNome}. Escola: ${escola}. Província: ${provincia}. Município: ${municipio}. Plano: ${plano}. Contacto: ${identifier}. Gostaria de adquirir o acesso ao Portal Pedagógico Angola.`;
    const url = `sms:+244954458413?body=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSolicitarEmail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/request-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: identifier.includes('@') ? identifier : undefined,
          telefone: !identifier.includes('@') ? identifier : undefined,
          professor_nome: professorNome,
          escola,
          provincia,
          municipio,
          plano_tipo: plano
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Pedido enviado por e-mail com sucesso!', 'success');
        setError('');
      } else {
        setError(data.error);
        addToast(data.error, 'error');
      }
    } catch (err) {
      setError('Erro ao enviar e-mail');
      addToast('Erro ao enviar e-mail', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Uma nova senha foi gerada. Entre em contato com o suporte.', 'success');
        setError('');
      } else {
        setError(data.error);
        addToast(data.error, 'error');
      }
    } catch (err) {
      setError('Erro de conexão');
      addToast('Erro de conexão', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const isEmail = identifier.includes('@');
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identifier,
          email: isRegister && isEmail ? identifier : undefined,
          telefone: isRegister && !isEmail ? identifier : undefined,
          password,
          escola: isRegister ? escola : undefined,
          professor_nome: isRegister ? professorNome : undefined,
          provincia: isRegister ? provincia : undefined,
          municipio: isRegister ? municipio : undefined,
          plano_tipo: isRegister ? plano : undefined
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.error("Erro ao fazer parse do JSON:", e);
        throw new Error(`Erro no servidor (${res.status}). Tente novamente mais tarde.`);
      }

      if (res.ok) {
        if (isRegister) {
          setIsRegister(false);
          addToast('Pedido enviado! Aguarde ativação pelo administrador.', 'success');
        } else {
          onLogin(data.user);
          addToast(`Bem-vindo de volta!`, 'success');
        }
      } else {
        setError(data.error || 'Erro desconhecido');
        addToast(data.error || 'Erro desconhecido', 'error');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Erro de conexão com o servidor';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isForgot) {
    return (
      <div className="min-h-screen bg-[#f5f2ed] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-black/5"
        >
          <div className="text-center mb-8">
            <Logo size={48} />
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Recuperar Senha</h1>
            <p className="text-gray-500 mt-2">Introduza seu e-mail ou telefone de registro</p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail ou Telefone</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="exemplo@gmail.com ou 9xx..."
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
              />
            </div>
            {error && (
              <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${error.includes('gerada') ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <button 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Gerar Nova Senha'}
            </button>
            <button 
              type="button"
              onClick={() => setIsForgot(false)}
              className="w-full text-sm font-bold text-gray-400 hover:text-gray-600 transition-all"
            >
              Voltar ao Login
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ed] flex items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-black/5"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo size={48} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal Pedagógico Angola</h1>
          <p className="text-gray-500 mt-1 text-sm">Apoio ao Professor do Ensino Primário</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
          <button 
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isRegister ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}
          >
            🔐 Entrar
          </button>
          <button 
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isRegister ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}
          >
            🔑 Solicitar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-end">
            <button 
              type="button" 
              onClick={toggleTheme}
              className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-gray-800 text-amber-400' : 'bg-gray-100 text-gray-500'}`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>E-mail ou Telefone</label>
            <input 
              type="text" 
              required
              className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              placeholder="exemplo@gmail.com ou 9xx..."
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Nome Completo do Professor</label>
                <input 
                  type="text" 
                  required
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  placeholder="Seu nome completo"
                  value={professorNome}
                  onChange={e => setProfessorNome(e.target.value)}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Nome da Escola</label>
                <input 
                  type="text" 
                  required
                  className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  placeholder="Nome da sua escola"
                  value={escola}
                  onChange={e => setEscola(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Sua Província</label>
                  <select 
                    required
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                    value={provincia}
                    onChange={e => {
                      setProvincia(e.target.value);
                      setMunicipio(''); // Reset municipality when province changes
                    }}
                  >
                    <option value="">Selecionar...</option>
                    {Object.keys(angolaData).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Município</label>
                  <select 
                    required
                    disabled={!provincia}
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all disabled:opacity-50 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                    value={municipio}
                    onChange={e => setMunicipio(e.target.value)}
                  >
                    <option value="">Selecionar...</option>
                    {provincia && angolaData[provincia].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Escolha o Plano</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Bronze', 'Prata', 'Ouro'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlano(p)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                        plano === p 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                          : theme === 'dark' 
                            ? 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600' 
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {p}
                      <span className="block text-[9px] font-normal opacity-80 mt-0.5">
                        {p === 'Bronze' ? '90 dias' : p === 'Prata' ? '180 dias' : '365 dias'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {!isRegister ? (
            <div>
              <div className="flex justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Chave de Acesso</label>
                <button 
                  type="button"
                  onClick={() => setIsForgot(true)}
                  className="text-xs font-bold text-emerald-600 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <input 
                type="password" 
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="Insira sua chave"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          ) : (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm text-emerald-800 space-y-3">
              <p className="font-bold flex items-center gap-2">
                <AlertCircle size={16} /> Como funciona:
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Introduza seu e-mail ou telefone acima.</li>
                <li>Fale com o Administrador via WhatsApp ou SMS.</li>
              </ol>
              <div className="space-y-2">
                {(professorNome && escola && identifier) && (
                  <>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-center">
                      <button 
                        type="button"
                        onClick={handleSolicitarWhatsApp}
                        className="text-emerald-600 font-bold hover:underline flex items-center justify-center gap-2 w-full"
                      >
                        <MessageSquare size={16} /> Enviar pedido pelo WhatsApp
                      </button>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-center">
                      <button 
                        type="button"
                        onClick={handleSolicitarSMS}
                        className="text-emerald-600 font-bold hover:underline flex items-center justify-center gap-2 w-full"
                      >
                        <FileText size={16} /> Enviar pedido via SMS
                      </button>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-center">
                      <button 
                        type="button"
                        onClick={handleSolicitarEmail}
                        className="text-emerald-600 font-bold hover:underline flex items-center justify-center gap-2 w-full"
                      >
                        <Mail size={16} /> Enviar pedido via E-mail
                      </button>
                    </div>
                  </>
                )}
                <div className="text-center py-2 border-t border-emerald-100 mt-2">
                  <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Ou ligue para ativação:</p>
                  <p className="font-bold text-emerald-900">948 298 246 / 954 458 413</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${error.includes('enviado') || error.includes('gerada') ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {!isRegister && (
            <button 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Entrar no Portal'}
            </button>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
            Suporte: 948 298 246 / 954 458 413
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const LessonGenerator = ({ user, onUpdateUser, showHistory, setShowHistory, theme, isOnline }: { user: UserData, onUpdateUser: (u: UserData) => void, showHistory: boolean, setShowHistory: (s: boolean) => void, theme: 'light' | 'dark', isOnline: boolean }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    escola: user.escola || '',
    professor: user.professor_nome || '',
    trimestre: '1º Trimestre',
    classe: '1ª Classe',
    disciplina: '',
    tema: '',
    subtema: '',
    sumario: '',
    aula_numero: 1,
    tempo: '45',
    template: 'Padrão'
  });
  const [result, setResult] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<PlanHistory[]>([]);
  const [dbCurriculum, setDbCurriculum] = useState<any[]>([]);
  const planRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
    fetchCurriculum();
    fetchGlobalSettings();
  }, []);

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      
      // For admins, we MANDATORILY use the default settings if they exist
      // For regular users, we only use them if their own data is empty
      if (user.is_admin) {
        setFormData(prev => ({ 
          ...prev, 
          escola: data.default_escola || prev.escola,
          professor: data.default_professor || prev.professor
        }));
      } else {
        if (data.default_escola && !user.escola) {
          setFormData(prev => ({ ...prev, escola: data.default_escola }));
        }
        if (data.default_professor && !user.professor_nome) {
          setFormData(prev => ({ ...prev, professor: data.default_professor }));
        }
      }
      
      // Store settings for later use in prompt
      (window as any).ppa_settings = data;
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCurriculum = async () => {
    try {
      const res = await fetch('/api/curriculum');
      const data = await res.json();
      setDbCurriculum(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/plans/history/${user.id}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Derived lists from DB Curriculum
  const classes = Array.from(new Set(dbCurriculum.map(c => c.classe)));
  const disciplinas = Array.from(new Set(dbCurriculum.filter(c => c.classe === formData.classe).map(c => c.disciplina)));
  const temas = Array.from(new Set(dbCurriculum.filter(c => c.classe === formData.classe && c.disciplina === formData.disciplina).map(c => c.tema)));
  const subtemas = Array.from(new Set(dbCurriculum.filter(c => c.classe === formData.classe && c.disciplina === formData.disciplina && c.tema === formData.tema).map(c => c.subtema || ''))).filter(s => s !== '');
  const sumarios = dbCurriculum.find(c => c.classe === formData.classe && c.disciplina === formData.disciplina && c.tema === formData.tema && (c.subtema === formData.subtema || (!c.subtema && !formData.subtema)))?.sumarios;
  const sumariosList = sumarios ? JSON.parse(sumarios) : [];

  useEffect(() => {
    if (disciplinas.length > 0 && !disciplinas.includes(formData.disciplina)) {
      setFormData(prev => ({ ...prev, disciplina: disciplinas[0] }));
    }
  }, [formData.classe, dbCurriculum]);

  useEffect(() => {
    if (temas.length > 0 && !temas.includes(formData.tema)) {
      setFormData(prev => ({ ...prev, tema: temas[0] }));
    }
  }, [formData.disciplina, dbCurriculum]);

  useEffect(() => {
    if (subtemas.length > 0 && !subtemas.includes(formData.subtema)) {
      setFormData(prev => ({ ...prev, subtema: subtemas[0] }));
    }
  }, [formData.tema, dbCurriculum]);

  useEffect(() => {
    if (sumariosList.length > 0 && !sumariosList.includes(formData.sumario)) {
      setFormData(prev => ({ ...prev, sumario: sumariosList[0] }));
    }
  }, [formData.subtema, dbCurriculum]);

    const handleGenerate = async () => {
    if (!isOnline) {
      addToast("Não é possível gerar planos em modo offline. Verifique sua conexão.", 'error');
      return;
    }
    setLoading(true);
    setError('');

    if (user.limite_planos !== null && user.planos_consumidos >= user.limite_planos && !user.is_admin) {
        setError("Limite de planos atingido. Melhore seu plano.");
        setLoading(false);
        return;
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const modelName = "gemini-3-flash-preview";

      // --- Search for relevant documents in the library ---
      let inideContext = "";
      try {
        const libRes = await fetch('/api/library/files');
        const libData: FileNode[] = await libRes.json();
        
        const allFiles: { name: string, path: string }[] = [];
        const flatten = (nodes: FileNode[]) => {
          nodes.forEach(node => {
            if (node.type === 'file' && node.path) allFiles.push({ name: node.name, path: node.path });
            if (node.children) flatten(node.children);
          });
        };
        flatten(libData);

        const relevantFiles = allFiles.filter(f => {
          const nameLower = f.name.toLowerCase();
          const disciplinaLower = formData.disciplina.toLowerCase();
          const classeLower = formData.classe.toLowerCase();
          return nameLower.includes(disciplinaLower) || nameLower.includes(classeLower);
        }).slice(0, 2);

        if (relevantFiles.length > 0) {
          for (const file of relevantFiles) {
            const textRes = await fetch(`/api/library/extract-text/${encodeURIComponent(file.path)}`);
            if (textRes.ok) {
              const textData = await textRes.json();
              inideContext += `\n--- CONTEÚDO DO DOCUMENTO OFICIAL: ${file.name} ---\n${textData.text}\n`;
            }
          }
        }
      } catch (libErr) {
        console.warn("Could not fetch library context:", libErr);
      }

      const settings = (window as any).ppa_settings || {};
      const prov = user.is_admin ? (settings.default_provincia || user.provincia || 'Não definida') : (user.provincia || 'Não definida');
      const mun = user.is_admin ? (settings.default_municipio || user.municipio || 'Não definido') : (user.municipio || 'Não definido');

      const prompt = `
Você é um especialista em educação angolana. Gere um plano de aula completo e rigoroso baseado no currículo oficial do INIDE (Angola).

${inideContext ? `Use as seguintes informações extraídas dos manuais oficiais do INIDE como base principal para o conteúdo pedagógico:
${inideContext}` : "Nota: Não foram encontrados manuais específicos na biblioteca local, use seu conhecimento interno sobre o currículo de Angola."}

LAYOUT OFICIAL ANGOLA - MINISTÉRIO DA EDUCAÇÃO
--------------------------------------------------
Escola: ${formData.escola}
Professor: ${formData.professor}
Província: ${prov}
Município: ${mun}
Disciplina: ${formData.disciplina}
Classe: ${formData.classe}
Trimestre: ${formData.trimestre}
Tempo: ${formData.tempo}
Aula nº: ${formData.aula_numero}
Unidade temática: ${formData.tema}
Subtema: ${formData.subtema}
Sumário: ${formData.sumario}

Se o subtema for amplo, divida em mais de uma aula de 45 minutos.

ESTRUTURA OBRIGATÓRIA DO PLANO:
1. Objetivo Geral do tema (baseado no programa do INIDE)
2. Objetivos da Aula (Operacionalizados)
3. Conteúdo (Fiel aos manuais do INIDE)
4. Material Didáctico
5. Metodologia (Ativa e participativa)
6. Actividades Chave
7. Tipo de Avaliação
8. Procedimentos (O passo a passo detalhado):
    - Introdução (Acolhimento e apresentação ou motivação)
    - Desenvolvimento (Explicação clara e exemplos práticos)
    - Atividades ou exercícios (Para os alunos resolverem)
    - Consolidação (Resumo dos pontos principais)
    - Avaliação (Verificação rápida da aprendizagem)
    - Tarefa para Casa

Linguagem formal pedagógica angolana.
Adicione uma marca d'água textual no final: "Gerado por Portal Pedagógico Angola (PPA) - Qualidade INIDE"

IMPORTANTE: No final do plano, após a marca d'água, adicione uma seção chamada "RECOMENDAÇÕES DA IA PARA O PROFESSOR" com 3 a 5 dicas práticas de como aplicar este plano específico (ex: revisar 3 vezes antes da aula, preparar material X com antecedência, etc).

Formate a resposta em Markdown rico.`;

            const response = await ai.models.generateContent({ model: modelName, contents: [{ parts: [{ text: prompt }] }] });
      const planContent = response.text;
      setResult(planContent);

      // Save history and update credits on the server
      await fetch('/api/plans/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          content: planContent,
          metadata: JSON.stringify({ ...formData, created_at: new Date().toISOString() })
        })
      });

      await fetch('/api/users/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      onUpdateUser({ ...user, planos_consumidos: user.planos_consumidos + 1 });
      fetchHistory();
      addToast("Plano de aula gerado com sucesso!", 'success');

    } catch (err) {
      console.error(err);
      setError(`[ERRO NO CLIENTE] Falha na chamada à IA: ${(err as Error).message}`);
      addToast("Erro ao gerar plano", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (h: PlanHistory) => {
    const meta = JSON.parse(h.metadata);
    try {
      const res = await fetch('/api/community/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          planId: h.id,
          title: meta.sumario || meta.tema,
          subject: meta.disciplina,
          classe: meta.classe,
          content: h.content
        })
      });
      if (res.ok) {
        addToast("Plano enviado para aprovação na Sala de Professores!", 'success');
      } else {
        const data = await res.json();
        addToast(data.error || "Erro ao partilhar", 'error');
      }
    } catch (err) {
      addToast("Erro ao partilhar", 'error');
    }
  };

  const handleExportDocx = async () => {
    try {
      const settings = (window as any).ppa_settings || {};
      const prov = user.is_admin ? (settings.default_provincia || user.provincia || 'Não definida') : (user.provincia || 'Não definida');
      const mun = user.is_admin ? (settings.default_municipio || user.municipio || 'Não definido') : (user.municipio || 'Não definido');

      const res = await fetch('/api/ai/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          plano: result,
          provincia: prov,
          municipio: mun
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plano_de_aula_${formData.disciplina}.docx`;
        a.click();
      }
    } catch (err) {
      addToast('Erro ao exportar Word', 'error');
    }
  };

  const handleDownloadPDF = async () => {
    if (!planRef.current) return;
    setLoading(true);
    try {
      const element = planRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: theme === 'dark' ? '#111827' : '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // If height is more than one page, we might need to split it, 
      // but for now let's keep it simple as most plans are 1-2 pages.
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`plano_${formData.disciplina}_${formData.classe}.pdf`);
      addToast("PDF baixado com sucesso!", 'success');
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      addToast("Erro ao gerar PDF", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDrive = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      const win = window.open(url, 'google_auth', 'width=600,height=700');
      
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          const { code } = event.data;
          addToast("Autenticado! Enviando para o Google Drive...", 'success');
          
          const uploadRes = await fetch('/api/google/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              title: `Plano de Aula - ${formData.disciplina} - ${formData.sumario}`,
              content: result
            })
          });
          
          if (uploadRes.ok) {
            addToast("Plano salvo no seu Google Drive!", 'success');
          } else {
            addToast("Erro ao salvar no Drive", 'error');
          }
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (err) {
      addToast("Erro ao iniciar conexão com Google", 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'} p-6 rounded-3xl border shadow-sm transition-colors duration-300`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
              <Sparkles size={20} />
            </div>
            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>📋 Dados da aula</h2>
          </div>
        </div>

        {showHistory ? (
          <div className="space-y-4 mb-8">
            <h3 className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Histórico Recente (30 dias)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.isArray(history) && history.map(h => {
                const meta = JSON.parse(h.metadata);
                return (
                  <div key={h.id} className={`p-4 rounded-2xl border transition-all cursor-pointer ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700 hover:border-emerald-500' : 'bg-gray-50/50 border-gray-100 hover:border-emerald-200'}`} onClick={() => setResult(h.content)}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>{meta.classe}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleShare(h); }}
                          className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors"
                          title="Partilhar na Sala de Professores"
                        >
                          <Share2 size={14} />
                        </button>
                        <span className="text-[10px] text-gray-400">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className={`font-bold text-sm truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{meta.disciplina}</p>
                    <p className="text-xs text-gray-500 truncate">{meta.tema}</p>
                  </div>
                );
              })}
              {(!Array.isArray(history) || history.length === 0) && <p className="text-gray-400 text-sm italic">Nenhum plano gerado recentemente.</p>}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Nome da Escola</label>
              <input 
                type="text"
                readOnly={!user.is_admin}
                className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all font-medium ${!user.is_admin ? (theme === 'dark' ? 'bg-gray-100 border-gray-200 text-black cursor-not-allowed' : 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed') : (theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900')}`}
                value={formData.escola}
                onChange={e => setFormData({...formData, escola: e.target.value})}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Professor</label>
              <input 
                type="text"
                readOnly={!user.is_admin}
                className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all font-medium ${!user.is_admin ? (theme === 'dark' ? 'bg-gray-100 border-gray-200 text-black cursor-not-allowed' : 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed') : (theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900')}`}
                value={formData.professor}
                onChange={e => setFormData({...formData, professor: e.target.value})}
              />
            </div>
            
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Classe</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.classe}
                onChange={e => setFormData({...formData, classe: e.target.value})}
              >
                {Array.isArray(classes) && classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Disciplina</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.disciplina}
                onChange={e => setFormData({...formData, disciplina: e.target.value})}
              >
                {Array.isArray(disciplinas) && disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Trimestre</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.trimestre}
                onChange={e => setFormData({...formData, trimestre: e.target.value})}
              >
                <option value="1º Trimestre">1º Trimestre</option>
                <option value="2º Trimestre">2º Trimestre</option>
                <option value="3º Trimestre">3º Trimestre</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Tema</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.tema}
                onChange={e => setFormData({...formData, tema: e.target.value})}
              >
                {Array.isArray(temas) && temas.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Subtema</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.subtema}
                onChange={e => setFormData({...formData, subtema: e.target.value})}
              >
                {Array.isArray(subtemas) && subtemas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Sumário</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.sumario}
                onChange={e => setFormData({...formData, sumario: e.target.value})}
              >
                {Array.isArray(sumariosList) && sumariosList.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Aula nº</label>
              <input 
                type="number"
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.aula_numero}
                onChange={e => setFormData({...formData, aula_numero: parseInt(e.target.value)})}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Modelo Exportação</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.template}
                onChange={e => setFormData({...formData, template: e.target.value})}
              >
                <option value="Padrão">Padrão</option>
                <option value="Pública">Escola Pública</option>
                <option value="Privada">Escola Privada</option>
                <option value="Luanda">Luanda</option>
                <option value="Benguela">Benguela</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Tempo (min)</label>
              <select 
                className={`w-full px-4 py-2.5 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium ${theme === 'dark' ? 'bg-white border-gray-200 text-black' : 'bg-white border-gray-200 text-gray-900'}`}
                value={formData.tempo}
                onChange={e => setFormData({...formData, tempo: e.target.value})}
              >
                <option value="45">45 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            <button 
              onClick={handleGenerate}
              disabled={loading || !formData.escola || !formData.professor}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-3 group"
            >
              {loading ? <Clock className="animate-spin" size={24} /> : <Sparkles className="group-hover:rotate-12 transition-transform" size={24} />}
              Gerar Plano de Aula
            </button>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Créditos: <span className="text-emerald-600">{user.planos_consumidos} / {user.limite_planos || '∞'}</span>
            </div>
          </div>
        </>
      )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-8 rounded-3xl border shadow-sm ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'}`}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Logo size={40} />
                <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Plano Gerado</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={async () => {
                    const title = prompt("Título para o agendamento:", `${formData.disciplina} - ${formData.sumario}`);
                    if (!title) return;
                    const date = prompt("Data e Hora (AAAA-MM-DD HH:MM):", new Date().toISOString().slice(0, 16).replace('T', ' '));
                    if (!date) return;
                    try {
                      await fetch('/api/calendar/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId: user.id,
                          title,
                          start_date: date,
                          end_date: date,
                          plan_id: null // Could link to history if saved
                        })
                      });
                      addToast("Aula agendada com sucesso!", 'success');
                    } catch (err) {
                      addToast("Erro ao agendar", 'error');
                    }
                  }}
                  className="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Clock size={18} /> Agendar
                </button>
                <button 
                  onClick={handleGoogleDrive}
                  className="text-emerald-700 hover:bg-emerald-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Cloud size={18} /> Google Drive
                </button>
                <button 
                  onClick={handleExportDocx}
                  className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <FileText size={18} /> Baixar Word
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Download size={18} /> Baixar PDF
                </button>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Editor de Plano</span>
              <button 
                onClick={() => {
                  const newContent = prompt("Editar Plano (Markdown):", result);
                  if (newContent !== null) setResult(newContent);
                }}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Editar Texto
              </button>
            </div>

            <div ref={planRef} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
              <div className={`markdown-body prose prose-emerald max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
                <Markdown remarkPlugins={[remarkGfm]}>{result}</Markdown>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                  Gerado por Portal Pedagógico Angola (PPA) • Qualidade INIDE
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LibraryView = () => {
  const { addToast } = useToast();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<{ name: string, base64: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'manuais' | 'central'>('manuais');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/library/files');
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (file: FileNode) => {
    if (!file.path) return;
    try {
      const res = await fetch(`/api/library/view/${encodeURIComponent(file.path)}`);
      const data = await res.json();
      setViewingFile({ name: file.name, base64: data.base64 });
    } catch (err) {
      addToast("Erro ao abrir arquivo", 'error');
    }
  };

  const handleDownload = async (file: FileNode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!file.path) return;
    addToast("Iniciando download...", 'info');
    try {
      const res = await fetch(`/api/library/view/${encodeURIComponent(file.path)}`);
      const data = await res.json();
      
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.base64}`;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("Download concluído!", 'success');
    } catch (err) {
      addToast("Erro ao baixar arquivo", 'error');
    }
  };

  const getCurrentFolder = () => {
    let current = files;
    
    if (activeTab === 'central') {
      current = files.find(f => f.name === 'Centrais de Documentos')?.children || [];
    }

    if (searchQuery.trim()) {
      const results: FileNode[] = [];
      const query = searchQuery.toLowerCase();
      
      let baseFiles = current;
      if (activeTab === 'manuais') {
        const order = ["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"];
        baseFiles = current.filter(f => f.name !== 'Centrais de Documentos' && order.includes(f.name));
      }

      const searchRecursive = (nodes: FileNode[]) => {
        for (const node of nodes) {
          if (node.name.toLowerCase().includes(query)) {
            results.push(node);
          }
          if (node.children) {
            searchRecursive(node.children);
          }
        }
      };

      searchRecursive(baseFiles);
      return results;
    }

    // Auto-filter based on tab if at root
    if (currentPath.length === 0) {
      if (activeTab === 'manuais') {
        // Classes folders are at root
        const order = ["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"];
        current = current.filter(f => f.name !== 'Centrais de Documentos' && order.includes(f.name))
                      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
      } else {
        // Centrais de Documentos is at root
        const docsOrder = [
          "Programas do Ensino Primário", "Cadernos de Avaliação", "Calendário Escolar", 
          "Constituição da República", "Currículo por Níveis", "Decretos Presidenciais", 
          "Diário da República", "Dosificação", "Estatuto da Carreira Docente", 
          "Estatuto da Carreira do Ministério da Educação", "Leis de Bases", 
          "Regulamento Escolar", "Outros Documentos"
        ];
        current = current
          .filter(f => docsOrder.includes(f.name))
          .sort((a, b) => docsOrder.indexOf(a.name) - docsOrder.indexOf(b.name));
      }
    } else {
      for (const segment of currentPath) {
        const found = current.find(f => f.name === segment);
        if (found && found.children) {
          current = found.children;
        }
      }
      
      // Filter subfolders in Centrais de Documentos except for Programas
      if (activeTab === 'central') {
        const isProgramas = currentPath.includes("Programas do Ensino Primário");
        if (!isProgramas) {
          // Remove subfolders if not in Programas
          current = current.filter(f => f.type === 'file');
        }
      }
    }

    return current;
  };

  return (
    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Library size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">📚 Biblioteca Digital</h2>
          </div>
          <div className="flex gap-2 text-sm">
            <button 
              onClick={() => setCurrentPath([])}
              className="text-gray-500 hover:text-gray-900"
            >
              Início
            </button>
            {currentPath.map((p, i) => (
              <React.Fragment key={p}>
                <span className="text-gray-300">/</span>
                <button 
                  onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                  className="text-gray-500 hover:text-gray-900"
                >
                  {p}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl mb-4 overflow-x-auto whitespace-nowrap gap-1 no-scrollbar">
          <button 
            onClick={() => { setActiveTab('manuais'); setCurrentPath([]); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-shrink-0 ${activeTab === 'manuais' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Folder size={16} /> Manuais INIDE
          </button>
          <button 
            onClick={() => { setActiveTab('central'); setCurrentPath([]); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 flex-shrink-0 ${activeTab === 'central' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Library size={16} /> Central de Documentos
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar documentos por nome ou palavra-chave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(getCurrentFolder()) && getCurrentFolder().map((file, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -2 }}
                onClick={() => {
                  if (file.type === 'directory') {
                    if (searchQuery.trim() && file.path) {
                      // file.path is like "/Centrais de Documentos/Programas do Ensino Primário/1ª Classe"
                      // or "/1ª Classe/Matemática"
                      const pathParts = file.path.split('/').filter(Boolean);
                      if (activeTab === 'central') {
                        // Remove "Centrais de Documentos" from the beginning
                        if (pathParts[0] === 'Centrais de Documentos') {
                          pathParts.shift();
                        }
                      }
                      setCurrentPath(pathParts);
                      setSearchQuery('');
                    } else {
                      setCurrentPath([...currentPath, file.name]);
                    }
                  } else {
                    handleView(file);
                  }
                }}
                className="p-4 rounded-2xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center gap-4"
              >
                <div className={`p-3 rounded-xl ${file.type === 'directory' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                  {file.type === 'directory' ? <PlusCircle size={20} /> : <BookOpen size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wider truncate">
                    {searchQuery.trim() && file.path ? file.path.replace(/^\//, '') : (file.type === 'directory' ? 'Pasta' : 'Documento PDF')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {file.type !== 'directory' && (
                    <button
                      onClick={(e) => handleDownload(file, e)}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                      title="Baixar"
                    >
                      <Download size={18} />
                    </button>
                  )}
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </motion.div>
            ))}
            {getCurrentFolder().length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400">
                Esta pasta está vazia.
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewingFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <h3 className="font-bold text-gray-900">{viewingFile.name}</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `data:application/pdf;base64,${viewingFile.base64}`;
                      link.download = viewingFile.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors"
                    title="Baixar"
                  >
                    <Download size={20} />
                  </button>
                  <button 
                    onClick={() => setViewingFile(null)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <iframe 
                  src={`data:application/pdf;base64,${viewingFile.base64}`}
                  className="w-full h-full border-none"
                  title="PDF Viewer"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CurriculumManager = () => {
  const { addToast } = useToast();
  const [curriculum, setCurriculum] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'manuais' | 'central' | 'gerenciador'>('manuais');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [files, setFiles] = useState<FileNode[]>([]);
  const [addingItem, setAddingItem] = useState<any | null>(null);
  const [addingName, setAddingName] = useState("");
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    fetchCurriculum();
    fetchFiles();
  }, []);

  const fetchCurriculum = async () => {
    try {
      const res = await fetch('/api/curriculum');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCurriculum(data);
      } else {
        setCurriculum([]);
      }
    } catch (err) {
      console.error(err);
      setCurriculum([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/library/files');
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddClick = (params: any) => {
    setAddingItem(params);
    setAddingName("");
  };

  const handleEditClick = (params: any, currentName: string) => {
    setEditingItem(params);
    setEditingName(currentName);
  };

  const confirmAdd = async () => {
    if (!addingName.trim() || !addingItem) return;
    try {
      await fetch('/api/admin/curriculum/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addingItem, [addingItem.type]: addingName })
      });
      addToast("Adicionado com sucesso", 'success');
      fetchCurriculum();
      setAddingItem(null);
    } catch (err) {
      addToast("Erro ao adicionar", 'error');
    }
  };

  const confirmEdit = async () => {
    if (!editingName.trim() || !editingItem) return;
    try {
      await fetch('/api/admin/curriculum/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: editingItem.type,
          oldData: editingItem,
          newData: { name: editingName }
        })
      });
      addToast("Editado com sucesso", 'success');
      fetchCurriculum();
      setEditingItem(null);
    } catch (err) {
      addToast("Erro ao editar", 'error');
    }
  };

  const handleRemove = async (params: any) => {
    if (!window.confirm("Tem certeza que deseja eliminar este item do currículo?")) return;
    try {
      const res = await fetch('/api/admin/curriculum/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        addToast("Removido com sucesso", 'success');
        fetchCurriculum();
      } else {
        addToast("Erro ao remover", 'error');
      }
    } catch (err) {
      addToast("Erro ao remover", 'error');
    }
  };

  const handleUpload = async (folder: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('folder', folder); // Field first
      formData.append('file', file); // File second
      try {
        await fetch('/api/admin/library/upload', {
          method: 'POST',
          body: formData
        });
        addToast("Upload concluído", 'success');
        fetchFiles();
      } catch (err) {
        addToast("Erro no upload", 'error');
      }
    };
    input.click();
  };

  const handleDeleteFile = async (filepath: string) => {
    if (!confirm("Excluir este arquivo?")) return;
    try {
      await fetch('/api/admin/library/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath })
      });
      addToast("Arquivo excluído", 'success');
      fetchFiles();
    } catch (err) {
      addToast("Erro ao excluir", 'error');
    }
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const getAllDirectories = (nodes: FileNode[], currentPath = ""): string[] => {
    let dirs: string[] = [];
    nodes.forEach(node => {
      if (node.type === 'directory') {
        const newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
        dirs.push(newPath);
        if (node.children) {
          dirs = dirs.concat(getAllDirectories(node.children, newPath));
        }
      }
    });
    return dirs;
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  const classes = ["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"];

  return (
    <div className="p-6">
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto whitespace-nowrap gap-1 no-scrollbar">
        <button onClick={() => setActiveTab('manuais')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'manuais' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Adicionar novo currículo</button>
        <button onClick={() => setActiveTab('gerenciador')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${activeTab === 'gerenciador' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>Gerenciador de currículo</button>
      </div>

      {activeTab === 'manuais' && (
        <div className="space-y-4">
          {classes.map(cls => (
            <div key={cls} className="border border-gray-100 rounded-2xl overflow-hidden">
              <button onClick={() => toggle(cls)} className="w-full p-4 bg-gray-50 flex justify-between items-center font-bold text-gray-900">
                <span>{cls}</span>
                <ChevronRight className={`transition-transform ${expanded[cls] ? 'rotate-90' : ''}`} size={18} />
              </button>
              {expanded[cls] && (
                <div className="p-4 space-y-2 bg-white">
                  <button onClick={() => handleAddClick({ classe: cls, type: 'disciplina' })} className="text-xs font-bold text-emerald-600 flex items-center gap-1 mb-2"><PlusCircle size={14} /> Adicionar Disciplina</button>
                  {Array.from(new Set(curriculum.filter(c => c.classe === cls).map(c => c.disciplina))).filter(Boolean).map(disc => (
                    <div key={disc} className="ml-4 border-l-2 border-gray-100 pl-4">
                      <div className="flex justify-between items-center py-1">
                        <button onClick={() => toggle(cls + disc)} className="font-bold text-sm text-gray-700">{disc}</button>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditClick({ classe: cls, disciplina: disc, type: 'disciplina' }, disc)} className="text-blue-400 hover:text-blue-600"><Edit2 size={14} /></button>
                          <button onClick={() => handleRemove({ classe: cls, disciplina: disc })} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {expanded[cls + disc] && (
                        <div className="mt-2 space-y-2">
                          <button onClick={() => handleAddClick({ classe: cls, disciplina: disc, type: 'tema' })} className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><PlusCircle size={12} /> Adicionar Tema</button>
                          {Array.from(new Set(curriculum.filter(c => c.classe === cls && c.disciplina === disc).map(c => c.tema))).filter(Boolean).map(tema => (
                            <div key={tema} className="ml-4">
                              <div className="flex justify-between items-center py-1">
                                <button onClick={() => toggle(cls + disc + tema)} className="text-sm text-gray-600">{tema}</button>
                                <div className="flex gap-2">
                                  <button onClick={() => handleEditClick({ classe: cls, disciplina: disc, tema: tema, type: 'tema' }, tema)} className="text-blue-400 hover:text-blue-600"><Edit2 size={12} /></button>
                                  <button onClick={() => handleRemove({ classe: cls, disciplina: disc, tema: tema })} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                                </div>
                              </div>
                              {expanded[cls + disc + tema] && (
                                <div className="mt-1 space-y-1">
                                  <button onClick={() => handleAddClick({ classe: cls, disciplina: disc, tema: tema, type: 'subtema' })} className="text-[10px] font-bold text-amber-600 flex items-center gap-1"><PlusCircle size={10} /> Adicionar Subtema</button>
                                  {Array.from(new Set(curriculum.filter(c => c.classe === cls && c.disciplina === disc && c.tema === tema).map(c => c.subtema || ''))).map(sub => (
                                    <div key={sub || 'empty'} className="ml-4">
                                      {sub ? (
                                        <>
                                          <div className="flex justify-between items-center py-1">
                                            <button onClick={() => toggle(cls + disc + tema + sub)} className="text-xs text-gray-500 italic">{sub}</button>
                                            <div className="flex gap-2">
                                              <button onClick={() => handleEditClick({ classe: cls, disciplina: disc, tema: tema, subtema: sub, type: 'subtema' }, sub)} className="text-blue-400 hover:text-blue-600"><Edit2 size={10} /></button>
                                              <button onClick={() => handleRemove({ classe: cls, disciplina: disc, tema: tema, subtema: sub })} className="text-red-400 hover:text-red-600"><Trash2 size={10} /></button>
                                            </div>
                                          </div>
                                          {expanded[cls + disc + tema + sub] && (
                                            <div className="mt-1 space-y-1">
                                              <button onClick={() => handleAddClick({ classe: cls, disciplina: disc, tema: tema, subtema: sub, type: 'sumario' })} className="text-[10px] font-bold text-purple-600 flex items-center gap-1"><PlusCircle size={10} /> Adicionar Sumário</button>
                                              {JSON.parse(curriculum.find(c => c.classe === cls && c.disciplina === disc && c.tema === tema && c.subtema === sub)?.sumarios || "[]").map((sum: string) => (
                                                <div key={sum} className="ml-4 flex justify-between items-center py-0.5 group">
                                                  <span className="text-[10px] text-gray-400">{sum}</span>
                                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => handleEditClick({ classe: cls, disciplina: disc, tema: tema, subtema: sub, sumario: sum, type: 'sumario' }, sum)} className="text-blue-300 hover:text-blue-500"><Edit2 size={10} /></button>
                                                    <button onClick={() => handleRemove({ classe: cls, disciplina: disc, tema: tema, subtema: sub, sumario: sum })} className="text-red-300 hover:text-red-500"><Trash2 size={10} /></button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <div className="mt-1 space-y-1">
                                          <button onClick={() => handleAddClick({ classe: cls, disciplina: disc, tema: tema, subtema: '', type: 'sumario' })} className="text-[10px] font-bold text-purple-600 flex items-center gap-1"><PlusCircle size={10} /> Adicionar Sumário ao Tema</button>
                                          {JSON.parse(curriculum.find(c => c.classe === cls && c.disciplina === disc && c.tema === tema && !c.subtema)?.sumarios || "[]").map((sum: string) => (
                                            <div key={sum} className="ml-4 flex justify-between items-center py-0.5 group">
                                              <span className="text-[10px] text-gray-400">{sum}</span>
                                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleEditClick({ classe: cls, disciplina: disc, tema: tema, subtema: '', sumario: sum, type: 'sumario' }, sum)} className="text-blue-300 hover:text-blue-500"><Edit2 size={10} /></button>
                                                <button onClick={() => handleRemove({ classe: cls, disciplina: disc, tema: tema, subtema: '', sumario: sum })} className="text-red-300 hover:text-red-500"><Trash2 size={10} /></button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {activeTab === 'gerenciador' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Alimentar o Portal</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const file = formData.get('file');
            const folder = formData.get('folder');
            if (!file || !folder) return;
            
            try {
              await fetch('/api/admin/library/upload', {
                method: 'POST',
                body: formData
              });
              addToast("Documento salvo com sucesso no portal!", 'success');
              fetchFiles();
              (e.target as HTMLFormElement).reset();
            } catch (err) {
              addToast("Erro no upload", 'error');
            }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pasta de Destino</label>
              <select name="folder" required className="w-full px-4 py-2 rounded-xl border border-gray-200">
                <option value="">Selecione uma pasta...</option>
                {getAllDirectories(files).map(dir => (
                  <option key={dir} value={dir}>{dir}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Arquivo</label>
              <input type="file" name="file" required className="w-full px-4 py-2 rounded-xl border border-gray-200" />
            </div>
            <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold text-sm">Confirmar e Salvar no Portal</button>
          </form>
        </div>
      )}

      <AnimatePresence>
        {addingItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="font-bold text-gray-900 mb-4">Adicionar {addingItem.type}</h3>
              <input 
                type="text" 
                autoFocus
                value={addingName} 
                onChange={e => setAddingName(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmAdd();
                  if (e.key === 'Escape') setAddingItem(null);
                }}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 mb-4 outline-none focus:ring-2 focus:ring-emerald-500" 
                placeholder={`Nome do(a) ${addingItem.type}...`}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddingItem(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Cancelar</button>
                <button onClick={confirmAdd} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">Adicionar</button>
              </div>
            </motion.div>
          </div>
        )}
        {editingItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm">
              <h3 className="font-bold text-gray-900 mb-4">Editar {editingItem.type}</h3>
              <input 
                type="text" 
                autoFocus
                value={editingName} 
                onChange={e => setEditingName(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmEdit();
                  if (e.key === 'Escape') setEditingItem(null);
                }}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 mb-4 outline-none focus:ring-2 focus:ring-emerald-500" 
                placeholder={`Novo nome...`}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-bold">Cancelar</button>
                <button onClick={confirmEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Salvar Alteração</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FeedbackView = ({ user, theme }: { user: UserData, theme: 'light' | 'dark' }) => {
  const { addToast } = useToast();
  const [content, setContent] = useState('');
  const [type, setType] = useState('opinião');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content, type })
      });
      if (res.ok) {
        addToast("Obrigado pelo seu feedback! O administrador foi notificado.", 'success');
        setContent('');
      }
    } catch (err) {
      addToast("Erro ao enviar feedback", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
      <div className={`p-8 rounded-[2.5rem] border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'} shadow-xl`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <MessageSquare size={20} />
          </div>
          <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Opiniões e Reclamações</h2>
        </div>
        <p className="text-sm text-gray-500 mb-8">Sua opinião é fundamental para melhorarmos o PPA. Use este espaço para críticas, sugestões ou reclamações.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tipo de Feedback</label>
            <div className="flex gap-2">
              {['opinião', 'crítica', 'reclamação'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${
                    type === t 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                      : `${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'}`
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sua Mensagem</label>
            <textarea
              required
              rows={5}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Descreva aqui sua opinião, crítica ou reclamação detalhadamente..."
              className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            />
          </div>
          <button
            disabled={loading || !content.trim()}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Clock className="animate-spin" size={20} /> : <Send size={20} />}
            Enviar Feedback
          </button>
        </form>
      </div>
    </motion.div>
  );
};

const AdminPanel = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState<'users' | 'curriculum' | 'settings' | 'news' | 'feedback' | 'publish' | 'community'>('users');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [syncingNews, setSyncingNews] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<CommunityPlan[]>([]);
  const [generatingLogo, setGeneratingLogo] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchFeedback();
    fetchNews();
    fetchPendingPlans();
  }, []);

  const fetchPendingPlans = async () => {
    try {
      const res = await fetch('/api/admin/community/pending');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPendingPlans(data);
      } else {
        setPendingPlans([]);
      }
    } catch (err) {
      console.error(err);
      setPendingPlans([]);
    }
  };

  const moderatePlan = async (id: number, status: 'Aprovado' | 'Rejeitado') => {
    try {
      await fetch('/api/admin/community/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      addToast(`Plano ${status.toLowerCase()} com sucesso`, 'success');
      fetchPendingPlans();
    } catch (err) {
      addToast("Erro ao moderar plano", 'error');
    }
  };

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (Array.isArray(data)) {
        setNews(data);
      } else {
        setNews([]);
      }
    } catch (err) {
      console.error(err);
      setNews([]);
    }
  };

  const fetchFeedback = async () => {
    try {
      const res = await fetch('/api/admin/feedback');
      const data = await res.json();
      if (Array.isArray(data)) {
        setFeedback(data);
      } else {
        setFeedback([]);
      }
    } catch (err) {
      console.error(err);
      setFeedback([]);
    }
  };

  const syncNews = async () => {
    setSyncingNews(true);
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Pesquise as notícias mais recentes (últimas 24h) sobre o Ministério da Educação de Angola (MED), Governo de Angola e sindicatos da educação em Angola. Retorne uma lista de notícias em formato JSON. Cada notícia deve ter: title, content, category (MED, Pedagogia ou Aviso), source (nome do site oficial). Verifique a credibilidade das fontes (apenas sites oficiais .gov.ao ou jornais de renome).",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                category: { type: Type.STRING },
                source: { type: Type.STRING }
              },
              required: ["title", "content", "category", "source"]
            }
          }
        }
      });

      const newsList = JSON.parse(response.text || "[]");
      
      const res = await fetch('/api/ai/save-synced-news', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsList })
      });
      
      const data = await res.json();
      if (res.ok) {
        addToast(`${data.count} novas notícias sincronizadas com sucesso!`, 'success');
        fetchNews();
      } else {
        throw new Error(data.error || "Erro ao salvar notícias");
      }
    } catch (err) {
      console.error("Sync News Error:", err);
      addToast("Erro ao sincronizar notícias com IA", 'error');
    } finally {
      setSyncingNews(false);
    }
  };

  const deleteNews = async (id: number) => {
    if (!confirm("Excluir esta notícia?")) return;
    try {
      await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
      addToast("Notícia excluída", 'success');
      fetchNews();
    } catch (err) {
      addToast("Erro ao excluir", 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
        if (data.error) addToast(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (user: UserData, updates: Partial<UserData>) => {
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, ...updates })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.activationMessage) {
          addToast(data.activationMessage, 'success');
        }
        fetchUsers();
      }
    } catch (err) {
      addToast("Erro ao atualizar usuário", 'error');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      setUploadingLogo(true);
      try {
        const res = await fetch('/api/admin/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo: reader.result })
        });
        if (res.ok) {
          addToast("Logotipo atualizado com sucesso! Recarregue a página.", 'success');
          window.location.reload();
        }
      } catch (err) {
        addToast("Erro ao enviar logotipo", 'error');
      } finally {
        setUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateLogo = async () => {
    setGeneratingLogo(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const prompt = "A professional, clean, and modern 1:1 logo for an educational app called 'Portal Pedagógico Angola (PPA)'. The logo should feature a stylized map of Angola in the background, an open book in the foreground, a bright lightbulb of wisdom rising from the book, and educational tools like a pencil and ruler. The text 'Portal Pedagógico Angola' and 'PPA' should be integrated into the design. Use a vibrant color palette of emerald green, amber yellow, and deep blue. High resolution, flat design, suitable for a mobile app icon.";
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      let base64Image = "";
      const candidate = response.candidates?.[0];
      if (candidate && candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            base64Image = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      }

      if (base64Image) {
        const res = await fetch('/api/admin/upload-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo: base64Image })
        });
        if (res.ok) {
          addToast("Logotipo gerado e atualizado com sucesso!", 'success');
          window.location.reload();
        }
      } else {
        addToast("Não foi possível gerar a imagem", 'error');
      }
    } catch (err) {
      console.error(err);
      addToast("Erro ao gerar logotipo com IA", 'error');
    } finally {
      setGeneratingLogo(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">🛡️ Gestão Administrativa</h2>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto whitespace-nowrap gap-1 no-scrollbar">
          <button 
            onClick={() => setAdminTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'users' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            👥 Usuários
          </button>
          <button 
            onClick={() => setAdminTab('curriculum')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'curriculum' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📚 Currículo
          </button>
          <button 
            onClick={() => setAdminTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'settings' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ⚙️ Configurações
          </button>
          <button 
            onClick={() => setAdminTab('news')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'news' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🔔 Notícias
          </button>
          <button 
            onClick={() => setAdminTab('feedback')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'feedback' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            💬 Feedback
          </button>
          <button 
            onClick={() => setAdminTab('community')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'community' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🌍 Moderação
          </button>
          <button 
            onClick={() => setAdminTab('publish')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${adminTab === 'publish' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🚀 Publicar
          </button>
        </div>
      </div>

      {adminTab === 'users' ? (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-bold">
              <tr>
                <th className="px-6 py-4">Professor / Escola</th>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4">Créditos</th>
                <th className="px-6 py-4">Expiração</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Array.isArray(users) && users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <input 
                        type="text"
                        value={u.professor_nome || ''}
                        placeholder="Nome do Professor"
                        onChange={e => handleUpdate(u, { professor_nome: e.target.value })}
                        className="w-full text-sm font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0"
                      />
                      <input 
                        type="text"
                        value={u.escola || ''}
                        placeholder="Nome da Escola"
                        onChange={e => handleUpdate(u, { escola: e.target.value })}
                        className="w-full text-xs text-gray-400 bg-transparent border-none focus:ring-0 p-0"
                      />
                      <div className="text-[10px] text-gray-300">{u.email || u.telefone}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Chave:</span>
                        <input 
                          type="text"
                          value={u.password || ''}
                          onChange={e => handleUpdate(u, { password: e.target.value })}
                          className="text-[10px] font-mono bg-gray-50 border border-gray-100 rounded px-1 w-20 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.plano_tipo || ''}
                      onChange={e => handleUpdate(u, { plano_tipo: e.target.value })}
                      className="text-sm border-none bg-transparent focus:ring-0 font-medium text-emerald-600"
                    >
                      <option value="">Nenhum</option>
                      <option value="Bronze">Bronze (90d)</option>
                      <option value="Prata">Prata (180d)</option>
                      <option value="Ouro">Ouro (365d)</option>
                      <option value="Ilimitado">Ilimitado (Admin)</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number"
                      value={u.limite_planos || 0}
                      onChange={e => handleUpdate(u, { limite_planos: parseInt(e.target.value) })}
                      className="w-16 text-sm border-none bg-transparent focus:ring-0"
                    />
                    <span className="text-xs text-gray-400">/ {u.planos_consumidos}</span>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="date"
                      value={u.data_expiracao ? u.data_expiracao.split('T')[0] : ''}
                      onChange={e => handleUpdate(u, { data_expiracao: e.target.value })}
                      className="text-sm border-none bg-transparent focus:ring-0"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      u.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                      u.status === 'Pendente' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex flex-col gap-2">
                    <button 
                      onClick={() => handleUpdate(u, { status: u.status === 'Ativo' ? 'Suspenso' : 'Ativo' })}
                      className="text-xs font-bold text-blue-600 hover:underline text-left"
                    >
                      {u.status === 'Ativo' ? 'Suspender' : 'Ativar'}
                    </button>
                    <button 
                      onClick={() => {
                        const msg = `Olá Professor(a) *${u.professor_nome}*, bem-vindo(a) ao **Portal Pedagógico Angola (PPA)**! 🇦🇴%0A%0AO seu acesso foi ativado com sucesso. Já pode começar a usar todas as ferramentas de produtividade para o Ensino Primário.%0A%0AAqui estão os seus dados para entrar no portal:%0A🌐 **Link:** https://portal-pedagogico-angola.onrender.com%0A👤 **Usuário:** ${u.email || u.telefone}%0A🔑 **Chave de Acesso:** ${u.password}%0A%0A**Com o PPA, você pode:**%0A✅ Gerar planos de aula completos em segundos.%0A✅ Baixar Programas, Calendários e Leis do MED.%0A✅ Organizar turmas e agendar aulas.%0A✅ Baixar planos em Word ou PDF prontos para entregar.%0A%0AQualquer dúvida, estamos aqui para ajudar!%0A*Equipa PPA - Qualidade INIDE*`;
                        window.open(`https://wa.me/${u.telefone?.replace(/\s/g, '')}?text=${msg}`, '_blank');
                      }}
                      className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <MessageSquare size={12} /> Enviar WhatsApp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      ) : adminTab === 'curriculum' ? (
        <CurriculumManager />
      ) : adminTab === 'settings' ? (
        <div className="p-8">
          <h3 className="font-bold text-gray-900 mb-4">Configurações do Portal</h3>
          <div className="space-y-8">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Identidade Visual</h4>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden shadow-sm">
                  <Logo size={40} />
                </div>
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden" 
                    id="logo-upload"
                  />
                  <label 
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-purple-700 transition-all"
                  >
                    {uploadingLogo ? <Clock className="animate-spin" size={16} /> : <Download size={16} />}
                    Carregar Novo Logotipo
                  </label>
                  <button 
                    onClick={handleGenerateLogo}
                    disabled={generatingLogo}
                    className="ml-2 inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {generatingLogo ? <Clock className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    Gerar com IA
                  </button>
                  <p className="text-[10px] text-gray-400 mt-2">Recomendado: PNG ou JPG, formato quadrado (1:1). Ou use a IA para criar um exclusivo.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Dados Padrão</h4>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  await fetch('/api/admin/update-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      escola: formData.get('escola'),
                      professor: formData.get('professor'),
                      provincia: formData.get('provincia'),
                      municipio: formData.get('municipio')
                    })
                  });
                  addToast("Configurações salvas!", 'success');
                  fetchSettings();
                } catch (err) {
                  addToast("Erro ao salvar", 'error');
                }
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome da Escola Padrão</label>
                    <input name="escola" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: Escola Primária nº 123" defaultValue={settings.default_escola || ''} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Professor Padrão</label>
                    <input name="professor" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: Prof. António Basto" defaultValue={settings.default_professor || ''} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Província Padrão</label>
                    <select name="provincia" className="w-full px-4 py-2 rounded-xl border border-gray-200" defaultValue={settings.default_provincia || ''}>
                      <option value="">Selecionar...</option>
                      {Object.keys(angolaData).map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Município Padrão</label>
                    <input name="municipio" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: Viana" defaultValue={settings.default_municipio || ''} />
                  </div>
                </div>
                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold text-sm">Salvar Alterações</button>
              </form>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
              <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Configurações de E-mail (SMTP)</h4>
              <p className="text-xs text-gray-500 mb-4">Configure os dados do servidor de e-mail para receber as solicitações de novos usuários.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                try {
                  await fetch('/api/admin/update-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      smtp_host: formData.get('smtp_host'),
                      smtp_port: formData.get('smtp_port'),
                      smtp_secure: formData.get('smtp_secure') === 'on',
                      smtp_user: formData.get('smtp_user'),
                      smtp_pass: formData.get('smtp_pass'),
                      admin_email: formData.get('admin_email')
                    })
                  });
                  addToast("Configurações de e-mail salvas!", 'success');
                } catch (err) {
                  addToast("Erro ao salvar configurações de e-mail", 'error');
                }
              }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Servidor SMTP (Host)</label>
                    <input name="smtp_host" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: smtp.gmail.com" defaultValue={settings.smtp_host || ''} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Porta SMTP</label>
                    <input name="smtp_port" type="number" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: 465 ou 587" defaultValue={settings.smtp_port || ''} />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="smtp_secure" name="smtp_secure" defaultChecked={settings.smtp_secure === 'true'} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                  <label htmlFor="smtp_secure" className="text-sm text-gray-700 font-bold">Usar conexão segura (SSL/TLS)</label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usuário SMTP (E-mail)</label>
                    <input name="smtp_user" type="email" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: seu-email@gmail.com" defaultValue={settings.smtp_user || ''} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha SMTP (Senha de App)</label>
                    <input name="smtp_pass" type="password" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Sua senha de aplicativo" defaultValue={settings.smtp_pass || ''} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail do Administrador (Recebedor)</label>
                  <input name="admin_email" type="email" className="w-full px-4 py-2 rounded-xl border border-gray-200" placeholder="Ex: admin@escola.com" defaultValue={settings.admin_email || ''} />
                  <p className="text-[10px] text-gray-400 mt-1">E-mail que receberá as notificações de novos cadastros.</p>
                </div>

                <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold text-sm">Salvar Configurações de E-mail</button>
              </form>
            </div>
          </div>
        </div>
      ) : adminTab === 'news' ? (
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Gestão de Notícias</h3>
            <button 
              onClick={syncNews}
              disabled={syncingNews}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {syncingNews ? <Clock className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Sincronizar Notícias MED (IA)
            </button>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Publicar Nova Notícia</h4>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              try {
                const res = await fetch('/api/admin/news', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: formData.get('title'),
                    content: formData.get('content'),
                    category: formData.get('category'),
                    source: 'Portal Pedagógico Angola',
                    expires_in_days: 14
                  })
                });
                if (res.ok) {
                  addToast("Notícia publicada com sucesso!", 'success');
                  fetchNews();
                  (e.target as HTMLFormElement).reset();
                }
              } catch (err) {
                addToast("Erro ao publicar", 'error');
              }
            }} className="space-y-4">
              <input name="title" required placeholder="Título da Notícia" className="w-full px-4 py-2 rounded-xl border border-gray-200" />
              <textarea name="content" required placeholder="Conteúdo da Notícia" rows={4} className="w-full px-4 py-2 rounded-xl border border-gray-200" />
              <div className="flex gap-4">
                <select name="category" required className="flex-1 px-4 py-2 rounded-xl border border-gray-200">
                  <option value="MED">MED</option>
                  <option value="Pedagogia">Pedagogia</option>
                  <option value="Aviso">Aviso</option>
                </select>
                <button type="submit" className="bg-purple-600 text-white px-8 py-2 rounded-xl font-bold">Publicar</button>
              </div>
            </form>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Notícias Ativas</h4>
            <div className="grid grid-cols-1 gap-4">
              {Array.isArray(news) && news.map(item => (
                <div key={item.id} className="p-4 bg-white rounded-2xl border border-gray-200 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.category}</span>
                      <span className="text-[10px] text-gray-400">{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    <h5 className="font-bold text-sm text-gray-900">{item.title}</h5>
                    <p className="text-xs text-gray-500 line-clamp-1">{item.content}</p>
                  </div>
                  <button onClick={() => deleteNews(item.id)} className="text-red-400 hover:text-red-600 p-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : adminTab === 'feedback' ? (
        <div className="p-8 space-y-6">
          <h3 className="font-bold text-gray-900">Feedback dos Usuários</h3>
          <div className="space-y-4">
            {feedback.map(item => (
              <div key={item.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        item.type === 'reclamação' ? 'bg-red-100 text-red-700' : 
                        item.type === 'crítica' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <h5 className="font-bold text-sm text-gray-900">{item.professor_nome}</h5>
                    <p className="text-[10px] text-gray-400">{item.email || item.telefone} | {item.status}</p>
                  </div>
                  {item.status === 'Pendente' && (
                    <button 
                      onClick={async () => {
                        await fetch('/api/admin/feedback/resolve', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: item.id })
                        });
                        fetchFeedback();
                        addToast("Feedback marcado como resolvido", 'success');
                      }}
                      className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold"
                    >
                      Marcar como Resolvido
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-600 italic">"{item.content}"</p>
              </div>
            ))}
            {feedback.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum feedback recebido até o momento.</p>}
          </div>
        </div>
      ) : adminTab === 'community' ? (
        <div className="p-8 space-y-6">
          <h3 className="font-bold text-gray-900">Planos Pendentes de Aprovação</h3>
          <div className="grid grid-cols-1 gap-4">
            {pendingPlans.map(plan => (
              <div key={plan.id} className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{plan.classe}</span>
                      <span className="text-[10px] text-gray-400">{new Date(plan.created_at).toLocaleString()}</span>
                    </div>
                    <h5 className="font-bold text-sm text-gray-900">{plan.title}</h5>
                    <p className="text-[10px] text-gray-400">Por: {plan.professor_nome} | {plan.subject}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => moderatePlan(plan.id, 'Rejeitado')}
                      className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-[10px] font-bold"
                    >
                      Rejeitar
                    </button>
                    <button 
                      onClick={() => moderatePlan(plan.id, 'Aprovado')}
                      className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold"
                    >
                      Aprovar
                    </button>
                  </div>
                </div>
                <div className="max-h-32 overflow-y-auto text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                  <Markdown>{plan.content}</Markdown>
                </div>
              </div>
            ))}
            {pendingPlans.length === 0 && <p className="text-center text-gray-400 py-8">Nenhum plano pendente.</p>}
          </div>
        </div>
      ) : adminTab === 'publish' ? (
        <div className="p-8 space-y-8">
          <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-900">Como Publicar o PPA no Render</h3>
                <p className="text-emerald-700 text-sm">Siga estes passos para hospedar o portal de forma profissional e persistente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs">1</span>
                  Criar Web Service
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  No <strong>Render.com</strong>, crie um novo "Web Service" e conecte o seu repositório GitHub.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs">2</span>
                  Comandos de Build
                </h4>
                <div className="text-xs space-y-2 text-gray-600">
                  <p><strong>Build Command:</strong> <code className="bg-gray-100 px-1 rounded">npm install && npm run build</code></p>
                  <p><strong>Start Command:</strong> <code className="bg-gray-100 px-1 rounded">node server.ts</code></p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs">3</span>
                  Variáveis de Ambiente
                </h4>
                <p className="text-xs text-gray-600 mb-2">Configure no painel "Environment":</p>
                <ul className="text-[10px] space-y-1 text-gray-500 font-mono">
                  <li>GEMINI_API_KEY=sua_chave</li>
                  <li>APP_URL=https://seu-app.onrender.com</li>
                  <li>NODE_ENV=production</li>
                </ul>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs">4</span>
                  Disco Persistente (CRÍTICO)
                </h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Vá em <strong>"Disks"</strong> e adicione um disco de 1GB. 
                  <strong>Mount Path:</strong> <code className="bg-gray-100 px-1 rounded">/app/data</code>. 
                  Isso garante que os usuários e planos não sejam apagados ao reiniciar.
                </p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-emerald-600 text-white rounded-2xl shadow-lg">
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <CheckCircle size={18} /> Verificação de Prontidão
              </h4>
              <p className="text-sm opacity-90 mb-4">A aplicação foi atualizada com proteções contra erros de dados e está pronta para o deploy.</p>
              <div className="flex gap-4">
                <div className="flex-1 bg-white/10 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold opacity-70">Banco de Dados</p>
                  <p className="text-xs font-bold">SQLite Persistente</p>
                </div>
                <div className="flex-1 bg-white/10 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold opacity-70">Frontend</p>
                  <p className="text-xs font-bold">Vite (Build Otimizado)</p>
                </div>
                <div className="flex-1 bg-white/10 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold opacity-70">Backend</p>
                  <p className="text-xs font-bold">Express API</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const CommunityView = ({ user, theme }: { user: UserData, theme: 'light' | 'dark' }) => {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<CommunityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<CommunityPlan | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/community/plans');
      const data = await res.json();
      setPlans(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: number) => {
    try {
      await fetch('/api/community/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setPlans(plans.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Sala de Professores</h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Repositório comunitário de planos de aula inspiradores.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold">
          <Sparkles size={16} />
          <span>Partilhe seus melhores planos!</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 w-full rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(plans) && plans.map(plan => (
            <div key={plan.id} className={`p-6 rounded-3xl border transition-all hover:shadow-xl ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                  {plan.foto_url ? <img src={plan.foto_url} className="w-full h-full object-cover" /> : <User size={20} />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{plan.professor_nome}</p>
                  <p className="text-[10px] text-gray-400 truncate">{plan.escola}</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{plan.classe}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{plan.subject}</span>
                </div>
                <h3 className={`font-bold text-base line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{plan.title}</h3>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button 
                  onClick={() => handleLike(plan.id)}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-rose-500 transition-colors"
                >
                  <Heart size={18} className={plan.likes > 0 ? 'fill-rose-500 text-rose-500' : ''} />
                  <span className="text-xs font-bold">{plan.likes}</span>
                </button>
                <button 
                  onClick={() => setSelectedPlan(plan)}
                  className="text-emerald-600 font-bold text-xs flex items-center gap-1 hover:underline"
                >
                  Ver Plano <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Globe size={48} className="mx-auto text-gray-200 mb-4" />
              <p className="text-gray-400 font-medium">Ainda não há planos partilhados. Seja o primeiro!</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Globe size={24} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{selectedPlan.title}</h3>
                    <p className="text-xs text-gray-500">Por {selectedPlan.professor_nome} | {selectedPlan.escola}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlan(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className={`markdown-body prose prose-emerald max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
                  <Markdown remarkPlugins={[remarkGfm]}>{selectedPlan.content}</Markdown>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={() => {
                    const blob = new Blob([selectedPlan.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `plano_${selectedPlan.title}.txt`;
                    a.click();
                  }}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <Download size={18} /> Baixar TXT
                </button>
                <button 
                  onClick={() => setSelectedPlan(null)}
                  className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CalendarView = ({ user, theme }: { user: UserData, theme: 'light' | 'dark' }) => {
  const { addToast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/calendar/${user.id}`);
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este agendamento?")) return;
    try {
      await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
      addToast("Agendamento removido", 'success');
      fetchEvents();
    } catch (err) {
      addToast("Erro ao remover", 'error');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Cronograma Escolar</h2>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <Clock size={16} />
          <span>Agendamentos</span>
        </div>
      </div>

      <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-xl`}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum plano agendado ainda.</p>
            <p className="text-xs text-gray-400 mt-2">Gere um plano de aula e clique em "Agendar" para vê-lo aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(event => (
              <div key={event.id} className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'} relative group`}>
                <button onClick={() => handleDelete(event.id)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} />
                </button>
                <div className="text-xs font-bold text-emerald-600 mb-1">{new Date(event.start_date).toLocaleDateString('pt-AO')}</div>
                <h3 className={`font-bold text-sm mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{event.title}</h3>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <Clock size={10} />
                  <span>{new Date(event.start_date).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StudentsView = ({ user, theme }: { user: UserData, theme: 'light' | 'dark' }) => {
  const { addToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch(`/api/students/${user.id}`);
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await fetch('/api/students/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: formData.get('name'),
          classe: formData.get('classe')
        })
      });
      addToast("Aluno adicionado com sucesso!", 'success');
      setShowAdd(false);
      fetchStudents();
    } catch (err) {
      addToast("Erro ao adicionar aluno", 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este aluno?")) return;
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
      addToast("Aluno removido", 'success');
      fetchStudents();
    } catch (err) {
      addToast("Erro ao remover aluno", 'error');
    }
  };

  const groupedStudents = students.reduce((acc, student) => {
    if (!acc[student.classe]) acc[student.classe] = [];
    acc[student.classe].push(student);
    return acc;
  }, {} as Record<string, Student[]>);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Gestão de Turmas</h2>
        <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
          <Plus size={16} />
          Novo Aluno
        </button>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-8 rounded-3xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} shadow-2xl`}>
            <h3 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Adicionar Aluno</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                <input name="name" required className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Classe/Turma</label>
                <select name="classe" required className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                  {["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-3xl" />
            ))}
          </div>
        ) : Object.keys(groupedStudents).length === 0 ? (
          <div className={`p-12 text-center rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum aluno cadastrado.</p>
          </div>
        ) : (
          Object.entries(groupedStudents).map(([classe, students]) => (
            <div key={classe} className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-lg`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>{classe}</h3>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">{students.length} Alunos</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {students.map(student => (
                  <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{student.name}</span>
                    <button onClick={() => handleDelete(student.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

const QuestionsGenerator = ({ user, theme, isOnline }: { user: UserData, theme: 'light' | 'dark', isOnline: boolean }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<QuestionBankItem[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/questions/${user.id}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isOnline) {
      addToast("Não é possível gerar questões em modo offline. Verifique sua conexão.", 'error');
      return;
    }
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject');
    const classe = formData.get('classe');
    const topic = formData.get('topic');
    const count = formData.get('count');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gere um banco de ${count} questões de prova para a disciplina de ${subject}, ${classe}, sobre o tema: ${topic}. 
        Inclua questões de múltipla escolha e de resposta curta. Forneça também as soluções. 
        Formate em Markdown elegante.`
      });

      const text = response.text || "";
      setResult(text);

      // Save to history
      await fetch('/api/questions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          subject,
          classe,
          content: text
        })
      });
      addToast("Questões geradas e salvas!", 'success');
      fetchHistory();
    } catch (err) {
      addToast("Erro ao gerar questões", 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Banco de Questões</h2>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <FileText size={16} />
          <span>Gerador de Provas</span>
        </div>
      </div>

      <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-xl`}>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Disciplina</label>
            <select name="subject" required className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
              <option value="">Selecionar Disciplina...</option>
              {[
                "Língua Portuguesa", 
                "Matemática", 
                "Estudo do Meio", 
                "História", 
                "Geografia", 
                "Educação Moral e Cívica", 
                "Educação Manual e Plástica", 
                "Educação Musical", 
                "Educação Física",
                "Ciências da Natureza"
              ].sort().map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Classe</label>
            <select name="classe" className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
              {["Iniciação", "1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Tema / Conteúdo</label>
            <input name="topic" required className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`} placeholder="Ex: Adição e Subtração até 100" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Quantidade de Questões</label>
            <input name="count" type="number" defaultValue={5} min={1} max={20} className={`w-full px-4 py-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Sparkles size={18} />}
              Gerar Questões
            </button>
          </div>
        </form>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-2xl`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Questões Geradas</h3>
            <button onClick={() => {
              const blob = new Blob([result], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'questoes_prova.txt';
              a.click();
            }} className="text-emerald-600 font-bold text-sm flex items-center gap-2">
              <Download size={16} />
              Baixar TXT
            </button>
          </div>
          <div className={`prose max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
            <Markdown>{result}</Markdown>
          </div>
        </motion.div>
      )}

      {history.length > 0 && (
        <div className="space-y-4">
          <h3 className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Histórico de Questões</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(history) && history.map(item => (
              <div key={item.id} onClick={() => setResult(item.content)} className={`p-4 rounded-2xl border cursor-pointer hover:border-emerald-500 transition-colors ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
                <div className="text-xs font-bold text-gray-500 mb-1">{new Date(item.created_at).toLocaleDateString('pt-AO')}</div>
                <div className="font-bold text-sm">{item.subject} - {item.classe}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const HomeView = ({ user, theme }: { user: UserData, theme: 'light' | 'dark' }) => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header with Logo */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
        <div className={`p-4 rounded-3xl ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} shadow-xl`}>
          <Logo size={80} variant={theme === 'dark' ? 'light' : 'default'} />
        </div>
        <div>
          <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Portal Pedagógico Angola <span className="text-emerald-600">(PPA)</span>
          </h1>
          <p className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            Sistema de Apoio ao Professor do Ensino Primário
          </p>
        </div>
      </div>

      {/* Welcome Section */}
      <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-xl relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Sparkles size={160} />
        </div>
        <div className="relative z-10">
          <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
            Bem-vindo de volta, Professor(a)!
          </h2>
          <p className={`text-lg max-w-2xl leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            Olá, <span className="font-bold text-emerald-600">{user.professor_nome || user.email}</span>. É um prazer tê-lo(a) aqui. 
            O PPA está pronto para ajudar você a preparar suas aulas com eficiência e qualidade.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              📍 {user.provincia || 'Província não definida'}
            </div>
            <div className={`px-4 py-2 rounded-xl text-xs font-bold ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              🏫 {user.escola || 'Escola não definida'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* News Feed (MED) */}
        <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-lg`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                <Bell size={24} />
              </div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Notícias do MED</h2>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actualizado Hoje</span>
          </div>
          <NewsFeed theme={theme} />
        </div>

        {/* App Updates */}
        <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'} shadow-lg`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                <Sparkles size={24} />
              </div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Novidades do PPA</h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Versão 1.8</span>
          </div>
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border transition-all hover:border-emerald-500/50 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Novo</span>
                <span className="text-[10px] text-gray-400 font-bold">V 1.8</span>
              </div>
              <h3 className={`font-bold text-sm mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Banco de Questões Inteligente</h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Agora você pode gerar provas e testes personalizados usando IA. Basta escolher a disciplina e o tema!</p>
            </div>
            <div className={`p-4 rounded-2xl border transition-all hover:border-indigo-500/50 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Melhoria</span>
                <span className="text-[10px] text-gray-400 font-bold">V 1.7</span>
              </div>
              <h3 className={`font-bold text-sm mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Gestão de Turmas e Alunos</h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Organize seus alunos por classe e tenha um controle mais rigoroso do seu cronograma escolar.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Dashboard = ({ user, onLogout, theme, toggleTheme }: { user: UserData, onLogout: () => void, theme: 'light' | 'dark', toggleTheme: () => void }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'ai' | 'library' | 'admin' | 'calendar' | 'students' | 'questions' | 'stats' | 'profile' | 'news' | 'feedback' | 'community'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(user);
  const [showHistory, setShowHistory] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const menuItems = [
    { id: 'home', label: '🏠 Início', icon: LayoutDashboard, color: theme === 'dark' ? 'text-blue-400' : 'text-blue-600', bg: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100' },
    { id: 'ai', label: '⚙️ GERADOR DE PLANO', icon: Sparkles, color: theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600', bg: theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100' },
    { id: 'calendar', label: '📅 Cronograma', icon: Clock, color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600', bg: theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100' },
    { id: 'questions', label: '📝 Banco de Questões', icon: FileText, color: theme === 'dark' ? 'text-rose-400' : 'text-rose-600', bg: theme === 'dark' ? 'bg-rose-900/30' : 'bg-rose-100' },
    { id: 'community', label: '🌍 Sala de Professores', icon: Globe, color: theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600', bg: theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100' },
    { id: 'history', label: '🕒 Históricos', icon: Clock, color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600', bg: theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100', isHistory: true },
    { id: 'students', label: '👥 Turmas/Alunos', icon: User, color: theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600', bg: theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100' },
    { id: 'library', label: '📚 Biblioteca', icon: Library, color: theme === 'dark' ? 'text-blue-400' : 'text-blue-600', bg: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100' },
    { id: 'stats', label: '📊 Estatísticas', icon: BarChart2, color: theme === 'dark' ? 'text-blue-400' : 'text-blue-600', bg: theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100' },
    { id: 'news', label: '🔔 Notícias MED', icon: Bell, color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600', bg: theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100' },
    { id: 'feedback', label: '💬 Sugestões', icon: MessageSquare, color: theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600', bg: theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100' },
    ...(currentUser.is_admin ? [{ id: 'admin', label: '🛡️ Admin', icon: ShieldCheck, color: theme === 'dark' ? 'text-purple-400' : 'text-purple-600', bg: theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100' }] : [])
  ];

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-[#f5f2ed] text-gray-900'}`}>
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 border-r transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
        ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'}
      `}>
        <div className="h-full flex flex-col">
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-50'}`}>
            <Logo variant={theme === 'dark' ? 'light' : 'default'} />
            <div className="mt-4">
              <h1 className={`text-sm font-bold leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Portal Pedagógico Angola</h1>
              <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Apoio ao Professor do Ensino Primário</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'history') {
                    setActiveTab('ai');
                    setShowHistory(true);
                  } else {
                    setActiveTab(item.id as any);
                    setShowHistory(false);
                  }
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all
                  ${(item.id === 'history' ? showHistory : (activeTab === item.id && !showHistory)) ? `${item.bg} ${item.color} shadow-sm` : `${theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
                `}
              >
                <item.icon size={20} />
                <span className="font-semibold">{item.label}</span>
                {(item.id === 'history' ? showHistory : (activeTab === item.id && !showHistory)) && <motion.div layoutId="active" className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />}
              </button>
            ))}
          </nav>

          <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-50'}`}>
            <div className={`p-3 rounded-2xl mb-3 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="mb-2">
                <p className={`text-[9px] uppercase font-bold mb-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Usuário:</p>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setActiveTab('profile')}
                >
                  <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-200 text-emerald-700'}`}>
                    {currentUser.foto_url ? (
                      <img src={currentUser.foto_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{currentUser.professor_nome || currentUser.email || currentUser.telefone}</p>
                    <p className="text-[9px] text-emerald-600 font-bold">
                      {currentUser.is_admin ? 'Modo gerente activo' : 'Ver Perfil'}
                    </p>
                  </div>
                </div>
              </div>
              {!currentUser.is_admin && (
                <div className="space-y-1.5">
                  <div className={`flex justify-between text-[9px] uppercase font-bold ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    <span>Créditos</span>
                    <span>{currentUser.planos_consumidos}/{currentUser.limite_planos || 0}</span>
                  </div>
                  <div className={`h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div 
                      className="h-full bg-emerald-500 transition-all" 
                      style={{ width: `${Math.min(100, (currentUser.planos_consumidos / (currentUser.limite_planos || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={toggleTheme}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all mb-1 text-sm font-semibold ${theme === 'dark' ? 'text-amber-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            </button>

            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 transition-all text-sm font-semibold"
            >
              <LogOut size={16} />
              <span>Sair do sistema</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className={`h-16 border-b flex items-center justify-between px-6 lg:px-8 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-black/5'}`}>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`lg:hidden p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-4">
            <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-gray-200 text-gray-600 animate-pulse">
                <WifiOff size={14} />
                Modo Offline
              </div>
            )}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
              <Clock size={14} />
              {currentUser.data_expiracao ? `Expira em: ${new Date(currentUser.data_expiracao).toLocaleDateString()}` : 'Acesso Vitalício'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'home' && <HomeView user={currentUser} theme={theme} />}
            {activeTab === 'stats' && <DashboardStats user={currentUser} theme={theme} />}
            {activeTab === 'ai' && <LessonGenerator user={currentUser} onUpdateUser={setCurrentUser} showHistory={showHistory} setShowHistory={setShowHistory} theme={theme} isOnline={isOnline} />}
            {activeTab === 'community' && <CommunityView user={currentUser} theme={theme} />}
            {activeTab === 'calendar' && <CalendarView user={currentUser} theme={theme} />}
            {activeTab === 'students' && <StudentsView user={currentUser} theme={theme} />}
            {activeTab === 'questions' && <QuestionsGenerator user={currentUser} theme={theme} isOnline={isOnline} />}
            {activeTab === 'library' && <LibraryView />}
            {activeTab === 'news' && <NewsFeed theme={theme} />}
            {activeTab === 'feedback' && <FeedbackView user={currentUser} theme={theme} />}
            {activeTab === 'profile' && <ProfileView user={currentUser} onUpdateUser={setCurrentUser} theme={theme} />}
            {activeTab === 'admin' && <AdminPanel />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('ppa_theme');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('ppa_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Persistence (simple for demo)
  useEffect(() => {
    const saved = localStorage.getItem('ppa_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u: UserData) => {
    setUser(u);
    localStorage.setItem('ppa_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ppa_user');
  };

  return (
    <ToastProvider>
      <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-[#f5f2ed] text-gray-900'}`}>
        {user ? (
          <Dashboard user={user} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        ) : (
          <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
        )}
      </div>
    </ToastProvider>
  );
}
