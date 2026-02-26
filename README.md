# MEafterMe — afterme.life

**Private beta web app + public website.**  
Records real video answers into a private legacy accessible to family for generations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15 (App Router)** + TypeScript |
| Styling | **Tailwind CSS v3** |
| Auth | **Magic-link email** via Nodemailer (SMTP) |
| Database | **Firebase Firestore** via Firebase Admin SDK |
| Hosting | **SuperHosting Shared Hosting** (cPanel + Node.js App Manager) |
| i18n | EN + BG dictionaries (client-side, no external lib) |
| Session | iron-session (cookie, httpOnly, encrypted) |

---

## Routes

### Public website
| Path | Page |
|---|---|
| `/` | Home — hero, how it works, what you create, beta gating |
| `/experience` | MEafterMe Experience — studio flow, consent-first |
| `/demo` | Interactive demo mock — 8 chips, ask-anything, preview cards |
| `/safety` | Safety & Consent |
| `/contact` | Contact form |
| `/privacy` | Privacy Policy (placeholder) |
| `/terms` | Terms (placeholder) |

### Private beta app entry
| Path | Page |
|---|---|
| `/waitlist` | Join waitlist form + status card |
| `/login` | Magic link sign-in |
| `/invite` | Single-use invite code entry |
| `/pending` | Awaiting admin approval |
| `/app` | Protected dashboard (Owner Studio) |
| `/admin` | Admin panel (ADMIN_SECRET-protected) |

### API routes
| Endpoint | Method | Description |
|---|---|---|
| `/api/waitlist` | POST | Join waitlist + create user (WAITLISTED) |
| `/api/auth/send` | POST | Send magic-link email |
| `/api/auth/verify` | GET | Verify token, set session, redirect |
| `/api/auth/logout` | POST | Destroy session |
| `/api/invite` | POST | Redeem invite code → PENDING_APPROVAL |
| `/api/contact` | POST | Save contact message |
| `/api/admin/users` | GET | List all / pending users |
| `/api/admin/approve` | POST | Approve user → ACTIVE |
| `/api/admin/generate-code` | GET/POST | List / create invite codes |
| `/api/admin/waitlist` | GET | List waitlist signups |

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `users` | User accounts: email, status (WAITLISTED/PENDING_APPROVAL/ACTIVE) |
| `waitlist_signups` | Waitlist email entries |
| `invite_codes` | Single-use invite codes |
| `magic_links` | Magic link tokens + expiry |
| `contact_messages` | Contact form submissions |
| `admin_audit` | Audit log (approvals, code redemptions) |

---

## Environment Variables

Copy `.env.example` → `.env.local` for local dev. For production set in **cPanel → Node.js App Manager → Environment Variables**.

| Variable | Description |
|---|---|
| `APP_URL` | `https://afterme.life` |
| `SESSION_SECRET` | ≥32-char random string for iron-session |
| `ADMIN_SECRET` | Protect `/admin` and admin API |
| `SMTP_HOST` | SuperHosting mail server host |
| `SMTP_PORT` | `465` (SSL) or `587` (STARTTLS) |
| `SMTP_SECURE` | `true` for 465, `false` for 587 |
| `SMTP_USER` | Full mailbox address |
| `SMTP_PASS` | Mailbox password |
| `MAIL_FROM` | `MEafterMe <no-reply@afterme.life>` |
| `FIREBASE_PROJECT_ID` | From Firebase service account JSON |
| `FIREBASE_CLIENT_EMAIL` | From Firebase service account JSON |
| `FIREBASE_PRIVATE_KEY_B64` | base64-encoded `private_key` from service account JSON |

### Encode FIREBASE_PRIVATE_KEY_B64
```bash
# Copy the full private_key value from your service account JSON (including header/footer)
# Then run:
echo -n "$(cat private_key.txt)" | base64
# Paste the result into FIREBASE_PRIVATE_KEY_B64
```

---

## SuperHosting cPanel Deployment

### 1. One-time Firebase setup
1. Create a Firebase project → enable Firestore (Native mode)
2. Project Settings → Service Accounts → Generate new private key (JSON)
3. Extract `project_id`, `client_email`, `private_key` and encode private key to base64

### 2. Upload project
- **Option A**: `zip -r meafterme.zip . --exclude 'node_modules/*' '.next/*'`  
  Upload via cPanel File Manager → extract to your app folder
- **Option B**: SSH/Git clone directly

### 3. cPanel Node.js App Manager
1. Create new Node.js application
2. **Node.js version**: 18.x or 20.x
3. **Application root**: `/home/username/afterme.life` (your app folder)
4. **Application URL**: `afterme.life`
5. **Startup file**: `server.js`
6. Click **Create**

### 4. Set Environment Variables
In the Node.js app UI → Environment Variables tab, add all variables from the table above.

### 5. Install + Build
In the cPanel Node.js app console (or SSH):
```bash
npm install --production=false
npm run build
```

### 6. Start
Click **Start** (or **Restart**) in cPanel Node.js App Manager.

### 7. Smoke tests
- `https://afterme.life/` — Home loads  
- `https://afterme.life/demo` — Demo has 8 chips + ask-anything  
- `https://afterme.life/waitlist` — Submit email → Firestore `waitlist_signups`  
- `https://afterme.life/login` — Magic link email sent  
- `https://afterme.life/invite` — Invite code flow  
- `https://afterme.life/admin` — Admin panel (enter ADMIN_SECRET)

---

## Local Development

```bash
cp .env.example .env.local
# Fill in Firebase + SMTP credentials

npm install
npm run dev
# → http://localhost:3000
```

---

## Troubleshooting (SuperHosting cPanel)

| Issue | Fix |
|---|---|
| App not starting | Check startup file is `server.js`, not `app.js` |
| `FIREBASE_PRIVATE_KEY_B64` error | Re-encode the key; ensure no trailing newline |
| SMTP connection refused | Check SMTP_HOST/PORT/SECURE match SuperHosting mail settings |
| 503 / app not responding | Click Restart in Node.js App Manager; check error logs |
| Session not persisting | Ensure `SESSION_SECRET` is set and is ≥32 chars |
| Port conflict | cPanel will proxy the correct port; set `PORT` env var to match |

---

## Access Model

```
Sign up → WAITLISTED
Enter invite code → PENDING_APPROVAL
Admin approval → ACTIVE
```

---

## Status

- ✅ Public website (all pages)
- ✅ Demo interactive mock (8 chips + ask-anything + preview cards)
- ✅ Magic-link auth (SMTP)
- ✅ Firestore persistence (all collections)
- ✅ Invite code flow
- ✅ Admin panel
- ✅ EN/BG i18n
- ✅ SuperHosting `server.js` startup
- 🔲 Recording Studio (v1.1)
- 🔲 Profile wizard full UI (v1.1)
- 🔲 Real video playback (v1.1)
