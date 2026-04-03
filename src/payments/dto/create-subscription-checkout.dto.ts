import { IsIn, IsOptional, IsUrl, IsUUID } from 'class-validator';

export class CreateSubscriptionCheckoutDto {
  @IsUUID()
  storeId!: string;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;

  @IsOptional()
  @IsIn(['pro', 'business'])
  plan?: 'pro' | 'business';
}
