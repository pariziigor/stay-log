import { describe, it, expect } from 'vitest';
import { Property } from '../types/property';

describe('Frontend Property Logic & Filtering', () => {
  const sampleProperties: Property[] = [
    {
      id: '1',
      owner_id: 'owner-1',
      name: 'Chalé da Montanha',
      description: 'Vista para a serra',
      property_type: 'chalet',
      status: 'active',
      address: {
        street: 'Rua da Serra',
        city: 'Urubici',
        state: 'SC',
        country: 'BR',
      },
      max_guests: 6,
      bedrooms: 3,
      bathrooms: 2,
      beds: 4,
      base_nightly_rate: 450,
      cleaning_fee: 150,
      check_in_time: '15:00',
      check_out_time: '11:00',
      amenities: [
        { id: 1, code: 'wifi', name: 'Wi-Fi', category: 'conectividade' },
        { id: 3, code: 'fireplace', name: 'Lareira', category: 'conforto' },
      ],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      owner_id: 'owner-1',
      name: 'Studio Beira-Mar',
      description: 'A 50m da praia',
      property_type: 'studio',
      status: 'active',
      address: {
        street: 'Av Atlantica',
        city: 'Balneário Camboriú',
        state: 'SC',
        country: 'BR',
      },
      max_guests: 2,
      bedrooms: 1,
      bathrooms: 1,
      beds: 1,
      base_nightly_rate: 340,
      cleaning_fee: 100,
      check_in_time: '14:00',
      check_out_time: '10:00',
      amenities: [
        { id: 1, code: 'wifi', name: 'Wi-Fi', category: 'conectividade' },
        { id: 2, code: 'pool', name: 'Piscina', category: 'lazer' },
      ],
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
    {
      id: '3',
      owner_id: 'owner-2',
      name: 'Apartamento Centro',
      description: 'Próximo a tudo',
      property_type: 'apartment',
      status: 'under_maintenance',
      address: {
        street: 'Rua Felipe Schmidt',
        city: 'Florianópolis',
        state: 'SC',
        country: 'BR',
      },
      max_guests: 4,
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
      base_nightly_rate: 280,
      cleaning_fee: 90,
      check_in_time: '15:00',
      check_out_time: '11:00',
      amenities: [],
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    },
  ];

  it('filters properties by city (case-insensitive substring match)', () => {
    const filterByCity = (props: Property[], city: string) =>
      props.filter((p) => p.address.city.toLowerCase().includes(city.toLowerCase()));

    expect(filterByCity(sampleProperties, 'urubici')).toHaveLength(1);
    expect(filterByCity(sampleProperties, 'urubici')[0].name).toBe('Chalé da Montanha');
    expect(filterByCity(sampleProperties, 'florianópolis')).toHaveLength(1);
    expect(filterByCity(sampleProperties, 'curitiba')).toHaveLength(0);
  });

  it('filters properties by minimum guest capacity', () => {
    const filterByMinGuests = (props: Property[], minGuests: number) =>
      props.filter((p) => p.max_guests >= minGuests);

    expect(filterByMinGuests(sampleProperties, 5)).toHaveLength(1); // Only Chalé da Montanha (6)
    expect(filterByMinGuests(sampleProperties, 2)).toHaveLength(3); // All
    expect(filterByMinGuests(sampleProperties, 10)).toHaveLength(0);
  });

  it('filters properties by status', () => {
    const active = sampleProperties.filter((p) => p.status === 'active');
    const maintenance = sampleProperties.filter((p) => p.status === 'under_maintenance');

    expect(active).toHaveLength(2);
    expect(maintenance).toHaveLength(1);
    expect(maintenance[0].name).toBe('Apartamento Centro');
  });

  it('calculates total expected booking fee for N nights', () => {
    const calculateBookingTotal = (property: Property, nights: number) => {
      const nightly = property.base_nightly_rate ?? 0;
      const cleaning = property.cleaning_fee ?? 0;
      return nightly * nights + cleaning;
    };

    const chale = sampleProperties[0]; // 450/night, 150 cleaning
    expect(calculateBookingTotal(chale, 3)).toBe(450 * 3 + 150); // 1500

    const studio = sampleProperties[1]; // 340/night, 100 cleaning
    expect(calculateBookingTotal(studio, 2)).toBe(340 * 2 + 100); // 780
  });

  it('formats BRL currency properly', () => {
    const formatBRL = (value: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatted = formatBRL(450);
    // Deve conter R$ e 450,00
    expect(formatted).toContain('450,00');
  });
});
