/**
 * MaaSetu — seed script.
 *
 * Writes the SYNTHETIC dataset in `src/data/seedData.ts` to the LOCAL
 * Firestore emulator (Auth + Firestore). It refuses to run against anything
 * that is not a loopback emulator, so synthetic records can never reach a
 * real project, and it refuses to write any record not marked synthetic.
 *
 *   Terminal 1: npm run emulators
 *   Terminal 2: npm run seed            (or: npm run seed -- --dry-run)
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SYNTHETIC_FLAG, type AuditStamp } from '../src/data/model';
import {
  CONSENT_LOGS,
  HANDOVERS,
  JOURNEY_CARDS,
  MOTHERS,
  VILLAGES,
  WORKERS,
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
  if (/^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/.test(host)) return;
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

  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();

  // Admin SDK adapter for the shared audit-trail writer in src/services/audit.ts.
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

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
