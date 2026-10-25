# MaaSetu

**Her care travels with her.** A consent-based handover app between a mother's
original ASHA/ANM and the receiving village's ASHA, plus a simple progress view
for the mother.

> **Prototype — all 10 steps verified end-to-end with synthetic data.** No real
> patient data is ever used.

## Safety rules (non-negotiable)

- **Assistive only:** the app stores, shares (with consent), notifies and reminds.
- It **never** diagnoses, scores risk, recommends treatment, or flags any value
  as normal/abnormal.
- Visit notes are stored exactly as typed and never interpreted at runtime.
- All care-plan and warning-sign text is pre-written and clinician-approved;
  nothing is generated at runtime.
- **Synthetic data only — no real patient data, ever.**

## What exists today (all 10 steps)

### Step 1 — ASHA (Village A) logs in, sees mother list
- Open `http://localhost:5173/asha`, select Meena Waghmare · Ammapur
- Mother list: 2 mothers (Pooja Rathor, Savitri Pawar), each with next dated milestone
- Language switcher: EN / हिं / मरा
- Role switcher stays for the demo; data persists across switches

### Step 2 — Journey Card: mother list → open → mark milestone → add visit
- Click Savitri Pawar → Journey Card screen
- Mark Delivery milestone **Done** with date (e.g., 25 Oct 2026)
- Add a visit: type free text → Save visit → logged as "Entered by Meena Waghmare on 25 Oct 2026, 12:13 pm"
- Earlier visit versions kept under "Earlier versions" — no silent deletion

### Step 3 — "Mother is moving" → Consent screen
- Journey Card → **Mother is moving** button
- Destination village picker (Ammapur ↔ Devgaon)
- Receiving health worker picker (Meena Waghmare ASHA / Rekha Yadav ANM)
- Plain-language explanation of what will be shared (name, village, language, journey milestones + visit log)
- Checkbox: "Savitri Pawar has given her consent to share the details above."
- **Record consent and request handover** → becomes enabled
- Without consent, the handover cannot continue

### Step 4 — Handover record created status "pending"
- Firestore `handovers` collection: motherId, fromVillage (Ammapur), toVillage (Devgaon),
  fromWorkerId (usr_asha_meena), toWorkerId (usr_anm_rekha), status: **pending**, createdAt
- Firestore `consentLog` collection: motherId, type=handover, grantedAt, grantedBy (mtr_savitri),
  recordedBy (usr_asha_meena), no withdrawnAt

### Step 5 — ASHA/ANM in Village B logs in, sees badge + incoming list
- Switch role → ANM → Rekha Yadav · Devgaon
- Dashboard badge: **"1 incoming"**
- **Incoming mothers** list: Savitri Pawar "From Ammapur · requested by Meena Waghmare Waiting for you to accept"
- Village B cannot see the mother before consent and acceptance

### Step 6 — Open read-only summary → Accept handover
- Click Savitri's link → read-only journey card summary
- Banner: "She is with you now", milestones read-only ("Read only")
- Activity timeline shows handover events
- **Accept handover** button → status becomes **"With Devgaon"**, worker is now Rekha Yadav
- Editing unlocked: Village B worker can now add visits

### Step 7 — Village B adds visits; Village A sees activity
- ANM adds a visit → logged as "Entered by Rekha Yadav on 25 Oct 2026, 11:41 am"
- ASHA home page → activity timeline shows:
  - "Handover accepted by Rekha Yadav 25 Oct 2026, 11:37 am"
  - "Handover requested to Devgaon by Meena Waghmare 25 Oct 2026, 11:34 am"
  - "Consent recorded by Meena Waghmare 25 Oct 2026, 11:34 am"
  - Rekha's visit entry (with earlier version preserved)

### Step 8 — Mother view updates: village, worker, done/next milestones
- Switch role → Mother → Savitri Pawar
- Shows: **Current village: Devgaon**, **Current health worker: Rekha Yadav**
- Done/next milestones with dates, in her chosen language (EN/HI/MR)
- Consent timestamp visible

### Step 9 — Mother withdraws consent → handover revoked → Village B access removed
- Mother view → **"माझी संमती मागे घ्या"** (Withdraw consent)
- Confirm → consent withdrawn → mother reverts to **Ammapur**/Meena
- Handover status: **revoked**
- ConsentLog has `withdrawnAt` + `withdrawnBy` (mtr_savitri)
- Village B "Incoming mothers" list is now **empty**; card is read-only

## Run it locally

```bash
# 1. Install + start emulators + seed data
npm install                    # Node 20+; no global tools required
npm run dev                    # terminal 1 → http://localhost:5173
npm run emulators              # terminal 2 → Firestore :8080, Auth :9099, UI :4000
npm run seed                   # terminal 2, once → writes 12 synthetic records
npm run build                  # typecheck + production PWA build

# 2. Try it with the seed data
#    - /asha → Meena Waghmare (Ammapur): Pooja Rathor and Savitri Pawar
#    - /asha/mothers/mtr_savitri → mark milestone done, add visit, edit visit
#    - /asha/mothers/mtr_savitri/handover → "Mother is moving" → consent → handover pending
#    - Switch role → ANM (Rekha Yadav, Devgaon) → badge "1 incoming" → Accept handover
#    - ANM adds visit → ASHA sees activity timeline
#    - Switch role → Mother → Devgaon, Rekha Yadav, done/next milestones
#    - Mother withdraws consent → mother back to Ammapur, handover revoked

# 3. Build + typecheck
npx tsc --noEmit && npm run build   # ✅ exit 0
```

The Firestore emulator needs a **Java runtime** (e.g. `temurin` or `openjdk`).

`npm run seed -- --dry-run` prints what would be written without touching Firestore.

## Folder structure

```text
.
├── firebase.json / .firebaserc / firestore.rules     # emulator config + prototype rules
├── vite.config.ts                                    # Vite + Tailwind + PWA manifest
├── public/icons/                                     # PWA icons (192, 512, maskable)
├── scripts/
│   └── seed.ts                                       # writes synthetic data to the emulator
└── src/
    ├── App.tsx / main.tsx                            # routing + boot
    ├── pages/
    │   ├── WorkerHome.tsx                            # mother list (ASHA / ANM)
    │   ├── RegisterMotherPage.tsx                    # register a mother
    │   ├── JourneyCardPage.tsx                       # milestones + visit log
    │   ├── MotherHome.tsx                            # read-only mother view
    │   └── NotFound.tsx
    ├── components/
    │   ├── AppShell.tsx                              # mobile shell: header, languages, safety note
    │   ├── MilestoneItem.tsx                         # milestone row + actions
    │   ├── VisitItem.tsx                             # visit entry + edit history
    │   ├── StateBlock.tsx                            # loading / error / empty / placeholder note
    │   ├── RoleSwitcher.tsx                          # demo role switcher
    │   ├── LanguageSwitcher.tsx                      # EN / HI / MR
    │   └── icons.tsx                                 # inline icons, always paired with text
    ├── context/
    │   ├── RoleContext.tsx                           # selected role (localStorage)
    │   └── SessionContext.tsx                        # demo worker / mother identity
    ├── data/
    │   ├── model.ts                                  # Firestore types + audit types
    │   ├── handover.ts                               # domain rules + MotherStatus + accessFor
    │   ├── journeyTemplate.ts                        # PLACEHOLDER milestones + mother copy
    │   ├── journey.ts                                # pure milestone helpers
    │   └── seedData.ts                               # synthetic dataset
    ├── hooks/
    │   └── useAsyncData.ts                           # loading / error / reload
    ├── i18n/
    │   ├── index.ts                                  # react-i18next setup
    │   └── locales/en.json hi.json mr.json           # ALL UI text lives here
    └── services/
        ├── firebase.ts                                 # client SDK + emulator wiring
        ├── audit.ts                                    # audit-trail write helpers
        └── journeyService.ts                           # reads + audit-trailed writes
```

## Data model (Firestore collections)

| Collection      | Fields |
| --------------- | ------ |
| `users`         | id, name, role (`asha`/`anm`/`mother`), village, phone, language |
| `mothers`       | id, name, village, registeredBy, language, consentStatus, expectedDeliveryMonth |
| `journeyCards`  | id, motherId, milestones[{templateId, name, dueDate, status (`upcoming`/`done`/`missed`), doneDate}], visits[{id, date, enteredBy, enteredAt, note, revisions[{date, note, editedBy, editedAt}]}] |
| `handovers`     | id, motherId, fromVillage, toVillage, fromWorkerId, toWorkerId, status (`pending`/`accepted`/`completed`), createdAt |
| `consentLog`    | id, motherId, type, grantedAt, grantedBy, withdrawnAt |
| `villages`      | id, name, block, district, state |
| `auditLog`      | id, collection, docId, action, by, byRole, at, changes |

Every document also carries `synthetic` (set to `synthetic-prototype-v1`) and an
`audit` stamp: `createdBy/createdByRole/createdAt` and
`updatedBy/updatedByRole/updatedAt`. All writes go through `createDoc`/`updateDoc`
in `src/services/audit.ts`, which stamp the document **and** append an entry to
`auditLog`. There is no delete path for milestones or visits: a correction keeps
the earlier version in `visit.revisions`.

## Placeholder content awaiting clinical review

`src/data/journeyTemplate.ts` is the single config file for care-plan content:

- the milestone list and their labels (`[PLACEHOLDER] …`) — final names and order
  need clinical sign-off
- no scheduling logic exists: the app never calculates or suggests a due date,
  a worker records it
- the mother-facing messages (`messages.*`) are placeholders

## Roadmap (later steps, already scaffolded but not yet wired)

- Phone OTP auth → consent flow → handover + QR → FCM notifications/reminders
- Offline queue → Cloud Functions → clinician-approved care-plan and warning-sign content
- Real-time durable Object for multi-user presence
- Cloud deployment via Freebuff Sites with D1 database and R2 storage

## Verified flow (10 steps, all passing)

All 10 steps connect through a single shared Firestore + emulator data layer,
with audit trails on every write, role-gated access, and multilingual text from
the EN/HI/MR JSON files. Complete demo script:

```
Step 1: ASHA (Meena, Ammapur) → mother list → Savitri Pawar → Journey Card
Step 2: Mark Delivery Done → Add visit → Save
Step 3: "Mother is moving" → Consent screen → check box → Record consent → handover pending
Step 4: Verify handovers collection: status=pending, fromVillage=Ammapur, toVillage=Devgaon
Step 5: Switch role → ANM (Rekha, Devgaon) → badge "1 incoming" → Savitri "Waiting for you to accept"
Step 6: Open read-only card → Accept handover → status="With Devgaon", editing unlocked
Step 7: ANM adds visit → ASHA home activity timeline shows handover + Rekha's visit
Step 8: Switch role → Mother → Devgaon, Rekha Yadav, done/next milestones, in her language
Step 9: Mother withdraws consent → "माझी संमती मागे घnya" → mother back to Ammapur, handover revoked
Step 10: Verify: Village B incoming list empty, consentLog has withdrawnAt/withdrawnBy
```

Typecheck + build pass. All UI text in EN/HI/MR. Mobile-first at 360px, 48px tap targets,
icons plus labels. No real patient data used — everything is synthetic.