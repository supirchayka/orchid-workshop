import { z } from "zod";

const serviceNameSchema = z
  .string()
  .trim()
  .min(1, "Название услуги обязательно")
  .max(60, "Название услуги должно быть не длиннее 60 символов");

const defaultPriceCentsSchema = z
  .number()
  .int("Цена должна быть целым числом")
  .min(0, "Цена не может быть отрицательной");

export const createServiceBodySchema = z.object({
  name: serviceNameSchema,
  defaultPriceCents: defaultPriceCentsSchema,
  isActive: z.boolean().default(true),
});

export const updateServiceBodySchema = z
  .object({
    name: serviceNameSchema.optional(),
    defaultPriceCents: defaultPriceCentsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Нет полей для обновления",
  });
