import { Controller, Get, Logger, Module, Injectable } from '@nestjs/common';
import { DealsService } from '../deals/deals.service';
import { SlackService } from '../slack/slack.service';
import { DealsModule } from '../deals/deals.module';
import { SlackModule } from '../slack/slack.module';
import { ParsedDeal } from '../types/deal.types';
import { ActiveSlackThread } from '../types/slack.types';

// --- Dashboard Service ---
@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(
        private readonly dealsService: DealsService,
        private readonly slackService: SlackService
    ) {}

    async getDashboardData(): Promise<{
        latestStaleDeals: ParsedDeal[];
        activeThreads: ActiveSlackThread[];
        activeThreadsCount: number;
    }> {
        this.logger.log('Fetching dashboard data...');
        try {
            const [latestDeals, activeThreads, activeThreadsCount] = await Promise.all([
                this.dealsService.getLatestStaleDeals(),
                this.slackService.getActiveThreads(),
                this.slackService.getActiveThreadsCount()
            ]);
            this.logger.log('Dashboard data fetched successfully.');
            return {
                latestStaleDeals: latestDeals,
                activeThreads: activeThreads,
                activeThreadsCount: activeThreadsCount
            };
        } catch (error) {
            this.logger.error(`Error fetching dashboard data: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getLatestStaleDeals(): Promise<ParsedDeal[]> {
        return this.dealsService.getLatestStaleDeals();
    }

    async getActiveThreads(): Promise<ActiveSlackThread[]> {
        return this.slackService.getActiveThreads();
    }

    async getActiveThreadsCount(): Promise<{ count: number }> {
        return { count: await this.slackService.getActiveThreadsCount() };
    }
}

// --- Dashboard Controller ---
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get()
    async getAllDashboardData() {
        return this.dashboardService.getDashboardData();
    }

    @Get('latest-stale-deals')
    async getLatestStaleDeals() {
        return this.dashboardService.getLatestStaleDeals();
    }

    @Get('active-threads')
    async getActiveThreads() {
        return this.dashboardService.getActiveThreads();
    }

    @Get('active-threads/count')
    async getActiveThreadsCount() {
        return this.dashboardService.getActiveThreadsCount();
    }
}

// --- Dashboard Module ---
@Module({
  imports: [
      DealsModule,
      SlackModule
    ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {} 