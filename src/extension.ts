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
let obsSocketPassword: string | undefined;
let authFailure: boolean;
let myStatusBarItem: vscode.StatusBarItem;

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
	
	if (settings.has('autoSwitchBack')) {
		autoSwitchBack = settings.get<boolean>("autoSwitchBack") as boolean;
	}

	if (settings.has('password')) { 
		obsSocketPassword = settings.get<string>('password');
		if (obsSocketPassword === null) {
			obsSocketPassword = undefined;
		}
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
		setStatusBarText();
	});

	obs.addListener("AuthenticationFailure", () =>{
		authFailure = true;
		obsOutputChannel.appendLine(`Failed to authenticate with the OBS Websockets server.`);
	});

	obs.addListener("ConnectionClosed", () => {
		obsConnected = false;
		obsOutputChannel.appendLine("Disconnected from OBS-Studio");
		setStatusBarText();
		if (isRetrying || authFailure) { return; }
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
	if (retryCount++ < 5 && !authFailure) {
		obsOutputChannel.appendLine(`Trying to connect to OBS @ ${obsSocketUrl}...`);
		obs.connect({ address: obsSocketUrl, password: obsSocketPassword }, (err?: any) => {
			if (!err || err.messageId === "2") { return; }
			setTimeout(tryConnect, 5000);
			obsOutputChannel.appendLine(`Could not establish a connection with the OBS Websocket server @ ${obsSocketUrl}.`);
			console.error(`[Failed connection] ${err.message}`);
		}).catch(reason => { console.error(reason); });
	} else {
		isRetrying = false;
		obsOutputChannel.appendLine("Exhausted all attempts to connect to OBS-Studio.");
		setStatusBarText();
	}
}

function setStatusBarText() {
	if (obsConnected) {
		myStatusBarItem.text = "$(radio-tower) Connected";
		myStatusBarItem.tooltip = "Connected to OBS-Studio";
	}
	else if (isRetrying) {
		myStatusBarItem.text = "$(radio-tower) Reconnecting...";
		myStatusBarItem.tooltip = "Trying to connect to OBS-Studio";
	}
	else {
		myStatusBarItem.text = "$(radio-tower) Disconnected";
		myStatusBarItem.tooltip = "Disconnected to OBS-Studio";
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

	let startConnection = () => {
		retryCount = 0;
		authFailure = false;
		tryConnect();
	};

	let stopConnection = () => {
		if (!obsConnected) { return; }
		obsOutputChannel.appendLine("Disconnecting from OBS-Studio");
		isRetrying = true;
		obs.disconnect();
	};

	let startConnectionCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.startConnection", startConnection);

	let stopConnectionCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.stopConnection", stopConnection);

	let toggleConnectionCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.toggleConnection", () => {
		if (!obsConnected) {
			startConnection();
		}
		else {
			stopConnection();
		}
	});

	let addFileToSecrets = (selectedFile: any, selectedFiles: any) => {
		console.log(`Adding file to secrets`);
		
		const settings = vscode.workspace.getConfiguration("obs.secretsSwitchScene");
		let fileNames = settings.get<string[]>('fileNames') || new Array<string>();
		selectedFiles.map((file: any) => {
			const fileName = path.parse(file.path).base;
			if (fileNames.findIndex(f => f === fileName) === -1) {
				fileNames.push(fileName);
			}
		});
		settings.update("fileNames", fileNames);
	};
	
	let addFileToSecretsCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.addFileToSecrets", addFileToSecrets);

	let removeFileFromSecrets = (selectedFile: any, selectedFiles: any) => {
		console.log(`Removing file from secrets`);

		const settings = vscode.workspace.getConfiguration("obs.secretsSwitchScene");
		let fileNames = settings.get<string[]>('fileNames') || new Array<string>();
		selectedFiles.map((file: any) => {
			const fileName = path.parse(file.path).base;
			fileNames = fileNames.filter(f => f !== fileName);
		});

		settings.update("fileNames", fileNames);
	};

	let removeFileFromSecretsCommand = vscode.commands.registerCommand("obs.secretsSwitchScene.removeFileFromSecrets", removeFileFromSecrets);

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	myStatusBarItem.command = 'obs.secretsSwitchScene.toggleConnection';
	myStatusBarItem.show();

	context.subscriptions.push(documentOpenedEvent);
	context.subscriptions.push(workspaceSettingsChangedEvent);
	context.subscriptions.push(startConnectionCommand);
	context.subscriptions.push(stopConnectionCommand);
	context.subscriptions.push(toggleConnectionCommand);
	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(addFileToSecretsCommand);
	context.subscriptions.push(removeFileFromSecretsCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
	myStatusBarItem.dispose();
	obs.removeAllListeners();
	obs.disconnect();
}
