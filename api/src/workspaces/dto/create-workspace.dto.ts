import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, Matches, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'slug must be unique and url-safe' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiProperty({ description: 'Owner user id' })
  @IsMongoId()
  ownerId!: string;
}

