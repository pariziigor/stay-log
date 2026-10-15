import { api } from './api';
import {
  Amenity,
  Property,
  PropertyCreateData,
  PropertyListResponse,
  PropertyStatus,
  PropertyType,
  PropertyUpdateData,
} from '../types/property';

export interface PropertyFilterParams {
  owner_id?: string;
  status?: PropertyStatus;
  property_type?: PropertyType;
  city?: string;
  state?: string;
  min_guests?: number;
  page?: number;
  page_size?: number;
}

export const propertyService = {
  async listProperties(params?: PropertyFilterParams): Promise<PropertyListResponse> {
    const response = await api.get<PropertyListResponse>('/properties', { params });
    return response.data;
  },

  async getProperty(id: string): Promise<Property> {
    const response = await api.get<Property>(`/properties/${id}`);
    return response.data;
  },

  async createProperty(data: PropertyCreateData): Promise<Property> {
    const response = await api.post<Property>('/properties', data);
    return response.data;
  },

  async updateProperty(id: string, data: Partial<PropertyCreateData>): Promise<Property> {
    const response = await api.put<Property>(`/properties/${id}`, data);
    return response.data;
  },

  async deleteProperty(id: string): Promise<void> {
    await api.delete(`/properties/${id}`);
  },

  async listAmenities(): Promise<Amenity[]> {
    const response = await api.get<Amenity[]>('/properties/catalog/amenities');
    return response.data;
  },
};
