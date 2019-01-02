/// <reference path="../node_modules/obs-websocket-js-types/index.d.ts" />

import * as vscode from 'vscode';
import * as OBSWebSocket from 'obs-websocket-js';
import { ListenEvents } from './ListenEvents';
import { OBSWebSocketProxySettings } from './OBSWebSocketProxySettings';
import IOBSWebSocketProxy from './IOBSWebSocketProxy';

const __outputWindowName = "OBS Secrets Scene Switcher";
const __settings = "obs.secretsSwitchScene";

function __getObsWebSocketProxySettings(config: vscode.WorkspaceConfiguration): OBSWebSocketProxySettings {
  let settings: OBSWebSocketProxySettings = { 
    address: config.get<string>('socketsUrl') || 'localhost:4444',
    password: config.get<string>('password'),
    scene: config.get<string>('scene') || "Scene",
    autoSwitchBack: config.get<boolean>('autoSwitchBack') || true,
    fileNames: config.get<string[]>('fileName') || []
  };

  return settings;
}

export class OBSWebSocketProxy extends vscode.Disposable implements IOBSWebSocketProxy {
  private _settings: OBSWebSocketProxySettings;
  private _obs: OBSWebSocket;
  private _outputChannel: vscode.OutputChannel;
  private _isConnected: boolean = false;
  private _isConnecting: boolean = false;
  private _authFailure: boolean = false;
  private _retryCount: number = 0;
  private _originalTransitionDuration: number = 300;
  private _originalScene: string = "Scene";
  private _switchedScene: boolean = false;
  
  constructor(context: vscode.ExtensionContext) {
    super(() => this.dispose());
    this._settings = __getObsWebSocketProxySettings(vscode.workspace.getConfiguration(__settings));
    this._obs = new OBSWebSocket();
    this._outputChannel = vscode.window.createOutputChannel(__outputWindowName);

    this._initialize();
    this._registerEvents(context);
  }

  public connect(resetRetryCount: boolean = true) {
    if (this._isConnected) { return null; }
    if (resetRetryCount) { this._retryCount = 0; }
    this._isConnecting = true;
    if (this._retryCount++ < 5 && !this._authFailure) {
      this._outputChannel.appendLine(`Trying to connect to OBS @ ${this._settings.address}`);
      this._obs.connect({
        address: this._settings.address,
        password: this._settings.password
      }, this._connectionError);
    }
    else {
      this._isConnecting = false;
      this._outputChannel.appendLine("Exhausted all attempts to connect to OBS Studio.");
      this.onExhaustedRetries();
    }
  }

  public disconnect() {
    if (!this._isConnected) { return false; }
    this._obs.disconnect();
  }

  public toggleConnection() {
    if (!this.isConnected) {
			this.connect();
		}
		else {
			this.disconnect();
		}
  }

  public gotoOriginalScene() {
    this._outputChannel.appendLine(`Setting transition duration to '${this._originalTransitionDuration}ms'.`);
    this._setTransitionDuration(this._originalTransitionDuration, false)
      .then(() => {        
        this._outputChannel.appendLine("Switching scene");
        this._setScene(this._originalScene, false)
          .then(() => {
            this._switchedScene = false;
            this._outputChannel.appendLine(`Switched scene back to '${this._originalScene}'.`);
          });
      });
  }
  
  public gotoSecretsScene() {
    this._outputChannel.appendLine(`Settings transition duration to '2ms'.`);
    this._setTransitionDuration(2, true)
      .then(() => {
        this._outputChannel.appendLine("Switching scene");
        this._setScene(this._settings.scene, true)
          .then(() => {
            this._switchedScene = true;
            this._outputChannel.appendLine(`Switched scene to '${this._settings.scene}'.`);
          });
      });
  }
  
  public isConnected() { return this._isConnected; }
  public isConnecting() { return this._isConnecting; }
  public switchedScene() { return this._switchedScene; }

  public onConnectedEvent = () => {};
  public onDisconnectedEvent = () => {};
  public onExhaustedRetries = () => {};

  private _initialize() {
    this._outputChannel.appendLine("Initializing OBS Websocket Proxy");

    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.toggleConnection = this.toggleConnection.bind(this);
    this.gotoOriginalScene = this.gotoOriginalScene.bind(this);
    this.gotoSecretsScene = this.gotoSecretsScene.bind(this);
    this.isConnected = this.isConnected.bind(this);
    this.isConnecting = this.isConnecting.bind(this);
    this.switchedScene = this.switchedScene.bind(this);
    
    this._connectionOpened = this._connectionOpened.bind(this);
    this._connectionClosed = this._connectionClosed.bind(this);
    this._authenticationFailure = this._authenticationFailure.bind(this);
    this._workspaceConfigurationChanged = this._workspaceConfigurationChanged.bind(this);    
    this._connectionError = this._connectionError.bind(this);
    this._showVersionInfo = this._showVersionInfo.bind(this);
    this._setTransitionDuration = this._setTransitionDuration.bind(this);
    this._setScene = this._setScene.bind(this);
    
    this._obs.addListener(ListenEvents.ConnectionOpened, this._connectionOpened);
    this._obs.addListener(ListenEvents.ConnectionClosed, this._connectionClosed);
    this._obs.addListener(ListenEvents.AuthenticationFailure, this._authenticationFailure);
  }

  private _registerEvents(context: vscode.ExtensionContext) {
    // Register for workspace settings change events
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(this._workspaceConfigurationChanged));
  }

  private _connectionError(err?: any) {
    if (!err || err.messageId === "2") { return; } // Error is undefined or an authentication failure    
    this._outputChannel.appendLine("Could not establish a connection with the OBS Websocket server.");
    setTimeout(() => this.connect(false), 5000); // retry the connection
  }

  private _connectionOpened() {
    this._isConnected = true;
    this._isConnecting = false;
    this._retryCount = 0;
    this._outputChannel.appendLine("Connected to OBS Studio!");
    this._obs.send("GetVersion").then(this._showVersionInfo);
    this.onConnectedEvent();
  }

  private _showVersionInfo(versionInfo: any) {
    this._outputChannel.appendLine(`OBS Studio Version: ${versionInfo.obsStudioVersion}`);
    this._outputChannel.appendLine(`OBS Studio Websocket Plugin Version: ${versionInfo.obsWebsocketVersion}`);
  }

  private _connectionClosed() {
    this._isConnected = false;
    this._outputChannel.appendLine("Disconnected from OBS Studio");
    this.onDisconnectedEvent();
    if (this._isConnecting || this._authFailure) { return; }
    this.connect(false);
  }

  private _authenticationFailure() {
    this._authFailure = true;
    this._outputChannel.appendLine("Failed to authenticate with the OBS Websocket server.");
  }

  private _workspaceConfigurationChanged(changes: vscode.ConfigurationChangeEvent) {
    if (!changes.affectsConfiguration(__settings)) { return; }
    this._settings = __getObsWebSocketProxySettings(vscode.workspace.getConfiguration(__settings));
  }

  private _setTransitionDuration(duration: number, getCurrent: boolean = true): Promise<void>
  {
    if (getCurrent) {
      this._obs.send("GetTransitionDuration")
        .then(result => this._originalTransitionDuration = result.transitionDuration);
    }

    return this._obs.send("SetTransitionDuration", { duration });
  }

  private _setScene(scene: string, getCurrent: boolean = true): Promise<void>
  {
    if (getCurrent) {
      this._obs.send("GetCurrentScene")
        .then(result => this._originalScene = result.name);
    }

    return this._obs.send("SetCurrentScene", {
      "scene-name": scene,
      "sceneName": scene
    });
  }

  public dispose() {
    this._obs.disconnect();
  }
}

export default OBSWebSocketProxy;