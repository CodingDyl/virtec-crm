import { cert, getApps, initializeApp, applicationDefault, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Server-side Firebase access.
 *
 * Firestore rules lock every collection to the operator allowlist, which is
 * what a browser hits. The client portal has no user behind it, so its reads
 * run here instead: the Admin SDK authenticates as a service account and is
 * not subject to rules. This module is server-only — importing it into a
 * client component will fail the build, which is the intent.
 */

/** Matches storageBucket in firebase/firebaseConfig.ts. */
export const STORAGE_BUCKET = 'virtec-crm.firebasestorage.app';

/** Thrown when the deployment has no service-account credential configured. */
export class AdminNotConfiguredError extends Error {
  constructor() {
    super('Firebase Admin credentials are not configured on this deployment.');
    this.name = 'AdminNotConfiguredError';
  }
}

/**
 * Vercel's environment editor mangles pasted multi-line JSON, so the key is
 * accepted either as raw JSON or base64-encoded. Base64 is the safer paste.
 */
function readServiceAccount(): Record<string, any> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;

  const json = raw.startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8');

  try {
    const parsed = JSON.parse(json);
    // A key pasted through a shell or web form often arrives with literal \n.
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON or base64 JSON.');
    return null;
  }
}

let cached: App | null = null;

export function getAdminApp(): App {
  if (cached) return cached;

  const existing = getApps();
  if (existing.length > 0) {
    cached = existing[0];
    return cached;
  }

  const serviceAccount = readServiceAccount();

  if (serviceAccount) {
    cached = initializeApp({
      credential: cert(serviceAccount as any),
      projectId: serviceAccount.project_id,
      storageBucket: STORAGE_BUCKET,
    });
    return cached;
  }

  // Google-hosted runtimes (App Hosting, Cloud Run) supply credentials
  // automatically, so no key file is needed there.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GCLOUD_PROJECT) {
    cached = initializeApp({
      credential: applicationDefault(),
      storageBucket: STORAGE_BUCKET,
    });
    return cached;
  }

  throw new AdminNotConfiguredError();
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GCLOUD_PROJECT
  );
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
