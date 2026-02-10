export type UserRole = 'admin' | 'manager' | 'staff' | 'customer';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    avatar: string | null;
  };
  accessToken: string;
  refreshToken: string;
  needsOnboarding?: boolean;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  storeId?: string; // for staff/manager - their associated store
  locationId?: string; // for manager - their scoped location
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}
