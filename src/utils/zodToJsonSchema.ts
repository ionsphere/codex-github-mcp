import { z } from "zod";

/**
 * Minimal Zod-to-JSON-Schema converter.
 * Handles the subset of Zod types actually used in this project.
 * This avoids a dependency on zod-to-json-schema while keeping full control.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return convertZod(schema) as Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertZod(schema: z.ZodTypeAny): unknown {
  // Unwrap optional / nullable / default
  if (schema instanceof z.ZodOptional) {
    return convertZod(schema.unwrap());
  }
  if (schema instanceof z.ZodNullable) {
    const inner = convertZod(schema.unwrap()) as Record<string, unknown>;
    return { ...inner, nullable: true };
  }
  if (schema instanceof z.ZodDefault) {
    const inner = convertZod(schema._def.innerType) as Record<string, unknown>;
    return { ...inner, default: schema._def.defaultValue() };
  }

  const description: string | undefined = schema.description;

  if (schema instanceof z.ZodString) {
    return withDesc({ type: "string" }, description);
  }
  if (schema instanceof z.ZodNumber) {
    return withDesc({ type: "number" }, description);
  }
  if (schema instanceof z.ZodBoolean) {
    return withDesc({ type: "boolean" }, description);
  }
  if (schema instanceof z.ZodNull) {
    return withDesc({ type: "null" }, description);
  }
  if (schema instanceof z.ZodLiteral) {
    return withDesc({ type: typeof schema.value, enum: [schema.value] }, description);
  }
  if (schema instanceof z.ZodEnum) {
    return withDesc({ type: "string", enum: schema.options }, description);
  }
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema.enum);
    return withDesc({ enum: values }, description);
  }
  if (schema instanceof z.ZodArray) {
    return withDesc({ type: "array", items: convertZod(schema.element) }, description);
  }
  if (schema instanceof z.ZodRecord) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return withDesc({ type: "object", additionalProperties: convertZod((schema as any)._def.valueType) }, description);
  }
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, val] of Object.entries(schema.shape as Record<string, z.ZodTypeAny>)) {
      properties[key] = convertZod(val);
      if (!(val instanceof z.ZodOptional) && !(val instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    const result: Record<string, unknown> = { type: "object", properties };
    if (required.length > 0) result.required = required;
    return withDesc(result, description);
  }
  if (schema instanceof z.ZodUnion) {
    return withDesc({ oneOf: (schema.options as z.ZodTypeAny[]).map(convertZod) }, description);
  }
  if (schema instanceof z.ZodIntersection) {
    return withDesc({ allOf: [convertZod(schema._def.left), convertZod(schema._def.right)] }, description);
  }
  if (schema instanceof z.ZodTuple) {
    return withDesc({ type: "array", items: schema.items.map(convertZod) }, description);
  }
  if (schema instanceof z.ZodAny || schema instanceof z.ZodUnknown) {
    return withDesc({}, description);
  }

  // Fallback — return permissive schema
  return { type: "object" };
}

function withDesc(schema: Record<string, unknown>, description?: string): Record<string, unknown> {
  if (description) return { ...schema, description };
  return schema;
}
