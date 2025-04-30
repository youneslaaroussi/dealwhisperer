import { Injectable, Logger } from '@nestjs/common';
import { SlackService } from '../slack/slack.service';
import { SalesforceService } from '../salesforce/salesforce.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ParsedDeal, LatestStaleDealDbRecord } from '../types/deal.types';
import { StakeholderMapping } from '../types/stakeholder.types';

@Injectable()
export class DealsService {
    private readonly logger = new Logger(DealsService.name);

    constructor(
        private readonly slackService: SlackService,
        private readonly salesforceService: SalesforceService,
        private readonly supabaseService: SupabaseService
    ) {}

    async notifyStakeholdersForStaleDeals(): Promise<void> {
        this.logger.log('Starting stale deal notification process...');
        let staleDeals: ParsedDeal[] = [];
        let currentStakeholders: Record<string, string> = {};

        try {
            currentStakeholders = await this.getStakeholders();
            if (Object.keys(currentStakeholders).length === 0) {
                this.logger.warn('No stakeholders found in the database. Skipping notification process.');
                return;
            }
        } catch (error) {
            this.logger.error(`Failed to fetch stakeholders: ${error.message}`, error.stack);
            return;
        }

        try {
            const flowOutput = await this.salesforceService.invokeFlow('GetColdOpportunities');
            if (flowOutput === null) {
                this.logger.warn('Salesforce Flow GetColdOpportunities did not return a valid output string.');
            } else {
                staleDeals = this._parseFlowOutput(flowOutput);
                await this._updateLatestStaleDeals(staleDeals);
            }
        } catch (error) {
             this.logger.error(`Error invoking flow or updating Supabase: ${error.message}`, error.stack);
             try {
                staleDeals = await this.getLatestStaleDeals();
                this.logger.warn(`Proceeding with potentially stale data (${staleDeals.length} deals) from Supabase due to error.`);
             } catch (fetchError) {
                this.logger.error(`Failed to fetch stale deals from Supabase as fallback: ${fetchError.message}`);
                return;
             }
        }

        this.logger.log(`Processing ${staleDeals.length} stale deals for ${Object.keys(currentStakeholders).length} stakeholders.`);

        if (staleDeals.length === 0) {
            this.logger.log('No stale deals to process.');
            return;
        }

        for (const [role, userId] of Object.entries(currentStakeholders)) {
            this.logger.log(`Processing deals for stakeholder ${role} (${userId})...`);
            for (const deal of staleDeals) {
                const message = this.generateMessageForRole(role, deal.name);
                if (!message) {
                    this.logger.warn(`No message template for role ${role} on deal ${deal.name}`);
                    continue;
                }
                try {
                    await this.slackService.sendMessageToUser(userId, message, deal.id, deal.name);
                    this.logger.log(`Sent message to ${role} (${userId}) for deal ${deal.name}`);
                } catch (error) {
                    this.logger.error(`Failed to send message to ${userId} for deal ${deal.name}: ${error.message}`, error.stack);
                }
            }
        }
        this.logger.log('Finished stale deal notification process.');
    }

    async getLatestStaleDeals(): Promise<ParsedDeal[]> {
        this.logger.log('Fetching latest stale deals from Supabase...');
        const { data, error } = await this.supabaseService.supabase
            .from('latest_stale_deals')
            .select('deal_id, deal_name')
            .order('identified_at', { ascending: false })
            .returns<Pick<LatestStaleDealDbRecord, 'deal_id' | 'deal_name'>[]>();

        if (error) {
            this.logger.error(`Error fetching from latest_stale_deals: ${error.message}`, error.stack);
            throw error;
        }

        this.logger.log(`Fetched ${data?.length ?? 0} deals from Supabase.`);
        return (data || []).map(deal => ({
            id: deal.deal_id,
            name: deal.deal_name
        }));
    }

    private async _updateLatestStaleDeals(deals: ParsedDeal[]): Promise<void> {
        const client = this.supabaseService.supabase;
        this.logger.log(`Updating latest_stale_deals table in Supabase with ${deals.length} deals...`);

        const { error: deleteError } = await client
            .from('latest_stale_deals')
            .delete()
            .neq('deal_id', 'dummy_id_to_delete_all');

        if (deleteError) {
            this.logger.error(`Error deleting from latest_stale_deals: ${deleteError.message}`, deleteError.stack);
            throw deleteError;
        }
        this.logger.log('Old stale deals cleared from Supabase.');
        if (deals.length === 0) {
             this.logger.log('No new stale deals to insert.');
            return;
        }

        const recordsToInsert: Omit<LatestStaleDealDbRecord, 'id' | 'identified_at'>[] = deals.map(deal => ({
            deal_id: deal.id,
            deal_name: deal.name
        }));

        const { error: insertError } = await client
            .from('latest_stale_deals')
            .insert(recordsToInsert);

        if (insertError) {
            this.logger.error(`Error inserting into latest_stale_deals: ${insertError.message}`, insertError.stack);
            throw insertError;
        }
        this.logger.log(`Successfully inserted ${deals.length} new stale deals into Supabase.`);
    }

    private _parseFlowOutput(output: string): ParsedDeal[] {
        if (!output || output.trim() === '') {
            return [];
        }
        const deals: ParsedDeal[] = [];
        const lines = output.trim().split(/\r?\n/);
        const dealRegex = /^- (.*?)\s+\(.*\)/;
        this.logger.log(`Parsing ${lines.length} lines from Flow output using regex: ${dealRegex}`);
        for (const line of lines) {
            const match = line.match(dealRegex);
            if (match && match[1]) {
                const dealName = match[1].trim();
                this.logger.warn(`Parsing deal: Using NAME '${dealName}' as placeholder ID.`);
                deals.push({ id: dealName, name: dealName });
            } else {
                this.logger.warn(`Could not parse line from Flow output: "${line}"`);
            }
        }
        return deals;
    }

    private generateMessageForRole(role: string, dealName: string): string | null {
        switch (role.toLowerCase()) {
            case 'pm':
                return `Deal: *${dealName}* has stalled. Any obstacles from a product perspective?`;
            case 'salesrep':
            case 'salesrep1':
            case 'salesrep2':
                return `Following up on *${dealName}*: Did you manage to connect? If not, what's holding you back?`;
            default:
                return `Attention needed for deal: *${dealName}*. Status update requested.`;
        }
    }

    async getStakeholders(): Promise<Record<string, string>> {
        this.logger.log('Retrieving deal stakeholders from database...');
        const { data, error } = await this.supabaseService.supabase
            .from('stakeholder_mapping')
            .select('role, slack_user_id');

        if (error) {
            this.logger.error(`Error fetching stakeholder mappings: ${error.message}`, error.stack);
            throw error;
        }

        if (!data || data.length === 0) {
            this.logger.warn('No stakeholder mappings found in the database.');
            return {};
        }

        const stakeholderMap = data.reduce((acc, mapping) => {
            if (mapping.role && mapping.slack_user_id) {
                acc[mapping.role] = mapping.slack_user_id;
            } else {
                this.logger.warn(`Skipping incomplete mapping: ${JSON.stringify(mapping)}`);
            }
            return acc;
        }, {} as Record<string, string>);
        
        this.logger.log(`Successfully retrieved ${Object.keys(stakeholderMap).length} stakeholder mappings.`);
        return stakeholderMap;
    }

    async assignStakeholders(mappings: StakeholderMapping[]): Promise<void> {
        this.logger.log(`Upserting ${mappings.length} stakeholder mappings into database...`);
        
        const recordsToUpsert = mappings.map(m => ({
            role: m.role,
            slack_user_id: m.slack_user_id,
            full_name: m.full_name,
        }));

        const { error } = await this.supabaseService.supabase
            .from('stakeholder_mapping')
            .upsert(recordsToUpsert, { onConflict: 'role' });

        if (error) {
            this.logger.error(`Error upserting stakeholder mappings: ${error.message}`, error.stack);
            throw error;
        }

        this.logger.log('Successfully upserted stakeholder mappings.');
    }
} 