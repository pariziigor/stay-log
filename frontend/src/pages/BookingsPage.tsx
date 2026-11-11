import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Users,
  X,
  RefreshCw,
  ShieldCheck,
  Ban,
  LogIn,
  LogOut,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import {
  bookingService,
  ReservationItem,
  ReservationSource,
  ReservationStatus,
} from '../services/bookingService';
import { propertyService } from '../services/propertyService';
import { Property } from '../types/property';
import { getApiErrorMessage } from '../utils/apiError';

const SOURCE_LABELS: Record<ReservationSource, string> = {
  direct: 'Reserva Direta',
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'Vrbo',
  other: 'Outro Canal',
};

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  checked_in: 'Em Hospedagem',
  checked_out: 'Finalizada',
  cancelled: 'Cancelada',
  no_show: 'No-Show',
};

export const BookingsPage: React.FC = () => {
  const { role } = useAuth();
  const canManage = role === 'admin' || role === 'owner';

  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filterPropertyId, setFilterPropertyId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const fourDaysOut = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState<{
    property_id: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    source: ReservationSource;
    check_in_date: string;
    check_out_date: string;
    guests_count: number;
    total_amount: string;
    platform_fee: string;
    notes: string;
  }>({
    property_id: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    source: 'direct',
    check_in_date: tomorrow,
    check_out_date: fourDaysOut,
    guests_count: 2,
    total_amount: '',
    platform_fee: '0',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [resData, propsData] = await Promise.all([
        bookingService.listReservations({
          property_id: filterPropertyId || undefined,
          status: filterStatus !== 'all' ? filterStatus : undefined,
        }),
        propertyService.listProperties({ page: 1, page_size: 100 }),
      ]);
      setReservations(resData);
      setProperties(propsData.items || []);
      if (propsData.items?.length && !form.property_id) {
        setForm((prev) => ({ ...prev, property_id: propsData.items[0].id }));
      }
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Não foi possível carregar as reservas.'));
    } finally {
      setIsLoading(false);
    }
  }, [filterPropertyId, filterStatus, form.property_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id) {
      setNotice({ type: 'error', text: 'Selecione um imóvel para registrar a reserva.' });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const created = await bookingService.createReservation({
        property_id: form.property_id,
        guest_name: form.guest_name.trim(),
        guest_email: form.guest_email.trim() || undefined,
        guest_phone: form.guest_phone.trim() || undefined,
        source: form.source,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        guests_count: Number(form.guests_count),
        total_amount: form.total_amount ? Number(form.total_amount) : undefined,
        platform_fee: Number(form.platform_fee || 0),
        notes: form.notes.trim() || undefined,
      });
      setReservations((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setForm((prev) => ({
        ...prev,
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        total_amount: '',
        platform_fee: '0',
        notes: '',
      }));
      setNotice({
        type: 'success',
        text: `Reserva de "${created.guest_name}" confirmada sem conflitos de calendário!`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Falha ao criar reserva (verifique datas e capacidade).'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (res: ReservationItem, status: ReservationStatus) => {
    setNotice(null);
    try {
      const updated = await bookingService.updateStatus(res.id, status);
      setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setNotice({
        type: 'success',
        text: `Status da reserva atualizado para "${STATUS_LABELS[status]}".`,
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao atualizar status da reserva.'),
      });
    }
  };

  const handleAnonymizeGuest = async (res: ReservationItem) => {
    setNotice(null);
    try {
      await bookingService.anonymizeGuest(res.guest_id);
      await loadData();
      setNotice({
        type: 'success',
        text: 'Dados pessoais do hóspede anonimizados em conformidade com o art. 18 da LGPD.',
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text: getApiErrorMessage(err, 'Erro ao anonimizar dados do hóspede.'),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Calendário & Reservas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Controle centralizado de estadias, prevenção de overbooking e proteção LGPD de dados de hóspedes (RF-05 a RF-07).
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
          {canManage && (
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Nova Reserva
            </Button>
          )}
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

      {/* Filtros */}
      <Card className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'confirmed', label: 'Confirmadas' },
            { id: 'checked_in', label: 'Em Hospedagem' },
            { id: 'checked_out', label: 'Finalizadas' },
            { id: 'cancelled', label: 'Canceladas' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                filterStatus === tab.id
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

      {/* Listagem */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-white border border-slate-200/70 p-5 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <Card className="p-8 text-center border-rose-200 bg-rose-50/40">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Erro ao carregar reservas</h3>
          <p className="text-xs text-slate-600 mt-1">{loadError}</p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={loadData}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : reservations.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-white/50">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Nenhuma reserva registrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre reservas diretas ou de plataformas (Airbnb, Booking.com). O sistema bloqueia automaticamente conflitos de datas no mesmo imóvel.
          </p>
          {canManage && (
            <div className="mt-5">
              <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} icon={<Plus className="w-4 h-4" />}>
                Registrar Primeira Reserva
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((r) => (
            <Card key={r.id} className="p-5 border-slate-200/90 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        r.status === 'confirmed' || r.status === 'checked_in'
                          ? 'emerald'
                          : r.status === 'cancelled'
                          ? 'rose'
                          : 'slate'
                      }
                      dot
                      size="sm"
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </Badge>
                    <Badge variant="brand" size="sm">
                      {SOURCE_LABELS[r.source] || r.source}
                    </Badge>
                    <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" /> {r.property_name}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">{r.guest_name}</h3>
                  <p className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                    <span>
                      <strong>Check-in:</strong> {new Date(r.check_in_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span>
                      <strong>Check-out:</strong> {new Date(r.check_out_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" /> {r.guests_count} hóspede(s) • {r.nights} noite(s)
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div className="text-left lg:text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total / Líquido</p>
                    <p className="text-sm font-black text-slate-900">
                      R$ {Number(r.total_amount).toFixed(2).replace('.', ',')}
                      <span className="text-xs font-semibold text-emerald-700 ml-1.5">
                        (Líq. R$ {Number(r.net_amount).toFixed(2).replace('.', ',')})
                      </span>
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusUpdate(r, 'checked_in')}
                          icon={<LogIn className="w-3.5 h-3.5" />}
                        >
                          Check-in
                        </Button>
                      )}
                      {r.status === 'checked_in' && (
                        <Button
                          size="sm"
                          variant="emerald"
                          onClick={() => handleStatusUpdate(r, 'checked_out')}
                          icon={<LogOut className="w-3.5 h-3.5" />}
                        >
                          Check-out
                        </Button>
                      )}
                      {r.status !== 'cancelled' && r.status !== 'checked_out' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleStatusUpdate(r, 'cancelled')}
                          icon={<Ban className="w-3.5 h-3.5" />}
                        >
                          Cancelar
                        </Button>
                      )}
                      {!r.guest_name.includes('anonimizado') && (
                        <button
                          type="button"
                          onClick={() => handleAnonymizeGuest(r)}
                          className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-xs"
                          title="Anonimizar dados pessoais do hóspede (LGPD art. 18)"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Nova Reserva */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">Registrar Nova Reserva</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-4 mt-4">
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
                      {p.name} (Máx. {p.max_guests} hóspedes)
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Nome Completo do Hóspede *"
                placeholder="Ex: Ana Beatriz Souza"
                value={form.guest_name}
                onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="E-mail do Hóspede"
                  type="email"
                  placeholder="ana@email.com"
                  value={form.guest_email}
                  onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
                />
                <Input
                  label="Telefone / WhatsApp"
                  placeholder="(48) 99999-0000"
                  value={form.guest_phone}
                  onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Data de Check-in *"
                  type="date"
                  value={form.check_in_date}
                  onChange={(e) => setForm({ ...form, check_in_date: e.target.value })}
                  required
                />
                <Input
                  label="Data de Check-out *"
                  type="date"
                  value={form.check_out_date}
                  onChange={(e) => setForm({ ...form, check_out_date: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                    Canal de Origem *
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) =>
                      setForm({ ...form, source: e.target.value as ReservationSource })
                    }
                    className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-3.5 py-2.5"
                  >
                    <option value="direct">Reserva Direta</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking.com</option>
                    <option value="vrbo">Vrbo</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <Input
                  label="Nº de Hóspedes *"
                  type="number"
                  min={1}
                  max={100}
                  value={form.guests_count}
                  onChange={(e) => setForm({ ...form, guests_count: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Valor Total (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Calculado pela diária se vazio"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                />
                <Input
                  label="Taxa da Plataforma (R$)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.platform_fee}
                  onChange={(e) => setForm({ ...form, platform_fee: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" isLoading={isSaving}>
                  Confirmar Reserva
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
