import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsEmail, Min, Matches, IsArray, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export enum DonationTypeEnum {
  REGISTRATION = 'REGISTRATION',
  GENERAL = 'GENERAL',
}

export class CreateDonationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty({ enum: DonationTypeEnum })
  @IsEnum(DonationTypeEnum)
  type!: DonationTypeEnum;

  @ApiProperty({ example: 1100 })
  @IsNumber()
  @Min(1, { message: 'Amount must be at least 1' })
  amount!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  donorName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsString()
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  donorMobile?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  donorEmail?: string;

  @ApiPropertyOptional({ type: [String], description: 'Offline registration split, e.g. CASH + ONLINE' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  splitPaymentMethods?: string[];

  @ApiPropertyOptional({ description: 'Cash portion in rupees (offline split)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  splitCashRupees?: number;

  @ApiPropertyOptional({ description: 'Online portion in rupees (offline split)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  splitOnlineRupees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  splitFreeRupees?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  splitFreeApprovedBy?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  splitFreeReason?: string;

  /** @deprecated Prefer splitCashRupees, splitOnlineRupees, splitPaymentMethods. Kept so older clients are not rejected by validation. */
  @ApiPropertyOptional({
    description:
      'Legacy: JSON string with cashAmount, onlineAmount, paymentMethods, etc. Merged into split* columns when those are omitted.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  donationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gatewayPaymentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gatewayOrderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gatewaySignature!: string;
}

export class ListDonationsQueryDto {
  @ApiPropertyOptional({ enum: DonationTypeEnum })
  @IsEnum(DonationTypeEnum)
  @IsOptional()
  type?: DonationTypeEnum;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value as string) : undefined)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value as string) : undefined)
  @IsNumber()
  limit?: number;
}
