import { AsyncLocalStorage } from "node:async_hooks";

export type ActiveMembership = { userId: number; profileId: number; classroomId: number };
const memberships = new AsyncLocalStorage<ActiveMembership | undefined>();

export function withActiveMembership<T>(membership: ActiveMembership | undefined, operation: () => T): T {
  return memberships.run(membership, operation);
}

export function getActiveMembership(userId: number) {
  const membership = memberships.getStore();
  return membership?.userId === userId ? membership : undefined;
}
