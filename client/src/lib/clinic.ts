// Clinic contact details, as supplied by Rophe Specialist Care.
export const CLINIC = {
  name: "Rophe Specialist Care",
  addressLines: ["Baiden Ave 1st St", "Accra"],
  phone: "020 152 9933",
  /** International form, for tel: links dialled from outside Ghana. */
  phoneDial: "+233201529933",
  logo: "/images/rophe-logo.png",
} as const;

export const CLINIC_ADDRESS = CLINIC.addressLines.join(", ");
