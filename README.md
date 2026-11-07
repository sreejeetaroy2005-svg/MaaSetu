# MaaSetu

**Her care travels with her.** A consent-based handover app between a mother's original ASHA/ANM and the receiving village's ASHA, plus a simple progress view for the mother.

> **Prototype — synthetic data only.** All 10 steps verified end-to-end with fake data. No real patient data is ever used.

---

## Problem & Research

MaaSetu addresses the gap in maternal care handover between ASHA (Accredited Social Health Activist) and ANM (Auxiliary Nurse Midwife) workers when a mother moves to another village. The prototype implements a consent-based flow where:

- The original health worker records the mother's details and consent to share care data
- The receiving health worker in the destination village accepts the handover
- Both workers can add visits and update milestones on the mother's journey card
- The mother can view her care record and withdraw consent at any time

**Research findings:** Existing maternal health tools either lack consent-based data sharing, don't support village-to-village handovers, or use centralized systems that don't work in low-connectivity settings. Firebase Firestore's offline persistence and emulator suite enabled a protoype that works entirely locally against synthetic data, with the security model isolatable behind feature flags.

**Constraints:** No real patient data, no diagnosis or risk scores, synthetic phone numbers only (99999900xx), demo-only security rules that expire 2026-12-31.

---

## Features

| Feature | Description |
|---------|-------------|
| **Worker login** | ASHA/ANM signs in with phone number; verified against `users` collection role field |
| **Mother login** | Mother signs in with phone number registered by her ASHA; verified against `mothers` collection `registeredBy` field |
| **Care tracker** | Journey card with milestones (registration, antenatal, delivery, postnatal) and visit log |
| **Handover flow** | Consent → pending handover → acceptance → visits; consent can be withdrawn at any time |
| **Offline first** | All changes queued locally; sync when connection restored; conflict handling keeps both versions |
| **Notifications** | Handover requested/accepted/overdue/consent withdrawn messages appear in inbox |
| **WhatsApp preview** | SMS message mock shown for what would be sent from a real phone |
| **QR codes** | Offline summary codes that receiving workers can scan without a connection |
| **Multi-language** | Interface in English (EN), Hindi (HI), and Marathi (MR) |
| **Role-based views** | Worker sees mother list + incoming mothers; Mother sees her own card and consent status |
| **Audit trail** | Every write carries `audit: { createdBy, createdByRole, createdAt }` |

---

## Tech Stack

- **Frontend:** React 19, Vite, React Router DOM, i18next (EN/HI/MR), Tailwind CSS
- **PWA:** Vite Plugin PWA with workbox precaching, standalone mode for low-end Android phones (360px reference width)
- **Backend:** Firestore (document store with IndexedDB persistence) — phone OTP removed; demo login uses seed profiles
- **Emulators:** Firestore (port 8080) for development without a live project; Auth emulator kept only if VITE_USE_EMULATORS=true

**Demo login:** Picks a seed profile automatically. It is not real authentication. Real phone OTP and role-based rules are the first pilot step.
- **Build:** `tsc -b` + `vite build`; production PWA with service worker
- **Types:** TypeScript 7.x; `npm run typecheck` exits 0

---

## Architecture

```
src/
  actions/         # Phone auth, profile resolution, demo sign-in
  components/      # PhoneAuth, DemoTools, WorkerHome, MotherHome, etc.
  data/            # model.ts (types), seedData.ts (synthetic records), journeyTemplate.ts
  services/        # firebase.ts (emulator config), authService.ts, journeyService.ts, audit.ts
  context/         # SessionContext.tsx (Firebase Auth state + profile caching)
  hooks/           # useOffline (online/slow/offline status)
  offline/         # repo.ts (auditStore), sync.ts, bootstrap.ts, network.ts
  i18n/            # locales/en.json, hi.json, mr.json (all 18 demo keys per locale)
  pages/           # Welcome, AshaHome, MotherHome, NotificationInbox, WhatsAppPreview, etc.
  services/        # firebase.ts, authService.ts, journeyService.ts, audit.ts
  offline/         # repo.ts, sync.ts, network.ts, bootstrap.ts
```

**Data model** (Firestore collections): `villages`, `users`, `mothers`, `journeyCards`, `handovers`, `consentLog`, `auditLog`, `notifications`, `conflicts`

**Session flow:**
1. App starts → `onAuthStateChanged` checks Firebase Auth state
2. If phone number present → `resolveProfile(phone)` looks up `users` or `mothers` collection
3. If profile found → session stored, cache warmed for offline
4. If no profile → user shown "register" or "ask your ASHA"
5. Sign out → cached profile cleared, next start lands on welcome screen

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install                # Node 20+; no global tools required

# 2. Start development server (terminal 1)
npm run dev              # http://localhost:5173

# 3. Start Firebase emulators (terminal 2)
npm run emulators        # Firestore :8080, Auth :9099, UI at http://localhost:4000

# 4. Seed synthetic data (terminal 2, once)
npm run seed             # Writes 12 synthetic records to local emulators

# 5. Type-check + build
npm run build            # tsc -b + vite build; exits 0

# 6. Try the app
#    - /asha → Meena Waghmare (Ammapur): Pooja Rathor and Savitri Pawar
#    - /asha/mothers/mtr_savitri → mark milestone done, add visit, edit visit
#    - /asha/mothers/mtr_savitri/handover → "Mother is moving" → consent → handover pending
#    - Switch role → ANM (Rekha Yadav, Devgaon) → badge "1 incoming" → Accept handover
#    - ANM adds visit → ASHA sees activity timeline
#    - Switch role → Mother → Devgaon, Rekha Yadav, done/next milestones
#    - Mother withdraws consent → mother back to Ammapur, handover revoked
```

---

## Demo Steps

### With Meena (ASHA, Ammapur, +919999990001)
1. Open `http://localhost:5173/asha`
2. Meena sees mothers: Pooja Rathor (Ammapur) and Savitri Pawar (Ammapur)
3. Open Savitri's journey card → mark Delivery milestone as Done with date
4. Add a visit → "Follow-up visit at home" → Save
5. Click "Mother is moving" → set destination to Devgaon, receiving worker to Rekha Yadav
6. Record consent → handover created with status "pending"

### With Rekha (ANM, Devgaon, +919999990004)
1. Switch role → ANM → Rekha Yadav · Devgaon
2. Dashboard badge shows "1 incoming"
3. Open Savitri's card → read-only summary → "She is with you now"
4. Click "Accept handover" → status becomes "With Devgaon", worker is now Rekha
5. Add a visit → logged as "Entered by Rekha Yadav on 25 Oct 2026"

### With Savitri (Mother, +919999990101)
1. Switch role → Mother → Savitri Pawar
2. Shows: Current village: Devgaon, Current health worker: Rekha Yadav
3. Done/next milestones with dates in chosen language (EN/HI/MR)
4. Consent timestamp visible
5. "Withdraw consent" → confirms → handover revoked → mother back to Ammapur, Meena

---

## Limitations (Honest)

| Limitation | Status |
|------------|--------|
| **Prototype only** | No real patient data; synthetic numbers (99999900xx) only |
| **Demo security rules** | Expire 2026-12-31; allow read/write for any signed-in user until that date; no role-based enforcement |
| **Role switcher persists data** | Switching roles (worker → mother → worker) keeps data in Firestore; not a production pattern |
| **No real SMS OTP** | Auth emulator issues codes; real SMS gateway not integrated (replace `sendOtp` in authService.ts) |
| **No clinical review** | Milestone labels are PLACEHOLDER; final wording from clinical lead needed |
| **No privacy review** | HIPAA/GDPR compliance not assessed; synthetic data only |
| **No production Firebase project** | `VITE_FIREBASE_API_KEY` unset → app uses local emulators; set key to point at hosted project |
| **Rules-test.ts** | 10 rule tests; 1 known emulator limitation (Test 8: role/village immutability); labeled "future work" |
| **Single-tenant emulators** | Local Emulator Suite only; not suitable for concurrent multi-user demos |
| **No offline + real backend** | Offline mode works against emulators; production build connects to live Firebase if API key set |

**To move toward a pilot:**
1. Set `VITE_FIREBASE_API_KEY` to a real Firebase project key
2. Set `VITE_USE_EMULATORS=false` for production
3. Replace demo security rules with role-based rules (pilot step)
4. Integrate real SMS gateway (Twilio/SMS) in authService.ts → replace `sendOtp` production path
5. Run clinical review of milestone labels and consent wording
6. Run privacy review (data minimization, user consent flows)
7. Test with real users under low-connectivity conditions

---

## API Reference (Env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_FIREBASE_API_KEY` | `'demo-api-key'` | Firebase project API key; empty → use local emulators |
| `VITE_FIREBASE_AUTH_DOMAIN` | `'maasetu-demo.firebaseapp.com'` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | `'maasetu-demo'` | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | `'demo-app-id'` | Firebase app ID |
| `VITE_USE_EMULATORS` | `'false'` | Set `'true'` to connect to local Auth 9099 / Firestore 8080 emulators |
| `VITE_DEMO_MODE` | `'false'` | Set `'true'` to show demo phone numbers and tools in login screen |

**.env.example** is committed (no secrets). Never commit real API keys.

---

**Generated with Codebuff 🤖**