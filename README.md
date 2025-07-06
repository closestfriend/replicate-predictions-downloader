# Replicate Predictions Downloader

A Node.js script to download and organize all your Replicate predictions, including images, metadata, and other outputs before they expire.

![Replicate Downloader Banner](https://replicate.com/static/favicon.png)

## Features

- 📥 Downloads all predictions from your Replicate account
- 🗂️ Organizes files by model and date
- 🗜️ Creates ZIP archives for each model (optional)
- 📊 Saves enhanced metadata for all predictions
- 📈 Shows detailed download statistics
- ⏱️ Preserves predictions before they expire

## Why Use This Tool?

Replicate only stores your predictions temporarily. This tool helps you preserve your valuable work before it disappears, with intelligent organization to make your outputs easy to find later.

## Setup

### Prerequisites

- Node.js 18+ installed
- A Replicate account with API access

### Installation

#### Option 1: Clone and install locally

```bash
# Clone the repository
git clone https://github.com/closestfriend/replicate-predictions-downloader.git
cd replicate-predictions-downloader

# Install dependencies
npm install
```

#### Option 2: Install via npm (coming soon)

```bash
npm install -g replicate-predictions-downloader
```

### API Token Setup

Get your Replicate API token from: https://replicate.com/account/api-tokens

Set your API token using one of these methods:

1. Export in terminal (temporary):
   ```bash
   export REPLICATE_API_TOKEN=your_token_here
   ```

2. Create a .env file (permanent):
   ```
   REPLICATE_API_TOKEN=your_token_here
   ```

## Usage

Run the script:
```bash
# If installed locally
npm start

# Or directly
node index.js

# If installed globally (coming soon)
replicate-downloader
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

## Output Structure

The tool creates a directory structure like this:

```
replicate_outputs_YYYY-MM-DD/
├── by-model/
│   ├── model1/
│   │   ├── YYYY-MM-DD_model1_prompt_id.png
│   │   ├── YYYY-MM-DD_model1_prompt_id.jpg
│   │   └── ...
│   ├── model2/
│   │   └── ...
│   └── ...
├── model1.zip
├── model2.zip
└── ...
replicate_metadata_YYYY-MM-DD.json
```

## Support

This is a tool I created for personal use. I'm sharing it in case others find it helpful, but I may not be able to provide extensive support. Pull requests are welcome!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Security Note

⚠️ Never commit your API token or .env file to version control!
The included .gitignore will help prevent this.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Background

This tool was created while working on LLM behavior/personality research to preserve valuable predictions before they expired.