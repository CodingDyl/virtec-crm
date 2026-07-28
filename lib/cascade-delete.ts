import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/firebase/firebaseConfig';

/**
 * Deleting a customer or a project in this CRM is never a single-document
 * operation — quotes, uploaded files, tasks, design notes, invoices and the
 * activity log all point back at it. These helpers gather everything first so
 * the UI can show the true blast radius, then remove it in one pass.
 */

export interface DeletionImpact {
  projects: number;
  quotes: number;
  documents: number;
  tasks: number;
  designItems: number;
  invoices: number;
  expenses: number;
  activity: number;
  /** Files in Cloud Storage that will be removed along with the records. */
  files: number;
}

const EMPTY_IMPACT: DeletionImpact = {
  projects: 0,
  quotes: 0,
  documents: 0,
  tasks: 0,
  designItems: 0,
  invoices: 0,
  expenses: 0,
  activity: 0,
  files: 0,
};

export function totalRecords(impact: DeletionImpact): number {
  return (
    impact.projects +
    impact.quotes +
    impact.documents +
    impact.tasks +
    impact.designItems +
    impact.invoices +
    impact.expenses +
    impact.activity
  );
}

function mergeImpact(a: DeletionImpact, b: DeletionImpact): DeletionImpact {
  return {
    projects: a.projects + b.projects,
    quotes: a.quotes + b.quotes,
    documents: a.documents + b.documents,
    tasks: a.tasks + b.tasks,
    designItems: a.designItems + b.designItems,
    invoices: a.invoices + b.invoices,
    expenses: a.expenses + b.expenses,
    activity: a.activity + b.activity,
    files: a.files + b.files,
  };
}

type Snap = QueryDocumentSnapshot;

/**
 * Run one or more equality queries against a collection and return the union of
 * their results. Several collections carry both camelCase and legacy snake_case
 * foreign keys, so a single query would silently miss older records.
 */
async function findAll(
  collectionName: string,
  fields: string[],
  value: string
): Promise<Snap[]> {
  const results = new Map<string, Snap>();
  await Promise.all(
    fields.map(async (field) => {
      try {
        const snap = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
        snap.docs.forEach((d) => results.set(d.id, d));
      } catch (error) {
        // A missing collection or index shouldn't abort the whole sweep.
        console.error(`cascade-delete: query ${collectionName}.${field} failed`, error);
      }
    })
  );
  return [...results.values()];
}

interface ProjectHaul {
  quotes: Snap[];
  documents: Snap[];
  tasks: Snap[];
  designItems: Snap[];
  invoices: Snap[];
  expenses: Snap[];
  activity: Snap[];
  storagePaths: string[];
}

async function gatherProject(projectId: string, agreementUrl?: string | null): Promise<ProjectHaul> {
  const [quotes, documents, tasks, designItems, invoices, expenses, activity] = await Promise.all([
    findAll('quotes', ['projectId', 'project_id'], projectId),
    findAll('documents', ['linkedId'], projectId),
    findAll('project_tasks', ['projectId'], projectId),
    findAll('design_items', ['projectId'], projectId),
    findAll('maintenance_invoices', ['projectId'], projectId),
    findAll('expenses', ['projectId'], projectId),
    findAll('activity', ['refId'], projectId),
  ]);

  const storagePaths: string[] = [];
  if (agreementUrl) storagePaths.push(agreementUrl);
  documents.forEach((d) => {
    const path = d.data().storagePath;
    if (path) storagePaths.push(path);
  });
  expenses.forEach((d) => {
    const path = d.data().receiptPath;
    if (path) storagePaths.push(path);
  });

  return { quotes, documents, tasks, designItems, invoices, expenses, activity, storagePaths };
}

function haulToImpact(haul: ProjectHaul, projects: number): DeletionImpact {
  return {
    projects,
    quotes: haul.quotes.length,
    documents: haul.documents.length,
    tasks: haul.tasks.length,
    designItems: haul.designItems.length,
    invoices: haul.invoices.length,
    expenses: haul.expenses.length,
    activity: haul.activity.length,
    files: haul.storagePaths.length,
  };
}

function haulToSnaps(haul: ProjectHaul): Snap[] {
  return [
    ...haul.quotes,
    ...haul.documents,
    ...haul.tasks,
    ...haul.designItems,
    ...haul.invoices,
    ...haul.expenses,
    ...haul.activity,
  ];
}

/** What removing a single project would take with it. */
export async function getProjectDeletionImpact(
  projectId: string,
  agreementUrl?: string | null
): Promise<DeletionImpact> {
  const haul = await gatherProject(projectId, agreementUrl);
  return haulToImpact(haul, 1);
}

/** What removing a customer would take with it, including every one of their projects. */
export async function getCustomerDeletionImpact(customerId: string): Promise<DeletionImpact> {
  const projectSnaps = await findAll('projects', ['clientId', 'client_id'], customerId);

  const perProject = await Promise.all(
    projectSnaps.map((p) => gatherProject(p.id, p.data().agreementUrl))
  );

  const [customerQuotes, customerDocs, customerInvoices, customerExpenses, customerActivity] =
    await Promise.all([
      findAll('quotes', ['clientId', 'client_id'], customerId),
      findAll('documents', ['linkedId'], customerId),
      findAll('maintenance_invoices', ['clientId'], customerId),
      findAll('expenses', ['clientId'], customerId),
      findAll('activity', ['refId'], customerId),
    ]);

  // Project-level sweeps already counted some of these; dedupe by document id.
  const seen = new Set(perProject.flatMap((h) => haulToSnaps(h).map((s) => s.id)));
  const unique = (snaps: Snap[]) => snaps.filter((s) => !seen.has(s.id));

  const projectImpact = perProject.reduce(
    (acc, haul) => mergeImpact(acc, haulToImpact(haul, 1)),
    { ...EMPTY_IMPACT }
  );

  const customerFiles = [
    ...unique(customerDocs).map((d) => d.data().storagePath),
    ...unique(customerExpenses).map((d) => d.data().receiptPath),
  ].filter(Boolean).length;

  return mergeImpact(projectImpact, {
    ...EMPTY_IMPACT,
    quotes: unique(customerQuotes).length,
    documents: unique(customerDocs).length,
    invoices: unique(customerInvoices).length,
    expenses: unique(customerExpenses).length,
    activity: unique(customerActivity).length,
    files: customerFiles,
  });
}

/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 450;

async function commitDeletes(refs: { path: string }[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((r) => batch.delete(doc(db, r.path)));
    await batch.commit();
  }
}

/**
 * Remove stored files. Storage has no batch API and a missing object is not an
 * error worth surfacing — the record is going away either way.
 */
async function removeFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await deleteObject(ref(storage, path));
      } catch {
        /* already gone, or the URL predates storagePath tracking */
      }
    })
  );
}

/**
 * Delete a project and everything attached to it. Files go first: if that step
 * fails we still have the records pointing at them, rather than orphaned blobs.
 */
export async function deleteProjectCascade(
  projectId: string,
  agreementUrl?: string | null
): Promise<DeletionImpact> {
  const haul = await gatherProject(projectId, agreementUrl);
  await removeFiles(haul.storagePaths);
  await commitDeletes(haulToSnaps(haul).map((s) => ({ path: s.ref.path })));
  await deleteDoc(doc(db, 'projects', projectId));
  return haulToImpact(haul, 1);
}

/** Delete a customer, every project they own, and all attached records. */
export async function deleteCustomerCascade(customerId: string): Promise<DeletionImpact> {
  const projectSnaps = await findAll('projects', ['clientId', 'client_id'], customerId);

  const perProject = await Promise.all(
    projectSnaps.map((p) => gatherProject(p.id, p.data().agreementUrl))
  );

  const [customerQuotes, customerDocs, customerInvoices, customerExpenses, customerActivity] =
    await Promise.all([
      findAll('quotes', ['clientId', 'client_id'], customerId),
      findAll('documents', ['linkedId'], customerId),
      findAll('maintenance_invoices', ['clientId'], customerId),
      findAll('expenses', ['clientId'], customerId),
      findAll('activity', ['refId'], customerId),
    ]);

  const allSnaps = new Map<string, Snap>();
  [
    ...perProject.flatMap(haulToSnaps),
    ...customerQuotes,
    ...customerDocs,
    ...customerInvoices,
    ...customerExpenses,
    ...customerActivity,
  ].forEach((s) => allSnaps.set(s.ref.path, s));

  const files = new Set<string>([
    ...perProject.flatMap((h) => h.storagePaths),
    ...customerDocs.map((d) => d.data().storagePath),
    ...customerExpenses.map((d) => d.data().receiptPath),
  ].filter(Boolean) as string[]);

  await removeFiles([...files]);
  await commitDeletes([...allSnaps.values()].map((s) => ({ path: s.ref.path })));
  await commitDeletes(projectSnaps.map((p) => ({ path: p.ref.path })));
  await deleteDoc(doc(db, 'customers', customerId));

  const impact = perProject.reduce(
    (acc, haul) => mergeImpact(acc, haulToImpact(haul, 1)),
    { ...EMPTY_IMPACT }
  );
  return { ...impact, files: files.size };
}
