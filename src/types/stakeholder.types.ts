export interface StakeholderNotification {
    id: string; // UUID
    stakeholder_id: string; // Slack user ID
    stakeholder_role: string; // Role like 'PM', 'SalesRep1', etc
    deal_id: string;
    message_ts: string; // Slack message timestamp
    sent_at: string; // ISO timestamp
}

export interface StakeholderResponse {
    id: string; // UUID
    notification_id: string; // References StakeholderNotification.id
    response_text: string;
    response_ts: string; // Slack message timestamp
    responded_at: string; // ISO timestamp
}

export interface DealResolution {
    id: string; // UUID
    deal_id: string;
    previous_status: string;
    new_status: string;
    resolved_by?: string; // Optional stakeholder_id
    resolved_at: string; // ISO timestamp
}

export interface StakeholderResponseRate {
    stakeholder_id: string;
    stakeholder_role: string;
    sent: number;
    responded: number;
    rate: number; // Percentage
    avg_response_time?: number; // Optional average response time in minutes
}

export interface DealPerformanceMetric {
    stakeholder_id: string;
    stakeholder_role: string;
    total_deals: number;
    deals_responded: number;
    deals_closed: number;
    deals_revived: number; // Changed status from stale to active
    conversion_rate: number; // Percentage
}

// New interface for the stakeholder_mapping table
export interface StakeholderMapping {
    role: string; // PRIMARY KEY
    slack_user_id: string;
    full_name?: string; // Optional
    updated_at?: string; // ISO timestamp, managed by DB
} 