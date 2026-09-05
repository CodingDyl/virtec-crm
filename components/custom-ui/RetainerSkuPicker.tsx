'use client'

import {
  SITE_KINDS,
  SERVICE_LINE_OPTIONS,
  RETAINER_MATRIX,
  SiteKind,
  ServiceLineId,
  applyCareShortcut,
  computeRetainerMonthly,
  formatZarAmount,
  toggleLine,
  isCareSelection,
  isBundleSelection,
} from '@/lib/service-skus'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export interface RetainerSkuPickerProps {
  siteKind: SiteKind
  lines: ServiceLineId[]
  onSiteKindChange: (kind: SiteKind) => void
  onLinesChange: (lines: ServiceLineId[]) => void
  className?: string
}

/** Site kind + stackable Hosting/Maintenance/SEO checkboxes with Care/Bundle shortcuts. */
export function RetainerSkuPicker({
  siteKind,
  lines,
  onSiteKindChange,
  onLinesChange,
  className,
}: RetainerSkuPickerProps) {
  const matrix = RETAINER_MATRIX[siteKind]
  const total = computeRetainerMonthly(siteKind, lines)
  const prices: Record<ServiceLineId, number> = {
    hosting: matrix.hosting,
    maintenance: matrix.maintenance,
    seo: matrix.seo,
  }

  return (
    <div className={className ?? 'space-y-3'}>
      <div>
        <Label htmlFor="site-kind">Site kind</Label>
        <select
          id="site-kind"
          value={siteKind}
          onChange={(e) => onSiteKindChange(e.target.value as SiteKind)}
          className="mt-1 flex h-10 w-full rounded-md border border-spaceAccent bg-space1 px-3 py-2 text-spaceText focus:outline-hidden focus:ring-2 focus:ring-spaceAccent"
        >
          {SITE_KINDS.map((k) => (
            <option key={k.id} value={k.id}>{k.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-spaceText">Service lines</p>
        {SERVICE_LINE_OPTIONS.map((opt) => {
          const checked = lines.includes(opt.id)
          return (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-spaceAccent/25 bg-space1/50 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 text-spaceText">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onLinesChange(toggleLine(lines, opt.id, e.target.checked))}
                  className="h-4 w-4 accent-spaceAccent"
                />
                {opt.label}
              </span>
              <span className="tabular-nums text-spaceAlt/90">{formatZarAmount(prices[opt.id])}/mo</span>
            </label>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`border-spaceAccent/40 ${isCareSelection(lines) && !lines.includes('seo') ? 'bg-spaceAccent/20 text-spaceAccent' : 'bg-space2 text-spaceText'}`}
          onClick={() => onLinesChange(applyCareShortcut(false))}
        >
          Care — {formatZarAmount(matrix.care)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`border-spaceAccent/40 ${isBundleSelection(lines) ? 'bg-spaceAccent/20 text-spaceAccent' : 'bg-space2 text-spaceText'}`}
          onClick={() => onLinesChange(applyCareShortcut(true))}
        >
          Bundle — {formatZarAmount(matrix.bundle)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-spaceAccent/40 bg-space2 text-spaceText"
          onClick={() => onLinesChange([])}
        >
          Clear
        </Button>
      </div>

      <p className="text-sm text-spaceAlt/80">
        Live total:{' '}
        <span className="font-semibold tabular-nums text-spaceAccent">{formatZarAmount(total)}</span>
        /mo
        {isBundleSelection(lines) && ' (Bundle package)'}
        {isCareSelection(lines) && !lines.includes('seo') && ' (Care package)'}
      </p>
    </div>
  )
}
