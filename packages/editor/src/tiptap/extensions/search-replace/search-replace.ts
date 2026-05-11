import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { clampMatchIndex, findPlainTextMatches } from "./search-replace-core";

export interface SearchReplaceMatch {
  from: number;
  to: number;
}

export interface SearchReplacePluginState {
  searchTerm: string;
  currentIndex: number;
  matches: SearchReplaceMatch[];
  decorations: DecorationSet;
}

interface SearchReplaceMeta {
  searchTerm?: string;
  currentIndex?: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setSearchCurrentIndex: (currentIndex: number) => ReturnType;
      goToNextSearchResult: () => ReturnType;
      goToPreviousSearchResult: () => ReturnType;
      replaceCurrentSearchResult: (replaceTerm: string) => ReturnType;
      replaceAllSearchResults: (replaceTerm: string) => ReturnType;
      clearSearchResults: () => ReturnType;
    };
  }
}

export const searchReplacePluginKey =
  new PluginKey<SearchReplacePluginState>("searchReplace");

const emptyPluginState = (doc: ProseMirrorNode): SearchReplacePluginState => ({
  searchTerm: "",
  currentIndex: 0,
  matches: [],
  decorations: DecorationSet.create(doc, []),
});

function findDocumentMatches(
  doc: ProseMirrorNode,
  searchTerm: string
): SearchReplaceMatch[] {
  if (searchTerm.length === 0) {
    return [];
  }

  const matches: SearchReplaceMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) {
      return;
    }

    for (const match of findPlainTextMatches(node.text, searchTerm)) {
      matches.push({
        from: pos + match.from,
        to: pos + match.to,
      });
    }
  });

  return matches;
}

function buildDecorations(
  doc: ProseMirrorNode,
  matches: readonly SearchReplaceMatch[],
  currentIndex: number
): DecorationSet {
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class:
        index === currentIndex
          ? "tiptap-search-result tiptap-search-result-current"
          : "tiptap-search-result",
    })
  );

  return DecorationSet.create(doc, decorations);
}

function buildPluginState({
  doc,
  searchTerm,
  currentIndex,
}: {
  doc: ProseMirrorNode;
  searchTerm: string;
  currentIndex: number;
}): SearchReplacePluginState {
  const matches = findDocumentMatches(doc, searchTerm);
  const safeCurrentIndex = clampMatchIndex(currentIndex, matches.length);

  return {
    searchTerm,
    currentIndex: safeCurrentIndex,
    matches,
    decorations: buildDecorations(doc, matches, safeCurrentIndex),
  };
}

function getMeta(tr: Transaction): SearchReplaceMeta | null {
  const meta = tr.getMeta(searchReplacePluginKey);
  if (!meta || typeof meta !== "object") {
    return null;
  }
  return meta as SearchReplaceMeta;
}

function resolveSearchTerm(
  previous: SearchReplacePluginState,
  meta: SearchReplaceMeta | null
): string {
  return typeof meta?.searchTerm === "string"
    ? meta.searchTerm
    : previous.searchTerm;
}

function resolveCurrentIndex(
  previous: SearchReplacePluginState,
  meta: SearchReplaceMeta | null
): number {
  return typeof meta?.currentIndex === "number"
    ? meta.currentIndex
    : previous.currentIndex;
}

function getPluginState(state: EditorState): SearchReplacePluginState {
  return searchReplacePluginKey.getState(state) ?? emptyPluginState(state.doc);
}

export function getSearchReplaceState(
  state: EditorState
): SearchReplacePluginState {
  return getPluginState(state);
}

export const SearchReplace = Extension.create({
  name: "searchReplace",

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ state, tr, dispatch }) => {
          const nextState = buildPluginState({
            doc: state.doc,
            searchTerm,
            currentIndex: 0,
          });

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              searchTerm,
              currentIndex: nextState.currentIndex,
            });
            dispatch(tr);
          }
          return true;
        },
      setSearchCurrentIndex:
        (currentIndex: number) =>
        ({ state, tr, dispatch }) => {
          const pluginState = getPluginState(state);
          const nextIndex = clampMatchIndex(
            currentIndex,
            pluginState.matches.length
          );

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { currentIndex: nextIndex });
            dispatch(tr);
          }
          return true;
        },
      goToNextSearchResult:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = getPluginState(state);
          if (pluginState.matches.length === 0) {
            return false;
          }

          const nextIndex =
            (pluginState.currentIndex + 1) % pluginState.matches.length;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { currentIndex: nextIndex });
            dispatch(tr);
          }
          return true;
        },
      goToPreviousSearchResult:
        () =>
        ({ state, tr, dispatch }) => {
          const pluginState = getPluginState(state);
          if (pluginState.matches.length === 0) {
            return false;
          }

          const nextIndex =
            (pluginState.currentIndex - 1 + pluginState.matches.length) %
            pluginState.matches.length;

          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, { currentIndex: nextIndex });
            dispatch(tr);
          }
          return true;
        },
      replaceCurrentSearchResult:
        (replaceTerm: string) =>
        ({ state, tr, dispatch }) => {
          const pluginState = getPluginState(state);
          const match = pluginState.matches.at(pluginState.currentIndex);
          if (!match) {
            return false;
          }

          if (dispatch) {
            tr.insertText(replaceTerm, match.from, match.to);
            tr.setMeta(searchReplacePluginKey, {
              currentIndex: pluginState.currentIndex,
            });
            dispatch(tr);
          }
          return true;
        },
      replaceAllSearchResults:
        (replaceTerm: string) =>
        ({ state, tr, dispatch }) => {
          const pluginState = getPluginState(state);
          if (pluginState.matches.length === 0) {
            return false;
          }

          if (dispatch) {
            for (const match of pluginState.matches.toReversed()) {
              tr.insertText(replaceTerm, match.from, match.to);
            }
            tr.setMeta(searchReplacePluginKey, { currentIndex: 0 });
            dispatch(tr);
          }
          return true;
        },
      clearSearchResults:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              searchTerm: "",
              currentIndex: 0,
            });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchReplacePluginState>({
        key: searchReplacePluginKey,
        state: {
          init: (_, state) => emptyPluginState(state.doc),
          apply: (tr, previous, _oldState, newState) => {
            const meta = getMeta(tr);
            if (!meta && !tr.docChanged) {
              return previous;
            }

            return buildPluginState({
              doc: newState.doc,
              searchTerm: resolveSearchTerm(previous, meta),
              currentIndex: resolveCurrentIndex(previous, meta),
            });
          },
        },
        props: {
          decorations: (state) => getPluginState(state).decorations,
        },
      }),
    ];
  },
});
