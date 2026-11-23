import { z } from 'zod';

export const idParam = z.object({ id: z.string().min(1).max(128) }).strict();

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(2048).optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date.');

export const readingSource = z.enum(['manual', 'simulated']);

const safeImageUrl = z
  .string()
  .trim()
  .max(512)
  .refine(
    (val) =>
      val.startsWith('/') ||
      val.startsWith('http://') ||
      val.startsWith('https://') ||
      val.startsWith('blob:'),
    'Unsupported image URL scheme.',
  );

export const cropCaseCreateSchema = z
  .object({
    crop: trimmed(1, 80),
    plantPart: trimmed(1, 80),
    location: trimmed(1, 160),
    symptoms: z.string().trim().max(2000).default(''),
    imageUrl: safeImageUrl.optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  })
  .strict();

export const cropCaseListQuery = paginationQuery.extend({
  status: z.enum(['new', 'ai_review', 'expert_review', 'resolved']).optional(),
});

export const uploadUrlSchema = z
  .object({
    fileName: trimmed(1, 255),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  })
  .strict();

export const analysisSchema = z
  .object({
    imageKey: z.string().min(1).max(512).optional(),
  })
  .strict();

export const expertReviewSchema = z
  .object({
    notes: trimmed(1, 4000),
    guidance: z.string().trim().max(4000).default(''),
    status: z.enum(['in_review', 'completed', 'needs_info']),
    confirmedCondition: trimmed(1, 160).optional(),
  })
  .strict();

export const mandiQuerySchema = paginationQuery.extend({
  crop: trimmed(1, 80).optional(),
  mandi: trimmed(1, 120).optional(),
  state: trimmed(1, 80).optional(),
  district: trimmed(1, 80).optional(),
  date: dateString.optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
});

export const mandiCreateSchema = z
  .object({
    crop: trimmed(1, 80),
    state: trimmed(1, 80),
    district: trimmed(1, 80),
    mandi: trimmed(1, 120),
    minPrice: z.number().nonnegative(),
    maxPrice: z.number().nonnegative(),
    modalPrice: z.number().nonnegative(),
    unit: trimmed(1, 40).default('INR/quintal'),
    date: dateString,
    source: trimmed(1, 200),
    dataType: z.enum(['sample', 'verified']),
    changePct: z.number().min(-100).max(1000).optional(),
  })
  .strict()
  .refine((v) => v.minPrice <= v.modalPrice && v.modalPrice <= v.maxPrice, {
    message: 'Prices must satisfy minPrice <= modalPrice <= maxPrice.',
    path: ['modalPrice'],
  });

const plotSchema = z
  .object({
    name: trimmed(1, 80),
    areaHa: z.number().positive().max(10000),
    crop: trimmed(1, 80),
    growthStage: trimmed(1, 80),
  })
  .strict();

export const farmCreateSchema = z
  .object({
    name: trimmed(1, 120),
    location: trimmed(1, 160),
    areaHa: z.number().positive().max(100000),
    soilType: trimmed(1, 80),
    irrigationType: trimmed(1, 80),
    plots: z.array(plotSchema).min(1).max(50),
  })
  .strict();

export const soilReadingSchema = z
  .object({
    plotId: trimmed(1, 128),
    soilMoisture: z.number().min(0).max(100),
    source: readingSource.default('manual'),
    weather: z
      .object({
        condition: trimmed(1, 80),
        temperatureC: z.number().min(-20).max(60).optional(),
        rainfallMm: z.number().min(0).max(1000).optional(),
      })
      .strict()
      .optional(),
    notes: trimmed(1, 1000).optional(),
  })
  .strict();

export const readingsQuerySchema = paginationQuery.extend({
  plotId: trimmed(1, 128).optional(),
});

export const storageBatchCreateSchema = z
  .object({
    code: trimmed(1, 40),
    crop: trimmed(1, 80),
    quantityKg: z.number().positive().max(10_000_000),
    location: trimmed(1, 160),
    thresholds: z
      .object({
        minTempC: z.number().min(-40).max(80),
        maxTempC: z.number().min(-40).max(80),
        maxHumidity: z.number().min(0).max(100),
      })
      .strict()
      .refine((t) => t.minTempC < t.maxTempC, {
        message: 'minTempC must be lower than maxTempC.',
        path: ['minTempC'],
      }),
    initialReading: z
      .object({
        tempC: z.number().min(-40).max(80),
        humidity: z.number().min(0).max(100),
        source: readingSource.default('manual'),
      })
      .strict()
      .optional(),
  })
  .strict();

export const storageReadingSchema = z
  .object({
    tempC: z.number().min(-40).max(80),
    humidity: z.number().min(0).max(100),
    source: readingSource.default('manual'),
  })
  .strict();

export const inspectionSchema = z
  .object({
    notes: trimmed(1, 2000),
    condition: z.enum(['normal', 'warning', 'critical']),
  })
  .strict();

export const schemeQuerySchema = paginationQuery.extend({
  q: trimmed(1, 120).optional(),
  category: trimmed(1, 80).optional(),
  state: trimmed(1, 80).optional(),
});

export const eligibilityCheckSchema = z
  .object({
    schemeId: trimmed(1, 128),
    profile: z
      .object({
        state: trimmed(1, 80).optional(),
        landHoldingHa: z.number().min(0).max(100000).optional(),
        annualIncomeINR: z.number().min(0).max(1_000_000_000).optional(),
        age: z.number().int().min(0).max(120).optional(),
        category: trimmed(1, 80).optional(),
        gender: trimmed(1, 40).optional(),
      })
      .strict(),
  })
  .strict();

export const auditQuerySchema = paginationQuery.extend({
  actorId: trimmed(1, 128).optional(),
});

export const backendEntityEnum = z.enum([
  'cropCases',
  'mandiPrices',
  'schemes',
  'storageBatches',
  'farms',
  'auditLogs',
]);

export const backendRecordsQuerySchema = paginationQuery.extend({
  entity: backendEntityEnum,
});

export const farmerRegisterSchema = z
  .object({
    name: trimmed(2, 120),
    email: z.string().trim().email('Enter a valid email address.').max(160),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
    location: trimmed(2, 160).default('India'),
    phone: z.string().trim().max(40).optional(),
  })
  .strict();

export const farmerLoginSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address.').max(160),
    password: z.string().min(1, 'Password is required.').max(128),
  })
  .strict();

export const staffLoginSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address.').max(160),
    password: z.string().min(1, 'Password is required.').max(128),
    role: z.enum(['expert', 'admin']),
  })
  .strict();

export const adminSetupSchema = z
  .object({
    name: trimmed(2, 120),
    email: z.string().trim().email('Enter a valid email address.').max(160),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  })
  .strict();

export const adminUsersQuerySchema = paginationQuery.extend({
  role: z.enum(['farmer', 'expert', 'admin']).optional(),
});

export const adminCreateUserSchema = z
  .object({
    name: trimmed(2, 120),
    email: z.string().trim().email('Enter a valid email address.').max(160),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
    role: z.enum(['farmer', 'expert', 'admin']),
    location: trimmed(2, 160),
    phone: trimmed(5, 40),
    specialisation: trimmed(2, 120).optional(),
    organisation: trimmed(2, 120).optional(),
  })
  .strict();

export const adminUserStatusSchema = z
  .object({
    status: z.enum(['active', 'invited', 'suspended']),
  })
  .strict();