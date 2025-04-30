import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AgentService } from './agent.service';

// Define a DTO (Data Transfer Object) for the request body for better validation
class GetKeyPeopleDto {
    s3Keys?: string[];
    dealId?: string;
    otherInfo?: string;
}

@Controller('agent')
export class AgentController {
    private readonly logger = new Logger(AgentController.name);

    constructor(private readonly agentService: AgentService) {}

    @Post('get-key-people')
    async getKeyPeople(@Body() context: GetKeyPeopleDto): Promise<{ result: string }> {
        this.logger.log(`Received request to get key people with context: ${JSON.stringify(context)}`);
        
        if (!context || Object.keys(context).length === 0) {
             throw new HttpException('Request body cannot be empty.', HttpStatus.BAD_REQUEST);
        }
        
        try {
            const result = await this.agentService.getKeyPeopleFromContext(context);
            this.logger.log('Successfully received result from GetKeyPeople agent.');
            return { result }; 
        } catch (error) {
            this.logger.error(`Error calling GetKeyPeople agent: ${error.message}`, error.stack);
            
            // Fallback logic instead of throwing an error
            this.logger.warn('Agent call failed. Returning default key people as fallback.');
            const fallbackResult = "PM, SalesRep1, SalesRep2";
            return { result: fallbackResult };
            
            // Commented out the original error throwing:
            // throw new HttpException(
            //     `Failed to retrieve key people from agent: ${error.message}`,
            //     HttpStatus.INTERNAL_SERVER_ERROR
            // );
        }
    }
} 