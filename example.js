// Example of using ReplicateDownloader as a module
import ReplicateDownloader from './index.js';
import dotenv from 'dotenv';

// Load environment variables from .env file (if present)
dotenv.config();

async function example() {
  // Check if API token is available
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ Error: REPLICATE_API_TOKEN not found in environment variables');
    console.log('Please set your API token before running this example');
    process.exit(1);
  }
  
  console.log('Starting Replicate Downloader example...');
  
  // Create a new instance with your API token
  const downloader = new ReplicateDownloader(process.env.REPLICATE_API_TOKEN);
  
  // Optional: Override default configuration
  // downloader.config = {
  //   requestDelay: 500,     // Increase delay between API requests
  //   downloadDelay: 200,    // Increase delay between downloads
  //   maxPromptLength: 30,   // Shorter prompt in filenames
  //   createZips: false,     // Disable ZIP creation
  //   enhancedMetadata: true // Keep enhanced metadata
  // };
  
  try {
    // Run the downloader
    await downloader.run();
    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Example failed:', error.message);
  }
}

// Run the example
example().catch(console.error);