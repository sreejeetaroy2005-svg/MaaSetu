/** @param {string[]} args */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SYNTHETIC_FLAG, type AuditStamp } from '../src/data/model';
import { 
  CONSENT_LOGS, 
  HANDOVERS, 
  JOURNEY_CARDS, 
  MOTHERS, 
  VILLAGES, 
  WORKERS 
} from '../src/data/seedData';
import { createDoc, type AuditStore } from '../src/services/audit';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? 'maasetu-demo';
const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const dryRun = process.argv.includes('--dry-run');

interface SeedRecord {
  id: string;
  synthetic: typeof SYNTHETIC_FLAG;
  audit: AuditStamp;
}

const BATCHES: Array<[string, SeedRecord[]]> = [
  [COLLECTIONS.villages, VILLAGES],
  [COLLECTIONS.users, WORKERS],
  [COLLECTIONS.mothers, MOTHERS],
  [COLLECTIONS.journeyCards, JOURNEY_CARDS],
  [COLLECTIONS.handovers, HANDOVERS],
  [COLLECTIONS.consentLog, CONSENT_LOGS],
];

function assertLoopbackEmulator(host: string): void {
  if (/^(127\\.0\\.0\\.1|localhost|\\[?::1\\]?)(:\\d+)?$/.test(host)) return;
  console.error(
    `SAFETY: refusing to seed ${host} — synthetic data may only be written to a local emulator.`,
  );
  process.exit(1);
}

function assertSynthetic(collection: string, record: SeedRecord): void {
  if (record.synthetic !== SYNTHETIC_FLAG) {
    console.error(`SAFETY: ${collection}/${record.id} is not marked synthetic — aborting.`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertLoopbackEmulator(HOST);

  console.log('------------------------------------------------------------');
  console.log(' MaaSetu seed — SYNTHETIC DATA ONLY (no real patient data)');
  console.log(` project : ${PROJECT_ID}`);
  console.log(` emulator: ${HOST}`);
  console.log(` mode    : ${dryRun ? 'dry run (nothing written)' : 'writing'}`);
  console.log('------------------------------------------------------------');

  if (dryRun) {
    for (const [collection, records] of BATCHES) {
      records.forEach((record) => assertSynthetic(collection, record));
      console.log(`  ${collection.padEnd(14)} ${records.length} records`);
    }
    console.log('Dry run complete — no writes performed.');
    return;
  }

  // Point the Admin SDK at the emulator only; no credentials needed.
  process.env.FIRESTORE_EMULATOR_HOST = HOST;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  // ---- Create Auth emulator users for all seed workers and mothers ----
  if (!dryRun) {
    console.log('Creating Auth emulator users...');
    const usersToCreate = [
      // Workers
      { uid: 'user_asha_meena', phone: '+919999990001' },
      { uid: 'user_asha_sunita', phone: '+919999990002' },
      { uid: 'user_anm_priya', phone: '+919999990003' },
      { uid: 'user_anm_rekha', phone: '+919999990004' },
      // Mothers
      { uid: 'user_mother_savitri', phone: '+919999990101' },
      { uid: 'user_mother_anita', phone: '+919999990102' },
      { uid: 'user_mother_pooja', phone: '+919999990103' },
    ];

    for (const u of usersToCreate) {
      try {
        await getAuth().getUser(u.uid);
        console.log('  User already exists:', u.uid);
      } catch (e: any) {
        await getAuth().createUser({ uid: u.uid, phoneNumber: u.phone });
        console.log('  Created user:', u.uid, u.phone);
      }
    }
    console.log('Auth users ready.');
  }

  // Admin SDK adapter for the shared audit-trail writer in src/services/audit.ts.
  process.env.FIRESTORE_EMULATOR_HOST = HOST;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();

  // Audit-store adapter
  const store: AuditStore = {
    async write(collection, id, data, merge = false) {
      await db.collection(collection).doc(id).set(data, merge ? { merge: true } : {});
    },
  };

  let total = 0;
  for (const [collection, records] of BATCHES) {
    for (const record of records) {
      assertSynthetic(collection, record);
      await createDoc(store, collection, record);
      total += 1;
    }
    console.log(`  wrote ${records.length.toString().padStart(2)} ${collection}`);
  }

  const auditCount = await db.collection(COLLECTIONS.auditLog).count().get();
  console.log('------------------------------------------------------------');
  console.log(` ${total} synthetic records written (every write also logged to auditLog).`);
  console.log(` auditLog entries now: ${auditCount.data().count}`);
}

export function getAuth() {
  // Return the auth instance; will be available after init
  // This is a placeholder - the real auth setup happens at runtime
  return {} as any;
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
