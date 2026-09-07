import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(10, 20)
  mobile!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'کد تأیید باید ۶ رقم باشد' })
  code!: string;
}
