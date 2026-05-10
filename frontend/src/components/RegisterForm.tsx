"use client";

import { useState, useEffect, useMemo } from "react";
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
  teamApi,
  uploadApi,
  resolvePhotoUrl,
  getUser,
} from "@/lib/api";
import { useCaptcha } from "@/hooks/useCaptcha";
import type { Profile } from "@/types";

const INDIA_STATES = State.getStatesOfCountry("IN");
const INDIA_STATE_OPTIONS = INDIA_STATES
  .map((s) => s.name)
  .sort((a, b) => a.localeCompare(b));

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

const REGISTRATION_FEE = 2100;

// ─── ZOD SCHEMAS PER STEP ─────────────────────────────

const nameRegex = /^[a-zA-Z\s.'-]+$/;
const numStr = (max: number) =>
  z
    .string()
    .optional()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && parseInt(v) >= 0 && parseInt(v) <= max),
      `Must be a number (0–${max})`,
    );

/** `yyyy-mm-dd` for native `<input type="date">` min/max. */
function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-readable e.g. `7 Apr 2026` for UI copy. */
function formatDateDayMonYear(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function registrationDateBounds() {
  const max = new Date();
  max.setHours(23, 59, 59, 999);
  const min = new Date(max);
  min.setMonth(min.getMonth() - 5);
  min.setHours(0, 0, 0, 0);
  return { min, max };
}

// Wider range for staff edit screens so older existing profiles still show & validate.
function registrationDateBoundsEdit() {
  const max = new Date();
  max.setHours(23, 59, 59, 999);
  const min = new Date(max);
  min.setFullYear(min.getFullYear() - 15);
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
      const { min, max } = registrationDateBoundsEdit();
      const d = new Date(`${v}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) return false;
      return d >= min && d <= max;
    }, "Registration date must be within the allowed range"),
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
  // income: z.string().optional(),
  income: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'Income must contain digits only'),
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
  // business: z.string().optional(),
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
    const isWidow =
      ms?.includes("Widow") && !ms?.includes("Widower");
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
    "fullName",
    "gender",
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
  // ["house", "business", "otherProp"],
  ["house", "otherProp"],
  ["prefCaste", "prefAgeMin", "prefAgeMax", "prefLoc", "preference", "preferenceDetails", "wantToSettleAbroad"],
  [],
];

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
  const createdAtDate = typeof p.createdAt === "string"
    ? p.createdAt.split("T")[0] || ""
    : "";
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
    registrationDate: createdAtDate,
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
    // business: p.business || "",
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

// function FormInput({
//   label,
//   hi,
//   name,
//   type = "text",
//   ph = "",
//   req = false,
//   full = false,
//   error,
//   register,
// }: {
//   label: string;
//   hi?: string;
//   name: string;
//   type?: string;
//   ph?: string;
//   req?: boolean;
//   full?: boolean;
//   error?: string;
//   register: any;
// }) {
//   return (
//     <div className={full ? "sm:col-span-2" : ""}>
//       <label className="block text-xs font-medium text-temple-brown-light mb-1">
//         {label} {hi && <span className="font-hindi text-primary">{hi}</span>}{" "}
//         {req && <span className="text-red-500">*</span>}
//       </label>
//       <input
//         type={type}
//         placeholder={ph}
//         {...register(name)}
//         className={`input-field ${error ? "!border-red-400" : ""}`}
//       />
//       {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
//     </div>
//   );
// }
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
        {label} {hi && <span className="font-hindi text-primary">{hi}</span>}
        {req && <span className="text-red-500">*</span>}
      </label>

      <input
        key={name}
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

// ─── PROPS ────────────────────────────────────────────

interface RegisterFormProps {
  /** Where to redirect after successful submission/edit. Default: /profiles */
  successRedirect?: string;
  /** 'user' = online payment only, 'staff' = choose CASH/FREE/ONLINE */
  mode?: "user" | "staff";
}

// ─── MAIN FORM COMPONENT (EXPORTED) ──────────────────

export default function RegisterForm({
  successRedirect = "/profiles",
  mode = "user",
}: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;
  const isStaff = mode === "staff";
  const actorRole = getUser()?.role;
  const canManageInternalRef = isStaff && (actorRole === "TEAM" || actorRole === "ADMIN");

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [editingProfileStatus, setEditingProfileStatus] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [decl, setDecl] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<
    Array<"CASH" | "ONLINE" | "FREE">
  >(["CASH"]);
  const [cashAmount, setCashAmount] = useState<number>(REGISTRATION_FEE);
  const [onlineAmount, setOnlineAmount] = useState<number>(0);
  const [freeApprovedBy, setFreeApprovedBy] = useState("");
  const [freeReason, setFreeReason] = useState("");
  const { getToken: getCaptchaToken } = useCaptcha();

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
    reValidateMode: "onChange",
    defaultValues: {
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
      internalRegistrationNo: "",
      registrationDate: "",
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
      // business: "",
      otherProp: "",
      prefCaste: "",
      prefAgeMin: "",
      prefAgeMax: "",
      prefLoc: "",
      preference: "",
      preferenceDetails: "",
      wantToSettleAbroad: "No (नहीं)",
    },
  });

  const selectedStateName = watch("state");
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
    if (!editId) return;
    setFetching(true);
    profilesApi
      .get(editId)
      .then((data) => {
        const profile = data as Profile;
        setEditingProfileStatus(profile.status ?? null);
        reset(profileToFormData(profile));
        // Ensure native date input gets an ISO `yyyy-mm-dd` string.
        if (isStaff && profile?.createdAt) {
          setValue(
            "registrationDate",
            String(profile.createdAt).split("T")[0] || "",
            { shouldValidate: false, shouldDirty: false },
          );
        }
        if (profile.photoUrl) setPhoto(profile.photoUrl);
      })
      .catch(() => {
        toast.error("Failed to load profile for editing");
        router.push(successRedirect);
      })
      .finally(() => setFetching(false));
  }, [editId, isStaff, reset, router, setValue, successRedirect]);

  const gender = watch("gender");
  const marriageStatus = watch("marriageStatus");
  const profession = watch("profession");
  const incomeType = watch("incomeType");
  const fatherIncomeType = watch("fatherIncomeType");
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const showRazorpaySummary = !isStaff && (!isEdit || editingProfileStatus === "PENDING_PAYMENT");
  console.log(showRazorpaySummary, "=showRazorpaySummary")

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

  const validateAndNext = async () => {
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields);
    if (valid) setStep(step + 1);
    else toast.error("Please fix the highlighted fields before continuing");
  };

  const handleUpdateCurrentStep = async () => {
    if (!isEdit || !editId) return;
    const fields = STEP_FIELDS[step];
    const valid = await trigger(fields);
    if (!valid) {
      toast.error("Please fix the highlighted fields before updating this step");
      return;
    }

    const form = getValues();
    const payload = buildPayload(form);
    setLoading(true);
    try {
      if (isStaff) {
        await teamApi.editProfile(editId, payload);
      } else {
        await profilesApi.update(editId, payload);
      }
      toast.success("Profile updated!");
      router.push(successRedirect);
    } catch (err: any) {
      toast.error(err.message || "Step update failed");
    } finally {
      setLoading(false);
    }
  };

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

    return ({
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
      professionDetails: form.professionDetails?.trim() ? form.professionDetails.trim() : null,
      incomeType: form.income?.trim() ? (form.incomeType || "MONTHLY") : null,
      incomeValue: form.income?.trim() ? form.income.trim() : null,
      monthlyIncome: (() => {
        const raw = form.income?.trim();
        if (!raw) return isEdit ? null : undefined;
        if (!/^\d+$/.test(raw)) return isEdit ? null : undefined;
        return parseInt(raw, 10);
      })(),
      diet: nullableText(form.diet),
      healthStatus: nullableText(form.healthStatus),
      glasses: form.glasses?.includes("Yes") || form.glasses?.includes("Occasionally") ? true : false,
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
      fatherIncomeType: form.fatherIncome?.trim() ? (form.fatherIncomeType || "MONTHLY") : null,
      fatherIncome: form.fatherIncome?.trim() ? form.fatherIncome.trim() : isEdit ? null : undefined,
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
      // business: form.business || undefined,
      otherProperty: nullableText(form.otherProp),
      preferredCaste: nullableText(form.prefCaste),
      preferredAgeMin: nullableInt(form.prefAgeMin),
      preferredAgeMax: nullableInt(form.prefAgeMax),
      preferredLocation: nullableText(form.prefLoc),
      partnerPreference: nullableText(form.preference),
      partnerPreferenceDetails: nullableText(form.preferenceDetails),
      wantToSettleAbroad: form.wantToSettleAbroad?.includes("Yes") ? true : false,
      photoUrl: photo,
      ...(isStaff && form.registrationDate
        ? {
          createdAt: new Date(
            `${form.registrationDate}T00:00:00.000Z`,
          ).toISOString(),
        }
        : {}),
    });
  };

  const initiatePayment = async (
    profileId: string,
    regNumber: string,
    amount: number,
    split?: {
      paymentMethods: string[];
      cashAmount: number;
      onlineAmount: number;
    },
  ) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      toast.error("Failed to load payment gateway.");
      router.push(successRedirect);
      return;
    }
    try {
      const order = (await donationsApi.create({
        profileId,
        type: "REGISTRATION",
        amount,
        ...(split
          ? {
            splitPaymentMethods: split.paymentMethods,
            splitCashRupees: split.cashAmount,
            splitOnlineRupees: split.onlineAmount,
          }
          : {}),
      })) as CreateOrderResponse;
      const options = {
        key: order.key,
        amount: order.amount * 100,
        currency: order.currency,
        name: "Mandir",
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
            toast.success("Payment successful! Profile is now active.");
            router.push(`/success?regId=${regNumber}`);
          } catch {
            toast.error("Payment verification failed.");
            router.push(successRedirect);
          }
        },
        prefill: {
          contact: getValues("guardianPhone") || undefined,
          email: getValues("guardianEmail") || undefined,
        },
        theme: { color: "#8B1A1A" },
        modal: {
          ondismiss: () => {
            toast.info("Payment skipped.");
            router.push(successRedirect);
          },
        },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", () => {
        toast.error("Payment failed.");
        router.push(successRedirect);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Payment initiation failed.");
      router.push(successRedirect);
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
    const allFields = STEP_FIELDS.flat();
    const valid = await trigger(allFields);
    if (!valid) {
      toast.error("Some required fields are missing.");
      return;
    }

    const form = getValues();
    const payload = buildPayload(form);
    setLoading(true);
    try {
      if (isEdit) {
        if (isStaff) {
          await teamApi.editProfile(editId!, payload);
        } else {
          await profilesApi.update(editId!, payload);
        }
        toast.success("Profile updated!");
        router.push(successRedirect);
      } else if (isStaff) {
        // Staff registers a profile on behalf of the end user.
        // Do NOT set userId to the staff account; backend will link by userId (if provided)
        // or by guardianPhone (auto create/link the USER record).
        const profileDataWithUser = { ...payload };

        const hasFree = paymentMethods.includes("FREE");
        const hasCash = paymentMethods.includes("CASH");
        const hasOnline = paymentMethods.includes("ONLINE");

        if (!hasFree && !hasCash && !hasOnline) {
          toast.error("Please select payment method");
          return;
        }

        if (hasFree) {
          if (!freeApprovedBy.trim() || !freeReason.trim()) {
            toast.error("FREE payment requires Approved by and Waiver reason");
            return;
          }

          const result = (await teamApi.createProfileOffline(
            profileDataWithUser,
            paymentMethods,
            {
              freeApprovedBy,
              freeReason,
              freeAmount: REGISTRATION_FEE,
            },
          )) as any;

          toast.success(
            `Profile registered with free payment. Invoice: ${result.donation?.invoiceNumber || "N/A"}`,
          );
          router.push(successRedirect);
          return;
        }

        // CASH and/or ONLINE split validation
        const cashAmt = hasCash ? cashAmount : 0;
        const onlineAmt = hasOnline ? onlineAmount : 0;

        if (hasCash && cashAmt <= 0) {
          toast.error("Cash amount must be greater than 0 for CASH");
          return;
        }
        if (hasOnline && onlineAmt <= 0) {
          toast.error("Online amount must be greater than 0 for ONLINE");
          return;
        }

        if (Math.round(cashAmt + onlineAmt) !== REGISTRATION_FEE) {
          toast.error(`Cash + Online must total exactly ₹${REGISTRATION_FEE}`);
          return;
        }

        const result = (await teamApi.createProfileOffline(
          profileDataWithUser,
          paymentMethods,
          {
            cashAmount: cashAmt,
            onlineAmount: onlineAmt,
          },
        )) as any;

        toast.success(
          `Profile registered successfully. Invoice: ${result.donation?.invoiceNumber || "N/A"}`,
        );
        router.push(successRedirect);
      } else {
        // User self-registration — MUST pay online
        const captchaToken = await getCaptchaToken("register");
        const profile = (await profilesApi.create(
          payload,
          captchaToken,
        )) as any;
        toast.success(
          `Profile created! Proceeding to payment (₹${REGISTRATION_FEE})...`,
        );
        await initiatePayment(
          profile.id,
          profile.registrationNumber,
          REGISTRATION_FEE,
        );
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

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-temple-brown-light">Loading profile...</span>
      </div>
    );
  }

  const togglePaymentMethod = (method: "CASH" | "FREE" | "ONLINE") => {
    setPaymentMethods((prev) => {
      if (method === "FREE") {
        if (prev.includes("FREE")) return prev.filter((m) => m !== "FREE");
        // FREE selection clears CASH/ONLINE amounts
        setCashAmount(0);
        setOnlineAmount(0);
        return ["FREE"];
      }
      // CASH or ONLINE
      let next = prev.filter((m) => m !== "FREE");
      if (next.includes(method)) next = next.filter((m) => m !== method);
      else next = [...next, method];

      // Keep amount split consistent with selected methods
      const hasCashNext = next.includes("CASH");
      const hasOnlineNext = next.includes("ONLINE");

      if (!hasCashNext && !hasOnlineNext) {
        setCashAmount(0);
        setOnlineAmount(0);
        return next;
      }

      if (hasCashNext && !hasOnlineNext) {
        setCashAmount(REGISTRATION_FEE);
        setOnlineAmount(0);
        return next;
      }

      if (!hasCashNext && hasOnlineNext) {
        setCashAmount(0);
        setOnlineAmount(REGISTRATION_FEE);
        return next;
      }

      // CASH + ONLINE
      // If user toggles into both, preserve cashAmount and derive online from remaining.
      setOnlineAmount(REGISTRATION_FEE - cashAmount);
      return next;
    });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            {isStaff
              ? (() => {
                const { min, max } = isEdit
                  ? registrationDateBoundsEdit()
                  : registrationDateBounds();
                return (
                  <div>
                    <label className="block text-xs font-medium text-temple-brown-light mb-1">
                      Registration Date{" "}
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
                      {/* {isEdit
                        ? `Allowed: ${formatDateDayMonYear(min)} to ${formatDateDayMonYear(max)} (editing existing profile)`
                        : `Allowed: ${formatDateDayMonYear(min)} to ${formatDateDayMonYear(max)}`} */}
                    </p>
                  </div>
                );
              })()
              : null}
            {canManageInternalRef && (
              <FormInput
                label="Temple / Offline Registration No"
                hi="आंतरिक पंजीकरण क्रमांक"
                name="internalRegistrationNo"
                ph="Internal reference (staff only)"
                register={register}
                error={e("internalRegistrationNo")}
              />
            )}
            <FormInput
              label="Father / Guardian Name"
              hi="पिता का नाम"
              name="guardianName"
              ph="Full name"
              req
              register={register}
              error={e("guardianName")}
            />
            <FormInput
              label="Father Profession"
              hi="पिता का व्यवसाय"
              name="fatherProfession"
              ph="e.g. Business / Service"
              register={register}
              error={e("fatherProfession")}
            />
            <div className="col-span-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-temple-brown-light mb-1">
                    Father Income Type{" "}
                    <span className="font-hindi text-primary">पिता की आय प्रकार</span>
                  </label>
                  <select
                    {...register("fatherIncomeType")}
                    className={`input-field ${e("fatherIncomeType") ? "!border-red-400" : ""}`}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                  {e("fatherIncomeType") && (
                    <p className="text-xs text-red-500 mt-1">{e("fatherIncomeType")}</p>
                  )}
                </div>
                <FormInput
                  label={fatherIncomeType === "YEARLY" ? "Father Yearly Income" : "Father Monthly Income"}
                  hi={fatherIncomeType === "YEARLY" ? "पिता की वार्षिक आय" : "पिता की मासिक आय"}
                  name="fatherIncome"
                  type="text"
                  ph={fatherIncomeType === "YEARLY" ? "e.g. 5 Lakh / 50k" : "e.g. 50k / 20000"}
                  register={register}
                  error={e("fatherIncome")}
                />
              </div>
            </div>
            <FormInput
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
              label="Alternate Mobile"
              hi="वैकल्पिक मोबाइल"
              name="alternateMobile"
              type="tel"
              ph="10-digit mobile (optional)"
              register={register}
              error={e("alternateMobile")}
            />
            <FormInput
              label="Email"
              hi="ईमेल"
              name="guardianEmail"
              type="email"
              ph="email@example.com"
              register={register}
              error={e("guardianEmail")}
            />
            <FormInput
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
                  <div>
                    <label className="block text-xs font-medium text-temple-brown-light mb-1">
                      State <span className="font-hindi text-primary">राज्य</span>
                    </label>
                    <select
                      {...stateReg}
                      onChange={(e) => {
                        stateReg.onChange(e);
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
                    {e("state") && <p className="text-xs text-red-500 mt-1">{e("state")}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-temple-brown-light mb-1">
                      City <span className="font-hindi text-primary">शहर</span>
                    </label>
                    <select
                      {...cityReg}
                      disabled={!selectedStateIso}
                      className={`input-field ${e("city") ? "!border-red-400" : ""} ${!selectedStateIso ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <option value="">
                        {selectedStateIso ? "Select / चुनें" : "Select State first"}
                      </option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {e("city") && <p className="text-xs text-red-500 mt-1">{e("city")}</p>}
                  </div>
                </>
              );
            })()}
            <FormInput
              label="Pincode"
              hi="पिन कोड"
              name="pincode"
              type="number"
              ph="e.g. 110031"
              register={register}
              error={e("pincode")}
            />

            <FormInput
              label="Religion"
              hi="धर्म"
              name="religion"
              ph="e.g. Hindu"
              register={register}
              error={e("religion")}
            />
            <FormInput
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
              label="Gender"
              hi="लिंग"
              name="gender"
              req
              options={["Groom (वर)", "Bride (वधू)"]}
              register={register}
              error={e("gender")}
            />
            <FormInput
              label="Full Name"
              hi="पूरा नाम"
              name="fullName"
              req
              register={register}
              error={e("fullName")}
            />
            <FormSelect
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
              label="Date of Birth"
              hi="जन्म तिथि"
              name="dob"
              type="date"
              req
              register={register}
              error={e("dob")}
            />
            <FormInput
              label="Birth Time"
              hi="जन्म समय"
              name="birthTime"
              type="time"
              register={register}
              error={e("birthTime")}
            />
            <FormInput
              label="Birth Place"
              hi="जन्म स्थान"
              name="birthPlace"
              register={register}
              error={e("birthPlace")}
            />
            <div>
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
                  className={`absolute right-1 top-1/2 -translate-y-1/2 h-[32px] rounded-lg border border-[#E8D5C4] bg-white px-2 text-xs font-semibold text-temple-brown focus:outline-none focus:ring-2 focus:ring-primary/30 ${e("heightUnit") ? "!border-red-400" : ""
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
              label="Weight (kg)"
              name="weight"
              type="number"
              ph="e.g. 65"
              register={register}
              error={e("weight")}
            />
            <FormSelect
              label="Blood Group"
              name="bloodGroup"
              options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
              register={register}
              error={e("bloodGroup")}
            />
            <FormSelect
              label="Complexion"
              hi="रंग"
              name="complexion"
              options={["Fair (गोरा)", "Wheatish (गेहुंआ)", "Dark (साँवला)"]}
              register={register}
              error={e("complexion")}
            />
            <FormSelect
              label="Manglik"
              hi="मांगलिक"
              name="manglik"
              req
              options={["Yes (हाँ)", "No (नहीं)", "Anshik (आंशिक)"]}
              register={register}
              error={e("manglik")}
            />
            <FormInput
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
                  label="Profession"
                  hi="व्यवसाय"
                  name="profession"
                  req
                  options={["Private Job", "Government Job", "Business", "Homely", "Other"]}
                  register={register}
                  error={e("profession")}
                />
                <FormInput
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
                    Income Type <span className="font-hindi text-primary">आय का प्रकार</span> {profession?.trim() !== "Homely" && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    {...register("incomeType")}
                    className={`input-field ${e("incomeType") ? "!border-red-400" : ""}`}
                  >
                    <option value="MONTHLY">Monthly Income</option>
                    <option value="YEARLY">Yearly Income</option>
                  </select>
                  {e("incomeType") && <p className="text-xs text-red-500 mt-1">{e("incomeType")}</p>}
                </div>
                <FormInput
                  label={incomeType === "YEARLY" ? "Yearly Income" : "Monthly Income"}
                  hi={incomeType === "YEARLY" ? "वार्षिक आय" : "मासिक आय"}
                  name="income"
                  type="text"
                  ph={incomeType === "YEARLY" ? "e.g. 10 Lakh / 1200000" : "e.g. 10 Lakh / 100000"}
                  req={profession?.trim() !== "Homely"}
                  register={register}
                  error={e("income")}
                />
              </div>
            </div>
            <FormSelect
              label="Diet"
              hi="खानपान"
              name="diet"
              options={["Vegetarian (शाकाहारी)", "Non-Vegetarian (मांसाहारी)"]}
              register={register}
              error={e("diet")}
            />
            <FormInput
              label="Health Status"
              hi="स्वास्थ्य"
              name="healthStatus"
              ph="Any health conditions"
              register={register}
              error={e("healthStatus")}
            />
            <FormSelect
              label="Glasses"
              hi="चश्मा"
              name="glasses"
              options={["No (नहीं)", "Yes (हाँ)", "Occasionally (कभी-कभी)"]}
              register={register}
              error={e("glasses")}
            />
            <FormSelect
              label="Disability"
              hi="विकलांगता"
              name="disability"
              options={["No (नहीं)", "Yes (हाँ)"]}
              register={register}
              error={e("disability")}
            />
            {watch("disability")?.includes("Yes") && (
              <FormInput
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
              label="Mother's Name"
              hi="माता का नाम"
              name="motherName"
              register={register}
              error={e("motherName")}
            />
            <FormInput
              label="Married Brothers"
              name="marriedBro"
              type="number"
              ph="0"
              register={register}
              error={e("marriedBro")}
            />
            <FormInput
              label="Unmarried Brothers"
              name="unmarriedBro"
              type="number"
              ph="0"
              register={register}
              error={e("unmarriedBro")}
            />
            <FormInput
              label="Married Sisters"
              name="marriedSis"
              type="number"
              ph="0"
              register={register}
              error={e("marriedSis")}
            />
            <FormInput
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
          <div className="grid sm:grid-cols-2 gap-4">
            <FormInput
              label="House"
              hi="मकान"
              name="house"
              ph="Own / Rented"
              register={register}
              error={e("house")}
            />
            {/* <FormInput
              label="Business"
              hi="व्यापार"
              name="business"
              register={register}
              error={e("business")}
            /> */}
            <FormInput
              label="Other Property"
              hi="अन्य संपत्ति"
              name="otherProp"
              // full
              register={register}
              error={e("otherProp")}
            />
          </div>
        );
      case 4:
        return (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* <FormInput
              label="Preferred Caste"
              hi="जाति"
              name="prefCaste"
              register={register}
              error={e("prefCaste")}
            />
            <FormInput
              label="Preferred Age Min"
              name="prefAgeMin"
              type="number"
              ph="e.g. 25"
              register={register}
              error={e("prefAgeMin")}
            />
            <FormInput
              label="Preferred Age Max"
              name="prefAgeMax"
              type="number"
              ph="e.g. 30"
              register={register}
              error={e("prefAgeMax")}
            />
            <FormSelect
              label="Preferred Location"
              hi="स्थान"
              name="prefLoc"
              options={INDIA_STATE_OPTIONS}
              register={register}
              error={e("prefLoc")}
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
                    {uploadingPhoto ? "Uploading photo…" : "Photo uploaded"}
                  </p>
                </div>
              ) : (
                <div>
                  <Upload size={36} className="text-primary mx-auto mb-2" />
                  <p className="font-semibold">Upload Passport Size Photo (optional)</p>
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
                    // allow selecting same file again
                    ev.currentTarget.value = "";
                  }
                }}
              />
            </label>
            {/* Staff: Payment method selector */}
            {isStaff && !isEdit && (
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <label className="block text-sm font-semibold text-blue-900 mb-3">
                  Payment Method{" "}
                  <span className="font-hindi text-blue-600">
                    भुगतान का तरीका
                  </span>
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {(
                    [
                      ["CASH", "Cash (नकद)", "Collected at temple"],
                      [
                        "ONLINE",
                        "Online (ऑनलाइन)",
                        "User pays via Razorpay later",
                      ],
                      ["FREE", "Fee Waived (मुक्त)", "No payment required"],
                    ] as const
                  ).map(([value, label, desc]) => {
                    const checked = paymentMethods.includes(value);
                    return (
                      <label
                        key={value}
                        className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${checked
                          ? "border-blue-500 bg-blue-100 text-blue-900"
                          : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"
                          }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => togglePaymentMethod(value)}
                          />
                          <div>
                            <p className="text-sm font-semibold">{label}</p>
                            <p className="text-xs mt-0.5 opacity-70">{desc}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {paymentMethods.includes("CASH") && (
                  <div className="mt-3 grid sm:grid-cols-1 gap-3">
                    <input
                      type="text"
                      value={cashAmount}
                      disabled={!paymentMethods.includes("ONLINE")}
                      onChange={(e) => {
                        const v = Math.max(
                          0,
                          Math.min(
                            REGISTRATION_FEE,
                            parseInt(e.target.value || "0", 10) || 0,
                          ),
                        );
                        setCashAmount(v);
                        setOnlineAmount(REGISTRATION_FEE - v);
                      }}
                      placeholder="Cash amount (₹)"
                      className="input-field"
                      min={0}
                      max={REGISTRATION_FEE}
                      step={1}
                    />
                  </div>
                )}

                {paymentMethods.includes("ONLINE") && (
                  <div className="mt-3 grid sm:grid-cols-1 gap-3">
                    <input
                      type="text"
                      value={onlineAmount}
                      disabled={!paymentMethods.includes("CASH")}
                      onChange={(e) => {
                        const v = Math.max(
                          0,
                          Math.min(
                            REGISTRATION_FEE,
                            parseInt(e.target.value || "0", 10) || 0,
                          ),
                        );
                        setOnlineAmount(v);
                        setCashAmount(REGISTRATION_FEE - v);
                      }}
                      placeholder="Online amount (₹)"
                      className="input-field"
                      min={0}
                      max={REGISTRATION_FEE}
                      step={1}
                    />
                  </div>
                )}

                {paymentMethods.includes("FREE") && (
                  <div className="mt-3 grid sm:grid-cols-2 gap-3">
                    <input
                      value={freeApprovedBy}
                      onChange={(e) => setFreeApprovedBy(e.target.value)}
                      placeholder="Approved by"
                      className="input-field"
                    />
                    <input
                      value={freeReason}
                      onChange={(e) => setFreeReason(e.target.value)}
                      placeholder="Waiver reason"
                      className="input-field"
                    />
                  </div>
                )}
              </div>
            )}

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
    <div className="max-w-3xl mx-auto overflow-hidden">
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
      <div className="flex  gap-1 mb-6 pb-2 overflow-auto">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => i < step && setStep(i)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${i === step
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
      <div className="bg-white rounded-xl shadow-lg border border-[#E8D5C4] overflow-hidden">
        <div className=" py-4 px-6 border-b border-[#E8D5C4] flex justify-between items-center">
          <h2 className="text-lg font-bold text-maroon">
            {isEdit ? `Edit Profile — ${STEPS[step]}` : STEPS[step]}
          </h2>
          {isEdit && (
            <button
              onClick={handleUpdateCurrentStep}
              disabled={loading}
              className="btn-outline justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              {loading ? "Update Profile..." : "Update Profile"}
            </button>
          )}
        </div>
        <div className=" p-4 sm:p-6">{renderStep()}</div>
        <div className="grid grid-cols-2 gap-2.5 sm:flex justify-between p-4 sm:p-6 border-t border-[#E8D5C4]">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="btn-outline disabled:opacity-40 justify-center"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          {step < STEPS.length - 1 ? (
            <div className="col-span-1 sm:col-auto flex items-center justify-end gap-2">

              <button
                onClick={validateAndNext}
                className="btn-primary justify-center"
              >
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
                  : isStaff
                    ? paymentMethods.includes("FREE")
                      ? "Register (Fee Waived)"
                      : paymentMethods.includes("CASH") &&
                        paymentMethods.includes("ONLINE")
                        ? `Register (Split ₹${cashAmount} + ₹${onlineAmount})`
                        : paymentMethods.includes("CASH")
                          ? `Register (Cash ₹${cashAmount})`
                          : `Register (Pay Online ₹${onlineAmount})`
                    : `Submit & Pay ₹${REGISTRATION_FEE}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
