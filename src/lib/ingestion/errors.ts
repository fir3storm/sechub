import { Prisma } from "@prisma/client";

export function formatIngestError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta ? ` ${JSON.stringify(err.meta)}` : "";
    return `${err.message} [${err.code}]${meta}`;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}
