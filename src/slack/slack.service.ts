import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebClient, ErrorCode } from '@slack/web-api';
import * as crypto from 'crypto';
import { AgentService } from '../agent/agent.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PostgrestError } from '@supabase/supabase-js';
import { ActiveSlackThread } from '../types/slack.types';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class SlackService implements OnModuleInit {
    private readonly logger = new Logger(SlackService.name);
    private client: WebClient;
    private slackSigningSecret: string;

    constructor(
        private readonly agentService: AgentService,
        private readonly supabaseService: SupabaseService,
        private readonly metricsService: MetricsService
    ) {
        const token = process.env.SLACK_BOT_TOKEN;
        const signingSecret = process.env.SLACK_SIGNING_SECRET;

        if (!token) {
            const errorMessage = 'Missing SLACK_BOT_TOKEN environment variable!';
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
        }
        if (!signingSecret) {
             const errorMessage = 'Missing SLACK_SIGNING_SECRET environment variable!';
             this.logger.error(errorMessage);
             throw new Error(errorMessage);
        }

        this.slackSigningSecret = signingSecret;
        this.client = new WebClient(token);
    }

    async onModuleInit() {
        try {
            const testAuth = await this.client.auth.test();
            this.logger.log(`Slack auth successful for bot user ${testAuth.user_id} on team ${testAuth.team_id}`);
        } catch (error) {
            this.logger.error(`Slack auth failed: ${error.message}`, error.stack);
        }
    }

    async sendMessageToUser(userId: string, text: string, dealId: string, dealName: string): Promise<string | null> {
        try {
            const messagePayload = {
                channel: userId,
                text: text,
                metadata: {
                    event_type: 'stale_deal_notice',
                    event_payload: { deal_id: dealId }
                },
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: text
                        }
                    },
                    {
                        type: 'context',
                        elements: [
                            {
                                type: 'mrkdwn',
                                text: `Related Deal: *${dealName}* (ID: ${dealId})`
                            }
                        ]
                    }
                ]
            };

            const result = await this.client.chat.postMessage(messagePayload);

            if (result.ok && result.ts) {
                this.logger.log(`Message sent successfully to ${userId} for deal ${dealId}. TS: ${result.ts}`);

                // Store thread -> deal mapping in Supabase
                const { error: upsertError } = await this.supabaseService.supabase
                    .from('active_slack_threads')
                    .upsert({
                        thread_ts: result.ts,
                        deal_id: dealId,
                        deal_name: dealName,
                        channel_id: userId, // For DMs, channel is user ID
                        // created_at defaults to NOW()
                    } as ActiveSlackThread);

                if (upsertError) {
                    this.logger.error(`Failed to upsert thread mapping to Supabase: ${upsertError.message}`, upsertError.stack);
                    // Decide if this should be fatal or just a warning
                } else {
                    this.logger.log(`Stored/Updated thread mapping in Supabase: ${result.ts} -> Deal: ${dealId}`);
                }

                // Extract stakeholder role from text or message context
                let stakeholderRole = 'Unknown';
                
                // Try to determine role based on userId mapping (common pattern in the codebase)
                if (text.toLowerCase().includes('product perspective')) {
                    stakeholderRole = 'PM';
                } else if (text.toLowerCase().includes('manage to connect') || text.toLowerCase().includes('holding you back')) {
                    stakeholderRole = 'SalesRep';
                }

                // Track the notification in stakeholder_notifications
                const { error: notificationError } = await this.supabaseService.supabase
                    .from('stakeholder_notifications')
                    .insert({
                        stakeholder_id: userId,
                        stakeholder_role: stakeholderRole,
                        deal_id: dealId,
                        message_ts: result.ts,
                        // sent_at defaults to NOW()
                    });

                if (notificationError) {
                    this.logger.error(`Failed to track notification in Supabase: ${notificationError.message}`, notificationError.stack);
                } else {
                    this.logger.log(`Tracked notification to ${userId} (${stakeholderRole}) for deal ${dealId}`);
                }

                return result.ts;
            } else {
                this.logger.error(`Slack API error sending message to ${userId}: ${result.error}`);
                throw new Error(result.error || 'Unknown Slack API error');
            }
        } catch (error) {
            this.logger.error(`Failed to send Slack message or store mapping: ${error.message}`, error.stack);
            if (error.code === ErrorCode.PlatformError) {
                this.logger.error(`Platform Error Data: ${JSON.stringify(error.data)}`);
            }
            throw error;
        }
    }

    verifySlackRequest(headers: Record<string, string>, rawBody: string, requestTimestampSeconds: number): boolean {
        const signature = headers['x-slack-signature'];
        const timestamp = headers['x-slack-request-timestamp'];

        if (!signature || !timestamp) {
            this.logger.warn('Missing x-slack-signature or x-slack-request-timestamp header');
            return false;
        }
        if (!this.slackSigningSecret) {
             this.logger.error('Slack signing secret is not configured.');
             return false;
        }
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - parseInt(timestamp, 10)) > 60 * 5) {
            this.logger.warn(`Timestamp difference too large: ${timestamp} vs ${nowSeconds}`);
            return false;
        }
        const baseString = `v0:${timestamp}:${rawBody}`;
        const hmac = crypto.createHmac('sha256', this.slackSigningSecret)
                           .update(baseString)
                           .digest('hex');
        const computedSignature = `v0=${hmac}`;
        const isValid = crypto.timingSafeEqual(Buffer.from(computedSignature, 'utf8'), Buffer.from(signature, 'utf8'));
        if (!isValid) {
             this.logger.warn(`Signature mismatch. Computed: ${computedSignature}, Received: ${signature}`);
        }
        return isValid;
    }

    async processEvent(payload: any): Promise<void> {
        this.logger.debug('Received Slack event:', JSON.stringify(payload, null, 2));

        if (payload.event?.type === 'message' && !payload.event.bot_id) {
            const { text, user, thread_ts, ts, metadata, channel } = payload.event;

            if (!thread_ts) {
                this.logger.debug('Ignoring non-threaded message');
                return;
            }
            if (!channel) {
                 this.logger.error('Missing channel ID in event payload. Cannot reply.');
                 return;
            }

            // Attempt to get deal context from Supabase using thread_ts
            let dealId: string | null = null;
            let dealName: string | null = null;
            let notificationId: string | null = null;

            try {
                const { data: threadData, error: dbError } = await this.supabaseService.supabase
                    .from('active_slack_threads')
                    .select('deal_id, deal_name')
                    .eq('thread_ts', thread_ts)
                    .maybeSingle();

                if (dbError) {
                    this.logger.error(`Error fetching thread mapping from Supabase for ts ${thread_ts}: ${dbError.message}`, dbError.stack);
                    // Decide if we should try to reply without context or stop
                    return; // Stop processing this event
                }

                if (threadData) {
                    dealId = threadData.deal_id;
                    dealName = threadData.deal_name;
                    this.logger.log(`Retrieved deal mapping for thread ${thread_ts} from Supabase: Deal: ${dealId}`);

                    // Find the notification ID for this thread
                    const { data: notificationData, error: notificationError } = await this.supabaseService.supabase
                        .from('stakeholder_notifications')
                        .select('id')
                        .eq('message_ts', thread_ts)
                        .maybeSingle();

                    if (notificationError) {
                        this.logger.error(`Error fetching notification ID for thread ${thread_ts}: ${notificationError.message}`);
                    } else if (notificationData) {
                        notificationId = notificationData.id;
                        this.logger.log(`Found notification ID ${notificationId} for thread ${thread_ts}`);
                    }
                } else {
                    // Optionally check metadata as a fallback, though unlikely if not in DB
                    const metaDealId = metadata?.event_payload?.deal_id;
                    if (metaDealId) {
                        dealId = metaDealId;
                        // We don't have the name from metadata alone
                        dealName = 'Unknown (from metadata)';
                        this.logger.warn(`Thread ${thread_ts} not found in Supabase map, using dealId from metadata.`);
                    } else {
                        this.logger.warn(`No deal mapping found in Supabase or metadata for thread ${thread_ts}. Cannot process reply.`);
                        return; // Stop processing
                    }
                }
            } catch (error) {
                 this.logger.error(`Unexpected error fetching thread mapping: ${error.message}`, error.stack);
                 return;
            }

            // Ensure we have a deal ID to proceed
            if (!dealId) {
                this.logger.error('Could not determine Deal ID for thread ${thread_ts}. Aborting.');
                return;
            }

            this.logger.log(`Processing reply from ${user} in thread ${thread_ts} (channel: ${channel}) for deal ${dealId}: "${text}"`);

            // Track the stakeholder response
            if (notificationId) {
                try {
                    const { error: responseError } = await this.supabaseService.supabase
                        .from('stakeholder_responses')
                        .insert({
                            notification_id: notificationId,
                            response_text: text,
                            response_ts: ts,
                            // responded_at defaults to NOW()
                        });

                    if (responseError) {
                        this.logger.error(`Failed to track stakeholder response: ${responseError.message}`);
                    } else {
                        this.logger.log(`Successfully tracked stakeholder response for notification ${notificationId}`);
                        
                        // If the response contains indications of status change, track it
                        if (text.toLowerCase().includes('closed') || text.toLowerCase().includes('won')) {
                            await this.metricsService.trackDealResolution(
                                dealId,
                                'Stalled',
                                'Closed Won',
                                user
                            );
                        } else if (text.toLowerCase().includes('progress') || 
                                 text.toLowerCase().includes('moving forward') ||
                                 text.toLowerCase().includes('active')) {
                            await this.metricsService.trackDealResolution(
                                dealId,
                                'Stalled',
                                'Active',
                                user
                            );
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error tracking stakeholder response: ${error.message}`, error.stack);
                }
            }

            // Generate reply via Agentforce
            try {
                const replyText = await this.agentService.generateSlackReply(
                    user,
                    text,
                    dealId, // Pass the retrieved dealId
                    thread_ts
                );

                await this.sendReplyInThread(channel, thread_ts, replyText);
                this.logger.log(`Sent Agentforce reply to thread ${thread_ts} in channel ${channel}`);
            } catch (error) {
                this.logger.error(`Error generating or sending Agentforce reply: ${error.message}`, error.stack);
                try {
                    await this.sendReplyInThread(channel, thread_ts, "Sorry, I encountered an issue trying to process your message.");
                } catch (replyError) {
                    this.logger.error(`Failed to send error notification: ${replyError.message}`);
                }
            }
        } else {
            this.logger.debug(`Ignoring event: ${payload.event?.type || 'unknown'} or bot message.`);
        }
    }

    private async sendReplyInThread(channelId: string, threadTs: string, text: string): Promise<void> {
         try {
            await this.client.chat.postMessage({
                channel: channelId,
                thread_ts: threadTs,
                text: text,
            });
            this.logger.log(`Successfully sent reply to thread ${threadTs} in channel ${channelId}`);
        } catch (error) {
            this.logger.error(`Failed to send reply to thread ${threadTs}: ${error.message}`, error.stack);
            if (error.code === ErrorCode.PlatformError) {
                this.logger.error(`Platform Error Data: ${JSON.stringify(error.data)}`);
            }
            throw error;
        }
    }

    // New method for dashboard
    async getActiveThreads(): Promise<ActiveSlackThread[]> {
        this.logger.log('Fetching active threads from Supabase...');
        const { data, error } = await this.supabaseService.supabase
            .from('active_slack_threads')
            .select('*')
            .order('created_at', { ascending: false })
            .returns<ActiveSlackThread[]>();

        if (error) {
            this.logger.error(`Error fetching active_slack_threads: ${error.message}`, error.stack);
            throw error;
        }
        this.logger.log(`Fetched ${data?.length ?? 0} active threads from Supabase.`);
        return data || [];
    }

    // New method for dashboard
    async getActiveThreadsCount(): Promise<number> {
         this.logger.log('Fetching active threads count from Supabase...');
         // Use Supabase count feature
         const { count, error } = await this.supabaseService.supabase
            .from('active_slack_threads')
            .select('*' , { count: 'exact', head: true }); // Only get count

         if (error) {
            this.logger.error(`Error fetching active_slack_threads count: ${error.message}`, error.stack);
            throw error;
         }
         const result = count ?? 0;
         this.logger.log(`Fetched active threads count from Supabase: ${result}`);
         return result;
    }

    /**
     * Searches for Slack users by name.
     * NOTE: This fetches the entire user list and filters locally. 
     * This can be inefficient and hit rate limits on very large workspaces.
     * @param nameQuery The name (or part of the name) to search for.
     * @returns A promise resolving to an array of matching users { id, name }.
     */
    async searchUserByName(nameQuery: string): Promise<{ id: string, name: string }[]> {
        this.logger.log(`Searching for Slack users matching "${nameQuery}"...`);
        if (!nameQuery || nameQuery.trim() === '') {
            this.logger.warn('Search query is empty, returning no users.');
            return [];
        }

        const lowerCaseQuery = nameQuery.toLowerCase();
        const matchingUsers: { id: string, name: string }[] = [];

        try {
            // Fetch all users (potential performance issue on large workspaces)
            // Consider adding pagination handling if necessary using the cursor in the response
            const result = await this.client.users.list({}); // Pass an empty object if no specific options needed

            if (result.ok && result.members) {
                this.logger.log(`Fetched ${result.members.length} users from Slack. Filtering...`);
                for (const member of result.members) {
                    // Skip bots and deleted users
                    if (member.is_bot || member.deleted || !member.id) {
                        continue;
                    }

                    const realName = member.real_name?.toLowerCase();
                    const displayName = member.profile?.display_name?.toLowerCase();

                    // Check if real name or display name contains the query
                    if ((realName && realName.includes(lowerCaseQuery)) || 
                        (displayName && displayName.includes(lowerCaseQuery))) {
                        matchingUsers.push({ 
                            id: member.id, 
                            name: member.real_name || member.profile?.display_name || member.name || 'Unknown Name' 
                        });
                    }
                }
                this.logger.log(`Found ${matchingUsers.length} users matching "${nameQuery}".`);
            } else {
                this.logger.error(`Failed to fetch users list from Slack: ${result.error}`);
                throw new Error(`Slack API error: ${result.error || 'Failed to list users'}`);
            }
        } catch (error) {
            this.logger.error(`Error searching Slack users: ${error.message}`, error.stack);
            // Re-throw the error to be handled by the controller
            throw error; 
        }

        return matchingUsers;
    }
} 