
import * as keytartype from 'keytar';
import { getNodeModule } from './NodeModules';

const OBSWebsocketService: string = "OBS Websocket Server";

export class CredentialManager {
  private static keytar: typeof keytartype | undefined = getNodeModule<typeof keytartype>('keytar');
  public static async setPassword(serviceUrl: string, value: string): Promise<void> {
    if (CredentialManager.keytar && value !== null) {
      await CredentialManager.keytar.setPassword(OBSWebsocketService, serviceUrl, value);
    }
  }
  public static async deletePassword(serviceUrl: string): Promise<boolean> {
    if (CredentialManager.keytar) {
      return await CredentialManager.keytar.deletePassword(OBSWebsocketService, serviceUrl);
    }
    return false;
  }
  public static async getPassword(serviceUrl: string): Promise<string | null> {
    if (CredentialManager.keytar) {
      return await CredentialManager.keytar.getPassword(OBSWebsocketService, serviceUrl);
    }
    return null;
  }
  public static async findPassword(): Promise<string | null> {
    if (CredentialManager.keytar) {
      return await CredentialManager.keytar.findPassword(OBSWebsocketService);
    }
    return null;
  }
}

export default CredentialManager;