import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { AgentService } from './agent.service';
// import { mocked } from 'jest-mock'; // Not needed directly if using jest.mock

// Mock dependencies
jest.mock('axios');
jest.mock('jsonwebtoken');
jest.mock('fs');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Cast the mocked module
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AgentService', () => {
  let service: AgentService;
  let configService: ConfigService;

  beforeEach(async () => {
     // Clear mocks before each test
     mockedAxios.post.mockClear();
     (mockedJwt.sign as jest.Mock).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SF_CLIENT_ID') return 'mock-client-id';
              if (key === 'SF_USERNAME') return 'mock-username';
              if (key === 'SF_JWT_KEY_PATH') return 'mock-key-path';
              if (key === 'AGENT_ID') return 'mock-agent-id';
              if (key === 'SLACK_WEBHOOK_URL') return 'mock-slack-url';
              return undefined;
            }),
            getOrThrow: jest.fn((key: string) => {
                if (key === 'SLACK_WEBHOOK_URL') return 'mock-slack-url';
                throw new Error(`Missing config: ${key}`);
            })
          },
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('callAgent', () => {
    it('should send the correct payload to the messages endpoint', async () => {
      // Arrange
      // Mock implementations
      (mockedJwt.sign as jest.Mock).mockReturnValue('mock-assertion');
      mockedAxios.post
        // Mock token exchange
        .mockResolvedValueOnce({ data: { access_token: 'mock-token' } })
        // Mock session creation
        .mockResolvedValueOnce({ data: { sessionId: 'mock-session-id' } })
        // Mock message sending (the one we are testing)
        .mockResolvedValueOnce({ data: { messages: [{ type: 'Text', message: 'mock-reply' }] } });

      const prompt = 'Test prompt';
      
      // Act
      await service['callAgent'](prompt); // Access private method for testing

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);

      // Check the call to the messages endpoint (3rd call, index 2)
      const messagesCall = mockedAxios.post.mock.calls[2];
      const messagesUrl = messagesCall[0];
      const messagesPayload = messagesCall[1];

      expect(messagesUrl).toBe(
        'https://api.salesforce.com/einstein/ai-agent/v1/sessions/mock-session-id/messages',
      );
      expect(messagesPayload).toEqual({
        message: {
          type: 'Text',
          text: prompt,
          sequenceId: 1,
        },
      });
    });
  });
}); 