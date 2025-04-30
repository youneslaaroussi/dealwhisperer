import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from './supabase.service'; // Import SupabaseService

@Injectable()
export class DatabaseSetupService implements OnModuleInit {
    private readonly logger = new Logger(DatabaseSetupService.name);

    constructor(private supabaseService: SupabaseService) {}

    async onModuleInit() {
        this.logger.log('Running database setup...');
        await this.createTables();
    }

    private async createTables() {
        const client = this.supabaseService.supabase;

        const createLatestStaleDealsTable = `
            CREATE TABLE IF NOT EXISTS latest_stale_deals (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                deal_id TEXT NOT NULL,
                deal_name TEXT NOT NULL,
                identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const createActiveSlackThreadsTable = `
            CREATE TABLE IF NOT EXISTS active_slack_threads (
                thread_ts TEXT PRIMARY KEY,
                deal_id TEXT NOT NULL,
                deal_name TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const createStakeholderNotificationsTable = `
            CREATE TABLE IF NOT EXISTS stakeholder_notifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                stakeholder_id TEXT NOT NULL,
                stakeholder_role TEXT NOT NULL,
                deal_id TEXT NOT NULL,
                message_ts TEXT NOT NULL,
                sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const createStakeholderResponsesTable = `
            CREATE TABLE IF NOT EXISTS stakeholder_responses (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                notification_id UUID REFERENCES stakeholder_notifications(id),
                response_text TEXT NOT NULL,
                response_ts TEXT NOT NULL,
                responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const createDealResolutionsTable = `
            CREATE TABLE IF NOT EXISTS deal_resolutions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                deal_id TEXT NOT NULL,
                previous_status TEXT NOT NULL,
                new_status TEXT NOT NULL,
                resolved_by TEXT,
                resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const createStakeholderMappingTable = `
            CREATE TABLE IF NOT EXISTS stakeholder_mapping (
                role TEXT PRIMARY KEY,            -- The role identifier (e.g., 'PM', 'SalesRep1')
                slack_user_id TEXT NOT NULL,    -- The corresponding Slack User ID (e.g., 'U123PMID')
                full_name TEXT,                 -- Optional: Full name of the stakeholder
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `;

        const tablesToCreate = [
            { name: 'latest_stale_deals', query: createLatestStaleDealsTable },
            { name: 'active_slack_threads', query: createActiveSlackThreadsTable },
            { name: 'stakeholder_notifications', query: createStakeholderNotificationsTable },
            { name: 'stakeholder_responses', query: createStakeholderResponsesTable },
            { name: 'deal_resolutions', query: createDealResolutionsTable },
            { name: 'stakeholder_mapping', query: createStakeholderMappingTable }
        ];

        for (const table of tablesToCreate) {
            this.logger.log(`Ensuring table/index ${table.name} exists...`);
            const { error } = await client.rpc('execute_sql', { sql: table.query });
            if (error) {
                if (error.code === '42P07') {
                   this.logger.log(`Table/Index ${table.name} already exists.`);
                } else if (error.message.includes('function uuid_generate_v4() does not exist')) {
                    this.logger.warn(`Table ${table.name} requires uuid-ossp extension. Please enable it in Supabase dashboard (Database -> Extensions). Error: ${error.message}`);
                } else if (error.message.includes('function execute_sql(text) does not exist')) {
                     this.logger.error(`Database function execute_sql does not exist. Please create it in Supabase SQL Editor.`);
                     this.logger.error(`Example: CREATE OR REPLACE FUNCTION execute_sql(sql TEXT) RETURNS void AS $$ BEGIN EXECUTE sql; END; $$ LANGUAGE plpgsql;`);
                     throw new Error(`Missing required database function: execute_sql. ${error.message}`);
                } else {
                   this.logger.error(`Error creating table/index ${table.name}: ${error.message}`, error.stack);
                }
            } else {
                this.logger.log(`Table/Index ${table.name} check/creation successful.`);
            }
        }
        this.logger.log('Database setup check complete.');
    }
} 