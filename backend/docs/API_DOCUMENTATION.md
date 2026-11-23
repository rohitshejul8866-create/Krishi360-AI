# KRISHI360 AI — API Documentation (Phase 2)

> **Status:** implemented and unit-tested locally. **Not deployed.** The base URL below
> refers to the local dev server (`npm run dev`). After an approved deployment, the base
> URL becomes the API Gateway stage URL from the SAM stack output `ApiBaseUrl`.

- Local base URL: `http://localhost:4000`
- Content type: `application/json` for all request/response bodies (image bytes go directly to S3 via presigned POST).
- All routes are also defined in `template.yaml` (API Gateway REST API + Cognito authorizer).

---

## 1. Authentication

### Deployed mode (Cognito)

API Gateway validates a Cognito **ID token** (`Authorization: Bearer <idToken>`) before the
Lambda runs. The backend reads the verified claims (`sub`, `cognito:groups`, `name`) from
`event.requestContext.authorizer.claims`. Roles come from Cognito group membership:

| Group | Role | Priority when in multiple groups |
| --- | --- | --- |
| `admin` | admin | highest |
| `expert` | expert | middle |
| `farmer` | farmer | lowest |

A user with no recognised group is rejected with `403 FORBIDDEN`.

### Local dev mode (never available in Lambda)

When `AUTH_MODE=dev` (local default), identity is taken from two headers:

```
x-dev-user-id: farmer-001
x-dev-role: farmer        # farmer | expert | admin
```

`loadConfig()` refuses to start inside AWS Lambda if `AUTH_MODE=dev`, `DATA_BACKEND=memory`
or `AI_PROVIDER=heuristic` is set — these escape hatches cannot leak into production.

---

## 2. Response envelope

Every success response uses the frontend's `ApiEnvelope<T>` shape:

```json
{
  "data": { "...": "endpoint-specific payload" },
  "meta": {
    "source": "krishi360-api",
    "simulated": false,
    "timestamp": "2026-11-23T15:30:00.000Z"
  }
}
```

`meta.simulated` is `true` when the payload is not live/verified data, e.g.:

- heuristic AI analysis (`AI_PROVIDER=heuristic`, local only),
- mandi prices / schemes with `dataType: "sample"`,
- readings submitted with `source: "simulated"`.

Individual records also carry their own honesty markers (`dataType`, `source`,
`analysis.simulated`, `analysis.verified: false`, disclaimers). **AI output is never
presented as a confirmed diagnosis, and pesticide dosage is never returned from image analysis.**

### Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body.",
    "details": [{ "path": "crop", "message": "Required" }],
    "requestId": "req-..."
  }
}
```

`X-Request-Id` is also returned as a response header on success and error.

### Error codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Zod validation failed (body/query/params), bad JSON, bad cursor, key/plot mismatch |
| 400 | `PAYLOAD_TOO_LARGE` | Declared image size exceeds `MAX_UPLOAD_BYTES` |
| 401 | `UNAUTHORIZED` | Missing/invalid authentication |
| 403 | `FORBIDDEN` | Role not allowed, or expert acting outside review scope |
| 404 | `NOT_FOUND` | Record missing, unknown route, **or record owned by another farmer** (anti-enumeration) |
| 409 | `CONFLICT` | Optimistic-lock version mismatch — reload and retry |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Upload content type not in jpeg/png/webp (service layer) |
| 500 | `INTERNAL_ERROR` | Unexpected failure; details are logged, never returned |
| 503 | `AI_NOT_CONFIGURED` | Analysis requested while `AI_PROVIDER=disabled` (safe default) |
| 503 | `AIInvocationFailed` | Bedrock invocation failed (e.g. no model access in the account/region) |
| 503 | `AI_IMAGE_UNAVAILABLE` / `AI_EMPTY_RESPONSE` / `AI_INVALID_OUTPUT` | Bedrock path failures — fail closed, never fabricate a result |
| 503 | `UPLOAD_NOT_CONFIGURED` | Upload requested without a configured S3 bucket |

Note: an upload request with a disallowed `contentType` fails Zod validation at the handler
(`400 VALIDATION_ERROR`); the `415` code exists at the service layer for direct callers.

---

## 3. Pagination

List endpoints accept `limit` (1–100, default 20) and `cursor` (opaque base64url token from
the previous page). Responses:

```json
{ "data": { "items": [ ... ], "nextToken": "eyJwayI6..." }, "meta": { ... } }
```

`nextToken: null` means no more pages. An invalid cursor returns `400 VALIDATION_ERROR`.
Ordering: newest-first for owner lists, readings, alerts and audit logs.

---

## 4. Role & ownership matrix

| Endpoint | farmer | expert | admin |
| --- | --- | --- | --- |
| `GET /health` | public | public | public |
| `GET /me` | ✅ | ✅ | ✅ |
| `POST /crop-cases` | ✅ | ❌ | ❌ |
| `GET /crop-cases` | own cases only | assigned + unassigned queue | all |
| `GET /crop-cases/{id}` | own only | assigned + queue only | any |
| `POST /crop-cases/{id}/upload-url` | own only | ❌ | any |
| `POST /crop-cases/{id}/analysis` | own only | ❌ | any |
| `POST /crop-cases/{id}/expert-review` | ❌ | authorised cases only | any |
| `GET /mandi/prices`, `GET /mandi/prices/{id}` | ✅ | ✅ | ✅ |
| `POST /mandi/prices` (ingestion) | ❌ | ❌ | ✅ |
| `POST /farms`, readings writes | ✅ own | ❌ | ✅ |
| `GET /farms`, `GET /farms/{id}`, readings lists | own only | own only* | all |
| `POST /storage-batches`, readings, inspections | ✅ own | ❌ | ✅ |
| `GET /storage-batches…`, alerts | own only | own only* | all |
| `GET /schemes`, `GET /schemes/{id}` | ✅ | ✅ | ✅ |
| `POST /schemes/eligibility-check` | ✅ | ✅ | ✅ |
| `GET /audit-logs` | ❌ | ❌ | ✅ |

\* Experts have no farms/batches of their own in Phase 2; the same owner-scoping code path
applies, so they see an empty list rather than other farmers' data.

**Expert queue rule:** an expert can see a case if it is assigned to them (any status), or
if it is unassigned and still in the review queue (`status` ∈ `new`, `ai_review`,
`expert_review`). Resolved unassigned cases drop out of the queue. An expert's review
assigns the case to them.

**Cross-tenant access returns 404, not 403**, so record ids cannot be enumerated.

---

## 5. System endpoints

### `GET /health` — public

```bash
curl http://localhost:4000/health
```

```json
{
  "data": {
    "status": "ok",
    "service": "krishi360-ai-backend",
    "version": "0.1.0",
    "time": "2026-11-23T15:30:00.000Z",
    "features": { "aiProvider": "heuristic", "uploadsConfigured": false, "dataBackend": "memory" }
  },
  "meta": { "source": "krishi360-api", "simulated": false, "timestamp": "..." }
}
```

### `GET /me` — any authenticated role

Returns `{ id, role, name, groups }` for the calling user. Useful for the frontend to
confirm the token/role after login.

---

## 6. CropDoctor AI

### `POST /crop-cases` — farmer only → `201`

```json
{
  "crop": "Tomato",
  "plantPart": "Leaf",
  "location": "Nashik, Maharashtra",
  "symptoms": "Yellowing leaves with dark spots",
  "priority": "high"
}
```

`priority` optional (`low|medium|high`, default `medium`). All strings trimmed, strict
schema (unknown fields rejected). Response `data` is the full `CropCase`:

```json
{
  "id": "CASE-...",
  "farmerId": "farmer-001",
  "crop": "Tomato",
  "plantPart": "Leaf",
  "location": "Nashik, Maharashtra",
  "symptoms": "Yellowing leaves with dark spots",
  "status": "new",
  "priority": "high",
  "reviewStatus": "pending",
  "createdAt": "...",
  "updatedAt": "...",
  "version": 1
}
```

### `GET /crop-cases` — role-scoped list

Query: `limit`, `cursor`, `status` (`new|ai_review|expert_review|resolved`).
Response `data`: `{ items: CropCase[], nextToken }`.

### `GET /crop-cases/{id}` — owner / authorised expert / admin

Response `data`: `CropCase` (includes `aiAnalysis` and `expertReview` when present).

### `POST /crop-cases/{id}/upload-url` — farmer (owner) or admin

```json
{ "fileName": "leaf.jpg", "contentType": "image/jpeg", "sizeBytes": 240000 }
```

- `contentType`: `image/jpeg | image/png | image/webp` only.
- `sizeBytes` ≤ `MAX_UPLOAD_BYTES` (default 5 MB).

Response `data` (requires a configured S3 bucket, otherwise `503 UPLOAD_NOT_CONFIGURED`):

```json
{
  "url": "https://<bucket>.s3.<region>.amazonaws.com",
  "fields": { "key": "crops/farmer-001/CASE-.../<uuid>.jpg", "Content-Type": "image/jpeg", "...": "policy fields" },
  "imageKey": "crops/farmer-001/CASE-.../<uuid>.jpg",
  "expiresAt": "...",
  "constraints": { "maxSizeBytes": 5242880, "allowedTypes": ["image/jpeg", "image/png", "image/webp"] }
}
```

The client uploads with `multipart/form-data` POST: all `fields` first, then the `file`
part. S3 itself enforces the size range, exact content type and pinned key. The bucket is
private; `imageKey` is a storage reference, never a public URL.

### `POST /crop-cases/{id}/analysis` — farmer (owner) or admin

```json
{ "imageKey": "crops/farmer-001/CASE-.../<uuid>.jpg" }
```

`imageKey` optional (falls back to the key already attached to the case; may be `{}`).
A supplied key must belong to this case's prefix or the request fails with `400`.

Response `data`: `{ case: CropCase, analysis: AiAnalysis }`; `meta.simulated` mirrors
`analysis.simulated`. The case moves to `status: "ai_review"`.

`AiAnalysis` fields: `provider`, `modelId?`, `condition`, `confidence` (0–100),
`uncertainty`, `alternatives[]`, `observedSymptoms[]`, `explanation`, `nextSteps[]`,
`recommendExpert`, `verified: false` (always), `simulated`, `disclaimer`, `analyzedAt`.

Behaviour by provider:

| `AI_PROVIDER` | Result |
| --- | --- |
| `disabled` (default) | `503 AI_NOT_CONFIGURED` — fails closed |
| `heuristic` (local only) | deterministic rules, `simulated: true`, demo disclaimer |
| `bedrock` | Converse API call; output validated against a strict Zod schema; dosage-like text sanitised; invalid/empty output → `503`, never fabricated |

### `POST /crop-cases/{id}/expert-review` — expert (authorised) or admin

```json
{
  "notes": "Reviewed photos and symptom history.",
  "guidance": "Confirm locally; remove affected leaves and monitor spread.",
  "status": "completed",
  "confirmedCondition": "Early blight"
}
```

- `status`: `completed | needs_info`.
- `confirmedCondition` optional, but **required** for `completed` when no AI analysis exists.
- `completed` → case `status: "resolved"`, `reviewStatus: "completed"`;
  `needs_info` → case `status: "expert_review"`, `reviewStatus: "needs_info"`.
- When the reviewer is an expert, the case is assigned to them (admin reviews leave the
  existing assignment unchanged). Response `data`: updated `CropCase` including
  `expertReview`. Only an expert review can confirm a condition.

---

## 7. MandiSmart

### `GET /mandi/prices` — any role

Query filters (all optional): `crop`, `mandi`, `state`, `district`, `date` (YYYY-MM-DD),
`dateFrom`, `dateTo`, plus `limit`/`cursor`. Response `data`: `{ items: MandiPrice[], nextToken }`.

`MandiPrice`: `id, crop, state, district, mandi, minPrice, maxPrice, modalPrice, unit,
date, source, dataType ("sample"|"verified"), changePct?, lastUpdatedAt, createdAt, version`.
`meta.simulated` is `true` only when **every** returned record is sample data (each record
also carries its own `dataType`). Sample seed ids are
`PRICE-sample01..06`.

```bash
curl 'http://localhost:4000/mandi/prices?crop=Tomato&state=Maharashtra' \
  -H 'x-dev-user-id: farmer-001' -H 'x-dev-role: farmer'
```

### `GET /mandi/prices/{id}` — any role

Response `data`: single `MandiPrice`.

### `POST /mandi/prices` — admin only (data ingestion) → `201`

```json
{
  "crop": "Tomato", "state": "Maharashtra", "district": "Nashik", "mandi": "Nashik APMC",
  "minPrice": 1400, "maxPrice": 2200, "modalPrice": 1800,
  "date": "2026-11-23", "source": "AGMARKNET (manual entry)", "dataType": "verified"
}
```

`unit` defaults to `INR/quintal`; `changePct` optional. Enforces
`minPrice ≤ modalPrice ≤ maxPrice`. `dataType` must be explicitly `sample` or `verified` —
there is no silent default. This is a manual ingestion endpoint; **no live price feed is connected.**

---

## 8. JalSense

### `POST /farms` — farmer or admin → `201`

```json
{
  "name": "Patil Farm", "location": "Nashik, Maharashtra", "areaHa": 2.5,
  "soilType": "Black cotton", "irrigationType": "Drip",
  "plots": [{ "name": "Plot A", "areaHa": 1.2, "crop": "Tomato", "growthStage": "Flowering" }]
}
```

1–50 plots; server generates plot ids. Response `data`: `Farm` (`id, farmerId, name,
location, areaHa, soilType, irrigationType, plots[], createdAt, updatedAt, version`).

### `GET /farms` — role-scoped (`limit`, `cursor`) → `{ items, nextToken }`

### `GET /farms/{id}` — owner / admin

### `POST /farms/{id}/readings` — farmer (owner) or admin → `201`

```json
{
  "plotId": "PLOT-...",
  "soilMoisture": 28,
  "source": "manual",
  "weather": { "condition": "Partly cloudy", "temperatureC": 27, "rainfallMm": 0 },
  "notes": "Checked at 7am"
}
```

- `soilMoisture`: 0–100 (%). `source`: `manual | simulated` (default `manual`).
- `plotId` must belong to the farm (`400` otherwise).
- Response `data`: `SoilReading` including a rule-based `recommendation`
  (`headline, action ("irrigate-now"|"schedule"|"hold"), waterLitres, durationMin,
  bestWindow, reasoning[], confidenceNote`). These are **advisory estimates**, not live
  telemetry; `meta.simulated` is `true` for `source: "simulated"` readings.

### `GET /farms/{id}/readings` — owner / admin

Query: `plotId` (optional filter), `limit`, `cursor`. Newest first.

---

## 9. GrainGuard

### `POST /storage-batches` — farmer or admin → `201`

```json
{
  "code": "GG-2401", "crop": "Wheat", "quantityKg": 12500, "location": "Nashik Warehouse 1",
  "thresholds": { "minTempC": 10, "maxTempC": 25, "maxHumidity": 65 },
  "initialReading": { "tempC": 22, "humidity": 60, "source": "manual" }
}
```

`minTempC < maxTempC` enforced. `initialReading` optional; if present it is evaluated
against thresholds immediately. Response `data`: `StorageBatch` (`id, ownerId, code, crop,
quantityKg, location, thresholds, currentReading?, status ("normal"|"warning"|"critical"),
createdAt, updatedAt, version`).

### `GET /storage-batches` — role-scoped → `{ items, nextToken }`

### `GET /storage-batches/{id}` — owner / admin

Response `data`: `{ batch: StorageBatch, inspections: Inspection[] }`.

### `POST /storage-batches/{id}/readings` — farmer (owner) or admin → `201`

```json
{ "tempC": 29, "humidity": 74, "source": "manual" }
```

Response `data`: `{ reading: StorageReading, alerts: StorageAlert[], batchStatus: "normal"|"warning"|"critical" }`.
Threshold breaches create alerts (`temperature_high | temperature_low | humidity_high`,
severity `warning | critical`) and update the batch's `status`/`currentReading`. Readings are
submitted values — **no IoT sensor feed is connected**; `source: "simulated"` marks demo data.

### `GET /storage-batches/{id}/alerts` — owner / admin → `{ items, nextToken }`

### `POST /storage-batches/{id}/inspections` — farmer (owner) or admin → `201`

```json
{ "notes": "Ventilation checked; grain dry.", "condition": "normal" }
```

`condition`: `normal | warning | critical`. Response `data`: `Inspection`
(`id, batchId, inspectorId, inspectorName?, notes, condition, createdAt`).

---

## 10. SchemeSaathi

### `GET /schemes` — any role

Query: `q` (text search over name/summary/category/tags), `category`, `state`
(state filter also includes `All India` central schemes), `limit`, `cursor`.
Response `data`: `{ items: Scheme[], nextToken }`. Sample seed ids: `SCHEME-sample01..04`
(PM-KISAN, PMFBY, KCC, Maharashtra drip subsidy), all `dataType: "sample"` with official
`sourceUrl`s.

### `GET /schemes/{id}` — any role

Response `data`: `Scheme` (`id, name, category, state, summary, eligibility[],
eligibilityRules[], documents[], sourceLabel, sourceUrl, tags[], dataType, lastUpdatedAt, ...`).

### `POST /schemes/eligibility-check` — any role

```json
{
  "schemeId": "SCHEME-sample03",
  "profile": { "state": "Maharashtra", "landHoldingHa": 1.5, "annualIncomeINR": 180000, "age": 30, "category": "OBC", "gender": "male" }
}
```

All profile fields optional. Response `data`: `EligibilityCheckResult`:

```json
{
  "schemeId": "SCHEME-sample03",
  "schemeName": "Kisan Credit Card (KCC)",
  "outcome": "likely_eligible",
  "criteria": [{ "description": "...", "result": "met" }],
  "documents": ["..."],
  "sourceLabel": "...",
  "sourceUrl": "https://...",
  "lastUpdatedAt": "...",
  "disclaimer": "Indicative check ... NOT a confirmation of eligibility, benefit amount or approval. ..."
}
```

- `outcome`: `likely_eligible | likely_not_eligible | insufficient_information`.
- Each criterion: `met | not_met | unknown` (missing profile fields → `unknown`).
- **Eligibility is never guaranteed.** The disclaimer is always present; users must verify
  and apply through the official source.

---

## 11. Audit (admin)

### `GET /audit-logs` — admin only

Query: `actorId` (optional), `limit`, `cursor`. Response `data`:
`{ items: AuditEntry[], nextToken }` where `AuditEntry` is
`{ id, actorId, actorRole, action, target, details?, timestamp }`.

Recorded actions include case creation, upload-url issuance, analysis requests, expert
reviews, mandi ingestion, farm/batch creation and readings. Details contain ids/statuses
only — never personal data or credentials.

---

## 12. CORS & headers

- CORS echoes the request `Origin` only if it is in `ALLOWED_ORIGINS` (no wildcard in
  deployed environments). Allowed methods: `GET, POST, OPTIONS`; allowed headers:
  `Content-Type, Authorization, X-Dev-User-Id, X-Dev-Role`.
- Every response carries: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store`,
  `Strict-Transport-Security`, `X-Request-Id`.
- API Gateway stage throttling (design): 25 req/s sustained, burst 50; the analysis route
  is tighter (2 req/s, burst 5) to bound AI cost.