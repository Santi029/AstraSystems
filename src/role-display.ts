/** Presentation only. Never use display labels as role identifiers or permission inputs. */
export function roleDisplayLabel(role: string): string {
  return role === 'PM' ? 'Technical Product Owner' : role;
}
