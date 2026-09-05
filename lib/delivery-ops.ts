import { Project } from '@/types/project';
import { toDate } from '@/lib/firestore-schema';

export const CLIENT_SILENCE_BUSINESS_DAYS = 5;

export const SILENCE_PAUSE_REASON = `Auto-paused after ${CLIENT_SILENCE_BUSINESS_DAYS} business days of client silence`;

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Count business days strictly after `from` up to and including `to` (SA weekdays Mon–Fri). */
export function businessDaysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (end <= start) return 0;
  let count = 0;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor <= end) {
    if (!isWeekend(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function silenceBusinessDays(project: Project, now = new Date()): number | null {
  const since = toDate(project.waitingOnClientSince);
  if (!since) return null;
  return businessDaysBetween(since, now);
}

export function shouldAutoPauseForSilence(project: Project, now = new Date()): boolean {
  const status = (project.status ?? '').toLowerCase();
  if (status === 'completed' || status.includes('hold') || status === 'paused') return false;
  const days = silenceBusinessDays(project, now);
  return days !== null && days >= CLIENT_SILENCE_BUSINESS_DAYS;
}

export function pausePatchForSilence(now = new Date()) {
  return {
    status: 'on-hold',
    pausedAt: now,
    pauseReason: SILENCE_PAUSE_REASON,
  };
}

/** Alias used by Overview / Command Centre pause writes. */
export function silencePausePatch(now = new Date()) {
  return pausePatchForSilence(now);
}

export function evaluateClientSilence(project: Project, now = new Date()) {
  const waitingSince = toDate(project.waitingOnClientSince);
  if (!waitingSince) return null;
  const silentBusinessDays = businessDaysBetween(waitingSince, now);
  return {
    waitingSince,
    silentBusinessDays,
    shouldPause: shouldAutoPauseForSilence(project, now),
  };
}

export interface SilencePauseEval {
  project: Project;
  silentBusinessDays: number;
  shouldPause: boolean;
  alert: string;
}

/** Projects that are waiting on the client (for CC alerts / auto-pause). */
export function projectsDueSilencePause(projects: Project[], now = new Date()): SilencePauseEval[] {
  return projects
    .map((project) => {
      const silence = evaluateClientSilence(project, now);
      if (!silence) return null;
      return {
        project,
        silentBusinessDays: silence.silentBusinessDays,
        shouldPause: silence.shouldPause,
        alert:
          silence.shouldPause || silence.silentBusinessDays >= CLIENT_SILENCE_BUSINESS_DAYS
            ? `${project.clientName || project.projectType}: silence pause due (${silence.silentBusinessDays} biz days)`
            : `${project.clientName || project.projectType}: waiting on client (${silence.silentBusinessDays} biz days)`,
      } satisfies SilencePauseEval;
    })
    .filter((item): item is SilencePauseEval => Boolean(item));
}
