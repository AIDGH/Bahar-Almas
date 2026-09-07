import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Length(10, 20)
  mobile!: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  @Matches(/\S/, { message: 'نام نمایشی نمی‌تواند خالی باشد' })
  displayName?: string;
}
