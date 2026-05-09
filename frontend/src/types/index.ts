// ═══════════════════════════════════════════════════════
// RISHTESETU — Frontend TypeScript Types
// Mirrors backend Prisma schema
// ═══════════════════════════════════════════════════════

export type Role = "USER" | "TEAM" | "MANAGER" | "ADMIN";
export type Gender = "BRIDE" | "GROOM";
export type ManglikStatus = "MANGLIK" | "NON_MANGLIK" | "ANSHIK_MANGLIK";
export type MarriageStatus = "UNMARRIED" | "DIVORCEE" | "WIDOW" | "WIDOWER";
export type Profession =
  | "PRIVATE_JOB"
  | "GOVERNMENT_JOB"
  | "JOB"
  | "BUSINESS"
  | "HOMELY"
  | "OTHER";
export type HeightUnit = "CM" | "IN" | "FT";
export type GlassesType = "YES" | "NO" | "OCCASIONALLY";
export type ProfileStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "SETTLED"
  | "INACTIVE";
export type DonationType = "REGISTRATION" | "GENERAL";

export interface User {
  id: string;
  mobile: string;
  name: string | null;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface Profile {
  id: string;
  registrationNumber: string;
  internalRegistrationNo?: string | null;
  status: ProfileStatus;
  gender: Gender;
  fullName: string;
  fatherName: string;
  dateOfBirth: string;
  birthTime: string | null;
  birthPlace: string | null;
  height: string | null;
  heightUnit: HeightUnit;
  weight: string | null;
  bloodGroup: string | null;
  complexion: string | null;
  manglikStatus: ManglikStatus;
  marriageStatus: MarriageStatus;
  childrenDetails: string | null;
  divorceDate: string | null;
  marriageDate: string | null;
  disability: boolean;
  disabilityDetails: string | null;
  education: string | null;
  profession: Profession;
  professionDetails: string | null;
  monthlyIncome: number | null;
  incomeType?: "MONTHLY" | "YEARLY" | null;
  incomeValue?: string | null;
  fatherProfession: string | null;
  fatherIncome: string | null;
  fatherIncomeType?: "MONTHLY" | "YEARLY" | null;
  religion: string | null;
  caste?: string | null;
  glasses: boolean;
  glassesType?: GlassesType | null;
  diet: string | null;
  healthStatus: string | null;
  motherName: string | null;
  guardianPhone: string;
  alternateMobile: string | null;
  guardianEmail: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  marriedBrothers: number;
  unmarriedBrothers: number;
  marriedSisters: number;
  unmarriedSisters: number;
  house: string | null;
  business: string | null;
  otherProperty: string | null;
  preferredCaste: string | null;
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredLocation: string | null;
  /** Partner work preference (वरीयता) */
  partnerPreference: string | null;
  /** Partner work preference details (वरीयता विवरण) */
  partnerPreferenceDetails?: string | null;
  /** Want to settle abroad */
  wantToSettleAbroad?: boolean;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface SearchFilters {
  gender?: Gender;
  manglikStatus?: ManglikStatus;
  marriageStatus?: MarriageStatus;
  profession?: Profession;
  ageMin?: number;
  ageMax?: number;
  /** Legacy single height (±0.5 cm); ignored by API if heightMin/heightMax sent */
  height?: number;
  heightMin?: number;
  heightMax?: number;
  heightUnit?: HeightUnit;
  caste?: string[];
  states?: string[];
  incomeMin?: number;
  incomeMax?: number;
  // height?: string;
  // heightUnit?: HeightUnit;
  disability?: boolean;
}

export interface SearchResult {
  profiles: Profile[];
  count: number;
  remaining: number;
  weeklyLimit: number;
}

export interface WeeklyLimitInfo {
  limit: number;
  viewed: number;
  remaining: number;
  weekStart: string;
  weekEnd: string;
}

export interface Donation {
  id: string;
  type: DonationType;
  amount: number;
  paymentStatus: string;
  donorName: string | null;
  createdAt: string;
  profile?: { fullName: string; registrationNumber: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DashboardStats {
  profiles: {
    total: number;
    active: number;
    settled: number;
    pending: number;
    newThisPeriod: number;
  };
  donations: {
    registration: { count: number; totalAmount: number };
    general: { count: number; totalAmount: number };
    grandTotal: number;
  };
  activeTeamMembers: number;
}

// TeamMember is a User with role=TEAM (unified table)
export interface TeamMember {
  id: string;
  name: string | null;
  mobile: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface SiteSetting {
  id: string;
  key: string;
  value: string;
  label: string | null;
}



