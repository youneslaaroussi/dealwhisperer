// Structure matching Supabase active_slack_threads table
export interface ActiveSlackThread {
    thread_ts: string;
    deal_id: string;
    deal_name: string;
    channel_id: string;
    created_at: string; // Should be ISO date string from DB
} 