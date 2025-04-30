import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SalesforceService } from '../salesforce/salesforce.service';
import { ColdDetectorService } from '../cold-detector/cold-detector.service';
import { NotifierService } from '../notifier/notifier.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private salesforceService: SalesforceService,
    private coldDetectorService: ColdDetectorService,
    private notifierService: NotifierService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async detectColdDeals() {
    this.logger.log('Starting cold deal detection job');
    
    try {
      // Get active opportunities from Salesforce
      const result = await this.salesforceService.getActiveOpportunities();
      this.logger.log(`Retrieved ${result.records.length} active opportunities`);
      
      // Detect cold deals
      const coldDeals = this.coldDetectorService.detect(result.records);
      this.logger.log(`Detected ${coldDeals.length} cold deals`);
      
      // Send Slack notifications for each cold deal
      for (const deal of coldDeals) {
        await this.notifierService.sendSlack(deal);
      }
      
      this.logger.log('Cold deal detection job completed successfully');
    } catch (error) {
      this.logger.error(`Cold deal detection job failed: ${error.message}`);
    }
  }
} 