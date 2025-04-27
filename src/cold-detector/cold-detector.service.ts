import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Opportunity } from '../types/opportunity';

@Injectable()
export class ColdDetectorService {
  private readonly logger = new Logger(ColdDetectorService.name);

  constructor(private configService: ConfigService) {}

  detect(opportunities: Opportunity[]): Opportunity[] {
    const coldDays = parseInt(this.configService.get<string>('COLD_DAYS') || '7', 10);
    const stalledDays = parseInt(this.configService.get<string>('STALLED_DAYS') || '10', 10);
    
    this.logger.log(`Detecting cold deals with COLD_DAYS=${coldDays} and STALLED_DAYS=${stalledDays}`);
    
    return opportunities.filter(opportunity => {
      const lastActivityDate = opportunity.LastActivityDate 
        ? new Date(opportunity.LastActivityDate) 
        : null;
      const lastModifiedDate = new Date(opportunity.LastModifiedDate);
      const now = new Date();
      
      // If LastActivityDate is null, consider it as cold
      const daysSinceLastActivity = lastActivityDate
        ? Math.floor((now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
        : Infinity;
        
      const daysSinceLastModified = Math.floor(
        (now.getTime() - lastModifiedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const isCold = daysSinceLastActivity >= coldDays || daysSinceLastModified >= stalledDays;
      
      if (isCold) {
        this.logger.debug(
          `Deal ${opportunity.Name} is cold: ` +
          `daysSinceLastActivity=${daysSinceLastActivity}, ` +
          `daysSinceLastModified=${daysSinceLastModified}`
        );
      }
      
      return isCold;
    });
  }
} 