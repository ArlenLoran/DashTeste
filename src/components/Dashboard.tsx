import { useState, useEffect, useRef, type RefObject } from 'react';
import { 
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, RefreshCcw, 
  X, Info, Download, BookOpen, ShieldCheck, Search,
  TrendingUp, TrendingDown, Activity, Settings, LayoutGrid,
  Clock, Bell, Triangle, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Markdown from 'react-markdown';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line 
} from 'recharts';
import type { Section, Metric, MetricHistory } from '../types';

import { postSqlQuery } from '../services/queryService';
import { ensureSharePointConfig, fetchDashboardConfig, saveMetricData } from '../services/configService';

interface MetricCardProps {
  metric: Metric;
  onClick?: (metric: Metric) => void;
  onRefresh?: (metric: Metric) => void;
  isWarRoom?: boolean;
}

function useScrollIndicator(ref: RefObject<HTMLDivElement | null>) {
  const [scrollInfo, setScrollInfo] = useState({ percentage: 0, ratio: 0, isScrollable: false });

  const updateScroll = () => {
    if (ref.current) {
      const { scrollLeft, scrollWidth, clientWidth } = ref.current;
      const isScrollable = scrollWidth > clientWidth + 1;
      const percentage = isScrollable ? (scrollLeft / (scrollWidth - clientWidth)) * 100 : 0;
      const ratio = isScrollable ? clientWidth / scrollWidth : 1;
      setScrollInfo({ percentage, ratio, isScrollable });
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateScroll();
    const observer = new ResizeObserver(updateScroll);
    observer.observe(el);
    el.addEventListener('scroll', updateScroll);
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScroll);
    };
  }, [ref]);

  return scrollInfo;
}

function Countdown({ metric, onRefresh, hideUI, className }: { metric: Metric, onRefresh?: (m: Metric) => void, hideUI?: boolean, className?: string }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (!metric || !metric.lastUpdateAt || !metric.refreshInterval || !onRefresh) return;
    
    isRefreshingRef.current = false;

    const calculate = () => {
      const now = new Date();
      const last = new Date(metric.lastUpdateAt!);
      if (isNaN(last.getTime())) return 0;
      const next = new Date(last.getTime() + metric.refreshInterval! * 60000);
      const diff = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
      return diff;
    };

    const initial = calculate();
    setTimeLeft(initial);
    
    // If we're already at zero, trigger refresh once
    if (initial <= 0 && !isRefreshingRef.current) {
      isRefreshingRef.current = true;
      onRefresh(metric);
    }

    const timer = setInterval(() => {
      const remaining = calculate();
      setTimeLeft(remaining);
      if (remaining <= 0 && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        onRefresh(metric);
      } else if (remaining > 0) {
        // Reset the flag if we have time again (meaning data updated)
        isRefreshingRef.current = false;
      }
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, [metric.lastUpdateAt, metric.refreshInterval, metric.id]);

  if (hideUI) return null;
  if (timeLeft === null || !metric.refreshInterval) return null;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isUrgent = timeLeft < 30;

  return (
    <div className={`${className || 'flex items-center gap-1 text-[8px] font-black transition-colors duration-500'} ${isUrgent ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
      <RefreshCcw className={`w-2 h-2 ${isUrgent ? 'animate-spin' : ''}`} />
      <span>{mins}:{secs < 10 ? '0' : ''}{secs}s</span>
    </div>
  );
}

function MiniSparkline({ data, color }: { data: MetricHistory[], color: string }) {
  const chartData = data.map((item, i) => ({ value: item.value, index: i }));
  return (
    <div className="w-full h-8 mt-2 overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={1.5} 
            fillOpacity={1} 
            fill={`url(#gradient-${color})`} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({ metric, onClick, onRefresh, isWarRoom }: MetricCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onClick?.(metric)}
      whileHover={{ 
        y: -4, 
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        transition: { duration: 0.2 } 
      }}
      className={`rounded-xl shadow-sm p-3 w-[160px] h-[240px] flex-shrink-0 flex flex-col items-center justify-between border transition-all duration-500 cursor-pointer relative overflow-hidden ${
        isWarRoom 
        ? 'bg-[#0b0e1a] border-indigo-900/30 shadow-slate-950/50 hover:border-indigo-500/50' 
        : 'bg-white border-slate-100 hover:border-slate-300'
      }`}
      id={`card-${metric.id}`}
    >
      <header className="w-full text-center">
        <h3 className={`text-[8px] font-bold uppercase tracking-wide truncate py-1 transition-colors duration-500 px-1 ${isWarRoom ? 'text-slate-300' : 'text-slate-700'}`}>
          {metric.title}
        </h3>
        <div className={`h-px w-3/4 mx-auto transition-colors duration-500 ${isWarRoom ? 'bg-slate-800' : 'bg-slate-200'}`} />
      </header>
      <div className="flex flex-col items-center gap-1.5 py-0.5">
        <span className={`text-lg font-black italic tracking-tighter tabular-nums transition-colors duration-500 ${isWarRoom ? 'text-white text-xl' : 'text-slate-900'}`}>
          {metric.value}
        </span>
        <div className={`relative group/icon flex items-center justify-center min-h-[52px] rounded-full transition-colors duration-500 ${isWarRoom ? 'bg-slate-800/50' : 'bg-transparent'}`}>
          {metric.status === 'ok' ? (
            <motion.div whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
              <CheckCircle2 className="w-12 h-12 text-emerald-500" strokeWidth={2.5} />
            </motion.div>
          ) : (
            <motion.div
              animate={{ scale: [1, isWarRoom ? 1.2 : 1.15, 1] }}
              transition={{ repeat: Infinity, duration: isWarRoom ? 0.6 : 0.8, ease: "easeInOut" }}
              style={{ filter: isWarRoom ? "drop-shadow(0 0 8px rgba(255, 0, 0, 0.4))" : "drop-shadow(0 0 6px rgba(204, 0, 0, 0.25))" }}
              whileHover={{ scale: 1.25 }}
            >
              <XCircle className={`w-12 h-12 ${isWarRoom ? 'text-red-500' : 'text-brand-red'}`} strokeWidth={2.5} />
            </motion.div>
          )}
        </div>
      </div>
      <footer className="w-full text-center">
        <div className={`h-px w-3/4 mx-auto mb-1 transition-colors duration-500 ${isWarRoom ? 'bg-slate-800' : 'bg-slate-200'}`} />
        {metric.history && metric.history.length > 2 && (
          <MiniSparkline data={metric.history.map((val, idx) => ({ value: val, timestamp: String(idx) }))} color={metric.status === 'ok' ? '#10b981' : '#ef4444'} />
        )}
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <div className="flex items-center gap-1">
            <Clock className={`w-2 h-2 ${isWarRoom ? 'text-slate-600' : 'text-slate-300'}`} />
            <span className={`text-[8px] font-bold tracking-tighter transition-colors duration-500 ${isWarRoom ? 'text-slate-500' : 'text-slate-400'}`}>
              {metric.lastUpdate}
            </span>
          </div>
          <Countdown metric={metric} onRefresh={onRefresh} hideUI />
        </div>
      </footer>
      {isWarRoom && metric.status === 'error' && <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500 animate-pulse" />}
    </motion.div>
  );
}

function SectionContainer({ section, onCardClick, onCardRefresh, isWarRoom }: { section: Section, onCardClick: (metric: Metric) => void, onCardRefresh: (metric: Metric) => void, isWarRoom: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { percentage, ratio, isScrollable } = useScrollIndicator(scrollRef);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWarRoom && isScrollable) {
      scrollInterval.current = setInterval(() => {
        if (scrollRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
          if (scrollLeft + clientWidth >= scrollWidth - 5) {
            scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
          }
        }
      }, 6000);
    } else {
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    }
    return () => { if (scrollInterval.current) clearInterval(scrollInterval.current); };
  }, [isWarRoom, isScrollable]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <section className={`flex flex-col gap-3 transition-all duration-500 ${isWarRoom ? 'scale-[1.02]' : ''}`} id={`section-${section.title.replace(/\s/g, '-')}`}>
      <div className={`py-4 px-8 rounded-2xl shadow-lg inline-flex items-center w-full transition-colors duration-500 transform -skew-x-6 ${isWarRoom ? 'bg-[#0b0e1a] border border-indigo-900/30' : 'bg-brand-red text-white'}`}>
        <h2 className={`text-xl font-black tracking-tighter uppercase italic skew-x-6 ${isWarRoom ? 'text-brand-red drop-shadow-[0_0_8px_rgba(204,0,0,0.3)]' : 'text-white'}`}>
          {section.title}
        </h2>
      </div>
      <div className="relative group flex flex-col w-full">
        <div ref={scrollRef} className="overflow-x-auto pb-4 scrollbar-hide flex gap-6 scroll-smooth px-4 w-full justify-start">
          {section.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} onClick={onCardClick} onRefresh={onCardRefresh} isWarRoom={isWarRoom} />
          ))}
        </div>
        <AnimatePresence>
          {isScrollable && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} className="flex items-center justify-between mt-2 px-4 w-full">
              <button onClick={() => scroll('left')} className={`focus:outline-none hover:scale-110 transition-all active:scale-95 ${isWarRoom ? 'text-slate-500 hover:text-white' : 'text-brand-yellow'}`}>
                <ChevronLeft className="w-5 h-5" strokeWidth={isWarRoom ? 2 : 4} />
              </button>
              <div className={`mx-4 h-1.5 flex-grow rounded-full relative overflow-hidden shadow-inner transition-colors duration-500 ${isWarRoom ? 'bg-slate-900' : 'bg-brand-yellow/10'}`}>
                <motion.div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-colors duration-500 ${isWarRoom ? 'bg-brand-red shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-brand-yellow'}`}
                  style={{ width: `${ratio * 100}%`, left: `${percentage * (1 - ratio)}%` }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
                />
              </div>
              <button onClick={() => scroll('right')} className={`focus:outline-none hover:scale-110 transition-all active:scale-95 ${isWarRoom ? 'text-slate-500 hover:text-white' : 'text-brand-yellow'}`}>
                <ChevronRight className="w-5 h-5" strokeWidth={isWarRoom ? 2 : 4} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function DivergenceModal({ metric, onClose, onRefresh }: { metric: Metric, onClose: () => void, onRefresh?: (m: Metric) => void }) {
  const [activeTab, setActiveTab] = useState<'table' | 'objective' | 'rules' | 'trend' | 'ai'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const itemsPerPage = 10;
  
  const runAiAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setActiveTab('ai');
    try {
      const resp = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricTitle: metric.title,
          objective: metric.objective,
          rules: metric.rules,
          data: metric.details,
          history: metric.history
        })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setAiAnalysis(data.analysis);
    } catch (err: any) {
      setAiAnalysis(`### ❌ Erro na análise\nNão foi possível processar a análise no momento. Detalhes: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  if (!metric) return null;

  const filteredDetails = (metric.details || []).filter(item => {
    const query = searchQuery.toLowerCase();
    if (metric.isDynamic) {
      return Object.values(item).some(val => String(val ?? '').toLowerCase().includes(query));
    }
    return (
      (item.posicao || '').toLowerCase().includes(query) ||
      (item.item || '').toLowerCase().includes(query) ||
      (item.validade || '').toLowerCase().includes(query) ||
      (item.lote || '').toLowerCase().includes(query) ||
      (item.quantidade || 0).toString().includes(query) ||
      (item.motivo || '').toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredDetails.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDetails = filteredDetails.slice(startIndex, startIndex + itemsPerPage);
  const dynamicColumns = metric.isDynamic && metric.details && metric.details.length > 0 ? Object.keys(metric.details[0]) : [];

  const downloadExcel = () => {
    if (!metric.details || metric.details.length === 0) return;
    let worksheet = metric.isDynamic ? XLSX.utils.json_to_sheet(metric.details) : XLSX.utils.json_to_sheet(metric.details.map(d => ({
        'Posição': d.posicao, 'Item': d.item, 'Validade': d.validade, 'Lote': d.lote, 'Quantidade': d.quantidade, 'Motivo': d.motivo
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Divergências");
    XLSX.writeFile(workbook, `Divergencias_${metric.title.replace(/\s/g, '_')}.xlsx`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-8 rounded-full ${metric.status === 'error' ? 'bg-brand-red' : 'bg-emerald-500'}`} />
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">Detalhes: <span className="text-brand-red">{metric.title}</span></h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Variações Identificadas - {metric.lastUpdate}</p>
                {metric.refreshInterval && (
                  <>
                    <div className="w-px h-3 bg-slate-200" />
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Próxima atualização em:</span>
                      <Countdown metric={metric} onRefresh={onRefresh} className="flex items-center gap-1 text-[10px] font-black" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button onClick={() => setActiveTab('table')} className={`p-2 rounded-md transition-all ${activeTab === 'table' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><Info className="w-5 h-5" /></button>
              <button onClick={() => setActiveTab('objective')} className={`p-2 rounded-md transition-all ${activeTab === 'objective' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><BookOpen className="w-5 h-5" /></button>
              <button onClick={() => setActiveTab('rules')} className={`p-2 rounded-md transition-all ${activeTab === 'rules' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><ShieldCheck className="w-5 h-5" /></button>
              <button onClick={() => setActiveTab('trend')} className={`p-2 rounded-md transition-all ${activeTab === 'trend' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><TrendingUp className="w-5 h-5" /></button>
              <button onClick={runAiAnalysis} className={`p-2 rounded-md transition-all ${activeTab === 'ai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-500 hover:text-indigo-700'}`} disabled={isAnalyzing}><Sparkles className={`w-5 h-5 ${isAnalyzing ? 'animate-pulse' : ''}`} /></button>
            </div>
            <button onClick={downloadExcel} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-sm active:scale-95 disabled:opacity-50" disabled={!metric.details || metric.details.length === 0}><Download className="w-5 h-5" /></button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
          </div>
        </header>

        <div className="flex-grow overflow-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'table' && (
              <motion.div key="table" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
                {metric.details && metric.details.length > 0 ? (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" placeholder="Buscar em qualquer coluna..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none transition-all font-medium" />
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {metric.isDynamic ? dynamicColumns.map(col => <th key={col} className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">{col}</th>) : (
                                <>
                                  <th className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">Posição</th>
                                  <th className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">Item / Descrição</th>
                                  <th className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider text-center">Validade</th>
                                  <th className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider text-center">Lote</th>
                                  <th className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider text-center">Qtd.</th>
                                  <th className="px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wider">Motivo Divergência</th>
                                </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedDetails.length > 0 ? paginatedDetails.map((detail, idx) => (
                              <tr key={detail.id || idx} className="hover:bg-slate-50 transition-colors group">
                                {metric.isDynamic ? dynamicColumns.map(col => <td key={col} className="px-4 py-4 text-sm font-medium text-slate-700">{String(detail[col] ?? '')}</td>) : (
                                    <>
                                      <td className="px-4 py-4 text-sm font-bold text-slate-900 font-mono">{detail.posicao}</td>
                                      <td className="px-4 py-4 text-sm font-medium text-slate-700">{detail.item}</td>
                                      <td className="px-4 py-4 text-sm text-slate-600 text-center font-mono">{detail.validade}</td>
                                      <td className="px-4 py-4 text-sm text-slate-600 text-center font-mono">{detail.lote}</td>
                                      <td className="px-4 py-4 text-sm font-black text-brand-red text-center tabular-nums">{detail.quantidade}</td>
                                      <td className="px-4 py-4 text-sm"><span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg font-bold text-[10px] border border-red-100">{detail.motivo}</span></td>
                                    </>
                                )}
                              </tr>
                          )) : <tr><td colSpan={6} className="px-4 py-10 text-center font-medium text-slate-500 italic">Nenhum resultado encontrado para "{searchQuery}"</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-2 pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exibindo {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredDetails.length)} de {filteredDetails.length} itens</span>
                        <div className="flex gap-1">
                          <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                          <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}>{page}</button>
                            ))}
                          </div>
                          <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center border-4 border-emerald-100"><CheckCircle2 className="w-10 h-10 text-emerald-500" /></div>
                    <div><h3 className="text-xl font-black text-slate-900 tracking-tight">SEM DIVERGÊNCIA</h3><p className="text-slate-500 font-medium">Todos os registros para esta métrica estão em conformidade.</p></div>
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'objective' && (
              <motion.div key="objective" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="bg-slate-50 rounded-xl p-8 border border-slate-200">
                <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><BookOpen className="w-8 h-8" /></div><h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">Objetivo da Métrica</h3></div>
                <p className="text-lg text-slate-700 leading-relaxed font-medium">{metric.objective || "Nenhum objetivo detalhado cadastrado para esta métrica."}</p>
              </motion.div>
            )}
            {activeTab === 'rules' && (
              <motion.div key="rules" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck className="w-8 h-8" /></div><h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">Regras de Validação</h3></div>
                {metric.rules && metric.rules.length > 0 ? (
                  <div className="grid gap-3">{metric.rules.map((rule, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm border-l-4 border-l-amber-500"><p className="text-slate-700 font-bold whitespace-pre-line text-sm leading-relaxed"><span className="text-amber-600 font-black mr-2">REGRA {idx + 1}:</span>{rule}</p></div>
                  ))}</div>
                ) : <p className="text-slate-500 italic p-8 bg-slate-50 rounded-xl border border-slate-200 text-center">Nenhuma regra de validação cadastrada para esta métrica.</p>}
              </motion.div>
            )}
            {activeTab === 'trend' && (
              <motion.div key="trend" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Activity className="w-8 h-8" /></div><h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">Análise de Tendência</h3></div>
                  <div className="text-right"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Atual</p><p className="text-3xl font-black text-slate-900 tabular-nums">{metric.value}</p></div>
                </div>
                {metric.history && metric.history.length > 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-[350px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...metric.history].reverse().map((val, idx) => ({ value: val, time: idx === metric.history!.length - 1 ? 'Agora' : `v-${metric.history!.length - idx - 1}` }))}>
                        <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={metric.status === 'error' ? "#cc0000" : "#10b981"} stopOpacity={0.1}/><stop offset="95%" stopColor={metric.status === 'error' ? "#cc0000" : "#10b981"} stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                        <Area type="monotone" dataKey="value" stroke={metric.status === 'error' ? "#cc0000" : "#10b981"} strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" animationDuration={1500} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center"><p className="text-slate-500 font-bold italic">Nenhum dado histórico disponível para esta métrica ainda.</p></div>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Média</p><p className="text-lg font-black text-slate-800">{metric.history && metric.history.length > 0 ? (metric.history.reduce((acc, curr) => acc + curr, 0) / metric.history.length).toFixed(1) : '0'}</p></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pico</p><p className="text-lg font-black text-slate-800">{metric.history && metric.history.length > 0 ? Math.max(...metric.history) : '0'}</p></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p><p className={`text-lg font-black ${metric.status === 'error' ? 'text-brand-red' : 'text-emerald-500'}`}>{metric.status === 'error' ? 'CRÍTICO' : 'ESTÁVEL'}</p></div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta</p><p className="text-lg font-black text-slate-800">0</p></div>
                </div>
              </motion.div>
            )}
            {activeTab === 'ai' && (
              <motion.div key="ai" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3"><div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Sparkles className="w-8 h-8" /></div><h3 className="text-2xl font-black text-slate-900 italic tracking-tighter uppercase">Inteligência Artificial</h3></div>
                  {aiAnalysis && <button onClick={runAiAnalysis} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors" disabled={isAnalyzing}><RefreshCcw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />Refazer Análise</button>}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 min-h-[400px] relative overflow-y-auto max-h-[55vh]">
                  {isAnalyzing ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                      <div className="relative"><motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-indigo-200 rounded-full blur-xl"/><Sparkles className="w-12 h-12 text-indigo-600 relative animate-bounce" /></div>
                      <div><p className="font-black text-slate-800 uppercase tracking-widest text-sm">Gerando Insights com Gemini</p><p className="text-[10px] text-slate-500 font-bold uppercase mt-1 px-8">Isso pode levar alguns segundos enquanto analisamos padrões e regras...</p></div>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="markdown-body prose prose-slate max-w-none prose-sm prose-headings:font-black prose-headings:uppercase prose-headings:italic prose-headings:tracking-tighter prose-p:text-slate-600 prose-p:font-medium prose-strong:text-slate-900"><Markdown>{aiAnalysis}</Markdown></div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 gap-6">
                      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center shadow-inner"><Sparkles className="w-10 h-10 text-indigo-600" /></div>
                      <div className="max-w-md">
                        <h4 className="text-lg font-black text-slate-800 uppercase italic">Análise de Dados IA</h4>
                        <p className="text-slate-500 text-sm font-medium mt-2">Clique no botão forneceremos insights profundos sobre a tendência, causas raízes e recomendações para esta métrica.</p>
                        <button onClick={runAiAnalysis} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 mx-auto"><Sparkles className="w-4 h-4" />Gerar Análise Agora</button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-400"><Info className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-widest">Informações em tempo real do ERP/WMS</span></div>
          <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md">Fechar Painel</button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<Section[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
  const [isWarRoom, setIsWarRoom] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'layout' | 'log'>('layout');
  const [layoutConfig, setLayoutConfig] = useState<{title: string, width: number}[]>([]);
  const [eventLog, setEventLog] = useState<{ id: string, message: string, time: string, type: 'info' | 'critical' | 'success' }[]>([]);

  useEffect(() => {
    if (layoutConfig.length > 0) {
      localStorage.setItem('dashboard_layout', JSON.stringify(layoutConfig));
    }
  }, [layoutConfig]);

  useEffect(() => {
    const initApp = async () => {
      await ensureSharePointConfig();
      const config = await fetchDashboardConfig();
      setData(config);
      
      const savedLayout = localStorage.getItem('dashboard_layout');
      let currentLayout: {title: string, width: number}[] = [];
      
      if (savedLayout) {
        try {
          currentLayout = JSON.parse(savedLayout);
          // Add missing sections from config to layout
          config.forEach(s => {
            if (!currentLayout.find(c => c.title === s.title)) {
              currentLayout.push({ title: s.title, width: 33.33 });
            }
          });
        } catch (e) {
          currentLayout = config.map(s => ({ title: s.title, width: 33.33 }));
        }
      } else {
        currentLayout = config.map(s => ({ title: s.title, width: 33.33 }));
      }
      
      setLayoutConfig(currentLayout);
    };
    initApp();
  }, []);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const config = await fetchDashboardConfig();
      setData(config);
      
      // Update layout config if new sections appeared
      setLayoutConfig(prev => {
        const newConfigs = [...prev];
        config.forEach(s => {
          if (!newConfigs.find(c => c.title === s.title)) {
            newConfigs.push({ title: s.title, width: 33.33 });
          }
        });
        return newConfigs;
      });

      await fetchAllDataInternal(config);
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchAllDataInternal = async (configRef: Section[]) => {
    if (configRef.length === 0) return;
    const fetchPromises: { promise: Promise<any>, sectionIdx: number, metricIdx: number, metric: Metric }[] = [];
    configRef.forEach((section, sIdx) => {
      section.metrics.forEach((metric, mIdx) => {
        if (metric.sqlQuery) {
          fetchPromises.push({ promise: postSqlQuery(metric.sqlQuery, metric.id), sectionIdx: sIdx, metricIdx: mIdx, metric });
        }
      });
    });

    try {
      const results = await Promise.all(fetchPromises.map(p => p.promise));
      const now = new Date();
      const nowIso = now.toISOString();
      const nowString = now.toLocaleString('pt-BR');
      const metricsToUpdate: any[] = [];
      
      setData(current => {
        return current.map(section => {
          const updatedMetrics = section.metrics.map(metric => {
            const resultMatch = fetchPromises.find(p => p.metric.id === metric.id);
            if (resultMatch) {
              const res = results[fetchPromises.indexOf(resultMatch)];
              const rowCount = Array.isArray(res) ? res.length : 0;
              const updatedHistory = [rowCount, ...(metric.history || [])].slice(0, 10);
              const updatedMetric = {
                ...metric,
                value: rowCount,
                details: Array.isArray(res) ? res : [],
                lastUpdate: nowString,
                lastUpdateAt: nowIso,
                status: (rowCount > 0 ? 'error' : 'ok') as 'error' | 'ok',
                history: updatedHistory
              };
              metricsToUpdate.push({ id: metric.id, iso: nowIso, result: res, history: updatedHistory });
              return updatedMetric;
            }
            return metric;
          });
          return { ...section, metrics: updatedMetrics };
        });
      });
      metricsToUpdate.forEach(m => saveMetricData(m.id, m.iso, m.result, m.history));
      setEventLog(prev => ([{ id: Math.random().toString(36).substr(2, 9), message: "Sincronização completada com sucesso.", time: new Date().toLocaleTimeString('pt-BR'), type: 'success' as const }, ...prev] as any).slice(0, 50));
    } catch (err) {
      console.error("Data fetch error:", err);
    }
  };

  const fetchAllData = () => fetchAllDataInternal(data);

  useEffect(() => { 
    if (data.length > 0 && !isRefreshing) {
      fetchAllData();
    } 
  }, [data.length]);

  const refreshSingleMetric = async (metric: Metric) => {
    if (!metric.sqlQuery || isRefreshing) return;
    try {
      const result = await postSqlQuery(metric.sqlQuery, metric.id);
      const now = new Date();
      const nowIso = now.toISOString();
      const rowCount = Array.isArray(result) ? result.length : 0;
      let updatedHistory: number[] = [];

      setData(current => {
        return current.map(section => {
          const mIdx = section.metrics.findIndex(m => m.id === metric.id);
          if (mIdx !== -1) {
            const currentMetric = section.metrics[mIdx];
            updatedHistory = [rowCount, ...(currentMetric.history || [])].slice(0, 10);
            const updatedMetrics = [...section.metrics];
            updatedMetrics[mIdx] = { 
              ...currentMetric, 
              value: rowCount, 
              details: Array.isArray(result) ? result : [], 
              lastUpdate: now.toLocaleString('pt-BR'), 
              lastUpdateAt: nowIso, 
              status: rowCount > 0 ? 'error' : 'ok', 
              history: updatedHistory 
            };
            return { ...section, metrics: updatedMetrics };
          }
          return section;
        });
      });
      saveMetricData(metric.id, nowIso, result, updatedHistory);
      setEventLog(prev => ([{ id: Math.random().toString(36).substr(2, 9), message: `Card "${metric.title}" atualizado automaticamente.`, time: now.toLocaleTimeString('pt-BR'), type: 'success' as const }, ...prev] as any).slice(0, 50));
    } catch (err) { console.error(`Auto-refresh error for metric ${metric.id}:`, err); }
  };

  const totalDivergences = data.reduce((acc, section) => acc + section.metrics.reduce((mAcc, m) => mAcc + Number(m.value || 0), 0), 0);
  const criticalMetrics = data.reduce((acc, section) => acc + section.metrics.filter(m => m.status === 'error').length, 0);
  const allMetrics = data.flatMap(s => s.metrics);
  const totalMetrics = allMetrics.length;
  let totalPoints = 0, totalOkPoints = 0, pointsUnderSLA = 0;
  allMetrics.forEach(m => { if (m.history && m.history.length > 0) { totalPoints += m.history.length; totalOkPoints += m.history.filter(v => v === 0).length; pointsUnderSLA += m.history.filter(v => v <= 10).length; } });
  const accuracyToday = totalPoints > 0 ? (totalOkPoints / totalPoints) * 100 : (totalMetrics > 0 ? (allMetrics.filter(m => m.value === 0).length / totalMetrics) * 100 : 0);
  const slaScore = totalPoints > 0 ? (pointsUnderSLA / totalPoints) * 100 : 100;
  let prevTotalPoints = 0, prevOkPoints = 0;
  allMetrics.forEach(m => { if (m.history && m.history.length > 1) { const h = m.history.slice(1); prevTotalPoints += h.length; prevOkPoints += h.filter(v => v === 0).length; } });
  const currentOkRate = totalMetrics > 0 ? (allMetrics.filter(m => m.value === 0).length / totalMetrics) * 100 : 0;
  const prevOkRate = prevTotalPoints > 0 ? (prevOkPoints / prevTotalPoints) * 100 : currentOkRate;
  const trendValue = currentOkRate - prevOkRate;
  const handleWidthChange = (title: string, width: number) => { setLayoutConfig(prev => prev.map(c => c.title === title ? { ...c, width } : c)); };

  const getPackedSections = () => {
    if (!data || data.length === 0) return [];
    
    // Map all sections in data to their config if it exists, or a default config
    const sectionsWithConfig = data.map(section => {
      // Try to find config by title (we could use ID in the future if we ensured all sections had one)
      const config = layoutConfig.find(c => c.title === section.title) || { title: section.title, width: 33.33 };
      return { config, section };
    });

    const result: { config: { title: string, width: number }, section: Section }[] = [];
    const remaining = [...sectionsWithConfig];
    
    while (remaining.length > 0) {
      let currentRowWidth = 0;
      const rowIndices: number[] = [];
      
      for (let i = 0; i < remaining.length; i++) { 
        if (currentRowWidth + remaining[i].config.width <= 100.1) { 
          currentRowWidth += remaining[i].config.width; 
          rowIndices.push(i); 
        } 
      }
      
      if (rowIndices.length === 0 && remaining.length > 0) {
        // Current section is too wide for any row, force it as 100% or just add it
        const first = remaining.shift()!;
        result.push(first);
        continue;
      }

      // Sort indices descending to splice safely
      rowIndices.sort((a, b) => b - a).forEach(idx => { 
        result.push(remaining[idx]); 
        remaining.splice(idx, 1); 
      });
    }
    return result;
  };

  return (
    <main className={`min-h-screen transition-colors duration-700 p-4 md:p-8 space-y-10 pb-32 ${isWarRoom ? 'bg-[#050510] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`flex flex-col sm:flex-row justify-between items-center mb-6 px-6 py-6 rounded-2xl transition-all duration-700 gap-6 mx-auto w-full ${isWarRoom ? 'bg-[#0f1125] border border-indigo-900/40 shadow-[0_0_40px_rgba(0,0,0,0.5)] max-w-[1700px]' : 'bg-white shadow-sm border border-slate-200 max-w-[1400px]'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl transition-colors duration-500 relative ${isWarRoom ? 'bg-indigo-950/30' : 'bg-slate-50'}`}><Activity className={`w-8 h-8 transition-colors duration-500 ${isWarRoom ? 'text-brand-red animate-pulse' : 'text-slate-900'}`} />{isWarRoom && <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 bg-brand-red/20 rounded-2xl" />}</div>
          <div><h1 className={`text-2xl font-black italic tracking-tighter uppercase leading-tight transition-colors duration-500 ${isWarRoom ? 'text-white' : 'text-slate-900'}`}>Monitor <span className="text-brand-red font-black">Operational</span></h1><div className="flex items-center gap-2 mt-1"><div className={`w-2 h-2 rounded-full animate-pulse ${isWarRoom ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-emerald-500'}`} /><p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isWarRoom ? 'text-indigo-400' : 'text-slate-400'}`}>Command Center &bull; Live Stream</p></div></div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin" className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all text-xs font-black border ${isWarRoom ? 'bg-indigo-950/20 border-indigo-900/50 text-indigo-300 hover:text-white hover:bg-indigo-900/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Settings className="w-4 h-4" /> GERENCIAMENTO
          </a>
          <button onClick={() => setIsWarRoom(!isWarRoom)} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${isWarRoom ? 'bg-brand-red text-white hover:bg-red-600 shadow-[0_0_20px_rgba(204,0,0,0.4)]' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{isWarRoom ? 'Sair do Modo War Room' : 'Ativar Modo War Room'}</button>
          <button onClick={refreshData} disabled={isRefreshing} className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all text-xs font-black border ${isWarRoom ? 'bg-indigo-950/20 border-indigo-900/50 text-indigo-300 hover:text-white hover:bg-indigo-900/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}><RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />{isRefreshing ? 'SINCRONIZANDO...' : 'SINCRONIZAR'}</button>
        </div>
      </header>

      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mx-auto w-full transition-all duration-700 ${isWarRoom ? 'max-w-[1700px]' : 'max-w-[1400px]'}`}>
        <div className={`p-5 rounded-2xl border transition-all duration-500 overflow-hidden relative group ${isWarRoom ? 'bg-[#0f1125] border-indigo-900/30' : 'bg-white border-slate-100 shadow-sm'}`}><div className="flex justify-between items-start"><div><p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWarRoom ? 'text-indigo-400' : 'text-slate-400'}`}>Total Divergências</p><h4 className={`text-3xl font-black italic tracking-tighter ${isWarRoom ? 'text-white' : 'text-slate-900'}`}>{totalDivergences}</h4></div><div className={`p-2 rounded-lg ${isWarRoom ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-50 text-slate-400'}`}><Activity className="w-5 h-5" /></div></div><div className={`mt-4 h-1.5 w-full rounded-full overflow-hidden ${isWarRoom ? 'bg-slate-800' : 'bg-slate-100'}`}><motion.div initial={{ width: 0 }} animate={{ width: '65%' }} className="h-full bg-brand-red" /></div></div>
        <div className={`p-5 rounded-2xl border transition-all duration-500 overflow-hidden relative group ${isWarRoom ? 'bg-[#0f1125] border-indigo-900/30' : 'bg-white border-slate-100 shadow-sm'}`}><div className="flex justify-between items-start"><div><p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWarRoom ? 'text-indigo-400' : 'text-slate-400'}`}>Métricas Críticas</p><h4 className="text-3xl font-black italic tracking-tighter text-brand-red">{criticalMetrics}</h4></div><div className={`p-2 rounded-lg ${isWarRoom ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-400'}`}><XCircle className="w-5 h-5" /></div></div><p className="mt-4 text-[10px] font-bold text-slate-500 italic">Requer atenção imediata</p></div>
        <div className={`p-5 rounded-2xl border transition-all duration-500 overflow-hidden relative group ${isWarRoom ? 'bg-[#0f1125] border-indigo-900/30' : 'bg-white border-slate-100 shadow-sm'}`}><div className="flex justify-between items-start"><div><p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWarRoom ? 'text-indigo-400' : 'text-slate-400'}`}>Acertos Hoje</p><h4 className={`text-3xl font-black italic tracking-tighter ${isWarRoom ? 'text-emerald-500' : 'text-emerald-600'}`}>{accuracyToday.toFixed(1)}%</h4></div><div className={`p-2 rounded-lg ${isWarRoom ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><CheckCircle2 className="w-5 h-5" /></div></div><div className="mt-4 flex items-center gap-1">{trendValue >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}<span className={`text-[10px] font-black ${trendValue >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{trendValue >= 0 ? '+' : ''}{trendValue.toFixed(1)}% vs anterior</span></div></div>
        <div className={`p-5 rounded-2xl border transition-all duration-500 overflow-hidden relative group ${isWarRoom ? 'bg-brand-red border-red-800 shadow-[0_0_30px_rgba(204,0,0,0.2)]' : 'bg-brand-yellow border-brand-yellow shadow-sm'}`}><div className="flex justify-between items-start"><div><p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isWarRoom ? 'text-white' : 'text-slate-900'}`}>SLA Operacional</p><h4 className={`text-3xl font-black italic tracking-tighter ${isWarRoom ? 'text-white' : 'text-slate-900'}`}>{slaScore.toFixed(1)}%</h4></div><div className={`p-2 rounded-lg ${isWarRoom ? 'bg-white/10 text-white' : 'bg-white/20 text-slate-900'}`}><RefreshCcw className="w-5 h-5" /></div></div><p className={`mt-4 text-[10px] font-black uppercase ${isWarRoom ? 'text-red-200' : 'text-slate-700'}`}>Status: {slaScore > 95 ? 'Excelente' : slaScore > 80 ? 'Bom' : 'Crítico'}</p></div>
      </div>

      <div className={`flex flex-wrap gap-x-8 gap-y-12 px-2 transition-all duration-700 mx-auto justify-center ${isWarRoom ? 'max-w-[1700px]' : 'max-w-[1400px]'}`}>
        <AnimatePresence mode="popLayout">
          {getPackedSections().map(({ section, config }) => (
            <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} key={section.title} className="transition-all duration-500" style={{ width: `calc(${config.width}% - 32px)`, minWidth: '320px', flexGrow: 0, flexShrink: 0 }}>
              <SectionContainer section={section} onCardClick={setSelectedMetric} onCardRefresh={refreshSingleMetric} isWarRoom={isWarRoom} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>{selectedMetric && <DivergenceModal metric={selectedMetric} onClose={() => setSelectedMetric(null)} onRefresh={refreshSingleMetric} />}</AnimatePresence>
      <AnimatePresence>{isSettingsOpen && (
          <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="fixed inset-0 bg-slate-950/20 backdrop-blur-[2px] z-[55]" />
            <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className={`fixed right-0 top-0 bottom-0 w-80 z-[60] shadow-2xl p-6 border-l transition-colors duration-500 flex flex-col ${isWarRoom ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
              <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-3"><Activity className="w-6 h-6 text-brand-red" /><h2 className="text-xl font-black italic uppercase tracking-tighter">Centro de Controle</h2></div><button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-full transition-colors ${isWarRoom ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X className="w-6 h-6" /></button></div>
              <div className={`flex p-1 rounded-xl mb-8 transition-colors ${isWarRoom ? 'bg-slate-950' : 'bg-slate-100'}`}>
                <button onClick={() => setSettingsTab('layout')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${settingsTab === 'layout' ? 'bg-brand-red text-white shadow-md' : 'text-slate-500 hover:bg-white/10'}`}>Layout</button>
                <button onClick={() => setSettingsTab('log')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${settingsTab === 'log' ? 'bg-brand-red text-white shadow-md' : 'text-slate-500 hover:bg-white/10'}`}>Atividade</button>
              </div>
              <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide">
                {settingsTab === 'layout' ? (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    {layoutConfig.map((config) => (
                      <div key={config.title} className="space-y-4">
                        <div className="flex justify-between items-end">
                          <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed max-w-[70%] ${isWarRoom ? 'text-indigo-400' : 'text-slate-400'}`}>
                            {config.title}
                          </p>
                          <span className="text-lg font-black tabular-nums">{config.width}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="30" 
                          max="100" 
                          step="5" 
                          value={config.width} 
                          onChange={(e) => handleWidthChange(config.title, parseInt(e.target.value))} 
                          className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-brand-red ${isWarRoom ? 'bg-slate-800' : 'bg-slate-100'}`} 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                    {eventLog.length > 0 ? (
                      eventLog.map((event) => (
                        <div key={event.id} className={`p-3 rounded-xl border-l-4 transition-all ${isWarRoom ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'} ${event.type === 'critical' ? 'border-l-red-500' : event.type === 'success' ? 'border-l-emerald-500' : 'border-l-indigo-500'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${isWarRoom ? 'text-slate-500' : 'text-slate-400'}`}>{event.time}</span>
                            {event.type === 'critical' && <Triangle className="w-2 h-2 text-red-500 fill-red-500 animate-pulse" />}
                          </div>
                          <p className={`text-[10px] font-bold leading-tight ${isWarRoom ? 'text-slate-300' : 'text-slate-700'}`}>{event.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20">
                        <p className="text-slate-500 font-bold italic text-xs">Nenhuma atividade recente detectada.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className={`mt-auto pt-6 p-4 rounded-xl border italic text-[10px] font-medium leading-relaxed ${isWarRoom ? 'bg-slate-950/50 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>{settingsTab === 'layout' ? "Sincronização inteligente de grid baseada em larguras customizadas." : "Log operacional de mutações detectadas em tempo real via stream."}</div>
            </motion.div></>
        )}</AnimatePresence>

      <button onClick={() => setIsSettingsOpen(true)} className={`fixed bottom-8 right-8 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 transition-all active:scale-95 group overflow-hidden ${isWarRoom ? 'bg-brand-red text-white hover:bg-red-600 shadow-[0_10px_30px_rgba(204,0,0,0.5)]' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.3)]'}`}><Settings className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" /><span className="font-black text-xs uppercase tracking-widest pr-2 border-l border-white/20 pl-3">Ajustar Dashboard</span></button>
      <footer className={`text-center text-[10px] py-10 border-t mt-12 transition-colors duration-500 mx-auto w-full ${isWarRoom ? 'border-indigo-950 text-indigo-900 max-w-[1700px]' : 'border-slate-200 text-slate-400 max-w-[1400px]'}`}>&copy; {new Date().getFullYear()} Monitoring System - Todos os direitos reservados</footer>
    </main>
  );
}
