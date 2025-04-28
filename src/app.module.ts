import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SalesforceModule } from './salesforce/salesforce.module';
import { ColdDetectorModule } from './cold-detector/cold-detector.module';
import { NotifierModule } from './notifier/notifier.module';
import { CronModule } from './cron/cron.module';
import { AgentModule } from './agent/agent.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SalesforceModule,
    ColdDetectorModule,
    NotifierModule,
    CronModule,
    AgentModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
