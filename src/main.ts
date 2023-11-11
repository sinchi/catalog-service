import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AddressInfo } from 'net';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from './discovery.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  const server = await app.listen(0);
  const { port } = server.address() as AddressInfo;

  const discoveryService = app.get<DiscoveryService>(DiscoveryService);
  await discoveryService.start(port);

  const configService = app.get<ConfigService>(ConfigService);
  const serviceName = configService.get<string>('SERVICE_NAME');
  const serviceVersion = configService.get<string>('SERVICE_VERSION');

  console.log(`${serviceName}:${serviceVersion} started at ${port}`);
}
bootstrap();
