import { Controller, Get, Logger } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(private agentService: AgentService) {}

  @Get('demo')
  async runDemo(): Promise<string> {
    try {
      await this.agentService.runOnce();
      return 'ok';
    } catch (error) {
      this.logger.error(`Demo run failed: ${error.message}`);
      throw error;
    }
  }
} 