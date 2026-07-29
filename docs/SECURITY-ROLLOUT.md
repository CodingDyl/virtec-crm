# Security rollout

Do these in order. Steps 1–3 are safe to do now; step 4 is the one that can
lock you out if the earlier steps are skipped.

Nothing below has been done for you — deploying rules and handling the service
account key both need your Firebase credentials.

**The service account is no longer optional.** Sign-in itself now mints a
server-verified session cookie, and every file goes through a server-signed
URL. Without `FIREBASE_SERVICE_ACCOUNT` you cannot sign in, and no document,
receipt or PDF will open. Do step 3 before you rely on the app anywhere.

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

> **Check:** deferred to after step 3 — sign-in needs the service account now.

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

> **Check:** sign in. You should reach the dashboard, and the Share tab of any
> project should stop showing the yellow "Portal not configured" warning. If
> sign-in reports *"not authorised"*, step 2's document ID does not match your
> UID. If it reports *"missing its credentials"*, this step has not taken
> effect — on Vercel, redeploy after adding the variable.

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

For **Storage**, the rules now deny everything, so the Playground should
report **Denied** for any path and any account, signed in or not. That is
correct — the app reaches files through server-signed URLs, which are honoured
without consulting rules.

Then, signed out, open your deployed URL at `/dashboard` — it should bounce
you to the sign-in page. Confirm the app still works signed in: open a
document, a quote PDF and a receipt, and upload something new.

---

## Known gaps

- **Files uploaded before this change keep their permanent download URLs.**
  Those URLs bypass storage rules by design and stay valid forever. They are
  unguessable, but they cannot be revoked short of rewriting each record and
  deleting the old object. Everything uploaded from now on stores a path and
  is served through a short-lived signed URL instead. Ask if you want a
  migration script for the historical files.
- **Signed URLs last 15 minutes.** A design image left on screen longer than
  that will not reload until the page is refreshed.
- **`firebase-admin` pulls in transitive advisories** (`brace-expansion`,
  `minimatch`, `glob` via `google-gax`) — all denial-of-service in glob path
  matching, which nothing here calls with untrusted input. `npm audit fix
  --force` downgrades `firebase-admin` and breaks the portal; leave it.
- **`next-auth` is still in `package.json` and completely unused.** Harmless,
  but it is dependency surface for nothing. Safe to remove.
