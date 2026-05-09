// ═══════════════════════════════════════════════════════
// FEATURE 2 & 3: Biodata PDF + Print Card Generation
// Generates downloadable PDF biodata and printable marriage card
// ═══════════════════════════════════════════════════════

import { Injectable, NotFoundException, ForbiddenException, Request, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import type { Profile } from '@prisma/client';

/** DB column `alternateMobile`; intersect so PDF code type-checks even if local Prisma types lag `schema.prisma`. */
type ProfileForPdf = Profile & { alternateMobile?: string | null };

// ─── GUARD: supports Bearer header OR ?token= query param ────────────────────
// Standard browser tab / direct link flows cannot set Authorization headers,
// so we fall back to a signed JWT passed as a query parameter.
@Injectable()
class PdfAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Attempt standard Bearer-token auth first.
    try {
      const result = await (super.canActivate(context) as Promise<boolean>);
      if (result) return true;
    } catch {
      // Fall through to query-param fallback.
    }

    // Fallback: verify JWT supplied as ?token=<jwt> query parameter.
    const request = context.switchToHttp().getRequest();
    const token: string | undefined = request.query?.token;
    if (!token) return false;

    try {
      const payload = this.jwtService.verify<{ sub: string; mobile: string; role: string }>(token);
      request.user = { sub: payload.sub, mobile: payload.mobile, role: payload.role };
      return true;
    } catch {
      return false;
    }
  }
}

function escapeHtml(value: unknown): string {
  const s = String(value ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafePhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  // Allow only absolute https/http URLs or local uploads paths.
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/');
}

function glassesDisplay(p: ProfileForPdf): string {
  if (p.glassesType === 'OCCASIONALLY') return 'Occasionally';
  if (p.glassesType === 'YES') return 'Yes';
  if (p.glassesType === 'NO') return 'No';
  return p.glasses ? 'Yes' : 'No';
}

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService) {}

  // ─── GET PROFILE DATA FOR PDF ─────────────────────
  private async getProfileForCaller(id: string, callerId: string, role: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Profile not found');

    // Regular users can only access their own profile biodata.
    if (role === 'USER' && profile.userId !== callerId) {
      throw new ForbiddenException('Not your profile');
    }

    return profile as ProfileForPdf;
  }

  // ─── GENERATE BIODATA HTML ────────────────────────
  async generateBiodataHtml(profileId: string, callerId: string, role: string): Promise<string> {
    const p = await this.getProfileForCaller(profileId, callerId, role);
    const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const safePhotoUrl = isSafePhotoUrl(p.photoUrl) ? p.photoUrl : null;
    const genderLabel = p.gender === 'BRIDE' ? 'Bride (वधू)' : 'Groom (वर)';
    const manglikLabel = p.manglikStatus.replace('_', ' ');
    const marriageLabel = p.marriageStatus.replace('_', ' ');
    const address = [p.address, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '—';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Yatra+One&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Outfit', sans-serif; color: #2D1810; line-height: 1.6; padding: 24px; max-width: 800px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #8B1A1A, #5a0f0f); color: white; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 18px; font-weight: 700; }
    .header .hindi { font-family: 'Yatra One', serif; color: #F5E6B8; font-size: 14px; }
    .header .reg { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px; }
    .om { font-size: 28px; margin-bottom: 8px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 700; color: #8B1A1A; border-bottom: 2px solid #E8651A; padding-bottom: 4px; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .field { margin-bottom: 6px; }
    .field .label { font-size: 11px; color: #7A6355; text-transform: uppercase; letter-spacing: 0.5px; }
    .field .value { font-size: 13px; font-weight: 600; color: #2D1810; }
    .photo-box { float: right; width: 120px; height: 150px; border: 2px solid #D4A017; border-radius: 8px; margin-left: 16px; margin-bottom: 16px; overflow: hidden; }
    .photo-box img { width: 100%; height: 100%; object-fit: cover; }
    .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E8D5C4; font-size: 11px; color: #7A6355; }
    .manglik-yes { color: #dc2626; font-weight: 700; }
    .manglik-no { color: #16a34a; font-weight: 700; }
    @media print { body { padding: 12px; } .header { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="om">ॐ</div>
    <div class="hindi">।। श्री गणेशाय नमः ।।</div>
    <h1>MATRIMONY BIODATA / विवाह बायोडाटा</h1>
    <div class="hindi">मंदिर — गीता कॉलोनी, दिल्ली</div>
    <div class="reg">Registration: ${escapeHtml(p.registrationNumber)}</div>
  </div>

  ${safePhotoUrl ? `<div class="photo-box"><img src="${escapeHtml(safePhotoUrl)}" alt="Photo"></div>` : ''}

  <div class="section">
    <div class="section-title">Personal Details / व्यक्तिगत विवरण</div>
    <div class="grid">
      <div class="field"><div class="label">Full Name / पूरा नाम</div><div class="value">${escapeHtml(p.fullName)}</div></div>
      <div class="field"><div class="label">Gender / लिंग</div><div class="value">${escapeHtml(genderLabel)}</div></div>
      <div class="field"><div class="label">Date of Birth / जन्म तिथि</div><div class="value">${escapeHtml(new Date(p.dateOfBirth).toLocaleDateString('en-IN'))} (Age: ${escapeHtml(age)})</div></div>
      <div class="field"><div class="label">Birth Time / जन्म समय</div><div class="value">${escapeHtml(p.birthTime || '—')}</div></div>
      <div class="field"><div class="label">Birth Place / जन्म स्थान</div><div class="value">${escapeHtml(p.birthPlace || '—')}</div></div>
      <div class="field"><div class="label">Height / ऊँचाई</div><div class="value">${escapeHtml(p.height || '—')} ${escapeHtml(p.heightUnit === 'IN' ? 'in' : p.heightUnit === 'FT' ? 'ft' : 'cm')}</div></div>
      <div class="field"><div class="label">Weight / वज़न</div><div class="value">${escapeHtml(p.weight || '—')} kg</div></div>
      <div class="field"><div class="label">Blood Group</div><div class="value">${escapeHtml(p.bloodGroup || '—')}</div></div>
      <div class="field"><div class="label">Complexion / रंग</div><div class="value">${escapeHtml(p.complexion || '—')}</div></div>
      <div class="field"><div class="label">Manglik / मांगलिक</div><div class="value ${p.manglikStatus === 'MANGLIK' ? 'manglik-yes' : 'manglik-no'}">${escapeHtml(manglikLabel)}</div></div>
      <div class="field"><div class="label">Marriage Status</div><div class="value">${escapeHtml(marriageLabel)}</div></div>
      <div class="field"><div class="label">Diet / खानपान</div><div class="value">${escapeHtml(p.diet || '—')}</div></div>
      <div class="field"><div class="label">Glasses / चश्मा</div><div class="value">${escapeHtml(glassesDisplay(p))}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Education & Profession / शिक्षा एवं व्यवसाय</div>
    <div class="grid">
      <div class="field"><div class="label">Education / शिक्षा</div><div class="value">${escapeHtml(p.education || '—')}</div></div>
      <div class="field"><div class="label">Profession / व्यवसाय</div><div class="value">${escapeHtml(p.profession)}${p.professionDetails ? ` — ${escapeHtml(p.professionDetails)}` : ''}</div></div>
      <div class="field"><div class="label">Monthly Income / मासिक आय</div><div class="value">${p.monthlyIncome ? `₹${escapeHtml(p.monthlyIncome.toLocaleString('en-IN'))}` : '—'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Family Details / पारिवारिक विवरण</div>
    <div class="grid">
      <div class="field"><div class="label">Father / पिता</div><div class="value">${escapeHtml(p.fatherName)}</div></div>
      <div class="field"><div class="label">Mother / माता</div><div class="value">${escapeHtml(p.motherName || '—')}</div></div>
      <div class="field"><div class="label">Contact / संपर्क</div><div class="value">${escapeHtml(p.guardianPhone)}${p.alternateMobile ? `<br>Alt: ${escapeHtml(p.alternateMobile)}` : ''}</div></div>
      <div class="field"><div class="label">Religion / धर्म</div><div class="value">${escapeHtml(p.religion || '—')}</div></div>
      <div class="field"><div class="label">Caste / जाति</div><div class="value">${escapeHtml(p.caste || '—')}</div></div>
      <div class="field"><div class="label">Address / पता</div><div class="value">${escapeHtml(address)}</div></div>
      <div class="field"><div class="label">Brothers / भाई</div><div class="value">${escapeHtml(p.marriedBrothers)} married, ${escapeHtml(p.unmarriedBrothers)} unmarried</div></div>
      <div class="field"><div class="label">Sisters / बहनें</div><div class="value">${escapeHtml(p.marriedSisters)} married, ${escapeHtml(p.unmarriedSisters)} unmarried</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Property / संपत्ति</div>
    <div class="grid">
      <div class="field"><div class="label">House / मकान</div><div class="value">${escapeHtml(p.house || '—')}</div></div>
      <div class="field"><div class="label">Business / व्यापार</div><div class="value">${escapeHtml(p.business || '—')}</div></div>
      <div class="field"><div class="label">Other / अन्य</div><div class="value">${escapeHtml(p.otherProperty || '—')}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Preferences / प्राथमिकता</div>
    <div class="grid">
      <div class="field"><div class="label">Preferred Caste</div><div class="value">${escapeHtml(p.preferredCaste || 'Any')}</div></div>
      <div class="field"><div class="label">Preferred Age</div><div class="value">${p.preferredAgeMin && p.preferredAgeMax ? `${escapeHtml(p.preferredAgeMin)}–${escapeHtml(p.preferredAgeMax)} years` : 'Any'}</div></div>
      <div class="field"><div class="label">Preferred Location</div><div class="value">${escapeHtml(p.preferredLocation || 'Any')}</div></div>
      <div class="field"><div class="label">Preference / वरीयता</div><div class="value">${escapeHtml(p.partnerPreference || '—')}</div></div>
      <div class="field"><div class="label">Preference Details / वरीयता विवरण</div><div class="value">${escapeHtml(p.partnerPreferenceDetails || '—')}</div></div>
    </div>
  </div>

  <div class="footer">
    <p>Generated by RishteNate — Mandir, Geeta Colony, Delhi</p>
    <p style="font-family:'Yatra One',serif; color:#E8651A;">।। जय श्री राम ।।</p>
  </div>
</body>
</html>`;
  }

  // ─── GENERATE PRINT CARD HTML ─────────────────────
  // Compact card format for temple committee printing
  async generatePrintCardHtml(profileId: string, callerId: string, role: string): Promise<string> {
    const p = await this.getProfileForCaller(profileId, callerId, role);
    const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const safePhotoUrl = isSafePhotoUrl(p.photoUrl) ? p.photoUrl : null;
    const manglikLabel = p.manglikStatus.replace('_', ' ');
    const addressCityState = `${p.city || '—'}, ${p.state || ''}`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Yatra+One&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Outfit', sans-serif; color: #2D1810; }
    .card { width: 400px; border: 2px solid #8B1A1A; border-radius: 12px; overflow: hidden; margin: 20px auto; }
    .card-header { background: linear-gradient(135deg, #8B1A1A, #5a0f0f); color: white; padding: 12px 16px; text-align: center; }
    .card-header h2 { font-size: 12px; font-weight: 700; }
    .card-header .hindi { font-family: 'Yatra One', serif; color: #F5E6B8; font-size: 10px; }
    .card-header .reg { background: #E8651A; display: inline-block; padding: 2px 12px; border-radius: 10px; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .card-body { padding: 16px; display: flex; gap: 12px; }
    .photo { width: 80px; height: 100px; border: 2px solid #D4A017; border-radius: 6px; overflow: hidden; flex-shrink: 0; background: #FFF0E0; display: flex; align-items: center; justify-content: center; font-size: 28px; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .info { flex: 1; font-size: 11px; line-height: 1.7; }
    .info .name { font-size: 14px; font-weight: 700; color: #8B1A1A; }
    .info .row { display: flex; gap: 4px; }
    .info .label { color: #7A6355; min-width: 60px; }
    .info .val { font-weight: 600; }
    .card-footer { background: #FFF3EB; padding: 8px 16px; font-size: 10px; text-align: center; color: #7A6355; border-top: 1px solid #E8D5C4; }
    @media print { body { margin: 0; } .card { border: 2px solid #8B1A1A; margin: 8px; page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <h2>ॐ RISHTESETU — MATRIMONY CARD</h2>
      <div class="hindi">मंदिर — गीता कॉलोनी</div>
      <div class="reg">${escapeHtml(p.registrationNumber)}</div>
    </div>
    <div class="card-body">
      <div class="photo">
        ${safePhotoUrl ? `<img src="${escapeHtml(safePhotoUrl)}" alt="Photo">` : 'ॐ'}
      </div>
      <div class="info">
        <div class="name">${escapeHtml(p.fullName)}</div>
        <div class="row"><span class="label">Gender:</span><span class="val">${escapeHtml(p.gender === 'BRIDE' ? 'Bride' : 'Groom')}</span></div>
        <div class="row"><span class="label">Age:</span><span class="val">${escapeHtml(age)} years</span></div>
        <div class="row"><span class="label">DOB:</span><span class="val">${escapeHtml(new Date(p.dateOfBirth).toLocaleDateString('en-IN'))}</span></div>
        <div class="row"><span class="label">Manglik:</span><span class="val" style="color:${p.manglikStatus === 'MANGLIK' ? '#dc2626' : '#16a34a'}">${escapeHtml(manglikLabel)}</span></div>
        <div class="row"><span class="label">Father:</span><span class="val">${escapeHtml(p.fatherName)}</span></div>
        <div class="row"><span class="label">Phone:</span><span class="val">${escapeHtml(p.guardianPhone)}${p.alternateMobile ? ` / ${escapeHtml(p.alternateMobile)}` : ''}</span></div>
        <div class="row"><span class="label">City:</span><span class="val">${escapeHtml(addressCityState)}</span></div>
        <div class="row"><span class="label">Job:</span><span class="val">${escapeHtml(p.profession)}${p.monthlyIncome ? ` — ₹${escapeHtml(p.monthlyIncome.toLocaleString('en-IN'))}/mo` : ''}</span></div>
        <div class="row"><span class="label">Edu:</span><span class="val">${escapeHtml(p.education || '—')}</span></div>
      </div>
    </div>
    <div class="card-footer">Mandir • Geeta Colony, East Delhi — 110031 • ।। जय श्री राम ।।</div>
  </div>
</body>
</html>`;
  }
}

// ─── CONTROLLER ─────────────────────────────────────
@ApiTags('PDF')
@ApiBearerAuth()
@UseGuards(PdfAuthGuard)
@Controller('pdf')
class PdfController {
  constructor(private pdfService: PdfService) {}

  @Get('biodata/:id')
  async downloadBiodata(@Param('id') id: string, @Request() req: { user: { sub: string; role: string } }, @Res() res: Response) {
    const html = await this.pdfService.generateBiodataHtml(id, req.user.sub, req.user.role);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="biodata-${id}.html"`);
    res.send(html);
  }

  @Get('card/:id')
  async downloadCard(@Param('id') id: string, @Request() req: { user: { sub: string; role: string } }, @Res() res: Response) {
    const html = await this.pdfService.generatePrintCardHtml(id, req.user.sub, req.user.role);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="card-${id}.html"`);
    res.send(html);
  }
}

// ─── MODULE ─────────────────────────────────────────
@Module({
  imports: [AuthModule],
  controllers: [PdfController],
  providers: [PdfService, PdfAuthGuard],
  exports: [PdfService],
})
export class PdfModule {}
