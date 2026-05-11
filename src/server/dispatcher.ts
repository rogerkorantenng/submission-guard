import type { Context } from '@devvit/public-api';
import type { RpcRequest } from '@shared/rpc';
import { whoami } from './api/whoami';
import { enforcementListHandler } from './api/enforcement';
import { settingsGetHandler, settingsSaveHandler } from './api/settings';
import { statsGetHandler } from './api/stats';
import { previewHandler } from './api/preview';
import { reapproveHandler } from './api/reapprove';
import { presetsListHandler, presetApplyHandler } from './api/presets';
import { aiSummaryHandler } from './api/ai-summary';
import { simulatorHandler } from './api/simulator';

/**
 * Pure dispatch function: given an RpcRequest envelope and a Devvit
 * Context, run the matching API handler and return the wire payload.
 * Mod-permission checks are inlined inside each handler.
 */
export async function dispatch(context: Context, msg: RpcRequest): Promise<unknown> {
  switch (msg.type) {
    case 'whoami':
      return whoami(context);
    case 'enforcement:list':
      return enforcementListHandler(context, msg.payload);
    case 'settings:get':
      return settingsGetHandler(context);
    case 'settings:save':
      return settingsSaveHandler(context, msg.payload);
    case 'stats:get':
      return statsGetHandler(context);
    case 'preview':
      return previewHandler(context, msg.payload);
    case 'reapprove':
      return reapproveHandler(context, msg.payload);
    case 'presets:list':
      return presetsListHandler(context);
    case 'presets:apply':
      return presetApplyHandler(context, msg.payload);
    case 'ai:summary':
      return aiSummaryHandler(context, msg.payload);
    case 'simulator:run':
      return simulatorHandler(context, msg.payload);
    default:
      return { error: `unknown type: ${msg.type}` };
  }
}
