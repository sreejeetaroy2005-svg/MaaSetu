# MaaSetu Firestore Security Rules

## Overview

This document describes the Firestore security rules for MaaSetu. All rules mirror the `accessFor` access control model exactly. No collection allows `if true` — everything is denied by default unless explicitly allowed.

## Safety Policy

- **Assistive only**: the app stores, shares (with consent), notifies and reminds.
- **No diagnosis or risk scores**: never diagnoses, scores risk, recommends treatment or flags values as normal/abnormal.
- **Synthetic data only**: every record in this prototype is fictional. No real patient data, ever.
- **All text is in EN/HI/MR files**: no hardcoded health data in UI or rules.

## Authentication

- Users sign in via Firebase Auth phone sign-in with the local Auth emulator.
- Fixed test numbers and a known OTP code (`123456`) are used for demonstration.
- Worker login: the phone number must match a `users` document (role ASHA or ANM).
- Mother login: the phone number must match a `mothers` document registered by an ASHA.
- Each Auth uid is linked to its user or mother record (the uid is stored on the record).
- Session comes from Firebase Auth state, not from a demo role switcher.
- Demo tools menu (development only) signs in as another seed user through Auth.
- Log out signs out of Firebase Auth; restart always shows Welcome unless a valid session exists.

## Collections & Access Rules

### `users`

| Action | Rule |
|---|---|
| **Read** | A user can read their own record (`request.auth.uid == userId`). |
| **Read (cross-worker)** | Workers can read other workers in the same village (`village` matches `request.auth.token.village`). |
| **Write** | Only by the user to their own non-role fields (`name`, `language`, `phone`). |
| **Role/Village change** | Nobody can change their own role or village. |
| **Audit fields** | Every write must carry the author's own uid (`audit.createdBy == request.auth.uid`). |

### `mothers`

| Action | Rule |
|---|---|
| **Read** | The mother herself; workers whose village equals the mother's home village; workers whose village equals the destination of a pending or accepted handover for her. |
| **Create** | Workers only, with `registeredBy` equal to their own id. |
| **Update** | Home village workers while no handover is accepted; receiving village workers only after acceptance. |
| **Role/Village change** | Nobody can change their own role or village. |

### `journeyCards` (milestones, visits)

| Action | Rule |
|---|---|
| **Read** | Same as mothers: the mother herself, workers in her home village, or workers in the destination village of a pending/accepted handover. |
| **Write** | Only by whoever has "edit" access per `accessFor`. The mother has read-only access. |

### `handovers`

| Action | Rule |
|---|---|
| **Create** | Only by a worker in the mother's home village with a matching consent (`consentStatus == 'granted'`). |
| **Accept** | Only by a worker in the destination village (`worker.village == toVillage`). |
| **Withdraw** | Only by the mother, or by a worker recording her withdrawal. |
| **Status changes** | Only along the allowed path: `pending → accepted ∣ revoked`, `accepted → revoked`. |

### `consentLog`

| Action | Rule |
|---|---|
| **Create** | Workers (`recordedBy == auth.uid`) or the mother. |
| **Delete** | Never. (`allow delete: if false`). |
| **Update** | Only add `withdrawnAt` and `withdrawnBy` later. |

### `notifications`

| Action | Rule |
|---|---|
| **Read** | Only own notifications (`recipientUserId == request.auth.uid`). |
| **Update (mark read)** | Only own notifications; add `readAt` timestamp. |
| **Create** | Denied directly — must be part of a valid handover or consent write (enforced by service layer). |

### `auditLog`

| Action | Rule |
|---|---|
| **Read** | Authenticated users only. |
| **Write** | Never directly — always via `createDoc` or `updateDoc` helpers. |

## Test Coverage

Rules unit tests cover the following scenarios (run with `npm run test:rules`):

1. **Signed-out user**: read and write denied everywhere.
2. **Worker cannot read a mother from another village** before a handover.
3. **Receiving worker can read** after the handover is pending, but cannot write.
4. **Receiving worker can write** after acceptance.
5. **Home worker cannot edit** after acceptance (read only).
6. **After consent is withdrawn**, the receiving worker is denied again.
7. **Mother can read only her own card** and cannot write visits.
8. **A user cannot change their own role or village**.
9. **A user cannot read another user's notifications**.
10. **A write with a forged author id is denied**.

## Running the Rules Tests

```bash
# 1. Start the emulators
npm run emulators

# 2. In another terminal, seed the data
npm run seed

# 3. Run the rules tests
npm run test:rules
```