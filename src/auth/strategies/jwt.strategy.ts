import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../repositories/user.repository';
import { JwtPayload } from '../interfaces/auth.interface';
import { DRIZZLE_ORM } from '../../db/drizzle.module';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userRepository: UserRepository,
    @Inject(DRIZZLE_ORM) private readonly db: any,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', 'your-secret-key'),
    });
  }

  async validate(payload: JwtPayload) {
    // Get user from database
    const user = await this.userRepository.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const result: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // For staff or manager, get their store and location info
    if (user.role === 'staff' || user.role === 'manager') {
      const [staffMember] = await this.db
        .select()
        .from(schema.staffMembers)
        .where(eq(schema.staffMembers.userId, user.id))
        .limit(1);

      if (staffMember) {
        result.storeId = staffMember.storeId;
        if (user.role === 'manager' && staffMember.locationId) {
          result.locationId = staffMember.locationId;
        }
      }
    }

    return result;
  }
}
