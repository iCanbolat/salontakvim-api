import { IsUrl, IsUUID } from 'class-validator';

export class CreateConnectOnboardingDto {
  @IsUUID()
  storeId!: string;

  @IsUrl({ require_tld: false })
  refreshUrl!: string;

  @IsUrl({ require_tld: false })
  returnUrl!: string;
}
