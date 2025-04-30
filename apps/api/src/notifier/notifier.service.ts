import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Opportunity } from '../types/opportunity';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class NotifierService {
  private readonly logger = new Logger(NotifierService.name);

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async sendSlack(deal: Opportunity): Promise<boolean> {
    const webhookUrl = this.configService.get<string>('SLACK_WEBHOOK');
    
    if (!webhookUrl) {
      this.logger.error('SLACK_WEBHOOK not configured');
      return false;
    }
    
    try {
      const message = {
        text: `:rotating_light: Deal *${deal.Name}* looks cold.\nSuggested action: Follow up NOW.`,
      };
      
      const { data } = await firstValueFrom(
        this.httpService.post(webhookUrl, message).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(
              `Failed to send Slack notification for deal ${deal.Name}: ${error.message}`,
            );
            throw error;
          }),
        ),
      );
      
      this.logger.log(`Slack notification sent for deal ${deal.Name}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending Slack notification: ${error.message}`);
      return false;
    }
  }
} 