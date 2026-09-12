'use client'

import { Project } from '@/types/project';
import {
  CLIENT_SILENCE_BUSINESS_DAYS,
  shouldAutoPauseForSilence,
  silenceBusinessDays,
} from '@/lib/delivery-ops';

interface HealthBadgesProps {
  project: Project;
  pendingQuotes: number;
}

/** Surfaces at-a-glance health signals for a project. */
export function HealthBadges({ project, pendingQuotes }: HealthBadgesProps) {
  const badges: { label: string; cls: string }[] = [];
  const agreement = project.agreementStatus ?? (project.agreementUrl ? 'signed' : 'pending');
  const silenceDays = silenceBusinessDays(project);

  if (agreement === 'pending' || agreement === 'declined') {
    badges.push({ label: `Agreement ${agreement}`, cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40' });
  }
  if (pendingQuotes > 0) {
    badges.push({ label: `${pendingQuotes} pending quote${pendingQuotes > 1 ? 's' : ''}`, cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' });
  }

  const silencePauseDue =
    (silenceDays != null && silenceDays >= CLIENT_SILENCE_BUSINESS_DAYS) ||
    shouldAutoPauseForSilence(project);

  if (silencePauseDue) {
    const n = silenceDays ?? CLIENT_SILENCE_BUSINESS_DAYS;
    badges.push({
      label: `Silence pause (${n} biz days)`,
      cls: 'bg-red-500/15 text-red-300 border-red-500/40',
    });
  } else if (silenceDays != null) {
    badges.push({
      label: `${silenceDays}/${CLIENT_SILENCE_BUSINESS_DAYS} biz days waiting`,
      cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    });
  }

  if (project.status === 'on-hold') {
    const reason = (project.pauseReason || '').trim();
    const label = reason
      ? `On hold — ${reason.length > 40 ? `${reason.slice(0, 40)}…` : reason}`
      : 'On hold';
    badges.push({ label, cls: 'bg-gray-500/15 text-gray-300 border-gray-500/40' });
  }
  if (project.status !== 'completed' && (project.completion ?? 0) === 0) {
    badges.push({ label: 'Not started', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40' });
  }
  if (badges.length === 0) {
    badges.push({ label: 'On track', cls: 'bg-green-500/15 text-green-300 border-green-500/40' });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b, i) => (
        <span key={i} className={`rounded-full border px-2 py-0.5 text-xs ${b.cls}`}>{b.label}</span>
      ))}
    </div>
  );
}
