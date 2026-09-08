import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsIn(['login', 'register'])
  mode!: 'login' | 'register';

  @IsString()
  @Length(10, 20)
  mobile!: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  @Matches(/\S/, { message: 'نام نمایشی نمی‌تواند خالی باشد' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(6, 12)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'کد معرف معتبر نیست' })
  referralCode?: string;
}
