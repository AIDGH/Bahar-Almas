import { IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @Length(2, 40)
  @Matches(/\S/, { message: 'نام نمایشی نمی‌تواند خالی باشد' })
  displayName!: string;
}
