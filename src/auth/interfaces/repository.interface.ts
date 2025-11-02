export interface IUserRepository {
  findById(id: number): Promise<any>;
  findByEmail(email: string): Promise<any>;
  findByProviderId(providerId: string, provider: string): Promise<any>;
  create(userData: any): Promise<any>;
  update(id: number, userData: any): Promise<any>;
  updateLastLogin(id: number): Promise<void>;
}

export interface IRefreshTokenRepository {
  create(userId: number, token: string, expiresAt: Date): Promise<any>;
  findByToken(token: string): Promise<any>;
  deleteByToken(token: string): Promise<void>;
  deleteAllByUserId(userId: number): Promise<void>;
}
