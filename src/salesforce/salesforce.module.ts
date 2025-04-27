import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [ConfigModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {} 