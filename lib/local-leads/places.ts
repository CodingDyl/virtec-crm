export const DEFAULT_SANDTON = {
  lat: -26.1076,
  lng: 28.0567,
  radiusMeters: 4000,
} as const;

export const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.rating',
  'places.userRatingCount',
].join(',');

export type PlacesSearchNearbyOpts = {
  lat: number;
  lng: number;
  radiusMeters: number;
  includedType: string;
  apiKey: string;
};

export type PlacesNearbyPlace = {
  googlePlaceId: string;
  name: string;
  phone?: string | null;
  websiteUrl?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  primaryType?: string | null;
  types?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  googleMapsUri?: string | null;
  raw: Record<string, unknown>;
};

export class PlacesApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Places API error ${status}: ${body.slice(0, 400)}`);
    this.name = 'PlacesApiError';
    this.status = status;
    this.body = body;
  }
}

function parsePlaceId(id?: string | null): string | null {
  if (!id) return null;
  // Places API (New) returns "places/XXXX"
  if (id.startsWith('places/')) return id.slice('places/'.length);
  return id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchNearby(
  opts: PlacesSearchNearbyOpts
): Promise<PlacesNearbyPlace[]> {
  const { lat, lng, radiusMeters, includedType, apiKey } = opts;

  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: [includedType],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new PlacesApiError(response.status, body);
  }

  const data = (await response.json()) as { places?: any[] };
  const places = Array.isArray(data.places) ? data.places : [];

  return places
    .map((place): PlacesNearbyPlace | null => {
      const googlePlaceId = parsePlaceId(place?.id ?? place?.name);
      if (!googlePlaceId) return null;

      const displayName =
        typeof place?.displayName === 'string'
          ? place.displayName
          : place?.displayName?.text ?? '';

      const phone =
        place?.nationalPhoneNumber ??
        place?.internationalPhoneNumber ??
        null;

      return {
        googlePlaceId,
        name: displayName || 'Unknown',
        phone,
        websiteUrl: place?.websiteUri ?? null,
        address: place?.formattedAddress ?? null,
        lat: place?.location?.latitude ?? null,
        lng: place?.location?.longitude ?? null,
        primaryType: place?.primaryType ?? null,
        types: Array.isArray(place?.types) ? place.types : undefined,
        rating: typeof place?.rating === 'number' ? place.rating : null,
        reviewCount:
          typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
        businessStatus: place?.businessStatus ?? null,
        googleMapsUri: place?.googleMapsUri ?? null,
        raw: {
          id: place?.id,
          displayName: place?.displayName,
          formattedAddress: place?.formattedAddress,
          location: place?.location,
          types: place?.types,
          primaryType: place?.primaryType,
          nationalPhoneNumber: place?.nationalPhoneNumber,
          internationalPhoneNumber: place?.internationalPhoneNumber,
          websiteUri: place?.websiteUri,
          googleMapsUri: place?.googleMapsUri,
          businessStatus: place?.businessStatus,
          rating: place?.rating,
          userRatingCount: place?.userRatingCount,
        },
      };
    })
    .filter((p): p is PlacesNearbyPlace => p !== null);
}

/** Rate-limit helper: 250ms between Places requests. */
export async function rateLimitPause(): Promise<void> {
  await sleep(250);
}
