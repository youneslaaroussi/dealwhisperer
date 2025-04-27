import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NotifierService } from './notifier.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [NotifierService],
  exports: [NotifierService],
})
export class NotifierModule {} 