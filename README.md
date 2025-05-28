# Google Maps Exploreer

An Electron application for exploring and managing business data with through Google Maps

## Features

- Business data management and storage
- Interactive map visualization
- Supabase database integration
- Data export functionality
- Archive management by date

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- A Supabase account and project

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/aly-001/google-maps-explorer.git
cd my-electron-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

This application requires Supabase credentials to function properly. These are kept secure through environment variables.

#### Create your environment file

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=your_supabase_project_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

#### Getting Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy the following values:
   - **Project URL** → Use as `SUPABASE_URL`
   - **Project API keys** → **anon** **public** → Use as `SUPABASE_ANON_KEY`

### 4. Database Setup

Ensure your Supabase project has the required tables:

- `current_list` - Main business data table
- Required columns: `name`, `address`, `phone`, `website`, `coordinates`, `created_at`

## Development

### Start the application in development mode

```bash
npm start
```

This will start the Electron application with hot reload enabled.

## Project Structure

```
src/
├── main.ts           # Main Electron process
├── preload.ts        # Preload script for secure renderer communication
├── renderer.tsx      # React application entry point
├── App.tsx           # Main React component
├── supabaseClient.ts # Supabase client configuration
├── ipcChannels.ts    # IPC channel definitions
├── types/            # TypeScript type definitions
└── components/       # React components
```

## Security Notes

- **Never commit `.env` files** - They contain sensitive credentials
- The `.env` file is already included in `.gitignore`
- Environment variables are securely passed from main to renderer process
- Supabase credentials are only exposed to the application, not to the browser

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

## Troubleshooting

### Environment Variables Not Loading

If you see errors about missing Supabase URL or keys:

1. Verify your `.env` file exists and contains the correct values
2. Restart the application after making changes to `.env`
3. Check that your Supabase credentials are valid

### Build Issues

If you encounter build issues:

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Ensure you're using a compatible Node.js version
