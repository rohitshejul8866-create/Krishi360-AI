# KRISHI360 AI — Database Schema (DynamoDB 2-table design)

> **Status:** implemented in `src/repositories/dynamo/` and unit-tested with a mocked AWS
> SDK. Local dev uses SQLite (`krishi_users` + `krishi_flag_items`) with the same 2-table split.

## 1. Table overview

Two DynamoDB tables (`KrishiUsersTable` and `KrishiFlagTable` in `template.yaml`):

1. **Users Login Table** (`DYNAMODB_USERS_TABLE_NAME`, default `krishi360-users-dev`): stores **only user login details** (`id`, `email`, `role`, `status`, `passwordHash`, `createdAt`, `updatedAt`, `version`) with `pk = USER#<id>`, `sk = LOGIN`, `gsi1pk = EMAIL#<email>`, `gsi2pk = ROLE#<role>`.
2. **Flag Data Table** (`DYNAMODB_FLAG_TABLE_NAME`, default `krishi360-flag-dev`): stores **all remaining details** — user profiles (`USER_PROFILE#<id>`), platform flags/settings (`SETTINGS#global`), workspaces, notifications, crop cases, mandi prices, schemes, farms & soil readings, storage batches/alerts/inspections, and audit entries.

| Property | Value (both tables) |
| --- | --- |
| Primary key | `pk` (HASH, S) + `sk` (RANGE, S) |
| GSI `gsi1` | `gsi1pk` / `gsi1sk`, projection **ALL** |
| GSI `gsi2` | `gsi2pk` / `gsi2sk`, projection **ALL** |
| Billing | `PAY_PER_REQUEST` (on-demand — no idle capacity cost) |
| Encryption | SSE enabled (AWS-managed key) |
| PITR | enabled when `EnvironmentName=prod`, off for dev |
| Stack deletion | `DeletionPolicy: Retain` — data survives stack teardown |

### Item shape

```json
{
  "pk": "CASE#CASE-abc123",
  "sk": "META",
  "gsi1pk": "FARMER#farmer-001",
  "gsi1sk": "2026-11-23T15:30:00.000Z#CASE-abc123",
  "gsi2pk": "EXPERTQUEUE",
  "gsi2sk": "UNASSIGNED#2026-11-23T15:30:00.000Z#CASE-abc123",
  "data": { "...": "the full entity (see src/models/)" }
}
```

The entity lives under a single `data` attribute so key attributes never collide with
entity fields, and filters use `#data.#field` expression names. Scheme items additionally
store a lower-cased `searchText` blob for `contains` search.

### Concurrency

Every mutable entity carries `version`. Updates are full-item `PutItem` with
`ConditionExpression: attribute_exists(pk) AND #data.#version = :expected`.
A mismatch surfaces as `409 CONFLICT` ("reload and retry"). Single-item writes are atomic;
multi-item operations (e.g. reading + alerts + batch update) are **not** wrapped in
transactions in Phase 2 — see limitations below.

### Pagination

`Query`/`Scan` `LastEvaluatedKey` is base64url-encoded into an opaque `cursor`
(`src/utils/pagination.ts`). Page size 1–100, default 20.

## 2. Entity key designs

### CropCase (CropDoctor)

| Attribute | Value |
| --- | --- |
| `pk` / `sk` | `CASE#{id}` / `META` |
| `gsi1pk` / `gsi1sk` | `FARMER#{farmerId}` / `{createdAt}#{id}` |
| `gsi2pk` / `gsi2sk` | `EXPERTQUEUE` / `{assignedExpertId ?? "UNASSIGNED"}#{createdAt}#{id}` |

Entity: `src/models/cropCase.ts` — includes embedded `aiAnalysis` and `expertReview`
(1:1 with the case, always read together, so they are embedded rather than separate items).

### Farm + SoilReading (JalSense)

| Item | `pk` | `sk` | `gsi1pk` / `gsi1sk` |
| --- | --- | --- | --- |
| Farm | `FARM#{id}` | `META` | `FARMER#{farmerId}` / `{createdAt}#{id}` |
| SoilReading | `FARM#{farmId}` | `READING#{createdAt}#{id}` | — |

Readings share the farm's partition (item collection): one `Query` fetches a farm's
readings newest-first; optional `plotId` is a filter expression. Plots are embedded in the
Farm entity (bounded at 50).

### StorageBatch + Reading / Alert / Inspection (GrainGuard)

| Item | `pk` | `sk` | `gsi1pk` / `gsi1sk` |
| --- | --- | --- | --- |
| Batch | `BATCH#{id}` | `META` | `FARMER#{ownerId}` / `{createdAt}#{id}` |
| Reading | `BATCH#{batchId}` | `READING#{createdAt}#{id}` | — |
| Alert | `BATCH#{batchId}` | `ALERT#{createdAt}#{id}` | — |
| Inspection | `BATCH#{batchId}` | `INSPECTION#{createdAt}#{id}` | — |

Same item-collection pattern: alerts/readings/inspections are prefix queries on the batch
partition. `currentReading` and `status` are denormalised onto the batch for cheap list views.

### MandiPrice (MandiSmart)

| Attribute | Value |
| --- | --- |
| `pk` / `sk` | `PRICE#{id}` / `META` |
| `gsi1pk` / `gsi1sk` | `CROP#{crop}` / `{date}#{state}#{mandi}#{id}` |
| `gsi2pk` / `gsi2sk` | `STATE#{state}` / `{date}#{crop}#{id}` |

Date is the leading sort-key component on both GSIs, so `date`, `dateFrom`/`dateTo` become
key conditions (`begins_with` / `BETWEEN`), not filters.

### Scheme (SchemeSaathi)

| Attribute | Value |
| --- | --- |
| `pk` / `sk` | `SCHEME#{id}` / `META` |
| `gsi1pk` / `gsi1sk` | `CATEGORY#{category}` / `{state}#{name}#{id}` |
| extra | `searchText` (lower-cased name+summary+category+tags) |

### AuditEntry

| Attribute | Value |
| --- | --- |
| `pk` / `sk` | `AUDIT#{YYYY-MM-DD}` / `{timestamp}#{id}` |
| `gsi1pk` / `gsi1sk` | `ACTOR#{actorId}` / `{timestamp}` |

Day-partitioned write key spreads audit write load; actor queries use `gsi1`.

## 3. Access patterns → operations

| # | Access pattern | Operation |
| --- | --- | --- |
| 1 | Get case / farm / batch / price / scheme by id | `GetItem` on `pk` (strongly consistent read) |
| 2 | Farmer lists own cases (opt. status filter) | `Query gsi1` `gsi1pk = FARMER#{id}`, newest-first; status is a filter |
| 3 | Farmer lists own farms / batches | `Query gsi1` `gsi1pk = FARMER#{id}` |
| 4 | Expert lists assigned + unassigned queue | `Query gsi2` `gsi2pk = EXPERTQUEUE` + filter `(assigned = me OR (unassigned AND status IN new/ai_review/expert_review))` |
| 5 | Admin lists all cases / farms / batches | bounded `Scan` with `begins_with(pk, PREFIX)` |
| 6 | Farm readings (opt. plotId) | `Query` `pk = FARM#{id} AND begins_with(sk, READING#)` |
| 7 | Batch alerts / readings / inspections | `Query` `pk = BATCH#{id} AND begins_with(sk, ALERT#/READING#/INSPECTION#)` |
| 8 | Prices by crop (+state/district/mandi/date) | `Query gsi1` `gsi1pk = CROP#{crop}` + date key condition + equality filters |
| 9 | Prices by state (+date/crop) | `Query gsi2` `gsi2pk = STATE#{state}` + date key condition |
| 10 | Prices with neither crop nor state | bounded `Scan` (documented limitation) |
| 11 | Schemes by category (+state/q) | `Query gsi1` `gsi1pk = CATEGORY#{cat}`, state includes `All India`, `contains(searchText, q)` |
| 12 | Schemes without category | bounded `Scan` (small catalogue) |
| 13 | Audit by actor | `Query gsi1` `gsi1pk = ACTOR#{id}` |
| 14 | Audit, all recent | bounded `Scan` (admin-only, low volume) |
| 15 | Update any mutable entity | conditional `PutItem` on `version` |

## 4. Honest limitations & scale notes

- **Scans are bounded, not free.** Patterns 5, 10, 12, 14 use `Scan` with `Limit` +
  filter expressions. DynamoDB applies `Limit` *before* filtering, so a page can return
  fewer items than `limit` while `nextToken` is still set — clients must follow the cursor.
  At scale: admin lists should move to dedicated GSIs; unfiltered price browsing should
  require a crop/state; audit browsing should query recent day partitions.
- **Expert queue is a hot partition.** All cases share `gsi2pk = EXPERTQUEUE`. Fine for
  Phase 2 volume; shard by region/status if the queue grows large.
- **GSI projection ALL** doubles/triples storage cost but keeps code simple. Revisit with
  `INCLUDE` projections when item sizes grow.
- **No transactions across items.** A storage reading writes reading + alerts + batch
  update as separate calls; a crash mid-sequence could leave alerts without the batch
  status update. Acceptable for advisory data; use `TransactWriteItems` if this becomes
  financial/critical data.
- **No TTL yet.** Readings/audit grow forever. Add a TTL attribute (e.g. 2 years for
  readings) before production volume.
- **GSI reads are eventually consistent.** Owner lists may briefly lag a just-created
  record; direct `GetItem` reads are strongly consistent.
- **Status filters are post-filters**, so a farmer with many resolved cases pages through
  them when filtering by `new`. A status-prefixed GSI sort key is the future fix.

## 5. Local development & Persistent SQLite Single-Table Engine

By default, the Express development server runs with `DATA_BACKEND=sqlite`, implemented in
`src/repositories/sqlite/` using Node's native `node:sqlite` (`DatabaseSync`) in **WAL mode**
(`.data/krishi360.db`). It mirrors the exact DynamoDB single-table layout (`pk`, `sk`,
`entity_type`, `gsi1pk`, `gsi1sk`, `gsi2pk`, `gsi2sk`, `search_text`, `data`, `version`)
with B-tree indexes on `(entity_type, created_at DESC)`, `(gsi1pk, gsi1sk)`, `(gsi2pk, gsi2sk)`,
and `(pk, sk)`, supporting optimistic locking and ACID persistence across server restarts.

Additional persisted entities:
- `UserAccount`: `USER#{id}` / `META`, `gsi1pk = EMAIL#{email}`, `gsi2pk = ROLE#{role}`
- `UserWorkspace`: `WORKSPACE#{userId}` / `META` (saved schemes, applications, mandi alerts, irrigation reminders)
- `Notification`: `NOTIF#{id}` / `META`
- `PlatformSettings`: `SETTINGS#GLOBAL` / `META`

`DATA_BACKEND=memory` remains available for isolated unit tests (`src/repositories/memory/`).
Memory and SQLite modes are refused inside AWS Lambda by `loadConfig()`, which requires `DATA_BACKEND=dynamodb`.