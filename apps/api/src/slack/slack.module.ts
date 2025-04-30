import { Module } from '@nestjs/common';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { AgentModule } from '../agent/agent.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    AgentModule,
    SupabaseModule,
    MetricsModule
  ],
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService] // Export SlackService so DealsModule can use it
})
export class SlackModule {} 