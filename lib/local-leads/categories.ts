import type { LocalLeadTrack } from '@/types/local-lead';

export type ScanCategory = {
  track: LocalLeadTrack;
  category: string;
  includedTypes: string[];
};

/**
 * Virtara / Jurivo category → Places (New) includedTypes.
 * Trades are split across multiple types so each searchNearby job stays focused.
 */
export const SCAN_CATEGORIES: ScanCategory[] = [
  // Virtara
  { track: 'virtara', category: 'cafe', includedTypes: ['cafe'] },
  { track: 'virtara', category: 'restaurant', includedTypes: ['restaurant'] },
  { track: 'virtara', category: 'gym', includedTypes: ['gym'] },
  { track: 'virtara', category: 'salon', includedTypes: ['beauty_salon', 'hair_care'] },
  {
    track: 'virtara',
    category: 'dental/aesthetics',
    includedTypes: ['dentist', 'beauty_salon'],
  },
  {
    track: 'virtara',
    category: 'boutique retail',
    includedTypes: ['clothing_store', 'store'],
  },
  { track: 'virtara', category: 'trades', includedTypes: ['plumber'] },
  { track: 'virtara', category: 'trades', includedTypes: ['electrician'] },
  { track: 'virtara', category: 'trades', includedTypes: ['painter'] },
  { track: 'virtara', category: 'trades', includedTypes: ['roofing_contractor'] },
  { track: 'virtara', category: 'estate agents', includedTypes: ['real_estate_agency'] },
  { track: 'virtara', category: 'auto', includedTypes: ['car_repair', 'car_dealer'] },
  { track: 'virtara', category: 'photo studios', includedTypes: ['photographer'] },

  // Jurivo — all lawyer Places type; category label distinguishes desk use
  { track: 'jurivo', category: 'attorneys', includedTypes: ['lawyer'] },
  { track: 'jurivo', category: 'conveyancers', includedTypes: ['lawyer'] },
  { track: 'jurivo', category: 'labour law', includedTypes: ['lawyer'] },
  { track: 'jurivo', category: 'notaries', includedTypes: ['lawyer'] },
];
