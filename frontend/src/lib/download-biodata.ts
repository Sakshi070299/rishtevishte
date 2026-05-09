import { ManglikStatus, Profile, type Profession } from "@/types";

const PROFESSION_LABELS: Record<Profession, string> = {
  PRIVATE_JOB: "Private Job",
  GOVERNMENT_JOB: "Govt. job",
  JOB: "Job",
  BUSINESS: "Business",
  HOMELY: "Homely",
  OTHER: "Other",
};

/** Printable profession + optional details when enum is OTHER. */
function professionDisplayText(p: Profile): string {
  if (p.profession === "OTHER") {
    const d = p.professionDetails?.trim();
    return d || "—";
  }
  return PROFESSION_LABELS[p.profession] ?? p.profession;
}
import { formatDate } from "date-fns";
import { toast } from "sonner";
import { resolvePhotoUrl } from "@/lib/api";
import { formatIncome } from "@/lib/formatIncome";

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


function formatManglikStatus(status?: ManglikStatus | null): string {
  if (!status) return "—";
  const labels: Record<ManglikStatus, string> = {
    MANGLIK: "MANGLIK",
    NON_MANGLIK: "NON-MANGLIK",
    ANSHIK_MANGLIK: "ANSHIK-MANGLIK",
  };
  return labels[status];
}

// function formatValue(
//   value: unknown,
//   suffix?: string
// ): string {
//   if (
//     value === null ||
//     value === undefined ||
//     value === ""
//   ) {
//     return "—";
//   }

//   return suffix ? `${value} ${suffix}` : String(value);
// }

function formatHeightWithUnit(p: Profile): string {
  if (!p.height) return "—";
  return `${p.height} ${p.heightUnit ?? "CM"}`;
}

function glassesDisplay(p: Profile): string {
  if (p.glassesType === "OCCASIONALLY") return "Occasionally";
  if (p.glassesType === "YES") return "Yes";
  if (p.glassesType === "NO") return "No";
  return p.glasses ? "Yes" : "No";
}

function parseIncomeRupees(p: Profile): number | null {
  const raw = p.incomeValue?.trim();
  if (raw && /^\d+$/.test(raw)) return parseInt(raw, 10);
  if (typeof p.monthlyIncome === "number" && p.monthlyIncome > 0) return p.monthlyIncome;
  return null;
}

function incomeCadence(p: Profile): "MONTHLY" | "YEARLY" {
  return p.incomeType === "YEARLY" ? "YEARLY" : "MONTHLY";
}


// function incomeText(p: Profile): string {
//   const cadence = incomeCadence(p) === "YEARLY" ? "Yearly" : "Monthly";
//   const raw = p.incomeValue?.trim();
//   if (raw) {
//     const val = /^\d+$/.test(raw) ? parseInt(raw, 10).toLocaleString("en-IN") : raw;
//     return `${cadence}: ${val}`;
//   }
//   const rupees = parseIncomeRupees(p);
//   if (!rupees) return "—";
//   return `${cadence}: ${rupees.toLocaleString("en-IN")}`;
// }
function incomeText(p: Profile): string {
  const cadence = incomeCadence(p) === "YEARLY" ? "Yearly" : "Monthly";
  const raw = p.incomeValue?.trim();

  if (raw) {
    const val = /^\d+$/.test(raw)
      ? formatIncome(raw)
      : raw;

    return `${cadence}: ${val}`;
  }

  const rupees = parseIncomeRupees(p);
  if (!rupees) return "—";

  return `${cadence}: ${formatIncome(rupees)}`;
}

function professionLineForCard(p: Profile): string {
  const profession = professionDisplayText(p);
  const inc = incomeText(p);
  if (inc === "—") return profession;
  return `${profession} (${inc})`;
}

/** Short form on print card only — partner preference is free text in DB. */
function cardPartnerPreferenceDisplay(v: string | null | undefined): string {
  const t = v?.trim();
  if (!t) return "—";
  if (/^government\s+job$/i.test(t)) return "Govt. job";
  return t;
}

function incomeDisplay(p: Profile): string {
  return incomeText(p);
}



function buildBiodataHTML(p: Profile) {
  const formatValue = (value: unknown, suffix?: string): string => {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return "—";
    }

    if (typeof value === "boolean") {
      return value ? "Yes (हाँ)" : "No (नहीं)";
    }

    return suffix ? `${value} ${suffix}` : String(value);
  };

  function fatherIncomeDisplay(p: Profile): string {
    if (p.fatherIncome === null) return "—";
    const typeText = p.fatherIncomeType === "MONTHLY" ? "मासिक" : "वार्षिक";
    return `${typeText} : ${formatValue(p.fatherIncome)}`;
  }

  const row = (label: string, value?: unknown, suffix?: string) => {
    return `<div class="bio-field">
    <span class="bio-label">${label}</span>
    <span class="bio-val">${formatValue(value, suffix)}</span>
  </div>`;
  };
  // const row = (label: string, value?: string | number | null) =>
  //   value
  //     ? `<div class="bio-field"><span class="bio-label">${label}</span><span class="bio-val">${value}</span></div>`
  //     : "";


  const section = (title: string, rows: string) =>
    rows.trim()
      ? `<h3 class="bio-section-title" style="text-align:center;">${title}</h3><div class="bio-fields-grid">${rows}</div>`
      : "";

  const fallbackAvatar = "/images/fallback.png";
  const avatarSrc = resolvePhotoUrl(p.photoUrl) ?? fallbackAvatar;

  return `<!DOCTYPE html><html dir="ltr"><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>Biodata — ${p.fullName}</title>
  <style>
    @page{size:A4;margin:12mm}
    body{font-family:Arial,sans-serif;margin:0;padding:16px;color:#3D2B1F;max-width:900px;margin:auto;box-sizing:border-box}
    *,*::before,*::after{box-sizing:border-box}
    @media print{
      body{padding:0}
      .bio-fields-grid{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
    .bio-section-title{padding-bottom:2px;color:black;font-size:16px;margin:4px 0 4px;border-bottom:1.5px solid #D4A853;text-align:left;page-break-after:avoid}
    /* Two fields per row: halves side by side */
    .bio-fields-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:0 14px;
      align-items:stretch;
      width:100%;
    }
    /* Each field: label | value as equal columns */
    .bio-field{
      display:grid;
      grid-template-columns:38% 60%;
      gap:8px 10px;
      align-items:start;
      padding:5px 0;
      border-bottom:1px solid #f0e6dc;
      min-width:0;
    }
    .bio-label{color:#7A6355;font-size:12px;word-wrap:break-word;overflow-wrap:break-word;text-align:left;font-weight:600;}
    .bio-val{font-weight:600;color:#3D2B1F;font-size:12px;word-wrap:break-word;overflow-wrap:break-word;text-align:left}
    .bio-avatar{position:absolute;left:5px;width:110px;height:120px;object-fit:cover;border-radius:10px;border:2px solid #D4A853;flex-shrink:0;background:#fff;object-position:top;object-fit:cover;}
    .bio-footer-wrap{margin-top:6px;padding-top:6px;page-break-inside:avoid}
    .bio-footer-box{border:1.5px solid #D4A853;border-radius:8px;overflow:hidden}
    .bio-footer-box-top{padding:2px 10px 2px;font-size:11px;line-height:1.55;color:#3D2B1F}
    .bio-footer-box-bottom{padding:2px 10px 2px;font-weight:800;color:black;font-size:11px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .bio-footer-notes{margin-top:8px;font-size:11px;color:#3D2B1F;line-height:1.5}
    .bio-footer-note-row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start}
    .bio-footer-sign{text-align:right;margin-top:18px;font-size:12px;color:#3D2B1F}
  </style></head><body>
  <div style="border:1.5px solid orange; padding:4px; border-radius:8px;position:relative">
    <div  style="background:orange;background:linear-gradient(135deg,#FFA500,#FFA500);color:white;text-align:center;display:flex;align-items:center;justify-content:space-between;border-radius:8px;padding:5px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <img src="/icons/ram-logo.png" style="width:100px"/>
    <div style="display:flex;flex-direction:column;align-items:center;gap:0px;width:100%;justify-content:start">
    <h2 style="margin:0;font-size:18px;letter-spacing:1px">मंदिर</h2>
    <p style="margin:2px 0 0;font-size:12px;color:#50431c">गीता कॉलोनी, पूर्वी दिल्ली — 110031</p>
    <p style="margin:2px 0 0;font-size:12px;color:#50431c">www.rishtenate.org</p>
    </div>
    </div>
  <div style=" padding:5px">
    <div style="display:flex;gap:20px;align-items:flex-start;padding-left:118px;padding-bottom:26px">
      <img class="bio-avatar" src="${avatarSrc}" alt="" onerror="this.onerror=null;this.src='${fallbackAvatar}'"/>
      <div style="width:100%;">
        <div style="display:flex;gap:10px;align-items:center;">
          <h2 style="margin:0;color:black;font-size:20px">${p.fullName}</h2><span style="color:#7A6355;font-size:13px" >(${p.gender === "BRIDE" ? "वधू" : "वर"})</span>
        </div>
        <div style="display:flex;justify-content:space-between;width:100%;">
        <div style="display:flex;flex-direction:column;">
          <div style="display:flex;gap:10px;align-items:center;margin: 4px 0">
            <p style="margin:0px;color:#7A6355;font-size:13px;font-weight:600;">मांगलिक:</p>
            <span style="font-weight:600; color:#000;margin:0;font-size:13px;">${formatManglikStatus(p.manglikStatus)}</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin: 4px 0"> 
            <p style="margin:0px;color:#7A6355;font-size:13px;font-weight:600;">वैवाहिक स्थिति:</p>
            <span style="font-weight:600; color:#000;margin:0;font-size:13px;">${p.marriageStatus || "—"}</span>
          </div>
        </div>
          <div style="display:flex;justify-content:space-between;flex-direction:column;gap:0px">
            <p style="margin:4px 0;color:#7A6355;font-size:13px;font-weight:600;">रजिस्ट्रेशन नं: <span style="font-weight:600; color:#000;">${p.registrationNumber}</span></p>
            <p style="margin:4px 0;color:#7A6355;font-size:13px;font-weight:600;">रजिस्ट्रेशन दिनांक: <span style="font-weight:600; color:#000;">${fmtDate(p.createdAt)}</span></p>
          </div>
        </div>
      </div>
    </div>
    ${section(
    "विवाह विवरण पत्र (Bio Data)",
    row("पिता का नाम:", p.fatherName) +
    row("फोन नंबर:", p.guardianPhone) +
    row("वैकल्पिक फोन नंबर:", p.alternateMobile) +
    row("ईमेल:", p.guardianEmail) +
    row("घर का वर्तमान पता:", p.address) +
    row("मकान (स्वयं का / किराये का):", p.house) +
    // row("वरीयता विवरण:", p.partnerPreferenceDetails) +
    row("पिता का व्यवसाय:", p.fatherProfession) +
    row("पिता की आय:", fatherIncomeDisplay(p)) +
    row("धर्म:", p.religion) +
    row("जाति:", p.caste),
  )}
    ${section(
    "वर/वधु का विवरण",
    row("जन्मतिथि:", fmtDate(p.dateOfBirth)) +
    row("जन्म समय:", p.birthTime) +
    row("जन्म स्थान:", p.birthPlace) +
    row("कद:", p.height) +
    row("वजन:", p.weight, "kg") +
    row(
      "क्या चश्मा पहनते हैं?:", glassesDisplay(p)) +
    row("रंग:", p.complexion) +
    row("मांगलिक:", formatManglikStatus(p.manglikStatus)) +
    row("आहार:", p.diet) +
    row(
      "दिव्यांगता:", p.disability,) +
    (p.disability === true ? row(
      "दिव्यांगता का विवरण:", p.disabilityDetails,) : '') +
    row("स्वास्थ्य स्थिति:", p.healthStatus) +
    row("अन्य संपत्ति का विवरण:", p.otherProperty) +
    row("व्यवसाय:", professionDisplayText(p)) +
    row("शिक्षा:", p.education) +
    row("आय (Income):", incomeDisplay(p)) +
    row("वरीयता:", p.partnerPreference) +
    row("विदेश में बसना चाहते हैं:", p.wantToSettleAbroad ? "Yes (हाँ)" : "No (नहीं)"),
  )}
    ${section(
    "परिवार का विवरण",
    row("माता का नाम:", p.motherName) +
    row("विवाहित भाई:", p.marriedBrothers) +
    row("अविवाहित भाई:", p.unmarriedBrothers) +
    row("विवाहित बहन:", p.marriedSisters) +
    row("अविवाहित बहन:", p.unmarriedSisters) +
    row("वैवाहिक स्थिति:", p.marriageStatus) +
    (p.marriageStatus === "DIVORCEE" && p.divorceDate
      ? row("विवाह विघ्न दिनांक:", fmtDate(p.divorceDate))
      : "") +
    ((p.marriageStatus === "WIDOW" || p.marriageStatus === "WIDOWER") &&
      p.marriageDate
      ? row("विवाह की तारीख :", fmtDate(p.marriageDate))
      : "") +
    (p.marriageStatus !== "UNMARRIED" && p.childrenDetails
      ? row("बच्चों का विवरण (यदि कोई हो):", p.childrenDetails)
      : ""),
  )}
    <div class="bio-footer-wrap">
      <div class="bio-footer-box">
        <div class="bio-footer-box-top">
          मैं सुझाये गये वर/वधु का सम्बन्ध होने के बाद उठने वाली किसी भी समस्या के लिए मन्दिर की कार्यकारिणी को उत्तरदायी नहीं ठहराऊंगा और सम्बन्ध का पूर्ण उत्तरदायित्व अपने ऊपर लूंगा।
        </div>
        <div class="bio-footer-box-bottom">
          <strong>घोषणा :</strong> मैं घोषणा करता हूँ कि मेरे द्वारा दिया गया उपरोक्त लिखित विवरण सर्वदा सत्य एवं स्पष्ट हैं।
        </div>
      </div>
      <div class="bio-footer-notes">
        <div class="bio-footer-note-row">
          <span>नोट : इस मन्दिर की कार्यकारिणी का काम केवल दोनों परिवारों का आपस में सम्पर्क कराना है। पंजीकरण केवल 6 माह के लिए हैं।</span>
        </div>
        <p style="margin:4px 0 0">इसके अलावा कार्यकारिणी का कोई उत्तरदायित्व नहीं होगा। (रिश्ता करने से पहले आप यथायोग्य जांच-पड़ताल स्वयं करें।)</p>
        <p style="margin:4px 0 0">कार्यकारिणी : श्री गीता कालोनी धार्मिक रामलीला कमेटी (पंजीकृत)</p>
      </div>
    </div>
  </div>
  </div>
  </body></html>`;
}
function downloadBiodata(profile: Profile) {
  const html = buildBiodataHTML(profile);
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Please allow popups to download biodata");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
export const formatCurrencyINR = (amount: number): string => {
  if (amount >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(1)}Cr P/M`;
  } else if (amount >= 1_00_000) {
    return `₹${(amount / 1_00_000).toFixed(1)}L P/M`;
  } else if (amount >= 1_000) {
    return `₹${(amount / 1_000).toFixed(0)}K P/M`;
  } else {
    return `₹${amount} P/M`;
  }
};
function printCard(p: Profile) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>Registration Card — ${p.registrationNumber}</title>
  <style>
    @page{size:A5 landscape;margin:10mm}
    body{font-family:Arial,sans-serif;margin:0;padding:0}
    @media print{
      body{padding:0}
      *{
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style></head><body>
  
  <div  style="border:2px solid orange;border-radius:8px;overflow:hidden;max-width:350px;margin:20px auto;position:relative">
    <div  style="background:orange;background:linear-gradient(135deg,#FFA500,#FFA500);color:white;padding:16px 20px;text-align:center;display:flex;align-items:center;justify-content:space-between;padding:4px 8px;border-radius:4px; margin:4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <img src="/icons/ram-logo.png" style="height:50px"/>
    <div style="display:flex;flex-direction:column;align-items:center;gap:0px;width:100%;justify-content:start">
    <h2 style="margin:0;font-size:14px;letter-spacing:1px">मंदिर</h2>
    <p style="margin:2px 0 0;font-size:10px;color:#50431c">गीता कॉलोनी, पूर्वी दिल्ली — 110031</p>
    <p style="margin:2px 0 0;font-size:10px;color:#50431c">www.rishtenate.org</p>
    </div>
    </div>

    <div style="padding:0 4px;display:flex;gap:8px;align-items:center;padding-bottom:4px;">

    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">

  <div style="position:relative;width:104px;height:125px;">

    ${resolvePhotoUrl(p.photoUrl)
      ? `<img src="${resolvePhotoUrl(p.photoUrl)}" 
          style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:2px solid #D4A853"/>`
      : `<div style="width:100%;height:100%;border-radius:8px;border:2px dashed #E8D5C4;
          display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px">
          Photo
        </div>`
    }

    <!-- Registration Number Overlay -->
    <div style="
      position:absolute;
      bottom:-4px;
      left:0;
      width:100%;
      background:rgba(0,0,0,0.6);
      color:#fff;
      font-size:12px;
      text-align:center;
      padding:4px 2px;
      border-bottom-left-radius:8px;
      border-bottom-right-radius:8px;
      font-weight:600;
    ">
      ${p.registrationNumber}
    </div>

  </div>

  <div style="display:flex;align-items:center;gap:4px;">
    <span style="font-size:8px;color:#7A6355;font-weight:600">
      ${p.createdAt ? formatDate(new Date(p.createdAt), "dd-MM-yyyy") : "—"}
    </span>
    <span style="font-size:8px;color:#7A6355;font-weight:600">/</span>
    <span style="font-size:8px;color:#7A6355;font-weight:600">
      ${p.expiresAt ? formatDate(new Date(p.expiresAt), "dd-MM-yyyy") : "—"}
    </span>
  </div>

</div>
  
      <div style="display:flex;flex-direction:column;gap:4px;width:100%;">
      <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Name:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${p.fullName || "—"}</span>
      </div>
  <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Contact No:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${p.guardianPhone || "—"}</span>
      </div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:center">
  <div style="display:flex;gap:4px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">DOB:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${p.dateOfBirth ? formatDate(new Date(p.dateOfBirth), "dd-MM-yyyy") : "—"}</span>
      </div>
  <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Height:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${formatHeightWithUnit(p)}</span>
      </div>
</div>
  <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Qualification:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${p.education || "—"}</span>
      </div>
  <div style="display:flex;gap:2px;align-items:flex-start">
      <span style="font-size:11px;color:#7A6355;;font-weight:600;flex-shrink:0">Profession:</span>
      <span style="font-size:10px;color:black;font-weight:600;line-height:1.3;word-break:break-word">
      ${professionLineForCard(p)}
      </span>
      </div>
       <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Preference:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${cardPartnerPreferenceDisplay(p.partnerPreference)}</span>
      </div>
 
  <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Manglik:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${formatManglikStatus(p.manglikStatus)}</span>
      </div>
  <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Status:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${p.marriageStatus || "—"}</span>
      </div>

        <div style="display:flex;gap:2px;align-items:center">
      <span style="font-size:11px;color:#7A6355;font-weight:600;">Disability:</span>
      <span style="font-size:10px;color:black;font-weight:600;">${p.disability ? "Yes" : "No"}</span>
      </div>
      </div>
      </div>
      
      </div>
  </div
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Please allow popups to print card");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

export { downloadBiodata, printCard };
