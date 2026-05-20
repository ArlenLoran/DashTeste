import { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ChevronRight, Settings, Layout, 
  Activity, Shield, Clock, BookOpen, Database, Save, X,
  AlertTriangle, Filter, ArrowLeft, Lock, GripVertical, ChevronUp, ChevronDown
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
  deleteMetric,
  isUserAllowed,
  fetchAllowedUsers,
  addAllowedUser,
  removeAllowedUser,
  saveDivisionsIndices,
  saveMetricsIndices
} from '../services/configService';
import { getCurrentSharePointUserEmail, hasSpContext } from '../services/spService';

export function Admin() {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingMetric, setEditingMetric] = useState<{ metric: Metric, divisionId: string } | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);

  // Permission settings
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<{ id: string; email: string }[]>([]);
  const [newAccessEmail, setNewAccessEmail] = useState('');
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [accessMessage, setAccessMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [draggedMetricIndex, setDraggedMetricIndex] = useState<{ sectionId: string, index: number } | null>(null);

  const handleMoveSection = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= sections.length) return;
    const updated = [...sections];
    const [removed] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, removed);
    setSections(updated);
    try {
      await saveDivisionsIndices(updated.map(s => s.id!));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveMetric = async (sectionId: string, fromIdx: number, toIdx: number) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section || toIdx < 0 || toIdx >= section.metrics.length) return;
    const updatedMetrics = [...section.metrics];
    const [removed] = updatedMetrics.splice(fromIdx, 1);
    updatedMetrics.splice(toIdx, 0, removed);
    
    const updatedSections = sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, metrics: updatedMetrics };
      }
      return s;
    });
    setSections(updatedSections);
    try {
      await saveMetricsIndices(sectionId, updatedMetrics.map(m => m.id));
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllowedUsers = async () => {
    try {
      const users = await fetchAllowedUsers();
      setAllowedUsers(users);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAccessModalOpen) {
      loadAllowedUsers();
    }
  }, [isAccessModalOpen]);

  const handleAddAccess = async () => {
    if (!newAccessEmail.trim() || !newAccessEmail.includes('@')) {
      setAccessMessage({ type: 'error', text: 'Insira um e-mail válido' });
      return;
    }
    setIsSavingAccess(true);
    setAccessMessage(null);
    try {
      const ok = await addAllowedUser(newAccessEmail);
      if (ok) {
        setAccessMessage({ type: 'success', text: 'Acesso concedido com sucesso!' });
        setNewAccessEmail('');
        await loadAllowedUsers();
      } else {
        setAccessMessage({ type: 'error', text: 'Erro ao conceder acesso' });
      }
    } catch (err: any) {
      setAccessMessage({ type: 'error', text: err?.message || 'Erro ao conceder acesso' });
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleRemoveAccess = async (id: string, email: string) => {
    if (window.confirm(`Deseja realmente remover o acesso de ${email}?`)) {
      setIsSavingAccess(true);
      setAccessMessage(null);
      try {
        const ok = await removeAllowedUser(id, email);
        if (ok) {
          setAccessMessage({ type: 'success', text: 'Acesso removido com sucesso!' });
          await loadAllowedUsers();
          
          const curEmail = getCurrentSharePointUserEmail() || localStorage.getItem('mock_user_email') || 'arlenloran@gmail.com';
          if (email.toLowerCase().trim() === curEmail.toLowerCase().trim()) {
            const allowed = await isUserAllowed(curEmail);
            setHasAccess(allowed);
          }
        } else {
          setAccessMessage({ type: 'error', text: 'Erro ao remover acesso' });
        }
      } catch (err: any) {
        setAccessMessage({ type: 'error', text: err?.message || 'Erro ao remover acesso' });
      } finally {
        setIsSavingAccess(false);
      }
    }
  };

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
    setIsCheckingAccess(true);
    await ensureSharePointConfig();
    const email = getCurrentSharePointUserEmail() || localStorage.getItem('mock_user_email') || 'arlenloran@gmail.com';
    setUserEmail(email);
    const allowed = await isUserAllowed(email);
    setHasAccess(allowed);
    if (allowed) {
      const data = await fetchDashboardConfig();
      setSections(data);
    }
    setIsCheckingAccess(false);
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

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-20 gap-4">
        <Activity className="w-12 h-12 text-slate-400 animate-spin" />
        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Verificando Permissões...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 p-8 rounded-3xl shadow-xl w-full max-w-md text-center"
        >
          <div className="mx-auto w-16 h-16 bg-red-50 text-brand-red rounded-2xl flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 animate-bounce" />
          </div>
          
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Acesso Restrito</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 mb-6">Painel Administrativo bloqueado</p>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-left mb-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-tight mb-1">E-mail Identificado:</p>
            <p className="text-xs font-black text-slate-800 break-all">{userEmail || 'Nenhum e-mail identificado'}</p>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed mb-8">
            Desculpe, apenas usuários cadastrados na lista de permissões possuem autorização para gerenciar a estrutura das métricas.
          </p>

          <div className="flex flex-col gap-3">
            <a href="/" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-md">
              <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
            </a>
            
            {!hasSpContext() && (
              <button 
                onClick={() => {
                  const val = window.prompt("Simular novo e-mail para teste:", userEmail);
                  if (val) {
                    localStorage.setItem('mock_user_email', val.trim());
                    window.location.reload();
                  }
                }}
                className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-50 transition-all cursor-pointer"
              >
                Simular outro e-mail (modo teste)
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 rounded-2xl text-white">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">Painel administrativo</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gerenciamento de Estrutura & Métricas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAccessModalOpen(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-brand-red animate-pulse" /> Gerenciar Acessos
          </button>
          <a href="/" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-8 pb-32">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-2">
            <Layout className="w-5 h-5 text-brand-red" /> Divisões do Dashboard
          </h2>
          <button 
            onClick={() => { setEditingSection(null); setSectionTitle(''); setIsSectionModalOpen(true); }}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nova Divisão
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
            <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Carregando Configurações...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {sections.map((section, sIdx) => (
              <motion.div 
                layout
                key={section.id || section.title}
                draggable
                onDragStart={(e) => {
                  // Only drag section if we are dragging the handle or general header area
                  setDraggedSectionIndex(sIdx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (draggedSectionIndex !== null && draggedSectionIndex !== sIdx) {
                    handleMoveSection(draggedSectionIndex, sIdx);
                  }
                  setDraggedSectionIndex(null);
                }}
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
                  draggedSectionIndex === sIdx ? 'opacity-40 border-dashed border-brand-red scale-[0.99]' : 'border-slate-200'
                }`}
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div 
                      className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600 transition-colors p-1" 
                      title="Arraste para reordenar divisão"
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className="w-2 h-8 bg-brand-red rounded-full" />
                    <h3 className="text-lg font-black uppercase italic tracking-tight">{section.title}</h3>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white mr-1">
                      <button 
                        onClick={() => handleMoveSection(sIdx, sIdx - 1)}
                        disabled={sIdx === 0}
                        className="p-1.5 px-2.5 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all border-r border-slate-150 cursor-pointer"
                        title="Mover divisão para cima"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleMoveSection(sIdx, sIdx + 1)}
                        disabled={sIdx === sections.length - 1}
                        className="p-1.5 px-2.5 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all cursor-pointer"
                        title="Mover divisão para baixo"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
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
                    {section.metrics.map((metric, mIdx) => (
                      <div 
                        key={metric.id} 
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggedMetricIndex({ sectionId: section.id!, index: mIdx });
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          if (draggedMetricIndex !== null && draggedMetricIndex.sectionId === section.id! && draggedMetricIndex.index !== mIdx) {
                            handleMoveMetric(section.id!, draggedMetricIndex.index, mIdx);
                          }
                          setDraggedMetricIndex(null);
                        }}
                        className={`flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-50 rounded-xl border gap-4 group transition-all duration-300 ${
                          draggedMetricIndex && draggedMetricIndex.sectionId === section.id! && draggedMetricIndex.index === mIdx
                            ? 'opacity-40 border-dashed border-brand-red scale-[0.99] border-brand-red bg-red-50/5'
                            : 'border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-4 w-full md:w-auto">
                          <div 
                            className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600 transition-colors p-1" 
                            title="Arraste para reordenar card"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
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
                        <div className="flex gap-2 self-end md:self-auto items-center">
                          <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white mr-1">
                            <button 
                              onClick={() => handleMoveMetric(section.id!, mIdx, mIdx - 1)}
                              disabled={mIdx === 0}
                              className="p-1 px-2.5 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all border-r border-slate-150 cursor-pointer"
                              title="Mover card para cima"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleMoveMetric(section.id!, mIdx, mIdx + 1)}
                              disabled={mIdx === section.metrics.length - 1}
                              className="p-1 px-2.5 bg-white text-slate-400 hover:text-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all cursor-pointer"
                              title="Mover card para baixo"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                      className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all group cursor-pointer"
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
                <h3 className="text-2xl font-black uppercase italic tracking-tighter">{editingSection ? 'Editar Divisão' : 'Nova Divisão'}</h3>
                <button onClick={() => setIsSectionModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Título da Divisão</label>
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
                    {editingMetric?.metric.id === 'new' ? 'Novo Card de Métrica' : 'Editar Card de Métrica'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Configuração dinâmica e persistência</p>
                </div>
                <button onClick={() => setIsMetricModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </header>

              <div className="flex-grow overflow-y-auto p-8 space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Activity className="w-3 h-3" /> Título do Card</label>
                      <input 
                        type="text" 
                        value={metricForm.title}
                        onChange={(e) => setMetricForm({...metricForm, title: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
                        placeholder="Ex: Divergência de Inventário"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Clock className="w-3 h-3" /> Intervalo de Atualização (Minutos)</label>
                      <input 
                        type="number" 
                        value={metricForm.refreshInterval}
                        onChange={(e) => setMetricForm({...metricForm, refreshInterval: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><BookOpen className="w-3 h-3" /> Objetivo (Descrição)</label>
                    <textarea 
                      value={metricForm.objective}
                      onChange={(e) => setMetricForm({...metricForm, objective: e.target.value})}
                      className="w-full h-[120px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold resize-none"
                      placeholder="Descreva o propósito desta métrica..."
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
                    <AlertTriangle className="w-3.5 h-3.5 text-brand-red" /> Atuando em tempo real sobre a base do ERP selecionada nas configurações.
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2"><Shield className="w-3 h-3" /> Regras de Negócio</label>
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

      {/* Modal de Gerenciamento de Acessos */}
      <AnimatePresence>
        {isAccessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="rounded-3xl p-8 w-full max-w-lg shadow-2xl bg-white border border-slate-200 text-slate-900 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-50 text-brand-red">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Controle de Acessos</h3>
                    <p className="text-[9px] font-black uppercase mt-0.5 tracking-wider text-slate-400">Gerenciar e-mails permitidos</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAccessModalOpen(false)} 
                  className="p-2 rounded-full transition-colors hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {accessMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold uppercase tracking-wider mb-4 border ${accessMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                  {accessMessage.text}
                </div>
              )}

              {/* Form to Add User */}
              <div className="mb-6">
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-slate-400">Conceder Novo Acesso (E-mail)</label>
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    value={newAccessEmail}
                    onChange={(e) => setNewAccessEmail(e.target.value)}
                    placeholder="Ex: usuario@empresa.com"
                    className="flex-grow px-4 py-3 border rounded-xl outline-none transition-all font-bold text-xs bg-slate-50 border-slate-200 text-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <button 
                    onClick={handleAddAccess}
                    disabled={isSavingAccess}
                    className="px-5 py-3 bg-brand-red hover:bg-red-650 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Scrollable list of active users */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-slate-400">Usuários com Permissão ({allowedUsers.length})</label>
                <div className="max-h-[200px] overflow-y-auto rounded-2xl border bg-slate-50 border-slate-200">
                  {allowedUsers.length === 0 ? (
                    <p className="text-[10px] uppercase font-bold text-center py-8 text-slate-400 tracking-wider">Nenhum e-mail cadastrado</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {allowedUsers.map(u => (
                        <div key={u.id} className="p-3.5 flex justify-between items-center hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-2.5 max-w-[80%]">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                            <span className="font-extrabold text-xs tracking-tight select-all truncate">{u.email}</span>
                          </div>
                          {(getCurrentSharePointUserEmail() || 'arlenloran@gmail.com').toLowerCase().trim() !== u.email.toLowerCase().trim() && (
                            <button 
                              onClick={() => handleRemoveAccess(u.id, u.email)}
                              disabled={isSavingAccess}
                              className="p-1.5 text-slate-400 hover:text-brand-red rounded-lg hover:bg-red-50/10 transition-colors"
                              title="Remover Permissão"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
