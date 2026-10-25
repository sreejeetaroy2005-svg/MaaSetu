/**
 * MaaSetu — SYNTHETIC seed dataset for local development.
 *
 * EVERY record below is fictional: invented names, fake phone numbers
 * (99999900xx) and invented villages. No real patient data — ever.
 * Each record carries `synthetic: SYNTHETIC_FLAG`; `scripts/seed.ts`
 * refuses to write a record that is not marked.
 *
 * Milestone labels are PLACEHOLDER placeholders for the prototype: replace
 * them with the clinician-approved care-plan wording supplied by the
 * programme. Nothing here is generated at runtime and nothing here is
 * medical advice.
 */
import { SEED_ACTOR, newAudit } from '../services/audit';
import { TEMPLATE_BY_ID } from './journeyTemplate';
import {
  SYNTHETIC_FLAG,
  type ConsentLogEntry,
  type Handover,
  type JourneyCard,
  type Mother,
  type User,
  type Village,
} from './model';

const SYN = SYNTHETIC_FLAG;
const stamp = (iso: string) => newAudit(SEED_ACTOR, iso);
const SEED_AT = '2026-09-01T06:00:00.000Z';
/** Milestone labels always come from the fixed template (PLACEHOLDER wording). */
const label = (templateId: string) => TEMPLATE_BY_ID[templateId]?.fallbackLabel ?? templateId;

/** 2 villages (a sending and a receiving village). */
export const VILLAGES: Village[] = [
  {
    id: 'vil_ammapur',
    name: 'Ammapur',
    block: 'Hinganghat',
    district: 'Wardha',
    state: 'Maharashtra',
    synthetic: SYN,
    audit: stamp(SEED_AT),
  },
  {
    id: 'vil_devgaon',
    name: 'Devgaon',
    block: 'Arvi',
    district: 'Wardha',
    state: 'Maharashtra',
    synthetic: SYN,
    audit: stamp(SEED_AT),
  },
];

/** 4 health workers: 2 ASHA (one per village) + 2 ANM. */
export const WORKERS: User[] = [
  {
    id: 'usr_asha_meena',
    name: 'Meena Waghmare',
    role: 'asha',
    village: 'vil_ammapur',
    phone: '+919999990001',
    language: 'mr',
    synthetic: SYN,
    audit: stamp(SEED_AT),
  },
  {
    id: 'usr_asha_sunita',
    name: 'Sunita Kamble',
    role: 'asha',
    village: 'vil_devgaon',
    phone: '+919999990002',
    language: 'hi',
    synthetic: SYN,
    audit: stamp(SEED_AT),
  },
  {
    id: 'usr_anm_priya',
    name: 'Priya Deshmukh',
    role: 'anm',
    village: 'vil_ammapur',
    phone: '+919999990003',
    language: 'mr',
    synthetic: SYN,
    audit: stamp(SEED_AT),
  },
  {
    id: 'usr_anm_rekha',
    name: 'Rekha Yadav',
    role: 'anm',
    village: 'vil_devgaon',
    phone: '+919999990004',
    language: 'hi',
    synthetic: SYN,
    audit: stamp(SEED_AT),
  },
];

/** 3 mothers, one in each consent state across the set. */
export const MOTHERS: Mother[] = [
  {
    id: 'mtr_savitri',
    name: 'Savitri Pawar',
    village: 'vil_ammapur',
    registeredBy: 'usr_asha_meena',
    language: 'mr',
    consentStatus: 'pending',
    expectedDeliveryMonth: '2026-11',
    synthetic: SYN,
    audit: stamp('2026-06-05T08:15:00.000Z'),
  },
  {
    id: 'mtr_anita',
    name: 'Anita Shaikh',
    village: 'vil_devgaon',
    registeredBy: 'usr_asha_sunita',
    language: 'hi',
    consentStatus: 'pending',
    expectedDeliveryMonth: '2026-12',
    synthetic: SYN,
    audit: stamp('2026-07-20T09:40:00.000Z'),
  },
  {
    id: 'mtr_pooja',
    name: 'Pooja Rathod',
    village: 'vil_ammapur',
    registeredBy: 'usr_asha_meena',
    language: 'mr',
    consentStatus: 'pending',
    expectedDeliveryMonth: '2026-10',
    synthetic: SYN,
    audit: stamp('2026-05-12T10:05:00.000Z'),
  },
];

/** One journey card per mother: milestones + recorded visits. */
export const JOURNEY_CARDS: JourneyCard[] = [
  {
    id: 'jrn_mtr_savitri',
    motherId: 'mtr_savitri',
    milestones: [
      { templateId: 'registration', name: label('registration'), dueDate: '2026-06-05', status: 'done', doneDate: '2026-06-05' },
      { templateId: 'antenatal_1', name: label('antenatal_1'), dueDate: '2026-06-15', status: 'done', doneDate: '2026-06-16' },
      { templateId: 'antenatal_2', name: label('antenatal_2'), dueDate: '2026-07-18', status: 'done', doneDate: '2026-07-19' },
      { templateId: 'antenatal_3', name: label('antenatal_3'), dueDate: '2026-08-22', status: 'missed', doneDate: null },
      { templateId: 'delivery', name: label('delivery'), dueDate: '2026-11-12', status: 'upcoming', doneDate: null },
      { templateId: 'postnatal_1', name: label('postnatal_1'), dueDate: '2026-11-20', status: 'upcoming', doneDate: null },
      { templateId: 'postnatal_2', name: label('postnatal_2'), dueDate: '2026-12-05', status: 'upcoming', doneDate: null },
    ],
    visits: [
      {
        id: 'vst_savitri_1',
        date: '2026-06-16',
        enteredBy: 'usr_asha_meena',
        enteredAt: '2026-06-16T10:20:00.000Z',
        note: 'Visit recorded at home, Ammapur.',
        revisions: [],
      },
      {
        id: 'vst_savitri_2',
        date: '2026-09-12',
        enteredBy: 'usr_asha_meena',
        enteredAt: '2026-09-12T09:05:00.000Z',
        note: 'Follow-up visit recorded at home.',
        revisions: [
          {
            date: '2026-09-11',
            note: 'Home visit.',
            editedBy: 'usr_asha_meena',
            editedAt: '2026-09-12T09:10:00.000Z',
          },
        ],
      },
    ],
    synthetic: SYN,
    audit: stamp('2026-06-05T08:20:00.000Z'),
  },
  {
    id: 'jrn_mtr_anita',
    motherId: 'mtr_anita',
    milestones: [
      { templateId: 'registration', name: label('registration'), dueDate: '2026-07-20', status: 'done', doneDate: '2026-07-20' },
      { templateId: 'antenatal_1', name: label('antenatal_1'), dueDate: '2026-08-05', status: 'done', doneDate: '2026-08-06' },
      { templateId: 'antenatal_2', name: label('antenatal_2'), dueDate: '2026-10-28', status: 'upcoming', doneDate: null },
      { templateId: 'antenatal_3', name: label('antenatal_3'), dueDate: '2026-12-02', status: 'upcoming', doneDate: null },
      { templateId: 'delivery', name: label('delivery'), dueDate: '2026-12-30', status: 'upcoming', doneDate: null },
      { templateId: 'postnatal_1', name: label('postnatal_1'), dueDate: null, status: 'upcoming', doneDate: null },
      { templateId: 'postnatal_2', name: label('postnatal_2'), dueDate: null, status: 'upcoming', doneDate: null },
    ],
    visits: [
      {
        id: 'vst_anita_1',
        date: '2026-08-06',
        enteredBy: 'usr_asha_sunita',
        enteredAt: '2026-08-06T11:00:00.000Z',
        note: 'Visit recorded at home, Devgaon.',
        revisions: [],
      },
    ],
    synthetic: SYN,
    audit: stamp('2026-07-20T09:45:00.000Z'),
  },
  {
    id: 'jrn_mtr_pooja',
    motherId: 'mtr_pooja',
    milestones: [
      { templateId: 'registration', name: label('registration'), dueDate: '2026-05-12', status: 'done', doneDate: '2026-05-12' },
      { templateId: 'antenatal_1', name: label('antenatal_1'), dueDate: '2026-05-28', status: 'done', doneDate: '2026-05-28' },
      { templateId: 'antenatal_2', name: label('antenatal_2'), dueDate: '2026-06-30', status: 'done', doneDate: '2026-07-01' },
      { templateId: 'antenatal_3', name: label('antenatal_3'), dueDate: '2026-08-04', status: 'done', doneDate: '2026-08-05' },
      { templateId: 'delivery', name: label('delivery'), dueDate: '2026-10-12', status: 'done', doneDate: '2026-10-14' },
      { templateId: 'postnatal_1', name: label('postnatal_1'), dueDate: '2026-11-02', status: 'upcoming', doneDate: null },
      { templateId: 'postnatal_2', name: label('postnatal_2'), dueDate: '2026-11-16', status: 'upcoming', doneDate: null },
    ],
    visits: [
      {
        id: 'vst_pooja_1',
        date: '2026-08-05',
        enteredBy: 'usr_asha_meena',
        enteredAt: '2026-08-05T07:45:00.000Z',
        note: 'Visit recorded at home, Ammapur.',
        revisions: [],
      },
      {
        id: 'vst_pooja_2',
        date: '2026-10-17',
        enteredBy: 'usr_asha_sunita',
        enteredAt: '2026-10-17T08:30:00.000Z',
        note: 'Visit recorded at natal home, Devgaon.',
        revisions: [],
      },
    ],
    synthetic: SYN,
    audit: stamp('2026-05-12T10:10:00.000Z'),
  },
];

/** 3 handovers, one per status. */
/**
 * Handovers and consent records start empty: they are created by the consent
 * screen during the demo (consent → pending → accepted → withdrawn), so the
 * whole 10-step flow can be walked from a clean seed.
 */
export const HANDOVERS: Handover[] = [];

/** Consent records: granted, granted-and-later-withdrawn, and still pending. */
export const CONSENT_LOGS: ConsentLogEntry[] = [];
