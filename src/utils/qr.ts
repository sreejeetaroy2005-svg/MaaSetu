/**
 * MaaSetu — the QR payload.
 *
 * A compact summary that fits in a QR code and needs no connection:
 *   mother id, name, home village, and the milestones recorded as done with
 *   their dates. Never a visit note, never anything about her health.
 *
 * "Signed" in this prototype means a checksum over the payload with a fixed
 * build salt: it catches a truncated or edited code, and it is NOT a
 * cryptographic signature. Production would sign the same payload with a
 * server key so a receiving phone can verify authorship.
 */
import { TEMPLATE_BY_ID } from '../data/journeyTemplate';
import type { JourneyCard, Mother } from '../data/model';
import { nowIso } from '../services/audit';

const SALT = 'maasetu-prototype-qr-v1';

export interface QrMilestone {
  templateId: string;
  /** The recorded date it was marked done (`YYYY-MM-DD`). */
  date: string;
}

export interface QrSummary {
  v: 1;
  motherId: string;
  name: string;
  village: string;
  milestones: QrMilestone[];
  issuedAt: string;
}

function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Build the summary from her card: done milestones only, with their dates. */
export function buildQrSummary(
  mother: Mother,
  card: JourneyCard | null,
  villageName: string,
): QrSummary {
  const milestones: QrMilestone[] = (card?.milestones ?? [])
    .filter((milestone) => milestone.status === 'done' && milestone.doneDate)
    .map((milestone) => ({
      templateId: milestone.templateId,
      date: milestone.doneDate as string,
    }));

  return {
    v: 1,
    motherId: mother.id,
    name: mother.name,
    village: villageName,
    milestones,
    issuedAt: nowIso(),
  };
}

export function encodeQrSummary(summary: QrSummary): string {
  const json = JSON.stringify(summary);
  return `${toBase64Url(json)}.${checksum(json + SALT)}`;
}

/** Returns null for anything that is not a complete, intact MaaSetu code. */
export function decodeQrSummary(code: string): QrSummary | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const [body, sum] = trimmed.split('.');
  if (!body || !sum) return null;
  try {
    const json = fromBase64Url(body);
    if (checksum(json + SALT) !== sum) return null;
    const parsed = JSON.parse(json) as QrSummary;
    if (parsed.v !== 1 || !parsed.motherId || !parsed.name) return null;
    if (!Array.isArray(parsed.milestones)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** i18n key for a milestone id, when the template still knows it. */
export function milestoneLabelKey(templateId: string): string | null {
  return TEMPLATE_BY_ID[templateId]?.labelKey ?? null;
}

/** Compare a scanned summary with what the server holds. */
export function summaryMatchesServer(
  summary: QrSummary,
  mother: Mother | null,
  card: JourneyCard | null,
): boolean {
  if (!mother) return false;
  if (mother.name !== summary.name) return false;
  const serverDone = (card?.milestones ?? [])
    .filter((milestone) => milestone.status === 'done' && milestone.doneDate)
    .map((milestone) => `${milestone.templateId}:${milestone.doneDate}`)
    .sort();
  const codeDone = summary.milestones
    .map((milestone) => `${milestone.templateId}:${milestone.date}`)
    .sort();
  return serverDone.join('|') === codeDone.join('|');
}
