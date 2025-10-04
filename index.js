#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import archiver from 'archiver';
import { Command } from 'commander';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get API token from environment variable
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Configuration
const CONFIG = {
    requestDelay: 200, // ms between requests (adjust for your CPU)
    downloadDelay: 100, // ms between downloads
    maxPromptLength: 50, // chars for filename
    createZips: true,
    enhancedMetadata: true
};

class ReplicateDownloader {
    constructor(apiToken, options = {}) {
        this.apiToken = apiToken;
        this.baseUrl = 'https://api.replicate.com/v1';
        this.allPredictions = [];
        this.downloadStats = {
            byModel: {},
            totalFiles: 0,
            totalSize: 0
        };
        
        // Date filtering options
        this.dateFilters = {
            since: options.since || null,
            until: options.until || null,
            lastRun: options.lastRun || false
        };
        
        this.stateFile = '.replicate-downloader-state.json';
    }

    // Load state from previous runs
    loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                return state;
            }
        } catch (error) {
            console.warn('Warning: Could not load state file:', error.message);
        }
        return { lastSuccessfulRun: null };
    }

    // Save state for future runs
    saveState(state) {
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.warn('Warning: Could not save state file:', error.message);
        }
    }

    // Parse date string to ISO format
    parseDate(dateStr) {
        if (!dateStr) return null;

        // Support common relative phrases
        const input = String(dateStr).trim().toLowerCase();
        const nowMs = Date.now();

        // Yesterday
        if (input === 'yesterday') {
            return new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
        }

        // "N <unit> ago" where unit ∈ minutes/hours/days/weeks/months/years
        const relMatch = input.match(/^(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago$/i);
        if (relMatch) {
            const amount = parseInt(relMatch[1], 10);
            const unit = relMatch[2];

            const unitToMs = {
                minute: 60 * 1000,
                minutes: 60 * 1000,
                hour: 60 * 60 * 1000,
                hours: 60 * 60 * 1000,
                day: 24 * 60 * 60 * 1000,
                days: 24 * 60 * 60 * 1000,
                week: 7 * 24 * 60 * 60 * 1000,
                weeks: 7 * 24 * 60 * 60 * 1000,
                // Approximations for broader ranges
                month: 30 * 24 * 60 * 60 * 1000,
                months: 30 * 24 * 60 * 60 * 1000,
                year: 365 * 24 * 60 * 60 * 1000,
                years: 365 * 24 * 60 * 60 * 1000
            };

            const deltaMs = amount * (unitToMs[unit] || 0);
            if (deltaMs > 0) {
                return new Date(nowMs - deltaMs).toISOString();
            }
        }

        // Fallback to native parser (ISO, RFC, etc.)
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date format: ${dateStr}. Use formats like "2024-01-15", "2024-01-15T10:30:00Z", or "2 days ago"`);
        }

        return date.toISOString();
    }

    // Get date filter parameters for API (server may ignore these)
    getDateFilterParams() {
        const params = new URLSearchParams();
        
        let sinceDate = this.dateFilters.since;
        
        // Handle --last-run option
        if (this.dateFilters.lastRun) {
            const state = this.loadState();
            if (state.lastSuccessfulRun) {
                sinceDate = state.lastSuccessfulRun;
                console.log(`Using last run date: ${sinceDate}`);
            } else {
                console.log('No previous run found, downloading all predictions');
            }
        }
        
        if (sinceDate) {
            const parsedSince = this.parseDate(sinceDate);
            // Add a small buffer to avoid edge cases
            const sinceBuffer = new Date(new Date(parsedSince).getTime() - 1000);
            params.append('created_at.gte', sinceBuffer.toISOString());
        }
        
        if (this.dateFilters.until) {
            const parsedUntil = this.parseDate(this.dateFilters.until);
            params.append('created_at.lte', parsedUntil);
        }
        
        return params.toString();
    }

    // Compute client-side date bounds for filtering
    getDateFilterBounds() {
        let sinceDate = this.dateFilters.since;
        if (this.dateFilters.lastRun) {
            const state = this.loadState();
            if (state.lastSuccessfulRun) {
                sinceDate = state.lastSuccessfulRun;
            }
        }
        let sinceIsoBuffer = null;
        if (sinceDate) {
            const parsedSince = this.parseDate(sinceDate);
            const sinceBuffer = new Date(new Date(parsedSince).getTime() - 1000);
            sinceIsoBuffer = sinceBuffer.toISOString();
        }
        let untilIso = null;
        if (this.dateFilters.until) {
            untilIso = this.parseDate(this.dateFilters.until);
        }
        return { sinceIsoBuffer, untilIso };
    }

    // Make authenticated request to Replicate API
    async makeRequest(url) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Token ${this.apiToken}`,
                    'User-Agent': 'ReplicateDownloader/2.0'
                }
            };

            https.get(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                });
            }).on('error', reject);
        });
    }

    // Sanitize filename
    sanitizeFilename(str) {
        return str.replace(/[^a-zA-Z0-9\-_\s]/g, '')
                 .replace(/\s+/g, '-')
                 .toLowerCase()
                 .substring(0, CONFIG.maxPromptLength);
    }

    // Extract model name from version or URL
    extractModelName(prediction) {
        if (prediction.model) {
            return prediction.model.split('/').pop();
        }
        if (prediction.version && prediction.version.model) {
            return prediction.version.model.split('/').pop();
        }
        if (prediction.urls && prediction.urls.get) {
            const urlParts = prediction.urls.get.split('/');
            const modelIndex = urlParts.indexOf('models');
            if (modelIndex !== -1 && urlParts[modelIndex + 1]) {
                return urlParts[modelIndex + 1];
            }
        }
        return 'unknown-model';
    }

    // Extract meaningful prompt/input info
    extractPromptInfo(prediction) {
        const input = prediction.input || {};
        
        // Common prompt fields
        const promptFields = ['prompt', 'text', 'description', 'input_text', 'query'];
        
        for (const field of promptFields) {
            if (input[field] && typeof input[field] === 'string') {
                return this.sanitizeFilename(input[field]);
            }
        }
        
        // Try to find any string input that looks like a prompt
        for (const [_key, value] of Object.entries(input)) {
            if (typeof value === 'string' && value.length > 5 && value.length < 200) {
                return this.sanitizeFilename(value);
            }
        }
        
        return 'no-prompt';
    }

    // Generate enhanced filename
    generateFilename(prediction, fileIndex, extension) {
        const date = new Date(prediction.created_at).toISOString().split('T')[0];
        const modelName = this.extractModelName(prediction);
        const promptInfo = this.extractPromptInfo(prediction);
        const predictionId = prediction.id.substring(0, 8); // Short ID
        
        const suffix = fileIndex > 0 ? `_${fileIndex + 1}` : '';
        return `${date}_${modelName}_${promptInfo}_${predictionId}${suffix}.${extension}`;
    }

    // Download a file from URL
    async downloadFile(url, filepath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filepath);
            https.get(url, (response) => {
                const contentLength = parseInt(response.headers['content-length'] || '0');
                
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({
                        filepath,
                        size: contentLength
                    });
                });
            }).on('error', (err) => {
                fs.unlink(filepath, () => {}); // Delete incomplete file
                reject(err);
            });
        });
    }

    // Fetch all predictions with pagination and date filtering
    async fetchAllPredictions() {
        let nextUrl = `${this.baseUrl}/predictions`;
        let page = 1;

        // Apply date filtering (server may ignore these; we also filter client-side)
        const dateParams = this.getDateFilterParams();
        if (dateParams) {
            nextUrl += `?${dateParams}`;
            console.log('Applying date filters (server or client-side):', dateParams);
        }

        // Client-side bounds
        const { sinceIsoBuffer, untilIso } = this.getDateFilterBounds();
        if (sinceIsoBuffer || untilIso) {
            console.log('Client-side date bounds:', { sinceIsoBuffer, untilIso });
        }

        console.log('Starting to fetch predictions...');

        while (nextUrl) {
            console.log(`Fetching page ${page}...`);
            
            try {
                const response = await this.makeRequest(nextUrl);
                
                if (response.results) {
                    const pageResults = response.results;
                    this.allPredictions.push(...pageResults);
                    console.log(`Found ${pageResults.length} predictions on page ${page}`);
                    console.log(`Total so far (pre-filter): ${this.allPredictions.length}`);

                    // Heuristic early stop: if all items are older than since bound, stop paginating
                    if (sinceIsoBuffer && pageResults.length > 0) {
                        const allOlder = pageResults.every(p => p.created_at && p.created_at < sinceIsoBuffer);
                        if (allOlder) {
                            console.log('Reached items older than since bound; stopping pagination early');
                            nextUrl = null;
                        }
                    }
                }

                // Handle pagination with date filters
                if (response.next) {
                    // Ensure date filters are preserved in next URL
                    if (dateParams && !response.next.includes('created_at')) {
                        const separator = response.next.includes('?') ? '&' : '?';
                        nextUrl = `${response.next}${separator}${dateParams}`;
                    } else {
                        nextUrl = response.next;
                    }
                } else {
                    nextUrl = null;
                }
                
                page++;

                // Custom delay
                await new Promise(resolve => setTimeout(resolve, CONFIG.requestDelay));

            } catch (error) {
                console.error(`Error fetching page ${page}:`, error.message);
                break;
            }
        }

        // Final client-side filter within bounds
        if (this.allPredictions.length > 0) {
            const before = this.allPredictions.length;
            this.allPredictions = this.allPredictions.filter(p => {
                const created = p.created_at;
                if (!created) return true;
                if (sinceIsoBuffer && created < sinceIsoBuffer) return false;
                if (untilIso && created > untilIso) return false;
                return true;
            });
            if (sinceIsoBuffer || untilIso) {
                console.log(`Applied client-side date filter: ${before} -> ${this.allPredictions.length}`);
            }
        }

        console.log(`\nTotal predictions fetched (post-filter): ${this.allPredictions.length}`);
        return this.allPredictions;
    }

    // Save enhanced metadata
    async saveEnhancedMetadata() {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `replicate_metadata_${timestamp}.json`;
        
        // Organize metadata by model
        const byModel = {};
        const modelStats = {};
        
        this.allPredictions.forEach(prediction => {
            const modelName = this.extractModelName(prediction);
            
            if (!byModel[modelName]) {
                byModel[modelName] = [];
                modelStats[modelName] = {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    canceled: 0
                };
            }
            
            byModel[modelName].push({
                id: prediction.id,
                created_at: prediction.created_at,
                status: prediction.status,
                input: prediction.input,
                prompt_summary: this.extractPromptInfo(prediction),
                has_output: !!prediction.output,
                urls: prediction.urls
            });
            
            modelStats[modelName].total++;
            modelStats[modelName][prediction.status]++;
        });

        const metadata = {
            exported_at: new Date().toISOString(),
            total_predictions: this.allPredictions.length,
            model_stats: modelStats,
            predictions_by_model: byModel,
            raw_predictions: this.allPredictions // Full data for reference
        };

        fs.writeFileSync(filename, JSON.stringify(metadata, null, 2));
        console.log(`Saved enhanced metadata to: ${filename}`);
        return filename;
    }

    // Create ZIP archive for a model
    async createModelZip(modelName, modelDir) {
        return new Promise((resolve, reject) => {
            const zipPath = `${modelDir}.zip`;
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`  Created ZIP: ${zipPath} (${archive.pointer()} bytes)`);
                resolve(zipPath);
            });

            archive.on('error', reject);
            archive.pipe(output);
            
            // Add all files from the model directory
            archive.directory(modelDir, false);
            archive.finalize();
        });
    }

    // Download and organize outputs by model
    async downloadAndOrganizeOutputs() {
        const timestamp = new Date().toISOString().split('T')[0];
        const baseDir = `replicate_outputs_${timestamp}`;
        
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir);
        }

        console.log(`\nDownloading and organizing files in: ${baseDir}/`);

        let totalDownloaded = 0;
        let totalErrors = 0;
        const modelDirs = new Set();

        // Process successful predictions only
        const successfulPredictions = this.allPredictions.filter(p => 
            p.status === 'succeeded' && p.output
        );

        console.log(`Processing ${successfulPredictions.length} successful predictions...`);

        for (let i = 0; i < successfulPredictions.length; i++) {
            const prediction = successfulPredictions[i];
            const modelName = this.extractModelName(prediction);
            
            // Create model directory
            const modelDir = path.join(baseDir, 'by-model', modelName);
            if (!fs.existsSync(modelDir)) {
                fs.mkdirSync(modelDir, { recursive: true });
            }
            modelDirs.add(modelDir);

            console.log(`[${i + 1}/${successfulPredictions.length}] Processing ${modelName} prediction ${prediction.id.substring(0, 8)}...`);

            try {
                // Extract output URLs
                let outputs = [];
                
                if (Array.isArray(prediction.output)) {
                    outputs = prediction.output;
                } else if (typeof prediction.output === 'string' && prediction.output.startsWith('http')) {
                    outputs = [prediction.output];
                } else if (prediction.output && typeof prediction.output === 'object') {
                    outputs = Object.values(prediction.output).filter(val => 
                        typeof val === 'string' && val.startsWith('http')
                    );
                }

                // Download each output file
                for (let j = 0; j < outputs.length; j++) {
                    const url = outputs[j];
                    if (url && url.startsWith('http')) {
                        try {
                            const extension = url.split('.').pop().split('?')[0] || 'bin';
                            const filename = this.generateFilename(prediction, j, extension);
                            const filepath = path.join(modelDir, filename);
                            
                            const result = await this.downloadFile(url, filepath);
                            totalDownloaded++;
                            this.downloadStats.totalFiles++;
                            this.downloadStats.totalSize += result.size;
                            
                            if (!this.downloadStats.byModel[modelName]) {
                                this.downloadStats.byModel[modelName] = { files: 0, size: 0 };
                            }
                            this.downloadStats.byModel[modelName].files++;
                            this.downloadStats.byModel[modelName].size += result.size;
                            
                            console.log(`  ✓ ${filename}`);
                        } catch (downloadError) {
                            console.error(`  ✗ Failed to download: ${downloadError.message}`);
                            totalErrors++;
                        }
                    }
                }

                // Delay between predictions
                await new Promise(resolve => setTimeout(resolve, CONFIG.downloadDelay));

            } catch (error) {
                console.error(`Error processing prediction ${prediction.id}:`, error.message);
                totalErrors++;
            }
        }

        // Create ZIP files for each model if enabled
        if (CONFIG.createZips) {
            console.log('\nCreating ZIP archives...');
            for (const modelDir of modelDirs) {
                try {
                    await this.createModelZip(path.basename(modelDir), modelDir);
                } catch (error) {
                    console.error(`Failed to create ZIP for ${modelDir}:`, error.message);
                }
            }
        }

        return {
            totalDownloaded,
            totalErrors,
            baseDir,
            modelCount: modelDirs.size
        };
    }

    // Format file size
    formatSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Main execution function
    async run() {
        try {
            console.log('🎵 Enhanced Replicate Predictions Downloader');
            console.log('============================================\n');

            // Fetch all predictions
            await this.fetchAllPredictions();

            if (this.allPredictions.length === 0) {
                console.log('No predictions found!');
                return;
            }

            // Save enhanced metadata
            const metadataFile = await this.saveEnhancedMetadata();

            // Download and organize outputs
            const downloadResults = await this.downloadAndOrganizeOutputs();

            console.log('\n🎉 Download Complete!');
            console.log('====================');
            console.log(`📁 Files organized in: ${downloadResults.baseDir}/`);
            console.log(`📊 Metadata saved to: ${metadataFile}`);
            console.log(`📦 Models processed: ${downloadResults.modelCount}`);
            console.log(`✅ Files downloaded: ${downloadResults.totalDownloaded}`);
            console.log(`❌ Errors: ${downloadResults.totalErrors}`);
            console.log(`💾 Total size: ${this.formatSize(this.downloadStats.totalSize)}`);

            // Show breakdown by model
            console.log('\n📈 Breakdown by Model:');
            Object.entries(this.downloadStats.byModel)
                .sort(([,a], [,b]) => b.files - a.files)
                .forEach(([model, stats]) => {
                    console.log(`  ${model}: ${stats.files} files (${this.formatSize(stats.size)})`);
                });

            // Show prediction stats
            const successful = this.allPredictions.filter(p => p.status === 'succeeded').length;
            const failed = this.allPredictions.filter(p => p.status === 'failed').length;
            const canceled = this.allPredictions.filter(p => p.status === 'canceled').length;

            console.log('\n📊 Prediction Stats:');
            console.log(`  ✅ Successful: ${successful}`);
            console.log(`  ❌ Failed: ${failed}`);
            console.log(`  ⏹️  Canceled: ${canceled}`);

            // Save state for future runs
            if (successful > 0) {
                const state = {
                    lastSuccessfulRun: new Date().toISOString(),
                    totalPredictions: this.allPredictions.length,
                    successfulPredictions: successful
                };
                this.saveState(state);
                console.log('\n💾 State saved for future incremental downloads');
            }

        } catch (error) {
            console.error('💥 Fatal error:', error.message);
        }
    }
}

// Setup command-line interface
const program = new Command();

program
    .name('replicate-downloader')
    .description('Download and organize Replicate predictions with date filtering')
    .version('2.0.0')
    .option('-s, --since <date>', 'Download predictions created since this date (ISO format, e.g., "2024-01-15" or "2 days ago")')
    .option('-u, --until <date>', 'Download predictions created until this date (ISO format)')
    .option('-l, --last-run', 'Download only predictions created since the last successful run')
    .option('--all', 'Download all predictions (default behavior)')
    .parse();

const options = program.opts();

// Usage
async function main() {
    if (!REPLICATE_API_TOKEN) {
        console.error('❌ Please set your Replicate API token in the REPLICATE_API_TOKEN environment variable!');
        console.log('🔑 Find your token at: https://replicate.com/account/api-tokens');
        console.log('\nTo set the token, you can:');
        console.log('1. Export it in your terminal:');
        console.log('   export REPLICATE_API_TOKEN=your_token_here');
        console.log('\n2. Or create a .env file with:');
        console.log('   REPLICATE_API_TOKEN=your_token_here');
        return;
    }

    // Validate date options
    if (options.since && options.lastRun) {
        console.error('❌ Cannot use both --since and --last-run options together');
        return;
    }

    if (options.until && options.lastRun) {
        console.error('❌ Cannot use both --until and --last-run options together');
        return;
    }

    const downloaderOptions = {};
    
    if (options.since) {
        downloaderOptions.since = options.since;
        console.log(`📅 Filtering predictions since: ${options.since}`);
    }
    
    if (options.until) {
        downloaderOptions.until = options.until;
        console.log(`📅 Filtering predictions until: ${options.until}`);
    }
    
    if (options.lastRun) {
        downloaderOptions.lastRun = true;
        console.log('🔄 Using incremental download (since last run)');
    }

    const downloader = new ReplicateDownloader(REPLICATE_API_TOKEN, downloaderOptions);
    await downloader.run();
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default ReplicateDownloader;