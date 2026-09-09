import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  mobile!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'کد تأیید باید ۶ رقم باشد' })
  code!: string;
}
