import { z } from 'zod';

export const MAX_DESCRIPTION_LENGTH = 120;

export const TERRAIN_KINDS = [
  'river',
  'mountain',
  'sea',
  'strait',
  'lake',
  'desert',
  'region',
] as const;

const idSchema = z.string().regex(/^[a-z0-9-]+$/);

const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const importanceSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const featureBase = {
  id: idSchema,
  name: z.string().min(1),
  coordinates: coordinatesSchema,
  importance: importanceSchema,
  description: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
};

const cityFeatureSchema = z.strictObject({
  kind: z.literal('city'),
  ...featureBase,
});

const terrainFeatureSchema = z.strictObject({
  kind: z.literal('terrain'),
  terrainKind: z.enum(TERRAIN_KINDS),
  ...featureBase,
});

const themeFeatureSchema = z.discriminatedUnion('kind', [
  cityFeatureSchema,
  terrainFeatureSchema,
]);

const boundsSchema = z
  .tuple([
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
    z.number().min(-180).max(180),
    z.number().min(-90).max(90),
  ])
  .refine(([west, south, east, north]) => west < east && south < north, {
    message:
      'bounds は [west, south, east, north] で west < east かつ south < north',
  });

export const themeSchema = z
  .strictObject({
    id: idSchema,
    title: z.string().min(1),
    era: z.string().min(1),
    summary: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
    bounds: boundsSchema,
    features: z.array(themeFeatureSchema).min(1),
  })
  .refine(
    (theme) =>
      new Set(theme.features.map((f) => f.id)).size === theme.features.length,
    {
      message: 'フィーチャー id が重複している',
    },
  );

export const themeIndexSchema = z.array(
  z.strictObject({
    id: idSchema,
    title: z.string().min(1),
    era: z.string().min(1),
    order: z.number().int(),
  }),
);

export type Theme = z.infer<typeof themeSchema>;
export type ThemeFeature = z.infer<typeof themeFeatureSchema>;
export type ThemeIndexEntry = z.infer<typeof themeIndexSchema>[number];
export type TerrainKind = (typeof TERRAIN_KINDS)[number];
export type Importance = z.infer<typeof importanceSchema>;
