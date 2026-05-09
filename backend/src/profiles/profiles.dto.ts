import {
  IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsBoolean, IsDateString,
  Matches, Min, Max, MinLength, MaxLength, ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum GenderEnum {
  BRIDE = 'BRIDE',
  GROOM = 'GROOM',
}

export enum ManglikStatusEnum {
  MANGLIK = 'MANGLIK',
  NON_MANGLIK = 'NON_MANGLIK',
  ANSHIK_MANGLIK = 'ANSHIK_MANGLIK',
}

export enum MarriageStatusEnum {
  UNMARRIED = 'UNMARRIED',
  DIVORCEE = 'DIVORCEE',
  WIDOW = 'WIDOW',
  WIDOWER = 'WIDOWER',
}

export enum ProfessionEnum {
  PRIVATE_JOB = 'PRIVATE_JOB',
  GOVERNMENT_JOB = 'GOVERNMENT_JOB',
  JOB = 'JOB',
  BUSINESS = 'BUSINESS',
  HOMELY = 'HOMELY',
  OTHER = 'OTHER',
}

export enum HeightUnitEnum {
  CM = 'CM',
  IN = 'IN',
  FT = 'FT',
}

export class CreateProfileDto {
  // ── Required fields ──────────────────────────────

  @ApiProperty({ enum: GenderEnum })
  @IsEnum(GenderEnum)
  gender!: GenderEnum;

  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-zA-Z\s.'\-]+$/, { message: 'Name must contain only letters, spaces, dots, or hyphens' })
  fullName!: string;

  @ApiProperty({ example: '1998-05-15T00:00:00.000Z' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: 'Rajesh Sharma' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-zA-Z\s.'\-]+$/, { message: 'Name must contain only letters, spaces, dots, or hyphens' })
  fatherName!: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  guardianPhone!: string;

  @ApiPropertyOptional({ example: '9123456789' })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.alternateMobile !== undefined && o.alternateMobile !== '')
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  alternateMobile?: string;

  // ── Optional basic details ───────────────────────

  @ApiPropertyOptional() @IsString() @IsOptional() birthTime?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() birthPlace?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  @ValidateIf((o) => o.height !== undefined && o.height !== '')
  @Matches(/^\d+(\.\d+)?$/, { message: 'Height must be a number' })
  height?: string;

  @ApiPropertyOptional({ enum: HeightUnitEnum, default: HeightUnitEnum.CM })
  @IsEnum(HeightUnitEnum)
  @IsOptional()
  heightUnit?: HeightUnitEnum;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  @ValidateIf((o) => o.weight !== undefined && o.weight !== '')
  @Matches(/^\d+$/, { message: 'Weight must be a number' })
  weight?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() bloodGroup?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() complexion?: string;

  @ApiPropertyOptional({ enum: ManglikStatusEnum })
  @IsEnum(ManglikStatusEnum)
  @IsOptional()
  manglikStatus?: ManglikStatusEnum;

  @ApiPropertyOptional({ enum: MarriageStatusEnum })
  @IsEnum(MarriageStatusEnum)
  @IsOptional()
  marriageStatus?: MarriageStatusEnum;

  // ── Disability ───────────────────────────────────

  @ApiPropertyOptional() @IsBoolean() @IsOptional() disability?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) disabilityDetails?: string;

  // ── Divorce details ──────────────────────────────

  @ApiPropertyOptional() @IsDateString() @IsOptional() divorceDate?: string;
  @ApiPropertyOptional()
  @ValidateIf((o) => o.marriageDate != null && o.marriageDate !== '')
  @IsDateString()
  @IsOptional()
  marriageDate?: string | null;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) childrenDetails?: string;

  // ── Education & Profession ───────────────────────

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) education?: string;

  @ApiPropertyOptional({ enum: ProfessionEnum })
  @IsEnum(ProfessionEnum)
  @IsOptional()
  profession?: ProfessionEnum;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) professionDetails?: string;

  @ApiPropertyOptional()
  @IsNumber() @IsOptional()
  @Min(0) @Max(10000000)
  monthlyIncome?: number;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'YEARLY'] })
  @IsString()
  @IsOptional()
  @Matches(/^(MONTHLY|YEARLY)$/, { message: 'incomeType must be MONTHLY or YEARLY' })
  incomeType?: string;

  @ApiPropertyOptional({ description: 'Flexible income text, e.g. 10 Lakh' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  incomeValue?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) fatherProfession?: string;

  @ApiPropertyOptional({ enum: ['MONTHLY', 'YEARLY'] })
  @IsString()
  @IsOptional()
  @Matches(/^(MONTHLY|YEARLY)$/, { message: 'fatherIncomeType must be MONTHLY or YEARLY' })
  fatherIncomeType?: string;

  @ApiPropertyOptional({ description: 'Flexible father income text, e.g. 50k / 5 Lakh' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  fatherIncome?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) religion?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) caste?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional() glasses?: boolean;
  @ApiPropertyOptional({ enum: ['YES', 'NO', 'OCCASIONALLY'] })
  @IsString()
  @IsOptional()
  @Matches(/^(YES|NO|OCCASIONALLY)$/, { message: 'glassesType must be YES, NO, or OCCASIONALLY' })
  glassesType?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() diet?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) healthStatus?: string;

  // ── Family details ───────────────────────────────

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  @ValidateIf((o) => o.motherName !== undefined && o.motherName !== '')
  @Matches(/^[a-zA-Z\s.'\-]+$/, { message: 'Name must contain only letters, spaces, dots, or hyphens' })
  motherName?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() guardianEmail?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) address?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) state?: string;

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  @ValidateIf((o) => o.pincode !== undefined && o.pincode !== '')
  @Matches(/^\d{6}$/, { message: 'Pincode must be 6 digits' })
  pincode?: string;

  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Max(20) marriedBrothers?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Max(20) unmarriedBrothers?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Max(20) marriedSisters?: number;
  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0) @Max(20) unmarriedSisters?: number;

  // ── Property ─────────────────────────────────────

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) house?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) business?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) otherProperty?: string;

  // ── Partner Preferences ──────────────────────────

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) preferredCaste?: string;

  @ApiPropertyOptional()
  @IsNumber() @IsOptional()
  @Min(18) @Max(100)
  preferredAgeMin?: number;

  @ApiPropertyOptional()
  @IsNumber() @IsOptional()
  @Min(18) @Max(100)
  preferredAgeMax?: number;

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) preferredLocation?: string;

  @ApiPropertyOptional({
    description: 'Partner work preference (वरीयता), e.g. Service (Job), Business, Homely, Suitable',
  })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  partnerPreference?: string;

  @ApiPropertyOptional({
    description: 'Partner preference details (वरीयता विवरण)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  partnerPreferenceDetails?: string;

  @ApiPropertyOptional({ description: 'Want to settle abroad (Yes/No)' })
  @IsBoolean()
  @IsOptional()
  wantToSettleAbroad?: boolean;

  // ── Photo ────────────────────────────────────────

  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(500) photoUrl?: string;
  @ApiPropertyOptional({ description: 'Internal temple/offline registration reference number' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  internalRegistrationNo?: string;

  /** Staff-only: backdate registration (maps to Profile.createdAt). */
  @ApiPropertyOptional({ example: '2025-12-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  createdAt?: string;
}

export class UpdateProfileDto extends PartialType(CreateProfileDto) { }



