import { Controller, Post, HttpCode, HttpStatus, Logger, Get, Body, ValidationPipe } from '@nestjs/common';
import { DealsService } from './deals.service';
import { StakeholderMapping } from '../types/stakeholder.types'; // Import the type
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// DTO for a single mapping entry
class StakeholderMappingDto implements Omit<StakeholderMapping, 'updated_at'> {
    @IsString()
    @IsNotEmpty()
    role: string;

    @IsString()
    @IsNotEmpty()
    slack_user_id: string;

    @IsString()
    @IsOptional()
    full_name?: string;
}

// DTO for the array of mappings in the request body
class AssignStakeholdersDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StakeholderMappingDto)
    mappings: StakeholderMappingDto[];
}

@Controller('deals')
export class DealsController {
    private readonly logger = new Logger(DealsController.name);

    constructor(private readonly dealsService: DealsService) {}

    @Post('notify-stale')
    @HttpCode(HttpStatus.ACCEPTED) // Use 202 Accepted for async tasks
    async notifyStaleDeals(): Promise<{ message: string }> {
        this.logger.log('Received request to notify stale deals');
        // Trigger the process asynchronously, don't wait for it to complete
        this.dealsService.notifyStakeholdersForStaleDeals()
            .catch(error => {
                this.logger.error('Error during asynchronous stale deal notification:', error);
                // Handle background task error (e.g., log to monitoring service)
            });

        return { message: 'Stale deal notification process initiated.' };
    }

    @Get('stakeholders')
    async getStakeholders(): Promise<Record<string, string>> {
        this.logger.log('Received request to get stakeholders');
        return this.dealsService.getStakeholders();
    }

    @Post('stakeholders/assign')
    @HttpCode(HttpStatus.OK)
    async assignStakeholders(
        @Body(new ValidationPipe({ transform: true, whitelist: true })) 
        assignDto: AssignStakeholdersDto
    ): Promise<{ message: string }> {
        this.logger.log(`Received request to assign ${assignDto.mappings.length} stakeholder mappings.`);
        await this.dealsService.assignStakeholders(assignDto.mappings);
        return { message: 'Stakeholder mappings updated successfully.' };
    }
} 