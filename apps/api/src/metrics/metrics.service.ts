import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { 
    StakeholderResponseRate, 
    DealPerformanceMetric,
    StakeholderNotification,
    StakeholderResponse,
    DealResolution
} from '../types/stakeholder.types';

@Injectable()
export class MetricsService {
    private readonly logger = new Logger(MetricsService.name);

    constructor(private readonly supabaseService: SupabaseService) {}

    async getStakeholderResponseRates(): Promise<Record<string, StakeholderResponseRate>> {
        this.logger.log('Calculating stakeholder response rates...');
        
        // First, fetch all notifications
        const { data: notifications, error: notificationsError } = await this.supabaseService.supabase
            .from('stakeholder_notifications')
            .select('id, stakeholder_id, stakeholder_role')
            .returns<Pick<StakeholderNotification, 'id' | 'stakeholder_id' | 'stakeholder_role'>[]>();
        
        if (notificationsError) {
            this.logger.error(`Error fetching stakeholder notifications: ${notificationsError.message}`);
            throw notificationsError;
        }

        // Then, fetch all responses
        const { data: responses, error: responsesError } = await this.supabaseService.supabase
            .from('stakeholder_responses')
            .select('notification_id, responded_at')
            .returns<Pick<StakeholderResponse, 'notification_id' | 'responded_at'>[]>();
        
        if (responsesError) {
            this.logger.error(`Error fetching stakeholder responses: ${responsesError.message}`);
            throw responsesError;
        }

        // Group notifications by stakeholder_id
        const stakeholderNotifications: Record<string, { id: string, role: string, notificationIds: string[] }> = {};

        notifications.forEach(notification => {
            if (!stakeholderNotifications[notification.stakeholder_id]) {
                stakeholderNotifications[notification.stakeholder_id] = {
                    id: notification.stakeholder_id,
                    role: notification.stakeholder_role,
                    notificationIds: []
                };
            }
            stakeholderNotifications[notification.stakeholder_id].notificationIds.push(notification.id);
        });

        // Count responses by notification_id
        const responsesByNotification = responses.reduce((acc, response) => {
            acc[response.notification_id] = response;
            return acc;
        }, {} as Record<string, Pick<StakeholderResponse, 'notification_id' | 'responded_at'>>);

        // Calculate response rates for each stakeholder
        const result: Record<string, StakeholderResponseRate> = {};

        Object.values(stakeholderNotifications).forEach(stakeholder => {
            const sent = stakeholder.notificationIds.length;
            const responded = stakeholder.notificationIds.filter(id => responsesByNotification[id]).length;
            const rate = sent > 0 ? (responded / sent) * 100 : 0;

            result[stakeholder.id] = {
                stakeholder_id: stakeholder.id,
                stakeholder_role: stakeholder.role,
                sent,
                responded,
                rate: Math.round(rate * 100) / 100 // Round to 2 decimal places
            };
        });

        return result;
    }

    async getDealPerformanceMetrics(): Promise<Record<string, DealPerformanceMetric>> {
        this.logger.log('Calculating deal performance metrics...');
        
        // First, get all notifications by stakeholder
        const { data: notifications, error: notificationsError } = await this.supabaseService.supabase
            .from('stakeholder_notifications')
            .select('stakeholder_id, stakeholder_role, deal_id')
            .returns<Pick<StakeholderNotification, 'stakeholder_id' | 'stakeholder_role' | 'deal_id'>[]>();
        
        if (notificationsError) {
            this.logger.error(`Error fetching stakeholder notifications: ${notificationsError.message}`);
            throw notificationsError;
        }

        // Get deal resolutions
        const { data: resolutions, error: resolutionsError } = await this.supabaseService.supabase
            .from('deal_resolutions')
            .select('deal_id, previous_status, new_status, resolved_by')
            .returns<Pick<DealResolution, 'deal_id' | 'previous_status' | 'new_status' | 'resolved_by'>[]>();
        
        if (resolutionsError) {
            this.logger.error(`Error fetching deal resolutions: ${resolutionsError.message}`);
            throw resolutionsError;
        }

        // Group notifications by stakeholder
        const stakeholderDeals: Record<string, { 
            id: string, 
            role: string, 
            dealIds: Set<string> 
        }> = {};

        notifications.forEach(notification => {
            if (!stakeholderDeals[notification.stakeholder_id]) {
                stakeholderDeals[notification.stakeholder_id] = {
                    id: notification.stakeholder_id,
                    role: notification.stakeholder_role,
                    dealIds: new Set()
                };
            }
            stakeholderDeals[notification.stakeholder_id].dealIds.add(notification.deal_id);
        });

        // Group resolutions by deal_id
        const dealResolutions: Record<string, Pick<DealResolution, 'deal_id' | 'previous_status' | 'new_status' | 'resolved_by'>[]> = {};
        
        resolutions.forEach(resolution => {
            if (!dealResolutions[resolution.deal_id]) {
                dealResolutions[resolution.deal_id] = [];
            }
            dealResolutions[resolution.deal_id].push(resolution);
        });

        // Calculate metrics for each stakeholder
        const result: Record<string, DealPerformanceMetric> = {};

        Object.values(stakeholderDeals).forEach(stakeholder => {
            const totalDeals = stakeholder.dealIds.size;
            let dealsResponded = 0;
            let dealsClosed = 0;
            let dealsRevived = 0;

            stakeholder.dealIds.forEach(dealId => {
                const resolutionsForDeal = dealResolutions[dealId] || [];
                
                // Check if any resolution was attributed to this stakeholder
                const stakeholderResolutions = resolutionsForDeal.filter(
                    r => r.resolved_by === stakeholder.id
                );
                
                if (stakeholderResolutions.length > 0) {
                    dealsResponded++;
                    
                    // Check for status changes
                    stakeholderResolutions.forEach(resolution => {
                        if (resolution.new_status === 'Closed Won') {
                            dealsClosed++;
                        }
                        
                        if (resolution.previous_status === 'Stalled' && 
                            (resolution.new_status === 'Active' || resolution.new_status === 'Negotiation')) {
                            dealsRevived++;
                        }
                    });
                }
            });

            const conversionRate = totalDeals > 0 ? (dealsClosed / totalDeals) * 100 : 0;

            result[stakeholder.id] = {
                stakeholder_id: stakeholder.id,
                stakeholder_role: stakeholder.role,
                total_deals: totalDeals,
                deals_responded: dealsResponded,
                deals_closed: dealsClosed,
                deals_revived: dealsRevived,
                conversion_rate: Math.round(conversionRate * 100) / 100 // Round to 2 decimal places
            };
        });

        return result;
    }

    async trackDealResolution(dealId: string, previousStatus: string, newStatus: string, resolvedBy?: string): Promise<void> {
        this.logger.log(`Tracking deal resolution: ${dealId} - ${previousStatus} → ${newStatus}`);
        
        try {
            const { error } = await this.supabaseService.supabase
                .from('deal_resolutions')
                .insert({
                    deal_id: dealId,
                    previous_status: previousStatus,
                    new_status: newStatus,
                    resolved_by: resolvedBy || null
                });
            
            if (error) {
                this.logger.error(`Error tracking deal resolution: ${error.message}`);
                throw error;
            }
            
            this.logger.log(`Successfully tracked deal resolution for ${dealId}`);
        } catch (error) {
            this.logger.error(`Failed to track deal resolution: ${error.message}`, error.stack);
            throw error;
        }
    }
} 