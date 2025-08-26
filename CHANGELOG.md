# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-12-15

### Added
- Complete rewrite with Commander.js CLI interface
- Date filtering with `--since`, `--until`, and `--last-run` options
- State tracking to prevent duplicate downloads
- Flexible date parsing (ISO dates, relative dates, natural language)
- Enhanced metadata collection and storage
- ZIP archive creation for organized storage
- Comprehensive CLI help and version commands
- Progress tracking and detailed statistics
- Intelligent filename generation from prompts

### Changed
- **Breaking**: Command-line interface completely redesigned
- **Breaking**: Output structure now organized by model and date
- **Breaking**: Requires Node.js 18+ (was 16+)
- Improved error handling and retry logic
- Better file organization and naming conventions
- Enhanced logging and user feedback

### Removed
- **Breaking**: Old command-line arguments no longer supported
- Legacy configuration options

### Fixed
- Rate limiting issues with Replicate API
- File naming conflicts and special character handling
- Memory usage optimization for large prediction sets
- Duplicate download prevention

## [1.x.x] - Previous versions

### Legacy Features
- Basic prediction downloading
- Simple file organization
- Manual duplicate management

---

## Migration Guide from v1.x to v2.0

### Command Line Changes
```bash
# Old v1.x usage
node script.js

# New v2.0 usage
node index.js
npm start
node index.js --since "2024-01-01"
node index.js --last-run
```

### New Features to Explore
- Use `--last-run` for daily/regular downloads
- Try `--since "1 week ago"` for recent predictions
- Check the new organized output structure
- Explore enhanced metadata files

### Configuration Changes
- Review the CONFIG object in `index.js` for new options
- Set up `.env` file for API token (recommended)
- Note the new `.replicate-downloader-state.json` state file

For detailed usage instructions, see the [README.md](README.md).