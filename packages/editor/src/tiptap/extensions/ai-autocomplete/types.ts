export interface AICompletionProvider {
  complete: (
    prompt: string,
    options?: Record<string, unknown>
  ) => Promise<string | null | undefined>;
  completion: string;
  isLoading: boolean;
}

export interface AIAutocompleteOptions {
  /**
   * 是否启用自动补全
   */
  enabled?: boolean;

  /**
   * 触发接受建议的按键
   */
  acceptKeys?: string[];

  /**
   * 取消建议的按键
   */
  dismissKey?: string;

  /**
   * 请求新建议的按键
   */
  requestKey?: string;

  /**
   * 最大 token 数
   */
  maxTokens?: number;

  /**
   * AI 温度参数
   */
  temperature?: number;

  /**
   * 停止序列
   */
  stopSequences?: string[];

  /**
   * 自定义提示模板函数
   */
  promptTemplate?: (text: string) => string;

  /**
   * 补全结果后处理函数
   */
  postProcess?: (completion: string) => string;

  /**
   * AI 模型名称
   */
  model?: string;
}

export interface GhostTextPosition {
  top: number;
  left: number;
}

export interface AIAutocompleteState {
  pendingCompletion: string;
  ghostPosition: GhostTextPosition | null;
  isEnabled: boolean;
}
