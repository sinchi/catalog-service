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

  const configService = app.get<ConfigService>(ConfigService);
  const discoveryService = app.get<DiscoveryService>(DiscoveryService);

  const serviceName = configService.get<string>('SERVICE_NAME');
  const serviceVersion = configService.get<string>('SERVICE_VERSION');

  await discoveryService.register(port);
  discoveryService.startInterval(port);

  process.on('uncaughtException', async () => {
    await discoveryService.cleanup(port);
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await discoveryService.cleanup(port);
    process.exit(0);
  });

  console.log(`${serviceName}:${serviceVersion} started at ${port}`);
}
bootstrap();
