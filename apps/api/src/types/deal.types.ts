export interface ParsedDeal {
    id: string; // NOTE: This will be the Deal Name due to Flow limitations
    name: string;
}

// Structure matching Supabase latest_stale_deals table
export interface LatestStaleDealDbRecord {
    id: string; // UUID from DB
    deal_id: string;
    deal_name: string;
    identified_at: string; // ISO timestamp string
} 