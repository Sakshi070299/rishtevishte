import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyAccessPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accessPaymentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gatewayOrderId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gatewayPaymentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gatewaySignature!: string;
}
