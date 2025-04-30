import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ColdDetectorService } from './cold-detector.service';

@Module({
  imports: [ConfigModule],
  providers: [ColdDetectorService],
  exports: [ColdDetectorService],
})
export class ColdDetectorModule {} 