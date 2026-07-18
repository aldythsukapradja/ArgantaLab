// Claude engine — drives @anthropic-ai/claude-agent-sdk. This is the original
// Bridge behaviour, unchanged, now behind the MissionEngine interface. MUST use
// streaming-input mode (async generator) so canUseTool fires; mcpServers is a
// Record, not an array.
import { query, type SDKMessage, type SDKUserMessage, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { classify, toolLabel } from '../permissions.ts';
import type { MissionEngine, EngineContext, MissionResult } from './types.ts';

export function createClaudeEngine(mcpServers: Record<string, any>, defaultModel?: string): MissionEngine {
  return {
    name: 'Claude Code',
    async run(ctx: EngineContext): Promise<MissionResult> {
      ctx.send({ type: 'status', label: 'Planning mission', missionId: ctx.missionId });

      async function* input(): AsyncIterable<SDKUserMessage> {
        yield {
          type: 'user',
          session_id: ctx.missionId,
          parent_tool_use_id: null,
          message: { role: 'user', content: ctx.prompt },
        } as SDKUserMessage;
      }

      const canUseTool = async (tool: string, toolInput: Record<string, unknown>): Promise<PermissionResult> => {
        if (classify(tool, toolInput) === 'auto') {
          ctx.send({ type: 'tool', tool, label: toolLabel(tool, toolInput), missionId: ctx.missionId });
          return { behavior: 'allow', updatedInput: toolInput };
        }
        const { approved, input: edited } = await ctx.gate(tool, toolInput, toolLabel(tool, toolInput));
        return approved
          ? { behavior: 'allow', updatedInput: (edited as Record<string, unknown>) ?? toolInput }
          : { behavior: 'deny', message: 'Denied by operator in HQ.' };
      };

      let ok = true;
      let result: string | undefined;
      let costUsd = 0;

      const q = query({
        prompt: input(),
        options: {
          cwd: ctx.cwd,
          model: ctx.model || defaultModel,
          mcpServers,
          canUseTool,
          permissionMode: 'default',
        },
      });

      for await (const m of q as AsyncIterable<SDKMessage>) {
        switch (m.type) {
          case 'system':
            if ((m as any).subtype === 'init') ctx.send({ type: 'status', label: 'Reading repository', missionId: ctx.missionId });
            break;
          case 'assistant':
            for (const block of (m as any).message?.content || []) {
              if (block.type === 'text' && block.text?.trim()) {
                ctx.send({ type: 'message', text: block.text, missionId: ctx.missionId });
              }
              // tool_use blocks are surfaced via canUseTool, not here (avoids dupes).
            }
            break;
          case 'result':
            ok = (m as any).subtype === 'success';
            result = (m as any).result;
            costUsd = (m as any).total_cost_usd || 0;
            break;
          default:
            break; // partial/status/hook frames: ignored for the feed
        }
      }

      return { ok, result, costUsd };
    },
  };
}
