export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: 'admin' | 'staff' | 'customer';
    avatar: string | null;
  };
  accessToken: string;
  refreshToken: string;
  needsOnboarding?: boolean;
}

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: 'admin' | 'staff' | 'customer';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}
