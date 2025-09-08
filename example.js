// Example of using ReplicateDownloader as a module with date filtering
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
  
  // Example 1: Download all predictions (default behavior)
  console.log('\n📥 Example 1: Download all predictions');
  const _downloader1 = new ReplicateDownloader(process.env.REPLICATE_API_TOKEN);
  // await downloader1.run(); // Uncomment to run
  
  // Example 2: Download predictions since a specific date
  console.log('\n📅 Example 2: Download predictions since 2024-01-01');
  const _downloader2 = new ReplicateDownloader(process.env.REPLICATE_API_TOKEN, {
    since: '2024-01-01'
  });
  // await downloader2.run(); // Uncomment to run
  
  // Example 3: Download predictions in a date range
  console.log('\n📅 Example 3: Download predictions between 2024-01-01 and 2024-01-31');
  const _downloader3 = new ReplicateDownloader(process.env.REPLICATE_API_TOKEN, {
    since: '2024-01-01',
    until: '2024-01-31'
  });
  // await downloader3.run(); // Uncomment to run
  
  // Example 4: Incremental download (since last run)
  console.log('\n🔄 Example 4: Incremental download since last successful run');
  const _downloader4 = new ReplicateDownloader(process.env.REPLICATE_API_TOKEN, {
    lastRun: true
  });
  // await downloader4.run(); // Uncomment to run
  
  // Example 5: Download predictions from the last 7 days
  console.log('\n📅 Example 5: Download predictions from the last 7 days');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const _downloader5 = new ReplicateDownloader(process.env.REPLICATE_API_TOKEN, {
    since: sevenDaysAgo.toISOString()
  });
  // await downloader5.run(); // Uncomment to run
  
  console.log('\n💡 To run any example, uncomment the corresponding await line');
  console.log('💡 The tool automatically saves state for incremental downloads');
  console.log('💡 Use --help for command-line options when running directly');
}

// Run the example
example().catch(console.error);