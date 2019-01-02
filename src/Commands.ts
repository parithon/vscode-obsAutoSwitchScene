import Constants from "./Constants";

export class Commands {
  public static ToggleCommand = `${Constants.Namespace}.toggleCommand`;
  public static StartCommand = `${Constants.Namespace}.startConnection`;
  public static StopCommand = `${Constants.Namespace}.stopConnection`;
  public static AddFileToSecrets = `${Constants.Namespace}.addFileToSecrets`;
  public static RemoveFileFromSecrets = `${Constants.Namespace}.removeFileFromSecrets`;
}

export default Commands;