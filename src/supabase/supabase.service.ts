import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private readonly logger = new Logger(SupabaseService.name);
    private _supabase!: SupabaseClient;

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseKey) {
            this.logger.error('Supabase URL or Service Role Key missing in configuration.');
            throw new Error('Supabase URL or Service Role Key missing.');
        }

        this.logger.log('Initializing Supabase client...');
        try {
             // Initialize using the Service Role Key for elevated privileges
            this._supabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    // Recommended settings for server-side clients
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                }
            });
            this.logger.log('Supabase client initialized successfully.');
        } catch (error) {
            this.logger.error(`Failed to initialize Supabase client: ${error.message}`, error.stack);
            throw error;
        }
    }

    get supabase(): SupabaseClient {
        return this._supabase;
    }
} 