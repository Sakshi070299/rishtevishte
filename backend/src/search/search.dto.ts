import { IsString, IsEnum, IsNumber, IsOptional, IsBoolean, IsArray, Min, Max, Matches, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export enum GenderEnum {
  BRIDE = 'BRIDE',
  GROOM = 'GROOM',
}

export enum ManglikEnum {
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

export class SearchFiltersDto {
  @ApiPropertyOptional({ enum: GenderEnum })
  @IsEnum(GenderEnum)
  @IsOptional()
  gender?: GenderEnum;

  @ApiPropertyOptional({ enum: ManglikEnum })
  @IsEnum(ManglikEnum)
  @IsOptional()
  manglikStatus?: ManglikEnum;

  @ApiPropertyOptional({ enum: MarriageStatusEnum })
  @IsEnum(MarriageStatusEnum)
  @IsOptional()
  marriageStatus?: MarriageStatusEnum;

  @ApiPropertyOptional({ enum: ProfessionEnum })
  @IsEnum(ProfessionEnum)
  @IsOptional()
  profession?: ProfessionEnum;

  @ApiPropertyOptional({ example: 21 })
  @IsNumber()
  @IsOptional()
  @Min(18)
  @Max(100)
  @Type(() => Number)
  ageMin?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsNumber()
  @IsOptional()
  @Min(18)
  @Max(100)
  @Type(() => Number)
  ageMax?: number;

  @ApiPropertyOptional({ enum: HeightUnitEnum })
  @IsEnum(HeightUnitEnum)
  @IsOptional()
  heightUnit?: HeightUnitEnum;

  @ApiPropertyOptional({
    description:
      'Legacy: single height in heightUnit (±0.5 cm). Ignored if heightMin or heightMax is set.',
    example: 5.5,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  height?: number;

  @ApiPropertyOptional({
    description: 'Minimum height in heightUnit (inclusive). Works with any profile unit (converted to cm).',
    example: 5.1,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  heightMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum height in heightUnit (inclusive). Works with any profile unit (converted to cm).',
    example: 5.5,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  heightMax?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  caste?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Filter by multiple states' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  states?: string[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  incomeMin?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  incomeMax?: number;

  // @ApiPropertyOptional({ description: 'Height numeric value as text' })
  // @IsString()
  // @IsOptional()
  // @ValidateIf((o) => o.height !== undefined && o.height !== '')
  // @Matches(/^\d+(\.\d+)?$/, { message: 'Height must be a number' })
  // height?: string;

  // @ApiPropertyOptional({ enum: HeightUnitEnum, default: HeightUnitEnum.FT })
  // @IsEnum(HeightUnitEnum)
  // @IsOptional()
  // heightUnit?: HeightUnitEnum;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  disability?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;
}
