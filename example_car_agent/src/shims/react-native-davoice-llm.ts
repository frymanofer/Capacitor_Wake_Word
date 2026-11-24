// 'react-native-davoice-llm' -> cordova-voice2voice / capacitor-voice2voice: window.DaVoiceLLM has the same exports.
const L = (window as any).DaVoiceLLM;
export const Agent = L.Agent;
export const generateStream = L.generateStream;
export const cancel = L.cancel;
export const prefill = L.prefill;
export const loadModel = L.loadModel;
export const unloadModel = L.unloadModel;
export const isModelLoaded = L.isModelLoaded;
export const loadState = L.loadState;
export const saveState = L.saveState;
export const setLicense = L.setLicense;
export const loadLayer2Model = L.loadLayer2Model;
export const unloadLayer2Model = L.unloadLayer2Model;
export const isLayer2ModelLoaded = L.isLayer2ModelLoaded;
export const toolReply = L.toolReply;
export const defineTool = L.defineTool;
export const runToolTurn = L.runToolTurn;
export const toolsSystemPrompt = L.toolsSystemPrompt;
export const connectMcpServer = L.connectMcpServer;
export const McpClient = L.McpClient;
export const ToolReply = L.ToolReply;
// Types (compile-time only in this app).
export type Agent = any; export type AgentApprovalRequest = any; export type AgentConfig = any; export type AgentEvent = any;
export type AgentHistoryMessage = any; export type AgentRemoteRequest = any; export type ToolChoice = any; export type ToolDefinition = any;
export type ToolTurnMessage = any; export type TurnResult = any;
