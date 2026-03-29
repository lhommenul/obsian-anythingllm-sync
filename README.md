# Obsian AnythingLLM Sync

Obsidian plugin to synchronize your vault with AnythingLLM for RAG (Retrieval-Augmented Generation).

## Features

- Automatic or manual synchronization of your Obsidian vault to AnythingLLM
- Sync individual files or the entire vault
- Change detection via hash to avoid unnecessary re-uploads
- Empty file support (ignored)
- Simple configuration interface

## Installation

1. Go to **Settings** → **Community plugins**
2. Disable Safe mode
3. Search for "Obsian AnythingLLM Sync"
4. Install and enable the plugin

## Configuration

1. Open the plugin settings
2. Configure:
   - **AnythingLLM URL**: Your AnythingLLM instance URL (e.g., `http://localhost:3001`)
   - **API Key**: Your AnythingLLM API key (Settings → API Keys in AnythingLLM)
   - **Workspace Slug**: Your workspace slug (e.g., `my-workspace`)
   - **Folder Name**: The folder name in AnythingLLM (e.g., `Obsidian`)

3. Click "Test" to verify the connection

## Usage

### Commands

- **Sync vault to AnythingLLM**: Synchronize the entire vault
- **Sync current file**: Synchronize the currently open file
- **Force resync all files**: Force re-synchronization of all files (clears cache)

### Options

- **Auto Sync**: Automatically sync on plugin load
- **Sync on Save**: Automatically sync on file save

## Generate an API Key in AnythingLLM

1. Go to AnythingLLM
2. Settings → API Keys
3. Click "Create New Key"
4. Copy the key and paste it into the plugin settings

## AnythingLLM API

This plugin uses the official AnythingLLM API:
- `POST /api/v1/document/create-folder` - Create folder
- `POST /api/v1/document/upload/{folder}` - Upload file
- `POST /api/v1/workspace/{slug}/update-embeddings` - Update embeddings

## Troubleshooting

If synchronization fails:
1. Verify AnythingLLM is running
2. Verify your API key is correct
3. Verify the workspace exists in AnythingLLM
4. Empty files are automatically ignored

## License

MIT License
