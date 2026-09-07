import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class GameHitDto {
  @IsInt()
  @Min(1)
  targetId!: number;

  @IsInt()
  @Min(0)
  @Max(200_000)
  hitAtMs!: number;

  @IsNumber()
  @Min(0)
  @Max(5_000)
  swipeDistance!: number;

  @IsInt()
  @Min(0)
  @Max(5_000)
  swipeDurationMs!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  gestureId?: number;
}

export class FinishGameDto {
  @IsArray()
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => GameHitDto)
  hits!: GameHitDto[];

  @IsOptional()
  @IsBoolean()
  endedEarly?: boolean;
}
