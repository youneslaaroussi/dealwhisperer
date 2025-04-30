import { 
    Controller, 
    Post, 
    UploadedFiles, 
    UseInterceptors, 
    Logger, 
    HttpException, 
    HttpStatus 
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import { Express } from 'express'; // Import Express types

@Controller('files')
export class S3Controller {
    private readonly logger = new Logger(S3Controller.name);

    constructor(private readonly s3Service: S3Service) {}

    @Post('upload-rag')
    @UseInterceptors(FilesInterceptor('files')) // 'files' is the field name in the form-data
    async uploadRagFiles(@UploadedFiles() files: Express.Multer.File[]) {
        this.logger.log(`Received request to upload ${files?.length || 0} files for RAG.`);
        
        if (!files || files.length === 0) {
            throw new HttpException('No files uploaded.', HttpStatus.BAD_REQUEST);
        }

        const uploadResults: { key: string; url: string }[] = []; // Explicitly type the array
        try {
            for (const file of files) {
                if (!file.mimetype.startsWith('application/pdf')) {
                     this.logger.warn(`Skipping non-PDF file: ${file.originalname} (${file.mimetype})`);
                     continue; // Skip non-PDF files as requested
                }
                this.logger.log(`Processing file: ${file.originalname} (${file.size} bytes, type: ${file.mimetype})`);
                const result = await this.s3Service.uploadFile(file.buffer, file.originalname, file.mimetype);
                uploadResults.push(result);
            }
            
            if (uploadResults.length === 0) {
                return {
                    message: 'No PDF files found in the upload.',
                    uploadedFiles: []
                };
            }

            return {
                message: `Successfully uploaded ${uploadResults.length} PDF file(s) for RAG.`,
                uploadedFiles: uploadResults, // Array of { key, url }
            };
        } catch (error) {
            this.logger.error(`Error during RAG file upload: ${error.message}`, error.stack);
            throw new HttpException('Failed to upload files to S3.', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
} 