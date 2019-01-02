// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import Commands from './Commands';
import IOBSWebSocketProxy from './IOBSWebSocketProxy';
import OBSWebSocketProxy from './OBSWebSocketProxy';
import Constants from './Constants';

let proxy: IOBSWebSocketProxy;
let secretsFileNames: string[];
let myStatusBarItem: vscode.StatusBarItem;

function setStatusBarText() {
	if (proxy.isConnected()) {
		myStatusBarItem.text = "$(radio-tower) Connected";
		myStatusBarItem.tooltip = "Connected to OBS-Studio";
	}
	else if (proxy.isConnecting()) {
		myStatusBarItem.text = "$(radio-tower) Connecting...";
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

	secretsFileNames = vscode.workspace.getConfiguration(Constants.Namespace)
		.get<string[]>('fileNames') || [];

	proxy = new OBSWebSocketProxy(context);
	
	proxy.onConnectedEvent = () => {
		setStatusBarText();
	};

	proxy.onDisconnectedEvent = () => {
		setStatusBarText();
	};

	proxy.onExhaustedRetries = () => {
		setStatusBarText();
	};

	// Check editor.document.fileName against known secrets fileNames and
	// also against user-specified secrets fileNames and switch
	// scenes if this document matches.
	let documentOpenedEvent = vscode.window.onDidChangeActiveTextEditor(editor => {
			// Sanity check
			if (!editor || !proxy.isConnected) { return; }
			
			// Gather the fileName only
			const fileName = path.parse(editor.document.fileName).base;

			// Switch the scene back to the original scene
			// that was set prior to automatically switching
			proxy.gotoOriginalScene();
			if (proxy.switchedScene) {
				proxy.gotoOriginalScene();
			}

			// Check if fileName matches a secrets fileName
			if (secretsFileNames.indexOf(fileName) > -1) {
				proxy.gotoSecretsScene();
			}
	});

	// Register the command to start the connection with OBS Studio
	let startConnectionCommand = vscode.commands.registerCommand(Commands.StartCommand, () => {
		proxy.connect();
		setStatusBarText();
	});

	// Register the command to stop the connection with OBS Studio
	let stopConnectionCommand = vscode.commands.registerCommand(Commands.StopCommand, () => {
		proxy.disconnect();
	});

	// Register the toggle command to start/stop the connection with OBS Studio
	let toggleConnectionCommand = vscode.commands.registerCommand(Commands.ToggleCommand, () => {
		proxy.toggleConnection();
	});	

	let addFileToSecretsCommand = vscode.commands.registerCommand(Commands.AddFileToSecrets, (selectedFile: any, selectedFiles: any) => {
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
	});

	let removeFileFromSecretsCommand = vscode.commands.registerCommand(Commands.RemoveFileFromSecrets, (selectedFile: any, selectedFiles: any) => {
		console.log(`Removing file from secrets`);

		const settings = vscode.workspace.getConfiguration("obs.secretsSwitchScene");
		let fileNames = settings.get<string[]>('fileNames') || new Array<string>();
		selectedFiles.map((file: any) => {
			const fileName = path.parse(file.path).base;
			fileNames = fileNames.filter(f => f !== fileName);
		});

		settings.update("fileNames", fileNames);
	});

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	myStatusBarItem.command = Commands.ToggleCommand;
	myStatusBarItem.show();
	setStatusBarText();

	context.subscriptions.push(documentOpenedEvent);
	context.subscriptions.push(startConnectionCommand);
	context.subscriptions.push(stopConnectionCommand);
	context.subscriptions.push(toggleConnectionCommand);
	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(addFileToSecretsCommand);
	context.subscriptions.push(removeFileFromSecretsCommand);

	proxy.connect();
}

// this method is called when your extension is deactivated
export function deactivate() {
	proxy.dispose();
}
