"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
    anythingLLMUrl: "http://localhost:3001",
    apiKey: "",
    workspaceSlug: "obsidian-vault",
    folderName: "Obsidian",
    autoSync: false,
    syncOnSave: true,
};
class AnythingLLMSyncSettingsTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "AnythingLLM Sync Settings" });
        new obsidian_1.Setting(containerEl)
            .setName("AnythingLLM URL")
            .setDesc("The URL of your AnythingLLM instance")
            .addText((text) => text
            .setPlaceholder("http://localhost:3001")
            .setValue(this.plugin.settings.anythingLLMUrl)
            .onChange(async (value) => {
            this.plugin.settings.anythingLLMUrl = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("API Key")
            .setDesc("Your AnythingLLM API key")
            .addText((text) => {
            text.inputEl.type = "password";
            text
                .setPlaceholder("Enter your API key")
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                this.plugin.settings.apiKey = value;
                await this.plugin.saveSettings();
            });
        });
        new obsidian_1.Setting(containerEl)
            .setName("Workspace Slug")
            .setDesc("The slug of your AnythingLLM workspace")
            .addText((text) => text
            .setPlaceholder("obsidian-vault")
            .setValue(this.plugin.settings.workspaceSlug)
            .onChange(async (value) => {
            this.plugin.settings.workspaceSlug = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Folder Name")
            .setDesc("The folder name in AnythingLLM for your documents")
            .addText((text) => text
            .setPlaceholder("Obsidian")
            .setValue(this.plugin.settings.folderName)
            .onChange(async (value) => {
            this.plugin.settings.folderName = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Auto Sync")
            .setDesc("Automatically sync on plugin load")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.autoSync)
            .onChange(async (value) => {
            this.plugin.settings.autoSync = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Sync on Save")
            .setDesc("Sync file when saving in Obsidian")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.syncOnSave)
            .onChange(async (value) => {
            this.plugin.settings.syncOnSave = value;
            await this.plugin.saveSettings();
        }));
        new obsidian_1.Setting(containerEl)
            .setName("Test Connection")
            .setDesc("Test the connection to AnythingLLM")
            .addButton((button) => button.setButtonText("Test").onClick(async () => {
            await this.plugin.testConnection();
        }));
    }
}
class AnythingLLMSyncPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        this.settings = DEFAULT_SETTINGS;
        this.syncState = {};
        this.statusBarItem = null;
        this.syncInProgress = false;
        this.syncTimeouts = new Map();
    }
    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: "sync-to-anythingllm",
            name: "Sync vault to AnythingLLM",
            callback: () => this.syncVault(),
        });
        this.addCommand({
            id: "sync-single-file",
            name: "Sync current file to AnythingLLM",
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    this.syncFile(file);
                }
                else {
                    new obsidian_1.Notice("No active file");
                }
            },
        });
        this.addCommand({
            id: "force-resync-all",
            name: "Force resync all files to AnythingLLM",
            callback: () => this.forceResyncAll(),
        });
        this.addSettingTab(new AnythingLLMSyncSettingsTab(this.app, this));
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText("AnythingLLM: Ready");
        if (this.settings.autoSync) {
            this.syncVault();
        }
        this.registerEvent(this.app.vault.on("modify", (file) => {
            if (!(file instanceof obsidian_1.TFile) || file.extension !== "md")
                return;
            if (!this.settings.syncOnSave)
                return;
            const existing = this.syncTimeouts.get(file.path);
            if (existing)
                clearTimeout(existing);
            this.syncTimeouts.set(file.path, setTimeout(() => {
                this.syncTimeouts.delete(file.path);
                this.syncFile(file);
            }, 2000));
        }));
        this.registerEvent(this.app.vault.on("create", (file) => {
            if (!(file instanceof obsidian_1.TFile) || file.extension !== "md")
                return;
            if (!this.settings.syncOnSave)
                return;
            this.syncFile(file);
        }));
    }
    onunload() {
        for (const t of this.syncTimeouts.values()) {
            clearTimeout(t);
        }
        this.syncTimeouts.clear();
    }
    getStateFilePath() {
        return `${this.manifest.dir}/sync-state.json`;
    }
    async loadSettings() {
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...(await this.loadData()),
        };
        try {
            const data = await this.app.vault.adapter.read(this.getStateFilePath());
            this.syncState = JSON.parse(data);
        }
        catch {
            this.syncState = {};
        }
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    async saveSyncState() {
        await this.app.vault.adapter.write(this.getStateFilePath(), JSON.stringify(this.syncState, null, 2));
    }
    async fileHash(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }
    getSafeFileName(file) {
        return file.path.replace(/\//g, "_") + ".md";
    }
    getApiHeaders() {
        return {
            Authorization: `Bearer ${this.settings.apiKey}`,
            "Content-Type": "application/json",
        };
    }
    async testConnection() {
        const { anythingLLMUrl, apiKey } = this.settings;
        if (!apiKey) {
            new obsidian_1.Notice("Please set your API key first");
            return;
        }
        try {
            const response = await fetch(`${anythingLLMUrl}/api/v1/system`, {
                method: "GET",
                headers: this.getApiHeaders(),
            });
            if (response.ok) {
                new obsidian_1.Notice("Connected to AnythingLLM");
            }
            else {
                new obsidian_1.Notice(`Connection failed: ${response.statusText}`);
            }
        }
        catch (error) {
            new obsidian_1.Notice(`Connection error: ${error.message}`);
        }
    }
    async createFolder() {
        const { anythingLLMUrl, folderName } = this.settings;
        try {
            const response = await fetch(`${anythingLLMUrl}/api/v1/document/create-folder`, {
                method: "POST",
                headers: this.getApiHeaders(),
                body: JSON.stringify({ name: folderName }),
            });
            return response.ok || response.status === 400 || response.status === 500;
        }
        catch (error) {
            console.error("Error creating folder:", error);
            return false;
        }
    }
    async syncFile(file) {
        if (this.syncInProgress) {
            new obsidian_1.Notice("Sync in progress, file queued");
            return;
        }
        this.syncInProgress = true;
        this.updateStatus("Syncing...");
        try {
            const fileContent = await this.app.vault.read(file);
            if (!fileContent || fileContent.trim().length === 0) {
                new obsidian_1.Notice(`Skipping empty file: ${file.name}`);
                this.syncInProgress = false;
                this.updateStatus("Ready");
                return;
            }
            const currentHash = await this.fileHash(fileContent);
            const fileKey = file.path;
            await this.createFolder();
            const formData = new FormData();
            const blob = new Blob([fileContent], { type: "text/markdown" });
            const safeName = this.getSafeFileName(file);
            formData.append("file", blob, safeName);
            const { anythingLLMUrl, folderName } = this.settings;
            const response = await fetch(`${anythingLLMUrl}/api/v1/document/upload/${folderName}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.settings.apiKey}`,
                },
                body: formData,
            });
            if (response.ok) {
                const data = await response.json();
                const docPath = data?.documents?.[0]?.location;
                if (docPath) {
                    await this.updateEmbeddings([docPath]);
                }
                this.syncState[fileKey] = currentHash;
                await this.saveSyncState();
                new obsidian_1.Notice(`Synced: ${file.name}`);
            }
            else {
                console.error("Upload failed:", await response.text());
            }
        }
        catch (error) {
            console.error("Sync error:", error);
            new obsidian_1.Notice(`Sync error: ${error.message}`);
        }
        finally {
            this.syncInProgress = false;
            this.updateStatus("Ready");
        }
    }
    async syncVault() {
        if (this.syncInProgress) {
            new obsidian_1.Notice("Sync already in progress");
            return;
        }
        this.syncInProgress = true;
        this.updateStatus("Syncing vault...");
        try {
            await this.createFolder();
            const allFiles = this.app.vault.getMarkdownFiles();
            console.log(`Found ${allFiles.length} markdown files`);
            const newState = {};
            const filesToEmbed = [];
            let uploadedCount = 0;
            for (const file of allFiles) {
                const fileContent = await this.app.vault.read(file);
                if (!fileContent || fileContent.trim().length === 0) {
                    console.log(`Skipping empty file: ${file.name}`);
                    newState[file.path] = "";
                    continue;
                }
                const currentHash = await this.fileHash(fileContent);
                newState[file.path] = currentHash;
                const needsSync = this.syncState[file.path] !== currentHash;
                console.log(`File ${file.name}: needsSync=${needsSync}`);
                if (needsSync) {
                    const formData = new FormData();
                    const blob = new Blob([fileContent], { type: "text/markdown" });
                    const safeName = this.getSafeFileName(file);
                    formData.append("file", blob, safeName);
                    const { anythingLLMUrl, folderName } = this.settings;
                    const response = await fetch(`${anythingLLMUrl}/api/v1/document/upload/${folderName}`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${this.settings.apiKey}`,
                        },
                        body: formData,
                    });
                    if (response.ok) {
                        uploadedCount++;
                        console.log(`Uploaded: ${file.name}`);
                        const data = await response.json();
                        const docPath = data?.documents?.[0]?.location;
                        if (docPath) {
                            filesToEmbed.push(docPath);
                        }
                    }
                    else {
                        console.error(`Upload failed for ${file.name}: ${response.status} ${response.statusText}`);
                    }
                }
            }
            console.log(`Uploaded ${uploadedCount} files, embedding ${filesToEmbed.length}`);
            if (filesToEmbed.length > 0) {
                await this.updateEmbeddings(filesToEmbed);
            }
            this.syncState = newState;
            await this.saveSyncState();
            new obsidian_1.Notice(`Sync complete: ${filesToEmbed.length} files updated`);
        }
        catch (error) {
            console.error("Sync error:", error);
            new obsidian_1.Notice(`Sync error: ${error.message}`);
        }
        finally {
            this.syncInProgress = false;
            this.updateStatus("Ready");
        }
    }
    async updateEmbeddings(docPaths) {
        const { anythingLLMUrl, workspaceSlug } = this.settings;
        try {
            await fetch(`${anythingLLMUrl}/api/v1/workspace/${workspaceSlug}/update-embeddings`, {
                method: "POST",
                headers: this.getApiHeaders(),
                body: JSON.stringify({ adds: docPaths, deletes: [] }),
            });
        }
        catch (error) {
            console.error("Error updating embeddings:", error);
        }
    }
    async forceResyncAll() {
        this.syncState = {};
        await this.saveSyncState();
        await this.syncVault();
    }
    updateStatus(text) {
        if (this.statusBarItem) {
            this.statusBarItem.setText(`AnythingLLM: ${text}`);
        }
    }
}
exports.default = AnythingLLMSyncPlugin;
