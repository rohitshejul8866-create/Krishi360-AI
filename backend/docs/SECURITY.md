# KRISHI360 AI — Security Notes (Phase 2)

> **Honest scope statement:** this backend implements sensible application-level security
> controls and is unit-tested, but it is **not deployed, not penetration-tested and not
> production-hardened**. Nothing here should be described as "production-grade" or
> "certified". This document records what is implemented, what is designed but awaiting
> AWS, and what is deliberately out of scope for Phase 2.

## 1. Authentication

**Deployed (designed, awaiting deployment):** API Gateway REST API with a Cognito user-pool
authorizer (`template.yaml`). The JWT signature, expiry, issuer and audience are verified
by API Gateway *before* Lambda runs. The backend only reads the verified claims
(`sub`, `cognito:groups`, `name`, `email`) from
`event.requestContext.authorizer.claims` — it never parses or trusts raw tokens, and never
sees passwords.

**Local dev:** `AUTH_MODE=dev` trusts `x-dev-user-id` / `x-dev-role` headers. This is a
developer convenience, **not authentication**. `loadConfig()` throws at startup if
`AUTH_MODE=dev`, `DATA_BACKEND=memory` or `AI_PROVIDER=heuristic` is set inside AWS Lambda
(`AWS_LAMBDA_FUNCTION_NAME` present), so dev escape hatches cannot reach a deployed stack.

**Role resolution:** Cognito groups map to roles with fixed priority
`admin > expert > farmer`. A token with no recognised group is authenticated but
role-less → rejected. Group assignment is an admin operation in Cognito (out of band);
there is no self-service role escalation endpoint.

## 2. Authorisation (server-side, every request)

- Role checks are declared per route (`withHttp({ roles: [...] })`) and enforced before
  any business logic. The frontend's role display is never trusted.
- **Farmers** can only read/write their own cases, farms and storage batches. Ownership is
  checked in the service layer against the authenticated id, not against anything in the
  request body.
- **Experts** can only see cases assigned to them plus the unassigned review queue
  (`status` ∈ `new`, `ai_review`, `expert_review`). They cannot create cases, upload
  images, request analysis, or see resolved cases they were never assigned to.
- **Admin** operations (ingest prices, list all records, read audit logs) are explicit
  admin-only routes — there is no implicit "admin can do everything" bypass in code.
- **Cross-tenant access returns `404 NOT_FOUND`, not `403`**, so probing ids cannot
  distinguish "exists but not yours" from "does not exist" (anti-enumeration).
- Upload keys are pinned: a presigned POST can only write
  `crops/{farmerId}/{caseId}/{uuid}.{ext}`, and an `imageKey` submitted for analysis must
  start with that case's prefix.

## 3. Input validation

- Every endpoint has a **strict Zod schema** for body, query and path params
  (`src/validators/`). Unknown fields are rejected; strings are trimmed and length-bounded;
  numbers are range-checked; enums are closed; dates must be `YYYY-MM-DD`.
- Pagination cursors are treated as untrusted input; malformed cursors → `400`.
- DynamoDB expressions always use `ExpressionAttributeNames`/`Values` — no string
  interpolation of user input into expressions.
- JSON parse failures and validation issues return safe `400` messages with field paths,
  never internals.

## 4. Output safety (AI & data honesty)

- AI analysis is **never a confirmed diagnosis**: `verified` is hard-coded `false`; only an
  expert review can confirm a condition. Every analysis carries a disclaimer.
- **No pesticide/chemical dosage from image analysis.** Three layers: the Bedrock system
  prompt forbids it; a dosage-pattern regex scans the model's explanation/nextSteps and
  replaces them with safe consultation steps if triggered; `nextSteps` are constrained to
  observation/consultation actions. This is defence-in-depth, not a guarantee — regex
  sanitisation can be evaded by creative phrasing, which is why expert review remains
  mandatory in the product flow.
- Bedrock output must match a strict Zod schema or it is **discarded** (`503
  AI_INVALID_OUTPUT`) — invalid model output is never shown to users. Empty responses and
  invocation failures also fail closed.
- `AI_PROVIDER=disabled` is the default: the analysis endpoint returns `503
  AI_NOT_CONFIGURED` rather than silently faking a result. The local `heuristic` provider
  is deterministic, labelled `simulated: true`, and refused in Lambda.
- Sample mandi prices and schemes carry `dataType: "sample"`; readings carry
  `source: "manual" | "simulated"`; envelope `meta.simulated` flags fully-simulated pages.
- Scheme eligibility outcomes are `likely_eligible / likely_not_eligible /
  insufficient_information` with a permanent disclaimer — never a guarantee.

## 5. Data protection

- **S3 uploads:** private bucket (all four public-access blocks, `BucketOwnerEnforced`,
  SSE-AES256, versioning). Presigned POST policies enforce `content-length-range`
  (1..`MAX_UPLOAD_BYTES`, default 5 MB), exact `Content-Type` (jpeg/png/webp only) and the
  pinned key — S3 itself rejects non-conforming uploads. URLs expire (default 300 s).
  Objects are referenced by key, never by public URL.
- **DynamoDB:** SSE enabled; PITR in prod; `DeletionPolicy: Retain` on table and bucket.
- **Secrets:** none in code or repo. AWS credentials come from IAM execution roles
  (Lambda) or `AWS_PROFILE`/SSO (developer machine). `.env` is gitignored;
  `.env.example` contains placeholders only.
- **Least-privilege IAM** (per-function policies in `template.yaml`): each Lambda gets
  only the table actions it needs (read-only functions get `GetItem`/`Query`/`Scan` only),
  the upload bucket is scoped to the `crops/` prefix, and `bedrock:InvokeModel` is granted
  only when `AiProvider=bedrock` and only for the configured model ARN. No `*` resource
  grants for data services.
- **Errors & logs:** clients get safe messages + `requestId`; stack traces and raw errors
  stay in CloudWatch. Structured logs carry ids/statuses, not personal data. Audit entries
  store non-sensitive context only.

## 6. Transport & HTTP hygiene

- HTTPS only via API Gateway; responses set `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer`, `Cache-Control: no-store`.
- CORS is an explicit origin allowlist (`ALLOWED_ORIGINS`); wildcard origins are refused
  in deployed environments. CORS is a browser convenience, **not** an access control —
  auth is enforced regardless of origin.
- API Gateway stage throttling (25 req/s sustained, burst 50; analysis route 2 req/s,
  burst 5) bounds abuse and AI cost. This is coarse rate limiting, not per-user quotas.

## 7. Known limitations (deliberate, documented)

1. **No WAF, no per-user rate limits, no bot protection** — add AWS WAF + usage plans
   before public exposure.
2. **No MFA enforcement in code** — Cognito pool settings can require MFA; decide at
   deployment time. Admin accounts should always use MFA.
3. **Request body size** is bounded by API Gateway's 10 MB payload limit and Zod string
   bounds, not by an explicit app-level byte counter.
4. **Dev auth trusts headers** — acceptable only because it cannot run in Lambda; the
   local server should never be exposed to a network you don't control.
5. **Dosage regex is heuristic** — see §4; the real control is mandatory expert review.
6. **No image content scanning** (malware/EXIF stripping). Files are private and served
   to no one directly, but consider EXIF stripping (location privacy!) and content
   validation before production.
7. **Audit trail is application-level**, append-only by convention — not a tamper-proof
   ledger. Admin-only read access; consider CloudTrail data events / immutable exports later.
8. **No transactions across multi-item writes** (see DATABASE_SCHEMA.md).
9. **Not security-tested.** No penetration test, dependency audit gate, or threat-model
   review has been performed. Run `npm audit` and a review before any deployment.
10. **Cognito pool hardening** (password policy, advanced security mode, token lifetimes)
    is set to reasonable defaults in `template.yaml` but must be reviewed against your
    requirements at deployment.

## 8. Reporting

If you find a security issue in this codebase, fix it in `backend/` with a regression test
in `backend/tests/` — several existing suites (`auth.test.ts`, `middleware.test.ts`,
`cropDoctor.test.ts`, `upload.test.ts`, `bedrock.test.ts`) exist precisely to lock these
behaviours in.