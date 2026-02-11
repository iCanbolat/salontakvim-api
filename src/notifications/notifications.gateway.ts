import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { StoreRepository } from '../stores/repositories/store.repository';
import { StaffMemberRepository } from '../staff/repositories/staff-member.repository';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/notifications',
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly storeRepository: StoreRepository,
    private readonly staffMemberRepository: StaffMemberRepository,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (typeof client.handshake.auth?.token === 'string'
          ? client.handshake.auth.token
          : undefined) ||
        (typeof client.handshake.headers.authorization === 'string'
          ? client.handshake.headers.authorization
          : undefined);

      if (!token) {
        this.logger.warn('Socket connection rejected: missing token');
        client.disconnect();
        return;
      }

      const cleanToken = token.replace('Bearer ', '');
      const payload = await this.jwtService.verifyAsync(cleanToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      const role = payload.role;
      client.data.userId = userId;
      client.data.role = role;
      client.join(`user_${userId}`);

      const storeIds = await this.resolveStoreIds(userId, role);
      storeIds.forEach((storeId) => client.join(`store_${storeId}`));

      this.logger.debug(
        `Socket connected for user_${userId}${
          storeIds.length ? ` stores: ${storeIds.join(',')}` : ''
        }`,
      );
    } catch (error) {
      this.logger.warn(`Socket connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.userId) {
      this.logger.debug(`Socket disconnected for user_${client.data.userId}`);
    }
  }

  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user_${userId}`).emit(event, data);
  }

  sendToStore(storeId: string, event: string, data: unknown) {
    this.server.to(`store_${storeId}`).emit(event, data);
  }

  private async resolveStoreIds(userId: string, role?: string) {
    if (role === 'admin') {
      const store = await this.storeRepository.findByOwnerId(userId);
      return store ? [store.id] : [];
    }

    if (role === 'manager' || role === 'staff') {
      const staff = await this.staffMemberRepository.findByUserId(userId);
      return staff ? [staff.storeId] : [];
    }

    return [];
  }
}
