import api from './api';

export type ReservationSource = 'direct' | 'airbnb' | 'booking' | 'vrbo' | 'other';
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

export interface ReservationItem {
  id: string;
  property_id: string;
  property_name: string;
  guest_id: string;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  source: ReservationSource;
  external_reference?: string | null;
  status: ReservationStatus;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guests_count: number;
  total_amount: string | number;
  platform_fee: string | number;
  net_amount: string | number;
  notes?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
}

export interface ReservationCreatePayload {
  property_id: string;
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;
  source: ReservationSource;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  total_amount?: number;
  platform_fee?: number;
  notes?: string;
}

export const bookingService = {
  async listReservations(params?: { property_id?: string; status?: string }): Promise<ReservationItem[]> {
    const response = await api.get<ReservationItem[]>('/bookings', { params });
    return response.data;
  },

  async createReservation(payload: ReservationCreatePayload): Promise<ReservationItem> {
    const response = await api.post<ReservationItem>('/bookings', payload);
    return response.data;
  },

  async updateStatus(
    reservationId: string,
    status: ReservationStatus,
    cancellation_reason?: string
  ): Promise<ReservationItem> {
    const response = await api.patch<ReservationItem>(`/bookings/${reservationId}/status`, {
      status,
      cancellation_reason,
    });
    return response.data;
  },

  async anonymizeGuest(guestId: string): Promise<void> {
    await api.post(`/bookings/guests/${guestId}/anonymize`);
  },
};
