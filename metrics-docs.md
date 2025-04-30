# Sales Rep Performance Metrics API

This document explains how to use the new endpoints for tracking and analyzing sales rep and stakeholder performance for stale deals.

## Overview

The Metrics API provides insights into how stakeholders are responding to stale deal notifications and their effectiveness in reviving or closing deals. It tracks:

1. **Response rates** - How often stakeholders respond to notifications
2. **Deal performance** - How effectively stakeholders convert stale deals to active or closed deals

## Endpoints

### 1. Get Stakeholder Response Rates

Provides metrics on how frequently each stakeholder responds to stale deal notifications.

- **URL**: `/metrics/stakeholders/response-rates`
- **Method**: `GET`
- **Response Format**: JSON

#### Example Response

```json
{
  "U123PMID": {
    "stakeholder_id": "U123PMID",
    "stakeholder_role": "PM",
    "sent": 15,
    "responded": 12,
    "rate": 80.00,
    "avg_response_time": 120.5
  },
  "U456SR1ID": {
    "stakeholder_id": "U456SR1ID",
    "stakeholder_role": "SalesRep1",
    "sent": 25,
    "responded": 18,
    "rate": 72.00,
    "avg_response_time": 45.2
  }
}
```

### 2. Get Stakeholder Deal Performance

Provides metrics on how effectively stakeholders are reviving or closing stale deals.

- **URL**: `/metrics/stakeholders/deal-performance`
- **Method**: `GET`
- **Response Format**: JSON

#### Example Response

```json
{
  "U123PMID": {
    "stakeholder_id": "U123PMID",
    "stakeholder_role": "PM",
    "total_deals": 15,
    "deals_responded": 12,
    "deals_closed": 3,
    "deals_revived": 8,
    "conversion_rate": 20.00
  },
  "U456SR1ID": {
    "stakeholder_id": "U456SR1ID",
    "stakeholder_role": "SalesRep1",
    "total_deals": 25,
    "deals_responded": 18,
    "deals_closed": 7,
    "deals_revived": 10,
    "conversion_rate": 28.00
  }
}
```

## How It Works

1. **Tracking Notifications**: When the system sends a message to a stakeholder about a stale deal, it logs this event in the `stakeholder_notifications` table.

2. **Tracking Responses**: When a stakeholder replies to a notification, the system logs this in the `stakeholder_responses` table and links it to the original notification.

3. **Tracking Deal Status Changes**: The system analyzes stakeholder messages for indicators of status changes (e.g., "deal closed", "moving forward") and updates the `deal_resolutions` table accordingly.

4. **Computing Metrics**: The endpoints aggregate this data to calculate response rates and deal performance metrics.

## Interpretation

- **Response Rate**: Higher is better - indicates stakeholders who are actively engaging with stale deal notifications.

- **Conversion Rate**: Higher is better - indicates stakeholders who are effectively reviving or closing stale deals.

- **Deals Revived vs. Closed**: "Revived" means the deal has moved from a stale state to an active one. "Closed" means the deal has reached a final state (won or lost).

## Implementation Details

The metrics are calculated in real-time from the following tables:

- `stakeholder_notifications`: Tracks all messages sent to stakeholders
- `stakeholder_responses`: Tracks all responses from stakeholders
- `deal_resolutions`: Tracks changes in deal status

The system uses message content analysis to automatically detect when a stakeholder reports a status change through their Slack messages. 