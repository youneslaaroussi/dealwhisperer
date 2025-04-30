import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Controller } from './s3.controller';
import { S3Service } from './s3.service';

@Module({
  imports: [
    ConfigModule, // Make ConfigService available
  ],
  controllers: [S3Controller],
  providers: [S3Service],
  exports: [S3Service] // Export if needed by other modules
})
export class S3Module {} 