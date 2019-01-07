/// <reference path="../node_modules/obs-websocket-js-types/index.d.ts" />

// import * as vscode from 'vscode';
// import { env, window, workspace, ExtensionContext, Disposable, OutputChannel, ConfigurationChangeEvent } from 'vscode';
import { window, Disposable, OutputChannel } from 'vscode';
import * as OBSWebsocket from 'obs-websocket-js';

// import * as keytartype from 'keytar';
// import { SwitchSceneSettings, SwitchSceneSettingsOptions } from './SwitchSceneSettings';
// import { Constants } from './Constants';

// const OBSWebsocketService: string = "OBS Websocket Server";
// const SwitchSceneSettings: string = Constants.Namespace;
const SwitchSceneOutputWindowName: string = "OBS Auto Switch Scene";

export interface OBSVersionInfoResponse {
  messageId: string;
  status: string;
  version: number;
  "obs-websocket-version": string;
  "obs-studio-version": string;
  "available-requests": string;
  obsWebsocketVersion: string;
  obsStudioVersion: string;
  availableRequests: string;
}

export interface OBSTransitionDurationResponse {
  messageId: string;
  status: string;
  "transition-duration": number;
  transitionDuration: number;
}

export interface OBSCurrentSceneResponse {
  messageId: string;
  status: string;
  name: string;
  sources: OBSWebsocket.Source[];
}

export class SwitchSceneManager extends Disposable {
  private serviceUrl: string;
  private password: string | undefined;
  private obs: OBSWebsocket;
  private outputChannel: OutputChannel;
  private originalTransitionDuration: number = 300;
  private originalScene: string = 'Scene';

  private authFailed: boolean = false;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private hasSceneSwitched: boolean = false;
  private retryConnection: boolean = false;
  private retryCount: number = 0;

  constructor(serviceUrl: string, password?: string)
  {
    super(() => this.dispose);
    
    this.serviceUrl = serviceUrl;
    this.password = password;

    this.outputChannel = window.createOutputChannel(SwitchSceneOutputWindowName);

    this.obs = new OBSWebsocket();
    this.obs.addListener('ConnectionOpened', () => this.connectionOpened());
    this.obs.addListener('ConnectionClosed', () => this.connectionClosed());
    this.obs.addListener('AuthenticationFailure', () => this.authenticationFailure());

    this.connected = this.connected.bind(this);
    this.connecting = this.connecting.bind(this);
  }

  public onConnectedEvent: Function | undefined;
  public onDisconnectedEvent: Function | undefined;
  public onExhaustedRetriesEvent: Function | undefined;

  public connected(): boolean {
     return this.isConnected;
  }

  public connecting(): boolean {
    return this.isConnecting;
  }

  public sceneSwitched(): boolean {
    return this.hasSceneSwitched;
  }

  public connect(resetRetryCount: boolean = true): void {
    if (this.isConnected) { return; }
    if (resetRetryCount) { this.retryCount = 0; }
    this.isConnecting = true;
    if (this.retryCount++ < 5) {
      this.outputChannel.appendLine(`Trying to connect to OBS @ ${this.serviceUrl}`);
      this.obs.connect({
        address: this.serviceUrl,
        password: this.password
      }, () => this.connectionError);
    } else {
      this.isConnecting = false;
      this.outputChannel.appendLine(`Exhausted all attempts to connect to OBS Studio. Please check that the server is running and the serviceUrl is configured in the settings.`);
      if (this.onExhaustedRetriesEvent) {
        this.onExhaustedRetriesEvent();
      }
    }
  }

  public disconnect(): void {
    if (this.isConnected) {
      this.retryConnection = false;
      this.obs.disconnect();
    }
  }

  public toggleConnection(): void {
    if (!this.isConnected) {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  public switchScene(sceneName: string, transitionDuration: number = this.originalTransitionDuration, getCurrent: boolean = true): void {
    this.outputChannel.appendLine(`Setting transition duration to ${transitionDuration}ms...`);
    this.setTransitionDuration(transitionDuration, true)
      .then(() => {
        this.outputChannel.appendLine(`Set transition duration to ${transitionDuration}.`);
        this.outputChannel.appendLine(`Switching scene to '${sceneName}'...`);
        this.hasSceneSwitched = getCurrent;
        this.setScene(sceneName, getCurrent)
          .then(() => {
            this.outputChannel.appendLine(`Switched scene to ${sceneName}.'`);
          });
      });
  }

  public revertSwitchScene(transitionDuration: number = this.originalTransitionDuration): void {
    if (this.hasSceneSwitched) {
      this.switchScene(this.originalScene, this.originalTransitionDuration, false);
    }
  }

  public dispose() {
    this.disconnect();
  }

  private connectionOpened() {
    this.isConnected = true;
    this.isConnecting = false;
    this.retryConnection = true;
    this.retryCount = 0;
    this.outputChannel.appendLine(`Connected to OBS Studio!`);
    this.obs.send('GetVersion').then((info: OBSVersionInfoResponse) => this.showVersionInfo(info));
    if (this.onConnectedEvent) {
      this.onConnectedEvent();
    }
  }

  private connectionClosed() {
    if (this.isConnected) {
      this.isConnected = false;
      this.outputChannel.appendLine(`Disconnected from OBS Studio.`);
      if (this.onDisconnectedEvent) {
        this.onDisconnectedEvent();
      }  
      if (this.retryConnection) {
        this.connect(false);
      }
    } else if (!this.isConnecting || !this.authFailed) {
      this.outputChannel.appendLine(`A connection with OBS Studio could not be established. Retrying in 5 seconds...`);
      setTimeout(() => this.connect(false), 5000);
    }
  }

  private authenticationFailure() {
    this.outputChannel.appendLine(`Failed to authenticate with the OBS Websocket server. Disconnecting...`);
    this.authFailed = true;
  }

  private showVersionInfo(versionInfo: OBSVersionInfoResponse) {
    this.outputChannel.appendLine(`OBS Studio Version: ${versionInfo.obsStudioVersion}`);
    this.outputChannel.appendLine(`OBS Studio Websocket Version: ${versionInfo.obsWebsocketVersion}`);
  }

  private connectionError(err: any) {
     // If the error is undefined or an authentication failure
     // return
    if(!err || err.messageId === '2') { return; }
    // retry the connection after 5 seconds
    setTimeout(() => this.connect(false), 5000);
  }

  private async setTransitionDuration(duration: number, getCurrent: boolean = true): Promise<void> {
    if (getCurrent) {
      await this.obs.send('GetTransitionDuration')
        .then((response: OBSTransitionDurationResponse) => this.originalTransitionDuration = response.transitionDuration);
    }
    return this.obs.send('SetTransitionDuration', { duration });
  }

  private async setScene(scene: string, getCurrent: boolean = true): Promise<void> {
    if (getCurrent) {
      await this.obs.send('GetCurrentScene')
        .then((response: OBSCurrentSceneResponse) => this.originalScene = response.name);
    }
    return this.obs.send('SetCurrentScene', {
      'scene-name': scene,
      'sceneName': scene
    });
  }
}

export default SwitchSceneManager;