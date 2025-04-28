import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly slackWebhook: string;

  constructor(private readonly config: ConfigService) {
    this.slackWebhook = this.config.getOrThrow<string>('SLACK_WEBHOOK_URL');
  }

  private async getSalesforceToken(): Promise<string> {
    try {
      const clientId = this.config.get<string>('SF_CLIENT_ID');
      const clientSecret = this.config.get<string>('SF_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new Error('Missing Salesforce credentials');
      }

      // Exchange client credentials for access token
      const response = await axios.post(
        'https://orgfarm-7f92dca1f7-dev-ed.develop.my.salesforce.com/services/oauth2/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error(`Failed to get Salesforce token: ${error.message}`);
      throw error;
    }
  }

  private async callAgent(prompt: string): Promise<string> {
    try {
      const token = await this.getSalesforceToken();
      const agentId = this.config.get<string>('AGENT_ID');

      this.logger.debug(`Token: ${token}`);
      this.logger.debug(`Agent ID: ${agentId}`);

      if (!agentId) {
        throw new Error('Missing AGENT_ID');
      }

      // Create a session
      const sessionKey = uuidv4();

      this.logger.debug(`Session Key: ${sessionKey}`);
      const sessionResponse = await axios.post(
        `https://api.salesforce.com/einstein/ai-agent/v1/agents/${agentId}/sessions`,
        {
          externalSessionKey: sessionKey,
          instanceConfig: {
            endpoint: "https://orgfarm-7f92dca1f7-dev-ed.develop.my.salesforce.com"
          },
          streamingCapabilities: { chunkTypes: ["Text"] },
          bypassUser: true
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const sessionId = sessionResponse.data.sessionId;

      this.logger.debug(`Session ID: ${sessionId}`);

      // Send the prompt
      const { data: msg } = await axios.post(
        `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
        {
          message: {
            type: "Text",
            text: prompt,
            sequenceId: 1
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Correctly parse the response based on the observed structure
      if (msg?.messages?.length > 0) {
        const firstMessage = msg.messages[0];
        this.logger.debug(`Received message type: ${firstMessage.type}`);
        
        // Handle different response types based on observed payload
        if (firstMessage.type === 'Inform' && firstMessage.message) {
          return firstMessage.message;
        } else if (firstMessage.type === 'Text' && firstMessage.text) {
            // Handle potential 'Text' type responses if they appear
            return firstMessage.text;
        }
        // Fallback for other types or if expected fields are missing
        this.logger.warn(`Unhandled message type or missing text/message field: ${firstMessage.type}`);
        return JSON.stringify(firstMessage); // Return full message for inspection
      }

      this.logger.warn('Agent did not return any messages in the expected format: ' + JSON.stringify(msg));
      return '';

    } catch (error) {
      // Log more details on HTTP errors
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to call Agent API: ${error.message}, ` +
          `Status: ${error.response?.status}, ` +
          `Data: ${JSON.stringify(error.response?.data)}`
        );
      } else {
        this.logger.error(`Failed to call Agent: ${error.message}`);
      }
      throw error;
    }
  }

  private async postToSlack(text: string) {
    try {
      // Slack section block keeps line-breaks
      await axios.post(this.slackWebhook, {
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text } }
        ]
      });
      this.logger.debug('Slack post OK');
    } catch (err) {
      this.logger.error('Slack post failed', err);
    }
  }

  async runOnce(): Promise<void> {
    try {
      // Token is fetched inside callAgent now, so no need to call it here
      const reply = await this.callAgent("Identify stalled opportunities (>30 days) and draft concise follow-up emails.");
      if (reply) {
        await this.postToSlack(reply);
      } else {
        this.logger.warn('Skipping Slack post due to empty agent reply.');
      }
    } catch (error) {
      this.logger.error(`Failed to run agent workflow: ${error.message}`);
      // Don't rethrow here if we want the controller to return 'ok' even on agent failure
      // throw error;
    }
  }
} 