import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsEnum,
} from 'class-validator';
import {
  Message,
  OutputFormat,
  FormatOptions,
} from '@lov3kaizen/agentsea-core';

/**
 * DTO for executing an agent
 */
export class ExecuteAgentDto {
  @IsString()
  input!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsObject()
  sessionData?: Record<string, any>;

  @IsOptional()
  @IsArray()
  history?: Message[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsEnum(['text', 'markdown', 'html', 'react'])
  outputFormat?: OutputFormat;

  @IsOptional()
  @IsObject()
  formatOptions?: FormatOptions;
}
