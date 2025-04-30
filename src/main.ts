import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    const app = await NestFactory.create(AppModule, {
      rawBody: true,
    });
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`Application running on port ${port}`);
  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`);
  }
}
bootstrap();
