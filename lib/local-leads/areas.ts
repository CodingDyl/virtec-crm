/**
 * Where a scan can be pointed.
 *
 * Named presets, not free text: turning "Johannesburg" into coordinates
 * would be another paid Google call, and a typo would spend a scan on the
 * wrong place. Centres are approximate; each scan covers a circle of
 * `radiusMeters` around it, which is what Places' nearby search takes.
 */
export interface ScanArea {
  key: string;
  label: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export const SCAN_AREAS: readonly ScanArea[] = [
  { key: 'sandton', label: 'Sandton', lat: -26.1076, lng: 28.0567, radiusMeters: 4000 },
  { key: 'rosebank', label: 'Rosebank', lat: -26.1467, lng: 28.0436, radiusMeters: 3000 },
  { key: 'bryanston', label: 'Bryanston', lat: -26.0575, lng: 28.0211, radiusMeters: 3500 },
  { key: 'randburg', label: 'Randburg', lat: -26.0944, lng: 28.0064, radiusMeters: 3500 },
  { key: 'fourways', label: 'Fourways', lat: -26.0167, lng: 28.0083, radiusMeters: 3500 },
  { key: 'melville', label: 'Melville', lat: -26.177, lng: 28.0071, radiusMeters: 2500 },
  { key: 'johannesburg-cbd', label: 'Johannesburg CBD', lat: -26.2041, lng: 28.0473, radiusMeters: 3000 },
  { key: 'midrand', label: 'Midrand', lat: -25.995, lng: 28.128, radiusMeters: 4000 },
  { key: 'centurion', label: 'Centurion', lat: -25.8603, lng: 28.1894, radiusMeters: 4000 },
  { key: 'pretoria-cbd', label: 'Pretoria CBD', lat: -25.7479, lng: 28.1879, radiusMeters: 3000 },
  { key: 'cape-town-cbd', label: 'Cape Town CBD', lat: -33.9249, lng: 18.4241, radiusMeters: 3000 },
  { key: 'sea-point', label: 'Sea Point', lat: -33.917, lng: 18.386, radiusMeters: 2500 },
  { key: 'umhlanga', label: 'Umhlanga', lat: -29.7266, lng: 31.0847, radiusMeters: 3500 },
];

export function findScanArea(key: unknown): ScanArea | undefined {
  return typeof key === 'string' ? SCAN_AREAS.find((area) => area.key === key) : undefined;
}
