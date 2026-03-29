import { App, Plugin, Notice, TFile, PluginSettingTab, Setting } from "obsidian";

interface AnythingLLMSyncSettings {
  anythingLLMUrl: string;
  apiKey: string;
  workspaceSlug: string;
  folderName: string;
  autoSync: boolean;
  syncOnSave: boolean;
}

const DEFAULT_SETTINGS: AnythingLLMSyncSettings = {
  anythingLLMUrl: "http://localhost:3001",
  apiKey: "",
  workspaceSlug: "obsidian-vault",
  folderName: "Obsidian",
  autoSync: false,
  syncOnSave: true,
};

class AnythingLLMSyncSettingsTab extends PluginSettingTab {
  plugin: AnythingLLMSyncPlugin;

  constructor(app: App, plugin: AnythingLLMSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "AnythingLLM Sync Settings" });

    new Setting(containerEl)
      .setName("AnythingLLM URL")
      .setDesc("The URL of your AnythingLLM instance")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:3001")
          .setValue(this.plugin.settings.anythingLLMUrl)
          .onChange(async (value) => {
            this.plugin.settings.anythingLLMUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Your AnythingLLM API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Workspace Slug")
      .setDesc("The slug of your AnythingLLM workspace")
      .addText((text) =>
        text
          .setPlaceholder("obsidian-vault")
          .setValue(this.plugin.settings.workspaceSlug)
          .onChange(async (value) => {
            this.plugin.settings.workspaceSlug = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Folder Name")
      .setDesc("The folder name in AnythingLLM for your documents")
      .addText((text) =>
        text
          .setPlaceholder("Obsidian")
          .setValue(this.plugin.settings.folderName)
          .onChange(async (value) => {
            this.plugin.settings.folderName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto Sync")
      .setDesc("Automatically sync on plugin load")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSync)
          .onChange(async (value) => {
            this.plugin.settings.autoSync = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sync on Save")
      .setDesc("Sync file when saving in Obsidian")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncOnSave)
          .onChange(async (value) => {
            this.plugin.settings.syncOnSave = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Test the connection to AnythingLLM")
      .addButton((button) =>
        button.setButtonText("Test").onClick(async () => {
          await this.plugin.testConnection();
        })
      );
  }
}

export default class AnythingLLMSyncPlugin extends Plugin {
  settings: AnythingLLMSyncSettings = DEFAULT_SETTINGS;
  syncState: Record<string, string> = {};
  private statusBarItem: HTMLElement | null = null;
  private syncInProgress = false;

  async onload(): Promise<void> {
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
        } else {
          new Notice("No active file");
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

    const vault = this.app.vault as unknown as { on(name: string, callback: (file: TFile) => void): void };
    vault.on("modify", (file: TFile) => {
      if (this.settings.syncOnSave && file.extension === "md") {
        this.syncFile(file);
      }
    });

    vault.on("create", (file: TFile) => {
      if (this.settings.syncOnSave && file.extension === "md") {
        this.syncFile(file);
      }
    });
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData()),
    };

    const stateFile = ".anythingllm-sync-state.json";
    try {
      const data = await this.app.vault.adapter.read(stateFile);
      this.syncState = JSON.parse(data);
    } catch {
      this.syncState = {};
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async saveSyncState(): Promise<void> {
    const stateFile = ".anythingllm-sync-state.json";
    await this.app.vault.adapter.write(
      stateFile,
      JSON.stringify(this.syncState, null, 2)
    );
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private getApiHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.settings.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async testConnection(): Promise<void> {
    const { anythingLLMUrl, apiKey } = this.settings;

    if (!apiKey) {
      new Notice("Please set your API key first");
      return;
    }

    try {
      const response = await fetch(`${anythingLLMUrl}/api/v1/system`, {
        method: "GET",
        headers: this.getApiHeaders(),
      });

      if (response.ok) {
        const data = await response.json() as { version?: string };
        new Notice(
          `Connected to AnythingLLM: ${data.version || "Unknown version"}`
        );
      } else {
        new Notice(`Connection failed: ${response.statusText}`);
      }
    } catch (error) {
      new Notice(`Connection error: ${(error as Error).message}`);
    }
  }

  private async createFolder(): Promise<boolean> {
    const { anythingLLMUrl, folderName } = this.settings;

    try {
      const response = await fetch(
        `${anythingLLMUrl}/api/v1/document/create-folder`,
        {
          method: "POST",
          headers: this.getApiHeaders(),
          body: JSON.stringify({ name: folderName }),
        }
      );
      return response.ok || response.status === 400 || response.status === 500;
    } catch (error) {
      console.error("Error creating folder:", error);
      return false;
    }
  }

  async syncFile(file: TFile): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    this.updateStatus("Syncing...");

    try {
      const fileContent = await this.app.vault.read(file);
      
      if (!fileContent || fileContent.trim().length === 0) {
        new Notice(`Skipping empty file: ${file.name}`);
        this.syncInProgress = false;
        this.updateStatus("Ready");
        return;
      }
      
      const currentHash = this.simpleHash(fileContent);
      const fileKey = file.path;

      await this.createFolder();

      const formData = new FormData();
      const blob = new Blob([fileContent], { type: "text/markdown" });
      formData.append("file", blob, file.name);

      const { anythingLLMUrl, folderName } = this.settings;

      const response = await fetch(
        `${anythingLLMUrl}/api/v1/document/upload/${folderName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.settings.apiKey}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json() as { documents?: Array<{ location?: string }> };
        const docPath = data?.documents?.[0]?.location;

        if (docPath) {
          await this.updateEmbeddings([docPath]);
        }

        this.syncState[fileKey] = currentHash;
        await this.saveSyncState();

        new Notice(`Synced: ${file.name}`);
      } else {
        console.error("Upload failed:", await response.text());
      }
    } catch (error) {
      console.error("Sync error:", error);
      new Notice(`Sync error: ${(error as Error).message}`);
    } finally {
      this.syncInProgress = false;
      this.updateStatus("Ready");
    }
  }

  async syncVault(): Promise<void> {
    if (this.syncInProgress) {
      new Notice("Sync already in progress");
      return;
    }

    this.syncInProgress = true;
    this.updateStatus("Syncing vault...");

    try {
      await this.createFolder();

      const allFiles = this.app.vault.getMarkdownFiles();
      console.log(`Found ${allFiles.length} markdown files`);
      
      const newState: Record<string, string> = {};
      const filesToEmbed: string[] = [];
      let uploadedCount = 0;

      for (const file of allFiles) {
        const fileContent = await this.app.vault.read(file);
        
        if (!fileContent || fileContent.trim().length === 0) {
          console.log(`Skipping empty file: ${file.name}`);
          newState[file.path] = "";
          continue;
        }
        
        const currentHash = this.simpleHash(fileContent);
        newState[file.path] = currentHash;

        const needsSync = this.syncState[file.path] !== currentHash;
        console.log(`File ${file.name}: needsSync=${needsSync}`);
        
        if (needsSync || !this.syncState[file.path]) {
          const formData = new FormData();
          const blob = new Blob([fileContent], { type: "text/markdown" });
          formData.append("file", blob, file.name);

          const { anythingLLMUrl, folderName } = this.settings;

          const response = await fetch(
            `${anythingLLMUrl}/api/v1/document/upload/${folderName}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${this.settings.apiKey}`,
              },
              body: formData,
            }
          );

          if (response.ok) {
            uploadedCount++;
            console.log(`Uploaded: ${file.name}`);
            const data = await response.json() as { documents?: Array<{ location?: string }> };
            const docPath = data?.documents?.[0]?.location;
            if (docPath) {
              filesToEmbed.push(docPath);
            }
          } else {
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

      new Notice(`Sync complete: ${filesToEmbed.length} files updated`);
    } catch (error) {
      console.error("Sync error:", error);
      new Notice(`Sync error: ${(error as Error).message}`);
    } finally {
      this.syncInProgress = false;
      this.updateStatus("Ready");
    }
  }

  private async updateEmbeddings(docPaths: string[]): Promise<void> {
    const { anythingLLMUrl, workspaceSlug } = this.settings;

    try {
      await fetch(
        `${anythingLLMUrl}/api/v1/workspace/${workspaceSlug}/update-embeddings`,
        {
          method: "POST",
          headers: this.getApiHeaders(),
          body: JSON.stringify({ adds: docPaths, deletes: [] }),
        }
      );
    } catch (error) {
      console.error("Error updating embeddings:", error);
    }
  }

  async forceResyncAll(): Promise<void> {
    if (this.syncInProgress) {
      new Notice("Sync already in progress");
      return;
    }

    this.syncInProgress = true;
    this.updateStatus("Force resync...");

    try {
      this.syncState = {};
      await this.saveSyncState();
      await this.syncVault();
      new Notice("Force resync complete");
    } catch (error) {
      console.error("Force resync error:", error);
      new Notice(`Force resync error: ${(error as Error).message}`);
    } finally {
      this.syncInProgress = false;
      this.updateStatus("Ready");
    }
  }

  private updateStatus(text: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.setText(`AnythingLLM: ${text}`);
    }
  }
}
