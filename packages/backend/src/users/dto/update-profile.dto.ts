import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsUrl,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ description: 'User full name' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({ description: 'Company name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Company name cannot exceed 100 characters' })
  companyName?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, {
    message: 'Please provide a valid phone number',
  })
  phone?: string;

  @ApiProperty({ description: 'Business address', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Address cannot exceed 500 characters' })
  address?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  website?: string;
}
