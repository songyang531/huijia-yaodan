import { z } from 'zod';

export const medicationSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(150),
  dosage: z.string().min(1).max(500),
  source: z.enum(['FAMILY_UPLOAD', 'DOCTOR_NOTE']),
  status: z.enum(['PENDING_AI', 'CONFLICT_DETECTED']),
  aiRemark: z.string().max(1500).optional(),
});
export const medicationListSchema = z.array(medicationSchema).max(40);
export const extractedItemSchema = z
  .object({
    name: z.string().max(150),
    dosage: z.string().max(500),
    source: z.enum(['FAMILY_UPLOAD', 'DOCTOR_NOTE']),
    status: z.enum(['PENDING_AI', 'CONFLICT_DETECTED']),
    aiRemark: z.string().max(1000),
    materialIds: z.array(z.string().max(100)).max(6),
    isUnclear: z.boolean(),
    hasMismatch: z.boolean(),
    isAbsentFromDischarge: z.boolean(),
    doctorExplicit: z.boolean(),
  })
  .strict();
export const extractionSchema = z
  .object({ medications: z.array(extractedItemSchema).max(40) })
  .strict();
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['medications'],
  properties: {
    medications: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'dosage',
          'source',
          'status',
          'aiRemark',
          'materialIds',
          'isUnclear',
          'hasMismatch',
          'isAbsentFromDischarge',
          'doctorExplicit',
        ],
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          source: { type: 'string', enum: ['FAMILY_UPLOAD', 'DOCTOR_NOTE'] },
          status: { type: 'string', enum: ['PENDING_AI', 'CONFLICT_DETECTED'] },
          aiRemark: { type: 'string' },
          materialIds: { type: 'array', items: { type: 'string' } },
          isUnclear: { type: 'boolean' },
          hasMismatch: { type: 'boolean' },
          isAbsentFromDischarge: { type: 'boolean' },
          doctorExplicit: { type: 'boolean' },
        },
      },
    },
  },
};
