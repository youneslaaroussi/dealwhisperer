import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SalesforceModule } from './salesforce/salesforce.module';
import { ColdDetectorModule } from './cold-detector/cold-detector.module';
import { NotifierModule } from './notifier/notifier.module';
import { CronModule } from './cron/cron.module';
import { AgentModule } from './agent/agent.module';
import { AppController } from './app.controller';
import { DealsModule } from './deals/deals.module';
import { SlackModule } from './slack/slack.module';
import { SupabaseModule } from './supabase/supabase.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MetricsModule } from './metrics/metrics.module';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    SalesforceModule,
    ColdDetectorModule,
    NotifierModule,
    CronModule,
    AgentModule,
    DealsModule,
    SlackModule,
    DashboardModule,
    MetricsModule,
    S3Module,
  ],
  controllers: [AppController],
})
export class AppModule {}
