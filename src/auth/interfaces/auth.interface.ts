export interface AuthResponse {
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: 'admin' | 'staff' | 'customer';
    paymentStatus: 'freemium' | 'paid';
    avatar: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: number; // user id
  email: string;
  role: 'admin' | 'staff' | 'customer';
}

export interface RefreshTokenPayload {
  sub: number;
  tokenId: number;
}
