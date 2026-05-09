import { IsString, IsNotEmpty, IsNumber, IsOptional, Matches, Min, Max, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTeamMemberDto {
  @ApiProperty({ example: 'Ram Sewak' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  mobile!: string;
}

export class UpdateSettingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  label?: string;
}

export class UpdateWeeklyLimitDto {
  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @Max(50)
  limit!: number;
}

export class AddGalleryImageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  titleHi?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;
}

export class AddBannerDto {
  @ApiProperty({ example: 'Summer Matrimony Event' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'गर्मी का विवाह उत्सव' })
  @IsString()
  @IsOptional()
  titleHi?: string;

  @ApiProperty({ example: 'https://cdn.example.com/banner.jpg' })
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiPropertyOptional({ example: 'https://example.com/event' })
  @IsString()
  @IsOptional()
  linkUrl?: string;
}

export class AddManagerDto {
  @ApiProperty({ example: 'Suresh Kumar' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '7777777777' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  mobile!: string;
}
