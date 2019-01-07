import { Constants } from './Constants';
export class Commands {
  public static ToggleCommand = `${Constants.Namespace}.toggleCommand`;
  public static StartCommand = `${Constants.Namespace}.startCommand`;
  public static StopCommand = `${Constants.Namespace}.stopCommand`;
  public static SetPasswordCommand = `${Constants.Namespace}.setPasswordCommand`;
  public static DeletePasswordCommand = `${Constants.Namespace}.deletePasswordCommand`;
  public static AddFilesToFileNamesCommand = `${Constants.Namespace}.addFilesToFileNamesCommand`;
  public static RemoveFilesFromFileNamesCommand = `${Constants.Namespace}.removeFilesFromFileNamesCommand`;
}
