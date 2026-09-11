'use client';

import { useState } from 'react';
import LocalLeadsSection from './LocalLeadsSection';
import QualifiedDeskSection from './QualifiedDeskSection';

type SubTab = 'pipeline' | 'qualified';

export default function LocalLeadsPage() {
  const [subTab, setSubTab] = useState<SubTab>('pipeline');

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="virtara-display text-2xl text-spaceText">Local leads</h2>
          <p className="mt-1 text-sm text-spaceAlt/85">
            Pipeline scan → qualify → owner email → outreach drafts. No live sends (Attach HOLD).
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-spaceAccent/25 bg-space1/50 p-1">
          <button
            type="button"
            onClick={() => setSubTab('pipeline')}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              subTab === 'pipeline'
                ? 'bg-spaceAccent/25 text-spaceAccent'
                : 'text-spaceAlt/70 hover:text-spaceText'
            }`}
          >
            Pipeline
          </button>
          <button
            type="button"
            onClick={() => setSubTab('qualified')}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              subTab === 'qualified'
                ? 'bg-spaceAccent/25 text-spaceAccent'
                : 'text-spaceAlt/70 hover:text-spaceText'
            }`}
          >
            Qualified
          </button>
        </div>
      </div>

      {subTab === 'pipeline' ? (
        <LocalLeadsSection embedded />
      ) : (
        <QualifiedDeskSection embedded />
      )}
    </section>
  );
}
