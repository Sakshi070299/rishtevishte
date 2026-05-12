"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Upload, Loader2 } from "lucide-react";
import { City, State } from "country-state-city";
import {
  profilesApi,
  donationsApi,
  uploadApi,
  resolvePhotoUrl,
} from "@/lib/api";
import { useCaptcha } from "@/hooks/useCaptcha";
import { useAuth } from "@/lib/auth-context";
import type { Profile } from "@/types";
import { useDashboardNavProfiles } from "@/app/dashboard/dashboard-nav-profiles-context";
import ActivationBanner from "@/components/ActivationBanner";

const INDIA_STATES = State.getStatesOfCountry("IN");
const INDIA_STATE_OPTIONS = INDIA_STATES.map((s) => s.name).sort((a, b) =>
  a.localeCompare(b),
);

const PARTNER_PREFERENCE_OPTIONS = [
  "Private Job",
  "Government Job",
  "Business",
  "Homely",
  "Suitable",
];

// ─── RAZORPAY LOADER ──────────────────────────────────

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface CreateOrderResponse {
  donationId: string;
  orderId: string;
  amount: number;
  currency: string;
  key: string;
}

const REGISTRATION_FEE = 2100; // Rs 2100

// ─── ZOD SCHEMAS PER STEP ─────────────────────────────

// ─── Reusable validators ────────────────────────────
const nameRegex = /^[a-zA-Z\s.'-]+$/;
const numStr = (max: number) =>
  z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && parseInt(v) >= 0 && parseInt(v) <= max),
      `Must be a number (0–${max})`,
    );

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function registrationDateBounds() {
  const max = new Date();
  max.setHours(23, 59, 59, 999);
  const min = new Date(max);
  min.setMonth(min.getMonth() - 5);
  min.setHours(0, 0, 0, 0);
  return { min, max };
}

const step0Schema = z.object({
  guardianName: z
    .string()
    .min(2, "Min 2 characters")
    .regex(nameRegex, "Only letters, spaces, dots allowed"),
  guardianPhone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  alternateMobile: z
    .string()
    .optional()
    .refine(
      (v) => !v || !v.trim() || /^[6-9]\d{9}$/.test(v.trim()),
      "Enter a valid 10-digit Indian mobile number",
    ),
  guardianEmail: z
    .string()
    .email("Enter a valid email")
    .or(z.literal(""))
    .optional(),
  guardianAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{6}$/.test(v), "Pincode must be 6 digits"),
  fatherProfession: z.string().optional(),
  fatherIncomeType: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
  fatherIncome: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length <= 120, "Father income is too long"),
  religion: z.string().optional(),
  caste: z.string().optional(),
  internalRegistrationNo: z.string().optional(),
  registrationDate: z
    .string()
    .optional()
    .refine((v) => {
      if (!v) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const { min, max } = registrationDateBounds();
      const d = new Date(`${v}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return false;
      return d >= min && d <= max;
    }, "Registration date must be within last 5 months"),
});

const step1Schema = z.object({
  fullName: z
    .string()
    .min(2, "Min 2 characters")
    .regex(nameRegex, "Only letters, spaces, dots allowed"),
  gender: z.string().min(1, "Please select gender"),
  marriageStatus: z.string().min(1, "Please select marriage status"),
  dob: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => {
      const d = new Date(val);
      return !isNaN(d.getTime()) && d <= new Date();
    }, "Date cannot be in the future")
    .refine((val) => {
      const age =
        (Date.now() - new Date(val).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 18;
    }, "Must be at least 18 years old")
    .refine((val) => {
      const age =
        (Date.now() - new Date(val).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age <= 80;
    }, "Age cannot exceed 80 years"),
  birthTime: z.string().optional(),
  birthPlace: z.string().optional(),
  height: z
    .string()
    .min(1, "Height is required")
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "Height must be a number"),
  heightUnit: z.enum(["CM", "IN", "FT"]).optional().default("FT"),
  weight: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && parseInt(v) >= 30 && parseInt(v) <= 200),
      "Weight must be 30–200 kg",
    ),
  bloodGroup: z.string().optional(),
  complexion: z.string().optional(),
  manglik: z.string().min(1, "Please select manglik status"),
  education: z.string().trim().min(1, "Qualification is required"),
  profession: z.string().min(1, "Profession is required"),
  professionDetails: z.string().optional(),
  incomeType: z.enum(["MONTHLY", "YEARLY"]).optional().default("MONTHLY"),
  income: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), "Income must contain digits only"),
  diet: z.string().optional(),
  healthStatus: z.string().optional(),
  glasses: z.string().optional(),
  disability: z.string().optional(),
  disabilityDetails: z.string().optional(),
});

const step2Schema = z.object({
  motherName: z
    .string()
    .optional()
    .refine(
      (v) => !v || nameRegex.test(v),
      "Only letters, spaces, dots allowed",
    ),
  marriedBro: numStr(20),
  unmarriedBro: numStr(20),
  marriedSis: numStr(20),
  unmarriedSis: numStr(20),
});

const step3Schema = z.object({
  divorceDate: z.string().optional(),
  marriageDate: z.string().optional(),
  children: z.string().optional(),
});

const step4Schema = z.object({
  house: z.string().optional(),
  business: z.string().optional(),
  otherProp: z.string().optional(),
});

const step5Schema = z.object({
  prefCaste: z.string().optional(),
  prefAgeMin: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && parseInt(v) >= 18 && parseInt(v) <= 100),
      "Min age must be 18–100",
    ),
  prefAgeMax: z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && parseInt(v) >= 18 && parseInt(v) <= 100),
      "Max age must be 18–100",
    ),
  prefLoc: z.string().optional(),
  preference: z.string().trim().min(1, "Preference is required"),
  preferenceDetails: z.string().optional(),
  wantToSettleAbroad: z.string().optional(),
});

const step6Schema = z.object({});

// Combined type for all fields
const fullSchema = step0Schema
  .merge(step1Schema)
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)
  .superRefine((val, ctx) => {
    if (!val.height) return;
    const n = Number(val.height);
    if (!Number.isFinite(n)) return;
    const unit = val.heightUnit ?? "CM";
    if (unit === "CM") {
      if (n < 100 || n > 250)
        ctx.addIssue({
          code: "custom",
          path: ["height"],
          message: "Height must be 100–250 cm",
        });
    } else if (unit === "IN") {
      if (n < 39 || n > 98)
        ctx.addIssue({
          code: "custom",
          path: ["height"],
          message: "Height must be 39–98 inches",
        });
    } else {
      if (n < 3 || n > 8)
        ctx.addIssue({
          code: "custom",
          path: ["height"],
          message: "Height must be 3–8 ft",
        });
    }
  })
  .superRefine((val, ctx) => {
    const alt = val.alternateMobile?.trim();
    if (!alt || !val.guardianPhone) return;
    if (alt === val.guardianPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["alternateMobile"],
        message: "Alternate number must be different from primary phone",
      });
    }
  })
  .superRefine((val, ctx) => {
    if (val.profession?.trim() !== "Other") return;
    const d = val.professionDetails?.trim();
    if (!d) {
      ctx.addIssue({
        code: "custom",
        path: ["professionDetails"],
        message: "Profession details are required when Other is selected",
      });
    }
  })
  .superRefine((val, ctx) => {
    const prof = val.profession?.trim();
    const inc = (val.income ?? "").trim();
    if (!prof) return;

    if (prof === "Homely") {
      if (inc.length > 120) {
        ctx.addIssue({
          code: "custom",
          path: ["income"],
          message: "Income text is too long",
        });
      }
      return;
    }
    if (!inc) {
      ctx.addIssue({
        code: "custom",
        path: ["income"],
        message: "Income is required",
      });
      return;
    }
    if (inc.length > 120) {
      ctx.addIssue({
        code: "custom",
        path: ["income"],
        message: "Income text is too long",
      });
    }
  })
  .superRefine((val, ctx) => {
    const ms = val.marriageStatus;
    const isWidow = ms?.includes("Widow") && !ms?.includes("Widower");
    const isWidower = ms?.includes("Widower");
    if (!isWidow && !isWidower) return;
    if (!val.marriageDate?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["marriageDate"],
        message: "Marriage date is required for widow / widower",
      });
      return;
    }
    const d = new Date(val.marriageDate);
    if (Number.isNaN(d.getTime()) || d > new Date()) {
      ctx.addIssue({
        code: "custom",
        path: ["marriageDate"],
        message: "Enter a valid marriage date (not in the future)",
      });
    }
  });
type FormData = z.infer<typeof fullSchema>;

const STEPS = [
  "Basic Info",
  "Personal",
  "Family",
  "Property",
  "Preferences",
  "Photo & Submit",
];

const STEP_FIELDS: (keyof FormData)[][] = [
  [
    "guardianName",
    "guardianPhone",
    "alternateMobile",
    "guardianEmail",
    "guardianAddress",
    "city",
    "state",
    "pincode",
    "fatherProfession",
    "fatherIncomeType",
    "fatherIncome",
    "religion",
    "caste",
    "internalRegistrationNo",
    "registrationDate",
  ],
  [
    "gender",
    "fullName",
    "marriageStatus",
    "divorceDate",
    "marriageDate",
    "children",
    "dob",
    "birthTime",
    "birthPlace",
    "height",
    "heightUnit",
    "weight",
    "bloodGroup",
    "complexion",
    "manglik",
    "education",
    "profession",
    "professionDetails",
    "incomeType",
    "income",
    "diet",
    "healthStatus",
    "glasses",
    "disability",
    "disabilityDetails",
  ],
  ["motherName", "marriedBro", "unmarriedBro", "marriedSis", "unmarriedSis"],
  ["house", "business", "otherProp"],
  [
    "prefCaste",
    "prefAgeMin",
    "prefAgeMax",
    "prefLoc",
    "preference",
    "preferenceDetails",
    "wantToSettleAbroad",
  ],
  [],
];

// ─── DB → Form display value mappers ────────────────────

const GENDER_MAP: Record<string, string> = {
  BRIDE: "Bride (वधू)",
  GROOM: "Groom (वर)",
};
const MANGLIK_MAP: Record<string, string> = {
  MANGLIK: "Yes (हाँ)",
  NON_MANGLIK: "No (नहीं)",
  ANSHIK_MANGLIK: "Anshik (आंशिक)",
};
const MARRIAGE_MAP: Record<string, string> = {
  UNMARRIED: "Unmarried (अविवाहित)",
  DIVORCEE: "Divorcee (तलाकशुदा)",
  WIDOW: "Widow (विधवा)",
  WIDOWER: "Widower (विधुर)",
};
const PROFESSION_MAP: Record<string, string> = {
  PRIVATE_JOB: "Private Job",
  GOVERNMENT_JOB: "Government Job",
  JOB: "Private Job",
  BUSINESS: "Business",
  HOMELY: "Homely",
  OTHER: "Other",
};

function profileToFormData(p: Profile): FormData {
  return {
    guardianName: p.fatherName || "",
    guardianPhone: p.guardianPhone || "",
    alternateMobile: p.alternateMobile || "",
    guardianEmail: p.guardianEmail || "",
    guardianAddress: p.address || "",
    city: p.city || "",
    state: p.state || "",
    pincode: p.pincode || "",
    fatherProfession: p.fatherProfession || "",
    fatherIncomeType: p.fatherIncomeType || "MONTHLY",
    fatherIncome: p.fatherIncome || "",
    religion: p.religion || "",
    caste: p.caste || "",
    internalRegistrationNo: p.internalRegistrationNo || "",
    fullName: p.fullName || "",
    gender: GENDER_MAP[p.gender] || "",
    dob: p.dateOfBirth
      ? new Date(p.dateOfBirth).toISOString().split("T")[0]
      : "",
    birthTime: p.birthTime || "",
    birthPlace: p.birthPlace || "",
    height: p.height || "",
    heightUnit: p.heightUnit || "FT",
    weight: p.weight || "",
    bloodGroup: p.bloodGroup || "",
    complexion: p.complexion || "",
    manglik: MANGLIK_MAP[p.manglikStatus] || "",
    education: p.education || "",
    profession: PROFESSION_MAP[p.profession] || "",
    professionDetails: p.professionDetails || "",
    incomeType: p.incomeType || "MONTHLY",
    income: p.incomeValue || (p.monthlyIncome ? String(p.monthlyIncome) : ""),
    diet: p.diet || "",
    healthStatus: p.healthStatus || "",
    glasses:
      p.glassesType === "OCCASIONALLY"
        ? "Occasionally (कभी-कभी)"
        : p.glasses
          ? "Yes (हाँ)"
          : "No (नहीं)",
    disability: p.disability ? "Yes (हाँ)" : "No (नहीं)",
    disabilityDetails: p.disabilityDetails || "",
    motherName: p.motherName || "",
    marriedBro: String(p.marriedBrothers ?? 0),
    unmarriedBro: String(p.unmarriedBrothers ?? 0),
    marriedSis: String(p.marriedSisters ?? 0),
    unmarriedSis: String(p.unmarriedSisters ?? 0),
    marriageStatus: MARRIAGE_MAP[p.marriageStatus] || "",
    divorceDate: p.divorceDate
      ? new Date(p.divorceDate).toISOString().split("T")[0]
      : "",
    marriageDate: p.marriageDate
      ? new Date(p.marriageDate).toISOString().split("T")[0]
      : "",
    children: p.childrenDetails || "",
    house: p.house || "",
    business: p.business || "",
    otherProp: p.otherProperty || "",
    prefCaste: p.preferredCaste || "",
    prefAgeMin: p.preferredAgeMin ? String(p.preferredAgeMin) : "",
    prefAgeMax: p.preferredAgeMax ? String(p.preferredAgeMax) : "",
    prefLoc: p.preferredLocation || "",
    preference: p.partnerPreference || "",
    preferenceDetails: p.partnerPreferenceDetails || "",
    wantToSettleAbroad: p.wantToSettleAbroad ? "Yes (हाँ)" : "No (नहीं)",
  };
}

// ─── FORM FIELD COMPONENTS ───────────────────────────

function FormInput({
  label,
  hi,
  name,
  type = "text",
  ph = "",
  req = false,
  full = false,
  error,
  register,
}: {
  label: string;
  hi?: string;
  name: string;
  type?: string;
  ph?: string;
  req?: boolean;
  full?: boolean;
  error?: string;
  register: any;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-temple-brown-light mb-1">
        {label} {hi && <span className="font-hindi text-primary">{hi}</span>}{" "}
        {req && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        placeholder={ph}
        {...register(name)}
        className={`input-field ${error ? "!border-red-400" : ""}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function FormSelect({
  label,
  hi,
  name,
  options,
  req = false,
  error,
  register,
}: {
  label: string;
  hi?: string;
  name: string;
  options: string[];
  req?: boolean;
  error?: string;
  register: any;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-temple-brown-light mb-1">
        {label} {hi && <span className="font-hindi text-primary">{hi}</span>}{" "}
        {req && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(name)}
        className={`input-field ${error ? "!border-red-400" : ""}`}
      >
        <option value="">Select / चुनें</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;
  const { user } = useAuth();
  const isStaff = user?.role === "TEAM" || user?.role === "MANAGER";
  const canManageInternalRef = user?.role === "TEAM" || user?.role === "ADMIN";
  const { myProfileCount, myProfilesLoading, refreshMyProfiles } =
    useDashboardNavProfiles();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [editingProfileStatus, setEditingProfileStatus] = useState<
    string | null
  >(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [decl, setDecl] = useState(false);
  const { getToken: getCaptchaToken } = useCaptcha();

  const defaultValues = useMemo<FormData>(
    () => ({
      guardianName: "",
      guardianPhone: "",
      alternateMobile: "",
      guardianEmail: "",
      guardianAddress: "",
      city: "",
      state: "",
      pincode: "",
      fatherProfession: "",
      fatherIncomeType: "MONTHLY",
      fatherIncome: "",
      religion: "",
      caste: "",
      registrationDate: "",
      internalRegistrationNo: "",
      fullName: "",
      gender: "",
      dob: "",
      birthTime: "",
      birthPlace: "",
      height: "",
      heightUnit: "FT",
      weight: "",
      bloodGroup: "",
      complexion: "",
      manglik: "",
      education: "",
      profession: "",
      professionDetails: "",
      incomeType: "MONTHLY",
      income: "",
      diet: "",
      healthStatus: "",
      glasses: "",
      disability: "",
      disabilityDetails: "",
      motherName: "",
      marriedBro: "",
      unmarriedBro: "",
      marriedSis: "",
      unmarriedSis: "",
      marriageStatus: "",
      divorceDate: "",
      marriageDate: "",
      children: "",
      house: "",
      business: "",
      otherProp: "",
      prefCaste: "",
      prefAgeMin: "",
      prefAgeMax: "",
      prefLoc: "",
      preference: "",
      preferenceDetails: "",
      wantToSettleAbroad: "No (नहीं)",
    }),
    [],
  );

  // Keep form values stable while navigating steps
  const [persisted, setPersisted] = useState<FormData>(defaultValues);

  const {
    register,
    getValues,
    trigger,
    setValue,
    formState: { errors },
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    mode: "onTouched",
    shouldUnregister: false,
    defaultValues,
  });
  console.log(getValues(), "getValues");
  console.log(errors, "errors");
  // Fetch existing profile for edit mode
  useEffect(() => {
    if (!editId) return;

    setFetching(true);
    profilesApi
      .get(editId)
      .then((data) => {
        const profile = data as Profile;
        setEditingProfileStatus(profile.status ?? null);
        const mapped = profileToFormData(profile);
        setPersisted(mapped);
        reset(mapped);
        if (profile.photoUrl) setPhoto(profile.photoUrl);
      })
      .catch(() => {
        toast.error("Failed to load profile for editing");
        router.push("/profiles");
      })
      .finally(() => setFetching(false));
  }, [editId, reset, router]);

  useEffect(() => {
    if (isEdit || isStaff) return;
    if (myProfilesLoading) return;
    // if (myProfileCount !== null && myProfileCount >= 1) {
    //   toast.info('You already have a profile. Open My Profiles to view or edit.');
    //   router.replace('/dashboard');
    // }
  }, [isEdit, isStaff, myProfileCount, myProfilesLoading, router]);

  const gender = watch("gender");
  const marriageStatus = watch("marriageStatus");
  const profession = watch("profession");
  const incomeType = watch("incomeType");
  const fatherIncomeType = watch("fatherIncomeType");
  const selectedStateName = watch("state");
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const showRazorpaySummary =
    !isStaff && (!isEdit || editingProfileStatus === "PENDING_PAYMENT");

  const selectedStateIso = useMemo(() => {
    const match = INDIA_STATES.find((s) => s.name === selectedStateName);
    return match?.isoCode || "";
  }, [selectedStateName]);

  const cityOptions = useMemo(() => {
    if (!selectedStateIso) return [];
    return City.getCitiesOfState("IN", selectedStateIso)
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b));
  }, [selectedStateIso]);

  useEffect(() => {
    if (profession === undefined) return;
    void trigger(["income", "incomeType"]);
  }, [profession, incomeType, trigger]);

  useEffect(() => {
    void trigger(["fatherIncome", "fatherIncomeType"]);
  }, [fatherIncomeType, trigger]);

  const marriageStatusOptions = gender?.includes("Groom")
    ? ["Unmarried (अविवाहित)", "Divorcee (तलाकशुदा)", "Widower (विधुर)"]
    : gender?.includes("Bride")
      ? ["Unmarried (अविवाहित)", "Divorcee (तलाकशुदा)", "Widow (विधवा)"]
      : [
          "Unmarried (अविवाहित)",
          "Divorcee (तलाकशुदा)",
          "Widow (विधवा)",
          "Widower (विधुर)",
        ];

  useEffect(() => {
    if (!marriageStatus) return;
    if (
      gender?.includes("Groom") &&
      marriageStatus.includes("Widow") &&
      !marriageStatus.includes("Widower")
    ) {
      setValue("marriageStatus", "", { shouldValidate: true });
    } else if (
      gender?.includes("Bride") &&
      marriageStatus.includes("Widower")
    ) {
      setValue("marriageStatus", "", { shouldValidate: true });
    }
  }, [gender, marriageStatus, setValue]);

  const goToStep = async (nextStep: number) => {
    // Keep RHF state as-is.
    // Using `reset()` here can overwrite untouched/unmounted fields with `undefined`,
    // which then fails Zod "Required" validation on final submit.
    const live = getValues() as FormData;
    setPersisted((prev) => {
      // Avoid overwriting persisted values with `undefined` for fields
      // that aren't currently registered (because their step UI is unmounted).
      const merged = { ...prev };
      for (const k of Object.keys(prev) as (keyof FormData)[]) {
        const value = live[k] as FormData[typeof k];
        if (value === undefined) continue;
        if (k === "heightUnit") {
          if (value === "CM" || value === "IN" || value === "FT")
            merged.heightUnit = value;
          continue;
        }
        if (k === "incomeType") {
          if (value === "MONTHLY" || value === "YEARLY")
            merged.incomeType = value;
          continue;
        }
        if (k === "fatherIncomeType") {
          if (value === "MONTHLY" || value === "YEARLY")
            merged.fatherIncomeType = value;
          continue;
        }
        merged[k] = value;
      }
      return merged;
    });
    setStep(nextStep);
  };

  const validateAndNext = async () => {
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields);
    if (valid) {
      await goToStep(step + 1);
    } else {
      toast.error("Please fix the highlighted fields before continuing");
    }
  };

  const getMergedFormData = (): FormData => {
    const live = getValues() as FormData;
    const merged: FormData = { ...persisted };
    for (const k of Object.keys(merged) as (keyof FormData)[]) {
      const value = live[k] as FormData[typeof k];
      if (value === undefined) continue;
      if (k === "heightUnit") {
        if (value === "CM" || value === "IN" || value === "FT")
          merged.heightUnit = value;
        continue;
      }
      if (k === "incomeType") {
        if (value === "MONTHLY" || value === "YEARLY")
          merged.incomeType = value;
        continue;
      }
      if (k === "fatherIncomeType") {
        if (value === "MONTHLY" || value === "YEARLY")
          merged.fatherIncomeType = value;
        continue;
      }
      merged[k] = value;
    }
    return merged;
  };

  const handleUpdateCurrentStep = async () => {
    if (!isEdit || !editId) return;
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields);
    if (!valid) {
      toast.error(
        "Please fix the highlighted fields before updating this step",
      );
      return;
    }

    const merged = getMergedFormData();
    const payload = buildPayload(merged);
    setLoading(true);
    try {
      await profilesApi.update(editId, payload);
      setPersisted(merged);
      toast.success("Profile updated successfully!");
      router.push("/profiles");
    } catch (err: any) {
      toast.error(err.message || "Step update failed");
    } finally {
      setLoading(false);
    }
  };

  // Build the payload from form values (shared by create & update)
  const buildPayload = (form: FormData) => {
    const nullableText = (value?: string) => {
      const v = value?.trim();
      if (v) return v;
      return isEdit ? null : undefined;
    };
    const nullableInt = (value?: string) => {
      const v = value?.trim();
      if (!v) return isEdit ? null : undefined;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : isEdit ? null : undefined;
    };

    return {
      gender: form.gender === "Bride (वधू)" ? "BRIDE" : "GROOM",
      fullName: form.fullName,
      fatherName: form.guardianName,
      dateOfBirth: form.dob ? new Date(form.dob).toISOString() : undefined,
      birthTime: nullableText(form.birthTime),
      birthPlace: nullableText(form.birthPlace),
      height: nullableText(form.height),
      heightUnit: form.height ? form.heightUnit || "FT" : undefined,
      weight: nullableText(form.weight),
      bloodGroup: nullableText(form.bloodGroup),
      complexion: nullableText(form.complexion),
      manglikStatus: form.manglik?.includes("No")
        ? "NON_MANGLIK"
        : form.manglik?.includes("Anshik")
          ? "ANSHIK_MANGLIK"
          : "MANGLIK",
      education: nullableText(form.education),
      profession:
        form.profession === "Private Job"
          ? "PRIVATE_JOB"
          : form.profession === "Government Job"
            ? "GOVERNMENT_JOB"
            : form.profession === "Business"
              ? "BUSINESS"
              : form.profession === "Homely"
                ? "HOMELY"
                : "OTHER",
      professionDetails: form.professionDetails?.trim()
        ? form.professionDetails.trim()
        : null,
      incomeType: form.income?.trim() ? form.incomeType || "MONTHLY" : null,
      incomeValue: form.income?.trim() ? form.income.trim() : null,
      monthlyIncome: (() => {
        const raw = form.income?.trim();
        if (!raw) return isEdit ? null : undefined;
        if (!/^\d+$/.test(raw)) return isEdit ? null : undefined;
        return parseInt(raw, 10);
      })(),
      diet: nullableText(form.diet),
      healthStatus: nullableText(form.healthStatus),
      glasses:
        form.glasses?.includes("Yes") || form.glasses?.includes("Occasionally")
          ? true
          : false,
      glassesType: form.glasses?.includes("Occasionally")
        ? "OCCASIONALLY"
        : form.glasses?.includes("Yes")
          ? "YES"
          : form.glasses?.includes("No")
            ? "NO"
            : null,
      disability: form.disability?.includes("Yes") ? true : false,
      disabilityDetails: form.disability?.includes("Yes")
        ? nullableText(form.disabilityDetails)
        : null,
      guardianPhone: form.guardianPhone,
      alternateMobile: nullableText(form.alternateMobile),
      guardianEmail: nullableText(form.guardianEmail),
      address: nullableText(form.guardianAddress),
      city: nullableText(form.city),
      state: nullableText(form.state),
      pincode: nullableText(form.pincode),
      fatherProfession: nullableText(form.fatherProfession),
      fatherIncomeType: form.fatherIncome?.trim()
        ? form.fatherIncomeType || "MONTHLY"
        : null,
      fatherIncome: form.fatherIncome?.trim()
        ? form.fatherIncome.trim()
        : isEdit
          ? null
          : undefined,
      religion: nullableText(form.religion),
      caste: nullableText(form.caste),
      ...(canManageInternalRef
        ? { internalRegistrationNo: nullableText(form.internalRegistrationNo) }
        : {}),
      motherName: nullableText(form.motherName),
      marriedBrothers: parseInt(form.marriedBro || "0"),
      unmarriedBrothers: parseInt(form.unmarriedBro || "0"),
      marriedSisters: parseInt(form.marriedSis || "0"),
      unmarriedSisters: parseInt(form.unmarriedSis || "0"),
      marriageStatus: form.marriageStatus?.includes("Unmarried")
        ? "UNMARRIED"
        : form.marriageStatus?.includes("Divorcee")
          ? "DIVORCEE"
          : form.marriageStatus?.includes("Widower")
            ? "WIDOWER"
            : "WIDOW",
      divorceDate: form.divorceDate
        ? new Date(form.divorceDate).toISOString()
        : null,
      marriageDate: (() => {
        const ms = form.marriageStatus;
        const needsMarriageDate =
          (ms?.includes("Widow") && !ms?.includes("Widower")) ||
          ms?.includes("Widower");
        if (!needsMarriageDate) return null;
        return form.marriageDate
          ? new Date(form.marriageDate).toISOString()
          : null;
      })(),
      childrenDetails: nullableText(form.children),
      house: nullableText(form.house),
      business: nullableText(form.business),
      otherProperty: nullableText(form.otherProp),
      preferredCaste: nullableText(form.prefCaste),
      preferredAgeMin: nullableInt(form.prefAgeMin),
      preferredAgeMax: nullableInt(form.prefAgeMax),
      preferredLocation: nullableText(form.prefLoc),
      partnerPreference: nullableText(form.preference),
      partnerPreferenceDetails: nullableText(form.preferenceDetails),
      wantToSettleAbroad: form.wantToSettleAbroad?.includes("Yes")
        ? true
        : false,
      photoUrl: photo,
      ...(isStaff && !isEdit && form.registrationDate
        ? {
            createdAt: new Date(
              `${form.registrationDate}T00:00:00.000Z`,
            ).toISOString(),
          }
        : {}),
    };
  };

  // ─── RAZORPAY PAYMENT AFTER REGISTRATION ─────────
  const initiatePayment = async (profileId: string, regNumber: string) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      toast.error(
        "Failed to load payment gateway. Please pay from your Profiles page.",
      );
      router.push("/profiles");
      return;
    }

    try {
      const order = (await donationsApi.create({
        profileId,
        type: "REGISTRATION",
        amount: REGISTRATION_FEE,
      })) as CreateOrderResponse;

      const options = {
        key: order.key,
        amount: order.amount * 100,
        currency: order.currency,
        name: "TheMarriageHome.com",
        description: `Registration Fee — ${regNumber}`,
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            await donationsApi.verify({
              donationId: order.donationId,
              gatewayPaymentId: response.razorpay_payment_id,
              gatewayOrderId: response.razorpay_order_id,
              gatewaySignature: response.razorpay_signature,
            });
            toast.success("Payment successful! Your profile is now active.");
            router.push(`/success?regId=${regNumber}`);
          } catch {
            toast.error(
              "Payment verification failed. Please contact TheMarriageHome.com support.",
            );
            router.push("/profiles");
          }
        },
        prefill: {
          contact: getValues("guardianPhone") || undefined,
          email: getValues("guardianEmail") || undefined,
        },
        theme: { color: "#8B1A1A" },
        modal: {
          ondismiss: () => {
            toast.info(
              "Payment skipped. You can pay later from your Profiles page.",
            );
            router.push("/profiles");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. You can retry from your Profiles page.");
        router.push("/profiles");
      });
      rzp.open();
    } catch (err: any) {
      toast.error(
        err.message ||
          "Payment initiation failed. You can pay later from Profiles.",
      );
      router.push("/profiles");
    }
  };

  const handleSubmit = async () => {
    if (!decl && !isEdit) {
      toast.error("Please accept the declaration");
      return;
    }
    if (uploadingPhoto) {
      toast.error("Please wait for photo upload to complete");
      return;
    }

    // Build a stable form object from persisted + current live values.
    // This avoids relying on RHF values that may become `undefined`
    // for fields whose step UI is currently unmounted.

    const merged = getMergedFormData();
    const parsed = fullSchema.safeParse(merged);
    if (!parsed.success) {
      // Keep it generic for UX; the UI already highlights step-by-step validation.
      const firstMsg = parsed.error.issues[0]?.message;
      toast.error(
        firstMsg ||
          "Some required fields are missing. Please review all steps.",
      );
      return;
    }

    const payload = buildPayload(parsed.data);
    setLoading(true);
    try {
      if (isEdit) {
        await profilesApi.update(editId!, payload);
        toast.success("Profile updated successfully!");
        router.push("/profiles");
      } else {
        const captchaToken = await getCaptchaToken("register");
        const profile = (await profilesApi.create(
          payload,
          captchaToken,
        )) as any;
        await refreshMyProfiles();
        toast.success(
          `Profile created! Proceeding to payment (₹${REGISTRATION_FEE})...`,
        );
        // Initiate Razorpay payment for registration fee
        await initiatePayment(profile.id, profile.registrationNumber);
      }
    } catch (err: any) {
      toast.error(
        err.message || (isEdit ? "Update failed" : "Registration failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const e = (field: keyof FormData) =>
    errors[field]?.message as string | undefined;

  const blockedFromNewRegistration =
    !isEdit &&
    !isStaff &&
    !myProfilesLoading &&
    myProfileCount !== null &&
    myProfileCount >= 1;

  if (blockedFromNewRegistration) {
    router.push("/dashboard");
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-temple-brown-light">Loading profile...</span>
      </div>
    );
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            {isStaff && !isEdit
              ? (() => {
                  const { min, max } = registrationDateBounds();
                  return (
                    <div key="registrationDate">
                      <label className="block text-xs font-medium text-temple-brown-light mb-1">
                        Registration Date
                      </label>
                      <input
                        type="date"
                        min={toInputDate(min)}
                        max={toInputDate(max)}
                        {...register("registrationDate")}
                        className={`input-field ${e("registrationDate") ? "!border-red-400" : ""}`}
                      />
                      {e("registrationDate") && (
                        <p className="text-xs text-red-500 mt-1">
                          {e("registrationDate")}
                        </p>
                      )}
                      <p className="text-[11px] text-temple-brown-light mt-1">
                        Allowed: {toInputDate(min)} to {toInputDate(max)}
                      </p>
                    </div>
                  );
                })()
              : null}
            {canManageInternalRef && (
              <FormInput
                key="internalRegistrationNo"
                label="Offline Registration No"
                hi="आंतरिक पंजीकरण क्रमांक"
                name="internalRegistrationNo"
                ph="Internal reference (staff only)"
                register={register}
                error={e("internalRegistrationNo")}
              />
            )}
            <FormInput
              key="guardianName"
              label="Father / Guardian Name"
              hi="पिता का नाम"
              name="guardianName"
              ph="Full name"
              req
              register={register}
              error={e("guardianName")}
            />
            <FormInput
              key="fatherProfession"
              label="Father Profession"
              hi="पिता का व्यवसाय"
              name="fatherProfession"
              ph="e.g. Business / Service"
              register={register}
              error={e("fatherProfession")}
            />
            <div key="fatherIncomeBlock" className="col-span-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-temple-brown-light mb-1">
                    Father Income Type{" "}
                    <span className="font-hindi text-primary">
                      पिता की आय प्रकार
                    </span>
                  </label>
                  <select
                    {...register("fatherIncomeType")}
                    className={`input-field ${e("fatherIncomeType") ? "!border-red-400" : ""}`}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                  {e("fatherIncomeType") && (
                    <p className="text-xs text-red-500 mt-1">
                      {e("fatherIncomeType")}
                    </p>
                  )}
                </div>
                <FormInput
                  key="fatherIncome"
                  label={
                    fatherIncomeType === "YEARLY"
                      ? "Father Yearly Income"
                      : "Father Monthly Income"
                  }
                  hi={
                    fatherIncomeType === "YEARLY"
                      ? "पिता की वार्षिक आय"
                      : "पिता की मासिक आय"
                  }
                  name="fatherIncome"
                  type="text"
                  ph={
                    fatherIncomeType === "YEARLY"
                      ? "e.g. 5 Lakh / 50k"
                      : "e.g. 50k / 20000"
                  }
                  register={register}
                  error={e("fatherIncome")}
                />
              </div>
            </div>
            <FormInput
              key="guardianPhone"
              label="Phone Number"
              hi="फ़ोन"
              name="guardianPhone"
              type="tel"
              ph="10-digit mobile"
              req
              register={register}
              error={e("guardianPhone")}
            />
            <FormInput
              key="alternateMobile"
              label="Alternate Mobile"
              hi="वैकल्पिक मोबाइल"
              name="alternateMobile"
              type="tel"
              ph="10-digit mobile (optional)"
              register={register}
              error={e("alternateMobile")}
            />
            <FormInput
              key="guardianEmail"
              label="Email"
              hi="ईमेल"
              name="guardianEmail"
              type="email"
              ph="email@example.com"
              register={register}
              error={e("guardianEmail")}
            />
            <FormInput
              key="guardianAddress"
              label="Address"
              hi="पता"
              name="guardianAddress"
              ph="Full address"
              full
              register={register}
              error={e("guardianAddress")}
            />
            {(() => {
              const stateReg = register("state");
              const cityReg = register("city");
              return (
                <>
                  <div key="state">
                    <label className="block text-xs font-medium text-temple-brown-light mb-1">
                      State{" "}
                      <span className="font-hindi text-primary">राज्य</span>
                    </label>
                    <select
                      {...stateReg}
                      onChange={(ev) => {
                        stateReg.onChange(ev);
                        setValue("city", "", {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }}
                      className={`input-field ${e("state") ? "!border-red-400" : ""}`}
                    >
                      <option value="">Select / चुनें</option>
                      {INDIA_STATE_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {e("state") && (
                      <p className="text-xs text-red-500 mt-1">{e("state")}</p>
                    )}
                  </div>

                  <div key="city">
                    <label className="block text-xs font-medium text-temple-brown-light mb-1">
                      City <span className="font-hindi text-primary">शहर</span>
                    </label>
                    <select
                      {...cityReg}
                      disabled={!selectedStateIso}
                      className={`input-field ${e("city") ? "!border-red-400" : ""} ${!selectedStateIso ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <option value="">
                        {selectedStateIso
                          ? "Select / चुनें"
                          : "Select State first"}
                      </option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {e("city") && (
                      <p className="text-xs text-red-500 mt-1">{e("city")}</p>
                    )}
                  </div>
                </>
              );
            })()}
            <FormInput
              key="pincode"
              label="Pincode"
              hi="पिन कोड"
              name="pincode"
              type="number"
              ph="e.g. 110031"
              register={register}
              error={e("pincode")}
            />
            <FormInput
              key="religion"
              label="Religion"
              hi="धर्म"
              name="religion"
              ph="e.g. Hindu"
              register={register}
              error={e("religion")}
            />
            <FormInput
              key="caste"
              label="Caste"
              hi="जाति"
              name="caste"
              ph="e.g. Agarwal"
              register={register}
              error={e("caste")}
            />
          </div>
        );
      case 1:
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            <FormSelect
              key="gender"
              label="Gender"
              hi="लिंग"
              name="gender"
              req
              options={["Groom (वर)", "Bride (वधू)"]}
              register={register}
              error={e("gender")}
            />
            <FormInput
              key="fullName"
              label="Full Name"
              hi="पूरा नाम"
              name="fullName"
              req
              register={register}
              error={e("fullName")}
            />
            <FormSelect
              key="marriageStatus"
              label="Marriage Status"
              hi="वैवाहिक स्थिति"
              name="marriageStatus"
              req
              options={marriageStatusOptions}
              register={register}
              error={e("marriageStatus")}
            />
            {marriageStatus?.includes("Divorcee") && (
              <FormInput
                key="divorceDate"
                label="Divorce Date"
                hi="तलाक की तारीख"
                name="divorceDate"
                type="date"
                register={register}
                error={e("divorceDate")}
              />
            )}
            {((marriageStatus?.includes("Widow") &&
              !marriageStatus?.includes("Widower")) ||
              marriageStatus?.includes("Widower")) && (
              <FormInput
                key="marriageDate"
                label="Marriage Date"
                hi="विवाह की तारीख"
                name="marriageDate"
                type="date"
                req
                register={register}
                error={e("marriageDate")}
              />
            )}
            {(marriageStatus?.includes("Divorcee") ||
              marriageStatus?.includes("Widow") ||
              marriageStatus?.includes("Widower")) && (
              <FormInput
                key="children"
                label="Children Details"
                hi="बच्चों का विवरण"
                name="children"
                ph="e.g. 1 son, 1 daughter"
                full
                register={register}
                error={e("children")}
              />
            )}
            <FormInput
              key="dob"
              label="Date of Birth"
              hi="जन्म तिथि"
              name="dob"
              type="date"
              req
              register={register}
              error={e("dob")}
            />
            <FormInput
              key="birthTime"
              label="Birth Time"
              hi="जन्म समय"
              name="birthTime"
              type="time"
              register={register}
              error={e("birthTime")}
            />
            <FormInput
              key="birthPlace"
              label="Birth Place"
              hi="जन्म स्थान"
              name="birthPlace"
              register={register}
              error={e("birthPlace")}
            />
            <div key="height" className="">
              <label className="block text-xs font-medium text-temple-brown-light mb-1">
                Height (default FT) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder={
                    watch("heightUnit") === "IN"
                      ? "e.g. 66"
                      : watch("heightUnit") === "FT"
                        ? "e.g. 5.8"
                        : "e.g. 170"
                  }
                  {...register("height")}
                  className={`input-field pr-16 ${e("height") ? "!border-red-400" : ""}`}
                />
                <select
                  aria-label="Height unit"
                  {...register("heightUnit")}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 h-[32px] rounded-lg border border-[#E8D5C4] bg-white px-2 text-xs font-semibold text-temple-brown focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    e("heightUnit") ? "!border-red-400" : ""
                  }`}
                >
                  <option value="CM">CM</option>
                  <option value="IN">IN</option>
                  <option value="FT">FT</option>
                </select>
              </div>
              {(e("height") || e("heightUnit")) && (
                <p className="text-xs text-red-500 mt-1">
                  {e("height") || e("heightUnit")}
                </p>
              )}
            </div>
            <FormInput
              key="weight"
              label="Weight (kg)"
              name="weight"
              type="number"
              ph="e.g. 65"
              register={register}
              error={e("weight")}
            />
            <FormSelect
              key="bloodGroup"
              label="Blood Group"
              name="bloodGroup"
              options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
              register={register}
              error={e("bloodGroup")}
            />
            <FormSelect
              key="complexion"
              label="Complexion"
              hi="रंग"
              name="complexion"
              options={["Fair (गोरा)", "Wheatish (गेहुंआ)", "Dark (साँवला)"]}
              register={register}
              error={e("complexion")}
            />
            <FormSelect
              key="manglik"
              label="Manglik"
              hi="मांगलिक"
              name="manglik"
              req
              options={["Yes (हाँ)", "No (नहीं)", "Anshik (आंशिक)"]}
              register={register}
              error={e("manglik")}
            />
            <FormInput
              key="education"
              label="Qualification"
              hi="शिक्षा"
              name="education"
              req
              register={register}
              error={e("education")}
            />
            <div className="col-span-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormSelect
                  key="profession"
                  label="Profession"
                  hi="व्यवसाय"
                  name="profession"
                  req
                  options={[
                    "Private Job",
                    "Government Job",
                    "Business",
                    "Homely",
                    "Other",
                  ]}
                  register={register}
                  error={e("profession")}
                />
                <FormInput
                  key="professionDetails"
                  label="Profession Details"
                  hi="व्यवसाय विवरण"
                  name="professionDetails"
                  ph="Company, designation..."
                  req={profession?.trim() === "Other"}
                  register={register}
                  error={e("professionDetails")}
                />
              </div>
            </div>
            <div className="col-span-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-temple-brown-light mb-1">
                    Income Type{" "}
                    <span className="font-hindi text-primary">
                      आय का प्रकार
                    </span>{" "}
                    {profession?.trim() !== "Homely" && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <select
                    {...register("incomeType")}
                    className={`input-field ${e("incomeType") ? "!border-red-400" : ""}`}
                  >
                    <option value="MONTHLY">Monthly Income</option>
                    <option value="YEARLY">Yearly Income</option>
                  </select>
                  {e("incomeType") && (
                    <p className="text-xs text-red-500 mt-1">
                      {e("incomeType")}
                    </p>
                  )}
                </div>
                <FormInput
                  key="income"
                  label={
                    incomeType === "YEARLY" ? "Yearly Income" : "Monthly Income"
                  }
                  hi={incomeType === "YEARLY" ? "वार्षिक आय" : "मासिक आय"}
                  name="income"
                  type="text"
                  ph={
                    incomeType === "YEARLY"
                      ? "e.g. 10 Lakh / 1200000"
                      : "e.g. 10 Lakh / 100000"
                  }
                  req={profession?.trim() !== "Homely"}
                  register={register}
                  error={e("income")}
                />
              </div>
            </div>
            <FormSelect
              key="diet"
              label="Diet"
              hi="खानपान"
              name="diet"
              options={["Vegetarian (शाकाहारी)", "Non-Vegetarian (मांसाहारी)"]}
              register={register}
              error={e("diet")}
            />
            <FormInput
              key="healthStatus"
              label="Health Status"
              hi="स्वास्थ्य"
              name="healthStatus"
              ph="Any health conditions"
              register={register}
              error={e("healthStatus")}
            />
            <FormSelect
              key="glasses"
              label="Glasses"
              hi="चश्मा"
              name="glasses"
              options={["No (नहीं)", "Yes (हाँ)", "Occasionally (कभी-कभी)"]}
              register={register}
              error={e("glasses")}
            />
            <FormSelect
              key="disability"
              label="Disability"
              hi="विकलांगता"
              name="disability"
              options={["No (नहीं)", "Yes (हाँ)"]}
              register={register}
              error={e("disability")}
            />
            {watch("disability")?.includes("Yes") && (
              <FormInput
                key="disabilityDetails"
                label="Disability Details"
                hi="विकलांगता विवरण"
                name="disabilityDetails"
                ph="Type and percentage"
                full
                register={register}
                error={e("disabilityDetails")}
              />
            )}
          </div>
        );
      case 2:
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            <FormInput
              key="motherName"
              label="Mother's Name"
              hi="माता का नाम"
              name="motherName"
              register={register}
              error={e("motherName")}
            />
            <FormInput
              key="marriedBro"
              label="Married Brothers"
              name="marriedBro"
              type="number"
              ph="0"
              register={register}
              error={e("marriedBro")}
            />
            <FormInput
              key="unmarriedBro"
              label="Unmarried Brothers"
              name="unmarriedBro"
              type="number"
              ph="0"
              register={register}
              error={e("unmarriedBro")}
            />
            <FormInput
              key="marriedSis"
              label="Married Sisters"
              name="marriedSis"
              type="number"
              ph="0"
              register={register}
              error={e("marriedSis")}
            />
            <FormInput
              key="unmarriedSis"
              label="Unmarried Sisters"
              name="unmarriedSis"
              type="number"
              ph="0"
              register={register}
              error={e("unmarriedSis")}
            />
          </div>
        );
      case 3:
        return (
          <div className="grid grid-cols-1 gap-y-4 ">
            <FormInput
              key="house"
              label="House"
              hi="मकान"
              name="house"
              ph="Own / Rented"
              register={register}
              error={e("house")}
            />
            {/* <FormInput key="business" label="Business" hi="व्यापार" name="business" register={register} error={e('business')} /> */}
            <FormInput
              key="otherProp"
              label="Other Property"
              hi="अन्य संपत्ति"
              name="otherProp"
              full
              register={register}
              error={e("otherProp")}
            />
          </div>
        );
      case 4:
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* <FormInput key="prefCaste" label="Preferred Caste" hi="जाति" name="prefCaste" register={register} error={e('prefCaste')} />
          <FormInput key="prefAgeMin" label="Preferred Age Min" name="prefAgeMin" type="number" ph="e.g. 25" register={register} error={e('prefAgeMin')} />
          <FormInput key="prefAgeMax" label="Preferred Age Max" name="prefAgeMax" type="number" ph="e.g. 30" register={register} error={e('prefAgeMax')} />
          <FormSelect
            key="prefLoc"
            label="Preferred Location"
            hi="स्थान"
            name="prefLoc"
            options={INDIA_STATE_OPTIONS}
            register={register}
            error={e('prefLoc')}
          /> */}
            <FormSelect
              key="Preference"
              label="Preference"
              hi="वरीयता"
              name="preference"
              req
              options={PARTNER_PREFERENCE_OPTIONS}
              register={register}
              error={e("preference")}
            />
            <FormInput
              key="preferenceDetails"
              label="Preference Details"
              hi="वरीयता विवरण"
              name="preferenceDetails"
              ph="Describe expected profession details"
              // full
              register={register}
              error={e("preferenceDetails")}
            />
            <FormSelect
              key="wantToSettleAbroad"
              label="Want to settle abroad"
              hi="विदेश में बसना चाहते हैं"
              name="wantToSettleAbroad"
              options={["Yes (हाँ)", "No (नहीं)"]}
              register={register}
              error={e("wantToSettleAbroad")}
            />
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <label className="block border-2 border-dashed border-[#E8D5C4] rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary-light/30 transition-all">
              {photo ? (
                <div>
                  <img
                    src={resolvePhotoUrl(photo) ?? ""}
                    alt="Preview"
                    className="w-28 h-36 object-cover rounded-lg border-2 border-gold mx-auto mb-2"
                  />
                  <p className="text-sm text-maroon">
                    {uploadingPhoto ? "Uploading photo…" : "Photo uploaded ✓"}
                  </p>
                </div>
              ) : (
                <div>
                  <Upload size={36} className="text-primary mx-auto mb-2" />
                  <p className="font-semibold">
                    Upload Passport Size Photo (optional)
                  </p>
                  <p className="font-hindi text-primary text-sm">
                    फोटो अपलोड करें (वैकल्पिक)
                  </p>
                  <p className="text-xs text-temple-brown-light mt-1">
                    JPG or PNG, max 5MB
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={async (ev) => {
                  const f = ev.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) {
                    toast.error("Photo must be under 5MB");
                    return;
                  }
                  try {
                    setUploadingPhoto(true);
                    const { url } = await uploadApi.photo(f);
                    setPhoto(url);
                    toast.success("Photo uploaded");
                  } catch (err: any) {
                    toast.error(err?.message || "Photo upload failed");
                  } finally {
                    setUploadingPhoto(false);
                    ev.currentTarget.value = "";
                  }
                }}
              />
            </label>
            {!isEdit && (
              <div
                className={`bg-primary-light rounded-xl p-5 flex gap-3 items-start border-2 ${!decl ? "border-transparent" : "border-primary/20"}`}
              >
                <input
                  type="checkbox"
                  checked={decl}
                  onChange={(ev) => setDecl(ev.target.checked)}
                  className="w-5 h-5 accent-primary mt-0.5 flex-shrink-0"
                />
                <label
                  className="text-sm cursor-pointer"
                  onClick={() => setDecl(!decl)}
                >
                  I declare all information is true and correct.
                  <span className="font-hindi text-primary block text-xs mt-1">
                    मैं घोषणा करता/करती हूँ कि सभी जानकारी सत्य है।
                  </span>
                </label>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <ActivationBanner />
      {/* Progress */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-1.5 bg-cream-dark rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-gold rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-temple-brown-light whitespace-nowrap">
          Step {step + 1}/{STEPS.length}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 mb-2.5 pb-2">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => i < step && setStep(i)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              i === step
                ? "bg-primary text-white font-semibold"
                : i < step
                  ? "bg-maroon/10 text-maroon"
                  : "bg-cream-dark text-temple-brown-light"
            }`}
          >
            {i < step ? "✓" : ""} {s}
          </button>
        ))}
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-lg border border-[#E8D5C4] overflow-hidden">
        <div className="py-4 px-6 border-b border-[#E8D5C4] flex justify-between items-center">
          <h2 className="text-lg font-bold text-maroon">
            {isEdit ? `Edit Profile — ${STEPS[step]}` : STEPS[step]}
          </h2>
          {isEdit && (
            <button
              onClick={handleUpdateCurrentStep}
              disabled={loading}
              className="btn-outline"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              {loading ? "Update Profile..." : "Update Profile"}
            </button>
          )}
        </div>
        <div className="p-6">{renderStep()}</div>
        <div className="flex justify-between md:p-6 p-4 gap-2  border-t border-[#E8D5C4]">
          <button
            onClick={() => goToStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="btn-outline disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          {step < STEPS.length - 1 ? (
            <div className="flex items-center gap-2">
              <button onClick={validateAndNext} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading
                ? isEdit
                  ? "Updating..."
                  : "Submitting..."
                : isEdit
                  ? "Update Profile"
                  : `Submit & Pay ₹${REGISTRATION_FEE}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RegisterPageFallback() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-temple-brown">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-hindi">फॉर्म लोड हो रहा है…</p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}
