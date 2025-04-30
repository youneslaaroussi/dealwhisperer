import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service'; // Import the service
import { DatabaseSetupService } from './database-setup.service'; // Import the service

@Global()
@Module({
  imports: [
      ConfigModule, // Ensure ConfigService is available
  ],
  // Provide the imported services
  providers: [SupabaseService, DatabaseSetupService],
  // Export SupabaseService so it can be injected globally
  exports: [SupabaseService],
})
export class SupabaseModule {} 