import { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ChevronRight, Settings, Layout, 
  Activity, Shield, Clock, BookOpen, Database, Save, X,
  AlertTriangle, Filter, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Section, Metric } from '../types';
import { 
  fetchDashboardConfig, 
  ensureSharePointConfig,
  addDivision, 
  updateDivision, 
  deleteDivision, 
  addMetric, 
  updateMetric, 
  deleteMetric 
} from '../services/configService';

export function Admin() {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingMetric, setEditingMetric] = useState<{ metric: Metric, divisionId: string } | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);

  // Form states
  const [sectionTitle, setSectionTitle] = useState('');
  const [metricForm, setMetricForm] = useState({
    title: '',
    objective: '',
    rules: [] as string[],
    sqlQuery: '',
    refreshInterval: 5
  });

  const loadConfig = async () => {
    setIsLoading(true);
    await ensureSharePointConfig();
    const data = await fetchDashboardConfig();
    setSections(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSaveSection = async () => {
    if (!sectionTitle.trim()) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      if (editingSection?.id) {
        await updateDivision(editingSection.id, sectionTitle, 1);
      } else {
        await addDivision(sectionTitle, sections.length + 1);
      }
      setSectionTitle('');
      setEditingSection(null);
      setIsSectionModalOpen(false);
      setStatusMessage({ type: 'success', text: 'Divisão salva com sucesso!' });
      loadConfig();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Erro ao salvar divisão: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMetric = async () => {
    if (!metricForm.title.trim() || !editingMetric?.divisionId) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      if (editingMetric.metric.id !== 'new') {
        await updateMetric(editingMetric.metric.id, metricForm);
      } else {
        await addMetric(editingMetric.divisionId, metricForm);
      }
      setEditingMetric(null);
      setIsMetricModalOpen(false);
      setStatusMessage({ type: 'success', text: 'Card salvo com sucesso!' });
      loadConfig();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: `Erro ao salvar card: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const openNewMetricModal = (divisionId: string) => {
    setMetricForm({
      title: '',
      objective: '',
      rules: [],
      sqlQuery: '',
      refreshInterval: 5
    });
    setEditingMetric({ 
      metric: { id: 'new', title: '', value: 0, status: 'ok', lastUpdate: '', isDynamic: true, details: [], history: [], rules: [] }, 
      divisionId: divisionId
    });
    setIsMetricModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 rounded-2xl text-white">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">Painel administrativo</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gerenciamento de Estrutura & M\u00E9tricas</p>
          </div>
        </div>
        <a href="/" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
        </a>
      </header>

      <main className="max-w-6xl mx-auto space-y-8 pb-32">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
            <Layout className="w-5 h-5 text-brand-red" /> Divis\u00F5es do Dashboard
          </h2>
          <button 
            onClick={() => { setEditingSection(null); setSectionTitle(''); setIsSectionModalOpen(true); }}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nova Divis\u00E3o
          </button>
        </div>

        <AnimatePresence>
          {statusMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-4 rounded-xl border flex items-center gap-3 font-bold text-xs uppercase tracking-widest ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                  : 'bg-red-50 border-red-100 text-red-600'
              }`}
            >
              {statusMessage.type === 'success' ? <Shield className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {statusMessage.text}
              <button onClick={() => setStatusMessage(null)} className="ml-auto opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Activity className="w-12 h-12 text-slate-300 animate-spin" />
            <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Carregando Configura\u00E7\u00F5es...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {sections.map((section) => (
              <motion.div 
                layout
                key={section.title}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-brand-red rounded-full" />
                    <h3 className="text-lg font-black uppercase italic tracking-tight">{section.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingSection(section); setSectionTitle(section.title); setIsSectionModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={async () => {
                        if (section.id && window.confirm(`Deseja realmente excluir a divisão "${section.title}"?`)) {
                          try {
                            setIsSaving(true);
                            await deleteDivision(section.id);
                            setStatusMessage({ type: 'success', text: 'Divisão excluída!' });
                            loadConfig();
                          } catch (err: any) {
                            setStatusMessage({ type: 'error', text: `Erro ao excluir: ${err.message}` });
                          } finally {
                            setIsSaving(false);
                          }
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid gap-4">
                    {section.metrics.map((metric) => (
                      <div key={metric.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-50 rounded-xl border border-slate-100 gap-4 group">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white border border-slate-200 rounded-xl group-hover:border-brand-red transition-colors">
                            <Activity className="w-5 h-5 text-slate-400 group-hover:text-brand-red" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 uppercase text-xs">{metric.title}</h4>
                            <div className="flex gap-4 mt-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> a cada {metric.refreshInterval}m</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> {metric.rules?.length || 0} regras</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 self-end md:self-auto">
                          <button 
                            onClick={() => {
                              setMetricForm({
                                title: metric.title,
                                objective: metric.objective || '',
                                rules: metric.rules || [],
                                sqlQuery: metric.sqlQuery || '',
                                refreshInterval: metric.refreshInterval || 5
                              });
                              setEditingMetric({ metric, divisionId: section.id || '' });
                              setIsMetricModalOpen(true);
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.confirm(`Deseja realmente excluir o card "${metric.title}"?`)) {
                                try {
                                  setIsSaving(true);
                                  await deleteMetric(metric.id);
                                  setStatusMessage({ type: 'success', text: 'Card excluído!' });
                                  loadConfig();
                                } catch (err: any) {
                                  setStatusMessage({ type: 'error', text: `Erro ao excluir: ${err.message}` });
                                } finally {
                                  setIsSaving(false);
                                }
                              }
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 text-red-500 rounded-lg font-black text-[10px] uppercase tracking-widest hover:border-red-100 hover:bg-red-50 transition-all flex items-center gap-2"
                          >
                            <Trash2 className="w-3 h-3" /> Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => section.id && openNewMetricModal(section.id)}
                      className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all group"
                    >
                      <Plus className="w-5 h-5 group-hover:scale-125 transition-transform" />
                      <span className="font-black uppercase text-xs tracking-widest">Adicionar Novo Card</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Division Modal */}
      <AnimatePresence>
        {isSectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">{editingSection ? 'Editar Divis\u00E3o' : 'Nova Divis\u00E3o'}</h3>
                <button onClick={() => setIsSectionModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">T\u00EDtulo da Divis\u00E3o</label>
                  <input 
                    type="text" 
                    value={sectionTitle}
                    onChange={(e) => setSectionTitle(e.target.value)}
                    placeholder="Ex: Qualidade Operacional"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
                  />
                </div>
                <button 
                  onClick={handleSaveSection}
                  disabled={isSaving}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className={isSaving ? "w-5 h-5 animate-spin" : "w-5 h-5"} /> {isSaving ? 'Salvando...' : (editingSection ? 'Salvar Alterações' : 'Criar Divisão')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Metric Modal */}
      <AnimatePresence>
        {isMetricModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">
                    {editingMetric?.metric.id === 'new' ? 'Novo Card de M\u00E9trica' : 'Editar Card de M\u00E9trica'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Configura\u00E7\u00E3o din\u00E2mica e persist\u00EAncia</p>
                </div>
                <button onClick={() => setIsMetricModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <div className="flex-grow overflow-y-auto p-8 space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Activity className="w-3 h-3" /> T\u00EDtulo do Card</label>
                      <input 
                        type="text" 
                        value={metricForm.title}
                        onChange={(e) => setMetricForm({...metricForm, title: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
                        placeholder="Ex: Diverg\u00EAncia de Invent\u00E1rio"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Clock className="w-3 h-3" /> Intervalo de Atualiza\u00E7\u00E3o (Minutos)</label>
                      <input 
                        type="number" 
                        value={metricForm.refreshInterval}
                        onChange={(e) => setMetricForm({...metricForm, refreshInterval: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Objetivo (Descri\u00E7\u00E3o)</label>
                    <textarea 
                      value={metricForm.objective}
                      onChange={(e) => setMetricForm({...metricForm, objective: e.target.value})}
                      className="w-full h-[120px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold resize-none"
                      placeholder="Descreva o prop\u00F3sito desta m\u00E9trica..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Database className="w-3 h-3" /> Query SQL (Fonte de Dados)</label>
                  <textarea 
                    value={metricForm.sqlQuery}
                    onChange={(e) => setMetricForm({...metricForm, sqlQuery: e.target.value})}
                    className="w-full h-[150px] px-4 py-3 bg-slate-950 text-emerald-500 font-mono text-sm border-2 border-slate-800 rounded-xl outline-none focus:border-brand-red transition-all resize-none shadow-inner"
                    placeholder="SELECT * FROM TABELA WHERE..."
                  />
                  <div className="mt-2 text-[9px] text-slate-400 font-bold uppercase p-3 bg-slate-100 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-brand-red" /> Atuando em tempo real sobre a base do ERP selecionada nas configura\u00E7\u00F5es.
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Shield className="w-3 h-3" /> Regras de Neg\u00F3cio</label>
                  <div className="space-y-2">
                    {metricForm.rules.map((rule, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text" 
                          value={rule}
                          onChange={(e) => {
                            const newRules = [...metricForm.rules];
                            newRules[idx] = e.target.value;
                            setMetricForm({...metricForm, rules: newRules});
                          }}
                          className="flex-grow px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
                        />
                        <button onClick={() => setMetricForm({...metricForm, rules: metricForm.rules.filter((_, i) => i !== idx)})} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setMetricForm({...metricForm, rules: [...metricForm.rules, '']})}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all font-black uppercase text-[10px] tracking-widest"
                    >
                      + Adicionar Regra
                    </button>
                  </div>
                </div>
              </div>

              <footer className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button onClick={() => setIsMetricModalOpen(false)} disabled={isSaving} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all disabled:opacity-50">Cancelar</button>
                <button 
                  onClick={handleSaveMetric}
                  disabled={isSaving}
                  className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className={isSaving ? "w-4 h-4 animate-spin" : "w-4 h-4"} /> {isSaving ? 'Salvando...' : 'Salvar Card'}
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
