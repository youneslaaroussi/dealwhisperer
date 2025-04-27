import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SalesforceModule } from '../salesforce/salesforce.module';
import { ColdDetectorModule } from '../cold-detector/cold-detector.module';
import { NotifierModule } from '../notifier/notifier.module';
import { CronService } from './cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SalesforceModule,
    ColdDetectorModule,
    NotifierModule,
  ],
  providers: [CronService],
})
export class CronModule {} 