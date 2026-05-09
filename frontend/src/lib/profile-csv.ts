import type { Profile } from "@/types";

function hasIncomeData(p: Profile): boolean {
  const raw = p.incomeValue?.trim();
  return (
    Boolean(raw) ||
    (typeof p.monthlyIncome === "number" && p.monthlyIncome > 0)
  );
}

function incomeValueCell(p: Profile): string {
  const raw = p.incomeValue?.trim();
  if (raw) {
    if (/^\d+$/.test(raw)) return parseInt(raw, 10).toLocaleString("en-IN");
    return raw;
  }
  const rupees = p.monthlyIncome;
  if (rupees !== null && rupees !== undefined && rupees > 0) {
    return rupees.toLocaleString("en-IN");
  }
  return "";
}

export function escapeCsvCell(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Shared column set for Team / Manager profile CSV exports */
export function buildProfileCsv(profiles: Profile[]): string {
  const headers = [
    "Registration Number",
    "Full Name",
    "Gender",
    "Father Name",
    "Mother Name",
    "Guardian Phone",
    "Guardian Email",
    "Status",
    "Date of Birth",
    "Height",
    "Height Unit",
    "Weight",
    "Blood Group",
    "Complexion",
    "Manglik Status",
    "Marital Status",
    "Disability Status",
    "Education",
    "Profession",
    "Income Type",
    "Income",
    "Diet",
    "Address",
    "City",
    "State",
    "Pincode",
    "Created At",
  ];

  const rows = profiles.map((p) => [
    escapeCsvCell(p.registrationNumber),
    escapeCsvCell(p.fullName),
    escapeCsvCell(p.gender),
    escapeCsvCell(p.fatherName),
    escapeCsvCell(p.motherName),
    escapeCsvCell(p.guardianPhone),
    escapeCsvCell(p.guardianEmail),
    escapeCsvCell(p.status),
    escapeCsvCell(p.dateOfBirth),
    escapeCsvCell(p.height),
    escapeCsvCell(p.heightUnit),
    escapeCsvCell(p.weight),
    escapeCsvCell(p.bloodGroup),
    escapeCsvCell(p.complexion),
    escapeCsvCell(p.manglikStatus?.replace(/_/g, " ")),
    escapeCsvCell(p.marriageStatus?.replace(/_/g, " ")),
    escapeCsvCell(p.disability ? "Yes" : "No"),
    escapeCsvCell(p.education),
    escapeCsvCell(p.profession?.replace(/_/g, " ")),
    escapeCsvCell(
      p.incomeType === "YEARLY"
        ? "Yearly"
        : hasIncomeData(p) || p.incomeType === "MONTHLY"
          ? "Monthly"
          : "",
    ),
    escapeCsvCell(incomeValueCell(p)),
    escapeCsvCell(p.diet),
    escapeCsvCell(p.address),
    escapeCsvCell(p.city),
    escapeCsvCell(p.state),
    escapeCsvCell(p.pincode),
    escapeCsvCell(new Date(p.createdAt).toLocaleDateString("en-IN")),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
