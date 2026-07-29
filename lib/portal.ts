import 'server-only';
import { FieldValue, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { pickNumber, pickValue, toDate } from '@/lib/firestore-schema';
import { signedReadUrl } from '@/lib/storage-server';

/**
 * The client-facing portal.
 *
 * Everything here runs on the server through the Admin SDK. Firestore rules
 * deny all browser access outside the operator allowlist, so a visitor holding
 * a share link never gets a database handle — they get exactly the slice this
 * module assembles, and nothing else.
 */

export { generatePortalToken } from '@/lib/portal-token';

export interface PortalTask {
  id: string;
  title: string;
  done: boolean;
}

export interface PortalQuote {
  id: string;
  reference: string;
  totalAmount: number;
  status: 'pending' | 'accepted' | 'rejected';
  features: string[];
  createdAt: string | null;
  pdfUrl: string;
}

export interface PortalDocument {
  id: string;
  name: string;
  type: string;
  fileUrl: string;
  uploadedAt: string | null;
}

export interface PortalData {
  projectId: string;
  projectType: string;
  clientName: string;
  status: string;
  completion: number;
  agreementStatus: string | null;
  startedAt: string | null;
  tasks: PortalTask[];
  quotes: PortalQuote[];
  documents: PortalDocument[];
}

type Snap = QueryDocumentSnapshot;

async function findByField(
  db: Firestore,
  collection: string,
  field: string,
  value: string
): Promise<Snap[]> {
  const snap = await db.collection(collection).where(field, '==', value).get();
  return snap.docs;
}

/** Resolve a share token to its project, or null when the link is dead or switched off. */
async function findProjectByToken(db: Firestore, token: string) {
  // A short token is never one we issued; refuse before touching the database.
  if (!token || token.length < 32) return null;

  const snap = await db.collection('projects').where('portalToken', '==', token).limit(1).get();
  const match = snap.docs[0];
  if (!match) return null;

  // A revoked link resolves to nothing, exactly like a token that never existed.
  if (match.data().portalEnabled === false) return null;

  return match;
}

const iso = (value: any): string | null => toDate(value)?.toISOString() ?? null;

/**
 * Assemble everything the client is allowed to see. Deliberately narrow:
 * no internal design notes, no costs or margins, no other clients.
 */
export async function fetchPortalData(
  token: string,
  { recordView = true }: { recordView?: boolean } = {}
): Promise<PortalData | null> {
  const db = getAdminDb();
  const project = await findProjectByToken(db, token);
  if (!project) return null;

  // "Last opened" should mean the client opened it, so previews don't count.
  if (recordView) {
    project.ref
      .update({ portalLastViewedAt: FieldValue.serverTimestamp() })
      .catch((error) => console.error('portal view stamp failed', error));
  }

  const [taskDocs, quoteDocsA, quoteDocsB, documentDocs] = await Promise.all([
    findByField(db, 'project_tasks', 'projectId', project.id),
    findByField(db, 'quotes', 'projectId', project.id),
    findByField(db, 'quotes', 'project_id', project.id),
    findByField(db, 'documents', 'linkedId', project.id),
  ]);

  const tasks: PortalTask[] = taskDocs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title ?? 'Untitled',
        done: data.done === true,
        order: pickNumber(data, ['order'], 0),
        createdAt: toDate(data.createdAt)?.getTime() ?? 0,
      };
    })
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
    .map(({ id, title, done }) => ({ id, title, done }));

  // Both key spellings exist in this data; dedupe by document id.
  const quoteDocs = new Map([...quoteDocsA, ...quoteDocsB].map((d) => [d.id, d]));

  // Signed here rather than on the page: the client has no session, so a bare
  // bucket path would be useless to them and a permanent URL would outlive the
  // share link. These expire on their own.
  const quotes: PortalQuote[] = (
    await Promise.all(
      [...quoteDocs.values()].map(async (d) => {
        const data = d.data();
        const ref = pickValue<string>(data, ['pdfPath', 'pdfUrl', 'pdf_url'], '');
        return {
          id: d.id,
          reference: `Q-${d.id.slice(0, 6).toUpperCase()}`,
          totalAmount: pickNumber(data, ['totalAmount', 'total_amount'], 0),
          status: (data.status ?? 'pending') as PortalQuote['status'],
          features: Array.isArray(data.features) ? data.features : [],
          createdAt: iso(data.createdAt ?? data.created_at),
          pdfUrl: ref ? (await signedReadUrl(ref)) ?? '' : '',
        };
      })
    )
  ).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const documents: PortalDocument[] = (
    await Promise.all(
      documentDocs.map(async (d) => {
        const data = d.data();
        const ref = pickValue<string>(data, ['storagePath', 'fileUrl'], '');
        return {
          id: d.id,
          name: data.name ?? 'Document',
          type: data.type ?? 'other',
          fileUrl: ref ? (await signedReadUrl(ref)) ?? '' : '',
          uploadedAt: iso(data.uploadedAt),
        };
      })
    )
  )
    .filter((d) => d.fileUrl)
    .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));

  const data = project.data();

  return {
    projectId: project.id,
    projectType: data.projectType ?? 'Project',
    clientName: data.clientName ?? '',
    status: data.status ?? 'active',
    completion: pickNumber(data, ['completion'], 0),
    agreementStatus: data.agreementStatus ?? null,
    startedAt: iso(data.createdAt),
    tasks,
    quotes,
    documents,
  };
}

/**
 * Record a client's decision on a quote.
 *
 * The token is the only credential the caller holds, so every constraint is
 * checked here: the token must resolve to an enabled project, the quote must
 * belong to that project, and it must still be undecided.
 */
export async function decidePortalQuote(
  token: string,
  quoteId: string,
  decision: 'accepted' | 'rejected'
): Promise<{ ok: true; totalAmount: number } | { ok: false }> {
  const db = getAdminDb();
  const project = await findProjectByToken(db, token);
  if (!project) return { ok: false };

  const quoteRef = db.collection('quotes').doc(quoteId);
  const quote = await quoteRef.get();
  if (!quote.exists) return { ok: false };

  const data = quote.data() ?? {};
  const owner = data.projectId ?? data.project_id;
  if (owner !== project.id) return { ok: false };
  if ((data.status ?? 'pending') !== 'pending') return { ok: false };

  const totalAmount = pickNumber(data, ['totalAmount', 'total_amount'], 0);

  await quoteRef.update({
    status: decision,
    decidedAt: FieldValue.serverTimestamp(),
    decidedVia: 'portal',
  });

  // Accepting makes the quote the source of truth for the project amount,
  // exactly as the internal Quotes tab does — otherwise job margin goes stale.
  if (decision === 'accepted') {
    await project.ref.update({ amount: totalAmount, quoteId });
  }

  await db.collection('activity').add({
    refType: 'project',
    refId: project.id,
    type: 'quote',
    message:
      decision === 'accepted'
        ? `Client accepted a quote from the portal — project amount synced to R${totalAmount.toLocaleString()}`
        : 'Client declined a quote from the portal',
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, totalAmount };
}
