import { Controller, Post, Body, Headers, RawBodyRequest, Req, Res, HttpCode, HttpStatus, Logger, Get, Query, HttpException } from '@nestjs/common';
import { SlackService } from './slack.service';
import { Request, Response } from 'express'; // Import Request and Response for raw body

@Controller('slack')
export class SlackController {
    private readonly logger = new Logger(SlackController.name);

    constructor(private readonly slackService: SlackService) {}

    @Post('webhook')
    @HttpCode(HttpStatus.OK) // Slack expects a quick 200 OK
    async handleWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response, @Headers() headers: Record<string, string>, @Body() body: any): Promise<void> {
        // IMPORTANT: Slack requires the raw body for signature verification
        const rawBody = req.rawBody; // Requires { rawBody: true } in main.ts bootstrap
        if (!rawBody) {
             this.logger.error('Raw body not available. Ensure NestJS app is configured with { rawBody: true }.');
             res.status(500).send('Internal Server Error');
             return;
        }

        // Verify Slack request signature
        if (!this.slackService.verifySlackRequest(headers, rawBody.toString('utf8'), body.event_time || Math.floor(Date.now() / 1000))) {
            this.logger.warn('Invalid Slack signature received');
            res.status(HttpStatus.UNAUTHORIZED).send('Invalid signature');
            return;
        }

        // Handle URL verification challenge from Slack
        if (body.type === 'url_verification') {
            this.logger.log('Responding to Slack URL verification challenge');
            res.status(HttpStatus.OK).send(body.challenge);
            return;
        }

        // Acknowledge the event immediately to avoid Slack retries
        res.status(HttpStatus.OK).send();

        // Process the event asynchronously
        this.slackService.processEvent(body)
            .catch(error => {
                this.logger.error('Error processing Slack event asynchronously:', error);
                // Handle background task error
            });

    }

    // New endpoint for searching users
    @Get('search-user')
    async searchUser(@Query('name') nameQuery: string): Promise<{ users: { id: string, name: string }[] }> {
        this.logger.log(`Received request to search Slack users for name: "${nameQuery}"`);
        if (!nameQuery) {
            throw new HttpException('Missing required query parameter: name', HttpStatus.BAD_REQUEST);
        }
        try {
            const users = await this.slackService.searchUserByName(nameQuery);
            return { users };
        } catch (error) {
            this.logger.error(`Failed during user search for "${nameQuery}": ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Failed to search Slack users', 
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
} 