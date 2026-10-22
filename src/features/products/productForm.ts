import { z } from "zod";

import { parseGuaraniesInput } from "@/lib/money";

const MAX_PRICE = 9_999_999_999;

/** Mirrors the API's ProductCreate validation so most errors never leave the browser. */
export const productFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "El SKU es obligatorio")
    .max(64, "Máximo 64 caracteres")
    .regex(/^[A-Za-z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo"),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200, "Máximo 200 caracteres"),
  price: z
    .string()
    .trim()
    .min(1, "El precio es obligatorio")
    .transform((value, ctx) => {
      const amount = parseGuaraniesInput(value);
      if (amount === null) {
        ctx.addIssue({ code: "custom", message: "Ingresá un monto en guaraníes, sin decimales" });
        return z.NEVER;
      }
      if (amount > MAX_PRICE) {
        ctx.addIssue({ code: "custom", message: "El precio es demasiado alto" });
        return z.NEVER;
      }
      return amount;
    }),
});
export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;
