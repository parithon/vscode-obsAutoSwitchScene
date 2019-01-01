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

function gotoSecretsScene()
{
	// Get the current scene
	obs.send("GetCurrentScene")
	.then(result => {
		originalScene = result.name;
		console.log(`Current Scene: ${result.name}`);
		console.log(`Switching to ${secretsScene}`);
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
	.catch(result => console.error(`An error occured while switching scenes: ${result.error}.`));
}

function gotoOriginalScene() {
	sceneSwitched = false;

	obs.send("SetTransitionDuration", { "duration": originalTransitionDuration });

	if (autoSwitchBack) {
		obs.send("SetCurrentScene", {
			"scene-name": originalScene,
			"sceneName": originalScene
		}).then(() => console.log(`Switched scene back to the original scene '${originalScene}'.`));
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	initializeSettings();

	obs.connect({ address: obsSocketUrl }, (err?: Error) => {
		if (!err) { return; }
		obsConnected = false;
		console.error(`An unhandled error occured while establishing a connection to the OBS Websocket @ ${obsSocketUrl}: ${err.message}`);
	})
	.then(() => {
		obsConnected = true;
		console.log(`Connection established!`);
		obs.send("GetVersion")
			 .then(result => {
				 console.log(`OBS Studio Version: ${result.obsStudioVersion}`);
				 console.log(`OBS Websockets Version" ${result.obsWebsocketVersion}`);
			 });
	});

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

	context.subscriptions.push(documentOpenedEvent);
	context.subscriptions.push(workspaceSettingsChangedEvent);
}

// this method is called when your extension is deactivated
export function deactivate() {
	obs.disconnect();
}
