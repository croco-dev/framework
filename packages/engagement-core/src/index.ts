/**
 * Typed message contracts and explicit, decorator-bound renderer registration for Croco engagement.
 */
export {
  defineMessage,
  MESSAGE_CHANNELS,
  MessageRendererRegistry,
  Renders,
  getMessageRendererBinding,
  MessageDataInvalidProblem,
  MessageDefinitionInvalidProblem,
  MessageRendererAlreadyRegisteredProblem,
  MessageRendererBindingMismatchProblem,
  MessageRendererChannelMissingProblem,
  MessageRendererMessageMissingProblem,
  MessageRendererMissingProblem,
  MessageRendererUndeclaredChannelProblem,
  MessageAlreadyRegisteredProblem,
} from "./libs/MessageContracts";
export type {
  DefinedMessage,
  EmailContent,
  MessageChannel,
  MessageContent,
  MessageContentByChannel,
  MessageContext,
  MessageData,
  MessageDefinitionInput,
  MessageDescriptor,
  MessageRenderer,
  MessageRendererBinding,
  MessageRendererConstructor,
  MessageRegistryInspection,
} from "./libs/MessageContracts";
