import { Injectable, Logger } from '@nestjs/common';
import {
  SmsProvider,
  SmsRegion,
} from '../../interfaces/sms-provider.interface';
import { NetgsmProvider } from './netgsm.provider';
import { PlivoProvider } from './plivo.provider';

/**
 * Resolves the most appropriate SMS provider for a given phone number
 * (or explicit region hint).
 *
 * Routing rules
 * ─────────────
 *  • +90 numbers  →  Netgsm   (Turkish carrier, better cost & delivery)
 *  • Everything else  →  Plivo (global reach)
 *
 * An explicit `SmsRegion` hint can override auto-detection when the
 * caller already knows the store's region.
 */
@Injectable()
export class SmsProviderFactory {
  private readonly logger = new Logger(SmsProviderFactory.name);
  private readonly providers: SmsProvider[];

  constructor(
    private readonly netgsm: NetgsmProvider,
    private readonly plivo: PlivoProvider,
  ) {
    this.providers = [netgsm, plivo];
  }

  /**
   * Return the best provider for the given phone number.
   * An optional `region` hint can force a specific provider.
   */
  resolve(e164Phone: string, region?: SmsRegion): SmsProvider {
    // Explicit region hint takes priority
    if (region === 'TR') {
      return this.netgsm;
    }
    if (region === 'GLOBAL') {
      return this.plivo;
    }

    // Auto-detect from number prefix
    for (const provider of this.providers) {
      if (provider.supportsNumber(e164Phone)) {
        this.logger.debug(
          `Resolved provider "${provider.name}" for ${e164Phone}`,
        );
        return provider;
      }
    }

    // Default fallback → Plivo (widest coverage)
    this.logger.warn(
      `No provider explicitly supports ${e164Phone}, falling back to Plivo`,
    );
    return this.plivo;
  }

  /**
   * Return all registered providers (useful for health-checks, etc.).
   */
  getAll(): SmsProvider[] {
    return [...this.providers];
  }
}
