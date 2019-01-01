/// <reference path="../node_modules/obs-websocket-js-types/index.d.ts" />
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

let obsSocketUrl: string;
let secretsFileNames: string[] = new Array<string>();
let secretsScene: string;
let obsConnected: boolean = false;
let originalScene: string;
let originalTransitionDuration: number;
let sceneSwitched: boolean = false;
let autoSwitchBack: boolean = true;
let retryCount: number = 0;
let isRetrying: boolean = false;
let obsOutputChannel: vscode.OutputChannel;

function initializeSettings()
{
	let settings = vscode.workspace.getConfiguration("obs.secretsSwitchScene");

	if (settings.has('socketsUrl')) {
		obsSocketUrl = settings.get<string>('socketsUrl') as string;
	}

	if (settings.has('fileNames')) {
		let fileNames = settings.get<string[]>('fileNames');
		if(fileNames !== undefined) {
			fileNames.map(fileName => secretsFileNames.push(fileName));
		}
	}
	
	if (settings.has('scene')) {
		secretsScene = settings.get<string>("scene") as string;
	}
	
	if (settings.has('autoSwitchBack'))
	{
		autoSwitchBack = settings.get<boolean>("autoSwitchBack") as boolean;
	}
}

function initializeObs() {

	obsOutputChannel = vscode.window.createOutputChannel('obs-studio');

	obs.addListener("ConnectionOpened", () => {
		obsConnected = true;
		isRetrying = false;
		retryCount = 0;
		obsOutputChannel.appendLine(`Connected to OBS-Studio!`);
		obs.send("GetVersion")
			 .then(result => {
					obsOutputChannel.appendLine(`OBS Studio Version: ${result.obsStudioVersion}`);
					obsOutputChannel.appendLine(`OBS Websockets Version" ${result.obsWebsocketVersion}`);
			 });
	});

	obs.addListener("ConnectionClosed", () => {
		obsConnected = false;
		obsOutputChannel.appendLine("Disconnected from OBS-Studio");
		if (isRetrying) { return; }
		isRetrying = true;
		tryConnect();
	});
}

function gotoSecretsScene()
{
	// Get the current scene
	obs.send("GetCurrentScene")
	.then(result => {
		originalScene = result.name;
		obsOutputChannel.appendLine(`Current Scene: ${result.name}`);
		obsOutputChannel.appendLine(`Switching to ${secretsScene}`);
	});

	// Get the transition duration
	obs.send("GetTransitionDuration")
		 .then(result => originalTransitionDuration = result.transitionDuration);

	// Ensure the scene switches as quickly as possible.
	obs.send("SetTransitionDuration", { "duration": 0 });

	// Switch the scene
	obs.send("SetCurrentScene", {
		"scene-name": secretsScene,
		"sceneName": secretsScene
	}).then(() => {
		sceneSwitched = true;
		vscode.window.showInformationMessage(`You opened a file which contains Secrets! OBS scene switched to '${secretsScene}'.`);
	})
	.catch(result => {
		obsOutputChannel.appendLine(`An error occured while switching scenes: ${result.error}.`);
		vscode.window.showErrorMessage(`An error occured while switching scenes.`);
	});
}

function gotoOriginalScene() {
	sceneSwitched = false;

	obs.send("SetTransitionDuration", { "duration": originalTransitionDuration });

	if (autoSwitchBack) {
		obs.send("SetCurrentScene", {
			"scene-name": originalScene,
			"sceneName": originalScene
		}).then(() => obsOutputChannel.appendLine(`Switched scene back to the original scene '${originalScene}'.`));
	}
}

function tryConnect() {
	obsConnected = false;
	if (retryCount++ < 5) {
		obsOutputChannel.appendLine(`Trying to connect to OBS @ ${obsSocketUrl}...`);
		obs.connect({ address: obsSocketUrl }, (err?: Error) => {
			if (!err) { return; }
			setTimeout(tryConnect, 5000);
			obsOutputChannel.appendLine(`Could not establish a connection with the OBS Websocket server @ ${obsSocketUrl}.`);
		});
	} else {
		obsOutputChannel.appendLine("Exhausted all attempts to connect to OBS-Studio.");
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	initializeSettings();

	initializeObs();

	tryConnect();

	// Check editor.document.fileName against known secrets fileNames and
	// also against user-specified secrets fileNames and switch
	// scenes if this document matches.
	let documentOpenedEvent = vscode.window.onDidChangeActiveTextEditor(
		editor => {
			// Sanity check
			if (!editor || !obsConnected) { return; }
			
			// Gather the fileName only
			const fileName = path.parse(editor.document.fileName).base;

			// Switch the scene back to the original scene
			// that was set prior to automatically switching
			if (sceneSwitched) {
				gotoOriginalScene();
			}		

			// Check if fileName matches a secrets fileName
			if (secretsFileNames.indexOf(fileName) > -1) {
				gotoSecretsScene();
			}
		});

	// If the workspace settings change and it affects our plugin
	// then load the new settings.
	let workspaceSettingsChangedEvent = vscode.workspace.onDidChangeConfiguration(
		changes => {
			if (!changes.affectsConfiguration("obs.secretsSwitchScene")) { return; }
			initializeSettings();
		}
	);

	let startConnectionCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.startConnection", () => {
		retryCount = 0;
		tryConnect();
	});

	let stopConnectionCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.stopConnection", () => {
		if (!obsConnected) { return; }
		obsOutputChannel.appendLine("Disconnecting from OBS-Studio");
		isRetrying = true;
		obs.disconnect();
	});

	context.subscriptions.push(documentOpenedEvent);
	context.subscriptions.push(workspaceSettingsChangedEvent);
	context.subscriptions.push(startConnectionCommand);
	context.subscriptions.push(stopConnectionCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
	obs.removeAllListeners();
	obs.disconnect();
}
