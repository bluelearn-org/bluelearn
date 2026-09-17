import { z } from "zod";

export const dateOfBirthSchema = z.iso
  .date()
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: "Date of birth cannot be in the future",
  });

export const updateDateOfBirthSchema = z.object({
  date_of_birth: dateOfBirthSchema.nullable(),
});

export function isAdult(dateOfBirth: string, today = new Date()): boolean {
  if (!z.iso.date().safeParse(dateOfBirth).success) return false;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const age = today.getUTCFullYear() - year;
  return (
    age > 18 ||
    (age === 18 &&
      (today.getUTCMonth() + 1 > month ||
        (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day)))
  );
}
