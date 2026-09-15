// The clinic's own details, as supplied by Rophe Specialist Care.
//
// Mirrors client/src/lib/clinic.ts. Rendered messages are produced here now,
// so the server needs the same two values the {{clinic_name}} and
// {{clinic_phone}} fields resolve to.
export const CLINIC = {
  name: "Rophe Specialist Care",
  phone: "020 152 9933",
} as const;
