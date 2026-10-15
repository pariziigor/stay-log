export type PropertyType =
  | 'apartment'
  | 'house'
  | 'studio'
  | 'room'
  | 'chalet'
  | 'farm'
  | 'other';

export type PropertyStatus = 'active' | 'inactive' | 'under_maintenance';

export interface Address {
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  postal_code?: string;
  country: string;
}

export interface Amenity {
  id: number;
  code: string;
  name: string;
  category: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  property_type: PropertyType;
  status: PropertyStatus;
  address: Address;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  area_m2?: number | null;
  base_nightly_rate?: number | null;
  cleaning_fee: number;
  check_in_time: string;
  check_out_time: string;
  amenities: Amenity[];
  created_at: string;
  updated_at: string;
}

export interface PropertyCreateData {
  name: string;
  description?: string;
  property_type: PropertyType;
  address: Address;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  area_m2?: number;
  base_nightly_rate?: number;
  cleaning_fee: number;
  check_in_time: string;
  check_out_time: string;
  amenity_ids: number[];
}

export type PropertyUpdateData = Partial<PropertyCreateData>;

export interface PropertyListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Property[];
}
