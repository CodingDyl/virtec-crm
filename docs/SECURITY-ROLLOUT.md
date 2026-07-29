# Security rollout

Do these in order. Steps 1–2 are safe to do now; step 4 is the one that can
lock you out if 1 and 2 are skipped.

Nothing below has been done for you — deploying rules and handling the service
account key both need your Firebase credentials.

---

## 1. Find your Firebase Auth UID

Firebase console → **Authentication** → **Users**.

Copy the **User UID** for the account you sign in with. If no user exists,
create one here with **Add user** (email + password).

## 2. Add yourself to the operator allowlist  ← do this before step 4

Firebase console → **Firestore Database** → **Start collection**.

| Field | Value |
| --- | --- |
| Collection ID | `operators` |
| Document ID | *your UID from step 1* |
| Field | `email` (string) — your address, purely so the list is readable |

The document only has to exist; its contents are never checked.

Repeat for anyone else who should have access. To revoke someone, delete
their document — no code change, no redeploy.

> **Check:** run the app and sign in. You should reach the dashboard. If you
> see "This account has no access", the document ID does not match your UID.

## 3. Give the portal a service-account credential

Firebase console → **Project settings** → **Service accounts** →
**Generate new private key**. This downloads a JSON file.

Encode it as one line:

```bash
base64 -i ~/Downloads/virtec-crm-firebase-adminsdk.json | pbcopy
```

Add it on Vercel → Project → **Settings** → **Environment Variables**:

- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: paste the base64 string
- Environments: Production, Preview, Development

For local dev, put the same line in `.env.local` (already gitignored):

```bash
FIREBASE_SERVICE_ACCOUNT=<paste>
```

Then delete the downloaded JSON file. It is a master key to your project —
it bypasses all security rules. Never commit it, never paste it into chat.

> **Check:** the Share tab of any project should stop showing the yellow
> "Portal not configured" warning.

## 4. Deploy the rules

Only after steps 2 and 3.

```bash
npx firebase-tools deploy --only firestore:rules,storage --project virtec-crm
```

Or paste `firestore.rules` and `storage.rules` into the console's **Rules**
tabs and publish.

> **Check immediately after:** reload the CRM. Customers, projects and quotes
> should all still load. If they do not, re-check step 2 — the rules are fine
> but your UID is not on the allowlist. You can always revert in the console;
> the Rules tab keeps version history and lets you roll back in one click.

## 5. Verify the lockdown actually holds

In the console's **Rules Playground** (Firestore → Rules → Play), run:

| Simulation | Location | Auth | Expect |
| --- | --- | --- | --- |
| `get` | `/customers/anything` | Unauthenticated | **Denied** |
| `get` | `/passwords/anything` | Unauthenticated | **Denied** |
| `get` | `/customers/anything` | Authenticated, UID = a random string | **Denied** |
| `get` | `/customers/anything` | Authenticated, UID = *your UID* | **Allowed** |
| `list` | `/operators` | Authenticated, UID = *your UID* | **Denied** |
| `create` | `/operators/someoneelse` | Authenticated, UID = *your UID* | **Denied** |

The third row is the important one: it proves that someone who signs
themselves up against your public config still gets nothing.

Then, signed out, open your deployed URL at `/dashboard` — it should bounce
you to the sign-in page.

---

## Known gaps

- **The client-side guard is not the security boundary.** `/dashboard` sends
  its UI shell (about 11 KB of tab labels and headings, no business data)
  before the session resolves. The rules are what actually protect the data.
  Closing this needs Firebase session cookies plus middleware — worth doing
  if the app ever holds something sensitive in the shell itself.
- **`firebase-admin` pulls in transitive advisories** (`brace-expansion`,
  `minimatch`, `glob` via `google-gax`) — all denial-of-service in glob path
  matching, which nothing here calls with untrusted input. `npm audit fix
  --force` downgrades `firebase-admin` and breaks the portal; leave it.
- **`next-auth` is still in `package.json` and completely unused.** Harmless,
  but it is dependency surface for nothing. Safe to remove.
- **Storage rules can only check "signed in"**, not the operator allowlist —
  Storage rules cannot read Firestore. Anyone who self-registers can read
  bucket paths if they can guess them. Moving uploads behind signed URLs
  issued by the server would close this.
