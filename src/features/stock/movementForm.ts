import { z } from "zod";

export const movementFormSchema = z
  .object({
    product_id: z.string().min(1, "Elegí un producto").transform(Number),
    reason: z.enum(["purchase", "adjustment"]),
    quantity: z
      .string()
      .trim()
      .regex(/^-?\d+$/, "Ingresá un número entero")
      .transform(Number)
      .refine((n) => n !== 0, "La cantidad no puede ser cero")
      .refine((n) => Math.abs(n) <= 100_000, "Máximo 100.000 unidades"),
    note: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
  })
  .refine((v) => v.reason !== "purchase" || v.quantity > 0, {
    path: ["quantity"],
    message: "Una compra debe sumar stock (cantidad positiva)",
  });
export type MovementFormInput = z.input<typeof movementFormSchema>;
export type MovementFormOutput = z.output<typeof movementFormSchema>;
