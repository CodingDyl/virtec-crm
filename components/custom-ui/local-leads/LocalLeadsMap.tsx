'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map, Marker, Popup, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocalLead } from '@/types/local-lead';

const SANDTON: [number, number] = [28.0567, -26.1076];
const DEFAULT_ZOOM = 12;

/**
 * Inline raster styles (CARTO CDN PNG tiles).
 * Remote vector styles (Carto GL `stops`, OpenFreeMap) left the canvas black
 * and/or never fired `load` under MapLibre v6 + Next — pins never mounted.
 * Raster tiles are simple PNGs: style loads reliably, no vector paint path.
 */
function rasterBasemap(theme: 'dark' | 'light'): StyleSpecification {
  const layer = theme === 'dark' ? 'dark_all' : 'light_all';
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/${layer}/{z}/{x}/{y}@2x.png`,
          `https://b.basemaps.cartocdn.com/${layer}/{z}/{x}/{y}@2x.png`,
          `https://c.basemaps.cartocdn.com/${layer}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'carto',
        type: 'raster',
        source: 'carto',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
}

const WEBSITE_SIGNAL_LABEL: Record<LocalLead['websiteSignal'], string> = {
  none: 'None',
  facebook_only: 'Facebook only',
  weak: 'Weak',
  ok: 'OK',
  unknown: 'Unknown',
};

function scoreColor(score: number): string {
  if (score >= 70) return '#34d399'; // hot
  if (score >= 40) return '#fbbf24'; // warm
  return '#94a3b8'; // cold
}

function hasFiniteCoords(lead: LocalLead): lead is LocalLead & { lat: number; lng: number } {
  return Number.isFinite(lead.lat) && Number.isFinite(lead.lng);
}

type LocalLeadsMapProps = {
  leads: LocalLead[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
};

export default function LocalLeadsMap({
  leads,
  selectedLeadId,
  onSelectLead,
}: LocalLeadsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const basemapReadyRef = useRef(false);
  const skipNextBasemapEffect = useRef(true);
  const [basemap, setBasemap] = useState<'dark' | 'light'>('dark');
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelectLead);
  onSelectRef.current = onSelectLead;

  const plottable = useMemo(() => leads.filter(hasFiniteCoords), [leads]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: rasterBasemap('dark'),
      center: SANDTON,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const markReady = () => {
      basemapReadyRef.current = true;
      setStyleEpoch((n) => n + 1);
      // Layout can settle after first paint (tabs / flex).
      requestAnimationFrame(() => map.resize());
    };

    map.once('load', markReady);
    map.on('error', (event) => {
      const message =
        (event as { error?: { message?: string } }).error?.message ??
        'Map failed to load basemap tiles';
      setMapError(message);
    });

    mapRef.current = map;

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.resize();
          })
        : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);

    return () => {
      ro?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      basemapReadyRef.current = false;
    };
  }, []);

  // Dark / Light toggle — skip the initial mount (constructor already has dark).
  useEffect(() => {
    if (skipNextBasemapEffect.current) {
      skipNextBasemapEffect.current = false;
      return;
    }

    const map = mapRef.current;
    if (!map || !basemapReadyRef.current) return;

    setMapError(null);
    const onReady = () => {
      setStyleEpoch((n) => n + 1);
      map.resize();
    };

    map.once('idle', onReady);
    map.setStyle(rasterBasemap(basemap));

    return () => {
      map.off('idle', onReady);
    };
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleEpoch === 0) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupRef.current?.remove();
    popupRef.current = null;

    for (const lead of plottable) {
      const id = lead.id ?? lead.googlePlaceId;
      const selected = selectedLeadId === id;
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', lead.name);
      el.style.width = selected ? '16px' : '12px';
      el.style.height = selected ? '16px' : '12px';
      el.style.borderRadius = '9999px';
      el.style.border = selected ? '2px solid #edf4ff' : '1px solid rgba(5,9,16,0.7)';
      el.style.background = scoreColor(lead.score);
      el.style.boxShadow = selected
        ? '0 0 0 3px rgba(141,246,255,0.55)'
        : '0 1px 4px rgba(0,0,0,0.45)';
      el.style.cursor = 'pointer';
      el.style.padding = '0';
      el.style.zIndex = '1';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lead.lng, lead.lat])
        .addTo(map);

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelectRef.current(id);

        const html = `
          <div style="font:12px/1.4 system-ui,sans-serif;color:#0f172a;min-width:140px">
            <div style="font-weight:600;margin-bottom:4px">${escapeHtml(lead.name)}</div>
            <div>${escapeHtml(lead.category || '—')}</div>
            <div>Score: <strong>${lead.score}</strong></div>
            <div>Website: ${escapeHtml(WEBSITE_SIGNAL_LABEL[lead.websiteSignal] ?? lead.websiteSignal)}</div>
          </div>
        `;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          offset: 12,
          maxWidth: '240px',
        })
          .setLngLat([lead.lng, lead.lat])
          .setHTML(html)
          .addTo(map);
      });

      markersRef.current.push(marker);
    }
  }, [plottable, selectedLeadId, styleEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLeadId) return;
    const lead = plottable.find((l) => (l.id ?? l.googlePlaceId) === selectedLeadId);
    if (!lead) return;
    map.easeTo({ center: [lead.lng, lead.lat], duration: 450 });
  }, [selectedLeadId, plottable]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-spaceAccent/25 bg-space1/55">
      <div className="flex items-center justify-between gap-2 border-b border-spaceAccent/20 px-3 py-2">
        <p className="text-xs text-spaceAlt/80">
          Map · {plottable.length} pinned · Sandton default
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBasemap('dark')}
            className={`rounded-md px-2 py-1 text-[11px] ${
              basemap === 'dark'
                ? 'bg-spaceAccent/20 text-spaceAccent'
                : 'text-spaceAlt/70 hover:text-spaceText'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setBasemap('light')}
            className={`rounded-md px-2 py-1 text-[11px] ${
              basemap === 'light'
                ? 'bg-spaceAccent/20 text-spaceAccent'
                : 'text-spaceAlt/70 hover:text-spaceText'
            }`}
          >
            Light
          </button>
        </div>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-[320px] w-full md:h-[380px]" />
        {mapError ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto max-w-[90%] rounded-md bg-black/70 px-3 py-2 text-center text-[11px] text-amber-200">
            Map tiles failed: {mapError}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-spaceAccent/20 px-3 py-2 text-[11px] text-spaceAlt/75">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" /> Hot
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Warm
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" /> Cold
        </span>
        <span className="text-spaceAlt/55">CARTO raster / OSM · no Google Maps JS</span>
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
