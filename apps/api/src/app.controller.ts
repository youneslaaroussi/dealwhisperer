import { Controller, Get } from '@nestjs/common';
import { SalesforceService } from './salesforce/salesforce.service';

@Controller()
export class AppController {
  constructor(
    private readonly salesforceService: SalesforceService,
  ) { }

  @Get('debug/run-once')
  async runOnce() {
    await this.salesforceService.init();
    const opportunities = await this.salesforceService.getActiveOpportunities();
    return opportunities;
  }
}
