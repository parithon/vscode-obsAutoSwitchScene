export default interface IOBSWebSocketProxy {
  connect(resetRetryCount?: boolean): void;
  disconnect(): void;
  toggleConnection(): void;
  gotoOriginalScene(): void;
  gotoSecretsScene(): void;
  dispose(): void;
  isConnected(): boolean;
  isConnecting(): boolean;
  switchedScene(): boolean;

  onConnectedEvent: () => void;
  onDisconnectedEvent: () => void;
  onExhaustedRetries: () => void;
}