import React, { useCallback, useEffect, useState } from 'react';
import {
  DollarSign,
  Plus,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  X,
  Wallet,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  financeService,
  CashFlowSummary,
  FinancialCategory,
  FinancialTransaction,
  PaymentMethod,
  PaymentStatus,
  TransactionType,
} from '../services/financeService';
import { propertyService } from '../services/propertyService';
import { Property } from '../types/property';
import { getApiErrorMessage } from '../utils/apiError';

export const FinancePage: React.FC = () => {
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filterPropertyId, setFilterPropertyId] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<{
    property_id: string;
    type: TransactionType;
    category_id: string;
    amount: string;
    description: string;
    transaction_date: string;
    payment_status: PaymentStatus;
    payment_method: PaymentMethod;
  }>({
    property_id: '',
    type: 'income',
    category_id: '',
    amount: '',
    description: '',
    transaction_date: todayStr,
    payment_status: 'paid',
    payment_method: 'pix',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sumData, txsData, catsData, propsData] = await Promise.all([
        financeService.getSummary(filterPropertyId || undefined),
        financeService.listTransactions({
          property_id: filterPropertyId || undefined,
          type: filterType !== 'all' ? (filterType as TransactionType) : undefined,
        }),
        financeService.listCategories(),
        propertyService.listProperties({ page: 1, page_size: 100 }),
      ]);
      setSummary(sumData);
      setTransactions(txsData);
      setCategories(catsData);
      setProperties(propsData.items || []);

      if (propsData.items?.length && !form.property_id) {
        setForm((prev) => ({ ...prev, property_id: propsData.items[0].id }));
      }
      const matchingCat = catsData.find((c) => c.type === form.type);
      if (matchingCat && !form.category_id) {
        setForm((prev) => ({ ...prev, category_id: String(matchingCat.id) }));
      }
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Não foi possível carregar os dados financeiros.'));
    } finally {
      setIsLoading(false);
    }
  }, [filterPropertyId, filterType, form.property_id, form.category_id, form.type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTypeChange = (nextType: TransactionType) => {
    const firstMatching = categories.find((c) => c.type === nextType);
    setForm((prev) => ({
      ...prev,
      type: nextType,
      category_id: firstMatching ? String(firstMatching.id) : '',
    }));
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.category_id) {
      setNotice({ type: 'error', text: 'Selecione o imóvel e a categoria financeira.' });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      await financeService.createTransaction({
        property_id: form.property_id,
        category_id: Number(form.category_id),
        type: form.type,
        amount: Number(form.amount),
        description: form.description.trim(),
        transaction_date: form.transaction_date,
        payment_status: form.payment_status,
        payment_method: form.payment_method,
      });
      setIsModalOpen(false);
      setForm((prev) => ({ ...prev, amount: '', description: '' }));
      setNotice({
        type: 'success',
        text: 'Lançamento financeiro registrado com sucesso!',
      });
      await loadData();
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao registrar lançamento financeiro.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCategoriesForForm = categories.filter((c) => c.type === form.type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Gestão Financeira & Fluxo de Caixa
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Controle de receitas de hospedagem, despesas operacionais e margem líquida por imóvel (RF-13).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Atualizar
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Resumo de Fluxo de Caixa */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Receitas Totais</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-emerald-700">
              R$ {Number(summary.total_income).toFixed(2).replace('.', ',')}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Despesas Totais</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-rose-700">
              R$ {Number(summary.total_expense).toFixed(2).replace('.', ',')}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Resultado Líquido</span>
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Wallet className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">
              R$ {Number(summary.net_result).toFixed(2).replace('.', ',')}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Margem Líquida</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <DollarSign className="w-4.5 h-4.5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-indigo-700">{summary.margin_pct}%</p>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Todos os Lançamentos' },
            { id: 'income', label: 'Receitas' },
            { id: 'expense', label: 'Despesas' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all ${
                filterType === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={filterPropertyId}
          onChange={(e) => setFilterPropertyId(e.target.value)}
          aria-label="Filtrar por imóvel"
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          <option value="">Todos os Imóveis</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>

      {/* Extrato de Lançamentos */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-2xl bg-white border border-slate-200/70 p-4 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Falha ao carregar dados financeiros</h3>
          <p className="text-xs text-slate-600 mt-1">{loadError}</p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={loadData}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : transactions.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white/50">
          <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Nenhum lançamento encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Registre receitas de hospedagem e despesas de manutenção, limpeza ou insumos para acompanhar o fluxo de caixa real.
          </p>
          <div className="mt-5">
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
              Registrar Primeiro Lançamento
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {transactions.map((tx) => (
            <Card key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant={tx.type === 'income' ? 'emerald' : 'rose'} size="sm">
                    {tx.type === 'income' ? 'Receita' : 'Despesa'}
                  </Badge>
                  <Badge variant="slate" size="sm">
                    {tx.category_name}
                  </Badge>
                  <span className="text-xs text-slate-500 font-medium">{tx.property_name}</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{tx.description}</p>
                <p className="text-[11px] text-slate-400">
                  Competência: {new Date(tx.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p
                  className={`text-base font-black ${
                    tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2).replace('.', ',')}
                </p>
                <Badge
                  variant={tx.payment_status === 'paid' ? 'emerald' : 'amber'}
                  size="sm"
                >
                  {tx.payment_status === 'paid' ? 'Liquidado' : 'Pendente'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Novo Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">Novo Lançamento Financeiro</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    form.type === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Receita (+)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    form.type === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Despesa (-)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Imóvel *
                </label>
                <select
                  required
                  value={form.property_id}
                  onChange={(e) => setForm({ ...form, property_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                >
                  <option value="">Selecione um imóvel...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Categoria Financeira (RF-13) *
                </label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                >
                  <option value="">Selecione a categoria...</option>
                  {filteredCategoriesForForm.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Descrição do Lançamento *"
                placeholder="Ex: Repasse Airbnb ou Lavanderia"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Valor (R$) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />

                <Input
                  label="Data *"
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Salvar Lançamento
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
