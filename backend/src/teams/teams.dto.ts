import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsOptional, IsObject, IsEnum, IsArray, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateProfileDto } from '../profiles/profiles.dto';
import { ProfileStatus } from '@prisma/client';

export enum OfflinePaymentMethod {
  CASH = 'CASH',
  FREE = 'FREE',
  ONLINE = 'ONLINE',
}

// Reuse UpdateProfileDto — team can edit same fields as user
export class TeamEditProfileDto extends UpdateProfileDto { }

export class ToggleSettledDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  settled!: boolean;
}

export class TeamUpdateStatusDto {
  @ApiProperty({ enum: ProfileStatus, example: ProfileStatus.ACTIVE })
  @IsEnum(ProfileStatus)
  status!: ProfileStatus;
}

export class TeamSearchQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() name?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() mobile?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() registrationNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() registrationDate?: string;
  @ApiPropertyOptional({ enum: ['all', 'today', 'weekly', 'monthly', 'custom'] })
  @IsString()
  @IsOptional()
  @IsIn(['all', 'today', 'weekly', 'monthly', 'custom'])
  datePreset?: 'all' | 'today' | 'weekly' | 'monthly' | 'custom';
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() gender?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
  // @ApiPropertyOptional({ enum: ['today', 'weekly', 'custom'] })
  // @IsOptional()
  // @IsIn(['today', 'weekly', 'custom'])
  // datePreset?: 'today' | 'weekly' | 'custom';
  /** YYYY-MM-DD */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dateFrom?: string;
  /** YYYY-MM-DD */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dateTo?: string;

  /** ONLINE / OFFLINE */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  registrationSource?: string;

  /** MANGLIK / NON_MANGLIK / ANSHIK_MANGLIK */
  @ApiPropertyOptional({ enum: ['MANGLIK', 'NON_MANGLIK', 'ANSHIK_MANGLIK'] })
  @IsOptional()
  @IsIn(['MANGLIK', 'NON_MANGLIK', 'ANSHIK_MANGLIK'])
  manglik?: 'MANGLIK' | 'NON_MANGLIK' | 'ANSHIK_MANGLIK';

  /** YES / NO */
  @ApiPropertyOptional({ enum: ['YES', 'NO'] })
  @IsOptional()
  @IsIn(['YES', 'NO'])
  disability?: 'YES' | 'NO';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ageMin?: string;
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ageMax?: string;

  @ApiPropertyOptional({ enum: ['CM', 'IN', 'FT'] })
  @IsOptional()
  @IsIn(['CM', 'IN', 'FT'])
  heightUnit?: 'CM' | 'IN' | 'FT';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heightMin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  heightMax?: string;

  /** Comma-separated: SINGLE,DIVORCED,WIDOWED,WIDOWER */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  marriage?: string;

  /** LATEST | OLDEST | AGE_ASC | AGE_DESC */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sort?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() page?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() limit?: string;
  // @ApiPropertyOptional({ enum: ['LATEST', 'OLDEST', 'AGE_ASC', 'AGE_DESC'] })
  // @IsString()
  // @IsOptional()
  // @IsIn(['LATEST', 'OLDEST', 'AGE_ASC', 'AGE_DESC'])
  // sort?: 'LATEST' | 'OLDEST' | 'AGE_ASC' | 'AGE_DESC';
  /** Order profiles by `updatedAt`: newest/oldest profile edits first. */
  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort by profile updatedAt' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortUpdatedAt?: 'asc' | 'desc';
}

export class TeamCreateProfileDto {
  @ApiProperty({ description: 'Full profile data (same fields as self-registration)' })
  @IsObject()
  profileData!: Record<string, any>;

  @ApiPropertyOptional({
    enum: OfflinePaymentMethod,
    isArray: true,
    description: 'Payment methods for offline registration (can be CASH+ONLINE, or FREE only)',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(OfflinePaymentMethod, { each: true })
  paymentMethods?: OfflinePaymentMethod[];

  // Backward compatibility (old clients may send single paymentMethod)
  @ApiPropertyOptional({ enum: OfflinePaymentMethod, description: 'Single payment method (legacy)' })
  @IsEnum(OfflinePaymentMethod)
  @IsOptional()
  paymentMethod?: OfflinePaymentMethod;

  @ApiPropertyOptional({
    description: 'Optional payment metadata. Saved into donation split columns (splitCashRupees, etc.) where applicable.',
  })
  @IsObject()
  @IsOptional()
  paymentDetails?: {
    cashCollectedBy?: string;
    cashReceiptNo?: string;
    cashAmount?: number;
    onlineProvider?: string;
    onlineRefNo?: string;
    onlineAmount?: number;
    freeAmount?: number;
    freeApprovedBy?: string;
    freeReason?: string;
  };

}
