import { prisma } from "@/lib/prisma";
import { AuditAction, AuditEntity, Prisma } from "@prisma/client";

export async function writeAudit(input: {
  actorId: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  orderId?: string | null;
  diff?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      orderId: input.orderId ?? null,
      diff: input.diff ?? undefined,
    },
  });
}
