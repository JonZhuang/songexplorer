// main.ts 
import type { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { readAsArrayBuffer } from 'promise-file-reader';
import { parseMP3 } from 'mp3-metadata';
import fetch from 'node-fetch';

interface SongExplorerSettings {
	defaultArtist: string;
	openAIApiKey: string;
	geminiProApiKey: string;
	deezerApiKey: string;
	shazamApiKey: string;
	geniusApiKey: string;
	theAudioDBApiKey: string;
}

const DEFAULT_SETTINGS: SongExplorerSettings = {
	defaultArtist: 'Unknown Artist',
	openAIApiKey: '',
	geminiProApiKey: '',
	deezerApiKey: '',
	shazamApiKey: '',
	geniusApiKey: '',
	theAudioDBApiKey: '',
};

export default class SongExplorerPlugin extends Plugin {
	settings: SongExplorerSettings;

	async onload() {
		await this.loadSettings();

		console.log('Loading Song Explorer Plugin');

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('music', 'Song Explorer Plugin', async (evt: MouseEvent) => {
			new Notice('Song Explorer Plugin is active!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('song-explorer-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Song Explorer Active');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-song-info-modal',
			name: 'Open Song Info Modal',
			callback: () => {
				new SongInfoModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'insert-song-info',
			name: 'Insert Song Info',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection(`Artist: ${this.settings.defaultArtist}`);
			}
		});

		// Register the drag-and-drop event
		this.registerEvent(
			this.app.workspace.on('file-drop', this.handleFileDrop.bind(this))
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SongExplorerSettingTab(this.app, this));

		// Register a global DOM event for clicks
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('Document clicked', evt);
		});

		// Register an interval for regular tasks
		this.registerInterval(window.setInterval(() => console.log('Checking plugin status'), 5 * 60 * 1000));
	}

		/**
		 * Called when the user disables the plugin.
		 * Unloads the plugin resources and removes all the plugin events.
		 */
	async onunload() {
		console.log('Unloading Song Explorer Plugin');
	}

		/**
		 * Handles the file-drop event by fetching song info from the given file.
		 * @param event The drag event.
		 * @param filePath The path of the file dropped.
		 */
	async handleFileDrop(event: DragEvent, filePath: string) {
		const file = event.dataTransfer?.files[0];
		if (file && this.isMusicFile(file)) {
			const fileContent = await readAsArrayBuffer(file);
			const metadata = await parseMP3(fileContent);
			const songInfo = await this.fetchSongInfo(metadata);

			// Insert song info into the note
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf) {
				const editor = activeLeaf.view.sourceMode.cmEditor;
				editor.replaceSelection(songInfo);
			}
		}
	}

	/**
	 * Checks if a file is a music file by checking its extension.
	 * Supported extensions are: mp3, wav, flac.
	 * @param file The file to check.
	 * @returns True if the file is a music file, false otherwise.
	 */
	isMusicFile(file: File): boolean {
		const allowedExtensions = ['mp3', 'wav', 'flac'];
		const fileExtension = file.name.split('.').pop()?.toLowerCase();
		return allowedExtensions.includes(fileExtension ?? '');
	}

	/**
	 * Fetches song info from multiple APIs given the file metadata.
	 * @param metadata The metadata of the file.
	 * @returns A string containing the song info from all the APIs.
	 */
	async fetchSongInfo(metadata: any): Promise<string> {
		// Fetch song info from multiple APIs
		const apiKeys = [
			this.settings.openAIApiKey,
			this.settings.geminiProApiKey,
			this.settings.deezerApiKey,
			this.settings.shazamApiKey,
			this.settings.geniusApiKey,
			this.settings.theAudioDBApiKey
		];

		const promises = apiKeys.map(apiKey => {
			if (apiKey) {
				return fetch(`https://api.${apiKey}/v1/engines/davinci/completions?prompt=Generate+song+info+based+on+metadata&metadata=${encodeURIComponent(JSON.stringify(metadata))}`, {
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'Content-Type': 'application/json'
					}
				}).then(r => r.json()).catch((error) => {
					console.error('Error fetching song info from API', error);
					return { choices: [] };
				});
			}
		});

		const responses = await Promise.all(promises);
		const songInfos = responses.map(response => response.choices[0].text);
		return songInfos.join('\n');
	}

	/**
	 * Loads the plugin settings from storage.
	 * If no settings are found, it initializes the settings with the DEFAULT_SETTINGS.
	 * @returns {Promise<void>}
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Saves the plugin settings to storage.
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SongInfoModal extends Modal {
	/**
	 * Creates a new SongInfoModal.
	 * @param app The app instance.
	 */
	constructor(app: App) {
		super(app);
	}

	/**
	 * Sets the content of the modal to "Song Info Modal Content" when it is opened.
	 */
	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Song Info Modal Content');
	}

	/**
	 * Clears the content of the modal when it is closed.
	 */
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SongExplorerSettingTab extends PluginSettingTab {
	plugin: SongExplorerPlugin;

	/**
	 * Creates a new SongExplorerSettingTab.
	 * @param app The Obsidian app.
	 * @param plugin The SongExplorerPlugin instance.
	 */
	constructor(app: App, plugin: SongExplorerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Default Artist')
			.setDesc('Enter the default artist name')
			.addText(text => text
				.setPlaceholder('Enter default artist')
				.setValue(this.plugin.settings.defaultArtist)
				.onChange(async (value) => {
					this.plugin.settings.defaultArtist = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key')
			.addText(text => text
				.setPlaceholder('Enter OpenAI API key')
				.setValue(this.plugin.settings.openAIApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openAIApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Gemini Pro API Key')
			.setDesc('Enter your Gemini Pro API key')
			.addText(text => text
				.setPlaceholder('Enter Gemini Pro API key')
				.setValue(this.plugin.settings.geminiProApiKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiProApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Deezer API Key')
			.setDesc('Enter your Deezer API key')
			.addText(text => text
				.setPlaceholder('Enter Deezer API key')
				.setValue(this.plugin.settings.deezerApiKey)
				.onChange(async (value) => {
					this.plugin.settings.deezerApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Shazam API Key')
			.setDesc('Enter your Shazam API key')
			.addText(text => text
				.setPlaceholder('Enter Shazam API key')
				.setValue(this.plugin.settings.shazamApiKey)
					onChange(async (value) => {
					this.plugin.settings

