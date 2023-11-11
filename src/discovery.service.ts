import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
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
  private name: string;
  private version: string;
  private intervalInMilis: number;
  private numberOfretryWhenFailed: number;
  private intervalSubscription: Subscription;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.name = this.configService.get<string>('SERVICE_NAME');
    this.version = this.configService.get<string>('SERVICE_VERSION');
    this.intervalInMilis = this.configService.get<number>(
      'SERVICE_REGISTRY_INTERVAL',
    );
    this.numberOfretryWhenFailed = this.configService.get<number>(
      'SERVICE_REGISTRY_RETRY_WHEN_FAILED',
    );
  }

  async register(port: number) {
    try {
      await this.httpService.axiosRef.put(
        `http://127.0.0.1:3000/${this.name}/${this.version}/${port}`,
      );
      console.log(`registered service ${this.name}:${this.version} at ${port}`);
    } catch (error) {
      console.error(error.message);
    }
  }

  async unregister(port: number) {
    await firstValueFrom(
      this.httpService.delete(
        `http://127.0.0.1:3000/${this.name}/${this.version}/${port}`,
      ),
    );

    console.log(`unregistred service ${this.name}:${this.version} at ${port}`);
  }

  startInterval(port: number): void {
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

  stopInterval(): void {
    if (this.intervalSubscription && !this.intervalSubscription.closed) {
      this.intervalSubscription.unsubscribe();
    }
  }

  async cleanup(port: number) {
    this.stopInterval();
    await this.unregister(port);
  }
}
