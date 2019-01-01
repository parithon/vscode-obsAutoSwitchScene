# vscode-obs-websockets-secretsswitchscene
A Microsoft Visual Studio Code extension to switch OBS Studio scenes when you open a filename which has been designated to have secrets within its contents.

Master | Dev
:---: | :---:
[![Build Status](https://dev.azure.com/parithon/vscode-obs-websockets-secretsswitchscene/_apis/build/status/parithon.vscode-obs-websockets-secretsswitchscene?branchName=master)](https://dev.azure.com/parithon/vscode-obs-websockets-secretsswitchscene/_build/latest?definitionId=42?branchName=master) | [![Build Status](https://dev.azure.com/parithon/vscode-obs-websockets-secretsswitchscene/_apis/build/status/parithon.vscode-obs-websockets-secretsswitchscene?branchName=dev)](https://dev.azure.com/parithon/vscode-obs-websockets-secretsswitchscene/_build/latest?definitionId=42?branchName=dev)

## Features

- Start a connection to OBS using the command `Start connection to OBS-Studio`
- Stop a connection to OBS using the command `Stop connection to OBS-Studio`
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
* `obs.secretsSwitchScene.password`: The password to use while connecting to the OBS Websocket server.

## Known issues

No issues are known at this time.

## Release Notes

### 1.2.0

Added a status bar indicator to VSCode

### 1.1.0

Added the ability for the extension to manage the connection state and try to reconnect up to 5 times.
Also added commands to start and stop the connection manually.

### 1.0.0

Initial release