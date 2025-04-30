import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, QueryResult } from 'jsforce';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { Opportunity } from '../types/opportunity';

// Define expected structure for Flow output (adjust if necessary)
interface FlowOutputVariable {
  name: string;
  value: any; // Type could be string, number, boolean, etc.
}

interface FlowActionResult {
  actionName: string;
  errors: any[] | null;
  isSuccess: boolean;
  outputValues: Record<string, any> | null; // Or potentially FlowOutputVariable[]
}

@Injectable()
export class SalesforceService implements OnModuleInit {
  private readonly logger = new Logger(SalesforceService.name);
  private conn!: Connection;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    await this.init();
  }

  async init() {
    const clientId = this.config.get<string>('SF_CLIENT_ID');
    const username = this.config.get<string>('SF_USERNAME');
    const keyPath  = this.config.get<string>('SF_JWT_KEY_PATH');

    if (!clientId || !username || !keyPath) throw new Error('Missing creds');

    // 1) Build JWT
    const claim = {
      iss: clientId,
      sub: username,
      aud: 'https://login.salesforce.com',      // use test.salesforce.com for sandbox
      exp: Math.floor(Date.now() / 1000) + 3 * 60,
    };
    const assertion = jwt.sign(
      claim,
      fs.readFileSync(keyPath, 'utf8'),
      { algorithm: 'RS256' },
    );

    // 2) Connect & authorize
    this.conn = new Connection();
    await this.conn.authorize({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    this.logger.log(`✅ Salesforce JWT auth OK → ${this.conn.instanceUrl}`);
  }

  async getActiveOpportunities(): Promise<QueryResult<Opportunity>> {
    return this.conn.query<Opportunity>(
      "SELECT Id, Name, StageName, LastActivityDate, LastModifiedDate, OwnerId FROM Opportunity WHERE IsClosed = false"
    );
  }

  /**
   * Invokes a Salesforce Flow via the REST API.
   * Assumes the flow has a single text output variable named 'ColdOppList'.
   * @param flowApiName The API name of the Flow.
   * @param inputs Optional input parameters for the flow.
   * @returns The string value of the 'ColdOppList' output variable, or null if not found or on error.
   */
  async invokeFlow(flowApiName: string, inputs: Record<string, any> = {}): Promise<string | null> {
    if (!this.conn) {
      this.logger.error('Salesforce connection not initialized.');
      throw new Error('Salesforce connection not initialized.');
    }

    const flowUrl = `/services/data/v${this.conn.version}/actions/custom/flow/${flowApiName}`;
    const requestBody = { inputs: [inputs] }; // Flow API expects inputs as an array

    this.logger.log(`Invoking Flow ${flowApiName} at ${flowUrl}`);
    try {
      // Use generic request method for flow invocation
      const results = await this.conn.request<FlowActionResult[]>({
        method: 'POST',
        url: flowUrl,
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      this.logger.debug(`Flow ${flowApiName} invocation result: ${JSON.stringify(results)}`);

      // Process results - expecting a single result in the array
      if (!results || results.length === 0 || !results[0].isSuccess) {
        const errors = results?.[0]?.errors;
        this.logger.error(`Flow ${flowApiName} invocation failed: ${JSON.stringify(errors || 'Unknown error')}`);
        return null; // Indicate failure
      }

      // Extract the specific output variable - expecting 'ColdOppList'
      const outputVariables = results[0].outputValues;
      const flowOutputValue = outputVariables?.ColdOppList; // Use the correct variable name

      if (typeof flowOutputValue !== 'string') { // Check if it exists and is a string
         this.logger.warn(`Flow ${flowApiName} did not return the expected 'ColdOppList' output variable or it was not a string. Value: ${JSON.stringify(flowOutputValue)}`);
         return null;
      }

      this.logger.log(`Flow ${flowApiName} invocation successful, returning output from ColdOppList.`);
      return flowOutputValue; // Return the value directly

    } catch (error) {
      this.logger.error(`Error invoking Flow ${flowApiName}: ${error.message}`, error.stack);
      // Rethrow or handle specific jsforce errors if needed
      throw error;
    }
  }
} 