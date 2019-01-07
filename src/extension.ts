import * as vscode from 'vscode';
import SwitchSceneManager from './SwitchSceneManager';
import { Commands } from './Commands';
import CredentialManager from './CredentialManager';
import { SwitchSceneSettings } from './SwitchSceneSettings';
import { Constants } from './Constants';
import * as minimatchtype from 'minimatch';
import { getNodeModule } from './NodeModules';

let ssm: SwitchSceneManager;
let switchSceneStatusBar: vscode.StatusBarItem;
const minimatch: typeof minimatchtype | undefined = getNodeModule<typeof minimatchtype>('minimatch');
const config = () => vscode.workspace.getConfiguration(Constants.Namespace);
const settings: SwitchSceneSettings = {
  autoSwitchBack: config().get<boolean>('autoSwitchBack', true),
  fileNames: config().get<string[]>('fileNames', []),
  scene: config().get<string>('scene', 'Scene'),
  serviceUrl: config().get<string>('serviceUrl', 'localhost:4444'),
  usePassword: config().get<boolean>('usePassword', false)
};

function setStatusBarText() {
  const iconName = '$(radio-tower)';
  if (ssm.connected()) {
    switchSceneStatusBar.text = `${iconName} Connected`;
    switchSceneStatusBar.tooltip = "Connected to OBS Studio";
  } else if (ssm.connecting()) {
    switchSceneStatusBar.text = `${iconName} Connecting...`;
    switchSceneStatusBar.tooltip = "Trying to connect to OBS Studio";
  } else {
    switchSceneStatusBar.text = `${iconName} Disconnected`;
    switchSceneStatusBar.tooltip = "Disconnected from OBS-Studio";
  }
}

function start() {
  ssm.connect(true);
}

function stop() {
  ssm.disconnect();
}

function toggleConnection() {
  ssm.toggleConnection();
}

function setPassword() {
  vscode.window.showInputBox({
    placeHolder: 'Type the OBS Websocket password',
    password: true
  }).then((result) => {
    if (result !== undefined) {
      CredentialManager.setPassword(settings.serviceUrl, result);
      //ssm.setPassword(result);
    } else {
      vscode.window.showErrorMessage('You cannot use an empty password.');
      setPassword();
    }
  });
}

function deletePassword() {
  CredentialManager.deletePassword(settings.serviceUrl);
}

function autoSwitchScene(e: vscode.TextEditor | undefined) {
  if (!e || !ssm.connected()) { return; }
  const path = ('./' + e.document.fileName.substr((vscode.workspace.rootPath || "").length).replace(/\\/g,'/')).replace(/\/\//g,'/');
  const idx = settings.fileNames.findIndex(f => {
    if (!minimatch) { return false; }
    return minimatch(path, f);
  });
  if (idx > -1) {
    ssm.switchScene(settings.scene, 0);
  } else {
    if (ssm.sceneSwitched()) {
      ssm.revertSwitchScene();
    }
  }
}

function setupSwitchSceneManager(passwd?: string) {
  ssm = new SwitchSceneManager(settings.serviceUrl, passwd);
  ssm.onConnectedEvent = setStatusBarText;
  ssm.onDisconnectedEvent = setStatusBarText;
  ssm.onExhaustedRetriesEvent = setStatusBarText;
  switchSceneStatusBar.show();
  setStatusBarText();
}

async function initializeSwitchSceneManager() {
  if (await CredentialManager.findPassword()) {
    CredentialManager.getPassword(settings.serviceUrl)
      .then(value => {
        setupSwitchSceneManager(value || undefined);
      });
  } else {
    setupSwitchSceneManager();
  }
}

function addFiles(file: any, selectedFiles: any[]) {
  let fileNames = config().get<string[]>('fileNames', []);
  if (!selectedFiles || selectedFiles.length === 0) {
    selectedFiles = [file];
  }
  selectedFiles.forEach(f => {
    const path = ('./' + f.fsPath.substr((vscode.workspace.rootPath || "").length).replace(/\\/g,'/')).replace(/\/\//g,'/');
    const globs = fileNames.filter(fileName => {
      if (!minimatch) { return false; }
      return minimatch(path, fileName, { matchBase: true });
    });
    if (globs.length > 0) { return; }
    fileNames.push(path);
  });
  config().update('fileNames', fileNames);
}

function removeFiles(file: any, selectedFiles: any[]) {
  let fileNames = config().get<string[]>('fileNames', []);
  if (!selectedFiles || selectedFiles.length === 0) {
    selectedFiles = [file];
  }
  selectedFiles.forEach(f => {
    const path = ('./' + f.fsPath.substr((vscode.workspace.rootPath || "").length).replace(/\\/g,'/')).replace(/\/\//g,'/');
    fileNames = fileNames.filter(fileName => {
      if (!minimatch) { return false; }
      return !minimatch(path, fileName, { matchBase: true });
    });
  });
  config().update('fileNames', fileNames);
}

function workspaceSettingsChanged(e: vscode.ConfigurationChangeEvent) {
  if (e.affectsConfiguration(`${Constants.Namespace}`)) {
    ssm.dispose();
    // Re-initialize the manager and autoswitchscene if the settings included the
    // file currently in the active text editor matches the new settings
    initializeSwitchSceneManager().then(() => autoSwitchScene(vscode.window.activeTextEditor));
  }
}

export async function activate(context: vscode.ExtensionContext) {
  context = context;
  initializeSwitchSceneManager();
  
  switchSceneStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  switchSceneStatusBar.command = Commands.ToggleCommand;  
  
  const startCommand = vscode.commands.registerCommand(Commands.StartCommand, start);
  const stopCommand = vscode.commands.registerCommand(Commands.StopCommand, stop);
  const toggleCommand = vscode.commands.registerCommand(Commands.ToggleCommand, toggleConnection);
  const setPasswordCommand = vscode.commands.registerCommand(Commands.SetPasswordCommand, setPassword);
  const deletePasswordCommand = vscode.commands.registerCommand(Commands.DeletePasswordCommand, deletePassword);
  
  const addFilesToFileNamesCommand = vscode.commands.registerCommand(Commands.AddFilesToFileNamesCommand, addFiles);
  const removeFilesFromFileNamesCommand = vscode.commands.registerCommand(Commands.RemoveFilesFromFileNamesCommand, removeFiles);
  
  const visibleTextEditorsEvent = vscode.window.onDidChangeActiveTextEditor(autoSwitchScene);
  const workspaceSettingsChangedEvent = vscode.workspace.onDidChangeConfiguration(workspaceSettingsChanged);

  context.subscriptions.push(startCommand);
  context.subscriptions.push(stopCommand);
  context.subscriptions.push(toggleCommand);
  context.subscriptions.push(setPasswordCommand);
  context.subscriptions.push(deletePasswordCommand);
  context.subscriptions.push(visibleTextEditorsEvent);
  context.subscriptions.push(workspaceSettingsChangedEvent);
  context.subscriptions.push(addFilesToFileNamesCommand);
  context.subscriptions.push(removeFilesFromFileNamesCommand);
  context.subscriptions.push(switchSceneStatusBar);
}

export function deactivate() {
  ssm.dispose();
}