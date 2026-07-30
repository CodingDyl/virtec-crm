'use client'

import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFollowUps } from '@/contexts/DataContexts';
import { effectiveDueDate, getFollowUpDisplayMeta } from '@/lib/follow-ups';
import { formatRand } from '@/lib/maintenance';
import { FollowUp } from '@/types/follow-up';
import { CheckCircle2, Clipboard, Clock3, Loader2, Mail, XCircle } from 'lucide-react';

interface FollowUpItemProps {
  followUp: FollowUp;
}

export function FollowUpItem({ followUp }: FollowUpItemProps) {
  const { markFollowUpSent, dismissFollowUp, snoozeFollowUp } = useFollowUps();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const meta = getFollowUpDisplayMeta(followUp.type);
  const dueDate = effectiveDueDate(followUp);
  const canEmail = Boolean(followUp.customerEmail);
  const isDone = followUp.status === 'sent' || followUp.status === 'dismissed';

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    setBusyAction(key);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      console.error(`follow-up action failed: ${key}`, error);
      toast.error('Follow-up action failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const sendEmail = async () => {
    await runAction('email', async () => {
      const response = await fetch('/api/follow-ups/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpId: followUp.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Email failed');
    }, 'Follow-up email sent.');
  };

  const copyMessage = async () => {
    await runAction('copy', async () => {
      await navigator.clipboard.writeText(followUp.suggestedMessage);
    }, 'Message copied.');
  };

  const actionDisabled = Boolean(busyAction);

  return (
    <Card className="border-spaceAccent/25 bg-space1/65">
      <CardContent className="p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${meta.tone} text-white`}>{meta.label}</Badge>
              <Badge variant="outline" className="border-spaceAccent/40 text-spaceAlt">
                {followUp.status}
              </Badge>
              <span className="text-xs text-spaceAlt/75">
                {dueDate ? `${format(dueDate, 'dd MMM yyyy')} · ${formatDistanceToNow(dueDate, { addSuffix: true })}` : 'No due date'}
              </span>
            </div>

            <div>
              <h3 className="truncate text-base font-semibold text-spaceText">{followUp.customerName}</h3>
              <p className="text-sm text-spaceAlt/85">
                {[followUp.companyName, followUp.projectName].filter(Boolean).join(' · ') || 'No linked company or project'}
              </p>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-spaceAlt/60">Reason</dt>
                <dd className="mt-0.5 text-spaceText">{followUp.reason}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-spaceAlt/60">Channel</dt>
                <dd className="mt-0.5 text-spaceText">{canEmail ? 'Email' : meta.channel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-spaceAlt/60">Amount at risk</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-spaceText">
                  {typeof followUp.amount === 'number' && followUp.amount > 0 ? formatRand(followUp.amount) : '—'}
                </dd>
              </div>
            </dl>

            <div className="rounded-lg border border-spaceAccent/20 bg-space2/45 p-3">
              {followUp.suggestedSubject && (
                <p className="mb-1 text-xs font-semibold text-spaceAlt">Subject: {followUp.suggestedSubject}</p>
              )}
              <p className="text-sm leading-6 text-spaceText">{followUp.suggestedMessage}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2 xl:w-64 xl:justify-end">
            {!isDone && canEmail && (
              <Button size="sm" onClick={sendEmail} disabled={actionDisabled}>
                {busyAction === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send email
              </Button>
            )}
            {!isDone && (
              <>
                <Button size="sm" variant="outline" onClick={copyMessage} disabled={actionDisabled}>
                  {busyAction === 'copy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />}
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction('done', () => markFollowUpSent(followUp.id), 'Follow-up marked done.')}
                  disabled={actionDisabled}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction('dismiss', () => dismissFollowUp(followUp.id), 'Follow-up dismissed.')}
                  disabled={actionDisabled}
                  className="border-red-500/40 text-red-300 hover:bg-red-500/15"
                >
                  <XCircle className="h-4 w-4" />
                  Dismiss
                </Button>
                {[1, 3, 7].map((days) => (
                  <Button
                    key={days}
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(`snooze-${days}`, () => snoozeFollowUp(followUp.id, days as 1 | 3 | 7), `Snoozed for ${days} day${days === 1 ? '' : 's'}.`)}
                    disabled={actionDisabled}
                  >
                    <Clock3 className="h-4 w-4" />
                    {days}d
                  </Button>
                ))}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
