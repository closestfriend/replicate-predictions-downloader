# Replicate Predictions Downloader

A Node.js script to download and organize all your Replicate predictions, including images, metadata, and other outputs.

## Features

- Downloads all predictions from your Replicate account
- Organizes files by model and date
- Creates ZIP archives for each model (optional)
- Saves enhanced metadata for all predictions
- Shows detailed download statistics

## Setup

1. Install Node.js if you haven't already
2. Install dependencies:
   ```bash
   npm install fs path https archiver
   ```

3. Get your Replicate API token from: https://replicate.com/account/api-tokens

4. Set your API token using one of these methods:

   a. Export in terminal (temporary):
   ```bash
   export REPLICATE_API_TOKEN=your_token_here
   ```

   b. Create a .env file (permanent):
   ```
   REPLICATE_API_TOKEN=your_token_here
   ```

## Usage

Run the script:
```bash
node replicate_downloaderv3.js
```

The script will:
1. Fetch all your predictions from Replicate
2. Download all outputs
3. Organize them by model
4. Create ZIP archives (if enabled)
5. Save detailed metadata

## Configuration

You can adjust these settings in the CONFIG object:
- `requestDelay`: Delay between API requests (ms)
- `downloadDelay`: Delay between downloads (ms)
- `maxPromptLength`: Maximum length for prompt in filenames
- `createZips`: Whether to create ZIP archives
- `enhancedMetadata`: Whether to save enhanced metadata

## Security Note

⚠️ Never commit your API token or .env file to version control!
The included .gitignore will help prevent this. 