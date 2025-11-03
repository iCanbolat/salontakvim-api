import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class InviteStaffDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email: string;
}
