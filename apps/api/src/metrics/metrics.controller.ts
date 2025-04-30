import { Controller, Get, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { StakeholderResponseRate, DealPerformanceMetric } from '../types/stakeholder.types';

@Controller('metrics')
export class MetricsController {
    private readonly logger = new Logger(MetricsController.name);

    constructor(private readonly metricsService: MetricsService) {}

    @Get('stakeholders/response-rates')
    async getStakeholderResponseRates(): Promise<Record<string, StakeholderResponseRate>> {
        this.logger.log('Received request for stakeholder response rates');
        return this.metricsService.getStakeholderResponseRates();
    }

    @Get('stakeholders/deal-performance')
    async getStakeholderDealPerformance(): Promise<Record<string, DealPerformanceMetric>> {
        this.logger.log('Received request for stakeholder deal performance metrics');
        return this.metricsService.getDealPerformanceMetrics();
    }
} 