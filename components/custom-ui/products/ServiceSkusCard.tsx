'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RETAINER_MATRIX, SITE_KINDS, formatZarAmount } from '@/lib/service-skus'

export default function ServiceSkusCard() {
  return (
    <Card className="rounded-lg border-spaceAccent/25 bg-space2/60">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base text-spaceText">Service retainers</CardTitle>
        <CardDescription className="text-spaceAlt/80">
          Locked monthly matrix (2026-09-05). Care = Hosting + Maintenance. Bundle = Care + SEO.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-0 md:grid-cols-2">
        {SITE_KINDS.map((kind) => {
          const m = RETAINER_MATRIX[kind.id]
          return (
            <div key={kind.id} className="rounded-lg border border-spaceAccent/20 bg-space1/50 p-4">
              <p className="text-sm font-semibold text-spaceText">{kind.label}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-spaceAlt/90">
                <li className="flex justify-between gap-3">
                  <span>Hosting</span>
                  <span className="tabular-nums text-spaceText">{formatZarAmount(m.hosting)}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Maintenance</span>
                  <span className="tabular-nums text-spaceText">{formatZarAmount(m.maintenance)}</span>
                </li>
                <li className="flex justify-between gap-3 border-t border-spaceAccent/15 pt-1.5 font-medium text-spaceAccent">
                  <span>Care (shortcut)</span>
                  <span className="tabular-nums">{formatZarAmount(m.care)}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>SEO</span>
                  <span className="tabular-nums text-spaceText">{formatZarAmount(m.seo)}</span>
                </li>
                <li className="flex justify-between gap-3 border-t border-spaceAccent/15 pt-1.5 font-medium text-spaceAccent">
                  <span>Bundle (Care + SEO)</span>
                  <span className="tabular-nums">{formatZarAmount(m.bundle)}</span>
                </li>
              </ul>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
