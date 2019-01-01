# vscode-obs-websockets-secretsswitchscene
A Microsoft Visual Studio Code extension to switch OBS Studio scenes when you open a filename which has been designated to have secrets within its contents.

## Features

- Switches scenes if the filename opened by the editor matches filenames set in your workspace settings.
- Switches scenes without any transition in order to ensure the scene switches as quickly as possible.
- Automatically switches back to the original scene when you either close or switch tabs from the filename identified above.

![example](images/example.gif)

## Requirements

This extension has a dependency on the following OBS plugin: [OBS-WebSocket 4.4.0](
https://github.com/Palakis/obs-websocket)

## Extension Settings

This extension contributes the following settings:

* `obs.secretsSwitchScene.socketsUrl`: The OBS Websocket URL and Port. (localhost:4444)
* `obs.secretsSwitchScene.fileNames`: A list of filenames that contain secrets.
* `obs.secretsSwitchScene.scene`: The scene to automatically switch to if a file containing secrets is opened.
* `obs.secretsSwitchScene.autoSwitchBack`: Automatically switch back to the previous scene after you close the file containing secrets.

## Known issues

- The plugin will only work if OBS is open and the Websockets server is enabled prior to loading VSCode.
- No connection state tracking of the websockets is currently in place. If the connection is lost you will have to reload VSCode.

## Release Notes

### 1.0.0

Initial release