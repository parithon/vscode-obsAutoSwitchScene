export class SwitchSceneSettingsOptions {
  public static ServiceUrl = `serviceUrl`;
  public static UsePassword = `usePassword`;
  public static AutoSwitchBack = `autoSwitchBack`;
  public static Scene = `scene`;
  public static FileNames = `fileNames`;
}

export interface SwitchSceneSettings {
  /**
   * The URL and Port to use when connecting to
   * OBS' Websocket server
   */
  serviceUrl: string;
  /**
   * Instructs the extension to use the local
   * operating systems Keystore to store a 
   * password and use that password when
   * connecting to the OBS Websocket server
   */
  usePassword: boolean;
  autoSwitchBack: boolean;
  scene: string;
  fileNames: string[];
}