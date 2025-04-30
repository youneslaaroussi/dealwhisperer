import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);
    private readonly s3Client: S3Client;
    private readonly bucketName: string;

    constructor(private configService: ConfigService) {
        const region = this.configService.get<string>('AWS_REGION');
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        this.bucketName = this.configService.getOrThrow<string>('S3_RAG_BUCKET_NAME');

        if (!region || !accessKeyId || !secretAccessKey || !this.bucketName) {
            this.logger.error('Missing AWS S3 configuration (Region, Access Key, Secret Key, or Bucket Name)');
            throw new Error('AWS S3 configuration is incomplete.');
        }

        this.s3Client = new S3Client({
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
        });
        this.logger.log(`S3 Client initialized for region ${region} and bucket ${this.bucketName}`);
    }

    async uploadFile(fileBuffer: Buffer, originalFilename: string, mimetype: string): Promise<{ key: string, url: string }> {
        const uniqueKey = `${uuidv4()}-${originalFilename}`; // Ensure unique file names
        const uploadParams = {
            Bucket: this.bucketName,
            Key: uniqueKey,
            Body: fileBuffer,
            ContentType: mimetype,
        };

        try {
            this.logger.log(`Attempting to upload file ${originalFilename} as ${uniqueKey} to bucket ${this.bucketName}`);
            const command = new PutObjectCommand(uploadParams);
            await this.s3Client.send(command);

            const fileUrl = `https://${this.bucketName}.s3.${this.s3Client.config.region}.amazonaws.com/${uniqueKey}`;
            this.logger.log(`Successfully uploaded ${uniqueKey} to ${fileUrl}`);
            return { key: uniqueKey, url: fileUrl };
        } catch (error) {
            this.logger.error(`Failed to upload file ${originalFilename} to S3: ${error.message}`, error.stack);
            throw error;
        }
    }
} 