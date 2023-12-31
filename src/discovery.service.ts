import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  Subscription,
  firstValueFrom,
  interval,
  retry,
  switchMap,
  throwError,
} from 'rxjs';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscoveryService {
  private url: string;
  private name: string;
  private version: string;
  private intervalInMilis: number;
  private numberOfretryWhenFailed: number;
  private intervalSubscription: Subscription;
  private logger = new Logger('DiscoveryService');

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.url = `
      ${this.configService.get<string>(
        'SERVICE_PROTOCOL',
      )}://${this.configService.get<string>(
        'SERVICE_HOST',
      )}:${this.configService.get<number>('SERVICE_PORT')}`;

    this.name = this.configService.get<string>('SERVICE_NAME');
    this.version = this.configService.get<string>('SERVICE_VERSION');
    this.intervalInMilis = this.configService.get<number>(
      'SERVICE_REGISTRY_INTERVAL',
    );
    this.numberOfretryWhenFailed = this.configService.get<number>(
      'SERVICE_REGISTRY_RETRY_WHEN_FAILED',
    );
  }

  private async register(port: number) {
    try {
      await this.httpService.axiosRef.put(
        `${this.url}/${this.name}/${this.version}/${port}`,
      );
      this.logger.log(
        `registered service ${this.name}:${this.version} at ${port}`,
      );
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  private async unregister(port: number) {
    await firstValueFrom(
      this.httpService.delete(
        `${this.url}/${this.name}/${this.version}/${port}`,
      ),
    );

    this.logger.log(
      `unregistred service ${this.name}:${this.version} at ${port}`,
    );
  }

  private startInterval(port: number): void {
    this.intervalSubscription = interval(this.intervalInMilis)
      .pipe(
        switchMap(() => {
          try {
            return this.register(port);
          } catch (error) {
            throwError(() => error);
          }
        }),
        retry(this.numberOfretryWhenFailed),
      )
      .subscribe();
  }

  private stopInterval(): void {
    if (this.intervalSubscription && !this.intervalSubscription.closed) {
      this.intervalSubscription.unsubscribe();
    }
  }

  private async cleanup(port: number) {
    this.stopInterval();
    await this.unregister(port);
  }

  async start(port: number) {
    await this.register(port);
    this.startInterval(port);

    process.on('uncaughtException', async () => {
      await this.cleanup(port);
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      await this.cleanup(port);
      process.exit(0);
    });
  }
}
