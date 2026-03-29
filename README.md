# Obsian AnythingLLM Sync

Plugin Obsidian pour synchroniser votre vault avec AnythingLLM pour la fonctionnalité RAG (Retrieval-Augmented Generation).

## Fonctionnalités

- Synchronisation automatique ou manuelle de votre vault Obsidian vers AnythingLLM
- Sync des fichiers individuels ou de tout le vault
- Détection des modifications par hash pour éviter les re-uploads inutiles
- Support des fichiers vides (ignorés)
- Interface de configuration simple

## Installation

1. Allez dans **Settings** → **Community plugins**
2. Désactivez le mode sans risque (Safe mode)
3. Recherchez "Obsian AnythingLLM Sync"
4. Installez et activez le plugin

## Configuration

1. Ouvrez les paramètres du plugin
2. Configurez :
   - **AnythingLLM URL** : L'URL de votre instance AnythingLLM (ex: `http://localhost:3001`)
   - **API Key** : Votre clé API AnythingLLM (Settings → API Keys dans AnythingLLM)
   - **Workspace Slug** : Le slug de votre workspace (ex: `my-workspace`)
   - **Folder Name** : Le nom du dossier dans AnythingLLM (ex: `Obsidian`)

3. Cliquez sur "Test" pour vérifier la connexion

## Utilisation

### Commandes

- **Sync vault to AnythingLLM** : Synchronise tout le vault
- **Sync current file** : Synchronise le fichier actuellement ouvert
- **Force resync all files** : Force la ré-synchronisation de tous les fichiers (efface le cache)

### Options

- **Auto Sync** : Synchronise automatiquement au chargement du plugin
- **Sync on Save** : Synchronise automatiquement à chaque sauvegarde d'un fichier

## Générer une clé API dans AnythingLLM

1. Allez dans AnythingLLM
2. Settings → API Keys
3. Cliquez sur "Create New Key"
4. Copiez la clé et collez-la dans les paramètres du plugin

## API AnythingLLM

Ce plugin utilise l'API officielle AnythingLLM :
- `POST /api/v1/document/create-folder` - Créer le dossier
- `POST /api/v1/document/upload/{folder}` - Uploader un fichier
- `POST /api/v1/workspace/{slug}/update-embeddings` - Mettre à jour les embeddings

## Dépannage

Si la synchronisation échoue :
1. Vérifiez qu'AnythingLLM est en cours d'exécution
2. Vérifiez que votre clé API est correcte
3. Vérifiez que le workspace existe dans AnythingLLM
4. Les fichiers vides sont automatiquement ignorés

## Licence

MIT License
