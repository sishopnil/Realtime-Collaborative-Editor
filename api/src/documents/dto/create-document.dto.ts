import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty()
  @IsMongoId()
  workspaceId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty()
  @IsMongoId()
  ownerId!: string;
}

