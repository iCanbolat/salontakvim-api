export interface IUserRepository {
  findById(id: string): Promise<any>;
  findByEmail(email: string): Promise<any>;
  findByProviderId(providerId: string, provider: string): Promise<any>;
  create(userData: any): Promise<any>;
  update(id: string, userData: any): Promise<any>;
  updateLastLogin(id: string): Promise<void>;
}

export interface IRefreshTokenRepository {
  create(userId: string, token: string, expiresAt: Date): Promise<any>;
  findByToken(token: string): Promise<any>;
  deleteByToken(token: string): Promise<void>;
  deleteAllByUserId(userId: string): Promise<void>;
}
