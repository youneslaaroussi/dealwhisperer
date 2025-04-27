import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, QueryResult } from 'jsforce';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import { Opportunity } from '../types/opportunity';

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
} 