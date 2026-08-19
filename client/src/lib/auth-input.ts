export function normalizeClassroomCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidClassroomCode(value: string) {
  return /^[A-Z0-9-]{3,32}$/.test(normalizeClassroomCode(value));
}

export function isValidPin(value: string) {
  return /^\d{4}$/.test(value);
}
