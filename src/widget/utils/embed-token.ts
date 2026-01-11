import { createHmac } from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export interface EmbedTokenPayload {
  storeId: string;
  slug: string;
  domain?: string; // ✅ Seviye 2: Token hangi domain için verildi (optional for backward compat)
  exp: number; // epoch seconds
}

function base64url(data: string | Buffer): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = 4 - (normalized.length % 4 || 4);
  const padded = normalized + '='.repeat(pad === 4 ? 0 : pad);
  return Buffer.from(padded, 'base64');
}

export class EmbedTokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {
    if (!secret || !secret.length) {
      throw new Error('EMBED_TOKEN_SECRET is not configured');
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('EMBED_TOKEN_TTL_SECONDS must be a positive number');
    }
  }

  sign(payload: Omit<EmbedTokenPayload, 'exp'>): string {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const fullPayload: EmbedTokenPayload = { ...payload, exp };
    const payloadJson = JSON.stringify(fullPayload);
    const payloadB64 = base64url(payloadJson);
    const signature = this.signData(payloadB64);
    return `${payloadB64}.${signature}`;
  }

  verify(token: string): EmbedTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing embed token');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid embed token format');
    }

    const [payloadB64, signature] = parts;
    const expectedSig = this.signData(payloadB64);
    if (!this.timingSafeEqual(signature, expectedSig)) {
      throw new UnauthorizedException('Invalid embed token signature');
    }

    let payload: EmbedTokenPayload;
    try {
      const json = fromBase64url(payloadB64).toString('utf8');
      payload = JSON.parse(json) as EmbedTokenPayload;
    } catch {
      throw new BadRequestException('Malformed embed token payload');
    }

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Embed token expired');
    }

    if (!payload.storeId || !payload.slug) {
      throw new UnauthorizedException('Embed token missing claims');
    }

    return payload;
  }

  private signData(payloadB64: string): string {
    const hmac = createHmac('sha256', this.secret);
    hmac.update(payloadB64);
    return base64url(hmac.digest());
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return aBuf.equals(bBuf);
  }
}
