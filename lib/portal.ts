import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/firebaseConfig';
import { Project } from '@/types/project';
import { BusinessDocument } from '@/types/document';
import { pickNumber, pickValue, toDate } from '@/lib/firestore-schema';

/**
 * The client-facing portal. Everything here runs on the server: a visitor
 * holding a share link never gets a Firestore handle, only the one project
 * slice this module assembles for them.
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

/** Resolve a share token to its project, or null when the link is dead or switched off. */
export async function findProjectByToken(
  token: string
): Promise<{ id: string; data: Project & Record<string, any> } | null> {
  if (!token || token.length < 16) return null;

  const snap = await getDocs(query(collection(db, 'projects'), where('portalToken', '==', token)));
  const match = snap.docs[0];
  if (!match) return null;

  const data = match.data();
  // A revoked link resolves to nothing, exactly like a token that never existed.
  if (data.portalEnabled === false) return null;

  return { id: match.id, data: data as Project & Record<string, any> };
}

const iso = (value: any): string | null => toDate(value)?.toISOString() ?? null;

/**
 * Assemble everything the client is allowed to see. Deliberately narrow:
 * no internal design notes, no margins, no other clients.
 */
export async function fetchPortalData(
  token: string,
  { recordView = true }: { recordView?: boolean } = {}
): Promise<PortalData | null> {
  const project = await findProjectByToken(token);
  if (!project) return null;

  // "Last opened" should mean the client opened it, so previews don't count.
  if (recordView) {
    updateDoc(doc(db, 'projects', project.id), { portalLastViewedAt: serverTimestamp() }).catch(
      (error) => console.error('portal view stamp failed', error)
    );
  }

  const [taskSnap, quoteSnapA, quoteSnapB, docSnap] = await Promise.all([
    getDocs(query(collection(db, 'project_tasks'), where('projectId', '==', project.id))),
    getDocs(query(collection(db, 'quotes'), where('projectId', '==', project.id))),
    getDocs(query(collection(db, 'quotes'), where('project_id', '==', project.id))),
    getDocs(query(collection(db, 'documents'), where('linkedId', '==', project.id))),
  ]);

  const tasks: PortalTask[] = taskSnap.docs
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
  const quoteDocs = new Map([...quoteSnapA.docs, ...quoteSnapB.docs].map((d) => [d.id, d]));
  const quotes: PortalQuote[] = [...quoteDocs.values()]
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        reference: `Q-${d.id.slice(0, 6).toUpperCase()}`,
        totalAmount: pickNumber(data, ['totalAmount', 'total_amount'], 0),
        status: (data.status ?? 'pending') as PortalQuote['status'],
        features: Array.isArray(data.features) ? data.features : [],
        createdAt: iso(data.createdAt ?? data.created_at),
        pdfUrl: pickValue<string>(data, ['pdfUrl', 'pdf_url'], ''),
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const documents: PortalDocument[] = docSnap.docs
    .map((d) => {
      const data = d.data() as BusinessDocument;
      return {
        id: d.id,
        name: data.name ?? 'Document',
        type: data.type ?? 'other',
        fileUrl: data.fileUrl ?? '',
        uploadedAt: iso(data.uploadedAt),
      };
    })
    .filter((d) => d.fileUrl)
    .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));

  return {
    projectId: project.id,
    projectType: project.data.projectType ?? 'Project',
    clientName: project.data.clientName ?? '',
    status: project.data.status ?? 'active',
    completion: pickNumber(project.data, ['completion'], 0),
    agreementStatus: project.data.agreementStatus ?? null,
    startedAt: iso(project.data.createdAt),
    tasks,
    quotes,
    documents,
  };
}

/** Confirm a quote really belongs to the project behind this token before touching it. */
export async function assertQuoteBelongsToToken(
  token: string,
  quoteId: string
): Promise<{ projectId: string; projectType: string; totalAmount: number } | null> {
  const project = await findProjectByToken(token);
  if (!project) return null;

  const quote = await getDoc(doc(db, 'quotes', quoteId));
  if (!quote.exists()) return null;

  const data = quote.data();
  const owner = data.projectId ?? data.project_id;
  if (owner !== project.id) return null;
  // Only an undecided quote can be decided.
  if ((data.status ?? 'pending') !== 'pending') return null;

  return {
    projectId: project.id,
    projectType: project.data.projectType ?? 'Project',
    totalAmount: pickNumber(data, ['totalAmount', 'total_amount'], 0),
  };
}
