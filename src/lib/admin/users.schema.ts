import { z } from "zod";

const userNameSchema = z
  .string()
  .trim()
  .min(1, "Имя обязательно")
  .max(32, "Имя должно быть не длиннее 32 символов")
  .regex(/^\S+$/u, "Имя может содержать только видимые символы");

const passwordSchema = z.string().min(6, "Пароль должен быть не короче 6 символов");

export const createUserBodySchema = z.object({
  name: userNameSchema,
  password: passwordSchema,
  isAdmin: z.boolean().default(false),
  commissionPct: z.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
});

export const updateUserBodySchema = z
  .object({
    isAdmin: z.boolean().optional(),
    commissionPct: z.number().int().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Нет полей для обновления",
  });

export const resetPasswordBodySchema = z.object({
  password: passwordSchema,
});
