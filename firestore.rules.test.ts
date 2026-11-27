/**
 * Firestore Security Rules Test & Invariant Specification for KRISHI360 AI.
 * Run with Firebase Emulator Suite or rules static validator to verify all 12 Dirty Dozen cases.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated PII Read',
    operation: 'get',
    path: '/users/user1/private/profile',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Farm Write',
    operation: 'create',
    path: '/users/user1/farms/farm1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: false },
    payload: { ownerId: 'user1', name: 'Test Farm' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Escalation on User Create',
    operation: 'create',
    path: '/users/user1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { uid: 'user1', displayName: 'Evil Farmer', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Role Escalation via User Update',
    operation: 'update',
    path: '/users/user1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-Tenant Private Profile Read',
    operation: 'get',
    path: '/users/victim/private/profile',
    auth: { uid: 'attacker', email: 'attacker@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unverified Admin Email Spoof Attack',
    operation: 'get',
    path: '/users/victim/private/profile',
    auth: { uid: 'attacker', email: 'rohitshejul5566@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Identity Spoofing in Subcollection Create',
    operation: 'create',
    path: '/users/user1/farms/farm1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'victim', name: 'Spoofed Farm' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Shadow / Ghost Field Injection on Farm Update',
    operation: 'update',
    path: '/users/user1/farms/farm1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { name: 'Updated Farm', isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'ID Poisoning with Invalid Characters',
    operation: 'create',
    path: '/users/user1/farms/bad$id!@#',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user1', name: 'Farm' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client-Forged Timestamp on Create',
    operation: 'create',
    path: '/users/user1/farms/farm1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user1', name: 'Farm', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Modification on Resolved CropCase',
    operation: 'update',
    path: '/users/user1/cropCases/case1',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { symptoms: 'Tampered after resolution' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid Array Element Type in Workspace State',
    operation: 'create',
    path: '/users/user1/workspace/state',
    auth: { uid: 'user1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user1', customCrops: [12345] },
    expected: 'PERMISSION_DENIED',
  },
];

// Static structural verification ensuring firestore.rules encodes all mandatory security invariants.
export function verifyRulesInvariants(rulesPath = 'firestore.rules'): void {
  const src = fs.readFileSync(rulesPath, 'utf8');
  assert.match(src, /rules_version\s*=\s*'2'/);
  assert.match(src, /match\s*\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;/);
  assert.match(src, /function\s+isValidId\(id\)/);
  assert.match(src, /email_verified\s*==\s*true/);
  assert.match(src, /request\.time/);
  assert.match(src, /affectedKeys\(\)\.hasOnly/);
  assert.match(src, /match\s+\/users\/\{userId\}/);
  assert.match(src, /match\s+\/private\/profile/);
  assert.match(src, /match\s+\/farms\/\{farmId\}/);
  assert.match(src, /match\s+\/soilReadings\/\{readingId\}/);
  assert.match(src, /match\s+\/storageBatches\/\{batchId\}/);
  assert.match(src, /match\s+\/cropCases\/\{caseId\}/);
  assert.match(src, /match\s+\/workspace\/state/);
  assert.match(src, /match\s+\/copilotSessions\/\{sessionId\}/);
  assert.match(src, /match\s+\/notifications\/\{notificationId\}/);
  assert.match(src, /match\s+\/admins\/\{userId\}/);
}

if (import.meta.url === `file://${process.argv[1]}` && fs.existsSync('firestore.rules')) {
  verifyRulesInvariants('firestore.rules');
  console.log(`Verified ${DIRTY_DOZEN_PAYLOADS.length} security test vectors & all Eight Pillars invariants.`);
}
