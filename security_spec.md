# KRISHI360 AI — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Email Verification**: Every write operation requires an authenticated Firebase user with `request.auth.token.email_verified == true`. Document IDs (`{userId}`, `{farmId}`, `{readingId}`, `{batchId}`, `{caseId}`, `{sessionId}`, `{notificationId}`) must match `^[a-zA-Z0-9_-]{1,128}$`.
2. **PII Split Collection Isolation**: `/users/{userId}` stores only non-PII display fields (`uid`, `displayName`, `role`, `photoUrl`, `createdAt`, `updatedAt`). Sensitive PII (`email`, `phone`, `location`) is strictly isolated in `/users/{userId}/private/profile`, readable only by the owner (`request.auth.uid == userId`) or a verified admin.
3. **Self-Assigned Role Escalation Guard**: Users creating `/users/{userId}` may only assign `role == 'farmer'` unless they already pass `isAdmin()`. Users cannot self-promote `role` during updates, nor can non-admins write to `/admins/{userId}`.
4. **Master Gate Relational Integrity**: Subcollections under `/users/{userId}/...` verify on `get`, `create`, `update`, and `delete` that the parent `/users/$(userId)` exists and `uid == userId`, and that `ownerId == userId`.
5. **Temporal Integrity & Immutable Ownership**: `createdAt` must equal `request.time` on creation and remain unchanged on updates; `updatedAt` must equal `request.time` on every create and update; `ownerId` and `uid` are immutable after creation.
6. **Terminal State Locking**: Once a `CropCase` reaches `status == 'resolved'` and `reviewStatus == 'completed'`, farmers cannot mutate it; only verified admins may override or correct it.
7. **Strict Keys, Sizes & Bounded Arrays**: Every create enforces `hasAll` + `hasOnly`, every update enforces `affectedKeys().hasOnly(...)` inside named action branches, every string has explicit `.size()` bounds, and every array has `.size() <= MAX` plus type verification.
8. **Secure List Queries**: `allow list` rules explicitly enforce `resource.data.ownerId == request.auth.uid` (without calling `get()` or `exists()`) so un-scoped list queries fail cleanly at the rules layer.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: `GET /users/user1/private/profile` with `auth: null`.
2. **Unverified Email Write**: `CREATE /users/user1/farms/farm1` with `auth: { uid: 'user1', token: { email_verified: false } }`.
3. **Self-Assigned Admin Escalation**: `CREATE /users/user1` with `{ uid: 'user1', displayName: 'Attacker', role: 'admin', createdAt: serverTime, updatedAt: serverTime }`.
4. **Role Promotion via Update**: `UPDATE /users/user1` changing `{ role: 'admin' }` by owner `'user1'`.
5. **Cross-Tenant PII Read**: `GET /users/victim/private/profile` authenticated as `'attacker'`.
6. **Email Spoofing Without Verification**: `GET /users/victim/private/profile` with `{ email: 'rohitshejul5566@gmail.com', email_verified: false }`.
7. **Identity Spoofing in Subcollection**: `CREATE /users/user1/farms/farm1` with `ownerId: 'victim'` while signed in as `'user1'`.
8. **Ghost / Shadow Field Injection**: `UPDATE /users/user1/farms/farm1` adding `{ isVerified: true }` alongside valid `name`.
9. **ID Poisoning / Resource Exhaustion**: `CREATE /users/user1/farms/<200-char-invalid-id!@#>` or `name` with 5,000 characters.
10. **Client-Forged Timestamp**: `CREATE /users/user1/farms/farm1` with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
11. **Terminal State Override on Resolved CropCase**: `UPDATE /users/user1/cropCases/case1` by `'user1'` when existing doc has `status: 'resolved', reviewStatus: 'completed'`.
12. **Unbounded Array / Invalid Element Type**: `CREATE /users/user1/workspace/state` with `customCrops: [12345]` (non-string element) or > 100 items.
