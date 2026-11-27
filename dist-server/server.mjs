// server.ts
import "dotenv/config";
import express from "express";
import fs2 from "node:fs";
import http from "node:http";
import path3 from "node:path";
import { randomUUID as randomUUID5 } from "node:crypto";
import { createServer as createViteServer } from "vite";

// backend/src/config/env.ts
import path from "node:path";
var ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
function oneOf(value, allowed, fallback, name) {
  if (value === void 0 || value === "") return fallback;
  if (allowed.includes(value)) return value;
  throw new Error(`Invalid ${name}: "${value}". Allowed: ${allowed.join(", ")}`);
}
function positiveInt(value, fallback, name) {
  if (value === void 0 || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${name}: must be a positive integer`);
  return n;
}
function optionalHttpUrl(value, name) {
  if (!value || !value.trim()) return void 0;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`Invalid ${name}: must be a valid URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid ${name}: must use http or https protocol.`);
  }
  return parsed.toString().replace(/\/+$/, "");
}
function loadConfig(env = process.env) {
  const isLambda = Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
  const nodeEnv = env.NODE_ENV ?? (isLambda ? "production" : "local");
  const authMode = oneOf(
    env.AUTH_MODE,
    ["dev", "session", "cognito"],
    isLambda ? "session" : "dev",
    "AUTH_MODE"
  );
  const dataBackend = oneOf(
    env.DATA_BACKEND,
    ["memory", "sqlite", "dynamodb"],
    isLambda ? "dynamodb" : "sqlite",
    "DATA_BACKEND"
  );
  const aiProvider = oneOf(
    env.AI_PROVIDER,
    ["disabled", "heuristic", "bedrock", "gemini"],
    "disabled",
    "AI_PROVIDER"
  );
  if (isLambda && (authMode === "dev" || dataBackend !== "dynamodb" || aiProvider === "heuristic")) {
    throw new Error("Refusing to start: dev-only AUTH_MODE/DATA_BACKEND/AI_PROVIDER cannot be used inside AWS Lambda.");
  }
  const rawSqlitePath = env.SQLITE_DB_PATH?.trim();
  const sqliteDbPath = rawSqlitePath === ":memory:" ? ":memory:" : path.resolve(process.cwd(), rawSqlitePath || ".data/krishi360.db");
  const awsRegion = env.AWS_REGION || env.AWS_DEFAULT_REGION || "ap-south-1";
  const dynamoEndpoint = optionalHttpUrl(env.DYNAMODB_ENDPOINT, "DYNAMODB_ENDPOINT");
  const awsCredentialsConfigured = isLambda || Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) || Boolean(env.AWS_WEB_IDENTITY_TOKEN_FILE) || Boolean(env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || env.AWS_CONTAINER_CREDENTIALS_FULL_URI) || Boolean(env.AWS_ECS_CONTAINER_METADATA_URI_V4 || env.AWS_PROFILE || env.AWS_ROLE_ARN) || Boolean(dynamoEndpoint);
  const bedrockBearerTokenConfigured = Boolean(
    env.AWS_BEARER_TOKEN_BEDROCK?.trim() || env.AWS_BEARER_TOKEN?.trim()
  );
  const bedrockModelId = env.BEDROCK_MODEL_ID?.trim() || (bedrockBearerTokenConfigured ? "amazon.nova-lite-v1:0" : "");
  if (aiProvider === "bedrock" && (!bedrockModelId || !awsRegion)) {
    throw new Error("AI_PROVIDER=bedrock requires BEDROCK_MODEL_ID and AWS_REGION to be configured.");
  }
  const geminiApiKeyConfigured = Boolean(env.GEMINI_API_KEY?.trim());
  const geminiModelId = env.GEMINI_MODEL_ID?.trim() || "gemini-4-hydrogen";
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean);
  if (isLambda && allowedOrigins.includes("*")) {
    throw new Error("Wildcard CORS origin is not allowed in deployed environments.");
  }
  return {
    nodeEnv,
    isLambda,
    authMode,
    dataBackend,
    sqliteDbPath,
    awsRegion,
    usersTableName: env.DYNAMODB_USERS_TABLE_NAME?.trim() || "krishi360-users-dev",
    flagTableName: env.DYNAMODB_FLAG_TABLE_NAME?.trim() || env.DYNAMODB_TABLE_NAME?.trim() || "krishi360-flag-dev",
    tableName: env.DYNAMODB_FLAG_TABLE_NAME?.trim() || env.DYNAMODB_TABLE_NAME?.trim() || "krishi360-flag-dev",
    dynamoEndpoint,
    awsCredentialsConfigured,
    uploadBucketName: env.UPLOAD_BUCKET_NAME ?? "",
    allowedOrigins,
    maxUploadBytes: positiveInt(env.MAX_UPLOAD_BYTES, 5 * 1024 * 1024, "MAX_UPLOAD_BYTES"),
    uploadUrlExpirySeconds: positiveInt(env.UPLOAD_URL_EXPIRY_SECONDS, 300, "UPLOAD_URL_EXPIRY_SECONDS"),
    allowedImageTypes: ALLOWED_IMAGE_TYPES,
    aiProvider,
    bedrockModelId,
    bedrockBearerTokenConfigured,
    geminiModelId,
    geminiApiKeyConfigured,
    logLevel: oneOf(env.LOG_LEVEL, ["debug", "info", "warn", "error"], "info", "LOG_LEVEL"),
    port: positiveInt(env.PORT, 4e3, "PORT")
  };
}

// backend/src/utils/ids.ts
import { randomUUID } from "node:crypto";
function makeId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function dateKey(iso = nowIso()) {
  return iso.slice(0, 10);
}

// backend/src/repositories/dynamo/helpers.ts
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

// backend/src/utils/errors.ts
var AppError = class extends Error {
  statusCode;
  code;
  details;
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
};
var ValidationError = class extends AppError {
  constructor(message, details) {
    super(400, "VALIDATION_ERROR", message, details);
  }
};
var UnauthorizedError = class extends AppError {
  constructor(message = "Authentication is required.") {
    super(401, "UNAUTHORIZED", message);
  }
};
var ForbiddenError = class extends AppError {
  constructor(message = "You do not have permission to perform this operation.") {
    super(403, "FORBIDDEN", message);
  }
};
var NotFoundError = class extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(404, "NOT_FOUND", message);
  }
};
var ConflictError = class extends AppError {
  constructor(message = "The resource was modified concurrently. Reload and retry.") {
    super(409, "CONFLICT", message);
  }
};
var PayloadTooLargeError = class extends AppError {
  constructor(message) {
    super(400, "PAYLOAD_TOO_LARGE", message);
  }
};
var UnsupportedMediaTypeError = class extends AppError {
  constructor(message) {
    super(415, "UNSUPPORTED_MEDIA_TYPE", message);
  }
};
var ServiceUnavailableError = class extends AppError {
  constructor(code, message) {
    super(503, code, message);
  }
};

// backend/src/utils/pagination.ts
function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function decodeCursor(cursor) {
  if (!cursor) return void 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    throw new Error("not an object");
  } catch {
    throw new ValidationError("Invalid pagination cursor.");
  }
}

// backend/src/repositories/dynamo/helpers.ts
async function putItem(client, table, keys3, data) {
  await client.send(new PutCommand({ TableName: table, Item: { ...keys3, data } }));
}
async function getItem(client, table, pk, sk = "META") {
  const res = await client.send(new GetCommand({ TableName: table, Key: { pk, sk }, ConsistentRead: true }));
  return res.Item?.data ?? null;
}
async function updateItem(client, table, keys3, data, expectedVersion) {
  try {
    await client.send(
      new PutCommand({
        TableName: table,
        Item: { ...keys3, data },
        ConditionExpression: "attribute_exists(pk) AND #data.#version = :expected",
        ExpressionAttributeNames: { "#data": "data", "#version": "version" },
        ExpressionAttributeValues: { ":expected": expectedVersion }
      })
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw new ConflictError();
    throw err;
  }
}
function mergeExpressions(spec) {
  return {
    ...spec.indexName ? { IndexName: spec.indexName } : {},
    KeyConditionExpression: spec.keyCondition,
    ...spec.filter ? { FilterExpression: spec.filter } : {},
    ...Object.keys(spec.names).length > 0 ? { ExpressionAttributeNames: spec.names } : {},
    ...Object.keys(spec.values).length > 0 ? { ExpressionAttributeValues: spec.values } : {},
    ScanIndexForward: spec.scanForward ?? false
  };
}
async function queryPage(client, table, spec, page) {
  const startKey = decodeCursor(page.cursor);
  const res = await client.send(
    new QueryCommand({
      TableName: table,
      Limit: page.limit,
      ...startKey ? { ExclusiveStartKey: startKey } : {},
      ...mergeExpressions(spec)
    })
  );
  return {
    items: (res.Items ?? []).map((i) => i.data),
    nextToken: res.LastEvaluatedKey ? encodeCursor(res.LastEvaluatedKey) : null
  };
}
async function scanPage(client, table, page, filter) {
  const startKey = decodeCursor(page.cursor);
  const res = await client.send(
    new ScanCommand({
      TableName: table,
      Limit: page.limit,
      ...startKey ? { ExclusiveStartKey: startKey } : {},
      ...filter ? {
        FilterExpression: filter.expression,
        ...Object.keys(filter.names).length > 0 ? { ExpressionAttributeNames: filter.names } : {},
        ...Object.keys(filter.values).length > 0 ? { ExpressionAttributeValues: filter.values } : {}
      } : {}
    })
  );
  return {
    items: (res.Items ?? []).map((i) => i.data),
    nextToken: res.LastEvaluatedKey ? encodeCursor(res.LastEvaluatedKey) : null
  };
}

// backend/src/repositories/dynamo/auditRepo.ts
var DynamoAuditRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  put(entry) {
    return putItem(
      this.client,
      this.table,
      {
        pk: `AUDIT#${dateKey(entry.timestamp)}`,
        sk: `${entry.timestamp}#${entry.id}`,
        gsi1pk: `ACTOR#${entry.actorId}`,
        gsi1sk: entry.timestamp
      },
      entry
    );
  }
  list(page, actorId) {
    if (actorId) {
      return queryPage(this.client, this.table, {
        indexName: "gsi1",
        keyCondition: "gsi1pk = :actor",
        names: {},
        values: { ":actor": `ACTOR#${actorId}` }
      }, page);
    }
    return scanPage(this.client, this.table, page, {
      expression: "begins_with(pk, :prefix)",
      names: {},
      values: { ":prefix": "AUDIT#" }
    });
  }
};

// backend/src/repositories/dynamo/client.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
var baseClient;
var docClient;
function getBaseDynamoClient(config) {
  if (!baseClient) {
    baseClient = new DynamoDBClient({
      region: config.awsRegion,
      ...config.dynamoEndpoint ? { endpoint: config.dynamoEndpoint } : {}
    });
  }
  return baseClient;
}
function getDocClient(config) {
  if (!docClient) {
    const base = getBaseDynamoClient(config);
    docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true }
    });
  }
  return docClient;
}

// backend/src/repositories/dynamo/cropCaseRepo.ts
function caseKeys(c) {
  return {
    pk: `CASE#${c.id}`,
    sk: "META",
    gsi1pk: `FARMER#${c.farmerId}`,
    gsi1sk: `${c.createdAt}#${c.id}`,
    gsi2pk: "EXPERTQUEUE",
    gsi2sk: `${c.assignedExpertId ?? "UNASSIGNED"}#${c.createdAt}#${c.id}`
  };
}
var DynamoCropCaseRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  create(item) {
    return putItem(this.client, this.table, caseKeys(item), item);
  }
  get(id) {
    return getItem(this.client, this.table, `CASE#${id}`);
  }
  async update(item, expectedVersion) {
    await updateItem(this.client, this.table, caseKeys(item), item, expectedVersion);
  }
  listByFarmer(farmerId, page, status) {
    return queryPage(this.client, this.table, {
      indexName: "gsi1",
      keyCondition: "gsi1pk = :owner",
      filter: status ? "begins_with(pk, :pkPrefix) AND #data.#status = :status" : "begins_with(pk, :pkPrefix)",
      names: status ? { "#data": "data", "#status": "status" } : {},
      values: {
        ":owner": `FARMER#${farmerId}`,
        ":pkPrefix": "CASE#",
        ...status ? { ":status": status } : {}
      }
    }, page);
  }
  listForExpert(expertId, page, status) {
    const queue = "(attribute_not_exists(#data.#assigned) AND #data.#status IN (:qNew, :qAi, :qExpert))";
    const access = `(#data.#assigned = :me OR ${queue})`;
    const filter = status ? `${access} AND #data.#status = :status` : access;
    return queryPage(this.client, this.table, {
      indexName: "gsi2",
      keyCondition: "gsi2pk = :queue",
      filter,
      names: { "#data": "data", "#assigned": "assignedExpertId", "#status": "status" },
      values: {
        ":queue": "EXPERTQUEUE",
        ":me": expertId,
        ":qNew": "new",
        ":qAi": "ai_review",
        ":qExpert": "expert_review",
        ...status ? { ":status": status } : {}
      }
    }, page);
  }
  listAll(page, status) {
    const expression = status ? "begins_with(pk, :prefix) AND #data.#status = :status" : "begins_with(pk, :prefix)";
    return scanPage(this.client, this.table, page, {
      expression,
      names: { "#data": "data", "#status": "status" },
      values: { ":prefix": "CASE#", ...status ? { ":status": status } : {} }
    });
  }
};

// backend/src/repositories/dynamo/farmRepo.ts
function farmKeys(f) {
  return {
    pk: `FARM#${f.id}`,
    sk: "META",
    gsi1pk: `FARMER#${f.farmerId}`,
    gsi1sk: `${f.createdAt}#${f.id}`
  };
}
var DynamoFarmRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  create(item) {
    return putItem(this.client, this.table, farmKeys(item), item);
  }
  get(id) {
    return getItem(this.client, this.table, `FARM#${id}`);
  }
  update(item, expectedVersion) {
    return updateItem(this.client, this.table, farmKeys(item), item, expectedVersion);
  }
  listByOwner(ownerId, page) {
    return queryPage(this.client, this.table, {
      indexName: "gsi1",
      keyCondition: "gsi1pk = :owner",
      filter: "begins_with(pk, :pkPrefix)",
      names: {},
      values: { ":owner": `FARMER#${ownerId}`, ":pkPrefix": "FARM#" }
    }, page);
  }
  listAll(page) {
    return scanPage(this.client, this.table, page, {
      expression: "begins_with(pk, :prefix) AND sk = :meta",
      names: {},
      values: { ":prefix": "FARM#", ":meta": "META" }
    });
  }
  addReading(r) {
    return putItem(this.client, this.table, { pk: `FARM#${r.farmId}`, sk: `READING#${r.createdAt}#${r.id}` }, r);
  }
  listReadings(farmId, plotId, page) {
    return queryPage(this.client, this.table, {
      keyCondition: "pk = :farm AND begins_with(sk, :prefix)",
      ...plotId ? { filter: "#data.#plotId = :plotId" } : {},
      names: { "#data": "data", "#plotId": "plotId" },
      values: { ":farm": `FARM#${farmId}`, ":prefix": "READING#", ...plotId ? { ":plotId": plotId } : {} }
    }, page);
  }
};

// backend/src/repositories/dynamo/mandiRepo.ts
function keys(p) {
  return {
    pk: `PRICE#${p.id}`,
    sk: "META",
    gsi1pk: `CROP#${p.crop}`,
    gsi1sk: `${p.date}#${p.state}#${p.mandi}#${p.id}`,
    gsi2pk: `STATE#${p.state}`,
    gsi2sk: `${p.date}#${p.crop}#${p.id}`
  };
}
var DynamoMandiRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  put(item) {
    return putItem(this.client, this.table, keys(item), item);
  }
  get(id) {
    return getItem(this.client, this.table, `PRICE#${id}`);
  }
  query(filters, page) {
    const names = { "#data": "data" };
    const values = {};
    const filtersExpr = [];
    const addEq = (field, value, token) => {
      if (!value) return;
      names[`#${field}`] = field;
      values[token] = value;
      filtersExpr.push(`#data.#${field} = ${token}`);
    };
    const dateCondition = (skAttr) => {
      if (filters.date) {
        values[":datePrefix"] = `${filters.date}#`;
        return `begins_with(${skAttr}, :datePrefix)`;
      }
      if (filters.dateFrom && filters.dateTo) {
        values[":from"] = filters.dateFrom;
        values[":to"] = `${filters.dateTo}#~`;
        return `${skAttr} BETWEEN :from AND :to`;
      }
      if (filters.dateFrom) {
        values[":from"] = filters.dateFrom;
        return `${skAttr} >= :from`;
      }
      if (filters.dateTo) {
        values[":to"] = `${filters.dateTo}#~`;
        return `${skAttr} <= :to`;
      }
      return "";
    };
    if (filters.crop) {
      addEq("state", filters.state, ":state");
      addEq("district", filters.district, ":district");
      addEq("mandi", filters.mandi, ":mandi");
      const dc = dateCondition("gsi1sk");
      const spec = {
        indexName: "gsi1",
        keyCondition: `gsi1pk = :crop${dc ? ` AND ${dc}` : ""}`,
        ...filtersExpr.length ? { filter: filtersExpr.join(" AND ") } : {},
        names,
        values: { ...values, ":crop": `CROP#${filters.crop}` }
      };
      return queryPage(this.client, this.table, spec, page);
    }
    if (filters.state) {
      addEq("district", filters.district, ":district");
      addEq("mandi", filters.mandi, ":mandi");
      const dc = dateCondition("gsi2sk");
      const spec = {
        indexName: "gsi2",
        keyCondition: `gsi2pk = :state${dc ? ` AND ${dc}` : ""}`,
        ...filtersExpr.length ? { filter: filtersExpr.join(" AND ") } : {},
        names,
        values: { ...values, ":state": `STATE#${filters.state}` }
      };
      return queryPage(this.client, this.table, spec, page);
    }
    addEq("crop", filters.crop, ":crop");
    addEq("district", filters.district, ":district");
    addEq("mandi", filters.mandi, ":mandi");
    if (filters.date) {
      names["#date"] = "date";
      values[":date"] = filters.date;
      filtersExpr.push("#data.#date = :date");
    }
    const expression = ["begins_with(pk, :prefix)", ...filtersExpr].join(" AND ");
    return scanPage(this.client, this.table, page, {
      expression,
      names,
      values: { ...values, ":prefix": "PRICE#" }
    });
  }
};

// backend/src/repositories/dynamo/schemeRepo.ts
import { PutCommand as PutCommand2 } from "@aws-sdk/lib-dynamodb";
function keys2(s) {
  return {
    pk: `SCHEME#${s.id}`,
    sk: "META",
    gsi1pk: `CATEGORY#${s.category}`,
    gsi1sk: `${s.state}#${s.name}#${s.id}`
  };
}
function searchText(s) {
  return [s.name, s.summary, s.category, ...s.tags].join(" ").toLowerCase();
}
var DynamoSchemeRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  async put(item) {
    await this.client.send(
      new PutCommand2({
        TableName: this.table,
        Item: { ...keys2(item), searchText: searchText(item), data: item }
      })
    );
  }
  get(id) {
    return getItem(this.client, this.table, `SCHEME#${id}`);
  }
  list(filters, page) {
    const names = { "#data": "data", "#state": "state" };
    const values = {};
    const expr = [];
    if (filters.state) {
      values[":state"] = filters.state;
      values[":allIndia"] = "All India";
      expr.push("(#data.#state = :state OR #data.#state = :allIndia)");
    }
    if (filters.q) {
      names["#search"] = "searchText";
      values[":q"] = filters.q.toLowerCase();
      expr.push("contains(#search, :q)");
    }
    if (filters.category) {
      return queryPage(this.client, this.table, {
        indexName: "gsi1",
        keyCondition: "gsi1pk = :category",
        ...expr.length ? { filter: expr.join(" AND ") } : {},
        names,
        values: { ...values, ":category": `CATEGORY#${filters.category}` },
        scanForward: true
      }, page);
    }
    return scanPage(this.client, this.table, page, {
      expression: ["begins_with(pk, :prefix)", ...expr].join(" AND "),
      names,
      values: { ...values, ":prefix": "SCHEME#" }
    });
  }
};

// backend/src/repositories/dynamo/storageRepo.ts
function batchKeys(b) {
  return {
    pk: `BATCH#${b.id}`,
    sk: "META",
    gsi1pk: `FARMER#${b.ownerId}`,
    gsi1sk: `${b.createdAt}#${b.id}`
  };
}
var DynamoStorageRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  createBatch(item) {
    return putItem(this.client, this.table, batchKeys(item), item);
  }
  getBatch(id) {
    return getItem(this.client, this.table, `BATCH#${id}`);
  }
  updateBatch(item, expectedVersion) {
    return updateItem(this.client, this.table, batchKeys(item), item, expectedVersion);
  }
  listByOwner(ownerId, page) {
    return queryPage(this.client, this.table, {
      indexName: "gsi1",
      keyCondition: "gsi1pk = :owner",
      filter: "begins_with(pk, :pkPrefix)",
      names: {},
      values: { ":owner": `FARMER#${ownerId}`, ":pkPrefix": "BATCH#" }
    }, page);
  }
  listAll(page) {
    return scanPage(this.client, this.table, page, {
      expression: "begins_with(pk, :prefix) AND sk = :meta",
      names: {},
      values: { ":prefix": "BATCH#", ":meta": "META" }
    });
  }
  addReading(r) {
    return putItem(this.client, this.table, { pk: `BATCH#${r.batchId}`, sk: `READING#${r.createdAt}#${r.id}` }, r);
  }
  listReadings(batchId, page) {
    return queryPage(this.client, this.table, {
      keyCondition: "pk = :batch AND begins_with(sk, :prefix)",
      names: {},
      values: { ":batch": `BATCH#${batchId}`, ":prefix": "READING#" }
    }, page);
  }
  addAlert(a) {
    return putItem(this.client, this.table, { pk: `BATCH#${a.batchId}`, sk: `ALERT#${a.createdAt}#${a.id}` }, a);
  }
  listAlerts(batchId, page) {
    return queryPage(this.client, this.table, {
      keyCondition: "pk = :batch AND begins_with(sk, :prefix)",
      names: {},
      values: { ":batch": `BATCH#${batchId}`, ":prefix": "ALERT#" }
    }, page);
  }
  addInspection(i) {
    return putItem(this.client, this.table, { pk: `BATCH#${i.batchId}`, sk: `INSPECTION#${i.createdAt}#${i.id}` }, i);
  }
  async listInspections(batchId) {
    const page = await queryPage(this.client, this.table, {
      keyCondition: "pk = :batch AND begins_with(sk, :prefix)",
      names: {},
      values: { ":batch": `BATCH#${batchId}`, ":prefix": "INSPECTION#" }
    }, { limit: 100 });
    return page.items;
  }
};

// backend/src/models/user.ts
function toPublicUser(user) {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
function splitUserAccount(user) {
  return {
    login: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      ...user.passwordHash ? { passwordHash: user.passwordHash } : {},
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version
    },
    profile: {
      id: user.id,
      name: user.name,
      location: user.location,
      phone: user.phone,
      avatar: user.avatar,
      ...user.specialisation ? { specialisation: user.specialisation } : {},
      ...user.organisation ? { organisation: user.organisation } : {},
      joinedAt: user.joinedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      version: user.version
    }
  };
}
function mergeUserAccount(login, profile) {
  const fallbackName = login.email.split("@")[0] || "User";
  return {
    id: login.id,
    email: login.email,
    role: login.role,
    status: login.status,
    ...login.passwordHash ? { passwordHash: login.passwordHash } : {},
    name: profile?.name ?? fallbackName,
    location: profile?.location ?? "India",
    phone: profile?.phone ?? "Not provided",
    avatar: profile?.avatar ?? fallbackName.slice(0, 2).toUpperCase(),
    ...profile?.specialisation ? { specialisation: profile.specialisation } : {},
    ...profile?.organisation ? { organisation: profile.organisation } : {},
    joinedAt: profile?.joinedAt ?? login.createdAt.slice(0, 10),
    createdAt: login.createdAt,
    updatedAt: login.updatedAt,
    version: login.version
  };
}

// backend/src/repositories/dynamo/userRepo.ts
function userLoginKeys(u) {
  return {
    pk: `USER#${u.id}`,
    sk: "LOGIN",
    gsi1pk: `EMAIL#${u.email.toLowerCase()}`,
    gsi1sk: `USER#${u.id}`,
    gsi2pk: `ROLE#${u.role}`,
    gsi2sk: `${u.createdAt}#${u.id}`
  };
}
function userProfileKeys(p) {
  return {
    pk: `USER_PROFILE#${p.id}`,
    sk: "META",
    gsi1pk: `PROFILE#${p.id}`,
    gsi1sk: p.updatedAt
  };
}
var DynamoUserRepository = class {
  constructor(client, usersTable, flagTable) {
    this.client = client;
    this.usersTable = usersTable;
    this.flagTable = flagTable;
  }
  async create(item) {
    const { login, profile } = splitUserAccount(item);
    await putItem(this.client, this.usersTable, userLoginKeys(login), login);
    await putItem(this.client, this.flagTable, userProfileKeys(profile), profile);
  }
  async get(id) {
    const [login, profile] = await Promise.all([
      getItem(this.client, this.usersTable, `USER#${id}`, "LOGIN"),
      getItem(this.client, this.flagTable, `USER_PROFILE#${id}`, "META")
    ]);
    if (!login) return null;
    return mergeUserAccount(login, profile);
  }
  async getByEmail(email) {
    const res = await queryPage(
      this.client,
      this.usersTable,
      {
        indexName: "gsi1",
        keyCondition: "gsi1pk = :email",
        filter: "begins_with(pk, :pkPrefix)",
        names: {},
        values: {
          ":email": `EMAIL#${email.trim().toLowerCase()}`,
          ":pkPrefix": "USER#"
        }
      },
      { limit: 1 }
    );
    const login = res.items[0];
    if (!login) return null;
    const profile = await getItem(
      this.client,
      this.flagTable,
      `USER_PROFILE#${login.id}`,
      "META"
    );
    return mergeUserAccount(login, profile);
  }
  async update(item, expectedVersion) {
    const { login, profile } = splitUserAccount(item);
    await updateItem(this.client, this.usersTable, userLoginKeys(login), login, expectedVersion);
    await putItem(this.client, this.flagTable, userProfileKeys(profile), profile);
  }
  async list(page, role) {
    const loginPage = role ? await queryPage(
      this.client,
      this.usersTable,
      {
        indexName: "gsi2",
        keyCondition: "gsi2pk = :role",
        filter: "begins_with(pk, :pkPrefix)",
        names: {},
        values: { ":role": `ROLE#${role}`, ":pkPrefix": "USER#" }
      },
      page
    ) : await scanPage(this.client, this.usersTable, page, {
      expression: "begins_with(pk, :prefix) AND sk = :loginSk",
      names: {},
      values: { ":prefix": "USER#", ":loginSk": "LOGIN" }
    });
    const items = await Promise.all(
      loginPage.items.map(async (login) => {
        const profile = await getItem(
          this.client,
          this.flagTable,
          `USER_PROFILE#${login.id}`,
          "META"
        );
        return mergeUserAccount(login, profile);
      })
    );
    return { items, nextToken: loginPage.nextToken };
  }
};

// backend/src/repositories/dynamo/workspaceRepo.ts
var DynamoWorkspaceRepository = class {
  constructor(client, table) {
    this.client = client;
    this.table = table;
  }
  getUserWorkspace(userId) {
    return getItem(this.client, this.table, `WORKSPACE#${userId}`);
  }
  saveUserWorkspace(state) {
    return putItem(
      this.client,
      this.table,
      {
        pk: `WORKSPACE#${state.userId}`,
        sk: "META",
        gsi1pk: `WORKSPACE_USER#${state.userId}`,
        gsi1sk: state.updatedAt
      },
      state
    );
  }
  listNotifications(page) {
    return scanPage(this.client, this.table, page, {
      expression: "begins_with(pk, :prefix) AND sk = :meta",
      names: {},
      values: { ":prefix": "NOTIF#", ":meta": "META" }
    });
  }
  putNotification(item) {
    return putItem(
      this.client,
      this.table,
      {
        pk: `NOTIF#${item.id}`,
        sk: "META",
        gsi1pk: `NOTIF_AUDIENCE#${item.audience}`,
        gsi1sk: `${item.createdAt}#${item.id}`
      },
      item
    );
  }
  getPlatformSettings() {
    return getItem(this.client, this.table, "SETTINGS#global");
  }
  savePlatformSettings(settings) {
    return putItem(
      this.client,
      this.table,
      {
        pk: "SETTINGS#global",
        sk: "META"
      },
      settings
    );
  }
};

// backend/src/repositories/memory/index.ts
function paginate(sorted, page) {
  const cursor = decodeCursor(page.cursor);
  const offset = cursor?.offset ?? 0;
  const items = sorted.slice(offset, offset + page.limit);
  const next = offset + page.limit;
  return { items, nextToken: next < sorted.length ? encodeCursor({ offset: next }) : null };
}
var byNewest = (a, b) => b.createdAt.localeCompare(a.createdAt);
var MemoryCropCaseRepository = class {
  items = /* @__PURE__ */ new Map();
  async create(item) {
    this.items.set(item.id, structuredClone(item));
  }
  async get(id) {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }
  async update(item, expectedVersion) {
    const existing = this.items.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.items.set(item.id, structuredClone(item));
  }
  async listByFarmer(farmerId, page, status) {
    const all = [...this.items.values()].filter((c) => c.farmerId === farmerId && (!status || c.status === status));
    return paginate(all.sort(byNewest), page);
  }
  async listForExpert(expertId, page, status) {
    const queueStatuses = /* @__PURE__ */ new Set(["new", "ai_review", "expert_review"]);
    const all = [...this.items.values()].filter(
      (c) => (c.assignedExpertId === expertId || c.assignedExpertId === void 0 && queueStatuses.has(c.status)) && (!status || c.status === status)
    );
    return paginate(all.sort(byNewest), page);
  }
  async listAll(page, status) {
    const all = [...this.items.values()].filter((c) => !status || c.status === status);
    return paginate(all.sort(byNewest), page);
  }
};
var MemoryMandiRepository = class {
  items = /* @__PURE__ */ new Map();
  async put(item) {
    this.items.set(item.id, structuredClone(item));
  }
  async get(id) {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }
  async query(filters, page) {
    const all = [...this.items.values()].filter((p) => {
      if (filters.crop && p.crop !== filters.crop) return false;
      if (filters.state && p.state !== filters.state) return false;
      if (filters.district && p.district !== filters.district) return false;
      if (filters.mandi && p.mandi !== filters.mandi) return false;
      if (filters.date && p.date !== filters.date) return false;
      if (filters.dateFrom && p.date < filters.dateFrom) return false;
      if (filters.dateTo && p.date > filters.dateTo) return false;
      return true;
    });
    return paginate(all.sort((a, b) => b.date.localeCompare(a.date)), page);
  }
};
var MemoryFarmRepository = class {
  farms = /* @__PURE__ */ new Map();
  readings = [];
  async create(item) {
    this.farms.set(item.id, structuredClone(item));
  }
  async get(id) {
    const found = this.farms.get(id);
    return found ? structuredClone(found) : null;
  }
  async update(item, expectedVersion) {
    const existing = this.farms.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.farms.set(item.id, structuredClone(item));
  }
  async listByOwner(ownerId, page) {
    return paginate([...this.farms.values()].filter((f) => f.farmerId === ownerId).sort(byNewest), page);
  }
  async listAll(page) {
    return paginate([...this.farms.values()].sort(byNewest), page);
  }
  async addReading(reading) {
    this.readings.push(structuredClone(reading));
  }
  async listReadings(farmId, plotId, page) {
    const all = this.readings.filter((r) => r.farmId === farmId && (!plotId || r.plotId === plotId));
    return paginate(all.sort(byNewest), page);
  }
};
var MemoryStorageRepository = class {
  batches = /* @__PURE__ */ new Map();
  readings = [];
  alerts = [];
  inspections = [];
  async createBatch(item) {
    this.batches.set(item.id, structuredClone(item));
  }
  async getBatch(id) {
    const found = this.batches.get(id);
    return found ? structuredClone(found) : null;
  }
  async updateBatch(item, expectedVersion) {
    const existing = this.batches.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.batches.set(item.id, structuredClone(item));
  }
  async listByOwner(ownerId, page) {
    return paginate([...this.batches.values()].filter((b) => b.ownerId === ownerId).sort(byNewest), page);
  }
  async listAll(page) {
    return paginate([...this.batches.values()].sort(byNewest), page);
  }
  async addReading(reading) {
    this.readings.push(structuredClone(reading));
  }
  async listReadings(batchId, page) {
    return paginate(this.readings.filter((r) => r.batchId === batchId).sort(byNewest), page);
  }
  async addAlert(alert) {
    this.alerts.push(structuredClone(alert));
  }
  async listAlerts(batchId, page) {
    return paginate(this.alerts.filter((a) => a.batchId === batchId).sort(byNewest), page);
  }
  async addInspection(inspection) {
    this.inspections.push(structuredClone(inspection));
  }
  async listInspections(batchId) {
    return this.inspections.filter((i) => i.batchId === batchId).sort(byNewest);
  }
};
var MemorySchemeRepository = class {
  items = /* @__PURE__ */ new Map();
  async put(item) {
    this.items.set(item.id, structuredClone(item));
  }
  async get(id) {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }
  async list(filters, page) {
    const q = filters.q?.toLowerCase();
    const all = [...this.items.values()].filter((s) => {
      if (filters.category && s.category !== filters.category) return false;
      if (filters.state && s.state !== filters.state && s.state !== "All India") return false;
      if (q && ![s.name, s.summary, s.category, ...s.tags].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
    return paginate(all.sort((a, b) => a.name.localeCompare(b.name)), page);
  }
};
var MemoryAuditRepository = class {
  entries = [];
  async put(entry) {
    this.entries.push(structuredClone(entry));
  }
  async list(page, actorId) {
    const all = this.entries.filter((e) => !actorId || e.actorId === actorId);
    return paginate(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)), page);
  }
};
var MemoryUserRepository = class {
  users = /* @__PURE__ */ new Map();
  async create(item) {
    this.users.set(item.id, structuredClone(item));
  }
  async get(id) {
    const found = this.users.get(id);
    return found ? structuredClone(found) : null;
  }
  async getByEmail(email) {
    const target = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === target) return structuredClone(user);
    }
    return null;
  }
  async update(item, expectedVersion) {
    const existing = this.users.get(item.id);
    if (!existing || existing.version !== expectedVersion) throw new ConflictError();
    this.users.set(item.id, structuredClone(item));
  }
  async list(page, role) {
    const all = [...this.users.values()].filter((u) => !role || u.role === role);
    return paginate(all.sort(byNewest), page);
  }
};
var MemoryWorkspaceRepository = class {
  workspaces = /* @__PURE__ */ new Map();
  notifications = /* @__PURE__ */ new Map();
  platformSettings = null;
  async getUserWorkspace(userId) {
    const found = this.workspaces.get(userId);
    return found ? structuredClone(found) : null;
  }
  async saveUserWorkspace(state) {
    this.workspaces.set(state.userId, structuredClone(state));
  }
  async listNotifications(page) {
    return paginate([...this.notifications.values()].sort(byNewest), page);
  }
  async putNotification(item) {
    this.notifications.set(item.id, structuredClone(item));
  }
  async getPlatformSettings() {
    return this.platformSettings ? structuredClone(this.platformSettings) : null;
  }
  async savePlatformSettings(settings) {
    this.platformSettings = structuredClone(settings);
  }
};

// backend/src/repositories/sqlite/client.ts
import fs from "node:fs";
import path2 from "node:path";
import { DatabaseSync } from "node:sqlite";
var SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS krishi_users (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  gsi1pk TEXT,
  gsi1sk TEXT,
  gsi2pk TEXT,
  gsi2sk TEXT,
  search_text TEXT,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_krishi_users_entity ON krishi_users (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_krishi_users_gsi1 ON krishi_users (gsi1pk, gsi1sk);
CREATE INDEX IF NOT EXISTS idx_krishi_users_gsi2 ON krishi_users (gsi2pk, gsi2sk);
CREATE INDEX IF NOT EXISTS idx_krishi_users_pk_sk ON krishi_users (pk, sk);

CREATE TABLE IF NOT EXISTS krishi_flag_items (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  gsi1pk TEXT,
  gsi1sk TEXT,
  gsi2pk TEXT,
  gsi2sk TEXT,
  search_text TEXT,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (pk, sk)
);

CREATE INDEX IF NOT EXISTS idx_krishi_flag_entity ON krishi_flag_items (entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_krishi_flag_gsi1 ON krishi_flag_items (gsi1pk, gsi1sk);
CREATE INDEX IF NOT EXISTS idx_krishi_flag_gsi2 ON krishi_flag_items (gsi2pk, gsi2sk);
CREATE INDEX IF NOT EXISTS idx_krishi_flag_pk_sk ON krishi_flag_items (pk, sk);
`;
var ALLOWED_TABLES = /* @__PURE__ */ new Set(["krishi_users", "krishi_flag_items"]);
function resolveSqliteTable(table = "krishi_flag_items") {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid SQLite table: ${table}`);
  }
  return table;
}
var instances = /* @__PURE__ */ new Map();
function migrateLegacySingleTable(db) {
  const legacyExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'krishi_items'").get();
  if (!legacyExists?.name) return;
  const rows = db.prepare("SELECT * FROM krishi_items").all();
  for (const row of rows) {
    if (row.entity_type === "userAccount") {
      const account = JSON.parse(row.data);
      const { login, profile } = splitUserAccount(account);
      putSqliteItemIfAbsent(
        db,
        {
          pk: `USER#${login.id}`,
          sk: "LOGIN",
          entityType: "userLogin",
          gsi1pk: `EMAIL#${login.email.toLowerCase()}`,
          gsi1sk: `USER#${login.id}`,
          gsi2pk: `ROLE#${login.role}`,
          gsi2sk: `${login.createdAt}#${login.id}`,
          createdAt: login.createdAt,
          updatedAt: login.updatedAt
        },
        login,
        login.version,
        "krishi_users"
      );
      putSqliteItemIfAbsent(
        db,
        {
          pk: `USER_PROFILE#${profile.id}`,
          sk: "META",
          entityType: "userProfile",
          gsi1pk: `PROFILE#${profile.id}`,
          gsi1sk: profile.updatedAt,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt
        },
        profile,
        profile.version,
        "krishi_flag_items"
      );
    } else {
      putSqliteItemIfAbsent(
        db,
        {
          pk: row.pk,
          sk: row.sk,
          entityType: row.entity_type,
          gsi1pk: row.gsi1pk ?? void 0,
          gsi1sk: row.gsi1sk ?? void 0,
          gsi2pk: row.gsi2pk ?? void 0,
          gsi2sk: row.gsi2sk ?? void 0,
          searchText: row.search_text ?? void 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        },
        JSON.parse(row.data),
        row.version,
        "krishi_flag_items"
      );
    }
  }
  db.exec("DROP TABLE IF EXISTS krishi_items;");
}
function getSqliteDb(dbPath) {
  const isMemory = dbPath === ":memory:";
  const resolved = isMemory ? ":memory:" : path2.resolve(dbPath);
  let db = instances.get(resolved);
  if (!db) {
    if (!isMemory) {
      fs.mkdirSync(path2.dirname(resolved), { recursive: true });
    }
    db = new DatabaseSync(resolved);
    if (!isMemory) {
      db.exec("PRAGMA journal_mode = WAL;");
    }
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA temp_store = MEMORY;");
    db.exec(SCHEMA_SQL);
    migrateLegacySingleTable(db);
    instances.set(resolved, db);
  }
  return db;
}
function closeSqliteDbs() {
  for (const db of instances.values()) {
    try {
      db.close();
    } catch {
    }
  }
  instances.clear();
}
function putSqliteItem(db, keys3, data, version = 1, table = "krishi_flag_items") {
  const target = resolveSqliteTable(table);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = keys3.createdAt ?? data.createdAt ?? data.timestamp ?? now;
  const updatedAt = keys3.updatedAt ?? data.updatedAt ?? data.lastUpdatedAt ?? createdAt;
  const stmt = db.prepare(`
    INSERT INTO ${target} (
      pk, sk, entity_type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, search_text, data, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pk, sk) DO UPDATE SET
      entity_type = excluded.entity_type,
      gsi1pk = excluded.gsi1pk,
      gsi1sk = excluded.gsi1sk,
      gsi2pk = excluded.gsi2pk,
      gsi2sk = excluded.gsi2sk,
      search_text = excluded.search_text,
      data = excluded.data,
      version = excluded.version,
      updated_at = excluded.updated_at
  `);
  stmt.run(
    keys3.pk,
    keys3.sk,
    keys3.entityType,
    keys3.gsi1pk ?? null,
    keys3.gsi1sk ?? null,
    keys3.gsi2pk ?? null,
    keys3.gsi2sk ?? null,
    keys3.searchText ?? null,
    JSON.stringify(data),
    version,
    createdAt,
    updatedAt
  );
}
function putSqliteItemIfAbsent(db, keys3, data, version = 1, table = "krishi_flag_items") {
  const target = resolveSqliteTable(table);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = keys3.createdAt ?? data.createdAt ?? data.timestamp ?? now;
  const updatedAt = keys3.updatedAt ?? data.updatedAt ?? data.lastUpdatedAt ?? createdAt;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO ${target} (
      pk, sk, entity_type, gsi1pk, gsi1sk, gsi2pk, gsi2sk, search_text, data, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    keys3.pk,
    keys3.sk,
    keys3.entityType,
    keys3.gsi1pk ?? null,
    keys3.gsi1sk ?? null,
    keys3.gsi2pk ?? null,
    keys3.gsi2sk ?? null,
    keys3.searchText ?? null,
    JSON.stringify(data),
    version,
    createdAt,
    updatedAt
  );
  return Number(result.changes) > 0;
}
function getSqliteItem(db, pk, sk = "META", table = "krishi_flag_items") {
  const target = resolveSqliteTable(table);
  const stmt = db.prepare(`SELECT data FROM ${target} WHERE pk = ? AND sk = ? LIMIT 1`);
  const row = stmt.get(pk, sk);
  return row ? JSON.parse(row.data) : null;
}
function updateSqliteItem(db, keys3, data, expectedVersion, table = "krishi_flag_items") {
  const target = resolveSqliteTable(table);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedAt = keys3.updatedAt ?? data.updatedAt ?? now;
  const stmt = db.prepare(`
    UPDATE ${target}
    SET entity_type = ?,
        gsi1pk = ?,
        gsi1sk = ?,
        gsi2pk = ?,
        gsi2sk = ?,
        search_text = ?,
        data = ?,
        version = ?,
        updated_at = ?
    WHERE pk = ? AND sk = ? AND version = ?
  `);
  const result = stmt.run(
    keys3.entityType,
    keys3.gsi1pk ?? null,
    keys3.gsi1sk ?? null,
    keys3.gsi2pk ?? null,
    keys3.gsi2sk ?? null,
    keys3.searchText ?? null,
    JSON.stringify(data),
    data.version,
    updatedAt,
    keys3.pk,
    keys3.sk,
    expectedVersion
  );
  if (Number(result.changes) === 0) {
    throw new ConflictError();
  }
}
function inspectSqliteDatabase(config, runIntegrity = false) {
  const db = getSqliteDb(config.sqliteDbPath);
  const isMemory = config.sqliteDbPath === ":memory:";
  const exists = !isMemory && fs.existsSync(config.sqliteDbPath);
  let fileSizeBytes = exists ? fs.statSync(config.sqliteDbPath).size : 0;
  const walPath = `${config.sqliteDbPath}-wal`;
  if (!isMemory && fs.existsSync(walPath)) {
    fileSizeBytes += fs.statSync(walPath).size;
  }
  const journalRow = db.prepare("PRAGMA journal_mode;").get();
  const usersRow = db.prepare("SELECT COUNT(*) AS total FROM krishi_users").get();
  const flagRow = db.prepare("SELECT COUNT(*) AS total FROM krishi_flag_items").get();
  const idxRow = db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('krishi_users', 'krishi_flag_items')").get();
  let integrityOk = true;
  if (runIntegrity) {
    const check = db.prepare("PRAGMA integrity_check;").get();
    integrityOk = check?.integrity_check === "ok";
  }
  const journalMode = (journalRow?.journal_mode ?? "wal").toUpperCase();
  const usersItems = Number(usersRow?.total ?? 0);
  const flagItems = Number(flagRow?.total ?? 0);
  const totalItems = usersItems + flagItems;
  const indexCount = Number(idxRow?.total ?? 0);
  return {
    dbPath: config.sqliteDbPath,
    exists,
    journalMode,
    integrityOk,
    fileSizeBytes,
    usersItems,
    flagItems,
    totalItems,
    indexCount,
    tables: ["krishi_users", "krishi_flag_items"],
    message: `Persistent SQLite 2-table store active (${journalMode} mode, ${usersItems} user login items + ${flagItems} flag/domain items, ${(fileSizeBytes / 1024).toFixed(1)} KB).`
  };
}

// backend/src/repositories/sqlite/index.ts
function paginateList(items, page) {
  const cursor = decodeCursor(page.cursor);
  const offset = cursor?.offset ?? 0;
  const sliced = items.slice(offset, offset + page.limit);
  const next = offset + page.limit;
  return {
    items: sliced,
    nextToken: next < items.length ? encodeCursor({ offset: next }) : null
  };
}
function queryRows(db, sql, params) {
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);
  return rows.map((r) => JSON.parse(r.data));
}
function selectEntityRows(db, table, whereClause, params, orderBy = "created_at DESC") {
  const target = resolveSqliteTable(table);
  return queryRows(db, `SELECT data FROM ${target} WHERE ${whereClause} ORDER BY ${orderBy}`, params);
}
function caseKeys2(c) {
  return {
    pk: `CASE#${c.id}`,
    sk: "META",
    entityType: "cropCase",
    gsi1pk: `FARMER#${c.farmerId}`,
    gsi1sk: `${c.createdAt}#${c.id}`,
    gsi2pk: "EXPERTQUEUE",
    gsi2sk: `${c.assignedExpertId ?? "UNASSIGNED"}#${c.createdAt}#${c.id}`,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}
var SqliteCropCaseRepository = class {
  constructor(db) {
    this.db = db;
  }
  async create(item) {
    putSqliteItem(this.db, caseKeys2(item), item, item.version);
  }
  async get(id) {
    return getSqliteItem(this.db, `CASE#${id}`);
  }
  async update(item, expectedVersion) {
    updateSqliteItem(this.db, caseKeys2(item), item, expectedVersion);
  }
  async listByFarmer(farmerId, page, status) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC",
      ["cropCase", `FARMER#${farmerId}`]
    ).filter((c) => !status || c.status === status);
    return paginateList(rows, page);
  }
  async listForExpert(expertId, page, status) {
    const queueStatuses = /* @__PURE__ */ new Set(["new", "ai_review", "expert_review"]);
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi2pk = ? ORDER BY created_at DESC",
      ["cropCase", "EXPERTQUEUE"]
    ).filter(
      (c) => (c.assignedExpertId === expertId || c.assignedExpertId === void 0 && queueStatuses.has(c.status)) && (!status || c.status === status)
    );
    return paginateList(rows, page);
  }
  async listAll(page, status) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC",
      ["cropCase"]
    ).filter((c) => !status || c.status === status);
    return paginateList(rows, page);
  }
};
function mandiKeys(p) {
  return {
    pk: `PRICE#${p.id}`,
    sk: "META",
    entityType: "mandiPrice",
    gsi1pk: `CROP#${p.crop}`,
    gsi1sk: `${p.date}#${p.state}#${p.mandi}#${p.id}`,
    gsi2pk: `STATE#${p.state}`,
    gsi2sk: `${p.date}#${p.crop}#${p.id}`,
    createdAt: p.createdAt,
    updatedAt: p.lastUpdatedAt
  };
}
var SqliteMandiRepository = class {
  constructor(db) {
    this.db = db;
  }
  async put(item) {
    putSqliteItem(this.db, mandiKeys(item), item, item.version);
  }
  async get(id) {
    return getSqliteItem(this.db, `PRICE#${id}`);
  }
  async query(filters, page) {
    let rows;
    if (filters.crop) {
      rows = queryRows(
        this.db,
        "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC",
        ["mandiPrice", `CROP#${filters.crop}`]
      );
    } else if (filters.state) {
      rows = queryRows(
        this.db,
        "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi2pk = ? ORDER BY gsi2sk DESC",
        ["mandiPrice", `STATE#${filters.state}`]
      );
    } else {
      rows = queryRows(
        this.db,
        "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC",
        ["mandiPrice"]
      );
    }
    const filtered = rows.filter((p) => {
      if (filters.crop && p.crop !== filters.crop) return false;
      if (filters.state && p.state !== filters.state) return false;
      if (filters.district && p.district !== filters.district) return false;
      if (filters.mandi && p.mandi !== filters.mandi) return false;
      if (filters.date && p.date !== filters.date) return false;
      if (filters.dateFrom && p.date < filters.dateFrom) return false;
      if (filters.dateTo && p.date > filters.dateTo) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
    return paginateList(filtered, page);
  }
};
function farmKeys2(f) {
  return {
    pk: `FARM#${f.id}`,
    sk: "META",
    entityType: "farm",
    gsi1pk: `FARMER#${f.farmerId}`,
    gsi1sk: `${f.createdAt}#${f.id}`,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt
  };
}
var SqliteFarmRepository = class {
  constructor(db) {
    this.db = db;
  }
  async create(item) {
    putSqliteItem(this.db, farmKeys2(item), item, item.version);
  }
  async get(id) {
    return getSqliteItem(this.db, `FARM#${id}`);
  }
  async update(item, expectedVersion) {
    updateSqliteItem(this.db, farmKeys2(item), item, expectedVersion);
  }
  async listByOwner(ownerId, page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC",
      ["farm", `FARMER#${ownerId}`]
    );
    return paginateList(rows, page);
  }
  async listAll(page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC",
      ["farm"]
    );
    return paginateList(rows, page);
  }
  async addReading(reading) {
    putSqliteItem(
      this.db,
      {
        pk: `FARM#${reading.farmId}`,
        sk: `READING#${reading.createdAt}#${reading.id}`,
        entityType: "soilReading",
        createdAt: reading.createdAt,
        updatedAt: reading.createdAt
      },
      reading,
      1
    );
  }
  async listReadings(farmId, plotId, page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC",
      [`FARM#${farmId}`, "READING#%"]
    ).filter((r) => !plotId || r.plotId === plotId);
    return paginateList(rows, page);
  }
};
function batchKeys2(b) {
  return {
    pk: `BATCH#${b.id}`,
    sk: "META",
    entityType: "storageBatch",
    gsi1pk: `FARMER#${b.ownerId}`,
    gsi1sk: `${b.createdAt}#${b.id}`,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt
  };
}
var SqliteStorageRepository = class {
  constructor(db) {
    this.db = db;
  }
  async createBatch(item) {
    putSqliteItem(this.db, batchKeys2(item), item, item.version);
  }
  async getBatch(id) {
    return getSqliteItem(this.db, `BATCH#${id}`);
  }
  async updateBatch(item, expectedVersion) {
    updateSqliteItem(this.db, batchKeys2(item), item, expectedVersion);
  }
  async listByOwner(ownerId, page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk DESC",
      ["storageBatch", `FARMER#${ownerId}`]
    );
    return paginateList(rows, page);
  }
  async listAll(page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC",
      ["storageBatch"]
    );
    return paginateList(rows, page);
  }
  async addReading(r) {
    putSqliteItem(
      this.db,
      {
        pk: `BATCH#${r.batchId}`,
        sk: `READING#${r.createdAt}#${r.id}`,
        entityType: "storageReading",
        createdAt: r.createdAt,
        updatedAt: r.createdAt
      },
      r,
      1
    );
  }
  async listReadings(batchId, page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC",
      [`BATCH#${batchId}`, "READING#%"]
    );
    return paginateList(rows, page);
  }
  async addAlert(a) {
    putSqliteItem(
      this.db,
      {
        pk: `BATCH#${a.batchId}`,
        sk: `ALERT#${a.createdAt}#${a.id}`,
        entityType: "storageAlert",
        createdAt: a.createdAt,
        updatedAt: a.createdAt
      },
      a,
      1
    );
  }
  async listAlerts(batchId, page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC",
      [`BATCH#${batchId}`, "ALERT#%"]
    );
    return paginateList(rows, page);
  }
  async addInspection(i) {
    putSqliteItem(
      this.db,
      {
        pk: `BATCH#${i.batchId}`,
        sk: `INSPECTION#${i.createdAt}#${i.id}`,
        entityType: "storageInspection",
        createdAt: i.createdAt,
        updatedAt: i.createdAt
      },
      i,
      1
    );
  }
  async listInspections(batchId) {
    return queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE pk = ? AND sk LIKE ? ORDER BY sk DESC",
      [`BATCH#${batchId}`, "INSPECTION#%"]
    );
  }
};
function schemeKeys(s) {
  return {
    pk: `SCHEME#${s.id}`,
    sk: "META",
    entityType: "scheme",
    gsi1pk: `CATEGORY#${s.category}`,
    gsi1sk: `${s.state}#${s.name}#${s.id}`,
    searchText: [s.name, s.summary, s.category, ...s.tags].join(" ").toLowerCase(),
    createdAt: s.createdAt,
    updatedAt: s.lastUpdatedAt
  };
}
var SqliteSchemeRepository = class {
  constructor(db) {
    this.db = db;
  }
  async put(item) {
    putSqliteItem(this.db, schemeKeys(item), item, item.version);
  }
  async get(id) {
    return getSqliteItem(this.db, `SCHEME#${id}`);
  }
  async list(filters, page) {
    const rows = filters.category ? queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY gsi1sk ASC",
      ["scheme", `CATEGORY#${filters.category}`]
    ) : queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY gsi1sk ASC",
      ["scheme"]
    );
    const q = filters.q?.toLowerCase();
    const filtered = rows.filter((s) => {
      if (filters.state && s.state !== filters.state && s.state !== "All India") return false;
      if (q && ![s.name, s.summary, s.category, ...s.tags].some((v) => v.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
    return paginateList(filtered, page);
  }
};
var SqliteAuditRepository = class {
  constructor(db) {
    this.db = db;
  }
  async put(entry) {
    putSqliteItem(
      this.db,
      {
        pk: `AUDIT#${dateKey(entry.timestamp)}`,
        sk: `${entry.timestamp}#${entry.id}`,
        entityType: "auditEntry",
        gsi1pk: `ACTOR#${entry.actorId}`,
        gsi1sk: entry.timestamp,
        createdAt: entry.timestamp,
        updatedAt: entry.timestamp
      },
      entry,
      1
    );
  }
  async list(page, actorId) {
    const rows = actorId ? queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? AND gsi1pk = ? ORDER BY created_at DESC",
      ["auditEntry", `ACTOR#${actorId}`]
    ) : queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC",
      ["auditEntry"]
    );
    return paginateList(rows, page);
  }
};
function userLoginKeys2(u) {
  return {
    pk: `USER#${u.id}`,
    sk: "LOGIN",
    entityType: "userLogin",
    gsi1pk: `EMAIL#${u.email.toLowerCase()}`,
    gsi1sk: `USER#${u.id}`,
    gsi2pk: `ROLE#${u.role}`,
    gsi2sk: `${u.createdAt}#${u.id}`,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  };
}
function userProfileKeys2(p) {
  return {
    pk: `USER_PROFILE#${p.id}`,
    sk: "META",
    entityType: "userProfile",
    gsi1pk: `PROFILE#${p.id}`,
    gsi1sk: p.updatedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}
var SqliteUserRepository = class {
  constructor(db) {
    this.db = db;
  }
  async create(item) {
    const { login, profile } = splitUserAccount(item);
    putSqliteItem(this.db, userLoginKeys2(login), login, login.version, "krishi_users");
    putSqliteItem(this.db, userProfileKeys2(profile), profile, profile.version, "krishi_flag_items");
  }
  async get(id) {
    const login = getSqliteItem(this.db, `USER#${id}`, "LOGIN", "krishi_users");
    if (!login) return null;
    const profile = getSqliteItem(
      this.db,
      `USER_PROFILE#${id}`,
      "META",
      "krishi_flag_items"
    );
    return mergeUserAccount(login, profile);
  }
  async getByEmail(email) {
    const rows = selectEntityRows(
      this.db,
      "krishi_users",
      "entity_type = ? AND gsi1pk = ?",
      ["userLogin", `EMAIL#${email.trim().toLowerCase()}`],
      "created_at DESC"
    );
    const login = rows[0];
    if (!login) return null;
    const profile = getSqliteItem(
      this.db,
      `USER_PROFILE#${login.id}`,
      "META",
      "krishi_flag_items"
    );
    return mergeUserAccount(login, profile);
  }
  async update(item, expectedVersion) {
    const { login, profile } = splitUserAccount(item);
    updateSqliteItem(this.db, userLoginKeys2(login), login, expectedVersion, "krishi_users");
    putSqliteItem(this.db, userProfileKeys2(profile), profile, profile.version, "krishi_flag_items");
  }
  async list(page, role) {
    const logins = role ? selectEntityRows(
      this.db,
      "krishi_users",
      "entity_type = ? AND gsi2pk = ?",
      ["userLogin", `ROLE#${role}`]
    ) : selectEntityRows(this.db, "krishi_users", "entity_type = ?", ["userLogin"]);
    const accounts = logins.map((login) => {
      const profile = getSqliteItem(
        this.db,
        `USER_PROFILE#${login.id}`,
        "META",
        "krishi_flag_items"
      );
      return mergeUserAccount(login, profile);
    });
    return paginateList(accounts, page);
  }
};
var SqliteWorkspaceRepository = class {
  constructor(db) {
    this.db = db;
  }
  async getUserWorkspace(userId) {
    return getSqliteItem(this.db, `WORKSPACE#${userId}`);
  }
  async saveUserWorkspace(state) {
    putSqliteItem(
      this.db,
      {
        pk: `WORKSPACE#${state.userId}`,
        sk: "META",
        entityType: "userWorkspace",
        gsi1pk: `WORKSPACE_USER#${state.userId}`,
        gsi1sk: state.updatedAt,
        createdAt: state.updatedAt,
        updatedAt: state.updatedAt
      },
      state,
      state.version
    );
  }
  async listNotifications(page) {
    const rows = queryRows(
      this.db,
      "SELECT data FROM krishi_flag_items WHERE entity_type = ? ORDER BY created_at DESC",
      ["notification"]
    );
    return paginateList(rows, page);
  }
  async putNotification(item) {
    putSqliteItem(
      this.db,
      {
        pk: `NOTIF#${item.id}`,
        sk: "META",
        entityType: "notification",
        gsi1pk: `NOTIF_AUDIENCE#${item.audience}`,
        gsi1sk: `${item.createdAt}#${item.id}`,
        createdAt: item.createdAt,
        updatedAt: item.createdAt
      },
      item,
      1
    );
  }
  async getPlatformSettings() {
    return getSqliteItem(this.db, "SETTINGS#global");
  }
  async savePlatformSettings(settings) {
    putSqliteItem(
      this.db,
      {
        pk: "SETTINGS#global",
        sk: "META",
        entityType: "platformSettings",
        createdAt: settings.updatedAt,
        updatedAt: settings.updatedAt
      },
      settings,
      settings.version
    );
  }
};

// backend/src/services/ai/factory.ts
import { BedrockRuntimeClient as BedrockRuntimeClient2 } from "@aws-sdk/client-bedrock-runtime";
import { S3Client as S3Client2 } from "@aws-sdk/client-s3";

// backend/src/services/ai/bedrock.ts
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

// backend/src/models/cropCase.ts
var AI_DISCLAIMER = "Unverified AI-assisted suggestion \u2014 not a confirmed diagnosis. Confirm with a qualified local expert before taking any action. No pesticide dosage is provided from image analysis.";
var HEURISTIC_DISCLAIMER = "Simulated demo analysis from deterministic rules \u2014 not a diagnosis and not a live AI result. Confirm with a qualified local expert before taking any action.";

// backend/src/services/ai/bedrock.ts
var modelOutputSchema = z.object({
  condition: z.string().min(1).max(200),
  confidence: z.number().min(0).max(100),
  uncertainty: z.string().min(1).max(1e3),
  alternatives: z.array(z.object({ name: z.string().min(1).max(120), confidence: z.number().min(0).max(100) })).max(5),
  observedSymptoms: z.array(z.string().min(1).max(200)).max(12),
  explanation: z.string().min(1).max(2e3),
  nextSteps: z.array(z.string().min(1).max(300)).max(8),
  recommendExpert: z.boolean()
});
var SYSTEM_PROMPT = `You are an agricultural plant-health assistant for Indian farmers.
Rules you MUST follow:
1. You are NOT a confirmed diagnosis. Express uncertainty explicitly.
2. NEVER provide pesticide, fungicide or chemical dosage instructions (no quantities per acre, hectare, litre, tank or pump). Treatment decisions require a human expert.
3. Recommend consulting a qualified local expert whenever confidence is not very high.
4. Respond with ONLY a JSON object, no markdown fences, matching exactly:
{"condition": string, "confidence": number 0-100, "uncertainty": string, "alternatives": [{"name": string, "confidence": number}], "observedSymptoms": string[], "explanation": string, "nextSteps": string[], "recommendExpert": boolean}
5. nextSteps must be observation and expert-consultation actions only.`;
var DOSAGE_PATTERN = /\d+(\.\d+)?\s*(ml|millilitre|g|gram|kg|l|litre|liter|cc)\b[^.]{0,60}\b(per|\/|each)\s*(acre|hectare|ha|litre|liter|l|tank|pump|spray)/i;
function containsDosageInstruction(text) {
  return DOSAGE_PATTERN.test(text);
}
var SAFE_NEXT_STEPS = [
  "Photograph affected and healthy plant parts together in daylight.",
  "Record recent weather and irrigation details.",
  "Consult a qualified local expert before any treatment."
];
function extractJson(text) {
  const trimmed2 = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed2);
}
var BedrockAnalysisService = class {
  constructor(deps) {
    this.deps = deps;
  }
  provider = "bedrock";
  simulated = false;
  async fetchImage(imageKey) {
    const res = await this.deps.s3.send(new GetObjectCommand({ Bucket: this.deps.bucket, Key: imageKey }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new ServiceUnavailableError("AI_IMAGE_UNAVAILABLE", "The case image could not be read for analysis.");
    const ext = imageKey.split(".").pop()?.toLowerCase();
    const format = ext === "png" ? "png" : ext === "webp" ? "webp" : "jpeg";
    return { format, bytes };
  }
  async analyze(input) {
    const userText = [
      `Crop: ${input.crop}`,
      `Plant part: ${input.plantPart}`,
      `Location: ${input.location}`,
      `Reported symptoms: ${input.symptoms}`,
      input.imageKey && this.deps.bucket ? "An image of the affected plant is attached." : "No image was provided; rely on the reported symptoms only."
    ].join("\n");
    const content = [{ text: userText }];
    if (input.imageKey && this.deps.bucket) {
      const image = await this.fetchImage(input.imageKey);
      content.push({ image: { format: image.format, source: { bytes: image.bytes } } });
    }
    let res;
    try {
      res = await this.deps.bedrock.send(
        new ConverseCommand({
          modelId: this.deps.modelId,
          system: [{ text: SYSTEM_PROMPT }],
          messages: [{ role: "user", content }],
          inferenceConfig: { maxTokens: 1500, temperature: 0.2 }
        })
      );
    } catch (err) {
      throw new ServiceUnavailableError(
        "AIInvocationFailed",
        "The AI model could not be invoked. Verify Bedrock model access, region and IAM permissions."
      );
    }
    const block = res.output?.message?.content?.find((c) => "text" in c);
    const text = block && "text" in block ? block.text : void 0;
    if (!text) throw new ServiceUnavailableError("AI_EMPTY_RESPONSE", "The AI model returned an empty response.");
    let parsed;
    try {
      const result = modelOutputSchema.safeParse(extractJson(text));
      if (!result.success) throw new Error("schema mismatch");
      parsed = result.data;
    } catch {
      throw new ServiceUnavailableError("AI_INVALID_OUTPUT", "The AI model output failed validation and was discarded.");
    }
    const dosageDetected = containsDosageInstruction(parsed.explanation) || parsed.nextSteps.some(containsDosageInstruction);
    const nextSteps = dosageDetected ? SAFE_NEXT_STEPS : parsed.nextSteps;
    const explanation = dosageDetected ? "The model response contained treatment-quantity content and was sanitised. Consult a qualified expert for treatment decisions." : parsed.explanation;
    return {
      provider: this.provider,
      modelId: this.deps.modelId,
      condition: parsed.condition,
      confidence: parsed.confidence,
      uncertainty: parsed.uncertainty,
      alternatives: parsed.alternatives,
      observedSymptoms: parsed.observedSymptoms,
      explanation,
      nextSteps,
      recommendExpert: true,
      // always require expert confirmation in this product
      verified: false,
      simulated: false,
      disclaimer: AI_DISCLAIMER,
      analyzedAt: nowIso()
    };
  }
};

// backend/src/services/ai/gemini.ts
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { z as z2 } from "zod";
var modelOutputSchema2 = z2.object({
  condition: z2.string().trim().min(1).max(200),
  confidence: z2.number().min(0).max(100),
  uncertainty: z2.string().trim().min(1).max(1e3),
  alternatives: z2.array(
    z2.object({
      name: z2.string().trim().min(1).max(120),
      confidence: z2.number().min(0).max(100)
    })
  ).max(5),
  observedSymptoms: z2.array(z2.string().trim().min(1).max(200)).max(12),
  explanation: z2.string().trim().min(1).max(2500),
  nextSteps: z2.array(z2.string().trim().min(1).max(300)).min(1).max(8),
  recommendExpert: z2.boolean()
});
var SYSTEM_INSTRUCTION = `You are KRISHI360 CropDoctor AI, an agricultural plant-health triage assistant for farmers in India.
Strict rules you MUST follow:
1. Never present your response as a confirmed clinical diagnosis. Explicitly state uncertainty and visual limitations in the "uncertainty" field.
2. NEVER output chemical, pesticide, fungicide, insecticide, or herbicide dosage instructions (no ml, grams, kg, litres, pumps, tanks, or amounts per acre/hectare). Treatment prescriptions require a qualified local agronomist.
3. Keep "nextSteps" strictly observational, preventive, and diagnostic (e.g., inspecting leaf undersides, checking drainage/irrigation, taking daylight close-ups, isolating affected samples, consulting a qualified local expert).
4. Base your analysis carefully on the attached plant image (if provided) together with the crop, plant part, location, and farmer-reported symptoms. If the image is unclear or doesn't show a plant clearly, reflect that honestly with lower confidence and clear guidance in "uncertainty" and "explanation".
5. Set "recommendExpert" to true whenever expert confirmation is advisable (almost always true for field decisions).
6. Confidence values must be realistic integers between 0 and 100.`;
var SAFE_NEXT_STEPS2 = [
  "Photograph affected and healthy plant parts together in clear daylight.",
  "Inspect the leaf undersides, stems, and nearby plants for spread.",
  "Record recent rainfall, humidity, and irrigation timing.",
  "Consult a qualified local agronomist before applying any treatment."
];
var RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    condition: {
      type: Type.STRING,
      description: 'Most likely candidate plant condition or stress pattern (e.g. "Possible early blight").'
    },
    confidence: {
      type: Type.NUMBER,
      description: "Estimated confidence score from 0 to 100."
    },
    uncertainty: {
      type: Type.STRING,
      description: "Plain-language statement of diagnostic uncertainty and image/symptom limitations."
    },
    alternatives: {
      type: Type.ARRAY,
      description: "Up to 3 plausible differential diagnoses or alternative causes.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["name", "confidence"]
      }
    },
    observedSymptoms: {
      type: Type.ARRAY,
      description: "Key visual or reported symptoms observed from the image and description.",
      items: { type: Type.STRING }
    },
    explanation: {
      type: Type.STRING,
      description: "Clear, helpful plain-language explanation for the farmer (no chemical dosages)."
    },
    nextSteps: {
      type: Type.ARRAY,
      description: "3 to 5 safe observational, cultural, and expert-consultation next steps (no chemical dosages).",
      items: { type: Type.STRING }
    },
    recommendExpert: {
      type: Type.BOOLEAN,
      description: "Whether a human agronomist review is recommended."
    }
  },
  required: [
    "condition",
    "confidence",
    "uncertainty",
    "alternatives",
    "observedSymptoms",
    "explanation",
    "nextSteps",
    "recommendExpert"
  ]
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getHttpStatus(err) {
  if (!err || typeof err !== "object") return void 0;
  const candidate = err;
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.code === "number") return candidate.code;
  return void 0;
}
function isRetryableGeminiError(err) {
  const status = getHttpStatus(err);
  if (status && [408, 429, 500, 502, 503, 504].includes(status)) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("fetch") || msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset");
}
function mapGeminiError(err) {
  const status = getHttpStatus(err);
  const rawMessage = err instanceof Error ? err.message : String(err);
  const upper = rawMessage.toUpperCase();
  if (status === 400 && (upper.includes("API_KEY_INVALID") || upper.includes("API KEY"))) {
    return new ServiceUnavailableError(
      "GEMINI_API_KEY_INVALID",
      "Gemini API key is invalid. Please check GEMINI_API_KEY in Settings > Secrets."
    );
  }
  if (status === 403 || upper.includes("PERMISSION_DENIED")) {
    return new ServiceUnavailableError(
      "GEMINI_PERMISSION_DENIED",
      "Gemini API access was denied. Please verify your API key in Settings > Secrets."
    );
  }
  if (status === 429 || upper.includes("RESOURCE_EXHAUSTED")) {
    return new ServiceUnavailableError(
      "GEMINI_QUOTA_EXCEEDED",
      "Gemini API quota limit reached. Please retry shortly or check your API billing quota in Settings > Secrets."
    );
  }
  if (status === 404 || upper.includes("NOT_FOUND")) {
    return new ServiceUnavailableError(
      "GEMINI_MODEL_NOT_FOUND",
      "Configured Gemini model is unavailable. Verify the model configuration."
    );
  }
  return new ServiceUnavailableError(
    "GEMINI_INVOCATION_FAILED",
    "Gemini crop analysis could not complete right now. Please try again in a moment."
  );
}
var GeminiAnalysisService = class {
  constructor(modelId = "gemini-4-hydrogen") {
    this.modelId = modelId;
  }
  provider = "gemini";
  simulated = false;
  createClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        "AI_NOT_CONFIGURED",
        "Gemini API key is not configured on the server. Set GEMINI_API_KEY in Settings > Secrets."
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  async analyze(input) {
    const ai = this.createClient();
    const promptLines = [
      `Crop: ${input.crop}`,
      `Affected plant part: ${input.plantPart}`,
      `Farm location: ${input.location || "India"}`,
      `Reported symptoms: ${input.symptoms.trim() || "Not specified \u2014 analyze from visual cues in the image."}`,
      input.imageData ? "An image of the crop sample is attached. Inspect visible lesions, discoloration, pests, or structural stress carefully." : "No image bytes were attached; base your differential analysis on the crop, plant part, location, and reported symptoms."
    ];
    const contents = input.imageData ? {
      parts: [
        {
          inlineData: {
            mimeType: input.imageData.mimeType,
            data: input.imageData.base64
          }
        },
        { text: promptLines.join("\n") }
      ]
    } : promptLines.join("\n");
    let response;
    let lastError;
    const delays = [300, 900];
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: this.modelId,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          }
        });
        break;
      } catch (err) {
        lastError = err;
        if (attempt < delays.length && isRetryableGeminiError(err)) {
          await sleep(delays[attempt]);
          continue;
        }
        throw mapGeminiError(err);
      }
    }
    if (!response) {
      throw mapGeminiError(lastError);
    }
    const rawText = (response.text ?? "").trim();
    if (!rawText) {
      throw new ServiceUnavailableError("AI_EMPTY_RESPONSE", "Gemini returned an empty crop analysis response.");
    }
    let parsed;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const result = modelOutputSchema2.safeParse(JSON.parse(cleaned));
      if (!result.success) {
        throw new Error("Schema validation failed");
      }
      parsed = result.data;
    } catch {
      throw new ServiceUnavailableError(
        "AI_INVALID_OUTPUT",
        "Gemini returned an unexpected output format. Please try analyzing again."
      );
    }
    const dosageDetected = containsDosageInstruction(parsed.explanation) || parsed.nextSteps.some(containsDosageInstruction) || containsDosageInstruction(parsed.uncertainty);
    const safeNextSteps = parsed.nextSteps.filter((step) => !containsDosageInstruction(step));
    const nextSteps = dosageDetected || safeNextSteps.length === 0 ? SAFE_NEXT_STEPS2 : safeNextSteps;
    const explanation = dosageDetected ? "Chemical dosage details were omitted for field safety. Consult a qualified local agronomist for treatment decisions." : parsed.explanation;
    const confidence = Math.round(Math.min(100, Math.max(0, parsed.confidence)));
    return {
      provider: this.provider,
      modelId: this.modelId,
      condition: parsed.condition,
      confidence,
      uncertainty: parsed.uncertainty,
      alternatives: parsed.alternatives.map((alt) => ({
        name: alt.name,
        confidence: Math.round(Math.min(100, Math.max(0, alt.confidence)))
      })),
      observedSymptoms: parsed.observedSymptoms,
      explanation,
      nextSteps,
      recommendExpert: true,
      verified: false,
      simulated: false,
      disclaimer: AI_DISCLAIMER,
      analyzedAt: nowIso()
    };
  }
};

// backend/src/services/ai/heuristic.ts
var KNOWLEDGE = {
  Tomato: {
    condition: "Possible early blight",
    alternatives: ["Leaf spot complex", "Nutrient stress"],
    symptoms: ["Irregular brown lesions", "Yellow haloing", "Older leaves affected first"],
    explanation: "The described pattern resembles common tomato leaf-spot groups. Similar visual symptoms can come from different causes, so this is only a demo comparison."
  },
  Wheat: {
    condition: "Possible rust-group disease",
    alternatives: ["Leaf scorch", "Nutrient imbalance"],
    symptoms: ["Small orange-brown pustules", "Upper leaf surface", "Patchy distribution"],
    explanation: "Colour and distribution may match a rust-group pattern in wheat. Field confirmation is necessary because several stresses look similar."
  },
  Grapes: {
    condition: "Possible fruit spot complex",
    alternatives: ["Anthracnose group", "Surface blemish"],
    symptoms: ["Dark specks on fruit", "Bunch interior affected", "No visible mould"],
    explanation: "Fruit blemishes can arise from disease, moisture or handling. This demo result highlights possibilities without confirming a cause."
  }
};
var DEFAULT_KNOWLEDGE = {
  condition: "Possible leaf stress pattern",
  alternatives: ["Fungal leaf spot group", "Environmental stress"],
  symptoms: ["Discoloured leaf area", "Uneven pattern", "Additional context needed"],
  explanation: "The input describes a non-specific visual pattern. This demo engine compares broad reference patterns and cannot confirm a condition."
};
var SAFE_NEXT_STEPS3 = [
  "Photograph affected and healthy plant parts together in daylight.",
  "Record recent rainfall, humidity and irrigation timing.",
  "Request a human expert review before any intervention."
];
var HeuristicAnalysisService = class {
  provider = "heuristic";
  simulated = true;
  async analyze(input) {
    const knowledge = KNOWLEDGE[input.crop] ?? DEFAULT_KNOWLEDGE;
    const symptomBonus = input.symptoms.trim().length > 20 ? 6 : 0;
    const confidence = Math.min(82, 62 + symptomBonus + (input.imageKey ? 6 : 0));
    return {
      provider: this.provider,
      condition: knowledge.condition,
      confidence,
      uncertainty: "High uncertainty: rule-based demo comparison without image understanding. Several conditions share these symptoms.",
      alternatives: knowledge.alternatives.map((name, index) => ({
        name,
        confidence: Math.max(18, confidence - 24 - index * 14)
      })),
      observedSymptoms: [...knowledge.symptoms, ...input.symptoms.trim() ? [input.symptoms.trim()] : []],
      explanation: knowledge.explanation,
      nextSteps: SAFE_NEXT_STEPS3,
      recommendExpert: true,
      verified: false,
      simulated: true,
      disclaimer: HEURISTIC_DISCLAIMER,
      analyzedAt: nowIso()
    };
  }
};

// backend/src/services/ai/types.ts
var AI_ANALYSIS_DISABLED_MESSAGE = "AI analysis is not configured. Configure GEMINI_API_KEY or AI_PROVIDER before using this endpoint.";

// backend/src/services/ai/factory.ts
var DisabledAnalysisService = class {
  provider = "heuristic";
  simulated = true;
  async analyze(_input) {
    throw new ServiceUnavailableError("AI_NOT_CONFIGURED", AI_ANALYSIS_DISABLED_MESSAGE);
  }
};
function createAiService(config, s3) {
  switch (config.aiProvider) {
    case "gemini":
      return new GeminiAnalysisService(config.geminiModelId);
    case "bedrock": {
      const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() || process.env.AWS_BEARER_TOKEN?.trim();
      return new BedrockAnalysisService({
        bedrock: new BedrockRuntimeClient2({
          region: config.awsRegion,
          ...bearerToken ? {
            token: async () => ({ token: bearerToken }),
            authSchemePreference: ["httpBearerAuth"]
          } : {}
        }),
        s3: s3 ?? new S3Client2({ region: config.awsRegion }),
        bucket: config.uploadBucketName,
        modelId: config.bedrockModelId
      });
    }
    case "heuristic":
      return new HeuristicAnalysisService();
    default:
      return new DisabledAnalysisService();
  }
}

// backend/src/services/auditService.ts
var AuditService = class {
  constructor(repo) {
    this.repo = repo;
  }
  async record(logger, actor, action, target, details) {
    const entry = {
      id: makeId("AUD"),
      actorId: actor.id,
      actorRole: actor.role,
      action,
      target,
      ...details ? { details } : {},
      timestamp: nowIso()
    };
    try {
      await this.repo.put(entry);
    } catch (err) {
      logger.error("audit.write_failed", {
        action,
        target,
        errorName: err instanceof Error ? err.name : "unknown"
      });
    }
  }
  list(page, actorId) {
    return this.repo.list(page, actorId);
  }
};

// backend/src/utils/token.ts
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
var RUNTIME_SIGNING_SECRET = randomBytes(32);
function getSigningKey() {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 16) {
    return createHash("sha256").update(configured).digest();
  }
  return RUNTIME_SIGNING_SECRET;
}
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  try {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
function constantTimeEqualsSecret(input, secret) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
function signSessionToken(payload, ttlSeconds = 12 * 60 * 60) {
  const claims = {
    ...payload,
    exp: Math.floor(Date.now() / 1e3) + ttlSeconds
  };
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSigningKey()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifySessionToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;
  const expectedSig = createHmac("sha256", getSigningKey()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.sub !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Math.floor(Date.now() / 1e3)) return null;
    if (parsed.role !== "farmer" && parsed.role !== "expert" && parsed.role !== "admin") return null;
    return parsed;
  } catch {
    return null;
  }
}

// backend/src/services/authService.ts
function initialsFor(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "KR";
}
var AuthService = class {
  constructor(users, audit) {
    this.users = users;
    this.audit = audit;
  }
  async getBootstrapStatus() {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@krishi360.in";
    if (envPasscode) {
      return { adminSetupRequired: false, adminEmailHint: envEmail };
    }
    const admins = await this.users.list({ limit: 20 }, "admin");
    const hasConfiguredAdmin = admins.items.some((a) => Boolean(a.passwordHash) && a.status === "active");
    return { adminSetupRequired: !hasConfiguredAdmin, adminEmailHint: envEmail };
  }
  async setupInitialAdmin(input, logger) {
    const status = await this.getBootstrapStatus();
    if (!status.adminSetupRequired) {
      throw new ConflictError("Administrator account is already configured. Sign in using the staff panel.");
    }
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.getByEmail(email);
    if (existing && existing.role !== "admin") {
      if (existing.status === "suspended") {
        throw new ForbiddenError("This account is currently suspended.");
      }
      if (!verifyPassword(input.password, existing.passwordHash)) {
        throw new ConflictError(
          `An account with this email already exists as a ${existing.role}. Enter that account's current password to promote it to Admin, or use a dedicated admin email.`
        );
      }
    }
    const now = nowIso();
    const adminUser = existing ? {
      ...existing,
      role: "admin",
      name: input.name.trim(),
      status: "active",
      avatar: initialsFor(input.name),
      organisation: existing.organisation || "KRISHI360 AI Operations",
      specialisation: existing.specialisation || "Platform administration",
      passwordHash: hashPassword(input.password),
      updatedAt: now,
      version: existing.version + 1
    } : {
      id: "admin-001",
      email,
      name: input.name.trim(),
      role: "admin",
      location: "Platform Operations",
      phone: "Not provided",
      status: "active",
      avatar: initialsFor(input.name),
      organisation: "KRISHI360 AI Operations",
      specialisation: "Platform administration",
      joinedAt: now.slice(0, 10),
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    if (existing) {
      await this.users.update(adminUser, existing.version);
    } else {
      await this.users.create(adminUser);
    }
    await this.audit.record(
      logger,
      { id: adminUser.id, role: "admin", name: adminUser.name, email: adminUser.email, groups: ["admin"] },
      "auth.admin_bootstrapped",
      adminUser.id
    );
    const token = signSessionToken({
      sub: adminUser.id,
      role: "admin",
      name: adminUser.name,
      email: adminUser.email
    });
    return { token, user: toPublicUser(adminUser) };
  }
  async registerFarmer(input, logger) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.getByEmail(email);
    if (existing) {
      throw new ConflictError("An account with this email is already registered.");
    }
    const now = nowIso();
    const user = {
      id: makeId("farmer"),
      email,
      name: input.name.trim(),
      role: "farmer",
      location: input.location.trim() || "India",
      phone: input.phone?.trim() || "Not provided",
      status: "active",
      avatar: initialsFor(input.name),
      joinedAt: now.slice(0, 10),
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    await this.users.create(user);
    await this.audit.record(
      logger,
      { id: user.id, role: "farmer", name: user.name, email: user.email, groups: ["farmer"] },
      "auth.farmer_registered",
      user.id
    );
    const token = signSessionToken({
      sub: user.id,
      role: "farmer",
      name: user.name,
      email: user.email
    });
    return { token, user: toPublicUser(user) };
  }
  async loginFarmer(input, logger) {
    const email = input.email.trim().toLowerCase();
    const user = await this.users.getByEmail(email);
    if (!user || user.role !== "farmer" || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedError("Invalid farmer email or password.");
    }
    if (user.status === "suspended") {
      throw new ForbiddenError("This farmer account is currently suspended.");
    }
    await this.audit.record(
      logger,
      { id: user.id, role: "farmer", name: user.name, email: user.email, groups: ["farmer"] },
      "auth.farmer_logged_in",
      user.id
    );
    const token = signSessionToken({
      sub: user.id,
      role: "farmer",
      name: user.name,
      email: user.email
    });
    return { token, user: toPublicUser(user) };
  }
  async loginStaff(input, logger) {
    const email = input.email.trim().toLowerCase();
    if (input.role === "admin") {
      const envPasscode = process.env.ADMIN_PASSCODE?.trim();
      const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "admin@krishi360.in";
      const existing = await this.users.getByEmail(email);
      if (envPasscode) {
        const emailMatches = email === envAdminEmail || existing?.role === "admin";
        if (!emailMatches || !constantTimeEqualsSecret(input.password, envPasscode)) {
          throw new UnauthorizedError("Invalid administrator email or passcode.");
        }
        if (existing?.role === "admin" && existing.status === "suspended") {
          throw new ForbiddenError("This administrator account is suspended.");
        }
        const now = nowIso();
        const adminAccount = existing && existing.role === "admin" ? existing : {
          id: existing ? `admin-${existing.id}` : "admin-001",
          email,
          name: "Administrator",
          role: "admin",
          location: "Platform Operations",
          phone: "Not provided",
          status: "active",
          avatar: "AD",
          organisation: "KRISHI360 AI Operations",
          specialisation: "Platform administration",
          joinedAt: now.slice(0, 10),
          createdAt: now,
          updatedAt: now,
          version: 1
        };
        if (!existing && !await this.users.get(adminAccount.id)) {
          await this.users.create(adminAccount);
        }
        const token3 = signSessionToken({
          sub: adminAccount.id,
          role: "admin",
          name: adminAccount.name,
          email: adminAccount.email
        });
        await this.audit.record(
          logger,
          { id: adminAccount.id, role: "admin", name: adminAccount.name, email: adminAccount.email, groups: ["admin"] },
          "auth.admin_logged_in",
          adminAccount.id
        );
        return { token: token3, user: toPublicUser(adminAccount) };
      }
      if (!existing || existing.role !== "admin" || !verifyPassword(input.password, existing.passwordHash)) {
        throw new UnauthorizedError("Invalid administrator email or password.");
      }
      if (existing.status === "suspended") {
        throw new ForbiddenError("This administrator account is suspended.");
      }
      const token2 = signSessionToken({
        sub: existing.id,
        role: "admin",
        name: existing.name,
        email: existing.email
      });
      await this.audit.record(
        logger,
        { id: existing.id, role: "admin", name: existing.name, email: existing.email, groups: ["admin"] },
        "auth.admin_logged_in",
        existing.id
      );
      return { token: token2, user: toPublicUser(existing) };
    }
    const expert = await this.users.getByEmail(email);
    if (!expert || expert.role !== "expert" || !verifyPassword(input.password, expert.passwordHash)) {
      throw new UnauthorizedError("Invalid crop expert email or password.");
    }
    if (expert.status === "suspended") {
      throw new ForbiddenError("This crop expert account is currently suspended.");
    }
    await this.audit.record(
      logger,
      { id: expert.id, role: "expert", name: expert.name, email: expert.email, groups: ["expert"] },
      "auth.expert_logged_in",
      expert.id
    );
    const token = signSessionToken({
      sub: expert.id,
      role: "expert",
      name: expert.name,
      email: expert.email
    });
    return { token, user: toPublicUser(expert) };
  }
  async getUserProfile(userId) {
    const found = await this.users.get(userId);
    return found ? toPublicUser(found) : null;
  }
  async updateOwnProfile(actor, patch, logger) {
    const existing = await this.users.get(actor.id);
    if (!existing) throw new NotFoundError("User profile not found.");
    const nextName = patch.name?.trim() || existing.name;
    const updated = {
      ...existing,
      name: nextName,
      avatar: initialsFor(nextName),
      ...patch.location !== void 0 ? { location: patch.location.trim() } : {},
      ...patch.phone !== void 0 ? { phone: patch.phone.trim() } : {},
      ...patch.specialisation !== void 0 ? { specialisation: patch.specialisation.trim() } : {},
      ...patch.organisation !== void 0 ? { organisation: patch.organisation.trim() } : {},
      updatedAt: nowIso(),
      version: existing.version + 1
    };
    await this.users.update(updated, existing.version);
    await this.audit.record(logger, actor, "auth.profile_updated", actor.id);
    return toPublicUser(updated);
  }
  async listUsers(page, role) {
    const res = await this.users.list(page, role);
    return {
      items: res.items.map(toPublicUser),
      nextToken: res.nextToken
    };
  }
  async createUserByAdmin(actor, input, logger) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.getByEmail(email);
    if (existing) {
      throw new ConflictError("An account with this email already exists.");
    }
    const now = nowIso();
    const user = {
      id: makeId(input.role),
      email,
      name: input.name.trim(),
      role: input.role,
      location: input.location.trim(),
      phone: input.phone.trim(),
      status: "active",
      avatar: initialsFor(input.name),
      specialisation: input.specialisation?.trim() || void 0,
      organisation: input.organisation?.trim() || (input.role === "expert" ? "KRISHI360 Expert Advisory" : void 0),
      joinedAt: now.slice(0, 10),
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    await this.users.create(user);
    await this.audit.record(logger, actor, "admin.user_created", user.id, {
      role: user.role,
      email: user.email
    });
    return toPublicUser(user);
  }
  async updateUserStatus(actor, userId, status, logger) {
    const existing = await this.users.get(userId);
    if (!existing) throw new NotFoundError("User account not found.");
    const updated = {
      ...existing,
      status,
      updatedAt: nowIso(),
      version: existing.version + 1
    };
    await this.users.update(updated, existing.version);
    await this.audit.record(logger, actor, "admin.user_status_updated", userId, { status });
    return toPublicUser(updated);
  }
};

// backend/src/services/cropDoctorService.ts
var REVIEW_QUEUE_STATUSES = /* @__PURE__ */ new Set(["new", "ai_review", "expert_review"]);
var CropDoctorService = class {
  constructor(cases, ai, uploads, audit) {
    this.cases = cases;
    this.ai = ai;
    this.uploads = uploads;
    this.audit = audit;
  }
  /**
   * Access rules (enforced server-side):
   * - admin: any case
   * - farmer: only their own case
   * - expert: cases assigned to them, or unassigned cases in the review queue
   * Cross-tenant access returns 404 so ids cannot be enumerated.
   */
  assertAccess(user, cropCase) {
    if (user.role === "admin") return;
    if (user.role === "farmer") {
      if (cropCase.farmerId !== user.id) throw new NotFoundError("Crop case not found.");
      return;
    }
    const assignedToMe = cropCase.assignedExpertId === user.id;
    const inQueue = cropCase.assignedExpertId === void 0 && REVIEW_QUEUE_STATUSES.has(cropCase.status);
    if (!assignedToMe && !inQueue) throw new NotFoundError("Crop case not found.");
  }
  async getAccessible(user, id) {
    const cropCase = await this.cases.get(id);
    if (!cropCase) throw new NotFoundError("Crop case not found.");
    this.assertAccess(user, cropCase);
    return cropCase;
  }
  async createCase(user, input, logger) {
    if (user.role !== "farmer" && user.role !== "admin") {
      throw new ForbiddenError("Only farmers or admins can create crop cases.");
    }
    const ts = nowIso();
    const cropCase = {
      id: makeId("CASE"),
      farmerId: user.id,
      ...user.name ? { farmerName: user.name } : {},
      crop: input.crop,
      plantPart: input.plantPart,
      location: input.location,
      symptoms: input.symptoms,
      ...input.imageUrl ? { imageUrl: input.imageUrl } : {},
      status: "new",
      priority: input.priority ?? "medium",
      reviewStatus: "pending",
      createdAt: ts,
      updatedAt: ts,
      version: 1
    };
    await this.cases.create(cropCase);
    await this.audit.record(logger, user, "crop_case.created", cropCase.id, { crop: cropCase.crop });
    return cropCase;
  }
  async listCases(user, page, status) {
    if (user.role === "farmer") return this.cases.listByFarmer(user.id, page, status);
    if (user.role === "expert") return this.cases.listForExpert(user.id, page, status);
    return this.cases.listAll(page, status);
  }
  getCase(user, id) {
    return this.getAccessible(user, id);
  }
  async createUploadUrl(user, id, request, logger) {
    const cropCase = await this.getAccessible(user, id);
    if (user.role === "expert") throw new ForbiddenError("Experts cannot upload images to a case.");
    const upload = await this.uploads.createUpload(cropCase, request);
    await this.audit.record(logger, user, "crop_case.upload_url_issued", id, { imageKey: upload.imageKey });
    return upload;
  }
  async requestAnalysis(user, id, options, logger) {
    const cropCase = await this.getAccessible(user, id);
    if (user.role === "expert") throw new ForbiddenError("Experts review cases; analysis is requested by the owner.");
    if (options.imageKey) this.uploads.assertKeyBelongsToCase(cropCase, options.imageKey);
    const effectiveKey = options.imageKey ?? cropCase.imageKey;
    const analysis = await this.ai.analyze({
      crop: cropCase.crop,
      plantPart: cropCase.plantPart,
      location: cropCase.location,
      symptoms: cropCase.symptoms,
      ...effectiveKey ? { imageKey: effectiveKey } : {},
      ...options.imageBase64 && options.imageMimeType ? { imageData: { base64: options.imageBase64, mimeType: options.imageMimeType } } : {}
    });
    const updated = {
      ...cropCase,
      ...effectiveKey ? { imageKey: effectiveKey } : {},
      aiAnalysis: analysis,
      status: "ai_review",
      reviewStatus: "pending",
      updatedAt: nowIso(),
      version: cropCase.version + 1
    };
    await this.cases.update(updated, cropCase.version);
    await this.audit.record(logger, user, "crop_case.analysis_requested", id, { provider: analysis.provider });
    return { case: updated, analysis };
  }
  async expertReview(user, id, input, logger) {
    if (user.role !== "expert" && user.role !== "admin") {
      throw new ForbiddenError("Only experts or admins can review cases.");
    }
    const cropCase = await this.getAccessible(user, id);
    if (input.status === "completed" && !input.confirmedCondition && !cropCase.aiAnalysis) {
      throw new ValidationError("A completed review needs a confirmedCondition when no AI analysis exists.");
    }
    const review = {
      reviewedBy: user.id,
      ...user.name ? { reviewerName: user.name } : {},
      notes: input.notes,
      guidance: input.guidance,
      ...input.confirmedCondition ? { confirmedCondition: input.confirmedCondition } : {},
      status: input.status,
      reviewedAt: nowIso()
    };
    const updated = {
      ...cropCase,
      expertReview: review,
      assignedExpertId: user.role === "expert" ? user.id : cropCase.assignedExpertId,
      reviewStatus: input.status,
      status: input.status === "completed" ? "resolved" : "expert_review",
      updatedAt: nowIso(),
      version: cropCase.version + 1
    };
    await this.cases.update(updated, cropCase.version);
    await this.audit.record(logger, user, "crop_case.expert_reviewed", id, { reviewStatus: input.status });
    return updated;
  }
};

// backend/src/services/grainGuardService.ts
var CRITICAL_TEMP_MARGIN_C = 3;
var CRITICAL_HUMIDITY_MARGIN = 8;
function evaluateReading(reading, thresholds) {
  const alerts = [];
  if (reading.tempC > thresholds.maxTempC) {
    alerts.push({
      type: "temperature_high",
      severity: reading.tempC >= thresholds.maxTempC + CRITICAL_TEMP_MARGIN_C ? "critical" : "warning",
      message: `Temperature ${reading.tempC}\xB0C exceeds the configured maximum of ${thresholds.maxTempC}\xB0C.`
    });
  }
  if (reading.tempC < thresholds.minTempC) {
    alerts.push({
      type: "temperature_low",
      severity: reading.tempC <= thresholds.minTempC - CRITICAL_TEMP_MARGIN_C ? "critical" : "warning",
      message: `Temperature ${reading.tempC}\xB0C is below the configured minimum of ${thresholds.minTempC}\xB0C.`
    });
  }
  if (reading.humidity > thresholds.maxHumidity) {
    alerts.push({
      type: "humidity_high",
      severity: reading.humidity >= thresholds.maxHumidity + CRITICAL_HUMIDITY_MARGIN ? "critical" : "warning",
      message: `Humidity ${reading.humidity}% exceeds the configured maximum of ${thresholds.maxHumidity}%.`
    });
  }
  return alerts;
}
function statusFromAlerts(alerts) {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.length > 0) return "warning";
  return "normal";
}
var GrainGuardService = class {
  constructor(repo, audit) {
    this.repo = repo;
    this.audit = audit;
  }
  assertAccess(user, batch) {
    if (user.role === "admin") return;
    if (batch.ownerId !== user.id) throw new NotFoundError("Storage batch not found.");
  }
  async getAccessible(user, id) {
    const batch = await this.repo.getBatch(id);
    if (!batch) throw new NotFoundError("Storage batch not found.");
    this.assertAccess(user, batch);
    return batch;
  }
  async createBatch(user, input, logger) {
    const ts = nowIso();
    const evaluated = input.initialReading ? evaluateReading(input.initialReading, input.thresholds) : [];
    const batch = {
      id: makeId("BATCH"),
      ownerId: user.id,
      code: input.code,
      crop: input.crop,
      quantityKg: input.quantityKg,
      location: input.location,
      thresholds: input.thresholds,
      ...input.initialReading ? { currentReading: { ...input.initialReading, recordedAt: ts } } : {},
      status: statusFromAlerts(evaluated),
      createdAt: ts,
      updatedAt: ts,
      version: 1
    };
    await this.repo.createBatch(batch);
    if (input.initialReading) {
      const reading = {
        id: makeId("SREAD"),
        batchId: batch.id,
        ...input.initialReading,
        recordedBy: user.id,
        createdAt: ts
      };
      await this.repo.addReading(reading);
      await this.persistAlerts(batch.id, reading.id, evaluated);
    }
    await this.audit.record(logger, user, "storage.batch_created", batch.id, { crop: batch.crop });
    return batch;
  }
  listBatches(user, page) {
    return user.role === "admin" ? this.repo.listAll(page) : this.repo.listByOwner(user.id, page);
  }
  async getBatch(user, id) {
    const batch = await this.getAccessible(user, id);
    const inspections = await this.repo.listInspections(id);
    return { batch, inspections };
  }
  async persistAlerts(batchId, readingId, evaluated) {
    const alerts = evaluated.map((e) => ({
      id: makeId("ALERT"),
      batchId,
      type: e.type,
      severity: e.severity,
      message: e.message,
      readingId,
      status: "open",
      createdAt: nowIso()
    }));
    for (const alert of alerts) await this.repo.addAlert(alert);
    return alerts;
  }
  async addReading(user, batchId, input, logger) {
    const batch = await this.getAccessible(user, batchId);
    const ts = nowIso();
    const reading = {
      id: makeId("SREAD"),
      batchId,
      tempC: input.tempC,
      humidity: input.humidity,
      source: input.source,
      recordedBy: user.id,
      createdAt: ts
    };
    await this.repo.addReading(reading);
    const evaluated = evaluateReading(reading, batch.thresholds);
    const alerts = await this.persistAlerts(batchId, reading.id, evaluated);
    const status = statusFromAlerts(evaluated);
    const updated = {
      ...batch,
      currentReading: { tempC: input.tempC, humidity: input.humidity, source: input.source, recordedAt: ts },
      status,
      updatedAt: ts,
      version: batch.version + 1
    };
    await this.repo.updateBatch(updated, batch.version);
    if (alerts.length > 0) {
      await this.audit.record(logger, user, "storage.alerts_raised", batchId, { count: alerts.length, status });
    }
    return { reading, alerts, batchStatus: status };
  }
  async listAlerts(user, batchId, page) {
    await this.getAccessible(user, batchId);
    return this.repo.listAlerts(batchId, page);
  }
  async listReadings(user, batchId, page) {
    await this.getAccessible(user, batchId);
    return this.repo.listReadings(batchId, page);
  }
  async addInspection(user, batchId, input, logger) {
    await this.getAccessible(user, batchId);
    const inspection = {
      id: makeId("INSP"),
      batchId,
      inspectorId: user.id,
      ...user.name ? { inspectorName: user.name } : {},
      notes: input.notes,
      condition: input.condition,
      createdAt: nowIso()
    };
    await this.repo.addInspection(inspection);
    await this.audit.record(logger, user, "storage.inspection_added", batchId, { condition: input.condition });
    return inspection;
  }
};

// backend/src/services/jalSenseService.ts
var CROP_NEED = {
  Tomato: 1.05,
  Wheat: 0.9,
  Grapes: 0.72,
  Onion: 0.68,
  Rice: 1.35,
  Cotton: 0.95,
  Maize: 0.92,
  Potato: 0.86
};
var STAGE_FACTOR = {
  Seedling: 0.65,
  Vegetative: 0.9,
  Flowering: 1.15,
  "Fruit / grain formation": 1.2,
  Maturity: 0.55
};
function recommendIrrigation(input) {
  const weatherText = input.weather?.condition ?? "Unknown";
  const temperature = input.weather?.temperatureC ?? 25;
  const hot = temperature >= 32;
  const dryWeather = ["Hot & dry", "Sunny", "Partly cloudy"].includes(weatherText);
  const rainExpected = weatherText.toLowerCase().includes("rain") || (input.weather?.rainfallMm ?? 0) > 5;
  const moisture = Math.min(100, Math.max(0, input.moisture));
  const sandy = input.soilType.toLowerCase().includes("sandy");
  const need = (CROP_NEED[input.crop] ?? 0.9) * (STAGE_FACTOR[input.stage] ?? 1);
  const threshold = sandy ? 40 : 34;
  let action = "hold";
  if (moisture < threshold - 8 || hot && dryWeather && moisture < threshold) action = "irrigate-now";
  else if (moisture < threshold + 8 && !rainExpected) action = "schedule";
  const baseLitres = Math.round(4200 * need * (action === "irrigate-now" ? 1 : action === "schedule" ? 0.7 : 0.25));
  const waterLitres = Math.max(900, baseLitres);
  const durationMin = Math.round(waterLitres / 145);
  return {
    headline: action === "irrigate-now" ? "Irrigation suggested soon" : action === "schedule" ? "Schedule a lighter irrigation" : "Hold irrigation for now",
    action,
    waterLitres,
    durationMin,
    bestWindow: action === "hold" ? "Reassess in 24 hours" : "Early morning or late evening",
    reasoning: [
      `Soil moisture is ${moisture}%. ${sandy ? "Sandy soils drain faster, so the threshold is higher (40%)." : "The default threshold is 34% for this soil group."}`,
      `${input.crop} at ${input.stage.toLowerCase()} stage has a relative water need of ${need.toFixed(2)}x in this model.`,
      rainExpected ? "Rain is indicated in the supplied weather context, so irrigation can be deferred." : hot ? "High temperature increases evapotranspiration." : "Weather context does not indicate immediate rainfall.",
      `Soil type: ${input.soilType}.`
    ],
    confidenceNote: "Advisory estimate derived only from the values you entered. Verify with field observation; simulated readings are not field measurements."
  };
}
var JalSenseService = class {
  constructor(repo, audit) {
    this.repo = repo;
    this.audit = audit;
  }
  assertAccess(user, farm) {
    if (user.role === "admin") return;
    if (farm.farmerId !== user.id) throw new NotFoundError("Farm not found.");
  }
  async getAccessible(user, id) {
    const farm = await this.repo.get(id);
    if (!farm) throw new NotFoundError("Farm not found.");
    this.assertAccess(user, farm);
    return farm;
  }
  async createFarm(user, input, logger) {
    const ts = nowIso();
    const plots = (input.plots ?? []).map((p) => ({
      ...p,
      id: p.id && p.id.trim() ? p.id.trim() : makeId("PLOT")
    }));
    const computedArea = plots.length > 0 ? Number(plots.reduce((sum, p) => sum + p.areaHa, 0).toFixed(2)) : input.areaHa;
    const farm = {
      id: makeId("FARM"),
      farmerId: user.id,
      name: input.name,
      location: input.location,
      areaHa: computedArea,
      soilType: input.soilType,
      irrigationType: input.irrigationType,
      ...typeof input.centerLat === "number" ? { centerLat: input.centerLat } : {},
      ...typeof input.centerLng === "number" ? { centerLng: input.centerLng } : {},
      plots,
      createdAt: ts,
      updatedAt: ts,
      version: 1
    };
    await this.repo.create(farm);
    await this.audit.record(logger, user, "farm.created", farm.id);
    return farm;
  }
  listFarms(user, page) {
    return user.role === "admin" ? this.repo.listAll(page) : this.repo.listByOwner(user.id, page);
  }
  getFarm(user, id) {
    return this.getAccessible(user, id);
  }
  async updateFarm(user, id, patch, logger) {
    const existing = await this.getAccessible(user, id);
    const nextPlots = patch.plots ? patch.plots.map((p) => ({
      id: p.id && p.id.trim() ? p.id.trim() : makeId("PLOT"),
      name: p.name,
      areaHa: p.areaHa,
      crop: p.crop,
      growthStage: p.growthStage,
      ...p.soilMoisture !== void 0 ? { soilMoisture: p.soilMoisture } : {},
      ...p.lastIrrigated ? { lastIrrigated: p.lastIrrigated } : {},
      ...p.status ? { status: p.status } : {},
      ...typeof p.lat === "number" ? { lat: p.lat } : {},
      ...typeof p.lng === "number" ? { lng: p.lng } : {}
    })) : existing.plots;
    const computedArea = patch.plots !== void 0 ? Number(nextPlots.reduce((sum, p) => sum + p.areaHa, 0).toFixed(2)) : patch.areaHa ?? existing.areaHa;
    const updated = {
      ...existing,
      ...patch.name ? { name: patch.name } : {},
      ...patch.location ? { location: patch.location } : {},
      ...patch.soilType ? { soilType: patch.soilType } : {},
      ...patch.irrigationType ? { irrigationType: patch.irrigationType } : {},
      ...typeof patch.centerLat === "number" ? { centerLat: patch.centerLat } : {},
      ...typeof patch.centerLng === "number" ? { centerLng: patch.centerLng } : {},
      areaHa: computedArea,
      plots: nextPlots,
      updatedAt: nowIso(),
      version: existing.version + 1
    };
    await this.repo.update(updated, existing.version);
    await this.audit.record(logger, user, "farm.updated", id, { plotCount: nextPlots.length });
    return updated;
  }
  async addReading(user, farmId, input, logger) {
    const farm = await this.getAccessible(user, farmId);
    const plot = farm.plots.find((p) => p.id === input.plotId);
    if (!plot) throw new ValidationError("plotId does not belong to this farm.");
    const reading = {
      id: makeId("READ"),
      farmId,
      plotId: input.plotId,
      soilMoisture: input.soilMoisture,
      source: input.source,
      ...input.weather ? { weather: input.weather } : {},
      ...input.notes ? { notes: input.notes } : {},
      recommendation: recommendIrrigation({
        crop: plot.crop,
        stage: plot.growthStage,
        soilType: farm.soilType,
        moisture: input.soilMoisture,
        ...input.weather ? { weather: input.weather } : {}
      }),
      recordedBy: user.id,
      createdAt: nowIso()
    };
    await this.repo.addReading(reading);
    await this.audit.record(logger, user, "farm.reading_added", farmId, { plotId: input.plotId, source: input.source });
    return reading;
  }
  async listReadings(user, farmId, plotId, page) {
    await this.getAccessible(user, farmId);
    return this.repo.listReadings(farmId, plotId, page);
  }
};

// backend/src/services/mandiService.ts
var MandiService = class {
  constructor(repo, audit) {
    this.repo = repo;
    this.audit = audit;
  }
  async list(filters, page) {
    const result = await this.repo.query(filters, page);
    const simulated = result.items.length > 0 && result.items.every((p) => p.dataType === "sample");
    return { page: result, simulated };
  }
  async get(id) {
    const price = await this.repo.get(id);
    if (!price) throw new NotFoundError("Mandi price record not found.");
    return { price, simulated: price.dataType === "sample" };
  }
  /** Admin-only ingestion. `dataType` must honestly reflect the source. */
  async create(user, input, logger) {
    if (user.role !== "admin") throw new ForbiddenError("Only admins can add mandi price records.");
    const ts = nowIso();
    const price = {
      ...input,
      id: makeId("PRICE"),
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    };
    await this.repo.put(price);
    await this.audit.record(logger, user, "mandi.price_created", price.id, {
      crop: price.crop,
      dataType: price.dataType
    });
    return price;
  }
};

// backend/src/models/scheme.ts
var ELIGIBILITY_DISCLAIMER = "Indicative check based only on the details you provided and the stored scheme summary. This is NOT a confirmation of eligibility, benefit amount or approval. Verify current rules and apply only through the official source.";

// backend/src/services/schemeService.ts
function evaluateRule(rule, profile) {
  const actual = profile[rule.field];
  if (actual === void 0 || actual === null || actual === "") return "unknown";
  switch (rule.op) {
    case "eq":
      if (rule.field === "state") {
        return actual === rule.value || rule.value === "All India" ? "met" : "not_met";
      }
      return String(actual).toLowerCase() === String(rule.value).toLowerCase() ? "met" : "not_met";
    case "neq":
      return String(actual).toLowerCase() !== String(rule.value).toLowerCase() ? "met" : "not_met";
    case "lte":
      return typeof actual === "number" && typeof rule.value === "number" && actual <= rule.value ? "met" : "not_met";
    case "gte":
      return typeof actual === "number" && typeof rule.value === "number" && actual >= rule.value ? "met" : "not_met";
    case "in":
      return Array.isArray(rule.value) && rule.value.map((v) => v.toLowerCase()).includes(String(actual).toLowerCase()) ? "met" : "not_met";
    default:
      return "unknown";
  }
}
var SchemeService = class {
  constructor(repo, audit) {
    this.repo = repo;
    this.audit = audit;
  }
  async list(filters, page) {
    const result = await this.repo.list(filters, page);
    const simulated = result.items.length > 0 && result.items.every((s) => s.dataType === "sample");
    return { page: result, simulated };
  }
  async get(id) {
    const scheme = await this.repo.get(id);
    if (!scheme) throw new NotFoundError("Scheme not found.");
    return { scheme, simulated: scheme.dataType === "sample" };
  }
  async upsert(actor, input, logger) {
    const ts = nowIso();
    const existing = input.id ? await this.repo.get(input.id) : null;
    const scheme = {
      id: existing?.id ?? input.id ?? makeId("SCHEME"),
      name: input.name,
      category: input.category,
      state: input.state,
      summary: input.summary,
      eligibility: input.eligibility,
      eligibilityRules: existing?.eligibilityRules ?? [
        {
          field: "state",
          op: "eq",
          value: input.state,
          description: `Applicable in ${input.state}.`
        }
      ],
      documents: input.documents,
      sourceLabel: input.sourceLabel,
      sourceUrl: input.sourceUrl,
      tags: input.tags,
      dataType: input.dataType,
      lastUpdatedAt: ts,
      createdAt: existing?.createdAt ?? ts,
      version: (existing?.version ?? 0) + 1
    };
    await this.repo.put(scheme);
    if (this.audit) {
      await this.audit.record(logger, actor, "scheme.saved", scheme.id, {
        name: scheme.name,
        category: scheme.category
      });
    }
    return scheme;
  }
  /**
   * Indicative eligibility check. NEVER guarantees eligibility or approval;
   * missing profile fields produce "unknown", not assumptions.
   */
  async checkEligibility(schemeId, profile) {
    const scheme = await this.repo.get(schemeId);
    if (!scheme) throw new NotFoundError("Scheme not found.");
    const criteria = scheme.eligibilityRules.map((rule) => ({
      description: rule.description,
      result: evaluateRule(rule, profile)
    }));
    const outcome = criteria.some((c) => c.result === "not_met") ? "likely_not_eligible" : criteria.length > 0 && criteria.every((c) => c.result === "met") ? "likely_eligible" : "insufficient_information";
    return {
      schemeId: scheme.id,
      schemeName: scheme.name,
      outcome,
      criteria,
      documents: scheme.documents,
      sourceLabel: scheme.sourceLabel,
      sourceUrl: scheme.sourceUrl,
      lastUpdatedAt: scheme.lastUpdatedAt,
      disclaimer: ELIGIBILITY_DISCLAIMER
    };
  }
};

// backend/src/services/uploadService.ts
import { S3Client as S3Client3 } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID as randomUUID2 } from "node:crypto";
var EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
var UploadService = class {
  constructor(config, s3) {
    this.config = config;
    this.s3 = s3;
  }
  client() {
    if (!this.config.uploadBucketName) {
      throw new ServiceUnavailableError(
        "UPLOAD_NOT_CONFIGURED",
        "Image uploads are not configured. Set UPLOAD_BUCKET_NAME and deploy the S3 bucket first."
      );
    }
    return this.s3 ?? new S3Client3({ region: this.config.awsRegion });
  }
  validate(request) {
    if (!this.config.allowedImageTypes.includes(request.contentType)) {
      throw new UnsupportedMediaTypeError(`Only ${this.config.allowedImageTypes.join(", ")} images are allowed.`);
    }
    if (request.sizeBytes > this.config.maxUploadBytes) {
      throw new PayloadTooLargeError(`Image exceeds the ${this.config.maxUploadBytes} byte limit.`);
    }
  }
  buildKey(cropCase, contentType) {
    const ext = EXT_BY_TYPE[contentType];
    if (!ext) throw new ValidationError("Unsupported image type.");
    return `crops/${cropCase.farmerId}/${cropCase.id}/${randomUUID2()}.${ext}`;
  }
  async createUpload(cropCase, request) {
    this.validate(request);
    const client = this.client();
    const imageKey = this.buildKey(cropCase, request.contentType);
    const { url, fields } = await createPresignedPost(client, {
      Bucket: this.config.uploadBucketName,
      Key: imageKey,
      Expires: this.config.uploadUrlExpirySeconds,
      Conditions: [
        ["content-length-range", 1, this.config.maxUploadBytes],
        ["eq", "$Content-Type", request.contentType],
        ["eq", "$key", imageKey]
      ],
      Fields: { "Content-Type": request.contentType }
    });
    return {
      url,
      fields,
      imageKey,
      expiresAt: new Date(Date.now() + this.config.uploadUrlExpirySeconds * 1e3).toISOString(),
      constraints: { maxSizeBytes: this.config.maxUploadBytes, allowedTypes: this.config.allowedImageTypes }
    };
  }
  /** An image key may only be attached to the case whose prefix it belongs to. */
  assertKeyBelongsToCase(cropCase, imageKey) {
    const expectedPrefix = `crops/${cropCase.farmerId}/${cropCase.id}/`;
    if (!imageKey.startsWith(expectedPrefix)) {
      throw new ValidationError("imageKey does not belong to this case.");
    }
  }
};

// backend/src/services/workspaceService.ts
var DEFAULT_SETTINGS = {
  id: "global",
  language: "English",
  notificationsEnabled: true,
  demoMode: true,
  compactTables: false,
  expertReviewSlaHours: 24,
  storageAlertTemp: 28,
  storageAlertHumidity: 70
};
var WorkspaceService = class {
  constructor(repo, audit) {
    this.repo = repo;
    this.audit = audit;
  }
  async ensureUserWorkspace(userId) {
    const existing = await this.repo.getUserWorkspace(userId);
    if (existing) return existing;
    const initial = {
      userId,
      savedSchemeIds: [],
      applications: [],
      mandiAlerts: [],
      irrigationSchedules: [],
      customCrops: [],
      updatedAt: nowIso(),
      version: 1
    };
    await this.repo.saveUserWorkspace(initial);
    return initial;
  }
  async getSnapshot(user) {
    const [workspace, notifPage, settingsExisting] = await Promise.all([
      this.ensureUserWorkspace(user.id),
      this.repo.listNotifications({ limit: 100 }),
      this.repo.getPlatformSettings()
    ]);
    const settings = settingsExisting ?? {
      ...DEFAULT_SETTINGS,
      updatedAt: nowIso(),
      version: 1
    };
    const visibleNotifications = notifPage.items.filter((n) => {
      if (n.targetUserId) {
        return n.targetUserId === user.id || user.role === "admin";
      }
      return user.role === "admin" || n.audience === "all" || n.audience === user.role;
    }).map((n) => ({
      ...n,
      read: n.readBy.includes(user.id)
    }));
    return {
      workspace,
      notifications: visibleNotifications,
      settings
    };
  }
  async saveUserWorkspace(user, patch) {
    const current2 = await this.ensureUserWorkspace(user.id);
    const next = {
      ...current2,
      ...patch.savedSchemeIds !== void 0 ? { savedSchemeIds: patch.savedSchemeIds } : {},
      ...patch.applications !== void 0 ? { applications: patch.applications } : {},
      ...patch.mandiAlerts !== void 0 ? { mandiAlerts: patch.mandiAlerts } : {},
      ...patch.irrigationSchedules !== void 0 ? { irrigationSchedules: patch.irrigationSchedules } : {},
      ...patch.customCrops !== void 0 ? { customCrops: patch.customCrops } : {},
      ...patch.preferences !== void 0 ? { preferences: patch.preferences } : {},
      updatedAt: nowIso(),
      version: current2.version + 1
    };
    await this.repo.saveUserWorkspace(next);
    return next;
  }
  async createNotification(user, input) {
    const requestedTarget = user.role === "admin" ? input.targetUserId : void 0;
    const scopeToSelf = user.role !== "admin" && (input.audience === user.role || input.audience === "all");
    const targetUserId = requestedTarget ?? (scopeToSelf ? user.id : void 0);
    const record = {
      id: makeId("NOTIF"),
      title: input.title,
      body: input.body,
      severity: input.severity,
      audience: input.audience,
      ...targetUserId ? { targetUserId } : {},
      readBy: [],
      createdAt: nowIso()
    };
    await this.repo.putNotification(record);
    return { ...record, read: record.readBy.includes(user.id) };
  }
  async markNotificationsRead(user, input) {
    const page = await this.repo.listNotifications({ limit: 100 });
    for (const item of page.items) {
      if (item.targetUserId && item.targetUserId !== user.id && user.role !== "admin") continue;
      if (input.id && item.id !== input.id) continue;
      if (!input.id && input.audience && item.audience !== input.audience && item.audience !== "all") continue;
      if (!item.readBy.includes(user.id)) {
        await this.repo.putNotification({
          ...item,
          readBy: [...item.readBy, user.id]
        });
      }
    }
  }
  async updatePlatformSettings(user, input, logger) {
    const existing = await this.repo.getPlatformSettings();
    const next = {
      id: "global",
      ...input,
      updatedAt: nowIso(),
      version: (existing?.version ?? 0) + 1
    };
    await this.repo.savePlatformSettings(next);
    await this.audit.record(logger, user, "admin.settings_updated", "SETTINGS#global", {
      language: next.language,
      expertReviewSlaHours: next.expertReviewSlaHours
    });
    return next;
  }
};

// backend/src/container.ts
function buildRepositories(config) {
  if (config.dataBackend === "memory") {
    return {
      cases: new MemoryCropCaseRepository(),
      mandi: new MemoryMandiRepository(),
      farms: new MemoryFarmRepository(),
      storage: new MemoryStorageRepository(),
      schemes: new MemorySchemeRepository(),
      audit: new MemoryAuditRepository(),
      users: new MemoryUserRepository(),
      workspace: new MemoryWorkspaceRepository()
    };
  }
  if (config.dataBackend === "sqlite") {
    const db = getSqliteDb(config.sqliteDbPath);
    return {
      cases: new SqliteCropCaseRepository(db),
      mandi: new SqliteMandiRepository(db),
      farms: new SqliteFarmRepository(db),
      storage: new SqliteStorageRepository(db),
      schemes: new SqliteSchemeRepository(db),
      audit: new SqliteAuditRepository(db),
      users: new SqliteUserRepository(db),
      workspace: new SqliteWorkspaceRepository(db)
    };
  }
  const client = getDocClient(config);
  const usersTable = config.usersTableName;
  const flagTable = config.flagTableName;
  return {
    cases: new DynamoCropCaseRepository(client, flagTable),
    mandi: new DynamoMandiRepository(client, flagTable),
    farms: new DynamoFarmRepository(client, flagTable),
    storage: new DynamoStorageRepository(client, flagTable),
    schemes: new DynamoSchemeRepository(client, flagTable),
    audit: new DynamoAuditRepository(client, flagTable),
    users: new DynamoUserRepository(client, usersTable, flagTable),
    workspace: new DynamoWorkspaceRepository(client, flagTable)
  };
}
function buildContainer(config, repos = buildRepositories(config)) {
  const audit = new AuditService(repos.audit);
  const auth = new AuthService(repos.users, audit);
  const uploads = new UploadService(config);
  const ai = createAiService(config);
  return {
    config,
    repos,
    audit,
    auth,
    cropDoctor: new CropDoctorService(repos.cases, ai, uploads, audit),
    mandi: new MandiService(repos.mandi, audit),
    jalSense: new JalSenseService(repos.farms, audit),
    grainGuard: new GrainGuardService(repos.storage, audit),
    schemes: new SchemeService(repos.schemes, audit),
    workspace: new WorkspaceService(repos.workspace, audit)
  };
}
var current;
function getContainer() {
  if (!current) current = buildContainer(loadConfig());
  return current;
}
function setContainer(container) {
  current = container;
}

// backend/src/middleware/withHttp.ts
import { randomUUID as randomUUID3 } from "node:crypto";

// backend/src/utils/logger.ts
var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
var SENSITIVE_KEY = /authorization|token|password|secret|credential|api[-_]?key|cookie/i;
var EMAIL_KEY = /email/i;
function maskEmail(value) {
  const [name, domain] = value.split("@");
  if (!domain || !name) return "[redacted]";
  return `${name.slice(0, 1)}***@${domain}`;
}
function redact(value, depth = 0) {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) out[k] = "[redacted]";
      else if (EMAIL_KEY.test(k) && typeof v === "string") out[k] = maskEmail(v);
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return value;
}
function createLogger(level, base = {}) {
  const emit = (lvl, msg, fields) => {
    if (LEVELS[lvl] < LEVELS[level]) return;
    const line = {
      level: lvl,
      msg,
      time: (/* @__PURE__ */ new Date()).toISOString(),
      ...redact(base),
      ...fields ? redact(fields) : {}
    };
    console.log(JSON.stringify(line));
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child: (fields) => createLogger(level, { ...base, ...fields })
  };
}

// backend/src/utils/response.ts
var API_SOURCE = "krishi360-api";
var SECURITY_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains"
};
function corsHeaders(config, origin) {
  if (!origin || !config.allowedOrigins.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  };
}
function successResponse(data, opts) {
  const envelope = {
    data,
    meta: { source: API_SOURCE, simulated: opts.simulated === true, timestamp: nowIso() }
  };
  return {
    statusCode: opts.status ?? 200,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(opts.config, opts.origin),
      "X-Request-Id": opts.requestId
    },
    body: JSON.stringify(envelope)
  };
}
function errorResponse(err, opts) {
  const appErr = err instanceof AppError ? err : new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  const body = {
    error: {
      code: appErr.code,
      message: appErr.message,
      ...appErr.details !== void 0 ? { details: appErr.details } : {},
      requestId: opts.requestId
    }
  };
  return {
    statusCode: appErr.statusCode,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(opts.config, opts.origin),
      "X-Request-Id": opts.requestId
    },
    body: JSON.stringify(body)
  };
}

// backend/src/middleware/auth.ts
function header(event, name) {
  const headers = event.headers ?? {};
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === "string") return v;
  }
  return void 0;
}
function parseGroups(raw) {
  if (Array.isArray(raw)) return raw.filter((g) => typeof g === "string");
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((g) => typeof g === "string");
    } catch {
    }
    return raw.split(",").map((g) => g.trim()).filter(Boolean);
  }
  return [];
}
function roleFromGroups(groups) {
  if (groups.includes("admin")) return "admin";
  if (groups.includes("expert")) return "expert";
  if (groups.includes("farmer")) return "farmer";
  return null;
}
function resolveUser(event, config) {
  if (config.authMode === "dev" || config.authMode === "session") {
    const authHeader = header(event, "authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const claims2 = verifySessionToken(token);
    if (!claims2) throw new UnauthorizedError("Invalid or expired session token.");
    return {
      id: claims2.sub,
      role: claims2.role,
      name: claims2.name,
      email: claims2.email,
      groups: [claims2.role]
    };
  }
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims || typeof claims.sub !== "string" || !claims.sub) return null;
  const groups = parseGroups(claims["cognito:groups"]);
  const role = roleFromGroups(groups);
  if (!role) return null;
  return {
    id: claims.sub,
    role,
    name: typeof claims.name === "string" ? claims.name : void 0,
    email: typeof claims.email === "string" ? claims.email : void 0,
    groups
  };
}
function requireRole(user, ...roles) {
  if (!user) throw new UnauthorizedError();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

// backend/src/middleware/withHttp.ts
function getHeader(event, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (k.toLowerCase() === lower && typeof v === "string") return v;
  }
  return void 0;
}
function parseWith(schema, value, source) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(`Invalid request ${source}.`, {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }
  return result.data;
}
function parseBody(raw) {
  if (raw === null || raw === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
function withHttp(options, config, handler10) {
  return async (event) => {
    const requestId = event.requestContext?.requestId ?? randomUUID3();
    const origin = getHeader(event, "origin");
    const logger = createLogger(config.logLevel, {
      requestId,
      route: `${event.httpMethod} ${event.resource ?? event.path}`
    });
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: corsHeaders(config, origin), body: "" };
    }
    const started = Date.now();
    try {
      const user = options.auth === "required" ? resolveUser(event, config) : null;
      if (options.auth === "required") {
        if (!user) throw new UnauthorizedError();
        if (options.roles) requireRole(user, ...options.roles);
      }
      const ctx = {
        user,
        requestId,
        body: options.body ? parseWith(options.body, parseBody(event.body), "body") : parseBody(event.body),
        query: options.query ? parseWith(options.query, event.queryStringParameters ?? {}, "query") : event.queryStringParameters ?? {},
        params: options.params ? parseWith(options.params, event.pathParameters ?? {}, "path") : event.pathParameters ?? {},
        logger: logger.child({ userId: user?.id, role: user?.role }),
        event
      };
      const result = await handler10(ctx);
      logger.info("request.completed", { status: result.status ?? 200, durationMs: Date.now() - started });
      return successResponse(result.data, {
        status: result.status,
        simulated: result.simulated,
        requestId,
        config,
        origin
      });
    } catch (err) {
      if (err instanceof AppError) {
        logger.warn("request.failed", { code: err.code, status: err.statusCode, durationMs: Date.now() - started });
      } else {
        logger.error("request.error", {
          durationMs: Date.now() - started,
          errorName: err instanceof Error ? err.name : "unknown",
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      }
      return errorResponse(err, { requestId, config, origin });
    }
  };
}

// backend/src/validators/index.ts
import { z as z3 } from "zod";
var idParam = z3.object({ id: z3.string().min(1).max(128) }).strict();
var paginationQuery = z3.object({
  limit: z3.coerce.number().int().min(1).max(100).default(20),
  cursor: z3.string().max(2048).optional()
});
var trimmed = (min, max) => z3.string().trim().min(min).max(max);
var dateString = z3.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD date.");
var readingSource = z3.enum(["manual", "simulated"]);
var safeImageUrl = z3.string().trim().max(512).refine(
  (val) => val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://") || val.startsWith("blob:"),
  "Unsupported image URL scheme."
);
var cropCaseCreateSchema = z3.object({
  crop: trimmed(1, 80),
  plantPart: trimmed(1, 80),
  location: trimmed(1, 160),
  symptoms: z3.string().trim().max(2e3).default(""),
  imageUrl: safeImageUrl.optional(),
  priority: z3.enum(["low", "medium", "high"]).optional()
}).strict();
var cropCaseListQuery = paginationQuery.extend({
  status: z3.enum(["new", "ai_review", "expert_review", "resolved"]).optional()
});
var uploadUrlSchema = z3.object({
  fileName: trimmed(1, 255),
  contentType: z3.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z3.number().int().positive().max(25 * 1024 * 1024)
}).strict();
var analysisSchema = z3.object({
  imageKey: z3.string().min(1).max(512).optional(),
  imageBase64: z3.string().min(16).max(105e5).regex(/^[A-Za-z0-9+/=]+$/, "Invalid base64 image payload.").optional(),
  imageMimeType: z3.enum(["image/jpeg", "image/png", "image/webp"]).optional()
}).strict().refine(
  (val) => Boolean(val.imageBase64) === Boolean(val.imageMimeType),
  { message: "imageBase64 and imageMimeType must be provided together.", path: ["imageMimeType"] }
);
var expertReviewSchema = z3.object({
  notes: trimmed(1, 4e3),
  guidance: z3.string().trim().max(4e3).default(""),
  status: z3.enum(["in_review", "completed", "needs_info"]),
  confirmedCondition: trimmed(1, 160).optional()
}).strict();
var mandiQuerySchema = paginationQuery.extend({
  crop: trimmed(1, 80).optional(),
  mandi: trimmed(1, 120).optional(),
  state: trimmed(1, 80).optional(),
  district: trimmed(1, 80).optional(),
  date: dateString.optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional()
});
var mandiCreateSchema = z3.object({
  crop: trimmed(1, 80),
  state: trimmed(1, 80),
  district: trimmed(1, 80),
  mandi: trimmed(1, 120),
  minPrice: z3.number().nonnegative(),
  maxPrice: z3.number().nonnegative(),
  modalPrice: z3.number().nonnegative(),
  unit: trimmed(1, 40).default("INR/quintal"),
  date: dateString,
  source: trimmed(1, 200),
  dataType: z3.enum(["sample", "verified"]),
  changePct: z3.number().min(-100).max(1e3).optional()
}).strict().refine((v) => v.minPrice <= v.modalPrice && v.modalPrice <= v.maxPrice, {
  message: "Prices must satisfy minPrice <= modalPrice <= maxPrice.",
  path: ["modalPrice"]
});
var plotSchema = z3.object({
  id: trimmed(1, 128).optional(),
  name: trimmed(1, 80),
  areaHa: z3.number().positive().max(1e4),
  crop: trimmed(1, 80),
  growthStage: trimmed(1, 80),
  soilMoisture: z3.number().min(0).max(100).optional(),
  lastIrrigated: trimmed(1, 64).optional(),
  status: z3.enum(["healthy", "watch", "attention"]).optional(),
  lat: z3.number().min(-90).max(90).optional(),
  lng: z3.number().min(-180).max(180).optional()
}).strict();
var farmCreateSchema = z3.object({
  name: trimmed(1, 120),
  location: trimmed(1, 160),
  areaHa: z3.number().nonnegative().max(1e5),
  soilType: trimmed(1, 80),
  irrigationType: trimmed(1, 80),
  plots: z3.array(plotSchema).max(50).default([]),
  centerLat: z3.number().min(-90).max(90).optional(),
  centerLng: z3.number().min(-180).max(180).optional()
}).strict();
var soilReadingSchema = z3.object({
  plotId: trimmed(1, 128),
  soilMoisture: z3.number().min(0).max(100),
  source: readingSource.default("manual"),
  weather: z3.object({
    condition: trimmed(1, 80),
    temperatureC: z3.number().min(-20).max(60).optional(),
    rainfallMm: z3.number().min(0).max(1e3).optional()
  }).strict().optional(),
  notes: trimmed(1, 1e3).optional()
}).strict();
var readingsQuerySchema = paginationQuery.extend({
  plotId: trimmed(1, 128).optional()
});
var storageBatchCreateSchema = z3.object({
  code: trimmed(1, 40),
  crop: trimmed(1, 80),
  quantityKg: z3.number().positive().max(1e7),
  location: trimmed(1, 160),
  thresholds: z3.object({
    minTempC: z3.number().min(-40).max(80),
    maxTempC: z3.number().min(-40).max(80),
    maxHumidity: z3.number().min(0).max(100)
  }).strict().refine((t) => t.minTempC < t.maxTempC, {
    message: "minTempC must be lower than maxTempC.",
    path: ["minTempC"]
  }),
  initialReading: z3.object({
    tempC: z3.number().min(-40).max(80),
    humidity: z3.number().min(0).max(100),
    source: readingSource.default("manual")
  }).strict().optional()
}).strict();
var storageReadingSchema = z3.object({
  tempC: z3.number().min(-40).max(80),
  humidity: z3.number().min(0).max(100),
  source: readingSource.default("manual")
}).strict();
var inspectionSchema = z3.object({
  notes: trimmed(1, 2e3),
  condition: z3.enum(["normal", "warning", "critical"])
}).strict();
var schemeQuerySchema = paginationQuery.extend({
  q: trimmed(1, 120).optional(),
  category: trimmed(1, 80).optional(),
  state: trimmed(1, 80).optional()
});
var eligibilityCheckSchema = z3.object({
  schemeId: trimmed(1, 128),
  profile: z3.object({
    state: trimmed(1, 80).optional(),
    landHoldingHa: z3.number().min(0).max(1e5).optional(),
    annualIncomeINR: z3.number().min(0).max(1e9).optional(),
    age: z3.number().int().min(0).max(120).optional(),
    category: trimmed(1, 80).optional(),
    gender: trimmed(1, 40).optional()
  }).strict()
}).strict();
var auditQuerySchema = paginationQuery.extend({
  actorId: trimmed(1, 128).optional()
});
var backendEntityEnum = z3.enum([
  "cropCases",
  "mandiPrices",
  "schemes",
  "storageBatches",
  "farms",
  "auditLogs",
  "users",
  "notifications"
]);
var backendRecordsQuerySchema = paginationQuery.extend({
  entity: backendEntityEnum
});
var backendSeedBodySchema = z3.object({
  mode: z3.enum(["missing", "reset"]).default("missing")
}).strict().optional();
var farmUpdateSchema = z3.object({
  name: trimmed(1, 120).optional(),
  location: trimmed(1, 160).optional(),
  areaHa: z3.number().nonnegative().max(1e5).optional(),
  soilType: trimmed(1, 80).optional(),
  irrigationType: trimmed(1, 80).optional(),
  centerLat: z3.number().min(-90).max(90).optional(),
  centerLng: z3.number().min(-180).max(180).optional(),
  plots: z3.array(
    z3.object({
      id: trimmed(1, 128).optional(),
      name: trimmed(1, 80),
      areaHa: z3.number().positive().max(1e4),
      crop: trimmed(1, 80),
      growthStage: trimmed(1, 80),
      soilMoisture: z3.number().min(0).max(100).optional(),
      lastIrrigated: trimmed(1, 64).optional(),
      status: z3.enum(["healthy", "watch", "attention"]).optional(),
      lat: z3.number().min(-90).max(90).optional(),
      lng: z3.number().min(-180).max(180).optional()
    }).strict()
  ).min(0).max(50).optional()
}).strict();
var schemeCreateSchema = z3.object({
  id: trimmed(1, 128).optional(),
  name: trimmed(2, 160),
  category: trimmed(2, 80),
  state: trimmed(2, 80),
  summary: trimmed(10, 2e3),
  eligibility: z3.array(trimmed(2, 300)).min(1).max(20),
  documents: z3.array(trimmed(2, 300)).min(1).max(20),
  sourceLabel: trimmed(2, 160),
  sourceUrl: z3.string().trim().url().max(512),
  tags: z3.array(trimmed(1, 40)).max(20).default([]),
  dataType: z3.enum(["sample", "verified"]).default("sample")
}).strict();
var profileUpdateSchema = z3.object({
  name: trimmed(2, 120).optional(),
  location: z3.string().trim().max(160).optional(),
  phone: z3.string().trim().max(40).optional(),
  specialisation: z3.string().trim().max(120).optional(),
  organisation: z3.string().trim().max(120).optional()
}).strict();
var workspaceSaveSchema = z3.object({
  savedSchemeIds: z3.array(trimmed(1, 128)).max(200).optional(),
  applications: z3.array(
    z3.object({
      id: trimmed(1, 128),
      schemeId: trimmed(1, 128),
      farmerId: trimmed(1, 128),
      progress: z3.number().min(0).max(100),
      stage: trimmed(1, 120),
      updatedAt: trimmed(1, 64)
    }).strict()
  ).max(200).optional(),
  mandiAlerts: z3.array(
    z3.object({
      id: trimmed(1, 128),
      crop: trimmed(1, 80),
      district: trimmed(1, 80),
      targetPrice: z3.number().nonnegative().max(1e6),
      createdAt: trimmed(1, 64)
    }).strict()
  ).max(100).optional(),
  irrigationSchedules: z3.array(
    z3.object({
      id: trimmed(1, 128),
      plot: trimmed(1, 120),
      crop: trimmed(1, 80),
      stage: trimmed(1, 80),
      nextDate: trimmed(1, 64),
      waterLitres: z3.number().nonnegative().max(1e7).optional(),
      reminder: z3.boolean()
    }).strict()
  ).max(100).optional(),
  customCrops: z3.array(trimmed(1, 80)).max(100).optional(),
  preferences: z3.object({
    language: trimmed(2, 40),
    notificationsEnabled: z3.boolean(),
    compactTables: z3.boolean(),
    expertReviewSlaHours: z3.number().int().min(1).max(168).optional()
  }).strict().optional()
}).strict();
var notificationCreateSchema = z3.object({
  title: trimmed(1, 160),
  body: trimmed(1, 1e3),
  severity: z3.enum(["info", "success", "warning", "critical"]).default("info"),
  audience: z3.enum(["farmer", "expert", "admin", "all"]).default("all"),
  targetUserId: trimmed(1, 128).optional()
}).strict();
var notificationReadSchema = z3.object({
  id: trimmed(1, 128).optional(),
  audience: z3.enum(["farmer", "expert", "admin", "all"]).optional()
}).strict();
var platformSettingsSchema = z3.object({
  language: trimmed(2, 40),
  notificationsEnabled: z3.boolean(),
  demoMode: z3.boolean(),
  compactTables: z3.boolean(),
  expertReviewSlaHours: z3.number().int().min(1).max(168),
  storageAlertTemp: z3.number().min(-10).max(60),
  storageAlertHumidity: z3.number().min(0).max(100)
}).strict();
var farmerRegisterSchema = z3.object({
  name: trimmed(2, 120),
  email: z3.string().trim().email("Enter a valid email address.").max(160),
  password: z3.string().min(8, "Password must be at least 8 characters.").max(128),
  location: trimmed(2, 160).default("India"),
  phone: z3.string().trim().max(40).optional()
}).strict();
var farmerLoginSchema = z3.object({
  email: z3.string().trim().email("Enter a valid email address.").max(160),
  password: z3.string().min(1, "Password is required.").max(128)
}).strict();
var staffLoginSchema = z3.object({
  email: z3.string().trim().email("Enter a valid email address.").max(160),
  password: z3.string().min(1, "Password is required.").max(128),
  role: z3.enum(["expert", "admin"])
}).strict();
var adminSetupSchema = z3.object({
  name: trimmed(2, 120),
  email: z3.string().trim().email("Enter a valid email address.").max(160),
  password: z3.string().min(8, "Password must be at least 8 characters.").max(128)
}).strict();
var adminUsersQuerySchema = paginationQuery.extend({
  role: z3.enum(["farmer", "expert", "admin"]).optional()
});
var adminCreateUserSchema = z3.object({
  name: trimmed(2, 120),
  email: z3.string().trim().email("Enter a valid email address.").max(160),
  password: z3.string().min(8, "Password must be at least 8 characters.").max(128),
  role: z3.enum(["farmer", "expert", "admin"]),
  location: trimmed(2, 160),
  phone: trimmed(5, 40),
  specialisation: trimmed(2, 120).optional(),
  organisation: trimmed(2, 120).optional()
}).strict();
var adminUserStatusSchema = z3.object({
  status: z3.enum(["active", "invited", "suspended"])
}).strict();

// backend/src/handlers/router.ts
import { randomUUID as randomUUID4 } from "node:crypto";
function createRouter(routes, config) {
  return async (event) => {
    const route = routes.find(
      (r) => r.method === event.httpMethod && r.resource === (event.resource ?? event.path)
    );
    if (!route) {
      return errorResponse(new NotFoundError("Route not found."), {
        requestId: event.requestContext?.requestId ?? randomUUID4(),
        config
      });
    }
    return route.handler(event);
  };
}
function lazyRouter(build) {
  let router;
  return async (event) => {
    if (!router) {
      const { routes, config } = build();
      router = createRouter(routes, config);
    }
    return router(event);
  };
}

// backend/src/handlers/auth.ts
function buildAuthRoutes(config, container) {
  const auth = container.auth;
  return [
    {
      method: "GET",
      resource: "/health",
      handler: withHttp({ auth: "none" }, config, async () => ({
        data: {
          status: "ok",
          service: "krishi360-ai-backend",
          version: "0.1.0",
          time: (/* @__PURE__ */ new Date()).toISOString(),
          features: {
            aiProvider: config.aiProvider,
            uploadsConfigured: Boolean(config.uploadBucketName),
            dataBackend: config.dataBackend
          }
        }
      }))
    },
    {
      method: "GET",
      resource: "/me",
      handler: withHttp({ auth: "required" }, config, async (ctx) => {
        const profile = await auth.getUserProfile(ctx.user.id);
        return {
          data: profile ?? {
            id: ctx.user.id,
            role: ctx.user.role,
            name: ctx.user.name ?? "User",
            email: ctx.user.email ?? "",
            groups: ctx.user.groups
          }
        };
      })
    },
    {
      method: "PATCH",
      resource: "/me",
      handler: withHttp({ auth: "required", body: profileUpdateSchema }, config, async (ctx) => ({
        data: await auth.updateOwnProfile(ctx.user, ctx.body, ctx.logger)
      }))
    },
    {
      method: "GET",
      resource: "/auth/bootstrap-status",
      handler: withHttp({ auth: "none" }, config, async () => ({
        data: await auth.getBootstrapStatus()
      }))
    },
    {
      method: "POST",
      resource: "/auth/setup-admin",
      handler: withHttp({ auth: "none", body: adminSetupSchema }, config, async (ctx) => ({
        status: 201,
        data: await auth.setupInitialAdmin(ctx.body, ctx.logger)
      }))
    },
    {
      method: "POST",
      resource: "/auth/register",
      handler: withHttp({ auth: "none", body: farmerRegisterSchema }, config, async (ctx) => ({
        status: 201,
        data: await auth.registerFarmer(ctx.body, ctx.logger)
      }))
    },
    {
      method: "POST",
      resource: "/auth/login",
      handler: withHttp({ auth: "none", body: farmerLoginSchema }, config, async (ctx) => ({
        data: await auth.loginFarmer(ctx.body, ctx.logger)
      }))
    },
    {
      method: "POST",
      resource: "/auth/staff-login",
      handler: withHttp({ auth: "none", body: staffLoginSchema }, config, async (ctx) => ({
        data: await auth.loginStaff(ctx.body, ctx.logger)
      }))
    },
    {
      method: "GET",
      resource: "/admin/users",
      handler: withHttp(
        { auth: "required", roles: ["admin"], query: adminUsersQuerySchema },
        config,
        async (ctx) => ({
          data: await auth.listUsers(
            { limit: ctx.query.limit, cursor: ctx.query.cursor },
            ctx.query.role
          )
        })
      )
    },
    {
      method: "POST",
      resource: "/admin/users",
      handler: withHttp(
        { auth: "required", roles: ["admin"], body: adminCreateUserSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await auth.createUserByAdmin(ctx.user, ctx.body, ctx.logger)
        })
      )
    },
    {
      method: "POST",
      resource: "/admin/users/{id}/status",
      handler: withHttp(
        { auth: "required", roles: ["admin"], params: idParam, body: adminUserStatusSchema },
        config,
        async (ctx) => ({
          data: await auth.updateUserStatus(ctx.user, ctx.params.id, ctx.body.status, ctx.logger)
        })
      )
    }
  ];
}
var handler = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildAuthRoutes(container.config, container), config: container.config };
});

// backend/src/handlers/ai.ts
import { z as z4 } from "zod";

// backend/src/services/ai/copilot.ts
import { GoogleGenAI as GoogleGenAI2, ThinkingLevel as ThinkingLevel2 } from "@google/genai";
var COPILOT_DISCLAIMER = "AI advisory triage only \u2014 verify field, storage, and market decisions with local agronomy experts and official mandi/government sources.";
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured on the server.");
  }
  return new GoogleGenAI2({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function extractGrounding(response) {
  const candidate = response?.candidates?.[0];
  const meta = candidate?.groundingMetadata;
  const seen = /* @__PURE__ */ new Set();
  const groundingSources = [];
  for (const chunk of meta?.groundingChunks ?? []) {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    groundingSources.push({
      title: chunk.web?.title?.trim() || uri,
      uri
    });
  }
  const searchQueries = (meta?.webSearchQueries ?? []).filter(
    (q) => typeof q === "string" && q.trim().length > 0
  );
  return { groundingSources, searchQueries };
}
async function runLiveIntelligenceBrief(region = "Nashik, Maharashtra") {
  const ai = getClient();
  const modelUsed = "gemini-4-hydrogen";
  const response = await ai.models.generateContent({
    model: modelUsed,
    contents: `Provide a current, practical agricultural market and weather intelligence brief for farmers in ${region}, India covering Tomato, Onion, Wheat, and Grapes mandi price ranges, weather forecast, and crop pest/disease alerts.`,
    config: {
      systemInstruction: `You are KRISHI360 AI, an agricultural market and meteorological analyst for Indian farmers.
Use Google Search grounding to retrieve fresh, real-world mandi trends, weather updates, and pest advisories.
Never include chemical or pesticide dosage quantities.
Return ONLY a valid JSON object (no markdown fences) with keys:
- "summary": string (2-3 sentences executive overview)
- "mandiUpdates": array of { "crop": string, "priceRange": string, "trend": string } (4 crops: Tomato, Onion, Wheat, Grapes)
- "weatherBrief": string (concise 1-2 sentence local weather forecast)
- "pestAlert": string (concise 1-2 sentence preventive scouting advisory, no chemical dosages)
- "sources": array of short source label strings`,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel2.LOW }
    }
  });
  const { groundingSources, searchQueries } = extractGrounding(response);
  const raw = (response.text ?? "").trim();
  let parsed = {};
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const match = cleaned.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : cleaned);
  } catch {
    parsed = {
      summary: raw || "Live grounded agricultural briefing retrieved.",
      mandiUpdates: [],
      weatherBrief: "Check local IMD district bulletin before irrigation or spraying.",
      pestAlert: "Continue routine leaf-underside scouting across active plots.",
      sources: []
    };
  }
  const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "Live grounded agricultural briefing retrieved.";
  const weatherBrief = typeof parsed.weatherBrief === "string" && parsed.weatherBrief.trim() ? parsed.weatherBrief.trim() : "Review district weather conditions before scheduling irrigation.";
  let pestAlert = typeof parsed.pestAlert === "string" && parsed.pestAlert.trim() ? parsed.pestAlert.trim() : "Inspect crop canopies and leaf undersides regularly for early stress signs.";
  if (containsDosageInstruction(pestAlert)) {
    pestAlert = "Preventive crop scouting recommended; consult a local agronomist for any treatment decisions.";
  }
  const mandiUpdates = Array.isArray(parsed.mandiUpdates) ? parsed.mandiUpdates.filter(
    (item) => Boolean(item && typeof item.crop === "string" && typeof item.priceRange === "string")
  ).slice(0, 6) : [];
  const textSources = Array.isArray(parsed.sources) ? parsed.sources.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 8) : [];
  return {
    summary,
    mandiUpdates,
    weatherBrief,
    pestAlert,
    sources: textSources.length > 0 ? textSources : groundingSources.map((g) => g.title).slice(0, 6),
    groundingSources,
    searchQueries,
    modelUsed,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function runKrishiCopilotChat(input) {
  const ai = getClient();
  const mode = input.mode === "fast" ? "fast" : "grounded";
  const modelUsed = mode === "fast" ? "gemini-3.1-flash-lite" : "gemini-4-hydrogen";
  const ctx = input.farmContext ?? {};
  const contextLines = [
    ctx.farmerName ? `Farmer: ${ctx.farmerName}` : "",
    ctx.location ? `Location: ${ctx.location}` : "",
    ctx.crops?.length ? `Active crops: ${ctx.crops.slice(0, 10).join(", ")}` : "",
    typeof ctx.plotsCount === "number" ? `Registered plots: ${ctx.plotsCount}` : "",
    typeof ctx.openCasesCount === "number" ? `Open CropDoctor cases: ${ctx.openCasesCount}` : "",
    typeof ctx.criticalStorageCount === "number" ? `Critical storage batches: ${ctx.criticalStorageCount}` : "",
    typeof ctx.activeAlertsCount === "number" ? `Active mandi alerts: ${ctx.activeAlertsCount}` : ""
  ].filter(Boolean).join("\n");
  const systemInstruction = `You are KRISHI360 AI Copilot, a unified agricultural intelligence assistant for Indian farmers across 5 platform modules:
1. CropDoctor AI (plant health triage & expert review escalation)
2. MandiSmart (mandi price comparison, transport net calculation, market trends)
3. JalSense (soil moisture tracking & irrigation scheduling)
4. GrainGuard (storage temperature/humidity threshold monitoring)
5. SchemeSaathi (government agricultural schemes & eligibility checklists)

Strict Safety & Accuracy Controls:
- NEVER present crop health advice as a confirmed clinical diagnosis; note uncertainty and recommend confirming with a qualified local agronomist.
- NEVER provide chemical, pesticide, fungicide, insecticide, or herbicide dosage instructions (no ml, grams, kg, litres, tanks, pumps per acre/hectare). Advise consulting a qualified local expert for prescriptions.
- Cite timestamps/recency or uncertainty when quoting live mandi prices, weather, or scheme terms.
- Be practical, concise, well-structured, and tailored to the farmer's active farm context below.
${contextLines ? `
Farmer Workspace Context:
${contextLines}` : ""}`;
  const historyContents = (input.history ?? []).slice(-16).filter((turn) => turn.text && turn.text.trim().length > 0).map((turn) => ({
    role: turn.sender === "assistant" ? "model" : "user",
    parts: [{ text: turn.text.trim().slice(0, 3e3) }]
  }));
  const contents = [
    ...historyContents,
    { role: "user", parts: [{ text: input.message.trim().slice(0, 3e3) }] }
  ];
  const response = await ai.models.generateContent({
    model: modelUsed,
    contents,
    config: mode === "grounded" ? {
      systemInstruction,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel2.LOW }
    } : {
      systemInstruction
    }
  });
  const { groundingSources, searchQueries } = extractGrounding(response);
  let reply = (response.text ?? "").trim();
  if (!reply) {
    reply = "I could not generate a response right now. Please rephrase your question or try again.";
  }
  let safetyFiltered = false;
  if (containsDosageInstruction(reply)) {
    safetyFiltered = true;
    reply = "For field safety, KRISHI360 AI cannot recommend pesticide or chemical dosages. Please submit a CropDoctor AI case with clear photos so a qualified local agronomist can advise on safe treatment options, and inspect drainage, airflow, and affected plant parts in the meantime.";
  }
  return {
    reply,
    modelUsed,
    mode,
    groundingSources,
    searchQueries,
    safetyFiltered,
    disclaimer: COPILOT_DISCLAIMER,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// backend/src/handlers/ai.ts
var liveIntelBodySchema = z4.object({
  region: z4.string().trim().min(2).max(120).optional()
}).optional();
var chatBodySchema = z4.object({
  message: z4.string().trim().min(1).max(3e3),
  mode: z4.enum(["grounded", "fast"]).default("grounded"),
  history: z4.array(
    z4.object({
      sender: z4.enum(["user", "assistant"]),
      text: z4.string().trim().min(1).max(3e3)
    })
  ).max(24).default([]),
  farmContext: z4.object({
    farmerName: z4.string().trim().max(120).optional(),
    location: z4.string().trim().max(160).optional(),
    crops: z4.array(z4.string().trim().max(80)).max(20).optional(),
    plotsCount: z4.number().int().min(0).max(500).optional(),
    openCasesCount: z4.number().int().min(0).max(500).optional(),
    criticalStorageCount: z4.number().int().min(0).max(500).optional(),
    activeAlertsCount: z4.number().int().min(0).max(500).optional()
  }).optional()
});
var cropAnalyzeBodySchema = z4.object({
  crop: z4.string().trim().min(1).max(80),
  plantPart: z4.string().trim().min(1).max(80),
  location: z4.string().trim().max(160).default("India"),
  symptoms: z4.string().trim().max(1500).default(""),
  imageBase64: z4.string().min(1).max(11e6).optional(),
  imageMimeType: z4.enum(["image/jpeg", "image/png", "image/webp"]).optional()
});
function buildAiRoutes(config, aiService = createAiService(config)) {
  return [
    {
      method: "POST",
      resource: "/ai/live-intelligence",
      handler: withHttp({ auth: "none", body: liveIntelBodySchema }, config, async (ctx) => {
        try {
          const region = ctx.body?.region;
          return { data: await runLiveIntelligenceBrief(region || "Nashik, Maharashtra") };
        } catch (err) {
          throw new ServiceUnavailableError(
            "AI_LIVE_INTELLIGENCE_UNAVAILABLE",
            err instanceof Error && err.message.includes("not configured") ? err.message : "Unable to fetch grounded agricultural intelligence from Gemini right now."
          );
        }
      })
    },
    {
      method: "POST",
      resource: "/ai/chat",
      handler: withHttp({ auth: "none", body: chatBodySchema }, config, async (ctx) => {
        try {
          return { data: await runKrishiCopilotChat(ctx.body) };
        } catch (err) {
          throw new ServiceUnavailableError(
            "AI_CHAT_UNAVAILABLE",
            err instanceof Error && err.message.includes("not configured") ? err.message : "KRISHI360 AI Copilot could not reach Gemini right now. Please try again."
          );
        }
      })
    },
    {
      method: "POST",
      resource: "/ai/crop-analyze",
      handler: withHttp({ auth: "none", body: cropAnalyzeBodySchema }, config, async (ctx) => {
        try {
          const { crop, plantPart, location, symptoms, imageBase64, imageMimeType } = ctx.body;
          const analysis = await aiService.analyze({
            crop,
            plantPart,
            location: location || "India",
            symptoms,
            imageData: imageBase64 && imageMimeType ? { base64: imageBase64, mimeType: imageMimeType } : void 0
          });
          return { data: { analysis }, simulated: analysis.simulated };
        } catch (err) {
          throw new ServiceUnavailableError(
            "AI_CROP_ANALYZE_FAILED",
            err instanceof Error ? err.message : "Crop AI analysis failed."
          );
        }
      })
    }
  ];
}
var handler2 = lazyRouter(() => {
  const container = getContainer();
  return {
    routes: buildAiRoutes(container.config, createAiService(container.config)),
    config: container.config
  };
});

// backend/src/services/awsDatabaseService.ts
import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  waitUntilTableExists
} from "@aws-sdk/client-dynamodb";
import { HeadBucketCommand, S3Client as S3Client4 } from "@aws-sdk/client-s3";

// backend/src/seed/sampleData.ts
var SAMPLE_SOURCE = "Sample dataset (local dev) \u2014 NOT live market data";
function sampleMandiPrices() {
  const ts = nowIso();
  const base = { unit: "INR/quintal", source: SAMPLE_SOURCE, dataType: "sample", lastUpdatedAt: ts, createdAt: ts, version: 1 };
  return [
    { ...base, id: "PRICE-sample01", crop: "Tomato", state: "Maharashtra", district: "Nashik", mandi: "Nashik APMC", minPrice: 1420, maxPrice: 2180, modalPrice: 1840, date: "2026-11-21", changePct: 4.2 },
    { ...base, id: "PRICE-sample02", crop: "Tomato", state: "Maharashtra", district: "Pune", mandi: "Pune Market Yard", minPrice: 1300, maxPrice: 2050, modalPrice: 1720, date: "2026-11-21", changePct: -1.8 },
    { ...base, id: "PRICE-sample03", crop: "Wheat", state: "Madhya Pradesh", district: "Indore", mandi: "Indore Mandi", minPrice: 2210, maxPrice: 2480, modalPrice: 2350, date: "2026-11-21", changePct: 0.6 },
    { ...base, id: "PRICE-sample04", crop: "Onion", state: "Maharashtra", district: "Nashik", mandi: "Lasalgaon APMC", minPrice: 900, maxPrice: 1650, modalPrice: 1310, date: "2026-11-22", changePct: 2.4 },
    { ...base, id: "PRICE-sample05", crop: "Grapes", state: "Maharashtra", district: "Nashik", mandi: "Nashik APMC", minPrice: 3200, maxPrice: 5400, modalPrice: 4300, date: "2026-11-22", changePct: 1.1 },
    { ...base, id: "PRICE-sample06", crop: "Wheat", state: "Punjab", district: "Ludhiana", mandi: "Khanna Mandi", minPrice: 2250, maxPrice: 2520, modalPrice: 2400, date: "2026-11-22", changePct: 0.2 }
  ];
}
function sampleSchemes() {
  const ts = nowIso();
  const base = { dataType: "sample", lastUpdatedAt: ts, createdAt: ts, version: 1 };
  return [
    {
      ...base,
      id: "SCHEME-sample01",
      name: "PM-KISAN (sample summary)",
      category: "Income support",
      state: "All India",
      summary: "Illustrative summary: income support for eligible landholder farmer families, paid in instalments. Stored criteria are simplified demo rules \u2014 verify at the official portal.",
      eligibility: ["Landholder farmer family (demo rule)", "Excludes higher-income categories (demo rule)"],
      eligibilityRules: [
        { field: "landHoldingHa", op: "gte", value: 0.01, description: "Owns at least some cultivable land (demo approximation)." },
        { field: "annualIncomeINR", op: "lte", value: 2e5, description: "Annual income within the demo threshold (not the official rule set)." }
      ],
      documents: ["Aadhaar card", "Land records", "Bank passbook"],
      sourceLabel: "Official PM-KISAN portal",
      sourceUrl: "https://pmkisan.gov.in/",
      tags: ["income", "central", "sample"]
    },
    {
      ...base,
      id: "SCHEME-sample02",
      name: "PMFBY crop insurance (sample summary)",
      category: "Insurance",
      state: "All India",
      summary: "Illustrative summary: crop insurance against notified natural calamities, pests and diseases. Demo criteria only \u2014 confirm notified crops and seasons at the official portal.",
      eligibility: ["Farmer growing a notified crop in a notified area (demo rule)"],
      eligibilityRules: [
        { field: "landHoldingHa", op: "gte", value: 0, description: "Open to farmer families incl. sharecroppers (demo approximation)." }
      ],
      documents: ["Aadhaar card", "Land records / tenancy agreement", "Bank passbook", "Sowing certificate"],
      sourceLabel: "Official PMFBY portal",
      sourceUrl: "https://pmfby.gov.in/",
      tags: ["insurance", "central", "sample"]
    },
    {
      ...base,
      id: "SCHEME-sample03",
      name: "Kisan Credit Card (sample summary)",
      category: "Credit",
      state: "All India",
      summary: "Illustrative summary: short-term credit for cultivation and allied activities. Demo criteria only \u2014 terms are set by the issuing bank.",
      eligibility: ["Farmer aged 18\u201375 (demo rule)"],
      eligibilityRules: [
        { field: "age", op: "gte", value: 18, description: "At least 18 years old (demo approximation)." },
        { field: "age", op: "lte", value: 75, description: "Up to 75 years old (demo approximation)." }
      ],
      documents: ["Aadhaar card", "PAN card", "Land records", "Passport photo"],
      sourceLabel: "Official myscheme directory",
      sourceUrl: "https://www.myscheme.gov.in/",
      tags: ["credit", "central", "sample"]
    },
    {
      ...base,
      id: "SCHEME-sample04",
      name: "Maharashtra drip irrigation subsidy (sample summary)",
      category: "Subsidy",
      state: "Maharashtra",
      summary: "Illustrative state-level summary: support for micro-irrigation adoption. Demo criteria only \u2014 verify the current scheme text with the state agriculture department.",
      eligibility: ["Farmer in Maharashtra (demo rule)", "Small or marginal landholding (demo rule)"],
      eligibilityRules: [
        { field: "state", op: "eq", value: "Maharashtra", description: "Farm located in Maharashtra (demo rule)." },
        { field: "landHoldingHa", op: "lte", value: 2, description: "Small/marginal holding up to 2 ha (demo approximation)." }
      ],
      documents: ["Aadhaar card", "7/12 land extract", "Bank passbook", "Quotation for drip system"],
      sourceLabel: "Maharashtra agriculture department",
      sourceUrl: "https://krishi.maharashtra.gov.in/",
      tags: ["subsidy", "state", "irrigation", "sample"]
    }
  ];
}

// backend/src/seed/demoPortalSeed.ts
async function seedDemoPortalData(repos, options = {}) {
  const mode = options.mode ?? "missing";
  const ts = nowIso();
  let inserted = 0;
  let skipped = 0;
  const mandiSource = "Demo market dataset \u2014 sample only";
  const mandiPrices = [
    ...sampleMandiPrices(),
    { id: "m-01", crop: "Tomato", state: "Maharashtra", district: "Nashik", mandi: "Nashik APMC", minPrice: 1420, maxPrice: 2180, modalPrice: 1840, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: 4.2, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-02", crop: "Tomato", state: "Maharashtra", district: "Pune", mandi: "Pune APMC", minPrice: 1360, maxPrice: 2020, modalPrice: 1710, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: 2.1, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-03", crop: "Tomato", state: "Karnataka", district: "Bengaluru", mandi: "Yeshwanthpur APMC", minPrice: 1510, maxPrice: 2320, modalPrice: 1960, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: -1.4, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-04", crop: "Wheat", state: "Maharashtra", district: "Nashik", mandi: "Nashik APMC", minPrice: 2280, maxPrice: 2710, modalPrice: 2510, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: 0.8, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-05", crop: "Wheat", state: "Uttar Pradesh", district: "Lucknow", mandi: "Lucknow Mandi", minPrice: 2210, maxPrice: 2640, modalPrice: 2430, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: 1.2, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-06", crop: "Wheat", state: "Madhya Pradesh", district: "Indore", mandi: "Indore APMC", minPrice: 2170, maxPrice: 2590, modalPrice: 2380, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: -0.6, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-07", crop: "Grapes", state: "Maharashtra", district: "Nashik", mandi: "Nashik APMC", minPrice: 3850, maxPrice: 5420, modalPrice: 4680, unit: "INR/quintal", date: "2026-11-20", source: mandiSource, dataType: "sample", changePct: 3.4, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-08", crop: "Grapes", state: "Karnataka", district: "Bengaluru", mandi: "Yeshwanthpur APMC", minPrice: 3690, maxPrice: 5180, modalPrice: 4420, unit: "INR/quintal", date: "2026-11-20", source: mandiSource, dataType: "sample", changePct: 1.9, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-09", crop: "Onion", state: "Maharashtra", district: "Nashik", mandi: "Lasalgaon APMC", minPrice: 1180, maxPrice: 1760, modalPrice: 1490, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: -2.8, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-10", crop: "Onion", state: "Telangana", district: "Warangal", mandi: "Warangal Market", minPrice: 1260, maxPrice: 1810, modalPrice: 1570, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: 0.5, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-11", crop: "Rice", state: "Uttar Pradesh", district: "Sultanpur", mandi: "Sultanpur Mandi", minPrice: 2950, maxPrice: 3480, modalPrice: 3210, unit: "INR/quintal", date: "2026-11-20", source: mandiSource, dataType: "sample", changePct: 0.3, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-12", crop: "Rice", state: "Kerala", district: "Palakkad", mandi: "Palakkad Market", minPrice: 3120, maxPrice: 3650, modalPrice: 3390, unit: "INR/quintal", date: "2026-11-20", source: mandiSource, dataType: "sample", changePct: 1.1, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-13", crop: "Cotton", state: "Rajasthan", district: "Barmer", mandi: "Barmer Mandi", minPrice: 5120, maxPrice: 6180, modalPrice: 5640, unit: "INR/quintal", date: "2026-11-19", source: mandiSource, dataType: "sample", changePct: -0.9, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-14", crop: "Maize", state: "Telangana", district: "Warangal", mandi: "Warangal Market", minPrice: 1980, maxPrice: 2410, modalPrice: 2190, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: 2.4, lastUpdatedAt: ts, createdAt: ts, version: 1 },
    { id: "m-15", crop: "Potato", state: "Uttar Pradesh", district: "Lucknow", mandi: "Lucknow Mandi", minPrice: 1080, maxPrice: 1560, modalPrice: 1320, unit: "INR/quintal", date: "2026-11-21", source: mandiSource, dataType: "sample", changePct: -1.7, lastUpdatedAt: ts, createdAt: ts, version: 1 }
  ];
  for (const price of mandiPrices) {
    if (mode === "missing" && await repos.mandi.get(price.id)) {
      skipped++;
      continue;
    }
    await repos.mandi.put(price);
    inserted++;
  }
  const officialSource = "https://www.india.gov.in/";
  const sourceLabel = "Official India government information portal \u2014 verify current details";
  const schemes = [
    ...sampleSchemes(),
    {
      id: "scheme-01",
      name: "Crop Insurance Awareness",
      category: "Risk protection",
      state: "All India",
      summary: "Sample entry describing a crop insurance support theme. Check the official source for current scheme availability and terms.",
      eligibility: ["Applicable farmers as defined in the current official guidelines", "Verify land and crop criteria on the official source"],
      eligibilityRules: [
        { field: "landHoldingHa", op: "gte", value: 0, description: "Cultivates land (owner or tenant) under demo criteria." }
      ],
      documents: ["Identity proof as specified", "Land records if required by the scheme", "Crop details and sowing evidence if requested"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["insurance", "risk", "kharif"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-02",
      name: "Irrigation Efficiency Support",
      category: "Irrigation",
      state: "All India",
      summary: "Demo scheme entry focused on water-use efficiency and on-farm irrigation improvements. Confirm eligibility and benefits officially.",
      eligibility: ["Farmers meeting current official criteria", "Confirm state-specific implementation through official sources"],
      eligibilityRules: [
        { field: "landHoldingHa", op: "gte", value: 0.2, description: "Minimum 0.2 ha cultivable holding (demo threshold)." },
        { field: "landHoldingHa", op: "lte", value: 5, description: "Up to 5 ha eligible area under micro-irrigation support (demo rule)." }
      ],
      documents: ["Land records if required", "Identity proof as specified", "Farm irrigation details if requested"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["irrigation", "water", "drip"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-03",
      name: "Soil Health Improvement Initiative",
      category: "Soil & nutrients",
      state: "All India",
      summary: "Sample information for a soil-health theme. Soil testing and advisory components should be confirmed on official portals.",
      eligibility: ["Eligibility as published in current official guidelines"],
      eligibilityRules: [
        { field: "landHoldingHa", op: "gte", value: 0.01, description: "Active farm plot registered for soil sampling (demo rule)." }
      ],
      documents: ["Land records if required", "Soil test report if available"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["soil", "testing", "fertility"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-04",
      name: "Farm Mechanisation Access",
      category: "Equipment",
      state: "Maharashtra",
      summary: "Demonstration entry for machinery access support. State implementation, quotas and terms must be verified officially.",
      eligibility: ["State-specific criteria as published officially"],
      eligibilityRules: [
        { field: "state", op: "eq", value: "Maharashtra", description: "Farm located in Maharashtra (demo rule)." },
        { field: "annualIncomeINR", op: "lte", value: 5e5, description: "Annual household income up to \u20B95,00,000 (demo approximation)." }
      ],
      documents: ["Identity and residence proof as specified", "Landholding proof if required"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["equipment", "machinery", "maharashtra"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-05",
      name: "Digital Mandi Enablement",
      category: "Market access",
      state: "All India",
      summary: "Sample scheme concept around digital market participation. Confirm market linkage rules and support through official sources.",
      eligibility: ["Farmers registered under applicable state systems", "Additional criteria as published officially"],
      eligibilityRules: [
        { field: "age", op: "gte", value: 18, description: "Applicant age 18 or older (demo criterion)." }
      ],
      documents: ["Farmer registration details", "Bank details if requested", "Produce details"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["mandi", "market", "digital"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-06",
      name: "Organic Farming Transition Support",
      category: "Sustainable farming",
      state: "Kerala",
      summary: "Demo entry highlighting organic transition themes. Certification, support and timelines must be verified on official sources.",
      eligibility: ["Current official eligibility conditions", "State-specific registration if applicable"],
      eligibilityRules: [
        { field: "state", op: "eq", value: "Kerala", description: "Farm located in Kerala (demo rule)." },
        { field: "landHoldingHa", op: "lte", value: 4, description: "Landholding up to 4 ha (demo approximation)." }
      ],
      documents: ["Land records if required", "Certification documents if already available"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["organic", "sustainability", "kerala"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-07",
      name: "Post-Harvest Storage Assistance",
      category: "Storage",
      state: "All India",
      summary: "Sample information for storage infrastructure support. Verify scheme availability and application process officially.",
      eligibility: ["Eligibility as defined in current official guidelines"],
      eligibilityRules: [
        { field: "landHoldingHa", op: "gte", value: 0.5, description: "Minimum 0.5 ha landholding (demo threshold)." }
      ],
      documents: ["Land and crop records if required", "Storage plan if requested"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["storage", "post-harvest", "infrastructure"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    },
    {
      id: "scheme-08",
      name: "Farmer Skill Development",
      category: "Training",
      state: "Telangana",
      summary: "Demo training-themed scheme entry. Training availability and schedules must be confirmed through official sources.",
      eligibility: ["As published in the current official notification"],
      eligibilityRules: [
        { field: "state", op: "eq", value: "Telangana", description: "Resident farmer in Telangana (demo rule)." },
        { field: "age", op: "gte", value: 18, description: "Age 18 years or above (demo rule)." }
      ],
      documents: ["Identity proof as specified", "Farmer registration details if available"],
      sourceLabel,
      sourceUrl: officialSource,
      tags: ["training", "skills", "telangana"],
      dataType: "sample",
      lastUpdatedAt: ts,
      createdAt: ts,
      version: 1
    }
  ];
  for (const scheme of schemes) {
    if (mode === "missing" && await repos.schemes.get(scheme.id)) {
      skipped++;
      continue;
    }
    await repos.schemes.put(scheme);
    inserted++;
  }
  const cropCases = [
    {
      id: "CASE-2401",
      farmerId: "farmer-001",
      farmerName: "Ramesh Patil",
      crop: "Tomato",
      plantPart: "Leaf",
      location: "Nashik, Maharashtra",
      symptoms: "Dark circular spots with yellow halo on older leaves.",
      imageUrl: "/sample-leaf.svg",
      status: "expert_review",
      priority: "high",
      reviewStatus: "in_review",
      assignedExpertId: "expert-001",
      aiAnalysis: {
        provider: "heuristic",
        condition: "Possible early blight",
        confidence: 78,
        uncertainty: "High uncertainty: rule-based demo comparison.",
        alternatives: [
          { name: "Leaf spot complex", confidence: 46 },
          { name: "Nutrient stress", confidence: 21 }
        ],
        observedSymptoms: ["Irregular brown lesions", "Yellow haloing", "Older leaves affected first"],
        explanation: "The visual pattern is consistent with a fungal leaf spot group. This is a demo comparison against sample reference patterns, not a confirmed field diagnosis.",
        nextSteps: [
          "Isolate a few affected leaves and photograph them in daylight.",
          "Avoid overhead irrigation until a human expert reviews the case.",
          "Check recent weather and irrigation history for prolonged leaf wetness."
        ],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: "2026-11-21T08:25:00.000Z"
      },
      expertReview: {
        reviewedBy: "expert-001",
        reviewerName: "Dr. Anjali Deshmukh",
        notes: "Initial review started against submitted tomato symptoms.",
        guidance: "",
        status: "in_review",
        reviewedAt: "2026-11-21T09:10:00.000Z"
      },
      createdAt: "2026-11-21T08:24:00.000Z",
      updatedAt: "2026-11-21T09:10:00.000Z",
      version: 1
    },
    {
      id: "CASE-2402",
      farmerId: "farmer-002",
      farmerName: "Sunita Devi",
      crop: "Wheat",
      plantPart: "Leaf",
      location: "Sultanpur, Uttar Pradesh",
      symptoms: "Orange pustules scattered on upper leaf surface.",
      imageUrl: "/sample-leaf.svg",
      status: "new",
      priority: "high",
      reviewStatus: "pending",
      aiAnalysis: {
        provider: "heuristic",
        condition: "Possible rust disease",
        confidence: 71,
        uncertainty: "Moderate-high uncertainty: field inspection required.",
        alternatives: [{ name: "Leaf scorch", confidence: 33 }],
        observedSymptoms: ["Orange-brown pustules", "Upper leaf surface", "Patchy field distribution"],
        explanation: "Colour and distribution may indicate a rust-group disease. Confirmation requires field observation and expert review.",
        nextSteps: ["Record the affected area size.", "Note recent rain and humidity.", "Share a close-up of the leaf underside."],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: "2026-11-21T15:03:00.000Z"
      },
      createdAt: "2026-11-21T15:02:00.000Z",
      updatedAt: "2026-11-21T15:03:00.000Z",
      version: 1
    },
    {
      id: "CASE-2403",
      farmerId: "farmer-001",
      farmerName: "Ramesh Patil",
      crop: "Grapes",
      plantPart: "Fruit",
      location: "Nashik, Maharashtra",
      symptoms: "Small dark specks on berries near the bunch centre.",
      imageUrl: "/sample-leaf.svg",
      status: "ai_review",
      priority: "medium",
      reviewStatus: "pending",
      aiAnalysis: {
        provider: "heuristic",
        condition: "Possible berry spot",
        confidence: 64,
        uncertainty: "High uncertainty: overlapping fruit symptoms.",
        alternatives: [{ name: "Anthracnose group", confidence: 39 }],
        observedSymptoms: ["Dark specks", "Bunch interior affected", "No visible mould"],
        explanation: "Demo pattern match. Fruit symptoms can have several overlapping causes and should be reviewed by a specialist.",
        nextSteps: ["Capture a second image from a different angle.", "Check bunch ventilation.", "Record recent humidity."],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: "2026-11-20T11:41:00.000Z"
      },
      createdAt: "2026-11-20T11:40:00.000Z",
      updatedAt: "2026-11-20T11:41:00.000Z",
      version: 1
    },
    {
      id: "CASE-2404",
      farmerId: "farmer-001",
      farmerName: "Ramesh Patil",
      crop: "Onion",
      plantPart: "Leaf",
      location: "Nashik, Maharashtra",
      symptoms: "Leaf tips turning yellow and drying.",
      imageUrl: "/sample-leaf.svg",
      status: "resolved",
      priority: "low",
      reviewStatus: "completed",
      assignedExpertId: "expert-001",
      aiAnalysis: {
        provider: "heuristic",
        condition: "Possible moisture or nutrient stress",
        confidence: 58,
        uncertainty: "High uncertainty: abiotic factors likely.",
        alternatives: [{ name: "Fungal leaf blight", confidence: 42 }],
        observedSymptoms: ["Tip yellowing", "Dry leaf edges", "No distinct lesions"],
        explanation: "Generic leaf discolouration can be linked to water, nutrient or disease factors. More context improves this demo result.",
        nextSteps: ["Check soil moisture at root depth.", "Review recent fertiliser schedule.", "Photograph the whole plant."],
        recommendExpert: false,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: "2026-11-18T06:56:00.000Z"
      },
      expertReview: {
        reviewedBy: "expert-002",
        reviewerName: "Dr. Vikram Singh",
        notes: "Image suggests abiotic stress. No disease-specific treatment recommended from the photo alone.",
        guidance: "Verify irrigation uniformity and review soil test results through a local advisory centre.",
        confirmedCondition: "Abiotic moisture stress",
        status: "completed",
        reviewedAt: "2026-11-18T14:10:00.000Z"
      },
      createdAt: "2026-11-18T06:55:00.000Z",
      updatedAt: "2026-11-18T14:10:00.000Z",
      version: 1
    },
    {
      id: "CASE-2405",
      farmerId: "farmer-005",
      farmerName: "Imran Qureshi",
      crop: "Cotton",
      plantPart: "Leaf",
      location: "Barmer, Rajasthan",
      symptoms: "Curled leaves with sticky residue.",
      imageUrl: "/sample-leaf.svg",
      status: "new",
      priority: "high",
      reviewStatus: "pending",
      aiAnalysis: {
        provider: "heuristic",
        condition: "Possible sucking pest activity",
        confidence: 69,
        uncertainty: "Field scouting needed.",
        alternatives: [{ name: "Viral curl complex", confidence: 37 }],
        observedSymptoms: ["Leaf curling", "Sticky surface", "Soft growth affected"],
        explanation: "The combination of curling and residue may point to sucking pests, but field scouting is required.",
        nextSteps: ["Inspect the underside of leaves.", "Count affected plants in five locations.", "Request expert review."],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: "2026-11-22T04:19:00.000Z"
      },
      createdAt: "2026-11-22T04:18:00.000Z",
      updatedAt: "2026-11-22T04:19:00.000Z",
      version: 1
    },
    {
      id: "CASE-2406",
      farmerId: "farmer-006",
      farmerName: "Lakshmi Nair",
      crop: "Rice",
      plantPart: "Leaf",
      location: "Palakkad, Kerala",
      symptoms: "Linear brown lesions along leaf edges.",
      imageUrl: "/sample-leaf.svg",
      status: "resolved",
      priority: "medium",
      reviewStatus: "completed",
      assignedExpertId: "expert-001",
      aiAnalysis: {
        provider: "heuristic",
        condition: "Possible leaf blight group",
        confidence: 73,
        uncertainty: "Sample-based similarity only.",
        alternatives: [{ name: "Brown spot group", confidence: 44 }],
        observedSymptoms: ["Linear lesions", "Leaf margin affected", "Older leaves more visible"],
        explanation: "Sample-based pattern similarity only. Confirm with local field observations.",
        nextSteps: ["Record field wetness duration.", "Photograph lesion margins.", "Share affected area estimate."],
        recommendExpert: true,
        verified: false,
        simulated: true,
        disclaimer: HEURISTIC_DISCLAIMER,
        analyzedAt: "2026-11-16T09:31:00.000Z"
      },
      expertReview: {
        reviewedBy: "expert-003",
        reviewerName: "Dr. Ravi Menon",
        notes: "Lesion pattern observed. Recommended non-chemical monitoring first.",
        guidance: "Maintain field records and consult a local extension officer before any intervention.",
        confirmedCondition: "Possible bacterial leaf blight pattern",
        status: "completed",
        reviewedAt: "2026-11-17T12:00:00.000Z"
      },
      createdAt: "2026-11-16T09:30:00.000Z",
      updatedAt: "2026-11-17T12:00:00.000Z",
      version: 1
    }
  ];
  for (const cropCase of cropCases) {
    const exists = await repos.cases.get(cropCase.id);
    if (exists) {
      if (mode === "reset") {
        await repos.cases.update({ ...cropCase, version: exists.version + 1 }, exists.version);
        inserted++;
      } else {
        skipped++;
      }
      continue;
    }
    await repos.cases.create(cropCase);
    inserted++;
  }
  const farm = {
    id: "farm-001",
    farmerId: "farmer-001",
    name: "Patil Family Farm",
    location: "Nashik, Maharashtra",
    areaHa: 6.4,
    soilType: "Black cotton soil",
    irrigationType: "Drip + canal",
    plots: [
      { id: "plot-a", name: "Plot A \u2014 North Field", areaHa: 2.1, crop: "Tomato", growthStage: "Flowering", soilMoisture: 32, lastIrrigated: "2026-11-20", status: "healthy" },
      { id: "plot-b", name: "Plot B \u2014 East Field", areaHa: 1.8, crop: "Wheat", growthStage: "Vegetative", soilMoisture: 26, lastIrrigated: "2026-11-19", status: "watch" },
      { id: "plot-c", name: "Plot C \u2014 Orchard", areaHa: 1.5, crop: "Grapes", growthStage: "Fruit / grain formation", soilMoisture: 41, lastIrrigated: "2026-11-21", status: "healthy" },
      { id: "plot-d", name: "Plot D \u2014 Storage Field", areaHa: 1, crop: "Onion", growthStage: "Vegetative", soilMoisture: 22, lastIrrigated: "2026-11-17", status: "attention" }
    ],
    createdAt: ts,
    updatedAt: ts,
    version: 1
  };
  const existingFarm = await repos.farms.get(farm.id);
  if (!existingFarm) {
    await repos.farms.create(farm);
    inserted++;
  } else {
    skipped++;
  }
  const batches = [
    {
      batch: {
        id: "batch-01",
        ownerId: "farmer-001",
        code: "GB-2401",
        crop: "Onion",
        quantityKg: 12400,
        location: "Warehouse A \xB7 Bay 2",
        thresholds: { minTempC: 12, maxTempC: 28, maxHumidity: 70 },
        currentReading: { tempC: 26.4, humidity: 68, source: "simulated", recordedAt: "2026-11-20T09:00:00.000Z" },
        status: "normal",
        createdAt: "2026-11-12T08:00:00.000Z",
        updatedAt: "2026-11-20T09:00:00.000Z",
        version: 1
      },
      inspections: [
        { id: "insp-01", batchId: "batch-01", inspectorId: "farmer-001", inspectorName: "Ramesh Patil", notes: "Ventilation checked. No visible spoilage.", condition: "normal", createdAt: "2026-11-20T09:15:00.000Z" },
        { id: "insp-02", batchId: "batch-01", inspectorId: "farmer-001", inspectorName: "Ramesh Patil", notes: "Routine inspection completed.", condition: "normal", createdAt: "2026-11-15T10:00:00.000Z" }
      ]
    },
    {
      batch: {
        id: "batch-02",
        ownerId: "farmer-001",
        code: "GB-2402",
        crop: "Wheat",
        quantityKg: 18200,
        location: "Warehouse A \xB7 Bay 4",
        thresholds: { minTempC: 10, maxTempC: 28, maxHumidity: 68 },
        currentReading: { tempC: 30.8, humidity: 72, source: "simulated", recordedAt: "2026-11-21T07:00:00.000Z" },
        status: "critical",
        createdAt: "2026-11-08T08:00:00.000Z",
        updatedAt: "2026-11-21T07:00:00.000Z",
        version: 1
      },
      inspections: [
        { id: "insp-03", batchId: "batch-02", inspectorId: "farmer-001", inspectorName: "Ramesh Patil", notes: "Temperature above demo threshold. Ventilation recommended.", condition: "critical", createdAt: "2026-11-21T08:00:00.000Z" }
      ]
    },
    {
      batch: {
        id: "batch-03",
        ownerId: "farmer-001",
        code: "GB-2403",
        crop: "Grapes",
        quantityKg: 4600,
        location: "Cold Store \xB7 Chamber 1",
        thresholds: { minTempC: 0, maxTempC: 6, maxHumidity: 92 },
        currentReading: { tempC: 4.2, humidity: 88, source: "simulated", recordedAt: "2026-11-21T06:00:00.000Z" },
        status: "normal",
        createdAt: "2026-11-18T08:00:00.000Z",
        updatedAt: "2026-11-21T06:00:00.000Z",
        version: 1
      },
      inspections: [
        { id: "insp-04", batchId: "batch-03", inspectorId: "farmer-004", inspectorName: "Kavita Sharma", notes: "Cold chain holding within range.", condition: "normal", createdAt: "2026-11-21T09:00:00.000Z" }
      ]
    },
    {
      batch: {
        id: "batch-04",
        ownerId: "farmer-001",
        code: "GB-2404",
        crop: "Tomato",
        quantityKg: 3200,
        location: "Farm Store \xB7 Room 1",
        thresholds: { minTempC: 12, maxTempC: 26, maxHumidity: 72 },
        currentReading: { tempC: 27.9, humidity: 74, source: "simulated", recordedAt: "2026-11-20T14:00:00.000Z" },
        status: "warning",
        createdAt: "2026-11-16T08:00:00.000Z",
        updatedAt: "2026-11-20T14:00:00.000Z",
        version: 1
      },
      inspections: [
        { id: "insp-05", batchId: "batch-04", inspectorId: "farmer-001", inspectorName: "Ramesh Patil", notes: "Humidity slightly above demo threshold.", condition: "warning", createdAt: "2026-11-20T15:00:00.000Z" }
      ]
    },
    {
      batch: {
        id: "batch-05",
        ownerId: "farmer-001",
        code: "GB-2405",
        crop: "Potato",
        quantityKg: 9800,
        location: "Warehouse B \xB7 Bay 1",
        thresholds: { minTempC: 4, maxTempC: 18, maxHumidity: 75 },
        currentReading: { tempC: 14.6, humidity: 64, source: "simulated", recordedAt: "2026-11-19T12:00:00.000Z" },
        status: "normal",
        createdAt: "2026-11-05T08:00:00.000Z",
        updatedAt: "2026-11-19T12:00:00.000Z",
        version: 1
      },
      inspections: [
        { id: "insp-06", batchId: "batch-05", inspectorId: "farmer-002", inspectorName: "Sunita Devi", notes: "Dark storage conditions maintained.", condition: "normal", createdAt: "2026-11-19T13:00:00.000Z" }
      ]
    },
    {
      batch: {
        id: "batch-06",
        ownerId: "farmer-001",
        code: "GB-2406",
        crop: "Maize",
        quantityKg: 7600,
        location: "Warehouse B \xB7 Bay 3",
        thresholds: { minTempC: 8, maxTempC: 27, maxHumidity: 70 },
        currentReading: { tempC: 25.1, humidity: 79, source: "simulated", recordedAt: "2026-11-18T11:00:00.000Z" },
        status: "warning",
        createdAt: "2026-11-10T08:00:00.000Z",
        updatedAt: "2026-11-18T11:00:00.000Z",
        version: 1
      },
      inspections: [
        { id: "insp-07", batchId: "batch-06", inspectorId: "farmer-003", inspectorName: "Arjun Reddy", notes: "Humidity trend needs observation.", condition: "warning", createdAt: "2026-11-18T12:00:00.000Z" }
      ]
    }
  ];
  for (const entry of batches) {
    const existingBatch = await repos.storage.getBatch(entry.batch.id);
    if (!existingBatch) {
      await repos.storage.createBatch(entry.batch);
      for (const insp of entry.inspections) await repos.storage.addInspection(insp);
      inserted++;
    } else {
      skipped++;
    }
  }
  const existingAudits = await repos.audit.list({ limit: 5 });
  if (existingAudits.items.length === 0) {
    const auditEntries = [
      { id: "AUD-001", actorId: "farmer-001", actorRole: "farmer", action: "crop_case.created", target: "CASE-2401", details: { crop: "Tomato" }, timestamp: "2026-11-21T08:24:00.000Z" },
      { id: "AUD-002", actorId: "expert-001", actorRole: "expert", action: "crop_case.expert_reviewed", target: "CASE-2401", details: { reviewStatus: "in_review" }, timestamp: "2026-11-21T09:10:00.000Z" },
      { id: "AUD-003", actorId: "farmer-001", actorRole: "farmer", action: "storage.inspection_added", target: "batch-02", details: { condition: "critical" }, timestamp: "2026-11-21T08:00:00.000Z" },
      { id: "AUD-004", actorId: "admin-001", actorRole: "admin", action: "mandi.dataset_seeded", target: "Nashik APMC", details: { count: mandiPrices.length }, timestamp: "2026-11-21T06:00:00.000Z" }
    ];
    for (const entry of auditEntries) await repos.audit.put(entry);
    inserted += auditEntries.length;
  }
  const directoryProfiles = [
    { id: "farmer-001", name: "Ramesh Patil", email: "ramesh@krishi360.in", role: "farmer", location: "Nashik, Maharashtra", phone: "+91 98\u2022\u2022\u2022\u2022\u2022412", status: "active", joinedAt: "2026-04-12", avatar: "RP", createdAt: ts, updatedAt: ts, version: 1 },
    { id: "farmer-002", name: "Sunita Devi", email: "sunita@krishi360.in", role: "farmer", location: "Sultanpur, Uttar Pradesh", phone: "+91 94\u2022\u2022\u2022\u2022\u2022809", status: "active", joinedAt: "2026-05-03", avatar: "SD", createdAt: ts, updatedAt: ts, version: 1 },
    { id: "expert-001", name: "Dr. Anjali Deshmukh", email: "anjali@krishi360.in", role: "expert", location: "Pune, Maharashtra", phone: "+91 98\u2022\u2022\u2022\u2022\u2022118", status: "active", joinedAt: "2026-03-10", avatar: "AD", specialisation: "Plant pathology", organisation: "KRISHI360 Expert Advisory", createdAt: ts, updatedAt: ts, version: 1 },
    { id: "expert-002", name: "Dr. Vikram Singh", email: "vikram@krishi360.in", role: "expert", location: "Lucknow, Uttar Pradesh", phone: "+91 94\u2022\u2022\u2022\u2022\u2022730", status: "active", joinedAt: "2026-03-19", avatar: "VS", specialisation: "Irrigation & soil health", organisation: "KRISHI360 Expert Advisory", createdAt: ts, updatedAt: ts, version: 1 }
  ];
  for (const profile of directoryProfiles) {
    const existing = await repos.users.get(profile.id);
    if (!existing) {
      await repos.users.create(profile);
      inserted++;
    } else {
      skipped++;
    }
  }
  const existingSettings = await repos.workspace.getPlatformSettings();
  if (!existingSettings) {
    const defaultSettings = {
      id: "global",
      language: "English",
      notificationsEnabled: true,
      demoMode: true,
      compactTables: false,
      expertReviewSlaHours: 24,
      storageAlertTemp: 28,
      storageAlertHumidity: 70,
      updatedAt: ts,
      version: 1
    };
    await repos.workspace.savePlatformSettings(defaultSettings);
    inserted++;
  }
  return { inserted, skipped };
}

// backend/src/services/awsDatabaseService.ts
var SINGLE_TABLE_SCHEMA = [
  { table: "Users Login Table", entity: "UserLogin (Credentials)", pkPattern: "USER#<id>", skPattern: "LOGIN", gsi1: "EMAIL#<email>", gsi2: "ROLE#<role>" },
  { table: "Flag Data Table", entity: "UserProfile (Details)", pkPattern: "USER_PROFILE#<id>", skPattern: "META", gsi1: "PROFILE#<id>", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "UserWorkspace", pkPattern: "WORKSPACE#<userId>", skPattern: "META", gsi1: "\u2014", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "Notification", pkPattern: "NOTIF#<id>", skPattern: "META", gsi1: "NOTIF_FEED", gsi2: "<createdAt>" },
  { table: "Flag Data Table", entity: "PlatformSettings (Flags)", pkPattern: "SETTINGS#global", skPattern: "META", gsi1: "\u2014", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "CropCase", pkPattern: "CASE#<id>", skPattern: "META", gsi1: "FARMER#<farmerId>", gsi2: "EXPERTQUEUE" },
  { table: "Flag Data Table", entity: "MandiPrice", pkPattern: "PRICE#<id>", skPattern: "META", gsi1: "CROP#<crop>", gsi2: "STATE#<state>" },
  { table: "Flag Data Table", entity: "Scheme", pkPattern: "SCHEME#<id>", skPattern: "META", gsi1: "CATEGORY#<cat>", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "Farm & Plots", pkPattern: "FARM#<id>", skPattern: "META", gsi1: "FARMER#<farmerId>", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "SoilReading", pkPattern: "FARM#<farmId>", skPattern: "READING#<ts>#<id>", gsi1: "\u2014", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "StorageBatch", pkPattern: "BATCH#<id>", skPattern: "META", gsi1: "FARMER#<ownerId>", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "StorageReading / Alert", pkPattern: "BATCH#<batchId>", skPattern: "READING# | ALERT# | INSPECTION#", gsi1: "\u2014", gsi2: "\u2014" },
  { table: "Flag Data Table", entity: "AuditEntry", pkPattern: "AUDIT#<YYYY-MM-DD>", skPattern: "<ts>#<id>", gsi1: "ACTOR#<actorId>", gsi2: "\u2014" }
];
var API_ENDPOINTS = [
  { method: "GET", path: "/api/health", module: "Platform", auth: "Public", description: "Service heartbeat & active backend mode" },
  { method: "GET", path: "/api/me", module: "Auth", auth: "Authenticated", description: "Active caller identity & role claims" },
  { method: "PATCH", path: "/api/me", module: "Auth", auth: "Authenticated", description: "Persist caller profile updates to database" },
  { method: "GET", path: "/api/workspace", module: "Workspace", auth: "Authenticated", description: "Hydrate saved schemes, alerts, schedules, notifications & settings" },
  { method: "PUT", path: "/api/workspace", module: "Workspace", auth: "Authenticated", description: "Persist saved schemes, applications, mandi alerts & reminders" },
  { method: "GET", path: "/api/backend/status", module: "Database", auth: "Admin only", description: "SQLite WAL / DynamoDB table health, counts & runtime readiness" },
  { method: "GET", path: "/api/backend/records?entity=cropCases", module: "Database", auth: "Admin only", description: "Inspect live records across all 8 database entities" },
  { method: "POST", path: "/api/backend/health-check", module: "Database", auth: "Admin only", description: "Run live integrity check (SQLite PRAGMA / DynamoDB DescribeTable)" },
  { method: "GET", path: "/api/backend/export", module: "Database", auth: "Admin only", description: "Download sanitized JSON database snapshot" },
  { method: "POST", path: "/api/backend/ensure-table", module: "Database", auth: "Admin only", description: "Verify or provision DynamoDB single-table & GSIs" },
  { method: "POST", path: "/api/backend/seed", module: "Database", auth: "Admin only", description: "Seed missing or reset demo dataset in active database" },
  { method: "GET", path: "/api/crop-cases?limit=25", module: "CropDoctor AI", auth: "Authenticated", description: "Role-scoped crop diagnosis cases" },
  { method: "GET", path: "/api/mandi/prices?limit=25", module: "MandiSmart", auth: "Authenticated", description: "Query agricultural mandi market prices" },
  { method: "GET", path: "/api/farms?limit=20", module: "JalSense", auth: "Authenticated", description: "Fetch farms & plot irrigation state" },
  { method: "PUT", path: "/api/farms/{id}", module: "JalSense", auth: "Authenticated", description: "Persist farm plot edits & irrigation metadata" },
  { method: "GET", path: "/api/storage-batches?limit=25", module: "GrainGuard", auth: "Authenticated", description: "Storage batch telemetry & threshold status" },
  { method: "GET", path: "/api/storage-batches/{id}/readings", module: "GrainGuard", auth: "Authenticated", description: "Fetch persisted temperature & humidity readings" },
  { method: "GET", path: "/api/schemes?limit=25", module: "SchemeSaathi", auth: "Authenticated", description: "Government schemes & eligibility catalog" },
  { method: "POST", path: "/api/schemes", module: "SchemeSaathi", auth: "Admin only", description: "Create or update government scheme entry" },
  { method: "PUT", path: "/api/admin/settings", module: "Governance", auth: "Admin only", description: "Persist platform configuration & SLA thresholds" },
  { method: "GET", path: "/api/audit-logs?limit=25", module: "Governance", auth: "Admin only", description: "Immutable mutation & review audit trail" }
];
function sanitizeAwsFailure(err) {
  const name = err instanceof Error ? err.name : "UnknownError";
  if (name === "CredentialsProviderError" || name === "UnrecognizedClientException") {
    return "AWS credentials are missing or invalid in server environment Secrets.";
  }
  if (name === "AccessDeniedException") {
    return "Configured AWS IAM principal lacks DynamoDB DescribeTable/CreateTable permissions.";
  }
  if (name === "TimeoutError" || name === "NetworkingError") {
    return "Unable to reach AWS DynamoDB endpoint from server.";
  }
  return `DynamoDB check returned ${name}.`;
}
async function inspectS3Bucket(config) {
  const bucketName = config.uploadBucketName.trim();
  if (!bucketName) {
    return {
      configured: false,
      reachable: false,
      bucketName: "",
      status: "NOT_CONFIGURED",
      message: "UPLOAD_BUCKET_NAME is not set. Presigned S3 uploads activate once configured."
    };
  }
  if (!config.awsCredentialsConfigured) {
    return {
      configured: true,
      reachable: false,
      bucketName,
      status: "NOT_CONFIGURED",
      message: `Bucket "${bucketName}" is set, awaiting AWS IAM credentials to verify reachability.`
    };
  }
  try {
    const s3 = new S3Client4({ region: config.awsRegion });
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    return {
      configured: true,
      reachable: true,
      bucketName,
      status: "ACTIVE",
      message: `Connected to private S3 bucket "${bucketName}" in ${config.awsRegion}.`
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : "UnknownError";
    if (name === "NotFound" || name === "NoSuchBucket") {
      return {
        configured: true,
        reachable: false,
        bucketName,
        status: "NOT_FOUND",
        message: `S3 bucket "${bucketName}" was not found in ${config.awsRegion}.`
      };
    }
    return {
      configured: true,
      reachable: false,
      bucketName,
      status: "UNREACHABLE",
      message: `S3 HeadBucket failed (${name}). Verify IAM s3:ListBucket permissions and bucket region.`
    };
  }
}
async function inspectDynamoTable(config, targetTableName = config.flagTableName) {
  if (!config.awsCredentialsConfigured) {
    return {
      reachable: false,
      tableStatus: "NOT_CONFIGURED",
      billingMode: null,
      approximateItemCount: null,
      gsiNames: ["gsi1", "gsi2"],
      message: config.dataBackend === "dynamodb" ? "DATA_BACKEND=dynamodb is enabled, but AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set." : config.dataBackend === "sqlite" ? `Running on persistent local SQLite 2-table database (krishi_users + krishi_flag_items). Set AWS credentials and DATA_BACKEND=dynamodb to switch to AWS DynamoDB (${config.usersTableName} & ${config.flagTableName}).` : "Running on local in-memory store. Set DATA_BACKEND=sqlite for local persistence or AWS credentials + DATA_BACKEND=dynamodb for AWS."
    };
  }
  try {
    const client = getBaseDynamoClient(config);
    const res = await client.send(new DescribeTableCommand({ TableName: targetTableName }));
    const table = res.Table;
    const rawStatus = table?.TableStatus;
    const tableStatus = rawStatus === "ACTIVE" ? "ACTIVE" : rawStatus === "CREATING" ? "CREATING" : rawStatus === "UPDATING" ? "UPDATING" : "UNREACHABLE";
    return {
      reachable: true,
      tableStatus,
      billingMode: table?.BillingModeSummary?.BillingMode ?? "PAY_PER_REQUEST",
      approximateItemCount: table?.ItemCount ?? 0,
      gsiNames: (table?.GlobalSecondaryIndexes ?? []).map((g) => g.IndexName ?? "").filter(Boolean),
      message: `Connected to DynamoDB table "${targetTableName}" (${tableStatus}) in ${config.awsRegion}.`
    };
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      return {
        reachable: true,
        tableStatus: "NOT_FOUND",
        billingMode: null,
        approximateItemCount: null,
        gsiNames: [],
        message: `AWS credentials reachable in ${config.awsRegion}, but table "${targetTableName}" does not exist yet.`
      };
    }
    return {
      reachable: false,
      tableStatus: "UNREACHABLE",
      billingMode: null,
      approximateItemCount: null,
      gsiNames: [],
      message: sanitizeAwsFailure(err)
    };
  }
}
async function ensureSingleDynamoTable(config, targetTableName) {
  const current2 = await inspectDynamoTable(config, targetTableName);
  if (current2.tableStatus === "ACTIVE") return current2;
  const client = getBaseDynamoClient(config);
  if (current2.tableStatus === "NOT_FOUND") {
    try {
      await client.send(
        new CreateTableCommand({
          TableName: targetTableName,
          BillingMode: "PAY_PER_REQUEST",
          AttributeDefinitions: [
            { AttributeName: "pk", AttributeType: "S" },
            { AttributeName: "sk", AttributeType: "S" },
            { AttributeName: "gsi1pk", AttributeType: "S" },
            { AttributeName: "gsi1sk", AttributeType: "S" },
            { AttributeName: "gsi2pk", AttributeType: "S" },
            { AttributeName: "gsi2sk", AttributeType: "S" }
          ],
          KeySchema: [
            { AttributeName: "pk", KeyType: "HASH" },
            { AttributeName: "sk", KeyType: "RANGE" }
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: "gsi1",
              KeySchema: [
                { AttributeName: "gsi1pk", KeyType: "HASH" },
                { AttributeName: "gsi1sk", KeyType: "RANGE" }
              ],
              Projection: { ProjectionType: "ALL" }
            },
            {
              IndexName: "gsi2",
              KeySchema: [
                { AttributeName: "gsi2pk", KeyType: "HASH" },
                { AttributeName: "gsi2sk", KeyType: "RANGE" }
              ],
              Projection: { ProjectionType: "ALL" }
            }
          ]
        })
      );
      await waitUntilTableExists(
        { client, maxWaitTime: 20, minDelay: 1, maxDelay: 3 },
        { TableName: targetTableName }
      );
    } catch (err) {
      throw new ServiceUnavailableError("DYNAMODB_PROVISION_FAILED", sanitizeAwsFailure(err));
    }
  } else if (!current2.reachable) {
    throw new ServiceUnavailableError("DYNAMODB_UNREACHABLE", current2.message);
  }
  return inspectDynamoTable(config, targetTableName);
}
async function ensureDynamoTable(config) {
  if (!config.awsCredentialsConfigured) {
    throw new ValidationError(
      "AWS credentials are not configured in server environment Secrets (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)."
    );
  }
  const [usersDynamo, flagDynamo] = await Promise.all([
    ensureSingleDynamoTable(config, config.usersTableName),
    ensureSingleDynamoTable(config, config.flagTableName)
  ]);
  return {
    ...flagDynamo,
    message: `Verified 2 DynamoDB tables: "${config.usersTableName}" (${usersDynamo.tableStatus}) & "${config.flagTableName}" (${flagDynamo.tableStatus}) in ${config.awsRegion}.`
  };
}
async function countAllEntities(repos) {
  const page = { limit: 100 };
  const [cases, mandi, schemes, storage, farms, audit, users, notifications] = await Promise.all([
    repos.cases.listAll(page).catch(() => ({ items: [] })),
    repos.mandi.query({}, page).catch(() => ({ items: [] })),
    repos.schemes.list({}, page).catch(() => ({ items: [] })),
    repos.storage.listAll(page).catch(() => ({ items: [] })),
    repos.farms.listAll(page).catch(() => ({ items: [] })),
    repos.audit.list(page).catch(() => ({ items: [] })),
    repos.users.list(page).catch(() => ({ items: [] })),
    repos.workspace.listNotifications(page).catch(() => ({ items: [] }))
  ]);
  return {
    cropCases: cases.items.length,
    mandiPrices: mandi.items.length,
    schemes: schemes.items.length,
    storageBatches: storage.items.length,
    farms: farms.items.length,
    auditLogs: audit.items.length,
    users: users.items.length,
    notifications: notifications.items.length
  };
}
async function getBackendStatus(config, container, runIntegrity = false) {
  const [usersDynamo, flagDynamo, s3, counts] = await Promise.all([
    inspectDynamoTable(config, config.usersTableName),
    inspectDynamoTable(config, config.flagTableName),
    inspectS3Bucket(config),
    countAllEntities(container.repos)
  ]);
  const sqlite = config.dataBackend === "sqlite" ? inspectSqliteDatabase(config, runIntegrity) : void 0;
  const dynamo = config.awsCredentialsConfigured ? {
    ...flagDynamo,
    reachable: usersDynamo.reachable && flagDynamo.reachable,
    tableStatus: usersDynamo.tableStatus === "ACTIVE" && flagDynamo.tableStatus === "ACTIVE" ? "ACTIVE" : usersDynamo.tableStatus === "NOT_FOUND" || flagDynamo.tableStatus === "NOT_FOUND" ? "NOT_FOUND" : flagDynamo.tableStatus,
    message: `Users Table "${config.usersTableName}": ${usersDynamo.tableStatus} | Flag Table "${config.flagTableName}": ${flagDynamo.tableStatus}`
  } : flagDynamo;
  return {
    service: "krishi360-ai-backend",
    dataBackend: config.dataBackend,
    awsRegion: config.awsRegion,
    usersTableName: config.usersTableName,
    flagTableName: config.flagTableName,
    tableName: config.flagTableName,
    uploadBucketName: config.uploadBucketName,
    customEndpointConfigured: Boolean(config.dynamoEndpoint),
    awsCredentialsConfigured: config.awsCredentialsConfigured,
    s3UploadsConfigured: Boolean(config.uploadBucketName),
    s3,
    aiProvider: config.aiProvider,
    bedrockConfigured: Boolean(
      config.bedrockModelId && (config.bedrockBearerTokenConfigured || config.awsCredentialsConfigured)
    ),
    bedrockModelId: config.bedrockModelId,
    authMode: config.authMode,
    dynamo,
    usersDynamo,
    flagDynamo,
    ...sqlite ? { sqlite } : {},
    counts,
    singleTableSchema: SINGLE_TABLE_SCHEMA,
    endpoints: API_ENDPOINTS,
    checkedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function seedActiveDatabase(config, container, actor, logger, options = {}) {
  if (config.dataBackend === "dynamodb") {
    await ensureDynamoTable(config);
  }
  const seedResult = await seedDemoPortalData(container.repos, options);
  await container.audit.record(logger, actor, "backend.database_seeded", config.tableName, {
    dataBackend: config.dataBackend,
    mode: options.mode ?? "missing",
    inserted: seedResult.inserted,
    skipped: seedResult.skipped
  });
  const status = await getBackendStatus(config, container);
  return { ...status, seedResult };
}
async function runDatabaseHealthCheck(config, container, actor, logger) {
  const status = await getBackendStatus(config, container, true);
  await container.audit.record(logger, actor, "backend.health_checked", config.tableName, {
    dataBackend: config.dataBackend,
    sqliteIntegrityOk: status.sqlite?.integrityOk,
    dynamoStatus: status.dynamo.tableStatus
  });
  return status;
}
async function exportSanitizedDatabase(config, container, actor, logger) {
  const page = { limit: 100 };
  const [cases, mandi, schemes, storage, farms, audit, users, notifications, settings] = await Promise.all([
    container.repos.cases.listAll(page),
    container.repos.mandi.query({}, page),
    container.repos.schemes.list({}, page),
    container.repos.storage.listAll(page),
    container.repos.farms.listAll(page),
    container.repos.audit.list(page),
    container.repos.users.list(page),
    container.repos.workspace.listNotifications(page),
    container.repos.workspace.getPlatformSettings()
  ]);
  await container.audit.record(logger, actor, "backend.database_exported", config.tableName, {
    dataBackend: config.dataBackend
  });
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    dataBackend: config.dataBackend,
    usersTableName: config.usersTableName,
    flagTableName: config.flagTableName,
    tableName: config.flagTableName,
    collections: {
      users: users.items.map(toPublicUser),
      cropCases: cases.items,
      mandiPrices: mandi.items,
      schemes: schemes.items,
      storageBatches: storage.items,
      farms: farms.items,
      notifications: notifications.items,
      auditLogs: audit.items,
      platformSettings: settings
    }
  };
}
async function listBackendRecords(repos, entity, limit, cursor) {
  const page = { limit, cursor };
  switch (entity) {
    case "cropCases":
      return repos.cases.listAll(page);
    case "mandiPrices":
      return repos.mandi.query({}, page);
    case "schemes":
      return repos.schemes.list({}, page);
    case "storageBatches":
      return repos.storage.listAll(page);
    case "farms":
      return repos.farms.listAll(page);
    case "auditLogs":
      return repos.audit.list(page);
    case "users": {
      const res = await repos.users.list(page);
      return { ...res, items: res.items.map(toPublicUser) };
    }
    case "notifications":
      return repos.workspace.listNotifications(page);
  }
}

// backend/src/handlers/backend.ts
function buildBackendRoutes(config, container) {
  return [
    {
      method: "GET",
      resource: "/backend/status",
      handler: withHttp({ auth: "required", roles: ["admin"] }, config, async () => ({
        data: await getBackendStatus(config, container)
      }))
    },
    {
      method: "GET",
      resource: "/backend/records",
      handler: withHttp(
        { auth: "required", roles: ["admin"], query: backendRecordsQuerySchema },
        config,
        async (ctx) => ({
          data: await listBackendRecords(
            container.repos,
            ctx.query.entity,
            ctx.query.limit,
            ctx.query.cursor
          )
        })
      )
    },
    {
      method: "POST",
      resource: "/backend/health-check",
      handler: withHttp({ auth: "required", roles: ["admin"] }, config, async (ctx) => ({
        data: await runDatabaseHealthCheck(config, container, ctx.user, ctx.logger)
      }))
    },
    {
      method: "GET",
      resource: "/backend/export",
      handler: withHttp({ auth: "required", roles: ["admin"] }, config, async (ctx) => ({
        data: await exportSanitizedDatabase(config, container, ctx.user, ctx.logger)
      }))
    },
    {
      method: "POST",
      resource: "/backend/ensure-table",
      handler: withHttp({ auth: "required", roles: ["admin"] }, config, async (ctx) => {
        const dynamo = await ensureDynamoTable(config);
        await container.audit.record(
          ctx.logger,
          ctx.user,
          "backend.dynamodb_table_verified",
          `${config.usersTableName},${config.flagTableName}`,
          {
            usersTableName: config.usersTableName,
            flagTableName: config.flagTableName,
            tableStatus: dynamo.tableStatus,
            awsRegion: config.awsRegion
          }
        );
        return { data: await getBackendStatus(config, container) };
      })
    },
    {
      method: "POST",
      resource: "/backend/seed",
      handler: withHttp(
        { auth: "required", roles: ["admin"], body: backendSeedBodySchema },
        config,
        async (ctx) => ({
          data: await seedActiveDatabase(config, container, ctx.user, ctx.logger, {
            mode: ctx.body?.mode ?? "missing"
          })
        })
      )
    }
  ];
}
var handler3 = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildBackendRoutes(container.config, container), config: container.config };
});

// backend/src/handlers/cropCases.ts
function buildCropDoctorRoutes(config, container) {
  const svc = container.cropDoctor;
  return [
    {
      method: "POST",
      resource: "/crop-cases",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], body: cropCaseCreateSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.createCase(requireRole(ctx.user, "farmer", "admin"), ctx.body, ctx.logger)
        })
      )
    },
    {
      method: "GET",
      resource: "/crop-cases",
      handler: withHttp({ auth: "required", query: cropCaseListQuery }, config, async (ctx) => ({
        data: await svc.listCases(ctx.user, { limit: ctx.query.limit, cursor: ctx.query.cursor }, ctx.query.status)
      }))
    },
    {
      method: "GET",
      resource: "/crop-cases/{id}",
      handler: withHttp({ auth: "required", params: idParam }, config, async (ctx) => ({
        data: await svc.getCase(ctx.user, ctx.params.id)
      }))
    },
    {
      method: "POST",
      resource: "/crop-cases/{id}/upload-url",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], params: idParam, body: uploadUrlSchema },
        config,
        async (ctx) => ({
          data: await svc.createUploadUrl(ctx.user, ctx.params.id, ctx.body, ctx.logger)
        })
      )
    },
    {
      method: "POST",
      resource: "/crop-cases/{id}/analysis",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], params: idParam, body: analysisSchema },
        config,
        async (ctx) => {
          const result = await svc.requestAnalysis(
            ctx.user,
            ctx.params.id,
            {
              imageKey: ctx.body.imageKey,
              imageBase64: ctx.body.imageBase64,
              imageMimeType: ctx.body.imageMimeType
            },
            ctx.logger
          );
          return { data: result, simulated: result.analysis.simulated };
        }
      )
    },
    {
      method: "POST",
      resource: "/crop-cases/{id}/expert-review",
      handler: withHttp(
        { auth: "required", roles: ["expert", "admin"], params: idParam, body: expertReviewSchema },
        config,
        async (ctx) => ({
          data: await svc.expertReview(ctx.user, ctx.params.id, ctx.body, ctx.logger)
        })
      )
    }
  ];
}
var handler4 = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildCropDoctorRoutes(container.config, container), config: container.config };
});

// backend/src/handlers/farms.ts
function buildJalSenseRoutes(config, container) {
  const svc = container.jalSense;
  return [
    {
      method: "POST",
      resource: "/farms",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], body: farmCreateSchema },
        config,
        async (ctx) => ({ status: 201, data: await svc.createFarm(ctx.user, ctx.body, ctx.logger) })
      )
    },
    {
      method: "GET",
      resource: "/farms",
      handler: withHttp({ auth: "required", query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listFarms(ctx.user, { limit: ctx.query.limit, cursor: ctx.query.cursor })
      }))
    },
    {
      method: "GET",
      resource: "/farms/{id}",
      handler: withHttp({ auth: "required", params: idParam }, config, async (ctx) => ({
        data: await svc.getFarm(ctx.user, ctx.params.id)
      }))
    },
    {
      method: "PUT",
      resource: "/farms/{id}",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], params: idParam, body: farmUpdateSchema },
        config,
        async (ctx) => ({
          data: await svc.updateFarm(ctx.user, ctx.params.id, ctx.body, ctx.logger)
        })
      )
    },
    {
      method: "POST",
      resource: "/farms/{id}/readings",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], params: idParam, body: soilReadingSchema },
        config,
        async (ctx) => {
          const reading = await svc.addReading(ctx.user, ctx.params.id, ctx.body, ctx.logger);
          return { status: 201, data: reading, simulated: reading.source === "simulated" };
        }
      )
    },
    {
      method: "GET",
      resource: "/farms/{id}/readings",
      handler: withHttp({ auth: "required", params: idParam, query: readingsQuerySchema }, config, async (ctx) => ({
        data: await svc.listReadings(ctx.user, ctx.params.id, ctx.query.plotId, {
          limit: ctx.query.limit,
          cursor: ctx.query.cursor
        })
      }))
    }
  ];
}
var handler5 = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildJalSenseRoutes(container.config, container), config: container.config };
});

// backend/src/handlers/mandi.ts
function buildMandiRoutes(config, container) {
  const svc = container.mandi;
  return [
    {
      method: "GET",
      resource: "/mandi/prices",
      handler: withHttp({ auth: "required", query: mandiQuerySchema }, config, async (ctx) => {
        const { limit, cursor, ...filters } = ctx.query;
        const result = await svc.list(filters, { limit, cursor });
        return { data: result.page, simulated: result.simulated };
      })
    },
    {
      method: "GET",
      resource: "/mandi/prices/{id}",
      handler: withHttp({ auth: "required", params: idParam }, config, async (ctx) => {
        const result = await svc.get(ctx.params.id);
        return { data: result.price, simulated: result.simulated };
      })
    },
    {
      method: "POST",
      resource: "/mandi/prices",
      handler: withHttp(
        { auth: "required", roles: ["admin"], body: mandiCreateSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.create(ctx.user, ctx.body, ctx.logger),
          simulated: ctx.body.dataType === "sample"
        })
      )
    }
  ];
}
var handler6 = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildMandiRoutes(container.config, container), config: container.config };
});

// backend/src/handlers/schemes.ts
function buildSchemeRoutes(config, container) {
  const svc = container.schemes;
  return [
    {
      method: "GET",
      resource: "/schemes",
      handler: withHttp({ auth: "required", query: schemeQuerySchema }, config, async (ctx) => {
        const { limit, cursor, ...filters } = ctx.query;
        const result = await svc.list(filters, { limit, cursor });
        return { data: result.page, simulated: result.simulated };
      })
    },
    {
      method: "POST",
      resource: "/schemes",
      handler: withHttp(
        { auth: "required", roles: ["admin"], body: schemeCreateSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.upsert(ctx.user, ctx.body, ctx.logger),
          simulated: ctx.body.dataType === "sample"
        })
      )
    },
    {
      // Declared before /schemes/{id} so the literal path wins in the router.
      method: "POST",
      resource: "/schemes/eligibility-check",
      handler: withHttp({ auth: "required", body: eligibilityCheckSchema }, config, async (ctx) => ({
        data: await svc.checkEligibility(ctx.body.schemeId, ctx.body.profile)
      }))
    },
    {
      method: "GET",
      resource: "/schemes/{id}",
      handler: withHttp({ auth: "required", params: idParam }, config, async (ctx) => {
        const result = await svc.get(ctx.params.id);
        return { data: result.scheme, simulated: result.simulated };
      })
    }
  ];
}
function buildAuditRoutes(config, container) {
  return [
    {
      method: "GET",
      resource: "/audit-logs",
      handler: withHttp({ auth: "required", roles: ["admin"], query: auditQuerySchema }, config, async (ctx) => ({
        data: await container.audit.list({ limit: ctx.query.limit, cursor: ctx.query.cursor }, ctx.query.actorId)
      }))
    }
  ];
}
var handler7 = lazyRouter(() => {
  const container = getContainer();
  return {
    routes: [...buildSchemeRoutes(container.config, container), ...buildAuditRoutes(container.config, container)],
    config: container.config
  };
});

// backend/src/handlers/storage.ts
function buildGrainGuardRoutes(config, container) {
  const svc = container.grainGuard;
  return [
    {
      method: "POST",
      resource: "/storage-batches",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], body: storageBatchCreateSchema },
        config,
        async (ctx) => ({ status: 201, data: await svc.createBatch(ctx.user, ctx.body, ctx.logger) })
      )
    },
    {
      method: "GET",
      resource: "/storage-batches",
      handler: withHttp({ auth: "required", query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listBatches(ctx.user, { limit: ctx.query.limit, cursor: ctx.query.cursor })
      }))
    },
    {
      method: "GET",
      resource: "/storage-batches/{id}",
      handler: withHttp({ auth: "required", params: idParam }, config, async (ctx) => ({
        data: await svc.getBatch(ctx.user, ctx.params.id)
      }))
    },
    {
      method: "GET",
      resource: "/storage-batches/{id}/readings",
      handler: withHttp({ auth: "required", params: idParam, query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listReadings(ctx.user, ctx.params.id, { limit: ctx.query.limit, cursor: ctx.query.cursor })
      }))
    },
    {
      method: "POST",
      resource: "/storage-batches/{id}/readings",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], params: idParam, body: storageReadingSchema },
        config,
        async (ctx) => {
          const result = await svc.addReading(ctx.user, ctx.params.id, ctx.body, ctx.logger);
          return { status: 201, data: result, simulated: ctx.body.source === "simulated" };
        }
      )
    },
    {
      method: "GET",
      resource: "/storage-batches/{id}/alerts",
      handler: withHttp({ auth: "required", params: idParam, query: paginationQuery }, config, async (ctx) => ({
        data: await svc.listAlerts(ctx.user, ctx.params.id, { limit: ctx.query.limit, cursor: ctx.query.cursor })
      }))
    },
    {
      method: "POST",
      resource: "/storage-batches/{id}/inspections",
      handler: withHttp(
        { auth: "required", roles: ["farmer", "admin"], params: idParam, body: inspectionSchema },
        config,
        async (ctx) => ({
          status: 201,
          data: await svc.addInspection(ctx.user, ctx.params.id, ctx.body, ctx.logger)
        })
      )
    }
  ];
}
var handler8 = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildGrainGuardRoutes(container.config, container), config: container.config };
});

// backend/src/handlers/workspace.ts
function buildWorkspaceRoutes(config, container) {
  const svc = container.workspace;
  return [
    {
      method: "GET",
      resource: "/workspace",
      handler: withHttp({ auth: "required" }, config, async (ctx) => ({
        data: await svc.getSnapshot(ctx.user)
      }))
    },
    {
      method: "PUT",
      resource: "/workspace",
      handler: withHttp({ auth: "required", body: workspaceSaveSchema }, config, async (ctx) => ({
        data: await svc.saveUserWorkspace(ctx.user, ctx.body)
      }))
    },
    {
      method: "POST",
      resource: "/notifications",
      handler: withHttp({ auth: "required", body: notificationCreateSchema }, config, async (ctx) => ({
        status: 201,
        data: await svc.createNotification(ctx.user, ctx.body)
      }))
    },
    {
      method: "POST",
      resource: "/notifications/read",
      handler: withHttp({ auth: "required", body: notificationReadSchema }, config, async (ctx) => {
        await svc.markNotificationsRead(ctx.user, ctx.body);
        return { data: { ok: true } };
      })
    },
    {
      method: "PUT",
      resource: "/admin/settings",
      handler: withHttp(
        { auth: "required", roles: ["admin"], body: platformSettingsSchema },
        config,
        async (ctx) => ({
          data: await svc.updatePlatformSettings(ctx.user, ctx.body, ctx.logger)
        })
      )
    }
  ];
}
var handler9 = lazyRouter(() => {
  const container = getContainer();
  return { routes: buildWorkspaceRoutes(container.config, container), config: container.config };
});

// server.ts
function compileRoutes(routes) {
  return routes.map((route) => {
    const paramNames = [];
    const pattern = route.resource.split("/").map((seg) => {
      if (seg.startsWith("{") && seg.endsWith("}")) {
        paramNames.push(seg.slice(1, -1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("/");
    return { route, regex: new RegExp(`^${pattern}$`), paramNames };
  });
}
function normalizeHeaders(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}
function normalizeQuery(raw) {
  const entries = Object.entries(raw);
  if (entries.length === 0) return null;
  const out = {};
  for (const [k, v] of entries) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && typeof v[0] === "string") out[k] = v[0];
  }
  return out;
}
async function startServer() {
  const port = Number(process.env.PORT || 3e3);
  const allowedOrigins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL);
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const defaultAuthMode = nodeEnv === "production" ? "session" : "dev";
  const config = loadConfig({
    ...process.env,
    NODE_ENV: nodeEnv,
    AUTH_MODE: process.env.AUTH_MODE ?? defaultAuthMode,
    DATA_BACKEND: process.env.DATA_BACKEND ?? "sqlite",
    AI_PROVIDER: process.env.AI_PROVIDER ?? (process.env.GEMINI_API_KEY?.trim() ? "gemini" : process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEARER_TOKEN || process.env.BEDROCK_MODEL_ID ? "bedrock" : "gemini"),
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? allowedOrigins.join(","),
    PORT: String(port)
  });
  const container = buildContainer(config);
  const aiService = createAiService(config);
  setContainer(container);
  if (config.dataBackend === "dynamodb") {
    try {
      await ensureDynamoTable(config);
      await seedDemoPortalData(container.repos, { mode: "missing" });
    } catch (err) {
      console.warn(
        "DynamoDB startup init skipped:",
        err instanceof Error ? err.message : String(err)
      );
    }
  } else {
    await seedDemoPortalData(container.repos, { mode: "missing" });
  }
  const routes = [
    ...buildAuthRoutes(config, container),
    ...buildBackendRoutes(config, container),
    ...buildCropDoctorRoutes(config, container),
    ...buildMandiRoutes(config, container),
    ...buildJalSenseRoutes(config, container),
    ...buildGrainGuardRoutes(config, container),
    ...buildSchemeRoutes(config, container),
    ...buildAuditRoutes(config, container),
    ...buildWorkspaceRoutes(config, container)
  ];
  const compiled = compileRoutes(routes);
  const router = createRouter(routes, config);
  const app = express();
  app.disable("x-powered-by");
  const httpServer = http.createServer(app);
  app.post("/api/ai/live-intelligence", express.json({ limit: "64kb" }), async (req, res) => {
    try {
      const parsed = liveIntelBodySchema.safeParse(req.body);
      const region = parsed.success ? parsed.data?.region : void 0;
      const result = await runLiveIntelligenceBrief(region || "Nashik, Maharashtra");
      res.json({
        data: result,
        groundingMetadata: {
          groundingSources: result.groundingSources,
          searchQueries: result.searchQueries
        }
      });
    } catch (err) {
      console.error("Live intelligence error:", err instanceof Error ? err.message : err);
      res.status(503).json({
        error: err instanceof Error && err.message.includes("not configured") ? err.message : "Unable to fetch grounded agricultural intelligence from Gemini right now."
      });
    }
  });
  app.post("/api/ai/chat", express.json({ limit: "512kb" }), async (req, res) => {
    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Enter a valid question for KRISHI360 AI Copilot." });
    }
    try {
      const result = await runKrishiCopilotChat(parsed.data);
      res.json({ data: result });
    } catch (err) {
      console.error("AI chat error:", err instanceof Error ? err.message : err);
      res.status(503).json({
        error: err instanceof Error && err.message.includes("not configured") ? err.message : "KRISHI360 AI Copilot could not reach Gemini right now. Please try again."
      });
    }
  });
  app.post("/api/ai/crop-analyze", express.json({ limit: "12mb" }), async (req, res) => {
    const parsed = cropAnalyzeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid crop analysis payload." });
    }
    try {
      const { crop, plantPart, location, symptoms, imageBase64, imageMimeType } = parsed.data;
      const analysis = await aiService.analyze({
        crop,
        plantPart,
        location: location || "India",
        symptoms,
        imageData: imageBase64 && imageMimeType ? { base64: imageBase64, mimeType: imageMimeType } : void 0
      });
      res.json({ data: { analysis } });
    } catch (err) {
      console.error("AI crop-analyze error:", err instanceof Error ? err.message : err);
      res.status(503).json({
        error: err instanceof Error ? err.message : "Gemini Vision crop analysis failed."
      });
    }
  });
  app.use("/api", express.text({ type: "*/*", limit: "12mb" }));
  app.use("/api", async (req, res) => {
    const apiPath = req.path === "/" ? "/" : req.path.replace(/\/+$/, "");
    let resource = apiPath;
    let pathParameters = null;
    for (const candidate of compiled) {
      if (candidate.route.method !== req.method && req.method !== "OPTIONS") continue;
      const match = candidate.regex.exec(apiPath);
      if (match) {
        resource = candidate.route.resource;
        if (candidate.paramNames.length > 0) {
          pathParameters = {};
          candidate.paramNames.forEach((name, idx) => {
            pathParameters[name] = decodeURIComponent(match[idx + 1]);
          });
        }
        break;
      }
    }
    const event = {
      httpMethod: req.method,
      path: apiPath,
      resource,
      headers: normalizeHeaders(req.headers),
      queryStringParameters: normalizeQuery(req.query),
      pathParameters,
      body: typeof req.body === "string" && req.body.length > 0 ? req.body : null,
      requestContext: { requestId: randomUUID5() }
    };
    const result = await router(event);
    res.status(result.statusCode);
    for (const [k, v] of Object.entries(result.headers ?? {})) {
      if (typeof v === "string") res.setHeader(k, v);
    }
    res.send(result.body);
  });
  if (process.env.NODE_ENV !== "production") {
    const disableHmr = process.env.DISABLE_HMR === "true" || Boolean(process.env.APP_URL);
    const vite = await createViteServer({
      root: path3.resolve(process.cwd(), "frontend"),
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: { server: httpServer },
        watch: disableHmr ? null : void 0
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path3.resolve(process.cwd(), "dist");
    const publicDir = path3.resolve(process.cwd(), "public");
    app.use(express.static(distDir));
    if (fs2.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }
    app.get("*", (_req, res) => {
      const indexFile = path3.join(distDir, "index.html");
      if (fs2.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found.");
      }
    });
  }
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`KRISHI360 server listening on http://0.0.0.0:${port} (backend: ${config.dataBackend})`);
  });
  const shutdown = () => {
    closeSqliteDbs();
    httpServer.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
