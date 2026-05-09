import { IsString, IsNotEmpty, Length, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LoginType {
  USER = 'USER',
  TEAM = 'TEAM',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

export class SendOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Mobile number must be 10 digits' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  mobile!: string;

  @ApiProperty({ enum: LoginType, default: LoginType.USER })
  @IsEnum(LoginType)
  @IsOptional()
  loginType?: LoginType = LoginType.USER;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  mobile!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must contain only digits' })
  code!: string;

  @ApiProperty({ enum: LoginType, default: LoginType.USER })
  @IsEnum(LoginType)
  @IsOptional()
  loginType?: LoginType = LoginType.USER;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
