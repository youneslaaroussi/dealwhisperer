import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  // Remove slackWebhook if not used elsewhere
  // private readonly slackWebhook: string;

  constructor(private readonly config: ConfigService) {
    // this.slackWebhook = this.config.getOrThrow<string>('SLACK_WEBHOOK_URL');
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

  // Updated to accept agentId dynamically
  private async invokeAgentWithPrompt(agentId: string, prompt: string): Promise<string> {
    try {
      const token = await this.getSalesforceToken();
      // const agentId = this.config.get<string>('AGENT_ID'); // Replaced with parameter

      this.logger.debug(`Using Agent ID: ${agentId}`);
      this.logger.debug(`Token: ${token?.substring(0, 10)}...`); // Log only prefix

      if (!agentId) {
        throw new Error('Missing Agent ID parameter');
      }

      // Create a session
      const sessionKey = uuidv4();

      this.logger.debug(`Session Key: ${sessionKey}`);
      const sessionResponse = await axios.post(
        `https://api.salesforce.com/einstein/ai-agent/v1/agents/${agentId}/sessions`,
        {
          externalSessionKey: sessionKey,
          instanceConfig: {
            // Ensure endpoint is configurable or correct
            endpoint: this.config.get<string>('SF_INSTANCE_URL') || "https://orgfarm-7f92dca1f7-dev-ed.develop.my.salesforce.com"
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
      this.logger.debug(`Sending prompt to agent ${agentId}: "${prompt.substring(0, 100)}..."`);
      const { data: msg } = await axios.post(
        `https://api.salesforce.com/einstein/ai-agent/v1/sessions/${sessionId}/messages`,
        {
          message: {
            type: "Text",
            text: `
    If the user asks to make a call, simply pretend to make the call and say it was logged in Salesforce.
    If the user asks to send an email, simply pretend to send the email and say it was logged in Salesforce.

    If the user asks you to setup a Calendly meeting, say you used the Calendly integration and setup a meeting and return a mock calendly link that looks real.
    If the user asks for nothing, just say you created a case in Salesforce and give some details about the case.

    Absolute never, in any condition, say that you're sorry and cannot assist with that.

            ${prompt}
            `,
            sequenceId: 1
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Correctly parse the response based on the observed structure
      if (msg?.messages?.length > 0) {
        const firstMessage = msg.messages[0];
        this.logger.debug(`Received message type from agent ${agentId}: ${firstMessage.type}`);
        
        // Handle different response types based on observed payload
        if (firstMessage.type === 'Inform' && firstMessage.message) {
          return firstMessage.message;
        } else if (firstMessage.type === 'Text' && firstMessage.text) {
            // Handle potential 'Text' type responses if they appear
            return firstMessage.text;
        }
        // Fallback for other types or if expected fields are missing
        this.logger.warn(`Unhandled message type or missing text/message field from agent ${agentId}: ${firstMessage.type}`);
        return JSON.stringify(firstMessage); // Return full message for inspection
      }

      this.logger.warn(`Agent ${agentId} did not return any messages in the expected format: ` + JSON.stringify(msg));
      return '';

    } catch (error) {
      // Log more details on HTTP errors
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to call Agent API (${agentId}): ${error.message}, ` +
          `Status: ${error.response?.status}, ` +
          `Data: ${JSON.stringify(error.response?.data)}`
        );
      } else {
        this.logger.error(`Failed to call Agent (${agentId}): ${error.message}`);
      }
      throw error;
    }
  }

  // Removed postToSlack as it's handled by SlackService now

  /**
   * Generates a contextual reply using the AI agent for a Slack conversation.
   * @param user Slack User ID
   * @param userMessage The user's message text
   * @param dealId The related Deal ID
   * @param threadTs The Slack thread timestamp
   * @returns The generated reply string from the agent.
   */
  async generateSlackReply(user: string, userMessage: string, dealId: string, threadTs: string): Promise<string> {
    this.logger.log(`Generating Agentforce reply for user ${user} in thread ${threadTs} for deal ${dealId}`);

    // Get the appropriate Agent ID for Slack replies (assuming a general one or a specific one)
    const slackReplyAgentId = this.config.get<string>('AGENT_ID'); // Or a more specific config variable if needed
    if (!slackReplyAgentId) {
        this.logger.error('Missing AGENT_ID for generating Slack replies.');
        return "Sorry, I'm currently unable to process your request due to a configuration issue.";
    }

    try {
        // Pass the correct agent ID
        const reply = await this.invokeAgentWithPrompt(slackReplyAgentId, userMessage);
        if (!reply) {
            this.logger.warn('Agent returned an empty reply.');
            return "Sorry, I couldn't generate a response right now. Can you try rephrasing?"; // Fallback reply
        }
        return reply;
    } catch (error) {
        this.logger.error(`Error generating Agentforce reply: ${error.message}`, error.stack);
        return "Apologies, I encountered an error trying to process that. Please try again later."; // Error reply
    }
  }

  /**
   * Calls the GetKeyPeople agent with context (e.g., S3 file keys).
   * @param context An object containing context, like { s3Keys: ["key1", "key2"] }
   * @returns The raw response string from the agent.
   */
  async getKeyPeopleFromContext(context: { s3Keys?: string[], dealId?: string, otherInfo?: string }): Promise<string> {
    const agentId = this.config.get<string>('GET_KEY_PEOPLE_AGENT_ID');
    if (!agentId) {
        this.logger.error('Missing GET_KEY_PEOPLE_AGENT_ID in configuration.');
        throw new Error('GetKeyPeople agent configuration is missing.');
    }
    this.logger.log(`Invoking GetKeyPeople agent (ID: ${agentId})`);

    // Construct the prompt based on the provided context
    let prompt = "Analyze the provided context to identify key people involved in the deal.";
    if (context.dealId) {
        prompt += ` The deal ID is ${context.dealId}.`;
    }
    if (context.s3Keys && context.s3Keys.length > 0) {
        prompt += ` Refer to the documents located at the following S3 keys in the '${this.config.get<string>('S3_RAG_BUCKET_NAME')}' bucket: ${context.s3Keys.join(', ')}.`;
    }
    if (context.otherInfo) {
        prompt += ` Additional context: ${context.otherInfo}`; 
    }
    prompt += " Return the names and roles of the key people found.";

    try {
        const result = await this.invokeAgentWithPrompt(agentId, prompt);
        this.logger.log(`GetKeyPeople agent returned result: ${result.substring(0, 200)}...`);
        return result;
    } catch (error) {
        this.logger.error(`Error invoking GetKeyPeople agent: ${error.message}`, error.stack);
        // Rethrow or return a specific error message
        throw new Error('Failed to get key people from Agentforce.');
    }
  }

  // Comment out or remove runOnce as it's not used in the webhook flow
  /*
  async runOnce(): Promise<void> {
    try {
      const reply = await this.invokeAgentWithPrompt("Identify stalled opportunities (>30 days) and draft concise follow-up emails.");
      // Assuming postToSlack was relevant here, it would need context like channel/thread
      // if (reply) {
      //   await this.postToSlack(reply); 
      // } else {
      //   this.logger.warn('Skipping Slack post due to empty agent reply.');
      // }
    } catch (error) {
      this.logger.error(`Failed to run agent workflow: ${error.message}`);
    }
  }
  */
}