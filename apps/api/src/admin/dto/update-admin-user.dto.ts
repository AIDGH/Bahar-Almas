import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  @Matches(/\S/, { message: 'نام و نام خانوادگی نمی‌تواند خالی باشد' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  mobile?: string;

  @IsOptional()
  @IsBoolean()
  isBanned?: boolean;
}
