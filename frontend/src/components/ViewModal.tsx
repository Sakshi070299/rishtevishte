import { resolvePhotoUrl } from "@/lib/api";
import { fmtDate } from "@/lib/download-biodata";
import { Profile } from "@/types";
import { X, Lock } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";

function fatherIncomeDisplay(p: Profile): string {
  const v = typeof p.fatherIncome === "string" ? p.fatherIncome.trim() : "";
  if (!v) return "—";
  const typeText = p.fatherIncomeType === "YEARLY" ? "वार्षिक" : "मासिक";
  return `${typeText} : ${v}`;
}

function age(dob: string) {
  return Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return digits.slice(0, 2) + "****" + digits.slice(-2);
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "****@****";
  return local.slice(0, 2) + "****@" + domain;
}

export function ViewModal({
  profile,
  onClose,
  showContactDetails = false,
}: {
  profile: Profile;
  onClose: () => void;
  showContactDetails?: boolean;
}) {
  const incomeForView = (p: Profile): { label: string; value: string | null } => {
    const raw = p.incomeValue?.trim();
    const yearly = p.incomeType === "YEARLY";
    const cadence = yearly ? "Yearly" : "Monthly";
    if (raw) {
      const val = /^\d+$/.test(raw) ? parseInt(raw, 10).toLocaleString("en-IN") : raw;
      return { label: "Income", value: `${cadence}: ${val}` };
    }
    const rupees = p.monthlyIncome;
    if (!rupees) return { label: "Income", value: null };
    return {
      label: "Income",
      value: `${cadence}: ${rupees.toLocaleString("en-IN")}`,
    };
  };
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="mb-5">
      <h4 className="text-xs font-bold text-navy uppercase tracking-wide mb-2 border-b border-gray-200 pb-1">
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  );
  const Field = ({
    label,
    value,
  }: {
    label: string;
    value?: string | number | null;
  }) =>
    value ? (
      <div className="text-sm min-w-0">
        <span className="text-gray-500">{label}:</span>{" "}
        <p className="text-navy inline font-semibold [overflow-wrap:anywhere]">
          {value}
        </p>
      </div>
    ) : null;

  const HiddenField = ({
    label,
  }: {
    label: string;
  }) => (
    <div className="text-sm min-w-0">
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="inline-flex items-center gap-1 text-primary/60 font-medium text-xs bg-primary/5 px-2 py-0.5 rounded-full">
        <Lock size={10} /> Hidden
      </span>
    </div>
  );

  const fullPhotoUrl = resolvePhotoUrl(profile.photoUrl);
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-10" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-navy to-navy-light rounded-t-2xl p-4 sm:p-5 text-white flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <a
              href={fullPhotoUrl ?? "/images/default-avatar.svg"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline font-medium shrink-0"
            >
              <ProfileAvatar
                photoUrl={profile.photoUrl}
                name={profile.fullName}
                className="w-14 h-16 sm:w-16 sm:h-20 rounded-lg border-2 border-gold"
              />
            </a>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold break-words">{profile.fullName}</h3>
              <p className="text-xs sm:text-sm opacity-80 break-words">
                {profile.registrationNumber} · {profile.gender} · Age{" "}
                {age(profile.dateOfBirth)}
              </p>
            </div>

          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
          <Section title="Personal Details">
            <Field label="Temple/Offline Reg No" value={profile.internalRegistrationNo} />
            <Field label="Date of Birth" value={fmtDate(profile.dateOfBirth)} />
            <Field label="Birth Time" value={profile.birthTime} />
            <Field label="Birth Place" value={profile.birthPlace} />
            <Field label="Height" value={profile.height} />
            <Field label="Weight" value={profile.weight} />
            <Field label="Disability" value={profile.disability ? "Yes" : "No"} />
            {
              profile.disability === true && (
                <Field label="Disability Details" value={profile.disabilityDetails} />
              )
            }
            <Field label="Blood Group" value={profile.bloodGroup} />
            <Field label="Complexion" value={profile.complexion} />
            <Field
              label="Manglik"
              value={profile.manglikStatus?.replace("_", " ")}
            />
            <Field label="Marriage Status" value={profile.marriageStatus} />
            {
              profile.marriageStatus == "DIVORCEE" && (
                <Field label="Divorce Date" value={fmtDate(profile.divorceDate!)} />
              )
            }
            {
              profile.marriageStatus == "WIDOW" || profile.marriageStatus == "WIDOWER" && (
                <Field label="Marriage Date" value={fmtDate(profile.marriageDate!)} />
              )
            }
            {
              profile.marriageStatus !== "UNMARRIED" && (
                <Field label="Children Details" value={profile.childrenDetails} />
              )
            }
            <Field label="Religion" value={profile.religion} />
            <Field label="Caste" value={profile.caste} />
            <Field label="Diet" value={profile.diet} />
            <Field label="Health Status" value={profile.healthStatus} />

            {
              profile.wantToSettleAbroad === true && (
                <Field label="Want to settle abroad" value={profile.wantToSettleAbroad ? "Yes (हाँ)" : "No (नहीं)"} />
              )
            }

            <Field
              label="Glasses"
              value={
                profile.glassesType === "OCCASIONALLY"
                  ? "Occasionally"
                  : profile.glassesType === "YES"
                    ? "Yes"
                    : profile.glassesType === "NO"
                      ? "No"
                      : profile.glasses
                        ? "Yes"
                        : "No"
              }
            />
          </Section>

          <Section title="Education & Profession">
            <Field label="Education" value={profile.education} />
            <Field label="Profession" value={profile.profession} />
            {
              profile.profession === "OTHER" && (
                <Field label="Profession Details" value={profile.professionDetails} />
              )
            }
            <Field label={incomeForView(profile).label} value={incomeForView(profile).value} />
          </Section>

          <Section title="Family Details">
            <Field label="Father" value={profile.fatherName} />
            <Field label="Father's Profession" value={profile.fatherProfession} />
            <Field label="Father's Income" value={fatherIncomeDisplay(profile)} />
            <Field label="Mother" value={profile.motherName} />
            {showContactDetails ? (
              <>
                <Field label="Phone" value={profile.guardianPhone} />
                <Field label="Alternate Mobile" value={profile.alternateMobile} />
                <Field label="Email" value={profile.guardianEmail} />
              </>
            ) : (
              <>
                <Field label="Phone" value={maskPhone(profile.guardianPhone)} />
                {profile.alternateMobile && <Field label="Alternate Mobile" value={maskPhone(profile.alternateMobile)} />}
                {profile.guardianEmail && <Field label="Email" value={maskEmail(profile.guardianEmail)} />}
              </>
            )}
            <Field label="Address" value={profile.address} />
            <Field label="Married Brothers" value={profile.marriedBrothers} />
            <Field
              label="Unmarried Brothers"
              value={profile.unmarriedBrothers}
            />
            <Field label="Married Sisters" value={profile.marriedSisters} />
            <Field label="Unmarried Sisters" value={profile.unmarriedSisters} />
          </Section>

          <Section title="Property">
            <Field label="House" value={profile.house} />
            <Field label="Other" value={profile.otherProperty} />
          </Section>

          <Section title="Preferences">
            <Field label="Preferred Caste" value={profile.preferredCaste} />

            <Field
              label="Age Range"
              value={
                profile.preferredAgeMin || profile.preferredAgeMax
                  ? `${profile.preferredAgeMin || "—"} to ${profile.preferredAgeMax || "—"}`
                  : null
              }
            />
            <Field label="Location" value={profile.preferredLocation} />
            <Field label="Preference (वरीयता)" value={profile.partnerPreference} />
            <Field label="Preference Details (वरीयता विवरण)" value={profile.partnerPreferenceDetails} />
          </Section>

          {!showContactDetails && (
            <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10 text-center">
              <p className="text-xs text-primary font-medium flex items-center justify-center gap-1.5">
                <Lock size={12} />
                Contact details are hidden for privacy protection
              </p>
              <p className="font-hindi text-xs text-primary/60 mt-0.5">
                संपर्क विवरण गोपनीयता के लिए छुपाए गए हैं
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
