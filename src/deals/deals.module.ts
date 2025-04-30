import { Module } from '@nestjs/common';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { SlackModule } from '../slack/slack.module';
import { SalesforceModule } from '../salesforce/salesforce.module';

@Module({
  imports: [
    SlackModule,
    SalesforceModule
  ],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService]
})
export class DealsModule {} 